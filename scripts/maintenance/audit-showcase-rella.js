#!/usr/bin/env node
'use strict';

/**
 * audit-showcase-rella.js — 逐张审核 rella 样张（强制角色身份判定）。
 *
 * 对 generation-manifest.json 中每条 succeeded 记录：
 *   - 用 image-inspect.js（CLIProxyAPI + gemini-3.7-flash-high）逐张看图
 *   - 审核维度：① 角色身份（是否是对应角色，必须对照档案特征）② 单人主体
 *     ③ 肢体/面部 ④ 乱码/伪影 ⑤ 场景契合
 *   - 输出 audit-results.json（verdict: pass | fail | review，身份不符强制 fail）
 *
 * Usage:
 *   node scripts/maintenance/audit-showcase-rella.js \
 *       [--manifest <generation-manifest.json>] [--out <audit-results.json>] \
 *       [--limit <n>] [--resume]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_MANIFEST = path.join(ROOT, '..', 'AI', 'Reviews', 'ShowcaseRefresh', '2026-08-15_v33-arknights-rella', 'generation-manifest.json');
const DEFAULT_OUT = path.join(ROOT, '..', 'AI', 'Reviews', 'ShowcaseRefresh', '2026-08-15_v33-arknights-rella', 'audit-results.json');

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

const characters = readJson(path.join(ROOT, 'data', 'popular-characters.json')).characters;

function expectedFeatures(character) {
  const top = (character.identityTokens || []).filter(t => !['1girl', 'solo', 'arknights'].includes(t)).slice(0, 10).join(' / ');
  const outfit = (character.outfits || []).find(o => o.default) || (character.outfits || [])[0];
  return `${character.displayName}（${character.originalName}）\n身份描述：${character.identityProse}\n关键标识：${top}\n主服装：${outfit ? outfit.prose : '（未定义）'}`;
}

function buildPrompt(record) {
  const character = characters.find(c => c.id === record.characterId) || { displayName: record.characterId, identityProse: '', identityTokens: [] };
  const expected = expectedFeatures(character);
  return `你是画师样张审核员。这是「${record.displayName}」的出图审核（画师 @rella 风格，蓝图「${record.blueprintTitle}」）。\n\n【该角色的预期特征】\n${expected}\n\n请逐项审核并严格按格式输出：\n1) 角色身份：画面中的人物是否确实是「${character.displayName}」本人？必须逐项对照预期特征（发色/瞳色/发型/标志特征/服装），明确回答 是 或 否，并说明依据（若不像，说清被画成了什么/哪里不像）；\n2) 单人主体：画面中心是否仅一人（有无多余人物/分身/双人）；\n3) 肢体与面部：有无崩坏（手/脸/肢体/穿模/结构错误）；\n4) 乱码伪影：有无文字乱码、水印、生成伪影；\n5) 场景契合：场景与蓝图主题是否匹配（蓝图：${record.blueprintTitle}）。\n\n【输出格式】（必须两行开头，后面可加详细说明）\n第一行：结论：通过 / 不通过 / 需注意\n第二行：角色身份：是 / 否\n之后：逐项说明。`;
}

function parseVerdict(output) {
  const text = String(output || '');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const concl = lines.find(l => l.startsWith('结论'));
  const identity = lines.find(l => l.startsWith('角色身份'));
  let verdict = 'review';
  if (concl) {
    if (concl.includes('通过')) verdict = 'pass';
    else if (concl.includes('不通过')) verdict = 'fail';
    else verdict = 'review';
  }
  // 身份不符 → 强制 fail
  if (identity && (identity.includes('：否') || identity.includes(':否') || identity.includes('身份：否'))) {
    verdict = 'fail';
  }
  return { verdict, summary: text.slice(0, 1200), identityLine: identity || '' };
}

async function main() {
  const manifestPath = path.resolve(argument('--manifest', DEFAULT_MANIFEST));
  const outPath = path.resolve(argument('--out', DEFAULT_OUT));
  const limit = Math.max(1, Number(argument('--limit', '9999')) || 9999);
  const resume = process.argv.includes('--resume');

  const records = readJson(manifestPath).filter(r => r.status === 'succeeded');
  const audit = resume && fs.existsSync(outPath) ? readJson(outPath) : {};
  const pending = records.filter(r => !audit[r.recordId] || audit[r.recordId].verdict !== 'pass');
  console.log(`[plan] ${records.length} succeeded records, ${pending.length} to inspect (limit ${limit})`);

  let inspected = 0;
  let pass = 0, fail = 0, review = 0;
  for (const record of pending) {
    if (inspected >= limit) break;
    const imagePath = path.join(path.dirname(manifestPath), record.image);
    if (!fs.existsSync(imagePath)) {
      console.log(`[missing] ${record.recordId}: ${imagePath}`);
      audit[record.recordId] = { ok: false, verdict: 'fail', summary: 'image file missing', inspectedAt: new Date().toISOString() };
      fail += 1;
      continue;
    }
    const prompt = buildPrompt(record);
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'maintenance', 'image-inspect.js'), imagePath, '-p', prompt], {
      encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024,
    });
    const output = (result.stdout || '') + (result.stderr || '');
    const { verdict, summary, identityLine } = parseVerdict(output);
    audit[record.recordId] = { ok: true, verdict, summary, identityLine, inspectedAt: new Date().toISOString() };
    inspected += 1;
    if (verdict === 'pass') pass += 1;
    else if (verdict === 'fail') fail += 1;
    else review += 1;
    console.log(`[${verdict}] ${record.recordId}${identityLine ? ' | ' + identityLine : ''}`);
    if (inspected % 5 === 0) {
      writeJsonAtomic(outPath, audit);
      console.log(`  ...progress ${inspected}/${pending.length} (pass ${pass} fail ${fail} review ${review})`);
    }
  }
  writeJsonAtomic(outPath, audit);
  console.log(JSON.stringify({ inspected, pass, fail, review, total: records.length }, null, 2));
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
