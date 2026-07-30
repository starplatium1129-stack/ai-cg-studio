import { expect, test } from '@playwright/test'

test('scene atlas particles morph with the selected archive theme', async ({ page }) => {
  await page.goto('/scene-explorer')

  const field = page.locator('.scene-atlas-particles')
  await expect(field).toBeVisible()
  await expect(field).toHaveAttribute('aria-label', /全部场景/)
  await expect(field.locator('canvas')).toBeVisible()

  const canvasSize = await field.locator('canvas').evaluate((canvas: HTMLCanvasElement) => ({
    cssWidth: canvas.getBoundingClientRect().width,
    cssHeight: canvas.getBoundingClientRect().height,
    bitmapWidth: canvas.width,
    bitmapHeight: canvas.height,
  }))
  expect(canvasSize.cssWidth).toBeGreaterThan(240)
  expect(canvasSize.cssHeight).toBeGreaterThan(200)
  expect(canvasSize.bitmapWidth).toBeGreaterThanOrEqual(canvasSize.cssWidth)
  expect(canvasSize.bitmapHeight).toBeGreaterThanOrEqual(canvasSize.cssHeight)

  await page.locator('.scene-cats').getByRole('button', { name: /恋爱/ }).click()
  await expect(field).toHaveAttribute('aria-label', /恋爱场景/)
  await expect(field.locator('.particle-caption')).toHaveText('ARCHIVE 02 / 09')
})

test('particle atmosphere respects reduced motion and narrow screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/scene-explorer')

  const field = page.locator('.scene-atlas-particles')
  await expect(field).toHaveClass(/is-static/)
  await expect(field.locator('canvas')).toBeVisible()

  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(Math.max(overflow.document, overflow.body)).toBeLessThanOrEqual(overflow.viewport + 1)
})
