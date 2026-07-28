import { ref } from 'vue'
import { LIVE2D_EXPRESSIONS } from '@/config/characters'

export interface Live2DStatus {
  state: 'checking' | 'idle' | 'static' | 'loading' | 'ready' | 'degraded' | 'fallback'
  text: string
  detail: string
  retryable: boolean
  ready: boolean
}

interface Live2DModelInfo {
  available: boolean
  modelUrl: string
  source: string
  missing: string[]
  canvas?: { width: number; height: number }
}

interface Live2DCatalog {
  models: Record<string, Live2DModelInfo>
}

interface Live2DModel {
  visible: boolean
  width: number
  height: number
  x: number
  y: number
  scale: { x: number; y: number; set(value: number): void }
  internalModel?: {
    on(event: 'beforeModelUpdate', callback: () => void): void
    coreModel?: { setParameterValueById(id: string, value: number, weight: number): void }
    motionManager?: { definitions?: Record<string, unknown[]> }
    settings?: {
      motions?: Record<string, unknown[]>
      hitAreas?: unknown[]
    }
  }
  focus?(x: number, y: number): void
  motion?(group: string, index?: number, priority?: number): Promise<unknown> | unknown
  expression?(name: string): Promise<unknown> | unknown
  hitTest?(x: number, y: number): string[]
  tap?(x: number, y: number): void
}

interface Live2DApp {
  app?: {
    screen?: { width: number; height: number }
    ticker?: { started: boolean; start(): void; stop(): void }
  }
  onModelLoaded(callback: (model: Live2DModel) => void): void
  onModelError(callback: (error: Error) => void): void
  destroy(): void
}

type Live2DFactory = (options: Record<string, unknown>) => Live2DApp
type Live2DLibrary = { wlLive2d: Live2DFactory }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCatchable(value: unknown): value is { catch(handler: (error: unknown) => void): unknown } {
  return isRecord(value) && typeof value.catch === 'function'
}

function readLive2DCatalog(value: unknown): Live2DCatalog {
  if (!isRecord(value) || !isRecord(value.models)) throw new Error('Live2D 状态响应格式无效')
  const models: Record<string, Live2DModelInfo> = {}
  for (const [character, raw] of Object.entries(value.models)) {
    if (!isRecord(raw)) continue
    models[character] = {
      available: Boolean(raw.available),
      modelUrl: typeof raw.modelUrl === 'string' ? raw.modelUrl : '',
      source: typeof raw.source === 'string' ? raw.source : '',
      missing: Array.isArray(raw.missing) ? raw.missing.filter((item): item is string => typeof item === 'string') : [],
      canvas: isRecord(raw.canvas)
        ? { width: Number(raw.canvas.width) || 420, height: Number(raw.canvas.height) || 610 }
        : undefined,
    }
  }
  return { models }
}

function readLibrary(value: unknown): Live2DLibrary | null {
  if (typeof value === 'function') return { wlLive2d: value as Live2DFactory }
  if (!isRecord(value)) return null
  if (typeof value.wlLive2d === 'function') return { wlLive2d: value.wlLive2d as Live2DFactory }
  return readLibrary(value.default)
}

export function useLive2D(onStatus: (s: Live2DStatus) => void = () => {}) {
  const ready = ref(false)
  const enabled = ref(false)
  const destroyed = ref(false)
  const character = ref('nene')
  const loadedCharacter = ref('')
  const mouthValue = ref(0)
  const interactionHint = ref('')

  // 内部可变状态（不需要响应式）
  let catalog: Live2DCatalog | null = null
  let app: Live2DApp | null = null
  let model: Live2DModel | null = null
  let loading: Promise<boolean> | null = null
  let loadTimer = 0
  let resizeObserver: ResizeObserver | null = null
  let onResize: (() => void) | null = null
  let visibilityHandler: (() => void) | null = null
  let pointerMoveHandler: ((event: PointerEvent) => void) | null = null
  let pointerLeaveHandler: (() => void) | null = null
  let pointerClickHandler: ((event: MouseEvent) => void) | null = null
  let focusFrame = 0
  let focusPoint: { x: number; y: number } | null = null
  let expressionTimer = 0
  let interactionIndex = 0
  let mouthHooked = false
  let speaking = false
  let hostEl: HTMLElement | null = null
  let stageEl: HTMLElement | null = null
  let hostSelector = '#live2dHost'
  let desiredExpression = 'neutral'

  function setState(state: Live2DStatus['state'], text: string, detail = '', retryable = false) {
    if (hostEl) { hostEl.dataset.state = state; hostEl.dataset.error = detail; hostEl.dataset.retryable = retryable ? 'true' : 'false' }
    onStatus({ state, text, detail, retryable, ready: ready.value })
  }

  async function init(char: string, host: HTMLElement, stage: HTMLElement, options: { autoLoad?: boolean } = {}) {
    hostEl = host; stageEl = stage
    // wl-live2d 只接受 CSS selector，这里保证宿主节点有稳定 id 可选中
    if (!hostEl.id) hostEl.id = 'live2dHost'
    hostSelector = '#' + hostEl.id
    character.value = char || character.value
    setState('checking', '检查 Live2D…')
    try {
      const response = await fetch('/api/live2d-status', { cache: 'no-store' })
      if (!response.ok) throw new Error('Live2D 状态接口不可用')
      catalog = readLive2DCatalog(await response.json())
      observeSize()
      bindVisibility()
      enabled.value = options.autoLoad === true
      if (enabled.value) await setCharacter(character.value)
      else {
        setVisible(false)
        setState('idle', '启用 Live2D', '点击后才下载并加载动态模型', true)
      }
    } catch (e) {
      fallback('Live2D 未就绪', errorMessage(e))
    }
  }

  function modelInfo(char: string) {
    return catalog?.models?.[char] ?? null
  }

  async function setCharacter(char: string) {
    character.value = char
    const info = modelInfo(char)
    if (!info?.available || !info?.modelUrl) {
      setVisible(false)
      interactionHint.value = ''
      setState('static', '静态立绘', info?.source || '该角色暂无 Live2D 模型')
      return
    }
    if (!enabled.value) {
      setVisible(false)
      interactionHint.value = ''
      setState('idle', '启用 Live2D', '点击后才下载并加载动态模型', true)
      return
    }
    if (ready.value && loadedCharacter.value === char) {
      setVisible(true); setState('ready', 'Live2D 已连接')
      setPaused(document.hidden); layout(); return
    }
    await load(char, info)
  }

  async function retry() {
    if (destroyed.value) return
    if (!enabled.value) return enable()
    destroyRuntime()
    await setCharacter(character.value)
  }

  async function enable() {
    if (destroyed.value) return false
    enabled.value = true
    return setCharacter(character.value)
  }

  function disable() {
    enabled.value = false
    destroyRuntime()
    interactionHint.value = ''
    setState('idle', '启用 Live2D', '动态模型已释放；点击可重新加载', true)
  }

  /**
   * 载入 wl-live2d 运行库。
   * 重构前靠 index.html 的全局 <script> 注入；Vue SPA 没有那段脚本，
   * 所以这里改成动态 import npm 包，并兼容 default / 命名导出 / 全局三种形态。
   */
  async function loadLibrary(): Promise<Live2DLibrary> {
    const live2DWindow = window as Window & typeof globalThis & { 'wl-live2d'?: Live2DLibrary }
    const existing = readLibrary(live2DWindow['wl-live2d'])
    if (existing) return existing
    try {
      const library = readLibrary(await import('wl-live2d'))
      if (library) {
        live2DWindow['wl-live2d'] = library
        return library
      }
      throw new Error('wl-live2d 导出中没有 wlLive2d')
    } catch (e) {
      throw new Error('wl-live2d 运行库导入失败：' + errorMessage(e))
    }
  }

  function load(char: string, info: Live2DModelInfo): Promise<boolean> {
    if (loading) return loading
    loading = new Promise((resolve) => {
      void (async () => {
      let library: Live2DLibrary
      try {
        library = await loadLibrary()
      } catch (e) {
        fallback('Live2D 运行库加载失败', errorMessage(e))
        loading = null
        resolve(false); return
      }
      if (destroyed.value || char !== character.value) { loading = null; resolve(false); return }
      destroyRuntime()
      if (hostEl) hostEl.innerHTML = ''
      setState('loading', 'Live2D 加载中…')
      const canvas = info.canvas || { width: 420, height: 610 }
      let settled = false
      const finish = (v: boolean) => {
        if (settled) return; settled = true
        clearTimeout(loadTimer); loading = null; resolve(v)
      }
      loadTimer = window.setTimeout(() => { fallback('Live2D 加载超时', '模型在 20 秒内没有完成初始化'); finish(false) }, 20000)
      try {
        app = library.wlLive2d({
          selector: hostSelector, fixed: false, drag: false, sayHello: false, hitFrame: false,
          menus: [], tips: { talk: false, drag: false, motionMessage: false, message: [], talkApis: [] },
          transitionTime: 250,
          models: [{ path: info.modelUrl, width: canvas.width, height: canvas.height, position: { x: 0, y: 0 }, motionPreload: 'IDLE' }],
        })
        app.onModelLoaded((m: Live2DModel) => {
          if (destroyed.value || char !== character.value) { finish(false); return }
          model = m; loadedCharacter.value = char; ready.value = true
          mouthValue.value = 0; mouthHooked = false
          bindMouthOverride(); bindContextEvents(); bindInteractionEvents(); fit(); layout()
          setVisible(true); setExpression(desiredExpression); setPaused(document.hidden); setState('ready', 'Live2D 已连接'); finish(true)
        })
        app.onModelError((e: Error) => {
          const detail = errorMessage(e)
          // wl-live2d 复用这一个回调报告初始载入和之后的 expression/motion
          // 错误。后者不代表已经显示的模型失效，不能因此切回静态立绘。
          if (ready.value && loadedCharacter.value === char) {
            setState('degraded', 'Live2D 动作暂不可用', detail, true)
            return
          }
          fallback('Live2D 模型加载失败', detail); finish(false)
        })
      } catch (e) { fallback('Live2D 初始化失败', errorMessage(e)); finish(false) }
      })()
    })
    return loading
  }

  function observeSize() {
    if (!hostEl) return
    if ('ResizeObserver' in window && !resizeObserver) {
      resizeObserver = new ResizeObserver(() => layout()); resizeObserver.observe(hostEl)
    } else {
      window.addEventListener('resize', (onResize = () => layout()))
    }
  }

  function bindVisibility() {
    if (visibilityHandler) return
    visibilityHandler = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', visibilityHandler)
  }

  function bindMouthOverride() {
    if (!model?.internalModel || mouthHooked) return
    mouthHooked = true
    model.internalModel.on('beforeModelUpdate', applyMouth)
  }

  function applyMouth() {
    if (!model?.visible || !speaking) return
    try {
      // Cubism motion/physics run before this event. Write with full weight so
      // their idle mouth value cannot overwrite the audio amplitude.
      model.internalModel?.coreModel?.setParameterValueById('ParamMouthOpenY', mouthValue.value, 1)
    } catch {}
  }

  function bindContextEvents() {
    if (!hostEl) return
    const cvs = hostEl.querySelector('canvas') as HTMLCanvasElement | null
    if (!cvs || cvs.dataset.contextEvents === '1') return
    cvs.dataset.contextEvents = '1'
    cvs.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallback('Live2D 图形上下文已暂停', 'WebGL context lost') })
    cvs.addEventListener('webglcontextrestored', () => retry())
  }

  function worldPoint(event: PointerEvent | MouseEvent) {
    const canvas = hostEl?.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect() ?? stageEl?.getBoundingClientRect()
    if (!rect) return null
    if (!rect.width || !rect.height) return null
    const screen = app?.app?.screen
    const width = Number(screen?.width) || 420
    const height = Number(screen?.height) || 610
    return {
      x: Math.max(0, Math.min(width, (event.clientX - rect.left) / rect.width * width)),
      y: Math.max(0, Math.min(height, (event.clientY - rect.top) / rect.height * height)),
    }
  }

  function centerFocus() {
    if (!ready.value || typeof model?.focus !== 'function') return
    const screen = app?.app?.screen
    model.focus((Number(screen?.width) || 420) / 2, (Number(screen?.height) || 610) / 2)
  }

  function motionDefinitions(): Record<string, unknown[]> {
    return model?.internalModel?.motionManager?.definitions
      ?? model?.internalModel?.settings?.motions
      ?? {}
  }

  function playInteraction(hitAreas: string[] = [], forcedExpression = '') {
    if (!ready.value || !model?.visible || prefersReducedMotion() || mouthValue.value > 0) return
    const groups = motionDefinitions()
    const groupNames = Object.keys(groups)
    const hitHead = hitAreas.some(name => /head|头/i.test(name))
    const tapGroup = hitHead
      ? groupNames.find(name => /tap.*head|head.*tap|摸头/i.test(name))
      : undefined
    const group = tapGroup || groupNames.find(name => name.toLowerCase() === 'idle')
    const motions = group ? groups[group] : null
    if (group && motions?.length && typeof model.motion === 'function') {
      const index = tapGroup ? undefined : interactionIndex % motions.length
      const result = model.motion(group, index, 3)
      if (isCatchable(result)) result.catch(() => {})
    }

    const reactions = ['happy', 'shy', 'gentle']
    applyExpression(forcedExpression || reactions[interactionIndex % reactions.length])
    interactionIndex += 1
    clearTimeout(expressionTimer)
    expressionTimer = window.setTimeout(() => applyExpression(desiredExpression), 1800)
    stageEl?.classList.remove('live2d-reacting')
    void stageEl?.offsetWidth
    stageEl?.classList.add('live2d-reacting')
  }

  function interact(kind: 'greet' | 'head' = 'greet') {
    if (kind === 'head') {
      playInteraction(['Head'], 'shy')
      interactionHint.value = '她有点害羞，但没有躲开。'
    } else {
      playInteraction([], 'happy')
      interactionHint.value = '她注意到你了，轻轻回应了一下。'
    }
    window.setTimeout(() => {
      if (ready.value) interactionHint.value = '移动指针，她会看向你 · 也可以使用下方互动按钮'
    }, 2400)
  }

  function bindInteractionEvents() {
    if (!stageEl || pointerMoveHandler) return
    interactionHint.value = '移动指针，她会看向你 · 也可以使用下方互动按钮'
    pointerMoveHandler = (event) => {
      if (event.pointerType === 'touch' || !ready.value || prefersReducedMotion()) return
      focusPoint = worldPoint(event)
      if (!focusPoint || focusFrame) return
      focusFrame = window.requestAnimationFrame(() => {
        focusFrame = 0
        if (focusPoint && typeof model?.focus === 'function') model.focus(focusPoint.x, focusPoint.y)
      })
    }
    pointerLeaveHandler = () => {
      focusPoint = null
      if (focusFrame) cancelAnimationFrame(focusFrame)
      focusFrame = 0
      centerFocus()
    }
    pointerClickHandler = (event) => {
      if ((event.target as HTMLElement | null)?.closest('button, a, input, select, textarea')) return
      const point = worldPoint(event)
      const hitAreas = model?.internalModel?.settings?.hitAreas
      const hits = point && typeof model?.hitTest === 'function' ? model.hitTest(point.x, point.y) : []
      if (point && Array.isArray(hitAreas) && hitAreas.length && typeof model?.tap === 'function') {
        model.tap(point.x, point.y)
      }
      playInteraction(Array.isArray(hits) ? hits : [])
    }
    stageEl.addEventListener('pointermove', pointerMoveHandler)
    stageEl.addEventListener('pointerleave', pointerLeaveHandler)
    stageEl.addEventListener('click', pointerClickHandler)
  }

  function fit() {
    if (!model || !hostEl) return
    try {
      const cvs = hostEl.querySelector('canvas') as HTMLCanvasElement | null
      const sw = cvs && (parseFloat(cvs.style.width) || cvs.width) || 420
      const sh = cvs && (parseFloat(cvs.style.height) || cvs.height) || 610
      const sx = model.scale?.x || 1, sy = model.scale?.y || 1
      const nw = model.width / sx, nh = model.height / sy
      if (!nw || !nh) return
      const scale = Math.min(sw / nw, sh / nh) * 0.99
      model.scale.set(scale); model.x = (sw - nw * scale) / 2; model.y = sh - nh * scale
    } catch (e) { fallback('Live2D 布局失败', errorMessage(e)) }
  }

  function layout() {
    if (!ready.value || document.hidden || !hostEl) return
    try {
      const wrapper = hostEl.firstElementChild as HTMLElement | null
      if (!wrapper) return
      const ws = hostEl.clientWidth / 420, hs = hostEl.clientHeight / 610
      const scale = Math.min(1.08, Math.max(ws, hs) * 1.08)
      wrapper.style.transform = `translateX(-50%) scale(${scale > 0 ? scale : 1})`
      fit()
    } catch {}
  }

  /**
   * 用户要求减少动态效果时不跑待机动作。
   * CSS 的 prefers-reduced-motion 关不掉 WebGL ticker，只能在这里判。
   */
  function prefersReducedMotion(): boolean {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  }

  function resumeRendering() {
    const ticker = app?.app?.ticker
    if (!ticker || document.hidden || prefersReducedMotion()) return
    if (!ticker.started) { ticker.start(); layout() }
  }

  function setPaused(paused: boolean) {
    const ticker = app?.app?.ticker
    if (!ticker) return
    // 减少动态效果：渲染一帧把立绘摆正，然后停住，不做待机循环
    if (paused || prefersReducedMotion()) { if (ticker.started) ticker.stop(); return }
    resumeRendering()
  }

  function setVisible(value: boolean) {
    const visible = Boolean(value && ready.value && loadedCharacter.value === character.value)
    stageEl?.classList.toggle('live2d-ready', visible)
    if (model) model.visible = visible
  }

  function applyExpression(emotion: string) {
    if (!ready.value || !model?.visible) return
    const name = LIVE2D_EXPRESSIONS[emotion] || LIVE2D_EXPRESSIONS.neutral
    try {
      const result = typeof model.expression === 'function' ? model.expression(name) : null
      if (isCatchable(result)) {
        result.catch((error: unknown) => {
          setState('degraded', 'Live2D 表情暂不可用', errorMessage(error), true)
        })
      }
    } catch (error) {
      setState('degraded', 'Live2D 表情暂不可用', errorMessage(error), true)
    }
    resumeRendering()
  }

  function setExpression(emotion: string) {
    clearTimeout(expressionTimer)
    desiredExpression = emotion || 'neutral'
    applyExpression(desiredExpression)
  }

  function setMouth(value: number) {
    mouthValue.value = Math.max(0, Math.min(1, Number(value) || 0))
    // Do not depend solely on the internal event emitter. Some Cubism builds
    // skip it for a frame after an expression change, which made speech look
    // frozen even while the audio analyser was producing amplitudes.
    applyMouth()
    if (mouthValue.value > 0) resumeRendering()
  }

  // 表情和口型都依赖 Pixi ticker。某些 Cubism 模型在切换表情后会停掉 idle
  // motion；语音开始时显式恢复渲染，避免出现“有声音但立绘冻结”。
  function setSpeaking(value: boolean) {
    speaking = value
    if (value) resumeRendering()
    else mouthValue.value = 0
  }

  function fallback(text: string, detail: string) {
    ready.value = false; mouthValue.value = 0; interactionHint.value = ''; setVisible(false)
    setState('fallback', text || '静态立绘', detail || '', true)
  }

  function destroyRuntime() {
    clearTimeout(loadTimer); loadTimer = 0
    clearTimeout(expressionTimer); expressionTimer = 0
    if (focusFrame) cancelAnimationFrame(focusFrame)
    focusFrame = 0; focusPoint = null
    ready.value = false; mouthValue.value = 0; mouthHooked = false; speaking = false; desiredExpression = 'neutral'; model = null
    loadedCharacter.value = ''
    stageEl?.classList.remove('live2d-ready')
    if (app && typeof app.destroy === 'function') { try { app.destroy() } catch {} }
    app = null
    if (hostEl) hostEl.innerHTML = ''
  }

  function destroy() {
    destroyed.value = true; enabled.value = false; destroyRuntime()
    resizeObserver?.disconnect()
    if (onResize) window.removeEventListener('resize', onResize)
    if (visibilityHandler) { document.removeEventListener('visibilitychange', visibilityHandler); visibilityHandler = null }
    if (stageEl && pointerMoveHandler) stageEl.removeEventListener('pointermove', pointerMoveHandler)
    if (stageEl && pointerLeaveHandler) stageEl.removeEventListener('pointerleave', pointerLeaveHandler)
    if (stageEl && pointerClickHandler) stageEl.removeEventListener('click', pointerClickHandler)
    pointerMoveHandler = null; pointerLeaveHandler = null; pointerClickHandler = null
  }

  return {
    ready, enabled, character, loadedCharacter, mouthValue, interactionHint,
    init, enable, disable, setCharacter, setMouth, setExpression, setSpeaking,
    setPaused, layout, retry, interact, destroy,
  }
}
