const assert = require('assert');
const fs = require('fs');
const path = require('path');
const policy = require('../../src/utils/promptPolicy.ts');

const source = fs.readFileSync(path.join(__dirname, '../../src/utils/promptPolicy.ts'), 'utf8');
assert(!/\bany\b/.test(source), 'production prompt policy must keep explicit domain types');

const dual = policy.dedupeText('2girls, (ayachi_nene, white_dress, blush) BREAK (shiki_natsume, white_dress, blush)');
assert.strictEqual((dual.match(/white_dress/g) || []).length, 2, 'BREAK scopes must retain repeated attributes for both subjects');
assert.strictEqual((dual.match(/blush/g) || []).length, 2, 'emotion must remain bound to both subjects');

const parts = policy.dedupeParts([
  { cls:'c', text:'1girl, solo, white_hair' },
  { cls:'t', text:'solo, white_hair, smile' },
  { cls:'n', text:'[NEG] bad hands, bad hands' }
]);
assert.strictEqual(parts[1].text, 'smile', 'single-subject global duplicates should be removed');
assert.strictEqual((parts[2].text.match(/bad hands/g) || []).length, 1, 'negative duplicates should be removed');

const enriched = policy.enrichDualPrompt(
  '2girls, cafe, (ayachi_nene_on_the_left, smile) BREAK (shiki_natsume_on_the_right, blush)',
  ['ayachi_nene','white_hair','purple_eyes'],
  ['shiki_natsume','black_hair','yellow_eyes']
);
['ayachi_nene','white_hair','purple_eyes','shiki_natsume','black_hair','yellow_eyes','BREAK'].forEach(token => {
  assert(enriched.includes(token), 'dual prompt should include ' + token);
});

const reframed = policy.filterFraming('close_up, full_body, wide_shot, smile', 'close');
assert(reframed.includes('close_up') && !reframed.includes('full_body') && !reframed.includes('wide_shot'), 'selected framing must override incompatible baseline framing');

const reframedParts = policy.applyFraming([
  { cls:'t', source:'scene', text:'cafe, wide_shot, smile' },
  { cls:'t', source:'manual', text:'full_body, medium_shot, holding_cup' },
  { cls:'t', source:'story', text:'beach, close_up' },
  { cls:'c', source:'tail', text:'establishing_shot, depth_of_field' },
  { cls:'n', text:'[NEG] cropped, bad hands' }
], 'close');
const positiveFramed = reframedParts.filter(part => part.cls !== 'n').map(part => part.text).join(', ');
['wide_shot','full_body','medium_shot','establishing_shot'].forEach(tag => {
  assert(!policy.tokenize(positiveFramed).includes(tag), 'final framing policy must remove stale ' + tag + ' from every positive source');
});
assert(positiveFramed.includes('close_up'), 'selected close framing must survive final composition');
assert(reframedParts.find(part => part.source === 'scene').source === 'scene', 'framing policy must retain part metadata');
assert(reframedParts.find(part => part.cls === 'n').text.includes('cropped'), 'positive framing policy must not rewrite negative parts');
assert.strictEqual(policy.resolveFramingMode('close', ['wide_shot','full_body']), 'close', 'explicit close shot must override stale wide scene tags for LoRA policy');
assert.strictEqual(policy.resolveFramingMode('pov', ['wide_shot','full_body']), '', 'explicit non-framing shot must not fall back to stale scene framing');
assert.strictEqual(policy.resolveFramingMode('', ['full_body']), 'wide', 'scene tags may drive LoRA framing only before a shot is selected');

const selectiveNegative = policy.mergeNegativePrompt(
  'bad quality, worst detail, sketch',
  'worst quality, bad anatomy, bad hands, crowd, daylight, harsh_lighting, school_uniform',
  'replace',
  'boilerplate'
);
['crowd','daylight','harsh_lighting','school_uniform'].forEach(tag => {
  assert(policy.tokenize(selectiveNegative).includes(tag), 'replace mode must preserve scene semantic exclusion ' + tag);
});
['bad_anatomy','bad_hands'].forEach(tag => {
  assert(!policy.tokenize(selectiveNegative).includes(tag), 'model baseline must replace generic boilerplate ' + tag);
});
assert(policy.tokenize(selectiveNegative).includes('bad quality'), 'model negative baseline must be retained');

const r15 = policy.adaptNegative('bad hands, nsfw, nude, explicit, cropped', { rating:'R15' }, { shot:'close', character:'nene' });
assert(!policy.tokenize(r15).includes('nsfw'), 'R15 must not be blocked by nsfw');
assert(!policy.tokenize(r15).includes('cropped'), 'close-up must not negatively block cropping');
assert(policy.tokenize(r15).includes('nude') && policy.tokenize(r15).includes('explicit'), 'R15 must still block explicit content');

const r18 = policy.adaptNegative('bad hands, nsfw, nude, explicit', { rating:'R18', mature:true }, { character:'nene' });
['child','loli','underage'].forEach(tag => assert(policy.tokenize(r18).includes(tag), 'R18 must exclude ' + tag));
['nsfw','nude','explicit'].forEach(tag => assert(!policy.tokenize(r18).includes(tag), 'R18 negative must not fight ' + tag));

const report = policy.analyzeParts([{ cls:'t', text:'1girl, close_up, wide_shot, smile' }, { cls:'n', text:'[NEG] bad hands' }]);
assert.strictEqual(report.level, 'warn', 'conflicting framing should be reported');
assert(report.warnings.some(message => message.includes('镜头')), 'framing warning should be actionable');

assert(policy.sceneSupportsCharacter({ char:'nene' }, 'nene'));
assert(!policy.sceneSupportsCharacter({ char:'nene' }, 'natsume'));
assert.strictEqual(
  policy.sceneTemplateText({ prompt:'cafe, school_uniform', tags:['school_uniform'] }, {}),
  'cafe',
  'scene template text should remove tags already supplied by scene metadata'
);

console.log('Prompt policy tests passed: production module, scoped BREAK, ratings, framing and analysis');
