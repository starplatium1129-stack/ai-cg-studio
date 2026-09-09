import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLive2DCtx } from './live2d/context'
import { createLifecycleController } from './live2d/lifecycle'
import { BROWSER_CAPABILITY, type Live2DConnectOptions, type Live2DModelHandle, type Live2DStageSession } from '@/live2d/types'
import { NATIVE_RENDER_STOPPED } from '@/live2d/nativeBackend'
import { mediaStatusApi } from '@/api/mediaStatusApi'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function setup() {
  vi.useFakeTimers()
  const ctx = createLive2DCtx()
  ctx.enabled.value = true
  ctx.catalog = { models: { nene: { available: true, modelUrl: '/nene.model3.json', source: '', missing: [] } } }
  ctx.hostEl = document.createElement('div')
  ctx.stageEl = document.createElement('div')
  let loaded!: (model: Live2DModelHandle) => void
  let failed!: (error: Error) => void
  const model: Live2DModelHandle = {
    visible: true, motion: vi.fn(() => false), expression: vi.fn(() => true),
    hitTest: () => [], focus: vi.fn(), setParameterValueById: vi.fn(),
    onBeforeModelUpdate: vi.fn(), applyFit: vi.fn(), getNaturalSize: () => ({ width: 420, height: 610 }),
  }
  const session: Live2DStageSession = {
    kind: 'browser', capability: BROWSER_CAPABILITY,
    onModelLoaded: callback => { loaded = callback }, onModelError: callback => { failed = callback },
    setPaused: vi.fn(), setMaxFps: vi.fn(), getScreenSize: model.getNaturalSize,
    getCanvasSize: model.getNaturalSize, setStageScale: vi.fn(), canvasElement: () => null, destroy: vi.fn(),
  }
  const connect = vi.fn<(options: Live2DConnectOptions) => Promise<Live2DStageSession>>(async () => session)
  ctx.backend = { kind: 'browser', capability: BROWSER_CAPABILITY, connect }
  const setState = vi.fn()
  const lifecycle = createLifecycleController(ctx, {
    pointerGaze: { bind: vi.fn() }, emotionClock: { start: vi.fn(), stop: vi.fn() },
    layoutFit: { fit: vi.fn(), layout: vi.fn(), scheduleNativeLayout: vi.fn(), resetWindowBounds: vi.fn() },
    interactions: { bind: vi.fn(), stopAudio: vi.fn() }, parameterFrame: { bindMouthOverride: vi.fn() },
  }, { setState })
  return { ctx, lifecycle, connect, session, model, setState, loaded: () => loaded(model), failed: (e: Error) => failed(e) }
}

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('Live2D lifecycle races', () => {
  it('a hanging connect times out, and its late result cannot clear a retry', async () => {
    const h = setup()
    const connection = deferred<Live2DStageSession>()
    h.connect.mockReturnValueOnce(connection.promise)
    const loading = h.lifecycle.setCharacter('nene')
    const signal = h.connect.mock.calls[0]![0].signal
    await vi.advanceTimersByTimeAsync(20000)
    await loading
    expect(signal?.aborted).toBe(true)
    expect(h.ctx.loading).toBeNull()
    expect(h.setState).toHaveBeenLastCalledWith('fallback', 'Live2D 加载超时', expect.any(String), true)
    const retrying = h.lifecycle.retry()
    await Promise.resolve()
    const pendingRetry = h.ctx.loading
    const stale = { ...h.session, destroy: vi.fn() }
    connection.resolve(stale)
    await Promise.resolve()
    expect(stale.destroy).toHaveBeenCalledOnce()
    expect(h.ctx.loading).toBe(pendingRetry)
    h.loaded()
    await retrying
    expect(h.ctx.ready.value).toBe(true)
    h.lifecycle.destroy()
  })

  it('destroy settles a connection that never answers', async () => {
    const h = setup()
    h.connect.mockReturnValueOnce(new Promise(() => {}))
    const loading = h.lifecycle.setCharacter('nene')
    h.lifecycle.destroy()
    await loading
    expect(h.connect.mock.calls[0]![0].signal?.aborted).toBe(true)
    expect(h.ctx.loading).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('disabling during connect destroys the late session without making it visible', async () => {
    const h = setup()
    const connection = deferred<Live2DStageSession>()
    h.connect.mockReturnValueOnce(connection.promise)
    const loading = h.lifecycle.setCharacter('nene')
    h.lifecycle.disable()
    await Promise.resolve()
    connection.resolve(h.session)
    await loading
    expect(h.session.destroy).toHaveBeenCalledOnce()
    expect(h.ctx.session).toBeNull()
    expect(h.ctx.ready.value).toBe(false)
  })

  it('destroy settles model loading and ignores late success and error callbacks', async () => {
    const h = setup()
    const loading = h.lifecycle.setCharacter('nene')
    await Promise.resolve()
    h.lifecycle.destroy()
    await loading
    h.loaded()
    h.failed(new Error('late error'))
    expect(h.ctx.loading).toBeNull()
    expect(h.ctx.ready.value).toBe(false)
    expect(h.setState).toHaveBeenLastCalledWith('loading', 'Live2D 加载中…')
  })

  it('a stopped renderer releases stale readiness and reconnects after backoff', async () => {
    const h = setup()
    const loading = h.lifecycle.setCharacter('nene')
    await Promise.resolve()
    h.loaded()
    await loading
    const stopped = new Error('device lost')
    stopped.name = NATIVE_RENDER_STOPPED
    h.failed(stopped)
    expect(h.ctx.ready.value).toBe(false)
    expect(h.session.destroy).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1200)
    expect(h.connect).toHaveBeenCalledTimes(2)
    h.loaded()
    expect(h.ctx.ready.value).toBe(true)
    h.lifecycle.destroy()
  })

  it('disable cancels a queued renderer recovery', async () => {
    const h = setup()
    const loading = h.lifecycle.setCharacter('nene')
    await Promise.resolve()
    h.loaded()
    await loading
    h.failed(Object.assign(new Error('stopped'), { name: NATIVE_RENDER_STOPPED }))
    h.lifecycle.disable()
    await vi.advanceTimersByTimeAsync(5000)
    expect(h.connect).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('switching to a static character releases the old renderer', async () => {
    const h = setup()
    const loading = h.lifecycle.setCharacter('nene')
    await Promise.resolve()
    h.loaded()
    await loading
    await h.lifecycle.setCharacter('static-only')
    expect(h.session.destroy).toHaveBeenCalledOnce()
    expect(h.ctx.ready.value).toBe(false)
    expect(h.ctx.loadedCharacter.value).toBe('')
  })

  it('a timed-out session cannot revive through a late ready event', async () => {
    const h = setup()
    const loading = h.lifecycle.setCharacter('nene')
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(20000)
    await loading
    h.loaded()
    expect(h.ctx.ready.value).toBe(false)
    expect(h.session.destroy).toHaveBeenCalledOnce()
    expect(h.setState).toHaveBeenLastCalledWith('fallback', 'Live2D 加载超时', expect.any(String), true)
  })

  it('unmount during catalog lookup does not attach observers or load a model', async () => {
    const h = setup()
    const catalog = deferred<Awaited<ReturnType<typeof mediaStatusApi.getLive2DStatus>>>()
    vi.spyOn(mediaStatusApi, 'getLive2DStatus').mockReturnValueOnce(catalog.promise)
    const init = h.lifecycle.init('nene', h.ctx.hostEl!, h.ctx.stageEl!, { autoLoad: true })
    h.lifecycle.destroy()
    catalog.resolve({ models: {} } as Awaited<ReturnType<typeof mediaStatusApi.getLive2DStatus>>)
    await init
    expect(h.ctx.resizeObserver).toBeNull()
    expect(h.ctx.visibilityHandler).toBeNull()
    expect(h.connect).not.toHaveBeenCalled()
  })
})
