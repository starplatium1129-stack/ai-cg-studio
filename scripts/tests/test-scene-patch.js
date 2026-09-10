'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const patch = require('../maintenance/apply-scene-patch');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'huiyu-scene-patch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function write(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data)); }
const pinned = { sc001: { prompt: 'locked' } };
function sources(root) {
  return [
    { type: 'scene', file: path.join(root, 'data/scenes/shared.json'), data: [{ id: 'sc001', prompt: 'locked', story: 'old' }, { id: 'sc002', prompt: 'ordinary' }] },
    { type: 'blueprint', file: path.join(root, 'data/blueprints/example.json'), data: { version: 2, franchise: 'example', extra: 'preserved', blueprints: [{ id: 'example_scene', title: 'original', promptProse: 'unchanged prose' }] } },
  ];
}

test('scene patch: missing, malformed and empty pinned baselines fail closed', t => {
  const root = fixture(t), file = path.join(root, 'pinned.json');
  assert.throws(() => patch.loadPinnedScenes(file), /定稿保护基线不可读取/);
  write(file, '{invalid');
  assert.throws(() => patch.loadPinnedScenes(file), /定稿保护基线不可读取/);
  for (const value of [{}, { scenes: {} }, { scenes: [] }, { scenes: { sc001: null } }]) {
    write(file, value);
    assert.throws(() => patch.loadPinnedScenes(file), /定稿保护基线结构无效/);
  }
  write(file, { scenes: pinned });
  assert.deepEqual(patch.loadPinnedScenes(file), pinned);
});

test('scene patch: all six protected fields reject the entire mixed patch', t => {
  const input = sources(fixture(t)), original = JSON.stringify(input);
  for (const field of patch.PROTECTED_SCENE_FIELDS) {
    assert.throws(() => patch.planPatches(input, [
      { type: 'scene', id: 'sc002', changes: { story: 'candidate' } },
      { type: 'scene', id: 'sc001', changes: { [field]: 'changed', auditRevision: 'must not be stamped' } },
    ], pinned), /受保护字段禁止批量修改/);
  }
  assert.equal(JSON.stringify(input), original);
});

test('scene patch: metadata-only patch to a pinned scene does not alter protected fields', t => {
  const input = sources(fixture(t));
  const plan = patch.planPatches(input, [{ type: 'scene', id: 'sc001', changes: { story: 'reviewed metadata' } }], pinned);
  assert.equal(plan.writes[0].data[0].prompt, 'locked');
  assert.equal(plan.writes[0].data[0].story, 'reviewed metadata');
  assert.equal(input[0].data[0].story, 'old');
});

test('scene patch: invalid types, IDs, duplicate entries and prototype fields are rejected', () => {
  const item = { type: 'scene', id: 'sc002', changes: { story: 'text' } };
  for (const entries of [{}, [null], [{ ...item, type: 'other' }], [{ ...item, id: '../escape' }], [{ ...item, changes: [] }], [item, item], [{ ...item, changes: { id: 'sc003' } }], JSON.parse('[{"type":"scene","id":"sc002","changes":{"__proto__":{"polluted":true}}}]')]) {
    assert.throws(() => patch.validatePatch(entries));
  }
  assert.equal({}.polluted, undefined);
});

test('scene patch: absent source IDs reject the whole plan without modifying input', t => {
  const input = sources(fixture(t)), original = JSON.stringify(input);
  assert.throws(() => patch.planPatches(input, [{ type: 'blueprint', id: 'missing', changes: { title: 'x' } }], pinned), /记录不存在/);
  assert.equal(JSON.stringify(input), original);
});

test('scene patch: blueprint changes survive aggregate reconstruction from canonical shards', t => {
  const root = fixture(t), input = sources(root);
  input.forEach(doc => write(doc.file, doc.data));
  const aggregate = path.join(root, 'data/scene-blueprints.json');
  write(aggregate, { version: 2, blueprints: [{ id: 'example_scene', title: 'STALE AGGREGATE' }] });
  const plan = patch.planPatches(input, [{ type: 'blueprint', id: 'example_scene', changes: { title: 'reviewed' } }], pinned);
  const rebuild = () => {
    const canonical = JSON.parse(fs.readFileSync(input[1].file, 'utf8'));
    write(aggregate, { version: 2, blueprints: canonical.blueprints });
    return 42;
  };
  const result = patch.commitPlan(plan, { root, derivedFiles: [aggregate], rebuild, validate() {
    assert.equal(JSON.parse(fs.readFileSync(aggregate, 'utf8')).blueprints[0].title, 'reviewed');
  } });
  assert.equal(result.applied, true);
  assert.equal(result.version, 42);
  rebuild();
  const canonical = JSON.parse(fs.readFileSync(input[1].file, 'utf8'));
  assert.equal(canonical.extra, 'preserved');
  assert.equal(canonical.blueprints[0].promptProse, 'unchanged prose');
  assert.equal(JSON.parse(fs.readFileSync(aggregate, 'utf8')).blueprints[0].title, 'reviewed');
});

test('scene patch: validation failure restores canonical, aggregate, version and compressed bytes', t => {
  const root = fixture(t), input = sources(root);
  input.forEach(doc => write(doc.file, doc.data));
  const aggregate = path.join(root, 'data/scene-blueprints.json'), version = path.join(root, 'src/stores/sceneStore.ts');
  write(aggregate, { original: true }); write(version, 'export const DATA_VERSION = 1');
  fs.writeFileSync(aggregate + '.gz', zlib.gzipSync(fs.readFileSync(aggregate)));
  fs.writeFileSync(aggregate + '.br', zlib.brotliCompressSync(fs.readFileSync(aggregate)));
  const files = [input[1].file, aggregate, aggregate + '.gz', aggregate + '.br', version];
  const original = files.map(file => fs.readFileSync(file));
  const plan = patch.planPatches(input, [{ type: 'blueprint', id: 'example_scene', changes: { title: 'candidate' } }], pinned);
  assert.throws(() => patch.commitPlan(plan, { root, derivedFiles: [aggregate, version], rebuild() {
    write(aggregate, { candidate: true }); write(version, 'export const DATA_VERSION = 2'); return 2;
  }, validate() { throw new Error('simulated contract failure'); } }), /已回滚/);
  files.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), original[index]));
});

test('scene patch: rollback removes derived files that did not previously exist', t => {
  const root = fixture(t), input = sources(root);
  input.forEach(doc => write(doc.file, doc.data));
  const aggregate = path.join(root, 'data/scene-blueprints.json');
  const plan = patch.planPatches(input, [{ type: 'blueprint', id: 'example_scene', changes: { title: 'candidate' } }], pinned);
  assert.throws(() => patch.commitPlan(plan, { root, derivedFiles: [aggregate], rebuild() {
    write(aggregate, { candidate: true }); return 2;
  }, validate() { throw new Error('simulated failure'); } }), /已回滚/);
  assert.equal(fs.existsSync(aggregate), false);
  assert.equal(JSON.parse(fs.readFileSync(input[1].file, 'utf8')).blueprints[0].title, 'original');
});

test('scene patch: dry/no-op plans do not write data or create backups', t => {
  const root = fixture(t), input = sources(root);
  const plan = patch.planPatches(input, [{ type: 'blueprint', id: 'example_scene', changes: { title: 'original' } }], pinned);
  assert.equal(plan.writes.length, 0);
  const result = patch.commitPlan(plan, { root, derivedFiles: [], rebuild() { assert.fail('unexpected rebuild'); }, validate() { assert.fail('unexpected validation'); } });
  assert.equal(result.outcome, 'unchanged');
  assert.equal(fs.existsSync(path.join(root, 'runtime')), false);
});

test('scene patch: parser rejects unknown or missing arguments and defaults to dry-run', () => {
  assert.equal(patch.parseArgs(['--patch', 'p.json']).apply, false);
  assert.equal(patch.parseArgs(['--patch', 'p.json', '--apply']).apply, true);
  assert.throws(() => patch.parseArgs(['--patch']), /缺少/);
  assert.throws(() => patch.parseArgs(['--force']), /未知参数/);
});
