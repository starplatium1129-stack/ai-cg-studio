'use strict';

/**
 * 效果样张页契约（Vue SPA 版本）
 *
 * 重构前断言 tools/showcase.html + showcase.js 的 DOM 与内联样式。
 * 那两个文件已迁为 src/views/ShowcaseView.vue，这里保留同样的保障目标：
 *   1. 加载审核 manifest、链回导演台、缩略图懒加载
 *   2. R18 直接可筛选（不用二次确认弹窗），默认模糊
 *   3. 瀑布流保持每张图原始比例
 *   4. 服务端正确挂载并限制 scene-showcase 目录
 *   5. 实际产出的 manifest 与图片资产自洽
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const view = read('src/views/ShowcaseView.vue');
const router = read('src/router/index.ts');
const nav = read('src/components/AppNav.vue');
const server = read('server.js');
const showcaseBuilder = read('scripts/maintenance/build-scene-showcase.py');

// ── 数据来源与跳转 ────────────────────────────────────────────────────────
assert(
  view.includes("fetch('/scene-showcase/manifest.json'"),
  'showcase view must load the approved manifest',
);
assert(
  view.includes('/prompt-builder?scene='),
  'approved samples must link back to the director',
);
assert(view.includes('loading="lazy"'), 'sample thumbnails must lazy-load');

// ── R18 处理：可直接筛选 + 默认模糊，不要确认弹窗 ─────────────────────────
assert(
  view.includes("{ v:'R18', l:'R18' }"),
  'R18 must be directly filterable',
);
assert(
  view.includes('.sample-r18 .sample-image { filter:blur('),
  'R18 thumbnails must be blurred by default',
);
assert(
  view.includes('sample-r18') && view.includes('sample-sensitive'),
  'R18 cards must render the blur treatment and content label',
);
assert(
  !/window\.confirm|\bconfirm\(/.test(view),
  'R18 browsing must not require a confirmation dialog',
);

// ── 画面比例：瀑布流 + 自适应高度 ────────────────────────────────────────
assert(
  view.includes('.showcase-grid { columns:'),
  'sample wall must use a masonry column layout',
);
assert(
  /\.sample-image \{[^}]*width:100%[^}]*height:auto/.test(view),
  'sample wall must preserve each image aspect ratio',
);

// ── 查看器必须脱离 scoped 样式（Teleport 到 body） ────────────────────────
assert(
  view.includes('showcase-viewer'),
  'viewer must use a dedicated class so teleported markup keeps its styles',
);
assert(
  /<style>\s*[\s\S]*\.showcase-viewer/.test(view),
  'teleported viewer styles must live in a non-scoped <style> block',
);

// ── 导航与路由 ────────────────────────────────────────────────────────────
assert(
  router.includes("path: 'showcase'") && router.includes('ShowcaseView.vue'),
  'router must expose the showcase route',
);
assert(
  nav.includes("id: 'showcase'") && nav.includes("to: '/showcase'"),
  'global navigation must expose the showcase',
);

// ── 服务端资产挂载 ────────────────────────────────────────────────────────
assert(server.includes("app.use('/scene-showcase'"), 'server must mount showcase assets');
assert(
  server.includes('SCENE_SHOWCASE_DIR') && server.includes('manifest\\.json'),
  'server must resolve and restrict the showcase directory',
);

// ── 导出脚本保持"直接模糊浏览"的措辞 ─────────────────────────────────────
assert(
  showcaseBuilder.includes('data-rating="R18"') && showcaseBuilder.includes('R18 默认模糊'),
  'generated showcase exports must keep the direct blurred R18 experience',
);
assert(
  !showcaseBuilder.includes('R18 默认隐藏') && !showcaseBuilder.includes('显示 R18'),
  'generated showcase exports must not restore the old R18 reveal copy',
);

// ── 实际资产自洽 ──────────────────────────────────────────────────────────
const showcaseRoot = path.resolve(root, '..', 'AI', 'SceneShowcase');
let checkedAssets = 0;
if (fs.existsSync(showcaseRoot)) {
  const candidates = fs.readdirSync(showcaseRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(showcaseRoot, entry.name, 'manifest.json')))
    .sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'));
  if (candidates[0]) {
    const selected = path.join(showcaseRoot, candidates[0].name);
    const manifest = JSON.parse(fs.readFileSync(path.join(selected, 'manifest.json'), 'utf8'));
    assert.strictEqual(manifest.entries.length, manifest.sceneCount, 'manifest count must match entries');
    assert.strictEqual(
      new Set(manifest.entries.map(e => e.id)).size, manifest.entries.length,
      'manifest ids must be unique',
    );
    manifest.entries.forEach(entry => {
      assert(fs.existsSync(path.join(selected, 'images', entry.id + '.jpg')), 'missing approved image: ' + entry.id);
      assert(fs.existsSync(path.join(selected, 'thumbs', entry.id + '.jpg')), 'missing approved thumbnail: ' + entry.id);
    });
    checkedAssets = manifest.entries.length;
  }
}

console.log(
  'Showcase tests passed: manifest loading, ratio-safe art wall, blurred R18 browsing, '
  + `director links, teleported viewer styles, routing, and ${checkedAssets} approved assets`,
);
