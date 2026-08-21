'use strict';
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.on('response', (r) => { if (r.url().includes('127.0.0.1:3000') || r.url().includes('localhost:3000')) console.log('resp', r.status(), r.url().slice(0, 80)) })
  console.log('goto video-studio…')
  await page.goto('http://127.0.0.1:3000/video-studio', { waitUntil: 'commit', timeout: 20000 })
  console.log('video-studio commit ok')
  await page.waitForTimeout(2000)
  console.log('goto characters…')
  await page.goto('http://127.0.0.1:3000/characters', { waitUntil: 'commit', timeout: 20000 })
  console.log('characters commit ok')
  await page.waitForTimeout(5000)
  console.log('canvas count:', await page.locator('.archive-page-hero canvas').count())
  await page.screenshot({ path: 'E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review\\particle-characters.png' })
  await browser.close()
  console.log('DIAG OK')
})().catch((e) => { console.error('DIAG FAIL', e.message); process.exitCode = 1 })
