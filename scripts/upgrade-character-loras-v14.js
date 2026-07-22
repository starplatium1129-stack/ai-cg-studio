#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const REPLACEMENTS = new Map([
  ['ayachi_nene_v11', 'ayachi_nene_v14'],
  ['ayachi_nene_v12', 'ayachi_nene_v14'],
  ['ayachi_nene_v13', 'ayachi_nene_v14'],
  ['shiki_natsume_v11', 'shiki_natsume_v14'],
  ['shiki_natsume_v12', 'shiki_natsume_v14'],
  ['shiki_natsume_v13', 'shiki_natsume_v14'],
]);

function replaceModels(text) {
  let result = text;
  for (const [from, to] of REPLACEMENTS) result = result.split(from).join(to);
  return result;
}

function updateTextFile(file) {
  const before = fs.readFileSync(file, 'utf8');
  const after = replaceModels(before);
  if (WRITE && after !== before) fs.writeFileSync(file, after, 'utf8');
  return before !== after;
}

function updateJsonFile(file) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  const after = JSON.parse(replaceModels(JSON.stringify(value)));
  if (WRITE) fs.writeFileSync(file, `${JSON.stringify(after, null, 2)}\n`, 'utf8');
  return after;
}

function main() {
  const changed = [];
  const sceneFiles = [
    path.join(ROOT, 'data', 'scenes.json'),
    ...fs.readdirSync(path.join(ROOT, 'data', 'scenes'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => path.join(ROOT, 'data', 'scenes', name)),
  ];
  for (const file of sceneFiles) {
    const before = fs.readFileSync(file, 'utf8');
    const after = replaceModels(before);
    if (before !== after) {
      changed.push(path.relative(ROOT, file));
      if (WRITE) fs.writeFileSync(file, after, 'utf8');
    }
  }

  const charactersFile = path.join(ROOT, 'data', 'characters.json');
  const characters = updateJsonFile(charactersFile);
  for (const character of characters) {
    if (character.id === 'nene') character.lora.weight = 0.8;
    if (character.id === 'natsume') character.lora.weight = 0.9;
  }
  if (WRITE) fs.writeFileSync(charactersFile, `${JSON.stringify(characters, null, 2)}\n`, 'utf8');
  changed.push(path.relative(ROOT, charactersFile));

  const lorasFile = path.join(ROOT, 'data', 'loras.json');
  const loras = updateJsonFile(lorasFile);
  for (const lora of loras) {
    const nene = lora.character === 'NENE_001';
    const natsume = lora.character === 'NAT_001';
    if (!nene && !natsume) continue;
    lora.id = nene ? 'L_NENE_V14' : 'L_NAT_V14';
    lora.version = '1.4.0';
    lora.strength.default = nene ? 0.8 : 0.9;
    lora.description = nene
      ? '绫地宁宁角色 LoRA v14 精选版。严格盲测后保留身份还原最稳定的 e15 权重，避免后续精修损伤脸型；默认优先保证官方脸、紫瞳、低双马尾与粉色发带。'
      : '四季夏目角色 LoRA v14。使用官方 CG 人脸锚点低学习率精修，盲测胜出的 e9 检查点显著改善脸型、金瞳、泪痣、发夹与旗袍还原。';
    lora.dataset = nene
      ? { images: 64, official_face_anchors: 6, resolution: 1024, strategy: 'identity-first checkpoint selection' }
      : { images: 16, official_face_anchors: 5, official_outfits: 3, resolution: 1024, strategy: 'official-only low-LR identity refinement' };
    lora.training = nene
      ? { selected_checkpoint: 'v13 epoch 15', rank: 32, alpha: 32, selection_reason: 'later checkpoints reduced face fidelity' }
      : { selected_checkpoint: 'v14 epoch 9', rank: 32, alpha: 32, unet_learning_rate: 0.000005, text_encoder: 'frozen' };
    lora.recommended_weight = nene
      ? { portrait: 0.8, fullbody: 0.78, complex_scene: 0.75 }
      : { portrait: 0.95, fullbody: 0.9, complex_scene: 0.85 };
    lora.validation = {
      method: 'same-seed blinded A/B against official references; face and signature accessories weighted first',
      baseline: nene ? 'ayachi_nene_v11' : 'shiki_natsume_v13_e15',
      selected_checkpoint: nene ? 'epoch 15 identity winner' : 'v14 epoch 9 identity winner',
      face_score: nene ? 8.625 : 8.542,
    };
  }
  if (WRITE) fs.writeFileSync(lorasFile, `${JSON.stringify(loras, null, 2)}\n`, 'utf8');
  changed.push(path.relative(ROOT, lorasFile));

  const textDefaults = [
    'docs/scene-spec.html', 'docs/prompt-spec.html', 'docs/art-direction.html',
    'tools/scene-manager.html', 'tools/scenario.html',
    'scripts/classify-scene-ratings.js', 'scripts/refine-scenes.js',
  ];
  for (const relative of textDefaults) {
    if (updateTextFile(path.join(ROOT, relative))) changed.push(relative);
  }
  console.log(JSON.stringify({ mode: WRITE ? 'write' : 'check', changed: [...new Set(changed)] }, null, 2));
}

main();
