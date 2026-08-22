import {
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
import { mediaStatusApi } from '@/api/mediaStatusApi'
import { createLive2DCtx, prefersReducedMotion, type Live2DStatus } from '@/composables/live2d/context'
import { createPointerGazeController } from '@/composables/live2d/pointerGaze'
import { createInteractionController } from '@/composables/live2d/interactions'
import { createNativeEmotionClock } from '@/composables/live2d/emotionClock'
import { createLayoutFitController } from '@/composables/live2d/layoutFit'
import {
  BLINK_PARAMS,
  ENTRANCE_GROUP,
  ENTRANCE_MAX_MS,
  LEAVE_GROUP,
  LEAVE_PLAY_MS,
  MOUTH_PARAMS,
  NATSUME_RESET_PARAMS,
  OVERLAY_SETTLE_MS,
  POINTER_FOCUS_PARAMS,
} from '@/composables/live2d/constants'
import { isRecord, readLive2DCatalog, type Live2DModelInfo } from '@/composables/live2d/catalog'

export type { Live2DStatus }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isCatchable(value: unknown): value is { catch(handler: (error: unknown) => void): unknown } {
  return isRecord(value) && typeof value.catch === 'function'
}

export function selectMouthParams(character: string): { id: string; scale: number } {
  return MOUTH_PARAMS[character] ?? MOUTH_PARAMS.nene
}

export function selectBlinkParams(character: string): readonly string[] | undefined {
  return BLINK_PARAMS[character]
}

export function useLive2D(onStatus: (s: Live2DStatus) => void = () => {}) {
  const ctx = createLive2DCtx()
  const pointerGaze = createPointerGazeController(ctx)
  const interactions = createInteractionController(ctx, { setState, resumeRendering })
  const emotionClock = createNativeEmotionClock(ctx)
  const layoutFit = createLayoutFitController(ctx, { fallback, startEmotionClock: emotionClock.start })

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
      setPaused(document.hidden); layoutFit.layout(); return
    }
    // A character switch can happen while the previous model is still loading.
    // Wait for that request to settle, then retry the character that is still
    // selected instead of returning the obsolete request's result.
    if (ctx.loading) await ctx.loading
    if (ctx.destroyed.value || !ctx.enabled.value || char !== ctx.character.value) return
    if (ctx.ready.value && ctx.loadedCharacter.value === char) {
      setVisible(true); setState('ready', 'Live2D 已连接')
      setPaused(document.hidden); layoutFit.layout(); return
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
          bindMouthOverride(); bindContextEvents(); interactions.bind(); layoutFit.fit(); layoutFit.scheduleNativeLayout()
          setVisible(true); setPaused(document.hidden); setState('ready', 'Live2D 已连接')
          emotionClock.start()
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
      ctx.resizeObserver = new ResizeObserver(() => layoutFit.layout()); ctx.resizeObserver.observe(ctx.hostEl)
    } else {
      window.addEventListener('resize', (ctx.onResize = () => layoutFit.layout()))
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
        interactions.beginNatsumeOverlaySettle()
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

  function resumeRendering() {
    if (!ctx.session || document.hidden || prefersReducedMotion()) return
    ctx.session.setMaxFps(ctx.maxFps)
    ctx.session.setPaused(false)
    emotionClock.start()
    layoutFit.layout()
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
    if (shouldPause) emotionClock.stop()
    else emotionClock.start()
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
    layoutFit.layout()
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
      interactions.stopAudio()
      resumeRendering()
    }
    else {
      ctx.mouthValue.value = 0
      ctx.session?.sendMouthLevel?.(0)
    }
  }

  function fallback(text: string, detail: string) {
    interactions.stopAudio()
    ctx.ready.value = false; ctx.mouthValue.value = 0; ctx.interactionHint.value = ''; setVisible(false)
    setState('fallback', text || '静态立绘', detail || '', true)
  }

  function destroyRuntime() {
    interactions.stopAudio()
    clearTimeout(ctx.timers.load); ctx.timers.load = 0
    clearTimeout(ctx.timers.interaction); ctx.timers.interaction = 0; ctx.activeInteraction = ''
    clearTimeout(ctx.timers.leave); ctx.timers.leave = 0
    emotionClock.stop()
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
    layoutFit.resetWindowBounds()
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
    attachEmotionRuntime, setPaused, setMaxFps, recover, layout: layoutFit.layout, retry, destroy,
    setGlobalPointer: pointerGaze.setGlobalPointer, releasePointerFocus: pointerGaze.release,
    setDesktopWindowBounds: layoutFit.setDesktopWindowBounds, syncNativeEmotion: emotionClock.syncIntent,
  }
}
