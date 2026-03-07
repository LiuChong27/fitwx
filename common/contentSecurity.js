/**
 * 前端内容安全模块 — 敏感词过滤 & 文本校验
 *
 * 定位：前端基础拦截层，用于在用户提交前快速拦截明显违规内容。
 *       **不替代** 云端 security.msgSecCheck —— 云端校验才是最终防线。
 *
 * 使用方式：
 *   import { validateText, validateImageFile, ContentType } from '@/common/contentSecurity.js'
 *
 *   // 文本校验
 *   const r = validateText(content, ContentType.CHAT)
 *   if (!r.valid) { uni.showToast({ title: r.reason, icon: 'none' }); return }
 *
 *   // 图片文件校验
 *   const r2 = validateImageFile(filePath, fileSize)
 *   if (!r2.valid) { ... }
 */
'use strict'

// ====== 内容类型 & 各类型长度限制 ======
const ContentType = Object.freeze({
  CHAT:    'chat',      // 聊天消息
  FEED:    'feed',      // 发布动态 / Feed
  COMMENT: 'comment',   // 评论
  INVITE:  'invite',    // 邀约消息
  BIO:     'bio',       // 个人简介
})

const LENGTH_LIMITS = {
  [ContentType.CHAT]:    { min: 1, max: 2000 },
  [ContentType.FEED]:    { min: 1, max: 5000 },
  [ContentType.COMMENT]: { min: 1, max: 500 },
  [ContentType.INVITE]:  { min: 1, max: 500 },
  [ContentType.BIO]:     { min: 0, max: 200 },
}

// ====== 敏感词库 ======
// 分类管理，便于后续维护和扩展
const _WORD_GROUPS = {
  // 违法违规
  illegal: [
    '赌博', '赌场', '网赌', '博彩',
    '代开发票', '假发票',
    '色情', '裸聊', '约炮',
    '枪支', '弹药', '管制刀具',
    '毒品', '冰毒', '大麻', '摇头丸',
    '洗钱', '走私',
  ],
  // 诈骗 / 灰产
  fraud: [
    '刷单', '刷信誉', '兼职打字',
    '日赚千元', '日赚百元', '轻松月入',
    '免费领取', '0元领',
    '传销', '拉人头',
    '内部消息', '稳赚不赔',
  ],
  // 引流 / 骚扰
  spam: [
    '加微信', '加我微信', '加V',
    '加QQ', '加扣扣',
    '私聊转账', '私信转账',
    '看我主页', '点我头像',
    '代理', '招代理',
  ],
  // 政治敏感（极简列表，主要依赖云端审核）
  political: [
    '翻墙', '科学上网', 'VPN',
  ],
  // 侮辱 / 人身攻击
  abuse: [
    '傻逼', '操你妈', '你妈死了', '去死',
    '脑残', '智障', '废物',
  ],
}

// 合并所有敏感词并构建正则
const _ALL_WORDS = Object.values(_WORD_GROUPS).flat()
const _SENSITIVE_REGEX = new RegExp(_ALL_WORDS.map(_escapeRegex).join('|'), 'i')

/** 正则特殊字符转义 */
function _escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ====== 图片校验配置 ======
const IMAGE_MAX_SIZE_MB = 10
const IMAGE_MAX_SIZE_BYTES = IMAGE_MAX_SIZE_MB * 1024 * 1024
const IMAGE_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']

// ====== 公共 API ======

/**
 * 校验文本内容
 *
 * @param {string}  content     原始文本
 * @param {string}  contentType ContentType 枚举值
 * @returns {{ valid: boolean, reason?: string, sanitized?: string }}
 */
function validateText(content, contentType = ContentType.CHAT) {
  if (typeof content !== 'string') {
    return { valid: false, reason: '内容必须为文本' }
  }

  const trimmed = content.trim()
  const limits = LENGTH_LIMITS[contentType] || LENGTH_LIMITS[ContentType.CHAT]

  // 长度校验
  if (limits.min > 0 && trimmed.length < limits.min) {
    return { valid: false, reason: '内容不能为空' }
  }
  if (trimmed.length > limits.max) {
    return { valid: false, reason: `内容长度不能超过${limits.max}字` }
  }

  // 敏感词校验
  if (_SENSITIVE_REGEX.test(trimmed)) {
    return { valid: false, reason: '内容包含违规信息，请修改后重试' }
  }

  return { valid: true, sanitized: trimmed }
}

/**
 * 校验图片文件（上传前调用）
 *
 * @param {string} filePath 本地文件路径
 * @param {number} [fileSize] 文件大小 (bytes)，不传则尝试自动获取
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateImageFile(filePath, fileSize) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, reason: '文件路径无效' }
  }

  // 扩展名校验
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (!IMAGE_ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, reason: `不支持的图片格式 (${ext})，请使用 JPG/PNG/GIF/WebP` }
  }

  // 文件大小校验
  if (typeof fileSize === 'number' && fileSize > IMAGE_MAX_SIZE_BYTES) {
    return { valid: false, reason: `图片不能超过 ${IMAGE_MAX_SIZE_MB}MB，请压缩后重试` }
  }

  return { valid: true }
}

/**
 * 检测文本是否包含敏感词（不做长度校验）
 * 适用于实时输入提示等场景
 *
 * @param {string} text
 * @returns {boolean}
 */
function hasSensitiveWord(text) {
  if (typeof text !== 'string' || !text.trim()) return false
  return _SENSITIVE_REGEX.test(text)
}

export {
  validateText,
  validateImageFile,
  hasSensitiveWord,
  ContentType,
  LENGTH_LIMITS,
  IMAGE_MAX_SIZE_MB,
  IMAGE_MAX_SIZE_BYTES,
  IMAGE_ALLOWED_EXTENSIONS,
}
export default {
  validateText,
  validateImageFile,
  hasSensitiveWord,
  ContentType,
}
