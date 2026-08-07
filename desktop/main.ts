import { app, BrowserWindow, clipboard, dialog, globalShortcut, Menu, nativeImage, Notification, powerMonitor, screen, session, shell, Tray, utilityProcess } from 'electron'
import { ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { GatewaySupervisor } from './gatewaySupervisor'
import {
  clampWindowBounds,
  loadAiWorkspace,
  loadCompanionPreferences,
  loadDesktopGatewayPort,
  loadWindowBounds,
  saveAiWorkspace,
  saveCompanionPreferences,
  saveDesktopGatewayPort,
  saveWindowBounds,
  type CompanionPreferences,
  type WindowBounds,
} from './windowState'
import { resolveDesktopPaths, type DesktopPaths } from './paths'
import { createFileLogger, type FileLogger } from './logger'
import { normalizeAtelierPath, parseDeepLink } from './deepLink'
import { runTool, type ToolContext, type ToolResult } from './toolRunner'

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
let desktopLive2dEnabled: boolean | null = null
let saveBoundsTimer = 0
let saveAtelierBoundsTimer = 0
let companionReloadTimer = 0
let gatewayRestartTimer = 0
let gatewayRestartAttempt = 0
let gatewayHealthTimer = 0
let gatewayHealthFailures = 0
let gatewayHealthChecking = false
let desktopPaths: DesktopPaths | null = null
let gatewayReadyPromise: Promise<string> | null = null
let startHidden = false
let onBatteryPower = false
let desktopLogger: FileLogger | null = null
let clipboardTimer = 0
let clipboardTextSignature = ''
let clipboardImageSignature = ''
let globalMouseTimer = 0
let lastGlobalMouseX = 0
let lastGlobalMouseY = 0

function runtimeRoot(): string {
  return app.getPath('userData')
}

function boundsPath(): string {
  return path.join(runtimeRoot(), 'companion-window.json')
}

function preferencesPath(): string {
  return path.join(runtimeRoot(), 'companion-preferences.json')
}

function gatewayPortPath(): string {
  return path.join(runtimeRoot(), 'desktop-gateway.json')
}

function requireDesktopPaths(): DesktopPaths {
  if (!desktopPaths) throw new Error('Desktop paths are not initialized')
  return desktopPaths
}

function desktopLogPath(): string {
  return path.join(requireDesktopPaths().runtimeRoot, 'desktop.log')
}

function logInfo(message: string): void {
  console.info(`[companion] ${message}`)
  desktopLogger?.info(message)
}

function logWarn(message: string): void {
  console.warn(`[companion] ${message}`)
  desktopLogger?.warn(message)
}

function logError(message: string): void {
  console.error(`[companion] ${message}`)
  desktopLogger?.error(message)
}

function savePreferences(): void {
  saveCompanionPreferences(preferencesPath(), { alwaysOnTop, ignoreMouseEvents, live2dEnabled: desktopLive2dEnabled })
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

function atelierBounds(): WindowBounds {
  const fallback: WindowBounds = { x: 120, y: 72, width: 1440, height: 960 }
  const saved = loadWindowBounds(path.join(runtimeRoot(), 'atelier-window.json'), fallback)
  const display = screen.getDisplayMatching(saved)
  return clampWindowBounds(saved, display.workArea, { minWidth: 1024, minHeight: 720 })
}

function saveAtelierBounds(): void {
  if (!atelierWindow || atelierWindow.isDestroyed()) return
  clearTimeout(saveAtelierBoundsTimer)
  saveAtelierBoundsTimer = setTimeout(() => {
    if (!atelierWindow || atelierWindow.isDestroyed()) return
    saveWindowBounds(path.join(runtimeRoot(), 'atelier-window.json'), atelierWindow.getBounds())
  }, 300) as unknown as number
}

function setIgnoreMouseEvents(value: boolean): void {
  ignoreMouseEvents = value
  companionWindow?.setIgnoreMouseEvents(value, { forward: true })
  companionWindow?.webContents.send('desktop:interaction-mode', value)
  savePreferences()
  updateTrayMenu()
}

function showCompanion(focus = false): void {
  if (!companionWindow || companionWindow.isDestroyed()) return
  const wasVisible = companionWindow.isVisible()
  companionWindow.showInactive()
  if (focus) companionWindow.focus()
  if (!wasVisible) companionWindow.webContents.send('desktop:shown')
}

function hideCompanion(): void {
  if (!companionWindow || companionWindow.isDestroyed()) return
  companionWindow.hide()
}

function toggleCompanionVisibility(): void {
  if (!companionWindow || companionWindow.isDestroyed()) return
  if (companionWindow.isVisible()) hideCompanion()
  else showCompanion(true)
}

function showAtelier(): void {
  if (!atelierWindow || atelierWindow.isDestroyed()) return
  atelierWindow.show()
  atelierWindow.focus()
  atelierWindow.webContents.setBackgroundThrottling(false)
}

/** 网关就绪后加载页面；窗口创建可与网关启动并行，无需先等网关。 */
function loadGatewayPage(win: BrowserWindow | null, pathname: string): Promise<void> {
  if (!win) return Promise.resolve()
  const ready = gatewayReadyPromise || Promise.resolve(gatewayBaseUrl)
  return ready.then(url => {
    if (win.isDestroyed() || !url) return
    return win.loadURL(`${url}${pathname}`)
  })
}

function handleDeepLink(url: string): void {
  const pathname = parseDeepLink(url)
  if (!pathname) {
    logWarn(`Ignored deep link: ${url}`)
    return
  }
  logInfo(`Deep link → ${pathname}`)
  createAtelierWindow(pathname)
}

function createAtelierWindow(targetPath = '/'): void {
  const pathname = normalizeAtelierPath(targetPath)
  if (atelierWindow && !atelierWindow.isDestroyed()) {
    try {
      if (new URL(atelierWindow.webContents.getURL()).pathname !== pathname) {
        atelierWindow.webContents.setBackgroundThrottling(false)
        void loadGatewayPage(atelierWindow, pathname).then(showAtelier)
        return
      }
    } catch {
      atelierWindow.webContents.setBackgroundThrottling(false)
      void loadGatewayPage(atelierWindow, pathname).then(showAtelier)
      return
    }
    showAtelier()
    return
  }
  atelierWindow = new BrowserWindow({
    ...atelierBounds(),
    minWidth: 1024,
    minHeight: 720,
    title: '绫季绘境 Atelier',
    show: false,
    backgroundColor: '#110b22',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      v8CacheOptions: 'bypassHeatCheck',
    },
  })
  atelierWindow.setMenuBarVisibility(false)
  atelierWindow.on('move', saveAtelierBounds)
  atelierWindow.on('resize', saveAtelierBounds)
  atelierWindow.on('maximize', () => sendWindowMaximized(atelierWindow))
  atelierWindow.on('unmaximize', () => sendWindowMaximized(atelierWindow))
  atelierWindow.on('close', event => {
    if (quitting) return
    event.preventDefault()
    atelierWindow?.hide()
  })
  atelierWindow.on('show', () => atelierWindow?.webContents.setBackgroundThrottling(false))
  atelierWindow.on('hide', () => atelierWindow?.webContents.setBackgroundThrottling(true))
  atelierWindow.on('closed', () => { atelierWindow = null })
  atelierWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  atelierWindow.webContents.on('will-navigate', (event, url) => allowGatewayNavigation(event, url))
  atelierWindow.webContents.on('will-redirect', (event, url) => allowGatewayNavigation(event, url))
  void loadGatewayPage(atelierWindow, pathname)
  atelierWindow.once('ready-to-show', showAtelier)
}

function updateTrayMenu(): void {
  if (!tray) return
  const alwaysOnTop = companionWindow?.isAlwaysOnTop() ?? false
  const openAtLogin = app.getLoginItemSettings(loginItemOptions()).openAtLogin
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 Companion', click: () => showCompanion(true) },
    { label: '打开 Atelier 工作台', click: () => createAtelierWindow() },
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
    { label: '查看日志文件', click: () => { void openDesktopLog() } },
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

async function openDesktopLog(): Promise<boolean> {
  const logPath = desktopLogPath()
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, '', 'utf8')
  } catch { /* 目录不可写时交给 showItemInFolder 兜底 */ }
  const error = await shell.openPath(logPath)
  if (!error) return true
  try {
    shell.showItemInFolder(logPath)
    return true
  } catch {
    return false
  }
}

function allowGatewayNavigation(event: Electron.Event, url: string): void {
  try {
    if (new URL(url).origin === new URL(gatewayBaseUrl).origin) return
  } catch { /* invalid navigation is denied below */ }
  event.preventDefault()
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
}

function sendWindowMaximized(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return
  win.webContents.send('desktop:window-maximized-changed', win.isMaximized())
}

function showDesktopNotification(title: unknown, body: unknown): void {
  if (typeof title !== 'string' || typeof body !== 'string') return
  const safeTitle = title.trim().slice(0, 80)
  const safeBody = body.trim().slice(0, 240)
  if (!safeTitle || !safeBody) return
  const notification = new Notification({ title: safeTitle, body: safeBody })
  notification.on('click', () => showCompanion(true))
  notification.show()
}

function registerShortcuts(): void {
  globalShortcut.unregisterAll()
  globalShortcut.register('CommandOrControl+Shift+Space', toggleCompanionVisibility)
  globalShortcut.register('CommandOrControl+Shift+A', () => createAtelierWindow())
  globalShortcut.register('CommandOrControl+Shift+P', () => setIgnoreMouseEvents(!ignoreMouseEvents))
}

function clipboardHash(value: string | Buffer): string {
  let hash = 5381
  const data = typeof value === 'string' ? Buffer.from(value, 'utf8') : value
  for (let i = 0; i < data.length; i += 1) {
    hash = ((hash << 5) + hash + data[i]) >>> 0
  }
  return hash.toString(36)
}

/** 轮询剪贴板：图片或文本变化时通知 Companion（剪贴板无事件 API，只能轮询）。 */
function startClipboardWatch(): void {
  clearInterval(clipboardTimer)
  clipboardTimer = setInterval(() => {
    if (quitting || !companionWindow || companionWindow.isDestroyed()) return
    // 只观察本应用之外的复制：Atelier 内部复制不需要提示
    if (companionWindow.isFocused() || atelierWindow?.isFocused()) return
    try {
      const image = clipboard.readImage()
      if (!image.isEmpty()) {
        const png = image.toPNG()
        const signature = clipboardHash(png)
        if (signature !== clipboardImageSignature && png.length > 0) {
          clipboardImageSignature = signature
          companionWindow.webContents.send('desktop:clipboard-image', png)
        }
        return
      }
      const text = clipboard.readText()
      const trimmed = text.trim()
      if (trimmed.length >= 4 && trimmed.length <= 400) {
        const signature = clipboardHash(trimmed)
        if (signature !== clipboardTextSignature) {
          clipboardTextSignature = signature
          companionWindow.webContents.send('desktop:clipboard-text', trimmed)
        }
      } else if (trimmed.length === 0) {
        clipboardTextSignature = ''
      }
    } catch {
      // 剪贴板被其他进程占用时静默跳过
    }
  }, 1500) as unknown as number
}

/**
 * 全局鼠标轮询：角色目光跟随屏幕任意位置的鼠标（DOM mousemove 只覆盖窗口
 * 内）。约 30fps，坐标变化 ≥2px 才发送；窗口隐藏时不发。窗口内的精确凝视
 * 仍由渲染端 DOM 事件负责，渲染端收到 inWindow=true 时跳过。
 */
function startGlobalMouseWatch(): void {
  clearInterval(globalMouseTimer)
  globalMouseTimer = setInterval(() => {
    if (quitting || !companionWindow || companionWindow.isDestroyed() || !companionWindow.isVisible()) return
    try {
      const point = screen.getCursorScreenPoint()
      if (Math.abs(point.x - lastGlobalMouseX) < 2 && Math.abs(point.y - lastGlobalMouseY) < 2) return
      lastGlobalMouseX = point.x
      lastGlobalMouseY = point.y
      const bounds = companionWindow.getBounds()
      const inWindow = point.x >= bounds.x && point.x <= bounds.x + bounds.width
        && point.y >= bounds.y && point.y <= bounds.y + bounds.height
      companionWindow.webContents.send('desktop:global-mouse', {
        x: point.x,
        y: point.y,
        inWindow,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      })
    } catch {
      // 屏幕查询瞬时失败（多显示器热插拔）时静默跳过
    }
  }, 33) as unknown as number
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
      logWarn(`Companion renderer recovery: ${reason}`)
      void companionWindow.loadURL(`${gatewayBaseUrl}/companion`)
    }
  }, 700) as unknown as number
}

function keepCompanionOnScreen(): void {
  if (companionWindow && !companionWindow.isDestroyed()) {
    const bounds = companionWindow.getBounds()
    const display = screen.getDisplayMatching(bounds)
    const clamped = clampWindowBounds(bounds, display.workArea)
    if (JSON.stringify(bounds) !== JSON.stringify(clamped)) companionWindow.setBounds(clamped)
  }
  if (atelierWindow && !atelierWindow.isDestroyed()) {
    const bounds = atelierWindow.getBounds()
    const display = screen.getDisplayMatching(bounds)
    const clamped = clampWindowBounds(bounds, display.workArea, { minWidth: 1024, minHeight: 720 })
    if (JSON.stringify(bounds) !== JSON.stringify(clamped)) atelierWindow.setBounds(clamped)
  }
}

function scheduleGatewayRestart(): void {
  if (quitting || gatewayRestartTimer || !supervisor) return
  const delay = Math.min(30_000, 1000 * (2 ** Math.min(gatewayRestartAttempt, 5)))
  gatewayRestartAttempt += 1
  gatewayRestartTimer = setTimeout(() => {
    gatewayRestartTimer = 0
    void supervisor?.start()
      .then(url => {
        const previousUrl = gatewayBaseUrl
        gatewayBaseUrl = url
        if (supervisor) saveDesktopGatewayPort(gatewayPortPath(), supervisor.port)
        gatewayRestartAttempt = 0
        gatewayHealthFailures = 0
        if (previousUrl && previousUrl !== url) {
          if (companionWindow && !companionWindow.isDestroyed()) void companionWindow.loadURL(`${url}/companion`)
          if (atelierWindow && !atelierWindow.isDestroyed()) void atelierWindow.loadURL(`${url}/`)
        }
      })
      .catch(error => {
        logError(`Gateway restart failed: ${String(error)}`)
        scheduleGatewayRestart()
      })
  }, delay) as unknown as number
}

function startGatewayMonitor(): void {
  clearInterval(gatewayHealthTimer)
  gatewayHealthTimer = setInterval(() => {
    if (quitting || gatewayRestartTimer || gatewayHealthChecking || !supervisor) return
    gatewayHealthChecking = true
    void supervisor.isHealthy()
      .then(healthy => {
        gatewayHealthFailures = healthy ? 0 : gatewayHealthFailures + 1
        if (gatewayHealthFailures >= 3) scheduleGatewayRestart()
      })
      .finally(() => { gatewayHealthChecking = false })
  }, 5000) as unknown as number
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
      spellcheck: false,
      v8CacheOptions: 'bypassHeatCheck',
    },
  })
  companionWindow.setMenuBarVisibility(false)
  companionWindow.on('move', saveCompanionBounds)
  companionWindow.on('resize', saveCompanionBounds)
  companionWindow.on('show', () => {
    companionWindow?.webContents.setBackgroundThrottling(false)
    companionWindow?.webContents.send('desktop:visibility-changed', true)
  })
  companionWindow.on('hide', () => {
    companionWindow?.webContents.setBackgroundThrottling(true)
    companionWindow?.webContents.send('desktop:visibility-changed', false)
  })
  companionWindow.on('close', event => {
    if (quitting) return
    event.preventDefault()
    hideCompanion()
  })
  companionWindow.on('closed', () => { companionWindow = null })
  companionWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  companionWindow.webContents.on('will-navigate', (event, url) => allowGatewayNavigation(event, url))
  companionWindow.webContents.on('will-redirect', (event, url) => allowGatewayNavigation(event, url))
  companionWindow.webContents.on('context-menu', (event, params) => {
    event.preventDefault()
    if (!companionWindow || companionWindow.isDestroyed()) return
    const template: Electron.MenuItemConstructorOptions[] = []
    if (params.isEditable) {
      template.push(
        { label: '撤销', role: 'undo', enabled: params.editFlags.canUndo },
        { label: '重做', role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
        { label: '剪切', role: 'cut', enabled: params.editFlags.canCut },
        { label: '复制', role: 'copy', enabled: params.editFlags.canCopy },
        { label: '粘贴', role: 'paste', enabled: params.editFlags.canPaste },
        { label: '全选', role: 'selectAll' },
        { type: 'separator' },
      )
    } else if (params.selectionText) {
      template.push({ label: '复制', role: 'copy' }, { type: 'separator' })
    }
    template.push(
      { label: '显示 Companion', click: () => showCompanion(true) },
      { label: alwaysOnTop ? '取消置顶' : '置顶 Companion', click: () => { void toggleAlwaysOnTop() } },
      { label: ignoreMouseEvents ? '关闭鼠标穿透' : '开启鼠标穿透', click: () => setIgnoreMouseEvents(!ignoreMouseEvents) },
      { type: 'separator' },
      { label: '打开 Atelier 工作台', click: () => createAtelierWindow() },
      { label: '退出 Companion', click: () => { quitting = true; app.quit() } },
    )
    Menu.buildFromTemplate(template).popup({ window: companionWindow })
  })
  companionWindow.setAlwaysOnTop(alwaysOnTop)
  companionWindow.setIgnoreMouseEvents(ignoreMouseEvents, { forward: true })
  companionWindow.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) reloadCompanion(`load failed: ${errorCode}`)
  })
  companionWindow.webContents.on('render-process-gone', () => reloadCompanion('renderer gone'))
  companionWindow.webContents.on('unresponsive', () => reloadCompanion('renderer unresponsive'))
  void loadGatewayPage(companionWindow, '/companion')
  companionWindow.once('ready-to-show', () => {
    if (!startHidden) showCompanion(true)
  })
  updateTrayMenu()
}

function createTray(): void {
  const iconPath = path.join(requireDesktopPaths().assetsRoot, 'favicon.svg')
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('绫季 Companion')
  tray.on('click', () => showCompanion(true))
  updateTrayMenu()
}

async function start(): Promise<void> {
  startHidden = process.argv.includes('--hidden')
  const userDataPath = app.getPath('userData')
  // 打包后 appRoot 在安装目录，父目录没有 AI/；工作区路径优先取
  // userData 里持久化的配置（ai-workspace.json），其次环境变量。
  if (!process.env.AI_WORKSPACE_ROOT) {
    const savedWorkspace = loadAiWorkspace(path.join(path.resolve(userDataPath), 'ai-workspace.json'))
    if (savedWorkspace) {
      process.env.AI_WORKSPACE_ROOT = savedWorkspace
      logInfo(`AI workspace from persisted config: ${savedWorkspace}`)
    } else {
      logWarn('AI workspace not configured; training/showcase may be unavailable')
    }
  }
  desktopPaths = resolveDesktopPaths({
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    userDataPath,
    isPackaged: app.isPackaged,
  })
  const paths = requireDesktopPaths()
  desktopLogger = createFileLogger({ filePath: desktopLogPath() })
  logInfo(`Companion starting (packaged=${app.isPackaged}, hidden=${startHidden})`)
  const preferences: CompanionPreferences = loadCompanionPreferences(preferencesPath())
  alwaysOnTop = preferences.alwaysOnTop
  ignoreMouseEvents = preferences.ignoreMouseEvents
  desktopLive2dEnabled = preferences.live2dEnabled
  onBatteryPower = powerMonitor.isOnBatteryPower()
  const configuredPort = Number(process.env.PORT)
  const port = Number.isInteger(configuredPort) && configuredPort >= 1024 && configuredPort <= 65_535
    ? configuredPort
    : loadDesktopGatewayPort(gatewayPortPath())
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
      // 仅打包模式注入：data 在只读 asar、维护脚本与 npm 均不可用，
      // 网关据此对场景内容维护链路返回 501（dev 模式 electron . 不注入）。
      ...(app.isPackaged ? { AICS_DESKTOP_PACKAGED: '1' } : {}),
    },
    onExit: () => scheduleGatewayRestart(),
    onOutput: (stream, text) => desktopLogger?.log('debug', `[gateway:${stream}] ${text.trim()}`),
    fork: (modulePath, args, options) => utilityProcess.fork(modulePath, args, options),
  })
  const sup = supervisor
  const gatewayPromise = sup.start().then(url => {
    gatewayBaseUrl = url
    logInfo(`Gateway ${sup.ownsGateway ? 'started' : 'attached'} at ${url}`)
    saveDesktopGatewayPort(gatewayPortPath(), sup.port)
    return url
  })
  gatewayReadyPromise = gatewayPromise
  // 窗口创建不再等待网关就绪：托盘、Companion 窗口先出现，
  // 网关起来后统一加载页面（冷启动更快，窗口与网关并行）。
  gatewayPromise.catch(error => {
    logError(`Gateway start failed: ${String(error)}`)
    scheduleGatewayRestart()
  })
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  powerMonitor.on('resume', () => {
    if (!companionWindow || companionWindow.isDestroyed()) return
    onBatteryPower = powerMonitor.isOnBatteryPower()
    companionWindow.webContents.send('desktop:power-mode', onBatteryPower)
    companionWindow.webContents.send('desktop:resume')
  })
  powerMonitor.on('on-battery', () => {
    onBatteryPower = true
    companionWindow?.webContents.send('desktop:power-mode', true)
  })
  powerMonitor.on('on-ac', () => {
    onBatteryPower = false
    companionWindow?.webContents.send('desktop:power-mode', false)
  })
  screen.on('display-removed', keepCompanionOnScreen)
  screen.on('display-metrics-changed', keepCompanionOnScreen)
  registerShortcuts()
  startClipboardWatch()
  createTray()
  createCompanionWindow()
  startGlobalMouseWatch()
  startGatewayMonitor()
  // 冷启动深链：aics://xxx 传在 argv 里
  const deepLinkArg = process.argv.find(arg => arg.startsWith('aics://'))
  if (deepLinkArg) handleDeepLink(deepLinkArg)
}

function shutdown(): void {
  logInfo('Companion shutting down')
  clearTimeout(companionReloadTimer)
  clearTimeout(gatewayRestartTimer)
  clearInterval(gatewayHealthTimer)
  clearTimeout(saveAtelierBoundsTimer)
  clearInterval(clipboardTimer)
  clearInterval(globalMouseTimer)
  if (supervisor) void supervisor.stop()
  if (atelierWindow && !atelierWindow.isDestroyed()) atelierWindow.destroy()
  if (companionWindow && !companionWindow.isDestroyed()) companionWindow.destroy()
  tray?.destroy()
  tray = null
  globalShortcut.unregisterAll()
}

function isTrustedDesktopSender(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean {
  const sender = event.sender
  const trustedWindow = sender === companionWindow?.webContents || sender === atelierWindow?.webContents
  if (!trustedWindow) return false
  const frame = event.senderFrame
  if (!frame) return false
  try {
    return new URL(frame.url).origin === new URL(gatewayBaseUrl).origin
  } catch {
    return false
  }
}

function requireTrustedDesktopSender(event: Electron.IpcMainInvokeEvent): void {
  if (!isTrustedDesktopSender(event)) throw new Error('Untrusted desktop IPC sender')
}

ipcMain.on('desktop:hide', event => { if (isTrustedDesktopSender(event)) hideCompanion() })
ipcMain.on('desktop:quit', event => {
  if (!isTrustedDesktopSender(event)) return
  quitting = true
  app.quit()
})
ipcMain.on('desktop:open-atelier', (event, pathname: unknown) => {
  if (isTrustedDesktopSender(event)) createAtelierWindow(normalizeAtelierPath(pathname))
})
ipcMain.on('desktop:set-ignore-mouse-events', (event, value: unknown) => {
  if (!isTrustedDesktopSender(event)) return
  if (typeof value === 'boolean') setIgnoreMouseEvents(value)
})
ipcMain.on('desktop:set-live2d-enabled', (event, value: unknown) => {
  if (!isTrustedDesktopSender(event)) return
  if (typeof value !== 'boolean') return
  desktopLive2dEnabled = value
  savePreferences()
})
ipcMain.handle('desktop:get-state', event => {
  requireTrustedDesktopSender(event)
  return {
    alwaysOnTop: companionWindow?.isAlwaysOnTop() ?? false,
    ignoreMouseEvents,
    visible: companionWindow?.isVisible() ?? false,
    onBatteryPower,
    live2dEnabled: desktopLive2dEnabled,
  }
})
ipcMain.handle('desktop:toggle-always-on-top', event => {
  requireTrustedDesktopSender(event)
  return toggleAlwaysOnTop()
})
ipcMain.handle('desktop:get-settings', event => {
  requireTrustedDesktopSender(event)
  return { openAtLogin: app.getLoginItemSettings(loginItemOptions()).openAtLogin }
})
ipcMain.handle('desktop:is-packaged', event => {
  requireTrustedDesktopSender(event)
  return app.isPackaged
})
ipcMain.handle('desktop:set-autostart', (event, enabled: unknown) => {
  requireTrustedDesktopSender(event)
  return typeof enabled === 'boolean' ? setAutostart(enabled) : app.getLoginItemSettings(loginItemOptions()).openAtLogin
})
ipcMain.handle('desktop:pick-files', async event => {
  requireTrustedDesktopSender(event)
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
ipcMain.handle('desktop:save-image', async (event, payload: unknown) => {
  requireTrustedDesktopSender(event)
  const value = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null
  if (!value || typeof value.data !== 'object' || value.data === null) {
    throw new Error('导出数据无效')
  }
  const data = value.data as Uint8Array
  if (!(data instanceof Uint8Array) || data.length === 0) throw new Error('导出图片为空')
  const suggestedName = typeof value.name === 'string' && value.name.trim()
    ? value.name.trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 120)
    : 'image.png'
  const ext = path.extname(suggestedName).toLowerCase() || '.png'
  const result = await dialog.showSaveDialog({
    title: '导出图片',
    defaultPath: suggestedName,
    filters: [
      { name: ext === '.jpg' || ext === '.jpeg' ? 'JPEG 图片' : ext === '.webp' ? 'WebP 图片' : 'PNG 图片', extensions: [ext.replace('.', '')] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePath) return { saved: false }
  fs.writeFileSync(result.filePath, Buffer.from(data))
  return { saved: true, filePath: result.filePath }
})
ipcMain.handle('desktop:open-workspace', event => {
  requireTrustedDesktopSender(event)
  return openWorkspace()
})
ipcMain.handle('desktop:get-workspace', event => {
  requireTrustedDesktopSender(event)
  const paths = requireDesktopPaths()
  return {
    root: process.env.AI_WORKSPACE_ROOT || paths.aiWorkspaceRoot,
    exists: fs.existsSync(process.env.AI_WORKSPACE_ROOT || paths.aiWorkspaceRoot),
  }
})
ipcMain.handle('desktop:set-workspace', async (event, root: unknown) => {
  requireTrustedDesktopSender(event)
  if (typeof root !== 'string' || !root.trim()) {
    throw new Error('工作区路径不能为空')
  }
  const paths = requireDesktopPaths()
  if (!saveAiWorkspace(paths.aiWorkspaceFile, root.trim())) {
    throw new Error('工作区目录不存在或不是文件夹')
  }
  process.env.AI_WORKSPACE_ROOT = path.resolve(root.trim())
  logInfo(`AI workspace updated to ${process.env.AI_WORKSPACE_ROOT}`)
  // 网关 fork 时读取 AI_WORKSPACE_ROOT；重启让它用新路径。
  if (supervisor) {
    await supervisor.stop()
    gatewayBaseUrl = await supervisor.start()
    if (companionWindow && !companionWindow.isDestroyed()) {
      void companionWindow.loadURL(`${gatewayBaseUrl}/companion`)
    }
    if (atelierWindow && !atelierWindow.isDestroyed()) {
      void atelierWindow.loadURL(`${gatewayBaseUrl}/`)
    }
  }
  return { root: process.env.AI_WORKSPACE_ROOT }
})
ipcMain.handle('desktop:open-runtime', event => {
  requireTrustedDesktopSender(event)
  return openRuntime()
})
ipcMain.handle('desktop:open-log', event => {
  requireTrustedDesktopSender(event)
  return openDesktopLog()
})
ipcMain.on('desktop:notify', (event, title: unknown, body: unknown) => {
  if (isTrustedDesktopSender(event)) showDesktopNotification(title, body)
})
// 无边框标题栏窗口控制：只允许本网关页面驱动自己的窗口
ipcMain.on('desktop:window-minimize', event => {
  if (!isTrustedDesktopSender(event)) return
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})
ipcMain.on('desktop:window-maximize-toggle', event => {
  if (!isTrustedDesktopSender(event)) return
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})
ipcMain.on('desktop:window-close', event => {
  if (!isTrustedDesktopSender(event)) return
  BrowserWindow.fromWebContents(event.sender)?.close()
})
ipcMain.handle('desktop:get-window-state', event => {
  requireTrustedDesktopSender(event)
  const win = BrowserWindow.fromWebContents(event.sender)
  return { maximized: win?.isMaximized() ?? false, focused: win?.isFocused() ?? false }
})
ipcMain.on('desktop:set-progress', (event, value: unknown) => {
  if (!isTrustedDesktopSender(event)) return
  const progress = typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : value === null ? -1 : NaN
  if (Number.isNaN(progress)) return
  // 训练/生成本地任务时任务栏图标显示进度环；完成/空闲时清除
  atelierWindow?.setProgressBar(Number.isFinite(progress) ? progress : -1)
  companionWindow?.setProgressBar(Number.isFinite(progress) ? progress : -1)
})

// 桌宠本地工具（Companion Tools）：LLM 通过 tool_calls 驱动，渲染端经此
// IPC 在 AI 工作区内执行文件读写与命令（toolRunner 内做路径白名单与上限）。
const TOOL_NAMES = new Set(['list_files', 'read_file', 'write_file', 'run_command', 'read_image', 'get_workspace_info'])
ipcMain.handle('desktop:run-tool', async (event, name: unknown, args: unknown) => {
  requireTrustedDesktopSender(event)
  const toolName = typeof name === 'string' ? name : ''
  if (!TOOL_NAMES.has(toolName)) throw new Error(`未知工具：${toolName}`)
  const rawArgs = args && typeof args === 'object' && !Array.isArray(args) ? args as Record<string, unknown> : {}
  const context: ToolContext = {
    workspaceRoot: process.env.AI_WORKSPACE_ROOT || requireDesktopPaths().aiWorkspaceRoot,
  }
  const result: ToolResult = await runTool(context, toolName, rawArgs)
  logInfo(`[tool] ${toolName} → ${result.ok ? 'ok' : 'error'} ${result.output.slice(0, 120).replace(/\s+/g, ' ')}`)
  return result
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // Windows 深链走 second-instance 的 argv；macOS 走 open-url
    for (const arg of argv) {
      if (typeof arg === 'string' && arg.startsWith('aics://')) {
        handleDeepLink(arg)
        return
      }
    }
    showCompanion(true)
  })
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })
  app.whenReady().then(async () => {
    // 注册 aics:// 协议（打包后由安装器写入注册表；开发模式动态注册）
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('aics', process.execPath, [path.resolve(process.argv[1])])
      }
    } else {
      app.setAsDefaultProtocolClient('aics')
    }
    await start()
  }).catch(error => {
    logError(`Companion startup failed: ${String(error)}`)
    app.quit()
  })
  app.on('before-quit', () => {
    quitting = true
    shutdown()
  })
  app.on('window-all-closed', () => { /* keep the tray process alive */ })
}
