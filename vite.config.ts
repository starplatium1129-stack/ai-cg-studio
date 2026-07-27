import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Express 默认运行在 3000 端口；Vite dev server 在 5173
// 生产时 Express 直接 serve dist/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api':         { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/sdapi':       { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/controlnet':  { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/adetailer':   { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/scene-showcase': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/data':        { target: 'http://127.0.0.1:3000', changeOrigin: true },
      // dev 模式下 tools/ 和 assets/ 由 Express 提供，Vite 需转发
      '/tools':       { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/assets':      { target: 'http://127.0.0.1:3000', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 避免与 Express 已有的 /assets/ 路由（角色图等）冲突
    assetsDir: '_app'
  }
})
