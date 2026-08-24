const fs = require('fs');
const path = require('path');

const bpFile = 'data/scene-blueprints.json';
const bpData = JSON.parse(fs.readFileSync(bpFile, 'utf8'));
const blueprints = bpData.blueprints || bpData;

const chunk1 = require('./refine-map-chunk1.js');
const chunk2 = require('./refine-map-chunk2.js');
const chunk3 = require('./refine-map-chunk3.js');
const chunk4 = require('./refine-map-chunk4.js');
const chunk5 = require('./refine-map-chunk5.js');

const allChunks = { ...chunk1, ...chunk2, ...chunk3, ...chunk4, ...chunk5 };

let replacedBps = 0;
blueprints.forEach(bp => {
  const map = allChunks[bp.id];
  if (map) {
    if (map.promptTokens) bp.promptTokens = map.promptTokens;
    if (map.promptProse) bp.promptProse = map.promptProse;
    if (map.nsfwTokens) bp.nsfwTokens = map.nsfwTokens;
    if (map.nsfwProse) bp.nsfwProse = map.nsfwProse;
    if (map.negativeTokens) bp.negativeTokens = map.negativeTokens;
    replacedBps++;
  }
});

fs.writeFileSync(bpFile, JSON.stringify(bpData, null, 2) + '\n', 'utf8');
console.log(`Successfully merged ${replacedBps} hand-crafted popular blueprints!`);

// 2. 更新场景库
const sceneChunk1 = require('./refine-map-scenes-chunk1.js');
const shardFiles = [
  'data/scenes/nene-core.json',
  'data/scenes/nene-after-story.json',
  'data/scenes/natsume-core.json',
  'data/scenes/natsume-after-story.json',
  'data/scenes/shared.json'
];

let replacedScenes = 0;
shardFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  let fReplaced = 0;
  list.forEach(sc => {
    const map = sceneChunk1[sc.id];
    if (map) {
      if (map.prompt) sc.prompt = map.prompt;
      if (map.animaCaption) sc.animaCaption = map.animaCaption;
      if (map.negative) sc.negative = map.negative;
      fReplaced++;
      replacedScenes++;
    }
  });
  if (fReplaced > 0) {
    fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n', 'utf8');
    console.log(`Updated ${fReplaced} hand-crafted scenes in ${file}`);
  }
});

// 重建聚合 JSON
const neneCore = JSON.parse(fs.readFileSync('data/scenes/nene-core.json', 'utf8'));
const neneAfter = JSON.parse(fs.readFileSync('data/scenes/nene-after-story.json', 'utf8'));
const natsumeCore = JSON.parse(fs.readFileSync('data/scenes/natsume-core.json', 'utf8'));
const natsumeAfter = JSON.parse(fs.readFileSync('data/scenes/natsume-after-story.json', 'utf8'));
const shared = JSON.parse(fs.readFileSync('data/scenes/shared.json', 'utf8'));

const allScenes = [...neneCore, ...neneAfter, ...natsumeCore, ...natsumeAfter, ...shared];
fs.writeFileSync('data/scenes.json', JSON.stringify(allScenes, null, 2) + '\n', 'utf8');
fs.writeFileSync('data/scenes-nene.json', JSON.stringify([...neneCore, ...neneAfter], null, 2) + '\n', 'utf8');
fs.writeFileSync('data/scenes-natsume.json', JSON.stringify([...natsumeCore, ...natsumeAfter], null, 2) + '\n', 'utf8');

console.log(`Aggregated scenes.json rebuilt with ${replacedScenes} hand-crafted scenes!`);
