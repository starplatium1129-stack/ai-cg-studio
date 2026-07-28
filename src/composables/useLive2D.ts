import { ref, shallowRef } from 'vue'
import { LIVE2D_EXPRESSIONS } from '@/config/characters'

export interface Live2DStatus {
  state: string
  text: string
  detail: string
  retryable: boolean
  ready: boolean
}

export function useLive2D(onStatus: (s: Live2DStatus) => void = () => {}) {
  const ready = ref(false)
  const destroyed = ref(false)
  const character = ref('nene')
  const loadedCharacter = ref('')
  const mouthValue = ref(0)

  // 内部可变状态（不需要响应式）
  let catalog: any = null
  let app: any = null
  let model: any = null
  let loading: Promise<boolean> | null = null
  let loadTimer = 0
  let resizeObserver: ResizeObserver | null = null
  let onResize: (() => void) | null = null
  let visibilityHandler: (() => void) | null = null
  let mouthHooked = false
  let hostEl: HTMLElement | null = null
  let stageEl: HTMLElement | null = null
  let hostSelector = '#live2dHost'
  let desiredExpression = 'neutral'

  function setState(state: string, text: string, detail = '', retryable = false) {
    if (hostEl) { hostEl.dataset.state = state; hostEl.dataset.error = detail; hostEl.dataset.retryable = retryable ? 'true' : 'false' }
    onStatus({ state, text, detail, retryable, ready: ready.value })
  }

  async function init(char: string, host: HTMLElement, stage: HTMLElement) {
    hostEl = host; stageEl = stage
    // wl-live2d 只接受 CSS selector，这里保证宿主节点有稳定 id 可选中
    if (!hostEl.id) hostEl.id = 'live2dHost'
    hostSelector = '#' + hostEl.id
    character.value = char || character.value
    setState('checking', '检查 Live2D…')
    try {
      const response = await fetch('/api/live2d-status', { cache: 'no-store' })
      if (!response.ok) throw new Error('Live2D 状态接口不可用')
      catalog = await response.json()
      observeSize()
      bindVisibility()
      await setCharacter(character.value)
    } catch (e) {
      fallback('Live2D 未就绪', String((e as any)?.message ?? e))
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
      setState('static', '静态立绘', info?.source || '该角色暂无 Live2D 模型')
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
    destroyRuntime()
    await setCharacter(character.value)
  }

  /**
   * 载入 wl-live2d 运行库。
   * 重构前靠 index.html 的全局 <script> 注入；Vue SPA 没有那段脚本，
   * 所以这里改成动态 import npm 包，并兼容 default / 命名导出 / 全局三种形态。
   */
  async function loadLibrary(): Promise<any> {
    const existing = (window as any)['wl-live2d']
    if (existing && typeof existing.wlLive2d === 'function') return existing
    try {
      const mod: any = await import('wl-live2d')
      const wlLive2d = mod?.wlLive2d ?? mod?.default?.wlLive2d ?? mod?.default
      if (typeof wlLive2d === 'function') {
        const lib = { wlLive2d }
        ;(window as any)['wl-live2d'] = lib
        return lib
      }
      throw new Error('wl-live2d 导出中没有 wlLive2d')
    } catch (e) {
      throw new Error('wl-live2d 运行库导入失败：' + String((e as any)?.message ?? e))
    }
  }

  function load(char: string, info: any): Promise<boolean> {
    if (loading) return loading
    loading = new Promise((resolve) => {
      void (async () => {
      let library: any
      try {
        library = await loadLibrary()
      } catch (e) {
        fallback('Live2D 运行库加载失败', String((e as any)?.message ?? e))
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
        app.onModelLoaded((m: any) => {
          if (destroyed.value || char !== character.value) { finish(false); return }
          model = m; loadedCharacter.value = char; ready.value = true
          mouthValue.value = 0; mouthHooked = false
          bindMouthOverride(); bindContextEvents(); fit(); layout()
          setVisible(true); setExpression(desiredExpression); setPaused(document.hidden); setState('ready', 'Live2D 已连接'); finish(true)
        })
        app.onModelError((e: any) => {
          const detail = String(e?.message ?? e)
          // wl-live2d 复用这一个回调报告初始载入和之后的 expression/motion
          // 错误。后者不代表已经显示的模型失效，不能因此切回静态立绘。
          if (ready.value && loadedCharacter.value === char) {
            setState('degraded', 'Live2D 动作暂不可用', detail, true)
            return
          }
          fallback('Live2D 模型加载失败', detail); finish(false)
        })
      } catch (e) { fallback('Live2D 初始化失败', String((e as any)?.message ?? e)); finish(false) }
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
    if (!model?.visible) return
    try {
      // Cubism motion/physics run before this event. Write with full weight so
      // their idle mouth value cannot overwrite the audio amplitude.
      model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', mouthValue.value, 1)
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
    } catch (e) { fallback('Live2D 布局失败', String((e as any)?.message ?? e)) }
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

  function setExpression(emotion: string) {
    desiredExpression = emotion || 'neutral'
    if (!ready.value || !model?.visible) return
    const name = LIVE2D_EXPRESSIONS[desiredExpression] || LIVE2D_EXPRESSIONS.neutral
    try {
      const result = typeof model.expression === 'function' ? model.expression(name) : null
      if (result && typeof result.catch === 'function') {
        result.catch((error: unknown) => {
          setState('degraded', 'Live2D 表情暂不可用', String((error as any)?.message ?? error), true)
        })
      }
    } catch (error) {
      setState('degraded', 'Live2D 表情暂不可用', String((error as any)?.message ?? error), true)
    }
    resumeRendering()
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
    if (value) resumeRendering()
  }

  function fallback(text: string, detail: string) {
    ready.value = false; mouthValue.value = 0; setVisible(false)
    setState('fallback', text || '静态立绘', detail || '', true)
  }

  function destroyRuntime() {
    clearTimeout(loadTimer); loadTimer = 0
    ready.value = false; mouthValue.value = 0; mouthHooked = false; desiredExpression = 'neutral'; model = null
    loadedCharacter.value = ''
    stageEl?.classList.remove('live2d-ready')
    if (app && typeof app.destroy === 'function') { try { app.destroy() } catch {} }
    app = null
    if (hostEl) hostEl.innerHTML = ''
  }

  function destroy() {
    destroyed.value = true; destroyRuntime()
    resizeObserver?.disconnect()
    if (onResize) window.removeEventListener('resize', onResize)
    if (visibilityHandler) { document.removeEventListener('visibilitychange', visibilityHandler); visibilityHandler = null }
  }

  return { ready, character, loadedCharacter, mouthValue, init, setCharacter, setMouth, setExpression, setSpeaking, setPaused, layout, retry, destroy }
}
