<template>
  <uni-popup ref="popup" type="bottom">
    <view class="sheet-box">
      <view class="sheet-header">
        <text class="sheet-title">训练数据</text>
        <view class="edit-close" @click="close">
          <uni-icons type="closeempty" size="20" color="rgba(255,255,255,0.6)" />
        </view>
      </view>

      <view class="stats-row">
        <view class="stat-item" v-for="item in statsList" :key="item.key">
          <text class="stat-value">{{ item.display }}</text>
          <text class="stat-label">{{ item.label }}</text>
        </view>
      </view>

      <view class="stats-actions">
        <button class="btn-ghost" @click="$emit('log-workout')">记录训练</button>
        <button class="btn-primary" @click="$emit('add-before-after')">新增对比</button>
      </view>

      <view v-if="beforeAfterList.length" class="ba-list">
        <view v-for="(item, i) in beforeAfterList" :key="i" class="ba-item">
          <view class="ba-half">
            <text class="ba-label">训练前</text>
            <image class="ba-img" :src="item.before" mode="aspectFill" />
          </view>
          <view class="ba-half">
            <text class="ba-label">训练后</text>
            <image class="ba-img" :src="item.after" mode="aspectFill" />
          </view>
        </view>
      </view>
      <fit-state-panel
        v-else
        compact
        scene="profile"
        kicker="前后对比"
        title="还没有上传训练对比"
        description="点击“新增对比”上传训练前后照片。"
      />
    </view>
  </uni-popup>
</template>

<script>
import FitStatePanel from '@/components/fit-state-panel.vue';

export default {
  name: 'TrainingStatsPopup',
  components: {
    FitStatePanel,
  },
  props: {
    statsList: {
      type: Array,
      default: () => [],
    },
    beforeAfterList: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['log-workout', 'add-before-after'],
  methods: {
    open() {
      this.$refs.popup.open();
    },
    close() {
      this.$refs.popup.close();
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.sheet-box {
  background-color: $sl-card-bg-solid;
  border-radius: 30rpx 30rpx 0 0;
  padding: 36rpx;
  max-height: 78vh;
  overflow-y: auto;
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.4);
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 26rpx;
}

.sheet-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
}

.edit-close {
  padding: 8rpx;
}

.stats-row {
  display: flex;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.stat-item {
  flex: 1;
  @include sl-card;
  padding: 18rpx 16rpx;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 8rpx;
}

.stat-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.55);
}

.stats-actions {
  display: flex;
  gap: 16rpx;
  margin-bottom: 22rpx;
}

.btn-ghost,
.btn-primary {
  flex: 1;
  height: 74rpx;
  line-height: 74rpx;
  border-radius: 38rpx;
  border: none;
  font-size: 26rpx;
}

.btn-ghost {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(255, 255, 255, 0.12);
}

.btn-primary {
  background: linear-gradient(135deg, #72E4C8, #8CEFD8);
  color: #08131D;
  font-weight: 700;
}

.ba-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.ba-item {
  display: flex;
  gap: 14rpx;
}

.ba-half {
  flex: 1;
}

.ba-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.62);
  display: block;
  margin-bottom: 8rpx;
}

.ba-img {
  width: 100%;
  height: 180rpx;
  border-radius: 14rpx;
}
</style>
