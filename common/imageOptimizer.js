/**
 * WebP 图片处理工具 — 云端自动转换 + 按需裁剪
 *
 * 由于 uniCloud 上传回调可在云函数中自动触发图片格式转换，
 * 此文件提供前端辅助工具：
 * 1. 上传时自动添加 WebP 转换参数
 * 2. 根据显示尺寸生成裁剪 URL
 * 3. 检测浏览器/平台 WebP 支持
 *
 * 阿里云 OSS 图片处理 URL 格式：
 *   {fileUrl}?x-oss-process=image/format,webp/resize,w_{width}
 *
 * 使用方式：
 *   import { webpUrl, thumbnailUrl } from '@/common/imageOptimizer.js'
 *   const url = webpUrl(originalUrl)
 *   const thumb = thumbnailUrl(originalUrl, 200)
 */
'use strict'

let _supportsWebP = null

/**
 * 检测 WebP 支持 (缓存结果)
 * APP/小程序默认支持 WebP
 */
export function supportsWebP() {
  if (_supportsWebP !== null) return _supportsWebP

  // #ifdef APP-PLUS || MP-WEIXIN
  _supportsWebP = true
  
  // #endif

  // #ifdef H5
  try {
    const canvas = document.createElement('canvas')
    _supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  } catch (_) {
    _supportsWebP = false
  }
  
  // #endif

  // 其他平台默认开启
  if (_supportsWebP === null) {
    _supportsWebP = true
  }
  return _supportsWebP
}

/**
 * 将云存储 URL 转为 WebP 格式 (阿里云 OSS)
 * 如果不支持 WebP 或非阿里云 URL，返回原始 URL
 *
 * @param {string} url 原始图片 URL
 * @returns {string}
 */
export function webpUrl(url) {
  if (!url || typeof url !== 'string') return url || ''
  if (!supportsWebP()) return url
  if (isCloudFileId(url)) return url

  // 只处理阿里云 OSS / uniCloud 云存储 URL
  if (!isOssUrl(url)) return url

  // 已有处理参数 → 追加 format,webp
  if (url.includes('x-oss-process=')) {
    if (url.includes('format,webp')) return url
    return url + '/format,webp'
  }

  return url + '?x-oss-process=image/format,webp'
}

/**
 * 生成缩略图 URL (带 WebP + 宽度裁剪)
 *
 * @param {string} url   原始图片 URL
 * @param {number} width 目标宽度 (px)
 * @param {number} quality 质量 (1-100，默认 80)
 * @returns {string}
 */
export function thumbnailUrl(url, width = 200, quality = 80) {
  if (!url || typeof url !== 'string') return url || ''
  if (isCloudFileId(url)) return url
  if (!isOssUrl(url)) return url

  const params = [`resize,w_${width}`, `quality,Q_${quality}`]
  if (supportsWebP()) params.push('format,webp')

  const process = 'image/' + params.join('/')

  if (url.includes('x-oss-process=')) {
    return url + '/' + params.join('/')
  }

  return url + '?x-oss-process=' + process
}

/**
 * 头像专用：小尺寸 + 圆形裁剪
 * @param {string} url
 * @param {number} size 宽=高 (默认 120)
 */
export function avatarUrl(url, size = 120) {
  if (!url || typeof url !== 'string') return url || ''
  if (isCloudFileId(url)) return url
  if (!isOssUrl(url)) return url

  const params = [
    `resize,m_fill,w_${size},h_${size}`,
    'quality,Q_85',
  ]
  if (supportsWebP()) params.push('format,webp')

  const process = 'image/' + params.join('/')
  if (url.includes('x-oss-process=')) {
    return url + '/' + params.join('/')
  }

  return url + '?x-oss-process=' + process
}

/**
 * 封面图专用：16:9 裁剪
 * @param {string} url
 * @param {number} width 目标宽度 (默认 750)
 */
export function coverUrl(url, width = 750) {
  if (!url || typeof url !== 'string') return url || ''
  if (isCloudFileId(url)) return url
  if (!isOssUrl(url)) return url

  const height = Math.round(width * 9 / 16)
  const params = [
    `resize,m_fill,w_${width},h_${height}`,
    'quality,Q_80',
  ]
  if (supportsWebP()) params.push('format,webp')

  const process = 'image/' + params.join('/')
  if (url.includes('x-oss-process=')) {
    return url + '/' + params.join('/')
  }

  return url + '?x-oss-process=' + process
}

// ─── 内部工具 ───

function isOssUrl(url) {
  return (
    url.includes('aliyuncs.com') ||
    url.includes('bspapp.com') ||
    url.includes('cdn.bspapp.com') ||
    url.startsWith('cloud://') ||
    url.includes('vkceyugu.cdn')
  )
}

function isCloudFileId(url) {
  return typeof url === 'string' && url.startsWith('cloud://')
}

export default {
  supportsWebP,
  webpUrl,
  thumbnailUrl,
  avatarUrl,
  coverUrl,
}
