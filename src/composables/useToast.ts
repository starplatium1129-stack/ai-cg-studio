import { ref, readonly } from 'vue'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

export interface ToastItem {
  id: number
  msg: string
  type: ToastType
  duration: number
}

const toasts = ref<ToastItem[]>([])
let nextId = 0

export function useToast() {
  function show(msg: string, type: ToastType = 'info', duration = 2800) {
    const id = ++nextId
    toasts.value.push({ id, msg, type, duration })
    setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id: number) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx >= 0) toasts.value.splice(idx, 1)
  }

  const success = (msg: string, d?: number) => show(msg, 'success', d)
  const error   = (msg: string, d?: number) => show(msg, 'error',   d ?? 4000)
  const warning = (msg: string, d?: number) => show(msg, 'warning', d)
  const info    = (msg: string, d?: number) => show(msg, 'info',    d)

  return { toasts: readonly(toasts), show, dismiss, success, error, warning, info }
}
