'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

test('desktop shell contracts and pure helpers', async () => {
  const mainSource = fs.readFileSync(path.join(root, 'desktop', 'main.ts'), 'utf8');
   const preloadSource = fs.readFileSync(path.join(root, 'desktop', 'preload.ts'), 'utf8');
  const companionSource = fs.readFileSync(path.join(root, 'src', 'views', 'CompanionView.vue'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(mainSource, /requestSingleInstanceLock/);
  assert.match(mainSource, /transparent:\s*true/);
  assert.match(mainSource, /frame:\s*false/);
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /utilityProcess\.fork/);
  assert.match(mainSource, /setAppUserModelId\('com\.aics\.studio'\)/);
  assert.match(mainSource, /display-metrics-changed/);
  assert.match(mainSource, /render-process-gone/);
   assert.match(mainSource, /setIgnoreMouseEvents/);
   assert.match(mainSource, /setLoginItemSettings/);
   assert.match(mainSource, /globalShortcut\.register/);
   assert.match(mainSource, /new Notification/);
   assert.match(mainSource, /showOpenDialog/);
   assert.match(preloadSource, /contextBridge\.exposeInMainWorld/);
   assert.match(preloadSource, /webUtils\.getPathForFile/);
   assert.match(preloadSource, /offFileDrop/);
   assert.match(preloadSource, /offResume/);
  assert.doesNotMatch(preloadSource, /remote|webFrame|process\.env/);
  assert.match(companionSource, /window\.companionDesktop/);
  assert.ok(packageJson.build.asarUnpack.includes('server.js'));
  assert.ok(packageJson.build.asarUnpack.includes('services/**/*'));
  assert.doesNotMatch(companionSource, /from ['"]electron['"]/);

  const supervisorModule = require(path.join(root, 'desktop-dist', 'gatewaySupervisor.js'));
  const windowState = require(path.join(root, 'desktop-dist', 'windowState.js'));
  const desktopPaths = require(path.join(root, 'desktop-dist', 'paths.js'));

  const packagedPaths = desktopPaths.resolveDesktopPaths({
    appPath: path.join(os.tmpdir(), 'AI-CG-Studio', 'resources', 'app.asar'),
    resourcesPath: path.join(os.tmpdir(), 'AI-CG-Studio', 'resources'),
    userDataPath: path.join(os.tmpdir(), 'AI-CG-Studio', 'userData'),
    isPackaged: true,
    env: { AI_WORKSPACE_ROOT: path.join(os.tmpdir(), 'AI-workspace') },
  });
  assert.equal(packagedPaths.gatewayScript, path.join(packagedPaths.unpackedRoot, 'server.js'));
  assert.equal(packagedPaths.gatewayCwd, packagedPaths.unpackedRoot);
  assert.equal(packagedPaths.assetsRoot, path.join(path.dirname(packagedPaths.appRoot), 'assets'));
  assert.equal(packagedPaths.aiWorkspaceRoot, path.join(os.tmpdir(), 'AI-workspace'));

  const server = http.createServer((request, response) => {
    if (request.url === '/api/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{"ok":true}');
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    assert.equal(await supervisorModule.isGatewayHealthy(`http://127.0.0.1:${address.port}`), true);
    let forked = false;
    const supervisor = new supervisorModule.GatewaySupervisor({
      host: '127.0.0.1',
      port: address.port,
      cwd: root,
      serverPath: path.join(root, 'server.js'),
      fork: () => {
        forked = true;
        throw new Error('healthy gateway must not be forked');
      },
    });
    assert.equal(await supervisor.start(), `http://127.0.0.1:${address.port}`);
    assert.equal(supervisor.ownsGateway, false);
    assert.equal(forked, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-desktop-'));
  const stateFile = path.join(tempRoot, 'window.json');
  windowState.saveWindowBounds(stateFile, { x: 120, y: 80, width: 540, height: 760 });
  assert.deepEqual(windowState.loadWindowBounds(stateFile), { x: 120, y: 80, width: 540, height: 760 });
  assert.deepEqual(
    windowState.clampWindowBounds({ x: 9000, y: -300, width: 900, height: 900 }, { x: 0, y: 0, width: 1280, height: 720 }),
    { x: 1200, y: 0, width: 900, height: 720 },
  );
  const preferencesFile = path.join(tempRoot, 'preferences.json');
  windowState.saveCompanionPreferences(preferencesFile, { alwaysOnTop: true, ignoreMouseEvents: true });
  assert.deepEqual(windowState.loadCompanionPreferences(preferencesFile), { alwaysOnTop: true, ignoreMouseEvents: true });
  fs.rmSync(tempRoot, { recursive: true, force: true });
});
