<template>
  <Teleport to="body">
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast-item"
          :class="`toast-${t.type}`"
          role="status"
          @click="dismiss(t.id)"
        >
          <span class="toast-icon">{{ icons[t.type] }}</span>
          <span class="toast-msg">{{ t.msg }}</span>
          <button class="toast-close" type="button" :aria-label="`关闭提示：${t.msg}`">×</button>
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
  z-index: 9999;
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
  box-shadow: 0 8px 32px rgba(0,0,0,.28), 0 1px 0 rgba(255,255,255,.06) inset;
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

.toast-success { border-color: color-mix(in srgb, var(--success) 40%, var(--border-soft)); }
.toast-success .toast-icon { color: var(--success); }
.toast-error   { border-color: color-mix(in srgb, var(--danger)  40%, var(--border-soft)); }
.toast-error   .toast-icon { color: var(--danger); }
.toast-warning { border-color: color-mix(in srgb, var(--warning) 40%, var(--border-soft)); }
.toast-warning .toast-icon { color: var(--warning); }
.toast-info    .toast-icon { color: var(--accent); }

/* TransitionGroup */
.toast-enter-active { transition: all .25s var(--ease-out); }
.toast-leave-active { transition: all .2s ease-in; }
.toast-enter-from   { opacity: 0; transform: translateY(16px) scale(.94); }
.toast-leave-to     { opacity: 0; transform: translateY(-8px) scale(.96); }
.toast-move         { transition: transform .25s var(--ease-out); }
</style>
