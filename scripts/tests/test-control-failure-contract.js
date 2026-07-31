'use strict';
const { test } = require('node:test');

var assert = require('assert');
var events = require('events');
var express = require('express');
var fs = require('fs');
var http = require('http');
var os = require('os');
var path = require('path');
var createControlRouter = require('../../routes/control').createControlRouter;
var createGateway = require('../../server').createGateway;
var createTtsService = require('../../services/tts-service').createTtsService;
var runtimePaths = require('../runtime/runtime-paths');

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
    TTS_HOST:'http://127.0.0.1:9880',
    OLLAMA_HOST:'http://127.0.0.1:11434',
    OLLAMA_MODEL:'',
    OLLAMA_KEEP_ALIVE:'10m',
    OLLAMA_NUM_PREDICT:300,
    OLLAMA_NUM_CTX:4096,
    TRANSLATE_PORT:5310,
    TRANSLATE_URL:'http://127.0.0.1:5310',
    TRANSLATION_LOG:path.join(runtime.logs, 'translate.log'),
    LIVE2D_ROOT:path.join(rootDir, 'assets', 'live2d'),
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
  } finally {
    await close(controlServer);
  }

  var weightMock = createWeightMock();
  var weightBase = await listen(weightMock.server);
  try {
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
  } finally {
    await close(weightMock.server);
  }

  var tunnelRuntime = runtimePaths.createRuntimePaths(path.join(temporaryRoot, 'tunnel'));
  var tunnelConfig = baseConfig(path.join(temporaryRoot, 'gateway-root'), tunnelRuntime);
  tunnelConfig.DISABLE_TUNNEL = false;
  tunnelConfig.CLOUDFLARED_PATH = path.join(temporaryRoot, 'cloudflared-test.exe');
  fs.writeFileSync(tunnelConfig.CLOUDFLARED_PATH, '', 'utf8');
  var tunnelChild = new events.EventEmitter();
  tunnelChild.unref = function () {};
  var gateway = createGateway({ config:tunnelConfig, spawn:function () { return tunnelChild; } });
  var gatewayServer = http.createServer(gateway.app);
  var gatewayBase = await listen(gatewayServer);
  tunnelConfig.PORT = Number(new URL(gatewayBase).port);
  try {
    gateway.startTunnel();
    fs.writeFileSync(tunnelRuntime.tunnelLog,
      'https://stable-test.trycloudflare.com\nRegistered tunnel connection\n', 'utf8');
    var readyTunnel = await waitFor(async function () {
      var status = await getJson(gatewayBase, '/api/status');
      return status.json.tunnelStatus === 'active' ? 'active' : '';
    }, 'tunnel ready status');
    assert.strictEqual(readyTunnel, 'active');

    tunnelChild.emit('exit', 1);
    var stoppedTunnel = await waitFor(async function () {
      var status = await getJson(gatewayBase, '/api/status');
      return status.json.tunnelStatus === 'waiting' ? 'cleared' : '';
    }, 'tunnel exit status cleanup');
    assert(stoppedTunnel, 'tunnel exit must remove the stale public URL from the real status route');
  } finally {
    gateway.close();
    await close(gatewayServer);
    fs.rmSync(temporaryRoot, { recursive:true, force:true });
  }

  console.log('Control failure contracts passed: timeout, config rollback, voice weights, tunnel exit');
});
