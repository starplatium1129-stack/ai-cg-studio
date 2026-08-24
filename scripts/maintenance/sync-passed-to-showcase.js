const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const popularAlign = JSON.parse(fs.readFileSync('runtime/human-audit-alignment-popular.json', 'utf8'));
const sceneAlign = JSON.parse(fs.readFileSync('runtime/human-audit-alignment-scenes.json', 'utf8'));

const targetDir = 'E:/code/2/lora/AI/SceneShowcase/2026-08-18_v24';
const manifestPath = path.join(targetDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log('Original entries in v24:', manifest.entries.length);

const entriesMap = new Map();
manifest.entries.forEach(e => {
  entriesMap.set(e.id, e);
  if (e.provenance && e.provenance.key) entriesMap.set(e.provenance.key, e);
});

let updatedScenes = 0;
let updatedPopular = 0;

// 1. Sync Scene Passed (146 items)
for (const item of sceneAlign.userPassed) {
  if (!item.fullPng || !fs.existsSync(item.fullPng)) continue;
  const sceneId = item.sceneId;
  const dstBig = path.join(targetDir, 'images', `${sceneId}.jpg`);
  const dstThumb = path.join(targetDir, 'thumbs', `${sceneId}.jpg`);
  
  try {
    execSync(`python scripts/maintenance/convert-showcase-image.py "${item.fullPng}" "${dstBig}" "${dstThumb}"`);
    updatedScenes++;
    
    const entry = entriesMap.get(sceneId);
    if (entry) {
      entry.provenance = entry.provenance || {};
      entry.provenance.review = { verdict: 'pass', reviewedAt: new Date().toISOString(), by: 'user-human-audit' };
    }
  } catch (err) {
    console.error(`Failed to convert scene ${sceneId}:`, err.message);
  }
}

// 2. Sync Popular Passed (264 items)
for (const item of popularAlign.userPassed) {
  if (!item.fullPng || !fs.existsSync(item.fullPng)) continue;
  const key = `popular:${item.character}:${item.blueprint}`;
  const dstId = `pc_${item.character}_${item.blueprint}`;
  const dstBig = path.join(targetDir, 'images', `${dstId}.jpg`);
  const dstThumb = path.join(targetDir, 'thumbs', `${dstId}.jpg`);
  
  try {
    execSync(`python scripts/maintenance/convert-showcase-image.py "${item.fullPng}" "${dstBig}" "${dstThumb}"`);
    updatedPopular++;
    
    const entry = entriesMap.get(key) || entriesMap.get(dstId);
    if (entry) {
      entry.provenance = entry.provenance || {};
      entry.provenance.review = { verdict: 'pass', reviewedAt: new Date().toISOString(), by: 'user-human-audit' };
    }
  } catch (err) {
    console.error(`Failed to convert popular ${key}:`, err.message);
  }
}

manifest.updatedAt = new Date().toISOString();
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log(`Successfully synced ${updatedScenes} scenes and ${updatedPopular} popular blueprints into live Showcase v24!`);
