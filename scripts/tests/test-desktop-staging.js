'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const {
  acquireDesktopBuildLock,
  desktopBuildLockPath,
  withDesktopBuildLock,
} = require('../maintenance/desktop-build-lock');
const { resolveNpmInvocation, stageResources } = require('../maintenance/desktop-stage-resources');
const { runTauri } = require('../maintenance/run-tauri');

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-stage-fixture-'));
  const dirs = ['server', 'routes', 'scripts/lib', 'data', 'dist', 'assets', 'tools'];
  dirs.forEach((directory) => fs.mkdirSync(path.join(root, directory), { recursive: true }));
  write(path.join(root, 'server.js'), 'module.exports = {}\n');
  write(path.join(root, 'server', 'config.js'), 'module.exports = {}\n');
  write(path.join(root, 'routes', 'health.js'), 'module.exports = {}\n');
  write(path.join(root, 'scripts/lib', 'runtime.js'), 'runtime\n');
  write(path.join(root, 'data', 'data.json'), '{}\n');
  write(path.join(root, 'dist', 'index.html'), '<!doctype html>\n');
  write(path.join(root, 'assets', 'asset.txt'), 'asset\n');
  write(path.join(root, 'tools', 'tool.txt'), 'tool\n');
  write(path.join(root, 'services', 'fixture.ts'), 'export const fixture = 1;\n');
  write(path.join(root, 'services', 'fixture.js'), '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.fixture = void 0;\nexports.fixture = 1;\n');
  write(path.join(root, 'services', 'fixture.d.ts'), 'export declare const fixture = 1;\n');
  write(path.join(root, 'services', 'orphan.js'), 'orphan\n');
  write(path.join(root, 'tsconfig.runtime.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'CommonJS', declaration: true, rootDir: 'services', outDir: 'services' },
    include: ['services/**/*.ts'],
    exclude: ['services/**/*.js', 'services/**/*.d.ts'],
  }, null, 2) + '\n');
  write(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }) + '\n');
  write(path.join(root, 'package-lock.json'), JSON.stringify({
    name: 'fixture', version: '1.0.0', lockfileVersion: 3, requires: true,
    packages: {
      '': { name: 'fixture', version: '1.0.0' },
      'node_modules/compression': { version: '1.0.0' },
      'node_modules/express': { version: '1.0.0' },
      'node_modules/http-proxy-middleware': { version: '1.0.0' },
      'node_modules/onnxruntime-node': { version: '1.0.0' },
      'node_modules/sharp': { version: '1.0.0' },
    },
  }, null, 2) + '\n');
  return root;
}

function remove(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test('npm invocation works without shelling through npm.cmd', () => {
  const npm = resolveNpmInvocation();
  const result = spawnSync(npm.command, [...npm.args, '--version'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || 'npm --version failed');
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test('production stage uses exact runtime outputs and atomic replacement', () => {
  const root = createFixture();
  const stage = path.join(root, 'desktop-tauri', 'src-tauri', 'resources');
  try {
    fs.mkdirSync(stage, { recursive: true });
    write(path.join(stage, 'stale.txt'), 'stale\n');
    let installCalls = 0;
    const result = stageResources({
      root,
      stage,
      logger: () => {},
      installDependencies: (gatewayDir) => {
        installCalls += 1;
        write(path.join(gatewayDir, 'node_modules', '.installed'), 'yes\n');
      },
    });

    assert.equal(installCalls, 1);
    assert.deepEqual(result.runtimeJavaScriptFiles, ['fixture.js']);
    assert.equal(fs.existsSync(path.join(stage, 'gateway', 'services', 'fixture.js')), true);
    assert.equal(fs.existsSync(path.join(stage, 'gateway', 'services', 'fixture.ts')), false);
    assert.equal(fs.existsSync(path.join(stage, 'gateway', 'services', 'fixture.d.ts')), false);
    assert.equal(fs.existsSync(path.join(stage, 'gateway', 'services', 'orphan.js')), false);
    assert.equal(fs.existsSync(path.join(stage, 'stale.txt')), false);

    const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'gateway', 'package.json'), 'utf8'));
    assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
      'compression', 'express', 'http-proxy-middleware', 'onnxruntime-node', 'sharp',
    ]);
  } finally {
    remove(root);
  }
});

test('failed npm ci leaves the previous complete stage untouched', () => {
  const root = createFixture();
  const stage = path.join(root, 'resources');
  try {
    write(path.join(stage, 'old', 'marker.txt'), 'old\n');
    assert.throws(() => stageResources({
      root,
      stage,
      logger: () => {},
      installDependencies: () => { throw new Error('npm ci failed'); },
    }), /npm ci failed/);
    assert.equal(fs.readFileSync(path.join(stage, 'old', 'marker.txt'), 'utf8'), 'old\n');
    assert.equal(fs.existsSync(path.join(stage, 'gateway')), false);
  } finally {
    remove(root);
  }
});

test('workspace lock serializes concurrent build critical sections', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-lock-fixture-'));
  const lockRoot = path.join(root, 'locks');
  let active = 0;
  let maximum = 0;
  try {
    await Promise.all([1, 2].map(() => withDesktopBuildLock({
      workspaceRoot: root,
      lockRoot,
      pollMs: 5,
      waitTimeoutMs: 1000,
    }, async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 25));
      active -= 1;
    })));
    assert.equal(maximum, 1);
  } finally {
    remove(root);
  }
});

test('workspace lock never steals an old lock from a live owner', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-lock-live-owner-'));
  const lockRoot = path.join(root, 'locks');
  const lockPath = desktopBuildLockPath(root, lockRoot);
  try {
    fs.mkdirSync(lockPath, { recursive: true });
    write(path.join(lockPath, 'owner.json'), JSON.stringify({
      token: 'live-owner',
      pid: process.pid,
      hostname: os.hostname(),
      workspace: root,
    }) + '\n');
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lockPath, old, old);
    await assert.rejects(
      acquireDesktopBuildLock({
        workspaceRoot: root,
        lockRoot,
        pollMs: 5,
        waitTimeoutMs: 30,
        staleMs: 1,
      }),
      /desktop build lock timeout/,
    );
  } finally {
    remove(root);
  }
});

test('runTauri holds the lock across build, verification, preparation and CLI', async () => {
  const events = [];
  await runTauri(['build', '--no-bundle'], {
    root: 'fixture-root',
    npmCommand: 'npm',
    withLock: async (options, callback) => {
      events.push('lock');
      const result = await callback();
      events.push('unlock');
      return result;
    },
    runCommand: (command, args) => {
      events.push(`${command}:${args.join(' ')}`);
      return 0;
    },
    prepareTauri: async () => { events.push('prepare'); },
    tauriCli: 'tauri-cli.js',
    spawnTauri: (command, args) => {
      events.push(`${command}:${args.join(' ')}`);
      return 0;
    },
  });
  assert.deepEqual(events, [
    'lock',
    'npm:run build',
    'npm:run test:services-generated',
    'prepare',
    `${process.execPath}:tauri-cli.js build --no-bundle`,
    'unlock',
  ]);
});
