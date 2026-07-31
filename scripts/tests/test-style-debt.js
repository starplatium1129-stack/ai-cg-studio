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

const sources = require('../maintenance/style-sources');

const { test } = require('node:test');

test("style-debt", () => {
const root = sources.ROOT;
const failures = [];

function fail(message) { failures.push(message); }

const htmlFiles = sources.staticHtmlFiles();
const sfcFiles = sources.sfcFiles();

// ---- 1. 内联 style 预算 ----------------------------------------------------
// 允许的唯一形态:自定义属性载体。值属于数据(评分/比例/进度),样式规则仍在 CSS 里。
const CUSTOM_PROP_ONLY = /^\s*(--[\w-]+\s*:\s*[^;]+;?\s*)+$/;
// 动态绑定 :style 里的对象字面量也只允许承载自定义属性
const DYNAMIC_CUSTOM_PROP_ONLY = /^\s*\{\s*(?:'--[\w-]+'|"--[\w-]+"|\[[^\]]+\])\s*:[^}]*\}\s*$/;
// :style="someRef" 的形态:去 <script> 里查该标识符的定义,确认它只产出自定义属性
const IDENTIFIER_ONLY = /^\s*[A-Za-z_$][\w$]*\s*$/;

function bindsOnlyCustomProps(source, identifier) {
  const decl = new RegExp('(?:const|let|var)\\s+' + identifier + '\\s*=\\s*computed\\(\\s*\\(\\)\\s*=>\\s*\\(([\\s\\S]*?)\\)\\s*\\)');
  const match = source.match(decl);
  if (!match) return false;
  const keys = [...match[1].matchAll(/(?:^|[\s,{])\s*(?:'([^']+)'|"([^"]+)"|([\w-]+))\s*:/g)]
    .map((m) => m[1] || m[2] || m[3]);
  return keys.length > 0 && keys.every((k) => k.startsWith('--'));
}

for (const rel of htmlFiles) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const matches = [...source.matchAll(/\sstyle="([^"]*)"/g)];
  for (const match of matches) {
    if (CUSTOM_PROP_ONLY.test(match[1])) continue;
    const line = source.slice(0, match.index).split('\n').length;
    fail(`${rel}:${line} 内联 style 必须换成全局 class 或自定义属性载体 → style="${match[1]}"`);
  }
}

// SFC 模板同样受约束 —— 这是过去完全没被覆盖的地方(实测 19 处违规)
for (const rel of sfcFiles) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const template = sources.sfcTemplate(source);
  if (!template) continue;
  // 模板在 SFC 里的起始行,用于把模板内行号换算成文件行号
  const templateStartLine = source.slice(0, source.indexOf(template)).split('\n').length - 1;
  for (const attr of sources.inlineStyleAttrs(template)) {
    if (attr.dynamic) {
      if (DYNAMIC_CUSTOM_PROP_ONLY.test(attr.value)) continue;
      if (IDENTIFIER_ONLY.test(attr.value) && bindsOnlyCustomProps(source, attr.value.trim())) continue;
    } else if (CUSTOM_PROP_ONLY.test(attr.value)) continue;
    const prefix = attr.dynamic ? ':style' : 'style';
    fail(`${rel}:${templateStartLine + attr.line} 内联 ${prefix} 必须换成 scoped class 或自定义属性载体 → ${prefix}="${attr.value}"`);
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
// 必须覆盖应用真正加载的 src/assets/css + 所有 SFC。
const cssFiles = [...sources.appCssFiles(), ...sources.legacyDocsCssFiles()];

let allCss = '';
for (const rel of cssFiles) allCss += fs.readFileSync(path.join(root, rel), 'utf8') + '\n';
let allInlineCss = '';
for (const rel of [...htmlFiles, ...sfcFiles]) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const match of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) allInlineCss += match[1] + '\n';
  // 自定义属性载体里赋的值也算定义点
  for (const match of source.matchAll(/\s:?style="([^"]*)"/g)) allInlineCss += match[1] + ';\n';
}

const defined = new Set();
for (const match of (allCss + allInlineCss).matchAll(/(--[\w-]+)\s*:/g)) defined.add(match[1]);
// 运行时通过 setProperty / 绑定对象注入的也算定义点
for (const rel of [...sfcFiles, 'src/main.ts']) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  const source = fs.readFileSync(abs, 'utf8');
  for (const match of source.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) defined.add(match[1]);
  for (const match of source.matchAll(/['"`](--[\w-]+)['"`]\s*:/g)) defined.add(match[1]);
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
for (const rel of sfcFiles) collectRefs(fs.readFileSync(path.join(root, rel), 'utf8'), rel);

for (const [name, where] of referenced) {
  if (!defined.has(name)) fail(`${where} 引用了未定义的设计 token ${name}(会静默掉样式)`);
}

// ---- 报告 ------------------------------------------------------------------
if (failures.length) {
  console.error('样式债门禁失败:');
  for (const message of failures) console.error('  - ' + message);
  process.exit(1);
}

const carriers = [...htmlFiles, ...sfcFiles].reduce((total, rel) => {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  return total + (source.match(/\s:?style="/g) || []).length;
}, 0);
console.log('inline style occurrences: ' + carriers);
});
