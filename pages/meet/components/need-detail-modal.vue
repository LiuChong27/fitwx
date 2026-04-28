<template>
  <!-- 搭子需求详情弹窗 -->
  <uni-popup ref="popup" type="center">
    <view class="detail-card">
      <fit-state-panel
        v-if="!item"
        compact
        scene="meet"
        :kicker="$t('state.meet.detailEmpty.kicker')"
        :title="$t('state.meet.detailEmpty.title')"
        :description="$t('state.meet.detailEmpty.description')"
      />

      <template v-else>
      <view class="d-header fit-popup-enter fit-popup-enter--1">
        <image v-if="item.avatar" :src="item.avatar" class="d-avatar" mode="aspectFill" />
        <view v-else class="d-avatar d-avatar--empty">
          <uni-icons type="person-filled" size="28" color="rgba(255,255,255,0.4)" />
        </view>
        <view class="d-info">
          <text class="d-name">{{ item.nickname }}</text>
          <text class="d-time">发布于 {{ item.time }}</text>
        </view>
        <view class="d-price">{{ item.feeType }}</view>
      </view>
      <view class="d-body">
        <view class="d-facts fit-popup-enter fit-popup-enter--2">
          <view class="d-fact"><text class="label">项目</text><text>{{ item.sport }}</text></view>
          <view class="d-fact"><text class="label">时间</text><text>{{ item.date }}</text></view>
          <view class="d-fact"><text class="label">地点</text><text>{{ item.location }} ({{ formatDistance(item.distance) }})</text></view>
        </view>
        <view v-if="item.desc" class="d-desc fit-popup-enter fit-popup-enter--3">{{ item.desc }}</view>
        <fit-state-panel
          v-else
          class="desc-state fit-popup-enter fit-popup-enter--3"
          compact
          scene="meet"
          :kicker="$t('state.meet.detailDescEmpty.kicker')"
          :title="$t('state.meet.detailDescEmpty.title')"
          :description="$t('state.meet.detailDescEmpty.description')"
        />
      </view>
      <view class="d-footer fit-popup-enter fit-popup-enter--4">
        <button class="detail-btn ghost" @click="close">关闭</button>
        <button v-if="item.isMine" class="detail-btn primary" @click="$emit('edit', item)">编辑</button>
        <button v-if="item.isMine" class="detail-btn danger" @click="$emit('delete', item)">删除</button>
        <button v-else class="detail-btn primary detail-btn--wide" @click="$emit('chat', item)">我要参加 / 联系对方</button>
      </view>
      </template>
    </view>
  </uni-popup>
</template>

<script>
import FitStatePanel from '@/components/fit-state-panel.vue'

export default {
  name: 'NeedDetailModal',
  components: {
    FitStatePanel,
  },
  props: {
    item: { type: Object, default: null },
  },
  emits: ['edit', 'delete', 'chat'],
  methods: {
    open() {
      this.$refs.popup.open()
    },
    close() {
      this.$refs.popup.close()
    },
    formatDistance(distance) {
      const value = Number(distance)
      if (!Number.isFinite(value)) return '距离未知'
      if (value < 0.1) return '100m内'
      if (value < 1) return `${Math.round(value * 1000)}m`
      return `${value.toFixed(1)}km`
    },
  },
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.detail-card {
  width: 600rpx;
  @include fit-surface-card(40rpx, 30rpx);
  padding: 40rpx;
  box-shadow: 0 16rpx 60rpx rgba(0, 0, 0, 0.4);
}
.d-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 30rpx;
  margin-bottom: 30rpx;
}
.d-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  margin-right: 24rpx;
  border: 1px solid rgba(114, 228, 200, 0.18);
}
.d-avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  @include fit-image-placeholder(50%, 0);
}
.d-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.d-name {
  font-size: 34rpx;
  font-weight: 600;
  color: #ffffff;
}
.d-time {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 6rpx;
}
.d-price {
  font-size: 26rpx;
  color: #ffb74d;
  background: rgba(255, 183, 77, 0.1);
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  border: 1px solid rgba(255, 183, 77, 0.15);
}
.d-body {
  margin-bottom: 40rpx;
}
.d-facts {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.d-fact {
  @include fit-form-panel(20rpx 22rpx, 22rpx);
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.84);
}
.d-fact .label {
  color: rgba(255, 255, 255, 0.48);
  flex-shrink: 0;
}
.d-desc {
  @include fit-form-panel(24rpx, 20rpx);
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.6;
  margin-top: 24rpx;
}
.desc-state {
  margin-top: 24rpx;
  padding-left: 0;
  padding-right: 0;
}
.d-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 20rpx;
}

.detail-btn {
  @include fit-pill-button('ghost', 76rpx, 38rpx);
  min-width: 140rpx;
  font-size: 26rpx;
}

.detail-btn.primary {
  @include fit-pill-button('primary', 76rpx, 38rpx);
}

.detail-btn.danger {
  @include fit-pill-button('danger', 76rpx, 38rpx);
}

.detail-btn--wide {
  flex: 1;
}

@include fit-popup-enter-classes(4);
</style>
