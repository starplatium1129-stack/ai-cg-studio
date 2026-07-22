#!/usr/bin/env node

/** Use the stable opening beat of sc096: Nene is caught beside the open fridge. */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const shardDir = path.join(ROOT, 'data', 'scenes');
const files = [path.join(ROOT, 'data', 'scenes.json'), ...fs.readdirSync(shardDir)
  .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
  .map((name) => path.join(shardDir, name))];

let found = 0;
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) continue;
  const scene = data.find((item) => item.id === 'sc096');
  if (!scene) continue;
  found += 1;
  scene.prompt = '1girl, solo, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, pink hair ribbons, solid plain pastel blue oversized t-shirt, (caught sneaking ice cream at midnight:1.65), standing beside an open refrigerator, (one small glass ice cream sundae and one spoon on kitchen counter:1.7), startled guilty smile, protective hand near the sundae, refrigerator light illuminating her face, cozy dark kitchen, medium shot, <lora:ayachi_nene_v14:0.8>';
  scene.negative = `${scene.negative}, giant container, bucket, cooking pot, large bowl, oversized food, ice cream cone, extra sundae, multiple desserts, text, logo, shirt print`;
  scene.auditRevision = 'round7-2026-07-22';
  if (WRITE) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`${WRITE ? 'updated' : 'would update'} ${path.relative(ROOT, file)}`);
}
console.log(`sc096 copies located: ${found}`);
if (found !== 2) process.exitCode = 1;
