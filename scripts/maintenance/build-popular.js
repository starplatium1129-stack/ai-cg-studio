/** Build the browser-facing data/popular-characters.json from per-franchise shards. */
const path = require('path');
const { aggregatePath, aggregateIsCurrent, loadPopularShards, writePopularAggregate } = require('../runtime/popular-store');
const { syncDataVersion } = require('../runtime/data-version');

const ROOT = path.resolve(__dirname, '..', '..');
const check = process.argv.includes('--check');
const { characters, sources } = loadPopularShards();
const counts = sources.map(({ entry, characters: items }) => entry.file + '=' + items.length).join(', ');

if (check) {
  if (!aggregateIsCurrent()) {
    console.error('Popular build is stale: run npm run popular:build');
    process.exit(1);
  }
  console.log('Popular build current: ' + characters.length + ' characters (' + counts + ')');
} else {
  writePopularAggregate();
  console.log('Built ' + aggregatePath + ': ' + characters.length + ' characters (' + counts + ')');
  // 同步 DATA_VERSION（与 build-scenes 共用哈希口径）
  try {
    const result = syncDataVersion(ROOT);
    if (result.wrote) {
      console.log(`[DATA_VERSION] 已同步至 ${result.version} (src/stores/sceneStore.ts)`);
    }
  } catch (e) {
    console.warn('[DATA_VERSION] 同步跳过:', e.message);
  }
}
