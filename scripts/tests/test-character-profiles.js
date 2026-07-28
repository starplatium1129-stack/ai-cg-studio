'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  parseCharacterProfiles,
  parseCharacterScenes,
} = require('../../src/utils/characterProfiles.ts');

const root = path.resolve(__dirname, '..', '..');
const characterView = fs.readFileSync(path.join(root, 'src/views/CharacterView.vue'), 'utf8');
const scenarioView = fs.readFileSync(path.join(root, 'src/views/ScenarioView.vue'), 'utf8');

const profiles = parseCharacterProfiles([
  {
    id: 'nene',
    name: 'Nene',
    icon: 'x',
    tags: ['gentle', 42],
    identity: { role: 'heroine', age: null },
    portrait: { image: '/nene.webp' },
    lora: { recommended_scene: ['sc001', false], trigger_words: ['nene'] },
  },
  { id: 'nene', name: 'Duplicate' },
  { id: '', name: 'Invalid' },
  null,
]);
assert.strictEqual(profiles.length, 1, 'profiles must reject invalid and duplicate records');
assert.deepStrictEqual(profiles[0].tags, ['gentle'], 'profile string arrays must be normalized');
assert.deepStrictEqual(
  profiles[0].lora.recommended_scene,
  ['sc001'],
  'recommended scene ids must discard non-string values',
);
assert.deepStrictEqual(
  parseCharacterScenes([
    { id: 'sc001', title: 'Scene', story: 'Story', char: 'nene' },
    { id: 'sc002', title: 2, char: 'nene' },
  ]),
  [{ id: 'sc001', title: 'Scene', story: 'Story', char: 'nene' }],
  'recommendation scenes must expose only valid display records',
);
assert(!/\bany\b/.test(characterView), 'CharacterView must not regress to explicit any types');
assert(!/\bany\b/.test(scenarioView), 'ScenarioView must not regress to explicit any types');
assert(
  characterView.includes('parseCharacterProfiles') && characterView.includes('parseCharacterScenes'),
  'CharacterView must normalize store data through production parsers',
);
assert(
  scenarioView.includes('interface ScenarioAct') && scenarioView.includes('ScenarioCharacter'),
  'ScenarioView must keep its static scenario and character contracts explicit',
);

console.log('Character profile tests passed: boundary parsing, scene records, and typed views');
