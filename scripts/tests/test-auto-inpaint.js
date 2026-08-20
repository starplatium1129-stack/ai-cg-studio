'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

function postJson(url, payload) {
  return new Promise(function (resolve, reject) {
    var u = new URL(url);
    var body = Buffer.from(JSON.stringify(payload));
    var req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length
      }
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8');
        try { resolve(JSON.parse(raw)); } catch (e) { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJson(url) {
  return new Promise(function (resolve, reject) {
    http.get(url, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8');
        try { resolve(JSON.parse(raw)); } catch (e) { resolve(raw); }
      });
    }).on('error', reject);
  });
}

async function waitForPrompt(promptId) {
  var start = Date.now();
  while (Date.now() - start < 120000) {
    var history = await getJson('http://127.0.0.1:8188/history/' + promptId);
    if (history && history[promptId]) {
      var status = history[promptId].status;
      var outputs = history[promptId].outputs;
      return { status: status, outputs: outputs, duration: (Date.now() - start) / 1000 };
    }
    await new Promise(function (r) { setTimeout(r, 300); });
  }
  throw new Error('Timeout waiting for prompt ' + promptId);
}

var comfyInputDir = 'E:/code/2/lora/AI/ComfyUI/input';
fs.mkdirSync(comfyInputDir, { recursive: true });
var sourceImg = 'E:/code/2/lora/AI/ComfyUI/output/bench_teacache_00001_.png';
var targetImgName = 'test_inpaint_source.png';
fs.copyFileSync(sourceImg, path.join(comfyInputDir, targetImgName));

var inpaintWorkflow = {
  // 1. Load Base Models
  '1': { class_type: 'UNETLoader', inputs: { unet_name: 'anima-base-v1.0.safetensors', weight_dtype: 'default' } },
  '2': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_06b_base.safetensors', type: 'qwen_image' } },
  '3': { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_vae.safetensors' } },

  // 2. Load Nene LoRA
  '4': { class_type: 'LoraLoader', inputs: {
    model: ['1', 0],
    clip: ['2', 0],
    lora_name: 'ayachi_nene_v21_anima.safetensors',
    strength_model: 0.85,
    strength_clip: 0.85
  } },

  // 3. Load Image & Auto-Segment Clothes
  '15': { class_type: 'LoadImage', inputs: { image: targetImgName } },
  '16': { class_type: 'AP_CLIPSeg_TextMask', inputs: {
    image: ['15', 0],
    prompt: 'clothes | shirt | dress | uniform | collar | sleeves',
    threshold: 0.35,
    smooth_radius: 4,
    soft_mask: true,
    invert: false,
    model: 'clipseg_rd64',
    mask_dilate: 8,
    mask_blur: 4,
    device: 'auto',
    unload_after_run: false
  } },

  // 4. Encode Image to Latent & Apply Noise Mask
  '18': { class_type: 'VAEEncode', inputs: {
    pixels: ['15', 0],
    vae: ['3', 0]
  } },
  '17': { class_type: 'SetLatentNoiseMask', inputs: {
    samples: ['18', 0],
    mask: ['16', 0]
  } },

  // 5. New outfit Prompt (Frilled Bikini)
  '5': { class_type: 'CLIPTextEncode', inputs: { clip: ['4', 1], text: 'ayachi_nene, 1girl, solo, smiling, wearing white frilled bikini, swimsuit, natural skin, cafe' } },
  '6': { class_type: 'CLIPTextEncode', inputs: { clip: ['4', 1], text: 'worst quality, low quality, clothes, sleeves, shirt' } },

  // 6. TeaCache Acceleration
  '13': { class_type: 'AnimaTeaCache', inputs: {
    model: ['4', 0],
    rel_l1_thresh: 0.08,
    start_percent: 0,
    end_percent: 1,
    cache_device: 'cuda'
  } },

  // 7. Inpaint Sampler (Denoise = 0.80 for new clothes)
  '8': { class_type: 'KSampler', inputs: {
    model: ['13', 0],
    positive: ['5', 0],
    negative: ['6', 0],
    latent_image: ['17', 0],
    seed: 4242,
    steps: 30,
    cfg: 4.5,
    sampler_name: 'res_multistep',
    scheduler: 'simple',
    denoise: 0.80
  } },

  // 8. Decode & Save
  '9': { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
  '10': { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: 'inpaint_swimsuit' } }
};

async function main() {
  console.log('--- Testing Auto-Segmentation Inpainting with VAEEncode + SetLatentNoiseMask ---');
  var res = await postJson('http://127.0.0.1:8188/prompt', { prompt: inpaintWorkflow, client_id: 'inpaint_test' });
  console.log('Submitted Inpaint prompt:', res.prompt_id);
  var t0 = Date.now();
  var out = await waitForPrompt(res.prompt_id);
  var dt = (Date.now() - t0) / 1000;
  console.log('Inpaint finished in ' + dt.toFixed(2) + 's');
  console.log('Outputs:', JSON.stringify(out.outputs));
}

main().catch(console.error);
