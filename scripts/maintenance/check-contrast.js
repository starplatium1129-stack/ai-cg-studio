'use strict';

// 对比度核算 —— 验证设计 token 在两个主题下是否满足 DESIGN.md §Colors 的 WCAG AA。
// 用法: node scripts/maintenance/check-contrast.js
//
// 只核算"会被当文字色使用"的 token(功能色 + mood + 角色品牌色)。
// AA 正文阈值 4.5:1;大号文字/图形 3:1。这里一律按 4.5 严格核算。

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'css', 'design-system.css'), 'utf8');

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// 从 :root 与 [data-theme="light"] 各自取 token 值
function block(selector) {
  const index = css.indexOf(selector);
  if (index < 0) return {};
  const open = css.indexOf('{', index);
  const close = css.indexOf('\n}', open);
  const body = css.slice(open, close);
  const map = {};
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map[match[1]] = match[2].trim();
  return map;
}

const dark = block(':root');
const light = block('[data-theme="light"]');

// 真正会被当文字色使用的 token。
// 功能色与 mood 色的原 token 只做背景/描边,故不在此列 —— 文字走 --*-text。
const TEXT_TOKENS = [
  '--success-text', '--warning-text', '--danger-text', '--info-text',
  '--mood-joy-text', '--mood-love-text', '--mood-calm-text',
  '--mood-sad-text', '--mood-tension-text', '--mood-warmth-text',
  '--nene-violet', '--natsume-amber', '--accent', '--accent-violet',
  '--text-primary', '--text-secondary', '--text-muted'
];

// 解开 var(--x) 别名链,拿到最终字面值
function resolve(tokens, name, depth) {
  const raw = tokens[name];
  if (!raw) return null;
  if ((depth || 0) > 8) return null;
  const alias = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return alias ? resolve(tokens, alias[1], (depth || 0) + 1) : raw;
}

let failures = 0;

for (const [themeName, tokens, bgToken] of [['dark', dark, '--bg-deep'], ['light', { ...dark, ...light }, '--bg-deep']]) {
  const bgRaw = tokens[bgToken];
  if (!/^#/.test(bgRaw || '')) { console.log(themeName + ': 背景不是 hex,跳过'); continue; }
  const bg = hexToRgb(bgRaw);
  console.log('\n=== ' + themeName + ' theme (底色 ' + bgRaw + ') ===');
  for (const name of TEXT_TOKENS) {
    const raw = resolve(tokens, name);
    if (!raw || !/^#/.test(raw)) { console.log('  ' + name.padEnd(22) + ' (非 hex,跳过: ' + raw + ')'); continue; }
    const value = ratio(hexToRgb(raw), bg);
    const ok = value >= 4.5;
    if (!ok) failures += 1;
    console.log('  ' + (ok ? 'OK  ' : 'FAIL') + ' ' + name.padEnd(22) + raw.padEnd(10) + value.toFixed(2) + ':1');
  }
}

console.log('\n未达 AA(4.5:1) 的文字 token: ' + failures + ' 项');
if (process.argv.includes('--check') && failures > 0) process.exit(1);
