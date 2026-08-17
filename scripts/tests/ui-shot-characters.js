'use strict';
// 角色档案页粒子英雄区截图（对照 Arknights-FlowingPoints 参考效果）。
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => {
    if (r.url().includes('/api/')) errors.push('reqfail: ' + r.url() + ' ' + (r.failure()?.errorText ?? ''))
  })
  await page.goto('http://127.0.0.1:3000/characters', { waitUntil: 'commit', timeout: 30000 })
  console.log('goto ok, waiting for hero…')
  await page.waitForSelector('.archive-page-hero', { timeout: 15000 })
  await page.waitForTimeout(8000)
  console.log('canvas count:', await page.locator('.archive-page-hero canvas').count())
  await page.screenshot({ path: 'E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review\\particle-characters.png' })
  const hero = await page.locator('.archive-page-hero').boundingBox()
  console.log('hero box:', JSON.stringify(hero))
  console.log('errors:', errors.length ? errors : 'none')
  await browser.close()
  console.log('SHOT OK')
})().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1 })
