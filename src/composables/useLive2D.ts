import { ref } from 'vue'
import {
  CHARACTERS,
  DEFAULT_LIVE2D_OUTFIT,
  findLive2DOutfit,
  findNatsumeOutfit,
} from '@/config/characters'
import type { EmotionRuntime } from '@/utils/emotionRuntime'
import { createLive2dNativeAdapter } from '@/utils/live2dNativeAdapter'
import { gazeFromClientPoint, gazeSettled, stepGaze } from '@/utils/live2dGaze'
import { createBlinkScheduler } from '@/utils/blinkScheduler'
import { selectLive2DBackend } from '@/live2d/createBackend'
import { NATIVE_RENDER_STOPPED } from '@/live2d/nativeBackend'
import type {
  Live2DBackendKind,
  Live2DModelHandle,
  Live2DStageBackend,
  Live2DStageSession,
} from '@/live2d/types'
import { computeOverlayRect } from '@/utils/live2dOverlayLayout'
import { mediaStatusApi } from '@/api/mediaStatusApi'
import { useCompanionAffection } from '@/composables/useCompanionAffection'

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

export interface Live2DInteraction {
  group: string
  hint: string
  duration: number
}

const INTERACTION_MOTIONS: Record<string, Live2DInteraction> = {
  Hair: { group: 'TapHair', hint: '摸了摸呆毛', duration: 5_000 },
  Head: { group: 'TapHead', hint: '摸了摸头顶', duration: 5_000 },
  Face: { group: 'TapFace', hint: '轻碰了脸颊', duration: 5_000 },
  LeftChest: { group: 'TapLeftChest', hint: '碰到了画面左侧胸前，宁宁有点生气', duration: 3_500 },
  RightChest: { group: 'TapRightChest', hint: '碰到了画面右侧胸前，宁宁有点生气', duration: 3_500 },
  Skirt: { group: 'TapSkirt', hint: '触发了裙摆互动', duration: 9_000 },
  Body: { group: 'TapBody', hint: '轻碰了身体', duration: 5_000 },
}

// 夏目模型（Live2DViewerEX 工坊解包）的互动区：头/手/胸/裙/腿/脚/外框。
// 动作分组已由 natsume-live2d-import.py 重命名为宁宁同款英文名。
const NATSUME_INTERACTIONS: Record<string, Live2DInteraction> = {
  Head: { group: 'TapHead', hint: '摸了摸夏目的头', duration: 11_750 },
  Hand: { group: 'TapHand', hint: '握了握夏目的手', duration: 6_317 },
  Chest: { group: 'TapChest', hint: '夏目微微皱眉，咖啡差点洒了', duration: 6_150 },
  Skirt: { group: 'TapSkirt', hint: '触发了裙摆互动', duration: 7_717 },
  Leg: { group: 'TapLeg', hint: '夏目别开了视线', duration: 5_333 },
  Foot: { group: 'TapFoot', hint: '夏目轻轻缩了缩脚', duration: 6_333 },
  Frame: { group: 'TapFrame', hint: '夏目抬眼看了你一下', duration: 5_633 },
}
// 夏目 model3.json 的 HitAreas 是中文名（解包保留），映射到互动键
const NATSUME_HIT_AREA_MAP: Record<string, string> = {
  外框: 'Frame', 摸腿: 'Leg', 摸头: 'Head', 摸手: 'Hand',
  摸胸: 'Chest', 摸脚: 'Foot', 摸裙子: 'Skirt',
}

// 夏目 model3.json 的 LipSync 组指向 ParamMouthOpenY，但 moc3 实际没有该参数；
// 说话动作（Idle_6 等）用 ParamMouthForm3（-0.5..0）驱动嘴部开合。
const MOUTH_PARAMS: Record<string, { id: string; scale: number }> = {
  nene: { id: 'ParamMouthOpenY', scale: 1 },
  natsume: { id: 'ParamMouthForm3', scale: -0.5 },
}

// 眨眼组与 model3.json 的 Groups.EyeBlink 一致。wl-live2d 的自动眨眼在
// 循环 Idle 运动期间从不触发，且夏目各 Idle 的作者眼曲线左右眼不同步
// （ParamEyeLOpen / ParamEyeLOpen2 长时间一闭一睁）；这里统一由
// blinkScheduler 逐帧覆盖双眼参数，保证同步眨眼。
const BLINK_PARAMS: Record<string, readonly string[]> = {
  nene: ['ParamEyeLOpen', 'ParamEyeROpen'],
  natsume: ['ParamEyeLOpen', 'ParamEyeLOpen2'],
}

// 登场动作：夏目模型加载完成后随机播一个（Live2DViewerEX 原版行为）。
// Start 运动 1.6-4.4s，眼曲线左右眼同步（Start_4 含开场闭眼），登场期间
// 暂停覆盖式眨眼，让作者动画原样呈现。宁宁没有 Start 组，自动降级为 no-op。
const ENTRANCE_GROUP = 'Start'
const ENTRANCE_MAX_MS = 5_200
// 告别动作：关闭 Live2D 时先播一小段 Leave（14s 的"待机最终"），再销毁。
const LEAVE_GROUP = 'Leave'
const LEAVE_PLAY_MS = 5_000

const POINTER_FOCUS_PARAMS = ['ParamAngleX', 'ParamAngleY', 'ParamEyeBallX', 'ParamEyeBallY']

// 夏目互动（Tap*）/登场（Start*）动作驱动、但 Idle 组完全未覆盖的参数
// （2026-08-15 从 motions/Tap*.motion3.json 与 Idle*.motion3.json 曲线差集
// 提取）：互动/登场动作把这些参数拉高（作者叠层/换装部件临时显隐），动作
// 结束后 idle 不带回默认值 → 叠层残留（"衣服重复显示/四只手"，官方 Notes on
// Pose Switching 场景）。动作结束必须显式写回隐藏态。
// 隐藏态按 moc3 默认值分组（2026-08-16 idle 采样实证）：多数叠层参数默认
// -1（隐藏），写 0 会落在"显示区间"导致叠层半透明残留（重影灰眼，用户
// 反馈）；Param18/44-51/56/57/62 默认 0。Param37/Param64 为 2026-08-16
// 补充（Tap 驱动但此前不在清单）。
// 依据：docs/live2d-natsume-overlay-research.md、docs/live2d-native-runtime.md。
const NATSUME_RESET_PARAMS: ReadonlyArray<{ id: string; value: number }> = [
  { id: 'Param18', value: 0 },
  { id: 'Param36', value: 0 },
  { id: 'Param44', value: 0 }, { id: 'Param45', value: 0 }, { id: 'Param46', value: 0 },
  { id: 'Param47', value: 0 }, { id: 'Param48', value: 0 }, { id: 'Param49', value: 0 },
  { id: 'Param50', value: 0 }, { id: 'Param51', value: 0 }, { id: 'Param56', value: 0 },
  { id: 'Param57', value: 0 }, { id: 'Param62', value: 0 },
  { id: 'Param37', value: -1 }, { id: 'Param38', value: -1 }, { id: 'Param39', value: -1 },
  { id: 'Param40', value: -1 }, { id: 'Param41', value: -1 }, { id: 'Param42', value: -1 },
  { id: 'Param43', value: -1 }, { id: 'Param52', value: -1 }, { id: 'Param53', value: -1 },
  { id: 'Param54', value: -1 }, { id: 'Param55', value: -1 }, { id: 'Param58', value: -1 },
  { id: 'Param59', value: -1 }, { id: 'Param60', value: -1 }, { id: 'Param61', value: -1 },
  { id: 'Param63', value: -1 }, { id: 'Param64', value: -1 },
  { id: 'ParamMouthForm5', value: 0 }, { id: 'ParamMouthForm6', value: 0 },
  { id: 'ParamMouthForm7', value: 0 }, { id: 'ParamMouthForm8', value: 0 },
  { id: 'ParamMouthForm9', value: 0 }, { id: 'ParamMouthForm10', value: 0 },
]

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

/**
 * 桌面窗口物理像素 bounds（IPC 注入）。Companion 单窗口，属全局窗口状态：
 * CompanionView 经 ChatCharacterStage.setDesktopWindowBounds 写入，原生
 * overlay 布局据此换算，避免用 screenX/devicePixelRatio 猜测造成错位。
 */
let desktopWindowBounds: { x: number; y: number; width: number; height: number } | null = null

function windowBoundsFromScreen(): { x: number; y: number } {
  // 兜底：screenX/screenY 是 CSS 像素（物理 ÷ DPR），换算回屏幕物理像素
  // 供 overlay 定位（DPR=1 时与窗口坐标一致）。桌面端由注入的
  // desktopWindowBounds 覆盖，此路径只作非桌面/未注入时的退化。
  if (desktopWindowBounds) return desktopWindowBounds
  const dpr = window.devicePixelRatio || 1
  return { x: Math.round((window.screenX || 0) * dpr), y: Math.round((window.screenY || 0) * dpr) }
}

export function useLive2D(onStatus: (s: Live2DStatus) => void = () => {}) {
  const ready = ref(false)
  const enabled = ref(false)
  const destroyed = ref(false)
  const character = ref('nene')
  const loadedCharacter = ref('')
  const mouthValue = ref(0)
  const interactionHint = ref('')
  const outfit = ref<string>(DEFAULT_LIVE2D_OUTFIT)
  const backendKind = ref<Live2DBackendKind>('browser')
  const backendFallback = ref<string | null>(null)

  // 内部可变状态（不需要响应式）
  let catalog: Live2DCatalog | null = null
  let backend: Live2DStageBackend | null = null
  let session: Live2DStageSession | null = null
  let model: Live2DModelHandle | null = null
  let loading: Promise<boolean> | null = null
  let loadTimer = 0
  let resizeObserver: ResizeObserver | null = null
  let onResize: (() => void) | null = null
  let visibilityHandler: (() => void) | null = null
  let pointerClickHandler: ((event: MouseEvent) => void) | null = null
  let pointerGazeHandler: ((event: MouseEvent) => void) | null = null
  let pointerGazeLeaveHandler: (() => void) | null = null
  let pointerGazeX = 0
  let pointerGazeY = 0
  let pointerGazeCurrentX = 0
  let pointerGazeCurrentY = 0
  let pointerGazeActive = false
  let pointerGazeFrame = 0
  let pointerGazeLastFrame = 0
  let pointerGazeFocusKind = 'idle'
  let activeInteraction = ''
  let interactionTimer = 0
  let leaveTimer = 0
  let lifecycleToken = 0
  let entranceUntil = 0
  let mouthHooked = false
  let speaking = false
  let hostEl: HTMLElement | null = null
  let stageEl: HTMLElement | null = null
  let hostSelector = '#live2dHost'
  let emotionRuntime: EmotionRuntime | null = null
  let nativeHitTestUnsubscribe: (() => void) | null = null
  let nativeMotionFailedUnsubscribe: (() => void) | null = null
  const nativeAnimationAdapter = createLive2dNativeAdapter()
  const blinkScheduler = createBlinkScheduler()
  const emotionCurrent: Record<string, number> = {}
  let lastParamFrame = 0
  let maxFps = 60
  let nativeOverlayReady = false
  let nativeLayoutFrame = 0
  let nativeLayoutAttempts = 0
  let nativeEmotionFrame = 0
  let nativeEmotionLastFrame = 0

  function setState(state: Live2DStatus['state'], text: string, detail = '', retryable = false) {
    if (hostEl) { hostEl.dataset.state = state; hostEl.dataset.error = detail; hostEl.dataset.retryable = retryable ? 'true' : 'false' }
    onStatus({ state, text, detail, retryable, ready: ready.value })
  }

  async function init(
    char: string,
    host: HTMLElement,
    stage: HTMLElement,
    options: { autoLoad?: boolean; outfit?: string; backendKind?: Live2DBackendKind } = {},
  ) {
    hostEl = host; stageEl = stage
    // wl-live2d 只接受 CSS selector，这里保证宿主节点有稳定 id 可选中
    if (!hostEl.id) hostEl.id = 'live2dHost'
    hostSelector = '#' + hostEl.id
    character.value = char || character.value
    bindPointerGaze()
    outfit.value = char === 'natsume'
      ? findNatsumeOutfit(options.outfit || outfit.value).id
      : findLive2DOutfit(options.outfit || outfit.value).id
    setState('checking', '检查 Live2D…')
    try {
      catalog = readLive2DCatalog(await mediaStatusApi.getLive2DStatus())
      const selection = selectLive2DBackend(options.backendKind)
      backend = selection.backend
      backendKind.value = selection.effectiveKind
      backendFallback.value = selection.fallbackReason
      if (backendFallback.value) {
        if (hostEl) hostEl.dataset.backend = 'browser-fallback'
        console.warn('[live2d]', backendFallback.value)
      } else if (hostEl) {
        hostEl.dataset.backend = selection.effectiveKind
      }
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
    // A character switch can happen while the previous model is still loading.
    // Wait for that request to settle, then retry the character that is still
    // selected instead of returning the obsolete request's result.
    if (loading) await loading
    if (destroyed.value || !enabled.value || char !== character.value) return
    if (ready.value && loadedCharacter.value === char) {
      setVisible(true); setState('ready', 'Live2D 已连接')
      setPaused(document.hidden); layout(); return
    }
    await load(char, info)
  }

  async function retry() {
    if (destroyed.value) return
    if (loading) return loading
    if (!enabled.value) return enable()
    destroyRuntime()
    await setCharacter(character.value)
  }

  async function enable() {
    if (destroyed.value) return false
    lifecycleToken += 1
    clearTimeout(leaveTimer)
    leaveTimer = 0
    enabled.value = true
    return setCharacter(character.value)
  }

  function disable() {
    const token = ++lifecycleToken
    enabled.value = false
    interactionHint.value = ''
    // 告别动作：先播一小段 Leave 再销毁，避免"切换回静态立绘"瞬间硬切。
    // 减少动态效果或动作不可用时直接销毁；告别期间再次点击可立即重载。
    const playable = ready.value && model && typeof model.motion === 'function' && !prefersReducedMotion()
      ? model.motion(LEAVE_GROUP, undefined, 3)
      : null
    const started = isCatchable(playable) ? playable.then((v: unknown) => v === true).catch(() => false) : Promise.resolve(playable === true)
    void started.then((ok: boolean) => {
      if (token !== lifecycleToken || enabled.value) return
      if (!ok) {
        destroyRuntime()
        setState('idle', '启用 Live2D', '动态模型已释放；点击可重新加载', true)
        return
      }
      resumeRendering()
      setState('idle', '正在道别…', '播放告别动作后释放资源', false)
      clearTimeout(leaveTimer)
      leaveTimer = window.setTimeout(() => {
        if (token !== lifecycleToken || enabled.value) return
        destroyRuntime()
        setState('idle', '启用 Live2D', '动态模型已释放；点击可重新加载', true)
      }, LEAVE_PLAY_MS)
    })
  }

  function load(char: string, info: Live2DModelInfo): Promise<boolean> {
    if (loading) return loading
    if (!backend) return Promise.resolve(false)
    loading = new Promise((resolve) => {
      void (async () => {
        // 先停旧会话并清空宿主：wl-live2d 在 connect 时向 hostEl 创建 canvas，
        // 顺序反了会把刚创建的 canvas 一起清掉。库加载失败时旧模型也随之
        // 销毁并进入 fallback（原实现残留旧模型的行为不一致，一并修正）。
        destroyRuntime()
        if (hostEl) hostEl.innerHTML = ''
        // 加载状态必须在 connect 之前显示：原生后端 setCharacter 在渲染线程
        // 加载模型与纹理可能耗时数秒，期间 UI 线程保持空闲，loading 立即可见。
        setState('loading', 'Live2D 加载中…')
        let nextSession: Live2DStageSession
        try {
          nextSession = await backend!.connect({
            selector: hostSelector,
            modelUrl: info.modelUrl,
            canvasWidth: info.canvas?.width || 420,
            canvasHeight: info.canvas?.height || 610,
            character: char,
          })
        } catch (e) {
          const message = errorMessage(e)
          // 原生 IPC、GPU 或模型初始化任一步失败，都回退浏览器后端再试一次。
          if (backendKind.value === 'native' && backend?.kind === 'native') {
            const selection = selectLive2DBackend('browser')
            backend = selection.backend
            backendKind.value = 'browser'
            backendFallback.value = `原生 Live2D 初始化失败，已回退到浏览器渲染：${message}`
            if (hostEl) hostEl.dataset.backend = 'browser-fallback'
            console.warn('[live2d]', backendFallback.value)
            try {
              nextSession = await backend!.connect({
                selector: hostSelector,
                modelUrl: info.modelUrl,
                canvasWidth: info.canvas?.width || 420,
                canvasHeight: info.canvas?.height || 610,
                character: char,
              })
            } catch (e2) {
              fallback('Live2D 初始化失败', errorMessage(e2))
              loading = null
              resolve(false); return
            }
          } else {
            fallback('Live2D 初始化失败', message)
            loading = null
            resolve(false); return
          }
        }
        if (destroyed.value || char !== character.value) {
          nextSession.destroy()
          loading = null
          resolve(false); return
        }
        session = nextSession
        const nativeCapability = session.kind === 'native' ? session.capability : null
        let settled = false
        const finish = (v: boolean) => {
          if (settled) return; settled = true
          clearTimeout(loadTimer); loading = null; resolve(v)
        }
        loadTimer = window.setTimeout(() => { fallback('Live2D 加载超时', '模型在 20 秒内没有完成初始化'); finish(false) }, 20000)
        session.onModelLoaded((m: Live2DModelHandle) => {
          if (destroyed.value || char !== character.value) { finish(false); return }
          model = m; loadedCharacter.value = char; ready.value = true
          mouthValue.value = 0; mouthHooked = false
          bindMouthOverride(); bindContextEvents(); bindInteractionEvents(); fit(); scheduleNativeLayout()
          setVisible(true); setPaused(document.hidden); setState('ready', 'Live2D 已连接')
          startNativeEmotionClock()
          if (!nativeCapability?.entranceNative) playEntrance()
          void setOutfit(outfit.value)
          finish(true)
        })
        session.onModelError((e: Error) => {
          const detail = errorMessage(e)
          // 原生渲染线程停止：overlay 已销毁，模型不可用，必须提示并允许
          // 重试重新拉起线程（与"动作/换装失败但模型仍显示"的退化不同）。
          if (e.name === NATIVE_RENDER_STOPPED) {
            setState('degraded', 'Live2D 渲染已停止', detail, true)
            return
          }
          // wl-live2d 复用这一个回调报告初始载入和之后的 outfit/motion
          // 错误。后者不代表已经显示的模型失效，不能因此切回静态立绘。
          if (ready.value && loadedCharacter.value === char) {
            setState('degraded', 'Live2D 动作或换装暂不可用', detail, true)
            return
          }
          fallback('Live2D 模型加载失败', detail); finish(false)
        })
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

  function playEntrance() {
    if (prefersReducedMotion()) return
    if (!model) return
    const motionFn = model.motion
    if (typeof motionFn !== 'function') return
    // 浏览器路径：从 wl-live2d 的 motionManager.definitions 探测 Start 组
    // （原生后端由 Rust 接管入场动作，不会走到这里）。
    if (!(model.hasMotionGroup?.(ENTRANCE_GROUP) ?? false)) return
    // 模型刚加载完成时 Start 组的动作可能还在预加载，startRandomMotion 会
    // 因组内全部未就绪直接返回 false；这里重试直到登场动作真正启动。
    let attempts = 0
    const tryStart = () => {
      if (attempts++ > 40 || destroyed.value || !model) return
      const result = motionFn.call(model, ENTRANCE_GROUP, undefined, 2)
      const started = isCatchable(result)
        ? result.then((v: unknown) => v === true).catch(() => false)
        : Promise.resolve(result === true)
      void started.then((ok: boolean) => {
        if (ok) {
          entranceUntil = performance.now() + ENTRANCE_MAX_MS
          // 登场动作结束（含最长 fadeOut）后复位叠层参数：Start* 变体也会
          // 驱动叠层显隐，结束后 idle 不带回（2026-08-16 实测 Start_1 等
          // 把 Param38 等从 0 拉高，结束后残留 → 半透明重影）。
          window.setTimeout(() => resetNatsumeOverlayParams(), ENTRANCE_MAX_MS + 400)
          return
        }
        window.setTimeout(tryStart, 250)
      })
    }
    tryStart()
  }

  function bindMouthOverride() {
    if (!model || mouthHooked) return
    // 原生后端：参数由作者工程执行，不需要 beforeModelUpdate 钩子
    if (session?.capability.parameterOverride === false) return
    mouthHooked = true
    model.onBeforeModelUpdate(applyParameters)
  }

  function attachEmotionRuntime(runtime: EmotionRuntime | null) {
    emotionRuntime = runtime
    nativeAnimationAdapter.reset()
    for (const key of Object.keys(emotionCurrent)) delete emotionCurrent[key]
    lastParamFrame = 0
  }

  function sendNativeEmotionIntent() {
    if (session?.capability.emotionChannel !== 'bridge' || !emotionRuntime) return
    session.sendEmotion?.(emotionRuntime.lastEmotion(), emotionRuntime.intensity())
  }

  function stopNativeEmotionClock() {
    if (nativeEmotionFrame) window.cancelAnimationFrame(nativeEmotionFrame)
    nativeEmotionFrame = 0
    nativeEmotionLastFrame = 0
  }

  function nativeEmotionTick(now: number) {
    nativeEmotionFrame = 0
    if (
      destroyed.value
      || document.hidden
      || !model?.visible
      || session?.capability.emotionChannel !== 'bridge'
    ) return
    const dt = Math.min(0.12, (now - nativeEmotionLastFrame) / 1000 || 1 / 60)
    nativeEmotionLastFrame = now
    emotionRuntime?.update(dt)
    if (stageEl && emotionRuntime) stageEl.dataset.emotionIntensity = emotionRuntime.intensity().toFixed(3)
    sendNativeEmotionIntent()
    nativeEmotionFrame = window.requestAnimationFrame(nativeEmotionTick)
  }

  function startNativeEmotionClock() {
    if (session?.capability.emotionChannel !== 'bridge' || nativeEmotionFrame || document.hidden) return
    nativeEmotionLastFrame = performance.now()
    nativeEmotionFrame = window.requestAnimationFrame(nativeEmotionTick)
  }

  function applyParameters() {
    if (!model?.visible) return
    const now = performance.now()
    const dt = Math.min(0.12, (now - lastParamFrame) / 1000 || 1 / 60)
    lastParamFrame = now
    if (session?.capability.parameterOverride === false) {
      // 原生后端：只传口型意图，参数级写入由 Cubism Native 按作者工程执行。
      // blinkScheduler / MOUTH_PARAMS 参数 hack 全部退役。情绪推进只有一个
      // 时钟（nativeEmotionTick 的 requestAnimationFrame），口型回调不得再次
      // update emotionRuntime，否则同一帧会被推进两次。
      if (speaking) session.sendMouthLevel?.(mouthValue.value)
      if (stageEl) stageEl.dataset.blink = '1.000'
      return
    }
    try {
      // Cubism motion/physics run before this event. Write with full weight so
      // their idle values cannot overwrite the audio amplitude or emotion.
      if (speaking) {
        const mouth = MOUTH_PARAMS[character.value] ?? MOUTH_PARAMS.nene
        model.setParameterValueById(mouth.id, mouthValue.value * mouth.scale, 1)
      }
      // 覆盖式眨眼：双眼参数永远写同一个值（1=睁、0=闭），修掉作者眼曲线
      // 左右眼不同步造成的"单眼 Wink"，并保证定时眨眼（见 blinkScheduler）。
      // 登场动作（Start 组）期间暂停覆盖：其眼曲线左右同步（含开场闭眼），
      // 让作者动画原样呈现。
      const inEntrance = now < entranceUntil
      if (inEntrance) {
        if (stageEl) stageEl.dataset.blink = '1.000'
      } else {
        const blinkValue = blinkScheduler.update(dt)
        const blinkIds = BLINK_PARAMS[character.value]
        if (blinkIds) {
          for (const id of blinkIds) model.setParameterValueById(id, blinkValue, 1)
        }
        if (stageEl) stageEl.dataset.blink = blinkValue.toFixed(3)
      }
      if (stageEl) stageEl.dataset.entrance = inEntrance ? '1' : '0'
      // 叠层参数守卫（2026-08-16 静止发灰修复）：Idle 动作 Idle_6 会把
      // Param36/37 拉出隐藏态（到 5+），静止时叠层显示 → 眼睛/全身发灰；
      // 互动（Tap）或登场（Start）播放期间让动作曲线驱动叠层（设计行为），
      // 其余时间每帧写回隐藏态（0/-1 分组，与 resetNatsumeOverlayParams
      // 同表）——与 native 端 force_overlay_hidden 行为一致。
      const interactionPlaying = activeInteraction !== ''
      if (!inEntrance && !interactionPlaying && character.value === 'natsume') {
        for (const { id, value } of NATSUME_RESET_PARAMS) {
          try { model.setParameterValueById(id, value, 1) } catch { /* 参数缺失忽略 */ }
        }
      }
      if (!emotionRuntime) return
      emotionRuntime.update(dt)
      if (stageEl) stageEl.dataset.emotionIntensity = emotionRuntime.intensity().toFixed(3)
      const frame = emotionRuntime.performanceFrame()
      if (!prefersReducedMotion()) {
        void nativeAnimationAdapter.apply(frame.nativeAnimation, model, character.value)
      }
      const targets = { ...frame.live2dParams, ...emotionRuntime.targets() }
      for (const id of nativeAnimationAdapter.activeSuppressedParamIds()) {
        delete targets[id]
        delete emotionCurrent[id]
      }
      if (typeof model.focus === 'function') {
        // pixi-live2d-display already maps focus to the model's authored eye
        // and head parameters. Do not overwrite those values with SoulLink.
        if (pointerGazeActive) {
          for (const id of POINTER_FOCUS_PARAMS) {
            delete targets[id]
            delete emotionCurrent[id]
          }
        }
      } else {
        // Keep a parameter fallback for runtimes without the native focus API.
        if (pointerGazeActive || Math.abs(pointerGazeCurrentX) > 0.01 || Math.abs(pointerGazeCurrentY) > 0.01) {
          targets.ParamEyeBallX = pointerGazeCurrentX
          targets.ParamEyeBallY = pointerGazeCurrentY
        }
      }
      for (const [id, target] of Object.entries(targets)) {
        const current = emotionCurrent[id] ?? 0
        const next = current + (target - current) * Math.min(1, dt * 6)
        emotionCurrent[id] = next
        model.setParameterValueById(id, next, 1)
      }
      // 归零的参数交还给 idle 动作，避免表情参数常驻覆写把待机动画压死
      for (const id of Object.keys(emotionCurrent)) {
        if (targets[id] === 0 && Math.abs(emotionCurrent[id]) < 0.004) {
          delete emotionCurrent[id]
        }
      }
    } catch {}
  }

  function bindContextEvents() {
    if (!hostEl) return
    const cvs = session?.canvasElement?.() as HTMLCanvasElement | null
    if (!cvs || cvs.dataset.contextEvents === '1') return
    cvs.dataset.contextEvents = '1'
    cvs.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      // 销毁/卸载阶段（disable、角色切换）移除 canvas 也会触发该事件，
      // 此时模型已经下线，不能再用"图形上下文已暂停"覆盖退出提示。
      if (!ready.value || !model) return
      fallback('Live2D 图形上下文已暂停', 'WebGL context lost')
    })
    cvs.addEventListener('webglcontextrestored', () => retry())
  }

  function bindPointerGaze() {
    if (!stageEl || pointerGazeHandler) return
    pointerGazeHandler = (event) => {
      const rect = stageEl?.getBoundingClientRect()
      if (!rect?.width || !rect.height) return
      const target = gazeFromClientPoint(event.clientX, event.clientY, rect)
      pointerGazeX = target.x
      pointerGazeY = target.y
      pointerGazeActive = true
      const focus = model?.focus
      pointerGazeFocusKind = focus ? 'native' : 'fallback'
      schedulePointerGaze()
    }
    pointerGazeLeaveHandler = releasePointerFocus
    stageEl.addEventListener('mousemove', pointerGazeHandler)
    stageEl.addEventListener('mouseleave', pointerGazeLeaveHandler)
  }

  function schedulePointerGaze() {
    if (pointerGazeFrame || !ready.value || !model) return
    pointerGazeLastFrame = performance.now()
    pointerGazeFrame = window.requestAnimationFrame(runPointerGazeFrame)
  }

  function runPointerGazeFrame(now: number) {
    pointerGazeFrame = 0
    if (!ready.value || !model || destroyed.value) return
    const dt = Math.max(1 / 240, Math.min(0.05, (now - pointerGazeLastFrame) / 1000))
    pointerGazeLastFrame = now
    const next = stepGaze(
      { x: pointerGazeCurrentX, y: pointerGazeCurrentY },
      { x: pointerGazeX, y: pointerGazeY },
      dt,
      pointerGazeActive ? 12 : 6,
    )
    pointerGazeCurrentX = next.x
    pointerGazeCurrentY = next.y
    const focus = model.focus
    if (focus) {
      const screen = session?.getScreenSize() ?? { width: 420, height: 610 }
      focus.call(
        model,
        (pointerGazeCurrentX + 1) * 0.5 * screen.width,
        (1 - pointerGazeCurrentY) * 0.5 * screen.height,
      )
    }
    session?.sendGaze?.(pointerGazeCurrentX, pointerGazeCurrentY)
    if (stageEl) {
      stageEl.dataset.pointerFocus = pointerGazeActive ? pointerGazeFocusKind : 'idle'
      stageEl.dataset.pointerGazeX = pointerGazeCurrentX.toFixed(3)
      stageEl.dataset.pointerGazeY = pointerGazeCurrentY.toFixed(3)
    }
    const settled = gazeSettled(
      { x: pointerGazeCurrentX, y: pointerGazeCurrentY },
      { x: pointerGazeX, y: pointerGazeY },
    )
    if (settled) {
      pointerGazeCurrentX = pointerGazeX
      pointerGazeCurrentY = pointerGazeY
      return
    }
    pointerGazeFrame = window.requestAnimationFrame(runPointerGazeFrame)
  }

  function releasePointerFocus() {
    pointerGazeActive = false
    pointerGazeX = 0
    pointerGazeY = 0
    pointerGazeFocusKind = 'idle'
    if (stageEl) stageEl.dataset.pointerFocus = 'idle'
    schedulePointerGaze()
  }

  function worldPoint(event: MouseEvent) {
    const canvas = session?.canvasElement?.() as HTMLCanvasElement | null
    const rect = canvas?.getBoundingClientRect() ?? stageEl?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return null
    const screen = session?.getScreenSize() ?? { width: 420, height: 610 }
    return {
      x: Math.max(0, Math.min(screen.width, (event.clientX - rect.left) / rect.width * screen.width)),
      y: Math.max(0, Math.min(screen.height, (event.clientY - rect.top) / rect.height * screen.height)),
    }
  }

  /**
   * 全局目光凝视（桌面悬浮窗外）：主进程轮询屏幕鼠标坐标并经 IPC 送达。
   * 与窗口内 DOM 逻辑共用同一套归一化与 focus 坐标变换；窗口内更新由
   * DOM 事件负责（更平滑），这里只处理鼠标在窗口外的时刻。
   */
  function setGlobalPointer(screenX: number, screenY: number, windowBounds: { x: number; y: number; width: number; height: number }): void {
    if (!ready.value || !model) return
    const rect = stageEl?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return
    // 无边框窗口的 bounds 即内容区在屏幕上的位置：clientX = 屏幕坐标 − bounds
    const clientX = screenX - windowBounds.x
    const clientY = screenY - windowBounds.y
    const target = gazeFromClientPoint(clientX, clientY, rect, 0.82)
    pointerGazeX = target.x
    pointerGazeY = target.y
    pointerGazeActive = true
    pointerGazeFocusKind = 'global'
    schedulePointerGaze()
  }

  function interactionFromStagePosition(event: MouseEvent): Live2DInteraction | null {
    const rect = stageEl?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return null
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    // 夏目：坐姿咖啡馆系模型，按 头/手/胸/裙/腿/脚 分区
    if (character.value === 'natsume') {
      if (y < 0.14) return NATSUME_INTERACTIONS.Head
      if (y < 0.26) return NATSUME_INTERACTIONS.Hand
      if (y < 0.38) return NATSUME_INTERACTIONS.Chest
      if (y < 0.55) return NATSUME_INTERACTIONS.Skirt
      if (y < 0.72) return NATSUME_INTERACTIONS.Leg
      return NATSUME_INTERACTIONS.Foot
    }
    // These zones follow the full visible model after the canvas is fitted
    // into the stage: face, chest, skirt, then exposed legs/body.
    if (y < 0.12) return INTERACTION_MOTIONS.Hair
    if (y < 0.19) return INTERACTION_MOTIONS.Head
    if (y < 0.29) return INTERACTION_MOTIONS.Face
    // Chest motions are intentional, reactive source motions. Keep their
    // hit bands tight so shoulder, arm, waist and ordinary body taps do not
    // accidentally invoke them.
    if (y >= 0.29 && y < 0.42 && x >= 0.40 && x < 0.50) return INTERACTION_MOTIONS.LeftChest
    if (y >= 0.29 && y < 0.42 && x >= 0.50 && x <= 0.60) return INTERACTION_MOTIONS.RightChest
    if (y >= 0.42 && y < 0.57) return INTERACTION_MOTIONS.Skirt
    return INTERACTION_MOTIONS.Body
  }

  function interactionAt(event: MouseEvent): Live2DInteraction {
    // The wl-live2d canvas is scaled and positioned inside the portrait card,
    // so its hitTest coordinates do not line up with the visible DOM stage.
    // Use the measured stage bands for user-facing semantics.
    const stageInteraction = interactionFromStagePosition(event)
    if (stageInteraction) return stageInteraction
    // wl-live2d sometimes reports the broad body mesh for every DOM click;
    // retain the measured hit areas only as a last-resort fallback.
    const point = worldPoint(event)
    const hitAreas = point && typeof model?.hitTest === 'function'
      ? model.hitTest(point.x, point.y)
      : []
    const interaction = hitAreas
      .map(area => (character.value === 'natsume' ? NATSUME_HIT_AREA_MAP[area] : area))
      .map(area => (character.value === 'natsume' ? NATSUME_INTERACTIONS[area] : INTERACTION_MOTIONS[area]))
      .find((item): item is Live2DInteraction => Boolean(item))
    if (interaction) return interaction
    return character.value === 'natsume' ? NATSUME_INTERACTIONS.Head : INTERACTION_MOTIONS.Head
  }

  /** 原生路径：Cubism 原生 HitArea 命中（作者分区）→ 互动动作 */
  function interactionFromHitAreas(areas: string[]): Live2DInteraction | null {
    // 夏目的"外框"是环绕角色的矩形命中区，与头/手/胸/裙/腿/脚分区重叠，
    // 且 model3.json HitAreas 顺序排第一——直接取首个会让所有点击都变成
    // "抬眼"反应（2026-08-16 实机：头/手/裙/腿点击全部命中外框）。
    // 具体分区优先，外框只在没有其他分区命中时兜底（点到角色外的框空白处）。
    const ordered = character.value === 'natsume'
      ? [...areas.filter(area => area !== '外框'), ...areas.filter(area => area === '外框')]
      : areas
    return ordered
      .map(area => (character.value === 'natsume' ? NATSUME_HIT_AREA_MAP[area] : area))
      .map(area => (character.value === 'natsume' ? NATSUME_INTERACTIONS[area] : INTERACTION_MOTIONS[area]))
      .find((item): item is Live2DInteraction => Boolean(item)) ?? null
  }

  function markInteractionStarted(interaction: Live2DInteraction, customText?: string) {
    activeInteraction = interaction.group
    clearTimeout(interactionTimer)
    interactionTimer = window.setTimeout(() => {
      if (activeInteraction === interaction.group) {
        activeInteraction = ''
        resetNatsumeOverlayParams()
      }
    }, interaction.duration + 600)
    interactionHint.value = customText || interaction.hint
    setState('ready', 'Live2D 已连接')
    stageEl?.classList.remove('live2d-reacting')
    void stageEl?.offsetWidth
    stageEl?.classList.add('live2d-reacting')
  }

  /**
   * 夏目互动/登场动作结束后复位叠层/换装参数（见 NATSUME_RESET_PARAMS）。
   * 浏览器端参数由前端写（parameterOverride）；原生端由 Rust 在 motion
   * 结束后经 C++ 复位，前端不重复写。幂等：参数已是隐藏态时重复写无副作用。
   * 复位值按隐藏态分组（0 / -1，2026-08-16 实证），统一写 0 会让 -1 组的
   * 参数落在"显示区间"，叠层半透明残留成重影。
   */
  function resetNatsumeOverlayParams() {
    if (character.value !== 'natsume' || !model || session?.capability.parameterOverride === false) return
    for (const { id, value } of NATSUME_RESET_PARAMS) {
      try { model.setParameterValueById(id, value, 1) } catch { /* 参数缺失忽略 */ }
    }
  }

  function interactionFailed(interaction: Live2DInteraction) {
    if (activeInteraction === interaction.group) {
      interactionHint.value = '这个动作正在进行中'
      return
    }
    interactionHint.value = '动作没有启动，请重试'
    setState('degraded', 'Live2D 动作未启动', `未能启动 ${interaction.group}`, true)
  }

  function playInteraction(interaction: Live2DInteraction) {
    if (!ready.value || !model?.visible || prefersReducedMotion() || mouthValue.value > 0) return
    // pixi-live2d-display uses the third argument as motion priority. Passing
    // null is treated as MotionPriority.NONE, which silently rejects the
    // motion while still letting the click hint update. FORCE interrupts idle
    // motion so a deliberate tap is always visible. We do not ship source WAVs;
    // this API does not need one for an authored motion to play.
    resumeRendering()
    if (typeof model.motion !== 'function') {
      interactionFailed(interaction)
      return
    }
    // 结合好感度调度系统按规则选择动作索引，并获取原装台词与加分反馈
    const affection = useCompanionAffection()
    const dispatched = affection.dispatchInteractiveMotion(character.value, interaction.group)
    const motionIndex = dispatched.index
    const customText = dispatched.entry?.text
      ? `“${dispatched.entry.text}”${dispatched.bonusAwarded ? ` (好感度+${dispatched.bonusAwarded})` : ''}`
      : interaction.hint

    const result = model.motion(interaction.group, motionIndex, 3)
    if (isCatchable(result)) {
      result.then((started: unknown) => {
        if (started === true) markInteractionStarted(interaction, customText)
        else interactionFailed(interaction)
      }).catch((error: unknown) => {
        interactionHint.value = '动作暂时不可用，请重试'
        setState('degraded', 'Live2D 动作暂不可用', errorMessage(error), true)
      })
      return
    }
    if (result === true) markInteractionStarted(interaction, customText)
    else interactionFailed(interaction)
  }

  function bindInteractionEvents() {
    if (!stageEl) return
    // 幂等重建：角色切换/重载会重建 session（onModelLoaded 再次进入），旧的
    // click 监听与 native 订阅必须解绑后重建，否则新 session 的 hit-test 回调
    // 无人接收（点击无任何反馈，2026-08-16 用户反馈"切换角色后无法点击"）。
    if (pointerClickHandler) {
      stageEl.removeEventListener('click', pointerClickHandler)
      pointerClickHandler = null
    }
    if (nativeHitTestUnsubscribe) { nativeHitTestUnsubscribe(); nativeHitTestUnsubscribe = null }
    if (nativeMotionFailedUnsubscribe) { nativeMotionFailedUnsubscribe(); nativeMotionFailedUnsubscribe = null }
    interactionHint.value = character.value === 'natsume'
      ? '移动鼠标可跟随视线；点击头部、手、胸前、裙子、腿或脚可互动'
      : '移动鼠标可跟随视线；点击呆毛、头部、脸、身体、两侧或裙摆可互动'
    // 原生 overlay 位于透明 WebView 下方且不接收鼠标。舞台 DOM 保持完整交互，
    // 点击坐标归一化后交给 Rust 做 Cubism 原生 HitArea 命中。
    if (session?.capability.hitTestNative) {
      nativeHitTestUnsubscribe = session.onNativeHitTest?.((areas) => {
        const interaction = interactionFromHitAreas(areas)
        if (interaction) playInteraction(interaction)
      }) ?? null
      // 同一互动播放中重复点击：Rust 拒绝并回传 motion-failed，这里直接
      // 显示"动作进行中"（Rust 状态为准，前端 duration 计时可能已过期）。
      nativeMotionFailedUnsubscribe = session.onMotionFailed?.((info) => {
        if (/already playing/.test(info.reason)) {
          interactionHint.value = '这个动作正在进行中'
        }
      }) ?? null
      pointerClickHandler = (event) => {
        if ((event.target as HTMLElement | null)?.closest('button, a, input, select, textarea')) return
        const rect = stageEl?.getBoundingClientRect()
        if (!rect?.width || !rect.height) return
        model?.hitTest(
          Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        )
      }
      stageEl.addEventListener('click', pointerClickHandler)
      return
    }
    pointerClickHandler = (event) => {
      if ((event.target as HTMLElement | null)?.closest('button, a, input, select, textarea')) return
      playInteraction(interactionAt(event))
    }
    stageEl.addEventListener('click', pointerClickHandler)
  }

  function fit() {
    if (!model || !hostEl) return
    try {
      const cvs = session?.canvasElement?.() as HTMLCanvasElement | null
      const sw = cvs && (parseFloat(cvs.style.width) || cvs.width) || 420
      const sh = cvs && (parseFloat(cvs.style.height) || cvs.height) || 610
      const size = model.getNaturalSize()
      const nw = size.width, nh = size.height
      if (!nw || !nh) return
      // The moc bounds include different transparent margins, so each model
      // owns an explicit visual calibration rather than sharing one multiplier.
      const profile = CHARACTERS[character.value]?.live2dLayout ?? {
        scale: 1,
        anchorX: 0.5,
        bottomOffset: 0,
      }
      const scale = Math.min(sw / nw, sh / nh) * profile.scale
      model.applyFit(scale, (sw - nw * scale) * profile.anchorX, sh - nh * scale + profile.bottomOffset)
    } catch (e) { fallback('Live2D 布局失败', errorMessage(e)) }
  }

  function layout() {
    if (!ready.value || !hostEl) return
    if (session?.capability.parameterOverride === false) {
      // 原生后端：计算舞台 DOM 矩形 → 屏幕物理像素 → 下发 overlay 帧
      if (!stageEl || !session.updateOverlay) return
      // Companion 首次加载时模型可能早于 desktop getState 完成。禁止用
      // screenX/devicePixelRatio 猜首帧，否则会缓存旧窗口尺寸的错误 offset，
      // 直到用户拖动窗口触发 bounds 事件才恢复。
      if (!desktopWindowBounds) {
        nativeOverlayReady = false
        session.setPaused(true)
        return
      }
      try {
        const rect = stageEl.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        const bounds = desktopWindowBounds ?? {
          ...windowBoundsFromScreen(),
          width: window.innerWidth,
          height: window.innerHeight,
        }
        // DPR 实测比例：WebView2 视口 CSS 像素与窗口物理像素的实际换算
        // （物理宽 / CSS 宽）。不能用 window.devicePixelRatio——per-monitor
        // 下它报告的是系统缩放（如 1.75），而 WebView2 视口可能按 1:1 布局，
        // 用它会整体错位（overlay 偏移、控件穿透矩形全偏）。
        const scale = bounds.width > 0 && window.innerWidth > 0
          ? bounds.width / window.innerWidth
          : (window.devicePixelRatio || 1)
        const overlayRect = computeOverlayRect({
          stageRect: rect,
          dpr: scale,
          // Native 契约使用 Companion-local 物理坐标；屏幕绝对原点由 Rust
          // 实时 GetWindowRect 获取，不能使用可能滞后的 desktop bounds x/y。
          windowBounds: { x: 0, y: 0, width: bounds.width, height: bounds.height },
        })
        nativeOverlayReady = true
        session.updateOverlay(overlayRect, true)
        session.setPaused(false)
        startNativeEmotionClock()
      } catch {}
      return
    }
    if (document.hidden) return
    try {
      const wrapper = hostEl.firstElementChild as HTMLElement | null
      if (!wrapper) return
      // 用实际 canvas 尺寸做比例（不同模型画布不同），不硬编码 420×610
      const canvasSize = session?.getCanvasSize() ?? { width: 420, height: 610 }
      const ws = hostEl.clientWidth / canvasSize.width, hs = hostEl.clientHeight / canvasSize.height
      // 舞台按角色卡片尺寸缩放画布；上限放宽到 1.28，让模型尽量撑满
      const scale = Math.min(1.28, Math.min(ws, hs) * 0.995)
      session?.setStageScale(scale > 0 ? scale : 1)
      fit()
    } catch {}
  }

  function scheduleNativeLayout(reset = true) {
    if (reset) nativeLayoutAttempts = 0
    if (nativeLayoutFrame) return
    const tick = () => {
      nativeLayoutFrame = 0
      if (destroyed.value || session?.capability.parameterOverride !== false) return
      layout()
      if (nativeOverlayReady || nativeLayoutAttempts >= 120) return
      nativeLayoutAttempts += 1
      nativeLayoutFrame = window.requestAnimationFrame(tick)
    }
    // 先同步测量：WebView 初次显示但尚未激活时 document.hidden 可能为 true，
    // requestAnimationFrame 也可能暂停；Native overlay 仍必须先拿到正确 frame。
    tick()
  }

  /**
   * 用户要求减少动态效果时不跑待机动作。
   * CSS 的 prefers-reduced-motion 关不掉 WebGL ticker，只能在这里判。
   */
  function prefersReducedMotion(): boolean {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  }

  function resumeRendering() {
    if (!session || document.hidden || prefersReducedMotion()) return
    session.setMaxFps(maxFps)
    session.setPaused(false)
    startNativeEmotionClock()
    layout()
  }

  function setMaxFps(value: number) {
    // 原生后端接电目标 165fps（渲染线程 vsync 决定实际帧率），不能被默认
    // 60 覆盖；browser 后端保持原有 120 上限不变。
    const isNative = backendKind.value === 'native' && backend?.kind === 'native'
    const cap = isNative ? 165 : 120
    maxFps = Math.max(24, Math.min(cap, Math.round(value) || 60))
    session?.setMaxFps(maxFps)
  }

  function setPaused(paused: boolean) {
    if (!session) return
    // 减少动态效果：渲染一帧把立绘摆正，然后停住，不做待机循环
    const waitingForNativeBounds = session?.capability.parameterOverride === false && !nativeOverlayReady
    const shouldPause = paused || prefersReducedMotion() || waitingForNativeBounds
    session.setPaused(shouldPause)
    if (shouldPause) stopNativeEmotionClock()
    else startNativeEmotionClock()
  }

  function setDesktopWindowBounds(bounds: { x: number; y: number; width: number; height: number }) {
    const previous = desktopWindowBounds
    desktopWindowBounds = bounds
    const nativeSession = session?.capability.parameterOverride === false
    const sizeChanged = !previous || previous.width !== bounds.width || previous.height !== bounds.height
    // 纯窗口移动由 Rust 每帧读取 Companion HWND 并保持本地 offset；这里若再用
    // 事件队列里的旧绝对坐标 setFrame，会与 Rust 跟随竞争并造成拖动抖动/跳位。
    if (nativeSession && nativeOverlayReady && !sizeChanged) return
    nativeOverlayReady = false
    scheduleNativeLayout()
  }

  async function recover() {
    if (destroyed.value || !enabled.value || document.hidden) return
    if (loading) await loading
    if (destroyed.value || !enabled.value || document.hidden) return
    if (!ready.value || !model || loadedCharacter.value !== character.value) {
      await retry()
      return
    }
    setVisible(true)
    setPaused(false)
    layout()
  }

  function setVisible(value: boolean) {
    const visible = Boolean(value && ready.value && loadedCharacter.value === character.value)
    stageEl?.classList.toggle('live2d-ready', visible)
    if (model) model.visible = visible
    if (!visible && session?.capability.parameterOverride === false) session.setPaused(true)
  }

  async function setOutfit(id: string): Promise<boolean> {
    // 夏目当前只有源模型自带的咖啡店制服，没有可切换衣装；模型无
    // Expressions，不得调用 expression（衣装参数由作者 motion 所有）。
    if (character.value === 'natsume') {
      const target = findNatsumeOutfit(id)
      outfit.value = target.id
      return true
    }
    const target = findLive2DOutfit(id)
    outfit.value = target.id
    if (!ready.value || !model?.visible) return true
    if (typeof model.expression !== 'function') {
      setState('degraded', 'Live2D 换装暂不可用', '当前运行库未提供 Expression 接口', true)
      return false
    }
    try {
      resumeRendering()
      const started = await Promise.resolve(model.expression(target.expression))
      if (started === false) {
        setState('degraded', 'Live2D 换装未完成', `模型拒绝了 ${target.label} Expression`, true)
        return false
      }
      setState('ready', 'Live2D 已连接')
      return true
    } catch (error) {
      setState('degraded', 'Live2D 换装暂不可用', errorMessage(error), true)
      return false
    }
  }

  function setMouth(value: number) {
    mouthValue.value = Math.max(0, Math.min(1, Number(value) || 0))
    // Do not depend solely on the internal event emitter. Some Cubism builds
    // skip it for a frame after an outfit change, which made speech look
    // frozen even while the audio analyser was producing amplitudes.
    applyParameters()
    if (mouthValue.value > 0) resumeRendering()
  }

  function setAudioLevel(level: number, peak = level) {
    emotionRuntime?.setAudioLevel(level, peak)
  }

  // 换装和口型都依赖 Pixi ticker。某些 Cubism 模型在切换 Expression 后会停掉 idle
  // motion；语音开始时显式恢复渲染，避免出现"有声音但立绘冻结"。
  function setSpeaking(value: boolean) {
    speaking = value
    emotionRuntime?.setSpeaking(value)
    if (value) resumeRendering()
    else {
      mouthValue.value = 0
      session?.sendMouthLevel?.(0)
    }
  }

  function fallback(text: string, detail: string) {
    ready.value = false; mouthValue.value = 0; interactionHint.value = ''; setVisible(false)
    setState('fallback', text || '静态立绘', detail || '', true)
  }

  function destroyRuntime() {
    clearTimeout(loadTimer); loadTimer = 0
    clearTimeout(interactionTimer); interactionTimer = 0; activeInteraction = ''
    clearTimeout(leaveTimer); leaveTimer = 0
    stopNativeEmotionClock()
    if (nativeLayoutFrame) window.cancelAnimationFrame(nativeLayoutFrame)
    nativeLayoutFrame = 0
    nativeLayoutAttempts = 0
    if (pointerGazeFrame) window.cancelAnimationFrame(pointerGazeFrame)
    pointerGazeFrame = 0
    pointerGazeLastFrame = 0
    entranceUntil = 0
    // Stop Pixi before clearing model state. Otherwise an authored motion can
    // tick once during character switching and read arrays already released by
    // wl-live2d's destroy path.
    const currentSession = session
    const currentModel = model
    if (currentSession) currentSession.setPaused(true)
    if (currentModel) currentModel.visible = false
    ready.value = false; mouthValue.value = 0; mouthHooked = false; speaking = false
    for (const key of Object.keys(emotionCurrent)) delete emotionCurrent[key]
    nativeAnimationAdapter.reset()
    blinkScheduler.reset()
    lastParamFrame = 0
    loadedCharacter.value = ''
    stageEl?.classList.remove('live2d-ready')
    if (nativeHitTestUnsubscribe) { nativeHitTestUnsubscribe(); nativeHitTestUnsubscribe = null }
    if (nativeMotionFailedUnsubscribe) { nativeMotionFailedUnsubscribe(); nativeMotionFailedUnsubscribe = null }
    if (currentSession && typeof currentSession.destroy === 'function') { try { currentSession.destroy() } catch {} }
    model = null
    session = null
    pointerGazeCurrentX = 0
    pointerGazeCurrentY = 0
    pointerGazeX = 0
    pointerGazeY = 0
    pointerGazeActive = false
    pointerGazeFocusKind = 'idle'
    nativeOverlayReady = false
    if (hostEl) hostEl.innerHTML = ''
  }

  function destroy() {
    lifecycleToken += 1
    destroyed.value = true; enabled.value = false; destroyRuntime()
    desktopWindowBounds = null
    resizeObserver?.disconnect()
    if (onResize) window.removeEventListener('resize', onResize)
    if (visibilityHandler) { document.removeEventListener('visibilitychange', visibilityHandler); visibilityHandler = null }
    if (stageEl && pointerClickHandler) stageEl.removeEventListener('click', pointerClickHandler)
      if (stageEl && pointerGazeHandler) stageEl.removeEventListener('mousemove', pointerGazeHandler)
      if (stageEl && pointerGazeLeaveHandler) stageEl.removeEventListener('mouseleave', pointerGazeLeaveHandler)
    pointerClickHandler = null
    pointerGazeHandler = null
    pointerGazeLeaveHandler = null
  }

  return {
    ready, enabled, character, loadedCharacter, mouthValue, interactionHint, outfit,
    backendKind, backendFallback,
    init, enable, disable, setCharacter, setMouth, setAudioLevel, setOutfit, setSpeaking,
    attachEmotionRuntime, setPaused, setMaxFps, recover, layout, retry, destroy,
    setGlobalPointer, releasePointerFocus, setDesktopWindowBounds, syncNativeEmotion: sendNativeEmotionIntent,
  }
}
