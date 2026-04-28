'use strict';

const crypto = require('crypto');
const configCenter = require('uni-config-center');
const {
  getAccessToken,
  ProviderType,
} = require('uni-open-bridge-common');

const MODERATION_RESULT = Object.freeze({
  PASS: 'pass',
  REVIEW: 'review',
  BLOCK: 'block',
});

const IMAGE_AUDIT_STATUS = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  PASS: 'pass',
  REVIEW: 'review',
  BLOCK: 'block',
  ERROR: 'error',
});

const MODERATION_PRIORITY = {
  [MODERATION_RESULT.PASS]: 0,
  [MODERATION_RESULT.REVIEW]: 1,
  [MODERATION_RESULT.BLOCK]: 2,
};

const securityConfigCenter = configCenter({
  pluginId: 'fit-content-security',
});

function getContentSecurityConfig() {
  try {
    return securityConfigCenter.config() || {};
  } catch (error) {
    console.warn('[fit-wechat-security] load config failed:', error);
    return {};
  }
}

function normalizeModerationStatus(status) {
  if (status === MODERATION_RESULT.BLOCK) return MODERATION_RESULT.BLOCK;
  if (status === MODERATION_RESULT.REVIEW) return MODERATION_RESULT.REVIEW;
  return MODERATION_RESULT.PASS;
}

function mergeModerationStates(current = {}, incoming = {}) {
  const currentStatus = normalizeModerationStatus(current.moderationStatus);
  const incomingStatus = normalizeModerationStatus(incoming.moderationStatus);
  if (MODERATION_PRIORITY[incomingStatus] > MODERATION_PRIORITY[currentStatus]) {
    return {
      moderationStatus: incomingStatus,
      moderationReason: String(incoming.moderationReason || '').slice(0, 200),
    };
  }
  return {
    moderationStatus: currentStatus,
    moderationReason: String(current.moderationReason || '').slice(0, 200),
  };
}

function mapFeedStatusByModeration(moderationStatus) {
  return normalizeModerationStatus(moderationStatus) === MODERATION_RESULT.PASS ? 1 : 0;
}

function getUserMpWeixinOpenid(userInfo = {}) {
  const wxOpenid = userInfo && typeof userInfo.wx_openid === 'object' ? userInfo.wx_openid : {};
  return String(
    wxOpenid['mp-weixin'] ||
    wxOpenid.mp ||
    wxOpenid.mpWeixin ||
    userInfo.openid ||
    ''
  ).trim();
}

function createImageAuditTraceId(feedId = '') {
  return `feed_${String(feedId || '').slice(-24)}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeWeixinBody(event = {}) {
  if (event && typeof event.body === 'object' && event.body !== null) {
    return event.body;
  }
  let rawBody = event && typeof event.body === 'string' ? event.body : '';
  if (!rawBody && event && typeof event === 'object' && !Array.isArray(event)) {
    return event;
  }
  if (event && event.isBase64Encoded && rawBody) {
    rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
  }
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody);
  } catch (error) {
    console.warn('[fit-wechat-security] parse callback body failed:', error);
    return {};
  }
}

function getHttpQuery(event = {}) {
  return event.queryStringParameters || event.query || {};
}

function sha1Hex(parts = []) {
  return crypto.createHash('sha1').update(parts.join('')).digest('hex');
}

function verifyWeChatCallbackSignature(event = {}) {
  const config = getContentSecurityConfig();
  const callbackConfig = config.callback || {};
  const token = String(callbackConfig.token || '').trim();
  if (!token) {
    return { valid: false, reason: 'callback-token-missing' };
  }

  const query = getHttpQuery(event);
  const signature = String(
    query.signature ||
    query.msg_signature ||
    (event.headers && (event.headers['x-wechat-signature'] || event.headers['X-Wechat-Signature'])) ||
    ''
  ).trim();
  const timestamp = String(query.timestamp || '').trim();
  const nonce = String(query.nonce || '').trim();

  if (!signature || !timestamp || !nonce) {
    return { valid: false, reason: 'callback-signature-params-missing' };
  }

  const expected = sha1Hex([token, timestamp, nonce].sort());
  return {
    valid: expected === signature,
    reason: expected === signature ? '' : 'callback-signature-invalid',
  };
}

function httpTextResponse(body, statusCode = 200) {
  return {
    mpserverlessComposedResponse: true,
    statusCode,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
    body: String(body || ''),
  };
}

async function getWeixinMpAccessToken() {
  const config = getContentSecurityConfig();
  const dcloudAppid = String(config.dcloudAppid || '').trim();
  if (!dcloudAppid) {
    throw new Error('fit-content-security dcloudAppid is required');
  }

  const tokenData = await getAccessToken({
    dcloudAppid,
    provider: ProviderType.WEIXIN_MP,
  });
  const accessToken = tokenData && tokenData.access_token;
  if (!accessToken) {
    throw new Error('weixin access_token is unavailable');
  }
  return accessToken;
}

async function resolveMediaUrl(fileIdOrUrl = '') {
  const source = String(fileIdOrUrl || '').trim();
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  if (typeof uniCloud.getTempFileURL !== 'function') {
    throw new Error('uniCloud.getTempFileURL is unavailable');
  }
  const res = await uniCloud.getTempFileURL({
    fileList: [source],
  });
  const first = res && Array.isArray(res.fileList) ? res.fileList[0] : null;
  const url = String(first && first.tempFileURL || '').trim();
  if (!url) {
    throw new Error('temp media url is unavailable');
  }
  return url;
}

function normalizeSuggestToImageStatus(suggest) {
  const value = String(suggest || '').toLowerCase();
  if (!value || value === 'pass' || value === 'ok') return IMAGE_AUDIT_STATUS.PASS;
  if (value === 'review') return IMAGE_AUDIT_STATUS.REVIEW;
  if (['risky', 'block', 'reject', 'fail'].includes(value)) return IMAGE_AUDIT_STATUS.BLOCK;
  return IMAGE_AUDIT_STATUS.REVIEW;
}

function mapImageAuditToModeration(status) {
  switch (status) {
    case IMAGE_AUDIT_STATUS.PASS:
    case IMAGE_AUDIT_STATUS.NONE:
      return MODERATION_RESULT.PASS;
    case IMAGE_AUDIT_STATUS.BLOCK:
      return MODERATION_RESULT.BLOCK;
    default:
      return MODERATION_RESULT.REVIEW;
  }
}

async function submitImageAuditTask({ fileId, openid, traceId }) {
  const config = getContentSecurityConfig();
  const mediaConfig = config.mediaCheck || {};
  const notifyUrl = String(mediaConfig.notifyUrl || '').trim();
  if (!notifyUrl) {
    throw new Error('fit-content-security mediaCheck.notifyUrl is required');
  }
  if (!openid) {
    throw new Error('openid is required for media_check_async');
  }

  const mediaUrl = await resolveMediaUrl(fileId);
  const accessToken = await getWeixinMpAccessToken();
  const response = await uniCloud.httpclient.request(
    `https://api.weixin.qq.com/wxa/media_check_async?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      contentType: 'json',
      dataType: 'json',
      timeout: 15000,
      data: {
        openid,
        scene: Number(mediaConfig.scene || 4),
        version: Number(mediaConfig.version || 2),
        media_url: mediaUrl,
        media_type: Number(mediaConfig.mediaType || 2),
        trace_id: traceId || createImageAuditTraceId('feed'),
        notify_url: notifyUrl,
      },
    }
  );

  const data = response && (response.data || response.body) || {};
  const errCode = typeof data.errcode === 'number' ? data.errcode : Number(data.errCode || 0);
  if (errCode !== 0) {
    throw new Error(data.errmsg || data.errMsg || `media_check_async failed: ${errCode}`);
  }

  return {
    traceId: String(data.trace_id || data.traceId || traceId || '').trim(),
    requestId: String(data.request_id || data.requestId || '').trim(),
    mediaUrl,
  };
}

function extractImageAuditResult(payload = {}) {
  const body = normalizeWeixinBody(payload);
  const imgResult = body.imgResult || body.imageResult || body.result || {};
  const innerResult = imgResult.result || {};
  const traceId = String(imgResult.traceId || imgResult.trace_id || body.traceId || body.trace_id || '').trim();
  const errCode = typeof imgResult.errCode === 'number'
    ? imgResult.errCode
    : (typeof imgResult.errcode === 'number' ? imgResult.errcode : Number(body.errCode || 0));
  const errMsg = String(imgResult.errMsg || imgResult.errmsg || body.errMsg || body.errmsg || '').trim();
  const suggest = String(innerResult.suggest || imgResult.suggest || '').trim();
  const label = String(innerResult.label || imgResult.label || '').trim();
  const imageAuditStatus = errCode === 0
    ? normalizeSuggestToImageStatus(suggest)
    : IMAGE_AUDIT_STATUS.ERROR;

  return {
    body,
    traceId,
    errCode,
    errMsg,
    suggest,
    label,
    imageAuditStatus,
    moderationStatus: mapImageAuditToModeration(imageAuditStatus),
    moderationReason: errCode === 0
      ? `${imageAuditStatus}${label ? `:${label}` : ''}`
      : `error:${errMsg || errCode}`,
  };
}

module.exports = {
  MODERATION_RESULT,
  IMAGE_AUDIT_STATUS,
  getContentSecurityConfig,
  mergeModerationStates,
  mapFeedStatusByModeration,
  getUserMpWeixinOpenid,
  createImageAuditTraceId,
  submitImageAuditTask,
  extractImageAuditResult,
  normalizeWeixinBody,
  getHttpQuery,
  verifyWeChatCallbackSignature,
  httpTextResponse,
};
