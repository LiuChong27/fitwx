/**
 * ESLint 配置 - FIT 项目
 * 基于 eslint-plugin-vue / Vue 3 规则集
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  globals: {
    // uni-app 全局变量
    uni: 'readonly',
    uniCloud: 'readonly',
    plus: 'readonly',
    wx: 'readonly',
    getCurrentPages: 'readonly',
    getApp: 'readonly',
    // vite define 注入的常量
    __VUE_I18N_FULL_INSTALL__: 'readonly',
    __VUE_I18N_LEGACY_API__: 'readonly',
    __INTLIFY_PROD_DEVTOOLS__: 'readonly',
    __AMAP_KEY_IOS__: 'readonly',
    __AMAP_KEY_ANDROID__: 'readonly',
    __TENCENT_MAP_KEY__: 'readonly',
    __WX_APPID__: 'readonly',
    __DEBUG__: 'readonly',
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'prettier', // prettier 放最后，覆盖格式相关规则
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // ── Vue 规则 ────────────────────────────────────
    'vue/multi-word-component-names': 'off', // uni-app 页面组件命名不强制多单词
    'vue/no-v-html': 'off', // 允许 v-html（部分富文本场景需要）
    'vue/require-default-prop': 'warn',
    'vue/require-prop-types': 'warn',
    'vue/no-unused-vars': 'warn',
    'vue/no-mutating-props': 'error',

    // ── JS 规则 ─────────────────────────────────────
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'no-var': 'error',
    'prefer-const': ['warn', { destructuring: 'all' }],
    'eqeqeq': ['warn', 'smart'],
    'no-duplicate-imports': 'error',
  },
  // uni_modules 和第三方不检查
  ignorePatterns: [
    'uni_modules/',
    'unpackage/',
    'node_modules/',
    'dist/',
    '*.min.js',
  ],
}
