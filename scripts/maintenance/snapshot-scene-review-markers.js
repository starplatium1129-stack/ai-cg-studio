#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const AI_ROOT = path.resolve(ROOT, '..', 'AI');
const DEFAULT_REVIEW = path.join(AI_ROOT, 'Reviews', 'SceneShowcaseRefresh', '2026-08-12_current-prompts');

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function writeJsonAtomic(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function main() {
  const reviewRoot = path.resolve(argument('--review', DEFAULT_REVIEW));
  const imagesRoot = path.join(reviewRoot, 'images');
  const scenes = require(path.join(ROOT, 'data', 'scenes.json'));
  const marked = fs.readdirSync(imagesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(imagesRoot, entry.name, '不合格.txt')))
    .map(entry => entry.name)
    .sort();
  const failed = new Set(marked);
  const records = Object.fromEntries(scenes.map(scene => [scene.id, {
    verdict: failed.has(scene.id) ? 'fail' : 'unreviewed',
    source: failed.has(scene.id) ? 'user-marker' : 'pending-agent-review',
    marker: failed.has(scene.id) ? `images/${scene.id}/不合格.txt` : '',
    attempt: 1,
  }]));
  const snapshot = {
    version: 1,
    round: 1,
    capturedAt: new Date().toISOString(),
    markerName: '不合格.txt',
    rule: 'A user marker is an unconditional fail and cannot be overridden by agent review.',
    totals: { scenes: scenes.length, failed: marked.length, pendingAgentReview: scenes.length - marked.length },
    failedSceneIds: marked,
    records,
  };
  const target = path.join(reviewRoot, 'manual-review-round1.json');
  writeJsonAtomic(target, snapshot);
  console.log(JSON.stringify({ target, totals: snapshot.totals }, null, 2));
}

if (require.main === module) main();
