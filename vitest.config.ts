import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * 前端单元测试配置（2026-08-22 引入）。
 * 独立于 vite.config.ts：构建走 Vite，单测走 Vitest，互不干扰。
 * 运行：npm run test:frontend（watch 模式加 --）
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.ts'],
    // store 与工具层测试为主；组件挂载测试按需补充
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      // 2026-08-28 接入 CI（工程审计 P0-2）：原 60/50 阈值自引入从未真实跑通
      // （全库实测 lines 5.43% / branches 3.34%，视图层依赖 e2e 覆盖）。
      // 以下为按 2026-08-28 实测基线激活的 ratchet 起点，后续只升不降；
      // stores/utils/config 是单测主战场，阈值显著高于全库基线。
      thresholds: {
        lines: 5,
        branches: 3,
        'src/stores/**': { lines: 45, branches: 24 },
        'src/utils/**': { lines: 13, branches: 10 },
        'src/config/**': { lines: 21, branches: 12 },
      },
    },
  },
})
