/** Build the browser-facing data/scenes.json from canonical scene shards. */
const { aggregatePath, aggregateIsCurrent, loadSceneShards, writeAggregate } = require('../runtime/scene-store');

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
  // 同步 DATA_VERSION（与 validate-content-contracts.js 同源，避免手 bump 遗漏导致 immutable 缓存漂移）
  try {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    const ROOT = path.resolve(__dirname, '..', '..');
    const files = ['scenes.json','scenes-index.json','scenes-core.json','scenes-nene.json','scenes-natsume.json','scenes-shared.json','curation.json','characters.json','loras.json','tags.json','presets.json','popular-characters.json','scene-blueprints.json'];
    const h = crypto.createHash('sha1');
    for (const n of files) {
      const p = path.join(ROOT, 'data', n);
      h.update(n + '=' + fs.readFileSync(p, 'utf8').length + ';');
      h.update(fs.readFileSync(p));
    }
    const expected = Number.parseInt(h.digest('hex').slice(0, 8), 16);
    const storeFile = path.join(ROOT, 'src', 'stores', 'sceneStore.ts');
    let src = fs.readFileSync(storeFile, 'utf8');
    const m = /DATA_VERSION\s*=\s*(\d+)/.exec(src);
    if (m && Number(m[1]) !== expected) {
      src = src.replace(/DATA_VERSION\s*=\s*\d+/, `DATA_VERSION = ${expected}`);
      fs.writeFileSync(storeFile, src, 'utf8');
      console.log(`[DATA_VERSION] 已同步至 ${expected} (src/stores/sceneStore.ts)`);
    }
  } catch (e) {
    console.warn('[DATA_VERSION] 同步跳过:', e.message);
  }
}
