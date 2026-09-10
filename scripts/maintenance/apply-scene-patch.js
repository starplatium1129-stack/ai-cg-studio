'use strict';

/**
 * Apply explicit scene/blueprint patches to canonical shards, never just aggregates.
 * Default: dry-run. --apply writes with a backup and rolls back on validation failure.
 * A missing/invalid pinned baseline or a protected-field edit rejects the whole plan.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { syncDataVersion } = require('../lib/data-version');

const ROOT = path.resolve(process.env.AICS_DATA_ROOT || process.env.AICS_APP_ROOT || path.join(__dirname, '../..'));
const PROTECTED_SCENE_FIELDS = Object.freeze(['prompt', 'negative', 'animaCaption', 'recommendedSize', 'rating', 'mature']);
const FORBIDDEN_KEYS = new Set(['id', '__proto__', 'prototype', 'constructor']);

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function jsonText(value) { return JSON.stringify(value, null, 2) + '\n'; }

function writeTextAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporary, content);
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* No temporary file after successful rename. */ }
    throw error;
  }
}

function loadPinnedScenes(file = path.join(ROOT, 'data/prompt-pinned-scenes.json')) {
  let data;
  try { data = readJson(file); } catch (error) {
    throw new Error(`定稿保护基线不可读取，拒绝应用补丁: ${error.message}`);
  }
  if (!object(data) || !object(data.scenes) || !Object.keys(data.scenes).length ||
      Object.values(data.scenes).some(value => !object(value))) {
    throw new Error('定稿保护基线结构无效，拒绝应用补丁');
  }
  return data.scenes;
}

function validatePatch(entries) {
  if (!Array.isArray(entries)) throw new Error('补丁文件根节点必须是数组');
  const seen = new Set();
  for (const entry of entries) {
    if (!object(entry) || !['scene', 'blueprint'].includes(entry.type) ||
        typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(entry.id) || !object(entry.changes)) {
      throw new Error('每条补丁必须有合法 type、id 和 changes 对象');
    }
    const key = `${entry.type}:${entry.id}`;
    if (seen.has(key)) throw new Error(`重复补丁: ${key}`);
    seen.add(key);
    if (Object.keys(entry.changes).some(key => FORBIDDEN_KEYS.has(key))) {
      throw new Error(`${key}: 不允许修改记录 ID 或原型字段`);
    }
  }
  return entries;
}

/** Build an immutable write plan from full canonical source documents. */
function planPatches(sources, entries, pinned) {
  validatePatch(entries);
  if (!object(pinned) || !Object.keys(pinned).length) throw new Error('缺少有效定稿保护基线');
  const documents = sources.map(source => ({ ...source, data: JSON.parse(JSON.stringify(source.data)) }));
  const byKey = new Map();
  for (const doc of documents) {
    const records = doc.type === 'scene' ? doc.data : doc.data.blueprints;
    if (!Array.isArray(records)) throw new Error(`分片结构无效: ${doc.file}`);
    for (const record of records) {
      const key = `${doc.type}:${record.id}`;
      if (byKey.has(key)) throw new Error(`源记录 ID 重复: ${key}`);
      byKey.set(key, { doc, record });
    }
  }
  // Preflight the entire plan before changing even its private copies.
  for (const entry of entries) {
    const key = `${entry.type}:${entry.id}`;
    if (!byKey.has(key)) throw new Error(`记录不存在: ${key}`);
    if (entry.type === 'scene' && Object.hasOwn(pinned, entry.id)) {
      const fields = Object.keys(entry.changes).filter(field => PROTECTED_SCENE_FIELDS.includes(field));
      if (fields.length) throw new Error(`定稿场景 ${entry.id} 的受保护字段禁止批量修改: ${fields.join(', ')}`);
    }
  }
  const changedFiles = new Set();
  const results = [];
  for (const entry of entries) {
    const { doc, record } = byKey.get(`${entry.type}:${entry.id}`);
    const diff = {};
    for (const [field, to] of Object.entries(entry.changes)) {
      const from = record[field];
      if (JSON.stringify(from) === JSON.stringify(to)) continue;
      diff[field] = { from, to };
      record[field] = to;
    }
    if (Object.keys(diff).length) changedFiles.add(doc.file);
    results.push({ id: entry.id, type: entry.type, diff });
  }
  return { results, writes: documents.filter(doc => changedFiles.has(doc.file)) };
}

function snapshotFiles(files) {
  return [...new Set(files)].map(file => ({ file, exists: fs.existsSync(file), content: fs.existsSync(file) ? fs.readFileSync(file) : null }));
}

function restoreSnapshot(snapshot) {
  for (const item of snapshot) {
    if (item.exists) writeTextAtomic(item.file, item.content);
    else if (fs.existsSync(item.file)) fs.unlinkSync(item.file);
  }
}

function saveBackup(snapshot, root) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;
  const target = path.join(root, 'runtime/maintenance-backups', stamp + '-scene-patch');
  fs.mkdirSync(path.join(target, 'files'), { recursive: true });
  const files = snapshot.map((item, index) => {
    const backup = item.exists ? `${String(index).padStart(3, '0')}-${path.basename(item.file)}` : '';
    if (item.exists) fs.writeFileSync(path.join(target, 'files', backup), item.content);
    return { source: path.relative(root, item.file), existed: item.exists, backup };
  });
  fs.writeFileSync(path.join(target, 'manifest.json'), jsonText({ createdAt: new Date().toISOString(), files }));
  return target;
}

/** Refresh only existing compressed siblings; missing compressed files remain optional. */
function refreshCompression(files) {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file);
    if (fs.existsSync(file + '.gz')) writeTextAtomic(file + '.gz', zlib.gzipSync(raw));
    if (fs.existsSync(file + '.br')) writeTextAtomic(file + '.br', zlib.brotliCompressSync(raw));
  }
}

/** Injectable rebuild/validate callbacks keep rollback behavior testable without real data. */
function commitPlan(plan, options) {
  if (!plan.writes.length) return { applied: false, outcome: 'unchanged' };
  const rawFiles = [...new Set([...plan.writes.map(doc => doc.file), ...options.derivedFiles])];
  const snapshot = snapshotFiles(rawFiles.flatMap(file => [file, file + '.gz', file + '.br']));
  const backup = saveBackup(snapshot, options.root);
  try {
    for (const doc of plan.writes) writeTextAtomic(doc.file, jsonText(doc.data));
    const version = options.rebuild();
    refreshCompression(rawFiles.filter(file => file.endsWith('.json')));
    options.validate();
    return { applied: true, outcome: 'validated', version, backup };
  } catch (error) {
    try { restoreSnapshot(snapshot); } catch (rollbackError) {
      throw new Error(`补丁失败且自动回滚失败；备份 ${backup}: ${error.message}; ${rollbackError.message}`);
    }
    throw new Error(`补丁写入/校验失败，已回滚；备份 ${backup}: ${error.message}`);
  }
}

function parseArgs(argv) {
  const args = { patch: null, apply: false, out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--dry-run') args.apply = false;
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
    else if (argv[i] === '--patch' || argv[i] === '--out') {
      const key = argv[i].slice(2);
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`缺少 ${argv[i]} 参数`);
      args[key] = argv[++i];
    } else throw new Error(`未知参数: ${argv[i]}`);
  }
  return args;
}

function runValidation(script) {
  const result = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 120000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} 校验失败:\n${(result.stderr + '\n' + result.stdout).trim().slice(-2000)}`);
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('用法: node scripts/maintenance/apply-scene-patch.js --patch <patch.json> [--apply] [--out <report.json>]');
    console.log('默认 dry-run。定稿保护命中会拒绝整批；--apply 写 canonical 分片并重建，校验失败回滚。');
    return;
  }
  if (!args.patch) throw new Error('缺少 --patch <patch.json>');
  const entries = validatePatch(readJson(args.patch));
  const pinned = loadPinnedScenes();
  const sceneStore = require('../lib/scene-store');
  const blueprintStore = require('../lib/blueprint-store');
  const sceneSources = sceneStore.loadSceneShards().sources;
  const blueprintSources = blueprintStore.loadBlueprintShards().sources;
  const sources = [
    ...sceneSources.map(source => ({ file: source.source, type: 'scene', data: readJson(source.source) })),
    ...blueprintSources.map(source => ({ file: source.source, type: 'blueprint', data: readJson(source.source) })),
  ];
  const plan = planPatches(sources, entries, pinned);
  const storeFile = path.join(ROOT, 'src/stores/sceneStore.ts');
  const derivedFiles = [
    sceneStore.aggregatePath, ...Object.values(sceneStore.browserShardPath), sceneStore.corePath,
    sceneStore.indexPath, blueprintStore.aggregatePath, storeFile,
  ];
  if (args.out) {
    const output = path.resolve(args.out);
    const reserved = [...sources.map(source => source.file), ...derivedFiles, path.resolve(args.patch), path.join(ROOT, 'data/prompt-pinned-scenes.json')];
    if (reserved.includes(output)) throw new Error('--out 不得覆盖输入、数据源、产物、版本常量或定稿基线');
  }
  const changed = plan.results.filter(item => Object.keys(item.diff).length);
  console.log(`[apply-scene-patch] 补丁 ${entries.length} 条 | 实际变更 ${changed.length} | 源分片 ${plan.writes.length}`);
  for (const item of changed) console.log(JSON.stringify(item));
  let outcome = { applied: false, outcome: args.apply ? 'planned' : 'dry-run' };
  const report = () => ({ createdAt: new Date().toISOString(), dryRun: !args.apply, entries: entries.length, changed: changed.length, results: plan.results, ...outcome });
  if (args.out) writeTextAtomic(path.resolve(args.out), jsonText(report()));
  if (args.apply) {
    outcome = commitPlan(plan, {
      root: ROOT, derivedFiles,
      rebuild() {
        if (plan.writes.some(doc => doc.type === 'scene')) sceneStore.writeAggregate(sceneStore.loadSceneShards().scenes);
        if (plan.writes.some(doc => doc.type === 'blueprint')) blueprintStore.writeBlueprintAggregate();
        return syncDataVersion(ROOT).version;
      },
      validate() {
        runValidation('scripts/maintenance/validate-scenes.js');
        runValidation('scripts/maintenance/validate-content-contracts.js');
        const pinnedRun = spawnSync(process.execPath, ['scripts/maintenance/pin-scene-prompts.js', '--check'], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
        if (pinnedRun.error || pinnedRun.status !== 0) throw new Error('定稿校验失败: ' + (pinnedRun.error?.message || pinnedRun.stdout || pinnedRun.stderr));
      },
    });
  }
  if (args.out) writeTextAtomic(path.resolve(args.out), jsonText(report()));
  console.log(`[apply-scene-patch] ${outcome.outcome}${outcome.backup ? '，备份 ' + path.basename(outcome.backup) : ''}`);
}

module.exports = { PROTECTED_SCENE_FIELDS, loadPinnedScenes, validatePatch, planPatches, snapshotFiles, restoreSnapshot, refreshCompression, commitPlan, parseArgs, main };
if (require.main === module) {
  try { main(); } catch (error) { console.error('[apply-scene-patch] ' + error.message); process.exitCode = 1; }
}
