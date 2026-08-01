<template>
  <div class="page-root">
    <a class="skip-link" href="#main">跳到主要内容</a>
    <AppNav />
    <RouteAtmosphere />
    <GuestGuide />
    <!-- 必须是真的 <main>：skip-link 指向这里，之前是 div，跳转链接落在一个普通容器上 -->
    <main id="main" class="page-main" tabindex="-1">
      <RouterView v-slot="{ Component, route }">
        <Transition :css="false" @enter="onEnter" @leave="onLeave">
          <!-- 作品册缓存：数百张大图的 blob URL 与解码结果常驻内存，
               切到其他页再回来不重新从 IndexedDB 读图，秒开。
               其余页面按需重建（各自 onMounted 拉最新数据）。 -->
          <KeepAlive :include="['GalleryView']">
            <div class="route-view" :key="route.path">
              <component :is="Component" />
            </div>
          </KeepAlive>
        </Transition>
      </RouterView>
    </main>
    <footer class="site-footer">
      <p>© 2025 绫季绘境 · 个人创作工作台</p>
    </footer>
    <!-- 日系竖排假名水印：纯装饰层（aria-hidden），样式与主题适配在 design-system.css -->
    <div class="kana-watermark" aria-hidden="true">
      <span class="kana-main">あとりえ</span>
      <span class="kana-sub">ATELIER ARCHIVE</span>
    </div>
    <!-- 博客式星光层：纯装饰（aria-hidden），样式在 design-system.css -->
    <div class="starfield" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
import { animateMini } from 'motion'
import AppNav from './AppNav.vue'
import RouteAtmosphere from './visual/RouteAtmosphere.vue'
import GuestGuide from './GuestGuide.vue'

// 路由进出走 spring：连续快速切页时上一个动画从当前值被打断重定向，
// 不会像固定时长 keyframes 那样"撞墙"。leave 只做快速淡出，把舞台让给新页。
// 注意：动画被 stop 后 .then(done) 不会触发，必须在这里强制调用 done，
// 否则 Vue 永远等不到旧节点移除，页面会叠在一起。
let activeAnim: { controls: ReturnType<typeof animateMini>; done: () => void } | null = null

// done 可能在"动画自然完成"和"stop 强制完成"两条路径被触发，只执行一次
function onceDone(done: () => void) {
  let called = false
  return () => {
    if (called) return
    called = true
    done()
  }
}

function stopActive() {
  if (activeAnim) {
    activeAnim.controls.stop()
    activeAnim.done()
    activeAnim = null
  }
}

function onEnter(el: Element, done: () => void) {
  stopActive()
  const doneOnce = onceDone(done)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const controls = reduced
    ? animateMini(el as HTMLElement, { opacity: [0, 1] }, { duration: 0.12 })
    : animateMini(
        el as HTMLElement,
        { opacity: [0, 1], transform: ['translateY(10px) scale(.994)', 'translateY(0) scale(1)'] },
        { type: 'spring', bounce: 0, duration: 0.32 },
      )
  activeAnim = { controls, done: doneOnce }
  controls.then(doneOnce)
}

function onLeave(el: Element, done: () => void) {
  stopActive()
  const doneOnce = onceDone(done)
  const controls = animateMini(el as HTMLElement, { opacity: 0, transform: 'translateY(-4px)' }, { duration: 0.12, ease: 'easeOut' })
  activeAnim = { controls, done: doneOnce }
  controls.then(doneOnce)
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
/* 朱印印章：页脚签名（色值由 --danger 派生，无硬编码） */
.site-footer::after {
  content: "綾季";
  display: inline-grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  margin-left: var(--s-3);
  border: 2px solid color-mix(in srgb, var(--danger) 42%, transparent);
  border-radius: var(--r-sm);
  color: color-mix(in srgb, var(--danger) 55%, transparent);
  font: 700 var(--fs-body-sm) var(--font-serif);
  letter-spacing: 0.06em;
  transform: rotate(-8deg);
  vertical-align: middle;
}
</style>
