const assert = require('assert');
const path = require('path');
const { readJson } = require('./scene-store');
const sceneUx = require('../tools/scene-ux');

const root = path.resolve(__dirname, '..');
const scenes = readJson(path.join(root, 'data', 'scenes.json'));
const curation = readJson(path.join(root, 'data', 'curation.json'));

assert(scenes.length > 0, 'scene data must not be empty');
assert(curation.signatureSceneIds.length > 0, 'signature scenes must be configured');

const sorted = [...scenes].sort((left, right) => sceneUx.priority(right, curation) - sceneUx.priority(left, curation));
assert.strictEqual(sceneUx.tier(sorted[0], curation), 'signature', 'signature scenes must sort first');
assert.deepStrictEqual(sorted.slice(0, curation.signatureSceneIds.length).map((scene) => scene.id), curation.signatureSceneIds,
  'signature scenes must preserve the curator-defined order');

for (const intent of Object.keys(curation.searchAliases || {})) {
  const matches = scenes.filter((scene) => sceneUx.matchesSearch(scene, intent, curation));
  assert(matches.length > 0, 'semantic intent must return scenes: ' + intent);
}

const neneMatches = scenes.filter((scene) => sceneUx.matchesSearch(scene, '宁宁经典感', curation));
assert(neneMatches.every((scene) => scene.char === 'nene' || scene.char === 'triad'), 'Nene intent must not return Natsume-only scenes');
const natsumeMatches = scenes.filter((scene) => sceneUx.matchesSearch(scene, '夏目经典感', curation));
assert(natsumeMatches.every((scene) => scene.char === 'natsume' || scene.char === 'triad'), 'Natsume intent must not return Nene-only scenes');

const memory = new Map();
const storage = { getItem:(key) => memory.has(key) ? memory.get(key) : null, setItem:(key, value) => memory.set(key, value) };
sceneUx.rememberRecent(scenes[0], storage);
sceneUx.rememberRecent(scenes[1], storage);
sceneUx.rememberRecent(scenes[0], storage);
const recent = sceneUx.readRecent(storage);
assert.strictEqual(recent.length, 2, 'recent scenes must be deduplicated');
assert.strictEqual(recent[0].id, scenes[0].id, 'most recent scene must be first');

console.log('Scene UX tests passed: tiers, semantic search, and recent scenes');
