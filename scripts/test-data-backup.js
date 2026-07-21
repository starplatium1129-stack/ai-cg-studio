const assert = require('assert');
const backup = require('../tools/data-backup.js');

const created = backup.create({
  appVersion:'1.5.0',
  history:[{ id:1, timestamp:10, prompt:'old' }],
  projects:[{ id:'p1', updatedAt:20, title:'project' }],
  settings:{ aics_theme:'dark' },
  images:[{ id:'img_1', dataUrl:'data:image/png;base64,YQ==', size:1 }]
});

assert.equal(created.type, backup.TYPE);
assert.equal(created.schemaVersion, backup.SCHEMA_VERSION);
assert.deepEqual(backup.summary(created), { history:1, projects:1, settings:1, images:1 });

const migrated = backup.normalize({
  history:[{ id:2, prompt:'legacy' }],
  projects:[],
  settings:{ aics_theme:'light' },
  images:[]
});
assert.equal(migrated.schemaVersion, 1);
assert.equal(migrated.data.history[0].prompt, 'legacy');

const merged = backup.mergeById(
  [{ id:1, timestamp:10, prompt:'local' }, { id:2, timestamp:20 }],
  [{ id:1, timestamp:30, prompt:'imported' }, { id:3, timestamp:40 }]
);
assert.deepEqual(merged.map(item => item.id), [3, 1, 2]);
assert.equal(merged.find(item => item.id === 1).prompt, 'imported');

const legacyMerged = backup.mergeById(
  [{ timestamp:50, prompt:'legacy local' }],
  [{ timestamp:50, prompt:'legacy imported' }, { prompt:'id-less record' }]
);
assert.equal(legacyMerged.length, 2);
assert.equal(legacyMerged[0].prompt, 'legacy imported');

assert.throws(() => backup.normalize({ schemaVersion:99 }), /更新版本/);
assert.throws(() => backup.normalize({ schemaVersion:1, type:'other-backup', data:{} }), /不是绫季绘境备份/);
assert.throws(() => backup.normalize({ foo:'bar' }), /不包含可恢复/);
assert.throws(() => backup.normalize(null), /有效对象/);

console.log('Local data backup tests passed');
