'use strict';

/**
 * Vue SPA 页面架构校验（重构后版本）
 *
 * 重构前这个测试检查 tools/*.html + 外部控制器：确保没有内联事件属性（CSP）、
 * 控制器带缓存版本号、页面暴露 nav-back / kicker。
 * 那批文件已随 Vue 迁移删除，现在改为对 src/ 下的 SPA 做等价约束：
 *   1. index.html 不得注入内联脚本或全局控制器
 *   2. 每个路由都有对应的 view 文件，且被路由懒加载引用
 *   3. view 不得使用 v-html 拼接未转义的用户输入以外的内联事件属性
 *   4. 热页面仍需暴露返回链接与 kicker 排版原语
 *   5. composables / stores / utils 语法可解析
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const src = path.join(root, 'src');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

// ── 1. index.html 必须是纯 SPA 入口 ───────────────────────────────────────
const indexHtml = read('index.html');
const scriptTags = [...indexHtml.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
const inlineScripts = scriptTags.filter(m => !/\bsrc\s*=/.test(m[1]) && m[2].trim());
assert.strictEqual(
  inlineScripts.length, 0,
  'index.html must not contain inline scripts (Vue SPA entry only)',
);
assert(
  !/<script[^>]+src=["']\/?tools\//i.test(indexHtml),
  'index.html must not load legacy tools/ controllers',
);
assert(
  /<script[^>]+type=["']module["'][^>]+src=["']\/src\/main\.ts["']/.test(indexHtml),
  'index.html must load /src/main.ts as a module',
);

// ── 2. 路由与 view 一一对应 ──────────────────────────────────────────────
const routerSource = read('src/router/index.ts');
const viewImports = [...routerSource.matchAll(/import\(['"]@\/views\/([A-Za-z0-9_]+\.vue)['"]\)/g)]
  .map(m => m[1]);
assert(viewImports.length >= 12, `router must lazy-load all views, found ${viewImports.length}`);
for (const view of viewImports) {
  assert(exists(path.join('src', 'views', view)), `src/views/${view} referenced by router must exist`);
}
// AppLayout 承载共享 chrome
assert(exists('src/components/AppLayout.vue'), 'AppLayout.vue must exist as the shared shell');
assert(
  /@\/components\/AppLayout\.vue/.test(routerSource),
  'router must mount AppLayout as the layout route',
);

// ── 3. view / component 不得使用内联 HTML 事件属性 ───────────────────────
// Vue 用 @click / v-on 绑定；出现 onclick= 说明是拼接字符串塞进 v-html，会被 CSP 拦。
const inlineHandlerRe = /\son(?:click|change|input|submit|keydown|keyup|focus|blur|error)\s*=\s*["'][^"']/i;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const srcFiles = walk(src);
const vueFiles = srcFiles.filter(f => f.endsWith('.vue'));
assert(vueFiles.length >= 15, `expected the SPA to ship views + components, found ${vueFiles.length}`);

for (const file of vueFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  assert(
    !inlineHandlerRe.test(source),
    `${rel} must not use inline HTML event attributes (use @event bindings)`,
  );
  // 单文件组件必须有 template
  assert(/<template>/.test(source), `${rel} must define a <template>`);
}

// ── 4. 热页面共享 atelier chrome ─────────────────────────────────────────
// 返回入口 + kicker 排版原语，保持各页顶部信息结构一致。
const chromeViews = [
  ['src/views/PromptBuilderView.vue', /\bpb-kicker\b/],
  ['src/views/ChatView.vue', /\bpage-kicker\b/],
  ['src/views/GalleryView.vue', /\bgallery-kicker\b/],
  ['src/views/ShowcaseView.vue', /\bpage-kicker\b/],
  ['src/views/SceneExplorerView.vue', /\bpage-kicker\b/],
  ['src/views/SceneManagerView.vue', /\bpage-kicker\b/],
  ['src/views/ControlView.vue', /\bgallery-kicker\b/],
  ['src/views/CharacterView.vue', /\bpage-kicker\b/],
  ['src/views/ColorScriptView.vue', /\bpage-kicker\b/],
  ['src/views/LoraView.vue', /\bpage-kicker\b/],
  ['src/views/StyleView.vue', /\bpage-kicker\b/],
];
for (const [rel, kickerRe] of chromeViews) {
  const source = read(rel);
  assert(kickerRe.test(source), `${rel} must expose a kicker chrome primitive`);
}

// 除首页与控制面板外，其余页面提供返回入口
const backLinkViews = [
  'src/views/PromptBuilderView.vue',
  'src/views/ChatView.vue',
  'src/views/ShowcaseView.vue',
  'src/views/StyleView.vue',
];
for (const rel of backLinkViews) {
  assert(/\bnav-back\b/.test(read(rel)), `${rel} must expose nav-back chrome`);
}

// ── 5. 关键 composable / store / util 必须存在 ───────────────────────────
const requiredModules = [
  'src/main.ts',
  'src/stores/promptBuilderStore.ts',
  'src/stores/sceneStore.ts',
  'src/composables/useVoice.ts',
  'src/composables/useLive2D.ts',
  'src/composables/useSDGenerate.ts',
  'src/composables/useSDQueue.ts',
  'src/composables/useBackup.ts',
  'src/composables/useKVStore.ts',
  'src/composables/useImageStore.ts',
  'src/utils/promptPolicy.ts',
  'src/utils/sdError.ts',
  'src/utils/sceneInference.ts',
  'src/utils/sceneUX.ts',
  'src/utils/stream.ts',
];
for (const rel of requiredModules) {
  assert(exists(rel), `${rel} must exist`);
}

// ── 6. 设计系统样式必须被入口引入 ────────────────────────────────────────
const mainTs = read('src/main.ts');
for (const css of ['design-system.css', 'scene-card.css', 'director.css', 'chat.css', 'mood.css', 'viewer.css']) {
  assert(
    new RegExp(`assets/css/${css.replace('.', '\\.')}`).test(mainTs),
    `src/main.ts must import ${css}`,
  );
}

// ── 7. 情绪推断不得退化为空实现（曾因编码损坏永远返回 neutral） ──────────
const streamSource = read('src/utils/stream.ts');
const emotionBlock = streamSource.match(/export function inferEmotion[\s\S]*?\n\}/);
assert(emotionBlock, 'stream.ts must export inferEmotion');
for (const emotion of ['shy', 'happy', 'sad', 'serious', 'gentle']) {
  assert(
    emotionBlock[0].includes(`'${emotion}'`),
    `inferEmotion must still classify "${emotion}"`,
  );
}
// 关键词必须是可用的中文，而不是被损坏的替换字符
assert(
  !/\uFFFD/.test(emotionBlock[0]),
  'inferEmotion keywords must not contain replacement characters (encoding damage)',
);

console.log(
  `Page architecture tests passed: ${viewImports.length} lazy routes, `
  + `${vueFiles.length} SFCs CSP-ready, ${requiredModules.length} core modules present, `
  + 'emotion inference intact',
);
