'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { test } = require('node:test');

test("E2E CI split tests passed: critical PR paths and nightly visual matrix stay separated", () => {
const root = path.resolve(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const quality = fs.readFileSync(path.join(root, '.github', 'workflows', 'quality.yml'), 'utf8');
const nightly = fs.readFileSync(path.join(root, '.github', 'workflows', 'nightly-e2e.yml'), 'utf8');

const critical = pkg.scripts['test:e2e:critical:run'];
const nightlyRun = pkg.scripts['test:e2e:nightly:run'];

assert.strictEqual(pkg.scripts['test:e2e'], 'npm run build && npm run test:e2e:all');
assert.match(pkg.scripts['test:e2e:all'], /^playwright test$/);
assert.match(pkg.scripts['test:e2e:critical'], /npm run build && npm run test:e2e:critical:run/);
assert.match(pkg.scripts['test:e2e:nightly'], /npm run build && npm run test:e2e:nightly:run/);

for (const spec of ['studio.spec.ts', 'flows.spec.ts', 'a11y-device.spec.ts']) {
  assert(critical.includes(spec), `critical browser regression must include ${spec}`);
}
assert(!/capture\.spec\.ts|theme-audit\.spec\.ts/.test(critical),
  'visual audit specs must not make PR browser regression slower');

for (const spec of ['theme-audit.spec.ts', 'capture.spec.ts']) {
  assert(nightlyRun.includes(spec), `nightly visual regression must include ${spec}`);
}
assert(!/studio\.spec\.ts|flows\.spec\.ts|a11y-device\.spec\.ts/.test(nightlyRun),
  'nightly visual regression should not duplicate the PR critical suite');

assert.match(quality, /pull_request:/);
assert.match(quality, /npm run test:e2e:critical:run/);
assert(!/npm run test:e2e\s*$/.test(quality), 'PR workflow must not run the full E2E suite');

assert.match(nightly, /schedule:/);
assert.match(nightly, /cron: '0 18 \* \* \*'/);
assert.match(nightly, /workflow_dispatch:/);
assert.match(nightly, /npm run test:e2e:nightly:run/);
assert.match(nightly, /Upload visual review screenshots/);

});
