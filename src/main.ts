import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/css/design-system.css'
import './assets/css/scene-card.css'
import './assets/css/viewer.css'
import './assets/css/mood.css'
import './assets/css/director.css'
import './assets/css/chat.css'

// 初始主题：从 localStorage 读取，默认 dark
const stored = (() => {
  try { return localStorage.getItem('aics_theme') } catch { return null }
})()
document.documentElement.setAttribute('data-theme', stored === 'light' ? 'light' : 'dark')

createApp(App).use(createPinia()).use(router).mount('#app')
