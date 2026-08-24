const fs = require('fs');
const alignment = JSON.parse(fs.readFileSync('runtime/human-audit-alignment-scenes.json', 'utf8'));

console.log('=== 37 Scene Cases: AI Pre-Passed but USER FAILED ===');
alignment.userFailed.filter(u => u.aiPrePassed).slice(0, 20).forEach((u, i) => {
  console.log(`${i+1}. [${u.sceneId}] ${u.failNote ? '-> Note: ' + u.failNote : ''}`);
});

const withNotes = alignment.userFailed.filter(u => u.failNote);
console.log('\n=== Total scene fail.txt with text notes:', withNotes.length);
withNotes.slice(0, 15).forEach((u, i) => {
  console.log(`${i+1}. [${u.sceneId}]: "${u.failNote}"`);
});
