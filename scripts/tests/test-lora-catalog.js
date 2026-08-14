'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test("LoRA catalog tests passed: production fields, weights, triggers, and typed cards", () => {
const { parseLoraCatalog, formatLoraWeight } = require('../../src/utils/loraCatalog.ts');

const root = path.resolve(__dirname, '..', '..');
const catalog = parseLoraCatalog(JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'loras.json'), 'utf8')
));
assert.strictEqual(catalog.length, 7, 'LoRA catalog must expose production models plus the promoted Natsume Anima v21');
assert(catalog.some(entry => entry.id === 'L_NENE_V20_ANIMA'), 'v20 Anima LoRA must be registered');
assert(catalog.some(entry => entry.id === 'L_NENE_V21_ANIMA' && !entry.experimental), 'Nene unified v21 Anima LoRA must be registered and not experimental');
assert(catalog.some(entry => entry.id === 'L_NAT_V20_ANIMA' && !entry.experimental), 'Natsume Anima v20 must be registered and no longer experimental');
assert(catalog.some(entry => entry.id === 'L_NAT_V21_ANIMA' && !entry.experimental), 'Natsume unified v21 Anima LoRA must be registered and not experimental');
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

});
