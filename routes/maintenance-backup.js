'use strict';
var writeJson = require('./maintenance-validation').writeJson;

var path = require('path');


var fs = require('fs');


function saveSnapshotBackup(snapshot, backupRoot, label) {
  fs.mkdirSync(backupRoot, { recursive:true });
  var stamp = new Date().toISOString().replace(/[:.]/g, '-');
  var target = path.join(backupRoot, stamp + '-' + label);
  var filesDir = path.join(target, 'files');
  fs.mkdirSync(filesDir, { recursive:true });
  var manifest = snapshot.map(function (item, index) {
    var backupName = item.exists ? String(index).padStart(3, '0') + '-' + path.basename(item.file) : '';
    if (item.exists) fs.writeFileSync(path.join(filesDir, backupName), item.content);
    return { source:item.file, existed:item.exists, backup:backupName };
  });
  writeJson(path.join(target, 'manifest.json'), { createdAt:new Date().toISOString(), label:label, files:manifest });
  return target;
}
module.exports = { saveSnapshotBackup };
