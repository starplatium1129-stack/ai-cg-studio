import {
  CHARACTERS,
  findLive2DOutfit,
  findNatsumeOutfit,
} from '@/config/characters'
import type { EmotionRuntime } from '@/utils/emotionRuntime'
import { selectLive2DBackend } from '@/live2d/createBackend'
import { NATIVE_RENDER_STOPPED } from '@/live2d/nativeBackend'
import type {
  Live2DBackendKind,
  Live2DModelHandle,
  Live2DStageSession,
} from '@/live2d/types'
import { computeOverlayRect } from '@/utils/live2dOverlayLayout'
import { mediaStatusApi } from '@/api/mediaStatusApi'
import { useCompanionAffection } from '@/composables/useCompanionAffection'
import { createLive2DCtx } from '@/composables/live2d/context'
import { createPointerGazeController } from '@/composables/live2d/pointerGaze'
import {
  BLINK_PARAMS,
  ENTRANCE_GROUP,
  ENTRANCE_MAX_MS,
  INTERACTION_MOTIONS,
  LEAVE_GROUP,
  LEAVE_PLAY_MS,
  MOUTH_PARAMS,
  NATSUME_HIT_AREA_MAP,
  NATSUME_INTERACTIONS,
  NATSUME_RESET_PARAMS,
  POINTER_FOCUS_PARAMS,
  type Live2DInteraction,
} from '@/composables/live2d/constants'
import { isRecord, readLive2DCatalog, type Live2DModelInfo } from '@/composables/live2d/catalog'

export interface Live2DStatus {
  state: 'checking' | 'idle' | 'static' | 'loading' | 'ready' | 'degraded' | 'fallback'
  text: string
  detail: string
  retryable: boolean
  ready: boolean
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isCatchable(value: unknown): value is { catch(handler: (error: unknown) => void): unknown } {
  return isRecord(value) && typeof value.catch === 'function'
}

/** 分区带映射：舞台归一化坐标（x/y ∈ [0,1]）→ 互动动作。 */
export function resolveStageInteraction(character: string, x: number, y: number): Live2DInteraction | null {
  // 夏目：坐姿咖啡馆系模型，按 头/手/胸/裙/腿/脚 分区
  if (character === 'natsume') {
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

/**
 * 原生路径：Cubism 原生 HitArea 命中（作者分区）→ 互动动作。
 * 夏目的"外框"是环绕角色的矩形命中区，与头/手/胸/裙/腿/脚分区重叠，
 * 且 model3.json HitAreas 顺序排第一——直接取首个会让所有点击都变成
 * "抬眼"反应（2026-08-16 实机：头/手/裙/腿点击全部命中外框）。
 * 具体分区优先，外框只在没有其他分区命中时兜底（点到角色外的框空白处）。
 */
export function resolveHitAreaInteraction(character: string, areas: string[]): Live2DInteraction | null {
  const ordered = character === 'natsume'
    ? [...areas.filter(area => area !== '外框'), ...areas.filter(area => area === '外框')]
    : areas
  return ordered
    .map(area => (character === 'natsume' ? NATSUME_HIT_AREA_MAP[area] : area))
    .map(area => (character === 'natsume' ? NATSUME_INTERACTIONS[area] : INTERACTION_MOTIONS[area]))
    .find((item): item is Live2DInteraction => Boolean(item)) ?? null
}

export function selectMouthParams(character: string): { id: string; scale: number } {
  return MOUTH_PARAMS[character] ?? MOUTH_PARAMS.nene
}

export function selectBlinkParams(character: string): readonly string[] | undefined {
  return BLINK_PARAMS[character]
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
  const ctx = createLive2DCtx()
  const pointerGaze = createPointerGazeController(ctx)

  function setState(state: Live2DStatus['state'], text: string, detail = '', retryable = false) {
    if (ctx.hostEl) { ctx.hostEl.dataset.state = state; ctx.hostEl.dataset.error = detail; ctx.hostEl.dataset.retryable = retryable ? 'true' : 'false' }
    onStatus({ state, text, detail, retryable, ready: ctx.ready.value })
  }

  async function init(
    char: string,
    host: HTMLElement,
    stage: HTMLElement,
    options: { autoLoad?: boolean; outfit?: string; backendKind?: Live2DBackendKind } = {},
  ) {
    ctx.hostEl = host; ctx.stageEl = stage
    // wl-live2d 只接受 CSS selector，这里保证宿主节点有稳定 id 可选中
    if (!ctx.hostEl.id) ctx.hostEl.id = 'live2dHost'
    ctx.hostSelector = '#' + ctx.hostEl.id
    ctx.character.value = char || ctx.character.value
    pointerGaze.bind()
    ctx.outfit.value = char === 'natsume'
      ? findNatsumeOutfit(options.outfit || ctx.outfit.value).id
      : findLive2DOutfit(options.outfit || ctx.outfit.value).id
    setState('checking', '检查 Live2D…')
    try {
      ctx.catalog = readLive2DCatalog(await mediaStatusApi.getLive2DStatus())
      const selection = selectLive2DBackend(options.backendKind)
      ctx.backend = selection.backend
      ctx.backendKind.value = selection.effectiveKind
      ctx.backendFallback.value = selection.fallbackReason
      if (ctx.backendFallback.value) {
        if (ctx.hostEl) ctx.hostEl.dataset.backend = 'browser-fallback'
        console.warn('[live2d]', ctx.backendFallback.value)
      } else if (ctx.hostEl) {
        ctx.hostEl.dataset.backend = selection.effectiveKind
      }
      observeSize()
      bindVisibility()
      ctx.enabled.value = options.autoLoad === true
      if (ctx.enabled.value) await setCharacter(ctx.character.value)
      else {
        setVisible(false)
        setState('idle', '启用 Live2D', '点击后才下载并加载动态模型', true)
      }
    } catch (e) {
      fallback('Live2D 未就绪', errorMessage(e))
    }
  }

  function modelInfo(char: string) {
    return ctx.catalog?.models?.[char] ?? null
  }

  async function setCharacter(char: string) {
    ctx.character.value = char
    const info = modelInfo(char)
    if (!info?.available || !info?.modelUrl) {
      setVisible(false)
      ctx.interactionHint.value = ''
      setState('static', '静态立绘', info?.source || '该角色暂无 Live2D 模型')
      return
    }
    if (!ctx.enabled.value) {
      setVisible(false)
      ctx.interactionHint.value = ''
      setState('idle', '启用 Live2D', '点击后才下载并加载动态模型', true)
      return
    }
    if (ctx.ready.value && ctx.loadedCharacter.value === char) {
      setVisible(true); setState('ready', 'Live2D 已连接')
      setPaused(document.hidden); layout(); return
    }
    // A character switch can happen while the previous model is still loading.
    // Wait for that request to settle, then retry the character that is still
    // selected instead of returning the obsolete request's result.
    if (ctx.loading) await ctx.loading
    if (ctx.destroyed.value || !ctx.enabled.value || char !== ctx.character.value) return
    if (ctx.ready.value && ctx.loadedCharacter.value === char) {
      setVisible(true); setState('ready', 'Live2D 已连接')
      setPaused(document.hidden); layout(); return
    }
    await load(char, info)
  }

  async function retry() {
    if (ctx.destroyed.value) return
    if (ctx.loading) return ctx.loading
    if (!ctx.enabled.value) return enable()
    destroyRuntime()
    await setCharacter(ctx.character.value)
  }

  async function enable() {
    if (ctx.destroyed.value) return false
    ctx.lifecycleToken += 1
    clearTimeout(ctx.timers.leave)
    ctx.timers.leave = 0
    ctx.enabled.value = true
    return setCharacter(ctx.character.value)
  }

  function disable() {
    const token = ++ctx.lifecycleToken
    ctx.enabled.value = false
    ctx.interactionHint.value = ''
    // 告别动作：先播一小段 Leave 再销毁，避免"切换回静态立绘"瞬间硬切。
    // 减少动态效果或动作不可用时直接销毁；告别期间再次点击可立即重载。
    const playable = ctx.ready.value && ctx.model && typeof ctx.model.motion === 'function' && !prefersReducedMotion()
      ? ctx.model.motion(LEAVE_GROUP, undefined, 3)
      : null
    const started = isCatchable(playable) ? playable.then((v: unknown) => v === true).catch(() => false) : Promise.resolve(playable === true)
    void started.then((ok: boolean) => {
      if (token !== ctx.lifecycleToken || ctx.enabled.value) return
      if (!ok) {
        destroyRuntime()
        setState('idle', '启用 Live2D', '动态模型已释放；点击可重新加载', true)
        return
      }
      resumeRendering()
      setState('idle', '正在道别…', '播放告别动作后释放资源', false)
      clearTimeout(ctx.timers.leave)
      ctx.timers.leave = window.setTimeout(() => {
        if (token !== ctx.lifecycleToken || ctx.enabled.value) return
        destroyRuntime()
        setState('idle', '启用 Live2D', '动态模型已释放；点击可重新加载', true)
      }, LEAVE_PLAY_MS)
    })
  }

  function load(char: string, info: Live2DModelInfo): Promise<boolean> {
    if (ctx.loading) return ctx.loading
    if (!ctx.backend) return Promise.resolve(false)
    ctx.loading = new Promise((resolve) => {
      void (async () => {
        // 先停旧会话并清空宿主：wl-live2d 在 connect 时向 hostEl 创建 canvas，
        // 顺序反了会把刚创建的 canvas 一起清掉。库加载失败时旧模型也随之
        // 销毁并进入 fallback（原实现残留旧模型的行为不一致，一并修正）。
        destroyRuntime()
        if (ctx.hostEl) ctx.hostEl.innerHTML = ''
        // 加载状态必须在 connect 之前显示：原生后端 setCharacter 在渲染线程
        // 加载模型与纹理可能耗时数秒，期间 UI 线程保持空闲，loading 立即可见。
        setState('loading', 'Live2D 加载中…')
        let nextSession: Live2DStageSession
        try {
          nextSession = await ctx.backend!.connect({
            selector: ctx.hostSelector,
            modelUrl: info.modelUrl,
            canvasWidth: info.canvas?.width || 420,
            canvasHeight: info.canvas?.height || 610,
            character: char,
          })
        } catch (e) {
          const message = errorMessage(e)
          // 原生 IPC、GPU 或模型初始化任一步失败，都回退浏览器后端再试一次。
          if (ctx.backendKind.value === 'native' && ctx.backend?.kind === 'native') {
            const selection = selectLive2DBackend('browser')
            ctx.backend = selection.backend
            ctx.backendKind.value = 'browser'
            ctx.backendFallback.value = `原生 Live2D 初始化失败，已回退到浏览器渲染：${message}`
            if (ctx.hostEl) ctx.hostEl.dataset.backend = 'browser-fallback'
            console.warn('[live2d]', ctx.backendFallback.value)
            try {
              nextSession = await ctx.backend!.connect({
                selector: ctx.hostSelector,
                modelUrl: info.modelUrl,
                canvasWidth: info.canvas?.width || 420,
                canvasHeight: info.canvas?.height || 610,
                character: char,
              })
            } catch (e2) {
              fallback('Live2D 初始化失败', errorMessage(e2))
              ctx.loading = null
              resolve(false); return
            }
          } else {
            fallback('Live2D 初始化失败', message)
            ctx.loading = null
            resolve(false); return
          }
        }
        if (ctx.destroyed.value || char !== ctx.character.value) {
          nextSession.destroy()
          ctx.loading = null
          resolve(false); return
        }
        ctx.session = nextSession
        const nativeCapability = ctx.session.kind === 'native' ? ctx.session.capability : null
        let settled = false
        const finish = (v: boolean) => {
          if (settled) return; settled = true
          clearTimeout(ctx.timers.load); ctx.loading = null; resolve(v)
        }
        ctx.timers.load = window.setTimeout(() => { fallback('Live2D 加载超时', '模型在 20 秒内没有完成初始化'); finish(false) }, 20000)
        ctx.session.onModelLoaded((m: Live2DModelHandle) => {
          if (ctx.destroyed.value || char !== ctx.character.value) { finish(false); return }
          ctx.model = m; ctx.loadedCharacter.value = char; ctx.ready.value = true
          ctx.mouthValue.value = 0; ctx.mouthHooked = false
          bindMouthOverride(); bindContextEvents(); bindInteractionEvents(); fit(); scheduleNativeLayout()
          setVisible(true); setPaused(document.hidden); setState('ready', 'Live2D 已连接')
          startNativeEmotionClock()
          if (!nativeCapability?.entranceNative) playEntrance()
          void setOutfit(ctx.outfit.value)
          finish(true)
        })
        ctx.session.onModelError((e: Error) => {
          const detail = errorMessage(e)
          // 原生渲染线程停止：overlay 已销毁，模型不可用，必须提示并允许
          // 重试重新拉起线程（与"动作/换装失败但模型仍显示"的退化不同）。
          if (e.name === NATIVE_RENDER_STOPPED) {
            setState('degraded', 'Live2D 渲染已停止', detail, true)
            return
          }
          // wl-live2d 复用这一个回调报告初始载入和之后的 outfit/motion
          // 错误。后者不代表已经显示的模型失效，不能因此切回静态立绘。
          if (ctx.ready.value && ctx.loadedCharacter.value === char) {
            setState('degraded', 'Live2D 动作或换装暂不可用', detail, true)
            return
          }
          fallback('Live2D 模型加载失败', detail); finish(false)
        })
      })()
    })
    return ctx.loading
  }

  function observeSize() {
    if (!ctx.hostEl) return
    if ('ResizeObserver' in window && !ctx.resizeObserver) {
      ctx.resizeObserver = new ResizeObserver(() => layout()); ctx.resizeObserver.observe(ctx.hostEl)
    } else {
      window.addEventListener('resize', (ctx.onResize = () => layout()))
    }
  }

  function bindVisibility() {
    if (ctx.visibilityHandler) return
    ctx.visibilityHandler = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', ctx.visibilityHandler)
  }

  function playEntrance() {
    if (prefersReducedMotion()) return
    if (!ctx.model) return
    const motionFn = ctx.model.motion
    if (typeof motionFn !== 'function') return
    // 浏览器路径：从 wl-live2d 的 motionManager.definitions 探测 Start 组
    // （原生后端由 Rust 接管入场动作，不会走到这里）。
    if (!(ctx.model.hasMotionGroup?.(ENTRANCE_GROUP) ?? false)) return
    // 模型刚加载完成时 Start 组的动作可能还在预加载，startRandomMotion 会
    // 因组内全部未就绪直接返回 false；这里重试直到登场动作真正启动。
    let attempts = 0
    const tryStart = () => {
      if (attempts++ > 40 || ctx.destroyed.value || !ctx.model) return
      const result = motionFn.call(ctx.model, ENTRANCE_GROUP, undefined, 2)
      const started = isCatchable(result)
        ? result.then((v: unknown) => v === true).catch(() => false)
        : Promise.resolve(result === true)
      void started.then((ok: boolean) => {
        if (ok) {
          ctx.entranceUntil = performance.now() + ENTRANCE_MAX_MS
          // 登场结束后（entranceUntil 过期）叠层参数由 applyParameters 的
          // 所有权交接自动启动 smoothstep 回落：Start* 变体也会驱动叠层
          // 显隐（2026-08-16 实测 Start_1 等把 Param38 等从 0 拉高），
          // idle 不带回，残留会成半透明重影。
          return
        }
        window.setTimeout(tryStart, 250)
      })
    }
    tryStart()
  }

  function bindMouthOverride() {
    if (!ctx.model || ctx.mouthHooked) return
    // 原生后端：参数由作者工程执行，不需要 beforeModelUpdate 钩子
    if (ctx.session?.capability.parameterOverride === false) return
    ctx.mouthHooked = true
    ctx.model.onBeforeModelUpdate(applyParameters)
  }

  function attachEmotionRuntime(runtime: EmotionRuntime | null) {
    ctx.emotionRuntime = runtime
    ctx.nativeAnimationAdapter.reset()
    for (const key of Object.keys(ctx.emotionCurrent)) delete ctx.emotionCurrent[key]
    ctx.lastParamFrame = 0
  }

  function sendNativeEmotionIntent() {
    if (ctx.session?.capability.emotionChannel !== 'bridge' || !ctx.emotionRuntime) return
    ctx.session.sendEmotion?.(ctx.emotionRuntime.lastEmotion(), ctx.emotionRuntime.intensity())
  }

  function stopNativeEmotionClock() {
    if (ctx.frames.nativeEmotion) window.cancelAnimationFrame(ctx.frames.nativeEmotion)
    ctx.frames.nativeEmotion = 0
    ctx.nativeEmotionLastFrame = 0
  }

  function nativeEmotionTick(now: number) {
    ctx.frames.nativeEmotion = 0
    if (
      ctx.destroyed.value
      || document.hidden
      || !ctx.model?.visible
      || ctx.session?.capability.emotionChannel !== 'bridge'
    ) return
    const dt = Math.min(0.12, (now - ctx.nativeEmotionLastFrame) / 1000 || 1 / 60)
    ctx.nativeEmotionLastFrame = now
    ctx.emotionRuntime?.update(dt)
    if (ctx.stageEl && ctx.emotionRuntime) ctx.stageEl.dataset.emotionIntensity = ctx.emotionRuntime.intensity().toFixed(3)
    sendNativeEmotionIntent()
    ctx.frames.nativeEmotion = window.requestAnimationFrame(nativeEmotionTick)
  }

  function startNativeEmotionClock() {
    if (ctx.session?.capability.emotionChannel !== 'bridge' || ctx.frames.nativeEmotion || document.hidden) return
    ctx.nativeEmotionLastFrame = performance.now()
    ctx.frames.nativeEmotion = window.requestAnimationFrame(nativeEmotionTick)
  }

  function applyParameters() {
    if (!ctx.model?.visible) return
    const now = performance.now()
    const dt = Math.min(0.12, (now - ctx.lastParamFrame) / 1000 || 1 / 60)
    ctx.lastParamFrame = now
    if (ctx.session?.capability.parameterOverride === false) {
      // 原生后端：只传口型意图，参数级写入由 Cubism Native 按作者工程执行。
      // blinkScheduler / MOUTH_PARAMS 参数 hack 全部退役。情绪推进只有一个
      // 时钟（nativeEmotionTick 的 requestAnimationFrame），口型回调不得再次
      // update emotionRuntime，否则同一帧会被推进两次。
      if (ctx.speaking) ctx.session.sendMouthLevel?.(ctx.mouthValue.value)
      if (ctx.stageEl) ctx.stageEl.dataset.blink = '1.000'
      return
    }
    try {
      // Cubism motion/physics run before this event. Write with full weight so
      // their idle values cannot overwrite the audio amplitude or emotion.
      if (ctx.speaking) {
        const mouth = selectMouthParams(ctx.character.value)
        ctx.model.setParameterValueById(mouth.id, ctx.mouthValue.value * mouth.scale, 1)
      }
      // 覆盖式眨眼：双眼参数永远写同一个值（1=睁、0=闭），修掉作者眼曲线
      // 左右眼不同步造成的"单眼 Wink"，并保证定时眨眼（见 blinkScheduler）。
      // 登场动作（Start 组）期间暂停覆盖：其眼曲线左右同步（含开场闭眼），
      // 让作者动画原样呈现。
      const inEntrance = now < ctx.entranceUntil
      if (inEntrance) {
        if (ctx.stageEl) ctx.stageEl.dataset.blink = '1.000'
      } else {
        const blinkValue = ctx.blinkScheduler.update(dt)
        const blinkIds = selectBlinkParams(ctx.character.value)
        if (blinkIds) {
          for (const id of blinkIds) ctx.model.setParameterValueById(id, blinkValue, 1)
        }
        if (ctx.stageEl) ctx.stageEl.dataset.blink = blinkValue.toFixed(3)
      }
      if (ctx.stageEl) ctx.stageEl.dataset.entrance = inEntrance ? '1' : '0'
      // 叠层参数守卫 + 平滑回落（2026-08-23 换装闪回修复）：Idle 动作
      // Idle_6 会把 Param36/37 拉出隐藏态（到 5+），静止时叠层显示 →
      // 眼睛/全身发灰；互动（Tap）或登场（Start）播放期间让动作曲线驱动
      // 叠层（设计行为）。动作曲线交还所有权的瞬间（entranceUntil 过期/
      // 互动计时清空 activeInteraction）启动 smoothstep 回落（与原生端
      // OVERLAY_SETTLE_SECONDS 同款），替代原先的单帧硬写——后者让换装
      // 部件一帧内消失/回穿，视觉上是"闪一下"；回落结束后恢复每帧硬性
      // 写回隐藏态（0/-1 分组）——与 native 端 step_overlay_settle /
      // force_overlay_hidden 行为一致。
      const interactionPlaying = ctx.activeInteraction !== ''
      const overlayByMotion = inEntrance || interactionPlaying
      if (overlayByMotion) {
        ctx.overlaySettle = null
      } else if (ctx.overlayWasByMotion && ctx.character.value === 'natsume') {
        beginNatsumeOverlaySettle()
      }
      ctx.overlayWasByMotion = overlayByMotion
      if (!overlayByMotion && ctx.character.value === 'natsume') {
        if (ctx.overlaySettle) {
          const t = Math.min(1, (now - ctx.overlaySettle.start) / OVERLAY_SETTLE_MS)
          const eased = t * t * (3 - 2 * t)
          for (const { id, from, to } of ctx.overlaySettle.entries) {
            try { ctx.model.setParameterValueById(id, from + (to - from) * eased, 1) } catch { /* 参数缺失忽略 */ }
          }
          if (t >= 1) ctx.overlaySettle = null
        } else {
          for (const { id, value } of NATSUME_RESET_PARAMS) {
            try { ctx.model.setParameterValueById(id, value, 1) } catch { /* 参数缺失忽略 */ }
          }
        }
      }
      if (!ctx.emotionRuntime) return
      ctx.emotionRuntime.update(dt)
      if (ctx.stageEl) ctx.stageEl.dataset.emotionIntensity = ctx.emotionRuntime.intensity().toFixed(3)
      const frame = ctx.emotionRuntime.performanceFrame()
      if (!prefersReducedMotion()) {
        void ctx.nativeAnimationAdapter.apply(frame.nativeAnimation, ctx.model, ctx.character.value)
      }
      const targets = { ...frame.live2dParams, ...ctx.emotionRuntime.targets() }
      for (const id of ctx.nativeAnimationAdapter.activeSuppressedParamIds()) {
        delete targets[id]
        delete ctx.emotionCurrent[id]
      }
      if (typeof ctx.model.focus === 'function') {
        // pixi-live2d-display already maps focus to the model's authored eye
        // and head parameters. Do not overwrite those values with SoulLink.
        if (ctx.gaze.active) {
          for (const id of POINTER_FOCUS_PARAMS) {
            delete targets[id]
            delete ctx.emotionCurrent[id]
          }
        }
      } else {
        // Keep a parameter fallback for runtimes without the native focus API.
        if (ctx.gaze.active || Math.abs(ctx.gaze.currentX) > 0.01 || Math.abs(ctx.gaze.currentY) > 0.01) {
          targets.ParamEyeBallX = ctx.gaze.currentX
          targets.ParamEyeBallY = ctx.gaze.currentY
        }
      }
      for (const [id, target] of Object.entries(targets)) {
        const current = ctx.emotionCurrent[id] ?? 0
        const next = current + (target - current) * Math.min(1, dt * 6)
        ctx.emotionCurrent[id] = next
        ctx.model.setParameterValueById(id, next, 1)
      }
      // 归零的参数交还给 idle 动作，避免表情参数常驻覆写把待机动画压死
      for (const id of Object.keys(ctx.emotionCurrent)) {
        if (targets[id] === 0 && Math.abs(ctx.emotionCurrent[id]) < 0.004) {
          delete ctx.emotionCurrent[id]
        }
      }
    } catch {}
  }

  function bindContextEvents() {
    if (!ctx.hostEl) return
    const cvs = ctx.session?.canvasElement?.() as HTMLCanvasElement | null
    if (!cvs || cvs.dataset.contextEvents === '1') return
    cvs.dataset.contextEvents = '1'
    cvs.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      // 销毁/卸载阶段（disable、角色切换）移除 canvas 也会触发该事件，
      // 此时模型已经下线，不能再用"图形上下文已暂停"覆盖退出提示。
      if (!ctx.ready.value || !ctx.model) return
      fallback('Live2D 图形上下文已暂停', 'WebGL context lost')
    })
    cvs.addEventListener('webglcontextrestored', () => retry())
  }

  function worldPoint(event: MouseEvent) {
    const canvas = ctx.session?.canvasElement?.() as HTMLCanvasElement | null
    const rect = canvas?.getBoundingClientRect() ?? ctx.stageEl?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return null
    const screen = ctx.session?.getScreenSize() ?? { width: 420, height: 610 }
    return {
      x: Math.max(0, Math.min(screen.width, (event.clientX - rect.left) / rect.width * screen.width)),
      y: Math.max(0, Math.min(screen.height, (event.clientY - rect.top) / rect.height * screen.height)),
    }
  }

  function interactionFromStagePosition(event: MouseEvent): Live2DInteraction | null {
    const rect = ctx.stageEl?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return null
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    return resolveStageInteraction(ctx.character.value, x, y)
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
    const hitAreas = point && typeof ctx.model?.hitTest === 'function'
      ? ctx.model.hitTest(point.x, point.y)
      : []
    const interaction = hitAreas
      .map(area => (ctx.character.value === 'natsume' ? NATSUME_HIT_AREA_MAP[area] : area))
      .map(area => (ctx.character.value === 'natsume' ? NATSUME_INTERACTIONS[area] : INTERACTION_MOTIONS[area]))
      .find((item): item is Live2DInteraction => Boolean(item))
    if (interaction) return interaction
    return ctx.character.value === 'natsume' ? NATSUME_INTERACTIONS.Head : INTERACTION_MOTIONS.Head
  }

  function stopInteractionAudio() {
    if (ctx.interactionAudio) {
      try {
        ctx.interactionAudio.pause()
        ctx.interactionAudio.src = ''
      } catch {
        // ignore
      }
      ctx.interactionAudio = null
    }
  }

  function playNativeInteractionSound(soundUrl?: string) {
    if (!soundUrl || ctx.mouthValue.value > 0) return
    try {
      stopInteractionAudio()
      const audio = new Audio(soundUrl)
      audio.volume = 0.8
      ctx.interactionAudio = audio
      audio.play().catch(() => {
        // 浏览器静音策略或交互时机拦截静默降级
      })
      audio.onended = () => {
        if (ctx.interactionAudio === audio) ctx.interactionAudio = null
      }
    } catch {
      // ignore
    }
  }

  function markInteractionStarted(interaction: Live2DInteraction, customText?: string, soundUrl?: string) {
    ctx.activeInteraction = interaction.group
    clearTimeout(ctx.timers.interaction)
    // 互动计时结束只交还叠层参数所有权；复位改由 applyParameters 的所有权
    // 交接检测启动 smoothstep 回落（2026-08-23）。此处若先硬写会破坏回落
    // 对动作现值的捕获，退化回单帧硬切的"闪一下"。
    ctx.timers.interaction = window.setTimeout(() => {
      if (ctx.activeInteraction === interaction.group) {
        ctx.activeInteraction = ''
      }
    }, interaction.duration + 600)
    ctx.interactionHint.value = customText || interaction.hint
    setState('ready', 'Live2D 已连接')
    ctx.stageEl?.classList.remove('live2d-reacting')
    void ctx.stageEl?.offsetWidth
    ctx.stageEl?.classList.add('live2d-reacting')
    playNativeInteractionSound(soundUrl)
  }

  /**
   * 夏目叠层/换装参数的一次性硬复位（见 NATSUME_RESET_PARAMS）。正常路径
   * 已改用 beginNatsumeOverlaySettle 的 smoothstep 回落（2026-08-23 换装
   * 闪回修复）；本函数保留为运行库缺读参数接口时的降级，以及幂等兜底
   * （参数已是隐藏态时重复写无副作用）。复位值按隐藏态分组（0 / -1，
   * 2026-08-16 实证），统一写 0 会让 -1 组的参数落在"显示区间"，叠层
   * 半透明残留成重影。
   */
  function resetNatsumeOverlayParams() {
    if (ctx.character.value !== 'natsume' || !ctx.model || ctx.session?.capability.parameterOverride === false) return
    for (const { id, value } of NATSUME_RESET_PARAMS) {
      try { ctx.model.setParameterValueById(id, value, 1) } catch { /* 参数缺失忽略 */ }
    }
  }

  // 叠层/换装回落时长：原生端为 0.5s（OVERLAY_SETTLE_SECONDS）；浏览器端
  // 回落起点比原生晚（互动定时器在动作时长+600ms 才交还所有权），取稍短
  // 时长补偿总时长。
  const OVERLAY_SETTLE_MS = 450

  /**
   * 开始一次夏目叠层/换装参数回落：捕获动作曲线留下的现值（换装显隐态），
   * 此后 applyParameters 每帧向隐藏态 smoothstep 缓动。运行库没有读参数
   * 接口时退回一次性硬写（旧行为）。原生端不适用（参数由 Rust 侧回落）。
   */
  function beginNatsumeOverlaySettle() {
    if (ctx.character.value !== 'natsume' || !ctx.model || ctx.session?.capability.parameterOverride === false) return
    const read = ctx.model.getParameterValueById
    if (typeof read !== 'function') {
      resetNatsumeOverlayParams()
      return
    }
    const entries: Array<{ id: string; from: number; to: number }> = []
    for (const { id, value } of NATSUME_RESET_PARAMS) {
      const current = read.call(ctx.model, id)
      if (typeof current === 'number' && Number.isFinite(current)) {
        entries.push({ id, from: current, to: value })
      }
    }
    ctx.overlaySettle = entries.length ? { start: performance.now(), entries } : null
  }

  function interactionFailed(interaction: Live2DInteraction) {
    if (ctx.activeInteraction === interaction.group) {
      ctx.interactionHint.value = '这个动作正在进行中'
      return
    }
    ctx.interactionHint.value = '动作没有启动，请重试'
    setState('degraded', 'Live2D 动作未启动', `未能启动 ${interaction.group}`, true)
  }

  function playInteraction(interaction: Live2DInteraction) {
    if (!ctx.ready.value || !ctx.model?.visible || prefersReducedMotion() || ctx.mouthValue.value > 0) return
    // pixi-live2d-display uses the third argument as motion priority. Passing
    // null is treated as MotionPriority.NONE, which silently rejects the
    // motion while still letting the click hint update. FORCE interrupts idle
    // motion so a deliberate tap is always visible. We do not ship source WAVs;
    // this API does not need one for an authored motion to play.
    resumeRendering()
    if (typeof ctx.model.motion !== 'function') {
      interactionFailed(interaction)
      return
    }
    // 结合好感度调度系统按规则选择动作索引，并获取原装台词与加分反馈。
    // 基础调用契约保持 model.motion(interaction.group, undefined, 3) 兼容性
    const affection = useCompanionAffection()
    const dispatched = affection.dispatchInteractiveMotion(ctx.character.value, interaction.group)
    const motionIndex = dispatched.index
    const customText = dispatched.entry?.text
      ? `“${dispatched.entry.text}”${dispatched.bonusAwarded ? ` (好感度+${dispatched.bonusAwarded})` : ''}`
      : interaction.hint

    const soundUrl = dispatched.entry?.sound
    const targetIndex = typeof motionIndex === 'number' ? motionIndex : undefined
    const result = ctx.model.motion(interaction.group, targetIndex, 3)
    if (isCatchable(result)) {
      result.then((started: unknown) => {
        if (started === true) markInteractionStarted(interaction, customText, soundUrl)
        else interactionFailed(interaction)
      }).catch((error: unknown) => {
        ctx.interactionHint.value = '动作暂时不可用，请重试'
        setState('degraded', 'Live2D 动作暂不可用', errorMessage(error), true)
      })
      return
    }
    if (result === true) markInteractionStarted(interaction, customText, soundUrl)
    else interactionFailed(interaction)
  }

  function bindInteractionEvents() {
    if (!ctx.stageEl) return
    // 幂等重建：角色切换/重载会重建 session（onModelLoaded 再次进入），旧的
    // click 监听与 native 订阅必须解绑后重建，否则新 session 的 hit-test 回调
    // 无人接收（点击无任何反馈，2026-08-16 用户反馈"切换角色后无法点击"）。
    if (ctx.pointerClickHandler) {
      ctx.stageEl.removeEventListener('click', ctx.pointerClickHandler)
      ctx.pointerClickHandler = null
    }
    if (ctx.nativeHitTestUnsubscribe) { ctx.nativeHitTestUnsubscribe(); ctx.nativeHitTestUnsubscribe = null }
    if (ctx.nativeMotionFailedUnsubscribe) { ctx.nativeMotionFailedUnsubscribe(); ctx.nativeMotionFailedUnsubscribe = null }
    ctx.interactionHint.value = ctx.character.value === 'natsume'
      ? '移动鼠标可跟随视线；点击头部、手、胸前、裙子、腿或脚可互动'
      : '移动鼠标可跟随视线；点击呆毛、头部、脸、身体、两侧或裙摆可互动'
    // 原生 overlay 位于透明 WebView 下方且不接收鼠标。舞台 DOM 保持完整交互，
    // 点击坐标归一化后交给 Rust 做 Cubism 原生 HitArea 命中。
    if (ctx.session?.capability.hitTestNative) {
      ctx.nativeHitTestUnsubscribe = ctx.session.onNativeHitTest?.((areas) => {
        const interaction = resolveHitAreaInteraction(ctx.character.value, areas)
        if (interaction) playInteraction(interaction)
      }) ?? null
      // 同一互动播放中重复点击：Rust 拒绝并回传 motion-failed，这里直接
      // 显示"动作进行中"（Rust 状态为准，前端 duration 计时可能已过期）。
      ctx.nativeMotionFailedUnsubscribe = ctx.session.onMotionFailed?.((info) => {
        if (/already playing/.test(info.reason)) {
          ctx.interactionHint.value = '这个动作正在进行中'
        }
      }) ?? null
      ctx.pointerClickHandler = (event) => {
        if ((event.target as HTMLElement | null)?.closest('button, a, input, select, textarea')) return
        const rect = ctx.stageEl?.getBoundingClientRect()
        if (!rect?.width || !rect.height) return
        ctx.model?.hitTest(
          Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        )
      }
      ctx.stageEl.addEventListener('click', ctx.pointerClickHandler)
      return
    }
    ctx.pointerClickHandler = (event) => {
      if ((event.target as HTMLElement | null)?.closest('button, a, input, select, textarea')) return
      playInteraction(interactionAt(event))
    }
    ctx.stageEl.addEventListener('click', ctx.pointerClickHandler)
  }

  function fit() {
    if (!ctx.model || !ctx.hostEl) return
    try {
      const cvs = ctx.session?.canvasElement?.() as HTMLCanvasElement | null
      const sw = cvs && (parseFloat(cvs.style.width) || cvs.width) || 420
      const sh = cvs && (parseFloat(cvs.style.height) || cvs.height) || 610
      const size = ctx.model.getNaturalSize()
      const nw = size.width, nh = size.height
      if (!nw || !nh) return
      // The moc bounds include different transparent margins, so each model
      // owns an explicit visual calibration rather than sharing one multiplier.
      const profile = CHARACTERS[ctx.character.value]?.live2dLayout ?? {
        scale: 1,
        anchorX: 0.5,
        bottomOffset: 0,
      }
      const scale = Math.min(sw / nw, sh / nh) * profile.scale
      ctx.model.applyFit(scale, (sw - nw * scale) * profile.anchorX, sh - nh * scale + profile.bottomOffset)
    } catch (e) { fallback('Live2D 布局失败', errorMessage(e)) }
  }

  function layout() {
    if (!ctx.ready.value || !ctx.hostEl) return
    if (ctx.session?.capability.parameterOverride === false) {
      // 原生后端：计算舞台 DOM 矩形 → 屏幕物理像素 → 下发 overlay 帧
      if (!ctx.stageEl || !ctx.session.updateOverlay) return
      // Companion 首次加载时模型可能早于 desktop getState 完成。禁止用
      // screenX/devicePixelRatio 猜首帧，否则会缓存旧窗口尺寸的错误 offset，
      // 直到用户拖动窗口触发 bounds 事件才恢复。
      if (!desktopWindowBounds) {
        ctx.nativeOverlayReady = false
        ctx.session.setPaused(true)
        return
      }
      try {
        const rect = ctx.stageEl.getBoundingClientRect()
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
        ctx.nativeOverlayReady = true
        ctx.session.updateOverlay(overlayRect, true)
        ctx.session.setPaused(false)
        startNativeEmotionClock()
      } catch {}
      return
    }
    if (document.hidden) return
    try {
      const wrapper = ctx.hostEl.firstElementChild as HTMLElement | null
      if (!wrapper) return
      // 用实际 canvas 尺寸做比例（不同模型画布不同），不硬编码 420×610
      const canvasSize = ctx.session?.getCanvasSize() ?? { width: 420, height: 610 }
      const ws = ctx.hostEl.clientWidth / canvasSize.width, hs = ctx.hostEl.clientHeight / canvasSize.height
      // 舞台按角色卡片尺寸缩放画布；上限放宽到 1.28，让模型尽量撑满
      const scale = Math.min(1.28, Math.min(ws, hs) * 0.995)
      ctx.session?.setStageScale(scale > 0 ? scale : 1)
      fit()
    } catch {}
  }

  function scheduleNativeLayout(reset = true) {
    if (reset) ctx.nativeLayoutAttempts = 0
    if (ctx.frames.nativeLayout) return
    const tick = () => {
      ctx.frames.nativeLayout = 0
      if (ctx.destroyed.value || ctx.session?.capability.parameterOverride !== false) return
      layout()
      if (ctx.nativeOverlayReady || ctx.nativeLayoutAttempts >= 120) return
      ctx.nativeLayoutAttempts += 1
      ctx.frames.nativeLayout = window.requestAnimationFrame(tick)
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
    if (!ctx.session || document.hidden || prefersReducedMotion()) return
    ctx.session.setMaxFps(ctx.maxFps)
    ctx.session.setPaused(false)
    startNativeEmotionClock()
    layout()
  }

  function setMaxFps(value: number) {
    // 原生后端接电目标 165fps（渲染线程 vsync 决定实际帧率），不能被默认
    // 60 覆盖；browser 后端保持原有 120 上限不变。
    const isNative = ctx.backendKind.value === 'native' && ctx.backend?.kind === 'native'
    const cap = isNative ? 165 : 120
    ctx.maxFps = Math.max(24, Math.min(cap, Math.round(value) || 60))
    ctx.session?.setMaxFps(ctx.maxFps)
  }

  function setPaused(paused: boolean) {
    if (!ctx.session) return
    // 减少动态效果：渲染一帧把立绘摆正，然后停住，不做待机循环
    const waitingForNativeBounds = ctx.session?.capability.parameterOverride === false && !ctx.nativeOverlayReady
    const shouldPause = paused || prefersReducedMotion() || waitingForNativeBounds
    ctx.session.setPaused(shouldPause)
    if (shouldPause) stopNativeEmotionClock()
    else startNativeEmotionClock()
  }

  function setDesktopWindowBounds(bounds: { x: number; y: number; width: number; height: number }) {
    const previous = desktopWindowBounds
    desktopWindowBounds = bounds
    const nativeSession = ctx.session?.capability.parameterOverride === false
    const sizeChanged = !previous || previous.width !== bounds.width || previous.height !== bounds.height
    // 纯窗口移动由 Rust 每帧读取 Companion HWND 并保持本地 offset；这里若再用
    // 事件队列里的旧绝对坐标 setFrame，会与 Rust 跟随竞争并造成拖动抖动/跳位。
    if (nativeSession && ctx.nativeOverlayReady && !sizeChanged) return
    ctx.nativeOverlayReady = false
    scheduleNativeLayout()
  }

  async function recover() {
    if (ctx.destroyed.value || !ctx.enabled.value || document.hidden) return
    if (ctx.loading) await ctx.loading
    if (ctx.destroyed.value || !ctx.enabled.value || document.hidden) return
    if (!ctx.ready.value || !ctx.model || ctx.loadedCharacter.value !== ctx.character.value) {
      await retry()
      return
    }
    setVisible(true)
    setPaused(false)
    layout()
  }

  function setVisible(value: boolean) {
    const visible = Boolean(value && ctx.ready.value && ctx.loadedCharacter.value === ctx.character.value)
    ctx.stageEl?.classList.toggle('live2d-ready', visible)
    if (ctx.model) ctx.model.visible = visible
    if (!visible && ctx.session?.capability.parameterOverride === false) ctx.session.setPaused(true)
  }

  async function setOutfit(id: string): Promise<boolean> {
    // 夏目当前只有源模型自带的咖啡店制服，没有可切换衣装；模型无
    // Expressions，不得调用 expression（衣装参数由作者 motion 所有）。
    if (ctx.character.value === 'natsume') {
      const target = findNatsumeOutfit(id)
      ctx.outfit.value = target.id
      return true
    }
    const target = findLive2DOutfit(id)
    ctx.outfit.value = target.id
    if (!ctx.ready.value || !ctx.model?.visible) return true
    if (typeof ctx.model.expression !== 'function') {
      setState('degraded', 'Live2D 换装暂不可用', '当前运行库未提供 Expression 接口', true)
      return false
    }
    try {
      resumeRendering()
      const started = await Promise.resolve(ctx.model.expression(target.expression))
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
    ctx.mouthValue.value = Math.max(0, Math.min(1, Number(value) || 0))
    // Do not depend solely on the internal event emitter. Some Cubism builds
    // skip it for a frame after an outfit change, which made speech look
    // frozen even while the audio analyser was producing amplitudes.
    applyParameters()
    if (ctx.mouthValue.value > 0) resumeRendering()
  }

  function setAudioLevel(level: number, peak = level) {
    ctx.emotionRuntime?.setAudioLevel(level, peak)
  }

  // 换装和口型都依赖 Pixi ticker。某些 Cubism 模型在切换 Expression 后会停掉 idle
  // motion；语音开始时显式恢复渲染，避免出现"有声音但立绘冻结"。
  function setSpeaking(value: boolean) {
    ctx.speaking = value
    ctx.emotionRuntime?.setSpeaking(value)
    if (value) {
      stopInteractionAudio()
      resumeRendering()
    }
    else {
      ctx.mouthValue.value = 0
      ctx.session?.sendMouthLevel?.(0)
    }
  }

  function fallback(text: string, detail: string) {
    stopInteractionAudio()
    ctx.ready.value = false; ctx.mouthValue.value = 0; ctx.interactionHint.value = ''; setVisible(false)
    setState('fallback', text || '静态立绘', detail || '', true)
  }

  function destroyRuntime() {
    stopInteractionAudio()
    clearTimeout(ctx.timers.load); ctx.timers.load = 0
    clearTimeout(ctx.timers.interaction); ctx.timers.interaction = 0; ctx.activeInteraction = ''
    clearTimeout(ctx.timers.leave); ctx.timers.leave = 0
    stopNativeEmotionClock()
    if (ctx.frames.nativeLayout) window.cancelAnimationFrame(ctx.frames.nativeLayout)
    ctx.frames.nativeLayout = 0
    ctx.nativeLayoutAttempts = 0
    if (ctx.frames.gaze) window.cancelAnimationFrame(ctx.frames.gaze)
    ctx.frames.gaze = 0
    ctx.gaze.lastFrame = 0
    ctx.entranceUntil = 0
    ctx.overlaySettle = null
    ctx.overlayWasByMotion = false
    // Stop Pixi before clearing model state. Otherwise an authored motion can
    // tick once during character switching and read arrays already released by
    // wl-live2d's destroy path.
    const currentSession = ctx.session
    const currentModel = ctx.model
    if (currentSession) currentSession.setPaused(true)
    if (currentModel) currentModel.visible = false
    ctx.ready.value = false; ctx.mouthValue.value = 0; ctx.mouthHooked = false; ctx.speaking = false
    for (const key of Object.keys(ctx.emotionCurrent)) delete ctx.emotionCurrent[key]
    ctx.nativeAnimationAdapter.reset()
    ctx.blinkScheduler.reset()
    ctx.lastParamFrame = 0
    ctx.loadedCharacter.value = ''
    ctx.stageEl?.classList.remove('live2d-ready')
    if (ctx.nativeHitTestUnsubscribe) { ctx.nativeHitTestUnsubscribe(); ctx.nativeHitTestUnsubscribe = null }
    if (ctx.nativeMotionFailedUnsubscribe) { ctx.nativeMotionFailedUnsubscribe(); ctx.nativeMotionFailedUnsubscribe = null }
    if (currentSession && typeof currentSession.destroy === 'function') { try { currentSession.destroy() } catch {} }
    ctx.model = null
    ctx.session = null
    ctx.gaze.currentX = 0
    ctx.gaze.currentY = 0
    ctx.gaze.x = 0
    ctx.gaze.y = 0
    ctx.gaze.active = false
    ctx.gaze.kind = 'idle'
    ctx.nativeOverlayReady = false
    if (ctx.hostEl) ctx.hostEl.innerHTML = ''
  }

  function destroy() {
    ctx.lifecycleToken += 1
    ctx.destroyed.value = true; ctx.enabled.value = false; destroyRuntime()
    desktopWindowBounds = null
    ctx.resizeObserver?.disconnect()
    if (ctx.onResize) window.removeEventListener('resize', ctx.onResize)
    if (ctx.visibilityHandler) { document.removeEventListener('visibilitychange', ctx.visibilityHandler); ctx.visibilityHandler = null }
    if (ctx.stageEl && ctx.pointerClickHandler) ctx.stageEl.removeEventListener('click', ctx.pointerClickHandler)
    if (ctx.stageEl && ctx.pointerGazeHandler) ctx.stageEl.removeEventListener('mousemove', ctx.pointerGazeHandler)
    if (ctx.stageEl && ctx.pointerGazeLeaveHandler) ctx.stageEl.removeEventListener('mouseleave', ctx.pointerGazeLeaveHandler)
    ctx.pointerClickHandler = null
    ctx.pointerGazeHandler = null
    ctx.pointerGazeLeaveHandler = null
  }

  return {
    ready: ctx.ready, enabled: ctx.enabled, character: ctx.character, loadedCharacter: ctx.loadedCharacter,
    mouthValue: ctx.mouthValue, interactionHint: ctx.interactionHint, outfit: ctx.outfit,
    backendKind: ctx.backendKind, backendFallback: ctx.backendFallback,
    init, enable, disable, setCharacter, setMouth, setAudioLevel, setOutfit, setSpeaking,
    attachEmotionRuntime, setPaused, setMaxFps, recover, layout, retry, destroy,
    setGlobalPointer: pointerGaze.setGlobalPointer, releasePointerFocus: pointerGaze.release,
    setDesktopWindowBounds, syncNativeEmotion: sendNativeEmotionIntent,
  }
}
