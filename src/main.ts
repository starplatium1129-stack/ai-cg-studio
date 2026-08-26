import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { preferredTheme } from './composables/useTheme'
// 字体本地自托管（替代 Google Fonts）：离线可用、无第三方请求。
// 字重：JetBrains Mono 400/600，Noto Sans SC 400/600/700
//（500/800 使用率最低已砍掉，缺失字重由浏览器在 400/600/700 之间插值，节省 ~1.2MB woff2）。
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/600.css'
import '@fontsource/noto-sans-sc/700.css'
// 全局样式只留真正跨路由共用的三份。
// director.css(91.6KB)与 chat.css(18.6KB)已移到各自视图内 import ——
// 它们占了 139KB 全局包的 79%，却只服务 /prompt-builder 与 /chat。
// Vite 的 cssCodeSplit 会把它们切成路由块，随懒加载组件一起取。
import './assets/css/design-system.css'
import './assets/css/scene-card.css'
import './assets/css/viewer.css'
import './assets/css/mood.css'

// 初始主题：优先用户选择，其次跟随系统 prefers-color-scheme
document.documentElement.setAttribute('data-theme', preferredTheme())

createApp(App).use(createPinia()).use(router).mount('#app')
