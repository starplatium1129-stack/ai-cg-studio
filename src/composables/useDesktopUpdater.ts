import { onUnmounted, ref } from 'vue'

/**
 * 桌面端自动更新横幅（审计 P1：Tauri updater）。
 * 仅在 Tauri 壳内生效（window.__TAURI__，withGlobalTauri 注入核心 invoke/event API）。
 * 启动检查在 Rust 侧后台完成并广播 `desktop-update-found`；安装经
 * `desktop_update_install` 命令下载安装并由安装器重启应用。
 */

interface TauriCore {
  event: {
    listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>
  }
  core: {
    invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
  }
}

function tauriApi(): TauriCore | null {
  return (window as unknown as { __TAURI__?: TauriCore }).__TAURI__ ?? null
}

export function useDesktopUpdater() {
  const availableVersion = ref('')
  const statusText = ref('')
  const installing = ref(false)
  const errorText = ref('')
  const offs: Array<() => void> = []

  const api = tauriApi()
  if (api) {
    api.event.listen('desktop-update-found', (event) => {
      if (typeof event.payload === 'string' && !installing.value) availableVersion.value = event.payload
    }).then((off) => offs.push(off))
    api.event.listen('desktop-update-progress', (event) => {
      if (typeof event.payload === 'string') statusText.value = event.payload
    }).then((off) => offs.push(off))
  }

  async function check(): Promise<void> {
    if (!api) return
    try {
      const version = (await api.core.invoke('desktop_update_check')) as string | null
      if (version && !installing.value) availableVersion.value = version
    } catch { /* 更新源不可达不打扰用户 */ }
  }

  async function install(): Promise<void> {
    if (!api || installing.value) return
    installing.value = true
    errorText.value = ''
    statusText.value = '准备安装…'
    try {
      await api.core.invoke('desktop_update_install')
      // 成功路径：安装器重启应用，不会走到这里
    } catch (error) {
      errorText.value = error instanceof Error ? error.message : String(error)
      installing.value = false
    }
  }

  onUnmounted(() => { offs.forEach((off) => off()) })

  return { availableVersion, statusText, installing, errorText, check, install }
}
