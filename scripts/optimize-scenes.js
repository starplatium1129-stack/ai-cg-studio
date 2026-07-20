const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scenesPath = path.join(root, 'data', 'scenes.json');
const write = process.argv.includes('--write');
const check = process.argv.includes('--check');

const aliases = new Map(Object.entries({
  indoor: 'indoors',
  casual_wear: 'casual_clothes',
  pouting_expression: 'pout',
  panicked_expression: 'panicked',
  cool_expression: 'serious',
  subtle_smile: 'slight_smile',
  soft_ambiance: 'soft_lighting',
  cozy_atmosphere: 'cozy',
  masterpiece_composition: 'cinematic_composition',
  cloying_affection: 'in_love',
  expressive_ahoge: 'ahoge',
  heart_shaped_ahoge: 'ahoge',
  adult_women: 'adult',
  three_hands_joined: 'holding_hands',
  floating_tea_cup: 'floating_cup',
  floating_object: 'floating_objects',
  energy_particles: 'glowing_particles',
  digital_artifacts: 'glitch_effect',
  infinite_loop_visual: 'abstract_background'
}));

const remove = new Set(['heart_rate_synchronization', 'shared_vows']);
const baseNegative = [
  'worst quality', 'low quality', 'normal quality', 'lowres', 'blurry', 'jpeg artifacts',
  'text', 'watermark', 'logo', 'signature', 'bad anatomy', 'bad hands', 'extra fingers',
  'missing fingers', 'fused fingers', 'extra arms', 'extra legs', 'deformed',
  'bad proportions', 'duplicate', 'cropped', '3d render', 'photorealistic'
];

function key(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function canonical(value) {
  const normalized = key(value);
  if (!normalized || remove.has(normalized)) return '';
  return aliases.get(normalized) || normalized;
}

function dedupe(values) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = key(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function cameraTags(scene, tags) {
  const camera = String(scene.camera || '');
  const set = new Set(tags);
  if (/\u7279\u5199|close/i.test(camera) && !tags.some((tag) => /close_up|face_focus/.test(tag))) set.add('close_up');
  else if (/\u8fdc\u666f|\u5168\u8eab|wide/i.test(camera)) {
    if (!tags.some((tag) => /wide_shot/.test(tag))) set.add('wide_shot');
    if (!tags.some((tag) => /full_body/.test(tag))) set.add('full_body');
  } else if (/\u4e2d\u666f|medium/i.test(camera) && !tags.some((tag) => /medium_shot/.test(tag))) set.add('medium_shot');
  if (/\u4e3b\u89c2|pov/i.test(camera)) set.add('pov');
  return [...set];
}

function optimizePrompt(prompt) {
  return String(prompt || '')
    .replace(/\{[^}]+\}/g, '')
    .replace(/\s*(?:\bBREAK\b|_break_)\s*/gi, ', BREAK, ')
    .split(',')
    .map((token) => {
      const trimmed = token.trim();
      const leading = trimmed.match(/^[([]/)?.[0] || '';
      const trailing = trimmed.match(/[)\]]$/)?.[0] || '';
      const bare = trimmed.replace(/^[([]/, '').replace(/[)\]]$/, '');
      if (/^<lora:/i.test(bare) || /^BREAK$/i.test(bare)) return token.trim();
      const mapped = canonical(bare);
      return mapped ? leading + mapped + trailing : '';
    })
    .filter(Boolean)
    .join(', ')
    .replace(/,\s*BREAK\s*,/g, ' BREAK ')
    .replace(/,\s*,/g, ', ')
    .replace(/,\s*$/, '');
}

function optimize(scene) {
  let tags = dedupe((scene.tags || []).map(canonical).filter(Boolean));
  tags = cameraTags(scene, tags);
  if (scene.id === 'sc064') tags = tags.filter((tag) => !['looking_at_viewer', 'looking_back'].includes(tag));
  const negative = dedupe([
    ...baseNegative,
    ...String(scene.negative || '').split(',').map((item) => item.trim()),
    ...(scene.mature ? [] : ['nsfw', 'nude', 'explicit'])
  ]).join(', ');
  let prompt = optimizePrompt(scene.prompt);
  if (scene.id === 'sc064') {
    prompt = prompt.split(',').map((item) => item.trim()).filter((item) => !['looking_at_viewer', 'looking_back'].includes(key(item))).join(', ');
  }
  return { ...scene, tags, prompt, negative };
}

const scenes = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));
const optimized = scenes.map(optimize);
const issues = [];
const ids = new Set();
for (const scene of optimized) {
  if (ids.has(scene.id)) issues.push(`${scene.id}: duplicate id`);
  ids.add(scene.id);
  if (!scene.title || !scene.story || !scene.prompt || !scene.negative) issues.push(`${scene.id}: missing required content`);
  if (/\{[^}]+\}/.test(scene.prompt)) issues.push(`${scene.id}: unresolved prompt placeholder`);
  if (scene.char === 'triad' && !scene.tags.includes('2girls')) issues.push(`${scene.id}: dual scene missing 2girls`);
  if (scene.char !== 'triad' && scene.tags.includes('2girls')) issues.push(`${scene.id}: solo scene contains 2girls`);
  if (!scene.mature && !/(^|, )nsfw(,|$)/.test(scene.negative)) issues.push(`${scene.id}: safe scene lacks nsfw exclusion`);
}

const changed = optimized.reduce((count, scene, index) => count + (JSON.stringify(scene) !== JSON.stringify(scenes[index]) ? 1 : 0), 0);
console.log(`scenes=${optimized.length} changed=${changed} issues=${issues.length}`);
issues.forEach((issue) => console.error(issue));
if (write) fs.writeFileSync(scenesPath, JSON.stringify(optimized, null, 2) + '\n', 'utf8');
if (issues.length || (check && changed)) process.exitCode = 1;
