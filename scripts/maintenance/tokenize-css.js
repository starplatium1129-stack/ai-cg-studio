'use strict';

// 一次性收敛工具:把 CSS 里的字号/圆角/z-index 字面量映射到设计 token。
// 用法: node scripts/maintenance/tokenize-css.js <css文件> [--write]
// 默认只预览;加 --write 才落盘。
//
// 只做"字面量 → 最近 token 档位"的机械替换,不改结构。
// 刻意保留的例外(装饰字形、iOS 16px 约束等)请在源文件里写注释,
// 本脚本不认注释,所以例外应放在 SKIP_LINES 里或替换后人工回退。

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const write = process.argv.includes('--write');
if (!file) { console.error('用法: node scripts/maintenance/tokenize-css.js <css文件> [--write]'); process.exit(1); }

const abs = path.resolve(process.cwd(), file);
let source = fs.readFileSync(abs, 'utf8');

// rem 值 → 字号 token。键为归一化后的数值。
const FS = {
  '0.58': '--fs-mono-xs', '0.6': '--fs-mono-xs', '0.62': '--fs-mono-xs', '0.63': '--fs-mono-xs',
  '0.64': '--fs-mono-sm', '0.65': '--fs-mono-sm', '0.66': '--fs-mono-sm', '0.67': '--fs-mono-sm', '0.68': '--fs-mono-sm', '0.69': '--fs-mono-sm', '0.7': '--fs-mono-sm',
  '0.72': '--fs-label-xs', '0.74': '--fs-label-xs', '0.75': '--fs-label-xs', '0.76': '--fs-label-xs',
  '0.78': '--fs-label-sm', '0.8': '--fs-label-sm',
  '0.82': '--fs-label', '0.83': '--fs-label', '0.84': '--fs-label',
  '0.85': '--fs-body-sm', '0.86': '--fs-body-sm', '0.88': '--fs-body-sm',
  '0.9': '--fs-body', '0.92': '--fs-body', '0.94': '--fs-body', '0.95': '--fs-body',
  '1': '--fs-body-lg',
  '1.05': '--fs-title-xs', '1.1': '--fs-title-xs', '1.15': '--fs-title-xs', '1.18': '--fs-title-xs',
  '1.2': '--fs-title-sm', '1.25': '--fs-title-sm', '1.3': '--fs-title-sm', '1.35': '--fs-title-sm',
  '1.4': '--fs-title', '1.5': '--fs-title',
  '2': '--fs-glyph', '3': '--fs-glyph-lg'
};

// px 值 → 圆角 token
const RADIUS = {
  '2': '--r-pill', '3': '--r-sm', '4': '--r-sm', '5': '--r-sm',
  '8': '--r-md', '9': '--r-md', '10': '--r-md',
  '12': '--r-lg', '14': '--r-lg', '15': '--r-lg',
  '16': '--r-xl', '18': '--r-xl',
  '20': '--r-2xl', '22': '--r-2xl',
  '24': '--r-3xl', '28': '--r-stage',
  '99': '--r-pill', '999': '--r-pill', '9999': '--r-pill'
};

// z-index 数字 → 层级 token
const Z = {
  '-1': '--z-below', '1': '--z-base', '2': '--z-raised', '3': '--z-raised', '4': '--z-raised', '5': '--z-raised',
  '10': '--z-sticky', '12': '--z-sticky', '20': '--z-sticky', '50': '--z-popover', '80': '--z-popover',
  '100': '--z-nav', '999': '--z-popover', '1000': '--z-overlay',
  '9990': '--z-overlay', '9999': '--z-overlay', '10000': '--z-skip'
};

function norm(value) { return String(parseFloat(value)); }

const changes = [];

// font-size: .Nrem | N.Nrem
source = source.replace(/font-size:\s*(\.?\d[\d.]*)rem/g, (whole, num) => {
  const token = FS[norm(num)];
  if (!token) return whole;
  changes.push(whole + ' → var(' + token + ')');
  return 'font-size: var(' + token + ')';
});

// font 简写里的尺寸槽: font: <weight> <size>rem <family>
source = source.replace(/font:\s*(\d+)\s+(\.?\d[\d.]*)rem/g, (whole, weight, num) => {
  const token = FS[norm(num)];
  if (!token) return whole;
  changes.push(whole + ' → var(' + token + ')');
  return 'font: ' + weight + ' var(' + token + ')';
});

// border-radius: Npx(单值)
source = source.replace(/border-radius:\s*(\d+)px(?=\s*[;}])/g, (whole, num) => {
  const token = RADIUS[norm(num)];
  if (!token) return whole;
  changes.push(whole + ' → var(' + token + ')');
  return 'border-radius: var(' + token + ')';
});

// z-index: N
source = source.replace(/z-index:\s*(-?\d+)(?=\s*[;}])/g, (whole, num) => {
  const token = Z[norm(num)];
  if (!token) return whole;
  changes.push(whole + ' → var(' + token + ')');
  return 'z-index: var(' + token + ')';
});

console.log(file + ': ' + changes.length + ' 处可收敛');
for (const line of changes) console.log('  ' + line);
if (write) { fs.writeFileSync(abs, source); console.log('已写入。'); }
else console.log('(预览模式,加 --write 落盘)');
