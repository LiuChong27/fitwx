'use strict';
const db = uniCloud.database();
const dbCmd = db.command;

const reportsCol = db.collection('fit-reports');
const feedsCol = db.collection('fit-feeds');
const notificationsCol = db.collection('fit-notifications');
const usersCol = db.collection('uni-id-users');
const securityRulesCol = db.collection('fit-content-security-rules');

const success = (data, msg = 'success') => ({ code: 0, msg, data });
const fail = (msg, code = -1) => ({ code, msg });

const REASON_LABELS = {
	spam: '垃圾营销',
	abuse: '辱骂骚扰',
	fraud: '欺诈导流',
	sexual: '低俗不适',
	illegal: '违法违规',
	other: '其他问题',
};

const ACTION_LABELS = {
	pending: '待处理',
	remove_feed: '下架动态',
	warn_user: '警告用户',
	dismiss: '驳回举报',
};

const MODERATION_SCENE = Object.freeze({
	REPORT: 'report',
});
const MODERATION_RESULT = Object.freeze({
	PASS: 'pass',
	REVIEW: 'review',
	BLOCK: 'block',
});
const MODERATION_PRIORITY = {
	[MODERATION_RESULT.PASS]: 0,
	[MODERATION_RESULT.REVIEW]: 1,
	[MODERATION_RESULT.BLOCK]: 2,
};
const MODERATION_CACHE_TTL_MS = 60 * 1000;
const BUILTIN_BLOCK_WORDS = [
	'赌博', '赌局', '网赌', '博彩',
	'代开发票', '假发票',
	'色情', '裸聊', '约炮',
	'枪支', '弹药', '管制刀具',
	'毒品', '冰毒', '大麻', '摇头丸',
	'洗钱', '走私',
];
const BUILTIN_REVIEW_WORDS = [
	'刷单', '兼职打字', '日赚千元', '稳赚不赔',
	'加微信', '加我微信', '加v', '加QQ', '私聊转账',
];
const BUILTIN_BLOCK_REGEX = new RegExp(BUILTIN_BLOCK_WORDS.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
const BUILTIN_REVIEW_REGEX = new RegExp(BUILTIN_REVIEW_WORDS.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
let securityObjectInitialized = false;
let securityObject = null;
let hasLoggedMissingSecurity = false;
let hasLoggedRuleLoadFailure = false;
let securityRuleCache = { expireAt: 0, rows: [] };

function toTrimmedText(value, maxLength = 500) {
	return String(value || '').trim().slice(0, maxLength);
}

async function callMsgSecCheck(content) {
	if (!content) return null;
	if (uniCloud.security && typeof uniCloud.security.msgSecCheck === 'function') {
		return uniCloud.security.msgSecCheck({ content });
	}
	if (!securityObjectInitialized) {
		securityObjectInitialized = true;
		if (typeof uniCloud.importObject === 'function') {
			try {
				const imported = uniCloud.importObject('security');
				if (imported && typeof imported.msgSecCheck === 'function') {
					securityObject = imported;
				}
			} catch (error) {
				console.warn('[fit-report-api] import security object failed:', error);
			}
		}
	}
	if (securityObject && typeof securityObject.msgSecCheck === 'function') {
		return securityObject.msgSecCheck({ content });
	}
	if (!hasLoggedMissingSecurity) {
		hasLoggedMissingSecurity = true;
		console.warn('[fit-report-api] security.msgSecCheck is unavailable, only fallback keyword checks are active.');
	}
	return null;
}

function normalizeModerationStatus(status) {
	if (status === MODERATION_RESULT.BLOCK) return MODERATION_RESULT.BLOCK;
	if (status === MODERATION_RESULT.REVIEW) return MODERATION_RESULT.REVIEW;
	return MODERATION_RESULT.PASS;
}

function mapSuggestToModeration(result = {}) {
	const suggest = String(result?.result?.suggest || result?.suggest || result?.data?.result?.suggest || '').toLowerCase();
	if (!suggest || suggest === 'pass' || suggest === 'ok') return MODERATION_RESULT.PASS;
	if (suggest === 'review') return MODERATION_RESULT.REVIEW;
	if (['risky', 'block', 'reject', 'fail'].includes(suggest)) return MODERATION_RESULT.BLOCK;
	return MODERATION_RESULT.REVIEW;
}

function ruleMatchesText(text, rule = {}) {
	const mode = String(rule.match_mode || 'contains').toLowerCase();
	const word = String(rule.word || '').trim();
	if (!word) return false;
	if (mode === 'regex') {
		try {
			return new RegExp(word, 'i').test(text);
		} catch (error) {
			console.warn('[fit-report-api] invalid security rule regex:', word, error);
			return false;
		}
	}
	if (mode === 'exact') {
		return text.toLowerCase() === word.toLowerCase();
	}
	return text.toLowerCase().includes(word.toLowerCase());
}

async function loadSecurityRules() {
	const now = Date.now();
	if (securityRuleCache.expireAt > now) return securityRuleCache.rows;
	try {
		const res = await securityRulesCol.where({ enabled: true }).orderBy('priority', 'asc').limit(500).get();
		const rows = Array.isArray(res.data) ? res.data : [];
		securityRuleCache = { expireAt: now + MODERATION_CACHE_TTL_MS, rows };
		return rows;
	} catch (error) {
		if (!hasLoggedRuleLoadFailure) {
			hasLoggedRuleLoadFailure = true;
			console.warn('[fit-report-api] load security rules failed, fallback to built-in words only:', error);
		}
		securityRuleCache = { expireAt: now + MODERATION_CACHE_TTL_MS, rows: [] };
		return [];
	}
}

async function detectRuleModeration(scene, text) {
	const rules = await loadSecurityRules();
	let moderationStatus = MODERATION_RESULT.PASS;
	let moderationReason = '';
	for (const rule of rules) {
		const ruleScene = String(rule.scene || 'all');
		if (!['all', scene].includes(ruleScene)) continue;
		if (!ruleMatchesText(text, rule)) continue;
		const nextStatus = normalizeModerationStatus(rule.mode);
		if (MODERATION_PRIORITY[nextStatus] > MODERATION_PRIORITY[moderationStatus]) {
			moderationStatus = nextStatus;
			moderationReason = `${nextStatus === MODERATION_RESULT.BLOCK ? '命中拦截词' : '命中审核词'}:${rule.word}`;
		}
		if (moderationStatus === MODERATION_RESULT.BLOCK) break;
	}
	return { moderationStatus, moderationReason };
}

async function evaluateTextModeration(rawText, options = {}) {
	const { allowEmpty = true, maxLength = 500 } = options;
	const scene = options.scene || MODERATION_SCENE.REPORT;
	const fieldName = options.fieldName || '内容';
	const text = toTrimmedText(rawText, maxLength);
	if (!text) {
		if (allowEmpty) return { text: '', moderationStatus: MODERATION_RESULT.PASS, moderationReason: '' };
		throw new Error(`${fieldName}不能为空`);
	}

	let moderationStatus = MODERATION_RESULT.PASS;
	let moderationReason = '';

	if (BUILTIN_BLOCK_REGEX.test(text)) {
		moderationStatus = MODERATION_RESULT.BLOCK;
		moderationReason = '命中系统拦截词';
	} else if (BUILTIN_REVIEW_REGEX.test(text)) {
		moderationStatus = MODERATION_RESULT.REVIEW;
		moderationReason = '命中系统审核词';
	}

	const ruleResult = await detectRuleModeration(scene, text);
	if (MODERATION_PRIORITY[ruleResult.moderationStatus] > MODERATION_PRIORITY[moderationStatus]) {
		moderationStatus = ruleResult.moderationStatus;
		moderationReason = ruleResult.moderationReason;
	}

	try {
		const secRes = await callMsgSecCheck(text);
		if (!secRes) return { text, moderationStatus, moderationReason };
		if (typeof secRes.errCode === 'number' && secRes.errCode !== 0) {
			console.error('[fit-report-api] msgSecCheck error:', secRes);
			throw new Error('内容安全校验失败，请稍后重试');
		}
		const msgSecStatus = mapSuggestToModeration(secRes);
		if (MODERATION_PRIORITY[msgSecStatus] > MODERATION_PRIORITY[moderationStatus]) {
			moderationStatus = msgSecStatus;
			moderationReason = `云端审核:${msgSecStatus}`;
		}
	} catch (error) {
		console.error('[fit-report-api] msgSecCheck failed:', error);
		throw new Error('内容安全校验失败，请稍后重试');
	}
	return {
		text,
		moderationStatus,
		moderationReason: String(moderationReason || '').slice(0, 200),
	};
}

async function sanitizeUnsafeText(rawText, fieldName, fallback = '', maxLength = 120) {
	const text = toTrimmedText(rawText, maxLength);
	if (!text) return fallback;
	try {
		const result = await evaluateTextModeration(text, {
			scene: MODERATION_SCENE.REPORT,
			fieldName,
			allowEmpty: false,
			maxLength,
		});
		if (result.moderationStatus !== MODERATION_RESULT.PASS) {
			console.warn(`[fit-report-api] ${fieldName} was sanitized by server-side moderation policy.`);
			return fallback;
		}
		return result.text;
	} catch (error) {
		console.warn(`[fit-report-api] ${fieldName} sanitization failed, fallback text is used.`, error);
		return fallback;
	}
}

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
		console.error('[fit-report-api] auth error:', err);
		return null;
	}
}

async function getUserSnapshot(userId) {
	if (!userId) return { userId: '', nickname: '', avatar: '' };
	try {
		const res = await usersCol.doc(userId).field({ nickname: 1, avatar: 1, avatar_file: 1 }).get();
		const row = res.data && res.data[0];
		return {
			userId,
			nickname: row?.nickname || '用户',
			avatar: row?.avatar || row?.avatar_file?.url || '',
		};
	} catch (error) {
		console.error('[fit-report-api] getUserSnapshot failed:', error);
		return { userId, nickname: '用户', avatar: '' };
	}
}

function previewText(text = '', max = 60) {
	const value = String(text || '').trim();
	if (!value) return '';
	return value.length > max ? `${value.slice(0, max)}...` : value;
}

function formatStatusLabel(status) {
	if (Number(status) === 1) return '已处置';
	if (Number(status) === 2) return '已驳回';
	return '待处理';
}

function formatReport(doc = {}) {
	return {
		id: doc._id,
		reporterId: doc.reporter_id || '',
		reporterNickname: doc.reporter_nickname || '用户',
		reporterAvatar: doc.reporter_avatar || '',
		targetType: doc.target_type || 'feed',
		targetId: doc.target_id || '',
		targetUserId: doc.target_user_id || '',
		targetNickname: doc.target_nickname || '',
		targetAvatar: doc.target_avatar || '',
		targetContent: doc.target_content || '',
		conversationId: doc.conversation_id || '',
		reasonCode: doc.reason_code || 'other',
		reasonLabel: REASON_LABELS[doc.reason_code] || REASON_LABELS.other,
		reasonText: doc.reason_text || '',
		status: Number(doc.status || 0),
		statusLabel: formatStatusLabel(doc.status),
		handleAction: doc.handle_action || 'pending',
		handleActionLabel: ACTION_LABELS[doc.handle_action] || ACTION_LABELS.pending,
		handleRemark: doc.handle_remark || '',
		handledBy: doc.handled_by || '',
		handledAt: Number(doc.handled_at || 0),
		moderationStatus: doc.moderation_status || 'pass',
		moderationReason: doc.moderation_reason || '',
		moderationUpdatedAt: Number(doc.moderation_updated_at || 0),
		createdAt: Number(doc.created_at || 0),
		updatedAt: Number(doc.updated_at || 0),
	};
}

async function createReport(params = {}, auth = {}) {
	const targetType = String(params.targetType || '').trim();
	const targetId = String(params.targetId || '').trim();
	const reasonCode = String(params.reasonCode || '').trim();
	const reasonResult = await evaluateTextModeration(params.reasonText || '', {
		scene: MODERATION_SCENE.REPORT,
		fieldName: '举报说明',
		allowEmpty: true,
		maxLength: 200,
	});
	if (reasonResult.moderationStatus === MODERATION_RESULT.BLOCK) {
		throw new Error('举报说明包含违规信息，请修改后重试');
	}
	const reasonText = reasonResult.text;
	const conversationId = String(params.conversationId || '').trim();
	if (!['feed', 'chat_user'].includes(targetType)) throw new Error('targetType is invalid');
	if (!targetId) throw new Error('targetId is required');
	if (!REASON_LABELS[reasonCode]) throw new Error('reasonCode is invalid');

	const reporter = await getUserSnapshot(auth.uid);
	let targetUserId = '';
	let targetNickname = '';
	let targetAvatar = '';
	let targetContent = '';

	if (targetType === 'feed') {
		const feedRes = await feedsCol.doc(targetId).get();
		const feed = feedRes.data && feedRes.data[0];
		if (!feed) throw new Error('举报的动态不存在');
		targetUserId = String(feed.user_id || '').trim();
		if (!targetUserId) throw new Error('动态作者信息缺失');
		if (targetUserId === auth.uid) throw new Error('不能举报自己的动态');
		targetNickname = await sanitizeUnsafeText(feed.nickname || '动态作者', '被举报对象昵称', '动态作者', 100);
		targetAvatar = feed.avatar || '';
		targetContent = await sanitizeUnsafeText(
			previewText(feed.content || params.targetContent || '', 120),
			'举报内容摘要',
			'[疑似违规内容，已隐藏]',
			120
		);
	} else {
		targetUserId = String(params.targetUserId || targetId || '').trim();
		if (!targetUserId) throw new Error('被举报用户信息缺失');
		if (targetUserId === auth.uid) throw new Error('不能举报自己');
		const targetUser = await getUserSnapshot(targetUserId);
		targetNickname = await sanitizeUnsafeText(
			String(params.targetNickname || targetUser.nickname || '聊天对象').trim(),
			'被举报对象昵称',
			'聊天对象',
			100
		);
		targetAvatar = String(params.targetAvatar || targetUser.avatar || '').trim();
		targetContent = await sanitizeUnsafeText(
			previewText(params.targetContent || `聊天对象：${targetNickname}`, 120),
			'举报内容摘要',
			'[疑似违规内容，已隐藏]',
			120
		);
	}

	const duplicateRes = await reportsCol.where({
		reporter_id: auth.uid,
		target_type: targetType,
		target_id: targetId,
		status: 0,
	}).limit(1).get();
	if (duplicateRes.data && duplicateRes.data.length) {
		throw new Error('该内容已在待处理举报中，请勿重复提交');
	}

	const now = Date.now();
	const doc = {
		reporter_id: auth.uid,
		reporter_nickname: reporter.nickname || '用户',
		reporter_avatar: reporter.avatar || '',
		target_type: targetType,
		target_id: targetId,
		target_user_id: targetUserId,
		target_nickname: targetNickname,
		target_avatar: targetAvatar,
		target_content: targetContent,
		conversation_id: targetType === 'chat_user' ? conversationId : '',
		reason_code: reasonCode,
		reason_text: reasonText,
		moderation_status: reasonResult.moderationStatus,
		moderation_reason: reasonResult.moderationReason || '',
		moderation_updated_at: now,
		status: 0,
		handle_action: 'pending',
		handle_remark: '',
		handled_by: '',
		handled_at: 0,
		created_at: now,
		updated_at: now,
	};

	const addRes = await reportsCol.add(doc);
	return {
		id: addRes.id,
		status: 0,
		statusLabel: '待处理',
		moderationStatus: reasonResult.moderationStatus,
	};
}

async function getReportStats() {
	const [pendingRes, handledRes, dismissedRes, totalRes] = await Promise.all([
		reportsCol.where({ status: 0 }).count(),
		reportsCol.where({ status: 1 }).count(),
		reportsCol.where({ status: 2 }).count(),
		reportsCol.count(),
	]);
	return {
		pending: pendingRes.total || 0,
		handled: handledRes.total || 0,
		dismissed: dismissedRes.total || 0,
		total: totalRes.total || 0,
	};
}

async function getReportList(params = {}) {
	const page = Math.max(Number(params.page) || 1, 1);
	const pageSize = Math.min(Math.max(Number(params.pageSize) || 20, 1), 100);
	const skip = (page - 1) * pageSize;
	const status = String(params.status ?? '0');
	const where = {};
	if (status !== 'all') {
		where.status = Number(status);
	}

	const [res, totalRes, stats] = await Promise.all([
		reportsCol.where(where).orderBy('created_at', 'desc').skip(skip).limit(pageSize).get(),
		reportsCol.where(where).count(),
		getReportStats(),
	]);
	const list = (res.data || []).map(formatReport);
	const total = totalRes.total || 0;
	return {
		list,
		page,
		pageSize,
		total,
		hasMore: skip + list.length < total,
		stats,
	};
}

async function getReportDetail(params = {}) {
	const reportId = String(params.reportId || '').trim();
	if (!reportId) throw new Error('reportId is required');
	const res = await reportsCol.doc(reportId).get();
	const row = res.data && res.data[0];
	if (!row) throw new Error('举报记录不存在');
	return formatReport(row);
}

async function notifyUser(toUserId, title, content, fromUserId = '') {
	if (!toUserId || !title) return;
	await notificationsCol.add({
		toUserId,
		fromUserId,
		type: 'system',
		title: String(title).slice(0, 100),
		content: String(content || '').slice(0, 500),
		meetId: '',
		meetTitle: '',
		isRead: false,
		readAt: null,
		createdAt: Date.now(),
	});
}

async function handleReport(params = {}, auth = {}) {
	const reportId = String(params.reportId || '').trim();
	const decision = String(params.decision || '').trim();
	const handleRemark = String(params.handleRemark || '').trim().slice(0, 200);
	if (!reportId) throw new Error('reportId is required');
	if (!['remove_feed', 'warn_user', 'dismiss'].includes(decision)) {
		throw new Error('decision is invalid');
	}

	const reportRes = await reportsCol.doc(reportId).get();
	const report = reportRes.data && reportRes.data[0];
	if (!report) throw new Error('举报记录不存在');
	if (Number(report.status) !== 0) throw new Error('该举报已处理');
	if (decision === 'remove_feed' && report.target_type !== 'feed') {
		throw new Error('当前举报对象不支持下架动态');
	}

	const now = Date.now();
	const nextStatus = decision === 'dismiss' ? 2 : 1;
	const relatedRes = await reportsCol.where({
		target_type: report.target_type,
		target_id: report.target_id,
		status: 0,
	}).get();
	const relatedReports = (relatedRes.data || []).length ? relatedRes.data : [report];
	const relatedIds = relatedReports.map(item => item._id).filter(Boolean);

	if (decision === 'remove_feed') {
		await feedsCol.doc(report.target_id).update({
			status: 2,
			moderation_status: MODERATION_RESULT.BLOCK,
			moderation_reason: handleRemark || '举报核实后下架',
			moderation_updated_at: now,
			review_date: now,
			review_by: auth.uid,
			review_remark: handleRemark || '该动态因举报核实被下架',
			update_date: now,
		});
	}

	if (relatedIds.length) {
		await reportsCol.where({ _id: dbCmd.in(relatedIds) }).update({
			status: nextStatus,
			handle_action: decision,
			handle_remark: handleRemark,
			handled_by: auth.uid,
			handled_at: now,
			updated_at: now,
		});
	}

	const reporterNoticeTitle = decision === 'dismiss' ? '举报处理结果已更新' : '举报已处理';
	const reporterNoticeContent = decision === 'remove_feed'
		? '你提交的举报已核实，相关动态已被下架处理。'
		: decision === 'warn_user'
			? '你提交的举报已核实，平台已向对方发出警告。'
			: '你提交的举报已完成核查，当前未发现足够违规证据。';

	const targetNoticeTitle = decision === 'remove_feed'
		? '动态已被平台下架'
		: decision === 'warn_user'
			? '社区警告提醒'
			: '';
	const targetNoticeContent = decision === 'remove_feed'
		? `你的动态因举报核实已被下架。${handleRemark ? `说明：${handleRemark}` : '请调整内容后重新发布。'}`
		: decision === 'warn_user'
			? `平台已收到针对你的举报并发出警告。${handleRemark ? `说明：${handleRemark}` : '请注意社区规范。'}`
			: '';

	const notifiedReporterIds = new Set();
		for (const item of relatedReports) {
		if (item.reporter_id && !notifiedReporterIds.has(item.reporter_id)) {
			notifiedReporterIds.add(item.reporter_id);
			await notifyUser(item.reporter_id, reporterNoticeTitle, reporterNoticeContent, auth.uid || '');
		}
	}

	if (report.target_user_id && targetNoticeTitle) {
		await notifyUser(report.target_user_id, targetNoticeTitle, targetNoticeContent, auth.uid || '');
	}

	return {
		reportId,
		status: nextStatus,
		statusLabel: formatStatusLabel(nextStatus),
		handleAction: decision,
		handleActionLabel: ACTION_LABELS[decision] || ACTION_LABELS.pending,
		resolvedCount: relatedIds.length,
	};
}

exports.main = async (event, context) => {
	const { action, params = {} } = event;
	const auth = await getAuth(event, context);

	try {
		switch (action) {
			case 'createReport': {
				if (!auth || !auth.uid) return fail('请先登录');
				const reportResult = await createReport(params, auth);
				return success(
					reportResult,
					reportResult.moderationStatus === MODERATION_RESULT.REVIEW ? '举报已提交，说明内容待审核' : '举报已提交'
				);
			}
			case 'getReportStats': {
				if (!auth || !auth.uid) return fail('请先登录');
				if (!(auth.roles || []).includes('admin')) return fail('仅管理员可执行该操作', 403);
				return success(await getReportStats());
			}
			case 'getReportList': {
				if (!auth || !auth.uid) return fail('请先登录');
				if (!(auth.roles || []).includes('admin')) return fail('仅管理员可执行该操作', 403);
				return success(await getReportList(params));
			}
			case 'getReportDetail': {
				if (!auth || !auth.uid) return fail('请先登录');
				if (!(auth.roles || []).includes('admin')) return fail('仅管理员可执行该操作', 403);
				return success(await getReportDetail(params));
			}
			case 'handleReport': {
				if (!auth || !auth.uid) return fail('请先登录');
				if (!(auth.roles || []).includes('admin')) return fail('仅管理员可执行该操作', 403);
				return success(await handleReport(params, auth));
			}
			default:
				return fail('Unknown action: ' + action);
		}
	} catch (error) {
		console.error('[fit-report-api] error:', error);
		return fail(error.message || '服务器错误');
	}
};
