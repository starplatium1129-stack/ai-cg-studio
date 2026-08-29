'use strict';

// 对比度核算 —— 验证设计 token 是否满足 DESIGN.md §Colors 的 WCAG AA。
// 2026-08-28: 主题锁定深色(美术审计 · 方案 A)，浅色覆盖已从设计系统移除，
// 这里只核算深色一套。若未来恢复双主题，把 block('[data-theme="light"]')
// 与下面的主题循环加回来即可。
// 用法: node scripts/maintenance/check-contrast.js
//
// 只核算"会被当文字色使用"的 token(功能色 + mood + 角色品牌色)。
// AA 正文阈值 4.5:1;大号文字/图形 3:1。这里一律按 4.5 严格核算。

const sources = require('./style-sources');

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

// 从 :root 取 token 值（深色是唯一主题）
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

// 真正会被当文字色使用的 token。
// 功能色与 mood 色的原 token 只做背景/描边,故不在此列 —— 文字走 --*-text。
const TEXT_TOKENS = [
  '--success-text', '--warning-text', '--danger-text', '--info-text',
  '--mood-joy-text', '--mood-love-text', '--mood-calm-text',
  '--mood-sad-text', '--mood-tension-text', '--mood-warmth-text',
  '--nene-violet', '--natsume-amber', '--accent', '--accent-violet',
  '--text-primary', '--text-secondary', '--text-muted', '--text-disabled'
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

for (const [themeName, tokens] of [['dark', dark]]) {
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
for (const [themeName, tokens] of [['dark', dark]]) {
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

// ---- SFC <style> 块局部文字色（2026-08-29 接入，补组件级盲区）----
// 令牌全绿不代表组件全绿：各 SFC 里还散落着字面 hex 的 color: 声明，
// 它们不经过 design-system.css，令牌检查天然看不到。这里补一层：
// 只查字面 hex 的 `color:`（var()/rgb()/color-mix() 已由令牌/字面量门槛另行把关）。
// 落点候选 = 全局 4 个表面 + 规则自身声明的背景色（hover 亮底配黑字这类
// "on-accent" 文字落在规则自己的背景上，不能错杀）。
// 全部候选落点都低于 4.5:1 才判 FAIL。
console.log('\n=== SFC <style> 局部文字色（组件级盲区补扫） ===');
let sfcChecks = 0;
let sfcFailures = 0;
let sfcExempt = 0;
const sfcSurfaces = SURFACES.map((name) => ({ name, bg: compositeSurface(dark, name, hexToRgb(dark['--bg-deep'])) })).filter((s) => s.bg);

// 从声明值里解析出可计算的颜色。除字面 hex 外，也解析 rgba() / rgb() /
// color-mix() / var() 令牌 —— 半透明白字（rgba(255,255,255,.6)）是组件里最常见的
// 漏网写法，不合成到落点上根本看不出它压线不过。
const SKIP_VALUES = new Set(['transparent', 'inherit', 'initial', 'unset', 'currentColor', 'none']);
function declColor(raw, parentRgb) {
  const value = raw.replace(/!important/g, '').trim();
  if (!value || SKIP_VALUES.has(value)) return null;
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
    const digits = value.slice(1);
    const full = digits.length <= 4 ? digits.split('').slice(0, 3).map((c) => c + c).join('') : digits;
    return hexToRgb('#' + full.slice(0, 6));
  }
  const alias = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  const expr = alias ? resolve(dark, alias[1]) : value;
  if (!expr) return null;
  return compositeSurface({ ...dark, tmp: expr }, 'tmp', parentRgb);
}

for (const file of sources.sfcFiles()) {
  const source = sources.read(file);
  for (const styleMatch of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const baseLine = source.slice(0, styleMatch.index).split('\n').length - 1;
    const styleBody = styleMatch[1];
    for (const rule of styleBody.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const ruleBody = rule[2];
      const ownBackgrounds = [];
      let ownBgUnknown = false; // 规则自身声明了底色但解析不动（动态 var/渐变/图像）
      for (const bg of ruleBody.matchAll(/(?:^|;)\s*(?:background(?:-color)?|backdrop)\s*:\s*([^;}]+)/g)) {
        const rgb = declColor(bg[1], hexToRgb(dark['--bg-deep']));
        if (rgb) ownBackgrounds.push(rgb);
        else if (!SKIP_VALUES.has(bg[1].replace(/!important/g, '').trim())) ownBgUnknown = true;
      }
      // 装饰性渐变/水印：按项目约定显式写 contrast-exempt 并给理由，与动效门禁的
      // compositor-exempt 同一治理思路（可见、可查、可评审），不用通符放行。
      // 标记写在规则的选择器段（选择器与 `{` 之间的注释块）里，只作用于紧随的那条规则，
      // 不会顺带豁免邻居。
      const exempt = /contrast-exempt\s*:/.test(rule[1]);
      if (exempt) sfcExempt += 1;
      for (const decl of ruleBody.matchAll(/(?<![-\w])color\s*:\s*([^;}]+)/g)) {
        const rawValue = decl[1].replace(/!important/g, '').trim();
        if (!/^(#|rgb|hsl|color-mix|var\()/i.test(rawValue)) continue;
        if (exempt || ownBgUnknown) continue; // 落点未知或已声明豁免 —— 不猜、不错杀
        const line = baseLine + styleBody.slice(0, rule.index + rule[1].length + 2 + decl.index).split('\n').length;
        const candidates = sfcSurfaces.map((s) => ({ name: s.name, bg: s.bg })).concat(
          ownBackgrounds.map((bg, i) => ({ name: '规则自身背景#' + (i + 1), bg }))
        );
        // 前景色随落点合成（alpha 值要在具体背景上才算得准），解析不动的跳过
        const results = [];
        for (const c of candidates) {
          const fg = declColor(rawValue, c.bg);
          if (fg) results.push(ratio(fg, c.bg));
        }
        if (!results.length) continue;
        sfcChecks += 1;
        // 判定语义：规则自身声明了可解析背景 → 文字必然落在它上面，硬判该落点；
        // 没有自身背景 → 落在父级表面但具体是哪个未知，要求 4 个表面全部达标。
        let ok, detail;
        if (ownBackgrounds.length && results[sfcSurfaces.length] !== undefined) {
          ok = results[sfcSurfaces.length] >= 4.5;
          detail = '自身背景 ' + results[sfcSurfaces.length].toFixed(2) + ':1';
        } else {
          const min = Math.min.apply(null, results);
          ok = min >= 4.5;
          detail = '全表面最低 ' + min.toFixed(2) + ':1';
        }
        if (!ok) {
          sfcFailures += 1;
          console.log('  FAIL ' + file + ':' + line + '  color: ' + rawValue + '  ' + detail);
        }
      }
    }
  }
}
console.log('  SFC 局部文字色检查 ' + sfcChecks + ' 处，FAIL ' + sfcFailures + ' 处，已豁免 ' + sfcExempt + ' 处');

if (process.argv.includes('--check') && (failures > 0 || nonTextFailures > 0 || sfcFailures > 0)) process.exit(1);
