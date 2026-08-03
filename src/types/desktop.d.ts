export interface DesktopFile {
  name: string
  path: string
  size: number
  type: string
}

export interface CompanionDesktopBridge {
  readonly isDesktop: true
  hide(): void
  quit(): void
  openAtelier(): void
  setIgnoreMouseEvents(ignore: boolean): void
  getState(): Promise<{ alwaysOnTop: boolean; ignoreMouseEvents: boolean }>
  toggleAlwaysOnTop(): Promise<boolean>
  getSettings(): Promise<{ openAtLogin: boolean }>
  setAutostart(enabled: boolean): Promise<boolean>
  pickFiles(): Promise<DesktopFile[]>
  openWorkspace(): Promise<boolean>
  openRuntime(): Promise<boolean>
  notify(title: string, body: string): void
  onFileDrop(listener: (files: DesktopFile[]) => void): number
  offFileDrop(subscriptionId: number): void
  onResume(listener: () => void): number
  offResume(subscriptionId: number): void
}

declare global {
  interface Window {
    companionDesktop?: CompanionDesktopBridge
  }
}

export {}
