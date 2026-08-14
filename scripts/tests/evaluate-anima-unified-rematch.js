#!/usr/bin/env node
'use strict';

/* evaluate-anima-unified-rematch.js — 加赛：e12 vs e16 专项对比。
 *
 * 用户分歧点：① 魔女服场景（e12 在 sc105 3/3 不通过 vs e16 2/3）；
 * ② 脸部特写（用户认为 e16 的脸最好看）。
 *
 * A 组（魔女服）：sc105 + sc300 × 4 seeds
 * B 组（脸部特写）：自定义半身回眸特写 × 6 seeds
 * 参数：Aesthetic v1.1 + 官方参数组（30s/CFG4.5/er_sde/sgm_uniform），1216x832，LoRA 0.85。
 *
 * 用法：node scripts/tests/evaluate-anima-unified-rematch.js [--dry-run] [--concurrency <n>]
 */

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var animaRoute = require('../../routes/anima');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var COMFY = process.env.COMFY_HOST || 'http://127.0.0.1:8188';
var LORA_ROOT = path.join(AI_ROOT, 'ComfyUI', 'models', 'loras');
var WIDTH = 1216;
var HEIGHT = 832;
var LORA_STRENGTH = 0.85;
var MODEL_ID = 'anima-aesthetic-v1.1';
var STEPS = 30, CFG = 4.5, SAMPLER = 'er_sde', SCHEDULER = 'sgm_uniform';
var CLIENT_ID = 'aics-anima-rematch-' + crypto.randomUUID();
var CONCURRENCY = 4;

var CANDIDATES = [
  { id:'u_e12', epoch:12, step:504, file:'ayachi_nene_v20_anima_unified_e12.safetensors' },
  { id:'u_e16', epoch:16, step:672, file:'ayachi_nene_v20_anima_unified_e16.safetensors' },
];
var SEEDS_A = [20260816, 20260817, 20260818, 20260819];
var SEEDS_B = [20260816, 20260817, 20260818, 20260819, 20260820, 20260821];

var FACE_SCENE = {
  id: 'face01',
  title: '脸部特写：半身回眸凝视',
  mature: false,
  prompt: 'portrait, close-up, upper body, looking at viewer, blush, slight smile, soft lighting, simple background',
  negative: '',
};

function assert(condition, message) { if (!condition) throw new Error(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  var temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, file);
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256File(file) { return sha256(fs.readFileSync(file)); }

function comfyUrl(pathname) {
  var base = new URL(COMFY);
  assert(base.protocol === 'http:' || base.protocol === 'https:', 'COMFY_HOST protocol is invalid');
  assert(['127.0.0.1', 'localhost', '::1'].includes(base.hostname), 'Rematch only allows a local ComfyUI host');
  return new URL(pathname, base).toString();
}
async function requestJson(pathname, options) {
  var response = await fetch(comfyUrl(pathname), options);
  var text = await response.text();
  var data = null;
  try { data = text ? JSON.parse(text) : null; } catch (error) {}
  if (!response.ok) throw new Error(pathname + ' returned HTTP ' + response.status + ': ' + text.slice(0, 1000));
  return data;
}
async function requestImage(image) {
  var query = new URLSearchParams({
    filename:String(image.filename || ''),
    subfolder:String(image.subfolder || ''),
    type:String(image.type || 'output'),
  });
  var response = await fetch(comfyUrl('/view?' + query.toString()), { cache:'no-store' });
  var mime = String(response.headers.get('content-type') || '');
  assert(response.ok && mime.startsWith('image/'), 'ComfyUI result was not an image: HTTP ' + response.status + ' ' + mime);
  var body = Buffer.from(await response.arrayBuffer());
  assert(body.length > 0, 'ComfyUI returned an empty image');
  return body;
}
async function waitFor(promptId) {
  var deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    var history = await requestJson('/history/' + encodeURIComponent(promptId), { cache:'no-store' });
    var entry = history && history[promptId];
    if (entry) {
      var messages = entry.status && entry.status.messages || [];
      var failed = messages.find(function (message) { return message && message[0] === 'execution_error'; });
      if (failed) throw new Error('ComfyUI execution failed: ' + JSON.stringify(failed));
      var images = entry.outputs && entry.outputs['10'] && entry.outputs['10'].images;
      if (Array.isArray(images) && images[0]) return images[0];
    }
    await new Promise(function (resolve) { setTimeout(resolve, 1000); });
  }
  throw new Error('ComfyUI prompt timed out: ' + promptId);
}

function preserved(token) { return /^(ayachi_nene|nene_|score_)/i.test(token); }
function spaced(token) {
  if (preserved(token)) return token;
  if (/^(safe|nsfw|sensitive|explicit|1girl|1boy|solo)$/i.test(token)) return token.toLowerCase();
  return token.replace(/_/g, ' ');
}
function animaPrompt(scene) {
  var safety = scene.mature ? 'nsfw' : 'safe';
  var story = String(scene.story || '').trim();
  var body = String(scene.prompt || '')
    .replace(/<lora:[^>]+>/gi, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/_BREAK_/gi, ' BREAK ')
    .split(',').map(function (tag) { return tag.trim(); }).filter(Boolean)
    .map(spaced).join(', ');
  return ['masterpiece, best_quality, score_7', safety, '1girl, solo, ayachi_nene',
    'white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons',
    story, body].filter(Boolean).join(', ');
}
function animaNegative(scene) {
  var tail = String(scene.negative || '')
    .replace(/<lora:[^>]+>/gi, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/_BREAK_/gi, ' BREAK ')
    .split(',').map(function (tag) { return tag.trim(); }).filter(Boolean)
    .map(spaced).join(', ');
  return ['worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration',
    tail].filter(Boolean).join(', ');
}

function buildScenes() {
  var library = readJson(path.join(ROOT, 'data', 'scenes.json'));
  var byId = new Map(library.map(function (scene) { return [scene.id, scene]; }));
  var fromLibrary = ['sc105', 'sc300'].map(function (id) {
    var scene = byId.get(id);
    assert(scene, 'Unknown scene id: ' + id);
    return {
      id:id, title:String(scene.title || ''), mature:Boolean(scene.mature),
      prompt:animaPrompt(scene), negative:animaNegative(scene),
    };
  });
  var face = {
    id: FACE_SCENE.id, title: FACE_SCENE.title, mature: false,
    prompt: animaPrompt(FACE_SCENE), negative: animaNegative(FACE_SCENE),
  };
  return { witch: fromLibrary, face: [face] };
}

function checkedCandidates() {
  return CANDIDATES.map(function (candidate) {
    var file = path.join(LORA_ROOT, candidate.file);
    assert(fs.existsSync(file), 'Missing LoRA: ' + file);
    return Object.assign({}, candidate, { bytes:fs.statSync(file).size, sha256:sha256File(file) });
  });
}

function workflowFor(scene, candidate, seed) {
  var workflow = animaRoute.buildWorkflow({
    prompt:scene.prompt,
    negative:scene.negative,
    modelId:MODEL_ID,
    loraId:'L_NENE_V20_ANIMA',
    loraStrength:LORA_STRENGTH,
    width:WIDTH, height:HEIGHT,
    steps:STEPS, cfg:CFG, sampler:SAMPLER, scheduler:SCHEDULER,
    seed:seed, character:'nene',
  });
  workflow['4'].inputs.lora_name = candidate.file;
  workflow['10'].inputs.filename_prefix = [
    'anima_unified_rematch', candidate.id, scene.id, 'seed-' + seed,
  ].join('/');
  return workflow;
}

async function main() {
  var scenes = buildScenes();
  var candidates = checkedCandidates();
  var outputRoot = path.join(AI_ROOT, 'Reviews', 'AnimaUnifiedSweep', '2026-08-14_rematch_e12_vs_e16');
  var manifestFile = path.join(outputRoot, 'manifest.json');
  var manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : {
    version:1,
    purpose:'Rematch: e12 vs e16 on witch scenes (sc105/sc300) + face close-up, Aesthetic v1.1 + official params',
    comfy:COMFY, modelId:MODEL_ID,
    settings:{ width:WIDTH, height:HEIGHT, steps:STEPS, cfg:CFG, sampler:SAMPLER, scheduler:SCHEDULER, loraStrength:LORA_STRENGTH },
    scenes: scenes.witch.concat(scenes.face),
    candidates:candidates,
    records:[],
  };
  manifest.scenes = scenes.witch.concat(scenes.face);
  manifest.candidates = candidates;

  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ outputRoot:outputRoot, scenes:manifest.scenes.map(function (s) { return s.id; }), candidates:candidates }, null, 2));
    return;
  }

  var pending = [];
  // A 组：witch 场景 × SEEDS_A
  scenes.witch.forEach(function (scene) {
    SEEDS_A.forEach(function (seed) {
      candidates.forEach(function (candidate) { pending.push({ candidate:candidate, scene:scene, seed:seed }); });
    });
  });
  // B 组：face 特写 × SEEDS_B
  scenes.face.forEach(function (scene) {
    SEEDS_B.forEach(function (seed) {
      candidates.forEach(function (candidate) { pending.push({ candidate:candidate, scene:scene, seed:seed }); });
    });
  });
  // 断点：跳过已成功
  pending = pending.filter(function (job) {
    var existing = manifest.records.find(function (item) {
      return item.candidate === job.candidate.id && item.sceneId === job.scene.id && item.seed === job.seed && item.status === 'succeeded';
    });
    return !(existing && fs.existsSync(path.join(outputRoot, existing.image)));
  });
  console.log('待生成: ' + pending.length + ' 张（A 组 ' + (scenes.witch.length * SEEDS_A.length * candidates.length) + ' + B 组 ' + (scenes.face.length * SEEDS_B.length * candidates.length) + '），并发窗口: ' + CONCURRENCY);

  fs.mkdirSync(outputRoot, { recursive:true });
  var next = 0;
  async function runOne() {
    while (true) {
      var index = next;
      next += 1;
      if (index >= pending.length) return;
      var job = pending[index];
      var candidate = job.candidate, scene = job.scene, seed = job.seed;
      var workflow = workflowFor(scene, candidate, seed);
      var startedAt = new Date().toISOString();
      var submitted = await requestJson('/prompt', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ prompt:workflow, client_id:CLIENT_ID }),
      });
      assert(submitted && submitted.prompt_id, 'ComfyUI did not return prompt_id');
      var image = await waitFor(submitted.prompt_id);
      var body = await requestImage(image);
      var relative = path.join('images', scene.id, 'seed-' + seed + '-' + candidate.id + '.png');
      var outputFile = path.join(outputRoot, relative);
      fs.mkdirSync(path.dirname(outputFile), { recursive:true });
      fs.writeFileSync(outputFile, body);
      manifest.records = manifest.records.filter(function (item) {
        return !(item.candidate === candidate.id && item.sceneId === scene.id && item.seed === seed);
      });
      manifest.records.push({
        candidate:candidate.id, epoch:candidate.epoch, step:candidate.step,
        loraFile:candidate.file, loraSha256:candidate.sha256,
        sceneId:scene.id, sceneTitle:scene.title, mature:scene.mature,
        seed:seed, image:relative.replace(/\\/g, '/'), bytes:body.length,
        sha256:sha256(body), promptId:submitted.prompt_id,
        startedAt:startedAt, finishedAt:new Date().toISOString(), status:'succeeded',
      });
      manifest.records.sort(function (a, b) { return a.sceneId.localeCompare(b.sceneId) || a.seed - b.seed || a.epoch - b.epoch; });
      writeJson(manifestFile, manifest);
      console.log(candidate.id + ' ' + scene.id + ' ' + seed + ': ' + outputFile);
    }
  }
  var workers = [];
  for (var w = 0; w < Math.min(CONCURRENCY, pending.length || 1); w += 1) workers.push(runOne());
  await Promise.all(workers);
  manifest.finishedAt = new Date().toISOString();
  writeJson(manifestFile, manifest);
  console.log('Rematch done. Manifest: ' + manifestFile);
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
