const fs = require('fs');
const { spawnSync } = require('child_process');

// 选取 5 个重构幅度最大的标志性场景
const sampleKeys = [
  'popular:makima:makima_office',
  'popular:kaltsit_arknights:kaltsit_arknights_r18_desk_night',
  'popular:reze_chainsaw:reze_night_school_pool_summer',
  'popular:roxy_migurdia:roxy_migurdia_r18_desk_night',
  'popular:eunectes_arknights:eunectes_arknights_mech_garage'
];

console.log('[Test Runner] Generating 5 fully tailored re-imagined blueprints...');

spawnSync('node', [
  'scripts/maintenance/generate-popular-showcase-anima11.js',
  '--gateway', 'http://127.0.0.1:3123',
  '--keys', sampleKeys.join(','),
  '--force',
  '--attempt', '2',
  '--seed-attempt', '2',
  '--concurrency', '3'
], { stdio: 'inherit' });

console.log('[Test Runner] Completed generation for 5 samples.');
