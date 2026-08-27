/**
 * 定稿场景提示词保护（pinned scene prompts）
 *
 * 背景：2026-08-26/27 的多批全量优化（氛围词补全、质量要素融合等）曾把用户
 * 实拍验证过的优质场景提示词改坏。本工具把「历史上定点手工修过 / 官方 CG
 * 对齐过」的场景清单固化为字节级基线；任何后续改动必须显式 --capture 才能过门禁。
 *
 * 用法：
 *   node scripts/maintenance/pin-scene-prompts.js            # 报告漂移（相对最后一次定点修状态）
 *   node scripts/maintenance/pin-scene-prompts.js --apply    # 回滚被批次覆盖的字段到最后一次定点修状态
 *   node scripts/maintenance/pin-scene-prompts.js --capture  # 以当前工作区为新一版基线（改动须先真实出图自测）
 *   node scripts/maintenance/pin-scene-prompts.js --check    # 门禁：与基线逐字节一致，否则退出码 1
 *
 * PINNED_SOURCES 的判定依据是提交信息（定点xN / 官方CG / 恢复手工 / 按实拍还原），
 * 取值窗口从 2026-08-22 倒推优化批次开始；更早的定点修已被底模换代（v14→v21）淘汰，
 * 冻结它们会复活过期写法。sc033/sc234 以 PNG 字节基准为准（source: png-reference）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(ROOT, 'data', 'prompt-pinned-scenes.json');
const SHARDS_DIR = path.join(ROOT, 'data', 'scenes');

/** 渲染链路锁定的字段（story/tags/location 等属 UI/检索元数据，不锁） */
const PIN_FIELDS = ['prompt', 'negative', 'animaCaption', 'recommendedSize', 'rating', 'mature'];

/** 手工/定点修复波次：提交 -> 触及场景（时间顺序由 git 时间戳决定，不依赖书写顺序） */
const PINNED_SOURCES = {
  b1ccfc0: ['sc264', 'sc277'],
  '64a3152': ['sc105', 'sc142', 'sc152', 'sc234', 'sc263', 'sc267'],
  '8532c04': ['sc267'],
  '8a6255b': ['sc267'],
  '31b439f': ['sc300'],
  aba1a54: ['sc285'],
  edf9def: ['sc299', 'sc301', 'sc302', 'sc303', 'sc304'],
  '3d07e1a': ['sc025', 'sc052', 'sc011', 'sc037', 'sc046', 'sc141', 'sc156', 'sc163'],
  '3dc7c45': ['sc003', 'sc034', 'sc038'],
  '8bccaa1': ['sc030'],
  '61f4ab9': ['sc022', 'sc032', 'sc040', 'sc088', 'sc101', 'sc107', 'sc109', 'sc113', 'sc119', 'sc125', 'sc129', 'sc137', 'sc158', 'sc190', 'sc248', 'sc254', 'sc256'],
  d149ee2: ['sc097', 'sc101', 'sc107', 'sc109', 'sc129', 'sc137', 'sc144', 'sc153', 'sc158', 'sc166', 'sc301'],
  '97ee431': ['sc263', 'sc264', 'sc267', 'sc272', 'sc273', 'sc274', 'sc276', 'sc279', 'sc299', 'sc302', 'sc303', 'sc304', 'sc305'],
  '2bf23e1': ['sc097', 'sc101', 'sc107', 'sc109', 'sc129', 'sc137', 'sc144', 'sc153', 'sc158', 'sc166', 'sc260', 'sc261', 'sc262', 'sc263', 'sc264', 'sc265', 'sc266', 'sc267', 'sc268', 'sc269', 'sc270', 'sc271', 'sc272', 'sc273', 'sc274', 'sc275', 'sc276', 'sc278', 'sc279', 'sc281', 'sc282', 'sc283', 'sc284', 'sc285', 'sc299', 'sc301', 'sc302', 'sc303', 'sc304', 'sc305'],
  '35e5382': ['sc008', 'sc017', 'sc039', 'sc043', 'sc044', 'sc090', 'sc102', 'sc103', 'sc106', 'sc142', 'sc152', 'sc168', 'sc240', 'sc242', 'sc251'],
  a530053: ['sc018', 'sc019', 'sc072', 'sc080', 'sc103', 'sc192', 'sc207', 'sc228', 'sc233', 'sc238', 'sc246'],
  b7171c2: ['sc060', 'sc136', 'sc164', 'sc170', 'sc204', 'sc231', 'sc232', 'sc234', 'sc305'],
  d240d4a: ['sc234'],
  '616c406': ['sc033'],
};

/** 以 PNG 内嵌元数据逐一验证过的场景：工作区现状即权威，无需历史回滚 */
const PNG_AUTHORED = new Set(['sc033', 'sc234']);

/** 每个受保护场景的最后（按提交时间）一次定点修来源 */
function newestSourceByScene() {
  const stampCache = new Map();
  const stampOf = (commit) => {
    if (!stampCache.has(commit)) {
      stampCache.set(commit, Number(execSync(`git show -s --format=%ct ${commit}`).toString().trim()));
    }
    return stampCache.get(commit);
  };
  const best = new Map();
  for (const [commit, ids] of Object.entries(PINNED_SOURCES)) {
    for (const id of ids) {
      if (!best.has(id) || stampOf(commit) > stampOf(best.get(id))) best.set(id, commit);
    }
  }
  return best;
}

function pick(entry) {
  const out = {};
  for (const f of PIN_FIELDS) out[f] = entry[f];
  return out;
}

function diffFields(current, target) {
  const drift = [];
  for (const f of PIN_FIELDS) {
    if (JSON.stringify(current[f]) !== JSON.stringify(target[f])) drift.push(f);
  }
  return drift;
}

function gitScene(commit, id) {
  const raw = execSync(`git show ${commit}:data/scenes.json`, { maxBuffer: 5e8 }).toString();
  return JSON.parse(raw).find((s) => s.id === id) || null;
}

function loadShards() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SHARDS_DIR, 'manifest.json'), 'utf8'));
  const shards = [];
  for (const entry of manifest.files) {
    const p = path.join(SHARDS_DIR, entry.file);
    shards.push({ file: entry.file, arr: JSON.parse(fs.readFileSync(p, 'utf8')) });
  }
  return shards;
}

/** 当前受保护条目索引（同一份分片实例，供 apply 原地修改后统一落盘）：id -> {file, arr, entry} */
function indexShards(shards) {
  const out = new Map();
  for (const { file, arr } of shards) {
    for (const entry of arr) if (entry && entry.id) out.set(entry.id, { file, arr, entry });
  }
  return out;
}

// ── 主流程 ────────────────────────────────────────────────────────────────
const mode = process.argv[2] || '--report';

if (!['--report', '--apply', '--capture', '--check'].includes(mode)) {
  console.error(`usage: node ${path.basename(__filename)} [--report|--apply|--capture|--check]`);
  process.exitCode = 2;
} else if (mode === '--check') {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error('baseline 缺失：先运行 --capture 生成 data/prompt-pinned-scenes.json');
    process.exitCode = 1;
  } else {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).scenes;
    const entries = indexShards(loadShards());
    let bad = 0;
    for (const [id, want] of Object.entries(baseline)) {
      const hit = entries.get(id);
      if (!hit) { console.error(`[FAIL] ${id}: 场景已被删除`); bad += 1; continue; }
      const drift = diffFields(pick(hit.entry), want);
      if (drift.length) {
        console.error(`[FAIL] ${id}: 字段漂移 ${drift.join(',')}（pinSource=${(want.pinSource || []).join(',')}）`);
        bad += 1;
      }
    }
    console.log(bad
      ? `pinned gate FAILED: ${bad}/${Object.keys(baseline).length}`
      : `pinned gate OK: ${Object.keys(baseline).length} 个定稿场景与基线逐字节一致`);
    process.exitCode = bad ? 1 : 0;
  }
} else if (mode === '--capture') {
  const entries = indexShards(loadShards());
  const sources = newestSourceByScene();
  const scenes = {};
  for (const [id] of sources) {
    const hit = entries.get(id);
    if (!hit) throw new Error(`受保护场景 ${id} 不存在于分片`);
    scenes[id] = {
      ...pick(hit.entry),
      pinSource: PNG_AUTHORED.has(id) ? ['png-reference'] : [sources.get(id)],
    };
  }
  const payload = {
    description: '定稿场景提示词字节基线 —— 由 scripts/maintenance/pin-scene-prompts.js 维护；改动须经真实出图自测后用 --capture 更新',
    pinnedAt: new Date().toISOString().slice(0, 19),
    scenes,
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n');
  console.log(`captured baseline: ${Object.keys(scenes).length} scenes -> data/prompt-pinned-scenes.json`);
} else {
  // --report / --apply
  const shards = loadShards();
  const entries = indexShards(shards);
  const sources = newestSourceByScene();
  const applied = [];
  let drifted = 0;
  for (const [id, commit] of sources) {
    if (PNG_AUTHORED.has(id)) continue;
    const hit = entries.get(id);
    if (!hit) { console.error(`[missing] ${id}`); continue; }
    const version = gitScene(commit, id);
    if (!version) { console.error(`[skip] ${id}: ${commit} 中不存在`); continue; }
    const target = pick(version);
    const drift = diffFields(pick(hit.entry), target);
    if (!drift.length) continue;
    drifted += 1;
    console.log(`[drift] ${id} source=${commit} fields=${drift.join(',')}`);
    if (mode === '--apply') {
      Object.assign(hit.entry, target);
      applied.push(`${id} <- ${commit} (${drift.join(',')})`);
    }
  }
  if (mode === '--apply') {
    const touchedFiles = new Set(applied.map((line) => entries.get(line.slice(0, line.indexOf(' <'))).file));
    for (const { file, arr } of shards) {
      if (touchedFiles.has(file)) fs.writeFileSync(path.join(SHARDS_DIR, file), JSON.stringify(arr, null, 2) + '\n');
    }
    console.log(`\napplied rollback: ${applied.length}/${sources.size - PNG_AUTHORED.size} scenes, rewrote shard files: ${[...touchedFiles].join(', ')}`);
    console.log('下一步: npm run scenes:build && npm run precompress && 本工具 --capture 固化新基线');
  } else {
    console.log(drifted
      ? `\n${drifted}/${sources.size - PNG_AUTHORED.size} 条定稿场景与最后一次定点修不一致`
      : `\n全部 ${sources.size - PNG_AUTHORED.size} 个手工定稿场景一致`);
  }
}
