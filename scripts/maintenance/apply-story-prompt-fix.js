#!/usr/bin/env node
'use strict';

/**
 * scripts/maintenance/apply-story-prompt-fix.js — 故事↔提示词修复 delta 合并器
 *
 * 背景：2026-08-26 全量审计（docs/archive/troubleshooting/scene-story-prompt-audit-2026-08-26.md）发现
 * 场景库 217 条 / 蓝图 320+ 条「故事 vs 提示词」不一致。修复由子代理逐条按故事
 * 原文重写，产出 delta 文件（仅含需修改的字段），本脚本负责合并落库：
 *
 *   场景 delta 字段: prompt / animaCaption / tags / negative / timeOfDay /
 *                    weather / location / camera / lighting / emotion / season / time
 *   蓝图 delta 字段: promptProse / promptTokens / nsfwProse / nsfwTokens /
 *                    negativeTokens / sceneTags / timeOfDay / lighting / camera /
 *                    mood / action / outfitId
 *
 * 流程：delta -> 写回分片(data/scenes/*.json)与 scene-blueprints.json
 *       -> 重建 data/scenes.json（scene-store 聚合）-> 同步 DATA_VERSION
 *       -> 生成 delivery 全量文件（供 test-prompt-rewrite-integrity 复检）
 *
 * 用法:
 *   node scripts/maintenance/apply-story-prompt-fix.js --delta <dir> [--dry-run]
 *   --delta <dir>   扫描 dir 下 rewrite-scenes-*.json 与 rewrite-bp-*.json
 *   --dry-run       只预览不改盘、不重建
 *   --delivery-out <path>  交付全量文件输出路径（默认 <delta>/delivery-full.json）
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

const SCENE_FIELDS = ['prompt', 'animaCaption', 'tags', 'negative', 'timeOfDay', 'weather', 'location', 'camera', 'lighting', 'emotion', 'season', 'time'];
const BP_FIELDS = ['promptProse', 'promptTokens', 'nsfwProse', 'nsfwTokens', 'negativeTokens', 'sceneTags', 'timeOfDay', 'lighting', 'camera', 'mood', 'action', 'outfitId'];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { deltaDir: null, dryRun: false, deliveryOut: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--delta') opts.deltaDir = args[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--delivery-out') opts.deliveryOut = args[++i];
  }
  return opts;
}

function loadSceneShardsMap() {
  const dir = path.join(ROOT, 'data', 'scenes');
  const map = new Map(); // id -> { filePath, arr, item }
  const arrCache = new Map(); // filePath -> array
  if (!fs.existsSync(dir)) throw new Error('data/scenes 分片目录不存在');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'manifest.json')) {
    const full = path.join(dir, f);
    const arr = readJsonFile(full);
    arrCache.set(full, arr);
    for (const item of arr) map.set(item.id, { filePath: full, arr, item });
  }
  return { map, arrCache };
}

function loadBlueprints() {
  const file = path.join(ROOT, 'data', 'scene-blueprints.json');
  const data = readJsonFile(file);
  const list = data.blueprints || data;
  return { file, data, list };
}

function collectDeltas(deltaDir) {
  const scenes = [];
  const bps = [];
  if (!fs.existsSync(deltaDir)) throw new Error(`delta 目录不存在: ${deltaDir}`);
  for (const f of fs.readdirSync(deltaDir)) {
    if (!/^rewrite-(scenes|bp)-.+\.json$/.test(f)) continue;
    const arr = readJsonFile(path.join(deltaDir, f));
    if (!Array.isArray(arr)) throw new Error(`${f} 必须是数组`);
    if (f.startsWith('rewrite-scenes-')) scenes.push(...arr);
    else bps.push(...arr);
  }
  return { scenes, bps };
}

function main() {
  const opts = parseArgs();
  if (!opts.deltaDir) {
    console.error('用法: node scripts/maintenance/apply-story-prompt-fix.js --delta <dir> [--dry-run]');
    process.exit(1);
  }

  const { scenes, bps } = collectDeltas(opts.deltaDir);
  console.log(`[delta] 场景 ${scenes.length} 条 / 蓝图 ${bps.length} 条`);

  const { map: sceneMap, arrCache } = loadSceneShardsMap();
  const bpData = loadBlueprints();
  const bpById = new Map(bpData.list.map((b) => [b.id, b]));

  const delivery = [];
  const touchedShards = new Set();
  let appliedScenes = 0;
  let appliedBps = 0;
  const errors = [];

  // ---------- 场景 ----------
  for (const d of scenes) {
    if (!d || !d.id) { errors.push('场景 delta 缺 id'); continue; }
    const hit = sceneMap.get(d.id);
    if (!hit) { errors.push(`scenes: ${d.id} 不存在`); continue; }
    // 官方CG/实机审核保护：usage 含标记的场景禁止批量改写提示词（故事是唯一事实源，
    // 此类场景为人工复刻/验收成果，见 docs/archive/troubleshooting/scene-story-prompt-fix-report-2026-08-27.md）
    const usage = Array.isArray(hit.item.usage) ? hit.item.usage.join('') : String(hit.item.usage || '');
    if (/官方CG|官方.?cg|实机审核|复刻/i.test(usage)) {
      console.log(`[保护] ${d.id}（${hit.item.title || ''}）：官方CG/实机审核场景，跳过提示词写入`);
      continue;
    }
    let changed = false;
    for (const f of SCENE_FIELDS) {
      if (!(f in d)) continue;
      const v = d[f];
      const cur = Array.isArray(hit.item[f]) ? JSON.stringify(hit.item[f]) : String(hit.item[f] ?? '');
      const nv = Array.isArray(v) ? JSON.stringify(v) : String(v ?? '');
      if (cur !== nv) { hit.item[f] = v; changed = true; }
    }
    if (changed) {
      appliedScenes++;
      touchedShards.add(hit.filePath);
      // delivery 仅收录真正重写了提示词承载字段的条目（供 integrity 复检，避免仅改元数据的条目被误判“未重写”）
      if ('prompt' in d || 'animaCaption' in d) {
        delivery.push({ id: d.id, type: 'scene', prompt: d.prompt ?? hit.item.prompt, animaCaption: d.animaCaption ?? hit.item.animaCaption, char: hit.item.char });
      }
    }
  }
  for (const fp of touchedShards) {
    if (!opts.dryRun) {
      fs.writeFileSync(fp, JSON.stringify(arrCache.get(fp), null, 2) + '\n', 'utf8');
    }
    console.log(`[scenes] ${path.basename(fp)} 已${opts.dryRun ? '预览（未写盘）' : '写回'}`);
  }

  // ---------- 蓝图 ----------
  for (const d of bps) {
    if (!d || !d.id) { errors.push('蓝图 delta 缺 id'); continue; }
    const b = bpById.get(d.id);
    if (!b) { errors.push(`bp: ${d.id} 不存在`); continue; }
    let changed = false;
    for (const f of BP_FIELDS) {
      if (!(f in d)) continue;
      const v = d[f];
      const cur = Array.isArray(b[f]) ? JSON.stringify(b[f]) : String(b[f] ?? '');
      const nv = Array.isArray(v) ? JSON.stringify(v) : String(v ?? '');
      if (cur !== nv) { b[f] = v; changed = true; }
    }
    if (changed) {
      appliedBps++;
      if ('promptProse' in d || 'promptTokens' in d || 'nsfwProse' in d || 'nsfwTokens' in d) {
        delivery.push({ id: d.id, type: 'popular', promptTokens: d.promptTokens ?? b.promptTokens ?? [], promptProse: d.promptProse ?? b.promptProse ?? '', characterId: b.characterId });
      }
    }
  }

  errors.forEach((e) => console.error('[FAIL] ' + e));
  console.log(`[结果] 场景应用 ${appliedScenes}/${scenes.length} | 蓝图应用 ${appliedBps}/${bps.length} | 交付 ${delivery.length} 条`);

  if (!opts.dryRun && delivery.length) {
    fs.writeFileSync(bpData.file, JSON.stringify(bpData.data, null, 2) + '\n', 'utf8');
    console.log('[bp] scene-blueprints.json 已写回');

    // 重建聚合 + DATA_VERSION
    const r = spawnSync('npm', ['run', 'scenes:build'], { cwd: ROOT, shell: true, encoding: 'utf8' });
    if (r.status !== 0) {
      console.error('[重建失败]' + (r.stderr || r.stdout || ''));
      process.exit(2);
    }
    console.log(r.stdout.trim().split('\n').filter(Boolean).join('\n'));

    const deliveryOut = opts.deliveryOut || path.join(opts.deltaDir, 'delivery-full.json');
    fs.writeFileSync(deliveryOut, JSON.stringify(delivery, null, 1) + '\n', 'utf8');
    console.log(`[delivery] ${deliveryOut}`);
  } else if (opts.dryRun) {
    console.log('[dry-run] 未写盘');
  }

  if (errors.length) process.exit(3);
  process.exit(0);
}

if (require.main === module) main();
module.exports = { SCENE_FIELDS, BP_FIELDS };