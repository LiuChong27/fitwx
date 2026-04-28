'use strict';
const db = uniCloud.database();
const dbCmd = db.command;
const {
	IMAGE_AUDIT_STATUS,
	createImageAuditTraceId,
	getUserMpWeixinOpenid,
	submitImageAuditTask,
} = require('fit-wechat-security');

// ──────────────────────────────────────
// 集合引用
// ──────────────────────────────────────
const profilesCol  = db.collection('fit-user-profiles');
const workoutsCol   = db.collection('fit-workout-logs');
const baCol         = db.collection('fit-before-after');
const coachSetCol   = db.collection('fit-coach-settings');
const studentsCol   = db.collection('fit-coach-students');
const incomeCol     = db.collection('fit-income-records');
const convsCol      = db.collection('fit-conversations');
const msgsCol       = db.collection('fit-messages');
const usersCol      = db.collection('uni-id-users');

// ──────────────────────────────────────
// 工具函数
// ──────────────────────────────────────
const success = (data, msg = 'success') => ({ code: 0, msg, data });
const fail    = (msg, code = -1)        => ({ code, msg });

function buildUnreadCountMap(members = [], source = {}) {
	const map = { ...(source || {}) };
	members.forEach(memberId => {
		const current = Number(map[memberId] || 0);
		map[memberId] = Number.isFinite(current) && current > 0 ? current : 0;
	});
	return map;
}

function getUnreadCountForUser(conversation = {}, uid) {
	if (!uid) return 0;
	const unreadMap = buildUnreadCountMap(conversation.members || [], conversation.unread_count_map || {});
	return Number(unreadMap[uid] || 0);
}

/** 获取当月起止时间戳 */
function getMonthRange() {
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
	const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
	return { start, end };
}

/** 相对时间描述 */
function relativeTime(ts) {
	if (!ts) return '未知';
	const diff = Date.now() - ts;
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return '刚刚';
	if (minutes < 60) return minutes + '分钟前';
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return hours + '小时前';
	const days = Math.floor(hours / 24);
	if (days < 30) return days + '天前';
	const months = Math.floor(days / 30);
	return months + '个月前';
}

/** 格式化日期为 MM-DD HH:mm */
function formatDate(ts) {
	if (!ts) return '';
	const d = new Date(ts);
	const M  = String(d.getMonth() + 1).padStart(2, '0');
	const D  = String(d.getDate()).padStart(2, '0');
	const h  = String(d.getHours()).padStart(2, '0');
	const m  = String(d.getMinutes()).padStart(2, '0');
	return `${M}-${D} ${h}:${m}`;
}

// ──────────────────────────────────────
// 主入口
// ──────────────────────────────────────
exports.main = async (event, context) => {
	const { action, params = {} } = event;

	// ── 通过 uni-id-common 验证 token 获取 uid（企业级标准方案） ──
	let uid = null;
	try {
		const uniIdCommon = require('uni-id-common');
		const uniID = uniIdCommon.createInstance({ context });
		const payload = await uniID.checkToken(event.uniIdToken);
		if (payload.errCode === 0) {
			uid = payload.uid;
		}
	} catch (e) {
		console.error('[fit-ucenter-api] checkToken error:', e.message);
	}

	try {
		switch (action) {

			// ==========================================
			// 用户资料
			// ==========================================

			/** 获取当前用户资料 */
			case 'getProfile': {
				if (!uid) return fail('请先登录');

				const res = await profilesCol.where({ uid }).limit(1).get();
				if (res.data && res.data.length > 0) {
					const p = res.data[0];
					return success({
						nickname:   p.nickname || '',
							gender:     p.gender || '',
							age:        typeof p.age === 'number' ? p.age : null,
						city:       p.city || '',
						singleCert: !!p.single_cert,
						gyms:       p.gyms || [],
						coverUrl:   p.cover_url || '',
						avatarUrl:  p.avatar_url || '',
						bio:        p.bio || '',
						isCoach:    !!p.is_coach,
					});
				}

				// 首次访问：从 uni-id-users 拉取基础信息自动建档
				let baseInfo = {};
				try {
					const userRes = await usersCol.doc(uid).field({
						nickname: 1, avatar: 1, gender: 1, avatar_file: 1
					}).get();
					if (userRes.data && userRes.data.length > 0) {
						baseInfo = userRes.data[0];
					}
				} catch (_) { /* ignore */ }

					let derivedGender = '';
					if (baseInfo.gender === 1) derivedGender = '男';
					if (baseInfo.gender === 2) derivedGender = '女';

					const newProfile = {
					uid,
					nickname:   baseInfo.nickname || '',
						gender:     derivedGender,
						age:        null,
					city:       '',
					single_cert: false,
					gyms:       [],
					cover_url:  '',
					avatar_url: baseInfo.avatar || (baseInfo.avatar_file && baseInfo.avatar_file.url) || '',
					bio:        '',
					is_coach:   false,
					create_date: Date.now(),
				};
				await profilesCol.add(newProfile);

				return success({
					nickname:   newProfile.nickname,
					gender:     newProfile.gender,
					age:        newProfile.age,
					city:       newProfile.city,
					singleCert: false,
					gyms:       [],
					coverUrl:   '',
					avatarUrl:  newProfile.avatar_url,
					bio:        '',
					isCoach:    false,
				});
			}

			/** 更新用户资料 */
			case 'updateProfile': {
				if (!uid) return fail('请先登录');

				const {
					nickname, gender, age, city, singleCert,
					gyms, coverUrl, avatarUrl, bio
				} = params;

				// 校验
				if (nickname !== undefined) {
					const trimmed = (nickname || '').trim();
					if (trimmed.length < 2 || trimmed.length > 20) {
						return fail('昵称长度应在2-20之间');
					}
				}
				if (age !== undefined) {
					const n = Number(age);
					if (!n || n < 12 || n > 80) return fail('年龄应在12-80之间');
				}
				if (gyms !== undefined && Array.isArray(gyms) && gyms.length > 6) {
					return fail('健身房最多6个');
				}

				const updateData = { update_date: Date.now() };
				if (nickname   !== undefined) updateData.nickname    = nickname.trim();
				if (gender     !== undefined) updateData.gender      = gender;
				if (age        !== undefined) updateData.age         = Number(age);
				if (city       !== undefined) updateData.city        = (city || '').trim();
				if (singleCert !== undefined) updateData.single_cert = !!singleCert;
				if (gyms       !== undefined) updateData.gyms        = gyms.slice(0, 6);
				if (coverUrl   !== undefined) updateData.cover_url   = coverUrl;
				if (avatarUrl  !== undefined) updateData.avatar_url  = avatarUrl;
				if (bio        !== undefined) updateData.bio         = (bio || '').trim();

				const existing = await profilesCol.where({ uid }).limit(1).get();
				if (existing.data && existing.data.length > 0) {
					await profilesCol.where({ uid }).update(updateData);
				} else {
					await profilesCol.add({ uid, ...updateData, create_date: Date.now() });
				}

				// 同步昵称和头像到 uni-id-users
				const syncFields = {};
				if (updateData.nickname)   syncFields.nickname = updateData.nickname;
				if (updateData.avatar_url) syncFields.avatar   = updateData.avatar_url;
				if (Object.keys(syncFields).length > 0) {
					try { await usersCol.doc(uid).update(syncFields); } catch (_) { /* ignore */ }
				}

				return success(params);
			}

			/** 上传图片到云存储 */
			case 'uploadImage': {
				if (!uid) return fail('请先登录');
				// 实际上传由客户端 uniCloud.uploadFile 完成
				// 此 action 仅用于记录或做额外处理
				const { fileUrl } = params;
				return success({ url: fileUrl });
			}

			// ==========================================
			// 训练统计
			// ==========================================

			/** 获取训练统计 */
			case 'getStats': {
				if (!uid) return fail('请先登录');

				const { start: monthStart } = getMonthRange();

				// 本月训练记录
				const logsRes = await workoutsCol.where({
					uid,
					create_date: dbCmd.gte(monthStart),
				}).get();

				const logs = logsRes.data || [];
				// 统计训练天数（按日去重）
				const daySet = new Set();
				const totalTimes = logs.length;
				let totalCalorie = 0;

				logs.forEach(log => {
					const d = new Date(log.create_date);
					daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
					totalCalorie += (log.calorie || 0);
				});

				return success({
					days:    daySet.size,
					times:   totalTimes,
					calorie: totalCalorie,
				});
			}

			/** 记录一次训练 */
			case 'logWorkout': {
				if (!uid) return fail('请先登录');

				const { type = 'gym', duration = 60, calorie = 1, note = '' } = params;

				await workoutsCol.add({
					uid,
					type,
					duration: Math.min(600, Math.max(1, Number(duration) || 60)),
					calorie:  Math.max(0, Number(calorie) || 1),
					note:     (note || '').slice(0, 200),
					create_date: Date.now(),
				});

				// 返回最新统计
				const { start: monthStart } = getMonthRange();
				const logsRes = await workoutsCol.where({
					uid,
					create_date: dbCmd.gte(monthStart),
				}).get();

				const logs = logsRes.data || [];
				const daySet = new Set();
				let totalCalorie = 0;
				logs.forEach(log => {
					const d = new Date(log.create_date);
					daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
					totalCalorie += (log.calorie || 0);
				});

				return success({
					days:    daySet.size,
					times:   logs.length,
					calorie: totalCalorie,
				});
			}

			// ==========================================
			// Before / After 对比照
			// ==========================================

			/** 获取对比照列表 */
			case 'getBeforeAfter': {
				if (!uid) return fail('请先登录');

				const res = await baCol.where({
					uid,
					status: 1,
				}).orderBy('create_date', 'desc').limit(20).get();

				const list = (res.data || []).map(item => ({
					id:     item._id,
					before: item.before,
					after:  item.after,
					note:   item.note || '',
					createdAt: item.create_date,
				}));

				return success(list);
			}

			/** 添加对比照 */
			case 'addBeforeAfter': {
				if (!uid) return fail('请先登录');

				const { before, after, note = '' } = params;
				if (!before || !after) return fail('请提供前后对比照片');

				const addRes = await baCol.add({
					uid,
					before,
					after,
					note: (note || '').slice(0, 200),
					status: 1,
					create_date: Date.now(),
				});

				return success({
					id:     addRes.id,
					before,
					after,
					note,
					createdAt: Date.now(),
				});
			}

			// ==========================================
			// 教练设置
			// ==========================================

			/** 获取教练接单设置 */
			case 'getCoachSettings': {
				if (!uid) return fail('请先登录');

				const res = await coachSetCol.where({ uid }).limit(1).get();
				if (res.data && res.data.length > 0) {
					const s = res.data[0];
					return success({
						available:  s.available !== false,
						price:      s.price || 120,
						skillsText: s.skills_text || '',
						intro:      s.intro || '',
					});
				}

				return success({
					available:  true,
					price:      120,
					skillsText: '',
					intro:      '',
				});
			}

			/** 更新教练接单设置 */
			case 'updateCoachSettings': {
				if (!uid) return fail('请先登录');

				const { available, price, skillsText, intro } = params;

				if (price !== undefined) {
					const p = Number(price);
					if (isNaN(p) || p < 0 || p > 99999) return fail('请输入合理价格');
				}

				const updateData = { update_date: Date.now() };
				if (available  !== undefined) updateData.available   = !!available;
				if (price      !== undefined) updateData.price       = Number(price);
				if (skillsText !== undefined) updateData.skills_text = (skillsText || '').slice(0, 200);
				if (intro      !== undefined) updateData.intro       = (intro || '').slice(0, 500);

				const existing = await coachSetCol.where({ uid }).limit(1).get();
				if (existing.data && existing.data.length > 0) {
					await coachSetCol.where({ uid }).update(updateData);
				} else {
					await coachSetCol.add({ uid, ...updateData, create_date: Date.now() });
				}

				return success({ available, price, skillsText, intro });
			}

			// ==========================================
			// 学员管理
			// ==========================================

			/** 获取教练的学员列表 */
			case 'getStudents': {
				if (!uid) return fail('请先登录');

				const res = await studentsCol.where({
					coach_id: uid,
					status: dbCmd.in([0, 1]),
				}).orderBy('last_active_date', 'desc').limit(50).get();

				const list = (res.data || []).map(s => ({
					id:         s.student_id,
					name:       s.student_name || '学员',
					avatar:     s.student_avatar || '',
					level:      s.level || '',
					sessions:   s.total_sessions || 0,
					lastActive: relativeTime(s.last_active_date),
					status:     s.status,
				}));

				return success(list);
			}

			// ==========================================
			// 收入记录
			// ==========================================

			/** 获取教练收入 */
			case 'getIncome': {
				if (!uid) return fail('请先登录');

				const { start: monthStart } = getMonthRange();

				// 本月收入
				const monthRes = await incomeCol.where({
					uid,
					status: 1,
					create_date: dbCmd.gte(monthStart),
				}).get();

				const monthIncome = (monthRes.data || []).reduce((sum, r) => sum + (r.amount || 0), 0);

				// 累计收入
				const totalRes = await incomeCol.where({
					uid,
					status: 1,
				}).get();

				const totalIncome = (totalRes.data || []).reduce((sum, r) => sum + (r.amount || 0), 0);

				// 最近收入明细
				const recordsRes = await incomeCol.where({
					uid,
				}).orderBy('create_date', 'desc').limit(50).get();

				const records = (recordsRes.data || []).map(r => ({
					id:     r._id,
					title:  r.title || '收入',
					date:   formatDate(r.create_date),
					amount: r.amount || 0,
					type:   r.type || 'private_course',
					status: r.status,
				}));

				return success({
					summary: {
						month: monthIncome,
						total: totalIncome,
					},
					records,
				});
			}

			// ==========================================
			// 聊天 - 会话管理
			// ==========================================

			/** 获取或创建与某用户的会话 */
			case 'getOrCreateConversation': {
				if (!uid) return fail('请先登录');

				const { targetUserId } = params;
				if (!targetUserId) return fail('缺少目标用户ID');
				if (targetUserId === uid) return fail('不能与自己聊天');

				// 查找已有会话（成员包含双方）
				const existRes = await convsCol.where({
					members: dbCmd.all([uid, targetUserId]),
				}).limit(1).get();

				if (existRes.data && existRes.data.length > 0) {
					return success({
						conversationId: existRes.data[0]._id,
						isNew: false,
					});
				}

				// 创建新会话
				const addRes = await convsCol.add({
					members:           [uid, targetUserId],
					last_message:      '',
					last_sender_id:    '',
					last_message_date: Date.now(),
					unread_count_map:  { [uid]: 0, [targetUserId]: 0 },
					create_date:       Date.now(),
				});

				return success({
					conversationId: addRes.id,
					isNew: true,
				});
			}

			/** 发送消息 */
			case 'sendMessage': {
				if (!uid) return fail('请先登录');

				const { conversationId, content, type = 'text' } = params;
				if (!conversationId || !content) return fail('消息内容不能为空');

				// 校验会话归属
				const convRes = await convsCol.doc(conversationId).get();
				if (!convRes.data || convRes.data.length === 0) return fail('会话不存在');
				const conv = convRes.data[0];
				if (!conv.members.includes(uid)) return fail('无权操作');
				const targetUserId = (conv.members || []).find(memberId => memberId !== uid) || '';
				const unreadMap = buildUnreadCountMap(conv.members || [], conv.unread_count_map || {});
				if (targetUserId) {
					unreadMap[targetUserId] = Number(unreadMap[targetUserId] || 0) + 1;
				}
				unreadMap[uid] = 0;

				const now = Date.now();
				let imageAuditData = {};
				if (type === 'image') {
					try {
						const userRes = await usersCol.doc(uid).field({ wx_openid: 1, openid: 1 }).get();
						const userInfo = userRes.data && userRes.data[0] || {};
						const openid = getUserMpWeixinOpenid(userInfo);
						if (!openid) return fail('图片审核暂不可用，请稍后重试');
						const traceId = createImageAuditTraceId(`chat_${conversationId}`);
						const audit = await submitImageAuditTask({ fileId: content, openid, traceId });
						imageAuditData = {
							image_audit_status: IMAGE_AUDIT_STATUS.PENDING,
							image_audit_trace_id: audit.traceId || traceId,
							image_audit_request_id: audit.requestId || '',
							image_audit_requested_at: now,
						};
					} catch (error) {
						console.warn('[fit-ucenter-api] chat image audit failed:', error);
						return fail('图片审核暂不可用，请稍后重试');
					}
				}
				const msgData = {
					conversation_id: conversationId,
					sender_id:       uid,
					content:         content.trim().slice(0, 2000),
					type,
					read:            false,
					create_date:     now,
					delivered_at:    now,
					read_at:         null,
					...imageAuditData,
				};
				const addRes = await msgsCol.add(msgData);
				msgData._id = addRes.id;

				// 更新会话摘要
				await convsCol.doc(conversationId).update({
					last_message:      msgData.content.slice(0, 100),
					last_sender_id:    uid,
					last_message_date: now,
					unread_count_map:  unreadMap,
				});

				return success(msgData);
			}

			/** 获取消息列表（支持增量拉取） */
			case 'getMessages': {
				if (!uid) return fail('请先登录');

				const { conversationId, page = 1, pageSize = 30, since = null } = params;
				if (!conversationId) return fail('缺少会话ID');

				// 校验会话归属
				const convRes = await convsCol.doc(conversationId).get();
				if (!convRes.data || convRes.data.length === 0) return fail('会话不存在');
				if (!convRes.data[0].members.includes(uid)) return fail('无权操作');

				let query = msgsCol.where({ conversation_id: conversationId });
				if (since) {
					query = query.where({ create_date: dbCmd.gt(Number(since)) });
				}

				let res;
				if (since) {
					res = await query.orderBy('create_date', 'asc').limit(pageSize).get();
				} else {
					const skip = (page - 1) * pageSize;
					res = await query.orderBy('create_date', 'desc').skip(skip).limit(pageSize).get();
				}

				const currentConversation = convRes.data[0];
				const shouldMarkRead = !!since || Number(page) <= 1;
				const unreadCount = getUnreadCountForUser(currentConversation, uid);
				if (shouldMarkRead && unreadCount > 0) {
					const now = Date.now();
					await msgsCol.where({
						conversation_id: conversationId,
						sender_id: dbCmd.neq(uid),
						read: false,
					}).update({ read: true, read_at: now });

					const unreadMap = buildUnreadCountMap(currentConversation.members || [], currentConversation.unread_count_map || {});
					unreadMap[uid] = 0;
					await convsCol.doc(conversationId).update({ unread_count_map: unreadMap });
				}

				return success(res.data || []);
			}

			case 'getUnreadCount': {
				if (!uid) return fail('请先登录');

				const convRes = await convsCol.where({
					members: dbCmd.elemMatch(dbCmd.eq(uid)),
				}).field({ members: 1, unread_count_map: 1 }).limit(100).get();

				const total = (convRes.data || []).reduce((sum, conv) => {
					return sum + getUnreadCountForUser(conv, uid);
				}, 0);

				return success({ count: total });
			}

			case 'markAllConversationsRead': {
				if (!uid) return fail('请先登录');

				const convRes = await convsCol.where({
					members: dbCmd.elemMatch(dbCmd.eq(uid)),
				}).field({ _id: 1, members: 1, unread_count_map: 1 }).limit(100).get();

				const conversations = convRes.data || [];
				const now = Date.now();
				let updated = 0;
				for (const conv of conversations) {
					const unreadMap = buildUnreadCountMap(conv.members || [], conv.unread_count_map || {});
					if (Number(unreadMap[uid] || 0) <= 0) continue;
					unreadMap[uid] = 0;
					await convsCol.doc(conv._id).update({ unread_count_map: unreadMap });
					await msgsCol.where({
						conversation_id: conv._id,
						sender_id: dbCmd.neq(uid),
						read: false,
					}).update({ read: true, read_at: now });
					updated += 1;
				}

				return success({ updated, count: 0 });
			}

			/** 在线心跳与对端在线查询 */
			case 'heartbeat': {
				if (!uid) return fail('请先登录');
				const { targetUserId } = params;
				const now = Date.now();
				await usersCol.doc(uid).update({ last_online: now });

				let targetOnline = false;
				let targetLast = null;
				if (targetUserId) {
					const tRes = await usersCol.doc(targetUserId).field({ last_online: 1 }).get();
					if (tRes.data && tRes.data.length > 0) {
						targetLast = tRes.data[0].last_online || null;
						targetOnline = targetLast && (now - targetLast <= 60000);
					}
				}

				return success({ now, targetOnline, targetLastOnline: targetLast });
			}

			/** 获取当前用户的会话列表（按最近消息倒序） */
			case 'listConversations': {
				if (!uid) return fail('请先登录');

				const { limit = 50 } = params;

				const convRes = await convsCol.where({
					members: dbCmd.elemMatch(dbCmd.eq(uid)),
				}).orderBy('last_message_date', 'desc').limit(limit).get();

				const convs = convRes.data || [];
				if (convs.length === 0) return success([]);

				const targetIds = [...new Set(convs
					.map(c => (c.members || []).find(m => m !== uid))
					.filter(Boolean)
				)];

				// 查询用户信息
				let userMap = {};
				if (targetIds.length > 0) {
					const userRes = await usersCol.where({ _id: dbCmd.in(targetIds) }).field({
						nickname: 1,
						avatar: 1,
						avatar_file: 1,
					}).get();
					userMap = (userRes.data || []).reduce((map, u) => {
						map[u._id] = u;
						return map;
					}, {});
				}

				const result = convs.map(conv => {
					const partnerId = (conv.members || []).find(m => m !== uid) || '';
					const user = userMap[partnerId] || {};
					const avatar = (user.avatar_file && user.avatar_file.url) || user.avatar || '';
					return {
						conversationId: conv._id,
						targetUserId: partnerId,
						nickname: user.nickname || '用户',
						avatar,
						lastMessage: conv.last_message || '',
						lastMessageDate: conv.last_message_date || conv.create_date,
						unread: getUnreadCountForUser(conv, uid),
					};
				});

				return success(result);
			}

			default:
				return fail('Unknown action: ' + action);
		}
	} catch (error) {
		console.error('fit-ucenter-api error:', error);
		return fail(error.message || '服务器错误');
	}
};
