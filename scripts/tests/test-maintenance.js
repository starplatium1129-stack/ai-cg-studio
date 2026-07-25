'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var helpers = require('../../routes/maintenance')._test;

function assert(condition, message) {
  if (!condition) throw new Error('[maintenance] ' + message);
}

function expectThrow(action, message) {
  var threw = false;
  try { action(); } catch (error) { threw = true; }
  assert(threw, message);
}

function run() {
  var temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-maintenance-'));
  try {
    var original = path.join(temp, 'content.json');
    var created = path.join(temp, 'created.json');
    fs.writeFileSync(original, '{"version":1}\n');
    var snapshot = helpers.snapshotFiles([original, created]);
    helpers.writeFileAtomic(original, '{"version":2}\n');
    helpers.writeFileAtomic(created, '{}\n');
    var backup = helpers.saveSnapshotBackup(snapshot, path.join(temp, 'backups'), 'test');
    helpers.restoreSnapshot(snapshot);
    assert(fs.readFileSync(original, 'utf8') === '{"version":1}\n', 'rollback must restore the previous file bytes');
    assert(!fs.existsSync(created), 'rollback must remove files created after the snapshot');
    assert(fs.existsSync(path.join(backup, 'manifest.json')), 'every transaction must create a recoverable backup manifest');

    helpers.validateTags([{ id:'tag_001', cat:'Scene', en:'library', cn:'图书馆', weight:0.8, related:[] }]);
    expectThrow(function () {
      helpers.validateTags([
        { id:'tag_001', en:'library' },
        { id:'tag_002', en:'LIBRARY' }
      ]);
    }, 'duplicate prompt tag names must be rejected');

    var curation = helpers.sanitizeCuration({
      curatedSceneIds:['sc001', 'missing'],
      signatureSceneIds:['sc002'],
      reviewSceneIds:['sc001', 'sc003'],
      recommendationReasons:{ sc002:'招牌理由', missing:'stale' }
    }, new Set(['sc001', 'sc002', 'sc003']));
    assert(curation.curatedSceneIds.includes('sc002'), 'signature scenes must automatically belong to curated scenes');
    assert(!curation.reviewSceneIds.includes('sc001'), 'a scene cannot be both curated and pending review');
    assert(!curation.recommendationReasons.missing, 'references to deleted scenes must be cleaned');

    var jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
    assert(helpers.decodeJpegDataUrl(jpeg, 'test').length === 4, 'canonical JPEG uploads must be accepted');
    expectThrow(function () { helpers.decodeJpegDataUrl('data:image/png;base64,AAAA', 'test'); }, 'non-canonical image formats must be rejected by the server');
  } finally {
    fs.rmSync(temp, { recursive:true, force:true });
  }

  console.log('Maintenance tests passed: atomic writes, backups, rollback, curation, tags and canonical JPEG uploads');
}

run();
