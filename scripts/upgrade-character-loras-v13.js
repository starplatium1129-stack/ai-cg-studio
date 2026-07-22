#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const SCENE_DIR = path.join(ROOT, 'data', 'scenes');

const MODEL_UPGRADES = new Map([
  ['ayachi_nene_v11', 'ayachi_nene_v13'],
  ['shiki_natsume_v11', 'shiki_natsume_v13'],
]);

const NATSUME_IDENTITY = [
  'black_hair',
  'long_hair',
  'yellow_eyes',
  'mole_under_eye',
  'hairclip',
];
const NATSUME_QIPAO = [
  'red_china_dress',
  'mandarin_collar',
  'gold_trim',
  'floral_pattern',
  'black_thighhighs',
  'hair_bun',
  'hair_flower',
];
const NENE_IDENTITY = [
  'white_hair',
  'very_long_hair',
  'low_twintails',
  'purple_eyes',
  'ahoge',
  'hair_ribbon',
];
const NENE_WITCH = [
  'witch_hat',
  'witch_dress',
  'black_cape',
  'pink_lining',
  'striped_legwear',
  'midriff',
];
const OUTFIT_CONFLICTS = new Set(['bare_legs', 'black_pantyhose', 'thighhighs']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function replaceModels(text) {
  let result = text;
  for (const [oldName, newName] of MODEL_UPGRADES) {
    result = result.split(oldName).join(newName);
  }
  return result;
}

function sceneText(scene) {
  return [scene.title, scene.story, scene.prompt, ...(scene.tags || [])].join(' ');
}

function isNatsumeQipao(scene) {
  return scene.char === 'natsume' && /旗袍|qipao|cheongsam|china_dress/i.test(sceneText(scene));
}

function isNeneWitch(scene) {
  return scene.char === 'nene' && /魔女服|witch_hat|witch_dress|witch_costume|black_cape/i.test(sceneText(scene));
}

function normalizeTagList(tags, additions, removeConflicts) {
  const result = [];
  for (const tag of tags || []) {
    if (removeConflicts && OUTFIT_CONFLICTS.has(tag)) continue;
    if (!result.includes(tag)) result.push(tag);
  }
  for (const tag of additions) {
    if (!result.includes(tag)) result.push(tag);
  }
  return result;
}

function upgradePrompt(prompt, additions, removeConflicts) {
  const upgraded = replaceModels(prompt || '');
  if (!upgraded || additions.length === 0) return upgraded;
  const tokens = upgraded.split(',').map((token) => token.trim()).filter(Boolean);
  const loras = tokens.filter((token) => /^<lora:/i.test(token));
  const body = tokens.filter((token) => {
    if (/^<lora:/i.test(token)) return false;
    return !(removeConflicts && OUTFIT_CONFLICTS.has(token));
  });
  for (const tag of additions) {
    if (!body.includes(tag)) body.push(tag);
  }
  return [...body, ...loras].join(', ');
}

function upgradeScene(scene, stats) {
  const qipao = isNatsumeQipao(scene);
  const witch = isNeneWitch(scene);
  const additions = qipao
    ? [...NATSUME_IDENTITY, ...NATSUME_QIPAO]
    : witch
      ? [...NENE_IDENTITY, ...NENE_WITCH]
      : [];
  if (typeof scene.lora === 'string') scene.lora = replaceModels(scene.lora);
  scene.prompt = upgradePrompt(scene.prompt, additions, qipao || witch);
  if (additions.length > 0) scene.tags = normalizeTagList(scene.tags, additions, true);
  if (qipao) stats.qipaoScenes.push(scene.id);
  if (witch) stats.witchScenes.push(scene.id);
}

function upgradeSceneSources(stats) {
  for (const name of fs.readdirSync(SCENE_DIR).filter((name) => name.endsWith('.json'))) {
    const file = path.join(SCENE_DIR, name);
    const value = readJson(file);
    if (!Array.isArray(value)) continue;
    for (const scene of value) upgradeScene(scene, stats);
    if (WRITE) writeJson(file, value);
  }
}

function upgradeCharacters() {
  const file = path.join(ROOT, 'data', 'characters.json');
  const characters = readJson(file);
  for (const character of characters) {
    if (!character.lora) continue;
    character.lora.name = replaceModels(character.lora.name);
    if (character.id === 'nene') {
      character.lora.special_outfits = {
        official_witch: NENE_WITCH,
      };
    }
    if (character.id === 'natsume') {
      character.lora.special_outfits = {
        official_qipao: NATSUME_QIPAO,
      };
    }
  }
  if (WRITE) writeJson(file, characters);
}

function upgradeLoras() {
  const file = path.join(ROOT, 'data', 'loras.json');
  const loras = readJson(file);
  for (const lora of loras) {
    const nene = lora.character === 'NENE_001';
    const natsume = lora.character === 'NAT_001';
    if (!nene && !natsume) continue;
    lora.id = nene ? 'L_NENE_V13' : 'L_NAT_V13';
    lora.name = nene ? 'ayachi_nene_v13' : 'shiki_natsume_v13';
    lora.version = '1.3.0';
    lora.description = nene
      ? '绫地宁宁角色 LoRA v13。在 v11 基础上加入筛选后的官方 CG 与立绘精修；固定种子对照中，人物身份与官方魔女服结构均优于 v11。'
      : '四季夏目角色 LoRA v13。在 v11 基础上加入筛选后的官方 CG 与立绘精修；经官方参考图和固定种子对照，人物身份与旗袍剪裁均优于 v11。';
    lora.dataset = {
      images: nene ? 64 : 68,
      official_additions: 9,
      resolution: 1024,
      strategy: 'v11 resume refinement',
    };
    lora.training = {
      epoch: 30,
      rank: 32,
      alpha: 32,
      unet_learning_rate: 0.00002,
      text_encoder: 'frozen during refinement',
    };
    lora.outfit_guidance = nene
      ? { official_witch: NENE_WITCH }
      : { official_qipao: NATSUME_QIPAO };
    lora.validation = {
      method: 'same-seed A/B plus official-reference review',
      baseline: nene ? 'ayachi_nene_v11' : 'shiki_natsume_v11',
      selected_checkpoint: 'epoch 30',
    };
    delete lora.test_grid;
  }
  if (WRITE) writeJson(file, loras);
}

function upgradeTextDefaults() {
  const relativeFiles = [
    'docs/scene-spec.html',
    'docs/prompt-spec.html',
    'docs/art-direction.html',
    'tools/scene-manager.html',
    'tools/scenario.html',
    'scripts/classify-scene-ratings.js',
    'scripts/refine-scenes.js',
  ];
  for (const relative of relativeFiles) {
    const file = path.join(ROOT, relative);
    const before = fs.readFileSync(file, 'utf8');
    const after = replaceModels(before);
    if (WRITE && before !== after) fs.writeFileSync(file, after, 'utf8');
  }
}

function main() {
  const stats = { qipaoScenes: [], witchScenes: [] };
  upgradeSceneSources(stats);
  upgradeCharacters();
  upgradeLoras();
  upgradeTextDefaults();
  console.log(JSON.stringify({ mode: WRITE ? 'write' : 'check', ...stats }, null, 2));
}

main();
