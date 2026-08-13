'use strict';

var assert = require('assert/strict');
var fs = require('fs');
var path = require('path');
var gatewayStack = require('./gateway-test-stack');
var video = require('../../routes/video');

function validBody(overrides) {
  return Object.assign({
    prompt:'黄昏的电车站，少女回头看向镜头，风吹起发丝，暖色逆光。',
    modelId:'wan2.2-ti2v-5b',
    aspectRatio:'landscape',
    duration:3,
    camera:'push',
    motion:'subtle',
    seed:12345,
  }, overrides || {});
}

async function json(response) {
  return response.json();
}

async function post(base, body) {
  return fetch(base + '/api/video/jobs', {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body:JSON.stringify(body),
  });
}

async function waitForJob(base, id) {
  var deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    var result = await json(await fetch(base + '/api/video/jobs/' + encodeURIComponent(id)));
    if (result.job.status === 'succeeded' || result.job.status === 'failed') return result.job;
    await new Promise(function (resolve) { setTimeout(resolve, 40); });
  }
  throw new Error('video job did not finish');
}

async function run() {
  var input = video.validateInput(validBody());
  assert.equal(input.width, 832);
  assert.equal(input.height, 480);
  assert.equal(input.frames, 73);
  assert.match(input.prompt, /镜头缓慢推进/);
  assert.match(input.prompt, /细微运动/);
  assert.throws(function () {
    video.validateInput(validBody({ workflow:{} }));
  }, /不支持的参数/);
  assert.throws(function () {
    video.validateInput(validBody({ modelId:'ltx-2.3' }));
  }, /适配与实测/);
  assert.throws(function () {
    video.validateInput(validBody({ duration:8 }));
  }, /3 秒或 5 秒/);

  var graph = video.buildWorkflow(input);
  assert.equal(graph['1'].class_type, 'UNETLoader');
  assert.equal(graph['7'].class_type, 'Wan22ImageToVideoLatent');
  assert.equal(graph['7'].inputs.start_image, undefined, 'T2V graph must not invent an image input');
  assert.equal(graph['7'].inputs.length, 73);
  assert.equal(graph['8'].inputs.sampler_name, 'uni_pc');
  assert.equal(graph['10'].class_type, 'CreateVideo');
  assert.equal(graph['11'].class_type, 'SaveVideo');
  assert.equal(graph['11'].inputs.format, 'mp4');
  assert.deepEqual(graph['11'].inputs.codec, {
    codec:'h264',
    encoding:{ encoding:'re-encode', crf:20 },
  });
  assert.deepEqual(
    video.validateVideoReference({ filename:'aics_video_00001_.mp4', subfolder:'', type:'output' }),
    { filename:'aics_video_00001_.mp4', subfolder:'', type:'output' }
  );
  assert.throws(function () {
    video.validateVideoReference({ filename:'../aics_video.mp4', subfolder:'', type:'output' });
  }, /允许范围/);
  assert.throws(function () {
    video.validateVideoReference({ filename:'ComfyUI.mp4', subfolder:'', type:'output' });
  }, /前缀/);

  var missingStack = await gatewayStack.start();
  try {
    var status = await json(await fetch(missingStack.baseUrl + '/api/video/status'));
    assert.equal(status.online, true);
    var wan = status.models.find(function (model) { return model.id === 'wan2.2-ti2v-5b'; });
    assert.equal(wan.available, false);
    assert.deepEqual(wan.missing, [
      'diffusion_models/wan2.2_ti2v_5B_fp16.safetensors',
      'text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors',
      'vae/wan2.2_vae.safetensors',
    ]);
    var missingResponse = await post(missingStack.baseUrl, validBody());
    assert.equal(missingResponse.status, 503);
    assert.equal((await json(missingResponse)).code, 'VIDEO_MODEL_UNAVAILABLE');
    var unknownResponse = await post(missingStack.baseUrl, validBody({ workflow:{} }));
    assert.equal(unknownResponse.status, 400);
    assert.equal((await json(unknownResponse)).code, 'UNKNOWN_PARAMETER');
  } finally {
    await missingStack.close();
  }

  var readyStack = await gatewayStack.start({
    prepare:function (context) {
      var root = path.join(context.config.AI_WORKSPACE_ROOT, 'ComfyUI', 'models');
      for (var requirement of video.constants.MODEL_CATALOG[0].requirements) {
        var dir = path.join(root, requirement[0]);
        fs.mkdirSync(dir, { recursive:true });
        fs.writeFileSync(path.join(dir, requirement[1]), requirement[1]);
      }
    },
  });
  try {
    var readyStatus = await json(await fetch(readyStack.baseUrl + '/api/video/status'));
    assert.equal(readyStatus.models[0].available, true);
    var createResponse = await post(readyStack.baseUrl, validBody());
    assert.equal(createResponse.status, 202);
    var created = (await json(createResponse)).job;
    assert.equal(created.modelId, 'wan2.2-ti2v-5b');

    var comfyState = await json(await fetch(readyStack.upstreams.comfy.url + '/__mock/state'));
    var promptCall = comfyState.calls.find(function (call) { return call.path === '/prompt'; });
    assert.ok(promptCall);
    assert.equal(promptCall.body.prompt['11'].class_type, 'SaveVideo');
    assert.equal(promptCall.body.prompt['7'].inputs.width, 832);
    assert.equal(promptCall.body.prompt['7'].inputs.height, 480);

    var finished = await waitForJob(readyStack.baseUrl, created.id);
    assert.equal(finished.status, 'succeeded');
    assert.equal(finished.resultAvailable, true);
    var result = await fetch(readyStack.baseUrl + finished.resultUrl, {
      headers:{ Range:'bytes=0-7' },
    });
    assert.equal(result.status, 206);
    assert.equal(result.headers.get('content-type'), 'video/mp4');
    assert.equal(result.headers.get('content-range'), 'bytes 0-7/28');
    assert.equal((await result.arrayBuffer()).byteLength, 8);

    assert.equal((await fetch(readyStack.baseUrl + '/prompt')).status, 404);
    assert.equal((await fetch(readyStack.baseUrl + '/history/demo')).status, 404);
  } finally {
    await readyStack.close();
  }
}

if (require.main === module) {
  run().then(function () {
    console.log('test-video-routes: ok');
  }).catch(function (error) {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { run:run };
