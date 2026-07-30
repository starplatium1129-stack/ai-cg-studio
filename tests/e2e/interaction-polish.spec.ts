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

test('navigation uses the archive icon system and emits pointer feedback', async ({ page }) => {
  await page.goto('/')

  const sceneLink = page.getByRole('link', { name: '灵感场景', exact: true })
  await expect(sceneLink.locator('svg.archive-icon')).toHaveCount(1)
  await sceneLink.dispatchEvent('pointerdown', { clientX: 180, clientY: 40, pointerType: 'mouse' })
  await expect(page.locator('.interaction-impulse')).toHaveClass(/active/)

  await sceneLink.click()
  await expect(page).toHaveURL(/\/scene-explorer$/)
  await expect(page.locator('.route-loader')).toHaveCount(1)
  await expect(page.locator('.route-cut')).toHaveClass(/active/)
  await expect(page.locator('.route-cut-register')).toContainText('SCENE ARCHIVE')
})

test('gallery empty content uses the shared archive state panel', async ({ page }) => {
  await page.goto('/gallery')

  const state = page.locator('.archive-state-panel[data-kind="empty"]')
  await expect(state).toBeVisible()
  await expect(state).toContainText('展墙还在等第一幅作品')
  await expect(state.getByRole('link', { name: '开始绘制' })).toBeVisible()
})

test('global motion feedback is suppressed when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const state = await page.evaluate(() => ({
    loader: getComputedStyle(document.querySelector('.route-loader')!).display,
    impulse: getComputedStyle(document.querySelector('.interaction-impulse')!).display,
  }))
  expect(state).toEqual({ loader: 'none', impulse: 'none' })
})

test('repeated navigation keeps a visible route view mounted', async ({ page }) => {
  await page.goto('/')

  for (const destination of [
    { label: '灵感场景', url: /\/scene-explorer$/, heading: '灵感场景' },
    { label: '效果样张', url: /\/showcase$/, heading: '场景，实际能画成什么样' },
    { label: '作品册', url: /\/gallery$/, heading: '作品册' },
  ]) {
    await page.getByRole('link', { name: destination.label, exact: true }).click()
    await expect(page).toHaveURL(destination.url)
    await expect(page.locator('#main')).toContainText(destination.heading)
    expect(await page.locator('#main .route-view').evaluateAll(views => views.some(view => {
      const style = getComputedStyle(view)
      return style.opacity !== '0' && view.getBoundingClientRect().height > 0
    }))).toBe(true)
  }
})
