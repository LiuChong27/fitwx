'use strict'
const db = uniCloud.database()
const dbCmd = db.command

const notificationsCol = db.collection('fit-notifications')
const usersCol = db.collection('uni-id-users')

// ─── 响应封装 ───
const success = (data, msg = 'success') => ({ code: 0, msg, data })
const fail = (msg, code = -1) => ({ code, msg })

// ─── 鉴权 ───
async function getUid(event, context) {
  try {
    const ctxUid = context && context.CLIENTINFO && context.CLIENTINFO.uid
    if (ctxUid) return ctxUid

    const uniIdCommon = require('uni-id-common')
    const uniID = uniIdCommon.createInstance({ context })
    const token =
      event.uniIdToken ||
      context.uniIdToken ||
      event.token ||
      (event.headers &&
        (event.headers.uniIdToken || event.headers['uni-id-token'])) ||
      (event.params &&
        (event.params.uniIdToken || event.params.token))
    if (!token) return null

    const payload = await uniID.checkToken(token)
    if (payload.errCode === 0) return payload.uid
    return null
  } catch (e) {
    console.error('[fit-notification-api] checkToken error:', e)
    return null
  }
}

exports.main = async (event, context) => {
  const { action, params = {} } = event
  let _uid

  const requireAuth = async () => {
    if (_uid === undefined) _uid = await getUid(event, context)
    return _uid
  }

  try {
    switch (action) {
      // ================================================================
      // getNotifications — 分页拉取当前用户的通知列表
      // 请求: { page, pageSize, lastId? }
      // 响应: { list, hasMore, unreadCount }
      // ================================================================
      case 'getNotifications': {
        const uid = await requireAuth()
        if (!uid) return fail('请先登录')

        const { page = 1, pageSize = 20, lastId } = params
        const limit = Math.min(Math.max(1, pageSize), 50) // 限制每页最多 50
        const skip = (page - 1) * limit

        // 构造查询条件
        const where = { toUserId: uid }
        if (lastId) {
          // 游标分页: 取 createdAt < lastId 对应记录的 createdAt
          try {
            const cursorDoc = await notificationsCol.doc(lastId).get()
            if (cursorDoc.data && cursorDoc.data.length > 0) {
              where.createdAt = dbCmd.lt(cursorDoc.data[0].createdAt)
            }
          } catch (_) {
            // 游标失效时忽略，退回 skip 分页
          }
        }

        // 查询列表
        const listRes = await notificationsCol
          .where(where)
          .orderBy('createdAt', 'desc')
          .skip(lastId ? 0 : skip) // 游标模式不 skip
          .limit(limit + 1) // 多取 1 条判断 hasMore
          .get()

        let list = listRes.data || []
        const hasMore = list.length > limit
        if (hasMore) list = list.slice(0, limit)

        // 格式化
        list = list.map(formatNotification)

        // 未读总数
        const unreadRes = await notificationsCol
          .where({ toUserId: uid, isRead: false })
          .count()
        const unreadCount = unreadRes.total || 0

        return success({ list, hasMore, unreadCount })
      }

      // ================================================================
      // readNotifications — 批量标记已读
      // 请求: { ids: string[] }
      // 响应: { success, unreadCount }
      // ================================================================
      case 'readNotifications': {
        const uid = await requireAuth()
        if (!uid) return fail('请先登录')

        const { ids } = params
        if (!Array.isArray(ids) || ids.length === 0) {
          return fail('参数错误：ids 必须是非空数组')
        }

        // 限制批量大小
        const safeIds = ids.slice(0, 100)

        // 只能标记自己的通知
        await notificationsCol
          .where({
            _id: dbCmd.in(safeIds),
            toUserId: uid,
            isRead: false,
          })
          .update({
            isRead: true,
            readAt: Date.now(),
          })

        // 返回最新未读数
        const unreadRes = await notificationsCol
          .where({ toUserId: uid, isRead: false })
          .count()
        const unreadCount = unreadRes.total || 0

        return success({ success: true, unreadCount })
      }

      // ================================================================
      // getUnreadCount — 仅返回未读数 (轻量)
      // 请求: 空
      // 响应: { unreadCount }
      // ================================================================
      case 'getUnreadCount': {
        const uid = await requireAuth()
        if (!uid) return fail('请先登录')

        const unreadRes = await notificationsCol
          .where({ toUserId: uid, isRead: false })
          .count()

        return success({ unreadCount: unreadRes.total || 0 })
      }

      // ================================================================
      // createNotification — 服务端/管理后台创建通知（内部调用）
      // 请求: { toUserId, type, title, content, meetId?, meetTitle? }
      // 响应: { id }
      // ================================================================
      case 'createNotification': {
        const uid = await requireAuth()
        if (!uid) return fail('请先登录')

        const { toUserId, type, title, content, meetId, meetTitle } = params
        if (!toUserId || !type || !title) {
          return fail('参数错误：toUserId, type, title 必填')
        }

        const validTypes = ['apply', 'accepted', 'rejected', 'system']
        if (!validTypes.includes(type)) {
          return fail(`无效的通知类型: ${type}`)
        }

        const doc = {
          toUserId,
          fromUserId: uid,
          type,
          title: String(title).slice(0, 100),
          content: String(content || '').slice(0, 500),
          meetId: meetId || '',
          meetTitle: meetTitle || '',
          isRead: false,
          readAt: null,
          createdAt: Date.now(),
        }

        const addRes = await notificationsCol.add(doc)
        return success({ id: addRes.id })
      }

      // ================================================================
      // markAllRead — 全部标记已读
      // 请求: 空
      // 响应: { success, updated }
      // ================================================================
      case 'markAllRead': {
        const uid = await requireAuth()
        if (!uid) return fail('请先登录')

        const updateRes = await notificationsCol
          .where({ toUserId: uid, isRead: false })
          .update({
            isRead: true,
            readAt: Date.now(),
          })

        return success({
          success: true,
          updated: updateRes.updated || 0,
          unreadCount: 0,
        })
      }

      default:
        return fail('Unknown action: ' + action)
    }
  } catch (error) {
    console.error('[fit-notification-api] error:', error)
    return fail(error.message || '服务器错误')
  }
}

// ─── 格式化通知文档 → 前端字段 ───
function formatNotification(doc) {
  return {
    id: doc._id,
    toUserId: doc.toUserId || '',
    fromUserId: doc.fromUserId || '',
    type: doc.type || 'system',
    title: doc.title || '',
    content: doc.content || '',
    meetId: doc.meetId || '',
    meetTitle: doc.meetTitle || '',
    isRead: !!doc.isRead,
    createdAt: doc.createdAt || 0,
  }
}
