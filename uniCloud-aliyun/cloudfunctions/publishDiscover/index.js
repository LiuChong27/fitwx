'use strict';
const db = uniCloud.database();

const maskToken = (token) => {
  if (!token) return '';
  const str = String(token);
  if (str.length <= 12) return `${str.slice(0, 3)}***${str.slice(-2)}`;
  return `${str.slice(0, 6)}...${str.slice(-4)}(len:${str.length})`;
};

const resolveUid = async (event, context) => {
  try {
    const ctxUid = context && context.CLIENTINFO && context.CLIENTINFO.uid;
    if (ctxUid) return ctxUid;
    const uniIdCommon = require('uni-id-common');
    const uniID = uniIdCommon.createInstance({ context });
    const token = event.uniIdToken || context.uniIdToken || event.token || (event.headers && (event.headers.uniIdToken || event.headers['uni-id-token']));
    console.log('[publishDiscover] auth token received:', {
      fromEventUniIdToken: !!event.uniIdToken,
      fromContextUniIdToken: !!context.uniIdToken,
      fromEventToken: !!event.token,
      fromHeadersToken: !!(event.headers && (event.headers.uniIdToken || event.headers['uni-id-token'])),
      tokenMasked: maskToken(token)
    });
    if (!token) return '';
    const payload = await uniID.checkToken(token);
    console.log('[publishDiscover] checkToken result:', {
      errCode: payload && payload.errCode,
      errMsg: payload && payload.errMsg,
      uid: payload && payload.uid,
      tokenExpired: payload && payload.tokenExpired
    });
    return payload.errCode === 0 ? payload.uid : '';
  } catch (error) {
    console.warn('[publishDiscover] resolveUid failed:', error);
    return '';
  }
};

/**
 * 发布 Discover 动态
 * 鉴权：使用 uni-id token uid
 */
exports.main = async (event, context) => {
  try {
    const uid = await resolveUid(event, context);
    if (!uid) {
      return { code: 401, msg: '未登录，无法发布', message: '未登录，无法发布' };
    }

    const content = String(event.content || '').trim();
    if (!content) {
      return { code: -1, msg: '内容不能为空' };
    }

    const publisherName = String(event.publisherName || '').trim() || '用户';
    const publisherAvatar = String(event.publisherAvatar || '').trim() || '';

    const doc = {
      publisherId: uid,
      user_id: uid,
      publisherName,
      publisherAvatar,
      nickname: publisherName,
      avatar: publisherAvatar,
      content,
      type: event.type || 'gym',
      level: event.level || 'beginner',
      gender: event.gender || 'unknown',
      location: event.location || '',
      location_geo: event.lat != null && event.lng != null ? { type: 'Point', coordinates: [event.lng, event.lat] } : null,
      cover: event.photo || '',
      tags: Array.isArray(event.tags) ? event.tags : [],
      city: event.city || '',
      like_count: 0,
      comment_count: 0,
      gift_count: 0,
      createdAt: db.serverDate(),
      status: 1
    };

    const res = await db.collection('discovers').add(doc);

    return {
      code: 0,
      msg: 'success',
      message: '发布成功',
      data: {
        id: res.id,
        ...doc
      }
    };
  } catch (error) {
    console.error('[publishDiscover] error:', error);
    return { code: -1, msg: '发布失败，请稍后重试' };
  }
};
