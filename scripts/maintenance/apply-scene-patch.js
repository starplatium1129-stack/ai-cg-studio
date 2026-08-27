'use strict';

/**
 * apply-scene-patch.js — 通用场景/蓝图补丁应用器。
 *
 * 目的：让大量场景优化从“脚本盲改整个 JSON”变成“逐条补丁 + diff 审阅 + 校验回滚”。
 * 支持经典场景（data/scenes/*.json）和热门角色蓝图（data/scene-blueprints.json）。
 *
 * 用法：
 *   node scripts/maintenance/apply-scene-patch.js --patch <patch.json> [--apply] [--out <report.json>] [--dry-run]
 *
 * 补丁文件格式（JSON 数组）：
 * [
 *   { "id": "sc042", "type": "scene", "changes": { "prompt": "...", "animaCaption": "..." } },
 *   { "id": "raiden_shogun_tenshukaku", "type": "blueprint", "changes": { "promptProse": "...", "promptTokens": ["..."] } }
 * ]
 *
 * 默认 dry-run：只输出 diff，不写盘。加 --apply 才真正写盘并跑校验，失败自动回滚。
 * 受保护定稿场景（data/prompt-pinned-scenes.json）的 prompt/negative/animaCaption/
 * recommendedSize/rating/mature 字段会被强制跳过。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const SCENES_DIR = path.join(DATA_DIR, 'scenes');
const BLUEPRINTS_PATH = path.join(DATA_DIR, 'scene-blueprints.json');
const STORE_PATH = path.join(ROOT, 'src', 'stores', 'sceneStore.ts');
const BACKUP_ROOT = path.join(ROOT, 'runtime', 'maintenance-backups');
const PINNED_PATH = path.join(DATA_DIR, 'prompt-pinned-scenes.json');

const PROTECTED_SCENE_FIELDS = ['prompt', 'negative', 'animaCaption', 'recommendedSize', 'rating', 'mature'];

function readJson(source) {
  return JSON.parse(fs.readFileSync(source, 'utf8'));
}

function writeTextAtomic(source, content) {
  const dir = path.dirname(source);
  fs.mkdirSync(dir, { recursive: true });
  const temporary = path.join(dir, `.${path.basename(source)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, source);
  } catch (error) {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (cleanupError) {}
    throw error;
  }
}

function writeJsonAtomic(source, data) {
  writeTextAtomic(source, JSON.stringify(data, null, 2) + '\n');
}

function snapshotFiles(files) {
  return Array.from(new Set(files)).map((file) => {
    const exists = fs.existsSync(file);
    return { file, exists, content: exists ? fs.readFileSync(file) : null };
  });
}

function restoreSnapshot(snapshot) {
  snapshot.forEach((item) => {
    if (item.exists) writeTextAtomic(item.file, item.content);
    else if (fs.existsSync(item.file)) fs.unlinkSync(item.file);
  });
}

function saveSnapshotBackup(snapshot, label) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(BACKUP_ROOT, stamp + '-' + label);
  const filesDir = path.join(target, 'files');
  fs.mkdirSync(filesDir, { recursive: true });
  const manifest = snapshot.map((item, index) => {
    const backupName = item.exists ? String(index).padStart(3, '0') + '-' + path.basename(item.file) : '';
    if (item.exists) fs.writeFileSync(path.join(filesDir, backupName), item.content);
    return { source: item.file, existed: item.exists, backup: backupName };
  });
  writeJsonAtomic(path.join(target, 'manifest.json'), { createdAt: new Date().toISOString(), label, files: manifest });
  return target;
}

function computeContentVersion() {
  const hash = crypto.createHash('sha1');
  const files = [
    'scenes.json', 'scenes-index.json', 'scenes-core.json',
    'scenes-nene.json', 'scenes-natsume.json', 'scenes-shared.json',
    'curation.json', 'characters.json', 'loras.json', 'tags.json', 'presets.json',
    'popular-characters.json', 'scene-blueprints.json'
  ];
  for (const name of files) {
    const file = path.join(DATA_DIR, name);
    if (fs.existsSync(file)) {
      hash.update(name + '=' + fs.readFileSync(file, 'utf8').length + ';');
      hash.update(fs.readFileSync(file));
    }
  }
  return Number(parseInt(hash.digest('hex').slice(0, 8), 16));
}

function syncSceneStoreDataVersion() {
  const expected = computeContentVersion();
  if (fs.existsSync(STORE_PATH)) {
    const source = fs.readFileSync(STORE_PATH, 'utf8');
    const next = source.replace(/DATA_VERSION\s*=\s*\d+/, 'DATA_VERSION = ' + expected);
    fs.writeFileSync(STORE_PATH, next, 'utf8');
  }
  return expected;
}

function loadPinnedScenes() {
  try {
    const data = readJson(PINNED_PATH);
    return data && data.scenes && typeof data.scenes === 'object' ? data.scenes : {};
  } catch (error) {
    return {};
  }
}

function parseArgs(argv) {
  const args = { patch: null, apply: false, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--patch') args.patch = argv[++i];
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
  }
  return args;
}

function printHelp() {
  console.log(`用法: node scripts/maintenance/apply-scene-patch.js --patch <patch.json> [--apply] [--out <report.json>]`);
  console.log('');
  console.log('默认 dry-run，只输出 diff。--apply 才写盘并校验，失败自动回滚。');
}

function loadPatch(file) {
  if (!file) throw new Error('缺少 --patch <patch.json>');
  const raw = readJson(file);
  if (!Array.isArray(raw)) throw new Error('补丁文件根节点必须是数组');
  return raw;
}

function applyChanges(record, changes) {
  const applied = JSON.parse(JSON.stringify(record));
  const diff = {};
  for (const key of Object.keys(changes)) {
    const from = applied[key];
    const to = changes[key];
    applied[key] = to;
    if (JSON.stringify(from) !== JSON.stringify(to)) diff[key] = { from, to };
  }
  return { record: applied, diff };
}

function applyScenePatches(scenes, entries, pinned) {
  const results = [];
  const errors = [];
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  for (const entry of entries) {
    if (entry.type !== 'scene') continue;
    const id = String(entry.id || '');
    const current = byId.get(id);
    if (!current) { errors.push('场景不存在: ' + id); continue; }
    let changes = { ...(entry.changes || {}) };
    const protectedHits = Object.keys(changes).filter((key) => PROTECTED_SCENE_FIELDS.includes(key));
    if (pinned[id] && protectedHits.length) {
      for (const key of protectedHits) delete changes[key];
      if (!Object.keys(changes).length) {
        results.push({ id, type: 'scene', skipped: 'protected pinned scene', protectedFields: protectedHits });
        continue;
      }
    }
    const { record, diff } = applyChanges(current, changes);
    results.push({ id, type: 'scene', diff, protectedFields: protectedHits.length && pinned[id] ? protectedHits : [] });
    Object.assign(current, record);
  }
  return { results, errors };
}

function applyBlueprintPatches(blueprints, entries) {
  const results = [];
  const errors = [];
  const byId = new Map(blueprints.map((blueprint) => [blueprint.id, blueprint]));
  for (const entry of entries) {
    if (entry.type !== 'blueprint') continue;
    const id = String(entry.id || '');
    const current = byId.get(id);
    if (!current) { errors.push('蓝图不存在: ' + id); continue; }
    const { record, diff } = applyChanges(current, entry.changes || {});
    results.push({ id, type: 'blueprint', diff });
    Object.assign(current, record);
  }
  return { results, errors };
}

function runValidation(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = (result.stderr || result.stdout || '').trim().slice(-1200);
    throw new Error(path.basename(script) + ' 校验失败:\n' + output);
  }
}

function main() {
  const args = parseArgs(process.argv);
  let patch;
  try {
    patch = loadPatch(args.patch);
  } catch (error) {
    console.error('[apply-scene-patch] ' + error.message);
    process.exit(2);
  }

  const sceneStore = require('../runtime/scene-store');
  const scenes = sceneStore.loadSceneShards().scenes;
  const blueprintFile = fs.existsSync(BLUEPRINTS_PATH) ? readJson(BLUEPRINTS_PATH) : { version: 2, blueprints: [] };
  const blueprints = Array.isArray(blueprintFile.blueprints) ? blueprintFile.blueprints : [];
  const pinned = loadPinnedScenes();

  const sceneResult = applyScenePatches(scenes, patch, pinned);
  const blueprintResult = applyBlueprintPatches(blueprints, patch);
  const errors = [...sceneResult.errors, ...blueprintResult.errors];
  const allResults = [...sceneResult.results, ...blueprintResult.results];
  const changed = allResults.filter((item) => item.diff && Object.keys(item.diff).length);
  const skipped = allResults.filter((item) => item.skipped);

  if (errors.length) {
    console.error('[apply-scene-patch] 补丁存在错误，未执行任何写入:');
    errors.forEach((error) => console.error('  - ' + error));
    process.exit(1);
  }

  console.log('[apply-scene-patch] 补丁 ' + patch.length + ' 条 | 命中 ' + allResults.length + ' | 实际变更 ' + changed.length + ' | 跳过 ' + skipped.length);
  for (const item of changed) {
    console.log('  • ' + item.type + ' ' + item.id + ': ' + Object.keys(item.diff).join(', '));
    for (const [field, value] of Object.entries(item.diff)) {
      console.log('      ' + field + ':');
      console.log('        - ' + JSON.stringify(value.from));
      console.log('        + ' + JSON.stringify(value.to));
    }
  }
  for (const item of skipped) {
    console.log('  • ' + item.type + ' ' + item.id + ' (跳过受保护字段 ' + item.protectedFields.join(', ') + ')');
  }

  if (args.out) {
    writeJsonAtomic(args.out, {
      appliedAt: new Date().toISOString(),
      dryRun: !args.apply,
      entries: patch.length,
      matched: allResults.length,
      changed: changed.length,
      skipped: skipped.length,
      results: allResults,
      errors,
    });
    console.log('[apply-scene-patch] 报告已写入 ' + args.out);
  }

  if (!args.apply) {
    console.log('[apply-scene-patch] dry-run：未写盘。确认无误后加 --apply 生效。');
    return;
  }

  // ── 真正写盘 ─────────────────────────────────────────────
  const filesToSnapshot = [];
  if (fs.existsSync(SCENES_DIR)) {
    fs.readdirSync(SCENES_DIR).forEach((name) => filesToSnapshot.push(path.join(SCENES_DIR, name)));
  }
  ['scenes.json', 'scenes-index.json', 'scenes-core.json', 'scenes-nene.json', 'scenes-natsume.json', 'scenes-shared.json']
    .forEach((name) => filesToSnapshot.push(path.join(DATA_DIR, name)));
  if (fs.existsSync(BLUEPRINTS_PATH)) filesToSnapshot.push(BLUEPRINTS_PATH);
  filesToSnapshot.push(STORE_PATH);
  const snapshot = snapshotFiles(filesToSnapshot.filter((file) => fs.existsSync(file)));
  const backupDir = saveSnapshotBackup(snapshot, 'scene-patch');

  try {
    if (changed.some((item) => item.type === 'scene')) {
      sceneStore.writeSceneSet(scenes);
    }
    if (changed.some((item) => item.type === 'blueprint')) {
      writeJsonAtomic(BLUEPRINTS_PATH, { version: blueprintFile.version || 2, blueprints });
    }
    // 先同步 DATA_VERSION，再跑内容契约校验（校验会检查 DATA_VERSION）。
    syncSceneStoreDataVersion();
    runValidation(path.join('scripts', 'maintenance', 'validate-scenes.js'));
    runValidation(path.join('scripts', 'maintenance', 'validate-content-contracts.js'));
    const version = syncSceneStoreDataVersion();
    console.log('[apply-scene-patch] 已写入并校验通过，备份 ' + path.basename(backupDir) + '，DATA_VERSION=' + version);
  } catch (error) {
    restoreSnapshot(snapshot);
    console.error('[apply-scene-patch] 写入/校验失败，已回滚：' + error.message);
    process.exit(1);
  }
}

main();
