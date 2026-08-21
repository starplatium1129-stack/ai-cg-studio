const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const CHARACTERS_FILE = path.join(ROOT, 'data', 'characters.json');
const POPULAR_FILE = path.join(ROOT, 'data', 'popular-characters.json');
const SCENE_STORE_PATH = path.join(ROOT, 'src', 'stores', 'sceneStore.ts');

const charData = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
const charList = charData.characters || charData;
const popData = JSON.parse(fs.readFileSync(POPULAR_FILE, 'utf8'));
const popList = popData.characters || popData;

// 标准统一作品出处映射（以规范的《中文名 / 英文名》或官方英文体系归一）
const UNIFIED_FRANCHISES = {
  // Fate 系列 (5人)
  'artoria_pendragon': { franchise: 'Fate', source: 'TYPE-MOON《Fate 系列》' },
  'tohsaka_rin': { franchise: 'Fate', source: 'TYPE-MOON《Fate 系列》' },
  'illyasviel_von_einzbern': { franchise: 'Fate', source: 'TYPE-MOON《Fate 系列》' },
  'jeanne_alter': { franchise: 'Fate', source: 'TYPE-MOON《Fate 系列》' },
  'matou_sakura': { franchise: 'Fate', source: 'TYPE-MOON《Fate 系列》' },

  // 葬送的芙莉莲 (2人)
  'frieren': { franchise: "Frieren: Beyond Journey's End", source: '山田钟人《葬送的芙莉莲 / Sousou no Frieren》' },
  'fern_frieren': { franchise: "Frieren: Beyond Journey's End", source: '山田钟人《葬送的芙莉莲 / Sousou no Frieren》' },

  // 电锯人 (2人)
  'makima': { franchise: 'Chainsaw Man', source: '藤本タツキ《电锯人 / Chainsaw Man》' },
  'reze_chainsaw': { franchise: 'Chainsaw Man', source: '藤本タツキ《电锯人 / Chainsaw Man》' },

  // Re:从零开始的异世界生活 (2人)
  'rem_rezero': { franchise: 'Re:Zero', source: '長月達平《Re:从零开始的异世界生活 / Re:Zero》' },
  'emilia_rezero': { franchise: 'Re:Zero', source: '長月達平《Re:从零开始的异世界生活 / Re:Zero》' },

  // 无职转生 (2人)
  'roxy_migurdia': { franchise: 'Mushoku Tensei', source: '理不尽な孫の手《无职转生 / Mushoku Tensei》' },
  'sylphiette': { franchise: 'Mushoku Tensei', source: '理不尽な孫の手《无职转生 / Mushoku Tensei》' },

  // 我的青春恋爱物语果然有问题 (2人)
  'yukinoshita_yukino': { franchise: 'Oregairu', source: '渡航《我的青春恋爱物语果然有问题 / Oregairu》' },
  'yuigahama_yui': { franchise: 'Oregairu', source: '渡航《我的青春恋爱物语果然有问题 / Oregairu》' },

  // 明日方舟：终末地 (2人)
  'perlica_arknights': { franchise: 'Arknights: Endfield', source: 'Hypergryph《明日方舟：终末地 / Arknights: Endfield》' },
  'laevatain_arknights': { franchise: 'Arknights: Endfield', source: 'Hypergryph《明日方舟：终末地 / Arknights: Endfield》' },

  // 明日方舟 本传 (13人)
  'surtr_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'kaltsit_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'chen_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'eyjafjalla_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'lemuen_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'dusk_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'mudrock_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'eunectes_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'goldenglow_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'skadi_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'quillpen_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'exusiai_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' },
  'suzuran_arknights': { franchise: 'Arknights', source: 'Hypergryph《明日方舟 / Arknights》' }
};

// 1. 同步 characters.json
charList.forEach(c => {
  if (UNIFIED_FRANCHISES[c.id]) {
    c.source = UNIFIED_FRANCHISES[c.id].source;
  }
});
fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(charData, null, 2) + '\n', 'utf8');

// 2. 同步 popular-characters.json
popList.forEach(c => {
  if (UNIFIED_FRANCHISES[c.id]) {
    c.franchise = UNIFIED_FRANCHISES[c.id].franchise;
  }
});
fs.writeFileSync(POPULAR_FILE, JSON.stringify(popData, null, 2) + '\n', 'utf8');

// 3. 计算 DATA_VERSION
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

console.log('[OK] 角色 source 与 popular franchise 彻底归一化对齐！新 DATA_VERSION:', v);
