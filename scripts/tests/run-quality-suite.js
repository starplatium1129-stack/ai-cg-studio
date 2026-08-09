'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { QUALITY_TEST_SUITES } = require('./quality-test-inventory');
const root = path.resolve(__dirname, '..', '..');
const SUITE_TIMEOUT_MS = Object.freeze({
  check: 180_000,
  unit: 300_000,
  contract: 180_000,
  desktop: 300_000,
});

function applyResult(result, label) {
  if (result.error) {
    console.error(`${label} failed to start or timed out: ${result.error.message}`);
    return 1;
  }
  if (result.signal) {
    console.error(`${label} terminated by ${result.signal}`);
  }
  return result.status ?? 1;
}

const suiteName = process.argv[2];
if (!Object.hasOwn(QUALITY_TEST_SUITES, suiteName)) {
  console.error(`usage: node ${path.basename(__filename)} <check|unit|contract|desktop>`);
  process.exitCode = 2;
} else if (suiteName === 'unit') {
  const files = QUALITY_TEST_SUITES.unit.map((file) => path.join(root, 'scripts', 'tests', file));
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...files], {
    cwd: root,
    stdio: 'inherit',
    timeout: SUITE_TIMEOUT_MS.unit,
  });
  process.exitCode = applyResult(result, 'unit suite');
} else {
  for (const file of QUALITY_TEST_SUITES[suiteName]) {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'tests', file)], {
      cwd: root,
      stdio: 'inherit',
      timeout: SUITE_TIMEOUT_MS[suiteName],
    });
    const status = applyResult(result, `${suiteName}:${file}`);
    if (status !== 0) {
      process.exitCode = status;
      break;
    }
  }
}
