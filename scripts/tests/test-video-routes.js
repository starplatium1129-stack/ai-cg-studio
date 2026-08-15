'use strict';

var assert = require('assert/strict');
var fs = require('fs');
var os = require('os');
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
  assert.equal(input.quality, 'standard', 'quality defaults to standard');
  assert.equal(input.frames, 73);
  assert.match(input.prompt, /镜头缓慢推进/);
  assert.match(input.prompt, /细微运动/);
  assert.equal(video.validateInput(validBody({ quality:'fast' })).width, 608, 'fast quality uses 0.2MP canvas');
  assert.equal(video.validateInput(validBody({ quality:'fast' })).height, 352);
  assert.equal(video.validateInput(validBody({ quality:'fine' })).width, 960, 'fine quality uses 0.5MP canvas');
  assert.equal(video.validateInput(validBody({ quality:'fine', aspectRatio:'portrait' })).height, 960);
  assert.throws(function () {
    video.validateInput(validBody({ quality:'4k' }));
  }, /画质档位/);
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
  // format/codec 必须用官方模板的 'auto'：SaveVideo 的 codec 是动态 combo，
  // 对象值在真实执行会报 missing 'codec'（2026-08-15 真机实测）。
  assert.equal(graph['11'].inputs.format, 'auto');
  assert.equal(graph['11'].inputs.codec, 'auto');

  var h3Input = video.validateInput(validBody({ modelId:'minimax-h3' }));
  assert.equal(h3Input.frames, 73, 'H3 3s must snap to the 17k+5 grid (73)');
  assert.equal(h3Input.negative, '', 'H3 is a natural-language model; negative must stay empty');
  assert.match(h3Input.prompt, /^integrated_multimodal_description: \[Shot 1\]/,
    'H3 prompt must open with the official multimodal description field');
  assert.match(h3Input.prompt, /^overall_soundscape:/m, 'H3 prompt must carry the soundscape field');
  assert.match(h3Input.prompt, /^non_diegetic_music:/m, 'H3 prompt must carry the music field');
  assert.match(h3Input.prompt, /The camera pushes in at a slow, steady pace/,
    'H3 camera motion must be a natural English sentence (type + pace)');
  assert.match(h3Input.prompt, /subtle/);
  assert.equal(h3Input.prompt.indexOf('负向'), -1);
  assert.equal(h3Input.width, 832);
  assert.equal(h3Input.height, 480);
  assert.equal(video.validateInput(validBody({ modelId:'minimax-h3', duration:5 })).frames, 124,
    'H3 5s must snap to 124 frames');

  var h3Graph = video.buildWorkflow(h3Input);
  assert.equal(h3Graph['11'].class_type, 'SaveVideo');
  assert.equal(h3Graph['11'].inputs.format, 'auto');
  assert.equal(h3Graph['11'].inputs.codec, 'auto');
  assert.equal(h3Graph['5'].class_type, 'MiniMaxH3ImageToVideo');
  assert.equal(h3Graph['5'].inputs.length, 73);
  assert.equal(h3Graph['5'].inputs.width, 832);
  assert.equal(h3Graph['5'].inputs.height, 480);
  assert.equal(h3Graph['5'].inputs.first_frame, undefined, 'H3 T2V must not invent a first frame');
  assert.equal(h3Graph['2'].inputs.type, 'minimax');
  assert.equal(h3Graph['2'].inputs.clip_name, 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors');
  assert.equal(h3Graph['15'].class_type, 'LoraLoaderModelOnly', 'H3 must load the Turbo LoRA');
  assert.equal(h3Graph['15'].inputs.lora_name, 'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors');
  assert.equal(h3Graph['15'].inputs.strength_model, 1);
  assert.equal(h3Graph['16'].class_type, 'MiniMaxH3SigmaShift', 'H3 must apply the distilled sigma shifts');
  assert.equal(h3Graph['16'].inputs.shift_video, 12);
  assert.equal(h3Graph['16'].inputs.shift_audio, 3);
  assert.equal(h3Graph['7'].inputs.sampler_name, 'euler', 'Turbo H3 samples with euler');
  assert.equal(h3Graph['8'].inputs.steps, 8, 'Turbo H3 runs 8 distilled steps');
  assert.equal(h3Graph['9'].class_type, 'BasicGuider');
  assert.equal(h3Graph['9'].inputs.model[0], '16');
  assert.equal(h3Graph['8'].inputs.model[0], '16');
  assert.equal(h3Graph['10'].class_type, 'SamplerCustomAdvanced');
  assert.equal(h3Graph['13'].class_type, 'VAEDecodeAudio');
  assert.equal(h3Graph['14'].class_type, 'CreateVideo');
  assert.equal(h3Graph['14'].inputs.audio[0], '13');
  assert.equal(h3Graph['14'].inputs.images[0], '12');
  assert.equal(h3Graph['11'].inputs.video[0], '14');
  assert.equal(JSON.stringify(h3Graph).indexOf('CLIPTextEncode'), -1,
    'H3 graph must not contain a negative-text encoding node');

  // I2VA：首帧图参数与官方首帧指令（h3-prompt-writing base-en.txt 的 I2VA 格式）。
  var h3I2vInput = video.validateInput(validBody({
    modelId:'minimax-h3',
    image:'aics_video_input_abcdef0123456789.png',
  }));
  assert.match(h3I2vInput.prompt,
    /^For the target video, at 0\.00 seconds into the target video, <Picture 1> \(from \[Shot 1\]\) is fully referenced\./,
    'I2VA prompt must open with the official first-frame instruction');
  assert.match(h3I2vInput.prompt,
    /preserve the subject, clothing, hairstyle, and scene from <Picture 1>/);
  assert.match(h3I2vInput.prompt, /\b2D-animated, cinematic\b/, 'H3 prompt must open [Shot 1] with a style anchor (official 4.1)');
  assert.match(h3I2vInput.prompt, /^overall_soundscape:/m);
  assert.doesNotMatch(h3I2vInput.prompt, /fits the mood/, 'H3 music must not use abstract mood words (official 4.7)');
  assert.equal(h3I2vInput.image, 'aics_video_input_abcdef0123456789.png');
  assert.throws(function () {
    video.validateInput(validBody({ modelId:'minimax-h3', image:'../evil.png' }));
  }, /图片引用格式/);
  assert.throws(function () {
    video.validateInput(validBody({ modelId:'minimax-h3', image:'random.png' }));
  }, /图片引用格式/);
  assert.throws(function () {
    video.validateInput(validBody({ modelId:'minimax-h3', image:'aics_video_input_123.png' }));
  }, /图片引用格式/);

  var h3I2vGraph = video.buildWorkflow(h3I2vInput);
  assert.equal(h3I2vGraph['17'].class_type, 'LoadImage');
  assert.equal(h3I2vGraph['17'].inputs.image, 'aics_video_input_abcdef0123456789.png');
  assert.deepEqual(h3I2vGraph['5'].inputs.first_frame, ['17', 0],
    'I2VA graph must feed the uploaded first frame into MiniMaxH3ImageToVideo');

  // original 画幅：跟随首帧图比例（只读 PNG IHDR 宽高，不校验 CRC）。
  var fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-video-original-'));
  try {
    var fixtureConfig = { AI_WORKSPACE_ROOT: fixtureRoot, ROOT_DIR: path.resolve(__dirname, '..', '..') };
    var fixtureInputDir = path.join(fixtureRoot, 'ComfyUI', 'input');
    fs.mkdirSync(fixtureInputDir, { recursive:true });
    var tallPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    tallPng.writeUInt32BE(832, 16);
    tallPng.writeUInt32BE(1216, 20);
    var fixtureName = 'aics_video_input_' + 'a'.repeat(16) + '.png';
    fs.writeFileSync(path.join(fixtureInputDir, fixtureName), tallPng);

    var originalInput = video.validateInput(validBody({
      modelId:'minimax-h3', image:fixtureName, aspectRatio:'original',
    }), fixtureConfig);
    assert.equal(originalInput.width, 512, 'original follows the 832x1216 ratio at standard area');
    assert.equal(originalInput.height, 768);
    assert.equal(video.validateInput(validBody({
      modelId:'minimax-h3', image:fixtureName, aspectRatio:'original', quality:'fast',
    }), fixtureConfig).width, 384, 'fast original uses a smaller canvas');
    assert.equal(video.validateInput(validBody({
      modelId:'minimax-h3', image:fixtureName, aspectRatio:'original', quality:'fine',
    }), fixtureConfig).width, 608, 'fine original stays within the 16GB envelope');

    assert.throws(function () {
      video.validateInput(validBody({ modelId:'minimax-h3', aspectRatio:'original' }));
    }, /需要先上传首帧图/);
    assert.throws(function () {
      video.validateInput(validBody({ modelId:'minimax-h3', image:fixtureName, aspectRatio:'original' }));
    }, /缺少图片文件上下文/);
    assert.throws(function () {
      video.validateInput(validBody({ modelId:'minimax-h3', image:'aics_video_input_ffffffffffffffff.png', aspectRatio:'original' }), fixtureConfig);
    }, /不存在或已过期/);

    var originalGraph = video.buildWorkflow(originalInput);
    assert.equal(originalGraph['5'].inputs.width, 512);
    assert.equal(originalGraph['5'].inputs.height, 768);
    assert.deepEqual(originalGraph['5'].inputs.first_frame, ['17', 0]);
  } finally {
    fs.rmSync(fixtureRoot, { recursive:true, force:true });
  }
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
    assert.equal(status.qualities.length, 3, 'status must expose the three quality tiers');
    assert.equal(status.qualities[0].id, 'fast');
    assert.equal(status.qualities[1].id, 'standard');
    assert.equal(status.qualities[2].id, 'fine');
    assert.equal(status.qualities[1].sizes.landscape, '832 × 480');
    assert.equal(status.qualities[2].sizes.landscape, '960 × 544');
    var wan = status.models.find(function (model) { return model.id === 'wan2.2-ti2v-5b'; });
    assert.equal(wan.available, false);
    assert.deepEqual(wan.missing, [
      'diffusion_models/wan2.2_ti2v_5B_fp16.safetensors',
      'text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors',
      'vae/wan2.2_vae.safetensors',
    ]);
    var h3 = status.models.find(function (model) { return model.id === 'minimax-h3'; });
    assert.equal(h3.executable, true, 'H3 adapter must be executable once the workflow is wired');
    assert.equal(h3.available, false);
    assert.deepEqual(h3.missing, [
      'diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors',
      'text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
      'vae/minimax_h3_video_vae_fp16.safetensors',
      'vae/minimax_h3_audio_vae_fp32.safetensors',
      'loras/minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors',
    ]);
    var missingResponse = await post(missingStack.baseUrl, validBody());
    assert.equal(missingResponse.status, 503);
    assert.equal((await json(missingResponse)).code, 'VIDEO_MODEL_UNAVAILABLE');
    var h3MissingResponse = await post(missingStack.baseUrl, validBody({ modelId:'minimax-h3' }));
    assert.equal(h3MissingResponse.status, 503);
    assert.equal((await json(h3MissingResponse)).code, 'VIDEO_MODEL_UNAVAILABLE');
    var unknownResponse = await post(missingStack.baseUrl, validBody({ workflow:{} }));
    assert.equal(unknownResponse.status, 400);
    assert.equal((await json(unknownResponse)).code, 'UNKNOWN_PARAMETER');
  } finally {
    await missingStack.close();
  }

  var readyStack = await gatewayStack.start({
    prepare:function (context) {
      var root = path.join(context.config.AI_WORKSPACE_ROOT, 'ComfyUI', 'models');
      for (var model of video.constants.MODEL_CATALOG) {
        for (var requirement of model.requirements) {
          var dir = path.join(root, requirement[0]);
          fs.mkdirSync(dir, { recursive:true });
          fs.writeFileSync(path.join(dir, requirement[1]), requirement[1]);
        }
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

    var h3CreateResponse = await post(readyStack.baseUrl, validBody({ modelId:'minimax-h3' }));
    assert.equal(h3CreateResponse.status, 202);
    var h3Created = (await json(h3CreateResponse)).job;
    assert.equal(h3Created.modelId, 'minimax-h3');
    assert.equal(h3Created.width, 832);
    assert.equal(h3Created.height, 480);

    var h3State = await json(await fetch(readyStack.upstreams.comfy.url + '/__mock/state'));
    var h3PromptCall = h3State.calls.find(function (call) {
      return call.path === '/prompt'
        && call.body && call.body.prompt && call.body.prompt['5']
        && call.body.prompt['5'].class_type === 'MiniMaxH3ImageToVideo';
    });
    assert.ok(h3PromptCall, 'H3 submit must carry the native MiniMaxH3ImageToVideo graph');
    assert.equal(h3PromptCall.body.prompt['5'].inputs.length, 73);
    assert.equal(h3PromptCall.body.prompt['11'].class_type, 'SaveVideo');
    assert.equal(h3PromptCall.body.prompt['13'].class_type, 'VAEDecodeAudio');
    assert.equal(h3PromptCall.body.prompt['15'].class_type, 'LoraLoaderModelOnly');
    assert.equal(h3PromptCall.body.prompt['16'].class_type, 'MiniMaxH3SigmaShift');
    assert.equal(h3PromptCall.body.prompt['8'].inputs.steps, 8);

    var h3Finished = await waitForJob(readyStack.baseUrl, h3Created.id);
    assert.equal(h3Finished.status, 'succeeded');
    assert.equal(h3Finished.resultAvailable, true);

    // I2VA 全流程：上传首帧 → 提交带 image 的任务 → LoadImage + first_frame → 成功。
    var tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    var badUpload = await fetch(readyStack.baseUrl + '/api/video/images', {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ data:'aGVsbG8gd29ybGQ=' }),
    });
    assert.equal(badUpload.status, 400);
    assert.equal((await json(badUpload)).code, 'INVALID_IMAGE');
    var emptyUpload = await fetch(readyStack.baseUrl + '/api/video/images', {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body:JSON.stringify({}),
    });
    assert.equal(emptyUpload.status, 400);
    assert.equal((await json(emptyUpload)).code, 'INVALID_IMAGE');
    var uploadRes = await fetch(readyStack.baseUrl + '/api/video/images', {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ data:tinyPngBase64 }),
    });
    assert.equal(uploadRes.status, 200);
    var uploadBody = await json(uploadRes);
    assert.match(uploadBody.name, /^aics_video_input_[a-f0-9]{16}\.png$/, 'upload must return a controlled input filename');
    assert.equal(uploadBody.bytes, 70);

    var h3I2vCreate = await post(readyStack.baseUrl, validBody({
      modelId:'minimax-h3',
      image:uploadBody.name,
      prompt:'少女轻轻转头看向镜头',
    }));
    assert.equal(h3I2vCreate.status, 202, 'I2VA job with an uploaded image must submit');
    var h3I2vJob = (await json(h3I2vCreate)).job;
    var i2vState = await json(await fetch(readyStack.upstreams.comfy.url + '/__mock/state'));
    var i2vCall = i2vState.calls.find(function (call) {
      return call.path === '/prompt' && call.body && call.body.prompt && call.body.prompt['17']
        && call.body.prompt['17'].class_type === 'LoadImage';
    });
    assert.ok(i2vCall, 'I2VA submit must carry a LoadImage node');
    assert.equal(i2vCall.body.prompt['17'].inputs.image, uploadBody.name);
    assert.deepEqual(i2vCall.body.prompt['5'].inputs.first_frame, ['17', 0]);
    var i2vFinished = await waitForJob(readyStack.baseUrl, h3I2vJob.id);
    assert.equal(i2vFinished.status, 'succeeded');
    assert.equal(i2vFinished.resultAvailable, true);

    // original 画幅全流程：上传 832x1216 首帧 → 提交 original → 画布按比例计算。
    var tallUploadPng = Buffer.from(tinyPngBase64, 'base64');
    tallUploadPng.writeUInt32BE(832, 16);
    tallUploadPng.writeUInt32BE(1216, 20);
    var tallUpload = await fetch(readyStack.baseUrl + '/api/video/images', {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ data:tallUploadPng.toString('base64') }),
    });
    assert.equal(tallUpload.status, 200);
    var tallName = (await json(tallUpload)).name;
    var originalCreate = await post(readyStack.baseUrl, validBody({
      modelId:'minimax-h3',
      image:tallName,
      aspectRatio:'original',
      prompt:'少女轻轻转头看向镜头',
    }));
    assert.equal(originalCreate.status, 202, 'original-aspect I2VA job must submit');
    var originalJob = (await json(originalCreate)).job;
    assert.equal(originalJob.width, 512, 'job reports the ratio-fitted canvas');
    assert.equal(originalJob.height, 768);
    var originalState = await json(await fetch(readyStack.upstreams.comfy.url + '/__mock/state'));
    var originalCall = originalState.calls.find(function (call) {
      return call.path === '/prompt' && call.body && call.body.prompt && call.body.prompt['5']
        && call.body.prompt['5'].inputs.width === 512;
    });
    assert.ok(originalCall, 'original submit must carry the ratio-fitted width');
    assert.equal(originalCall.body.prompt['5'].inputs.height, 768);
    var originalFinished = await waitForJob(readyStack.baseUrl, originalJob.id);
    assert.equal(originalFinished.status, 'succeeded');

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
