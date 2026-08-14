/**
 * 跨端桌面与系统环境自适应适配器
 * 统一处理 Electron / Tauri 2 / 现代 Web 浏览器的平台特征、原生能力与生命周期
 */

import { ref, computed } from 'vue'

export type DesktopRuntimeKind = 'electron' | 'tauri' | 'web'

export interface PlatformCapabilities {
  runtime: DesktopRuntimeKind
  isDesktop: boolean
  hasNativeFS: boolean
  hasNativeNotification: boolean
  hasNativeWindowControls: boolean
  hasNativeLive2dBridge: boolean
}

export function useDesktopPlatform() {
  const isElectron = Boolean(typeof window !== 'undefined' && (window as unknown as { companionDesktop?: unknown }).companionDesktop)
  const isTauri = Boolean(
    typeof window !== 'undefined' &&
    ((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ || (window as unknown as { __TAURI__?: unknown }).__TAURI__)
  )

  const runtimeKind = ref<DesktopRuntimeKind>(isElectron ? 'electron' : isTauri ? 'tauri' : 'web')

  const capabilities = computed<PlatformCapabilities>(() => ({
    runtime: runtimeKind.value,
    isDesktop: runtimeKind.value !== 'web',
    hasNativeFS: runtimeKind.value !== 'web',
    hasNativeNotification: Boolean(typeof window !== 'undefined' && ('Notification' in window || (window as unknown as { companionDesktop?: unknown }).companionDesktop)),
    hasNativeWindowControls: runtimeKind.value !== 'web',
    hasNativeLive2dBridge: Boolean(typeof window !== 'undefined' && (window as unknown as { aicsLive2dNative?: unknown }).aicsLive2dNative),
  }))

  /** 发送跨平台系统通知（支持桌面 Bridge 与浏览器原生 Notification API） */
  async function notify(title: string, body: string): Promise<boolean> {
    if (typeof window === 'undefined') return false

    if (window.companionDesktop) {
      try {
        window.companionDesktop.notify(title, body)
        return true
      } catch { /* fallback below */ }
    }

    if ('Notification' in window) {
      try {
        if (Notification.permission === 'granted') {
          new Notification(title, { body })
          return true
        } else if (Notification.permission !== 'denied') {
          const perm = await Notification.requestPermission()
          if (perm === 'granted') {
            new Notification(title, { body })
            return true
          }
        }
      } catch { /* ignore notification errors */ }
    }

    return false
  }

  return {
    runtimeKind,
    capabilities,
    notify,
  }
}
