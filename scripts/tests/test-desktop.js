'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

test('desktop shell contracts and pure helpers', async () => {
  const mainSource = fs.readFileSync(path.join(root, 'desktop', 'main.ts'), 'utf8');
   const preloadSource = fs.readFileSync(path.join(root, 'desktop', 'preload.ts'), 'utf8');
  const companionSource = fs.readFileSync(path.join(root, 'src', 'views', 'CompanionView.vue'), 'utf8');
  const companionCss = fs.readFileSync(path.join(root, 'src', 'assets', 'css', 'companion.css'), 'utf8');
  const live2dSource = fs.readFileSync(path.join(root, 'src', 'composables', 'useLive2D.ts'), 'utf8');
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
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
  assert.match(mainSource, /setBackgroundThrottling/);
  assert.match(mainSource, /v8CacheOptions:\s*'bypassHeatCheck'/);
  assert.match(mainSource, /powerMonitor\.on\('on-battery'/);
  assert.match(mainSource, /desktop:visibility-changed/);
  assert.match(mainSource, /CommandOrControl\+Shift\+P/);
  assert.match(mainSource, /webContents\.on\('context-menu'/);
  assert.match(mainSource, /allowGatewayNavigation/);
  assert.match(mainSource, /normalizeAtelierPath/);
  assert.match(mainSource, /will-redirect/);
  assert.match(mainSource, /loadDesktopGatewayPort/);
  assert.match(mainSource, /startGatewayMonitor/);
  assert.match(mainSource, /isTrustedDesktopSender/);
   assert.match(mainSource, /setIgnoreMouseEvents/);
   assert.match(mainSource, /setLoginItemSettings/);
   assert.match(mainSource, /globalShortcut\.register/);
  assert.match(mainSource, /new Notification/);
  assert.match(mainSource, /showOpenDialog/);
  assert.match(mainSource, /startClipboardWatch/);
  assert.match(mainSource, /clipboard\.readImage/);
  assert.match(mainSource, /desktop:clipboard-image/);
  assert.match(mainSource, /desktop:set-progress/);
  assert.match(mainSource, /setProgressBar/);
  assert.match(mainSource, /desktop:save-image/);
  assert.match(mainSource, /showSaveDialog/);
  assert.match(mainSource, /setAsDefaultProtocolClient/);
  assert.match(mainSource, /parseDeepLink/);
  assert.match(mainSource, /second-instance/);
  assert.match(packageJson.build.protocols[0].schemes.join(','), /aics/);
  assert.match(preloadSource, /contextBridge\.exposeInMainWorld/);
  assert.match(preloadSource, /webUtils\.getPathForFile/);
  assert.match(preloadSource, /offFileDrop/);
  assert.match(preloadSource, /offResume/);
  assert.match(preloadSource, /onClipboardImage/);
  assert.match(preloadSource, /onClipboardText/);
  assert.match(preloadSource, /setProgress/);
  assert.match(preloadSource, /saveImage/);
  assert.match(preloadSource, /onShown/);
  assert.match(preloadSource, /offShown/);
  assert.match(preloadSource, /onVisibilityChanged/);
  assert.match(preloadSource, /onPowerModeChanged/);
  assert.match(preloadSource, /onInteractionModeChanged/);
  assert.match(preloadSource, /setLive2dEnabled/);
  assert.doesNotMatch(preloadSource, /remote|webFrame|process\.env/);
  assert.match(companionSource, /window\.companionDesktop/);
  assert.match(companionSource, /desktopWindowVisible\.value && desktopLive2dOverride\.value !== false/);
  assert.match(companionSource, /storage\.state\.settings\.live2dEnabled/);
  assert.match(companionSource, /setDesktopPerformanceMode/);
  assert.doesNotMatch(companionSource, /window\.location\.reload/);
  assert.match(live2dSource, /ticker\.maxFPS = maxFps/);
  assert.match(live2dSource, /async function recover/);
  assert.match(live2dSource, /lifecycleToken/);
  assert.match(serverSource, /desktopProtocol:1/);
  assert.match(companionCss, /Immersive stage/);
  assert.match(companionCss, /\.companion-page \.companion-conversation[\s\S]*background:\s*transparent/);
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
  assert.equal(packagedPaths.gatewayScript, packagedPaths.appRoot + path.sep + 'server.js');
  assert.equal(packagedPaths.gatewayCwd, packagedPaths.unpackedRoot);
  assert.equal(packagedPaths.assetsRoot, path.join(path.dirname(packagedPaths.appRoot), 'assets'));
  assert.equal(packagedPaths.aiWorkspaceRoot, path.join(os.tmpdir(), 'AI-workspace'));

  const server = http.createServer((request, response) => {
    if (request.url === '/api/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{"ok":true,"app":"ai-cg-studio","desktopProtocol":1}');
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

  const truncatedGateway = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '128' });
    response.write('{"ok":true');
    response.destroy();
  });
  await new Promise(resolve => truncatedGateway.listen(0, '127.0.0.1', resolve));
  const truncatedAddress = truncatedGateway.address();
  assert.ok(truncatedAddress && typeof truncatedAddress === 'object');
  try {
    assert.equal(
      await supervisorModule.isGatewayHealthy(`http://127.0.0.1:${truncatedAddress.port}`, 500),
      false,
      'truncated health responses must settle as unhealthy',
    );
  } finally {
    await new Promise(resolve => truncatedGateway.close(resolve));
  }

  const oldGateway = http.createServer((request, response) => {
    if (request.url === '/api/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{"ok":true,"app":"ai-cg-studio"}');
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise(resolve => oldGateway.listen(0, '127.0.0.1', resolve));
  const oldAddress = oldGateway.address();
  assert.ok(oldAddress && typeof oldAddress === 'object');
  let ownedGateway = null;
  let selectedPort = 0;
  const fallbackSupervisor = new supervisorModule.GatewaySupervisor({
    host: '127.0.0.1',
    port: oldAddress.port,
    cwd: root,
    serverPath: path.join(root, 'server.js'),
    waitMs: 4000,
    fork: (_modulePath, _args, options) => {
      selectedPort = Number(options.env.PORT);
      const child = new EventEmitter();
      child.stdout = null;
      child.stderr = null;
      child.kill = () => {
        if (ownedGateway?.listening) ownedGateway.close(() => child.emit('exit', 0));
        else child.emit('exit', 0);
      };
      ownedGateway = http.createServer((request, response) => {
        if (request.url === '/api/health') {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end('{"ok":true,"app":"ai-cg-studio","desktopProtocol":1}');
          return;
        }
        response.writeHead(404);
        response.end();
      });
      ownedGateway.listen(selectedPort, '127.0.0.1');
      return child;
    },
  });
  try {
    const fallbackUrl = await fallbackSupervisor.start();
    assert.notEqual(selectedPort, oldAddress.port, 'desktop must not attach to an old gateway protocol');
    assert.equal(fallbackUrl, `http://127.0.0.1:${selectedPort}`);
    assert.equal(fallbackSupervisor.ownsGateway, true);
  } finally {
    await fallbackSupervisor.stop();
    await new Promise(resolve => oldGateway.close(resolve));
  }

  const slowGateway = http.createServer((request, response) => {
    if (request.url === '/api/health') {
      setTimeout(() => {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('{"ok":true,"app":"ai-cg-studio","desktopProtocol":1}');
      }, 180);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise(resolve => slowGateway.listen(0, '127.0.0.1', resolve));
  const slowAddress = slowGateway.address();
  assert.ok(slowAddress && typeof slowAddress === 'object');
  let cancelledFork = false;
  const cancelledSupervisor = new supervisorModule.GatewaySupervisor({
    host: '127.0.0.1',
    port: slowAddress.port,
    cwd: root,
    serverPath: path.join(root, 'server.js'),
    fork: () => {
      cancelledFork = true;
      throw new Error('cancelled start must not fork');
    },
  });
  try {
    const pendingStart = cancelledSupervisor.start();
    await new Promise(resolve => setTimeout(resolve, 20));
    await cancelledSupervisor.stop();
    await assert.rejects(pendingStart, /Gateway start cancelled/);
    assert.equal(cancelledFork, false);
  } finally {
    await new Promise(resolve => slowGateway.close(resolve));
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-desktop-'));  const stateFile = path.join(tempRoot, 'window.json');
  windowState.saveWindowBounds(stateFile, { x: 120, y: 80, width: 540, height: 760 });
  assert.deepEqual(windowState.loadWindowBounds(stateFile), { x: 120, y: 80, width: 540, height: 760 });
  assert.deepEqual(
    windowState.clampWindowBounds({ x: 9000, y: -300, width: 900, height: 900 }, { x: 0, y: 0, width: 1280, height: 720 }),
    { x: 1200, y: 0, width: 900, height: 720 },
  );
  assert.deepEqual(
    windowState.clampWindowBounds(
      { x: 0, y: 0, width: 500, height: 500 },
      { x: 0, y: 0, width: 1600, height: 900 },
      { minWidth: 1024, minHeight: 720 },
    ),
    { x: 0, y: 0, width: 1024, height: 720 },
  );
  const preferencesFile = path.join(tempRoot, 'preferences.json');
  windowState.saveCompanionPreferences(preferencesFile, { alwaysOnTop: true, ignoreMouseEvents: true, live2dEnabled: false });
  assert.deepEqual(windowState.loadCompanionPreferences(preferencesFile), {
    alwaysOnTop: true,
    ignoreMouseEvents: true,
    live2dEnabled: false,
  });
  const gatewayPortFile = path.join(tempRoot, 'desktop-gateway.json');
  windowState.saveDesktopGatewayPort(gatewayPortFile, 3017);
  assert.equal(windowState.loadDesktopGatewayPort(gatewayPortFile), 3017);
  assert.equal(windowState.loadDesktopGatewayPort(path.join(tempRoot, 'missing-gateway.json')), 3000);

  const fileLogger = require(path.join(root, 'desktop-dist', 'logger.js'));
  const logFile = path.join(tempRoot, 'logs', 'desktop.log');
  const logger = fileLogger.createFileLogger({ filePath: logFile, maxBytes: 512, maxFiles: 2 });
  logger.debug('debug line should be filtered');
  logger.info('first info line');
  logger.warn('first warn line');
  for (let i = 0; i < 40; i++) logger.info(`padding line ${i} `.repeat(24));
  logger.error('error after rotation');
  assert.equal(fs.existsSync(logFile), true, 'log file must exist');
  const rotated = fs.readdirSync(path.join(tempRoot, 'logs')).sort();
  assert.ok(rotated.includes('desktop.log'), 'primary log file must be kept');
  assert.ok(rotated.includes('desktop.log.1'), 'rotated log must be kept');
  const primary = fs.readFileSync(logFile, 'utf8');
  assert.match(primary, /ERROR\] error after rotation/, 'primary log must keep the latest entry');
  assert.doesNotMatch(primary, /debug line/, 'debug must be filtered at default info level');
  assert.doesNotMatch(primary, /first info line/, 'old entries must rotate out');
  const rotatedContent = fs.readFileSync(`${logFile}.1`, 'utf8');
  assert.match(rotatedContent, /first warn line/, 'rotated file must keep older entries');
  fs.rmSync(tempRoot, { recursive: true, force: true });
});
