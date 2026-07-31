'use strict';

const { test } = require('node:test');

test("Gallery tests passed: original ratios, masonry wall, immersive viewer with focus trap, lazy images and cleanup", () => {
/**
 * 作品册契约（Vue SPA 版本）
 *
 * 重构前断言 tools/gallery.html + gallery.js。两者已迁为 src/views/GalleryView.vue，
 * 这里保留同样的保障目标：
 *   1. 瀑布式展墙，保留每幅作品的完整原始构图（contain 而非 cover）
 *   2. 沉浸查看器可键盘导航、焦点可回、有无障碍标注
 *   3. 本地原图按需读取并及时释放 object URL
 *   4. 展墙图懒加载，查看器主图立即加载
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const { artworkTimestamp, parseArtworkRecords } = require('../../src/types/artwork.ts');

const view = read('src/views/GalleryView.vue');
const home = read('src/views/HomeView.vue');
const artworkTypes = read('src/types/artwork.ts');
const layout = read('src/components/AppLayout.vue');

assert.deepStrictEqual(
  parseArtworkRecords([null, {}, { id:'', prompt:'bad' }, { id:7, prompt:'ok' }]),
  [{ id:7, prompt:'ok' }],
  'persisted artwork parsing must reject malformed records without losing valid entries',
);
assert.strictEqual(
  artworkTimestamp({ id:42, timestamp:'not-a-date' }),
  42,
  'legacy artwork timestamps must fall back to numeric ids',
);

// ── 展墙：瀑布流 + 原始比例 ───────────────────────────────────────────────
assert(
  view.includes('gallery-wall') && /columns:\s*4\s+260px/.test(view),
  'gallery must use a responsive masonry exhibition wall',
);
assert(
  view.includes('object-fit:contain'),
  'artwork must preserve the complete original composition',
);
assert(
  !/\.artwork-image\s*\{[^}]*object-fit:cover/.test(view),
  'artwork images must not be cropped with object-fit:cover',
);
assert(
  view.includes('--art-ratio') && view.includes('ratioOf'),
  'gallery must honor each artwork aspect ratio',
);

// ── 沉浸查看器 ────────────────────────────────────────────────────────────
assert(
  view.includes('art-viewer') && view.includes('aria-label="作品观赏模式"'),
  'gallery must provide an accessible immersive viewer',
);
assert(
  view.includes('aria-modal="true"'),
  'immersive viewer must be marked as a modal dialog',
);
assert(
  view.includes("'ArrowLeft'") && view.includes("'ArrowRight'"),
  'immersive viewer must support keyboard navigation',
);
// 焦点管理已抽成 useFocusTrap（原先 6 个弹层里只有这里做对了）。
// 断言视图接上了它，而不是再手写一份。
assert(
  /useFocusTrap\(\s*viewerEl/.test(view),
  'immersive viewer must use the shared useFocusTrap composable',
);
assert(
  /onEscape:\s*closeViewer/.test(view),
  'immersive viewer must close on Escape via useFocusTrap',
);
assert(
  /initialFocus:\s*closeBtn/.test(view),
  'immersive viewer must move focus into the dialog on open',
);

// composable 本身必须真的实现陷阱与焦点还原
const trap = read('src/composables/useFocusTrap.ts');
assert(
  trap.includes("event.key !== 'Tab'") && trap.includes('shiftKey'),
  'useFocusTrap must implement a real Tab cycle',
);
assert(
  /returnFocus\.value\?\.focus\?\./.test(trap),
  'useFocusTrap must restore focus to the opener on close',
);
assert(
  trap.includes("classList.add('overlay-open')") && trap.includes("classList.remove('overlay-open')"),
  'useFocusTrap must lock and unlock background scroll',
);

// ── 本地原图读取与释放 ────────────────────────────────────────────────────
assert(
  view.includes('imgGet'),
  'gallery must load local originals from the image store',
);
assert(
  view.includes('revokeAll') || view.includes('revokeObjectURL'),
  'gallery must release object URLs to avoid leaking blobs',
);
assert(
  view.includes('hydrateCards'),
  'gallery must hydrate card images lazily rather than eagerly decoding everything',
);
assert(
  view.includes('viewerLoadToken') && view.includes('unmounted'),
  'gallery async image loads must not write stale URLs after navigation or unmount',
);
assert(
  home.includes('Promise.all') && home.includes('unmounted'),
  'home cover hydration must be awaited and guarded against component unmount',
);
assert(
  view.includes('parseArtworkRecords') && home.includes('parseArtworkRecords')
    && artworkTypes.includes('interface ArtworkRecord'),
  'home and gallery must share one typed compatibility boundary for persisted artwork',
);
assert(
  !/\bany\b/.test(view) && !/\bany\b/.test(home),
  'home and gallery persistence, scene, event, and image lifecycles must stay explicitly typed',
);

// ── 图片加载策略 ──────────────────────────────────────────────────────────
assert(
  /class="artwork-image"[\s\S]{0,200}loading="lazy"/.test(view),
  'wall images must lazy-load',
);
assert(
  /class="viewer-image"(?![\s\S]{0,200}loading="lazy")/.test(view),
  'the selected artwork must load eagerly (no lazy attribute)',
);

// ── 无障碍骨架由 AppLayout 提供 ───────────────────────────────────────────
assert(
  layout.includes('skip-link') && layout.includes('id="main"'),
  'shared layout must expose a skip link and main landmark for the gallery',
);

});
