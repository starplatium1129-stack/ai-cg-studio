'use strict';

// 统一静态资源缓存版本号。
// 用法: node scripts/maintenance/bump-asset-version.js <资源路径> <新版本>
//   例: node scripts/maintenance/bump-asset-version.js css/design-system.css 11
// 会更新 index.html / tools/*.html / docs/*.html 里所有对该资源的 ?v= 引用。

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const [assetArg, versionArg] = process.argv.slice(2);

if (!assetArg || !/^\d+$/.test(versionArg || '')) {
  console.error('用法: node scripts/maintenance/bump-asset-version.js <资源路径> <新版本(数字)>');
  process.exit(1);
}

// 引用时用的是相对路径,所以只匹配文件名部分
const assetName = assetArg.split('/').pop();
const escaped = assetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp('(' + escaped + '\\?v=)\\d+', 'g');

function listHtml(dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((n) => n.endsWith('.html')).map((n) => (dir ? dir + '/' + n : n));
}

const files = ['index.html', ...listHtml('tools'), ...listHtml('docs')];
let changed = 0;
let touched = 0;

for (const rel of files) {
  const abs = path.join(root, rel);
  const before = fs.readFileSync(abs, 'utf8');
  let hits = 0;
  const after = before.replace(pattern, (_match, head) => { hits += 1; return head + versionArg; });
  if (hits && after !== before) {
    fs.writeFileSync(abs, after);
    changed += hits;
    touched += 1;
    console.log(`  ${rel}: ${hits} 处 → ?v=${versionArg}`);
  }
}

console.log(`${assetName}: 更新 ${changed} 处引用,涉及 ${touched} 个页面`);
