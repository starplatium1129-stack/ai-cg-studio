'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ROOT = path.resolve(__dirname, '..', '..');

/**
 * 浏览器读取 data/*.json 时带 ?v=DATA_VERSION，服务端按 immutable 缓存。
 * 这里用数据内容的稳定哈希锁定 DATA_VERSION：任何人改了 data 而忘了
 * 在 sceneStore.ts 升版本号，validate 就会失败，避免客户端吃到旧缓存。
 */
function contentVersion() {
  var hash = crypto.createHash('sha1');
  [
    'scenes.json', 'scenes-index.json', 'scenes-core.json',
    'scenes-nene.json', 'scenes-natsume.json', 'scenes-shared.json',
    'curation.json', 'characters.json', 'loras.json', 'tags.json', 'presets.json'
  ].forEach(function (name) {
    hash.update(name + '=' + fs.readFileSync(path.join(ROOT, 'data', name), 'utf8').length + ';');
    hash.update(fs.readFileSync(path.join(ROOT, 'data', name)));
  });
  return Number(parseInt(hash.digest('hex').slice(0, 8), 16));
}

function checkDataVersion() {
  var storeSource = fs.readFileSync(path.join(ROOT, 'src', 'stores', 'sceneStore.ts'), 'utf8');
  var match = /DATA_VERSION\s*=\s*(\d+)/.exec(storeSource);
  if (!match) return ['sceneStore.ts is missing DATA_VERSION'];
  var expected = contentVersion();
  var actual = Number(match[1]);
  if (actual !== expected) {
    return ['DATA_VERSION mismatch: sceneStore.ts has ' + actual + ', data content expects ' + expected
      + ' (改过 data/*.json 后必须同步升 sceneStore.ts 的 DATA_VERSION，否则客户端命中 immutable 旧缓存)'];
  }
  return [];
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function validateContent(data, fileExists) {
  var errors = [];
  var characters = data.characters;
  var loras = data.loras;
  var scenes = data.scenes;
  fileExists = fileExists || function () { return true; };
  if (!Array.isArray(characters) || !characters.length) errors.push('characters.json must contain at least one character');
  if (!Array.isArray(loras) || !loras.length) errors.push('loras.json must contain at least one LoRA');
  if (!Array.isArray(scenes)) errors.push('scenes.json must be an array');
  if (errors.length) return errors;

  var characterIds = new Set();
  var characterLoras = new Set();
  characters.forEach(function (character, index) {
    var label = 'characters[' + index + ']';
    if (!character || typeof character !== 'object') { errors.push(label + ' must be an object'); return; }
    if (!/^[a-z][a-z0-9_-]*$/.test(character.id || '')) errors.push(label + '.id must be a stable lowercase key');
    if (characterIds.has(character.id)) errors.push(label + '.id is duplicated: ' + character.id);
    characterIds.add(character.id);
    ['name', 'source', 'speech'].forEach(function (key) {
      if (typeof character[key] !== 'string' || !character[key].trim()) errors.push(label + '.' + key + ' is required');
    });
    if (!character.portrait || typeof character.portrait.image !== 'string') errors.push(label + '.portrait.image is required');
    else if (!fileExists(character.portrait.image)) errors.push(label + '.portrait.image does not exist: ' + character.portrait.image);
    if (!character.visual_dna || !character.visual_dna.signature) errors.push(label + '.visual_dna.signature is required');
    if (!Array.isArray(character.traits) || character.traits.length < 3) errors.push(label + '.traits must contain identity anchors');
    if (!character.lora || typeof character.lora.name !== 'string') errors.push(label + '.lora.name is required');
    else characterLoras.add(character.lora.name);
    if (!(Number(character.lora && character.lora.weight) > 0 && Number(character.lora.weight) <= 2)) errors.push(label + '.lora.weight must be in (0, 2]');
  });

  var loraIds = new Set();
  var loraNames = new Set();
  var sceneIds = new Set(scenes.map(function (scene) { return scene && scene.id; }).filter(Boolean));
  loras.forEach(function (lora, index) {
    var label = 'loras[' + index + ']';
    if (!lora || typeof lora !== 'object') { errors.push(label + ' must be an object'); return; }
    if (!lora.id || loraIds.has(lora.id)) errors.push(label + '.id is missing or duplicated');
    if (!lora.name || loraNames.has(lora.name)) errors.push(label + '.name is missing or duplicated');
    loraIds.add(lora.id); loraNames.add(lora.name);
    var strength = lora.strength || {};
    if (!(Number(strength.min) <= Number(strength.default) && Number(strength.default) <= Number(strength.max))) {
      errors.push(label + '.strength must satisfy min <= default <= max');
    }
    if (!Array.isArray(lora.compatible_models) || !lora.compatible_models.length) errors.push(label + '.compatible_models is required');
    (lora.test_scene || []).forEach(function (sceneId) {
      if (!sceneIds.has(sceneId)) errors.push(label + '.test_scene references unknown scene: ' + sceneId);
    });
  });

  characterLoras.forEach(function (name) {
    if (!loraNames.has(name)) errors.push('character references unknown LoRA: ' + name);
  });
  scenes.forEach(function (scene, index) {
    if (!scene || !scene.char) return;
    if (scene.char !== 'triad' && !characterIds.has(scene.char)) errors.push('scenes[' + index + '].char references unknown character: ' + scene.char);
    (Array.isArray(scene.character) ? scene.character : []).forEach(function (id) {
      if (!characterIds.has(id)) errors.push('scenes[' + index + '].character references unknown character: ' + id);
    });
  });
  return errors;
}

function validateSceneShards(data) {
  var errors = [];
  var scenes = data.scenes;
  if (!Array.isArray(scenes)) return errors;
  var byId = new Map(scenes.map(function (scene) { return [scene.id, scene]; }));
  var shards = ['nene', 'natsume', 'shared'].map(function (char) {
    var file = 'scenes-' + char + '.json';
    try {
      var items = readJson('data/' + file);
      if (!Array.isArray(items)) errors.push(file + ' must be an array');
      return { char: char, file: file, items: Array.isArray(items) ? items : [] };
    } catch (error) {
      errors.push(file + ' is missing or unreadable');
      return { char: char, file: file, items: [] };
    }
  });
  var seen = new Set();
  shards.forEach(function (shard) {
    shard.items.forEach(function (scene) {
      if (!scene || !scene.id) { errors.push(shard.file + ' contains an item without id'); return; }
      if (seen.has(scene.id)) { errors.push(scene.id + ' appears in multiple browser shards'); return; }
      seen.add(scene.id);
      var canonical = byId.get(scene.id);
      if (!canonical) { errors.push(shard.file + ' contains unknown scene ' + scene.id); return; }
      if (JSON.stringify(scene) !== JSON.stringify(canonical)) {
        errors.push(shard.file + ' scene ' + scene.id + ' differs from scenes.json');
      }
      var expectedChar = scene.char === 'natsume' ? 'natsume'
        : scene.char === 'triad' ? 'shared' : 'nene';
      if (expectedChar !== shard.char) {
        errors.push(scene.id + ' is placed in ' + shard.file + ' but char=' + scene.char);
      }
    });
  });
  if (seen.size !== scenes.length) {
    errors.push('browser shards cover ' + seen.size + ' scenes, expected ' + scenes.length);
  }

  try {
    var index = readJson('data/scenes-index.json');
    if (Number(index.total) !== scenes.length) errors.push('scenes-index.json total mismatch');
    var coreIds = Array.isArray(index.tiers && index.tiers.core) ? index.tiers.core : [];
    var coreFile = readJson('data/scenes-core.json');
    if (!Array.isArray(coreFile)) errors.push('scenes-core.json must be an array');
    else {
      if (coreFile.length !== coreIds.length) errors.push('scenes-core.json length differs from index tiers.core');
      coreIds.forEach(function (id, position) {
        if (!coreFile[position] || coreFile[position].id !== id || !byId.has(id)) {
          errors.push('scenes-core.json[' + position + '] does not match index tier id ' + id);
        }
      });
      if (coreFile.some(function (scene) { return !byId.has(scene.id); })) {
        errors.push('scenes-core.json references scenes outside scenes.json');
      }
    }
    var ordered = Array.isArray(index.orderedIds) ? index.orderedIds : [];
    if (ordered.length !== scenes.length) errors.push('scenes-index.json orderedIds length mismatch');
  } catch (error) {
    errors.push('scenes-index.json is missing or unreadable');
  }
  return errors;
}

function main() {
  var data = {
    characters:readJson('data/characters.json'),
    loras:readJson('data/loras.json'),
    scenes:readJson('data/scenes.json')
  };
  var errors = validateContent(data, function (relative) {
    return fs.existsSync(path.resolve(ROOT, 'data', relative));
  });
  errors = errors.concat(validateSceneShards(data));
  errors = errors.concat(checkDataVersion());
  if (errors.length) {
    console.error(errors.map(function (error) { return '  - ' + error; }).join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('Content contracts passed: ' + data.characters.length + ' characters, ' + data.loras.length + ' LoRAs, ' + data.scenes.length + ' scenes');
}

if (require.main === module) main();
module.exports = { validateContent:validateContent };
