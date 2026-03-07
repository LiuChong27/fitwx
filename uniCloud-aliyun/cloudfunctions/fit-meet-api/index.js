'use strict';
const db = uniCloud.database();
const dbCmd = db.command;
const needsCollection = db.collection('fit-needs');
const coachesCollection = db.collection('fit-coaches');
const bookingsCollection = db.collection('fit-bookings');
const notificationsCol = db.collection('fit-notifications');
const usersCol = db.collection('uni-id-users');

// ──────────────────────────────────────
// 工具函数
// ──────────────────────────────────────
const success = (data) => ({ code: 0, msg: 'success', data });
const fail = (msg) => ({ code: -1, msg });

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
			if (sportType && sportType !== '全部类型') {
				// "球类" 约定为包含匹配，其余为精确匹配
				if (sportType === '球类') {
					queryObj.sport_type = db.command.regex({ regexp: '球' });
				} else {
					queryObj.sport_type = sportType;
				}
			}
			const needsRes = await needsCollection.where(queryObj)
				.orderBy('create_date', 'desc')
				.skip(params.skip || 0)
				.limit(params.limit || 20)
				.get();
			return success(needsRes.data);
		}

		case 'publishNeed': {
			const uid = await requireAuth();
			if (!uid) return fail('请先登录');

			if (!params.sport_type || !params.desc) return fail('主要信息不能为空');

			// 关键：昵称/头像由后端基于 uid 获取，避免前端伪造
			let userInfo = { nickname: '微信用户', avatar: '' };
			try {
				const userRes = await usersCol.doc(uid).field({ nickname: 1, avatar: 1, avatar_file: 1 }).get();
				if (userRes.data && userRes.data.length > 0) {
					const u = userRes.data[0];
					userInfo = {
						nickname: u.nickname || '微信用户',
						avatar: u.avatar || (u.avatar_file && u.avatar_file.url) || ''
					};
				}
			} catch (e) {
				console.warn('[fit-meet-api] fetch user info failed:', e);
			}

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
				location_geo: params.location_geo || null,
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

			const updateData = {
				update_date: Date.now(),
			};
			if (params.sport_type !== undefined) updateData.sport_type = params.sport_type;
			if (params.fee_type !== undefined) updateData.fee_type = params.fee_type;
			if (params.date_str !== undefined) updateData.date_str = params.date_str;
			if (params.desc !== undefined) updateData.desc = params.desc;
			if (params.location_name !== undefined) updateData.location_name = params.location_name;
			if (params.location_address !== undefined) updateData.location_address = params.location_address;
			if (params.location_geo !== undefined) updateData.location_geo = params.location_geo;

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
			return success(coachRes.data);
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
				let fromNickname = '用户';
				const fromRes = await usersCol.doc(uid).field({ nickname: 1 }).get();
				if (fromRes.data && fromRes.data.length > 0) {
					fromNickname = fromRes.data[0].nickname || '用户';
				}
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
			if (!bookingId || ![1, 2].includes(status)) return fail('参数错误');
			// status: 1=已接受, 2=已拒绝

			const bookingRes = await bookingsCollection.doc(bookingId).get();
			if (!bookingRes.data || bookingRes.data.length === 0) return fail('预约不存在');
			const booking = bookingRes.data[0];
			if (booking.coach_id !== uid) return fail('无权操作');

			await bookingsCollection.doc(bookingId).update({
				status,
				update_date: Date.now(),
			});

			// >>> 发送通知给约练者 <<<
			try {
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
			} catch (e) {
				console.warn('[fit-meet-api] create status notification failed:', e);
			}

			return success({ status });
		}

		default:
			return fail('Unknown action: ' + action);
	}
};
