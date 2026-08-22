import type { Live2DCtx } from '@/composables/live2d/context'

/**
 * 原生情绪时钟（拆分 Step 5 自 useLive2D.ts 原样搬出）：
 * bridge 通道独立的 requestAnimationFrame 推进 emotionRuntime——原生后端
 * 没有 beforeModelUpdate 钩子，情绪推进只有这一个时钟（口型回调不得再次
 * update emotionRuntime，否则同一帧被推进两次）。取消仍由 destroyRuntime
 * 统一执行（唯一复位路径）。
 */
export function createNativeEmotionClock(ctx: Live2DCtx) {
  function syncIntent() {
    if (ctx.session?.capability.emotionChannel !== 'bridge' || !ctx.emotionRuntime) return
    ctx.session.sendEmotion?.(ctx.emotionRuntime.lastEmotion(), ctx.emotionRuntime.intensity())
  }

  function stop() {
    if (ctx.frames.nativeEmotion) window.cancelAnimationFrame(ctx.frames.nativeEmotion)
    ctx.frames.nativeEmotion = 0
    ctx.nativeEmotionLastFrame = 0
  }

  function tick(now: number) {
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
    syncIntent()
    ctx.frames.nativeEmotion = window.requestAnimationFrame(tick)
  }

  function start() {
    if (ctx.session?.capability.emotionChannel !== 'bridge' || ctx.frames.nativeEmotion || document.hidden) return
    ctx.nativeEmotionLastFrame = performance.now()
    ctx.frames.nativeEmotion = window.requestAnimationFrame(tick)
  }

  return { start, stop, syncIntent }
}
