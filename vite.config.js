import fs from 'fs'
import path from 'path'
import uni from '@dcloudio/vite-plugin-uni'

/**
 * 简易读取 .env 文件（替代 vite 的 loadEnv，避免从 'vite' 导入导致 HBuilderX ESM 冲突）
 */
function loadEnvFiles(mode, dir) {
  const env = {}
  const files = ['.env', `.env.${mode}`, '.env.local', `.env.${mode}.local`]
  for (const file of files) {
    const filePath = path.resolve(dir, file)
    if (!fs.existsSync(filePath)) continue
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx <= 0) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      env[key] = val
    }
  }
  return env
}

export default ({ mode }) => {
  const env = loadEnvFiles(mode, process.cwd())
  const isProduction = mode === 'production'

  return {
    plugins: [uni()],

    define: {
      // vue-i18n feature flags - 消除 esm-bundler tree-shaking 警告
      __VUE_I18N_FULL_INSTALL__: true,
      __VUE_I18N_LEGACY_API__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
      // 环境变量注入（manifest.json 不支持 import.meta.env，通过 define 注入全局常量）
      __AMAP_KEY_IOS__: JSON.stringify(env.VITE_AMAP_KEY_IOS || ''),
      __AMAP_KEY_ANDROID__: JSON.stringify(env.VITE_AMAP_KEY_ANDROID || ''),
      __TENCENT_MAP_KEY__: JSON.stringify(env.VITE_TENCENT_MAP_KEY || ''),
      __WX_APPID__: JSON.stringify(env.VITE_WX_APPID || ''),
      __DEBUG__: env.VITE_DEBUG === 'true',
    },

    // ── 生产环境 console/debugger 剥离 ──────────────────────────
    esbuild: isProduction
      ? { drop: ['console', 'debugger'], legalComments: 'none' }
      : undefined,

    // ── 构建优化 ───────────────────────────────────────────────
    build: {
      // 生产环境不生成 sourcemap（减小体积 + 安全）
      sourcemap: !isProduction,
      // 分包阈值：>500KB 警告
      chunkSizeWarningLimit: 500,
      // CSS 代码拆分（按页面按需加载）
      cssCodeSplit: true,
      // 压缩选项
      minify: isProduction ? 'esbuild' : false,
      rollupOptions: {
        output: {
          // ── 手动分包策略（Vendor Splitting）───────────────────
          manualChunks(id) {
            // vue 核心
            if (id.includes('node_modules/@vue') || id.includes('node_modules/vue')) {
              return 'vendor-vue'
            }
            // pinia 状态管理
            if (id.includes('node_modules/pinia')) {
              return 'vendor-pinia'
            }
            // vue-i18n 国际化
            if (id.includes('node_modules/vue-i18n') || id.includes('node_modules/@intlify')) {
              return 'vendor-i18n'
            }
            // 其他第三方依赖
            if (id.includes('node_modules')) {
              return 'vendor-libs'
            }
          },
        },
      },
    },

    // ── 开发服务器优化 ─────────────────────────────────────────
    server: {
      // 预构建依赖（加速冷启动）
      warmup: {
        clientFiles: ['./pages/**/*.vue', './components/**/*.vue'],
      },
    },
  }
}
