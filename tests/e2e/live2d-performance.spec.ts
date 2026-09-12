import { test, expect, type Page } from '@playwright/test'
import type { Live2DNativeBridge } from '../../src/types/live2dNative'

type Probe = {
  events: Record<string, (value?: unknown) => void>
  frames: { visible: boolean }[]
  fps: number[]
  characters: { textureScale?: number }[]
  snapshot: (value: unknown) => void
}

async function fixture(page: Page, legacy = false) {
  await page.addInitScript(({ legacy }) => {
    localStorage.setItem('aics_companion_live2d_v1', 'true')
    localStorage.setItem('aics_live2d_quality_v1', 'compact')
    localStorage.setItem('aics_companion_behavior_v1', JSON.stringify({ enabled: false, dnd: true }))
    const probe: Probe = { events: {}, frames: [], fps: [], characters: [], snapshot: () => {} }
    Object.assign(window, { __live2dProbe: probe })
    const methods: Record<string, unknown> = {
      isDesktop: true,
      getState: () => new Promise(resolve => { probe.snapshot = resolve }),
      getSettings: async () => ({ openAtLogin: false }),
      getWorkspace: async () => ({ root: '', exists: false }),
      getWindowState: async () => ({ maximized: false, focused: true }),
      chatRelay: async () => {}, isPackaged: async () => true,
    }
    window.companionDesktop = new Proxy(methods, { get(target, key: string) {
      if (key in target) return target[key]
      if (key.startsWith('on')) return (callback: (value?: unknown) => void) => { probe.events[key] = callback; return 1 }
      return () => undefined
    } }) as unknown as NonNullable<Window['companionDesktop']>
    window.aicsLive2dNative = {
      isNativeLive2D: true, supportsTextureQuality: !legacy,
      setCharacter: async (_path, options) => { probe.characters.push(options!); return { ok: true } },
      setFrame: async frame => { probe.frames.push(frame) }, setMaxFps: async fps => { probe.fps.push(fps) },
      playMotion: async () => ({ ok: true }), setExpression: async () => ({ ok: true }),
      setMouthLevel: async () => {}, setEmotion: async () => {}, setGaze: async () => {},
      hitTest: async () => ({ areas: [] }), destroy: async () => {},
      onReady: () => 1, onHitTest: () => 2, onMotionStarted: () => 3,
      onMotionFailed: () => 4, onEntranceFinished: () => 5, onStopped: () => 6, off: () => {},
    } satisfies Live2DNativeBridge
  }, { legacy })
  await page.setViewportSize({ width: 480, height: 720 })
  await page.goto('/companion')
  await page.waitForFunction(() => (window as unknown as { __live2dProbe: Probe }).__live2dProbe.events.onPowerModeChanged)
}

test('native companion keeps live visibility, power and bounds ahead of a stale startup snapshot', async ({ page }) => {
  await fixture(page)
  await page.evaluate(() => {
    const p = (window as unknown as { __live2dProbe: Probe }).__live2dProbe
    p.events.onPowerModeChanged(true)
    p.events.onWindowBoundsChanged({ x: 300, y: 100, width: 480, height: 720 })
    p.events.onShown()
  })
  await expect(page.locator('.live2d-host')).toHaveAttribute('data-state', 'ready')
  const probe = () => page.evaluate(() => {
    const p = (window as unknown as { __live2dProbe: Probe }).__live2dProbe
    return { frame: p.frames.at(-1), fps: p.fps.at(-1), character: p.characters.at(-1) }
  })
  await expect.poll(async () => (await probe()).frame?.visible).toBe(true)
  expect((await probe()).fps).toBe(30)
  expect((await probe()).character?.textureScale).toBe(4)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('resize'))
  })
  expect((await probe()).frame?.visible).toBe(true)
  await page.evaluate(() => {
    const p = (window as unknown as { __live2dProbe: Probe }).__live2dProbe
    p.events.onVisibilityChanged(false)
    p.snapshot({ visible: true, onBatteryPower: false, alwaysOnTop: false, ignoreMouseEvents: false, live2dEnabled: true, bounds: { x: 0, y: 0, width: 200, height: 300 } })
    window.dispatchEvent(new Event('resize'))
  })
  await expect.poll(async () => (await probe()).frame?.visible).toBe(false)
  await page.waitForTimeout(250)
  expect((await probe()).frame?.visible).toBe(false)
  expect((await probe()).fps).toBe(30)
  await page.evaluate(() => (window as unknown as { __live2dProbe: Probe }).__live2dProbe.events.onShown())
  await expect.poll(async () => (await probe()).frame?.visible).toBe(true)
})

test('legacy desktop bridge retains original textures and disables unsupported quality controls', async ({ page }) => {
  await fixture(page, true)
  await page.evaluate(() => {
    const p = (window as unknown as { __live2dProbe: Probe }).__live2dProbe
    p.snapshot({ visible: true, onBatteryPower: false, alwaysOnTop: false, ignoreMouseEvents: false, live2dEnabled: true, bounds: { x: 0, y: 0, width: 480, height: 720 } })
  })
  await expect(page.locator('.live2d-host')).toHaveAttribute('data-state', 'ready')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  const quality = page.locator('.companion-settings-popover').getByRole('combobox', { name: 'Live2D 画质' })
  await expect(quality).toBeDisabled()
  await expect(quality).toHaveValue('original')
  expect(await page.evaluate(() => (window as unknown as { __live2dProbe: Probe }).__live2dProbe.characters.every(value => value.textureScale === undefined))).toBe(true)
})
