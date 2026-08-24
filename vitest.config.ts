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
  },
})
