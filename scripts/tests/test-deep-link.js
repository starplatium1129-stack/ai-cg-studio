const assert = require('assert');
const { test } = require('node:test');
const { parseDeepLink, normalizeAtelierPath } = require('../../desktop-dist/deepLink.js');

test('深链解析：常见路由', () => {
  assert.equal(parseDeepLink('aics://gallery'), '/gallery');
  assert.equal(parseDeepLink('aics://training'), '/training');
  assert.equal(parseDeepLink('aics://chat'), '/chat');
  assert.equal(parseDeepLink('aics://control'), '/control');
  assert.equal(parseDeepLink('aics://prompt'), '/prompt');
});

test('深链解析：pathname 形式与大小写', () => {
  assert.equal(parseDeepLink('aics:///gallery'), '/gallery');
  assert.equal(parseDeepLink('AICS://Gallery'), '/gallery');
  assert.equal(parseDeepLink('aics://scene-explorer'), '/scene-explorer');
});

test('深链解析：非法输入拒绝', () => {
  assert.equal(parseDeepLink('aics://'), '');
  assert.equal(parseDeepLink('aics://unknown!!'), '');
  assert.equal(parseDeepLink('https://gallery'), '');
  assert.equal(parseDeepLink('not a url'), '');
  assert.equal(parseDeepLink('aics://gallery/extra'), '');
});

test('Atelier 路径归一化：非法回退根路径', () => {
  assert.equal(normalizeAtelierPath('/gallery'), '/gallery');
  assert.equal(normalizeAtelierPath('/'), '/');
  assert.equal(normalizeAtelierPath('gallery'), '/');
  assert.equal(normalizeAtelierPath('/a/b'), '/');
  assert.equal(normalizeAtelierPath('/UPPER-1'), '/UPPER-1');
});
