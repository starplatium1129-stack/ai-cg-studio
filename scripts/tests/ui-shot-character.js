'use strict';
// 角色档案页（/character）粒子英雄区截图（对照 Arknights-FlowingPoints 参考效果）。
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('http://127.0.0.1:3000/character', { waitUntil: 'commit', timeout: 30000 })
  console.log('goto ok')
  await page.waitForSelector('.archive-page-hero', { timeout: 15000 })
  console.log('hero found')
  // 等待角色数据与点云加载 + 粒子成形
  await page.waitForTimeout(9000)
  const canvas = page.locator('.archive-page-hero canvas')
  console.log('canvas count:', await canvas.count(), 'visible:', await canvas.isVisible().catch(() => false))
  const box = await canvas.boundingBox()
  console.log('canvas box:', JSON.stringify(box))
  await page.screenshot({ path: 'E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review\\particle-character-hero.png' })
  // 英雄区裁剪特写
  const hero = await page.locator('.archive-page-hero').boundingBox()
  if (hero) {
    await page.screenshot({ path: 'E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review\\particle-character-hero-crop.png', clip: { x: hero.x, y: hero.y, width: hero.width, height: Math.min(hero.height, 700) } })
  }
  console.log('errors:', errors.length ? errors : 'none')
  await browser.close()
  console.log('SHOT OK')
})().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1 })
