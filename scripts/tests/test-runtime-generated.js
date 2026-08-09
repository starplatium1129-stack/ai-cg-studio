'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const servicesRoot = path.join(root, 'services');
const {
  auditGeneratedFileSets,
  emitRuntime,
  findByteDrift,
  getRuntimeGeneratedInventory,
  listGeneratedFiles,
  listTrackedGeneratedFiles,
} = require('../maintenance/runtime-generated-files');

test('services runtime JavaScript and declarations match TypeScript sources', () => {
  const inventory = getRuntimeGeneratedInventory(root);
  assert.ok(inventory.sourceFiles.length > 0, 'runtime tsconfig must include service sources');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-runtime-emit-'));
  try {
    emitRuntime(root, inventory, tempDir);
    const emitted = listGeneratedFiles(tempDir);
    const onDisk = listGeneratedFiles(servicesRoot);
    const tracked = listTrackedGeneratedFiles(root, servicesRoot);
    const audit = auditGeneratedFileSets(inventory.generatedFiles, onDisk, tracked);
    assert.deepEqual(audit.missing, [], 'missing runtime outputs; run npm run build:runtime');
    assert.deepEqual(audit.orphan, [], 'orphan runtime outputs; remove obsolete services .js/.d.ts');
    assert.deepEqual(audit.untracked, [], 'runtime outputs must be tracked by Git');
    assert.deepEqual(audit.expectedUntracked, [], 'expected runtime outputs must be tracked by Git');
    assert.deepEqual(audit.trackedOrphan, [], 'tracked runtime outputs must have a TypeScript source');
    assert.deepEqual(emitted, inventory.generatedFiles, 'runtime source/output set must stay one-to-one');
    assert.deepEqual(
      findByteDrift(inventory.generatedFiles, servicesRoot, tempDir),
      [],
      'runtime output is stale; run npm run build:runtime',
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
