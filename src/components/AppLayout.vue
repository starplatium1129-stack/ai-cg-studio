<template>
  <div class="page-root">
    <a class="skip-link" href="#main">跳到主要内容</a>
    <AppNav />
    <RouteAtmosphere />
    <!-- 必须是真的 <main>：skip-link 指向这里，之前是 div，跳转链接落在一个普通容器上 -->
    <main id="main" class="page-main" tabindex="-1">
      <RouterView v-slot="{ Component, route }">
        <Transition :css="false" @enter="onEnter" @leave="onLeave">
          <div class="route-view" :key="route.path">
            <component :is="Component" />
          </div>
        </Transition>
      </RouterView>
    </main>
    <footer class="site-footer">
      <p>© 2025 绫季绘境 · 个人创作工作台</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { animateMini } from 'motion'
import AppNav from './AppNav.vue'
import RouteAtmosphere from './visual/RouteAtmosphere.vue'

// 路由进出走 spring：连续快速切页时上一个动画从当前值被打断重定向，
// 不会像固定时长 keyframes 那样"撞墙"。leave 只做快速淡出，把舞台让给新页。
let activeAnim: ReturnType<typeof animateMini> | null = null

function stopActive() {
  activeAnim?.stop()
  activeAnim = null
}

function onEnter(el: Element, done: () => void) {
  stopActive()
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    activeAnim = animateMini(el as HTMLElement, { opacity: [0, 1] }, { duration: 0.12 })
  } else {
    activeAnim = animateMini(
      el as HTMLElement,
      { opacity: [0, 1], transform: ['translateY(14px) scale(.992)', 'translateY(0) scale(1)'] },
      { type: 'spring', bounce: 0, duration: 0.42 },
    )
  }
  activeAnim.then(done)
}

function onLeave(el: Element, done: () => void) {
  stopActive()
  activeAnim = animateMini(el as HTMLElement, { opacity: 0, transform: 'translateY(-6px)' }, { duration: 0.16, ease: 'easeOut' })
  activeAnim.then(done)
}
</script>

<style scoped>
.page-root {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.page-main {
  position: relative;
  z-index: var(--z-raised);
  flex: 1;
  min-width: 0;
  display: grid;
}
.route-view {
  grid-area: 1 / 1;
  min-width: 0;
}
/* 用 skip-link 跳进来时要有可见落点，但鼠标点击不该出现描边 */
.page-main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.site-footer {
  position: relative;
  z-index: var(--z-raised);
  padding: var(--s-4) var(--s-6);
  text-align: center;
  font-size: var(--fs-body-sm);
  color: var(--text-muted);
  border-top: 1px solid var(--border-soft);
  background: color-mix(in srgb, var(--bg-deep) 55%, transparent);
}
</style>
