import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 产品层美术/体验审阅：批量截全页图，供人工逐张观察。
 * 不做断言 —— 这是取证工具，不是门禁。
 *
 * 用法: npx playwright test tests/e2e/capture.spec.ts --project=desktop
 */

const OUT = path.resolve('.review-shots');

// Vue Router 路径（重构前是 /tools/*.html）
const PAGES: [string, string][] = [
  ['home', '/'],
  ['director', '/prompt-builder'],
  ['director-scene', '/prompt-builder?scene=sc001'],
  ['scene-explorer', '/scene-explorer'],
  ['showcase', '/showcase'],
  ['gallery', '/gallery'],
  ['character', '/character'],
  ['chat', '/chat'],
  ['lora', '/lora'],
  ['style', '/style'],
  ['color-script', '/color-script'],
  ['scenario', '/scenario'],
  ['control', '/control'],
  ['training', '/training'],
  ['scene-manager', '/scene-manager'],
  ['docs-index', '/docs/index.html'],
  ['docs-getting-started', '/docs/getting-started.html'],
  ['docs-philosophy', '/docs/philosophy.html'],
  ['docs-roadmap', '/docs/roadmap.html'],
];

const THEMES = ['light', 'dark'];

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); });

for (const theme of THEMES) {
  test(`capture ${theme} director-4k`, async ({ page }) => {
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.addInitScript(value => {
      try { localStorage.setItem('aics_theme', value as string); } catch { /* ignore */ }
    }, theme);
    await page.goto('/prompt-builder');
    await page.evaluate(value => {
      document.documentElement.setAttribute('data-theme', value as string);
    }, theme);
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(OUT, `${theme}-director-4k.png`),
      fullPage: false,
    });
  });

  for (const [name, url] of PAGES) {
    test(`capture ${theme} ${name}`, async ({ page }) => {
      // 先落主题再导航，避免首帧闪一次默认配色
      await page.addInitScript(value => {
        try { localStorage.setItem('aics_theme', value as string); } catch { /* ignore */ }
      }, theme);
      await page.goto(url);
      await page.evaluate(value => {
        document.documentElement.setAttribute('data-theme', value as string);
      }, theme);
      // 等字体、场景数据与首屏图片。
      // 控制面板持续轮询服务状态，networkidle 到不了，只能定时等待。
      if (url !== '/control') {
        await page.waitForLoadState('networkidle').catch(() => {});
      }
      // Full-page screenshots do not scroll the viewport, so native lazy images
      // below the fold may otherwise appear as false blank cards in audit sheets.
      await page.evaluate(() => {
        document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')
          .forEach(image => { image.loading = 'eager'; });
      });
      await page.waitForFunction(() =>
        Array.from(document.images).every(image => image.complete),
      ).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(OUT, `${theme}-${name}.png`),
        fullPage: true,
      });
    });
  }
}
