import { ref, type Ref } from 'vue'
import type { EmotionRuntime } from '@/utils/emotionRuntime'
import { createLive2dNativeAdapter } from '@/utils/live2dNativeAdapter'
import { createBlinkScheduler } from '@/utils/blinkScheduler'
import type {
  Live2DBackendKind,
  Live2DModelHandle,
  Live2DStageBackend,
  Live2DStageSession,
} from '@/live2d/types'
import type { Live2DCatalog } from '@/composables/live2d/catalog'
import { DEFAULT_LIVE2D_OUTFIT } from '@/config/characters'

/**
 * Live2DCtx：useLive2D 全部共享可变状态的显式类型化容器（拆分 Step 2）。
 * 由原 ~35 个工厂闭包 let 机械收敛而来——模块边界即数据边界，各子模块只经
 * ctx 通信。禁止解构可变字段（plain 字段是值拷贝，读写会断裂），统一
 * `ctx.x` 访问；Ref 字段解构虽安全但为一致性同样走 `ctx.x`。
 */
export interface Live2DCtx {
  // 响应式面
  ready: Ref<boolean>
  enabled: Ref<boolean>
  destroyed: Ref<boolean>
  character: Ref<string>
  loadedCharacter: Ref<string>
  mouthValue: Ref<number>
  interactionHint: Ref<string>
  outfit: Ref<string>
  backendKind: Ref<Live2DBackendKind>
  backendFallback: Ref<string | null>

  // 元素与选择器（wl-live2d 只接受 CSS selector）
  hostEl: HTMLElement | null
  stageEl: HTMLElement | null
  hostSelector: string

  // 目录 / 后端 / 会话
  catalog: Live2DCatalog | null
  backend: Live2DStageBackend | null
  session: Live2DStageSession | null
  model: Live2DModelHandle | null
  loading: Promise<boolean> | null

  // 定时器句柄（各子模块自持语义，ctx 存统一取消入口）
  timers: { load: number; interaction: number; leave: number }

  // rAF 句柄（凝视 / 原生情绪 / native layout 重试三个独立时钟）
  frames: { gaze: number; nativeEmotion: number; nativeLayout: number }

  // 凝视共享值（applyParameters 回退路径读取 currentX/Y）
  gaze: {
    x: number
    y: number
    currentX: number
    currentY: number
    active: boolean
    kind: string
    lastFrame: number
  }

  // 互动域
  activeInteraction: string
  interactionAudio: HTMLAudioElement | null

  // 生命周期卫兵与帧率窗口
  lifecycleToken: number
  entranceUntil: number
  maxFps: number

  // 口型 / 情绪
  mouthHooked: boolean
  speaking: boolean
  emotionRuntime: EmotionRuntime | null
  emotionCurrent: Record<string, number>
  lastParamFrame: number
  nativeAnimationAdapter: ReturnType<typeof createLive2dNativeAdapter>
  blinkScheduler: ReturnType<typeof createBlinkScheduler>

  // 原生 overlay
  nativeOverlayReady: boolean
  nativeLayoutAttempts: number
  nativeEmotionLastFrame: number
  nativeHitTestUnsubscribe: (() => void) | null
  nativeMotionFailedUnsubscribe: (() => void) | null

  // DOM 监听
  resizeObserver: ResizeObserver | null
  onResize: (() => void) | null
  visibilityHandler: (() => void) | null
  pointerClickHandler: ((event: MouseEvent) => void) | null
  pointerGazeHandler: ((event: MouseEvent) => void) | null
  pointerGazeLeaveHandler: (() => void) | null
}

export function createLive2DCtx(): Live2DCtx {
  return {
    ready: ref(false),
    enabled: ref(false),
    destroyed: ref(false),
    character: ref('nene'),
    loadedCharacter: ref(''),
    mouthValue: ref(0),
    interactionHint: ref(''),
    outfit: ref<string>(DEFAULT_LIVE2D_OUTFIT),
    backendKind: ref<Live2DBackendKind>('browser'),
    backendFallback: ref<string | null>(null),

    hostEl: null,
    stageEl: null,
    hostSelector: '#live2dHost',

    catalog: null,
    backend: null,
    session: null,
    model: null,
    loading: null,

    timers: { load: 0, interaction: 0, leave: 0 },
    frames: { gaze: 0, nativeEmotion: 0, nativeLayout: 0 },

    gaze: { x: 0, y: 0, currentX: 0, currentY: 0, active: false, kind: 'idle', lastFrame: 0 },

    activeInteraction: '',
    interactionAudio: null,

    lifecycleToken: 0,
    entranceUntil: 0,
    maxFps: 60,

    mouthHooked: false,
    speaking: false,
    emotionRuntime: null,
    emotionCurrent: {},
    lastParamFrame: 0,
    nativeAnimationAdapter: createLive2dNativeAdapter(),
    blinkScheduler: createBlinkScheduler(),

    nativeOverlayReady: false,
    nativeLayoutAttempts: 0,
    nativeEmotionLastFrame: 0,
    nativeHitTestUnsubscribe: null,
    nativeMotionFailedUnsubscribe: null,

    resizeObserver: null,
    onResize: null,
    visibilityHandler: null,
    pointerClickHandler: null,
    pointerGazeHandler: null,
    pointerGazeLeaveHandler: null,
  }
}
