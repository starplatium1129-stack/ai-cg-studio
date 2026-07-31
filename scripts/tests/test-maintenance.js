'use strict';

/**
 * 维护写盘路径测试 — 已迁移到 node:test。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const helpers = require('../../routes/maintenance')._test;

function expectThrow(action, message) {
  assert.throws(action, message);
}

test('写盘回滚：原子写 + 快照恢复 + 备份清单', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-maintenance-'));
  try {
    const original = path.join(temp, 'content.json');
    const created = path.join(temp, 'created.json');
    fs.writeFileSync(original, '{"version":1}\n');
    const snapshot = helpers.snapshotFiles([original, created]);
    helpers.writeFileAtomic(original, '{"version":2}\n');
    helpers.writeFileAtomic(created, '{}\n');
    const backup = helpers.saveSnapshotBackup(snapshot, path.join(temp, 'backups'), 'test');
    helpers.restoreSnapshot(snapshot);
    assert.equal(fs.readFileSync(original, 'utf8'), '{"version":1}\n', 'rollback must restore the previous file bytes');
    assert.equal(fs.existsSync(created), false, 'rollback must remove files created after the snapshot');
    assert.equal(fs.existsSync(path.join(backup, 'manifest.json')), true, 'every transaction must create a recoverable backup manifest');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('标签校验：重复英文名必须拒绝', () => {
  helpers.validateTags([{ id: 'tag_001', cat: 'Scene', en: 'library', cn: '图书馆', weight: 0.8, related: [] }]);
  expectThrow(() => {
    helpers.validateTags([
      { id: 'tag_001', en: 'library' },
      { id: 'tag_002', en: 'LIBRARY' },
    ]);
  }, 'duplicate prompt tag names must be rejected');
});

test('策展清洗：招牌自动入精选、互斥与失效引用清理', () => {
  const curation = helpers.sanitizeCuration({
    curatedSceneIds: ['sc001', 'missing'],
    signatureSceneIds: ['sc002'],
    reviewSceneIds: ['sc001', 'sc003'],
    recommendationReasons: { sc002: '招牌理由', missing: 'stale' },
  }, new Set(['sc001', 'sc002', 'sc003']));
  assert.equal(curation.curatedSceneIds.includes('sc002'), true, 'signature scenes must automatically belong to curated scenes');
  assert.equal(curation.reviewSceneIds.includes('sc001'), false, 'a scene cannot be both curated and pending review');
  assert.equal(curation.recommendationReasons.missing, undefined, 'references to deleted scenes must be cleaned');
});

test('JPEG 上传：规范魔数接受、非规范格式拒绝', () => {
  const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
  assert.equal(helpers.decodeJpegDataUrl(jpeg, 'test').length, 4, 'canonical JPEG uploads must be accepted');
  expectThrow(() => { helpers.decodeJpegDataUrl('data:image/png;base64,AAAA', 'test'); }, 'non-canonical image formats must be rejected by the server');
});
