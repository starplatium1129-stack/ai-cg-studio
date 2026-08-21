'use strict';
// 冒烟：绘图页按钮区 + 视频页 ?mode=shots 深链自动进入分镜模式。
const { chromium } = require('@playwright/test');
const fs = require('fs');

(async () => {
  const outDir = 'E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review';
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  // 1) 绘图页加载（Anima 后端可能离线，仅确认页面可渲染、无脚本错误）
  await page.goto('http://127.0.0.1:3000/prompt-builder', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: outDir + '\\shots-integration-draw.png' });

  // 2) 视频页深链 ?mode=shots：应自动选中「分镜短片」并渲染编辑器
  await page.goto('http://127.0.0.1:3000/video-studio?mode=shots', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  const shotsCardActive = await page.getByRole('button', { name: /分镜短片/ }).evaluate((el) => el.classList.contains('active'));
  const addBtn = await page.getByRole('button', { name: /添加镜头/ }).count();
  const toolbar = await page.locator('.shot-toolbar').count();
  console.log('mode=shots 深链：分镜卡片选中 =', shotsCardActive, '| 添加镜头 =', addBtn, '| 工具栏 =', toolbar);
  await page.screenshot({ path: outDir + '\\shots-integration-video.png' });

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  console.log('INTEGRATION SMOKE OK');
})().catch((error) => {
  console.error('INTEGRATION SMOKE FAIL:', error.message);
  process.exitCode = 1;
});
