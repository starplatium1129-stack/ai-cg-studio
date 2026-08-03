import { expect, test } from '@playwright/test'

test('route atmosphere persists and updates its archive identity across navigation', async ({ page }) => {
  await page.goto('/prompt-builder')

  const atmosphere = page.locator('.route-atmosphere')
  const initialCanvas = atmosphere.locator('canvas')
  await expect(atmosphere).toBeVisible()
  await expect(initialCanvas).toBeVisible()
  await expect(atmosphere.locator('.route-index > span')).toHaveText('01')
  await expect(page.locator('.workspace-archive-bar')).toContainText('DIRECTOR CONSOLE')

  await page.getByRole('button', { name: '专家模式', exact: true }).click()
  await expect(page.locator('.pb')).toHaveAttribute('data-director-mode', 'pro')
  await expect(page.locator('.workspace-archive-bar')).toHaveAttribute('data-shape', 'spark')

  await page.getByRole('link', { name: /作品册/ }).click()
  await expect(page).toHaveURL(/\/gallery$/)
  await expect(page.locator('.route-atmosphere')).toHaveCount(1)
  await expect(page.locator('.archive-page-hero .archive-register strong')).toHaveText('06')
  await expect(page.locator('.route-atmosphere canvas')).toHaveCount(0)
  await expect(page.locator('.archive-page-hero canvas')).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('workspace state bars use real character and service state', async ({ page }) => {
  await page.goto('/chat')

  const bar = page.locator('.workspace-archive-bar')
  await expect(bar).toContainText('CHARACTER ROOM')
  await expect(bar).toContainText('绫地宁宁')

  await page.locator('.character-tab').filter({ hasText: '夏目' }).click()
  await expect(bar).toContainText('四季夏目')
  await expect(bar).toHaveAttribute('data-shape', 'lantern')

  await page.goto('/control')
  await expect(page.locator('.route-atmosphere')).toHaveCount(1)
  await expect(page.locator('.workspace-archive-bar')).toContainText('LOCAL CONTROL')
  await expect(page.locator('.workspace-state')).not.toHaveText('')
})

test('all complex workspaces expose one compact archive status bar', async ({ page }) => {
  const pages = [
    ['/prompt-builder', '01'],
    ['/chat', '09'],
    ['/lora', '10'],
    ['/training', '11'],
    ['/scene-manager', '12'],
    ['/control', '13'],
  ] as const

  for (const [path, chapter] of pages) {
    await page.goto(path)
    const bar = page.locator('.workspace-archive-bar')
    await expect(bar).toHaveCount(1)
    await expect(bar.locator('.workspace-code > span')).toHaveText(chapter)
    await expect(bar.locator('.workspace-state')).toBeVisible()
  }
})

test('narrative atmosphere respects reduced motion and mobile width', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/chat')

  await expect(page.locator('.route-atmosphere .semantic-particle-field')).toHaveClass(/is-static/)
  const motion = await page.evaluate(() => ({
    scan: getComputedStyle(document.querySelector('.route-scan')!).display,
    radar: getComputedStyle(document.querySelector('.workspace-radar i:last-child')!).animationName,
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(motion.scan).toBe('none')
  expect(motion.radar).toBe('none')
  expect(Math.max(motion.document, motion.body)).toBeLessThanOrEqual(motion.viewport + 1)
})
