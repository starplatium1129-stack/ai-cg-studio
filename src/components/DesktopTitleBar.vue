<template>
  <header v-if="visible" class="desktop-titlebar" aria-label="窗口标题栏">
    <div class="titlebar-brand">
      <span class="titlebar-dot" aria-hidden="true"></span>
      <span class="titlebar-name">绫季绘境 Atelier</span>
      <span v-if="pageTitle" class="titlebar-page">{{ pageTitle }}</span>
    </div>
    <div class="titlebar-controls">
      <button class="tb-btn" type="button" aria-label="最小化" title="最小化" @click="bridge?.minimizeWindow()">
        <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true"><rect x="1" y="5.4" width="10" height="1.3" rx="0.65" fill="currentColor" /></svg>
      </button>
      <button class="tb-btn" type="button" :aria-label="maximized ? '还原' : '最大化'" :title="maximized ? '还原' : '最大化'" @click="bridge?.toggleMaximizeWindow()">
        <svg v-if="!maximized" viewBox="0 0 12 12" width="14" height="14" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3" /></svg>
        <svg v-else viewBox="0 0 12 12" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5v-2h7v7h-2M1.5 4.5v6h6v-6z" fill="none" stroke="currentColor" stroke-width="1.3" /></svg>
      </button>
      <button class="tb-btn tb-close" type="button" aria-label="关闭" title="关闭" @click="bridge?.closeWindow()">
        <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
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
  --desktop-titlebar-bg-top: #181130;
  --desktop-titlebar-bg-bottom: #0e0b1d;
  --desktop-titlebar-dot-start: #b48cf2;
  --desktop-titlebar-dot-end: #f2c98c;
  --desktop-titlebar-text: #b3aad0;
  --desktop-titlebar-name: #ddd6f0;
  --desktop-titlebar-page: #857baa;
  --desktop-titlebar-hover: #f4f1fb;
  --desktop-titlebar-hover-bg: rgba(255, 255, 255, 0.08);
  --desktop-titlebar-press-bg: rgba(255, 255, 255, 0.13);
  --desktop-titlebar-close: #e81123;
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 0 0 14px;
  background:
    radial-gradient(26rem 6rem at 10% -140%, rgba(180, 140, 242, 0.2), transparent 62%),
    linear-gradient(180deg, var(--desktop-titlebar-bg-top), var(--desktop-titlebar-bg-bottom));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  -webkit-app-region: drag;
  user-select: none;
  color: var(--desktop-titlebar-text);
  font-size: 12.5px;
  letter-spacing: 0.02em;
}
/* 底部渐变发丝线：与整站「克制光效」一致，取代平直白边 */
.desktop-titlebar::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 2%, rgba(168, 138, 236, 0.34) 18%, rgba(168, 138, 236, 0.12) 55%, transparent 98%);
  pointer-events: none;
}
.titlebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.titlebar-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--desktop-titlebar-dot-start), var(--desktop-titlebar-dot-end));
  box-shadow: 0 0 10px rgba(180, 140, 242, 0.55), 0 0 2px rgba(255, 255, 255, 0.35);
}
.titlebar-name {
  color: var(--desktop-titlebar-name);
  font-weight: 600;
  letter-spacing: 0.03em;
}
.titlebar-page {
  padding-left: 10px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--desktop-titlebar-page);
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
  color: var(--desktop-titlebar-text);
  cursor: default;
  transition: background 0.14s ease, color 0.14s ease;
}
.tb-btn:hover {
  background: var(--desktop-titlebar-hover-bg);
  color: var(--desktop-titlebar-hover);
}
.tb-btn:active {
  background: var(--desktop-titlebar-press-bg);
}
.tb-btn:focus-visible {
  outline: 2px solid rgba(214, 196, 250, 0.55);
  outline-offset: -2px;
}
.tb-close:hover {
  background: linear-gradient(180deg, #ee2a3c, var(--desktop-titlebar-close));
  color: #fff;
}
.tb-close:active {
  background: linear-gradient(180deg, var(--desktop-titlebar-close), #a80d1b);
}
@media (max-width: 640px) {
  .titlebar-page { display: none; }
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
/* 桌面壳下 skip-link 的包含块在标题栏下方，translateY(-140%) 只上移 59px，
   底部仍会露出标题栏上方（实测 0-33px 可见）。隐藏态改 clip-path 完全裁剪
   （保持可聚焦，visibility:hidden 会移出 Tab 序）；聚焦态显示在标题栏正下方。 */
html.aics-desktop-shell .skip-link {
  top: calc(var(--s-3) + 38px);
  clip-path: inset(0 0 100% 0);
  transform: none;
}
html.aics-desktop-shell .skip-link:focus,
html.aics-desktop-shell .skip-link:focus-visible {
  clip-path: none;
  transform: none;
}
</style>
