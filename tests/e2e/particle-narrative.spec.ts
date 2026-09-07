import { expect, test } from '@playwright/test'

test('ambient background persists across navigation without foreground effects', async ({ page }) => {
  await page.goto('/prompt-builder')
  const backdrop = await page.locator('.route-atmosphere').elementHandle()
  await expect(page.locator('.route-atmosphere')).toHaveCount(1)
  await page.getByRole('navigation').getByRole('link', { name: 'CG 画册', exact: true }).click()
  await expect(page).toHaveURL(/showcase$/)
  expect(await backdrop!.evaluate(el => el.isConnected)).toBe(true)
  await expect(page.locator('.route-atmosphere canvas,.route-cut,.sakura-fall')).toHaveCount(0)
})

test('workspace state bars retain real character and service context', async ({ page }) => {
  await page.goto('/chat')
  const bar = page.locator('.workspace-archive-bar')
  await expect(bar).toContainText('绫地宁宁')
  await page.locator('.character-tab').filter({ hasText: '夏目' }).click()
  await expect(bar).toContainText('四季夏目')
  await page.goto('/control')
  await expect(page.locator('.workspace-state')).not.toHaveText('')
})

test('workspaces keep one concise state bar', async ({ page }) => {
  for (const path of ['/prompt-builder', '/chat', '/lora', '/scene-manager', '/control']) {
    await page.goto(path)
    await expect(page.locator('.workspace-archive-bar')).toHaveCount(1)
    await expect(page.locator('.workspace-state')).toBeVisible()
  }
})

test('reduced motion leaves a static ambient background on phones', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  expect(await page.locator('.route-atmosphere').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
  await expect(page.locator('.route-progress,.route-index')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391)
})
