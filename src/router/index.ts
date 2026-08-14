import { createRouter, createWebHistory } from 'vue-router'

/**
 * Live2D（PixiJS）编译着色器要用 new Function，需要 CSP 的 'unsafe-eval'。
 * 服务端只给 Live2D 页面文档放行（server/security.js），可是 SPA 只在首次
 * 请求时拿一次 CSP：从首页点进 Live2D 路由属于前端跳转，不发新文档请求，
 * 沿用的还是首页那份不含 unsafe-eval 的策略，于是 Live2D 必然初始化失败。
 * 这也解释了"直接打开 Live2D 页面正常、从站内点进去就挂"。
 *
 * 处理办法是进出 Live2D 页面时强制整页跳转，让浏览器重新取对应 CSP。
 * 代价是两次刷新，换来的是其余路由继续维持不含 unsafe-eval 的严格策略。
 */
const LIVE2D_PATHS = new Set(['/chat', '/companion'])
const STRICT_FLAG = 'aics_csp_strict'

function evalAllowed(): boolean {
  try { new Function('return 1')(); return true } catch { return false }
}

/** 记住"本服务端确实在按路由收紧 CSP"，跨整页跳转后仍然有效 */
function markStrictCsp() {
  try { sessionStorage.setItem(STRICT_FLAG, '1') } catch { /* 隐私模式忽略 */ }
}
function isStrictCsp(): boolean {
  try { return sessionStorage.getItem(STRICT_FLAG) === '1' } catch { return false }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/components/AppLayout.vue'),
      children: [
        { path: '',                name: 'home',          component: () => import('@/views/HomeView.vue') },
        { path: 'scene-explorer', name: 'scene',         component: () => import('@/views/SceneExplorerView.vue') },
        { path: 'popular-scenes', name: 'popular-scenes', component: () => import('@/views/PopularSceneExplorerView.vue') },
        { path: 'prompt-builder', name: 'director',      component: () => import('@/views/PromptBuilderView.vue') },
        { path: 'video-studio',  name: 'video',         component: () => import('@/views/VideoStudioView.vue') },
        { path: 'chat',           name: 'chat',          component: () => import('@/views/ChatView.vue') },
        { path: 'showcase',       name: 'showcase',      component: () => import('@/views/ShowcaseView.vue') },
        { path: 'gallery',        name: 'gallery',       component: () => import('@/views/GalleryView.vue') },
        { path: 'character',      name: 'character',     component: () => import('@/views/CharacterView.vue') },
        { path: 'style',          name: 'style',         component: () => import('@/views/StyleView.vue') },
        { path: 'lora',           name: 'lora',          component: () => import('@/views/LoraView.vue') },
        { path: 'training',       name: 'training',      component: () => import('@/views/TrainingView.vue') },
        { path: 'scene-manager',  name: 'manager',       component: () => import('@/views/SceneManagerView.vue') },
        { path: 'color-script',   name: 'color-script',  component: () => import('@/views/ColorScriptView.vue') },
        { path: 'scenario',       name: 'scenario',      component: () => import('@/views/ScenarioView.vue') },
        // 兜底路由：没有它，任何拼错的地址都只渲染一个空白外壳
        { path: ':pathMatch(.*)*', name: 'not-found',    component: () => import('@/views/NotFoundView.vue') },
      ]
    },
    // 桌宠与控制面板都有独立完整布局，不套 AppLayout。
    { path: '/companion', name: 'companion', component: () => import('@/views/CompanionView.vue') },
    { path: '/control', name: 'control', component: () => import('@/views/ControlView.vue') }
  ],
  // 路由切换回到顶部；带 hash 时定位到锚点，浏览器前进/后退时还原原位置
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  }
})

/** Warm a lazy route without changing location. Used on internal-link intent. */
export function prefetchRoute(path: string): void {
  if (LIVE2D_PATHS.has(path)) return
  const route = router.resolve(path)
  for (const record of route.matched) {
    const component = record.components?.default
    if (typeof component === 'function') {
      void (component as () => Promise<unknown>)().catch(() => {})
    }
  }
}

router.beforeEach((to, from) => {
  // 首帧就地判定：当前文档若禁 eval，说明服务端在按路由收紧 CSP
  if (!evalAllowed()) markStrictCsp()

  // 服务端没收紧（dev server、或已是宽松文档）时不必刷新
  if (!isStrictCsp()) return true
  // 初次进入（无 from）由浏览器自己请求文档，CSP 已经对路径生效
  if (!from.matched.length) return true

  const toLive2D = LIVE2D_PATHS.has(to.path)
  const fromLive2D = LIVE2D_PATHS.has(from.path)
  if (toLive2D === fromLive2D) return true

  // 进 Live2D 页面换到带 unsafe-eval 的文档；离开时换回严格文档，
  // 顺带彻底释放 WebGL 上下文与 Pixi ticker
  window.location.assign(to.fullPath)
  return false
})

export default router
