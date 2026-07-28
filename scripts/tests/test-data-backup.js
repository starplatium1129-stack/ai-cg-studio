const assert = require('assert');
const backup = require('../../src/utils/backupCore.ts');

const created = backup.createBackup({
  appVersion:'1.5.0',
  history:[{ id:1, timestamp:10, prompt:'old' }],
  projects:[{ id:'p1', updatedAt:20, title:'project' }],
  settings:{ aics_theme:'dark' },
  images:[{ id:'img_1', dataUrl:'data:image/png;base64,YQ==', size:1 }]
});

assert.equal(created.app, backup.BACKUP_APP);
assert.equal(created.schemaVersion, backup.BACKUP_SCHEMA_VERSION);
assert.deepEqual(backup.summarizeBackup(created), { history:1, projects:1, settings:1, images:1 });

const migrated = backup.normalizeBackup({
  history:[{ id:2, prompt:'legacy' }],
  projects:[],
  settings:{ aics_theme:'light' },
  images:[]
});
assert.equal(migrated.schemaVersion, backup.BACKUP_SCHEMA_VERSION);
assert.equal(migrated.data.history[0].prompt, 'legacy');

const merged = backup.mergeBackupRecords(
  [{ id:1, timestamp:10, prompt:'local' }, { id:2, timestamp:20 }],
  [{ id:1, timestamp:30, prompt:'imported' }, { id:3, timestamp:40 }]
);
assert.deepEqual(merged.map(item => item.id), [3, 1, 2]);
assert.equal(merged.find(item => item.id === 1).prompt, 'imported');

const legacyMerged = backup.mergeBackupRecords(
  [{ timestamp:50, prompt:'legacy local' }],
  [{ timestamp:50, prompt:'legacy imported' }, { prompt:'id-less record' }]
);
assert.equal(legacyMerged.length, 2);
assert.equal(legacyMerged[0].prompt, 'legacy imported');

assert.throws(() => backup.normalizeBackup({ schemaVersion:99 }), /更新版本/);
assert.throws(() => backup.normalizeBackup({ schemaVersion:1, type:'other-backup', data:{} }), /不是绫季绘境备份/);
assert.throws(() => backup.normalizeBackup({ schemaVersion:2, app:'other-app', data:{ settings:{ key:'value' } } }), /不是绫季绘境备份/);
assert.throws(() => backup.normalizeBackup({ foo:'bar' }), /不包含可恢复/);
assert.throws(() => backup.normalizeBackup(null), /有效对象/);
assert.throws(() => backup.normalizeBackup({
  schemaVersion:2,
  data:{ history:[], projects:[], settings:{} },
  images:[{ id:'bad', dataUrl:'data:text/html;base64,YQ==' }],
}), /没有可恢复/);

console.log('Local data backup tests passed against the production TypeScript core');
