import { expect, test, type Page } from '@playwright/test';

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !/favicon|ERR_CONNECTION_REFUSED|404|Failed to load resource.*50[23]|Content Security Policy.*fonts\.googleapis/.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

test('home and director load their external controllers', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/');
  await expect(page.locator('.hero-title')).toContainText('绫季绘境');
  await expect(page.locator('#featuredScenes .sc-strip').first()).toBeVisible();
  await expect(page.locator('#sceneCountCopy')).not.toContainText('加载中');

  await page.goto('/tools/prompt-builder.html');
  await expect(page.locator('#storyInput')).toBeVisible();
  await expect(page.locator('#sceneCountBadge')).not.toHaveText('');
  await expect(page.locator('#sceneGrid .scene-card').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('scene manager loads project data without editing source files', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/tools/scene-manager.html');
  await expect(page.locator('#sceneTable tr').first()).toBeVisible();
  await expect(page.locator('#stats')).toContainText('297');
  await expect(page.locator('#pendingCount')).toHaveText('0');
  await expect(page.locator('#saveProjectBtn')).toBeDisabled();

  await page.getByRole('button', { name:'+ 新增场景' }).click();
  // 断言可见性而非某个 class:弹层已收敛到全局 .overlay + hidden 属性,
  // 测行为不测实现,换弹层实现时这条断言仍然有效。
  await expect(page.locator('#editModal')).toBeVisible();
  await expect(page.locator('#formId')).toHaveValue(/sc\d+/);
  await page.getByRole('button', { name:'取消' }).click();
  await expect(page.locator('#editModal')).toBeHidden();
  expect(errors).toEqual([]);
});

test('gallery preserves horizontal and vertical art in the immersive viewer', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/tools/gallery.html');
  const svg = (width: number, height: number, color: string) =>
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`)}`;
  await page.evaluate(async records => {
    await window.AICKVStore.set('aics_pb_history', records);
  }, [
    { id:'e2e-landscape', scene:'sc001', timestamp:Date.now(), size:'1200x600', image_data:svg(1200, 600, '#7057c7'), favorite:true },
    { id:'e2e-portrait', scene:'sc005', timestamp:Date.now() - 1, size:'600x1200', image_data:svg(600, 1200, '#d87898') }
  ]);
  await page.reload();

  await expect(page.locator('.artwork')).toHaveCount(2);
  const ratios = await page.locator('.artwork-media').evaluateAll(nodes => nodes.map(node => {
    const raw = getComputedStyle(node).aspectRatio;
    const parts = raw.split('/').map(part => Number(part.trim()));
    return parts.length === 2 && parts[1] ? parts[0] / parts[1] : Number(raw);
  }));
  expect(ratios[0]).toBeCloseTo(2, 5);
  expect(ratios[1]).toBeCloseTo(0.5, 5);
  await page.locator('.artwork-button').first().click();
  await expect(page.locator('#artViewer')).toHaveClass(/open/);
  await expect(page.locator('.viewer-image')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#viewerPosition')).toContainText('2 / 2');
  await page.keyboard.press('Escape');
  await expect(page.locator('#artViewer')).not.toHaveClass(/open/);
  expect(errors).toEqual([]);
});

test('home page stays inside the performance budget', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#featuredScenes .sc-strip').first()).toBeVisible();
  const budget = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return {
      requests:resources.length,
      scriptBytes:resources.filter(item => item.initiatorType === 'script').reduce((sum, item) => sum + item.decodedBodySize, 0),
      transferBytes:resources.reduce((sum, item) => sum + item.transferSize, 0),
      domNodes:document.querySelectorAll('*').length
    };
  });
  expect(budget.requests).toBeLessThanOrEqual(45);
  expect(budget.scriptBytes).toBeLessThanOrEqual(650_000);
  // Current art-led home page is ~2.56 MB cold; keep a small regression margin.
  expect(budget.transferBytes).toBeLessThanOrEqual(2_800_000);
  expect(budget.domNodes).toBeLessThanOrEqual(1_500);
});

test('roadmap exposes prioritized phases and product boundaries', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/docs/roadmap.html');
  await expect(page.getByRole('heading', { name:'产品路线图', level:1 })).toBeVisible();
  await expect(page.locator('.phase')).toHaveCount(5);
  await expect(page.getByRole('heading', { name:'可靠性精修' })).toBeVisible();
  await expect(page.getByRole('heading', { name:'创作体验增强' })).toBeVisible();
  await expect(page.getByRole('heading', { name:'产品边界' })).toBeVisible();
  await expect(page.getByText('暂不计划', { exact:true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('control panel loads service badges without runtime errors', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/tools/control.html');
  await expect(page.locator('.page-kicker')).toContainText('Local control room');
  await expect(page.getByRole('heading', { name:'控制面板', level:1 })).toBeVisible();
  await expect(page.locator('.nav-back')).toBeVisible();
  await expect(page.locator('#badge')).toBeVisible();
  await expect(page.locator('#sd-badge')).toBeVisible();
  await expect(page.locator('#check-services')).toBeVisible();
  expect(errors).toEqual([]);
});

test('character room shell mounts without runtime errors', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/tools/chat.html');
  await expect(page.locator('.page-kicker')).toContainText('Character room');
  await expect(page.getByRole('heading', { name:'角色房间', level:1 })).toBeVisible();
  await expect(page.locator('.nav-back')).toBeVisible();
  await expect(page.locator('#chatInput')).toBeVisible();
  await expect(page.locator('#sendBtn')).toBeVisible();
  await expect(page.locator('#portraitMain')).toBeVisible();
  expect(errors).toEqual([]);
});

declare global {
  interface Window {
    AICKVStore: { set(key: string, value: unknown): Promise<boolean> };
  }
}
