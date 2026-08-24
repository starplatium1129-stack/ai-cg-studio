const fs = require('fs');
const { spawnSync } = require('child_process');

const popularKeys = fs.readFileSync('runtime/failed-popular-keys.txt', 'utf8').trim().split(',');
console.log(`[Batch Runner] Total keys to process: ${popularKeys.length}`);

const BATCH_SIZE = 25;
for (let i = 0; i < popularKeys.length; i += BATCH_SIZE) {
  const batch = popularKeys.slice(i, i + BATCH_SIZE);
  console.log(`\n--- Running batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(popularKeys.length / BATCH_SIZE)} (${batch.length} items) ---`);
  
  spawnSync('node', [
    'scripts/maintenance/generate-popular-showcase-anima11.js',
    '--gateway', 'http://127.0.0.1:3123',
    '--keys', batch.join(','),
    '--force',
    '--attempt', '2',
    '--seed-attempt', '2',
    '--concurrency', '3'
  ], { stdio: 'inherit' });
}

console.log('\n[Batch Runner] All 174 popular blueprint Attempt-2 batches completed!');
