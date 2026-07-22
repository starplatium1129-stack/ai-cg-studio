#!/usr/bin/env node

/** Final single-scene correction: keep the ice-cream prop human-sized and readable. */

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
  scene.prompt = '1girl, solo, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, pink hair ribbons, solid plain pastel blue oversized t-shirt, midnight kitchen, (small blank paper ice cream pint held under her left arm:1.75), human-sized single-serving container, (one clean spoon extended directly toward the viewer in her right hand:1.85), offering the viewer a bite, shy conspiratorial smile, open refrigerator light, medium close-up, <lora:ayachi_nene_v14:0.8>';
  scene.negative = `${scene.negative}, giant container, metal bucket, cooking pot, large bowl, oversized food, spoon in mouth, empty hand, hidden spoon, text on container, logo on container`;
  scene.auditRevision = 'round6-2026-07-22';
  if (WRITE) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`${WRITE ? 'updated' : 'would update'} ${path.relative(ROOT, file)}`);
}
console.log(`sc096 copies located: ${found}`);
if (found !== 2) process.exitCode = 1;
