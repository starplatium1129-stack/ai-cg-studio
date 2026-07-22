#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

function natsumeWeight(scene) {
  const text = `${scene.prompt || ''} ${(scene.tags || []).join(' ')}`.toLowerCase();
  return /qipao|cheongsam|china_dress/.test(text) ? 0.95 : 0.9;
}

function required(scene) {
  if (scene.char === 'nene') return [`<lora:ayachi_nene_v14:0.8>`];
  if (scene.char === 'natsume') return [`<lora:shiki_natsume_v14:${natsumeWeight(scene)}>`];
  if (scene.char === 'triad') {
    return ['<lora:ayachi_nene_v14:0.65>', '<lora:shiki_natsume_v14:0.65>'];
  }
  return [];
}

function updateFile(file) {
  const scenes = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(scenes)) return [];
  const changed = [];
  for (const scene of scenes) {
    if (typeof scene.prompt !== 'string') continue;
    const additions = required(scene).filter((tag) => {
      const name = tag.match(/^<lora:([^:]+)/)?.[1];
      return name && !scene.prompt.includes(`<lora:${name}:`);
    });
    if (!additions.length) continue;
    scene.prompt = `${scene.prompt.trim().replace(/,+$/, '')}, ${additions.join(', ')}`;
    changed.push(scene.id);
  }
  if (WRITE && changed.length) fs.writeFileSync(file, `${JSON.stringify(scenes, null, 2)}\n`, 'utf8');
  return changed;
}

function main() {
  const files = [
    path.join(ROOT, 'data', 'scenes.json'),
    ...fs.readdirSync(path.join(ROOT, 'data', 'scenes'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => path.join(ROOT, 'data', 'scenes', name)),
  ];
  const results = files.map((file) => ({ file: path.relative(ROOT, file), scenes: updateFile(file) }));
  console.log(JSON.stringify({ mode: WRITE ? 'write' : 'check', results }, null, 2));
}

main();
