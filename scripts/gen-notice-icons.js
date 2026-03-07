/**
 * 生成通知 TabBar 图标 (notice.png / notice_active.png)
 * 纯 Node.js 实现，无外部依赖
 * 运行: node scripts/gen-notice-icons.js
 */
'use strict'
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// ─── PNG 编码器（零依赖）───
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filter: None
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4
      const di = y * (w * 4 + 1) + 1 + x * 4
      raw[di] = rgba[si]; raw[di + 1] = rgba[si + 1]
      raw[di + 2] = rgba[si + 2]; raw[di + 3] = rgba[si + 3]
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── 绘制铃铛图标 ───
function drawBell(size, r, g, b, alpha) {
  const pixels = new Uint8Array(size * size * 4)

  function setPixel(x, y, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    // alpha blending onto transparent
    const aa = Math.round(a * alpha)
    if (aa <= 0) return
    pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b
    pixels[i + 3] = Math.min(255, pixels[i + 3] + aa)
  }

  // 抗锯齿圆
  function fillCircle(cx, cy, radius) {
    const r2 = radius * radius
    const ir = Math.ceil(radius) + 1
    for (let dy = -ir; dy <= ir; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        const d2 = dx * dx + dy * dy
        if (d2 > (radius + 1) * (radius + 1)) continue
        let a = 1
        if (d2 > r2) a = Math.max(0, 1 - (Math.sqrt(d2) - radius))
        setPixel(Math.round(cx + dx), Math.round(cy + dy), a * 255)
      }
    }
  }

  // 抗锯齿椭圆
  function fillEllipse(cx, cy, rx, ry) {
    const irx = Math.ceil(rx) + 1
    const iry = Math.ceil(ry) + 1
    for (let dy = -iry; dy <= iry; dy++) {
      for (let dx = -irx; dx <= irx; dx++) {
        const nd = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
        if (nd > 1.5) continue
        let a = 1
        if (nd > 1) a = Math.max(0, 1 - (Math.sqrt(nd) - 1) * Math.min(rx, ry))
        setPixel(Math.round(cx + dx), Math.round(cy + dy), a * 255)
      }
    }
  }

  // 填充矩形（带圆角支持）
  function fillRect(x1, y1, x2, y2) {
    for (let y = Math.max(0, Math.floor(y1)); y <= Math.min(size - 1, Math.ceil(y2)); y++) {
      for (let x = Math.max(0, Math.floor(x1)); x <= Math.min(size - 1, Math.ceil(x2)); x++) {
        let a = 1
        if (x < x1) a *= (x + 1 - x1)
        if (x > x2 - 1) a *= (x2 - x)
        if (y < y1) a *= (y + 1 - y1)
        if (y > y2 - 1) a *= (y2 - y)
        setPixel(x, y, a * 255)
      }
    }
  }

  const cx = size / 2
  const s = size / 48 // 归一化因子 (基于 48px 设计)

  // 1) 铃铛主体 — 上半部分椭圆
  fillEllipse(cx, 18 * s, 13 * s, 12 * s)

  // 2) 铃铛下半部分 — 梯形/矩形
  fillRect(cx - 15 * s, 22 * s, cx + 15 * s, 34 * s)

  // 3) 底部横条（击锤座）
  fillEllipse(cx, 34 * s, 17 * s, 3 * s)

  // 4) 顶部小圆环（悬挂点）
  fillCircle(cx, 6 * s, 3 * s)

  // 5) 底部小球（铃锤）
  fillCircle(cx, 38 * s, 4 * s)

  return pixels
}

// ─── 主流程 ───
const SIZE = 81 // 高清 TabBar 图标

// 普通态: 半透明白色 rgba(255,255,255,0.4)
const normalPixels = drawBell(SIZE, 255, 255, 255, 0.4)
const normalPng = encodePNG(SIZE, SIZE, normalPixels)

// 激活态: 青色 #00E5FF
const activePixels = drawBell(SIZE, 0, 229, 255, 1.0)
const activePng = encodePNG(SIZE, SIZE, activePixels)

const outDir = path.resolve(__dirname, '..', 'static', 'tabbar')
fs.mkdirSync(outDir, { recursive: true })

fs.writeFileSync(path.join(outDir, 'notice.png'), normalPng)
fs.writeFileSync(path.join(outDir, 'notice_active.png'), activePng)

console.log(`✅ Generated notice icons (${SIZE}x${SIZE}px):`)
console.log(`   ${path.join(outDir, 'notice.png')} (${normalPng.length} bytes)`)
console.log(`   ${path.join(outDir, 'notice_active.png')} (${activePng.length} bytes)`)
