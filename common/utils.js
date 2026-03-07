/**
 * 通用工具函数模块
 * 包含节流、防抖、格式化等高频使用工具
 */

/**
 * 防抖函数 - 延迟执行，重复触发只执行最后一次
 * 适用场景：搜索输入、表单提交、窗口 resize
 * @param {Function} fn - 目标函数
 * @param {number} delay - 延迟时间（ms），默认 300
 * @param {boolean} immediate - 是否立即执行（首次触发时），默认 false
 * @returns {Function} 带 cancel() 方法的防抖函数
 */
export function debounce(fn, delay = 300, immediate = false) {
  let timer = null
  const debounced = function (...args) {
    const context = this
    if (timer) clearTimeout(timer)
    if (immediate && !timer) {
      fn.apply(context, args)
    }
    timer = setTimeout(() => {
      timer = null
      if (!immediate) fn.apply(context, args)
    }, delay)
  }
  debounced.cancel = () => {
    clearTimeout(timer)
    timer = null
  }
  return debounced
}

/**
 * 节流函数 - 固定间隔执行，高频触发时保证均匀执行
 * 适用场景：滚动事件、触底加载、点赞按钮
 * @param {Function} fn - 目标函数
 * @param {number} interval - 最小间隔时间（ms），默认 300
 * @param {Object} options - 配置项
 * @param {boolean} options.leading - 是否在间隔开始时执行，默认 true
 * @param {boolean} options.trailing - 是否在间隔结束后补执行，默认 true
 * @returns {Function} 带 cancel() 方法的节流函数
 */
export function throttle(fn, interval = 300, { leading = true, trailing = true } = {}) {
  let timer = null
  let lastTime = 0
  const throttled = function (...args) {
    const context = this
    const now = Date.now()
    if (!leading && lastTime === 0) lastTime = now
    const remaining = interval - (now - lastTime)
    if (remaining <= 0 || remaining > interval) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      lastTime = now
      fn.apply(context, args)
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        lastTime = leading ? Date.now() : 0
        timer = null
        fn.apply(context, args)
      }, remaining)
    }
  }
  throttled.cancel = () => {
    clearTimeout(timer)
    timer = null
    lastTime = 0
  }
  return throttled
}

/**
 * 格式化时间为相对描述（几分钟前、几小时前…）
 * @param {number|string|Date} timestamp - 时间戳（ms）/ ISO 字符串 / Date 对象
 * @returns {string} 相对时间描述
 */
export function timeAgo(timestamp) {
  const now = Date.now()
  const date = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime()
  const diff = now - date
  if (diff < 0) return '刚刚'
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

/**
 * 深拷贝（简化版，不处理循环引用和特殊类型）
 * @param {*} obj - 待拷贝对象
 * @returns {*} 深拷贝结果
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (Array.isArray(obj)) return obj.map(item => deepClone(item))
  const result = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = deepClone(obj[key])
    }
  }
  return result
}

/**
 * 数字格式化（如: 1200 → '1.2k'，100000 → '100k'）
 * @param {number} num - 数字
 * @returns {string} 格式化后的字符串
 */
export function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0'
  if (num < 1000) return String(num)
  if (num < 10000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  if (num < 1000000) return Math.floor(num / 1000) + 'k'
  return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
}

/**
 * 安全解析 JSON，失败时返回默认值
 * @param {string} str - JSON 字符串
 * @param {*} fallback - 解析失败时的默认值
 * @returns {*} 解析结果
 */
export function safeJSONParse(str, fallback = null) {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

/**
 * 生成唯一 ID（基于时间戳 + 随机数，非 UUID 标准）
 * @param {string} prefix - 前缀
 * @returns {string} 唯一 ID
 */
export function uniqueId(prefix = '') {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 8)
  return prefix ? `${prefix}_${ts}${rand}` : `${ts}${rand}`
}
