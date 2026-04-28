'use strict';
const db = uniCloud.database();
const dbCmd = db.command;
const {
    IMAGE_AUDIT_STATUS,
    getContentSecurityConfig,
    mergeModerationStates,
    getUserMpWeixinOpenid,
    createImageAuditTraceId,
    submitImageAuditTask,
    extractImageAuditResult,
    verifyWeChatCallbackSignature,
    httpTextResponse,
} = require('fit-wechat-security');

// 集合引用
const feedsCol = db.collection('fit-feeds');
const likesCol = db.collection('fit-feed-likes');
const commentsCol = db.collection('fit-feed-comments');
const giftsCol = db.collection('fit-feed-gifts');
const invitesCol = db.collection('fit-invites');
const collectsCol = db.collection('fit-collects');
const usersCol = db.collection('uni-id-users');
const profilesCol = db.collection('fit-user-profiles');
const notificationsCol = db.collection('fit-notifications');
const securityRulesCol = db.collection('fit-content-security-rules');

// 响应封装
const success = (data, msg = 'success') => ({ code: 0, msg, data });
const fail = (msg, code = -1) => ({ code, msg });

async function getUid(event, context) {
    try {
        const ctxUid = context && context.CLIENTINFO && context.CLIENTINFO.uid;
        if (ctxUid) return ctxUid;
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
        if (payload.errCode === 0) return payload.uid;
        return null;
    } catch (e) {
        console.error('[fit-discover-api] checkToken error:', e);
        return null;
    }
}

// 计算两点之间距离 (km)
function calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径 km
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
    if (Array.isArray(locationGeo) && locationGeo.length >= 2) {
        const lng = Number(locationGeo[0]);
        const lat = Number(locationGeo[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return { lat, lng };
        }
    }
    return null;
}

const MODERATION_SCENE = Object.freeze({
    FEED: 'feed',
    COMMENT: 'comment',
    INVITE: 'invite',
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
const DEFAULT_BLOCKED_IMAGE_LABELS = [
    'porn', 'porno', 'sexual', 'sex', 'sexy', 'nudity', 'nude', 'exposure', 'exposed',
    'exhibitionism', 'exhibitionist',
    '色情', '低俗', '裸露', '裸', '暴露', '暴露狂', '性感', '露点',
];
const MODERATION_CACHE_TTL_MS = 60 * 1000;
const MAX_INVITE_DISTANCE_KM = 10;
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
                console.warn('[fit-discover-api] import security object failed:', error);
            }
        }
    }
    if (securityObject && typeof securityObject.msgSecCheck === 'function') {
        return securityObject.msgSecCheck({ content });
    }
    if (!hasLoggedMissingSecurity) {
        hasLoggedMissingSecurity = true;
        console.warn('[fit-discover-api] security.msgSecCheck is unavailable, only fallback keyword checks are active.');
    }
    return null;
}

function normalizeModerationStatus(status) {
    if (status === MODERATION_RESULT.BLOCK) return MODERATION_RESULT.BLOCK;
    if (status === MODERATION_RESULT.REVIEW) return MODERATION_RESULT.REVIEW;
    return MODERATION_RESULT.PASS;
}

function getBlockedImageLabels() {
    const config = getContentSecurityConfig();
    const labels = config.mediaCheck && Array.isArray(config.mediaCheck.blockedImageLabels)
        ? config.mediaCheck.blockedImageLabels
        : DEFAULT_BLOCKED_IMAGE_LABELS;
    return labels
        .map(label => String(label || '').trim().toLowerCase())
        .filter(Boolean);
}

function imageLabelMatchesBlockedPolicy(auditResult = {}) {
    if (auditResult.imageAuditStatus !== IMAGE_AUDIT_STATUS.BLOCK) return false;
    const haystack = [
        auditResult.label,
        auditResult.moderationReason,
        auditResult.suggest,
    ].map(value => String(value || '').toLowerCase()).join(' ');
    if (!haystack.trim()) return false;
    return getBlockedImageLabels().some(label => haystack.includes(label));
}

function buildPassModeration(reason = '') {
    return {
        moderationStatus: MODERATION_RESULT.PASS,
        moderationReason: reason,
    };
}

function normalizeFeedTextInput(rawText, fieldName, maxLength, allowEmpty = true) {
    const text = toTrimmedText(rawText, maxLength);
    if (!text && !allowEmpty) {
        throw new Error(`${fieldName}不能为空`);
    }
    return text;
}

function getWeixinQuery(event = {}) {
    return event.queryStringParameters || event.query || {};
}

function isWeixinAuditCallbackEvent(event = {}) {
    const query = getWeixinQuery(event);
    return !!(query.signature || query.msg_signature);
}

async function handleImageAuditCallback(event = {}, params = {}) {
    const skipSignVerify = !!params.skipSignVerify;
    const query = getWeixinQuery(event);
    const method = String(event.httpMethod || event.requestContext?.http?.method || '').toUpperCase();

    if (!skipSignVerify) {
        const verifyRes = verifyWeChatCallbackSignature(event);
        if (!verifyRes.valid) {
            return {
                ok: false,
                code: 401,
                reason: verifyRes.reason || 'callback-signature-invalid',
                response: httpTextResponse('invalid signature', 401),
            };
        }
    }

    if (method === 'GET') {
        const echoStr = String(query.echostr || '').trim();
        return {
            ok: true,
            code: 0,
            response: httpTextResponse(echoStr || 'success', 200),
            result: { verified: true, handshake: true },
        };
    }

    const payloadSource = params.payload || params.body || event;
    const auditResult = extractImageAuditResult(payloadSource);
    if (!auditResult.traceId) {
        console.warn('[fit-discover-api] image callback traceId missing');
        return {
            ok: true,
            code: 0,
            response: httpTextResponse('success', 200),
            result: { updated: false, reason: 'trace-id-missing' },
        };
    }

    const feedRes = await feedsCol.where({ image_audit_trace_id: auditResult.traceId }).limit(1).get();
    const feed = feedRes.data && feedRes.data[0];
    if (!feed) {
        console.warn('[fit-discover-api] image callback trace not found:', auditResult.traceId);
        return {
            ok: true,
            code: 0,
            response: httpTextResponse('success', 200),
            result: { updated: false, reason: 'feed-not-found', traceId: auditResult.traceId },
        };
    }

    const shouldBlock = imageLabelMatchesBlockedPolicy(auditResult);
    const moderationStatus = shouldBlock ? MODERATION_RESULT.BLOCK : MODERATION_RESULT.PASS;
    const moderationReason = shouldBlock
        ? String(auditResult.moderationReason || 'blocked-image-label').slice(0, 200)
        : '';
    const now = Date.now();

    await feedsCol.doc(feed._id).update({
        image_moderation_status: auditResult.imageAuditStatus,
        image_moderation_reason: String(auditResult.moderationReason || '').slice(0, 200),
        image_audit_err_code: Number(auditResult.errCode || 0),
        image_audit_err_msg: String(auditResult.errMsg || '').slice(0, 200),
        image_audit_suggest: String(auditResult.suggest || '').slice(0, 40),
        image_audit_label: String(auditResult.label || '').slice(0, 40),
        image_audit_callback_at: now,
        image_audit_raw: auditResult.body || {},
        moderation_status: moderationStatus,
        moderation_reason: moderationReason,
        moderation_updated_at: now,
        status: shouldBlock ? 0 : 1,
        update_date: now,
    });

    return {
        ok: true,
        code: 0,
        response: httpTextResponse('success', 200),
        result: {
            updated: true,
            feedId: feed._id,
            traceId: auditResult.traceId,
            imageStatus: auditResult.imageAuditStatus,
            moderationStatus,
            status: shouldBlock ? 0 : 1,
        },
    };
}

function buildInitialImageModeration(photo, userInfo = {}) {
    if (!photo) {
        return {
            imageStatus: IMAGE_AUDIT_STATUS.NONE,
            moderationStatus: MODERATION_RESULT.PASS,
            moderationReason: '',
            openid: '',
        };
    }
    const openid = getUserMpWeixinOpenid(userInfo);
    if (!openid) {
        return {
            imageStatus: IMAGE_AUDIT_STATUS.ERROR,
            moderationStatus: MODERATION_RESULT.PASS,
            moderationReason: 'image-openid-missing',
            openid: '',
        };
    }
    return {
        imageStatus: IMAGE_AUDIT_STATUS.PENDING,
        moderationStatus: MODERATION_RESULT.PASS,
        moderationReason: 'image-audit-pending',
        openid,
    };
}

async function queueFeedImageAudit(feedId, photo, userInfo = {}) {
    if (!feedId || !photo) {
        return {
            queued: false,
            imageStatus: photo ? IMAGE_AUDIT_STATUS.ERROR : IMAGE_AUDIT_STATUS.NONE,
            moderationReason: photo ? 'image-audit-missing-feed' : '',
        };
    }

    const openid = getUserMpWeixinOpenid(userInfo);
    if (!openid) {
        return {
            queued: false,
            imageStatus: IMAGE_AUDIT_STATUS.ERROR,
            moderationReason: 'image-openid-missing',
        };
    }

    const traceId = createImageAuditTraceId(feedId);
    const submitResult = await submitImageAuditTask({
        fileId: photo,
        openid,
        traceId,
    });

    await feedsCol.doc(feedId).update({
        image_moderation_status: IMAGE_AUDIT_STATUS.PENDING,
        image_moderation_reason: 'image-audit-submitted',
        image_audit_trace_id: submitResult.traceId || traceId,
        image_audit_request_id: submitResult.requestId || '',
        image_audit_requested_at: Date.now(),
        image_audit_media_url: submitResult.mediaUrl || '',
        update_date: Date.now(),
    });

    return {
        queued: true,
        imageStatus: IMAGE_AUDIT_STATUS.PENDING,
        moderationReason: 'image-audit-submitted',
        traceId: submitResult.traceId || traceId,
    };
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
            console.warn('[fit-discover-api] invalid security rule regex:', word, error);
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
        const res = await securityRulesCol
            .where({ enabled: true })
            .orderBy('priority', 'asc')
            .limit(500)
            .get();
        const rows = Array.isArray(res.data) ? res.data : [];
        securityRuleCache = { expireAt: now + MODERATION_CACHE_TTL_MS, rows };
        return rows;
    } catch (error) {
        if (!hasLoggedRuleLoadFailure) {
            hasLoggedRuleLoadFailure = true;
            console.warn('[fit-discover-api] load security rules failed, fallback to built-in words only:', error);
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
    const { scene, fieldName = '内容', allowEmpty = true, maxLength = 500 } = options;
    const text = toTrimmedText(rawText, maxLength);
    if (!text) {
        if (allowEmpty) {
            return { text: '', moderationStatus: MODERATION_RESULT.PASS, moderationReason: '' };
        }
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
            console.error('[fit-discover-api] msgSecCheck error:', secRes);
            const merged = mergeModerationStates(
                { moderationStatus, moderationReason },
                { moderationStatus: MODERATION_RESULT.REVIEW, moderationReason: 'msg-sec-check-error' }
            );
            return { text, moderationStatus: merged.moderationStatus, moderationReason: merged.moderationReason };
        }
        const msgSecStatus = mapSuggestToModeration(secRes);
        if (MODERATION_PRIORITY[msgSecStatus] > MODERATION_PRIORITY[moderationStatus]) {
            moderationStatus = msgSecStatus;
            moderationReason = `云端审核:${msgSecStatus}`;
        }
    } catch (error) {
        console.error('[fit-discover-api] msgSecCheck failed:', error);
        const merged = mergeModerationStates(
            { moderationStatus, moderationReason },
            { moderationStatus: MODERATION_RESULT.REVIEW, moderationReason: 'msg-sec-check-failed' }
        );
        moderationStatus = merged.moderationStatus;
        moderationReason = merged.moderationReason;
    }

    return {
        text,
        moderationStatus,
        moderationReason: moderationReason.slice(0, 200),
    };
}

async function evaluateModerationBatch(scene, fields = []) {
    const sanitized = {};
    let moderationStatus = MODERATION_RESULT.PASS;
    let moderationReason = '';

    for (const field of fields) {
        const result = await evaluateTextModeration(field.value, {
            scene,
            fieldName: field.fieldName,
            allowEmpty: field.allowEmpty !== false,
            maxLength: field.maxLength || 500,
        });
        sanitized[field.key] = result.text;
        if (MODERATION_PRIORITY[result.moderationStatus] > MODERATION_PRIORITY[moderationStatus]) {
            moderationStatus = result.moderationStatus;
            moderationReason = result.moderationReason;
        }
        if (moderationStatus === MODERATION_RESULT.BLOCK) break;
    }

    return {
        moderationStatus,
        moderationReason: String(moderationReason || '').slice(0, 200),
        sanitized,
    };
}

function mapCommentStatusByModeration(moderationStatus) {
    return moderationStatus === MODERATION_RESULT.PASS ? 1 : 0;
}

async function ensureFeedVisible(feedId, requestUid, options = {}) {
    const { requirePublished = false, allowOwnerWhenHidden = true, failMessage = '动态不可见' } = options;
    const feedRes = await feedsCol.doc(feedId).get();
    if (!feedRes.data || feedRes.data.length === 0) {
        throw new Error('动态不存在');
    }
    const feed = feedRes.data[0];
    const status = Number(feed.status);
    if (requirePublished && status !== 1) {
        throw new Error(failMessage);
    }
    if (status !== 1) {
        const isOwner = !!requestUid && feed.user_id === requestUid;
        if (!(allowOwnerWhenHidden && isOwner)) {
            throw new Error(failMessage);
        }
    }
    return feed;
}

exports.main = async (event, context) => {
    const { action, params = {} } = event;
    let uid = context.CLIENTINFO?.uid || null;
    const requireAuth = async () => {
        if (!uid) uid = await getUid(event, context);
        return uid;
    };

    try {
        if (!action && isWeixinAuditCallbackEvent(event)) {
            const callbackRes = await handleImageAuditCallback(event, params);
            return callbackRes.response;
        }

        switch (action) {
            case 'handleImageAuditCallback': {
                const callbackRes = await handleImageAuditCallback(event, params);
                if (!callbackRes.ok) {
                    return fail(callbackRes.reason || 'callback verify failed', callbackRes.code || 401);
                }
                return success(callbackRes.result || {});
            }

            // ==================== Feed 列表 ====================
            case 'getFeedList': {
                const { page = 1, pageSize = 10, gender, type, level, distanceKm, lat, lng, userId, status } = params;
                const normalizedPage = Math.max(Number(page) || 1, 1);
                const normalizedPageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 50);
                const skip = (normalizedPage - 1) * normalizedPageSize;
                const requestLat = Number(lat);
                const requestLng = Number(lng);
                const maxDistance = Number(distanceKm);
                const hasRequesterPoint = Number.isFinite(requestLat) && Number.isFinite(requestLng);
                const hasDistanceFilter = Number.isFinite(maxDistance);

                const query = {};
                const authedUid = userId ? await requireAuth() : uid;
                const queryingOwnFeeds = !!userId && !!authedUid && userId === authedUid;

                if (userId) {
                    query.user_id = userId;
                }

                if (queryingOwnFeeds) {
                    const numericStatus = Number(status);
                    if ([0, 1, 2].includes(numericStatus)) {
                        query.status = numericStatus;
                    }
                } else {
                    query.status = 1;
                }
                
                // 筛选条件
                if (gender && gender !== 'all') {
                    query.gender = gender;
                }
                if (type && type !== 'all') {
                    query.type = type;
                }
                if (level && level !== 'all') {
                    query.level = level;
                }
                
                let list = [];
                let total = 0;

                if (!hasRequesterPoint) {
                    const [feedRes, totalRes] = await Promise.all([
                        feedsCol
                            .where(query)
                            .orderBy('create_date', 'desc')
                            .skip(skip)
                            .limit(normalizedPageSize)
                            .get(),
                        feedsCol.where(query).count(),
                    ]);
                    list = feedRes.data || [];
                    total = totalRes.total || 0;
                } else {
                    const batchSize = Math.max(normalizedPageSize * 3, 100);
                    let cursor = 0;
                    const filteredList = [];

                    let hasNextBatch = true;
                    while (hasNextBatch) {
                        const batchRes = await feedsCol
                            .where(query)
                            .orderBy('create_date', 'desc')
                            .skip(cursor)
                            .limit(batchSize)
                            .get();

                        const batch = batchRes.data || [];
                        if (batch.length === 0) {
                            hasNextBatch = false;
                            break;
                        }

                        const mapped = batch.map(feed => {
                            let distanceVal = null;
                            const point = normalizePoint(feed.location_geo);
                            if (point) {
                                distanceVal = calcDistance(requestLat, requestLng, point.lat, point.lng);
                            }
                            return { ...feed, distanceKm: distanceVal };
                        });

                        const passed = hasDistanceFilter
                            ? mapped.filter(item => item.distanceKm === null || item.distanceKm <= maxDistance)
                            : mapped;
                        filteredList.push(...passed);

                        cursor += batch.length;
                        if (batch.length < batchSize) {
                            hasNextBatch = false;
                            break;
                        }
                    }

                    filteredList.sort((a, b) => {
                        const aDistance = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.MAX_SAFE_INTEGER;
                        const bDistance = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.MAX_SAFE_INTEGER;
                        if (aDistance !== bDistance) return aDistance - bDistance;

                        const aCreate = Number(a.create_date || 0);
                        const bCreate = Number(b.create_date || 0);
                        if (aCreate !== bCreate) return bCreate - aCreate;

                        return String(a._id || '').localeCompare(String(b._id || ''));
                    });

                    total = filteredList.length;
                    list = filteredList.slice(skip, skip + normalizedPageSize);
                }

                // 如果用户已登录，获取点赞和收藏状态（仅查询当前页）
                if (uid && list.length > 0) {
                    const feedIds = list.map(f => f._id).filter(Boolean);
                    if (feedIds.length > 0) {
                        const [likesRes, collectsRes] = await Promise.all([
                            likesCol.where({ user_id: uid, feed_id: dbCmd.in(feedIds) }).get(),
                            collectsCol.where({ user_id: uid, feed_id: dbCmd.in(feedIds) }).get()
                        ]);

                        const likedSet = new Set((likesRes.data || []).map(l => l.feed_id));
                        const collectedSet = new Set((collectsRes.data || []).map(c => c.feed_id));

                        list = list.map(feed => ({
                            ...feed,
                            liked: likedSet.has(feed._id),
                            collected: collectedSet.has(feed._id)
                        }));
                    }
                }

                // 格式化输出
                const formattedList = list.map(feed => ({
                    id: feed._id,
                    userId: feed.user_id,
                    nickname: feed.nickname || '用户',
                    avatar: feed.avatar || '',
                    gender: feed.gender || 'unknown',
                    cover: feed.cover || '',
                    content: feed.content,
                    type: feed.type,
                    level: feed.level,
                    location: feed.location || '',
                    distanceKm: feed.distanceKm != null ? Number(feed.distanceKm.toFixed(2)) : null,
                    tags: feed.tags || [],
                    status: typeof feed.status === 'number' ? feed.status : 1,
                    moderationStatus: feed.moderation_status || 'pass',
                    moderationReason: feed.moderation_reason || '',
                    likeCount: feed.like_count || 0,
                    commentCount: feed.comment_count || 0,
                    giftCount: feed.gift_count || 0,
                    liked: feed.liked || false,
                    collected: feed.collected || false,
                    createdAt: feed.create_date
                }));

                // 计算是否还有更多
                const hasMore = skip + list.length < total;

                return success({ list: formattedList, hasMore, total });
            }

            // ==================== 公开用户主页 ====================
            case 'getPublicProfile': {
                const { userId } = params;
                if (!userId) return fail('参数错误');

                let base = { nickname: '用户', avatar: '', gender: '', age: null };
                try {
                    const userRes = await usersCol.doc(userId).field({
                        nickname: 1,
                        avatar: 1,
                        gender: 1,
                        avatar_file: 1,
                    }).get();
                    if (userRes.data && userRes.data.length > 0) {
                        const u = userRes.data[0];
                        base = {
                            nickname: u.nickname || '用户',
                            avatar: u.avatar || (u.avatar_file && u.avatar_file.url) || '',
                            gender: u.gender || '',
                            age: null,
                        };
                    }
                } catch (e) {
                    console.warn('[fit-discover-api] getPublicProfile userRes failed:', e);
                }

                let extra = { coverUrl: '', bio: '', gyms: [], gender: '', age: null };
                try {
                    const profRes = await profilesCol.where({ uid: userId }).limit(1).get();
                    if (profRes.data && profRes.data.length > 0) {
                        const p = profRes.data[0];
                        extra = {
                            coverUrl: p.cover_url || '',
                            bio: p.bio || '',
                            gyms: Array.isArray(p.gyms) ? p.gyms : [],
                            gender: p.gender || '',
                            age: typeof p.age === 'number' ? p.age : null,
                        };
                    }
                } catch (e) {
                    console.warn('[fit-discover-api] getPublicProfile profileRes failed:', e);
                }

                return success({
                    userId,
                    nickname: base.nickname,
                    avatarUrl: base.avatar,
                    coverUrl: extra.coverUrl,
                    bio: extra.bio,
                    gyms: extra.gyms,
                    gender: extra.gender || base.gender || '',
                    age: extra.age,
                });
            }

            // ==================== 发布动态 ====================
            case 'publishFeed': {
                const authedUid = await requireAuth();
                if (!authedUid) return fail('请先登录');

                const { content, type, location, photo, tags, lat, lng, level, gender, location_geo } = params;
                const safeTags = Array.isArray(tags)
                    ? tags.map(tag => toTrimmedText(tag, 30)).filter(Boolean).slice(0, 10)
                    : [];
                const safeContent = normalizeFeedTextInput(content, '动态内容', 500, false);
                const safeLocation = normalizeFeedTextInput(location, '地点', 100, true);
                const moderation = buildPassModeration();

                // 获取用户信息
                let userInfo = { nickname: '用户', avatar: '', gender: 'unknown' };
                const userRes = await usersCol.doc(authedUid).field({ nickname: 1, avatar: 1, gender: 1, avatar_file: 1, wx_openid: 1, openid: 1 }).get();
                if (userRes.data && userRes.data.length > 0) {
                    userInfo = userRes.data[0];
                }

                const imageModeration = buildInitialImageModeration(photo, userInfo);
                const finalModeration = moderation;

                let geo = location_geo || null;
                if (!geo && lat && lng) {
                    geo = { type: 'Point', coordinates: [lng, lat] };
                }

                const now = Date.now();
                const feedData = {
                    user_id: authedUid,
                    nickname: userInfo.nickname || '用户',
                    avatar: userInfo.avatar || (userInfo.avatar_file && userInfo.avatar_file.url) || '',
                    gender: userInfo.gender || gender || 'unknown',
                    cover: photo || '',
                    content: safeContent,
                    type: type || 'gym',
                    level: level || 'beginner',
                    location: safeLocation,
                    location_geo: geo,
                    tags: safeTags,
                    like_count: 0,
                    comment_count: 0,
                    gift_count: 0,
                    status: 1,
                    moderation_status: finalModeration.moderationStatus,
                    moderation_reason: finalModeration.moderationReason || '',
                    text_moderation_status: moderation.moderationStatus,
                    text_moderation_reason: moderation.moderationReason || '',
                    image_moderation_status: imageModeration.imageStatus,
                    image_moderation_reason: imageModeration.moderationReason || '',
                    moderation_updated_at: now,
                    create_date: now
                };

                const addRes = await feedsCol.add(feedData);
                if (photo && imageModeration.imageStatus === IMAGE_AUDIT_STATUS.PENDING) {
                    try {
                        const queued = await queueFeedImageAudit(addRes.id, photo, userInfo);
                        if (queued.traceId) {
                            feedData.image_audit_trace_id = queued.traceId;
                        }
                    } catch (error) {
                        console.error('[fit-discover-api] queue feed image audit failed:', error);
                        feedData.image_moderation_status = IMAGE_AUDIT_STATUS.ERROR;
                        feedData.image_moderation_reason = 'image-audit-submit-failed';
                        await feedsCol.doc(addRes.id).update({
                            image_moderation_status: IMAGE_AUDIT_STATUS.ERROR,
                            image_moderation_reason: 'image-audit-submit-failed',
                            moderation_updated_at: Date.now(),
                            update_date: Date.now(),
                        });
                    }
                }

                return success({
                    id: addRes.id,
                    ...feedData,
                    likeCount: 0,
                    commentCount: 0,
                    giftCount: 0,
                    liked: false,
                    collected: false,
                    moderationStatus: finalModeration.moderationStatus,
                }, '发布成功');
            }

            case 'updateFeed': {
                const authedUid = await requireAuth();
                if (!authedUid) return fail('请先登录');

                const { feedId, content, type, location, photo, tags, lat, lng, level, gender, location_geo } = params;
                if (!feedId) return fail('参数错误');

                const existing = await feedsCol.doc(feedId).get();
                if (!existing.data || existing.data.length === 0) return fail('动态不存在');
                const row = existing.data[0];
                if (row.user_id !== authedUid) return fail('无权限');

                let geo = location_geo || null;
                if (!geo && lat && lng) {
                    geo = { type: 'Point', coordinates: [lng, lat] };
                }

                const safeTags = tags !== undefined
                    ? (Array.isArray(tags) ? tags.map(tag => toTrimmedText(tag, 30)).filter(Boolean).slice(0, 10) : [])
                    : undefined;
                const sanitized = {};
                if (content !== undefined) sanitized.content = normalizeFeedTextInput(content, '动态内容', 500, false);
                if (location !== undefined) sanitized.location = normalizeFeedTextInput(location, '地点', 100, true);
                const keepExistingImageBlock = photo === undefined
                    && row.image_moderation_status === IMAGE_AUDIT_STATUS.BLOCK
                    && imageLabelMatchesBlockedPolicy({
                        imageAuditStatus: IMAGE_AUDIT_STATUS.BLOCK,
                        label: row.image_audit_label || '',
                        suggest: row.image_audit_suggest || '',
                        moderationReason: row.image_moderation_reason || row.moderation_reason || '',
                    });
                let finalModeration = keepExistingImageBlock
                    ? {
                        moderationStatus: MODERATION_RESULT.BLOCK,
                        moderationReason: String(row.moderation_reason || row.image_moderation_reason || 'blocked-image-label').slice(0, 200),
                    }
                    : buildPassModeration();
                let auditUserInfo = {};
                let nextImageStatus = row.image_moderation_status || IMAGE_AUDIT_STATUS.NONE;
                let nextImageReason = row.image_moderation_reason || '';
                if (photo !== undefined) {
                    const userRes = await usersCol.doc(authedUid).field({ wx_openid: 1, openid: 1 }).get();
                    const userInfo = userRes.data && userRes.data.length > 0 ? userRes.data[0] : {};
                    auditUserInfo = userInfo;
                    const imageModeration = buildInitialImageModeration(photo, userInfo);
                    nextImageStatus = imageModeration.imageStatus;
                    nextImageReason = imageModeration.moderationReason || '';
                    finalModeration = buildPassModeration();
                }

                const updateData = { update_date: Date.now() };
                if (content !== undefined) {
                    updateData.content = sanitized.content;
                }
                if (type !== undefined) updateData.type = type;
                if (level !== undefined) updateData.level = level;
                if (gender !== undefined) updateData.gender = gender;
                if (location !== undefined) {
                    updateData.location = sanitized.location;
                }
                if (photo !== undefined) updateData.cover = photo;
                if (safeTags !== undefined) updateData.tags = safeTags;
                if (geo !== undefined) updateData.location_geo = geo;
                updateData.status = finalModeration.moderationStatus === MODERATION_RESULT.BLOCK ? 0 : 1;
                updateData.moderation_status = finalModeration.moderationStatus;
                updateData.moderation_reason = finalModeration.moderationReason || '';
                updateData.text_moderation_status = MODERATION_RESULT.PASS;
                updateData.text_moderation_reason = '';
                if (photo !== undefined) {
                    updateData.image_moderation_status = nextImageStatus;
                    updateData.image_moderation_reason = nextImageReason;
                    updateData.image_audit_trace_id = '';
                    updateData.image_audit_request_id = '';
                    updateData.image_audit_requested_at = Date.now();
                }
                updateData.moderation_updated_at = Date.now();

                await feedsCol.doc(feedId).update(updateData);
                if (photo !== undefined && photo && nextImageStatus === IMAGE_AUDIT_STATUS.PENDING) {
                    try {
                        await queueFeedImageAudit(feedId, photo, auditUserInfo);
                    } catch (error) {
                        console.error('[fit-discover-api] requeue feed image audit failed:', error);
                        await feedsCol.doc(feedId).update({
                            image_moderation_status: IMAGE_AUDIT_STATUS.ERROR,
                            image_moderation_reason: 'image-audit-submit-failed',
                            moderation_updated_at: Date.now(),
                            update_date: Date.now(),
                        });
                    }
                }
                return success({
                    msg: '更新成功',
                    moderationStatus: finalModeration.moderationStatus,
                });
            }

            case 'getMyFeedStats': {
                const authedUid = await requireAuth();
                if (!authedUid) return fail('请先登录');

                const [pendingRes, publishedRes, deletedRes] = await Promise.all([
                    feedsCol.where({ user_id: authedUid, status: 0 }).count(),
                    feedsCol.where({ user_id: authedUid, status: 1 }).count(),
                    feedsCol.where({ user_id: authedUid, status: 2 }).count(),
                ]);

                const pending = pendingRes.total || 0;
                const published = publishedRes.total || 0;
                const deleted = deletedRes.total || 0;

                return success({
                    pending,
                    published,
                    deleted,
                    total: pending + published + deleted,
                    active: pending + published,
                });
            }

            case 'removeFeed': {
                const authedUid = await requireAuth();
                if (!authedUid) return fail('请先登录');

                const { feedId } = params;
                if (!feedId) return fail('参数错误');

                const existing = await feedsCol.doc(feedId).get();
                if (!existing.data || existing.data.length === 0) return fail('动态不存在');
                const row = existing.data[0];
                if (row.user_id !== authedUid) return fail('无权限');

                await feedsCol.doc(feedId).update({
                    status: 2,
                    update_date: Date.now()
                });
                return success({ msg: '删除成功' });
            }

            // ==================== 点赞/取消点赞 ====================
            case 'likeFeed': {
                const likeUid = await requireAuth();
                if (!likeUid) return fail('请先登录');

                const { feedId, liked } = params;
                if (!feedId) return fail('参数错误');

                if (liked) {
                    // 点赞
                    const existingLike = await likesCol.where({ feed_id: feedId, user_id: uid }).get();
                    if (existingLike.data.length === 0) {
                        await likesCol.add({
                            feed_id: feedId,
                            user_id: uid,
                            create_date: Date.now()
                        });
                        await feedsCol.doc(feedId).update({ like_count: dbCmd.inc(1) });
                    }
                } else {
                    // 取消点赞
                    await likesCol.where({ feed_id: feedId, user_id: uid }).remove();
                    await feedsCol.doc(feedId).update({ like_count: dbCmd.inc(-1) });
                }

                return success({ liked });
            }

            // ==================== 收藏/取消收藏 ====================
            case 'collectFeed': {
                const collectUid = await requireAuth();
                if (!collectUid) return fail('请先登录');

                const { feedId, collected } = params;
                if (!feedId) return fail('参数错误');

                if (collected) {
                    const existingCollect = await collectsCol.where({ feed_id: feedId, user_id: uid }).get();
                    if (existingCollect.data.length === 0) {
                        await collectsCol.add({
                            feed_id: feedId,
                            user_id: uid,
                            create_date: Date.now()
                        });
                    }
                } else {
                    await collectsCol.where({ feed_id: feedId, user_id: uid }).remove();
                }

                return success({ collected });
            }

            // ==================== 发表评论 ====================
            case 'addComment': {
                const commentUid = await requireAuth();
                if (!commentUid) return fail('请先登录');

                const { feedId, content, replyTo } = params;
                if (!feedId || !content || content.trim().length === 0) {
                    return fail('参数错误');
                }
                await ensureFeedVisible(feedId, commentUid, { requirePublished: true, allowOwnerWhenHidden: false, failMessage: '动态不可评论' });
                const moderation = await evaluateModerationBatch(MODERATION_SCENE.COMMENT, [
                    { key: 'content', value: content, fieldName: '评论内容', allowEmpty: false, maxLength: 200 },
                ]);
                if (moderation.moderationStatus === MODERATION_RESULT.BLOCK) {
                    return fail('评论内容包含违规信息，请修改后重试');
                }
                const safeComment = moderation.sanitized.content;

                // 获取用户信息
                let userInfo = { nickname: '用户', avatar: '' };
                const userRes = await usersCol.doc(commentUid).field({ nickname: 1, avatar: 1 }).get();
                if (userRes.data && userRes.data.length > 0) {
                    userInfo = userRes.data[0];
                }

                const commentData = {
                    feed_id: feedId,
                    user_id: commentUid,
                    nickname: userInfo.nickname,
                    avatar: userInfo.avatar,
                    content: safeComment,
                    reply_to: replyTo || null,
                    status: mapCommentStatusByModeration(moderation.moderationStatus),
                    moderation_status: moderation.moderationStatus,
                    moderation_reason: moderation.moderationReason || '',
                    moderation_updated_at: Date.now(),
                    create_date: Date.now()
                };

                await commentsCol.add(commentData);
                if (commentData.status === 1) {
                    await feedsCol.doc(feedId).update({ comment_count: dbCmd.inc(1) });
                }

                return success(commentData, moderation.moderationStatus === MODERATION_RESULT.REVIEW ? '评论已提交审核' : '评论成功');
            }

            // ==================== 获取评论列表 ====================
            case 'getComments': {
                const { feedId, page = 1, pageSize = 20 } = params;
                if (!feedId) return fail('参数错误');
                const viewerUid = await requireAuth();
                await ensureFeedVisible(feedId, viewerUid, { allowOwnerWhenHidden: true, failMessage: '动态不可见' });

                const skip = (page - 1) * pageSize;
                const res = await commentsCol
                    .where({ feed_id: feedId, status: 1 })
                    .orderBy('create_date', 'desc')
                    .skip(skip)
                    .limit(pageSize)
                    .get();

                return success(res.data || []);
            }

            // ==================== 送礼物 ====================
            case 'sendGift': {
                const giftUid = await requireAuth();
                if (!giftUid) return fail('请先登录');

                const { feedId, toUserId, giftCode } = params;
                if (!feedId || !toUserId || !giftCode) {
                    return fail('参数错误');
                }

                const giftValues = { drink: 1, protein: 5, relax: 10, rose: 20 };
                const giftValue = giftValues[giftCode] || 1;

                await giftsCol.add({
                    feed_id: feedId,
                    from_user_id: uid,
                    to_user_id: toUserId,
                    gift_code: giftCode,
                    gift_value: giftValue,
                    create_date: Date.now()
                });

                await feedsCol.doc(feedId).update({ gift_count: dbCmd.inc(1) });

                return success({ giftCode, giftValue });
            }

            // ==================== 发送约练邀请 ====================
            case 'sendInvite': {
                const inviteUid = await requireAuth();
                if (!inviteUid) return fail('请先登录');

                const { feedId, toUserId, toNickname, date, place, message, lat, lng } = params;
                const requestLat = Number(lat);
                const requestLng = Number(lng);
                const hasRequesterPoint = Number.isFinite(requestLat) && Number.isFinite(requestLng);
                const safeDate = toTrimmedText(date, 40);
                const safePlace = toTrimmedText(place, 100);
                const safeMessage = toTrimmedText(message, 200);
                const safeToNickname = toTrimmedText(toNickname, 50);
                if (!toUserId || !safeDate || !safePlace) {
                    return fail('请填写完整的约练信息');
                }
                if (!feedId) {
                    return fail('仅可从10公里内动态发起邀约');
                }
                if (!hasRequesterPoint) {
                    return fail('请先开启定位后再发起约练');
                }
                const moderation = await evaluateModerationBatch(MODERATION_SCENE.INVITE, [
                    { key: 'date', value: safeDate, fieldName: '邀约日期', allowEmpty: false, maxLength: 40 },
                    { key: 'place', value: safePlace, fieldName: '邀约地点', allowEmpty: false, maxLength: 100 },
                    { key: 'message', value: safeMessage, fieldName: '邀约留言', allowEmpty: true, maxLength: 200 },
                    { key: 'toNickname', value: safeToNickname, fieldName: '邀约对象昵称', allowEmpty: true, maxLength: 50 },
                ]);
                if (moderation.moderationStatus === MODERATION_RESULT.BLOCK) {
                    return fail('邀约内容包含违规信息，请修改后重试');
                }
                const feed = await ensureFeedVisible(feedId, inviteUid, {
                    requirePublished: true,
                    allowOwnerWhenHidden: false,
                    failMessage: '该动态不可发起邀约',
                });
                const feedPoint = normalizePoint(feed.location_geo);
                if (!feedPoint) {
                    return fail('该动态距离未知，暂不可发起约练');
                }
                const inviteDistanceKm = calcDistance(requestLat, requestLng, feedPoint.lat, feedPoint.lng);
                if (!Number.isFinite(inviteDistanceKm) || inviteDistanceKm > MAX_INVITE_DISTANCE_KM) {
                    return fail('仅可邀请10公里内用户');
                }

                // 获取发起者信息
                let fromInfo = { nickname: '用户', avatar: '' };
                const fromRes = await usersCol.doc(inviteUid).field({ nickname: 1, avatar: 1 }).get();
                if (fromRes.data && fromRes.data.length > 0) {
                    fromInfo = fromRes.data[0];
                }

                const inviteData = {
                    feed_id: feedId || null,
                    from_user_id: inviteUid,
                    from_nickname: fromInfo.nickname,
                    from_avatar: fromInfo.avatar,
                    to_user_id: toUserId,
                    to_nickname: safeToNickname,
                    date: safeDate,
                    place: safePlace,
                    message: safeMessage,
                    distance_km: Number(inviteDistanceKm.toFixed(2)),
                    moderation_status: moderation.moderationStatus,
                    moderation_reason: moderation.moderationReason || '',
                    moderation_updated_at: Date.now(),
                    status: 0,
                    create_date: Date.now()
                };

                const addRes = await invitesCol.add(inviteData);

                // >>> 发送通知给对方 <<<
                if (moderation.moderationStatus === MODERATION_RESULT.PASS) {
                    try {
                        await notificationsCol.add({
                            toUserId,
                            fromUserId: inviteUid,
                            type: 'apply',
                            title: '新的约练邀请',
                            content: `${fromInfo.nickname} 邀请你一起${safeDate}在${safePlace}约练`,
                            meetId: feedId || '',
                            meetTitle: `${safeDate} · ${safePlace}`,
                            isRead: false,
                            readAt: null,
                            createdAt: Date.now(),
                        });
                    } catch (e) {
                        console.warn('[fit-discover-api] create invite notification failed:', e);
                    }
                }

                return success(
                    { id: addRes.id, moderationStatus: moderation.moderationStatus },
                    moderation.moderationStatus === MODERATION_RESULT.REVIEW ? '邀约已提交审核' : '约练邀请已发送'
                );
            }

            // ==================== 获取我的约练邀请 ====================
            case 'getMyInvites': {
                const myInvitesUid = await requireAuth();
                if (!myInvitesUid) return fail('请先登录');

                const { type = 'received', page = 1, pageSize = 20 } = params;
                const skip = (page - 1) * pageSize;

                const query = {};
                if (type === 'received') {
                    query.to_user_id = myInvitesUid;
                    query.moderation_status = dbCmd.neq(MODERATION_RESULT.REVIEW);
                } else {
                    query.from_user_id = myInvitesUid;
                }

                const res = await invitesCol
                    .where(query)
                    .orderBy('create_date', 'desc')
                    .skip(skip)
                    .limit(pageSize)
                    .get();

                return success(res.data || []);
            }

            // ==================== 处理约练邀请 ====================
            case 'handleInvite': {
                const handleUid = await requireAuth();
                if (!handleUid) return fail('请先登录');

                const { inviteId, status } = params; // status: 1=接受, 2=拒绝
                if (!inviteId || ![1, 2].includes(status)) {
                    return fail('参数错误');
                }

                // 验证是被邀请者
                const inviteRes = await invitesCol.doc(inviteId).get();
                if (!inviteRes.data || inviteRes.data.length === 0) {
                    return fail('邀请不存在');
                }
                
                const invite = inviteRes.data[0];
                if (invite.to_user_id !== handleUid) {
                    return fail('无权操作');
                }
                if (invite.moderation_status === MODERATION_RESULT.REVIEW) {
                    return fail('邀约正在审核中，暂不可处理');
                }

                await invitesCol.doc(inviteId).update({
                    status: status,
                    update_date: Date.now()
                });

                // >>> 发送通知给邀请发起者 <<<
                try {
                    const toNickname = invite.to_nickname || '用户';
                    const nType = status === 1 ? 'accepted' : 'rejected';
                    const nTitle = status === 1 ? '约练邀请已接受' : '约练邀请未通过';
                    const nContent = status === 1
                        ? `${toNickname} 接受了你的约练邀请`
                        : `${toNickname} 未能接受你的约练邀请`;
                    await notificationsCol.add({
                        toUserId: invite.from_user_id,
                        fromUserId: handleUid,
                        type: nType,
                        title: nTitle,
                        content: nContent,
                        meetId: invite.feed_id || '',
                        meetTitle: `${invite.date || ''} · ${invite.place || ''}`,
                        isRead: false,
                        readAt: null,
                        createdAt: Date.now(),
                    });
                } catch (e) {
                    console.warn('[fit-discover-api] create handleInvite notification failed:', e);
                }

                return success({ status });
            }

            // ==================== 获取动态详情 ====================
            case 'getFeedDetail': {
                const { feedId } = params;
                if (!feedId) return fail('参数错误');
                const viewerUid = await requireAuth();

                const feed = await ensureFeedVisible(feedId, viewerUid, { allowOwnerWhenHidden: true, failMessage: '动态不可见' });

                // 检查点赞和收藏状态
                if (viewerUid) {
                    const [likeRes, collectRes] = await Promise.all([
                        likesCol.where({ feed_id: feedId, user_id: viewerUid }).get(),
                        collectsCol.where({ feed_id: feedId, user_id: viewerUid }).get()
                    ]);
                    feed.liked = likeRes.data.length > 0;
                    feed.collected = collectRes.data.length > 0;
                }

                return success({
                    id: feed._id,
                    userId: feed.user_id,
                    nickname: feed.nickname,
                    avatar: feed.avatar,
                    gender: feed.gender,
                    cover: feed.cover,
                    content: feed.content,
                    type: feed.type,
                    level: feed.level,
                    location: feed.location,
                    tags: feed.tags,
                    status: typeof feed.status === 'number' ? feed.status : 1,
                    moderationStatus: feed.moderation_status || 'pass',
                    moderationReason: feed.moderation_reason || '',
                    likeCount: feed.like_count,
                    commentCount: feed.comment_count,
                    giftCount: feed.gift_count,
                    liked: feed.liked || false,
                    collected: feed.collected || false,
                    createdAt: feed.create_date
                });
            }

            default:
                return fail('Unknown action: ' + action);
        }
    } catch (error) {
        console.error('fit-discover-api error:', error);
        return fail(error.message || '服务器错误');
    }
};
