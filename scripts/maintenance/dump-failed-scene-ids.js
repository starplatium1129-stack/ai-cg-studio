const fs = require('fs');
const sceneAlign = JSON.parse(fs.readFileSync('runtime/human-audit-alignment-scenes.json', 'utf8'));
const ids = sceneAlign.userFailed.map(u => u.sceneId).join(',');
console.log('Failed scene IDs count:', sceneAlign.userFailed.length);
fs.writeFileSync('runtime/failed-scene-ids.txt', ids, 'utf8');
