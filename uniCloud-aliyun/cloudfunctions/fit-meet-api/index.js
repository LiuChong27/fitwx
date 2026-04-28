'use strict';
const db = uniCloud.database();
const dbCmd = db.command;
const needsCollection = db.collection('fit-needs');
const coachesCollection = db.collection('fit-coaches');
const bookingsCollection = db.collection('fit-bookings');
const notificationsCol = db.collection('fit-notifications');
const usersCol = db.collection('uni-id-users');
const profilesCol = db.collection('fit-user-profiles');
const MAX_MEET_DISTANCE_KM = 10;

// ──────────────────────────────────────
// 工具函数
// ──────────────────────────────────────
const success = (data) => ({ code: 0, msg: 'success', data });
const fail = (msg) => ({ code: -1, msg });

function calcDistance(lat1, lng1, lat2, lng2) {
	const R = 6371;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
		Math.sin(dLng / 2) * Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function normalizePoint(locationGeo) {
	if (!locationGeo) return null;
	if (Array.isArray(locationGeo.coordinates) && locationGeo.coordinates.length >= 2) {
		const lng = Number(locationGeo.coordinates[0]);
		const lat = Number(locationGeo.coordinates[1]);
		if (Number.isFinite(lat) && Number.isFinite(lng)) {
			return { lat, lng };
		}
	}
	if (typeof locationGeo.longitude !== 'undefined' && typeof locationGeo.latitude !== 'undefined') {
		const lng = Number(locationGeo.longitude);
		const lat = Number(locationGeo.latitude);
		if (Number.isFinite(lat) && Number.isFinite(lng)) {
			return { lat, lng };
		}
	}
	return null;
}

function formatBookingStatus(status) {
	const numericStatus = Number(status);
	if (numericStatus === 1) return '已确认';
	if (numericStatus === 2) return '已拒绝';
	if (numericStatus === 3) return '已完成';
	return '待确认';
}

function resolveUserAvatar(user = {}) {
	return user.avatar_url || user.avatarUrl || (user.avatar_file && user.avatar_file.url) || user.avatar || '';
}

function normalizeDisplayProfile(uid, profile = {}, user = {}, fallback = {}) {
	return {
		uid,
		nickname: profile.nickname || user.nickname || fallback.nickname || '用户',
		avatar: resolveUserAvatar(profile) || resolveUserAvatar(user) || fallback.avatar || '',
	};
}

async function getDisplayProfileMap(userIds = []) {
	const ids = Array.from(new Set((userIds || []).filter(Boolean)));
	if (!ids.length) return {};

	const [profileRes, userRes] = await Promise.all([
		profilesCol.where({ uid: dbCmd.in(ids) }).field({ uid: 1, nickname: 1, avatar_url: 1 }).limit(ids.length).get(),
		usersCol.where({ _id: dbCmd.in(ids) }).field({ _id: 1, nickname: 1, avatar: 1, avatar_file: 1 }).limit(ids.length).get(),
	]);

	const profileMap = (profileRes.data || []).reduce((acc, item) => {
		acc[item.uid] = item;
		return acc;
	}, {});
	const userMap = (userRes.data || []).reduce((acc, item) => {
		acc[item._id] = item;
		return acc;
	}, {});

	return ids.reduce((acc, uid) => {
		acc[uid] = normalizeDisplayProfile(uid, profileMap[uid], userMap[uid]);
		return acc;
	}, {});
}

async function getDisplayProfile(uid, fallback = {}) {
	if (!uid) return normalizeDisplayProfile('', {}, {}, fallback);
	const map = await getDisplayProfileMap([uid]);
	return {
		...normalizeDisplayProfile(uid, {}, {}, fallback),
		...(map[uid] || {}),
	};
}

/**
 * 通过 uni-id-common 验证 token 获取 uid（企业级标准方案）
 * uniCloud 客户端 SDK 调用 callFunction 时会自动附带 uniIdToken
 */
async function getUid(event, context) {
	try {
		const uniIdCommon = require('uni-id-common');
		const uniID = uniIdCommon.createInstance({ context });
		// 兼容多端：token 可能存在 event 或 context
		const token = event.uniIdToken || context.uniIdToken || event.token || (event.headers && (event.headers.uniIdToken || event.headers['uni-id-token']));
		if (!token) {
			console.warn('[fit-meet-api] token missing in request');
			return null;
		}
		const payload = await uniID.checkToken(token);
		if (payload.errCode === 0) {
			return payload.uid;
		}
		console.warn('[fit-meet-api] checkToken errCode:', payload.errCode, payload.errMsg);
		return null;
	} catch (e) {
		console.error('[fit-meet-api] checkToken error:', e);
		return null;
	}
}

exports.main = async (event, context) => {
	const { action, params = {} } = event;

	// 对需要登录的操作延迟验证 token（避免读操作也验证影响性能）
	let _uid = undefined; // 惰性求值
	const requireAuth = async () => {
		if (_uid === undefined) {
			_uid = await getUid(event, context);
		}
		return _uid;
	};

	switch (action) {
		case 'getNeedsList': {
			// 读操作：无需登录
			const queryObj = {};
			const sportType = params.sportType;
			const requestLat = Number(params.lat);
			const requestLng = Number(params.lng);
			const hasRequesterPoint = Number.isFinite(requestLat) && Number.isFinite(requestLng);
			if (!hasRequesterPoint) {
				return success([]);
			}
			if (sportType && sportType !== '全部类型') {
				// "球类" 约定为包含匹配，其余为精确匹配
				if (sportType === '球类') {
					queryObj.sport_type = db.command.regex({ regexp: '球' });
				} else {
					queryObj.sport_type = sportType;
				}
			}
			const skip = Math.max(Number(params.skip) || 0, 0);
			const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 50);
			const batchSize = 100;
			let cursor = 0;
			let allVisible = [];
			let hasMoreBatches = true;

			while (hasMoreBatches) {
				const needsRes = await needsCollection.where(queryObj)
					.orderBy('create_date', 'desc')
					.skip(cursor)
					.limit(batchSize)
					.get();

				const batch = needsRes.data || [];
				if (!batch.length) {
					hasMoreBatches = false;
					break;
				}

				allVisible = allVisible.concat(batch.map(item => {
					const point = normalizePoint(item.location_geo);
					const distanceKm = point ? calcDistance(requestLat, requestLng, point.lat, point.lng) : null;
					return {
						...item,
						distanceKm,
						distance: Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null,
					};
				}).filter(item => Number.isFinite(item.distanceKm) && item.distanceKm <= MAX_MEET_DISTANCE_KM));

				cursor += batch.length;
				if (batch.length < batchSize) hasMoreBatches = false;
			}

			const list = allVisible.sort((a, b) => {
				const aDistance = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.MAX_SAFE_INTEGER;
				const bDistance = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.MAX_SAFE_INTEGER;
				if (aDistance !== bDistance) return aDistance - bDistance;
				return (b.create_date || 0) - (a.create_date || 0);
			}).slice(skip, skip + limit);

			const displayMap = await getDisplayProfileMap(list.map(item => item.uid));
			return success(list.map(item => {
				const display = displayMap[item.uid] || {};
				return {
					...item,
					nickname: display.nickname || item.nickname || '用户',
					avatar: display.avatar || item.avatar || '',
				};
			}));
		}

		case 'publishNeed': {
			const uid = await requireAuth();
			if (!uid) return fail('请先登录');

			if (!params.sport_type || !params.desc) return fail('主要信息不能为空');
			const publishPoint = normalizePoint(params.location_geo);
			if (!publishPoint) return fail('请选择学校或健身房附近地点');

			// 关键：昵称/头像由后端基于 uid 获取，优先使用“我的资料”中的最新信息。
			const userInfo = await getDisplayProfile(uid, { nickname: '微信用户', avatar: '' });

			const needData = {
				uid,
				nickname: userInfo.nickname,
				avatar: userInfo.avatar,
				sport_type: params.sport_type,
				fee_type: params.fee_type || '免费',
				date_str: params.date_str || '',
				desc: params.desc,
				location_name: params.location_name || '',
				location_address: params.location_address || '',
				location_geo: { type: 'Point', coordinates: [publishPoint.lng, publishPoint.lat] },
				create_date: Date.now()
			};

			await needsCollection.add(needData);
			return success({ msg: '发布成功' });
		}

		case 'updateNeed': {
			const uid = await requireAuth();
			if (!uid) return fail('请先登录');
			const { needId } = params;
			if (!needId) return fail('参数错误');
			// 仅允许更新自己的需求
			const existing = await needsCollection.doc(needId).get();
			if (!existing.data || existing.data.length === 0) return fail('需求不存在');
			const row = existing.data[0];
			if (row.uid !== uid) return fail('无权限');
			const nextPoint = params.location_geo !== undefined
				? normalizePoint(params.location_geo)
				: normalizePoint(row.location_geo);
			if (!nextPoint) return fail('请选择学校或健身房附近地点');

			const updateData = {
				update_date: Date.now(),
			};
			if (params.sport_type !== undefined) updateData.sport_type = params.sport_type;
			if (params.fee_type !== undefined) updateData.fee_type = params.fee_type;
			if (params.date_str !== undefined) updateData.date_str = params.date_str;
			if (params.desc !== undefined) updateData.desc = params.desc;
			if (params.location_name !== undefined) updateData.location_name = params.location_name;
			if (params.location_address !== undefined) updateData.location_address = params.location_address;
			if (params.location_geo !== undefined) updateData.location_geo = { type: 'Point', coordinates: [nextPoint.lng, nextPoint.lat] };

			await needsCollection.doc(needId).update(updateData);
			return success({ msg: '更新成功' });
		}

		case 'removeNeed': {
			const uid = await requireAuth();
			if (!uid) return fail('请先登录');
			const { needId } = params;
			if (!needId) return fail('参数错误');
			const existing = await needsCollection.doc(needId).get();
			if (!existing.data || existing.data.length === 0) return fail('需求不存在');
			const row = existing.data[0];
			if (row.uid !== uid) return fail('无权限');
			await needsCollection.doc(needId).remove();
			return success({ msg: '删除成功' });
		}

		case 'getCoachList': {
			const coachRes = await coachesCollection.limit(20).get();
			const coaches = coachRes.data || [];
			const displayMap = await getDisplayProfileMap(coaches.map(item => item.uid));
			return success(coaches.map(item => {
				const display = displayMap[item.uid] || {};
				const nickname = display.nickname || item.nickname || item.name || '教练';
				const avatar = display.avatar || item.avatar || '';
				return {
					...item,
					name: nickname,
					nickname,
					avatar,
				};
			}));
		}

		case 'getMyMeetStats': {
			const uid = await requireAuth();
			if (!uid) return fail('请先登录');

			const [needsRes, bookingPendingRes, bookingAcceptedRes] = await Promise.all([
				needsCollection.where({ uid }).count(),
				bookingsCollection.where({ user_id: uid, status: 0 }).count(),
				bookingsCollection.where({ user_id: uid, status: 1 }).count(),
			]);

			const needsCount = needsRes.total || 0;
			const pendingBookingCount = bookingPendingRes.total || 0;
			const acceptedBookingCount = bookingAcceptedRes.total || 0;

			return success({
				needsCount,
				pendingBookingCount,
				acceptedBookingCount,
				bookingCount: pendingBookingCount + acceptedBookingCount,
				totalCount: needsCount + pendingBookingCount + acceptedBookingCount,
			});
		}

		case 'getMyMeetList': {
			const uid = await requireAuth();
			if (!uid) return fail('请先登录');

			const scope = String(params.scope || 'created');
			const page = Math.max(Number(params.page) || 1, 1);
			const pageSize = Math.min(Math.max(Number(params.pageSize) || 10, 1), 50);
			const skip = (page - 1) * pageSize;

			if (!['created', 'joined'].includes(scope)) return fail('scope 参数错误');

			if (scope === 'created') {
				const res = await needsCollection.where({ uid })
					.orderBy('create_date', 'desc')
					.skip(skip)
					.limit(pageSize)
					.get();
				const totalRes = await needsCollection.where({ uid }).count();
				const displayMap = await getDisplayProfileMap((res.data || []).map(item => item.uid));
				const list = (res.data || []).map(item => {
					const display = displayMap[item.uid] || {};
					return {
						entryType: 'need',
						id: item._id,
						needId: item._id,
						uid: item.uid,
						nickname: display.nickname || item.nickname || '我',
						avatar: display.avatar || item.avatar || '',
						sport_type: item.sport_type || '健身',
						fee_type: item.fee_type || '免费',
						date_str: item.date_str || '',
						desc: item.desc || '',
						location_name: item.location_name || '',
						location_address: item.location_address || '',
						location_geo: item.location_geo || null,
						create_date: item.create_date || 0,
					};
				});

				return success({
					list,
					page,
					pageSize,
					total: totalRes.total || 0,
					hasMore: skip + list.length < (totalRes.total || 0),
				});
			}

			const status = String(params.status || 'all');
			const where = { user_id: uid };
			if (status !== 'all') {
				where.status = Number(status);
			}

			const bookingRes = await bookingsCollection.where(where)
				.orderBy('create_date', 'desc')
				.skip(skip)
				.limit(pageSize)
				.get();
			const totalRes = await bookingsCollection.where(where).count();
			const bookingList = bookingRes.data || [];
			const coachIds = Array.from(new Set(bookingList.map(item => item.coach_id).filter(Boolean)));
			let coachMap = {};
			if (coachIds.length) {
				coachMap = await getDisplayProfileMap(coachIds);
			}

			const list = bookingList.map(item => {
				const coachSnapshot = coachMap[item.coach_id] || {};
				return {
					entryType: 'booking',
					id: item._id,
					bookingId: item._id,
					targetUserId: item.coach_id || '',
					targetNickname: coachSnapshot.nickname || item.coach_name || '教练',
					targetAvatar: coachSnapshot.avatar || '',
					project: item.project || '私教课程',
					note: item.note || '',
					status: Number(item.status || 0),
					statusLabel: formatBookingStatus(item.status),
					create_date: item.create_date || 0,
				};
			});

			return success({
				list,
				page,
				pageSize,
				total: totalRes.total || 0,
				hasMore: skip + list.length < (totalRes.total || 0),
			});
		}

		case 'bookCoach': {
			const uid = await requireAuth();
			if (!uid) return fail('请先登录');

			const bookingData = {
				user_id: uid,
				coach_id: params.coach_id,
				coach_name: params.coach_name,
				project: params.project,
				note: params.note || '',
				status: 0, // 待确认
				create_date: Date.now()
			};
			await bookingsCollection.add(bookingData);

			// >>> 发送通知给教练 <<<
			try {
				const fromInfo = await getDisplayProfile(uid, { nickname: '用户', avatar: '' });
				const fromNickname = fromInfo.nickname || '用户';
				await notificationsCol.add({
					toUserId: params.coach_id,
					fromUserId: uid,
					type: 'apply',
					title: '新的预约申请',
					content: `${fromNickname} 预约了你的「${params.project || '私教课程'}」`,
					meetId: '',
					meetTitle: params.project || '',
					isRead: false,
					readAt: null,
					createdAt: Date.now(),
				});
			} catch (e) {
				console.warn('[fit-meet-api] create booking notification failed:', e);
			}

			return success({ msg: '预约已提交' });
		}

		// >>> 教练处理预约状态 <<<
		case 'updateBookingStatus': {
			const uid = await requireAuth();
			if (!uid) return fail('请先登录');

			const { bookingId, status } = params;
			if (!bookingId || ![1, 2, 3].includes(status)) return fail('参数错误');
			// status: 1=已接受, 2=已拒绝, 3=已取消（用户主动取消）

			const bookingRes = await bookingsCollection.doc(bookingId).get();
			if (!bookingRes.data || bookingRes.data.length === 0) return fail('预约不存在');
			const booking = bookingRes.data[0];

			// 取消预约只能本人操作，接受/拒绝只能教练操作
			if (status === 3) {
				if (booking.user_id !== uid) return fail('无权操作');
			} else {
				if (booking.coach_id !== uid) return fail('无权操作');
			}

			await bookingsCollection.doc(bookingId).update({
				status,
				update_date: Date.now(),
			});

			// 发送通知
			try {
				if (status === 1 || status === 2) {
					const type = status === 1 ? 'accepted' : 'rejected';
					const title = status === 1 ? '预约已通过' : '预约未通过';
					const coachName = booking.coach_name || '教练';
					const content = status === 1
						? `${coachName} 已接受你的「${booking.project || '私教课程'}」预约`
						: `${coachName} 未能接受你的「${booking.project || '私教课程'}」预约`;
					await notificationsCol.add({
						toUserId: booking.user_id,
						fromUserId: uid,
						type,
						title,
						content,
						meetId: bookingId,
						meetTitle: booking.project || '',
						isRead: false,
						readAt: null,
						createdAt: Date.now(),
					});
				} else if (status === 3) {
					// 用户取消预约，通知教练
					const userName = booking.user_name || '用户';
					const content = `${userName} 已取消「${booking.project || '私教课程'}」预约`;
					await notificationsCol.add({
						toUserId: booking.coach_id,
						fromUserId: uid,
						type: 'cancelled',
						title: '预约已取消',
						content,
						meetId: bookingId,
						meetTitle: booking.project || '',
						isRead: false,
						readAt: null,
						createdAt: Date.now(),
					});
				}
			} catch (e) {
				console.warn('[fit-meet-api] create status notification failed:', e);
			}

			return success({ status });
		}

		default:
			return fail('Unknown action: ' + action);
	}
};
