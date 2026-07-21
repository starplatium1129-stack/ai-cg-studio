/** Build the browser-facing data/scenes.json from canonical scene shards. */
const { aggregatePath, aggregateIsCurrent, loadSceneShards, writeAggregate } = require('./scene-store');

const check = process.argv.includes('--check');
const { scenes, sources } = loadSceneShards();
const counts = sources.map(({ entry, scenes: items }) => entry.file + '=' + items.length).join(', ');

if (check) {
  if (!aggregateIsCurrent(scenes)) {
    console.error('Scene build is stale: run npm run scenes:build');
    process.exit(1);
  }
  console.log('Scene build current: ' + scenes.length + ' scenes (' + counts + ')');
} else {
  writeAggregate(scenes);
  console.log('Built ' + aggregatePath + ': ' + scenes.length + ' scenes (' + counts + ')');
}
