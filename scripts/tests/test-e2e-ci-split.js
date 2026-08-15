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
const native = fs.readFileSync(path.join(root, '.github', 'workflows', 'windows-native.yml'), 'utf8');

const critical = pkg.scripts['test:e2e:critical:run'];
const nightlyRun = pkg.scripts['test:e2e:nightly:run'];
const specNames = function (command) {
  return [...command.matchAll(/tests\/e2e\/([^\s]+\.spec\.ts)/g)].map(function (match) { return match[1]; }).sort();
};

assert.strictEqual(pkg.scripts['test:e2e'], 'npm run build && npm run test:e2e:all');
assert.match(pkg.scripts['test:e2e:all'], /^playwright test$/);
assert.match(pkg.scripts['test:e2e:critical'], /npm run build && npm run test:e2e:critical:run/);
assert.match(pkg.scripts['test:e2e:nightly'], /npm run build && npm run test:e2e:nightly:run/);

for (const spec of ['studio.spec.ts', 'flows.spec.ts', 'a11y-device.spec.ts']) {
  assert(critical.includes(spec), `critical browser regression must include ${spec}`);
}
assert.deepStrictEqual(specNames(critical), ['a11y-device.spec.ts', 'flows.spec.ts', 'studio.spec.ts']);
assert(!/capture\.spec\.ts|theme-audit\.spec\.ts/.test(critical),
  'visual audit specs must not make PR browser regression slower');

for (const spec of ['theme-audit.spec.ts', 'capture.spec.ts']) {
  assert(nightlyRun.includes(spec), `nightly visual regression must include ${spec}`);
}
assert.deepStrictEqual(specNames(nightlyRun), ['capture.spec.ts', 'theme-audit.spec.ts']);
assert(!/studio\.spec\.ts|flows\.spec\.ts|a11y-device\.spec\.ts/.test(nightlyRun),
  'nightly visual regression should not duplicate the PR critical suite');

assert.match(quality, /pull_request:/);
assert.match(quality, /npm run test:e2e:critical:run/);
assert(!/npm run test:e2e\s*$/.test(quality), 'PR workflow must not run the full E2E suite');
assert.doesNotMatch(quality, /windows-latest/, 'Windows desktop gates live in windows-native.yml');
assert.doesNotMatch(quality, /npm run test:live2d-native/);
assert.doesNotMatch(quality, /npm run test:live\b|regress-anima|ComfyUI/i);

assert.match(nightly, /schedule:/);
assert.match(nightly, /cron: '0 18 \* \* \*'/);
assert.match(nightly, /workflow_dispatch:/);
assert.match(nightly, /npm run test:e2e:nightly:run/);
assert.match(nightly, /Upload visual review screenshots/);

assert.match(native, /self-hosted, Windows, X64, live2d-cubism/);
assert.match(native, /LIVE2D_CUBISM_SDK_DIR/);
assert.match(native, /npm run build:tauri/);
assert.match(native, /npm run test:live2d-native:release/);
assert.match(native, /run-live2d-renderer-soak\.js --seconds 300 --switch-every 60/);
assert.doesNotMatch(native, /pull_request:/);

});
