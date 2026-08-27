'use strict';

/** 定稿场景提示词基线门禁：受保护场景（定点手工修/官方CG/实拍定稿）的渲染字段
 *  必须与 data/prompt-pinned-scenes.json 逐字节一致。字段有意的更新流程：
 *  真实出图自测 -> node scripts/maintenance/pin-scene-prompts.js --capture。 */
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const test = require('node:test');

const tool = path.resolve(__dirname, '..', 'maintenance', 'pin-scene-prompts.js');

test('pinned scenes: all protected prompts byte-match the baseline', () => {
  execFileSync(process.execPath, [tool, '--check'], { stdio: 'pipe' });
});

test('pinned scenes: baseline exists and is non-trivial', () => {
  const baseline = require(path.resolve(__dirname, '..', '..', 'data', 'prompt-pinned-scenes.json'));
  const ids = Object.keys(baseline.scenes || {});
  assert.ok(ids.length >= 95, `expected >=95 pinned scenes, got ${ids.length}`);
  for (const id of ['sc033', 'sc234']) {
    assert.ok(baseline.scenes[id], `${id} must stay pinned`);
    assert.deepStrictEqual(baseline.scenes[id].pinSource, ['png-reference']);
  }
});
