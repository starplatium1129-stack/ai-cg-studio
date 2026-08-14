#!/usr/bin/env node
'use strict';

/**
 * Build manual-review.json from a reviewer decisions file.
 *
 * decisions.json shape (only keys that differ from 'pass' need to appear):
 *   { "scene:sc001": { verdict: 'fail', notes: '...' }, ... }
 *
 * Any succeeded key without a decision defaults to pass with the latest
 * succeeded recordId. Missing succeeded keys are reported; the publish gate
 * still enforces full coverage, this tool only builds the file.
 *
 * Usage:
 *   node scripts/maintenance/build-scene-manual-review.js \
 *       [--manifest <generation-manifest.json>] [--decisions <decisions.json>] \
 *       [--out manual-review.json] [--latest-attempt]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_DIR = path.join(
  path.resolve(ROOT, '..', 'AI'),
  'Reviews',
  'SceneShowcaseRefresh',
  '2026-08-14_v16-anima11-rella',
);

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main() {
  const manifestPath = path.resolve(argument('--manifest', path.join(DEFAULT_DIR, 'generation-manifest.json')));
  const decisionsPath = path.resolve(argument('--decisions', path.join(DEFAULT_DIR, 'decisions.json')));
  const outPath = path.resolve(argument('--out', path.join(path.dirname(manifestPath), 'manual-review.json')));
  const latestOnly = process.argv.includes('--latest-attempt');

  const records = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const succeeded = records.filter(record => record.status === 'succeeded');
  let selected = succeeded;
  if (latestOnly) {
    const best = new Map();
    for (const record of succeeded) {
      const previous = best.get(record.key);
      if (!previous || record.attempt > previous.attempt) best.set(record.key, record);
    }
    selected = [...best.values()];
  }
  const byKey = new Map(selected.map(record => [record.key, record]));

  let decisions = {};
  if (fs.existsSync(decisionsPath)) {
    decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));
  }
  const reviewedAt = new Date().toISOString();
  const recordsOut = {};
  for (const [key, record] of byKey) {
    const decision = decisions[key] || { verdict: 'pass' };
    if (decision.verdict !== 'pass' && decision.verdict !== 'fail') {
      throw new Error(`invalid decision for ${key}: ${JSON.stringify(decision)}`);
    }
    recordsOut[key] = {
      verdict: decision.verdict,
      recordId: record.recordId,
      notes: decision.notes || '',
      reviewedAt,
    };
  }
  const output = { version: 1, reviewedAt, records: recordsOut };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const temporary = `${outPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, outPath);
  const counts = { pass: 0, fail: 0 };
  for (const entry of Object.values(recordsOut)) counts[entry.verdict] += 1;
  console.log(JSON.stringify({ out: outPath, reviewed: Object.keys(recordsOut).length, counts }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { main };
