const fs = require('fs');
const alignment = JSON.parse(fs.readFileSync('runtime/human-audit-alignment-popular.json', 'utf8'));

console.log('=== 35 Cases: AI Pre-Passed but USER FAILED ===');
alignment.userFailed.filter(u => u.aiPrePassed).forEach((u, i) => {
  console.log(`${i+1}. [${u.character}] ${u.blueprint} ${u.failNote ? '-> Note: ' + u.failNote : ''}`);
});

const withNotes = alignment.userFailed.filter(u => u.failNote);
console.log('\n=== Total fail.txt with text notes:', withNotes.length);
withNotes.forEach((u, i) => {
  console.log(`${i+1}. [${u.character}] ${u.blueprint}: "${u.failNote}"`);
});
