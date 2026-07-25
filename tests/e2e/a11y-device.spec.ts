import { expect, test, type Page } from '@playwright/test';

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !/favicon|ERR_CONNECTION_REFUSED|404|Failed to load resource.*50[23]/.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

const pages = [
  { path: '/', name: 'home' },
  { path: '/tools/prompt-builder.html', name: 'director' },
  { path: '/tools/gallery.html', name: 'gallery' },
  { path: '/tools/control.html', name: 'control' }
];

for (const entry of pages) {
  test(`${entry.name} exposes skip link and main landmark`, async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto(entry.path);
    await expect(page.locator('a.skip-link[href="#main"]')).toHaveCount(1);
    await expect(page.locator('main#main')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test('gallery viewer traps focus and restores it on Escape', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/tools/gallery.html');
  const svg = (width: number, height: number, color: string) =>
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`)}`;
  await page.evaluate(async records => {
    await window.AICKVStore.set('aics_pb_history', records);
  }, [
    { id: 'a11y-landscape', scene: 'sc001', timestamp: Date.now(), size: '1200x600', image_data: svg(1200, 600, '#7057c7'), favorite: true },
    { id: 'a11y-portrait', scene: 'sc005', timestamp: Date.now() - 1, size: '600x1200', image_data: svg(600, 1200, '#d87898') }
  ]);
  await page.reload();
  const firstArt = page.locator('.artwork-button').first();
  await expect(firstArt).toBeVisible();
  await firstArt.focus();
  await firstArt.click();
  await expect(page.locator('#artViewer')).toHaveClass(/open/);
  await expect.poll(async () => page.evaluate(() => {
    const viewer = document.getElementById('artViewer');
    const active = document.activeElement as HTMLElement | null;
    return !!(viewer && active && viewer.contains(active));
  }), { timeout: 5000 }).toBe(true);

  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const viewer = document.getElementById('artViewer');
      return !!(viewer && viewer.contains(document.activeElement));
    });
    expect(inside).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(page.locator('#artViewer')).not.toHaveClass(/open/);
  await expect(firstArt).toBeFocused();
  expect(errors).toEqual([]);
});
