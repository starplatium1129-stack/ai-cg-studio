<template>
  <header v-if="visible" class="desktop-titlebar" aria-label="窗口标题栏">
    <div class="titlebar-brand">
      <span class="titlebar-dot" aria-hidden="true"></span>
      <span class="titlebar-name">绫季绘境 Atelier</span>
      <span v-if="pageTitle" class="titlebar-page">{{ pageTitle }}</span>
    </div>
    <div class="titlebar-controls">
      <button class="tb-btn" type="button" aria-label="最小化" title="最小化" @click="bridge?.minimizeWindow()">
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="1" y="5.5" width="10" height="1.2" rx="0.6" fill="currentColor" /></svg>
      </button>
      <button class="tb-btn" type="button" :aria-label="maximized ? '还原' : '最大化'" :title="maximized ? '还原' : '最大化'" @click="bridge?.toggleMaximizeWindow()">
        <svg v-if="!maximized" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
        <svg v-else viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3.5 3.5v-2h7v7h-2M1.5 4.5v6h6v-6z" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
      </button>
      <button class="tb-btn tb-close" type="button" aria-label="关闭" title="关闭" @click="bridge?.closeWindow()">
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const bridge = window.companionDesktop
const route = useRoute()
const maximized = ref(false)
const pageTitle = computed(() => {
  const metaTitle = route.meta?.title
  if (typeof metaTitle === 'string' && metaTitle.trim()) return metaTitle.trim()
  return ''
})
const visible = computed(() => Boolean(bridge) && route.path !== '/companion')
let maximizedSub = 0

onMounted(async () => {
  if (!bridge || route.path === '/companion') return
  document.documentElement.classList.add('aics-desktop-shell')
  try {
    const state = await bridge.getWindowState()
    maximized.value = state.maximized
  } catch { /* 窗口状态查询失败时保持默认 */ }
  maximizedSub = bridge.onMaximizedChanged(value => { maximized.value = value })
})
onUnmounted(() => {
  if (bridge && maximizedSub) bridge.offMaximizedChanged(maximizedSub)
  document.documentElement.classList.remove('aics-desktop-shell')
})
</script>

<style scoped>
.desktop-titlebar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 0 0 14px;
  background: #110b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  -webkit-app-region: drag;
  user-select: none;
  color: #9b93b8;
  font-size: 12.5px;
  letter-spacing: 0.02em;
}
.titlebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.titlebar-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--nene-violet, #b48cf2), var(--natsume-amber, #f2c98c));
  box-shadow: 0 0 8px rgba(180, 140, 242, 0.6);
  flex: none;
}
.titlebar-name {
  color: #c9c2de;
  font-weight: 600;
}
.titlebar-page {
  color: #6f6790;
  overflow: hidden;
  text-overflow: ellipsis;
}
.titlebar-controls {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}
.tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: 0;
  margin: 0;
  padding: 0;
  background: transparent;
  color: #9b93b8;
  cursor: default;
  transition: background 0.15s ease, color 0.15s ease;
}
.tb-btn:hover {
  background: rgba(255, 255, 255, 0.09);
  color: #e8e4f4;
}
.tb-close:hover {
  background: #e81123;
  color: #fff;
}
</style>

<style>
html.aics-desktop-shell {
  height: 100%;
}
html.aics-desktop-shell body {
  height: 100%;
  overflow-y: auto;
}
html.aics-desktop-shell #app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
html.aics-desktop-shell #app > .route-stage {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
