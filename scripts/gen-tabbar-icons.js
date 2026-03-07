/**
 * 生成全套 TabBar 图标 — Shorelines Energy Utilities 风格
 * 纯 Node.js，零外部依赖
 * 运行: node scripts/gen-tabbar-icons.js
 *
 * 输出 8 个文件到 static/tabbar/:
 *   list.png / list_active.png       — Meet 约练（日历+人物）
 *   grid.png / grid_active.png       — Discover 发现（指南针/探索）
 *   me.png   / me_active.png         — 我的（用户头像）
 *   notice.png / notice_active.png   — 消息（铃铛）
 */
'use strict'
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// ════════════════════════════════════════════════════════════
//  PNG 编码器
// ════════════════════════════════════════════════════════════
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
  ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
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

// ════════════════════════════════════════════════════════════
//  像素级绘图原语（抗锯齿）
// ════════════════════════════════════════════════════════════
class Canvas {
  constructor(size) {
    this.size = size
    this.pixels = new Float64Array(size * size * 4) // float for blending
  }

  /** 混合单像素 (pre-multiplied alpha blend) */
  blend(x, y, r, g, b, a) {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || x >= this.size || y < 0 || y >= this.size || a <= 0) return
    const i = (y * this.size + x) * 4
    const srcA = a / 255
    const dstA = this.pixels[i + 3] / 255
    const outA = srcA + dstA * (1 - srcA)
    if (outA > 0) {
      this.pixels[i]     = (r * srcA + this.pixels[i]     * dstA * (1 - srcA)) / outA
      this.pixels[i + 1] = (g * srcA + this.pixels[i + 1] * dstA * (1 - srcA)) / outA
      this.pixels[i + 2] = (b * srcA + this.pixels[i + 2] * dstA * (1 - srcA)) / outA
      this.pixels[i + 3] = outA * 255
    }
  }

  /** 抗锯齿填充圆 */
  fillCircle(cx, cy, radius, r, g, b, a = 255) {
    const ir = Math.ceil(radius) + 2
    for (let dy = -ir; dy <= ir; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > radius + 1) continue
        const coverage = Math.max(0, Math.min(1, radius + 0.5 - d))
        this.blend(cx + dx, cy + dy, r, g, b, a * coverage)
      }
    }
  }

  /** 抗锯齿填充椭圆 */
  fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
    const ir = Math.ceil(Math.max(rx, ry)) + 2
    for (let dy = -ir; dy <= ir; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        const nd = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry))
        if (nd > 1.5) continue
        const coverage = Math.max(0, Math.min(1, 1.5 - nd))
        this.blend(cx + dx, cy + dy, r, g, b, a * coverage)
      }
    }
  }

  /** 抗锯齿线段 (Xiaolin Wu style) */
  drawLine(x0, y0, x1, y1, r, g, b, a, thickness = 2) {
    const len = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)
    if (len < 0.1) return
    const steps = Math.max(Math.ceil(len * 2), 1)
    const halfT = thickness / 2
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const px = x0 + (x1 - x0) * t
      const py = y0 + (y1 - y0) * t
      // fill a small circle at each step for thickness
      for (let dy = -Math.ceil(halfT) - 1; dy <= Math.ceil(halfT) + 1; dy++) {
        for (let dx = -Math.ceil(halfT) - 1; dx <= Math.ceil(halfT) + 1; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d > halfT + 1) continue
          const coverage = Math.max(0, Math.min(1, halfT + 0.5 - d))
          this.blend(px + dx, py + dy, r, g, b, a * coverage)
        }
      }
    }
  }

  /** 抗锯齿填充圆环 */
  fillRing(cx, cy, outerR, innerR, r, g, b, a = 255) {
    const ir = Math.ceil(outerR) + 2
    for (let dy = -ir; dy <= ir; dy++) {
      for (let dx = -ir; dx <= ir; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > outerR + 1 || d < innerR - 1) continue
        const outerCov = Math.max(0, Math.min(1, outerR + 0.5 - d))
        const innerCov = Math.max(0, Math.min(1, d - innerR + 0.5))
        const coverage = outerCov * innerCov
        this.blend(cx + dx, cy + dy, r, g, b, a * coverage)
      }
    }
  }

  /** 填充矩形 (带抗锯齿边缘) */
  fillRect(x1, y1, x2, y2, r, g, b, a = 255) {
    for (let y = Math.floor(y1) - 1; y <= Math.ceil(y2) + 1; y++) {
      for (let x = Math.floor(x1) - 1; x <= Math.ceil(x2) + 1; x++) {
        let cx = Math.max(0, Math.min(1, Math.min(x + 1 - x1, x2 - x, 1)))
        let cy = Math.max(0, Math.min(1, Math.min(y + 1 - y1, y2 - y, 1)))
        const coverage = cx * cy
        if (coverage > 0) this.blend(x, y, r, g, b, a * coverage)
      }
    }
  }

  /** 填充圆角矩形 */
  fillRoundRect(x1, y1, x2, y2, radius, r, g, b, a = 255) {
    for (let y = Math.floor(y1) - 1; y <= Math.ceil(y2) + 1; y++) {
      for (let x = Math.floor(x1) - 1; x <= Math.ceil(x2) + 1; x++) {
        // signed distance to rounded rect
        const dx = Math.max(x1 + radius - x, 0, x - (x2 - radius))
        const dy = Math.max(y1 + radius - y, 0, y - (y2 - radius))
        let d
        if (dx > 0 && dy > 0) {
          d = Math.sqrt(dx * dx + dy * dy) - radius
        } else {
          const ex = Math.max(x1 - x, 0, x - x2)
          const ey = Math.max(y1 - y, 0, y - y2)
          d = Math.max(ex, ey)
        }
        const coverage = Math.max(0, Math.min(1, 0.5 - d))
        if (coverage > 0) this.blend(x, y, r, g, b, a * coverage)
      }
    }
  }

  /** 填充三角形 */
  fillTriangle(ax, ay, bx, by, cx, cy, r, g, b, a = 255) {
    const minX = Math.floor(Math.min(ax, bx, cx)) - 1
    const maxX = Math.ceil(Math.max(ax, bx, cx)) + 1
    const minY = Math.floor(Math.min(ay, by, cy)) - 1
    const maxY = Math.ceil(Math.max(ay, by, cy)) + 1
    const area2 = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay))
    if (area2 < 0.01) return
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5
        const w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / area2
        const w1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) / area2
        const w2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) / area2
        const inside = Math.min(w0, w1, w2)
        if (inside < -0.02) continue
        const coverage = Math.max(0, Math.min(1, inside * area2 * 0.5 + 0.5))
        this.blend(x, y, r, g, b, a * coverage)
      }
    }
  }

  /** 弧形线段 */
  drawArc(cx, cy, radius, startAngle, endAngle, r, g, b, a, thickness = 2) {
    const arcLen = Math.abs(endAngle - startAngle) * radius
    const steps = Math.max(Math.ceil(arcLen * 2), 8)
    for (let i = 0; i <= steps; i++) {
      const t = startAngle + (endAngle - startAngle) * (i / steps)
      const px = cx + Math.cos(t) * radius
      const py = cy + Math.sin(t) * radius
      const halfT = thickness / 2
      for (let dy = -Math.ceil(halfT) - 1; dy <= Math.ceil(halfT) + 1; dy++) {
        for (let dx = -Math.ceil(halfT) - 1; dx <= Math.ceil(halfT) + 1; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d > halfT + 1) continue
          const coverage = Math.max(0, Math.min(1, halfT + 0.5 - d))
          this.blend(px + dx, py + dy, r, g, b, a * coverage)
        }
      }
    }
  }

  /** 导出为 Uint8Array (RGBA) */
  toRGBA() {
    const out = new Uint8Array(this.size * this.size * 4)
    for (let i = 0; i < this.pixels.length; i++) {
      out[i] = Math.max(0, Math.min(255, Math.round(this.pixels[i])))
    }
    return out
  }
}

// ════════════════════════════════════════════════════════════
//  图标绘制函数  (纯填充风格, 适合小图标辨识)
// ════════════════════════════════════════════════════════════
const SIZE = 81
const PI = Math.PI

/**
 * Meet/约练 图标 — 双人轮廓
 * 寓意：一起运动、社交约练
 */
function drawMeet(r, g, b, alpha) {
  const c = new Canvas(SIZE)
  const a = 255 * alpha
  const s = SIZE / 48
  const cx = SIZE / 2

  // ── 右侧人 (前景，略大) ──
  const rx = cx + 5 * s
  c.fillCircle(rx, 13 * s, 6 * s, r, g, b, a) // 头
  // 半身弧形
  const rbY = 36 * s, rbRx = 11 * s, rbRy = 13 * s
  for (let dy = -Math.ceil(rbRy) - 2; dy <= 0; dy++) {
    for (let dx = -Math.ceil(rbRx) - 2; dx <= Math.ceil(rbRx) + 2; dx++) {
      const nd = Math.sqrt((dx * dx) / (rbRx * rbRx) + (dy * dy) / (rbRy * rbRy))
      if (nd > 1.5) continue
      const cov = Math.max(0, Math.min(1, 1.5 - nd))
      const py = rbY + dy
      if (py >= 22 * s && py <= 45 * s) c.blend(rx + dx, py, r, g, b, a * cov)
    }
  }

  // ── 左侧人 (背景，70% 不透明度造成层次感) ──
  const lx = cx - 8 * s
  const la = a * 0.65
  c.fillCircle(lx, 15 * s, 5.5 * s, r, g, b, la) // 头
  const lbY = 37 * s, lbRx = 10 * s, lbRy = 12 * s
  for (let dy = -Math.ceil(lbRy) - 2; dy <= 0; dy++) {
    for (let dx = -Math.ceil(lbRx) - 2; dx <= Math.ceil(lbRx) + 2; dx++) {
      const nd = Math.sqrt((dx * dx) / (lbRx * lbRx) + (dy * dy) / (lbRy * lbRy))
      if (nd > 1.5) continue
      const cov = Math.max(0, Math.min(1, 1.5 - nd))
      const py = lbY + dy
      if (py >= 23 * s && py <= 45 * s) c.blend(lx + dx, py, r, g, b, la * cov)
    }
  }

  return c.toRGBA()
}

/**
 * Discover/发现 图标 — 2×2 圆角方格
 * 寓意：多元探索、发现新内容
 */
function drawDiscover(r, g, b, alpha) {
  const c = new Canvas(SIZE)
  const a = 255 * alpha
  const s = SIZE / 48
  const rad = 3.5 * s
  const gap = 3.5 * s
  const boxW = 16 * s

  const l1 = 5 * s
  const l2 = l1 + boxW + gap
  const t1 = 5 * s
  const t2 = t1 + boxW + gap

  // 四个圆角方块
  c.fillRoundRect(l1, t1, l1 + boxW, t1 + boxW, rad, r, g, b, a)
  c.fillRoundRect(l2, t1, l2 + boxW, t1 + boxW, rad, r, g, b, a)
  c.fillRoundRect(l1, t2, l1 + boxW, t2 + boxW, rad, r, g, b, a)
  c.fillRoundRect(l2, t2, l2 + boxW, t2 + boxW, rad, r, g, b, a)

  return c.toRGBA()
}

/**
 * Me/我的 图标 — 用户头像轮廓
 * 寓意：个人中心
 */
function drawMe(r, g, b, alpha) {
  const c = new Canvas(SIZE)
  const a = 255 * alpha
  const s = SIZE / 48
  const cx = SIZE / 2

  // 头部
  c.fillCircle(cx, 14 * s, 8 * s, r, g, b, a)

  // 肩膀/身体 — 宽弧形半椭圆 (只画上半)
  const bodyY = 42 * s, bodyRx = 17 * s, bodyRy = 16 * s
  for (let dy = -Math.ceil(bodyRy) - 2; dy <= 0; dy++) {
    for (let dx = -Math.ceil(bodyRx) - 2; dx <= Math.ceil(bodyRx) + 2; dx++) {
      const nd = Math.sqrt((dx * dx) / (bodyRx * bodyRx) + (dy * dy) / (bodyRy * bodyRy))
      if (nd > 1.5) continue
      const cov = Math.max(0, Math.min(1, 1.5 - nd))
      const py = bodyY + dy
      if (py >= 25 * s && py <= 46 * s) c.blend(cx + dx, py, r, g, b, a * cov)
    }
  }

  return c.toRGBA()
}

/**
 * Notice/消息 图标 — 实心铃铛
 * 寓意：通知、消息提醒
 */
function drawNotice(r, g, b, alpha) {
  const c = new Canvas(SIZE)
  const a = 255 * alpha
  const s = SIZE / 48
  const cx = SIZE / 2

  // 铃体上半 — 圆弧 dome
  c.fillEllipse(cx, 18 * s, 13 * s, 13 * s, r, g, b, a)

  // 铃体下半 — 矩形
  c.fillRect(cx - 13 * s, 18 * s, cx + 13 * s, 32 * s, r, g, b, a)

  // 底部展开弧
  c.fillEllipse(cx, 32 * s, 16 * s, 4.5 * s, r, g, b, a)

  // 顶部小挂环
  c.fillCircle(cx, 5 * s, 2.8 * s, r, g, b, a)
  // 连接杆
  c.fillRect(cx - 1.2 * s, 5 * s, cx + 1.2 * s, 9 * s, r, g, b, a)

  // 底部铃锤
  c.fillCircle(cx, 39 * s, 3.5 * s, r, g, b, a)

  return c.toRGBA()
}

// ════════════════════════════════════════════════════════════
//  主流程 — 生成全部图标
// ════════════════════════════════════════════════════════════
const outDir = path.resolve(__dirname, '..', 'static', 'tabbar')
fs.mkdirSync(outDir, { recursive: true })

// 设计系统配色
const INACTIVE = { r: 255, g: 255, b: 255, a: 0.40 } // rgba(255,255,255,0.4)
const ACTIVE   = { r: 0,   g: 229, b: 255, a: 1.00 } // #00E5FF

const icons = [
  { name: 'list',   draw: drawMeet },
  { name: 'grid',   draw: drawDiscover },
  { name: 'me',     draw: drawMe },
  { name: 'notice', draw: drawNotice },
]

let count = 0
for (const { name, draw } of icons) {
  // 普通态
  const normalPx = draw(INACTIVE.r, INACTIVE.g, INACTIVE.b, INACTIVE.a)
  const normalPng = encodePNG(SIZE, SIZE, normalPx)
  fs.writeFileSync(path.join(outDir, `${name}.png`), normalPng)

  // 激活态
  const activePx = draw(ACTIVE.r, ACTIVE.g, ACTIVE.b, ACTIVE.a)
  const activePng = encodePNG(SIZE, SIZE, activePx)
  fs.writeFileSync(path.join(outDir, `${name}_active.png`), activePng)

  console.log(`  ✅ ${name}.png (${normalPng.length}B)  ${name}_active.png (${activePng.length}B)`)
  count += 2
}

console.log(`\n🎨 Generated ${count} tabbar icons (${SIZE}×${SIZE}px) → ${outDir}`)
