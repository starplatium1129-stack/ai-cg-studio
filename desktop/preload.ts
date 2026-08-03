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
  setAutostart: (enabled: boolean) => ipcRenderer.invoke('desktop:set-autostart', enabled) as Promise<boolean>,
  pickFiles: () => ipcRenderer.invoke('desktop:pick-files') as Promise<DesktopFile[]>,
  openWorkspace: () => ipcRenderer.invoke('desktop:open-workspace') as Promise<boolean>,
  openRuntime: () => ipcRenderer.invoke('desktop:open-runtime') as Promise<boolean>,
  openLog: () => ipcRenderer.invoke('desktop:open-log') as Promise<boolean>,
  notify: (title: string, body: string) => ipcRenderer.send('desktop:notify', title, body),
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
})
