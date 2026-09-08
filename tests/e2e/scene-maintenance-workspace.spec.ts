import { expect, test } from '@playwright/test'
import type { CompanionDesktopBridge } from '../../src/types/desktop'
import type { SceneDraft } from '../../src/types/api'
import { GUEST_GUIDE_DISMISSED_KEY, THEME_KEY } from '../../src/utils/storageKeys'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => {
    localStorage.setItem(key, '1')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { (window as unknown as { maintenanceCopy: string }).maintenanceCopy = value } } })
  }, GUEST_GUIDE_DISMISSED_KEY)
})

for (const [theme, width, height] of [['dark', 1440, 960], ['light', 1280, 800], ['dark', 1024, 800]] as const) {
  test(`scene maintenance workspace ${theme} ${width}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height })
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: THEME_KEY, value: theme })
    await page.goto('/scene-manager')
    const catalog = page.locator('.maintenance-catalog:visible')
    await expect(catalog.locator('.catalog-record').first()).toBeVisible()
    await page.getByRole('searchbox', { name: '搜索管理场景' }).fill('sc005')
    await expect(catalog.locator('.catalog-record')).toHaveCount(1)
    await expect(page.getByRole('region', { name: '场景详情', exact: true })).toContainText('sc005')
    await page.screenshot({ path: testInfo.outputPath(`scene-maintenance-${theme}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    const workspace = await catalog.locator('.catalog-workspace').boundingBox()
    expect(workspace!.y + workspace!.height).toBeLessThanOrEqual(height)
    await catalog.getByRole('button', { name: '提示词', exact: true }).click()
    await expect(catalog.locator('.inspector-prompt').first()).toBeVisible()
    await catalog.getByRole('button', { name: '复制 JSON', exact: true }).click()
    const copied = await page.evaluate(() => JSON.parse((window as unknown as { maintenanceCopy: string }).maintenanceCopy) as { id: string })
    expect(copied.id).toBe('sc005')
    await page.getByRole('button', { name: /蓝图库/ }).click()
    await expect(catalog.locator('.catalog-record').first()).toBeVisible()
    await page.getByRole('button', { name: /^场景库/ }).click()
    await expect(page.getByRole('searchbox', { name: '搜索管理场景' })).toHaveValue('sc005')
    await catalog.getByRole('button', { name: '清除筛选' }).click()
    await catalog.locator('.catalog-record').first().focus()
    await page.keyboard.press('ArrowDown')
    await expect(catalog.locator('.catalog-record').nth(1)).toBeFocused()
    await expect(catalog.locator('.catalog-record').nth(1)).toHaveAttribute('aria-pressed', 'true')
    expect(errors).toEqual([])
  })
}

test('packaged desktop can inspect records without enabling writes', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.companionDesktop = {
      isDesktop: true, isPackaged: async () => true,
      getWindowState: async () => ({ maximized: false, focused: true }),
      onMaximizedChanged: () => 1, offMaximizedChanged: () => {},
    } as unknown as CompanionDesktopBridge
  })
  await page.goto('/scene-manager')
  await expect(page.locator('.manager-readonly')).toBeVisible()
  const catalog = page.locator('.maintenance-catalog:visible')
  await expect(catalog.locator('.catalog-record').first()).toBeVisible()
  await catalog.locator('.catalog-record').nth(1).click()
  await expect(catalog.getByRole('button', { name: '编辑', exact: true })).toBeDisabled()
  await expect(catalog.getByRole('button', { name: '新增场景' })).toBeDisabled()
  await catalog.getByRole('button', { name: '提示词', exact: true }).click()
  await expect(catalog.locator('.inspector-prompt').first()).toBeVisible()
  await expect(catalog.getByRole('button', { name: '复制 JSON' })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('desktop-scene-maintenance.png'), fullPage: true })
})

test('editing a title preserves prompt data and uses the existing save contract', async ({ page }) => {
  let saved: { scenes: SceneDraft[] } | undefined
  await page.route('**/api/maintenance/scenes', async route => {
    saved = route.request().postDataJSON() as { scenes: SceneDraft[] }
    await route.fulfill({ json: { ok: true, count: saved.scenes.length, backup: 'workspace-test-backup' } })
  })
  await page.goto('/scene-manager')
  const catalog = page.locator('.maintenance-catalog:visible')
  await catalog.getByRole('button', { name: '复制 JSON' }).click()
  const original = await page.evaluate(() => JSON.parse((window as unknown as { maintenanceCopy: string }).maintenanceCopy) as SceneDraft)
  await catalog.getByRole('button', { name: '编辑', exact: true }).click()
  await page.getByLabel('标题 *', { exact: true }).fill('维护布局回归测试标题')
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await expect(catalog.locator('h2')).toHaveText('维护布局回归测试标题')
  await page.getByRole('button', { name: '保存到项目', exact: true }).click()
  await expect(page.locator('.maintenance-state')).not.toHaveClass(/dirty/)
  const updated = saved?.scenes.find(scene => scene.id === original.id)
  expect(updated?.title).toBe('维护布局回归测试标题')
  for (const field of ['prompt', 'negative', 'animaCaption', 'recommendedSize', 'rating', 'mature']) expect(updated?.[field]).toEqual(original[field])
})
