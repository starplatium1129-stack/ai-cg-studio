/**
 * AI CG Studio scene and character data quality gate.
 * Run with: npm run validate
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const sceneSource = path.join(dataDir, 'scenes.json');
const characterSource = path.join(dataDir, 'characters.json');
const presetSource = path.join(dataDir, 'presets.json');
const required = [
  'id', 'title', 'category', 'story', 'storyJa', 'char', 'character', 'lora', 'emotion',
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

function hasRepeatedNgram(value, size = 12) {
  const compact = String(value || '').replace(/\s+/g, '');
  const counts = new Map();
  for (let index = 0; index <= compact.length - size; index += 1) {
    const gram = compact.slice(index, index + size);
    const count = (counts.get(gram) || 0) + 1;
    if (count >= 3) return true;
    counts.set(gram, count);
  }
  return false;
}

const errors = [];
const scenes = readJson(sceneSource, 'scenes.json', errors);
const characters = readJson(characterSource, 'characters.json', errors);
const presetData = readJson(presetSource, 'presets.json', errors);
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
  if (typeof scene.storyJa === 'string' && !/[ぁ-んァ-ヶ]/.test(scene.storyJa)) {
    errors.push(label + ': storyJa must contain Japanese kana');
  }
  if (typeof scene.storyJa === 'string' && /[这们说没让还过进给为从吗边发经动觉样东门书车话气实间见听脸妈爱现开关窝败总紧头轻软应处]/.test(scene.storyJa)) {
    errors.push(label + ': storyJa contains likely untranslated Simplified Chinese');
  }
  if (typeof scene.storyJa === 'string' && typeof scene.story === 'string') {
    const sourceHasDialogue = scene.story.includes('「') && scene.story.includes('」');
    const japaneseHasDialogue = scene.storyJa.includes('「') && scene.storyJa.includes('」');
    if (sourceHasDialogue !== japaneseHasDialogue) errors.push(label + ': storyJa dialogue structure differs from story');
  }
  if (typeof scene.storyJa === 'string' && Array.isArray(scene.character)) {
    const japaneseHeader = scene.storyJa.split('】', 1)[0];
    if (scene.character.includes('nene') && !japaneseHeader.includes('寧々')) errors.push(label + ': storyJa header is missing Nene');
    if (scene.character.includes('natsume') && !japaneseHeader.includes('夏目')) errors.push(label + ': storyJa header is missing Natsume');
  }
  if (typeof scene.storyJa === 'string' && typeof scene.story === 'string' && scene.storyJa.length > Math.max(300, scene.story.length * 2.4)) {
    errors.push(label + ': storyJa is implausibly longer than story');
  }
  if (typeof scene.storyJa === 'string' && hasRepeatedNgram(scene.storyJa)) {
    errors.push(label + ': storyJa repeats the same 12-character text three times');
  }
  if (typeof scene.prompt === 'string' && scene.prompt.length < 100) {
    errors.push(label + ': prompt is too short (' + scene.prompt.length + ' < 100)');
  }
  if (typeof scene.prompt === 'string' && /_BREAK_/i.test(scene.prompt)) {
    errors.push(label + ': use standalone BREAK instead of _BREAK_');
  }
  if (scene.char !== 'triad' && typeof scene.prompt === 'string' && /\bclosed_eyes\b/.test(scene.prompt) && /\blooking_at_viewer\b/.test(scene.prompt)) {
    errors.push(label + ': conflicting gaze tags closed_eyes + looking_at_viewer');
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

const modelProfiles = presetData && Array.isArray(presetData.model_profiles) ? presetData.model_profiles : [];
const presets = presetData && Array.isArray(presetData.presets) ? presetData.presets : [];
if (!modelProfiles.length) errors.push('presets.json must define model_profiles');
if (!presets.length) errors.push('presets.json must define presets');
const profileIds = new Set();
for (const profile of modelProfiles) {
  const label = profile && profile.id ? profile.id : 'model profile';
  if (!profile || !profile.id) { errors.push('model profile missing id'); continue; }
  if (profileIds.has(profile.id)) errors.push(label + ': duplicate model profile id');
  profileIds.add(profile.id);
  if (!Array.isArray(profile.match) || !profile.match.length) errors.push(label + ': missing model match patterns');
  if (!profile.quality_prefix || !profile.negative_prefix) errors.push(label + ': missing prompt prefixes');
  if (!profile.sampler || !Number.isFinite(Number(profile.steps)) || !Number.isFinite(Number(profile.cfg))) errors.push(label + ': invalid generation defaults');
  if (!/^\d+×\d+$/.test(profile.size || '')) errors.push(label + ': invalid output size');
}
for (const requiredProfile of ['wai_illustrious_v17', 'noobai_xl_11']) {
  if (!profileIds.has(requiredProfile)) errors.push('presets.json missing model profile ' + requiredProfile);
}
const presetIds = new Set();
for (const preset of presets) {
  const label = preset && preset.id ? preset.id : 'preset';
  if (!preset || !preset.id || !preset.name) { errors.push('preset missing id or name'); continue; }
  if (presetIds.has(preset.id)) errors.push(label + ': duplicate preset id');
  presetIds.add(preset.id);
  if (!preset.sampler || !Number.isFinite(Number(preset.steps)) || !Number.isFinite(Number(preset.cfg))) errors.push(label + ': invalid generation values');
  if (!/^\d+×\d+$/.test(preset.size || '')) errors.push(label + ': invalid output size');
}

if (errors.length) {
  console.error('Scene validation failed (' + errors.length + ' issues)');
  for (const error of errors) console.error('  - ' + error);
  process.exit(1);
}

console.log('Validation passed: ' + scenes.length + ' scenes, ' + modelProfiles.length + ' model profiles, ' + presets.length + ' presets');
