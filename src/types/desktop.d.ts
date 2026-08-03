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
  openAtelier(pathname?: string): void
  setIgnoreMouseEvents(ignore: boolean): void
  setLive2dEnabled(enabled: boolean): void
  getState(): Promise<{
    alwaysOnTop: boolean
    ignoreMouseEvents: boolean
    visible: boolean
    onBatteryPower: boolean
    live2dEnabled: boolean | null
  }>
  toggleAlwaysOnTop(): Promise<boolean>
  getSettings(): Promise<{ openAtLogin: boolean }>
  setAutostart(enabled: boolean): Promise<boolean>
  pickFiles(): Promise<DesktopFile[]>
  openWorkspace(): Promise<boolean>
  openRuntime(): Promise<boolean>
  openLog(): Promise<boolean>
  notify(title: string, body: string): void
  onFileDrop(listener: (files: DesktopFile[]) => void): number
  offFileDrop(subscriptionId: number): void
  onResume(listener: () => void): number
  offResume(subscriptionId: number): void
  onShown(listener: () => void): number
  offShown(subscriptionId: number): void
  onVisibilityChanged(listener: (visible: boolean) => void): number
  offVisibilityChanged(subscriptionId: number): void
  onPowerModeChanged(listener: (onBatteryPower: boolean) => void): number
  offPowerModeChanged(subscriptionId: number): void
  onInteractionModeChanged(listener: (ignoreMouseEvents: boolean) => void): number
  offInteractionModeChanged(subscriptionId: number): void
}

declare global {
  interface Window {
    companionDesktop?: CompanionDesktopBridge
  }
}

export {}
