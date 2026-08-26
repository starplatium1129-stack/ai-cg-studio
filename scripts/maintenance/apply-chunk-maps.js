const fs = require('fs');
const _path = require('path');

const bpFile = 'data/scene-blueprints.json';
const bpData = JSON.parse(fs.readFileSync(bpFile, 'utf8'));
const blueprints = bpData.blueprints || bpData;

const chunk1 = require('./refine-map-chunk1.js');
const chunk2 = require('./refine-map-chunk2.js');

let replaced = 0;
blueprints.forEach(bp => {
  const map = chunk1[bp.id] || chunk2[bp.id];
  if (map) {
    if (map.promptTokens) bp.promptTokens = map.promptTokens;
    if (map.promptProse) bp.promptProse = map.promptProse;
    if (map.nsfwTokens) bp.nsfwTokens = map.nsfwTokens;
    if (map.nsfwProse) bp.nsfwProse = map.nsfwProse;
    if (map.negativeTokens) bp.negativeTokens = map.negativeTokens;
    replaced++;
  }
});

fs.writeFileSync(bpFile, JSON.stringify(bpData, null, 2) + '\n', 'utf8');
console.log(`Applied tailored deep reconstruction to ${replaced} blueprints!`);
