'use strict';

// 把"文字色使用点"从背景色 token 切到 --*-text 变体。
// 用法: node scripts/maintenance/retarget-text-colors.js [--write]
//
// 背景:功能色与 mood 色是为色块/描边调的(高亮度),当文字色时浅色主题只有
// 1.2–3.0:1。design-system.css 已拆出 --*-text 专供文字。本脚本负责把使用点切过去。
//
// 只改这些位置(其余保持原 token,因为它们是背景/描边/图形):
//   color: var(--X)              → color: var(--X-text)
//   color:var(--X)               → 同上
//   --badge-color: var(--X)      → 同上(badge 的文字与描边都取这个值)
//   font: <w> <size> ... 不含颜色,不涉及
// 明确跳过: background, border, box-shadow, fill, stroke, color-mix 内部,
//           以及 --X 出现在 linear-gradient / radial-gradient 里的情形。

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const write = process.argv.includes('--write');

const TOKENS = [
  'success', 'warning', 'danger', 'info',
  'mood-joy', 'mood-love', 'mood-calm', 'mood-sad', 'mood-tension', 'mood-warmth'
];

function listFiles() {
  const out = ['index.html'];
  for (const dir of ['css', 'tools', 'docs']) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (/\.(css|html)$/.test(name)) out.push(dir + '/' + name);
    }
  }
  return out;
}

let grand = 0;
const report = [];

for (const rel of listFiles()) {
  const abs = path.join(root, rel);
  let source = fs.readFileSync(abs, 'utf8');
  const before = source;
  let hits = 0;

  for (const token of TOKENS) {
    const esc = token.replace(/-/g, '\\-');
    // color: var(--token)  /  color:var(--token)
    source = source.replace(
      new RegExp('(\\bcolor\\s*:\\s*)var\\(\\s*--' + esc + '\\s*\\)', 'g'),
      (whole, head) => { hits += 1; return head + 'var(--' + token + '-text)'; }
    );
    // --badge-color: var(--token)  —— badge 的文字色与描边同源
    source = source.replace(
      new RegExp('(--badge-color\\s*:\\s*)var\\(\\s*--' + esc + '\\s*\\)', 'g'),
      (whole, head) => { hits += 1; return head + 'var(--' + token + '-text)'; }
    );
  }

  if (hits) {
    report.push('  ' + rel.padEnd(32) + hits);
    grand += hits;
    if (write && source !== before) fs.writeFileSync(abs, source);
  }
}

for (const line of report) console.log(line);
console.log('TOTAL text-color use sites retargeted: ' + grand);
if (!write) console.log('(预览模式,加 --write 落盘)');
