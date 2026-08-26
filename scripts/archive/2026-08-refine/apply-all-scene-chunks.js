const fs = require('fs');
const _path = require('path');

const sceneChunk1 = require('./refine-map-scenes-chunk1.js');
const sceneChunk2 = require('./refine-map-scenes-chunk2.js');
const sceneChunk3 = require('./refine-map-scenes-chunk3.js');

const allSceneChunks = { ...sceneChunk1, ...sceneChunk2, ...sceneChunk3 };

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
    const map = allSceneChunks[sc.id];
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
