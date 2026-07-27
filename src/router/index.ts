import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/components/AppLayout.vue'),
      children: [
        { path: '',                name: 'home',          component: () => import('@/views/HomeView.vue') },
        { path: 'scene-explorer', name: 'scene',         component: () => import('@/views/SceneExplorerView.vue') },
        { path: 'prompt-builder', name: 'director',      component: () => import('@/views/PromptBuilderView.vue') },
        { path: 'chat',           name: 'chat',          component: () => import('@/views/ChatView.vue') },
        { path: 'showcase',       name: 'showcase',      component: () => import('@/views/ShowcaseView.vue') },
        { path: 'gallery',        name: 'gallery',       component: () => import('@/views/GalleryView.vue') },
        { path: 'character',      name: 'character',     component: () => import('@/views/CharacterView.vue') },
        { path: 'style',          name: 'style',         component: () => import('@/views/StyleView.vue') },
        { path: 'lora',           name: 'lora',          component: () => import('@/views/LoraView.vue') },
        { path: 'scene-manager',  name: 'manager',       component: () => import('@/views/SceneManagerView.vue') },
        { path: 'color-script',   name: 'color-script',  component: () => import('@/views/ColorScriptView.vue') },
        { path: 'scenario',       name: 'scenario',      component: () => import('@/views/ScenarioView.vue') },
      ]
    },
    // control 有自己的完整导航栏，不套 AppLayout（避免双 nav）
    { path: '/control', name: 'control', component: () => import('@/views/ControlView.vue'), meta: { transition: 'fade' } }
  ]
})

export default router
