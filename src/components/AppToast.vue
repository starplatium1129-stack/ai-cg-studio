<template>
  <Teleport to="body">
    <!-- 只在容器上声明一次 live region。子项再挂 role="status" 会造成
         嵌套 live region，读屏可能重复播报或整条丢掉。 -->
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast-item"
          :class="`toast-${t.type}`"
        >
          <span class="toast-icon" aria-hidden="true">{{ icons[t.type] }}</span>
          <span class="toast-msg">{{ t.msg }}</span>
          <!-- 关闭动作挂在按钮本身，而不是外层 div：
               原先 div 才是 @click 的宿主，但它不可聚焦 -->
          <button
            class="toast-close"
            type="button"
            :aria-label="`关闭提示：${t.msg}`"
            @click="dismiss(t.id)"
          >×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

const icons: Record<string, string> = {
  info:    'ℹ',
  success: '✓',
  error:   '✕',
  warning: '⚠',
}
</script>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: var(--s-6);
  left: 50%;
  transform: translateX(-50%);
  /* 走 z 阶梯。9999 会盖住 --z-skip(500) 的跳转链接 */
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: var(--s-2);
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-3) var(--s-4);
  border-radius: var(--r-lg);
  border: 1px solid var(--border-soft);
  background: var(--bg-elevated);
  backdrop-filter: blur(16px);
  /* 走 token:硬编码 rgba 在浅色主题下是脏灰,而 --glass-shadow 已按主题调过 */
  box-shadow: var(--glass-shadow), 0 1px 0 var(--glass-highlight) inset;
  font-size: var(--fs-body-sm);
  font-weight: 600;
  color: var(--text-primary);
  pointer-events: auto;
  cursor: pointer;
  max-width: min(460px, 90vw);
  white-space: pre-wrap;
  word-break: break-word;
  transition: transform var(--t-fast), opacity var(--t-fast);
}
.toast-item:hover { opacity: .88; }

.toast-icon { font-size: 1em; flex-shrink: 0; }
.toast-msg  { flex: 1; }
.toast-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0 0 0 var(--s-1); font-size: 1.1em; line-height: 1; }

/* 图标是这四种提示唯一的颜色信号,按设计系统契约必须走 --*-text
   (原 token 是给色块/描边调的,浅色主题下当图标只有 1.9–2.6:1) */
.toast-success { border-color: color-mix(in srgb, var(--success) 40%, var(--border-soft)); }
.toast-success .toast-icon { color: var(--success-text); }
.toast-error   { border-color: color-mix(in srgb, var(--danger)  40%, var(--border-soft)); }
.toast-error   .toast-icon { color: var(--danger-text); }
.toast-warning { border-color: color-mix(in srgb, var(--warning) 40%, var(--border-soft)); }
.toast-warning .toast-icon { color: var(--warning-text); }
.toast-info    .toast-icon { color: var(--accent); }

/* TransitionGroup */
.toast-enter-active { transition: opacity var(--t-base) var(--ease-out), transform var(--t-base) var(--ease-out); }
.toast-leave-active { transition: opacity var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out); }
.toast-enter-from   { opacity: 0; transform: translateY(16px) scale(.97); }
.toast-leave-to     { opacity: 0; transform: translateY(-8px) scale(.96); }
.toast-move         { transition: transform var(--t-base) var(--ease-out); }
</style>
