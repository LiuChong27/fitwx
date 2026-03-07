<template>
  <!-- 收入记录弹窗 -->
  <uni-popup ref="popup" type="bottom">
    <view class="sheet-box">
      <view class="sheet-header">
        <text class="sheet-title">收入记录</text>
        <view class="edit-close" @click="close">
          <uni-icons type="closeempty" size="20" color="rgba(255,255,255,0.6)" />
        </view>
      </view>
      <view class="income-summary">
        <view class="income-item">
          <text class="income-label">本月收入</text>
          <text class="income-value">¥{{ summary.month }}</text>
        </view>
        <view class="income-item">
          <text class="income-label">累计收入</text>
          <text class="income-value">¥{{ summary.total }}</text>
        </view>
      </view>
      <view v-if="records.length" class="income-list">
        <view v-for="r in records" :key="r.id" class="income-row">
          <view class="income-left">
            <text class="income-title">{{ r.title }}</text>
            <text class="income-date">{{ r.date }}</text>
          </view>
          <text class="income-amount">+¥{{ r.amount }}</text>
        </view>
      </view>
      <view v-else class="empty-tip">
        <text class="empty-text">暂无收入记录</text>
      </view>
    </view>
  </uni-popup>
</template>

<script>
export default {
  name: 'IncomePopup',
  props: {
    summary: { type: Object, default: () => ({ month: 0, total: 0 }) },
    records: { type: Array, default: () => [] },
  },
  methods: {
    open() {
      this.$refs.popup.open()
    },
    close() {
      this.$refs.popup.close()
    },
  },
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.sheet-box {
  background-color: $sl-card-bg-solid;
  border-radius: 30rpx 30rpx 0 0;
  padding: 40rpx;
  max-height: 70vh;
  overflow-y: auto;
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.4);
}
.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}
.sheet-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
}
.edit-close {
  padding: 8rpx;
}
.income-summary {
  display: flex;
  gap: 20rpx;
  margin-bottom: 30rpx;
}
.income-item {
  flex: 1;
  @include sl-card;
  padding: 24rpx;
  text-align: center;
}
.income-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.5);
  display: block;
  margin-bottom: 8rpx;
}
.income-value {
  font-size: 40rpx;
  font-weight: 700;
  color: $sl-cyan;
}
.income-list {
  max-height: 45vh;
  overflow-y: auto;
}
.income-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.income-left {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.income-title {
  font-size: 28rpx;
  color: #ffffff;
}
.income-date {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.4);
}
.income-amount {
  font-size: 32rpx;
  font-weight: 600;
  color: #4caf50;
}
.empty-tip {
  @include sl-card;
  padding: 40rpx;
  text-align: center;
}
.empty-text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.45);
}
</style>
