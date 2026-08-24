const fs = require('fs');
const { spawnSync } = require('child_process');

console.log('[Batch Popular Attempt-2] Starting batch rendering of all failed popular blueprints...');

const popularKeys = fs.readFileSync('runtime/failed-popular-keys.txt', 'utf8')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean);

console.log(`[Batch Popular Attempt-2] Total blueprints to render: ${popularKeys.length}`);

spawnSync('node', [
  'scripts/maintenance/generate-popular-showcase-anima11.js',
  '--gateway', 'http://127.0.0.1:3123',
  '--keys', popularKeys.join(','),
  '--force',
  '--attempt', '2',
  '--seed-attempt', '2',
  '--concurrency', '3'
], { stdio: 'inherit' });

console.log('[Batch Popular Attempt-2] Completed full popular batch generation!');
