import { expect, test } from '@playwright/test'

const archivePages = [
  { path: '/character', chapter: '03', heading: '角色档案' },
  { path: '/style', chapter: '04', heading: '画风' },
  { path: '/showcase', chapter: '05', heading: '定稿样张 · Verified Showcase' },
  { path: '/gallery', chapter: '06', heading: '作品册' },
  { path: '/color-script', chapter: '07', heading: '色彩情绪' },
  { path: '/scenario', chapter: '08', heading: '剧本模式' },
] as const

test('core browsing pages share the archive hero and semantic particle language', async ({ page }) => {
  for (const entry of archivePages) {
    await page.goto(entry.path)

    const hero = page.locator('.archive-page-hero')
    await expect(hero).toBeVisible()
    await expect(hero).toHaveClass(/is-ready/)
    await expect(hero.getByRole('heading', { level: 1, name: entry.heading })).toBeVisible()
    await expect(hero.locator('.archive-register strong')).toHaveText(entry.chapter)
    await expect(hero.locator('.archive-particles canvas')).toBeVisible()

    const bitmap = await hero.locator('canvas').evaluate((canvas: HTMLCanvasElement) => ({
      width: canvas.width,
      height: canvas.height,
    }))
    expect(bitmap.width).toBeGreaterThan(200)
    expect(bitmap.height).toBeGreaterThan(200)
  }
})

test('archive content reveals and route changes leave one active page', async ({ page }) => {
  await page.goto('/style')
  await expect(page.locator('.mood-grid[data-reveal]')).toHaveClass(/revealed/)

  await page.getByRole('link', { name: /作品册/ }).click()
  await expect(page).toHaveURL(/\/gallery$/)
  await expect(page.locator('.archive-page-hero')).toHaveCount(1)
  await expect(page.locator('.gallery-toolbar[data-reveal]')).toHaveClass(/revealed/)
})

test('archive pages remain static and overflow-free on reduced-motion phones', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })

  for (const path of ['/style', '/gallery', '/showcase']) {
    await page.goto(path)
    await expect(page.locator('.archive-page-hero')).toBeVisible()
    await expect(page.locator('.archive-particles')).toHaveClass(/is-static/)

    const widths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }))
    expect(Math.max(widths.document, widths.body)).toBeLessThanOrEqual(widths.viewport + 1)
  }
})
