const { spawnSync } = require('child_process');

const chunkKeys = [
  'popular:roxy_migurdia:roxy_migurdia_r18_academy_bath',
  'popular:sylphiette:sylphiette_r18_fitz_unbuttoned_desk',
  'popular:illyasviel_von_einzbern:illyasviel_einzbern_castle',
  'popular:alisa_mikhailovna_kujou:alya_r18_classroom_afterschool_desk',
  'popular:surtr_arknights:surtr_arknights_snowfield',
  'popular:lemuen_arknights:lemuen_arknights_cliff_sunset',
  'popular:frieren:frieren_magic_library',
  'popular:yuzuriha_inori:yuzuriha_inori_stage'
];

console.log('[Batch Runner] Generating 8 newly hand-crafted blueprints (Attempt-2)...');

spawnSync('node', [
  'scripts/maintenance/generate-popular-showcase-anima11.js',
  '--gateway', 'http://127.0.0.1:3123',
  '--keys', chunkKeys.join(','),
  '--force',
  '--attempt', '2',
  '--seed-attempt', '2',
  '--concurrency', '3'
], { stdio: 'inherit' });

console.log('[Batch Runner] Completed 8 samples.');
