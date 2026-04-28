'use strict';
const db = uniCloud.database();
const convsCol = db.collection('fit-conversations');
const msgsCol = db.collection('fit-messages');
const feedsCol = db.collection('fit-feeds');
const notificationsCol = db.collection('fit-notifications');
const dbCmd = db.command;

const success = (data, msg = 'success') => ({ code: 0, msg, data });
const fail = (msg, code = -1) => ({ code, msg });
const IMAGE_AUDIT_STATUS = Object.freeze({
	NONE: 'none',
	PENDING: 'pending',
	PASS: 'pass',
	REVIEW: 'review',
	BLOCK: 'block',
	ERROR: 'error',
});
const DEFAULT_BLOCKED_IMAGE_LABELS = [
	'porn', 'porno', 'sexual', 'sex', 'sexy', 'nudity', 'nude', 'exposure', 'exposed',
	'exhibitionism', 'exhibitionist',
	'色情', '低俗', '裸露', '裸', '暴露', '暴露狂', '性感', '露点',
];

async function getAuth(event, context) {
	try {
		const uniIdCommon = require('uni-id-common');
		const uniID = uniIdCommon.createInstance({ context });
		const token =
			event.uniIdToken ||
			context.uniIdToken ||
			event.token ||
			(event.headers && (event.headers.uniIdToken || event.headers['uni-id-token'])) ||
			(event.params && (event.params.uniIdToken || event.params.token));
		if (!token) return null;

		const payload = await uniID.checkToken(token);
		if (payload.errCode !== 0) return null;
		return {
			uid: payload.uid,
			roles: Array.isArray(payload.role) ? payload.role : [],
		};
	} catch (err) {
		console.error('[fit-maintenance-api] auth error:', err);
		return null;
	}
}

function buildUnreadCountMap(members = [], unreadMessages = []) {
	const map = {};
	(members || []).forEach(memberId => {
		map[memberId] = 0;
	});

	for (const msg of unreadMessages) {
		const senderId = msg && msg.sender_id;
		if (!senderId) continue;
		const receiverId = (members || []).find(memberId => memberId !== senderId);
		if (!receiverId) continue;
		map[receiverId] = Number(map[receiverId] || 0) + 1;
	}

	return map;
}

function mapsEqual(a = {}, b = {}) {
	const keys = Array.from(new Set([...Object.keys(a || {}), ...Object.keys(b || {})])).sort();
	for (const key of keys) {
		if (Number(a[key] || 0) !== Number(b[key] || 0)) return false;
	}
	return true;
}

function isExplicitImageBlock(feed = {}, labels = DEFAULT_BLOCKED_IMAGE_LABELS) {
	if (feed.image_moderation_status !== IMAGE_AUDIT_STATUS.BLOCK) return false;
	const haystack = [
		feed.image_audit_label,
		feed.image_audit_suggest,
		feed.image_moderation_reason,
		feed.moderation_reason,
	].map(value => String(value || '').toLowerCase()).join(' ');
	return labels
		.map(label => String(label || '').trim().toLowerCase())
		.filter(Boolean)
		.some(label => haystack.includes(label));
}

async function rebuildConversationUnreadMap(params = {}) {
	const batchSize = Math.min(Math.max(Number(params.batchSize) || 50, 1), 200);
	const offset = Math.max(Number(params.offset) || 0, 0);
	const dryRun = !!params.dryRun;

	const convRes = await convsCol
		.orderBy('create_date', 'asc')
		.skip(offset)
		.limit(batchSize)
		.get();

	const conversations = convRes.data || [];
	let updated = 0;
	let unchanged = 0;
	let skipped = 0;

	for (const conv of conversations) {
		const members = Array.isArray(conv.members) ? conv.members.filter(Boolean) : [];
		if (members.length !== 2) {
			skipped += 1;
			continue;
		}

		const unreadRes = await msgsCol.where({
			conversation_id: conv._id,
			read: false,
		}).field({ sender_id: 1 }).get();

		const nextMap = buildUnreadCountMap(members, unreadRes.data || []);
		const currentMap = conv.unread_count_map || {};
		if (mapsEqual(currentMap, nextMap)) {
			unchanged += 1;
			continue;
		}

		if (!dryRun) {
			await convsCol.doc(conv._id).update({ unread_count_map: nextMap });
		}
		updated += 1;
	}

	return {
		offset,
		batchSize,
		processed: conversations.length,
		updated,
		unchanged,
		skipped,
		dryRun,
		hasMore: conversations.length === batchSize,
		nextOffset: offset + conversations.length,
	};
}

async function getPendingFeedList(params = {}) {
	const page = Math.max(Number(params.page) || 1, 1);
	const pageSize = Math.min(Math.max(Number(params.pageSize) || 20, 1), 100);
	const skip = (page - 1) * pageSize;

	const res = await feedsCol
		.where({ status: 0 })
		.orderBy('create_date', 'desc')
		.skip(skip)
		.limit(pageSize)
		.get();

	const totalRes = await feedsCol.where({ status: 0 }).count();
	const list = (res.data || []).map(feed => ({
		id: feed._id,
		userId: feed.user_id,
		nickname: feed.nickname || '用户',
		content: feed.content || '',
		type: feed.type || 'gym',
		level: feed.level || 'beginner',
		location: feed.location || '',
		cover: feed.cover || '',
		createDate: feed.create_date || 0,
		status: typeof feed.status === 'number' ? feed.status : 0,
	}));

	return {
		list,
		page,
		pageSize,
		total: totalRes.total || 0,
		hasMore: skip + list.length < (totalRes.total || 0),
	};
}

async function reviewFeed(params = {}, auth = {}) {
	const feedId = String(params.feedId || '').trim();
	const nextStatus = Number(params.status);
	const reviewRemark = String(params.reviewRemark || '').trim().slice(0, 200);
	if (!feedId) throw new Error('feedId is required');
	if (![1, 2].includes(nextStatus)) throw new Error('status must be 1 or 2');

	const res = await feedsCol.doc(feedId).get();
	const row = res.data && res.data[0];
	if (!row) throw new Error('动态不存在');

	await feedsCol.doc(feedId).update({
		status: nextStatus,
		review_date: Date.now(),
		review_by: auth.uid,
		review_remark: reviewRemark,
		update_date: Date.now(),
	});

	if (row.user_id) {
		const contentPreview = String(row.content || '').trim().slice(0, 24);
		const previewText = contentPreview ? `「${contentPreview}${contentPreview.length >= 24 ? '...' : ''}」` : '你提交的动态';
		const title = nextStatus === 1 ? '动态审核已通过' : '动态审核未通过';
		const content = nextStatus === 1
			? `${previewText} 已通过审核，现在会展示在社区动态中。`
			: `${previewText} 未通过审核。${reviewRemark ? `原因：${reviewRemark}` : '可调整内容后重新提交审核。'}`;

		await notificationsCol.add({
			toUserId: row.user_id,
			fromUserId: auth.uid || '',
			type: 'system',
			title,
			content: String(content).slice(0, 500),
			meetId: '',
			meetTitle: '',
			isRead: false,
			readAt: null,
			createdAt: Date.now(),
		});
	}

	return {
		feedId,
		status: nextStatus,
		reviewRemark,
	};
}

async function restoreNonExplicitReviewFeeds(params = {}) {
	const batchSize = Math.min(Math.max(Number(params.batchSize) || 50, 1), 200);
	const offset = Math.max(Number(params.offset) || 0, 0);
	const dryRun = params.dryRun !== false;
	const labels = Array.isArray(params.blockedImageLabels) && params.blockedImageLabels.length
		? params.blockedImageLabels
		: DEFAULT_BLOCKED_IMAGE_LABELS;

	const res = await feedsCol
		.where({
			status: 0,
			moderation_status: dbCmd.in(['review', 'block']),
		})
		.orderBy('create_date', 'asc')
		.skip(offset)
		.limit(batchSize)
		.get();

	const feeds = res.data || [];
	let restored = 0;
	let keptBlocked = 0;
	for (const feed of feeds) {
		if (isExplicitImageBlock(feed, labels)) {
			keptBlocked += 1;
			continue;
		}
		if (!dryRun) {
			await feedsCol.doc(feed._id).update({
				status: 1,
				moderation_status: 'pass',
				moderation_reason: '',
				text_moderation_status: 'pass',
				text_moderation_reason: '',
				moderation_updated_at: Date.now(),
				update_date: Date.now(),
			});
		}
		restored += 1;
	}

	return {
		offset,
		batchSize,
		processed: feeds.length,
		restored,
		keptBlocked,
		dryRun,
		hasMore: feeds.length === batchSize,
		nextOffset: offset + feeds.length,
	};
}

exports.main = async (event, context) => {
	const { action, params = {} } = event;
	const auth = await getAuth(event, context);
	if (!auth || !auth.uid) return fail('请先登录');
	if (!(auth.roles || []).includes('admin')) return fail('仅管理员可执行该操作', 403);

	try {
		switch (action) {
			case 'rebuildConversationUnreadMap':
				return success(await rebuildConversationUnreadMap(params));
			case 'getPendingFeedList':
				return success(await getPendingFeedList(params));
			case 'reviewFeed':
				return success(await reviewFeed(params, auth));
			case 'restoreNonExplicitReviewFeeds':
				return success(await restoreNonExplicitReviewFeeds(params));
			default:
				return fail('Unknown action: ' + action);
		}
	} catch (error) {
		console.error('[fit-maintenance-api] error:', error);
		return fail(error.message || '服务器错误');
	}
};
