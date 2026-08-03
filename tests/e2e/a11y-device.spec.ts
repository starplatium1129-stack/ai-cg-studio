import { expect, test, type Page } from '@playwright/test';

/**
 * 无障碍与多设备回归（Vue SPA 版本）
 *
 * 骨架断言从各页 HTML 移到 AppLayout：整站共用一个 skip-link + main landmark，
 * 所以这里逐路由验证「唯一 landmark」而不是每页各自实现一份。
 */

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  const ignore = /favicon|ERR_CONNECTION_REFUSED|404|Failed to load resource.*50[23]|Content Security Policy.*fonts\.googleapis|net::ERR_/;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !ignore.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

async function seedGallery(page: Page) {
  await page.evaluate(async () => {
    const svg = (w: number, h: number, color: string) =>
      `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/></svg>`,
      )}`;
    const records = [
      { id: 1, timestamp: Date.now(), scene: 'sc001', sceneTitle: '横向作品', character: 'nene', size: '1200x600', image_data: svg(1200, 600, '#7057c7'), favorite: true, version: 1, rating: {}, prompt: 'a' },
      { id: 2, timestamp: Date.now() - 1000, scene: 'sc005', sceneTitle: '竖向作品', character: 'natsume', size: '600x1200', image_data: svg(600, 1200, '#d87898'), favorite: false, version: 1, rating: {}, prompt: 'b' },
    ];
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('aics_kv_store', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('kv')) {
          request.result.createObjectStore('kv', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ key: 'aics_pb_history', value: records });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

async function mockTrainingWorkbench(page: Page) {
  const makeJob = (
    id: string,
    kind: 'lora' | 'voice',
    character: 'nene' | 'natsume',
    label: string,
  ) => ({
    id,
    kind,
    character,
    label,
    datasetId: id,
    ready: true,
    missing: [],
    status: 'idle',
    pid: 0,
    startedAt: 0,
    finishedAt: 0,
    exitCode: null,
    error: '',
    runCount: 0,
    logVersion: 0,
    progress: { stage: '待开始', message: '', percent: 0 },
  });
  const jobs = [
    { ...makeJob('lora-nene-v18', 'lora', 'nene', '宁宁 LoRA v18'), configName: 'ayachi_nene_v18_wd14_curated.json' },
    { ...makeJob('lora-natsume-v18', 'lora', 'natsume', '夏目 LoRA v18'), configName: 'shiki_natsume_v18_wd14_balanced_r18.json' },
    makeJob('voice-nene', 'voice', 'nene', '宁宁角色语音'),
    makeJob('voice-natsume', 'voice', 'natsume', '夏目角色语音'),
  ];
  const datasets = [
    {
      id: 'lora-nene-v18', kind: 'lora', character: 'nene', version: 'v18',
      ready: true, images: 64, captions: 64, bytes: 1024,
      categories: { identity_anchors: 5, outfit_witch: 8, adult_solo: 8, validation: 6 },
      missing: [], preview: { available: true, label: '宁宁魔女服训练样本审核表', blurred: false },
      adultPreview: { available: true, label: '宁宁 R18 分层样本（默认模糊）', blurred: true },
    },
    {
      id: 'lora-natsume-v18', kind: 'lora', character: 'natsume', version: 'v18',
      ready: true, images: 76, captions: 76, bytes: 2048,
      categories: { identity_anchors: 4, outfit_qipao: 9, adult_solo: 14, validation: 8 },
      missing: [], preview: { available: true, label: '夏目旗袍服训练样本审核表', blurred: false },
      adultPreview: { available: true, label: '夏目 R18 分层样本（默认模糊）', blurred: true },
    },
    {
      id: 'voice-nene', kind: 'voice', character: 'nene', version: 'test',
      ready: true, images: 0, captions: 0, bytes: 0, categories: {},
      trainSamples: 90, evalSamples: 10, wavs: 100,
      missing: [], preview: { available: false, label: '', blurred: false },
      adultPreview: { available: false, label: '', blurred: false },
    },
    {
      id: 'voice-natsume', kind: 'voice', character: 'natsume', version: 'test',
      ready: true, images: 0, captions: 0, bytes: 0, categories: {},
      trainSamples: 90, evalSamples: 10, wavs: 100,
      missing: [], preview: { available: false, label: '', blurred: false },
      adultPreview: { available: false, label: '', blurred: false },
    },
  ];

  await page.route('**/api/training/overview', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      workspace: { available: true, name: 'AI' },
      activeJobId: null,
      readyJobs: jobs.map(job => job.id),
      datasets,
      jobs,
    }),
  }));
  await page.route(/\/api\/training\/jobs\/[^/]+\/logs(?:\?.*)?$/, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true, id: 'lora-nene-v18', cursor: 0, nextCursor: 0,
      reset: false, version: 0, text: '', lines: [],
    }),
  }));
  await page.route('**/api/training/datasets/*/preview', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="684"></svg>',
  }));
  await page.route('**/api/training/datasets/*/adult-preview', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="1120"></svg>',
  }));
}

// 走 AppLayout 的路由：共享 skip-link 与 main landmark
const layoutRoutes = [
  { path: '/', name: 'home' },
  { path: '/prompt-builder', name: 'director' },
  { path: '/gallery', name: 'gallery' },
  { path: '/scene-explorer', name: 'scene-explorer' },
  { path: '/showcase', name: 'showcase' },
  { path: '/chat', name: 'chat' },
  { path: '/training?kind=lora', name: 'training' },
];

for (const entry of layoutRoutes) {
  test(`${entry.name} exposes a single skip link and main landmark`, async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto(entry.path);
    await expect(page.locator('a.skip-link[href="#main"]')).toHaveCount(1);
    await expect(page.locator('#main')).toHaveCount(1);
    // 必须是真的 <main>，且全页恰好一个。
    // 这条断言原先写的是 toHaveCount(0) —— 那是在锁定"没有 main 地标"这个 bug：
    // AppLayout 当时输出 <div id="main">，skip-link 落在一个普通容器上。
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main#main')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test('every route keeps exactly one h1', async ({ page }) => {
  for (const entry of [
    ...layoutRoutes,
    { path: '/companion', name: 'companion' },
    { path: '/control', name: 'control' },
  ]) {
    await page.goto(entry.path);
    await expect(page.locator('h1'), `${entry.name} must have a single h1`).toHaveCount(1);
  }
});

test('primary navigation is reachable and marks the active route', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/');

  // 品牌字标必须完整渲染（曾被塞进方框裁成色块）
  const logo = page.locator('.nav-logo');
  await expect(logo).toBeVisible();
  const box = await logo.boundingBox();
  expect(box!.width).toBeGreaterThan(box!.height);

  // 窄屏导航收进汉堡菜单，先展开
  const toggle = page.locator('.nav-menu-toggle');
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(page.locator('.nav-links')).toHaveClass(/open/);
  }

  // 限定在顶栏：首页正文里也有指向 /showcase 的入口卡
  await page.locator('.nav-links').getByRole('link', { name: /效果样张/ }).click();
  await expect(page).toHaveURL(/\/showcase/);
  await expect(page.locator('.nav-links a.active')).toContainText('效果样张');
  expect(errors).toEqual([]);
});

test('gallery viewer traps focus and restores it on Escape', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/gallery');
  await seedGallery(page);
  await page.reload();

  const firstArt = page.locator('.artwork-button').first();
  await expect(firstArt).toBeVisible();
  await firstArt.focus();
  await firstArt.click();
  await expect(page.locator('.art-viewer')).toHaveClass(/open/);

  await expect.poll(async () => page.evaluate(() => {
    const viewer = document.querySelector('.art-viewer');
    const active = document.activeElement as HTMLElement | null;
    return !!(viewer && active && viewer.contains(active));
  }), { timeout: 5000 }).toBe(true);

  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const viewer = document.querySelector('.art-viewer');
      return !!(viewer && viewer.contains(document.activeElement));
    });
    expect(inside).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(page.locator('.art-viewer')).not.toHaveClass(/open/);
  await expect(firstArt).toBeFocused();
  expect(errors).toEqual([]);
});

test('narrow viewports keep the director usable without horizontal scroll', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/prompt-builder');
  await expect(page.locator('.story-input')).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  // 允许 1px 的取整误差
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('narrow viewports keep the home hero inside the viewport', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/');
  await expect(page.locator('.home-hero')).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('training workbench keeps visual samples and keyboard tabs usable', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await mockTrainingWorkbench(page);
  await page.goto('/training?kind=lora');
  await expect(page.getByRole('heading', { name: '角色训练台' })).toHaveCount(1);
  // 数据集详情（审核样张/分层）默认折叠：先展开再断言样本可见与模糊遮罩
  await page.locator('.dataset-details summary').first().click();
  await expect(page.locator('.dataset-preview img')).toHaveCount(2);
  await expect(page.locator('.dataset-preview img').first()).toBeVisible();
  await expect(page.locator('.adult-preview img')).toHaveCount(2);
  await expect(page.locator('.adult-preview img').first()).toBeVisible();
  await expect(page.locator('.adult-preview img').first()).toHaveCSS('filter', /blur/);

  const voiceTab = page.getByRole('tab', { name: /角色语音/ });
  await voiceTab.click();
  await expect(page.getByRole('heading', { name: '角色语音训练' })).toBeVisible();
  await voiceTab.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: /角色 LoRA/ })).toHaveAttribute('aria-selected', 'true');

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('control layout keeps its navigation usable without horizontal scroll', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/control');
  await expect(page.locator('.control-title')).toBeVisible();

  const narrow = page.viewportSize()!.width <= 900;
  if (narrow) {
    await expect(page.locator('.control-mobile-nav')).toBeVisible();
    await expect(page.locator('.control-rail')).toBeHidden();
  } else {
    await expect(page.locator('.control-mobile-nav')).toBeHidden();
    await expect(page.locator('.control-rail')).toBeVisible();
    await expect(page.locator('.control-rail-link')).toHaveCount(5);
  }

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
