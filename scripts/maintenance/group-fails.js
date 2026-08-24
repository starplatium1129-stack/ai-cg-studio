const fs = require('fs');
const alignment = JSON.parse(fs.readFileSync('runtime/human-audit-alignment-popular.json', 'utf8'));

const charFails = {};
alignment.userFailed.forEach(u => {
  charFails[u.character] = charFails[u.character] || [];
  charFails[u.character].push(u.blueprint);
});

console.log('=== 174 FAILED BLUEPRINTS GROUPED BY CHARACTER ===');
Object.keys(charFails).sort((a,b) => charFails[b].length - charFails[a].length).forEach(char => {
  console.log(`${char} (${charFails[char].length} fails): ${charFails[char].join(', ')}`);
});
