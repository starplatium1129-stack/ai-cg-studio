#!/usr/bin/env node
'use strict';

/*
 * Real-GPU checkpoint audit for Anima LoRAs that are not production-whitelisted.
 * Reuse the production workflow builder, then replace only the local LoRA filename.
 */
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var animaRoute = require('../../routes/anima');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var COMFY = process.env.COMFY_HOST || 'http://127.0.0.1:8188';
var SOURCE_ROOT = path.join(AI_ROOT, 'Reviews', 'AnimaV19VisualMatrix', '2026-08-09_6x3');
var OUTPUT_ROOT = process.env.AICS_ANIMA_CHECKPOINT_AUDIT_DIR || path.join(
  AI_ROOT,
  'Reviews',
  'AnimaV19CheckpointAudit',
  '2026-08-09_e10_e20'
);
var SCENE_IDS = ['sc260', 'sc261', 'sc262', 'sc263', 'sc264', 'sc265'];
var CANDIDATES = [
  { id:'e10', epoch:10, file:'ayachi_nene_v19_anima_e10.safetensors' },
  { id:'e20', epoch:20, file:'ayachi_nene_v19_anima_e20.safetensors' },
];
var CLIENT_ID = 'aics-anima-checkpoint-audit-' + crypto.randomUUID();

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

function comfyUrl(pathname) {
  var base = new URL(COMFY);
  assert(base.protocol === 'http:' || base.protocol === 'https:', 'COMFY_HOST protocol is invalid');
  assert(['127.0.0.1', 'localhost', '::1'].includes(base.hostname), 'Checkpoint audit only allows a local ComfyUI host');
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

function sourceRecords() {
  var manifest = readJson(path.join(SOURCE_ROOT, 'manifest.json'));
  var records = manifest.records.filter(function (record) {
    return record.engine === 'anima' && SCENE_IDS.includes(record.sceneId);
  });
  assert(records.length === SCENE_IDS.length * 3, 'Expected ' + (SCENE_IDS.length * 3) + ' source Anima records, found ' + records.length);
  return records;
}

function workflowFor(record, candidate) {
  var source = record.metadata && record.metadata.jobMetadata;
  assert(source && source.prompt && source.modelId, 'Source record is missing immutable job metadata');
  var workflow = animaRoute.buildWorkflow({
    prompt:source.prompt,
    negative:source.negative || '',
    modelId:source.modelId,
    loraId:'L_NENE_V20_ANIMA',
    loraStrength:source.loraStrength,
    width:source.width,
    height:source.height,
    steps:source.steps,
    cfg:source.cfg,
    seed:source.seed,
    character:'nene',
  });
  workflow['4'].inputs.lora_name = candidate.file;
  workflow['10'].inputs.filename_prefix = [
    'anima_checkpoint_audit', candidate.id, record.sceneId, 'seed-' + record.seed,
  ].join('/');
  return { source:source, workflow:workflow };
}

async function main() {
  var records = sourceRecords();
  var manifestFile = path.join(OUTPUT_ROOT, 'manifest.json');
  var manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : {
    version:1,
    purpose:'Compare preserved epoch 10/20 Anima LoRA checkpoints against the rejected epoch 45 production candidate',
    comfy:COMFY,
    sourceManifest:path.join(SOURCE_ROOT, 'manifest.json'),
    scenes:SCENE_IDS,
    candidates:CANDIDATES,
    records:[],
  };
  manifest.scenes = SCENE_IDS;
  manifest.candidates = CANDIDATES;

  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ outputRoot:OUTPUT_ROOT, sourceRecords:records.length, candidates:CANDIDATES }, null, 2));
    return;
  }

  fs.mkdirSync(OUTPUT_ROOT, { recursive:true });
  for (var candidateIndex = 0; candidateIndex < CANDIDATES.length; candidateIndex += 1) {
    var candidate = CANDIDATES[candidateIndex];
    for (var recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
      var record = records[recordIndex];
      var existing = manifest.records.find(function (item) {
        return item.candidate === candidate.id && item.sceneId === record.sceneId && item.seed === record.seed && item.status === 'succeeded';
      });
      if (existing && fs.existsSync(path.join(OUTPUT_ROOT, existing.image))) continue;

      var built = workflowFor(record, candidate);
      var startedAt = new Date().toISOString();
      var submitted = await requestJson('/prompt', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ prompt:built.workflow, client_id:CLIENT_ID }),
      });
      assert(submitted && submitted.prompt_id, 'ComfyUI did not return prompt_id');
      var image = await waitFor(submitted.prompt_id);
      var body = await requestImage(image);
      var relative = path.join('images', record.sceneId, 'seed-' + record.seed + '-' + candidate.id + '.png');
      var outputFile = path.join(OUTPUT_ROOT, relative);
      fs.mkdirSync(path.dirname(outputFile), { recursive:true });
      fs.writeFileSync(outputFile, body);

      manifest.records = manifest.records.filter(function (item) {
        return !(item.candidate === candidate.id && item.sceneId === record.sceneId && item.seed === record.seed);
      });
      manifest.records.push({
        candidate:candidate.id,
        epoch:candidate.epoch,
        loraFile:candidate.file,
        sceneId:record.sceneId,
        seed:record.seed,
        image:relative.replace(/\\/g, '/'),
        bytes:body.length,
        sha256:sha256(body),
        promptId:submitted.prompt_id,
        startedAt:startedAt,
        finishedAt:new Date().toISOString(),
        status:'succeeded',
        source:built.source,
      });
      manifest.records.sort(function (a, b) {
        return a.sceneId.localeCompare(b.sceneId) || a.seed - b.seed || a.epoch - b.epoch;
      });
      writeJson(manifestFile, manifest);
      console.log(candidate.id + ' ' + record.sceneId + ' ' + record.seed + ': ' + outputFile);
    }
  }
  manifest.finishedAt = new Date().toISOString();
  writeJson(manifestFile, manifest);
  console.log('Checkpoint audit manifest: ' + manifestFile);
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
