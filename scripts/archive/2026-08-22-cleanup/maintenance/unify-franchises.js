const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const POPULAR_FILE = path.join(ROOT, 'data', 'popular-characters.json');
const SCENE_STORE_PATH = path.join(ROOT, 'src', 'stores', 'sceneStore.ts');

const popData = JSON.parse(fs.readFileSync(POPULAR_FILE, 'utf8'));
const popList = popData.characters || popData;

// 归一化多角色所属作品名
popList.forEach(c => {
  if (c.franchise === 'Fate/stay night' || c.franchise === 'Fate') {
    c.franchise = 'Fate';
  } else if (c.franchise === 'My Teen Romantic Comedy SNAFU' || c.franchise === 'Oregairu') {
    c.franchise = 'Oregairu';
  }
});

fs.writeFileSync(POPULAR_FILE, JSON.stringify(popData, null, 2) + '\n', 'utf8');

function contentVersion() {
  const hash = crypto.createHash('sha1');
  [
    'scenes.json', 'scenes-index.json', 'scenes-core.json',
    'scenes-nene.json', 'scenes-natsume.json', 'scenes-shared.json',
    'curation.json', 'characters.json', 'loras.json', 'tags.json', 'presets.json',
    'popular-characters.json', 'scene-blueprints.json'
  ].forEach(function (name) {
    hash.update(name + '=' + fs.readFileSync(path.join(ROOT, 'data', name), 'utf8').length + ';');
    hash.update(fs.readFileSync(path.join(ROOT, 'data', name)));
  });
  return Number(parseInt(hash.digest('hex').slice(0, 8), 16));
}

const v = contentVersion();
let storeSource = fs.readFileSync(SCENE_STORE_PATH, 'utf8');
storeSource = storeSource.replace(/DATA_VERSION\s*=\s*\d+/, `DATA_VERSION = ${v}`);
fs.writeFileSync(SCENE_STORE_PATH, storeSource, 'utf8');

console.log('[OK] 热门角色 franchise 归一化完成，新 DATA_VERSION:', v);
