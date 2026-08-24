const fs = require('fs');
const { spawnSync } = require('child_process');

console.log('[Batch Scene Attempt-2] Starting batch rendering of all failed scenes in scene library...');

const sceneIds = fs.readFileSync('runtime/failed-scene-ids.txt', 'utf8')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean);

console.log(`[Batch Scene Attempt-2] Total scenes to render: ${sceneIds.length}`);

spawnSync('node', [
  'scripts/maintenance/generate-scene-showcase-anima11.js',
  '--gateway', 'http://127.0.0.1:3123',
  '--ids', sceneIds.join(','),
  '--force',
  '--attempt', '2',
  '--seed-attempt', '2',
  '--concurrency', '3'
], { stdio: 'inherit' });

console.log('[Batch Scene Attempt-2] Completed full scene batch generation!');
