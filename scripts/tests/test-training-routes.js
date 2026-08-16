'use strict';
const { test } = require('node:test');

/**
 * Training route contract tests.
 *
 * These assertions go through the real Express gateway over loopback HTTP.
 * The injected service is deliberately in-memory so this test can exercise
 * the public contract without starting OneTrainer or GPT-SoVITS.
 */

test('training-routes', async () => {
var assert = require('assert');
var fs = require('fs');
var http = require('http');
var os = require('os');
var path = require('path');
var gatewayTestStack = require('./gateway-test-stack');
var TrainingServiceError = require(path.join(
  __dirname,
  '..',
  '..',
  'services',
  'training-service'
)).TrainingServiceError;

var TOKEN = 'training-contract-token-0123456789abcdef';

function job(id, status) {
  var character = id.indexOf('natsume') >= 0 ? 'natsume' : 'nene';
  var kind = id.indexOf('voice-') === 0 ? 'voice' : 'lora';
  return {
    id:id,
    kind:kind,
    character:character,
    label:id,
    datasetId:kind + '-' + character + (kind === 'lora' ? '-v16' : ''),
    ready:true,
    missing:[],
    configName:kind === 'lora' ? character + '_v16.json' : undefined,
    status:status || 'idle',
    pid:0,
    startedAt:0,
    finishedAt:0,
    exitCode:null,
    error:'',
    runCount:0,
    logVersion:3,
    progress:{ stage:'ready', message:'Ready', percent:0 }
  };
}

function createTrainingStub(previewFile) {
  var calls = {
    overview:0,
    listDatasets:0,
    listJobs:0,
    getJob:[],
    getJobConfig:[],
    getLogs:[],
    getDatasetPreview:[],
    startJob:[],
    stopJob:[],
    close:0
  };
  var currentJobs = {
    'lora-nene-v18':job('lora-nene-v18'),
    'lora-natsume-v18':job('lora-natsume-v18'),
    'voice-nene':job('voice-nene'),
    'voice-natsume':job('voice-natsume')
  };
  var datasets = [{
    id:'lora-nene-v18',
    kind:'lora',
    character:'nene',
    version:'v16',
    ready:true,
    images:67,
    captions:67,
    bytes:1048576,
    categories:{ identity:6, outfit_witch:3, validation:7 },
    preview:{ available:true, label:'Nene preview', blurred:false },
    adultPreview:{ available:true, label:'Nene adult preview', blurred:true },
    missing:[]
  }, {
    id:'voice-nene',
    kind:'voice',
    character:'nene',
    version:'current',
    ready:true,
    images:0,
    captions:0,
    bytes:2048,
    categories:{},
    trainSamples:542,
    evalSamples:42,
    testSamples:42,
    wavs:584,
    preview:{ available:false, label:'', blurred:false },
    adultPreview:{ available:false, label:'', blurred:false },
    missing:[]
  }];

  function requireJob(id) {
    if (!currentJobs[id]) {
      throw new TrainingServiceError('Unknown training job', 'UNKNOWN_JOB', 404);
    }
    return currentJobs[id];
  }

  return {
    calls:calls,
    service:{
      overview:function () {
        calls.overview += 1;
        return {
          workspace:'test-workspace',
          activeJobId:'',
          readyJobs:4,
          datasets:datasets,
          jobs:Object.keys(currentJobs).map(function (id) { return currentJobs[id]; })
        };
      },
      listDatasets:function () {
        calls.listDatasets += 1;
        return { datasets:datasets };
      },
      listJobs:function () {
        calls.listJobs += 1;
        return { jobs:Object.keys(currentJobs).map(function (id) { return currentJobs[id]; }) };
      },
      getJob:function (id) {
        calls.getJob.push(id);
        return requireJob(id);
      },
      getJobConfig:function (id) {
        calls.getJobConfig.push(id);
        requireJob(id);
        if (id.indexOf('voice-') === 0) {
          return { id:id, kind:'voice', available:false, fields:{}, recommended:{} };
        }
        return {
          id:id,
          kind:'lora',
          available:true,
          fields:{
            epochs:143,
            batch_size:4,
            gradient_accumulation_steps:1,
            lora_rank:32,
            lora_alpha:32,
            unet_learning_rate:0.0001,
            text_encoder_learning_rate:0.00003,
            text_encoder_stop_epoch:30
          },
          recommended:{
            epochs:143,
            batch_size:4,
            gradient_accumulation_steps:1,
            lora_rank:32,
            lora_alpha:32,
            unet_learning_rate:0.0001,
            text_encoder_learning_rate:0.00003,
            text_encoder_stop_epoch:30
          }
        };
      },
      getDatasetPreview:function (id) {
        var variant = arguments[1] || 'signature';
        calls.getDatasetPreview.push(variant === 'signature' ? id : id + ':' + variant);
        if (id !== 'lora-nene-v18') {
          throw new TrainingServiceError('Preview unavailable', 'PREVIEW_UNAVAILABLE', 404);
        }
        return {
          filePath:previewFile,
          contentType:'image/jpeg',
          label:'Nene preview',
          blurred:false
        };
      },
      getLogs:function (id, cursor, version) {
        requireJob(id);
        calls.getLogs.push({ id:id, cursor:cursor, version:version });
        // 2026-08-16 审计：路由已适配异步 getLogs（读前先 flush），桩必须返回 Promise。
        return Promise.resolve({
          id:id,
          cursor:Number(cursor) || 0,
          nextCursor:19,
          reset:String(version || '') !== '3',
          version:3,
          text:'epoch 2/80 - loss 0.094',
          lines:['epoch 2/80 - loss 0.094']
        });
      },
      startJob:function (id, overrides, dataset) {
        calls.startJob.push({ id:id, overrides:overrides, dataset:dataset });
        if (id === 'voice-nene') {
          throw new TrainingServiceError(
            'Another GPU training job is active',
            'JOB_BUSY',
            409,
            'lora-nene-v18'
          );
        }
        var next = Object.assign({}, requireJob(id), {
          status:'running',
          pid:4242,
          runCount:1,
          progress:{ stage:'starting', message:'Starting', percent:1 }
        });
        currentJobs[id] = next;
        return next;
      },
      stopJob:function (id) {
        calls.stopJob.push(id);
        var next = Object.assign({}, requireJob(id), {
          status:'stopping',
          progress:{ stage:'stopping', message:'Stopping', percent:1 }
        });
        currentJobs[id] = next;
        return next;
      },
      close:function () { calls.close += 1; }
    }
  };
}

function createDependencies(training) {
  return { training:training };
}

function request(port, options) {
  options = options || {};
  var body = options.body;
  var headers = Object.assign({ Host:'127.0.0.1:' + port }, options.headers || {});
  if (body !== undefined) {
    body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  return new Promise(function (resolve, reject) {
    var req = http.request({
      host:'127.0.0.1',
      port:port,
      method:options.method || 'GET',
      path:options.path,
      headers:headers
    }, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8');
        var json = null;
        try { json = JSON.parse(raw); } catch (error) {}
        resolve({
          status:res.statusCode,
          headers:res.headers,
          raw:raw,
          json:json
        });
      });
    });
    req.once('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function assertSuccess(response, label) {
  assert.strictEqual(response.status, 200, label + ' must return 200');
  assert.ok(response.json, label + ' must return JSON');
  assert.strictEqual(response.json.ok, true, label + ' must use the success envelope');
}

function assertFailure(response, status, code, label) {
  assert.strictEqual(response.status, status, label + ' returned the wrong status');
  assert.ok(response.json, label + ' must return JSON');
  assert.strictEqual(response.json.ok, false, label + ' must use the error envelope');
  assert.strictEqual(typeof response.json.error, 'string', label + ' must include error');
  assert.ok(response.json.error.length > 0, label + ' error must not be empty');
  if (code) assert.strictEqual(response.json.code, code, label + ' returned the wrong code');
}

function safeRemoveTemporaryRoot(temporaryRoot) {
  var expectedParent = path.resolve(os.tmpdir()).toLowerCase();
  var actualParent = path.dirname(path.resolve(temporaryRoot)).toLowerCase();
  var name = path.basename(temporaryRoot);
  if (actualParent !== expectedParent || name.indexOf('ai-cg-training-http-') !== 0) {
    throw new Error('Refusing to remove unexpected temporary path: ' + temporaryRoot);
  }
  fs.rmSync(temporaryRoot, { recursive:true, force:true });
}

async function main() {
  var temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-cg-training-http-'));
  var previewFile = path.join(temporaryRoot, 'preview.jpg');
  fs.writeFileSync(previewFile, 'test-preview', 'utf8');
  var stub = createTrainingStub(previewFile);
  var stack = null;

  try {
    stack = await gatewayTestStack.start({
      runtimeRoot:temporaryRoot,
      services:createDependencies(stub.service),
      token:TOKEN
    });
    var port = stack.address.port;

    var overview = await request(port, { path:'/api/training/overview' });
    assertSuccess(overview, 'training overview');
    assert.strictEqual(overview.headers['cache-control'], 'no-store');
    assert.strictEqual(overview.json.workspace, 'test-workspace');
    assert.strictEqual(overview.json.readyJobs, 4);
    assert.strictEqual(overview.json.datasets[0].categories.outfit_witch, 3);
    assert.strictEqual(stub.calls.overview, 1);

    var datasets = await request(port, { path:'/api/training/datasets' });
    assertSuccess(datasets, 'training datasets');
    assert.strictEqual(datasets.json.datasets[1].trainSamples, 542);
    assert.strictEqual(datasets.json.datasets[1].evalSamples, 42);
    assert.strictEqual(datasets.json.datasets[1].testSamples, 42);
    assert.strictEqual(stub.calls.listDatasets, 1);

    var preview = await request(port, {
      path:'/api/training/datasets/lora-nene-v18/preview'
    });
    assert.strictEqual(preview.status, 200, 'training preview must return the allowlisted image');
    assert.ok(String(preview.headers['content-type'] || '').indexOf('image/jpeg') >= 0);
    assert.strictEqual(preview.headers['content-disposition'], 'inline');
    assert.deepStrictEqual(stub.calls.getDatasetPreview, ['lora-nene-v18']);

    var adultPreview = await request(port, {
      path:'/api/training/datasets/lora-nene-v18/adult-preview'
    });
    assert.strictEqual(adultPreview.status, 200, 'adult preview must return the pre-blurred allowlisted image');
    assert.ok(String(adultPreview.headers['content-type'] || '').indexOf('image/jpeg') >= 0);
    assert.deepStrictEqual(stub.calls.getDatasetPreview, ['lora-nene-v18', 'lora-nene-v18:adult']);

    var unavailablePreview = await request(port, {
      path:'/api/training/datasets/voice-nene/preview'
    });
    assertFailure(unavailablePreview, 404, 'PREVIEW_UNAVAILABLE', 'unavailable training preview');

    var jobs = await request(port, { path:'/api/training/jobs' });
    assertSuccess(jobs, 'training jobs');
    assert.strictEqual(jobs.json.jobs.length, 4);
    assert.strictEqual(stub.calls.listJobs, 1);

    var jobResponse = await request(port, {
      path:'/api/training/jobs/lora-nene-v18'
    });
    assertSuccess(jobResponse, 'single training job');
    assert.strictEqual(jobResponse.json.job.id, 'lora-nene-v18');
    assert.deepStrictEqual(stub.calls.getJob, ['lora-nene-v18']);

    var logs = await request(port, {
      path:'/api/training/jobs/lora-nene-v18/logs?cursor=7&version=3'
    });
    assertSuccess(logs, 'training logs');
    assert.strictEqual(logs.json.cursor, 7);
    assert.strictEqual(logs.json.nextCursor, 19);
    assert.strictEqual(logs.json.reset, false);
    assert.deepStrictEqual(stub.calls.getLogs[0], {
      id:'lora-nene-v18',
      cursor:'7',
      version:'3'
    });

    var logAlias = await request(port, {
      path:'/api/training/logs/lora-nene-v18?cursor=0&version=2'
    });
    assertSuccess(logAlias, 'training log alias');
    assert.strictEqual(logAlias.json.reset, true);
    assert.strictEqual(stub.calls.getLogs.length, 2);

    var started = await request(port, {
      method:'POST',
      path:'/api/training/jobs',
      body:{ id:'lora-nene-v18' }
    });
    assertSuccess(started, 'start training job');
    assert.strictEqual(started.json.job.status, 'running');
    assert.strictEqual(started.json.job.pid, 4242);
    assert.deepStrictEqual(stub.calls.startJob, [{ id:'lora-nene-v18', overrides:undefined, dataset:undefined }]);

    var configResponse = await request(port, {
      path:'/api/training/jobs/lora-nene-v18/config'
    });
    assertSuccess(configResponse, 'training job config');
    assert.strictEqual(configResponse.json.config.available, true);
    assert.strictEqual(configResponse.json.config.fields.epochs, 143);
    assert.strictEqual(configResponse.json.config.recommended.lora_rank, 32);
    assert.deepStrictEqual(stub.calls.getJobConfig, ['lora-nene-v18']);

    var voiceConfig = await request(port, {
      path:'/api/training/jobs/voice-nene/config'
    });
    assertSuccess(voiceConfig, 'voice job config');
    assert.strictEqual(voiceConfig.json.config.available, false);

    var startedWithOverrides = await request(port, {
      method:'POST',
      path:'/api/training/jobs',
      body:{ id:'lora-natsume-v18', overrides:{ epochs:90, lora_rank:64 }, dataset:'V18_Unified' }
    });
    assertSuccess(startedWithOverrides, 'start training job with whitelisted overrides');
    assert.deepStrictEqual(stub.calls.startJob[1], {
      id:'lora-natsume-v18',
      overrides:{ epochs:90, lora_rank:64 },
      dataset:'V18_Unified'
    });

    var stopped = await request(port, {
      method:'POST',
      path:'/api/training/jobs/lora-nene-v18/stop',
      body:{}
    });
    assertSuccess(stopped, 'stop training job');
    assert.strictEqual(stopped.json.job.status, 'stopping');
    assert.deepStrictEqual(stub.calls.stopJob, ['lora-nene-v18']);

    var startedByKind = await request(port, {
      method:'POST',
      path:'/api/training/jobs',
      body:{ kind:'natsume' }
    });
    assertSuccess(startedByKind, 'start training job by safe alias');
    assert.strictEqual(startedByKind.json.job.id, 'lora-natsume-v18');
    assert.strictEqual(stub.calls.startJob[2].id, 'lora-natsume-v18');

    var unknownJob = await request(port, {
      method:'POST',
      path:'/api/training/jobs',
      body:{ id:'arbitrary-command' }
    });
    assertFailure(unknownJob, 400, 'UNKNOWN_JOB', 'unknown training job');
    assert.strictEqual(stub.calls.startJob.length, 3,
      'unknown job ids must be rejected before reaching the service');

    var missingJob = await request(port, {
      path:'/api/training/jobs/not-a-job'
    });
    assertFailure(missingJob, 404, 'UNKNOWN_JOB', 'missing training job');

    var busyJob = await request(port, {
      method:'POST',
      path:'/api/training/jobs/voice-nene/start',
      body:{}
    });
    assertFailure(busyJob, 409, 'JOB_BUSY', 'busy GPU job');
    assert.strictEqual(busyJob.json.detail, 'lora-nene-v18');

    var malformedJson = await request(port, {
      method:'POST',
      path:'/api/training/jobs',
      headers:{ 'Content-Type':'application/json' },
      body:'{not-json'
    });
    assertFailure(malformedJson, 400, null, 'malformed training JSON');

    var tunneled = await request(port, {
      path:'/api/training/overview',
      headers:{
        'x-forwarded-for':'203.0.113.10',
        'x-token':TOKEN
      }
    });
    assertFailure(tunneled, 403, null, 'tunneled training overview');
    assert.strictEqual(stub.calls.overview, 1,
      'localOnly must reject tunneled calls before reaching the service');

    var unknownApi = await request(port, {
      path:'/api/training/not-a-route'
    });
    assertFailure(unknownApi, 404, null, 'unknown training API');
    assert.ok(String(unknownApi.headers['content-type'] || '').indexOf('json') >= 0,
      'unknown training APIs must return JSON rather than the SPA shell');

    console.log(
      'Training route contract tests passed: real HTTP overview/datasets/jobs/logs, ' +
      'safe previews, start/stop, aliases, localOnly, error envelopes, and API 404'
    );
  } finally {
    if (stack) await stack.close();
    else safeRemoveTemporaryRoot(temporaryRoot);
    assert.strictEqual(stub.calls.close, 1, 'gateway close must close the training service');
  }
}

await main();
});
