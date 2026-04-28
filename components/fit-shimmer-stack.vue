<template>
  <view class="shimmer-stack" :class="[`shimmer-stack--${variant}`]" aria-hidden="true">
    <view v-for="index in normalizedCount" :key="`${variant}-${index}`" class="shimmer-card">
      <template v-if="variant === 'discover'">
        <fit-shimmer-block class="shimmer-media" height="320rpx" radius="22rpx"></fit-shimmer-block>
        <fit-shimmer-block class="shimmer-line shimmer-line--lg" height="22rpx"></fit-shimmer-block>
        <fit-shimmer-block class="shimmer-line" height="22rpx"></fit-shimmer-block>
        <fit-shimmer-block class="shimmer-line shimmer-line--sm" height="22rpx"></fit-shimmer-block>
      </template>
      <template v-else-if="variant === 'notification'">
        <view class="shimmer-row shimmer-row--notification">
          <fit-shimmer-block class="shimmer-avatar shimmer-avatar--notification" width="88rpx" height="88rpx" shape="circle"></fit-shimmer-block>
          <view class="shimmer-stack__col">
            <fit-shimmer-block class="shimmer-line shimmer-line--title" height="24rpx"></fit-shimmer-block>
            <fit-shimmer-block class="shimmer-line shimmer-line--wide" height="24rpx"></fit-shimmer-block>
            <fit-shimmer-block class="shimmer-line shimmer-line--time" height="22rpx"></fit-shimmer-block>
          </view>
        </view>
      </template>
      <template v-else>
        <view class="shimmer-row">
          <fit-shimmer-block
            class="shimmer-avatar"
            :class="{ 'shimmer-avatar--square': variant === 'coach' }"
            :width="variant === 'coach' ? '110rpx' : '88rpx'"
            :height="variant === 'coach' ? '110rpx' : '88rpx'"
            :radius="variant === 'coach' ? '20rpx' : '50%'"
            :shape="variant === 'coach' ? 'rounded' : 'circle'"
          ></fit-shimmer-block>
          <view class="shimmer-stack__col">
            <fit-shimmer-block class="shimmer-line shimmer-line--title" height="22rpx"></fit-shimmer-block>
            <fit-shimmer-block class="shimmer-line shimmer-line--meta" height="22rpx"></fit-shimmer-block>
            <fit-shimmer-block v-if="variant === 'coach'" class="shimmer-line shimmer-line--wide" height="22rpx"></fit-shimmer-block>
          </view>
        </view>
        <template v-if="variant === 'need'">
          <fit-shimmer-block class="shimmer-line shimmer-line--wide" height="22rpx"></fit-shimmer-block>
          <fit-shimmer-block class="shimmer-line" height="22rpx"></fit-shimmer-block>
        </template>
      </template>
    </view>
  </view>
</template>

<script>
import FitShimmerBlock from './fit-shimmer-block.vue'

export default {
  name: 'FitShimmerStack',
  components: {
    FitShimmerBlock
  },
  props: {
    variant: {
      type: String,
      default: 'discover'
    },
    count: {
      type: Number,
      default: 2
    }
  },
  computed: {
    normalizedCount() {
      return Math.max(1, Number(this.count) || 1)
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.shimmer-stack {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.shimmer-card {
  @include fit-skeleton-card(24rpx, 30rpx);
}

.shimmer-stack--discover .shimmer-card {
  padding: 20rpx;
}

.shimmer-stack--notification .shimmer-card {
  padding: 24rpx;
}

.shimmer-media {
  margin-bottom: 18rpx;
}

.shimmer-line {
  margin-top: 14rpx;
}

.shimmer-line--lg {
  width: 68%;
}

.shimmer-line--sm {
  width: 42%;
}

.shimmer-row {
  display: flex;
  gap: 18rpx;
  align-items: center;
}

.shimmer-row--notification {
  align-items: flex-start;
}

.shimmer-avatar {
  flex-shrink: 0;
}

.shimmer-avatar--notification {
  margin-top: 4rpx;
}

.shimmer-avatar--square {
  border-radius: 20rpx;
}

.shimmer-stack__col {
  flex: 1;
}

.shimmer-line--title {
  width: 44%;
  margin-top: 0;
}

.shimmer-line--meta {
  width: 28%;
}

.shimmer-line--wide {
  width: 82%;
}

.shimmer-line--time {
  width: 30%;
}
</style>