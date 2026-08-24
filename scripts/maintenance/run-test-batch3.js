const fs = require('fs');
const { spawnSync } = require('child_process');

const newKeys = [
  'popular:tokisaki_kurumi:tokisaki_kurumi_old_bookstore',
  'popular:sakurajima_mai:sakurajima_mai_bookstore',
  'popular:yuigahama_yui:yui_tennis_court_afternoon',
  'popular:eunectes_arknights:eunectes_arknights_mudland_excavation',
  'popular:perlica_arknights:perlica_arknights_talos_wasteland',
  'popular:goldenglow_arknights:goldenglow_arknights_r18_greenhouse_night',
  'popular:quillpen_arknights:quillpen_arknights_feather_shop'
];

console.log(`[Batch Runner] Generating ${newKeys.length} newly refined popular blueprints...`);

spawnSync('node', [
  'scripts/maintenance/generate-popular-showcase-anima11.js',
  '--gateway', 'http://127.0.0.1:3123',
  '--keys', newKeys.join(','),
  '--force',
  '--attempt', '2',
  '--seed-attempt', '2',
  '--concurrency', '3'
], { stdio: 'inherit' });

console.log('[Batch Runner] Completed batch.');
