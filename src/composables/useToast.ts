import { ref, readonly } from 'vue'
import { playInterfaceTone, type InterfaceTone } from '@/composables/useInterfaceFeedback'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

/** 可选内联动作（如删除后的「撤销」）。点击即关 toast 并执行回调。 */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: number
  msg: string
  type: ToastType
  duration: number
  remaining: number
  startedAt: number
  timer?: ReturnType<typeof setTimeout>
  action?: ToastAction
}

const toasts = ref<ToastItem[]>([])
let nextId = 0
let listenersInstalled = false

function pauseToast(t: ToastItem) {
  if (t.timer) {
    clearTimeout(t.timer)
    t.timer = undefined
    const elapsed = Date.now() - t.startedAt
    t.remaining = Math.max(200, t.remaining - elapsed)
  }
}

function resumeToast(t: ToastItem) {
  if (!t.timer && t.remaining > 0) {
    t.startedAt = Date.now()
    t.timer = setTimeout(() => dismiss(t.id), t.remaining)
  }
}

export function pauseAllToasts() {
  toasts.value.forEach(pauseToast)
}

export function resumeAllToasts() {
  toasts.value.forEach(resumeToast)
}

function ensureListeners() {
  if (listenersInstalled || typeof document === 'undefined') return
  listenersInstalled = true
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAllToasts()
    else resumeAllToasts()
  })
}

function dismiss(id: number) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx >= 0) {
    const item = toasts.value[idx]
    if (item.timer) clearTimeout(item.timer)
    toasts.value.splice(idx, 1)
  }
}

export function useToast() {
  ensureListeners()

  function show(msg: string, type: ToastType = 'info', duration = 2800, action?: ToastAction) {
    const id = ++nextId
    const item: ToastItem = {
      id,
      msg,
      type,
      duration,
      remaining: duration,
      startedAt: Date.now(),
      action,
    }
    item.timer = setTimeout(() => dismiss(id), duration)
    toasts.value.push(item)

    const tones: Record<ToastType, InterfaceTone> = {
      info: 'tap', success: 'success', error: 'warning', warning: 'warning',
    }
    playInterfaceTone(tones[type])
  }

  const success = (msg: string, d?: number) => show(msg, 'success', d)
  const error   = (msg: string, d?: number) => show(msg, 'error',   d ?? 4000)
  const warning = (msg: string, d?: number) => show(msg, 'warning', d)
  const info    = (msg: string, d?: number) => show(msg, 'info',    d)

  return {
    toasts: readonly(toasts),
    show,
    dismiss,
    pauseAll: pauseAllToasts,
    resumeAll: resumeAllToasts,
    success,
    error,
    warning,
    info,
  }
}
