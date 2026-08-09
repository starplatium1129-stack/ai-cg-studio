'use strict';

var fs = require('fs');
var http = require('http');
var os = require('os');
var path = require('path');
var createGateway = require(path.join(__dirname, '..', '..', 'server.js')).createGateway;
var loadGatewayConfig = require(path.join(__dirname, '..', '..', 'server', 'config.js')).loadGatewayConfig;
var runtimePaths = require(path.join(__dirname, '..', 'runtime', 'runtime-paths.js'));
var mocks = require('./mock-upstreams.js');

var ROOT = path.join(__dirname, '..', '..');
var DEFAULT_TOKEN = 'gateway-fixture-token-0123456789abcdef012345';

function closeServer(server) {
  return new Promise(function (resolve) {
    if (!server || !server.listening) return resolve();
    server.close(function () { resolve(); });
  });
}

function removeFixtureRoot(root) {
  var tempRoot = fs.realpathSync.native(os.tmpdir());
  var resolved = fs.realpathSync.native(path.resolve(root));
  var relative = path.relative(tempRoot, resolved);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Refusing to remove non-temporary fixture root: ' + root);
  }
  fs.rmSync(resolved, { recursive:true, force:true });
}

async function startMockUpstreams() {
  var entries = [
    { name:'sd', mock:mocks.createSdMock() },
    { name:'comfy', mock:mocks.createComfyMock() },
    { name:'ollama', mock:mocks.createOllamaMock() },
    { name:'tts', mock:mocks.createTtsMock() },
    { name:'translate', mock:mocks.createTranslateMock() }
  ];
  try {
    for (var i = 0; i < entries.length; i += 1) {
      var address = await mocks.listen(entries[i].mock.server, 0, '127.0.0.1');
      entries[i].port = address.port;
      entries[i].url = 'http://127.0.0.1:' + address.port;
    }
  } catch (error) {
    for (var c = 0; c < entries.length; c += 1) await closeServer(entries[c].mock.server);
    throw error;
  }

  var upstreams = {};
  entries.forEach(function (entry) { upstreams[entry.name] = entry; });
  upstreams.list = entries;
  upstreams.close = async function () {
    for (var i = entries.length - 1; i >= 0; i -= 1) await closeServer(entries[i].mock.server);
  };
  return upstreams;
}

function buildConfig(runtime, upstreams, options) {
  options = options || {};
  var env = Object.assign({
    AICS_APP_ROOT:ROOT,
    AI_WORKSPACE_ROOT:path.join(runtime.root, 'workspace'),
    AICS_RUNTIME_ROOT:runtime.root,
    AICS_DISABLE_LEGACY_RUNTIME_MIGRATION:'1',
    PORT:'3000',
    HOST:'127.0.0.1',
    TOKEN:options.token || DEFAULT_TOKEN,
    DISABLE_TUNNEL:'1',
    SD_HOST:upstreams.sd.url,
    COMFY_HOST:upstreams.comfy.url,
    TTS_HOST:upstreams.tts.url,
    OLLAMA_HOST:upstreams.ollama.url,
    TRANSLATE_PORT:String(upstreams.translate.port),
    TRANSLATION_PYTHON:path.join(runtime.root, 'fixture-python.exe'),
    TRANSLATION_SCRIPT:path.join(runtime.root, 'fixture-translate.py')
  }, options.env || {});
  var config = loadGatewayConfig(ROOT, env);
  // The fixture owns the actual listener, so the OS chooses an ephemeral port.
  config.PORT = 0;
  return config;
}

async function start(options) {
  options = options || {};
  var ownsTemporaryRoot = !options.runtimeRoot;
  var temporaryRoot = ownsTemporaryRoot
    ? fs.mkdtempSync(path.join(os.tmpdir(), options.prefix || 'aics-gateway-test-'))
    : path.resolve(options.runtimeRoot);
  var cleanupRuntime = options.cleanupRuntime === true || (ownsTemporaryRoot && options.cleanupRuntime !== false);
  var runtime = runtimePaths.createRuntimePaths(temporaryRoot);
  var upstreams = null;
  var gateway = null;
  var server = null;
  var closed = false;

  try {
    upstreams = await startMockUpstreams();
    var config = buildConfig(runtime, upstreams, options);
    if (typeof options.configureConfig === 'function') options.configureConfig(config, runtime, upstreams);
    if (typeof options.prepare === 'function') {
      await options.prepare({ root:temporaryRoot, runtime:runtime, config:config, upstreams:upstreams });
    }

    var services = typeof options.createServices === 'function'
      ? (await options.createServices({ root:temporaryRoot, runtime:runtime, config:config, upstreams:upstreams }) || {})
      : (options.services || {});
    var control = Object.assign({
      // Fixture routes must never launch PowerShell or another managed process.
      runScriptAsync:function () {
        return Promise.resolve({ ok:false, error:'fixture process execution disabled' });
      }
    }, options.control || {});
    gateway = createGateway({
      config:config,
      services:services,
      control:control,
      spawn:options.spawn
    });
    server = http.createServer(gateway.app);
    server.on('upgrade', gateway.handleUpgrade);
    var address = await new Promise(function (resolve, reject) {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', function () { resolve(server.address()); });
    });
    config.PORT = address.port;
    config.HOST = '127.0.0.1';

    return {
      root:temporaryRoot,
      runtime:runtime,
      config:config,
      upstreams:upstreams,
      gateway:gateway,
      server:server,
      address:address,
      baseUrl:'http://127.0.0.1:' + address.port,
       close:async function () {
         if (closed) return;
         closed = true;
         var errors = [];
         try { if (gateway) gateway.close(); } catch (error) { errors.push(error); }
         try { await closeServer(server); } catch (error) { errors.push(error); }
         try { if (upstreams) await upstreams.close(); } catch (error) { errors.push(error); }
         try { if (cleanupRuntime) removeFixtureRoot(temporaryRoot); } catch (error) { errors.push(error); }
         if (errors.length) throw new AggregateError(errors, 'gateway fixture cleanup failed');
       }
    };
  } catch (error) {
    try { if (gateway) gateway.close(); } catch (closeError) {}
    await closeServer(server);
    if (upstreams) await upstreams.close();
    if (cleanupRuntime) removeFixtureRoot(temporaryRoot);
    throw error;
  }
}

module.exports = {
  ROOT:ROOT,
  start:start,
  closeServer:closeServer,
  removeFixtureRoot:removeFixtureRoot
};
