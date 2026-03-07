<template>
  <!-- 私信收件箱 Tab -->
  <view class="inbox-wrap">
    <scroll-view scroll-y class="list-scroll">
      <view class="inbox-header">
        <text class="section-title">最近私信</text>
        <button class="refresh-btn" size="mini" @click="refresh" :loading="loading">刷新</button>
      </view>

      <view v-if="!loading && list.length === 0" class="empty-hint">
        <text>还没有私信，去和附近的伙伴聊聊吧～</text>
      </view>

      <view
        v-for="conv in list"
        :key="conv.conversationId"
        class="conv-item"
        @click="$emit('open-chat', conv)"
      >
        <image :src="conv.avatar || '/static/tabbar/me.png'" class="conv-avatar" mode="aspectFill" />
        <view class="conv-body">
          <view class="conv-row">
            <text class="conv-name">{{ conv.nickname }}</text>
            <text class="conv-time">{{ conv.time }}</text>
          </view>
          <view class="conv-row">
            <text class="conv-last" :lines="1">{{ conv.lastMessage || '暂无消息' }}</text>
            <view v-if="conv.unread > 0" class="badge">{{ conv.unread }}</view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import chatService from '@/services/chatService.js'
import { throttle } from '@/common/utils.js'

export default {
  name: 'InboxTab',
  emits: ['open-chat'],
  data() {
    return {
      list: [],
      loading: false,
      lastSync: 0,
      _pollTimer: null,
    }
  },
  methods: {
    async refresh(force = true) {
      const now = Date.now()
      if (!force && this.loading) return
      if (!force && now - this.lastSync < 3000) return

      this.loading = true
      try {
        const conversations = await chatService.listConversations()
        this.lastSync = now
        this.list = (conversations || []).map(item => ({
          ...item,
          time: this._formatTime(item.lastMessageDate),
        }))
      } catch (e) {
        console.error('[inbox] loadInbox failed:', e)
        uni.showToast({ title: '私信加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    startPolling() {
      this.stopPolling()
      this._pollTimer = setInterval(() => {
        this.refresh(false)
      }, 7000)
    },

    stopPolling() {
      if (this._pollTimer) {
        clearInterval(this._pollTimer)
        this._pollTimer = null
      }
    },

    _formatTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now - date
      if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
      if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
      return (date.getMonth() + 1) + '月' + date.getDate() + '日'
    },
  },

  beforeUnmount() {
    this.stopPolling()
  },
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.inbox-wrap {
  width: 100%;
}
.inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding: 10rpx 4rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
}
.refresh-btn {
  @include neu-btn;
  padding: 0 24rpx;
  height: 56rpx;
  line-height: 56rpx;
  font-size: 24rpx;
  color: #00e5ff;
}
.conv-item {
  @include sl-card;
  padding: 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease;
  &:active {
    transform: scale(0.985);
    border-color: rgba(0, 229, 255, 0.12);
  }
}
.conv-avatar {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  border: 1px solid rgba(0, 229, 255, 0.1);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
}
.conv-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.conv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}
.conv-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
}
.conv-time {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.45);
}
.conv-last {
  flex: 1;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  min-width: 34rpx;
  padding: 4rpx 12rpx;
  background: linear-gradient(135deg, #ff5252, #ff1744);
  color: #fff;
  border-radius: 20rpx;
  font-size: 22rpx;
  text-align: center;
  margin-left: 12rpx;
  box-shadow: 0 4rpx 12rpx rgba(255, 82, 82, 0.3);
  animation: badgeAppear 0.3s ease-out;
}
@keyframes badgeAppear {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
.empty-hint {
  @include sl-card;
  padding: 40rpx;
  text-align: center;
  color: rgba(255, 255, 255, 0.65);
  font-size: 26rpx;
}
</style>
