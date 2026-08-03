import { contextBridge, ipcRenderer, webUtils } from 'electron'

interface DesktopFile {
  name: string
  path: string
  size: number
  type: string
}

let nextSubscriptionId = 0
const dropCleanups = new Map<number, () => void>()
const resumeHandlers = new Map<number, () => void>()

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
  openAtelier: () => ipcRenderer.send('desktop:open-atelier'),
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('desktop:set-ignore-mouse-events', ignore),
  getState: () => ipcRenderer.invoke('desktop:get-state') as Promise<{ alwaysOnTop: boolean; ignoreMouseEvents: boolean }>,
  toggleAlwaysOnTop: () => ipcRenderer.invoke('desktop:toggle-always-on-top') as Promise<boolean>,
  getSettings: () => ipcRenderer.invoke('desktop:get-settings') as Promise<{ openAtLogin: boolean }>,
  setAutostart: (enabled: boolean) => ipcRenderer.invoke('desktop:set-autostart', enabled) as Promise<boolean>,
  pickFiles: () => ipcRenderer.invoke('desktop:pick-files') as Promise<DesktopFile[]>,
  openWorkspace: () => ipcRenderer.invoke('desktop:open-workspace') as Promise<boolean>,
  openRuntime: () => ipcRenderer.invoke('desktop:open-runtime') as Promise<boolean>,
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
})
