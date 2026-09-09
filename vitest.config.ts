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
      // 2026-09-09 办公机实测后提高门槛，后续只升不降；
      // stores/utils/config 与任务中心分别约束，不能用全库平均值掩盖关键模块回退。
      thresholds: {
        lines: 17,
        branches: 11,
        'src/stores/**': { lines: 60, branches: 40 },
        'src/utils/**': { lines: 29, branches: 22 },
        'src/config/**': { lines: 39, branches: 17 },
        'src/composables/useTaskCenter.ts': { lines: 90, branches: 70 },
      },
    },
  },
})
