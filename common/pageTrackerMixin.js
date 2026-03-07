/**
 * 页面级埋点 Mixin — 自动追踪 PV / 停留时长
 *
 * 在 main.js 中全局注册或按需引入：
 *   import pageTrackerMixin from '@/common/pageTrackerMixin.js'
 *   app.mixin(pageTrackerMixin)
 */
import analytics from '@/common/analytics.js'
import perfMonitor from '@/common/perfMonitor.js'

export default {
  onShow() {
    const pages = getCurrentPages()
    if (pages.length) {
      const cur = pages[pages.length - 1]
      const path = '/' + (cur.route || cur.__route__ || '')
      analytics.trackPageView(path, cur.options || {})
    }
  },
  onHide() {
    const pages = getCurrentPages()
    if (pages.length) {
      const cur = pages[pages.length - 1]
      const path = '/' + (cur.route || cur.__route__ || '')
      analytics.trackPageLeave(path)
    }
  },
  onReady() {
    // 首屏渲染标记（仅触发一次）
    perfMonitor.markFirstRender()
  },
}
