'use strict';
const db = uniCloud.database();
const dbCmd = db.command;

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

// 响应封装
const success = (data, msg = 'success') => ({ code: 0, msg, data });
const fail = (msg, code = -1) => ({ code, msg });

const maskToken = (token) => {
    if (!token) return '';
    const str = String(token);
    if (str.length <= 12) return `${str.slice(0, 3)}***${str.slice(-2)}`;
    return `${str.slice(0, 6)}...${str.slice(-4)}(len:${str.length})`;
};

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

exports.main = async (event, context) => {
    const { action, params = {} } = event;
    let uid = context.CLIENTINFO?.uid || null;
    const requireAuth = async () => {
        if (!uid) uid = await getUid(event, context);
        return uid;
    };

    try {
        switch (action) {
            // ==================== Feed 列表 ====================
            case 'getFeedList': {
                const { page = 1, pageSize = 10, gender, type, level, distanceKm, lat, lng } = params;
                
                let query = { status: 1 };
                
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

                const skip = (page - 1) * pageSize;
                
                // 查询动态列表
                const feedRes = await feedsCol
                    .where(query)
                    .orderBy('create_date', 'desc')
                    .skip(skip)
                    .limit(pageSize)
                    .get();

                let list = feedRes.data || [];

                // 如果用户已登录，获取点赞和收藏状态
                if (uid && list.length > 0) {
                    const feedIds = list.map(f => f._id);
                    
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

                // 计算距离
                if (lat && lng) {
                    list = list.map(feed => {
                        let distanceVal = null;
                        if (feed.location_geo && feed.location_geo.coordinates) {
                            const [feedLng, feedLat] = feed.location_geo.coordinates;
                            distanceVal = calcDistance(lat, lng, feedLat, feedLng);
                        }
                        return { ...feed, distanceKm: distanceVal };
                    });

                    // 筛选距离
                    if (distanceKm && !isNaN(distanceKm)) {
                        list = list.filter(f => f.distanceKm === null || f.distanceKm <= distanceKm);
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
                    likeCount: feed.like_count || 0,
                    commentCount: feed.comment_count || 0,
                    giftCount: feed.gift_count || 0,
                    liked: feed.liked || false,
                    collected: feed.collected || false,
                    createdAt: feed.create_date
                }));

                // 计算是否还有更多
                const totalRes = await feedsCol.where(query).count();
                const hasMore = skip + list.length < totalRes.total;

                return success({ list: formattedList, hasMore, total: totalRes.total });
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
                
                if (!content || content.trim().length === 0) {
                    return fail('内容不能为空');
                }

                // 获取用户信息
                let userInfo = { nickname: '用户', avatar: '', gender: 'unknown' };
                const userRes = await usersCol.doc(authedUid).field({ nickname: 1, avatar: 1, gender: 1, avatar_file: 1 }).get();
                if (userRes.data && userRes.data.length > 0) {
                    userInfo = userRes.data[0];
                }

                let geo = location_geo || null;
                if (!geo && lat && lng) {
                    geo = { type: 'Point', coordinates: [lng, lat] };
                }

                const feedData = {
                    user_id: authedUid,
                    nickname: userInfo.nickname || '用户',
                    avatar: userInfo.avatar || (userInfo.avatar_file && userInfo.avatar_file.url) || '',
                    gender: userInfo.gender || gender || 'unknown',
                    cover: photo || '',
                    content: content.trim(),
                    type: type || 'gym',
                    level: level || 'beginner',
                    location: location || '',
                    location_geo: geo,
                    tags: Array.isArray(tags) ? tags : [],
                    like_count: 0,
                    comment_count: 0,
                    gift_count: 0,
                    status: 1,
                    create_date: Date.now()
                };

                const addRes = await feedsCol.add(feedData);

                return success({
                    id: addRes.id,
                    ...feedData,
                    likeCount: 0,
                    commentCount: 0,
                    giftCount: 0,
                    liked: false,
                    collected: false
                });
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

                const updateData = { update_date: Date.now() };
                if (content !== undefined) updateData.content = String(content).trim();
                if (type !== undefined) updateData.type = type;
                if (level !== undefined) updateData.level = level;
                if (gender !== undefined) updateData.gender = gender;
                if (location !== undefined) updateData.location = location;
                if (photo !== undefined) updateData.cover = photo;
                if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
                if (geo !== undefined) updateData.location_geo = geo;

                await feedsCol.doc(feedId).update(updateData);
                return success({ msg: '更新成功' });
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

                await feedsCol.doc(feedId).remove();
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

                // 获取用户信息
                let userInfo = { nickname: '用户', avatar: '' };
                const userRes = await usersCol.doc(uid).field({ nickname: 1, avatar: 1 }).get();
                if (userRes.data && userRes.data.length > 0) {
                    userInfo = userRes.data[0];
                }

                const commentData = {
                    feed_id: feedId,
                    user_id: uid,
                    nickname: userInfo.nickname,
                    avatar: userInfo.avatar,
                    content: content.trim(),
                    reply_to: replyTo || null,
                    status: 1,
                    create_date: Date.now()
                };

                await commentsCol.add(commentData);
                await feedsCol.doc(feedId).update({ comment_count: dbCmd.inc(1) });

                return success(commentData);
            }

            // ==================== 获取评论列表 ====================
            case 'getComments': {
                const { feedId, page = 1, pageSize = 20 } = params;
                if (!feedId) return fail('参数错误');

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

                const { feedId, toUserId, toNickname, date, place, message } = params;
                if (!toUserId || !date || !place) {
                    return fail('请填写完整的约练信息');
                }

                // 获取发起者信息
                let fromInfo = { nickname: '用户', avatar: '' };
                const fromRes = await usersCol.doc(uid).field({ nickname: 1, avatar: 1 }).get();
                if (fromRes.data && fromRes.data.length > 0) {
                    fromInfo = fromRes.data[0];
                }

                const inviteData = {
                    feed_id: feedId || null,
                    from_user_id: uid,
                    from_nickname: fromInfo.nickname,
                    from_avatar: fromInfo.avatar,
                    to_user_id: toUserId,
                    to_nickname: toNickname || '',
                    date: date,
                    place: place,
                    message: message || '',
                    status: 0,
                    create_date: Date.now()
                };

                await invitesCol.add(inviteData);

                // >>> 发送通知给对方 <<<
                try {
                    await notificationsCol.add({
                        toUserId,
                        fromUserId: uid,
                        type: 'apply',
                        title: '新的约练邀请',
                        content: `${fromInfo.nickname} 邀请你一起${date}在${place}约练`,
                        meetId: feedId || '',
                        meetTitle: `${date} · ${place}`,
                        isRead: false,
                        readAt: null,
                        createdAt: Date.now(),
                    });
                } catch (e) {
                    console.warn('[fit-discover-api] create invite notification failed:', e);
                }

                return success({ msg: '约练邀请已发送' });
            }

            // ==================== 获取我的约练邀请 ====================
            case 'getMyInvites': {
                const myInvitesUid = await requireAuth();
                if (!myInvitesUid) return fail('请先登录');

                const { type = 'received', page = 1, pageSize = 20 } = params;
                const skip = (page - 1) * pageSize;

                let query = {};
                if (type === 'received') {
                    query.to_user_id = uid;
                } else {
                    query.from_user_id = uid;
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
                if (invite.to_user_id !== uid) {
                    return fail('无权操作');
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
                        fromUserId: uid,
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

                const feedRes = await feedsCol.doc(feedId).get();
                if (!feedRes.data || feedRes.data.length === 0) {
                    return fail('动态不存在');
                }

                let feed = feedRes.data[0];

                // 检查点赞和收藏状态
                if (uid) {
                    const [likeRes, collectRes] = await Promise.all([
                        likesCol.where({ feed_id: feedId, user_id: uid }).get(),
                        collectsCol.where({ feed_id: feedId, user_id: uid }).get()
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
