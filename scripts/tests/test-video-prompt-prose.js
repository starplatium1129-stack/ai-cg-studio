const { test } = require('node:test');
const assert = require('assert');
const { tagsToVideoProse } = require('../../src/utils/videoPromptProse.ts');

test('tag stream converts to natural-language head with kept tags', () => {
  const out = tagsToVideoProse('safe, surtr_(arknights), 1girl, solo, red hair, long hair, red eyes, techwear jacket, dorm room, winter sunlight');
  assert.ok(out.startsWith('a girl with red hair and red eyes'), 'subject + looks head, got: ' + out);
  assert.ok(out.includes('techwear jacket') && out.includes('dorm room'), 'scene/outfit tags kept');
  assert.ok(!out.includes('safe'), 'quality tag dropped');
});

test('solo subject keeps solo as modifier', () => {
  const out = tagsToVideoProse('1girl, solo, blue hair, blue eyes, maid outfit');
  assert.ok(out.startsWith('a girl with blue hair and blue eyes'), out);
  assert.ok(out.includes('solo') && out.includes('maid outfit'), out);
});

test('natural-language prompt passes through unchanged', () => {
  const prose = 'A silver-haired girl stands by the library window, snow falling softly outside, warm lamplight on her face.';
  assert.strictEqual(tagsToVideoProse(prose), prose);
});

test('empty input returns empty', () => {
  assert.strictEqual(tagsToVideoProse(''), '');
  assert.strictEqual(tagsToVideoProse('   '), '');
});

test('no subject tag still produces a figure head when looks exist', () => {
  const out = tagsToVideoProse('long hair, red eyes, black dress, night city, neon');
  assert.ok(out.startsWith('a figure with long hair and red eyes'), out);
});
