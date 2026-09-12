import { expect, test } from '@playwright/test'
import type { CompanionDesktopBridge } from '../../src/types/desktop'

// CSS viewport sizes represent Windows logical pixels; DPR models rendering scale.
// Native WebView2, monitor switching and OS window controls still need device acceptance.
const displays = [
  { name: 'minimum-window', width: 1024, height: 720, scale: 1 },
  { name: 'laptop', width: 1366, height: 768, scale: 1 },
  { name: '1080p-125', width: 1536, height: 864, scale: 1.25 },
  { name: '1080p-150', width: 1280, height: 720, scale: 1.5 },
  { name: '1440p-150', width: 1707, height: 960, scale: 1.5 },
  { name: 'wide-desktop', width: 2560, height: 1440, scale: 1 },
  { name: '4k-100', width: 3840, height: 2160, scale: 1 },
  { name: '4k-125', width: 3072, height: 1728, scale: 1.25 },
  { name: '4k-150', width: 2560, height: 1440, scale: 1.5 },
  { name: '4k-200', width: 1920, height: 1080, scale: 2 },
  { name: '4k-150-workarea', width: 2560, height: 1392, scale: 1.5 },
  { name: '4k-150-windowed', width: 1920, height: 1080, scale: 1.5 },
]

for (const theme of ['dark', 'light']) {
  for (const display of displays) {
    test(`desktop workspace ${theme} ${display.name}`, async ({ browser }, info) => {
      const context = await browser.newContext({ viewport: { width: display.width, height: display.height }, deviceScaleFactor: display.scale, reducedMotion: 'reduce' })
      await context.addInitScript(value => {
        localStorage.setItem('aics_theme', value)
        localStorage.setItem('aics_guest_guide_dismissed', '1')
        window.companionDesktop = {
          isDesktop: true, getWindowState: async () => ({ maximized: false, focused: true }),
          onMaximizedChanged: () => 1, offMaximizedChanged: () => {},
          minimizeWindow: () => {}, toggleMaximizeWindow: () => {}, closeWindow: () => {},
        } as unknown as CompanionDesktopBridge
      }, theme)
      const page = await context.newPage()
      try {
        await page.goto(`${info.project.use.baseURL}/prompt-builder?scene=sc006`)
        await expect(page.locator('.desktop-titlebar')).toBeVisible()
        const generate = page.getByRole('button', { name: '生成图片', exact: true })
        await expect(page.locator('.workspace-archive-bar')).toBeVisible()
        const basic = await generate.boundingBox()
        expect(basic!.y + basic!.height).toBeLessThanOrEqual(display.height)
        await page.getByRole('button', { name: '专家模式', exact: true }).click()
        const materials = (await page.locator('#drawing-materials').boundingBox())!
        const canvas = (await page.locator('#drawing-canvas').boundingBox())!
        const inspector = (await page.locator('.director-inspector').boundingBox())!
        expect(materials.x + materials.width).toBeLessThanOrEqual(canvas.x)
        expect(canvas.x + canvas.width).toBeLessThanOrEqual(inspector.x)
        expect(Math.abs(materials.y - inspector.y)).toBeLessThan(2)
        const button = (await generate.boundingBox())!
        expect(button.y + button.height).toBeLessThanOrEqual(display.height)
        expect(inspector.y + inspector.height).toBeLessThanOrEqual(display.height)
        if (display.width >= 1920) {
          expect(inspector.x + inspector.width - materials.x).toBeGreaterThan(display.width * .94)
          expect(materials.width).toBeGreaterThanOrEqual(300)
          expect(inspector.width).toBeGreaterThanOrEqual(360)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
        const list = page.locator('#stepScene > .scene-list')
        await expect(list.locator('.scene-card').first()).toBeVisible()
        const listBox = (await list.boundingBox())!
        const contentBox = (await page.locator('#material-scenes').boundingBox())!
        expect(contentBox.y + contentBox.height - listBox.y - listBox.height).toBeLessThanOrEqual(24)
        await list.hover()
        expect(Math.abs((await list.boundingBox())!.height - listBox.height)).toBeLessThan(2)
        const search = page.locator('#stepScene .scene-search')
        const searchTop = (await search.boundingBox())!.y
        await page.mouse.wheel(0, 500)
        await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
        expect(Math.abs((await search.boundingBox())!.y - searchTop)).toBeLessThan(2)
        const beforeCount = await list.locator('.scene-card').count()
        await list.locator('.scene-more').click()
        await expect(list.locator('.scene-card')).toHaveCount(beforeCount + 20)
        await list.locator('.scene-card').last().focus()
        await list.evaluate(el => { el.scrollTop = el.scrollHeight })
        await expect.poll(() => list.evaluate(el => {
          const last = [...el.querySelectorAll('.scene-card')].at(-1)!.getBoundingClientRect()
          return last.bottom - el.getBoundingClientRect().bottom
        })).toBeLessThanOrEqual(1)
        await list.evaluate(el => { el.scrollTop = 0 })
        await page.getByRole('tab', { name: '提示词', exact: true }).click()
        await expect(page.locator('#inspector-tab-prompt')).toBeFocused()
        await page.screenshot({ path: info.outputPath('desktop-workspace.png') })
      } finally { await context.close() }
    })
  }
}
