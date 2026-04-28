<template>
  <view class="report-review-page">
    <view class="report-hero">
      <view>
        <text class="report-hero__kicker">Admin Review</text>
        <text class="report-hero__title">举报处理台</text>
        <text class="report-hero__desc">集中查看举报列表，打开详情后直接完成下架动态、警告用户或驳回举报。</text>
      </view>
      <view class="report-hero__stats">
        <view class="hero-stat-card accent">
          <text class="hero-stat-card__label">待处理</text>
          <text class="hero-stat-card__value">{{ stats.pending || 0 }}</text>
        </view>
        <view class="hero-stat-card">
          <text class="hero-stat-card__label">已处置</text>
          <text class="hero-stat-card__value">{{ stats.handled || 0 }}</text>
        </view>
        <view class="hero-stat-card">
          <text class="hero-stat-card__label">已驳回</text>
          <text class="hero-stat-card__value">{{ stats.dismissed || 0 }}</text>
        </view>
      </view>
    </view>

    <fit-state-panel
      v-if="!isAdmin"
      class="report-state"
      tone="error"
      scene="profile"
      kicker="管理员权限"
      title="当前账号无举报处理权限"
      description="请使用具有 admin 角色的账号登录后再进入举报处理台。"
    />

    <template v-else>
      <scroll-view class="filter-scroll" scroll-x :show-scrollbar="false">
        <view class="filter-row">
          <view
            v-for="item in statusOptions"
            :key="item.value"
            class="filter-chip"
            :class="{ 'filter-chip--active': statusFilter === item.value }"
            role="button"
            @tap="setStatusFilter(item.value)"
          >
            <text>{{ item.label }}</text>
          </view>
        </view>
      </scroll-view>

      <fit-shimmer-stack v-if="firstLoading" variant="discover" :count="3" />

      <fit-state-panel
        v-else-if="loadError"
        class="report-state"
        tone="error"
        scene="discover"
        kicker="举报处理"
        title="举报列表加载失败"
        :description="loadError"
        action-text="重试"
        @action="reloadList(true)"
      />

      <fit-state-panel
        v-else-if="!items.length"
        class="report-state"
        scene="discover"
        kicker="举报处理"
        title="当前筛选下没有举报记录"
        description="新的举报提交后会在这里进入核查和处置。"
      />

      <scroll-view
        v-else
        class="report-scroll"
        scroll-y
        :show-scrollbar="false"
        refresher-enabled
        :refresher-triggered="refreshing"
        @refresherrefresh="onPullRefresh"
        @scrolltolower="loadMore"
      >
        <view class="report-list">
          <view v-for="item in items" :key="item.id" class="report-card" role="button" @tap="openDetail(item)">
            <view class="report-card__head">
              <view>
                <text class="report-card__title">{{ item.targetType === 'feed' ? '动态举报' : '聊天举报' }}</text>
                <text class="report-card__meta">举报人 {{ item.reporterNickname }} · {{ formatDate(item.createdAt) }}</text>
              </view>
              <text class="report-card__status" :class="statusClass(item.status)">{{ item.statusLabel }}</text>
            </view>
            <text class="report-card__reason">{{ item.reasonLabel }}</text>
            <text class="report-card__content">{{ item.targetContent || '未提供对象摘要' }}</text>
            <text class="report-card__target">对象：{{ item.targetNickname || '匿名用户' }}</text>
          </view>
        </view>
        <uni-load-more :status="loadMoreStatus" color="#72E4C8" />
      </scroll-view>
    </template>

    <uni-popup ref="detailPopup" type="bottom">
      <view class="detail-sheet">
        <view class="detail-sheet__head">
          <view>
            <text class="detail-sheet__kicker">举报详情</text>
            <text class="detail-sheet__title">{{ detail ? (detail.targetType === 'feed' ? '动态举报' : '聊天举报') : '举报详情' }}</text>
          </view>
          <view class="detail-sheet__close" @tap="closeDetail">
            <uni-icons type="closeempty" size="22" color="rgba(255,255,255,0.72)" />
          </view>
        </view>

        <view v-if="detail" class="detail-sheet__body">
          <view class="detail-block">
            <text class="detail-block__label">举报对象</text>
            <text class="detail-block__value">{{ detail.targetNickname || '匿名用户' }}</text>
            <text class="detail-block__sub">{{ detail.targetContent || '未提供对象摘要' }}</text>
          </view>

          <view class="detail-block">
            <text class="detail-block__label">举报信息</text>
            <text class="detail-block__value">{{ detail.reasonLabel }}</text>
            <text class="detail-block__sub">{{ detail.reasonText || '举报人未补充说明' }}</text>
            <text class="detail-block__sub">举报人：{{ detail.reporterNickname }} · {{ formatDate(detail.createdAt) }}</text>
          </view>

          <view class="detail-block" v-if="detail.status !== 0">
            <text class="detail-block__label">处置结果</text>
            <text class="detail-block__value">{{ detail.handleActionLabel }}</text>
            <text class="detail-block__sub">{{ detail.handleRemark || '未填写处置备注' }}</text>
          </view>

          <view v-if="detail.status === 0" class="detail-block">
            <text class="detail-block__label">处置备注</text>
            <textarea
              v-model="actionRemark"
              class="detail-textarea"
              maxlength="200"
              placeholder="可填写核查结论、证据说明或给用户的提示"
              placeholder-class="detail-textarea__placeholder"
            />
          </view>

          <view v-if="detail.status === 0" class="detail-actions">
            <button
              v-if="detail.targetType === 'feed'"
              class="detail-btn detail-btn--danger"
              :loading="submitting && decision === 'remove_feed'"
              :disabled="submitting"
              @click="applyDecision('remove_feed')"
            >下架动态</button>
            <button
              class="detail-btn detail-btn--warning"
              :loading="submitting && decision === 'warn_user'"
              :disabled="submitting"
              @click="applyDecision('warn_user')"
            >警告用户</button>
            <button
              class="detail-btn detail-btn--ghost"
              :loading="submitting && decision === 'dismiss'"
              :disabled="submitting"
              @click="applyDecision('dismiss')"
            >驳回举报</button>
          </view>
        </view>
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
      stats: {},
      page: 1,
      pageSize: 10,
      loading: false,
      firstLoading: true,
      refreshing: false,
      hasMore: true,
      loadError: '',
      statusFilter: '0',
      detail: null,
      actionRemark: '',
      submitting: false,
      decision: '',
      statusOptions: [
        { label: '待处理', value: '0' },
        { label: '已处置', value: '1' },
        { label: '已驳回', value: '2' },
        { label: '全部', value: 'all' },
      ],
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
        const res = await apiService.getReportList({
          page: this.page,
          pageSize: this.pageSize,
          status: this.statusFilter,
        })
        const list = Array.isArray(res.list) ? res.list : []
        this.stats = res.stats || {}
        this.items = reset ? list : [...this.items, ...list]
        this.hasMore = !!res.hasMore
        if (list.length > 0) {
          this.page += 1
        }
      } catch (error) {
        this.loadError = error?.message || '举报列表加载失败'
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
    setStatusFilter(value) {
      if (this.statusFilter === value) return
      this.statusFilter = value
      this.reloadList(true)
    },
    async openDetail(item) {
      if (!item?.id) return
      this.actionRemark = ''
      this.detail = null
      this.$refs.detailPopup.open()
      try {
        this.detail = await apiService.getReportDetail(item.id)
      } catch (error) {
        this.$refs.detailPopup.close()
        uni.showToast({ title: error?.message || '详情加载失败', icon: 'none' })
      }
    },
    closeDetail() {
      this.detail = null
      this.actionRemark = ''
      this.decision = ''
      this.$refs.detailPopup.close()
    },
    async applyDecision(decision) {
      if (!this.detail?.id) return
      this.submitting = true
      this.decision = decision
      try {
        await apiService.handleReport({
          reportId: this.detail.id,
          decision,
          handleRemark: this.actionRemark,
        })
        uni.showToast({ title: '处置已完成', icon: 'success' })
        this.closeDetail()
        this.reloadList(true)
      } catch (error) {
        uni.showToast({ title: error?.message || '处置失败', icon: 'none' })
      } finally {
        this.submitting = false
        this.decision = ''
      }
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
    statusClass(status) {
      if (Number(status) === 1) return 'report-card__status--handled'
      if (Number(status) === 2) return 'report-card__status--dismissed'
      return 'report-card__status--pending'
    },
  },
}
</script>

<style scoped lang="scss">
.report-review-page {
  min-height: 100vh;
  padding: 32rpx;
  background:
    radial-gradient(circle at top right, rgba(114, 228, 200, 0.12), transparent 32%),
    linear-gradient(180deg, #08131D 0%, #0E1F2D 100%);
}

.report-hero {
  padding: 36rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, rgba(114, 228, 200, 0.18), rgba(114, 228, 200, 0.04));
  border: 2rpx solid rgba(114, 228, 200, 0.16);
}

.report-hero__kicker,
.report-hero__title,
.report-hero__desc,
.hero-stat-card__label,
.hero-stat-card__value,
.report-card__title,
.report-card__meta,
.report-card__reason,
.report-card__content,
.report-card__target,
.detail-sheet__kicker,
.detail-sheet__title,
.detail-block__label,
.detail-block__value,
.detail-block__sub {
  display: block;
}

.report-hero__kicker {
  font-size: 22rpx;
  letter-spacing: 6rpx;
  text-transform: uppercase;
  color: rgba(114, 228, 200, 0.72);
}

.report-hero__title {
  margin-top: 12rpx;
  font-size: 42rpx;
  font-weight: 700;
  color: #F4FBF8;
}

.report-hero__desc,
.report-card__content,
.detail-block__sub {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: rgba(244, 251, 248, 0.7);
}

.report-hero__stats {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.hero-stat-card {
  flex: 1;
  padding: 20rpx;
  border-radius: 24rpx;
  background: rgba(8, 19, 29, 0.72);
}

.hero-stat-card.accent {
  border: 2rpx solid rgba(114, 228, 200, 0.28);
}

.hero-stat-card__label {
  font-size: 22rpx;
  color: rgba(244, 251, 248, 0.56);
}

.hero-stat-card__value {
  margin-top: 10rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #F4FBF8;
}

.filter-scroll {
  margin-top: 24rpx;
  white-space: nowrap;
}

.filter-row {
  display: inline-flex;
  gap: 16rpx;
}

.filter-chip {
  padding: 14rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(244, 251, 248, 0.68);
}

.filter-chip--active {
  background: rgba(114, 228, 200, 0.16);
  color: #72E4C8;
}

.report-state {
  margin-top: 28rpx;
}

.report-scroll {
  height: calc(100vh - 360rpx);
  margin-top: 20rpx;
}

.report-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding-bottom: 32rpx;
}

.report-card {
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(8, 19, 29, 0.88);
  border: 2rpx solid rgba(255, 255, 255, 0.06);
}

.report-card__head {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
}

.report-card__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #F4FBF8;
}

.report-card__meta,
.report-card__target {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: rgba(244, 251, 248, 0.52);
}

.report-card__reason {
  margin-top: 18rpx;
  font-size: 26rpx;
  color: #72E4C8;
}

.report-card__status {
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  height: fit-content;
}

.report-card__status--pending {
  background: rgba(114, 228, 200, 0.12);
  color: #72E4C8;
}

.report-card__status--handled {
  background: rgba(96, 165, 250, 0.14);
  color: #93C5FD;
}

.report-card__status--dismissed {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(244, 251, 248, 0.58);
}

.detail-sheet {
  padding: 32rpx;
  border-radius: 32rpx 32rpx 0 0;
  background: #08131D;
}

.detail-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-sheet__kicker {
  font-size: 22rpx;
  color: rgba(114, 228, 200, 0.72);
}

.detail-sheet__title {
  margin-top: 12rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: #F4FBF8;
}

.detail-sheet__body {
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.detail-block {
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.04);
}

.detail-block__label {
  font-size: 22rpx;
  color: rgba(114, 228, 200, 0.7);
}

.detail-block__value {
  margin-top: 12rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #F4FBF8;
}

.detail-textarea {
  width: 100%;
  min-height: 180rpx;
  margin-top: 16rpx;
  padding: 22rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.05);
  box-sizing: border-box;
  color: #F4FBF8;
}

.detail-textarea__placeholder {
  color: rgba(244, 251, 248, 0.38);
}

.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.detail-btn {
  border-radius: 999rpx;
  font-weight: 700;
}

.detail-btn--danger {
  background: linear-gradient(135deg, #FB7185, #F97316);
  color: #fff;
}

.detail-btn--warning {
  background: linear-gradient(135deg, #FACC15, #F59E0B);
  color: #3A2200;
}

.detail-btn--ghost {
  background: rgba(255, 255, 255, 0.08);
  color: #F4FBF8;
}
</style>