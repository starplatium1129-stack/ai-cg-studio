#!/usr/bin/env node
'use strict';

/* One-variable E08 ordinary-fullbody prompt A/B. */
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var COMFY = process.env.COMFY_HOST || 'http://127.0.0.1:8188';
var SOURCE_MATRIX = path.join(AI_ROOT, 'Reviews', 'AnimaNatsumeV19ProductMatrix', '2026-08-09');
var OUTPUT_ROOT = process.env.AICS_NATSUME_V19_ORDINARY_AB_DIR || path.join(AI_ROOT, 'Reviews', 'AnimaNatsumeV19OrdinaryFullbodyAB', '2026-08-10');
var LORA_FILE = 'shiki_natsume_v19_anima_e08.safetensors';
var SCENE = { id:'ordinary_fullbody', label:'普通全身', safe:true, prompt:'full body, standing, casual clothes, natural body proportions, bookstore interior, warm afternoon light' };
var SEEDS = [20260809, 20260810, 20260811];
var CLIENT_ID = 'aics-natsume-v19-ordinary-ab-' + crypto.randomUUID();

function assert(condition, message) { if (!condition) throw new Error(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive:true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function localUrl(pathname) {
  var base = new URL(COMFY);
  assert(['127.0.0.1', 'localhost', '::1'].includes(base.hostname), 'A/B only permits local ComfyUI');
  return new URL(pathname, base).toString();
}
async function jsonRequest(pathname, options) {
  var response = await fetch(localUrl(pathname), options);
  var text = await response.text();
  var data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(pathname + ' HTTP ' + response.status + ': ' + text.slice(0, 500));
  return data;
}
function identity() { return 'shiki_natsume, very long black hair, golden yellow eyes, two red hairclips, mole under eye'; }
function basePrompt() { return ['masterpiece, best quality, score_7', 'safe', '1girl, solo', identity(), SCENE.prompt].join(', '); }
function correctedPrompt() {
  var composition = 'full body, head to toe, feet visible, standing, long shot, camera pulled back, centered composition';
  return [basePrompt(), composition].join(', ');
}
function negative() { return 'worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, nsfw, nude, explicit, underwear, extra person'; }
function workflow(prompt, seed, variant) {
  return {
    '1':{ class_type:'UNETLoader', inputs:{ unet_name:'anima-base-v1.0.safetensors', weight_dtype:'default' } },
    '2':{ class_type:'CLIPLoader', inputs:{ clip_name:'qwen_3_06b_base.safetensors', type:'qwen_image' } },
    '3':{ class_type:'VAELoader', inputs:{ vae_name:'qwen_image_vae.safetensors' } },
    '4':{ class_type:'LoraLoader', inputs:{ model:['1', 0], clip:['2', 0], lora_name:LORA_FILE, strength_model:0.85, strength_clip:0.85 } },
    '5':{ class_type:'CLIPTextEncode', inputs:{ clip:['4', 1], text:prompt } },
    '6':{ class_type:'CLIPTextEncode', inputs:{ clip:['4', 1], text:negative() } },
    '7':{ class_type:'EmptyLatentImage', inputs:{ width:1216, height:832, batch_size:1 } },
    '8':{ class_type:'KSampler', inputs:{ model:['4', 0], positive:['5', 0], negative:['6', 0], latent_image:['7', 0], seed:seed, steps:24, cfg:3, sampler_name:'res_multistep', scheduler:'simple', denoise:1 } },
    '9':{ class_type:'VAEDecode', inputs:{ samples:['8', 0], vae:['3', 0] } },
    '10':{ class_type:'SaveImage', inputs:{ images:['9', 0], filename_prefix:'natsume_v19_ordinary_ab/' + variant + '/seed-' + seed } },
  };
}
async function waitFor(promptId) {
  var deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    var history = await jsonRequest('/history/' + encodeURIComponent(promptId), { cache:'no-store' });
    var entry = history && history[promptId];
    if (entry) {
      var failed = (entry.status && entry.status.messages || []).find(function (message) { return message && message[0] === 'execution_error'; });
      if (failed) throw new Error('ComfyUI execution failed: ' + JSON.stringify(failed));
      var image = entry.outputs && entry.outputs['10'] && entry.outputs['10'].images && entry.outputs['10'].images[0];
      if (image) return image;
    }
    await new Promise(function (resolve) { setTimeout(resolve, 1000); });
  }
  throw new Error('ComfyUI prompt timed out: ' + promptId);
}
async function generate(prompt, seed, variant) {
  var submitted = await jsonRequest('/prompt', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ prompt:workflow(prompt, seed, variant), client_id:CLIENT_ID }) });
  assert(submitted && submitted.prompt_id, 'ComfyUI returned no prompt id');
  var image = await waitFor(submitted.prompt_id);
  var query = new URLSearchParams({ filename:image.filename, subfolder:image.subfolder || '', type:image.type || 'output' });
  var response = await fetch(localUrl('/view?' + query.toString()));
  assert(response.ok && String(response.headers.get('content-type') || '').startsWith('image/'), 'ComfyUI returned non-image result');
  return { body:Buffer.from(await response.arrayBuffer()), promptId:submitted.prompt_id };
}
async function main() {
  var source = readJson(path.join(SOURCE_MATRIX, 'manifest.json'));
  var records = source.records.filter(function (item) { return item.candidate === 'wai_v18' && item.sceneId === SCENE.id && SEEDS.includes(item.seed); });
  assert(records.length === 3, 'expected 3 WAI baseline records');
  var manifestFile = path.join(OUTPUT_ROOT, 'manifest.json');
  var manifest = { version:1, purpose:'Single-variable E08 ordinary-fullbody positive-prompt A/B', checkpoint:'E08 step 312', loraFile:LORA_FILE, model:'anima-base-v1.0', scene:SCENE, seeds:SEEDS, fixed:{ width:1216, height:832, steps:24, cfg:3, sampler:'res_multistep', scheduler:'simple', negative:negative(), loraStrength:0.85 }, variants:{ baseline:'existing E08 ordinary_fullbody prompt', corrected:'scoped app policy composition helper' }, records:[] };
  fs.mkdirSync(path.join(OUTPUT_ROOT, 'baseline'), { recursive:true });
  records.forEach(function (record) {
    var sourceImage = path.join(SOURCE_MATRIX, record.image);
    var target = path.join(OUTPUT_ROOT, 'baseline', 'seed-' + record.seed + '-wai_v18.png');
    fs.copyFileSync(sourceImage, target);
    manifest.records.push({ variant:'wai_v18', seed:record.seed, image:path.relative(OUTPUT_ROOT, target).replace(/\\/g, '/'), sha256:sha256(fs.readFileSync(target)), source:sourceImage, prompt:record.metadata.prompt, status:'succeeded' });
  });
  for (var variant of ['baseline', 'corrected']) for (var seed of SEEDS) {
    var prompt = variant === 'baseline' ? basePrompt() : correctedPrompt();
    var relative = path.join(variant, 'seed-' + seed + '-e08.png').replace(/\\/g, '/');
    var target = path.join(OUTPUT_ROOT, relative);
    var generated = await generate(prompt, seed, variant);
    fs.mkdirSync(path.dirname(target), { recursive:true }); fs.writeFileSync(target, generated.body);
    manifest.records.push({ variant:variant, candidate:'e08', seed:seed, image:relative, sha256:sha256(generated.body), prompt:prompt, negative:negative(), promptId:generated.promptId, status:'succeeded' });
    writeJson(manifestFile, manifest); console.log(variant + ' ' + seed);
  }
  manifest.finishedAt = new Date().toISOString(); writeJson(manifestFile, manifest); console.log(manifestFile);
}
main().catch(function (error) { console.error(error && error.stack || error); process.exitCode = 1; });
