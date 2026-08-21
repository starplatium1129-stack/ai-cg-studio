const fs = require('fs');
const path = require('path');
const ROOT = path.resolve('.');
const POPULAR_FILE = path.join(ROOT, 'data', 'popular-characters.json');
const popData = JSON.parse(fs.readFileSync(POPULAR_FILE, 'utf8'));
const popList = popData.characters || popData;

const franchiseMap = {};
popList.forEach(c => {
  franchiseMap[c.franchise] = (franchiseMap[c.franchise] || 0) + 1;
});

console.log('=== Popular Characters Franchise Groups ===');
for (const [k, v] of Object.entries(franchiseMap).sort((a,b) => b[1] - a[1])) {
  const chars = popList.filter(c => c.franchise === k).map(c => c.displayName || c.name);
  console.log(`- ${k} (${v} 人): ${chars.join(', ')}`);
}
