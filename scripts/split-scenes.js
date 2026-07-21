/** Import data/scenes.json into the canonical scene shards. */
const fs = require('fs');
const { aggregatePath, readJson, writeSceneShards } = require('./scene-store');

if (!process.argv.includes('--write')) {
  console.error('Refusing to replace scene shards without --write');
  process.exit(1);
}

const scenes = readJson(aggregatePath);
if (!Array.isArray(scenes)) throw new Error('data/scenes.json root must be an array');
writeSceneShards(scenes);
console.log('Imported ' + scenes.length + ' scenes from ' + aggregatePath + ' into data/scenes/*.json');
