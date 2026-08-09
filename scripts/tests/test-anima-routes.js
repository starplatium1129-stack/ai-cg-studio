'use strict';

var assert = require('assert');
var fs = require('fs');
var http = require('http');
var path = require('path');
var test = require('node:test');
var createAnimaService = require('../../routes/anima.js').createAnimaService;
var gatewayTestStack = require('./gateway-test-stack.js');

function request(port, options) {
  return new Promise(function (resolve, reject) {
    var body = options.body === undefined ? null : Buffer.from(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    var headers = Object.assign({ Host:'127.0.0.1:' + port }, options.headers || {});
    if (body) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = body.length;
    }
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
        var raw = Buffer.concat(chunks);
        var json = null;
        try { json = JSON.parse(raw.toString('utf8')); } catch (error) {}
        resolve({ status:res.statusCode, headers:res.headers, body:raw, json:json });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function postJson(port, pathname, payload, headers) {
  return request(port, {
    method:'POST',
    path:pathname,
    body:payload,
    headers:headers
  });
}

async function mockState(port) {
  var response = await request(port, { path:'/__mock/state' });
  assert.strictEqual(response.status, 200);
  return response.json;
}

async function mockFault(port, faults) {
  var response = await postJson(port, '/__mock/fault', faults);
  assert.strictEqual(response.status, 200);
}

async function waitForJob(port, id, predicate) {
  var last = null;
  for (var i = 0; i < 80; i += 1) {
    var response = await request(port, { path:'/api/anima/jobs/' + encodeURIComponent(id) });
    assert.strictEqual(response.status, 200);
    last = response.json && response.json.job;
    if (predicate(last)) return last;
    await new Promise(function (resolve) { setTimeout(resolve, 50); });
  }
  throw new Error('job did not reach expected state: ' + JSON.stringify(last));
}

function validJob(overrides) {
  return Object.assign({
    prompt:'ayachi_nene, 1girl, solo, cafe',
    negative:'worst quality, low quality',
    modelId:'anima-base-v1.0',
    loraId:'L_NENE_V20_ANIMA',
    loraStrength:0.85,
    width:832,
    height:1216,
    steps:24,
    cfg:3,
    seed:4242,
    character:'nene'
  }, overrides || {});
}

test('Anima routes enforce application job and result boundaries over real HTTP', async function () {
  var stack = await gatewayTestStack.start({
    prefix:'aics-anima-route-',
    token:'anima-contract-token-0123456789abcdef0123456789',
    prepare:function (context) {
      fs.mkdirSync(path.join(context.runtime.outputs, 'anima'), { recursive:true });
      fs.writeFileSync(path.join(context.runtime.outputs, 'anima', 'orphan-startup.png'), 'orphan');
    }
  });
  var runtime = stack.runtime;
  var comfy = stack.upstreams.comfy;
  var gateway = stack.gateway;
  var port = stack.address.port;
  assert.strictEqual(fs.existsSync(path.join(runtime.outputs, 'anima', 'orphan-startup.png')), false,
    'gateway startup must remove orphan Anima result files');

  try {
    var remote = { 'x-forwarded-for':'8.8.8.8' };
    var unauthorized = await request(port, { path:'/api/anima/status', headers:remote });
    assert.strictEqual(unauthorized.status, 401, 'remote Anima requests need a token');

    var blockedPaths = ['/comfy/prompt', '/comfy/history/abc', '/comfy/queue', '/comfy/interrupt', '/comfy/view?filename=x.png', '/history', '/queue', '/interrupt', '/view'];
    for (var i = 0; i < blockedPaths.length; i += 1) {
      var blocked = await request(port, { path:blockedPaths[i] });
      assert.strictEqual(blocked.status, 404, blockedPaths[i] + ' must not be exposed');
      assert.ok(blocked.json && blocked.json.ok === false, blockedPaths[i] + ' must return an error envelope');
    }

    var status = await request(port, { path:'/api/anima/status' });
    assert.strictEqual(status.status, 200);
    assert.strictEqual(status.json.ok, true);
    assert.strictEqual(status.json.online, true);
    assert.ok(Array.isArray(status.json.models) && status.json.models.every(function (model) { return model.id; }));
    assert.ok(!status.json.models.some(function (model) { return model.id === 'anima-yume-v1.0'; }), 'unreviewed Yume must not be discoverable');
    assert.ok(status.json.loras.some(function (lora) { return lora.id === 'L_NENE_V20_ANIMA'; }));
    assert.ok(!status.json.loras.some(function (lora) { return lora.id === 'L_NENE_V19_ANIMA'; }), 'superseded v19 must not remain selectable');

    var arbitraryWorkflow = await postJson(port, '/api/anima/jobs', { prompt:{ '1':{ class_type:'ReadFile', inputs:{ path:'C:/secret' } } } });
    assert.strictEqual(arbitraryWorkflow.status, 400, 'raw workflow graph must be rejected');
    assert.ok(['INVALID_PARAMETER', 'MISSING_PARAMETER'].includes(arbitraryWorkflow.json.code));

    var unknownKey = await postJson(port, '/api/anima/jobs', Object.assign(validJob(), { workflow:{} }));
    assert.strictEqual(unknownKey.status, 400);
    assert.strictEqual(unknownKey.json.code, 'UNKNOWN_PARAMETER');

    var unknownModel = await postJson(port, '/api/anima/jobs', validJob({ modelId:'unknown-model' }));
    assert.strictEqual(unknownModel.status, 400);
    assert.strictEqual(unknownModel.json.code, 'UNKNOWN_MODEL');
    var browserProfile = await postJson(port, '/api/anima/jobs', validJob({ profileId:'anima_base_v10' }));
    assert.strictEqual(browserProfile.status, 400, 'profile metadata must be derived by the server, not accepted from the browser');
    assert.strictEqual(browserProfile.json.code, 'UNKNOWN_PARAMETER');
    var unreviewedYume = await postJson(port, '/api/anima/jobs', validJob({ modelId:'anima-yume-v1.0' }));
    assert.strictEqual(unreviewedYume.status, 400, 'unreviewed Yume must not be accepted as Base');
    assert.strictEqual(unreviewedYume.json.code, 'UNKNOWN_MODEL');

    var unknownLora = await postJson(port, '/api/anima/jobs', validJob({ loraId:'ayachi_nene_v18_wd14' }));
    assert.strictEqual(unknownLora.status, 400);
    assert.strictEqual(unknownLora.json.code, 'UNKNOWN_LORA');

    var wrongCharacter = await postJson(port, '/api/anima/jobs', validJob({ character:'natsume' }));
    assert.strictEqual(wrongCharacter.status, 400);
    assert.strictEqual(wrongCharacter.json.code, 'INCOMPATIBLE_CHARACTER');

    var oversized = await postJson(port, '/api/anima/jobs', validJob({ prompt:'x'.repeat(70000) }));
    assert.strictEqual(oversized.status, 413, 'oversized Anima JSON must be rejected before service submission');

    var created = await postJson(port, '/api/anima/jobs', validJob());
    assert.strictEqual(created.status, 202);
    assert.strictEqual(created.json.ok, true);
    assert.ok(created.json.job && created.json.job.id);
    assert.strictEqual(created.json.job.metadata.profileId, 'anima_base_v10');
    assert.strictEqual(created.json.job.metadata.modelId, 'anima-base-v1.0');
    assert.strictEqual(created.json.job.metadata.width, 832);
    assert.strictEqual(created.json.job.metadata.height, 1216);
    assert.strictEqual(created.json.job.prompt_id, undefined, 'Comfy prompt id must not cross the application boundary');
    var jobId = created.json.job.id;

    var state = await mockState(comfy.port);
    var promptCalls = state.calls.filter(function (call) { return call.path === '/prompt'; });
    assert.strictEqual(promptCalls.length, 1);
    assert.ok(promptCalls[0].body && promptCalls[0].body.prompt);
    assert.strictEqual(promptCalls[0].body.workflow, undefined);
    assert.deepStrictEqual(Object.keys(promptCalls[0].body.prompt).sort(), ['1','10','2','3','4','5','6','7','8','9'], 'workflow must keep the fixed ten-node shape');
    assert.strictEqual(promptCalls[0].body.prompt['7'].inputs.batch_size, 1);
    assert.strictEqual(promptCalls[0].body.prompt['1'].class_type, 'UNETLoader');
    assert.strictEqual(promptCalls[0].body.prompt['1'].inputs.unet_name, 'anima-base-v1.0.safetensors');

    var succeeded = await waitForJob(port, jobId, function (job) { return job && job.status === 'succeeded'; });
    assert.ok(succeeded.resultUrl && succeeded.resultUrl.indexOf('/api/anima/jobs/' + jobId + '/result') !== -1);
    var result = await request(port, { path:succeeded.resultUrl });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.headers['content-type'], 'image/png');
    assert.strictEqual(result.body[0], 137);
    await new Promise(function (resolve) { setTimeout(resolve, 20); });
    assert.strictEqual(fs.readdirSync(path.join(runtime.outputs, 'anima')).length, 0, 'normal result consumption must remove the runtime file');
    var consumedAgain = await request(port, { path:succeeded.resultUrl });
    assert.strictEqual(consumedAgain.status, 404, 'consumed result must not remain readable');

    await mockFault(comfy.port, { historyTransient:2, renderMs:10 });
    var transientJob = await postJson(port, '/api/anima/jobs', validJob({ seed:4243 }));
    assert.strictEqual(transientJob.status, 202);
    await waitForJob(port, transientJob.json.job.id, function (job) { return job && job.status === 'succeeded'; });
    state = await mockState(comfy.port);
    promptCalls = state.calls.filter(function (call) { return call.path === '/prompt'; });
    assert.strictEqual(promptCalls.length, 2, 'history polling failures must not resubmit the workflow');

    await mockFault(comfy.port, { renderMs:5000 });
    state = await mockState(comfy.port);
    var promptCountBeforeCancel = state.calls.filter(function (call) { return call.path === '/prompt'; }).length;
    var expectedCancelPromptId = 'mock-comfy-' + (promptCountBeforeCancel + 1);
    var cancelResponse = await postJson(port, '/api/anima/jobs', validJob({ seed:4244 }));
    assert.strictEqual(cancelResponse.status, 202);
    var cancelId = cancelResponse.json.job.id;
    var cancelled = await request(port, { method:'DELETE', path:'/api/anima/jobs/' + cancelId });
    assert.strictEqual(cancelled.status, 202, 'cancellation stays pending until upstream termination is confirmed');
    assert.strictEqual(cancelled.json.job.status, 'cancelling');
    var cancelledFinal = await waitForJob(port, cancelId, function (job) { return job && job.status === 'cancelled'; });
    assert.strictEqual(cancelledFinal.status, 'cancelled');
    state = await mockState(comfy.port);
    var targetedCancelCalls = state.calls.filter(function (call) {
      return call.path === '/api/jobs/' + expectedCancelPromptId + '/cancel';
    });
    assert.strictEqual(targetedCancelCalls.length, 1, 'cancellation must use the matching Comfy job id');

    await mockFault(comfy.port, { renderMs:5000 });
    var jobA = await postJson(port, '/api/anima/jobs', validJob({ seed:6001 }));
    var jobB = await postJson(port, '/api/anima/jobs', validJob({ seed:6002 }));
    assert.strictEqual(jobA.status, 202);
    assert.strictEqual(jobB.status, 202);
    var cancelledA = await request(port, { method:'DELETE', path:'/api/anima/jobs/' + jobA.json.job.id });
    assert.strictEqual(cancelledA.status, 202);
    await waitForJob(port, jobA.json.job.id, function (job) { return job && job.status === 'cancelled'; });
    await mockFault(comfy.port, { renderMs:0 });
    var successB = await waitForJob(port, jobB.json.job.id, function (job) { return job && job.status === 'succeeded'; });
    assert.strictEqual(successB.status, 'succeeded', 'cancelling A must not cancel B');

    await mockFault(comfy.port, { renderMs:5000 });
    var maxJobs = [];
    for (var maxIndex = 0; maxIndex < 4; maxIndex += 1) {
      var maxJob = await postJson(port, '/api/anima/jobs', validJob({ seed:6100 + maxIndex }));
      assert.strictEqual(maxJob.status, 202);
      maxJobs.push(maxJob.json.job.id);
    }
    var full = await postJson(port, '/api/anima/jobs', validJob({ seed:6199 }));
    assert.strictEqual(full.status, 429, 'MAX_PENDING must include all queued/running jobs');
    var cancelOne = await request(port, { method:'DELETE', path:'/api/anima/jobs/' + maxJobs[0] });
    assert.strictEqual(cancelOne.status, 202);
    var stillFull = await postJson(port, '/api/anima/jobs', validJob({ seed:6200 }));
    assert.strictEqual(stillFull.status, 429, 'cancelling jobs must continue occupying MAX_PENDING');
    await waitForJob(port, maxJobs[0], function (job) { return job && job.status === 'cancelled'; });
    await mockFault(comfy.port, { renderMs:0 });
    for (var remainingIndex = 1; remainingIndex < maxJobs.length; remainingIndex += 1) {
      await waitForJob(port, maxJobs[remainingIndex], function (job) { return job && job.status === 'succeeded'; });
    }

    var unsafeRefs = [
      { filename:'C:\\secret.png', subfolder:'', type:'output' },
      { filename:'%2e%2e%2fsecret.png', subfolder:'', type:'output' },
      { filename:'safe.png', subfolder:'input', type:'output' },
      { filename:'safe.png', subfolder:'temp', type:'output' },
      { filename:'annotation.png', subfolder:'', type:'output' },
      { filename:'hash.png', subfolder:'', type:'output' },
      { filename:'safe.png', subfolder:'junction-link', type:'output' }
    ];
    state = await mockState(comfy.port);
    var viewsBeforeUnsafe = state.calls.filter(function (call) { return call.path === '/view'; }).length;
    for (var r = 0; r < unsafeRefs.length; r += 1) {
      await mockFault(comfy.port, { renderMs:0, resultImage:unsafeRefs[r] });
      var unsafeJob = await postJson(port, '/api/anima/jobs', validJob({ seed:5000 + r }));
      assert.strictEqual(unsafeJob.status, 202);
      var failed = await waitForJob(port, unsafeJob.json.job.id, function (job) { return job && (job.status === 'failed' || job.status === 'cancelled'); });
      assert.strictEqual(failed.status, 'failed', 'unsafe result reference must fail closed');
    }
    state = await mockState(comfy.port);
    assert.strictEqual(state.calls.filter(function (call) { return call.path === '/view'; }).length, viewsBeforeUnsafe,
      'unsafe result references must not be forwarded to Comfy view');

    await mockFault(comfy.port, { renderMs:0, resultNode:'11' });
    var wrongNode = await postJson(port, '/api/anima/jobs', validJob({ seed:7001 }));
    assert.strictEqual(wrongNode.status, 202);
    var wrongNodeFailed = await waitForJob(port, wrongNode.json.job.id, function (job) { return job && job.status === 'failed'; });
    assert.strictEqual(wrongNodeFailed.code, 'COMFY_NO_IMAGE', 'only SaveImage node 10 may provide results');

    await mockFault(comfy.port, { renderMs:0, resultNode:'10', resultImage:{ filename:'other_prefix.png', subfolder:'', type:'output' } });
    var wrongPrefix = await postJson(port, '/api/anima/jobs', validJob({ seed:7002 }));
    assert.strictEqual(wrongPrefix.status, 202);
    var wrongPrefixFailed = await waitForJob(port, wrongPrefix.json.job.id, function (job) { return job && job.status === 'failed'; });
    assert.strictEqual(wrongPrefixFailed.code, 'INVALID_RESULT', 'only anima_app result files may be consumed');

    await mockFault(comfy.port, {});
    var finalState = await mockState(comfy.port);
    assert.ok(finalState.calls.every(function (call) {
      if (call.path === '/interrupt') return false;
      if (call.path === '/queue' && call.method === 'POST') return call.body && Array.isArray(call.body.delete);
      return true;
    }), 'gateway must never issue a global or legacy running interrupt operation');
    fs.writeFileSync(path.join(runtime.outputs, 'anima', 'orphan-close.png'), 'orphan');
    gateway.close();
    assert.strictEqual(fs.existsSync(path.join(runtime.outputs, 'anima', 'orphan-close.png')), false,
      'gateway close must remove runtime Anima result files');
  } finally {
    await stack.close();
  }
});

test('Anima runtime TTL removes an unconsumed result file', async function () {
  var stack = await gatewayTestStack.start({
    prefix:'aics-anima-ttl-',
    token:'anima-ttl-token-0123456789abcdef0123456789',
    createServices:function (context) {
      return {
        anima:createAnimaService(context.config, { jobTtlMs:1000, cancelPollIntervalMs:10 })
      };
    }
  });
  var runtime = stack.runtime;
  var port = stack.address.port;
  try {
    var created = await postJson(port, '/api/anima/jobs', validJob({ seed:8001 }));
    assert.strictEqual(created.status, 202);
    await waitForJob(port, created.json.job.id, function (job) { return job && job.status === 'succeeded'; });
    var resultRoot = path.join(runtime.outputs, 'anima');
    assert.ok(fs.readdirSync(resultRoot).length > 0, 'unconsumed result must exist before TTL');
    await new Promise(function (resolve) { setTimeout(resolve, 1500); });
    assert.strictEqual(fs.readdirSync(resultRoot).length, 0, 'TTL must delete the unconsumed runtime result');
    var expired = await request(port, { path:'/api/anima/jobs/' + created.json.job.id });
    assert.strictEqual(expired.status, 404, 'TTL must remove the expired job record');
  } finally {
    await stack.close();
  }
});

test('Anima cancellation failure releases the pending slot after a bounded timeout', async function () {
  var stack = await gatewayTestStack.start({
    prefix:'aics-anima-cancel-timeout-',
    token:'anima-cancel-token-0123456789abcdef012345',
    createServices:function (context) {
      return {
        anima:createAnimaService(context.config, { cancelPollIntervalMs:10, cancelTimeoutMs:100 })
      };
    }
  });
  var port = stack.address.port;
  var comfy = stack.upstreams.comfy;
  try {
    await mockFault(comfy.port, { renderMs:5000, cancelStatus:503, queueStatus:503 });
    var created = await postJson(port, '/api/anima/jobs', validJob({ seed:8101 }));
    assert.strictEqual(created.status, 202);
    var cancelled = await request(port, { method:'DELETE', path:'/api/anima/jobs/' + created.json.job.id });
    assert.strictEqual(cancelled.status, 202);
    var failed = await waitForJob(port, created.json.job.id, function (job) { return job && job.status === 'failed'; });
    assert.strictEqual(failed.code, 'ANIMA_CANCEL_FAILED');
    var status = await request(port, { path:'/api/anima/status' });
    assert.strictEqual(status.json.pending, 0, 'failed cancellation must not occupy MAX_PENDING forever');
  } finally {
    await stack.close();
  }
});
