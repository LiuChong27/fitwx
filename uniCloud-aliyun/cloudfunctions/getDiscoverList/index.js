'use strict';
const db = uniCloud.database();

/**
 * 获取 Discover 列表（公共可见）
 */
exports.main = async (event, _context) => {
  try {
    const page = Math.max(1, Number(event.page) || 1);
    const pageSize = Math.max(1, Math.min(50, Number(event.pageSize) || 15));
    const skip = (page - 1) * pageSize;

    const collection = db.collection('discovers');

    const listRes = await collection
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const totalRes = await collection.count();

    const list = (listRes.data || []).map(item => ({
      id: item._id,
      userId: item.user_id || item.publisherId || item._openid,
      nickname: item.nickname || item.publisherName || '用户',
      avatar: item.avatar || item.publisherAvatar || '',
      content: item.content || '',
      type: item.type || 'gym',
      level: item.level || 'beginner',
      gender: item.gender || 'unknown',
      location: item.location || item.city || '',
      distanceKm: item.distanceKm,
      cover: item.cover || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      likeCount: item.like_count || item.likeCount || 0,
      commentCount: item.comment_count || item.commentCount || 0,
      giftCount: item.gift_count || item.giftCount || 0,
      createdAt: item.createdAt || item.create_date || Date.now()
    }));

    const hasMore = skip + list.length < (totalRes.total || 0);

    return {
      code: 0,
      msg: 'success',
      data: {
        list,
        page,
        pageSize,
        hasMore,
        total: totalRes.total || 0
      }
    };
  } catch (error) {
    console.error('[getDiscoverList] error:', error);
    return { code: -1, msg: '获取失败' };
  }
};
