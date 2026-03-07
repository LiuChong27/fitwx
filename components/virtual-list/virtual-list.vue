<template>
  <!-- 虚拟滚动列表 - 只渲染可视区域内的列表项，适用于大量数据列表 -->
  <scroll-view
    scroll-y
    :class="['virtual-list', customClass]"
    :style="{ height: containerHeight }"
    :scroll-top="scrollTop"
    :scroll-into-view="scrollIntoView"
    :enable-back-to-top="enableBackToTop"
    :refresher-enabled="refresherEnabled"
    :refresher-triggered="refresherTriggered"
    @scroll="onScroll"
    @scrolltolower="onScrollToLower"
    @refresherrefresh="onRefresherRefresh"
  >
    <!-- 顶部占位 -->
    <view :style="{ height: topPlaceholderHeight + 'px' }" />

    <!-- 可视列表项 -->
    <view
      v-for="item in visibleItems"
      :key="item._virtualKey"
      :style="{ height: itemHeight + 'px' }"
    >
      <slot :item="item._rawItem" :index="item._virtualIndex" />
    </view>

    <!-- 底部占位 -->
    <view :style="{ height: bottomPlaceholderHeight + 'px' }" />

    <!-- 触底加载 -->
    <view v-if="loading" class="virtual-list__loading">
      <uni-load-more status="loading" />
    </view>
    <view v-else-if="noMore && list.length" class="virtual-list__no-more">
      <text class="no-more-text">{{ noMoreText }}</text>
    </view>

    <!-- 空状态 -->
    <view v-if="!loading && !list.length" class="virtual-list__empty">
      <slot name="empty">
        <text class="empty-text">{{ emptyText }}</text>
      </slot>
    </view>
  </scroll-view>
</template>

<script>
import { throttle } from '@/common/utils.js'

export default {
  name: 'VirtualList',
  props: {
    // 完整数据列表
    list: {
      type: Array,
      default: () => [],
    },
    // 每项的固定高度（rpx → 需转换为 px），单位 px
    itemHeight: {
      type: Number,
      default: 120,
    },
    // 容器高度（CSS 值）
    containerHeight: {
      type: String,
      default: '100vh',
    },
    // 缓冲区大小（上下各多渲染几条）
    buffer: {
      type: Number,
      default: 5,
    },
    // 唯一键字段名（用于 :key）
    keyField: {
      type: String,
      default: 'id',
    },
    // 是否正在加载
    loading: {
      type: Boolean,
      default: false,
    },
    // 是否没有更多
    noMore: {
      type: Boolean,
      default: false,
    },
    // 没有更多文案
    noMoreText: {
      type: String,
      default: '没有更多了',
    },
    // 空状态文案
    emptyText: {
      type: String,
      default: '暂无数据',
    },
    // 自定义 class
    customClass: {
      type: String,
      default: '',
    },
    // 距底部多少px触发加载更多
    lowerThreshold: {
      type: Number,
      default: 100,
    },
    // 启用下拉刷新
    refresherEnabled: {
      type: Boolean,
      default: false,
    },
    // 下拉刷新触发状态
    refresherTriggered: {
      type: Boolean,
      default: false,
    },
    // 启用回到顶部
    enableBackToTop: {
      type: Boolean,
      default: true,
    },
  },

  emits: ['load-more', 'refresh', 'scroll'],

  data() {
    return {
      scrollTop: 0,
      scrollIntoView: '',
      startIndex: 0,
      endIndex: 0,
    }
  },

  computed: {
    totalHeight() {
      return this.list.length * this.itemHeight
    },
    visibleCount() {
      // 估算可视区域能放多少条
      const sysInfo = uni.getSystemInfoSync()
      const containerPx = sysInfo.windowHeight
      return Math.ceil(containerPx / this.itemHeight) + 1
    },
    visibleItems() {
      const start = Math.max(0, this.startIndex - this.buffer)
      const end = Math.min(this.list.length, this.endIndex + this.buffer)
      const items = []
      for (let i = start; i < end; i++) {
        items.push({
          _rawItem: this.list[i],
          _virtualIndex: i,
          _virtualKey: this.list[i][this.keyField] || i,
        })
      }
      return items
    },
    topPlaceholderHeight() {
      const start = Math.max(0, this.startIndex - this.buffer)
      return start * this.itemHeight
    },
    bottomPlaceholderHeight() {
      const end = Math.min(this.list.length, this.endIndex + this.buffer)
      return Math.max(0, (this.list.length - end) * this.itemHeight)
    },
  },

  watch: {
    list() {
      this.updateVisibleRange(this._lastScrollTop || 0)
    },
  },

  created() {
    this._lastScrollTop = 0
    this.onScroll = throttle(this._handleScroll.bind(this), 16)
    this.updateVisibleRange(0)
  },

  methods: {
    _handleScroll(e) {
      const scrollTop = e.detail.scrollTop
      this._lastScrollTop = scrollTop
      this.updateVisibleRange(scrollTop)
      this.$emit('scroll', e)
    },

    updateVisibleRange(scrollTop) {
      this.startIndex = Math.floor(scrollTop / this.itemHeight)
      this.endIndex = this.startIndex + this.visibleCount
    },

    onScrollToLower() {
      if (!this.loading && !this.noMore) {
        this.$emit('load-more')
      }
    },

    onRefresherRefresh() {
      this.$emit('refresh')
    },

    /**
     * 手动滚动到指定索引
     * @param {number} index - 目标索引
     */
    scrollToIndex(index) {
      this.scrollTop = index * this.itemHeight
    },

    /**
     * 滚动到顶部
     */
    scrollToTop() {
      this.scrollTop = this._lastScrollTop // 先设不同值触发更新
      this.$nextTick(() => {
        this.scrollTop = 0
      })
    },
  },
}
</script>

<style lang="scss" scoped>
.virtual-list {
  width: 100%;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;

  &__loading,
  &__no-more,
  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32rpx 0;
  }

  .no-more-text,
  .empty-text {
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.45);
  }
}
</style>
