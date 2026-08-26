import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createProxyMiddleware } from 'http-proxy-middleware'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath, URL } from 'node:url'

// Express 默认运行在 3000 端口；Vite dev server 在 5173
// 生产时 Express 直接 serve dist/
export default defineConfig(async ({ mode }) => {
  const plugins = [
    vue(),
    // /assets/ 两头都要服务：SFC 模板里的 /assets/*.svg 会被 plugin-vue 改写成
    // 模块导入（?import），必须由 Vite 转换成 JS；其余（角色立绘等大文件）仍由
    // Express 提供。写进 proxy 表会把 ?import 请求也转给 Express，返回
    // image/svg+xml 触发模块 MIME 检查失败，dev 模式整条路由链路挂掉。
    {
      name: 'express-assets-conditional-proxy',
      configureServer(server) {
        server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
          const url = req.url ?? ''
          if (!url.startsWith('/assets/') || url.includes('import')) return next()
          return createProxyMiddleware({
            target: 'http://127.0.0.1:3000',
            changeOrigin: true
          })(req, res, next)
        })
      }
    } satisfies Plugin
  ]
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
      // desktop-tauri Rust 构建产物会被锁（EBUSY 导致 dev server 崩溃）；
      // runtime/ 由网关随时写入 pid/日志，同样会触发 EBUSY
      ignored: ['**/desktop-tauri/**', '**/native-live2d/target/**', '**/src-tauri/**', '**/runtime/**']
    },
    proxy: {
      '/api':         { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/sdapi':       { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/controlnet':  { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/adetailer':   { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/scene-showcase': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/data':        { target: 'http://127.0.0.1:3000', changeOrigin: true },
      // dev 模式下 tools/ 由 Express 提供，Vite 需转发
      // （/assets/ 见上方 express-assets-conditional-proxy 插件）
      '/tools':       { target: 'http://127.0.0.1:3000', changeOrigin: true }
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
          if (id.includes('node_modules/motion/') || id.includes('node_modules/framer-motion/')) {
            return 'motion'
          }
          if (id.includes('node_modules/@vueuse/')) {
            return 'motion'
          }
          // 提示词策略与热门内容单独成块：改一个词条不应让全量 vendor 缓存失效
          if (id.includes('src/utils/promptPolicy') ||
              id.includes('src/utils/promptCompiler') ||
              id.includes('src/utils/popularContent') ||
              id.includes('src/config/artistStyleCatalog') ||
              id.includes('src/config/artistStyles')) {
            return 'prompt'
          }
          if (id.includes('src/composables/live2d/') ||
              id.includes('src/utils/emotionRuntime') ||
              id.includes('src/utils/blinkScheduler')) {
            return 'live2d'
          }
          return undefined
        }
      }
    }
  }
  }
})
