'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const sceneDir = path.join(root, 'data', 'scenes');
const write = process.argv.includes('--write');
const models = {
  nene: process.env.NENE_LORA || 'ayachi_nene_v18_wd14',
  natsume: process.env.NATSUME_LORA || 'shiki_natsume_v18_wd14',
};
const supports = {
  nene: /ayachi_nene_v(?:18|19|[2-9]\d)/i.test(models.nene),
  natsume: /shiki_natsume_v(?:17|18|19|[2-9]\d)/i.test(models.natsume),
};

function ratingOf(scene) {
  if (String(scene.rating || '').toUpperCase() === 'R18' || scene.mature) return 'R18';
  return String(scene.rating || '').toUpperCase() || 'ALL';
}

function hasCharacter(scene, key) {
  const value = String(scene.char || '').toLowerCase();
  return value === key || value === 'triad' || value === 'both';
}

function appendIdentityControl(prompt, identity, control) {
  if (!prompt || new RegExp(`\\b${control}\\b`, 'i').test(prompt)) return prompt;
  const identityPattern = new RegExp(`\\b${identity}\\b(?!_)`, 'i');
  if (identityPattern.test(prompt)) return prompt.replace(identityPattern, match => `${match}, ${control}`);
  return `${control}, ${prompt}`;
}

function migrateLoraText(value) {
  let result = String(value || '')
    .replace(/ayachi_nene_v\d+(?:_[a-z0-9]+)*/gi, models.nene)
    .replace(/shiki_natsume_v\d+(?:_[a-z0-9]+)*/gi, models.natsume);
  if (/shiki_natsume_v18/i.test(models.natsume)) {
    result = result.replace(
      new RegExp(`(${models.natsume.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:)(0\\.52|0\\.85|0\\.9|0\\.90|0\\.95)\\b`, 'gi'),
      (_match, prefix, oldWeight) => `${prefix}${oldWeight === '0.52' ? '0.42' : '0.65'}`,
    );
  }
  return result;
}

function migrateScene(scene) {
  const next = { ...scene };
  next.lora = migrateLoraText(next.lora);
  let prompt = migrateLoraText(String(next.prompt || ''));
  const normalized = prompt.toLowerCase().replace(/[ -]+/g, '_');
  const r18 = ratingOf(next) === 'R18';

  if (hasCharacter(next, 'nene') && supports.nene) {
    if (r18) prompt = appendIdentityControl(prompt, 'ayachi_nene', 'nene_r18');
    if (/(?:nene_witch_canonical|official(?:_ayachi_nene)?_witch|witch_costume)/.test(normalized)) {
      prompt = appendIdentityControl(prompt, 'ayachi_nene', 'nene_witch_canonical');
    } else if (
      /(?:nene_school_uniform|navy_school_uniform|complete_navy_school_uniform)/.test(normalized)
      || (/(?:school_uniform|navy_blazer)/.test(normalized) && !/(?:magenta|red_cardigan)/.test(normalized))
    ) {
      prompt = appendIdentityControl(prompt, 'ayachi_nene', 'nene_school_uniform');
    }
  }

  if (hasCharacter(next, 'natsume') && supports.natsume) {
    if (r18) prompt = appendIdentityControl(prompt, 'shiki_natsume', 'natsume_r18');
    if (/(?:natsume_official_qipao|qipao|cheongsam|china_dress)/.test(normalized)) {
      prompt = appendIdentityControl(prompt, 'shiki_natsume', 'natsume_official_qipao');
    }
  }
  next.prompt = prompt;
  return next;
}

const manifest = JSON.parse(fs.readFileSync(path.join(sceneDir, 'manifest.json'), 'utf8'));
const files = manifest.files.map(entry => path.join(sceneDir, typeof entry === 'string' ? entry : entry.file));
let changedFiles = 0;
let changedScenes = 0;
const controls = { neneR18: 0, natsumeR18: 0, neneWitch: 0, neneSchool: 0, natsumeQipao: 0 };
const violations = [];

for (const file of files) {
  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(before) ? before : before.scenes;
  if (!Array.isArray(list)) throw new Error(`${file} does not contain a scene array`);
  const migrated = list.map(scene => {
    const next = migrateScene(scene);
    if (JSON.stringify(next) !== JSON.stringify(scene)) changedScenes += 1;
    const prompt = String(next.prompt || '');
    const r18 = ratingOf(next) === 'R18';
    const has = token => new RegExp(`\\b${token}\\b`, 'i').test(prompt);
    if (has('nene_r18')) controls.neneR18 += 1;
    if (has('natsume_r18')) controls.natsumeR18 += 1;
    if (has('nene_witch_canonical')) controls.neneWitch += 1;
    if (has('nene_school_uniform')) controls.neneSchool += 1;
    if (has('natsume_official_qipao')) controls.natsumeQipao += 1;
    if (hasCharacter(next, 'nene') && supports.nene && has('nene_r18') !== r18) violations.push(`${next.id}: nene_r18 rating mismatch`);
    if (hasCharacter(next, 'natsume') && supports.natsume && has('natsume_r18') !== r18) violations.push(`${next.id}: natsume_r18 rating mismatch`);
    if (supports.nene && /ayachi_nene_v15/i.test(`${next.lora} ${prompt}`)) violations.push(`${next.id}: stale Nene v15 model`);
    if (supports.natsume && /shiki_natsume_v15/i.test(`${next.lora} ${prompt}`)) violations.push(`${next.id}: stale Natsume v15 model`);
    return next;
  });
  const after = Array.isArray(before) ? migrated : { ...before, scenes: migrated };
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    changedFiles += 1;
    if (write) fs.writeFileSync(file, `${JSON.stringify(after, null, 2)}\n`, 'utf8');
  }
}

console.log(JSON.stringify({ write, changedFiles, changedScenes, models, supports, controls, violations }));
if (violations.length) process.exitCode = 2;
if (!write && changedFiles) process.exitCode = 1;
