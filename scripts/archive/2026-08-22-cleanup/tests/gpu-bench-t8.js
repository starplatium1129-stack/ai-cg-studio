'use strict';
// T8 双时钟采样基准：pruned 模型 + 4step turbo LoRA + DualClockSamplerT8。
// 对照：standard 5s 8步 lightx2v-8step 基线 228s。
var fs = require('fs');
var path = require('path');
var http = require('http');
var COMFY = 'http://127.0.0.1:8188';
var CLIENT = 'aics-gpu-t8bench';
function req(method, url, body) {
  return new Promise(function (resolve, reject) {
    var u = new URL(COMFY + url);
    var payload = body ? Buffer.from(JSON.stringify(body)) : null;
    var r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: method, headers: payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {} }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { resolve({ status: res.statusCode, body: Buffer.concat(chunks) }); });
    });
    r.on('error', reject);
    r.setTimeout(60000, function () { r.destroy(new Error('request timeout')); });
    if (payload) r.write(payload);
    r.end();
  });
}
function buildGraph(input) {
  var prompt = input.prompt;
  var graph = {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: 'minimax_h3_fl2va_pruned_int8_convrot.safetensors', weight_dtype: 'default' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', type: 'minimax', device: 'default' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'minimax_h3_video_vae_fp16.safetensors' } },
    '4': { class_type: 'VAELoader', inputs: { vae_name: 'minimax_h3_audio_vae_fp32.safetensors' } },
    '5': { class_type: 'MiniMaxH3AudioConditioningT8', inputs: {
      clip: ['2', 0], video_vae: ['3', 0], audio_vae: ['4', 0],
      prompt: prompt,
      width: input.width, height: input.height, length: input.frames,
      task_type: input.image ? 'I2VA' : 'T2VA',
      audio_mode: 'native', audio_denoise_strength: 1,
      add_source_as_reference: false, prompt_primary_audio_ordinal: 0,
      strict_prompt_tags: true, ref_image_size: 'match', reference_video_policy: 'official_2_to_15s',
    } },
    '15': { class_type: 'LoraLoaderBypassModelOnly', inputs: {
      model: ['1', 0],
      lora_name: 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors',
      strength_model: 1,
    } },
    '16': { class_type: 'MiniMaxH3DualClockSamplerT8', inputs: {
      model: ['15', 0], av_latent: ['5', 1],
      steps: input.steps, shift_video: 12, shift_audio: 3,
    } },
    '6': { class_type: 'RandomNoise', inputs: { noise_seed: input.seed } },
    '9': { class_type: 'BasicGuider', inputs: { model: ['16', 0], conditioning: ['5', 0] } },
    '10': { class_type: 'SamplerCustomAdvanced', inputs: {
      noise: ['6', 0], guider: ['9', 0], sampler: ['16', 1], sigmas: ['16', 2], latent_image: ['5', 1],
    } },
    '12': { class_type: 'MiniMaxH3AVDecodeT8', inputs: { av_latent: ['10', 0], video_vae: ['3', 0], audio_vae: ['4', 0] } },
    '14': { class_type: 'CreateVideo', inputs: { images: ['12', 0], audio: ['12', 1], fps: 24, bit_depth: 8 } },
    '11': { class_type: 'SaveVideo', inputs: { video: ['14', 0], filename_prefix: 'aics_video', format: 'auto', codec: 'auto' } },
  };
  if (input.image) {
    graph['17'] = { class_type: 'LoadImage', inputs: { image: input.image } };
    graph['5'].inputs.first_frame = ['17', 0];
  }
  return graph;
}
async function runJob(label, input) {
  var graph = buildGraph(input);
  var submitted = await req('POST', '/prompt', { prompt: graph, client_id: CLIENT });
  if (submitted.status !== 200) { console.error('[' + label + '] submit failed', submitted.status, submitted.body.toString('utf8', 0, 500)); return null; }
  var promptId = JSON.parse(submitted.body.toString('utf8')).prompt_id;
  var t0 = Date.now();
  while (true) {
    await new Promise(function (r) { setTimeout(r, 10000); });
    var h = await req('GET', '/history/' + promptId);
    var entry = JSON.parse(h.body.toString('utf8'))[promptId];
    if (!entry) continue;
    var st = entry.status && entry.status.status_str;
    if (st === 'error' || st === 'failed') { console.error('[' + label + '] FAILED: ' + JSON.stringify(entry.status).slice(0, 800)); return null; }
    if (st === 'success') {
      var secs = Math.round((Date.now() - t0) / 1000);
      console.log('[' + label + '] succeeded in ' + secs + 's');
      var out = entry.outputs['11'];
      var vids = (out && (out.videos || out.images)) || [];
      if (vids.length) {
        var view = await req('GET', '/view?filename=' + encodeURIComponent(vids[0].filename) + '&type=output');
        fs.writeFileSync('E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review\\' + label + '.mp4', view.body);
        console.log('[' + label + '] saved ' + view.body.length + ' bytes');
      }
      return secs;
    }
  }
}
function frames(seconds) {
  var count = Math.max(5, Math.round(seconds * 24));
  return count + (5 - (count % 17)) % 17;
}
async function main() {
  var base = {
    prompt: 'A girl with long silver hair stands on a rain-soaked rooftop at night, wind blowing her hair and coat, she slowly turns her head toward the camera, city lights glowing behind her.',
  };
  var t1 = await runJob('t8-std-5s-4step', Object.assign({}, base, { width: 832, height: 480, frames: frames(5), steps: 4, seed: 21 }));
  var t2 = await runJob('t8-std-5s-8step', Object.assign({}, base, { width: 832, height: 480, frames: frames(5), steps: 8, seed: 22 }));
  var t3 = await runJob('t8-fast-5s-4step', Object.assign({}, base, { width: 608, height: 352, frames: frames(5), steps: 4, seed: 23 }));
  console.log('T8 BENCH: std4=' + t1 + 's std8=' + t2 + 's fast4=' + t3 + 's (基线 std 8步 228s)');
  console.log('T8 BENCH DONE');
}
main().catch(function (e) { console.error(e); process.exitCode = 1; });
