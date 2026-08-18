'use strict';
/**
 * 2026-08-18 增量补发：attempt-4 的 3 个约束句修复通过场景 → 并入 2026-08-18_v24。
 * 复用 publish-popular-showcase.js 的条目构建/图片转换逻辑，只处理这 3 个 key。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const publish = require(path.join(ROOT, 'scripts', 'maintenance', 'publish-popular-showcase.js'));

const FROM = path.join(ROOT, '..', 'AI', 'Reviews', 'ShowcaseRefresh', '2026-08-18_v24-popular-fix-rella');
const TARGET = path.join(ROOT, '..', 'AI', 'SceneShowcase', '2026-08-18_v24');
const AUDIT = path.join(FROM, 'audit-results.json');
const MANIFEST = path.join(FROM, 'generation-manifest.json');
const PYTHON = 'python';

function main() {
  const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
  const targetManifest = JSON.parse(fs.readFileSync(path.join(TARGET, 'manifest.json'), 'utf8'));
  const blueprints = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scene-blueprints.json'), 'utf8'));
  const popularData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'popular-characters.json'), 'utf8'));
  const displayNameByChar = {};
  for (const c of popularData.characters || []) displayNameByChar[c.id] = c.displayName || c.id;

  // v24 已有 popular 条目（char:blueprint）
  const v24Set = new Set();
  for (const e of targetManifest.entries || []) {
    if ((e.id || '').startsWith('pc_')) {
      const bp = e.id.replace('pc_' + e.char + '_', '');
      if (bp !== e.id) v24Set.add(e.char + ':' + bp);
    }
  }

  // 每 key 最新 attempt
  const records = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).filter(r => r.status === 'succeeded');
  const best = new Map();
  for (const r of records) {
    const prev = best.get(r.key);
    if (!prev || r.attempt > prev.attempt) best.set(r.key, r);
  }

  // 需要补 = 最新 attempt 判定 pass 且 v24 未发布
  const picked = [];
  for (const [key, rec] of best) {
    const [, cid, bp] = key.split(':');
    if (v24Set.has(cid + ':' + bp)) continue;
    const v = audit[rec.recordId];
    if (v && v.ok && v.verdict === 'pass') picked.push(rec);
  }
  console.log('pass pick-ups (missing in v24):', picked.length);
  for (const r of picked) console.log(' ', r.key, '@attempt-' + r.attempt);

  const loraVersions = {}; // no-LoRA 记录无需 LoRA 版本映射
  const existingIds = new Set(targetManifest.entries.map(e => e.id));
  const newEntries = [];
  for (const record of picked) {
    const entry = publish.popularEntry(record, audit, loraVersions, displayNameByChar);
    if (existingIds.has(entry.id) || newEntries.some(e => e.id === entry.id)) {
      console.log('[skip dup]', entry.id);
      continue;
    }
    // 转换图片到 target（sourcePathFor 第二参应为 manifest 文件路径）
    const src = publish.sourcePathFor(record, MANIFEST);
    publish.convertImages(PYTHON, src,
      path.join(TARGET, entry.image.split('/').join(path.sep)),
      path.join(TARGET, entry.thumb.split('/').join(path.sep)),
    );
    newEntries.push(entry);
    console.log('[converted]', entry.id);
  }

  // 追加 + 重算统计
  targetManifest.entries.push(...newEntries);
  const typeCounts = { scene: 0, artist: 0, popular: 0, lora: 0 };
  for (const e of targetManifest.entries) if (e && typeCounts[e.type] !== undefined) typeCounts[e.type] += 1;
  const counts = { All: 0, R15: 0, R18: 0 };
  for (const e of targetManifest.entries) {
    if (!e) continue;
    const rating = e.rating === 'R15' || e.rating === 'R18' ? e.rating : 'All';
    counts[rating] += 1;
  }
  targetManifest.entryCount = targetManifest.entries.length;
  targetManifest.sceneCount = typeCounts.scene;
  targetManifest.typeCounts = typeCounts;
  targetManifest.counts = counts;
  targetManifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(TARGET, 'manifest.json'), JSON.stringify(targetManifest, null, 2) + '\n', 'utf8');
  console.log('appended', newEntries.length, '-> total entries', targetManifest.entries.length, '| popular', typeCounts.popular);
}

main();
