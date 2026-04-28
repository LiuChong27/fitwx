<template>
  <view class="shimmer-block" :class="shapeClass" :style="blockStyle" aria-hidden="true"></view>
</template>

<script>
export default {
  name: 'FitShimmerBlock',
  props: {
    width: {
      type: [String, Number],
      default: '100%'
    },
    height: {
      type: [String, Number],
      default: '24rpx'
    },
    radius: {
      type: [String, Number],
      default: '16rpx'
    },
    shape: {
      type: String,
      default: 'rounded'
    }
  },
  computed: {
    blockStyle() {
      return {
        width: this.normalizeUnit(this.width),
        height: this.normalizeUnit(this.height),
        borderRadius: this.shape === 'circle' ? '50%' : this.normalizeUnit(this.radius)
      }
    },
    shapeClass() {
      return this.shape === 'circle' ? 'shimmer-block--circle' : ''
    }
  },
  methods: {
    normalizeUnit(value) {
      if (typeof value === 'number') {
        return `${value}rpx`
      }
      return value
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.shimmer-block {
  display: block;
  @include skeleton-shimmer;
}

.shimmer-block--circle {
  flex-shrink: 0;
}
</style>