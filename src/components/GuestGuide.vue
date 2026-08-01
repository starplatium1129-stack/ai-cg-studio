<template>
  <aside v-if="visible" class="guest-guide" role="region" aria-label="访客导览">
    <div class="guest-guide-card">
      <div class="guest-guide-body">
        <span class="guest-guide-kicker">FIRST VISIT · 一次导览</span>
        <h2>欢迎来到 绫姬绘境</h2>
        <p>
          这里是你朋友的本地创作间：浏览场景图鉴、带着场景去导演台出图、或去角色房间
          和 <strong>宁宁 / 夏目</strong> 聊天。
        </p>
        <ul>
          <li><strong>角色是谁</strong>：宁宁是银发紫瞳的魔女系女孩，夏目是琥珀色眼睛的可靠同伴。</li>
          <li><strong>能做什么</strong>：查看场景样张、直接生成图片；生成在你朋友的电脑上完成。</li>
          <li><strong>聊天配音</strong>：角色房间右上角打开「记忆归档」旁的新对话即可开聊；
            语音默认跟随回复自动播放，也可在房间内单独开关。</li>
        </ul>
      </div>
      <button class="btn btn-primary" type="button" @click="dismiss">知道了，开始浏览</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const DISMISS_KEY = 'aics_guest_guide_dismissed'

const isNonLocal = !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
const forcedGuest = new URLSearchParams(window.location.search).get('guest') === '1'
let dismissed = false
try {
  dismissed = localStorage.getItem(DISMISS_KEY) === '1'
} catch { /* 隐私模式忽略 */ }

const visible = ref((isNonLocal || forcedGuest) && !dismissed)

function dismiss() {
  visible.value = false
  try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* 隐私模式忽略 */ }
}
</script>

<style scoped>
.guest-guide {
  position: fixed;
  z-index: var(--z-overlay);
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--s-5);
  background: color-mix(in srgb, var(--bg-deep) 72%, transparent);
  backdrop-filter: blur(10px);
}
.guest-guide-card {
  width: min(520px, 100%);
  display: grid;
  gap: var(--s-4);
  padding: var(--s-6);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-xl);
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
}
.guest-guide-kicker {
  color: var(--accent);
  font: 700 var(--fs-mono-xs) var(--font-mono);
  letter-spacing: .14em;
}
.guest-guide-body h2 { margin: var(--s-1) 0 var(--s-2); }
.guest-guide-body p { margin: 0 0 var(--s-3); color: var(--text-secondary); line-height: 1.7; }
.guest-guide-body ul { margin: 0; padding-left: var(--s-4); display: grid; gap: var(--s-2); color: var(--text-secondary); }
.guest-guide-body strong { color: var(--text-primary); }
@media (prefers-reduced-motion: reduce) {
  .guest-guide { backdrop-filter: none; }
}
@media (max-width: 600px) {
  .guest-guide-card { padding: var(--s-4); }
}
</style>
