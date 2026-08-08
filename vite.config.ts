import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Express 默认运行在 3000 端口；Vite dev server 在 5173
// 生产时 Express 直接 serve dist/
export default defineConfig(async ({ mode }) => {
  const plugins = [vue()]
  if (mode === 'analyze') {
    const { visualizer } = await import('rollup-plugin-visualizer')
    plugins.push(visualizer({
      filename: 'dist/bundle-report.html',
      gzipSize: true,
      brotliSize: true,
      open: false,
    }))
  }

  return {
  plugins,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    watch: {
      // desktop-tauri Rust 构建产物会被锁（EBUSY 导致 dev server 崩溃）
      ignored: ['**/desktop-tauri/**', '**/native-live2d/target/**', '**/src-tauri/**']
    },
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
    manifest: true,
    // 避免与 Express 已有的 /assets/ 路由（角色图等）冲突
    assetsDir: '_app',
    // 固定构建目标，别随 Vite 默认值漂移；与 package.json 的 browserslist 对齐
    target: ['chrome111', 'edge111', 'firefox113', 'safari16.4'],
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // 框架单独成块：应用代码改动不该让 Vue/Router/Pinia 的缓存一起失效
          if (id.includes('node_modules/vue/') ||
              id.includes('node_modules/@vue/') ||
              id.includes('node_modules/vue-router/') ||
              id.includes('node_modules/pinia/')) {
            return 'vendor'
          }
          return undefined
        }
      }
    }
  }
  }
})
