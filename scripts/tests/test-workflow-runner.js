'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { main, plan, audit, invocation } = require('../lib/workflow-runner');
const { WORKFLOWS } = require('../workflow');
const { classifyFiles, main: gate } = require('../maintenance/gate-quick');
const root = path.resolve(__dirname, '../..');

test('every registered help is side-effect free; plans never spawn', () => {
  const never = () => { throw new Error('unexpected child execution'); };
  for (const name of Object.keys(WORKFLOWS)) assert.equal(main([name, '--help'], WORKFLOWS, root, never), 0);
  assert.equal(main(['data:build', '--plan'], WORKFLOWS, root, never), 0);
});
test('registry references and graph are valid', () => {
  assert.deepEqual(audit(WORKFLOWS, root).errors, []);
  assert.equal(audit({ a: { steps: ['a'] } }, root).ok, false);
});
test('composites stop after failure and preserve child errors', () => {
  const registry = { a: { cmd: ['node', 'a.js'] }, b: { cmd: ['node', 'b.js'] }, all: { steps: ['a', 'b'] } };
  let calls = 0;
  assert.equal(main(['all'], registry, root, () => { calls++; return { status: 7 }; }), 7);
  assert.equal(calls, 1);
  assert.equal(main(['a'], registry, root, () => ({ error: new Error('ENOENT'), status: null })), 1);
  assert.throws(() => plan('all', ['--keys', 'x'], registry));
});
test('showcase uses one candidate directory across stages and previews publication', () => {
  const steps = plan('showcase:full', ['--output', 'review folder', '--source', 'old', '--target', 'new'], WORKFLOWS);
  assert.ok(steps[1].args.includes(path.join('review folder', 'generation-manifest.json')));
  assert.ok(steps[2].args.includes(path.join('review folder', 'generation-manifest.json')));
  assert.ok(!steps[2].args.includes('--apply'));
  assert.throws(() => plan('showcase:full', [], WORKFLOWS));
});
test('npm argument forwarding preserves spaces and metacharacters', () => {
  const [cmd, args] = invocation({ cmd: ['npm', 'run', 'character:onboard'] }, ['--character', 'a & b']);
  assert.equal(cmd, process.execPath);
  assert.deepEqual(args.slice(-3), ['--', '--character', 'a & b']);
});
test('quick gate covers root server, dependencies, scripts and rejects typos', () => {
  assert.deepEqual(classifyFiles(['server.js']), ['server']);
  for (const file of ['package-lock.json', 'scripts/workflow.js', '.github/workflows/quality.yml', 'vite.config.ts']) assert.deepEqual(classifyFiles([file]), ['full']);
  assert.deepEqual(classifyFiles(['docs/workflow.md']), []);
  assert.deepEqual(classifyFiles(['src/中文.vue', 'data/a.json']), ['ui', 'data']);
  assert.equal(gate(['servre']), 2);
});
test('desktop batch preserves failure without deploying or waiting for input', { skip: process.platform !== 'win32' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-workflow-'));
  const file = path.join(dir, 'deploy.bat');
  try {
    const source = fs.readFileSync(path.join(root, 'deploy-desktop.bat'), 'utf8');
    // Replace the sole deployment invocation with a controlled failure in an isolated copy.
    assert.equal(source.split(/\r?\n/).filter(line => line.startsWith('powershell ')).length, 1);
    fs.writeFileSync(file, source.replace(/^powershell .*$/m, 'cmd /c exit 7'));
    const result = spawnSync('cmd.exe', ['/d', '/c', file], {
      encoding: 'utf8', timeout: 5000, windowsHide: true,
      env: { ...process.env, AICS_WORKFLOW_NONINTERACTIVE: '1' },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 7);
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});
