import { expect, test, type Page } from '@playwright/test';

/**
 * Vue SPA 浏览器回归
 *
 * 重构前这些用例走 /tools/*.html + 全局 DOM id。
 * 现在是 Vue Router 单页应用，断言改为路由路径 + 语义/类选择器，
 * 避免再次和某个实现细节的 id 绑死。
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

/** 往 IndexedDB 塞两条作品记录（一横一竖），用于作品册相关用例 */
async function seedGallery(page: Page) {
  await page.evaluate(async () => {
    const svg = (w: number, h: number, color: string) =>
      `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/></svg>`,
      )}`;

    const records = [
      { id: 1, timestamp: Date.now(), scene: 'sc001', sceneTitle: '横向作品', character: 'nene', size: '1200x600', image_data: svg(1200, 600, '#7057c7'), favorite: true, version: 1, rating: {}, prompt: 'landscape' },
      { id: 2, timestamp: Date.now() - 1000, scene: 'sc005', sceneTitle: '竖向作品', character: 'natsume', size: '600x1200', image_data: svg(600, 1200, '#d87898'), favorite: false, version: 1, rating: {}, prompt: 'portrait' },
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

test('home renders hero, featured scenes and live counts', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/');

  await expect(page.locator('.hero-title')).toContainText('绫季绘境');
  // 精选场景来自 scenes.json + curation.json，必须真的渲染出卡片
  await expect(page.locator('.strip-scroll .sc').first()).toBeVisible();
  await expect(page.locator('.strip-label')).not.toContainText('场景加载中');
  // 主要创作入口
  await expect(page.getByRole('link', { name: /开始绘制/ }).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('director loads scene library, prompt preview and generation params', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/prompt-builder');

  await expect(page.locator('.story-input')).toBeVisible();
  await expect(page.locator('.scene-list button.scene-card').first()).toBeVisible();
  await expect(page.locator('.scene-count-badge')).not.toHaveText('');

  // 选一张场景后，提示词应实时生成，并带出结构健康统计
  await page.locator('.scene-list button.scene-card').first().click();
  await expect(page.locator('.preview-output')).not.toHaveText(/^选择左侧场景/);
  await expect(page.locator('.token-counter')).toBeVisible();
  // 质量前缀必须来自模型 profile，而不是硬编码
  await expect(page.locator('.monitor-profile')).not.toHaveText('');

  expect(errors).toEqual([]);
});

test('director restores state from a scene deep link', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/prompt-builder?scene=sc001');

  // 深链必须把场景真正装进导演台
  await expect(page.locator('.pb')).toHaveAttribute('data-character', /nene|natsume|triad/);
  await expect(page.locator('.scene-context-title')).toBeVisible();
  await expect(page.locator('.preview-output')).toContainText('lora');

  expect(errors).toEqual([]);
});

test('scene manager loads project data and opens the editor without dirtying state', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/scene-manager');

  await expect(page.locator('table tbody tr').first()).toBeVisible();
  await expect(page.locator('.stats')).toContainText('297');
  // 未改动时保存按钮必须不可用
  await expect(page.getByRole('button', { name: /保存到项目/ })).toBeDisabled();

  await page.getByRole('button', { name: /新增场景/ }).click();
  await expect(page.locator('.modal-card')).toBeVisible();
  await expect(page.locator('.modal-card input').first()).toHaveValue(/sc\d+/);
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.locator('.modal-card')).toBeHidden();

  expect(errors).toEqual([]);
});

test('scene manager exposes tag, showcase and duplicate tooling', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/scene-manager');

  // 标签库：字段来自 tags.json 的 en/cn/cat/weight
  await page.getByRole('button', { name: '标签库' }).click();
  await expect(page.locator('table tbody tr').first()).toBeVisible();
  await expect(page.locator('.tag-chip').first()).not.toHaveText('');

  // 样张管理
  await page.getByRole('button', { name: '样张', exact: true }).click();
  await expect(page.locator('.sm-image-card').first()).toBeVisible();

  // 重复检测
  await page.getByRole('button', { name: '重复检测' }).click();
  await page.getByRole('button', { name: '开始检测' }).click();
  await expect(page.locator('.list-meta')).toContainText('发现');

  expect(errors).toEqual([]);
});

test('gallery preserves horizontal and vertical art in the immersive viewer', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/gallery');
  await seedGallery(page);
  await page.reload();

  await expect(page.locator('.artwork')).toHaveCount(2);
  const ratios = await page.locator('.artwork-media').evaluateAll(nodes => nodes.map(node => {
    const raw = getComputedStyle(node).aspectRatio;
    const parts = raw.split('/').map(part => Number(part.trim()));
    return parts.length === 2 && parts[1] ? parts[0] / parts[1] : Number(raw);
  }));
  expect(ratios[0]).toBeCloseTo(2, 1);
  expect(ratios[1]).toBeCloseTo(0.5, 1);

  await page.locator('.artwork-button').first().click();
  await expect(page.locator('.art-viewer')).toHaveClass(/open/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.viewer-position')).toContainText('2 / 2');
  await page.keyboard.press('Escape');
  await expect(page.locator('.art-viewer')).not.toHaveClass(/open/);

  expect(errors).toEqual([]);
});

test('showcase renders one frosted toolbar and a side-by-side viewer', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/showcase');

  await expect(page.locator('.sample').first()).toBeVisible();

  // 工具条只应有一层磨砂容器：内层 search-row 不得再叠圆角/底色
  const layers = await page.evaluate(() => {
    const row = document.querySelector('.search-row');
    if (!row) return null;
    const cs = getComputedStyle(row);
    return { radius: cs.borderRadius, bg: cs.backgroundColor, border: cs.borderTopWidth };
  });
  expect(layers).not.toBeNull();
  expect(layers!.radius).toBe('0px');
  expect(layers!.border).toBe('0px');

  // 查看器：图与文字并排，不得重叠
  await page.locator('.sample .sample-visual').first().click();
  await expect(page.locator('.showcase-viewer')).toHaveAttribute('open', '');
  const boxes = await page.evaluate(() => {
    const art = document.querySelector('.showcase-viewer .viewer-art');
    const copy = document.querySelector('.showcase-viewer .viewer-copy');
    if (!art || !copy) return null;
    const a = art.getBoundingClientRect();
    const c = copy.getBoundingClientRect();
    return { artRight: Math.round(a.right), copyLeft: Math.round(c.left) };
  });
  expect(boxes).not.toBeNull();
  expect(boxes!.artRight).toBeLessThanOrEqual(boxes!.copyLeft + 2);

  expect(errors).toEqual([]);
});

test('control panel shows service status wall and scheduling controls', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/control');

  await expect(page.locator('.gallery-kicker')).toContainText('Local control room');
  await expect(page.locator('.control-title')).toBeVisible();
  await expect(page.locator('.status-tile').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /检测所有服务/ })).toBeVisible();
  // 显存调度与单服务启停
  await expect(page.getByRole('button', { name: /绘图优先/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /聊天优先/ })).toBeVisible();
  await expect(page.locator('.service-row')).toHaveCount(3);

  expect(errors).toEqual([]);
});

test('character room mounts portrait, composer and voice console', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/chat');

  await expect(page.locator('.page-kicker')).toContainText('Character room');
  await expect(page.getByRole('heading', { name: '角色房间', level: 1 })).toBeVisible();
  await expect(page.locator('.chat-input')).toBeVisible();
  await expect(page.locator('.send-btn')).toBeVisible();
  await expect(page.locator('.portrait-main')).toBeVisible();
  await expect(page.locator('.voice-console')).toBeVisible();
  // 两个角色都可切换
  await expect(page.locator('.character-tab')).toHaveCount(2);

  expect(errors).toEqual([]);
});

test('style page offers full colour moods that route into the director', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/style');

  await expect(page.locator('.mood-card')).toHaveCount(6);
  // 每张色卡应有多色条，而不是单色块
  const swatches = await page.locator('.mood-card').first().locator('.mood-swatch').count();
  expect(swatches).toBeGreaterThan(1);

  await page.locator('.mood-card').first().click();
  await expect(page).toHaveURL(/\/prompt-builder\?mood=/);

  expect(errors).toEqual([]);
});

test('scene explorer collapses filters into a single toolbar', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/scene-explorer');

  await expect(page.locator('.scene-toolbar')).toHaveCount(1);
  await expect(page.locator('.sc').first()).toBeVisible();
  // 精细筛选默认收起，点开后才出现
  await expect(page.locator('.scene-facet-panel')).toBeHidden();
  await page.locator('.filter-toggle').click();
  await expect(page.locator('.scene-facet-panel')).toBeVisible();

  expect(errors).toEqual([]);
});

test('home page stays inside the performance budget', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.strip-scroll .sc').first()).toBeVisible();
  const budget = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return {
      requests: resources.length,
      transferBytes: resources.reduce((sum, item) => sum + item.transferSize, 0),
      domNodes: document.querySelectorAll('*').length,
      // 带颜色过渡的元素数：曾经用 * 选择器命中近 200 个，是性能回归信号
      animated: Array.from(document.querySelectorAll('*')).filter(el => {
        const d = getComputedStyle(el).transitionDuration;
        return d && d !== '0s';
      }).length,
    };
  });
  expect(budget.requests).toBeLessThanOrEqual(60);
  expect(budget.transferBytes).toBeLessThanOrEqual(3_200_000);
  expect(budget.domNodes).toBeLessThanOrEqual(1_800);
  expect(budget.animated).toBeLessThanOrEqual(120);
});

test('roadmap exposes prioritized phases and product boundaries', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/docs/roadmap.html');
  await expect(page.getByRole('heading', { name: '产品路线图', level: 1 })).toBeVisible();
  await expect(page.locator('.phase')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: '产品边界' })).toBeVisible();
  expect(errors).toEqual([]);
});
