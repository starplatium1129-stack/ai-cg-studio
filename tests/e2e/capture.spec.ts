import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// 产品层美术/体验审阅用:批量截全页图,供人工逐张观察。
// 不做断言 —— 这是取证工具,不是门禁。
// 用法: npx playwright test tests/e2e/capture.spec.ts --project=desktop

const OUT = path.resolve('.review-shots');

const PAGES: [string, string][] = [
  ['home', '/index.html'],
  ['director', '/tools/prompt-builder.html'],
  ['scene-explorer', '/tools/scene-explorer.html'],
  ['showcase', '/tools/showcase.html'],
  ['gallery', '/tools/gallery.html'],
  ['character', '/tools/character.html'],
  ['chat', '/tools/chat.html'],
  ['lora', '/tools/lora.html'],
  ['style', '/tools/style.html'],
  ['color-script', '/tools/color-script.html'],
  ['scenario', '/tools/scenario.html'],
  ['control', '/tools/control.html'],
  ['scene-manager', '/tools/scene-manager.html'],
  ['docs-index', '/docs/index.html'],
  ['docs-getting-started', '/docs/getting-started.html'],
  ['docs-philosophy', '/docs/philosophy.html'],
  ['docs-roadmap', '/docs/roadmap.html']
];

const THEMES = ['light', 'dark'];

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); });

for (const theme of THEMES) {
  for (const [name, url] of PAGES) {
    test(`capture ${theme} ${name}`, async ({ page }) => {
      await page.goto(url);
      await page.evaluate((value) => {
        document.documentElement.setAttribute('data-theme', value);
        try { localStorage.setItem('aics_theme', value); } catch { /* ignore */ }
      }, theme);
      // 等字体与首屏图片
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(OUT, `${theme}-${name}.png`),
        fullPage: true
      });
    });
  }
}
