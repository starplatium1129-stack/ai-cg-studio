'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const {
  createSettingsRepository,
  DRAW_ENGINE_SETTING,
  THEME_SETTING,
  INTERFACE_SOUND_SETTING,
  TUNNEL_ENABLED_SETTING,
  GUEST_GUIDE_DISMISSED_SETTING,
  CHAT_THINKING_SETTING,
} = require('../../src/storage/settingsRepository.ts');
const {
  ARTWORK_HISTORY_KEY,
  ARTWORK_PROJECTS_KEY,
  ArtworkDeletionError,
  createArtworkRepository,
} = require('../../src/storage/artworkRepository.ts');
const { thumbKey } = require('../../src/utils/imageThumb.ts');
const keys = require('../../src/utils/storageKeys.ts');

function createLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

function filesUnder(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(full));
    else if (/\.(ts|vue)$/.test(entry.name)) result.push(full);
  }
  return result;
}

function assertRegisteredLocalStorageWrites() {
  const pattern = /\b(?:window\.)?localStorage\.setItem\(\s*(['"])(aics_[^'"]+)\1/g;
  const unknown = [];
  for (const file of filesUnder(path.join(root, 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      if (!keys.isLiveLocalKey(match[2])) unknown.push(`${path.relative(root, file)}:${match[2]}`);
    }
  }
  assert.deepStrictEqual(unknown, [], 'every literal aics_* localStorage write must be registered');
}

function createArtworkFixture(failure = {}) {
  const history = [
    { id: 1, image_id: 'img_1', prompt: 'one' },
    { id: 2, image_id: 'img_2', prompt: 'two' },
  ];
  const projects = [{ id: 'project', history_ids: [1, 2, 1] }];
  const thumbnails = new Map([
    [thumbKey('img_1'), 'data:image/jpeg;base64,one'],
    [thumbKey('img_2'), 'data:image/jpeg;base64,two'],
  ]);
  const imageRecords = new Map([
    ['img_1', { id: 'img_1', blob: new Blob(['one'], { type: 'image/png' }), name: 'one.png', type: 'image/png', size: 3, created_at: 1 }],
    ['img_2', { id: 'img_2', blob: new Blob(['two'], { type: 'image/png' }), name: 'two.png', type: 'image/png', size: 3, created_at: 2 }],
  ]);
  const imageReads = [];
  const values = new Map([
    [ARTWORK_HISTORY_KEY, history],
    [ARTWORK_PROJECTS_KEY, projects],
    ...thumbnails,
  ]);
  const failOnce = new Set(failure.failOnce || []);
  const kv = {
    async get(key) { return values.get(key) ?? null; },
    async set(key, value) {
      const marker = `set:${key}`;
      if (failOnce.delete(marker)) throw new Error(`${marker} injected failure`);
      values.set(key, value);
    },
    async remove(key) {
      const marker = `remove:${key}`;
      if (failOnce.delete(marker)) throw new Error(`${marker} injected failure`);
      values.delete(key);
    },
  };
  const images = {
    async get(id) { imageReads.push(id); return imageRecords.get(id) ?? null; },
    async putRecord(record) { imageRecords.set(record.id, { ...record, size: record.blob.size, type: record.type || record.blob.type }); return record.id; },
    async deleteMany(ids) {
      if (failOnce.delete('delete:images')) throw new Error('delete:images injected failure');
      ids.forEach(id => imageRecords.delete(id));
    },
  };
  return { values, imageRecords, imageReads, repository: createArtworkRepository({ kv, images }) };
}

function stateOf(fixture) {
  return {
    history: fixture.values.get(ARTWORK_HISTORY_KEY),
    projects: fixture.values.get(ARTWORK_PROJECTS_KEY),
    thumbnails: [...fixture.values.entries()].filter(([key]) => key.startsWith('thumb:')),
    images: [...fixture.imageRecords.keys()].sort(),
  };
}

test('settings repository: typed draw-engine round-trip with injected storage', () => {
  const storage = createLocalStorage();
  const repository = createSettingsRepository(storage);
  assert.strictEqual(repository.get(DRAW_ENGINE_SETTING), null);
  repository.set(DRAW_ENGINE_SETTING, 'anima');
  assert.strictEqual(storage.getItem('aics_draw_engine'), 'anima');
  assert.strictEqual(repository.get(DRAW_ENGINE_SETTING), 'anima');
  storage.setItem('aics_draw_engine', 'unknown');
  assert.strictEqual(repository.get(DRAW_ENGINE_SETTING), null);
  repository.remove(DRAW_ENGINE_SETTING);
  assert.strictEqual(storage.getItem('aics_draw_engine'), null);
});

test('settings repository: typed scalar definitions preserve exact legacy bytes', () => {
  const cases = [
    [THEME_SETTING, [['dark', 'dark'], ['light', 'light']], [[null, null], ['invalid', null], ['1', null]]],
    [INTERFACE_SOUND_SETTING, [[true, '1'], [false, '0']], [[null, false], ['', false], ['true', false]]],
    [TUNNEL_ENABLED_SETTING, [[true, ''], [false, '1']], [[null, true], ['0', true], ['off', true]]],
    [GUEST_GUIDE_DISMISSED_SETTING, [[true, '1'], [false, '0']], [[null, false], ['', false], ['true', false]]],
    [CHAT_THINKING_SETTING, [['off', 'off'], ['low', 'low'], ['medium', 'medium'], ['high', 'high']], [[null, null], ['0x', null], ['invalid', null]]],
  ];
  for (const [definition, valid, invalid] of cases) {
    for (const [value, raw] of valid) assert.strictEqual(definition.serialize(value), raw);
    for (const [raw, expected] of invalid) assert.strictEqual(definition.parse(raw), expected, `${definition.key} invalid parse`);
  }
  assert.strictEqual(CHAT_THINKING_SETTING.parse('0'), 'off', 'legacy reasoning 0 must remain off');
  assert.strictEqual(TUNNEL_ENABLED_SETTING.parse(''), true);
  assert.strictEqual(TUNNEL_ENABLED_SETTING.parse('1'), false);
  assert.strictEqual(TUNNEL_ENABLED_SETTING.parse(null), true);
});

test('settings repository: storage failures are silent for get/set/remove', () => {
  const failing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  const repository = createSettingsRepository(failing);
  assert.doesNotThrow(() => repository.get(THEME_SETTING));
  assert.doesNotThrow(() => repository.set(THEME_SETTING, 'dark'));
  assert.doesNotThrow(() => repository.remove(THEME_SETTING));
  assert.doesNotThrow(() => repository.has(THEME_SETTING));
});

test('settings repository: migrated scalar callers do not use raw localStorage access', () => {
  const callers = [
    'src/composables/useTheme.ts',
    'src/composables/useInterfaceFeedback.ts',
    'src/composables/useControlActions.ts',
    'src/components/GuestGuide.vue',
    'src/composables/useCharacterRoomSession.ts',
  ];
  for (const relative of callers) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.strictEqual(/localStorage\.(?:getItem|setItem|removeItem)\s*\(/.test(source), false, `${relative} must use settingsRepository`);
  }
});

test('storage gate: literal aics_* localStorage writes are registered', () => {
  assertRegisteredLocalStorageWrites();
});

test('artwork repository: successful delete removes history, media, thumbnail and project references', async () => {
  const fixture = createArtworkFixture();
  const result = await fixture.repository.deleteArtwork(1);
  assert.deepStrictEqual(result, {
    deleted: true,
    historyChanged: true,
    removedImageIds: ['img_1'],
    removedThumbnailIds: ['img_1'],
    removedProjectReferences: 2,
  });
  assert.deepStrictEqual(fixture.values.get(ARTWORK_HISTORY_KEY), [{ id: 2, image_id: 'img_2', prompt: 'two' }]);
  assert.deepStrictEqual(fixture.values.get(ARTWORK_PROJECTS_KEY), [{ id: 'project', history_ids: [2] }]);
  assert.strictEqual(fixture.values.has(thumbKey('img_1')), false);
  assert.deepStrictEqual([...fixture.imageRecords.keys()], ['img_2']);
  assert.deepStrictEqual(fixture.imageReads, ['img_1'], 'delete must snapshot only the target image');
  const repeated = await fixture.repository.deleteArtwork(1);
  assert.strictEqual(repeated.deleted, false, 'repeated delete must be idempotent');
});

test('artwork repository: concurrent deletes serialize without stale-snapshot corruption', async () => {
  const fixture = createArtworkFixture();
  await Promise.all([
    fixture.repository.deleteArtwork(1),
    fixture.repository.deleteArtwork(2),
  ]);
  assert.deepStrictEqual(fixture.values.get(ARTWORK_HISTORY_KEY), []);
  assert.deepStrictEqual(fixture.values.get(ARTWORK_PROJECTS_KEY), [{ id: 'project', history_ids: [] }]);
  assert.deepStrictEqual([...fixture.imageRecords.keys()], []);
  assert.strictEqual(fixture.values.has(thumbKey('img_1')), false);
  assert.strictEqual(fixture.values.has(thumbKey('img_2')), false);
});

for (const [label, failure] of [
  ['record write', { failOnce: [`set:${ARTWORK_HISTORY_KEY}`] }],
  ['original image delete', { failOnce: ['delete:images'] }],
  ['thumbnail delete', { failOnce: [`remove:${thumbKey('img_1')}`] }],
]) {
  test(`artwork repository: ${label} failure compensates every prior mutation`, async () => {
    const fixture = createArtworkFixture(failure);
    const before = stateOf(fixture);
    await assert.rejects(
      fixture.repository.deleteArtwork(1),
      error => error instanceof ArtworkDeletionError && error.rollbackErrors.length === 0,
    );
    assert.deepStrictEqual(stateOf(fixture), before, `${label} failure must leave no half-deleted state`);
  });
}
