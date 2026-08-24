const fs = require('fs');
const popularAlign = JSON.parse(fs.readFileSync('runtime/human-audit-alignment-popular.json', 'utf8'));
const keys = popularAlign.userFailed.map(u => `popular:${u.character}:${u.blueprint}`).join(',');
console.log('Failed popular keys count:', popularAlign.userFailed.length);
fs.writeFileSync('runtime/failed-popular-keys.txt', keys, 'utf8');
