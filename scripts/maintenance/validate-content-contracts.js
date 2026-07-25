'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');

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

function main() {
  var data = {
    characters:readJson('data/characters.json'),
    loras:readJson('data/loras.json'),
    scenes:readJson('data/scenes.json')
  };
  var errors = validateContent(data, function (relative) {
    return fs.existsSync(path.resolve(ROOT, 'data', relative));
  });
  if (errors.length) {
    console.error(errors.map(function (error) { return '  - ' + error; }).join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('Content contracts passed: ' + data.characters.length + ' characters, ' + data.loras.length + ' LoRAs, ' + data.scenes.length + ' scenes');
}

if (require.main === module) main();
module.exports = { validateContent:validateContent };
