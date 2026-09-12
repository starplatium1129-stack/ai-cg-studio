import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLive2DCtx, isStageHidden } from './live2d/context'
import { createLayoutFitController } from './live2d/layoutFit'
import { NATIVE_CAPABILITY, type Live2DStageSession } from '@/live2d/types'

afterEach(() => vi.restoreAllMocks())

describe('desktop layout respects visibility ownership', () => {
  function setup() {
    const ctx = createLive2DCtx()
    ctx.ready.value = true
    ctx.hostEl = document.createElement('div')
    ctx.stageEl = document.createElement('div')
    vi.spyOn(ctx.stageEl, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 500 } as DOMRect)
    const updateOverlay = vi.fn(), setPaused = vi.fn(), startEmotionClock = vi.fn()
    ctx.session = { kind: 'native', capability: NATIVE_CAPABILITY, updateOverlay, setPaused } as unknown as Live2DStageSession
    const layout = createLayoutFitController(ctx, { fallback: vi.fn(), startEmotionClock })
    return { ctx, layout, updateOverlay, setPaused, startEmotionClock }
  }

  it('resize cannot reshow a hidden desktop, even when its WebView says visible', () => {
    const h = setup()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    h.ctx.desktopVisible = false
    h.layout.setDesktopWindowBounds({ x: 20, y: 30, width: 400, height: 600 })
    h.layout.layout()
    expect(h.updateOverlay).toHaveBeenLastCalledWith(expect.any(Object), false)
    expect(h.setPaused).toHaveBeenLastCalledWith(true)
    expect(h.startEmotionClock).not.toHaveBeenCalled()
    h.layout.resetWindowBounds()
  })

  it('a visible native overlay can follow bounds when the transparent WebView is inactive', () => {
    const h = setup()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    h.ctx.desktopVisible = true
    h.layout.setDesktopWindowBounds({ x: 20, y: 30, width: 400, height: 600 })
    expect(h.updateOverlay).toHaveBeenLastCalledWith(expect.any(Object), true)
    expect(h.setPaused).toHaveBeenLastCalledWith(false)
    h.ctx.session = { ...h.ctx.session!, kind: 'browser' }
    expect(isStageHidden(h.ctx)).toBe(true)
    h.layout.resetWindowBounds()
  })
})
