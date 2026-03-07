/**
 * 带 TTL 的本地缓存系统 + 乐观更新策略
 *
 * 功能：
 * 1. 读取时优先返回缓存，后台静默刷新 (stale-while-revalidate)
 * 2. 写入时乐观更新本地 → 异步同步云端 → 失败回滚
 * 3. TTL (time-to-live) 过期自动清除
 *
 * 使用方式：
 *   import cache from '@/common/cacheManager.js'
 *   const data = await cache.getOrFetch('profile', () => apiService.getProfile(), { ttl: 300 })
 *   await cache.optimisticUpdate('profile', newData, () => apiService.updateProfile(newData))
 */
'use strict'

const DEFAULT_TTL = 300 // 5 分钟 (秒)
const CACHE_PREFIX = '__fit_cache_'
const MAX_MEM_CACHE_SIZE = 100 // 内存缓存最大条目数

class CacheManager {
  constructor() {
    this._memCache = new Map()
  }

  /**
   * 读取缓存 (带 TTL 检查)
   * @returns {*|null}
   */
  get(key) {
    // 优先内存缓存
    const mem = this._memCache.get(key)
    if (mem && !this._isExpired(mem)) {
      return mem.data
    }

    // 降级到持久存储
    try {
      const raw = uni.getStorageSync(CACHE_PREFIX + key)
      if (raw) {
        const entry = JSON.parse(raw)
        if (!this._isExpired(entry)) {
          // 回填内存缓存
          this._memCache.set(key, entry)
          return entry.data
        }
        // 过期 → 删除
        this.remove(key)
      }
    } catch (_) { /* ignore parse errors */ }
    return null
  }

  /**
   * 写入缓存
   * @param {string} key
   * @param {*}      data
   * @param {number} ttl  秒 (默认 300s)
   */
  set(key, data, ttl = DEFAULT_TTL) {
    const entry = {
      data,
      ts: Date.now(),
      ttl: ttl * 1000, // 转毫秒
    }
    this._memCache.set(key, entry)
    // 超过上限时淘汰最旧的条目 (LRU-like)
    if (this._memCache.size > MAX_MEM_CACHE_SIZE) {
      const firstKey = this._memCache.keys().next().value
      this._memCache.delete(firstKey)
    }
    try {
      uni.setStorageSync(CACHE_PREFIX + key, JSON.stringify(entry))
    } catch (_) { /* 高频、静默 */ }
  }

  /** 删除缓存 */
  remove(key) {
    this._memCache.delete(key)
    try {
      uni.removeStorageSync(CACHE_PREFIX + key)
    } catch (_) { /* ignore */ }
  }

  /** 清除所有 fit 缓存 */
  clear() {
    this._memCache.clear()
    try {
      const res = uni.getStorageInfoSync()
      const keys = res.keys || []
      keys.forEach(k => {
        if (k.startsWith(CACHE_PREFIX)) {
          uni.removeStorageSync(k)
        }
      })
    } catch (_) { /* ignore */ }
  }

  /**
   * Stale-While-Revalidate 模式
   *
   * 1. 有缓存 → 立刻返回缓存数据 → 后台静默刷新
   * 2. 无缓存 → 等待 fetcher 返回
   *
   * @param {string}   key
   * @param {function} fetcher  返回 Promise 的数据请求函数
   * @param {object}   opts     { ttl, forceRefresh }
   * @returns {Promise<*>}
   */
  async getOrFetch(key, fetcher, opts = {}) {
    const { ttl = DEFAULT_TTL, forceRefresh = false } = opts

    if (!forceRefresh) {
      const cached = this.get(key)
      if (cached !== null) {
        // 后台静默刷新 (不 await)
        this._bgRefresh(key, fetcher, ttl)
        return cached
      }
    }

    // 无缓存或强制刷新
    const data = await fetcher()
    this.set(key, data, ttl)
    return data
  }

  /**
   * 乐观更新
   *
   * 1. 立刻更新本地缓存为 newData
   * 2. 异步调用 updater() 同步到云端
   * 3. 如果 updater() 失败 → 回滚到 oldData
   *
   * @param {string}   key
   * @param {*}        newData
   * @param {function} updater  返回 Promise
   * @param {number}   ttl
   */
  async optimisticUpdate(key, newData, updater, ttl = DEFAULT_TTL) {
    const oldData = this.get(key)
    // 乐观更新
    this.set(key, newData, ttl)
    try {
      await updater()
    } catch (err) {
      // 回滚
      if (oldData !== null) {
        this.set(key, oldData, ttl)
      } else {
        this.remove(key)
      }
      throw err
    }
  }

  // ─── 内部方法 ───

  _isExpired(entry) {
    if (!entry || !entry.ts) return true
    return Date.now() - entry.ts > (entry.ttl || DEFAULT_TTL * 1000)
  }

  async _bgRefresh(key, fetcher, ttl) {
    try {
      const data = await fetcher()
      this.set(key, data, ttl)
    } catch (_) {
      // 静默失败：继续使用旧缓存
    }
  }
}

const cacheManager = new CacheManager()
export default cacheManager
