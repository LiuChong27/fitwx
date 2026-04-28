<template>
  <view class="report-page">
    <fit-state-panel
      v-if="loadError"
      class="report-state"
      tone="error"
      scene="discover"
      kicker="举报"
      title="暂时无法提交举报"
      :description="loadError"
    />

    <template v-else>
      <view class="report-hero">
        <text class="report-hero__kicker">安全举报</text>
        <text class="report-hero__title">提交举报</text>
        <text class="report-hero__desc">举报内容将由后台管理员审核处理。</text>
      </view>

      <view class="report-card">
        <text class="report-card__label">举报对象</text>
        <text class="report-card__title">{{ targetNickname }}</text>
        <text class="report-card__meta">{{ targetTypeLabel }}</text>
        <text class="report-card__content">{{ targetContent || '暂无摘要信息。' }}</text>
      </view>

      <view class="report-section">
        <text class="report-section__title">选择举报原因</text>
        <view class="reason-grid">
          <view
            v-for="item in reasonOptions"
            :key="item.code"
            class="reason-chip"
            :class="{ 'reason-chip--active': form.reasonCode === item.code }"
            role="button"
            @tap="selectReason(item.code)"
          >
            <text class="reason-chip__title">{{ item.label }}</text>
            <text class="reason-chip__desc">{{ item.desc }}</text>
          </view>
        </view>
      </view>

      <view class="report-section">
        <text class="report-section__title">补充说明</text>
        <textarea
          v-model="form.reasonText"
          class="report-textarea"
          maxlength="200"
          placeholder="可补充时间、行为描述、截图说明等信息"
          placeholder-class="report-textarea__placeholder"
        />
      </view>

      <button class="report-submit" :loading="submitting" @click="submitReport">提交举报</button>
    </template>
  </view>
</template>

<script>
import apiService from '@/services/apiService.js'
import FitStatePanel from '@/components/fit-state-panel.vue'
import { requireLogin as requireAuthLogin } from '@/common/auth.js'

const REASON_OPTIONS = [
  { code: 'spam', label: '垃圾信息', desc: '广告引流、重复推广或无关灌水。' },
  { code: 'abuse', label: '辱骂骚扰', desc: '辱骂、人身攻击或持续骚扰行为。' },
  { code: 'fraud', label: '诈骗风险', desc: '虚假承诺、诱导转账或可疑链接。' },
  { code: 'sexual', label: '低俗内容', desc: '性骚扰、露骨暗示或不当内容。' },
  { code: 'illegal', label: '违法违规', desc: '涉违法信息、违规交易或危险内容。' },
  { code: 'other', label: '其他问题', desc: '不属于以上分类但存在风险的内容。' },
]

function buildReportFromPath(options = {}) {
  const entries = Object.entries(options || {}).filter(([key, value]) => key && value !== undefined && value !== null && value !== '')
  if (!entries.length) return '/pages/report/create'
  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return query ? `/pages/report/create?${query}` : '/pages/report/create'
}

export default {
  components: {
    FitStatePanel,
  },
  data() {
    return {
      loadError: '',
      submitting: false,
      targetType: 'feed',
      targetId: '',
      targetUserId: '',
      conversationId: '',
      targetNickname: '',
      targetContent: '',
      form: {
        reasonCode: '',
        reasonText: '',
      },
      reasonOptions: REASON_OPTIONS,
      loginFrom: '/pages/report/create',
    }
  },
  computed: {
    targetTypeLabel() {
      return this.targetType === 'chat_user' ? '私信举报' : '动态举报'
    },
  },
  onLoad(options = {}) {
    this.loginFrom = buildReportFromPath(options)
    if (!this.requireLogin('请先登录后再提交举报', this.loginFrom)) {
      this.loadError = '请先登录'
      return
    }
    this.targetType = String(options.targetType || 'feed')
    this.targetId = String(options.targetId || '').trim()
    this.targetUserId = String(options.targetUserId || '').trim()
    this.conversationId = String(options.conversationId || '').trim()
    this.targetNickname = decodeURIComponent(options.targetNickname || '') || '举报对象'
    this.targetContent = decodeURIComponent(options.targetContent || '')
    if (!this.targetId || !['feed', 'chat_user'].includes(this.targetType)) {
      this.loadError = '举报对象无效'
    }
  },
  methods: {
    requireLogin(message = '请先登录后继续', from = '') {
      return requireAuthLogin({
        message,
        from: from || this.loginFrom || '/pages/report/create',
      })
    },
    selectReason(code) {
      this.form.reasonCode = code
    },
    async submitReport() {
      if (this.loadError) return
      if (!this.requireLogin('登录状态已过期，请重新登录')) return
      if (!this.form.reasonCode) {
        uni.showToast({ title: '请选择举报原因', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        await apiService.submitReport({
          targetType: this.targetType,
          targetId: this.targetId,
          targetUserId: this.targetUserId,
          conversationId: this.conversationId,
          targetNickname: this.targetNickname,
          targetContent: this.targetContent,
          reasonCode: this.form.reasonCode,
          reasonText: this.form.reasonText,
        })
        uni.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => {
          uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/notification/index' }) })
        }, 500)
      } catch (error) {
        uni.showToast({ title: error?.message || '提交失败，请稍后重试', icon: 'none' })
      } finally {
        this.submitting = false
      }
    },
  },
}
</script>

<style scoped lang="scss">
.report-page {
  min-height: 100vh;
  padding: 32rpx;
  background:
    radial-gradient(circle at top left, rgba(114, 228, 200, 0.14), transparent 34%),
    linear-gradient(180deg, #08131d 0%, #102030 100%);
}

.report-state,
.report-card,
.report-section,
.report-hero {
  margin-bottom: 24rpx;
}

.report-hero,
.report-card,
.report-section {
  padding: 32rpx;
  border-radius: 28rpx;
  background: rgba(8, 19, 29, 0.88);
  border: 2rpx solid rgba(255, 255, 255, 0.06);
}

.report-hero__kicker,
.report-hero__title,
.report-hero__desc,
.report-card__label,
.report-card__title,
.report-card__meta,
.report-card__content,
.report-section__title,
.reason-chip__title,
.reason-chip__desc {
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
  color: #f4fbf8;
}

.report-hero__desc,
.report-card__content,
.reason-chip__desc {
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: rgba(244, 251, 248, 0.7);
}

.report-card__label,
.report-card__meta,
.report-section__title {
  font-size: 24rpx;
  color: rgba(114, 228, 200, 0.76);
}

.report-card__title {
  margin-top: 16rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #f4fbf8;
}

.reason-grid {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 20rpx;
}

.reason-chip {
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.03);
  border: 2rpx solid rgba(255, 255, 255, 0.05);
}

.reason-chip--active {
  border-color: rgba(114, 228, 200, 0.52);
  background: rgba(114, 228, 200, 0.12);
}

.reason-chip__title {
  font-size: 30rpx;
  font-weight: 600;
  color: #f4fbf8;
}

.report-textarea {
  width: 100%;
  min-height: 220rpx;
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.04);
  color: #f4fbf8;
  box-sizing: border-box;
}

.report-textarea__placeholder {
  color: rgba(244, 251, 248, 0.4);
}

.report-submit {
  margin-top: 12rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #72e4c8, #4fb7c5);
  color: #042636;
  font-weight: 700;
}
</style>
