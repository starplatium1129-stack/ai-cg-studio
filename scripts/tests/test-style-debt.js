'use strict';

// 样式债门禁 —— 防止本次全局美术校准的成果回归。
// 用法: node scripts/tests/test-style-debt.js
//
// 覆盖三件事:
//   1. HTML 内联 style 预算(只允许自定义属性载体,如 style="--fill:80%")
//   2. docs/ 也必须 CSP 就绪(原门禁只覆盖 tools/,导致 docs 长期存在 inline handler)
//   3. 设计 token 的完整性(被引用但未定义 = 运行时静默失效)

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const failures = [];

function fail(message) { failures.push(message); }

function listHtml(dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((name) => name.endsWith('.html'))
    .map((name) => (dir ? dir + '/' + name : name));
}

const htmlFiles = ['index.html', ...listHtml('tools'), ...listHtml('docs')];

// ---- 1. 内联 style 预算 ----------------------------------------------------
// 允许的唯一形态:自定义属性载体。值属于数据(评分/比例/进度),样式规则仍在 CSS 里。
const CUSTOM_PROP_ONLY = /^\s*(--[\w-]+\s*:\s*[^;]+;?\s*)+$/;

for (const rel of htmlFiles) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const matches = [...source.matchAll(/\sstyle="([^"]*)"/g)];
  for (const match of matches) {
    if (CUSTOM_PROP_ONLY.test(match[1])) continue;
    const line = source.slice(0, match.index).split('\n').length;
    fail(`${rel}:${line} 内联 style 必须换成全局 class 或自定义属性载体 → style="${match[1]}"`);
  }
}

// ---- 2. CSP 就绪:全站(含 docs/)零 inline handler、零内嵌控制器 ------------
const inlineHandlerRe = /\son(?:click|change|input|submit|keydown|keyup|focus|blur|error)\s*=/i;

for (const rel of htmlFiles) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  if (inlineHandlerRe.test(source)) {
    fail(`${rel} 不得使用 HTML 事件属性(onclick 等),改用外置控制器 + addEventListener`);
  }
  const inlineScripts = [...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/\bsrc\s*=/.test(match[1]) && match[2].trim().length > 0);
  if (inlineScripts.length) {
    fail(`${rel} 不得内嵌 <script> 控制器(${inlineScripts.length} 处),抽成外部带版本号的脚本`);
  }
}

// docs/ 抽出的控制器必须是可解析的普通脚本,且不得再输出 inline handler
const jsInlineHandlerRe = /(?:^|[\s"'`])on(?:click|change|input|submit|keydown|keyup|focus|blur|error)\s*=/;
const docsDir = path.join(root, 'docs');
if (fs.existsSync(docsDir)) {
  for (const name of fs.readdirSync(docsDir).filter((n) => n.endsWith('.js'))) {
    const rel = 'docs/' + name;
    const source = fs.readFileSync(path.join(docsDir, name), 'utf8');
    if (jsInlineHandlerRe.test(source)) fail(`${rel} 不得输出内联事件属性`);
    try {
      new (require('vm').Script)(source, { filename: rel });
    } catch (error) {
      fail(`${rel} 语法错误: ${error.message}`);
    }
  }
}

// ---- 3. 设计 token 完整性 --------------------------------------------------
// 被 var() 引用但从未定义 = 静默失效(浏览器不报错,元素直接掉样式)。
const cssFiles = fs.readdirSync(path.join(root, 'css'))
  .filter((name) => name.endsWith('.css'))
  .map((name) => 'css/' + name);

let allCss = '';
for (const rel of cssFiles) allCss += fs.readFileSync(path.join(root, rel), 'utf8') + '\n';
let allInlineCss = '';
for (const rel of htmlFiles) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const match of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) allInlineCss += match[1] + '\n';
  // 自定义属性载体里赋的值也算定义点
  for (const match of source.matchAll(/\sstyle="([^"]*)"/g)) allInlineCss += match[1] + ';\n';
}

const defined = new Set();
for (const match of (allCss + allInlineCss).matchAll(/(--[\w-]+)\s*:/g)) defined.add(match[1]);
// JS 运行时通过 setProperty 注入的也算定义点
for (const dir of ['tools', 'tools/prompt-builder', 'tools/chat']) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs).filter((n) => /\.(js|mjs)$/.test(n))) {
    const source = fs.readFileSync(path.join(abs, name), 'utf8');
    for (const match of source.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) defined.add(match[1]);
    for (const match of source.matchAll(/(--[\w-]+)\s*:/g)) defined.add(match[1]);
  }
}

const referenced = new Map();
function collectRefs(rawText, label) {
  // 先剥注释:CSS 注释与 HTML 注释里的 var(--xxx) 是文档示例,不是真实引用
  const text = rawText.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  for (const match of text.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
    // 带 fallback 的 var(--x, y) 不算缺陷:显式声明了降级
    if (match[2] === ',') continue;
    if (!referenced.has(match[1])) referenced.set(match[1], label);
  }
}
for (const rel of cssFiles) collectRefs(fs.readFileSync(path.join(root, rel), 'utf8'), rel);
for (const rel of htmlFiles) collectRefs(fs.readFileSync(path.join(root, rel), 'utf8'), rel);

for (const [name, where] of referenced) {
  if (!defined.has(name)) fail(`${where} 引用了未定义的设计 token ${name}(会静默掉样式)`);
}

// ---- 报告 ------------------------------------------------------------------
if (failures.length) {
  console.error('样式债门禁失败:');
  for (const message of failures) console.error('  - ' + message);
  process.exit(1);
}

const carriers = htmlFiles.reduce((total, rel) => {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  return total + (source.match(/\sstyle="/g) || []).length;
}, 0);
console.log(`Style debt tests passed: ${htmlFiles.length} pages CSP-ready, ${carriers} custom-property carriers, ${defined.size} design tokens resolved`);
