'use strict';

// 对比度核算 —— 验证设计 token 在两个主题下是否满足 DESIGN.md §Colors 的 WCAG AA。
// 用法: node scripts/maintenance/check-contrast.js
//
// 只核算"会被当文字色使用"的 token(功能色 + mood + 角色品牌色)。
// AA 正文阈值 4.5:1;大号文字/图形 3:1。这里一律按 4.5 严格核算。

const fs = require('fs');
const path = require('path');

const sources = require('./style-sources');

const root = sources.ROOT;
// 必须读应用真正加载的那一份。曾经这里读 css/design-system.css，
// 而 SPA 加载的是 src/assets/css/design-system.css —— 门槛在审计一棵死树。
const css = sources.read(sources.DESIGN_SYSTEM);

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

// 文字实际会落在的表面。只测 --bg-deep 是不够的:
// --text-muted 合成到 --bg-elevated 上只有 4.03,而它确实用在那个表面。
const SURFACES = ['--bg-deep', '--bg-base', '--bg-surface', '--bg-elevated'];

// rgba()/color-mix() 表面要先合成到不透明父层才能算对比度
function compositeSurface(tokens, name, parentRgb, depth) {
  const raw = resolve(tokens, name);
  if (!raw) return null;
  if (/^#/.test(raw)) return hexToRgb(raw);

  const rgba = raw.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/);
  if (rgba) {
    const fg = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
    if (!parentRgb) return alpha >= 1 ? fg : null;
    return fg.map((c, i) => Math.round(c * alpha + parentRgb[i] * (1 - alpha)));
  }

  // color-mix(in srgb, A pct%, B) —— 只解析设计系统里实际用到的形态
  const mix = raw.match(/^color-mix\(\s*in\s+srgb\s*,\s*([^,]+?)\s+([\d.]+)%\s*,\s*([^)]+?)\s*\)$/);
  if (mix && (depth || 0) < 6) {
    const pct = Number(mix[2]) / 100;
    const a = resolveColor(tokens, mix[1].trim(), parentRgb, (depth || 0) + 1);
    const bRaw = mix[3].trim();
    const b = bRaw === 'transparent' ? parentRgb : resolveColor(tokens, bRaw, parentRgb, (depth || 0) + 1);
    if (!a || !b) return null;
    return a.map((c, i) => Math.round(c * pct + b[i] * (1 - pct)));
  }
  return null;
}

function resolveColor(tokens, expr, parentRgb, depth) {
  const varRef = expr.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (varRef) return compositeSurface(tokens, varRef[1], parentRgb, depth);
  if (/^#/.test(expr)) return hexToRgb(expr);
  if (expr === 'transparent') return parentRgb;
  const inline = { tmp: expr };
  return compositeSurface({ ...tokens, ...inline }, 'tmp', parentRgb, depth);
}

let failures = 0;

for (const [themeName, tokens] of [['dark', dark], ['light', { ...dark, ...light }]]) {
  const deepRaw = tokens['--bg-deep'];
  if (!/^#/.test(deepRaw || '')) { console.log(themeName + ': 背景不是 hex,跳过'); continue; }
  const deep = hexToRgb(deepRaw);

  for (const surfaceToken of SURFACES) {
    const bg = compositeSurface(tokens, surfaceToken, deep);
    if (!bg) { console.log('\n=== ' + themeName + ' / ' + surfaceToken + ' (无法解析,跳过) ==='); continue; }
    const hex = '#' + bg.map((c) => c.toString(16).padStart(2, '0')).join('');
    console.log('\n=== ' + themeName + ' theme / ' + surfaceToken + ' (合成后 ' + hex + ') ===');
    for (const name of TEXT_TOKENS) {
      const raw = resolve(tokens, name);
      if (!raw || !/^#/.test(raw)) { console.log('  ' + name.padEnd(22) + ' (非 hex,跳过: ' + raw + ')'); continue; }
      const value = ratio(hexToRgb(raw), bg);
      const ok = value >= 4.5;
      if (!ok) failures += 1;
      console.log('  ' + (ok ? 'OK  ' : 'FAIL') + ' ' + name.padEnd(22) + raw.padEnd(10) + value.toFixed(2) + ':1');
    }
  }
}

// SC 1.4.11:非文字图形（图标、状态点、分隔边框）阈值 3:1。
// AppToast 的四种类型只靠图标颜色区分,浅色主题下曾低到 1.90。
const NON_TEXT_TOKENS = ['--success', '--warning', '--danger', '--info'];
let nonTextFailures = 0;
for (const [themeName, tokens] of [['dark', dark], ['light', { ...dark, ...light }]]) {
  const deep = hexToRgb(tokens['--bg-deep']);
  const bg = compositeSurface(tokens, '--bg-elevated', deep) || deep;
  console.log('\n=== ' + themeName + ' theme / 非文字图形 3:1 (--bg-elevated) ===');
  for (const name of NON_TEXT_TOKENS) {
    const raw = resolve(tokens, name);
    if (!raw || !/^#/.test(raw)) continue;
    const value = ratio(hexToRgb(raw), bg);
    const ok = value >= 3;
    if (!ok) nonTextFailures += 1;
    console.log('  ' + (ok ? 'OK  ' : 'FAIL') + ' ' + name.padEnd(22) + raw.padEnd(10) + value.toFixed(2) + ':1');
  }
}

console.log('\n未达 AA(4.5:1) 的文字 token: ' + failures + ' 项');
console.log('未达 3:1 的非文字图形 token: ' + nonTextFailures + ' 项');
if (process.argv.includes('--check') && (failures > 0 || nonTextFailures > 0)) process.exit(1);
