#!/usr/bin/env node
'use strict';

/*
 * V-10 real-GPU matrix runner.
 * Run one engine per process so the operator can reserve the GPU explicitly.
 * Anima is submitted only through the production /api/anima/* contract.
 */

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var policy = require('../../src/utils/promptPolicy.ts');
var sdRequest = require('../../src/utils/sdRequest.ts');
var profiles = require('../../data/presets.json').model_profiles;

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var DEFAULT_OUTPUT = path.join(AI_ROOT, 'Reviews', 'AnimaV19VisualMatrix', '2026-08-09_6x3');
var GATEWAY = process.env.AICS_GPU_GATEWAY_URL || 'http://127.0.0.1:3000';
var SD_CHECKPOINT_TOKEN = 'waiillustrioussdxlv170';
var ANIMA_MODEL_ID = 'anima-base-v1.0';
var ANIMA_LORA_ID = 'L_NENE_V19_ANIMA';
var ANIMA_LORA_STRENGTH = 0.85;
var WIDTH = 1216;
var HEIGHT = 832;
var SEEDS = [20260809, 20260810, 20260811];
var SCENE_IDS = ['sc260', 'sc261', 'sc262', 'sc263', 'sc264', 'sc265'];
var MATRIX_VERSION = 'v19-visual-matrix-2026-08-09';
var NENE_IDENTITY = '1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons';
var DEFAULT_NEGATIVE = 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, extra arms, extra legs, deformed, cropped, duplicate';

function arg(name, fallback) {
  var index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) { return process.argv.indexOf(name) >= 0; }

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  var temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, file);
}

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

function relativeFile(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }

function dataUrlBuffer(value) {
  var match = String(value || '').match(/^data:image\/[^;]+;base64,(.+)$/i);
  if (!match) throw new Error('SD returned an invalid image data URL');
  return Buffer.from(match[1], 'base64');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestJson(url, options) {
  var response = await fetch(url, options);
  var text = await response.text();
  var data = null;
  try { data = text ? JSON.parse(text) : null; } catch (error) {}
  if (!response.ok) {
    throw new Error(url + ' returned HTTP ' + response.status + ': ' + text.slice(0, 500));
  }
  return { response:response, data:data };
}

async function requestImage(url) {
  var response = await fetch(url, { cache:'no-store' });
  var mime = String(response.headers.get('content-type') || '');
  if (!response.ok || !mime.startsWith('image/')) {
    throw new Error(url + ' returned non-image HTTP ' + response.status + ' (' + mime + ')');
  }
  var body = Buffer.from(await response.arrayBuffer());
  if (!body.length) throw new Error(url + ' returned an empty image');
  return { body:body, mime:mime };
}

function profile(id) {
  var result = profiles.find(function (item) { return item.id === id; });
  if (!result) throw new Error('Missing profile: ' + id);
  return result;
}

function productionPrompt(scene, modelProfile, engine) {
  var raw = [
    policy.qualityPrefix(modelProfile, scene, engine),
    NENE_IDENTITY,
    scene.story || '',
    scene.prompt || '',
  ].filter(Boolean).join(', ');
  return policy.formatPromptForProfile(raw, modelProfile, engine);
}

function productionNegative(scene, modelProfile, engine) {
  var sceneNegative = String(scene.negative || DEFAULT_NEGATIVE).trim();
  var merged = policy.modelNegativePrompt(modelProfile, sceneNegative, engine);
  return policy.formatPromptForProfile(merged, modelProfile, engine);
}

function makeSelection(scenes, output) {
  return {
    version:1,
    matrixVersion:MATRIX_VERSION,
    purpose:'V-10 real production v18/v19 visual audit; no public showcase replacement',
    gateway:GATEWAY,
    outputRoot:output,
    sceneIds:SCENE_IDS,
    scenes:scenes.map(function (scene) {
      return {
        id:scene.id,
        title:scene.title,
        rating:scene.rating || (scene.mature ? 'R18' : 'All'),
        mature:Boolean(scene.mature),
        recommendedSize:scene.recommendedSize || null,
        story:scene.story || '',
        coverage:scene.coverage || null
      };
    }),
    seeds:SEEDS,
    shared:{ width:WIDTH, height:HEIGHT, character:'nene' },
    sd:{ engine:'sd', family:'v18', checkpoint:'discovered from /sdapi/v1/options', steps:30, cfg:6, sampler:'Euler a', scheduler:'' },
    anima:{ engine:'anima', family:'v19', modelId:ANIMA_MODEL_ID, loraId:ANIMA_LORA_ID, loraStrength:ANIMA_LORA_STRENGTH, steps:24, cfg:3, sampler:'res_multistep', scheduler:'simple' },
    records:[]
  };
}

function loadOrCreateManifest(output, scenes) {
  var manifestFile = path.join(output, 'manifest.json');
  if (!fs.existsSync(manifestFile)) {
    var fresh = makeSelection(scenes, output);
    writeJson(manifestFile, fresh);
    return fresh;
  }
  var manifest = readJson(manifestFile);
  assert(manifest.matrixVersion === MATRIX_VERSION, 'Manifest version mismatch; use a new audit directory');
  assert(JSON.stringify(manifest.sceneIds) === JSON.stringify(SCENE_IDS), 'Manifest scene selection changed');
  assert(JSON.stringify(manifest.seeds) === JSON.stringify(SEEDS), 'Manifest seed selection changed');
  assert(manifest.shared && manifest.shared.width === WIDTH && manifest.shared.height === HEIGHT, 'Manifest shared size changed');
  return manifest;
}

function importSdBaseline(output, manifest, sourceRoot) {
  var source = readJson(path.join(sourceRoot, 'manifest.json'));
  assert(source.matrixVersion === MATRIX_VERSION, 'SD baseline matrix version mismatch');
  assert(JSON.stringify(source.sceneIds) === JSON.stringify(SCENE_IDS), 'SD baseline scene selection mismatch');
  assert(JSON.stringify(source.seeds) === JSON.stringify(SEEDS), 'SD baseline seed selection mismatch');
  var records = source.records.filter(function (record) { return record.engine === 'sd' && record.status === 'succeeded'; });
  assert(records.length === SCENE_IDS.length * SEEDS.length, 'Expected 18 SD baseline records, found ' + records.length);
  records.forEach(function (record) {
    var sourceFile = path.join(sourceRoot, record.image);
    var outputFile = path.join(output, record.image);
    assert(fs.existsSync(sourceFile), 'Missing SD baseline image: ' + record.image);
    assert(fs.statSync(sourceFile).size === record.bytes, 'SD baseline byte size mismatch: ' + record.image);
    assert(sha256(fs.readFileSync(sourceFile)) === record.sha256, 'SD baseline SHA256 mismatch: ' + record.image);
    fs.mkdirSync(path.dirname(outputFile), { recursive:true });
    if (!fs.existsSync(outputFile) || sha256(fs.readFileSync(outputFile)) !== record.sha256) fs.copyFileSync(sourceFile, outputFile);
    var imported = JSON.parse(JSON.stringify(record));
    imported.reusedFrom = sourceRoot;
    upsertRecord(manifest, imported);
  });
  manifest.runs = manifest.runs || {};
  manifest.runs.sd = Object.assign({}, source.runs && source.runs.sd || {}, {
    reusedFrom:sourceRoot,
    importedAt:new Date().toISOString(),
  });
  writeJson(path.join(output, 'manifest.json'), manifest);
}

function recordFor(manifest, engine, sceneId, seed) {
  return manifest.records.find(function (record) {
    return record.engine === engine && record.sceneId === sceneId && record.seed === seed;
  });
}

function upsertRecord(manifest, record) {
  var index = manifest.records.findIndex(function (item) {
    return item.engine === record.engine && item.sceneId === record.sceneId && item.seed === record.seed;
  });
  if (index >= 0) manifest.records[index] = record;
  else manifest.records.push(record);
  manifest.records.sort(function (a, b) {
    return a.sceneId.localeCompare(b.sceneId) || a.seed - b.seed || a.engine.localeCompare(b.engine);
  });
}

async function discoverSdCheckpoint() {
  var result = await requestJson(GATEWAY + '/sdapi/v1/options', { cache:'no-store' });
  var checkpoint = String(result.data && result.data.sd_model_checkpoint || '');
  assert(checkpoint.toLowerCase().replace(/[^a-z0-9]/g, '').includes(SD_CHECKPOINT_TOKEN), 'Expected WAI v17 checkpoint, found ' + (checkpoint || 'none'));
  return checkpoint;
}

async function discoverAnima() {
  var result = await requestJson(GATEWAY + '/api/anima/status', { cache:'no-store' });
  var data = result.data || {};
  assert(data.ok === true && data.online === true, 'Production Anima status is offline: ' + JSON.stringify(data));
  assert(Array.isArray(data.models) && data.models.some(function (item) { return item.id === ANIMA_MODEL_ID; }), 'Production Anima model is not discoverable');
  assert(Array.isArray(data.loras) && data.loras.some(function (item) { return item.id === ANIMA_LORA_ID; }), 'Production Anima LoRA is not discoverable');
  return data;
}

async function generateSd(scene, seed, checkpoint, sdProfile) {
  var prompt = productionPrompt(scene, sdProfile, 'sd');
  var negative = productionNegative(scene, sdProfile, 'sd');
  var built = sdRequest.buildTxt2ImgRequest({
    prompt:prompt,
    negative_prompt:negative,
    width:WIDTH,
    height:HEIGHT,
    cfg_scale:6,
    steps:30,
    sampler_name:'Euler a',
    seed:seed,
    model:checkpoint,
  });
  var result = await requestJson(GATEWAY + '/sdapi/v1/txt2img', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(built.payload)
  });
  var parsed = sdRequest.parseTxt2ImgResponse(result.data);
  return {
    body:dataUrlBuffer(parsed.image),
    metadata:{
      route:'/sdapi/v1/txt2img',
      checkpoint:checkpoint,
      prompt:built.payload.prompt,
      negative:built.payload.negative_prompt,
      width:built.payload.width,
      height:built.payload.height,
      steps:built.payload.steps,
      cfg:built.payload.cfg_scale,
      sampler:built.payload.sampler_name,
      scheduler:built.payload.scheduler || '',
      seed:seed,
      reportedSeed:parsed.seed,
      enhancements:built.enhancements,
    }
  };
}

async function waitAnima(jobId) {
  var deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    var result = await requestJson(GATEWAY + '/api/anima/jobs/' + encodeURIComponent(jobId), { cache:'no-store' });
    var job = result.data && result.data.job;
    assert(job, 'Production Anima status response did not contain a job');
    if (job.status === 'failed' || job.status === 'cancelled') throw new Error('Anima job ' + jobId + ' ended as ' + job.status + ': ' + JSON.stringify(job));
    if (job.status === 'succeeded' && job.resultAvailable && job.resultUrl) return job;
    await new Promise(function (resolve) { setTimeout(resolve, 1000); });
  }
  throw new Error('Anima job timed out: ' + jobId);
}

async function generateAnima(scene, seed, animaProfile) {
  var prompt = productionPrompt(scene, animaProfile, 'anima');
  var negative = productionNegative(scene, animaProfile, 'anima');
  var submitted = await requestJson(GATEWAY + '/api/anima/jobs', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({
      prompt:prompt,
      negative:negative,
      modelId:ANIMA_MODEL_ID,
      loraId:ANIMA_LORA_ID,
      loraStrength:ANIMA_LORA_STRENGTH,
      width:WIDTH,
      height:HEIGHT,
      steps:24,
      cfg:3,
      seed:seed,
      character:'nene'
    })
  });
  assert(submitted.data && submitted.data.ok && submitted.data.job && submitted.data.job.id, 'Production Anima submission did not return an application job');
  var job = await waitAnima(submitted.data.job.id);
  var image = await requestImage(GATEWAY + job.resultUrl);
  return {
    body:image.body,
    metadata:{
      route:'/api/anima/jobs',
      resultRoute:job.resultUrl,
      jobId:job.id,
      jobMetadata:job.metadata,
      prompt:prompt,
      negative:negative,
      modelId:ANIMA_MODEL_ID,
      loraId:ANIMA_LORA_ID,
      loraStrength:ANIMA_LORA_STRENGTH,
      width:WIDTH,
      height:HEIGHT,
      steps:24,
      cfg:3,
      sampler:'res_multistep',
      scheduler:'simple',
      seed:seed,
    }
  };
}

function imagePath(output, sceneId, seed, engine) {
  return path.join(output, 'images', sceneId, 'seed-' + seed + '-' + engine + '.png');
}

async function runEngine(engine, output, scenes, manifest) {
  var sdProfile = profile('wai_illustrious_v17');
  var animaProfile = profile('anima_base_v10');
  var checkpoint = engine === 'sd' ? await discoverSdCheckpoint() : null;
  if (engine === 'anima') await discoverAnima();
  manifest.generatedAt = manifest.generatedAt || new Date().toISOString();
  manifest.runs = manifest.runs || {};
  manifest.runs[engine] = { startedAt:new Date().toISOString(), gateway:GATEWAY };
  if (checkpoint) manifest.runs[engine].checkpoint = checkpoint;
  writeJson(path.join(output, 'manifest.json'), manifest);

  for (var sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
    var scene = scenes[sceneIndex];
    for (var seedIndex = 0; seedIndex < SEEDS.length; seedIndex += 1) {
      var seed = SEEDS[seedIndex];
      var existing = recordFor(manifest, engine, scene.id, seed);
      var file = imagePath(output, scene.id, seed, engine + (engine === 'sd' ? '-v18' : '-v19'));
      if (!hasFlag('--force') && existing && existing.status === 'succeeded' && fs.existsSync(path.join(output, existing.image)) && fs.statSync(path.join(output, existing.image)).size > 100000) {
        console.log('[reuse] ' + engine + ' ' + scene.id + ' seed ' + seed);
        continue;
      }
      var startedAt = new Date().toISOString();
      console.log('[start] ' + engine + ' ' + scene.id + ' seed ' + seed + ' (' + (sceneIndex * SEEDS.length + seedIndex + 1) + '/18)');
      var generated = engine === 'sd'
        ? await generateSd(scene, seed, checkpoint, sdProfile)
        : await generateAnima(scene, seed, animaProfile);
      fs.mkdirSync(path.dirname(file), { recursive:true });
      fs.writeFileSync(file, generated.body);
      upsertRecord(manifest, {
        engine:engine,
        family:engine === 'sd' ? 'v18' : 'v19',
        sceneId:scene.id,
        title:scene.title,
        rating:scene.rating || (scene.mature ? 'R18' : 'All'),
        mature:Boolean(scene.mature),
        seed:seed,
        image:relativeFile(output, file),
        bytes:generated.body.length,
        sha256:sha256(generated.body),
        status:'succeeded',
        startedAt:startedAt,
        finishedAt:new Date().toISOString(),
        metadata:generated.metadata
      });
      writeJson(path.join(output, 'manifest.json'), manifest);
      console.log('[saved] ' + relativeFile(output, file) + ' ' + generated.body.length + ' bytes');
    }
  }
  manifest.runs[engine].finishedAt = new Date().toISOString();
  writeJson(path.join(output, 'manifest.json'), manifest);
}

function validateSelection() {
  var scenes = readJson(path.join(ROOT, 'data', 'scenes.json'));
  var byId = new Map(scenes.map(function (scene) { return [scene.id, scene]; }));
  var selected = SCENE_IDS.map(function (id) { return byId.get(id); });
  assert(selected.every(Boolean), 'One or more fixed V-10 scenes are missing');
  assert(selected.every(function (scene) { return scene.char === 'nene' && Array.isArray(scene.character) && scene.character.length === 1 && scene.character[0] === 'nene'; }), 'V-10 scenes must be Nene-only');
  assert(new Set(SCENE_IDS).size === SCENE_IDS.length, 'V-10 scene IDs must be unique');
  return { all:scenes, selected:selected };
}

async function main() {
  var engine = String(arg('--engine', hasFlag('--dry-run') || hasFlag('--validate') ? 'sd' : '')).toLowerCase();
  assert(engine === 'sd' || engine === 'anima', 'Use exactly one engine per run: --engine sd or --engine anima');
  var output = path.resolve(arg('--output', DEFAULT_OUTPUT));
  var sdBaseline = arg('--reuse-sd-from', '');
  var selection = validateSelection();
  var manifest = loadOrCreateManifest(output, selection.selected);
  if (sdBaseline && !hasFlag('--dry-run')) importSdBaseline(output, manifest, path.resolve(sdBaseline));
  if (hasFlag('--dry-run')) {
    console.log(JSON.stringify({
      output:output,
      gateway:GATEWAY,
      engine:engine,
      sceneIds:SCENE_IDS,
      seeds:SEEDS,
      reuseSdFrom:sdBaseline || null,
      shared:{ width:WIDTH, height:HEIGHT },
      anima:{ route:'/api/anima/jobs', modelId:ANIMA_MODEL_ID, loraId:ANIMA_LORA_ID },
      sd:{ route:'/sdapi/v1/txt2img', checkpointToken:SD_CHECKPOINT_TOKEN },
    }, null, 2));
    return;
  }
  if (hasFlag('--validate')) {
    var expected = SCENE_IDS.length * SEEDS.length * 2;
    var successful = manifest.records.filter(function (record) { return record.status === 'succeeded'; });
    assert(successful.length === expected, 'Expected ' + expected + ' successful records, found ' + successful.length);
    successful.forEach(function (record) {
      var file = path.join(output, record.image);
      assert(fs.existsSync(file), 'Missing ' + record.image);
      assert(fs.statSync(file).size === record.bytes, 'Byte size mismatch for ' + record.image);
      assert(sha256(fs.readFileSync(file)) === record.sha256, 'SHA256 mismatch for ' + record.image);
    });
    console.log(JSON.stringify({ output:output, records:successful.length, status:'valid' }, null, 2));
    return;
  }
  await runEngine(engine, output, selection.selected, manifest);
  console.log(JSON.stringify({ output:output, engine:engine, records:manifest.records.filter(function (record) { return record.engine === engine && record.status === 'succeeded'; }).length }, null, 2));
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
