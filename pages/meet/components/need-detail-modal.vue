<template>
  <!-- 搭子需求详情弹窗 -->
  <uni-popup ref="popup" type="center">
    <view class="detail-card" v-if="item">
      <view class="d-header">
        <image :src="item.avatar" class="d-avatar" mode="aspectFill" />
        <view class="d-info">
          <text class="d-name">{{ item.nickname }}</text>
          <text class="d-time">发布于 {{ item.time }}</text>
        </view>
        <view class="d-price">{{ item.feeType }}</view>
      </view>
      <view class="d-body">
        <view class="d-row"><text class="label">项目：</text><text>{{ item.sport }}</text></view>
        <view class="d-row"><text class="label">时间：</text><text>{{ item.date }}</text></view>
        <view class="d-row"><text class="label">地点：</text><text>{{ item.location }} ({{ item.distance }}km)</text></view>
        <view class="d-desc">{{ item.desc }}</view>
      </view>
      <view class="d-footer">
        <button type="default" size="mini" @click="close">关闭</button>
        <button v-if="item.isMine" type="primary" size="mini" @click="$emit('edit', item)">编辑</button>
        <button v-if="item.isMine" type="warn" size="mini" @click="$emit('delete', item)">删除</button>
        <button v-else type="primary" size="mini" @click="$emit('chat', item)">我要参加/联系TA</button>
      </view>
    </view>
  </uni-popup>
</template>

<script>
export default {
  name: 'NeedDetailModal',
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
  },
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.detail-card {
  width: 600rpx;
  @include glass-card(rgba(13, 27, 42, 0.95));
  border-radius: 30rpx;
  padding: 40rpx;
  box-shadow: 0 16rpx 60rpx rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 229, 255, 0.08);
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
  border: 1px solid rgba(0, 229, 255, 0.15);
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
.d-row {
  display: flex;
  margin-bottom: 20rpx;
  font-size: 30rpx;
  color: rgba(255, 255, 255, 0.85);
}
.d-row .label {
  color: rgba(255, 255, 255, 0.45);
  width: 110rpx;
}
.d-desc {
  background: rgba(0, 229, 255, 0.04);
  padding: 24rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.6;
  margin-top: 24rpx;
  border: 1px solid rgba(0, 229, 255, 0.06);
}
.d-footer {
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
}
</style>
