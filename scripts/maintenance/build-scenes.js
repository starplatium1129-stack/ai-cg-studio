/** Build the browser-facing data/scenes.json from canonical scene shards. */
const { aggregatePath, aggregateIsCurrent, loadSceneShards, writeAggregate } = require('../runtime/scene-store');
const { syncDataVersion } = require('../runtime/data-version');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const check = process.argv.includes('--check');
const { scenes, sources } = loadSceneShards();
const counts = sources.map(({ file, scenes: items }) => file + '=' + items.length).join(', ');

if (check) {
  if (!aggregateIsCurrent(scenes)) {
    console.error('Scene build is stale: run npm run scenes:build');
    process.exit(1);
  }
  console.log('Scene build current: ' + scenes.length + ' scenes (' + counts + ')');
} else {
  writeAggregate(scenes);
  console.log('Built ' + aggregatePath + ': ' + scenes.length + ' scenes (' + counts + ')');
  // 同步 DATA_VERSION（与 validate-content-contracts.js 共用哈希口径，避免手 bump 遗漏导致 immutable 缓存漂移）
  try {
    const result = syncDataVersion(ROOT);
    if (result.wrote) {
      console.log(`[DATA_VERSION] 已同步至 ${result.version} (src/stores/sceneStore.ts)`);
    }
  } catch (e) {
    console.warn('[DATA_VERSION] 同步跳过:', e.message);
  }
}
