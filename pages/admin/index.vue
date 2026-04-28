<template>
  <view class="admin-page">
    <view class="admin-hero">
      <view>
        <text class="admin-hero__kicker">Admin Console</text>
        <text class="admin-hero__title">管理员面板</text>
        <text class="admin-hero__desc">把内容审核和后续风控处理收在一个入口，减少运营切换成本。</text>
      </view>
    </view>

    <fit-state-panel
      v-if="!isAdmin"
      class="admin-state"
      tone="error"
      scene="profile"
      kicker="管理员权限"
      title="当前账号无管理权限"
      description="请使用具有 admin 角色的账号登录后再进入管理员面板。"
    />

    <view v-else class="admin-section">
      <view class="admin-grid">
        <view class="admin-card" role="button" @tap="goFeedReview">
          <view class="admin-card__head">
            <text class="admin-card__tag">内容审核</text>
            <text class="admin-card__action">进入</text>
          </view>
          <text class="admin-card__title">动态审核</text>
          <text class="admin-card__desc">审核用户新发和编辑后的动态，决定是否进入社区公开流。</text>
        </view>

        <view class="admin-card admin-card--muted" role="button" @tap="goReportReview">
          <view class="admin-card__head">
            <text class="admin-card__tag">风控处理</text>
            <text class="admin-card__action">进入</text>
          </view>
          <text class="admin-card__title">举报处理</text>
          <text class="admin-card__desc">集中查看用户举报、打开详情并执行下架动态或警告用户等处置动作。</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { store } from '@/uni_modules/uni-id-pages/common/store.js'
import FitStatePanel from '@/components/fit-state-panel.vue'

export default {
  components: {
    FitStatePanel,
  },
  computed: {
    userInfo() {
      return store.userInfo || {}
    },
    isAdmin() {
      const roleList = this.userInfo.role || this.userInfo.roles || []
      return Array.isArray(roleList) && roleList.includes('admin')
    },
  },
  methods: {
    goFeedReview() {
      uni.navigateTo({ url: '/pages/admin/feed-review' })
    },
    goReportReview() {
      uni.navigateTo({ url: '/pages/admin/report-review' })
    },
  },
}
</script>

<style scoped lang="scss">
.admin-page {
  min-height: 100vh;
  padding: 32rpx;
  background:
    radial-gradient(circle at top left, rgba(114, 228, 200, 0.14), transparent 32%),
    linear-gradient(180deg, #08131D 0%, #0E1F2D 100%);
}

.admin-hero {
  padding: 40rpx 36rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, rgba(114, 228, 200, 0.2), rgba(114, 228, 200, 0.06));
  border: 2rpx solid rgba(114, 228, 200, 0.18);
  box-shadow: 0 24rpx 60rpx rgba(0, 0, 0, 0.2);
}

.admin-hero__kicker,
.admin-hero__title,
.admin-hero__desc,
.admin-card__tag,
.admin-card__action,
.admin-card__title,
.admin-card__desc {
  display: block;
}

.admin-hero__kicker {
  font-size: 22rpx;
  letter-spacing: 6rpx;
  text-transform: uppercase;
  color: rgba(114, 228, 200, 0.72);
}

.admin-hero__title {
  margin-top: 14rpx;
  font-size: 44rpx;
  font-weight: 700;
  color: #F4FBF8;
}

.admin-hero__desc {
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: rgba(244, 251, 248, 0.72);
}

.admin-section {
  margin-top: 28rpx;
}

.admin-grid {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.admin-card {
  padding: 32rpx;
  border-radius: 28rpx;
  background: rgba(8, 19, 29, 0.88);
  border: 2rpx solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 20rpx 44rpx rgba(0, 0, 0, 0.18);
}

.admin-card--muted {
  opacity: 0.82;
}

.admin-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.admin-card__tag {
  font-size: 22rpx;
  color: rgba(114, 228, 200, 0.78);
}

.admin-card__action {
  font-size: 24rpx;
  color: rgba(244, 251, 248, 0.56);
}

.admin-card__title {
  margin-top: 18rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #F4FBF8;
}

.admin-card__desc {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: rgba(244, 251, 248, 0.7);
}

.admin-state {
  margin-top: 28rpx;
}
</style>