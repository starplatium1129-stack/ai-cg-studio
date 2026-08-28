'use strict';

/** 场景分片完整性独立守卫：不复用 scripts/lib/scene-store.js 的分组逻辑，
 *  直接断言生成物之间的不变量。scenes:build --check 用同一套函数推导期望值，
 *  分组函数自身回归（如 groupBrowserShards 丢出去重守卫）时自检无法发现，
 *  本文件作为独立 oracle 补上这一盲区。
 *
 *  设计约定（勿"修复"为重复删除）：scenes-core.json 是 curation.json
 *  personaCoreSceneIds 驱动的人格核心精选层，条目允许与浏览器分片重叠；
 *  三个浏览器分片（nene/natsume/shared）之间必须互斥且并集等于聚合 scenes.json。 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const dataDir = path.resolve(__dirname, '..', '..', 'data');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
}

test('scene shards: browser shards are mutually disjoint', () => {
  const seen = new Map();
  for (const name of ['scenes-nene.json', 'scenes-natsume.json', 'scenes-shared.json']) {
    for (const scene of readJson(name)) {
      assert.ok(!seen.has(scene.id),
        `${scene.id} appears in both ${seen.get(scene.id)} and ${name}`);
      seen.set(scene.id, name);
    }
  }
});

test('scene shards: browser shard union equals the aggregate', () => {
  const aggregate = readJson('scenes.json');
  const unionIds = new Set([
    ...readJson('scenes-nene.json').map((s) => s.id),
    ...readJson('scenes-natsume.json').map((s) => s.id),
    ...readJson('scenes-shared.json').map((s) => s.id),
  ]);
  const aggregateIds = aggregate.map((s) => s.id);
  assert.strictEqual(new Set(aggregateIds).size, aggregateIds.length,
    'aggregate scenes.json must not contain duplicate ids');
  assert.deepStrictEqual(unionIds, new Set(aggregateIds),
    'browser shard union must cover exactly the aggregate id set');
});

test('scene shards: core tier is a curated subset backed by curation', () => {
  const aggregateIds = new Set(readJson('scenes.json').map((s) => s.id));
  const browserIds = new Set([
    ...readJson('scenes-nene.json').map((s) => s.id),
    ...readJson('scenes-natsume.json').map((s) => s.id),
    ...readJson('scenes-shared.json').map((s) => s.id),
  ]);
  const coreIds = readJson('scenes-core.json').map((s) => s.id);
  const curationIds = readJson('curation.json').personaCoreSceneIds || [];
  assert.deepStrictEqual(coreIds, curationIds.filter((id) => aggregateIds.has(id)),
    'scenes-core.json must equal personaCoreSceneIds ∩ aggregate');
  for (const id of coreIds) {
    assert.ok(browserIds.has(id),
      `core tier id ${id} must also exist in a browser shard`);
  }
});

test('scene shards: scenes-index.json mirrors the generated files', () => {
  const index = readJson('scenes-index.json');
  const aggregate = readJson('scenes.json');
  const coreIds = readJson('scenes-core.json').map((s) => s.id);
  const counts = {
    nene: readJson('scenes-nene.json').length,
    natsume: readJson('scenes-natsume.json').length,
    shared: readJson('scenes-shared.json').length,
  };
  assert.strictEqual(index.version, 1);
  assert.strictEqual(index.total, aggregate.length);
  for (const [char, count] of Object.entries(counts)) {
    assert.strictEqual(index.shards[char].count, count,
      `index.shards.${char}.count must match the actual shard`);
  }
  assert.deepStrictEqual(index.orderedIds, aggregate.map((s) => s.id));
  assert.deepStrictEqual(index.tiers.core, coreIds);
});
