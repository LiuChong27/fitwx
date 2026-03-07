/**
 * 全链路埋点 & 统计系统
 *
 * 功能：PV/UV 追踪、漏斗分析、自定义事件上报、页面停留时长
 * 上报策略：批量 + 定时队列（减少云函数调用次数）
 *
 * 使用方式：
 *   import analytics from '@/common/analytics.js'
 *   analytics.trackEvent('click_publish', { category: 'meet' })
 *   analytics.trackPageView('/pages/meet/meet')
 */
'use strict'

const BATCH_SIZE = 20
const FLUSH_INTERVAL = 10000 // 10s
const MAX_QUEUE_SIZE = 500   // 队列上限，防止内存膨胀

/** 生成简单 UUID (无外部依赖) */
function uuid() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    ((Math.random() * 16) | 0).toString(16)
  )
}

/** 获取或生成匿名设备 ID */
function getDeviceId() {
  let id = ''
  try {
    id = uni.getStorageSync('__fit_device_id')
  } catch (_) { /* ignore */ }
  if (!id) {
    id = uuid()
    try { uni.setStorageSync('__fit_device_id', id) } catch (_) { /* ignore */ }
  }
  return id
}

/** 获取会话 ID (每次冷启动重新生成) */
const sessionId = uuid()

/** 获取基础设备信息 (只读一次) */
let _sysInfo = null
function getSysInfo() {
  if (_sysInfo) return _sysInfo
  try {
    const info = uni.getSystemInfoSync()
    _sysInfo = {
      platform: info.platform || '',
      brand: info.brand || '',
      model: info.model || '',
      system: info.system || '',
      screenWidth: info.screenWidth || 0,
      screenHeight: info.screenHeight || 0,
      language: info.language || '',
      version: info.appVersion || info.SDKVersion || '',
    }
  } catch (_) {
    _sysInfo = {}
  }
  return _sysInfo
}

class Analytics {
  constructor() {
    this._queue = []
    this._deviceId = getDeviceId()
    this._sessionId = sessionId
    this._pageEnterTime = {}
    this._funnels = {}
    this._timer = null
  }

  /** 初始化 (在 App.onLaunch 中调用) */
  init() {
    this._startFlushTimer()
    // 记录启动事件
    this.trackEvent('app_launch', {
      ...getSysInfo(),
    })
  }

  /** 追踪页面浏览 (PV) */
  trackPageView(pagePath, options = {}) {
    this._pageEnterTime[pagePath] = Date.now()
    this._push({
      type: 'pv',
      page: pagePath,
      query: options,
    })
  }

  /** 追踪页面离开 (计算停留时长) */
  trackPageLeave(pagePath) {
    const enterTime = this._pageEnterTime[pagePath]
    const duration = enterTime ? Date.now() - enterTime : 0
    delete this._pageEnterTime[pagePath]
    this._push({
      type: 'page_leave',
      page: pagePath,
      duration,
    })
  }

  /**
   * 追踪自定义事件
   * @param {string} eventName 事件名称 (如 click_publish, submit_invite)
   * @param {object} params   事件参数
   */
  trackEvent(eventName, params = {}) {
    this._push({
      type: 'event',
      event: eventName,
      params,
    })
  }

  /**
   * 漏斗追踪
   * @param {string} funnelName 漏斗名称 (如 login_funnel, publish_funnel)
   * @param {string} step       步骤 (如 view, input, submit, success)
   */
  trackFunnel(funnelName, step, params = {}) {
    if (!this._funnels[funnelName]) {
      this._funnels[funnelName] = { start: Date.now(), steps: [] }
    }
    this._funnels[funnelName].steps.push(step)
    this._push({
      type: 'funnel',
      funnel: funnelName,
      step,
      params,
    })
  }

  /** 内部：推入队列 */
  _push(data) {
    // 队列溢出保护：丢弃最旧的事件
    if (this._queue.length >= MAX_QUEUE_SIZE) {
      this._queue.splice(0, this._queue.length - MAX_QUEUE_SIZE + 1)
    }
    this._queue.push({
      ...data,
      ts: Date.now(),
      deviceId: this._deviceId,
      sessionId: this._sessionId,
    })
    if (this._queue.length >= BATCH_SIZE) {
      this.flush()
    }
  }

  /** 批量上报到云端 */
  async flush() {
    if (!this._queue.length) return
    const batch = this._queue.splice(0, BATCH_SIZE)
    try {
      await uniCloud.callFunction({
        name: 'fit-ucenter-api',
        data: {
          action: 'reportAnalytics',
          params: { events: batch },
        },
      })
    } catch (err) {
      // 上报失败：回收到队列头部，下次重试
      // 但要防止无限膨胀：只在队列未满时回收
      if (this._queue.length + batch.length <= MAX_QUEUE_SIZE) {
        this._queue.unshift(...batch)
      }
      if (typeof console !== 'undefined') {
        console.warn('[analytics] flush failed, will retry:', err.message || err)
      }
    }
  }

  /** 定时刷新 */
  _startFlushTimer() {
    if (this._timer) return
    this._timer = setInterval(() => this.flush(), FLUSH_INTERVAL)
  }

  /** 销毁 */
  destroy() {
    this.flush()
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }
}

const analytics = new Analytics()
export default analytics
