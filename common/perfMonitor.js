/**
 * 前端性能监控
 *
 * 采集指标：白屏时间、API P95 响应时间、FPS、内存占用
 * 上报策略：每 30s 汇总一次 → 批量上报
 *
 * 使用方式：
 *   import perfMonitor from '@/common/perfMonitor.js'
 *   perfMonitor.init()              // App.onLaunch
 *   perfMonitor.markApiStart(id)    // API 请求开始
 *   perfMonitor.markApiEnd(id)      // API 请求结束
 */
'use strict'

const REPORT_INTERVAL = 30000 // 30s

class PerfMonitor {
  constructor() {
    this._apiTimings = []        // { name, duration }
    this._fpsSamples = []
    this._launchTime = Date.now()
    this._firstRenderDone = false
    this._apiInFlight = new Map() // id → startTime
    this._timer = null
    this._fpsRunning = false      // FPS 采样控制开关
    this._appInForeground = true  // App 前后台状态
  }

  /** 初始化 */
  init() {
    this._startReportTimer()
    this._startFpsSampling()
    this._recordLaunchTime()
    this._listenAppLifecycle()
  }

  /** 标记首屏渲染完成 (在首页 onReady 中调用) */
  markFirstRender() {
    if (this._firstRenderDone) return
    this._firstRenderDone = true
    const ttfr = Date.now() - this._launchTime
    this._report('perf_first_render', { ttfr })
  }

  /** API 请求开始 */
  markApiStart(requestId, apiName = '') {
    this._apiInFlight.set(requestId, { start: Date.now(), name: apiName })
  }

  /** API 请求结束 */
  markApiEnd(requestId) {
    const entry = this._apiInFlight.get(requestId)
    if (!entry) return
    this._apiInFlight.delete(requestId)
    const duration = Date.now() - entry.start
    this._apiTimings.push({ name: entry.name, duration })
    // 保留最近 200 条
    if (this._apiTimings.length > 200) this._apiTimings.shift()
  }

  /** 计算 API 响应时间 P95 */
  getApiP95() {
    if (!this._apiTimings.length) return 0
    const sorted = this._apiTimings.map(t => t.duration).sort((a, b) => a - b)
    const idx = Math.floor(sorted.length * 0.95)
    return sorted[Math.min(idx, sorted.length - 1)]
  }

  /** 获取平均 FPS */
  getAvgFps() {
    if (!this._fpsSamples.length) return 60
    const sum = this._fpsSamples.reduce((s, v) => s + v, 0)
    return Math.round(sum / this._fpsSamples.length)
  }

  /** 获取内存占用 (仅 APP 端) */
  getMemoryUsage() {
    // #ifdef APP-PLUS
    try {
      const info = plus.runtime.getProperty(plus.runtime.appid, () => {})
      // plus.memory 并非标准 API，使用 performance 兜底
    } catch (_) { /* ignore */ }
    // #endif
    // 通用：使用 uni.getSystemInfoSync 估算
    try {
      const info = uni.getSystemInfoSync()
      return {
        deviceMemory: info.deviceMemory || 0,
      }
    } catch (_) {
      return {}
    }
  }

  // ─── 内部方法 ───

  _recordLaunchTime() {
    // 白屏率指标：记录 App 启动时间点
    this._report('perf_launch', {
      launchTime: this._launchTime,
      cold: true,
    })
  }

  _startFpsSampling() {
    // FPS 采样：仅在支持 requestAnimationFrame 的平台 (H5/APP)
    // 通过 _fpsRunning 标志位控制，destroy / App 进入后台时停止
    // #ifdef H5 || APP-PLUS
    if (this._fpsRunning) return
    this._fpsRunning = true
    let lastTime = Date.now()
    let frameCount = 0
    const measure = () => {
      if (!this._fpsRunning) return // ← 停止递归
      frameCount++
      const now = Date.now()
      if (now - lastTime >= 1000) {
        this._fpsSamples.push(frameCount)
        if (this._fpsSamples.length > 60) this._fpsSamples.shift()
        frameCount = 0
        lastTime = now
      }
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(measure)
      }
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(measure)
    }
    // #endif
  }

  /** 停止 FPS 采样 */
  _stopFpsSampling() {
    this._fpsRunning = false
  }

  /** 监听 App 前后台切换，后台时暂停采集节省资源 */
  _listenAppLifecycle() {
    try {
      uni.onAppShow && uni.onAppShow(() => {
        this._appInForeground = true
        this._startFpsSampling()
        this._startReportTimer()
      })
      uni.onAppHide && uni.onAppHide(() => {
        this._appInForeground = false
        this._stopFpsSampling()
        // 暂停定时上报
        if (this._timer) {
          clearInterval(this._timer)
          this._timer = null
        }
      })
    } catch (_) {
      // 部分平台不支持 onAppShow/onAppHide，静默忽略
    }
  }

  _startReportTimer() {
    if (this._timer) return
    this._timer = setInterval(() => this._periodicReport(), REPORT_INTERVAL)
  }

  async _periodicReport() {
    const metrics = {
      apiP95: this.getApiP95(),
      avgFps: this.getAvgFps(),
      memory: this.getMemoryUsage(),
      apiCount: this._apiTimings.length,
      timestamp: Date.now(),
    }
    this._report('perf_metrics', metrics)
  }

  async _report(type, data) {
    try {
      await uniCloud.callFunction({
        name: 'fit-ucenter-api',
        data: {
          action: 'reportPerf',
          params: { type, ...data },
        },
      })
    } catch (_) {
      // 静默失败：不影响用户体验
    }
  }

  destroy() {
    this._stopFpsSampling()
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }
}

const perfMonitor = new PerfMonitor()
export default perfMonitor
