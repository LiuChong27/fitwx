<template>
  <view class="notification-page">
    <!-- 顶部导航栏 -->
    <view class="nav-bar">
      <view class="nav-bar__status" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="nav-bar__content">
        <text class="nav-bar__title">消息中心</text>
        <view v-if="unreadCount > 0" class="nav-bar__action" role="button" aria-label="全部标记为已读" @tap="markAllRead">
          <text class="nav-bar__action-text">全部已读</text>
        </view>
      </view>
    </view>

    <!-- 骨架屏 -->
    <view v-if="firstLoading" class="skeleton-wrap">
      <view v-for="i in 6" :key="i" class="skeleton-item">
        <view class="skeleton-avatar"></view>
        <view class="skeleton-content">
          <view class="skeleton-line skeleton-line--title"></view>
          <view class="skeleton-line skeleton-line--desc"></view>
          <view class="skeleton-line skeleton-line--time"></view>
        </view>
      </view>
    </view>

    <!-- 列表 -->
    <scroll-view
      v-else
      class="notification-list"
      scroll-y
      :style="{ height: scrollHeight + 'px' }"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onPullRefresh"
      @scrolltolower="loadMore"
    >
      <!-- 空态 -->
      <view v-if="!list.length && !loading" class="empty-state" role="status" aria-label="暂无消息">
        <view class="empty-icon" aria-hidden="true">📭</view>
        <text class="empty-text">暂无消息</text>
        <view class="empty-btn" role="button" aria-label="去约练看看" @tap="goMeet">
          <text class="empty-btn-text">去约练看看</text>
        </view>
      </view>

      <!-- 通知条目 -->
      <view
        v-for="item in list"
        :key="item.id"
        class="notification-item"
        :class="{ 'notification-item--unread': !item.isRead }"
        role="listitem"
        :aria-label="item.title + ' ' + item.content"
        @tap="handleTap(item)"
      >
        <!-- 类型图标 -->
        <view class="notification-avatar">
          <view class="type-badge" :class="'type-badge--' + item.type">
            <text class="type-badge-icon">{{ typeIcon(item.type) }}</text>
          </view>
        </view>

        <!-- 内容 -->
        <view class="notification-body">
          <view class="notification-header">
            <text class="notification-title">{{ item.title }}</text>
            <view v-if="!item.isRead" class="unread-dot"></view>
          </view>
          <text class="notification-content">{{ item.content }}</text>
          <view class="notification-meta">
            <text class="notification-time">{{ formatTime(item.createdAt) }}</text>
            <text v-if="item.meetTitle" class="notification-meet">{{ item.meetTitle }}</text>
          </view>
        </view>
      </view>

      <!-- 加载更多 -->
      <view v-if="list.length" class="load-more">
        <text v-if="loading" class="load-more-text">加载中...</text>
        <text v-else-if="noMore" class="load-more-text">没有更多了</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import apiService from '@/services/apiService.js'
import { timeAgo } from '@/common/utils.js'
import tabCacheMixin from '@/common/tabCacheMixin.js'

const NOTIFICATION_TAB_INDEX = 2

export default {
  mixins: [tabCacheMixin],
  tabCacheKeys: ['list', 'unreadCount'],
  data() {
    return {
      list: [],
      page: 1,
      pageSize: 20,
      loading: false,
      firstLoading: true,
      noMore: false,
      refreshing: false,
      unreadCount: 0,
      statusBarHeight: 0,
      scrollHeight: 0,
    }
  },

  onLoad() {
    const sysInfo = uni.getSystemInfoSync()
    this.statusBarHeight = sysInfo.statusBarHeight || 0
    // 导航栏高度 = 状态栏 + 44px 内容区
    const navHeight = this.statusBarHeight + 44
    this.scrollHeight = sysInfo.windowHeight - navHeight
  },

  onShow() {
    this.bootstrap()
  },

  methods: {
    async bootstrap() {
      await this.syncUnread()
      this.resetAndLoad()
    },

    async syncUnread() {
      try {
        const res = await apiService.getUnreadCount()
        this.unreadCount = res.unreadCount || 0
        this.updateTabBadge(this.unreadCount)
      } catch (_) {
        // 静默失败
      }
    },

    resetAndLoad() {
      this.page = 1
      this.noMore = false
      this.list = []
      this.loadList(true)
    },

    async loadList(isFirst = false) {
      if (this.loading || this.noMore) return
      this.loading = true
      if (isFirst) this.firstLoading = true

      try {
        const res = await apiService.getNotifications({
          page: this.page,
          pageSize: this.pageSize,
        })
        const newList = res.list || []
        this.list = this.page === 1 ? newList : [...this.list, ...newList]
        this.noMore = !(res.hasMore)
        if (res.unreadCount !== undefined) {
          this.unreadCount = res.unreadCount
          this.updateTabBadge(this.unreadCount)
        }
        this.page++
      } catch (err) {
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.loading = false
        this.firstLoading = false
      }
    },

    loadMore() {
      if (!this.loading && !this.noMore) {
        this.loadList()
      }
    },

    async onPullRefresh() {
      this.refreshing = true
      this.page = 1
      this.noMore = false

      try {
        const res = await apiService.getNotifications({
          page: 1,
          pageSize: this.pageSize,
        })
        this.list = res.list || []
        this.noMore = !(res.hasMore)
        this.page = 2
        if (res.unreadCount !== undefined) {
          this.unreadCount = res.unreadCount
          this.updateTabBadge(this.unreadCount)
        }
      } catch (_) {
        uni.showToast({ title: '刷新失败', icon: 'none' })
      } finally {
        this.refreshing = false
      }
    },

    async handleTap(item) {
      // 标记已读
      if (!item.isRead) {
        item.isRead = true
        this.unreadCount = Math.max(0, this.unreadCount - 1)
        this.updateTabBadge(this.unreadCount)
        try {
          const res = await apiService.readNotifications([item.id])
          if (res.unreadCount !== undefined) {
            this.unreadCount = res.unreadCount
            this.updateTabBadge(this.unreadCount)
          }
        } catch (_) {
          // 静默
        }
      }

      // 跳转约练页面
      if (item.meetId) {
        uni.switchTab({ url: '/pages/meet/meet' })
      }
    },

    async markAllRead() {
      const unreadIds = this.list.filter(i => !i.isRead).map(i => i.id)
      if (!unreadIds.length) return

      // 乐观更新
      this.list.forEach(i => { i.isRead = true })
      this.unreadCount = 0
      this.updateTabBadge(0)

      try {
        await apiService.markAllNotificationsRead()
      } catch (_) {
        // 失败时可回滚，此处静默
      }
    },

    updateTabBadge(count) {
      if (count > 0) {
        const text = count > 99 ? '99+' : String(count)
        uni.setTabBarBadge({ index: NOTIFICATION_TAB_INDEX, text })
      } else {
        uni.removeTabBarBadge({ index: NOTIFICATION_TAB_INDEX })
      }
    },

    goMeet() {
      uni.switchTab({ url: '/pages/meet/meet' })
    },

    typeIcon(type) {
      const map = { apply: '📩', accepted: '✅', rejected: '❌' }
      return map[type] || '🔔'
    },

    formatTime(ts) {
      if (!ts) return ''
      return timeAgo(ts)
    },
  },
}
</script>

<style scoped>
.notification-page {
  min-height: 100vh;
  background-color: #0A1628;
}

/* 导航栏 */
.nav-bar {
  background: linear-gradient(180deg, rgba(10, 22, 40, 0.98), rgba(10, 22, 40, 0.92));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
.nav-bar__content {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
}
.nav-bar__title {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
}
.nav-bar__action {
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(0, 229, 255, 0.12);
}
.nav-bar__action-text {
  font-size: 24rpx;
  color: #00E5FF;
}

/* 骨架屏 */
.skeleton-wrap {
  padding: 32rpx;
  padding-top: calc(var(--status-bar-height, 25px) + 88rpx + 32rpx);
}
.skeleton-item {
  display: flex;
  gap: 24rpx;
  margin-bottom: 32rpx;
  animation: shimmer 1.5s infinite;
}
.skeleton-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  flex-shrink: 0;
}
.skeleton-content {
  flex: 1;
}
.skeleton-line {
  height: 24rpx;
  border-radius: 12rpx;
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  margin-bottom: 16rpx;
}
.skeleton-line--title { width: 60%; }
.skeleton-line--desc { width: 90%; }
.skeleton-line--time { width: 30%; }

/* 列表 */
.notification-list {
  padding-top: 32rpx;
}

/* 空态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}
.empty-icon {
  font-size: 120rpx;
  margin-bottom: 32rpx;
}
.empty-text {
  font-size: 30rpx;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 40rpx;
}
.empty-btn {
  padding: 16rpx 48rpx;
  border-radius: 40rpx;
  background: linear-gradient(135deg, #00E5FF, #00B8D4);
}
.empty-btn-text {
  font-size: 28rpx;
  color: #0A1628;
  font-weight: 600;
}

/* 通知条目 */
.notification-item {
  display: flex;
  gap: 24rpx;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.04);
  transition: background-color 0.2s ease;
}
.notification-item--unread {
  background: rgba(0, 229, 255, 0.03);
}
.notification-item:active {
  background: rgba(0, 229, 255, 0.08);
}

.notification-avatar {
  flex-shrink: 0;
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.type-badge {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 229, 255, 0.1);
}
.type-badge--apply {
  background: rgba(0, 229, 255, 0.12);
}
.type-badge--accepted {
  background: rgba(76, 175, 80, 0.12);
}
.type-badge--rejected {
  background: rgba(244, 67, 54, 0.12);
}
.type-badge-icon {
  font-size: 36rpx;
}

.notification-body {
  flex: 1;
  min-width: 0;
}
.notification-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.notification-title {
  font-size: 30rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.unread-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #00E5FF;
  flex-shrink: 0;
  box-shadow: 0 0 8rpx rgba(0, 229, 255, 0.4);
}
.notification-content {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.55);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  margin-bottom: 8rpx;
}
.notification-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.notification-time {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.3);
}
.notification-meet {
  font-size: 22rpx;
  color: rgba(0, 229, 255, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 加载更多 */
.load-more {
  padding: 32rpx 0;
  text-align: center;
}
.load-more-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.3);
}
</style>
