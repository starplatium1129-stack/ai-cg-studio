import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserLive2DBackend } from '@/live2d/browserBackend'
import type { Live2DModelHandle } from '@/live2d/types'

async function setup() {
  const model = {
    visible: true, width: 420, height: 610, x: 0, y: 0,
    scale: { x: 1, y: 1, set: vi.fn() },
  }
  let loaded!: (value: typeof model) => void
  let failed!: (error: Error) => void
  const ticker = { started: true, start: vi.fn(), stop: vi.fn() }
  const app = {
    app: { ticker },
    onModelLoaded: (callback: typeof loaded) => { loaded = callback },
    onModelError: (callback: typeof failed) => { failed = callback },
    destroy: vi.fn(),
  }
  Object.defineProperty(window, 'wl-live2d', { configurable: true, value: { wlLive2d: () => app } })
  const session = await createBrowserLive2DBackend().connect({
    selector: '#host', modelUrl: '/model.json', canvasWidth: 420, canvasHeight: 610, character: 'nene',
  })
  return { model, app, ticker, session, loaded: () => loaded(model), failed: () => failed(new Error('late')) }
}

afterEach(() => { Reflect.deleteProperty(window, 'wl-live2d') })

describe('browser Live2D session', () => {
  it('visibility reads and writes the actual rendered model', async () => {
    const h = await setup()
    let handle!: Live2DModelHandle
    h.session.onModelLoaded(value => { handle = value })
    h.loaded()
    handle.visible = false
    expect(h.model.visible).toBe(false)
    h.model.visible = true
    expect(handle.visible).toBe(true)
    h.session.destroy()
    expect(h.model.visible).toBe(false)
  })

  it('destroy stops rendering once and blocks late callbacks and resume', async () => {
    const h = await setup()
    const loaded = vi.fn()
    const failed = vi.fn()
    h.session.onModelLoaded(loaded)
    h.session.onModelError(failed)
    h.session.destroy()
    h.session.destroy()
    h.ticker.started = false
    h.session.setPaused(false)
    h.loaded()
    h.failed()
    expect(h.ticker.stop).toHaveBeenCalledOnce()
    expect(h.app.destroy).toHaveBeenCalledOnce()
    expect(h.ticker.start).not.toHaveBeenCalled()
    expect(loaded).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
    expect(h.model.visible).toBe(false)
  })
})
