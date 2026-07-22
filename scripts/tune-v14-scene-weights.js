#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

function targetWeight(scene) {
  const text = `${scene.prompt || ''} ${(scene.tags || []).join(' ')}`.toLowerCase();
  if (/qipao|cheongsam|china_dress/.test(text)) return 0.95;
  return 0.9;
}

function updateFile(file) {
  const scenes = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(scenes)) return 0;
  let changed = 0;
  for (const scene of scenes) {
    if (scene.char !== 'natsume' || typeof scene.prompt !== 'string') continue;
    const weight = targetWeight(scene);
    const next = scene.prompt.replace(
      /<lora:shiki_natsume_v14:[0-9.]+>/g,
      `<lora:shiki_natsume_v14:${weight}>`,
    );
    if (next !== scene.prompt) {
      scene.prompt = next;
      changed += 1;
    }
  }
  if (WRITE && changed) fs.writeFileSync(file, `${JSON.stringify(scenes, null, 2)}\n`, 'utf8');
  return changed;
}

function main() {
  const files = [
    path.join(ROOT, 'data', 'scenes.json'),
    ...fs.readdirSync(path.join(ROOT, 'data', 'scenes'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => path.join(ROOT, 'data', 'scenes', name)),
  ];
  const result = files.map((file) => ({ file: path.relative(ROOT, file), changed: updateFile(file) }));
  console.log(JSON.stringify({ mode: WRITE ? 'write' : 'check', files: result }, null, 2));
}

main();
