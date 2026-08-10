'use strict';
const { test } = require('node:test');

var assert = require('assert');
var events = require('events');
var express = require('express');
var fs = require('fs');
var http = require('http');
var os = require('os');
var path = require('path');
var childProcess = require('child_process');
var createControlRouter = require('../../routes/control').createControlRouter;
var createTtsService = require('../../services/tts-service').createTtsService;
var runtimePaths = require('../runtime/runtime-paths');
var gatewayTestStack = require('./gateway-test-stack');

var projectRoot = path.resolve(__dirname, '..', '..');

function listen(server) {
  return new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', function () {
      resolve('http://127.0.0.1:' + server.address().port);
    });
  });
}

function close(server) {
  return new Promise(function (resolve) {
    if (!server || !server.listening) return resolve();
    server.close(function () { resolve(); });
  });
}

async function postJson(baseUrl, pathname, payload) {
  var response = await fetch(baseUrl + pathname, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(payload)
  });
  var body = await response.text();
  var json = null;
  try { json = JSON.parse(body); } catch (error) {}
  return { status:response.status, body:body, json:json };
}

async function getJson(baseUrl, pathname) {
  var response = await fetch(baseUrl + pathname);
  return { status:response.status, json:await response.json() };
}

async function waitFor(check, description) {
  var deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    var value = await check();
    if (value) return value;
    await new Promise(function (resolve) { setTimeout(resolve, 25); });
  }
  throw new Error('Timed out waiting for ' + description);
}

function baseConfig(rootDir, runtime) {
  return {
    ROOT_DIR:rootDir,
    RUNTIME:runtime,
    RUNTIME_ROOT:runtime.root,
    PORT:3000,
    HOST:'127.0.0.1',
    TOKEN:'control-contract-token',
    SD_HOST:'http://127.0.0.1:7860',
    COMFY_HOST:'http://127.0.0.1:8188',
    SD_API_AUTH:'',
    TTS_HOST:'http://127.0.0.1:9880',
    OLLAMA_HOST:'http://127.0.0.1:11434',
    OLLAMA_MODEL:'',
    OLLAMA_KEEP_ALIVE:'10m',
    OLLAMA_NUM_PREDICT:300,
    OLLAMA_NUM_CTX:4096,
    TRANSLATE_PORT:5310,
    TRANSLATE_URL:'http://127.0.0.1:5310',
    TRANSLATION_PYTHON:path.join(runtime.root, 'fixture-python.exe'),
    TRANSLATION_SCRIPT:path.join(runtime.root, 'fixture-translate.py'),
    TRANSLATION_LOG:path.join(runtime.logs, 'translate.log'),
    SELF_HEALING_INTERVAL_MS:50,
    LIVE2D_ROOT:path.join(rootDir, 'assets', 'live2d'),
    ASSETS_ROOT:path.join(rootDir, 'assets'),
    TOOLS_ROOT:path.join(rootDir, 'tools'),
    SCENE_SHOWCASE_DIR:'',
    VOICE_PROFILES:{},
    DISABLE_TUNNEL:true,
    CLOUDFLARED_PATH:''
  };
}

function createWeightMock() {
  var state = { paths:[], rejectGpt:true };
  var server = http.createServer(function (req, res) {
    state.paths.push(req.url || '');
    if ((req.url || '').startsWith('/set_gpt_weights') && state.rejectGpt) {
      res.statusCode = 500;
      res.end('gpt weight rejected');
      return;
    }
    res.end('ok');
  });
  return { server:server, state:state };
}

test('control-failure-contract: timeout, config rollback, voice weights, tunnel exit', async () => {
  var temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-control-failure-'));
  var controlRuntime = runtimePaths.createRuntimePaths(path.join(temporaryRoot, 'control'));
  var controlConfig = baseConfig(projectRoot, controlRuntime);
  var controlProbeServer = http.createServer(function (req, res) { res.end('ok'); });
  controlConfig.TTS_HOST = await listen(controlProbeServer);
  var failConfigWrite = false;
  var controlRouter = createControlRouter(controlConfig, function () {
    return { tunnelUrl:'', startTunnel:function () {}, stopTunnel:function () {} };
  }, {
    runScriptAsync:async function () {
      return { ok:false, error:'operation timeout' };
    },
    refreshServiceStates:async function () {
      return { sdOnline:false, ttsOnline:false, ollamaOnline:false, ollamaModels:[], ollamaVram:0, webuiManaged:false };
    },
    writeJson:function (file, data) {
      if (failConfigWrite) throw new Error('simulated config write failure');
      fs.writeFileSync(file, JSON.stringify(data), 'utf8');
    }
  });
  var controlApp = express();
  controlApp.use(controlRouter);
  var controlServer = http.createServer(controlApp);
  var controlBase = await listen(controlServer);
  var weightMock = null;
  var tunnelStack = null;

  try {
    var startedVoice = await postJson(controlBase, '/api/service/voice', { action:'start' });
    assert(startedVoice.status === 200 && startedVoice.json && startedVoice.json.pending,
      'voice start must acknowledge the asynchronous control operation');
    var failedVoice = await waitFor(async function () {
      var status = await getJson(controlBase, '/api/status');
      return status.json.operation && status.json.operation.status === 'failed' ? status.json.operation : null;
    }, 'voice startup timeout failure');
    assert(failedVoice.error.includes('timeout'), 'voice startup timeout must be exposed in the operation result');

    failConfigWrite = true;
    var previousSdHost = controlConfig.SD_HOST;
    var failedConfig = await postJson(controlBase, '/api/config', { sdHost:'http://127.0.0.1:7999' });
    assert(failedConfig.status === 500 && failedConfig.json && !failedConfig.json.ok,
      'config write failure must return the standard error envelope');
    assert.strictEqual(controlConfig.SD_HOST, previousSdHost,
      'a failed config write must not leave the in-memory SD host partially updated');
    if (controlRouter.close) controlRouter.close();
    await close(controlServer);

    weightMock = createWeightMock();
    var weightBase = await listen(weightMock.server);
    var tts = createTtsService({
      host:weightBase,
      profiles:{
        nene:{
          refAudioPath:'nene.wav', promptText:'reference',
          sovitsWeightsPath:'nene.pth', gptWeightsPath:'nene.ckpt'
        }
      }
    });
    var firstFailure = await tts.prepare('nene').then(function () { return null; }, function (error) { return error; });
    assert(firstFailure, 'a rejected GPT weight switch must reject voice preparation');
    assert.strictEqual((await tts.status()).activeVoice, '',
      'a partial weight switch must not mark a voice as active');

    weightMock.state.rejectGpt = false;
    await tts.prepare('nene');
    var sovitsRequests = weightMock.state.paths.filter(function (pathname) {
      return pathname.startsWith('/set_sovits_weights');
    });
    assert.strictEqual(sovitsRequests.length, 2,
      'retrying a partial weight switch must reapply the SoVITS weight instead of trusting stale cache state');
    await close(weightMock.server);
    weightMock = null;

    var tunnelChild = new events.EventEmitter();
    tunnelChild.unref = function () {};
    tunnelStack = await gatewayTestStack.start({
      runtimeRoot:path.join(temporaryRoot, 'tunnel'),
      spawn:function () { return tunnelChild; },
      configureConfig:function (config) {
        config.DISABLE_TUNNEL = false;
        config.CLOUDFLARED_PATH = path.join(temporaryRoot, 'cloudflared-test.exe');
        fs.writeFileSync(config.CLOUDFLARED_PATH, '', 'utf8');
      }
    });
    tunnelStack.gateway.startTunnel();
    fs.writeFileSync(tunnelStack.runtime.tunnelLog,
      'https://stable-test.trycloudflare.com\nRegistered tunnel connection\n', 'utf8');
    var readyTunnel = await waitFor(async function () {
      var status = await getJson(tunnelStack.baseUrl, '/api/status');
      return status.json.tunnelStatus === 'active' ? 'active' : '';
    }, 'tunnel ready status');
    assert.strictEqual(readyTunnel, 'active');

    tunnelChild.emit('exit', 1);
    var stoppedTunnel = await waitFor(async function () {
      var status = await getJson(tunnelStack.baseUrl, '/api/status');
      return status.json.tunnelStatus === 'waiting' ? 'cleared' : '';
    }, 'tunnel exit status cleanup');
    assert(stoppedTunnel, 'tunnel exit must remove the stale public URL from the real status route');
  } finally {
    if (controlRouter.close) controlRouter.close();
    await close(controlServer);
    if (weightMock) await close(weightMock.server);
    if (tunnelStack) await tunnelStack.close();
    await close(controlProbeServer);
    fs.rmSync(temporaryRoot, { recursive:true, force:true });
  }

  console.log('Control failure contracts passed: timeout, config rollback, voice weights, tunnel exit');
});

test('gateway test stack preserves caller-owned runtime roots by default', async () => {
  var temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-gateway-owned-root-'));
  var runtimeRoot = path.join(temporaryRoot, 'runtime');
  fs.mkdirSync(runtimeRoot, { recursive:true });
  var marker = path.join(runtimeRoot, 'caller-owned.txt');
  fs.writeFileSync(marker, 'keep\n', 'utf8');
  var stack = null;
  try {
    stack = await gatewayTestStack.start({ runtimeRoot:runtimeRoot });
    await stack.close();
    stack = null;
    assert.strictEqual(fs.readFileSync(marker, 'utf8'), 'keep\n');
  } finally {
    if (stack) await stack.close();
    fs.rmSync(temporaryRoot, { recursive:true, force:true });
  }
});

test('control contract: ComfyUI start/stop uses managed ownership and shared operations', async () => {
  var temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-comfy-control-'));
  var runtime = runtimePaths.createRuntimePaths(path.join(temporaryRoot, 'control'));
  var config = baseConfig(projectRoot, runtime);
  config.AI_WORKSPACE_ROOT = path.join(temporaryRoot, 'AI workspace');
  var comfyOnline = false;
  var calls = [];
  var router = createControlRouter(config, function () { return { tunnelUrl:'' }; }, {
    runScriptAsync:async function (script, args) {
      calls.push({ script:script, args:args });
      if (path.basename(script) === 'managed-comfyui.ps1') {
        var action = args[args.indexOf('-Action') + 1];
        comfyOnline = action === 'Start';
        return { ok:true, message:JSON.stringify({ ok:true, managed:comfyOnline, state:comfyOnline ? 'ready' : 'stopped', message:'mock comfy' }) };
      }
      return { ok:true, message:JSON.stringify({ managed:false }) };
    },
    refreshServiceStates:async function () {
      return { sdOnline:false, comfyOnline:comfyOnline, ttsOnline:false, ollamaOnline:false, ollamaModels:[], ollamaVram:0, webuiManaged:false, comfyManaged:comfyOnline };
    }
  });
  var app = express();
  app.use(router);
  var server = http.createServer(app);
  var base = await listen(server);
  try {
    var start = await postJson(base, '/api/service/comfy', { action:'start' });
    assert.strictEqual(start.status, 200);
    assert.strictEqual(start.json.pending, true);
    var ready = await waitFor(async function () {
      var status = await getJson(base, '/api/status');
      return status.json.operation && status.json.operation.status === 'completed' ? status.json : null;
    }, 'mock ComfyUI start');
    assert.strictEqual(ready.comfyOnline, true);
    assert.strictEqual(ready.comfyManaged, true);
    assert.ok(calls[0].args.includes('-AIWorkspaceRoot') && calls[0].args.includes('-RuntimeRoot'));
    var stop = await postJson(base, '/api/service/comfy', { action:'stop' });
    assert.strictEqual(stop.status, 200);
    var stopped = await waitFor(async function () {
      var status = await getJson(base, '/api/status');
      return status.json.operation && status.json.operation.status === 'completed' ? status.json : null;
    }, 'mock ComfyUI stop');
    assert.strictEqual(stopped.comfyOnline, false);
    assert.strictEqual(stopped.comfyManaged, false);
    assert.strictEqual(JSON.parse(fs.readFileSync(runtime.config, 'utf8')).managedServices.comfy, false);
  } finally {
    if (router.close) router.close();
    await close(server);
    fs.rmSync(temporaryRoot, { recursive:true, force:true });
  }
});

test('managed runtime scripts require injected paths and protect external ownership', () => {
  var comfy = fs.readFileSync(path.join(projectRoot, 'scripts', 'runtime', 'managed-comfyui.ps1'), 'utf8');
  var webui = fs.readFileSync(path.join(projectRoot, 'scripts', 'runtime', 'managed-webui.ps1'), 'utf8');
  assert.ok(comfy.includes('$AIWorkspaceRoot') && comfy.includes('$RuntimeRoot') && comfy.includes('$ComfyHost'));
  assert.ok(webui.includes('$PackageRoot') && webui.includes('$RuntimeRoot') && webui.includes('$WebuiHost'));
  assert.ok(comfy.includes('Test-ManagedProcess') && comfy.includes('taskkill.exe /PID'));
  assert.ok(webui.includes('Test-ManagedProcess') && webui.includes('taskkill.exe /PID'));
  assert.ok(comfy.includes('/system_stats') && webui.includes('/sdapi/v1/sd-models'));
});

test('managed-comfyui script does not stop an external healthy process', async () => {
  var temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-comfy-script-'));
  var health = http.createServer(function (req, res) {
    res.statusCode = req.url === '/system_stats' ? 200 : 404;
    res.end('{}');
  });
  var base = await listen(health);
  function invoke(action) {
    return new Promise(function (resolve, reject) {
      childProcess.execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        path.join(projectRoot, 'scripts', 'runtime', 'managed-comfyui.ps1'), '-Action', action,
        '-AIWorkspaceRoot', path.join(temporaryRoot, 'workspace'), '-RuntimeRoot', path.join(temporaryRoot, 'runtime'), '-ComfyHost', base],
        { windowsHide:true }, function (error, stdout, _stderr) {
          if (error && !stdout) return reject(error);
          resolve(JSON.parse(String(stdout).trim()));
        });
    });
  }
  try {
    var status = await invoke('Status');
    assert.strictEqual(status.state, 'external-running');
    assert.strictEqual(status.managed, false);
    var stopped = await invoke('Stop');
    assert.strictEqual(stopped.state, 'external-or-stopped');
    assert.strictEqual(stopped.managed, false);
  } finally {
    await close(health);
    fs.rmSync(temporaryRoot, { recursive:true, force:true });
  }
});

// 自愈看门狗单测随控制面失败契约一起跑（validate 已串接本文件）。
