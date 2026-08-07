import { contextBridge, ipcRenderer, webUtils } from 'electron'

interface DesktopFile {
  name: string
  path: string
  size: number
  type: string
}

let nextSubscriptionId = 0
type IpcListener = Parameters<typeof ipcRenderer.on>[1]
const dropCleanups = new Map<number, () => void>()
const resumeHandlers = new Map<number, () => void>()
const shownHandlers = new Map<number, () => void>()
const visibilityHandlers = new Map<number, IpcListener>()
const powerModeHandlers = new Map<number, IpcListener>()
const interactionModeHandlers = new Map<number, IpcListener>()
const clipboardImageHandlers = new Map<number, IpcListener>()
const clipboardTextHandlers = new Map<number, IpcListener>()
const globalMouseHandlers = new Map<number, IpcListener>()
const windowMaximizedHandlers = new Map<number, IpcListener>()

export interface GlobalMouseState {
  x: number
  y: number
  inWindow: boolean
  bounds: { x: number; y: number; width: number; height: number }
}

function droppedFiles(event: DragEvent): DesktopFile[] {
  return Array.from(event.dataTransfer?.files || []).flatMap(file => {
    try {
      const filePath = webUtils.getPathForFile(file)
      return filePath ? [{ name: file.name, path: filePath, size: file.size, type: file.type }] : []
    } catch {
      return []
    }
  })
}

contextBridge.exposeInMainWorld('companionDesktop', {
  isDesktop: true,
  hide: () => ipcRenderer.send('desktop:hide'),
  quit: () => ipcRenderer.send('desktop:quit'),
  openAtelier: (pathname = '/') => ipcRenderer.send('desktop:open-atelier', pathname),
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('desktop:set-ignore-mouse-events', ignore),
  setLive2dEnabled: (enabled: boolean) => ipcRenderer.send('desktop:set-live2d-enabled', enabled),
  getState: () => ipcRenderer.invoke('desktop:get-state') as Promise<{
    alwaysOnTop: boolean
    ignoreMouseEvents: boolean
    visible: boolean
    onBatteryPower: boolean
    live2dEnabled: boolean | null
  }>,
  toggleAlwaysOnTop: () => ipcRenderer.invoke('desktop:toggle-always-on-top') as Promise<boolean>,
  getSettings: () => ipcRenderer.invoke('desktop:get-settings') as Promise<{ openAtLogin: boolean }>,
  isPackaged: () => ipcRenderer.invoke('desktop:is-packaged') as Promise<boolean>,
  setAutostart: (enabled: boolean) => ipcRenderer.invoke('desktop:set-autostart', enabled) as Promise<boolean>,
  pickFiles: () => ipcRenderer.invoke('desktop:pick-files') as Promise<DesktopFile[]>,
  saveImage: (payload: { data: Uint8Array; name?: string }) => ipcRenderer.invoke('desktop:save-image', payload) as Promise<{ saved: boolean; filePath?: string }>,
  openWorkspace: () => ipcRenderer.invoke('desktop:open-workspace') as Promise<boolean>,
  openRuntime: () => ipcRenderer.invoke('desktop:open-runtime') as Promise<boolean>,
  openLog: () => ipcRenderer.invoke('desktop:open-log') as Promise<boolean>,
  getWorkspace: () => ipcRenderer.invoke('desktop:get-workspace') as Promise<{ root: string; exists: boolean }>,
  setWorkspace: (root: string) => ipcRenderer.invoke('desktop:set-workspace', root) as Promise<{ root: string }>,
  notify: (title: string, body: string) => ipcRenderer.send('desktop:notify', title, body),
  setProgress: (progress: number | null) => ipcRenderer.send('desktop:set-progress', progress),
  runTool: (name: string, args: Record<string, unknown>) =>
    ipcRenderer.invoke('desktop:run-tool', name, args) as Promise<{ ok: boolean; output: string; imageDataUrl?: string }>,
  onFileDrop: (listener: (files: DesktopFile[]) => void) => {
    const subscriptionId = ++nextSubscriptionId
    const onDragOver = (event: DragEvent) => event.preventDefault()
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      const files = droppedFiles(event)
      if (files.length) listener(files)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    dropCleanups.set(subscriptionId, () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    })
    return subscriptionId
  },
  offFileDrop: (subscriptionId: number) => {
    dropCleanups.get(subscriptionId)?.()
    dropCleanups.delete(subscriptionId)
  },
  onResume: (listener: () => void) => {
    const subscriptionId = ++nextSubscriptionId
    const handler = () => listener()
    ipcRenderer.on('desktop:resume', handler)
    resumeHandlers.set(subscriptionId, handler)
    return subscriptionId
  },
  offResume: (subscriptionId: number) => {
    const handler = resumeHandlers.get(subscriptionId)
    if (handler) ipcRenderer.removeListener('desktop:resume', handler)
    resumeHandlers.delete(subscriptionId)
  },
  onShown: (listener: () => void) => {
    const subscriptionId = ++nextSubscriptionId
    const handler = () => listener()
    ipcRenderer.on('desktop:shown', handler)
    shownHandlers.set(subscriptionId, handler)
    return subscriptionId
  },
  offShown: (subscriptionId: number) => {
    const handler = shownHandlers.get(subscriptionId)
    if (handler) ipcRenderer.removeListener('desktop:shown', handler)
    shownHandlers.delete(subscriptionId)
  },
  onVisibilityChanged: (listener: (visible: boolean) => void) => {
    const subscriptionId = ++nextSubscriptionId
    const handler: IpcListener = (_event, visible: unknown) => {
      if (typeof visible === 'boolean') listener(visible)
    }
    ipcRenderer.on('desktop:visibility-changed', handler)
    visibilityHandlers.set(subscriptionId, handler)
    return subscriptionId
  },
  offVisibilityChanged: (subscriptionId: number) => {
    const handler = visibilityHandlers.get(subscriptionId)
    if (handler) ipcRenderer.removeListener('desktop:visibility-changed', handler)
    visibilityHandlers.delete(subscriptionId)
  },
  onPowerModeChanged: (listener: (onBatteryPower: boolean) => void) => {
    const subscriptionId = ++nextSubscriptionId
    const handler: IpcListener = (_event, onBatteryPower: unknown) => {
      if (typeof onBatteryPower === 'boolean') listener(onBatteryPower)
    }
    ipcRenderer.on('desktop:power-mode', handler)
    powerModeHandlers.set(subscriptionId, handler)
    return subscriptionId
  },
  offPowerModeChanged: (subscriptionId: number) => {
    const handler = powerModeHandlers.get(subscriptionId)
    if (handler) ipcRenderer.removeListener('desktop:power-mode', handler)
    powerModeHandlers.delete(subscriptionId)
  },
  onInteractionModeChanged: (listener: (ignoreMouseEvents: boolean) => void) => {
    const subscriptionId = ++nextSubscriptionId
    const handler: IpcListener = (_event, ignoreMouseEvents: unknown) => {
      if (typeof ignoreMouseEvents === 'boolean') listener(ignoreMouseEvents)
    }
    ipcRenderer.on('desktop:interaction-mode', handler)
    interactionModeHandlers.set(subscriptionId, handler)
    return subscriptionId
  },
  offInteractionModeChanged: (subscriptionId: number) => {
    const handler = interactionModeHandlers.get(subscriptionId)
    if (handler) ipcRenderer.removeListener('desktop:interaction-mode', handler)
    interactionModeHandlers.delete(subscriptionId)
  },
  onClipboardImage: (listener: (png: Uint8Array) => void) => {
    const subscriptionId = ++nextSubscriptionId
    const handler: IpcListener = (_event, png: unknown) => {
      if (png instanceof Uint8Array) listener(png)
    }
    ipcRenderer.on('desktop:clipboard-image', handler)
    clipboardImageHandlers.set(subscriptionId, handler)
    return subscriptionId
  },
  offClipboardImage: (subscriptionId: number) => {
    const handler = clipboardImageHandlers.get(subscriptionId)
    if (handler) ipcRenderer.removeListener('desktop:clipboard-image', handler)
    clipboardImageHandlers.delete(subscriptionId)
  },
  onClipboardText: (listener: (text: string) => void) => {
    const subscriptionId = ++nextSubscriptionId
    const handler: IpcListener = (_event, text: unknown) => {
      if (typeof text === 'string') listener(text)
    }
    ipcRenderer.on('desktop:clipboard-text', handler)
    clipboardTextHandlers.set(subscriptionId, handler)
    return subscriptionId
  },
  offClipboardText: (subscriptionId: number) => {
    const handler = clipboardTextHandlers.get(subscriptionId)
    if (handler) ipcRenderer.removeListener('desktop:clipboard-text', handler)
    clipboardTextHandlers.delete(subscriptionId)
  },
  onGlobalMouse: (listener: (state: GlobalMouseState) => void) => {
    const subscriptionId = ++nextSubscriptionId
    const handler: IpcListener = (_event, state: unknown) => {
      if (!state || typeof state !== 'object') return
      const value = state as Record<string, unknown>
      const bounds = value.bounds && typeof value.bounds === 'object' ? value.bounds as Record<string, unknown> : null
      if (typeof value.x !== 'number' || typeof value.y !== 'number' || typeof value.inWindow !== 'boolean') return
      if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number'
        || typeof bounds.width !== 'number' || typeof bounds.height !== 'number') return
      listener({
        x: value.x,
        y: value.y,
        inWindow: value.inWindow,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      })
    }
    ipcRenderer.on('desktop:global-mouse', handler)
    globalMouseHandlers.set(subscriptionId, handler)
    return subscriptionId
  },
  offGlobalMouse: (subscriptionId: number) => {
    const handler = globalMouseHandlers.get(subscriptionId)
    if (handler) ipcRenderer.removeListener('desktop:global-mouse', handler)
    globalMouseHandlers.delete(subscriptionId)
  },
  minimizeWindow: () => ipcRenderer.send('desktop:window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('desktop:window-maximize-toggle'),
  closeWindow: () => ipcRenderer.send('desktop:window-close'),
  getWindowState: () => ipcRenderer.invoke('desktop:get-window-state') as Promise<{ maximized: boolean; focused: boolean }>,
  onMaximizedChanged: (listener: (maximized: boolean) => void) => {
    const subscriptionId = ++nextSubscriptionId
    const handler: IpcListener = (_event, maximized: unknown) => {
      if (typeof maximized === 'boolean') listener(maximized)
    }
    ipcRenderer.on('desktop:window-maximized-changed', handler)
    windowMaximizedHandlers.set(subscriptionId, handler)
    return subscriptionId
  },
  offMaximizedChanged: (subscriptionId: number) => {
    const handler = windowMaximizedHandlers.get(subscriptionId)
    if (handler) ipcRenderer.removeListener('desktop:window-maximized-changed', handler)
    windowMaximizedHandlers.delete(subscriptionId)
  },
})
