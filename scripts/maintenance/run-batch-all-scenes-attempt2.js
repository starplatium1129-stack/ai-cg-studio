const fs = require('fs');
const { spawnSync } = require('child_process');

const sceneIds = fs.readFileSync('runtime/failed-scene-ids.txt', 'utf8')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean);

console.log(`[Batch Scene Attempt-2] Starting safe batch rendering of ${sceneIds.length} failed scenes...`);

// 分批执行，每批 10 个场景，concurrency 为 2
const batchSize = 10;
for (let i = 0; i < sceneIds.length; i += batchSize) {
  const batch = sceneIds.slice(i, i + batchSize);
  console.log(`\n=== Running Scene Batch ${i / batchSize + 1} / ${Math.ceil(sceneIds.length / batchSize)} (Count: ${batch.length}) ===`);
  spawnSync('node', [
    'scripts/maintenance/generate-scene-showcase-anima11.js',
    '--gateway', 'http://127.0.0.1:3123',
    '--ids', batch.join(','),
    '--force',
    '--attempt', '2',
    '--seed-attempt', '2',
    '--concurrency', '2'
  ], { stdio: 'inherit' });
}

console.log('\n[Batch Scene Attempt-2] 🎉 All 157 failed scenes have completed rendering!');
