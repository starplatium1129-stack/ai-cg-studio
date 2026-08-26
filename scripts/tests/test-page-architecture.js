'use strict';

const { test } = require('node:test');

test("page-architecture", () => {
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
// 工作台页面（控制台 / 模型架 / 训练台）自第八轮起使用 WorkspaceArchiveBar
// 承载档案编号与机读状态，不再重复输出同义英文 Kicker（见
// docs/visual-architecture-roadmap.md「第六轮：工作台标签去重」）。
const chromeViews = [
  ['src/views/PromptBuilderView.vue', /\bpb-kicker\b/],
  ['src/views/ChatView.vue', /\bpage-kicker\b/],
  ['src/views/GalleryView.vue', /\bgallery-kicker\b/],
  ['src/views/ShowcaseView.vue', /\bpage-kicker\b/],
  ['src/views/SceneExplorerView.vue', /\bpage-kicker\b/],
  ['src/views/SceneManagerView.vue', /\bpage-kicker\b/],
  ['src/views/ControlView.vue', /\bWorkspaceArchiveBar\b/],
  ['src/views/CharacterView.vue', /\bpage-kicker\b/],
  ['src/views/ColorScriptView.vue', /\bpage-kicker\b/],
  ['src/views/LoraView.vue', /\bWorkspaceArchiveBar\b/],
  ['src/views/StyleView.vue', /\bpage-kicker\b/],
];
for (const [rel, kickerRe] of chromeViews) {
  const source = read(rel);
  assert(kickerRe.test(source), `${rel} must expose a kicker chrome primitive`);
}
assert(
  !/\bany\b/.test(read('src/views/ColorScriptView.vue')),
  'ColorScriptView must keep its mood catalog explicitly typed',
);

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
  'src/types/artwork.ts',
  'src/composables/useVoice.ts',
  'src/composables/useLive2D.ts',
  'src/composables/chat/useCharacterRoomSession.ts',
  'src/composables/generation/useSDGenerate.ts',
  'src/composables/generation/useSDQueue.ts',
  'src/composables/prompt/usePromptAssembly.ts',
  'src/composables/useBackup.ts',
  'src/composables/useKVStore.ts',
  'src/composables/useImageStore.ts',
  'src/utils/promptPolicy.ts',
  'src/utils/promptBuilderPersistence.ts',
  'src/utils/characterProfiles.ts',
  'src/utils/chatStatus.ts',
  'src/utils/loraCatalog.ts',
  'src/utils/showcaseManifest.ts',
  'src/utils/sdError.ts',
  'src/utils/sdRequest.ts',
  'src/utils/sdStatus.ts',
  'src/utils/quickCreate.ts',
  'src/utils/storageHealth.ts',
  'src/utils/sceneInference.ts',
  'src/utils/sceneUX.ts',
  'src/utils/stream.ts',
];
for (const rel of requiredModules) {
  assert(exists(rel), `${rel} must exist`);
}

const docsNav = read('tools/nav.js');
const docsStatus = read('tools/local-status.js');
assert(
  !/tools\/[a-z-]+\.html/.test(docsNav + docsStatus),
  'docs navigation must link to current SPA routes, not deleted tools/*.html pages',
);
assert(
  docsNav.includes("href:'prompt-builder'") && docsStatus.includes("d + 'control"),
  'docs navigation and local status actions must expose current creation/control routes',
);

// ── 6. 样式加载分层：跨路由的进全局，路由专属的进各自视图 ────────────────
// director.css(91.6KB) + chat.css(18.6KB) 曾占 139KB 全局包的 79%，
// 却只服务 /prompt-builder 与 /chat。移入视图后由 cssCodeSplit 切成路由块。
const mainTs = read('src/main.ts');
for (const css of ['design-system.css', 'scene-card.css', 'mood.css', 'viewer.css']) {
  assert(
    new RegExp(`assets/css/${css.replace('.', '\\.')}`).test(mainTs),
    `src/main.ts must import shared stylesheet ${css}`,
  );
}
for (const css of ['director.css', 'chat.css']) {
  assert(
    !new RegExp(`assets/css/${css.replace('.', '\\.')}`).test(mainTs),
    `${css} is route-scoped — it must not be imported globally in src/main.ts`,
  );
}
assert(
  /assets\/css\/director\.css/.test(read('src/views/PromptBuilderView.vue')),
  'PromptBuilderView must import director.css so it ships in the route chunk',
);
assert(
  /assets\/css\/chat\.css/.test(read('src/views/ChatView.vue')),
  'ChatView must import chat.css so it ships in the route chunk',
);
assert(
  /assets\/css\/companion\.css/.test(read('src/views/CompanionView.vue')),
  'CompanionView must import its own route-scoped stylesheet',
);
assert(
  !/assets\/css\/companion\.css/.test(read('src/views/ChatView.vue'))
    && !/(?:import\s+ChatView|<ChatView)/.test(read('src/views/CompanionView.vue')),
  'website chat and companion must remain independent presentation roots',
);

// D-1: director.css 虽然跟随 /prompt-builder 路由块加载，但 Vite 注入过一次后
// CSS 仍会留在 document 里。过去 571 个裸选择器（`.scene-search`、`.panel`、
// `.history-item` 等）会污染随后访问的任意路由。普通选择器必须以 `.pb` 根
// 开始；body:has(.pb…) / @property / keyframes 是刻意保留的全局规则。
// 2026-08-26 修复：director.css 已拆为 director/*.css 四片，聚合后校验。
function readDirectorCss() {
  const entry = read('src/assets/css/director.css');
  const dir = path.join(root, 'src/assets/css/director');
  const parts = [entry];
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.css'))) {
      parts.push(read(path.join('src/assets/css/director', name)));
    }
  }
  return parts.join('\n');
}
const directorCss = readDirectorCss();
const leakedDirectorSelectors = [...directorCss.matchAll(/^\s*\.([A-Za-z_-][\w-]*)/gm)]
  .map(m => m[1])
  .filter(name => name !== 'pb' && !name.startsWith('pb-'));
assert.strictEqual(
  leakedDirectorSelectors.length, 0,
  'director.css selectors must be rooted at .pb; leaked: ' + leakedDirectorSelectors.slice(0, 8).join(', '),
);
assert(
  /\.pb-backup-overlay/.test(directorCss) && /class="pb-backup-overlay open"/.test(read('src/components/PromptDataTools.vue')),
  'teleported backup overlay must use its own pb-* namespace (it has no .pb ancestor)',
);
for (const retiredFirstCreationSelector of [
  'stage-welcome', 'first-creation-actions', 'first-creation-note',
  'recent-scene-shortcuts', 'recent-scene-chip', 'data-first-creation', 'firstCreationPulse',
]) {
  assert(
    !directorCss.includes(retiredFirstCreationSelector),
    'director.css must not retain the unused first-creation selector: ' + retiredFirstCreationSelector,
  );
}
assert(
  /\.pb \.stage-quick-actions/.test(directorCss),
  'the live stage quick actions must retain their scoped styling',
);

// chat.css 有同样的生命周期：路由块卸载后样式仍在 document，不能让 `.message`
// `.chat-list` 等裸类污染作品册或场景页。
const chatCss = read('src/assets/css/chat.css');
const leakedChatSelectors = [...chatCss.matchAll(/^\s*\.([A-Za-z_-][\w-]*)/gm)]
  .map(m => m[1])
  .filter(name => name !== 'chat-page' && !name.startsWith('chat-page-'));
assert.strictEqual(
  leakedChatSelectors.length, 0,
  'chat.css selectors must be rooted at .chat-page; leaked: ' + leakedChatSelectors.slice(0, 8).join(', '),
);

// 字体不得在打包 CSS 里 @import：那会造成 HTML→CSS→CSS→字体 三段串行 RTT
assert(
  !/@import\s+url\(["']?https:\/\/fonts\./.test(read('src/assets/css/design-system.css')),
  'fonts must be preconnected/linked from index.html, not @import-ed inside bundled CSS',
);
// 字体已本地自托管：main.ts 从 @fontsource 引入，index.html 不再请求 Google Fonts
assert(
  /@fontsource\/(noto-sans-sc|jetbrains-mono)\//.test(read('src/main.ts')),
  'fonts must be self-hosted via @fontsource in main.ts',
);
assert(
  !/fonts\.gstatic\.com/.test(read('index.html')),
  'index.html must not reference Google Fonts CDN when fonts are self-hosted',
);

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

// ── 8. 高频交互与合成层动效规范（2026-08-23 计划 001）────────────────────
const compareSliderSource = read('src/components/visual/ImageCompareSlider.vue');
assert(
  !compareSliderSource.includes('left: var(--split-pos')
    && /container-type:\s*inline-size/.test(compareSliderSource)
    && /transform:\s*translateX\(calc\(var\(--split-x/.test(compareSliderSource),
  'ImageCompareSlider must use container-query cqw transform for divider and eliminate layout left updates',
);

const zoomViewerSource = read('src/components/visual/ZoomableImageViewer.vue');
assert(
  /\.zoomable-image-viewer\.is-panning\s+\.zoom-transform-layer\s*\{\s*transition:\s*none;?\s*\}/.test(zoomViewerSource)
    && /transition:\s*transform\s+var\(--motion-control\)\s+var\(--ease-out\)/.test(zoomViewerSource)
    && !zoomViewerSource.includes('0.08s linear'),
  'ZoomableImageViewer must disable transition during panning and use motion tokens for transform easing',
);

const videoStudioSource = read('src/views/VideoStudioView.vue');
assert(
  /transform:\s*scaleX\(var\(--progress,\s*0%\)\)/.test(videoStudioSource)
    && /transition:\s*transform\s+var\(--motion-surface\)\s+var\(--ease-out\)/.test(videoStudioSource)
    && !/scale:\s*var\(--progress/.test(videoStudioSource),
  'VideoStudioView progress bar must use scaleX transform and eliminate single-axis scale squish',
);

const controlViewSource = read('src/views/ControlView.vue');
assert(
  /transition:\s*transform\s+var\(--motion-hover\)/.test(controlViewSource)
    && /\.tunnel-switch\[aria-checked="true"\]\s+\.tunnel-switch-knob\s*\{\s*transform:\s*translateX\(20px\);?\s*\}/.test(controlViewSource)
    && !controlViewSource.includes('transition: left')
    && !controlViewSource.includes('left: 22px'),
  'ControlView tunnel switch knob must animate via transform translateX and eliminate left transition',
);

});
