/**
 * Tab 页数据缓存 Mixin — 保持切换时不丢失状态
 *
 * uni-app 的 tabBar 页面组件实例在切换时不销毁 (原生 keep-alive),
 * 但 H5 端可能因路由切换导致状态重置。
 *
 * 此 mixin 提供:
 * 1. 自动在 onHide 时存储页面关键数据到内存
 * 2. 自动在 onShow 时恢复缓存数据
 * 3. 避免 onShow 时不必要的重复请求
 *
 * 使用方式:
 *   import tabCacheMixin from '@/common/tabCacheMixin.js'
 *   export default {
 *     mixins: [tabCacheMixin],
 *     tabCacheKeys: ['feedList', 'filters', 'current'], // 要缓存的 data key
 *     ...
 *   }
 */

const _cache = new Map()

export default {
  data() {
    return {
      /** 标记数据是否已加载过 (避免 onShow 重复请求) */
      _tabDataLoaded: false,
    }
  },

  onShow() {
    const keys = this.$options.tabCacheKeys
    if (!keys || !keys.length) return

    const pagePath = this._getPagePath()
    const cached = _cache.get(pagePath)
    if (cached && !this._tabDataLoaded) {
      // 恢复缓存数据
      keys.forEach(key => {
        if (cached[key] !== undefined) {
          this[key] = cached[key]
        }
      })
      this._tabDataLoaded = true
    }
  },

  onHide() {
    const keys = this.$options.tabCacheKeys
    if (!keys || !keys.length) return

    const pagePath = this._getPagePath()
    const snapshot = {}
    keys.forEach(key => {
      snapshot[key] = this[key]
    })
    _cache.set(pagePath, snapshot)
  },

  methods: {
    /**
     * 手动标记需要刷新 (如下拉刷新后)
     * 下次 onShow 会跳过缓存、强制请求
     */
    invalidateTabCache() {
      this._tabDataLoaded = false
      const pagePath = this._getPagePath()
      _cache.delete(pagePath)
    },

    _getPagePath() {
      const pages = getCurrentPages()
      if (pages.length) {
        const cur = pages[pages.length - 1]
        return cur.route || cur.__route__ || ''
      }
      return ''
    },
  },
}
