/**
 * AI CG Studio scene and character data quality gate.
 * Run with: npm run validate
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const sceneSource = path.join(dataDir, 'scenes.json');
const characterSource = path.join(dataDir, 'characters.json');
const required = [
  'id', 'title', 'category', 'story', 'char', 'character', 'lora', 'emotion',
  'season', 'time', 'timeOfDay', 'tags', 'mature', 'location', 'weather',
  'camera', 'lighting', 'usage', 'prompt', 'negative'
];
const timeValues = new Set(['morning', 'afternoon', 'sunset', 'evening', 'night', 'late_night', 'dawn', 'all_day']);
const charValues = new Set(['nene', 'natsume', 'triad']);
const promptTrigger = { nene: 'ayachi_nene', natsume: 'shiki_natsume' };
const driftMarkers = [
  '\u4e03\u7eea', '\u3059\u3054\u3044', '\u9b45\u9b54', '\u732b\u8033', 'Devon', '\u758f\u53f2',
  '\u94f6\u8272\u53d1\u4e1d', '\u6e7f\u900f\u7684\u94f6\u8272\u957f\u53d1', '\u7c89\u8272\u957f\u53d1', '\u7c89\u53d1'
];

function readJson(source, label, errors) {
  try {
    return JSON.parse(fs.readFileSync(source, 'utf8'));
  } catch (error) {
    errors.push(label + ' cannot be parsed: ' + error.message);
    return [];
  }
}

const errors = [];
const scenes = readJson(sceneSource, 'scenes.json', errors);
const characters = readJson(characterSource, 'characters.json', errors);
const ids = new Set();

if (!Array.isArray(scenes)) errors.push('scenes.json root must be an array');

(Array.isArray(scenes) ? scenes : []).forEach((scene, index) => {
  const label = scene && scene.id ? scene.id : 'index ' + index;
  if (!scene || typeof scene !== 'object') {
    errors.push(label + ': scene must be an object');
    return;
  }

  for (const key of required) {
    const value = scene[key];
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      errors.push(label + ': missing field ' + key);
    }
  }

  if (!/^sc\d{3}$/.test(scene.id || '')) errors.push(label + ': id must match sc000');
  if (ids.has(scene.id)) errors.push(label + ': duplicate id');
  ids.add(scene.id);

  if (!charValues.has(scene.char)) errors.push(label + ': unknown char ' + scene.char);
  if (!timeValues.has(scene.timeOfDay)) errors.push(label + ': unknown timeOfDay ' + scene.timeOfDay);
  if (!Array.isArray(scene.character)) errors.push(label + ': character must be an array');
  if (!Array.isArray(scene.tags)) errors.push(label + ': tags must be an array');
  if (!Array.isArray(scene.usage)) errors.push(label + ': usage must be an array');
  if (typeof scene.mature !== 'boolean') errors.push(label + ': mature must be boolean');

  if (typeof scene.story === 'string' && scene.story.length < 80) {
    errors.push(label + ': story is too short (' + scene.story.length + ' < 80)');
  }
  if (typeof scene.prompt === 'string' && scene.prompt.length < 100) {
    errors.push(label + ': prompt is too short (' + scene.prompt.length + ' < 100)');
  }
  if (Array.isArray(scene.character) && typeof scene.prompt === 'string') {
    for (const character of scene.character) {
      const trigger = promptTrigger[character];
      if (trigger && !scene.prompt.includes(trigger)) errors.push(label + ': prompt missing ' + trigger);
    }
  }
  if (typeof scene.story === 'string') {
    for (const marker of driftMarkers) {
      if (scene.story.includes(marker)) errors.push(label + ': stale character marker ' + marker);
    }
  }

  const includesNene = scene.char === 'nene' || (Array.isArray(scene.character) && scene.character.includes('nene'));
  const adultMarked = typeof scene.story === 'string' && (scene.story.includes('\u6210\u5e74') || /adult/i.test(scene.story.slice(0, 60)));
  if (scene.mature && includesNene && !adultMarked) errors.push(label + ': mature Nene scene must be explicitly adult');
});

for (let number = 1; number <= scenes.length; number += 1) {
  const expected = 'sc' + String(number).padStart(3, '0');
  if (!ids.has(expected)) errors.push('missing continuous id ' + expected);
}

const expectedCharacters = {
  nene: ['white_hair', 'low_twintails', 'purple_eyes', 'ahoge', 'hair_ribbon'],
  natsume: ['black_hair', 'long_hair', 'yellow_eyes', 'mole_under_eye', 'hairclip']
};
for (const [id, traits] of Object.entries(expectedCharacters)) {
  const character = Array.isArray(characters) ? characters.find((item) => item.id === id) : null;
  if (!character) {
    errors.push('characters.json missing ' + id);
    continue;
  }
  const actual = new Set((character.traits || []).map((trait) => trait.tag));
  for (const trait of traits) if (!actual.has(trait)) errors.push(id + ': missing visual trait ' + trait);
  if (!character.lora || !character.lora.name) errors.push(id + ': missing LoRA binding');

  const recommendations = character.lora && character.lora.recommended_scene;
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    errors.push(id + ': missing recommended scenes');
    continue;
  }
  for (const sceneId of recommendations) {
    const scene = scenes.find((item) => item.id === sceneId);
    if (!scene) {
      errors.push(id + ': recommended scene does not exist: ' + sceneId);
      continue;
    }
    const sceneCharacters = Array.isArray(scene.character) ? scene.character : [];
    if (scene.char !== id && !sceneCharacters.includes(id)) {
      errors.push(id + ': recommended scene belongs to another character: ' + sceneId);
    }
  }
}

if (errors.length) {
  console.error('Scene validation failed (' + errors.length + ' issues)');
  for (const error of errors) console.error('  - ' + error);
  process.exit(1);
}

console.log('Scene validation passed: ' + scenes.length + ' scenes, continuous IDs, complete fields and quality rules');
