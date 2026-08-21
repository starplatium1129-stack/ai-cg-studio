'use strict';
// 分镜模式 UI 冒烟：打开视频页 → 切到「分镜短片」→ 断言编辑器渲染 → 应用内截图。
const { chromium } = require('@playwright/test');
const fs = require('fs');

(async () => {
  const outDir = 'E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review';
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto('http://127.0.0.1:3000/video-studio', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outDir + '\\shot-editor-0-entry.png' });

  const shotsCard = page.getByRole('button', { name: /分镜短片/ });
  const count = await shotsCard.count();
  console.log('分镜短片 mode card count:', count);
  if (count === 0) throw new Error('分镜短片 mode card not found');
  const disabled = await shotsCard.isDisabled();
  console.log('分镜短片 card disabled:', disabled, '(期望 false：H3 权重已就绪)');
  await shotsCard.click();
  await page.waitForTimeout(1200);

  const heading = page.getByRole('heading', { name: /分镜清单/ });
  console.log('分镜清单 heading count:', await heading.count());
  const addBtn = page.getByRole('button', { name: /添加镜头/ });
  console.log('添加镜头 button count:', await addBtn.count());
  await addBtn.first().click();
  await page.waitForTimeout(300);
  const promptBoxes = await page.locator('textarea[placeholder*="画面描述"], textarea[placeholder*="主体动作"]').count();
  console.log('shot prompt textareas:', promptBoxes);
  await page.screenshot({ path: outDir + '\\shot-editor-1-mode.png' });

  // 加第二个镜头 + 填对白，检查提交按钮状态
  await addBtn.first().click();
  const textareas = page.locator('.shot-field-prompt textarea');
  await textareas.nth(0).fill('少女在雨夜车站撑伞等待，列车进站的风掀起裙摆，她抬头望向站台尽头。');
  await textareas.nth(1).fill('少女推开车门走进车厢，车窗上的雨痕倒映着灯光。');
  const dialogueInputs = page.locator('input[maxlength="300"]');
  await dialogueInputs.nth(0).fill('我在这站下车。');
  const submitBtn = page.getByRole('button', { name: /生成全部镜头/ });
  console.log('生成全部镜头 enabled:', await submitBtn.isEnabled());
  await page.screenshot({ path: outDir + '\\shot-editor-2-filled.png' });

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  console.log('UI SMOKE OK');
})().catch((error) => {
  console.error('UI SMOKE FAIL:', error.message);
  process.exitCode = 1;
});
