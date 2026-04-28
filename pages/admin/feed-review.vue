<template>
  <view class="review-page">
    <view class="review-hero">
      <view>
        <text class="review-hero__kicker">Admin Review</text>
        <text class="review-hero__title">动态审核台</text>
        <text class="review-hero__desc">新发布或编辑后的动态会先进入待审核，审核通过后才会在社区公开展示。</text>
      </view>
      <view class="review-hero__stats">
        <view class="review-stat-card">
          <text class="review-stat-card__label">待审核</text>
          <text class="review-stat-card__value">{{ total }}</text>
        </view>
        <view class="review-stat-card review-stat-card--ghost" role="button" @click="reloadList(true)">
          <text class="review-stat-card__label">操作</text>
          <text class="review-stat-card__value review-stat-card__value--small">{{ loading ? '刷新中' : '刷新' }}</text>
        </view>
      </view>
    </view>

    <fit-state-panel
      v-if="!isAdmin"
      class="review-state"
      tone="error"
      scene="profile"
      kicker="管理员权限"
      title="当前账号无审核权限"
      description="请使用具有 admin 角色的账号登录后再进入动态审核页面。"
    />

    <template v-else>
      <fit-shimmer-stack v-if="firstLoading" variant="discover" :count="3" />

      <fit-state-panel
        v-else-if="loadError"
        class="review-state"
        tone="error"
        scene="discover"
        kicker="审核列表"
        title="待审核动态加载失败"
        :description="loadError"
        action-text="重试"
        @action="reloadList(true)"
      />

      <fit-state-panel
        v-else-if="!items.length"
        class="review-state"
        scene="discover"
        kicker="审核列表"
        title="当前没有待审核动态"
        description="新的社区动态提交后会在这里集中处理。"
      />

      <scroll-view
        v-else
        class="review-scroll"
        scroll-y
        :show-scrollbar="false"
        refresher-enabled
        :refresher-triggered="refreshing"
        @refresherrefresh="onPullRefresh"
        @scrolltolower="loadMore"
      >
        <view class="review-list">
          <view v-for="item in items" :key="item.id" class="review-card">
            <image v-if="item.cover" class="review-card__cover" :src="item.cover" mode="aspectFill" />
            <view class="review-card__body">
              <view class="review-card__head">
                <view>
                  <text class="review-card__name">{{ item.nickname || '用户' }}</text>
                  <text class="review-card__meta">{{ formatType(item.type) }} · {{ formatLevel(item.level) }}</text>
                </view>
                <text class="review-card__date">{{ formatDate(item.createDate) }}</text>
              </view>
              <text class="review-card__content">{{ item.content || '未填写内容' }}</text>
              <text v-if="item.location" class="review-card__location">📍 {{ item.location }}</text>
              <view class="review-card__actions">
                <button class="review-btn review-btn--ghost" :disabled="submittingId === item.id" @click="openRejectPopup(item)">驳回</button>
                <button class="review-btn" :loading="submittingId === item.id && reviewAction === 'approve'" :disabled="submittingId === item.id" @click="approveItem(item)">通过</button>
              </view>
            </view>
          </view>
        </view>
        <uni-load-more :status="loadMoreStatus" color="#72E4C8" />
      </scroll-view>
    </template>

    <uni-popup ref="rejectPopup" type="bottom">
      <view class="reject-sheet">
        <view class="reject-sheet__head">
          <text class="reject-sheet__title">驳回动态</text>
          <view class="reject-sheet__close" @click="closeRejectPopup">
            <uni-icons type="closeempty" size="22" color="rgba(255,255,255,0.72)" />
          </view>
        </view>
        <text class="reject-sheet__hint">可填写驳回原因，便于后续运营复核。</text>
        <textarea
          v-model="reviewRemark"
          class="reject-sheet__textarea"
          maxlength="200"
          placeholder="例如：内容不完整、图片不清晰、存在广告导流等"
          placeholder-class="reject-sheet__placeholder"
        />
        <button class="reject-sheet__submit" :loading="submittingId === pendingRejectId && reviewAction === 'reject'" :disabled="!pendingRejectId" @click="rejectItem">确认驳回</button>
      </view>
    </uni-popup>
  </view>
</template>

<script>
import { store } from '@/uni_modules/uni-id-pages/common/store.js'
import apiService from '@/services/apiService.js'
import FitStatePanel from '@/components/fit-state-panel.vue'
import FitShimmerStack from '@/components/fit-shimmer-stack.vue'

export default {
  components: {
    FitStatePanel,
    FitShimmerStack,
  },
  data() {
    return {
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      loading: false,
      firstLoading: true,
      refreshing: false,
      hasMore: true,
      loadError: '',
      submittingId: '',
      reviewAction: '',
      pendingRejectId: '',
      reviewRemark: '',
    }
  },
  computed: {
    userInfo() {
      return store.userInfo || {}
    },
    isAdmin() {
      const roleList = this.userInfo.role || this.userInfo.roles || []
      return Array.isArray(roleList) && roleList.includes('admin')
    },
    loadMoreStatus() {
      if (this.loading && !this.firstLoading) return 'loading'
      if (!this.hasMore) return 'noMore'
      return 'more'
    },
  },
  onLoad() {
    if (this.isAdmin) {
      this.reloadList(true)
    }
  },
  onPullDownRefresh() {
    this.onPullRefresh()
  },
  methods: {
    async reloadList(reset = false) {
      if (!this.isAdmin || this.loading) return
      if (reset) {
        this.page = 1
        this.hasMore = true
        this.items = []
        this.firstLoading = true
      }
      this.loading = true
      this.loadError = ''
      try {
        const res = await apiService.getPendingFeedList({ page: this.page, pageSize: this.pageSize })
        const list = Array.isArray(res.list) ? res.list : []
        this.total = Number(res.total || 0)
        this.items = reset ? list : [...this.items, ...list]
        this.hasMore = !!res.hasMore
        if (list.length > 0) {
          this.page += 1
        }
      } catch (error) {
        this.loadError = error?.message || '审核列表加载失败'
      } finally {
        this.loading = false
        this.firstLoading = false
        this.refreshing = false
        uni.stopPullDownRefresh()
      }
    },
    loadMore() {
      if (!this.loading && this.hasMore) {
        this.reloadList(false)
      }
    },
    onPullRefresh() {
      this.refreshing = true
      this.reloadList(true)
    },
    formatDate(value) {
      if (!value) return '刚刚'
      const date = new Date(Number(value))
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${month}-${day} ${hour}:${minute}`
    },
    formatType(type) {
      const map = {
        gym: '健身房',
        bodyweight: '徒手',
        yoga: '瑜伽',
        run: '跑步',
        pilates: '普拉提',
        boxing: '格斗',
      }
      return map[type] || '训练'
    },
    formatLevel(level) {
      const map = {
        beginner: '新手',
        intermediate: '进阶',
        pro: '专业',
      }
      return map[level] || '不限'
    },
    async approveItem(item) {
      if (!item || !item.id) return
      this.submittingId = item.id
      this.reviewAction = 'approve'
      try {
        await apiService.reviewFeed({ feedId: item.id, status: 1 })
        this.removeReviewedItem(item.id)
        uni.showToast({ title: '已通过', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error?.message || '审核失败', icon: 'none' })
      } finally {
        this.submittingId = ''
        this.reviewAction = ''
      }
    },
    openRejectPopup(item) {
      if (!item || !item.id) return
      this.pendingRejectId = item.id
      this.reviewRemark = ''
      this.$refs.rejectPopup.open()
    },
    closeRejectPopup() {
      this.pendingRejectId = ''
      this.reviewRemark = ''
      this.$refs.rejectPopup.close()
    },
    async rejectItem() {
      if (!this.pendingRejectId) return
      this.submittingId = this.pendingRejectId
      this.reviewAction = 'reject'
      try {
        await apiService.reviewFeed({
          feedId: this.pendingRejectId,
          status: 2,
          reviewRemark: this.reviewRemark,
        })
        this.removeReviewedItem(this.pendingRejectId)
        this.closeRejectPopup()
        uni.showToast({ title: '已驳回', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error?.message || '驳回失败', icon: 'none' })
      } finally {
        this.submittingId = ''
        this.reviewAction = ''
      }
    },
    removeReviewedItem(feedId) {
      this.items = this.items.filter(item => item.id !== feedId)
      this.total = Math.max(0, this.total - 1)
      if (!this.items.length && this.hasMore) {
        this.reloadList(false)
      }
    },
  },
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.review-page {
  min-height: 100vh;
  padding: 24rpx;
  background:
    radial-gradient(circle at top right, rgba(114, 228, 200, 0.10), transparent 24%),
    linear-gradient(180deg, #0B1822 0%, #08131D 100%);
}

.review-hero {
  @include fit-soft-card(28rpx, 28rpx);
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.review-hero__kicker {
  display: block;
  font-size: 20rpx;
  letter-spacing: 4rpx;
  text-transform: uppercase;
  color: rgba(114, 228, 200, 0.78);
  margin-bottom: 10rpx;
}

.review-hero__title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.review-hero__desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: rgba(255,255,255,0.62);
}

.review-hero__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.review-stat-card {
  @include fit-soft-card(24rpx, 24rpx);
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.review-stat-card--ghost {
  background: rgba(255,255,255,0.03);
}

.review-stat-card__label {
  font-size: 22rpx;
  color: rgba(255,255,255,0.5);
}

.review-stat-card__value {
  font-size: 34rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.review-stat-card__value--small {
  font-size: 28rpx;
  color: #72E4C8;
}

.review-state {
  margin-top: 40rpx;
}

.review-scroll {
  height: calc(100vh - 320rpx);
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

.review-card {
  overflow: hidden;
  border-radius: 28rpx;
  background: rgba(15, 30, 42, 0.94);
  border: 1rpx solid rgba(255,255,255,0.06);
  box-shadow: 0 18rpx 40rpx rgba(0,0,0,0.18);
}

.review-card__cover {
  width: 100%;
  height: 280rpx;
  display: block;
}

.review-card__body {
  padding: 24rpx;
}

.review-card__head {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
}

.review-card__name {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.review-card__meta,
.review-card__date,
.review-card__location {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(255,255,255,0.54);
}

.review-card__content {
  display: block;
  margin-top: 18rpx;
  font-size: 28rpx;
  line-height: 1.7;
  color: rgba(255,255,255,0.92);
}

.review-card__actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.review-btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #72E4C8 0%, #55D9C7 100%);
  color: #08131D;
  font-size: 28rpx;
  font-weight: 700;
}

.review-btn--ghost {
  background: rgba(255,255,255,0.05);
  color: #FFFFFF;
  border: 1rpx solid rgba(255,255,255,0.08);
}

.reject-sheet {
  background: #10202C;
  border-radius: 30rpx 30rpx 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.reject-sheet__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reject-sheet__title {
  font-size: 34rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.reject-sheet__hint {
  display: block;
  margin-top: 18rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: rgba(255,255,255,0.56);
}

.reject-sheet__textarea {
  width: 100%;
  min-height: 220rpx;
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255,255,255,0.04);
  color: #FFFFFF;
  box-sizing: border-box;
}

.reject-sheet__placeholder {
  color: rgba(255,255,255,0.28);
}

.reject-sheet__submit {
  margin-top: 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 999rpx;
  background: rgba(255,107,107,0.92);
  color: #FFFFFF;
  font-size: 28rpx;
  font-weight: 700;
}
</style>