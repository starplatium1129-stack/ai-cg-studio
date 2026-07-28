'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseLoraCatalog, formatLoraWeight } = require('../../src/utils/loraCatalog.ts');

const root = path.resolve(__dirname, '..', '..');
const catalog = parseLoraCatalog(JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'loras.json'), 'utf8')
));
assert.strictEqual(catalog.length, 2, 'production LoRA catalog must expose both character models');
assert(catalog.every(entry => entry.baseModel), 'current base_model fields must reach the model shelf');
assert(catalog.every(entry => entry.character), 'current character fields must reach the model shelf');
assert(catalog.every(entry => entry.triggerWords.length), 'legacy trigger fields must normalize to trigger words');
assert.strictEqual(
  formatLoraWeight({ portrait:0.8, fullbody:0.75 }),
  'portrait: 80% / fullbody: 75%',
  'recommended weight maps must render stable percentages',
);
assert.deepStrictEqual(
  parseLoraCatalog([
    { id:'one', name:'valid', trigger_words:['tag', 3] },
    { id:'one', name:'duplicate' },
    { id:'', name:'invalid' },
    null,
  ]),
  [{
    id:'one',
    name:'valid',
    version:'',
    description:'',
    recommendedWeight:undefined,
    baseModel:'',
    character:'',
    triggerWords:['tag'],
  }],
  'malformed and duplicate LoRA records must be discarded',
);

for (const relative of ['src/views/LoraView.vue', 'src/components/SceneCard.vue']) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  assert(!/\bany\b/.test(source), relative + ' must stay explicitly typed');
}

console.log('LoRA catalog tests passed: production fields, weights, triggers, and typed cards');
