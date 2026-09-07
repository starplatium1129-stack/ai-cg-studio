import { expect, test } from '@playwright/test'

test('interface sound is opt-in and persists the explicit choice', async ({ page }) => {
  await page.goto('/')

  const sound = page.getByRole('button', { name: '开启界面音效' })
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => localStorage.getItem('aics_interface_sound_v1'))).toBeNull()

  await sound.click()
  await expect(page.getByRole('button', { name: '关闭界面音效' })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => localStorage.getItem('aics_interface_sound_v1'))).toBe('1')

  await page.reload()
  await expect(page.getByRole('button', { name: '关闭界面音效' })).toHaveAttribute('aria-pressed', 'true')
})

test('navigation uses hand-drawn icons and a settled selection indicator', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: '主导航' })
  const sceneLink = nav.getByRole('link', { name: '灵感', exact: true })
  await expect(sceneLink.locator('svg.archive-icon')).toHaveCount(1)
  await sceneLink.click()
  await expect(page).toHaveURL(/scene-explorer$/)
  await expect(sceneLink).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.nav-links > .animated-selection')).toBeVisible()
  await expect(page.locator('.route-loader')).not.toHaveClass(/active/)
})

test('entering a character room keeps the interface clear of transition overlays', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation').getByRole('link', { name: '房间', exact: true }).click()
  await expect(page).toHaveURL(/chat$/)
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.locator('.route-cut,.interaction-impulse')).toHaveCount(0)
})

test('gallery empty content uses the shared archive state panel', async ({ page }) => {
  await page.goto('/gallery')

  const state = page.locator('.archive-state-panel[data-kind="empty"]')
  await expect(state).toBeVisible()
  await expect(state).toContainText('展墙还在等你的第一幅作品')
  await expect(state.getByRole('link', { name: '开始绘制' })).toBeVisible()
})

test('scene cards keep drawing actions subordinate until interaction', async ({ page }) => {
  await page.goto('/scene-explorer')

  await expect(page.locator('.scene-grid').getByRole('link', { name: '开始绘制' }).first()).toHaveClass(/scene-draw-action/)
})

test('global motion feedback is suppressed when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const state = await page.evaluate(() => ({
    loader: getComputedStyle(document.querySelector('.route-loader')!).display,
    overlays: document.querySelectorAll('.route-cut,.interaction-impulse').length,
  }))
  expect(state).toEqual({ loader: 'none', overlays: 0 })
})

test('repeated navigation keeps a visible route view mounted', async ({ page }) => {
  await page.goto('/')

  for (const destination of [
    { label: '灵感', url: /\/scene-explorer$/, heading: '灵感场景' },
    { label: 'CG 画册', url: /\/showcase$/, heading: '把心动，一页页收藏。' },
    { label: '作品册', url: /\/gallery$/, heading: '作品册' },
  ]) {
    if (destination.label === '作品册') await page.locator('.nav-more summary').click()
    await page.getByRole('navigation').getByRole('link', { name: destination.label, exact: true }).click()
    await expect(page).toHaveURL(destination.url)
    await expect(page.locator('#main')).toContainText(destination.heading)
    expect(await page.locator('#main .route-view').evaluateAll(views => views.some(view => {
      const style = getComputedStyle(view)
      return style.opacity !== '0' && view.getBoundingClientRect().height > 0
    }))).toBe(true)
  }
})
