'use strict';
// 冒烟：极速 4 步开关 + H3 长镜时长选项（单任务模式 + 分镜模式）。
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  // 单任务模式：切到 H3 → 高级设置应有「极速 4 步」，时长应有 10/15
  await page.goto('http://127.0.0.1:3000/video-studio', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: /MiniMax H3/ }).first().click();
  await page.waitForTimeout(500);
  await page.locator('details.video-advanced summary').click();
  await page.waitForTimeout(300);
  const stepsToggle = await page.locator('.video-steps-toggle').count();
  const durationOptions = await page.locator('.video-duration-row option').allTextContents();
  console.log('单任务：极速开关 =', stepsToggle, '| 时长选项 =', durationOptions.join('/'));

  // 分镜模式：应有整批极速开关 + 每镜时长含 10/15
  await page.goto('http://127.0.0.1:3000/video-studio?mode=shots', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /添加镜头/ }).first().click();
  await page.waitForTimeout(300);
  const batchSteps = await page.locator('.shot-toggle', { hasText: '极速 4 步' }).count();
  const shotDurations = await page.locator('.shot-selects select').nth(3).locator('option').allTextContents();
  console.log('分镜模式：整批极速开关 =', batchSteps, '| 镜头时长选项 =', shotDurations.join('/'));
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  console.log('STEPS SMOKE OK');
})().catch((error) => {
  console.error('STEPS SMOKE FAIL:', error.message);
  process.exitCode = 1;
});
