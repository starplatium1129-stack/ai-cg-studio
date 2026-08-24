const fs = require('fs');
const alignment = JSON.parse(fs.readFileSync('runtime/human-audit-alignment-popular.json', 'utf8'));

console.log('=== Sample 10 User PASSED but AI Rejected ===');
alignment.userPassed.filter(u => !u.aiPrePassed).slice(0, 10).forEach((u, i) => {
  console.log(`${i+1}. [${u.character}] ${u.blueprint} -> AI rejected reason: ${u.aiPreReason}`);
});
