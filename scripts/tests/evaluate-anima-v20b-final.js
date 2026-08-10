#!/usr/bin/env node
'use strict';

/* Final round: scientific Anima v20-b epochs 16 vs 20, extended scene matrix.
 * Scenes come from data/scenes.json; prompts are rebuilt in the same format
 * as the v19 visual matrix (quality prefix + safety + subject + identity +
 * story + scene tags, underscore tokens preserved for ayachi_nene, nene_*
 * and score_* tokens). */

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var animaRoute = require('../../routes/anima');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var COMFY = process.env.COMFY_HOST || 'http://127.0.0.1:8188';
var OUTPUT_ROOT = process.env.AICS_ANIMA_V20B_FINAL_DIR || path.join(
  AI_ROOT,
  'Reviews',
  'AnimaV20bFinal',
  '2026-08-10_e16_vs_e20'
);
var LORA_ROOT = path.join(AI_ROOT, 'ComfyUI', 'models', 'loras');
var SCENES = ['sc261', 'sc268', 'sc269', 'sc002', 'sc105', 'sc014', 'sc006'];
var SEEDS = [20260812, 20260813, 20260814];
var WIDTH = 1216;
var HEIGHT = 832;
var CANDIDATES = [
  { id:'b_e16', epoch:16, step:672, file:'ayachi_nene_v20_anima_scientific_b_e16.safetensors' },
  { id:'b_e20', epoch:20, step:840, file:'ayachi_nene_v20_anima_scientific_b_e20.safetensors' },
];
var CLIENT_ID = 'aics-anima-v20b-final-' + crypto.randomUUID();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  var temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, file);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function comfyUrl(pathname) {
  var base = new URL(COMFY);
  assert(base.protocol === 'http:' || base.protocol === 'https:', 'COMFY_HOST protocol is invalid');
  assert(['127.0.0.1', 'localhost', '::1'].includes(base.hostname), 'Final audit only allows a local ComfyUI host');
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

function preserved(token) {
  return /^(ayachi_nene|nene_|score_)/i.test(token);
}

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
  return SCENES.map(function (id) {
    var scene = byId.get(id);
    assert(scene, 'Unknown scene id: ' + id);
    return {
      id:id,
      title:String(scene.title || ''),
      mature:Boolean(scene.mature),
      prompt:animaPrompt(scene),
      negative:animaNegative(scene),
    };
  });
}

function checkedCandidates() {
  return CANDIDATES.map(function (candidate) {
    var file = path.join(LORA_ROOT, candidate.file);
    assert(fs.existsSync(file), 'Missing final LoRA: ' + file);
    return Object.assign({}, candidate, {
      bytes:fs.statSync(file).size,
      sha256:sha256File(file),
    });
  });
}

function workflowFor(scene, candidate, seed) {
  var workflow = animaRoute.buildWorkflow({
    prompt:scene.prompt,
    negative:scene.negative,
    modelId:'anima-base-v1.0',
    loraId:'L_NENE_V20_ANIMA',
    loraStrength:0.85,
    width:WIDTH,
    height:HEIGHT,
    steps:24,
    cfg:3,
    seed:seed,
    character:'nene',
  });
  workflow['4'].inputs.lora_name = candidate.file;
  workflow['10'].inputs.filename_prefix = [
    'anima_v20b_final', candidate.id, scene.id, 'seed-' + seed,
  ].join('/');
  return workflow;
}

async function main() {
  var scenes = buildScenes();
  var candidates = checkedCandidates();
  var manifestFile = path.join(OUTPUT_ROOT, 'manifest.json');
  var manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : {
    version:1,
    purpose:'Final round: v20-b epoch 16 vs epoch 20 on an extended scene matrix (sleepwear, R18 extreme angles, full body, witch props, swimsuit OOD, knitwear)',
    comfy:COMFY,
    settings:{ width:WIDTH, height:HEIGHT, steps:24, cfg:3, loraStrength:0.85, seeds:SEEDS },
    scenes:scenes,
    candidates:candidates,
    records:[],
  };
  manifest.scenes = scenes;
  manifest.candidates = candidates;

  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ outputRoot:OUTPUT_ROOT, scenes:scenes.map(function (s) { return s.id; }), candidates:candidates }, null, 2));
    return;
  }

  fs.mkdirSync(OUTPUT_ROOT, { recursive:true });
  for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    var candidate = candidates[candidateIndex];
    for (var sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
      var scene = scenes[sceneIndex];
      for (var seedIndex = 0; seedIndex < SEEDS.length; seedIndex += 1) {
        var seed = SEEDS[seedIndex];
        var existing = manifest.records.find(function (item) {
          return item.candidate === candidate.id && item.sceneId === scene.id && item.seed === seed && item.status === 'succeeded';
        });
        if (existing && fs.existsSync(path.join(OUTPUT_ROOT, existing.image))) continue;

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
        var outputFile = path.join(OUTPUT_ROOT, relative);
        fs.mkdirSync(path.dirname(outputFile), { recursive:true });
        fs.writeFileSync(outputFile, body);

        manifest.records = manifest.records.filter(function (item) {
          return !(item.candidate === candidate.id && item.sceneId === scene.id && item.seed === seed);
        });
        manifest.records.push({
          candidate:candidate.id,
          epoch:candidate.epoch,
          step:candidate.step,
          loraFile:candidate.file,
          loraSha256:candidate.sha256,
          sceneId:scene.id,
          seed:seed,
          image:relative.replace(/\\/g, '/'),
          bytes:body.length,
          sha256:sha256(body),
          promptId:submitted.prompt_id,
          startedAt:startedAt,
          finishedAt:new Date().toISOString(),
          status:'succeeded',
        });
        manifest.records.sort(function (a, b) {
          return a.sceneId.localeCompare(b.sceneId) || a.seed - b.seed || a.epoch - b.epoch;
        });
        writeJson(manifestFile, manifest);
        console.log(candidate.id + ' ' + scene.id + ' ' + seed + ': ' + outputFile);
      }
    }
  }
  manifest.finishedAt = new Date().toISOString();
  writeJson(manifestFile, manifest);
  console.log('Anima v20-b final manifest: ' + manifestFile);
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
