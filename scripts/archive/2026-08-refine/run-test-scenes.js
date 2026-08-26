const { spawnSync } = require('child_process');

const sceneKeys = ['sc003', 'sc009', 'sc011', 'sc016', 'sc022', 'sc025', 'sc026', 'sc027', 'sc030', 'sc031', 'sc033', 'sc034'];

console.log(`[Scene Runner] Generating ${sceneKeys.length} hand-crafted scenes (Attempt-2)...`);

spawnSync('node', [
  'scripts/maintenance/generate-scene-showcase-anima11.js',
  '--gateway', 'http://127.0.0.1:3123',
  '--ids', sceneKeys.join(','),
  '--force',
  '--attempt', '2',
  '--seed-attempt', '2',
  '--concurrency', '3'
], { stdio: 'inherit' });

console.log('[Scene Runner] Finished generating hand-crafted scenes.');
