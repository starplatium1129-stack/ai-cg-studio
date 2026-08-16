'use strict';
// 角色档案页（/character）粒子英雄区主题对比截图：
// 深色主题（screen 混合）vs 浅色主题（source-over + 深色衬底），
// 验证亮色主题下点阵可读性（2026-08-16 用户反馈「亮色都看不清了」）。
const { chromium } = require('@playwright/test');

const OUT = 'E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review\\'
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('http://127.0.0.1:3000/character', { waitUntil: 'commit', timeout: 30000 })
  await page.waitForSelector('.archive-page-hero', { timeout: 15000 })
  await wait(9000) // 角色数据 + 点云加载 + 粒子成形

  const hero = await page.locator('.archive-page-hero').boundingBox()
  if (!hero) throw new Error('hero not visible')
  const clip = { x: hero.x, y: hero.y, width: hero.width, height: Math.min(hero.height, 700) }

  const theme = await page.evaluate(() => document.documentElement.dataset.theme)
  console.log('default theme:', theme)
  // 显式切深色主题截图（对照：screen 混合路径不得回归）
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await wait(1200)
  await page.screenshot({ path: OUT + 'particle-theme-dark.png', clip })
  console.log('dark shot ok')

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await wait(1200) // MutationObserver → rAF → readPalette → draw
  const canvasVisible = await page.locator('.archive-page-hero canvas').isVisible().catch(() => false)
  console.log('light canvas visible:', canvasVisible)
  await page.screenshot({ path: OUT + 'particle-theme-light.png', clip })
  console.log('light shot ok')

  console.log('errors:', errors.length ? errors : 'none')
  await browser.close()
  console.log('SHOT OK')
})().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1 })
