import { app, BrowserWindow, dialog, globalShortcut, Menu, nativeImage, Notification, powerMonitor, screen, session, shell, Tray, utilityProcess } from 'electron'
import { ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { GatewaySupervisor } from './gatewaySupervisor'
import {
  clampWindowBounds,
  loadCompanionPreferences,
  loadWindowBounds,
  saveCompanionPreferences,
  saveWindowBounds,
  type CompanionPreferences,
  type WindowBounds,
} from './windowState'
import { resolveDesktopPaths, type DesktopPaths } from './paths'

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.setAppUserModelId('com.aics.studio')

let companionWindow: BrowserWindow | null = null
let atelierWindow: BrowserWindow | null = null
let tray: Tray | null = null
let supervisor: GatewaySupervisor | null = null
let gatewayBaseUrl = ''
let quitting = false
let ignoreMouseEvents = false
let alwaysOnTop = false
let saveBoundsTimer = 0
let companionReloadTimer = 0
let gatewayRestartTimer = 0
let gatewayRestartAttempt = 0
let desktopPaths: DesktopPaths | null = null
let startHidden = false

function runtimeRoot(): string {
  return app.getPath('userData')
}

function boundsPath(): string {
  return path.join(runtimeRoot(), 'companion-window.json')
}

function preferencesPath(): string {
  return path.join(runtimeRoot(), 'companion-preferences.json')
}

function requireDesktopPaths(): DesktopPaths {
  if (!desktopPaths) throw new Error('Desktop paths are not initialized')
  return desktopPaths
}

function savePreferences(): void {
  saveCompanionPreferences(preferencesPath(), { alwaysOnTop, ignoreMouseEvents })
}

function companionBounds(): WindowBounds {
  const saved = loadWindowBounds(boundsPath())
  const display = screen.getDisplayMatching(saved)
  return clampWindowBounds(saved, display.workArea)
}

function saveCompanionBounds(): void {
  if (!companionWindow || companionWindow.isDestroyed()) return
  clearTimeout(saveBoundsTimer)
  saveBoundsTimer = setTimeout(() => {
    if (!companionWindow || companionWindow.isDestroyed()) return
    const bounds = companionWindow.getBounds()
    saveWindowBounds(boundsPath(), bounds)
  }, 300) as unknown as number
}

function setIgnoreMouseEvents(value: boolean): void {
  ignoreMouseEvents = value
  companionWindow?.setIgnoreMouseEvents(value, { forward: true })
  savePreferences()
  updateTrayMenu()
}

function showCompanion(): void {
  if (!companionWindow || companionWindow.isDestroyed()) return
  companionWindow.showInactive()
  companionWindow.focus()
}

function toggleCompanionVisibility(): void {
  if (!companionWindow || companionWindow.isDestroyed()) return
  if (companionWindow.isVisible()) companionWindow.hide()
  else showCompanion()
}

function createAtelierWindow(): void {
  if (atelierWindow && !atelierWindow.isDestroyed()) {
    atelierWindow.show()
    atelierWindow.focus()
    return
  }
  atelierWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: '绫季绘境 Atelier',
    backgroundColor: '#110b22',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  atelierWindow.on('closed', () => { atelierWindow = null })
  void atelierWindow.loadURL(`${gatewayBaseUrl}/`)
}

function updateTrayMenu(): void {
  if (!tray) return
  const alwaysOnTop = companionWindow?.isAlwaysOnTop() ?? false
  const openAtLogin = app.getLoginItemSettings(loginItemOptions()).openAtLogin
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 Companion', click: showCompanion },
    { label: '打开 Atelier 工作台', click: createAtelierWindow },
    { type: 'separator' },
    {
      label: alwaysOnTop ? '取消置顶' : '置顶 Companion',
      click: () => { void toggleAlwaysOnTop() },
    },
    {
      label: ignoreMouseEvents ? '关闭鼠标穿透' : '开启鼠标穿透',
      click: () => setIgnoreMouseEvents(!ignoreMouseEvents),
    },
    {
      label: '开机启动',
      type: 'checkbox',
      checked: openAtLogin,
      click: item => { setAutostart(item.checked) },
    },
    { label: '打开 AI 工作区', click: () => { void openWorkspace() } },
    { label: '打开运行时目录', click: () => { void openRuntime() } },
    { type: 'separator' },
    { label: '退出 Companion', click: () => { quitting = true; app.quit() } },
  ]))
}

function loginItemOptions(): Pick<Electron.LoginItemSettingsOptions, 'path' | 'args'> {
  return { path: process.execPath, args: ['--hidden'] }
}

function setAutostart(enabled: boolean): boolean {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    ...loginItemOptions(),
  })
  updateTrayMenu()
  return app.getLoginItemSettings(loginItemOptions()).openAtLogin === enabled
}

async function openWorkspace(): Promise<boolean> {
  return !(await shell.openPath(requireDesktopPaths().aiWorkspaceRoot))
}

async function openRuntime(): Promise<boolean> {
  return !(await shell.openPath(requireDesktopPaths().runtimeRoot))
}

function showDesktopNotification(title: unknown, body: unknown): void {
  if (typeof title !== 'string' || typeof body !== 'string') return
  const safeTitle = title.trim().slice(0, 80)
  const safeBody = body.trim().slice(0, 240)
  if (!safeTitle || !safeBody) return
  new Notification({ title: safeTitle, body: safeBody }).show()
}

function registerShortcuts(): void {
  globalShortcut.unregisterAll()
  globalShortcut.register('CommandOrControl+Shift+Space', toggleCompanionVisibility)
  globalShortcut.register('CommandOrControl+Shift+A', createAtelierWindow)
}

async function toggleAlwaysOnTop(): Promise<boolean> {
  if (!companionWindow || companionWindow.isDestroyed()) return false
  const value = !companionWindow.isAlwaysOnTop()
  companionWindow.setAlwaysOnTop(value)
  alwaysOnTop = value
  savePreferences()
  updateTrayMenu()
  return value
}

function reloadCompanion(reason: string): void {
  if (quitting || !companionWindow || companionWindow.isDestroyed()) return
  clearTimeout(companionReloadTimer)
  companionReloadTimer = setTimeout(() => {
    if (!quitting && companionWindow && !companionWindow.isDestroyed()) {
      console.warn(`Companion renderer recovery: ${reason}`)
      void companionWindow.loadURL(`${gatewayBaseUrl}/companion`)
    }
  }, 700) as unknown as number
}

function keepCompanionOnScreen(): void {
  if (!companionWindow || companionWindow.isDestroyed()) return
  const bounds = companionWindow.getBounds()
  const display = screen.getDisplayMatching(bounds)
  const clamped = clampWindowBounds(bounds, display.workArea)
  if (JSON.stringify(bounds) !== JSON.stringify(clamped)) companionWindow.setBounds(clamped)
}

function scheduleGatewayRestart(): void {
  if (quitting || gatewayRestartTimer || !supervisor) return
  const delay = Math.min(30_000, 1000 * (2 ** Math.min(gatewayRestartAttempt, 5)))
  gatewayRestartAttempt += 1
  gatewayRestartTimer = setTimeout(() => {
    gatewayRestartTimer = 0
    void supervisor?.start()
      .then(url => {
        gatewayBaseUrl = url
        gatewayRestartAttempt = 0
      })
      .catch(error => {
        console.error('Gateway restart failed:', error)
        scheduleGatewayRestart()
      })
  }, delay) as unknown as number
}

function createCompanionWindow(): void {
  const bounds = companionBounds()
  companionWindow = new BrowserWindow({
    ...bounds,
    minWidth: 360,
    minHeight: 480,
    transparent: true,
    frame: false,
    resizable: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  companionWindow.setMenuBarVisibility(false)
  companionWindow.on('move', saveCompanionBounds)
  companionWindow.on('resize', saveCompanionBounds)
  companionWindow.on('close', event => {
    if (quitting) return
    event.preventDefault()
    companionWindow?.hide()
  })
  companionWindow.on('closed', () => { companionWindow = null })
  companionWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  companionWindow.webContents.on('will-navigate', event => event.preventDefault())
  companionWindow.setAlwaysOnTop(alwaysOnTop)
  companionWindow.setIgnoreMouseEvents(ignoreMouseEvents, { forward: true })
  companionWindow.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) reloadCompanion(`load failed: ${errorCode}`)
  })
  companionWindow.webContents.on('render-process-gone', () => reloadCompanion('renderer gone'))
  companionWindow.webContents.on('unresponsive', () => reloadCompanion('renderer unresponsive'))
  void companionWindow.loadURL(`${gatewayBaseUrl}/companion`)
  companionWindow.once('ready-to-show', () => {
    if (!startHidden) companionWindow?.showInactive()
  })
  updateTrayMenu()
}

function createTray(): void {
  const iconPath = path.join(requireDesktopPaths().assetsRoot, 'favicon.svg')
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('绫季 Companion')
  tray.on('click', showCompanion)
  updateTrayMenu()
}

async function start(): Promise<void> {
  startHidden = process.argv.includes('--hidden')
  desktopPaths = resolveDesktopPaths({
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath('userData'),
    isPackaged: app.isPackaged,
  })
  const paths = requireDesktopPaths()
  const preferences: CompanionPreferences = loadCompanionPreferences(preferencesPath())
  alwaysOnTop = preferences.alwaysOnTop
  ignoreMouseEvents = preferences.ignoreMouseEvents
  const port = Number(process.env.PORT || 3000)
  supervisor = new GatewaySupervisor({
    port,
    cwd: paths.gatewayCwd,
    serverPath: paths.gatewayScript,
    env: {
      AICS_APP_ROOT: paths.appRoot,
      AICS_ASSETS_ROOT: paths.assetsRoot,
      AICS_TOOLS_ROOT: paths.toolsRoot,
      AICS_RUNTIME_ROOT: paths.runtimeRoot,
      AI_WORKSPACE_ROOT: paths.aiWorkspaceRoot,
    },
    onExit: () => scheduleGatewayRestart(),
    fork: (modulePath, args, options) => utilityProcess.fork(modulePath, args, options),
  })
  gatewayBaseUrl = await supervisor.start()
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  powerMonitor.on('resume', () => {
    if (!companionWindow || companionWindow.isDestroyed()) return
    companionWindow.webContents.send('desktop:resume')
  })
  screen.on('display-removed', keepCompanionOnScreen)
  screen.on('display-metrics-changed', keepCompanionOnScreen)
  registerShortcuts()
  createTray()
  createCompanionWindow()
}

function shutdown(): void {
  clearTimeout(companionReloadTimer)
  clearTimeout(gatewayRestartTimer)
  if (supervisor) void supervisor.stop()
  if (atelierWindow && !atelierWindow.isDestroyed()) atelierWindow.destroy()
  if (companionWindow && !companionWindow.isDestroyed()) companionWindow.destroy()
  tray?.destroy()
  tray = null
  globalShortcut.unregisterAll()
}

ipcMain.on('desktop:hide', () => companionWindow?.hide())
ipcMain.on('desktop:quit', () => { quitting = true; app.quit() })
ipcMain.on('desktop:open-atelier', createAtelierWindow)
ipcMain.on('desktop:set-ignore-mouse-events', (_event, value: unknown) => {
  if (typeof value === 'boolean') setIgnoreMouseEvents(value)
})
ipcMain.handle('desktop:get-state', () => ({
  alwaysOnTop: companionWindow?.isAlwaysOnTop() ?? false,
  ignoreMouseEvents,
}))
ipcMain.handle('desktop:toggle-always-on-top', toggleAlwaysOnTop)
ipcMain.handle('desktop:get-settings', () => ({ openAtLogin: app.getLoginItemSettings(loginItemOptions()).openAtLogin }))
ipcMain.handle('desktop:set-autostart', (_event, enabled: unknown) => (
  typeof enabled === 'boolean' ? setAutostart(enabled) : app.getLoginItemSettings(loginItemOptions()).openAtLogin
))
ipcMain.handle('desktop:pick-files', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
  if (result.canceled) return []
  return result.filePaths.flatMap(filePath => {
    try {
      const stats = fs.statSync(filePath)
      return [{ name: path.basename(filePath), path: filePath, size: stats.size, type: path.extname(filePath) }]
    } catch {
      return []
    }
  })
})
ipcMain.handle('desktop:open-workspace', openWorkspace)
ipcMain.handle('desktop:open-runtime', openRuntime)
ipcMain.on('desktop:notify', (_event, title: unknown, body: unknown) => showDesktopNotification(title, body))

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showCompanion())
  app.whenReady().then(start).catch(error => {
    console.error('Companion startup failed:', error)
    app.quit()
  })
  app.on('before-quit', () => {
    quitting = true
    shutdown()
  })
  app.on('window-all-closed', () => { /* keep the tray process alive */ })
}
