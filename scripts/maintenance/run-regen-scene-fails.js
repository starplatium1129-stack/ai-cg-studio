const fs = require('fs');
const { spawnSync } = require('child_process');

const sceneIds = fs.readFileSync('runtime/failed-scene-ids.txt', 'utf8').trim().split(',');
console.log(`[Batch Runner] Total scene IDs to process: ${sceneIds.length}`);

const BATCH_SIZE = 25;
for (let i = 0; i < sceneIds.length; i += BATCH_SIZE) {
  const batch = sceneIds.slice(i, i + BATCH_SIZE);
  console.log(`\n--- Running scene batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(sceneIds.length / BATCH_SIZE)} (${batch.length} items) ---`);
  
  spawnSync('node', [
    'scripts/maintenance/generate-scene-showcase-anima11.js',
    '--gateway', 'http://127.0.0.1:3123',
    '--ids', batch.join(','),
    '--force',
    '--attempt', '2',
    '--seed-attempt', '2',
    '--concurrency', '3'
  ], { stdio: 'inherit' });
}

console.log('\n[Batch Runner] All 157 scene Attempt-2 batches completed!');
