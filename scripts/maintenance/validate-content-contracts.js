'use strict';

var fs = require('fs');
var path = require('path');
var expectedDataVersion = require('../runtime/data-version').expectedDataVersion;

var ROOT = path.resolve(__dirname, '..', '..');

/**
 * 浏览器读取 data/*.json 时带 ?v=DATA_VERSION，服务端按 immutable 缓存。
 * 这里用数据内容的稳定哈希锁定 DATA_VERSION：任何人改了 data 而忘了
 * 在 sceneStore.ts 升版本号，validate 就会失败，避免客户端吃到旧缓存。
 * 哈希口径统一收口到 scripts/runtime/data-version.js（与 build-scenes/build-popular 共用）。
 */
function contentVersion() {
  return expectedDataVersion(ROOT);
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
    // 热门角色（type=popular）无 LoRA：仅 heroine 强制 lora.name/weight。
    if (character.type !== 'popular') {
      if (!character.lora || typeof character.lora.name !== 'string') errors.push(label + '.lora.name is required');
      else characterLoras.add(character.lora.name);
      if (!(Number(character.lora && character.lora.weight) > 0 && Number(character.lora.weight) <= 2)) errors.push(label + '.lora.weight must be in (0, 2]');
    }
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

function validatePopularContent() {
  var errors = [];
  try {
    var popular = require('../../src/utils/popularContent.ts');
    var recipes = require('../../src/config/kreaStyleRecipes.ts');
    var characters = popular.parsePopularCharacters(readJson('data/popular-characters.json'));
    var blueprints = popular.parseSceneBlueprints(readJson('data/scene-blueprints.json'));
    if (characters.length < 1) errors.push('popular-characters.json must contain at least one character');
    characters.forEach(function (character) {
      var defaults = character.outfits.filter(function (outfit) { return outfit.default; });
      if (defaults.length !== 1) errors.push(character.id + ' must have exactly one default outfit');
      // 全字段污染扫描：identityProse/aliases/exactPrefixes/outfit prose+tokens 都覆盖。
      popular.scanCharacterPollution(character).forEach(function (leak) {
        errors.push('pollution: ' + leak);
      });
    });
    if (blueprints.length < 20) errors.push('scene-blueprints.json must contain at least 20 blueprints');
    var adultBlueprints = blueprints.filter(function (blueprint) { return blueprint.adult; });
    if (adultBlueprints.length < 1) errors.push('scene-blueprints.json should keep at least one adult-only blueprint gated by adultEligibility');
    var nonAdult = characters.filter(function (character) { return character.adultEligibility !== 'adult'; });
    nonAdult.forEach(function (character) {
      adultBlueprints.forEach(function (blueprint) {
        if (popular.blueprintEligible(blueprint, character, { adultEnabled: true })) {
          errors.push(character.id + ' must never reach adult blueprint ' + blueprint.id + ' (fail closed)');
        }
      });
    });
    (blueprints || []).forEach(function (blueprint) {
      var text = JSON.stringify(blueprint);
      if (popular.scanStudioTokenLeaks(text).length) {
        errors.push('blueprint ' + blueprint.id + ' must not reference nene/natsume tokens');
      }
      if (/(?:official_cg|visual_audited)/i.test(text)) {
        errors.push('blueprint ' + blueprint.id + ' must not leak retrieval metadata');
      }
      // kreaStyleHint / animaStyleHint：命中配方时，成人配方只允许挂在成人蓝图上
      // （成人蓝图对非 adult 角色 fail closed，hint 随蓝图一起被拦下）。
      ['kreaStyleHint', 'animaStyleHint'].forEach(function (key) {
        var hint = blueprint[key];
        if (typeof hint !== 'string' || !hint.trim()) return;
        var recipe = recipes.findStyleRecipe(recipes.KREA_STYLE_RECIPES, hint);
        if (recipe && recipe.adult && !blueprint.adult) {
          errors.push('blueprint ' + blueprint.id + ' ' + key + ' references adult recipe ' + recipe.id + ' but the blueprint is not adult');
        }
      });
    });
    // 配方本体契约：至少 8 个通用配方 + 独立显式的成人配方；成人配方只对 adult
    // 角色 + 成熟内容开关同时放行（unknown/underage 永远不可达）。
    var allRecipes = recipes.KREA_STYLE_RECIPES;
    var common = allRecipes.filter(function (recipe) { return !recipe.adult; });
    var adultRecipes = allRecipes.filter(function (recipe) { return recipe.adult; });
    if (common.length < 8) errors.push('kreaStyleRecipes must ship at least 8 common recipes, got ' + common.length);
    if (adultRecipes.length < 1) errors.push('kreaStyleRecipes must ship explicit adult-only recipes');
    allRecipes.forEach(function (recipe) {
      if (!recipe.lead || !recipe.lead.trim()) errors.push('kreaStyleRecipes.' + recipe.id + ' must have a lead phrase');
      if (/(?:ayachi_nene|shiki_natsume|nene_|natsume_)/i.test(recipe.lead + ' ' + (recipe.medium || ''))) {
        errors.push('kreaStyleRecipes.' + recipe.id + ' must not reference studio LoRA tokens');
      }
    });
    nonAdult.forEach(function (character) {
      adultRecipes.forEach(function (recipe) {
        if (recipes.recipeEligible(recipe, character, { adultEnabled: true })) {
          errors.push(character.id + ' must never reach adult style recipe ' + recipe.id + ' (fail closed)');
        }
      });
    });
  } catch (error) {
    errors.push('popular/scene-blueprints data failed to parse: ' + error.message);
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
    // 样张/立绘 URL 允许携带缓存版本串（如 popular-*.png?v=2），存在性检查需剥离。
    var pathOnly = String(relative).replace(/\?.*$/, '');
    return fs.existsSync(path.resolve(ROOT, 'data', pathOnly));
  });
  errors = errors.concat(validateSceneShards(data));
  errors = errors.concat(validatePopularContent());
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
