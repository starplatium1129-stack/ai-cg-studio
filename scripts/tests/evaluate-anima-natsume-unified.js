#!/usr/bin/env node
'use strict';

/* Unified sweep: shiki_natsume_v20_anima_scientific_unified epochs 4..24.
 * Mirrors the Nene unified sweep protocol (2026-08-13/14): 7-scene matrix
 * (cafe uniform identity anchor, official qipao, identity close-up, ordinary
 * fullbody, complex lowlight, R18 fullbody, R18 intimate), fixed seeds,
 * 1216x832, LoRA 0.85, dual parameter groups: default (24s/CFG3/
 * res_multistep/simple) and official (30s/CFG4.5/er_sde/sgm_uniform, usually
 * with --model anima-aesthetic-v1.1).
 *
 * Usage: node scripts/tests/evaluate-anima-natsume-unified.js [--dry-run] [--params default|official] [--model anima-base-v1.0|anima-aesthetic-v1.1] [--concurrency <n>]
 */

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var animaRoute = require('../../routes/anima');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var COMFY = process.env.COMFY_HOST || 'http://127.0.0.1:8188';
var LORA_ROOT = path.join(AI_ROOT, 'ComfyUI', 'models', 'loras');
var SCENES = [
  { id:'cafe_uniform', label:'咖啡制服', mature:false,
    prompt:'natsume_cafe_uniform, full body, standing, white shirt, black suspenders, brown skirt, cafe interior, wooden counter, warm afternoon light, looking at viewer, gentle smile, medium shot',
    negative:'natsume_official_qipao, school uniform, winter coat, swimsuit, night, cold lighting, casual street clothes, extra person' },
  { id:'official_qipao', label:'官方旗袍', mature:false,
    prompt:'natsume_official_qipao, full body, standing, red dress, floral print, double bun, red flower hair accessory, side slit, black thighhighs, simple background, soft studio lighting, looking at viewer',
    negative:'natsume_cafe_uniform, school uniform, winter coat, casual clothes, night, complex background, extra person' },
  { id:'identity_closeup', label:'身份近景', mature:false,
    prompt:'close-up portrait, face focus, looking at viewer, calm reserved expression, cafe uniform collar visible, simple background, soft even lighting, upper body',
    negative:'full body, wide shot, complex background, night, motion blur, extra person' },
  { id:'ordinary_fullbody', label:'普通全身', mature:false,
    prompt:'full body, standing, casual clothes, plain cardigan and skirt, natural body proportions, bookstore interior, warm afternoon light, looking at viewer, gentle expression',
    negative:'natsume_cafe_uniform, natsume_official_qipao, winter coat, night, low light, swimsuit, extra person' },
  { id:'complex_lowlight', label:'复杂低光', mature:false,
    prompt:'natsume_winter_coat, upper body, holding a small birthday cake with both hands, dark entryway, candlelight, night, low light, face and red hairclips in sharp focus, warm flame glow',
    negative:'daylight, bright lighting, outdoor, full body, school uniform, extra person' },
  { id:'r18_fullbody', label:'R18 全身', mature:true,
    prompt:'natsume_r18, adult, nude, full body, standing, natural body proportions, accurate anatomy, simple bedroom background, soft even lighting',
    negative:'school uniform, cafe uniform, qipao, winter coat, child, loli, underage, extra person' },
  { id:'r18_intimate', label:'R18 亲密', mature:true,
    prompt:'natsume_r18, adult, lying on bed, cafe uniform shirt partially unbuttoned, bare shoulders, cleavage, black thighhighs, intimate close up, soft warm bedroom light, direct shy eye contact',
    negative:'school uniform, qipao, winter coat, full body standing, child, loli, underage, extra person' },
];
var SEEDS = [20260812, 20260813, 20260814];
var WIDTH = 1216;
var HEIGHT = 832;
var LORA_STRENGTH = 0.85;
var CLIENT_ID = 'aics-natsume-unified-' + crypto.randomUUID();
var CONCURRENCY = 4;

var PARAM_GROUPS = {
  default: { label:'24s_cfg3', steps:24, cfg:3, sampler:'res_multistep', scheduler:'simple' },
  official: { label:'30s_cfg45_ersde', steps:30, cfg:4.5, sampler:'er_sde', scheduler:'sgm_uniform' },
};

var CANDIDATES = [
  { id:'u_e04', epoch:4, step:156, file:'shiki_natsume_v20_anima_unified_e04.safetensors' },
  { id:'u_e08', epoch:8, step:312, file:'shiki_natsume_v20_anima_unified_e08.safetensors' },
  { id:'u_e12', epoch:12, step:468, file:'shiki_natsume_v20_anima_unified_e12.safetensors' },
  { id:'u_e16', epoch:16, step:624, file:'shiki_natsume_v20_anima_unified_e16.safetensors' },
  { id:'u_e20', epoch:20, step:780, file:'shiki_natsume_v20_anima_unified_e20.safetensors' },
  { id:'u_e24', epoch:24, step:936, file:'shiki_natsume_v20_anima_unified_e24.safetensors' },
];

function paramsGroup() {
  var raw = process.argv.find(function (a) { return a.startsWith('--params='); });
  var value = raw ? raw.split('=')[1] : (process.argv.includes('--params') ? process.argv[process.argv.indexOf('--params') + 1] : 'default');
  var group = PARAM_GROUPS[value];
  if (!group) throw new Error('Unknown --params group: ' + value + ' (default|official)');
  return group;
}

function concurrencyFromArgs() {
  var raw = process.argv.find(function (a) { return a.startsWith('--concurrency='); });
  var value = raw ? raw.split('=')[1] : (process.argv.includes('--concurrency') ? process.argv[process.argv.indexOf('--concurrency') + 1] : String(CONCURRENCY));
  var n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 32) throw new Error('--concurrency must be an integer 1..32, got: ' + value);
  return n;
}

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
  assert(['127.0.0.1', 'localhost', '::1'].includes(base.hostname), 'Sweep only allows a local ComfyUI host');
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
  return /^(shiki_natsume|natsume_|score_)/i.test(token);
}

function spaced(token) {
  if (preserved(token)) return token;
  if (/^(safe|nsfw|sensitive|explicit|1girl|1boy|solo)$/i.test(token)) return token.toLowerCase();
  return token.replace(/_/g, ' ');
}

function natsumePrompt(scene) {
  var safety = scene.mature ? 'nsfw' : 'safe';
  var body = String(scene.prompt || '')
    .replace(/[\r\n]+/g, ' ')
    .split(',').map(function (tag) { return tag.trim(); }).filter(Boolean)
    .map(spaced).join(', ');
  return ['masterpiece, best_quality, score_7', safety, '1girl, solo, shiki_natsume',
    'black hair, very long hair, golden yellow eyes, red hairclips, mole under eye', body]
    .filter(Boolean).join(', ');
}

function natsumeNegative(scene) {
  var tail = String(scene.negative || '')
    .replace(/[\r\n]+/g, ' ')
    .split(',').map(function (tag) { return tag.trim(); }).filter(Boolean)
    .map(spaced).join(', ');
  return ['worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration',
    tail].filter(Boolean).join(', ');
}

function buildScenes() {
  return SCENES.map(function (scene) {
    return {
      id:scene.id,
      title:String(scene.label || ''),
      mature:Boolean(scene.mature),
      prompt:natsumePrompt(scene),
      negative:natsumeNegative(scene),
    };
  });
}

function checkedCandidates() {
  var dryRun = process.argv.includes('--dry-run');
  return CANDIDATES.map(function (candidate) {
    var file = path.join(LORA_ROOT, candidate.file);
    if (!dryRun) assert(fs.existsSync(file), 'Missing unified LoRA: ' + file + '（训练完成后从 workspace/save 复制并改名到 ComfyUI loras 目录）');
    return Object.assign({}, candidate, {
      bytes:dryRun ? 0 : fs.statSync(file).size,
      sha256:dryRun ? '' : sha256File(file),
    });
  });
}

function workflowFor(scene, candidate, seed, group, modelId) {
  var workflow = animaRoute.buildWorkflow({
    prompt:scene.prompt,
    negative:scene.negative,
    modelId:modelId,
    loraId:'L_NAT_V20_ANIMA',
    loraStrength:LORA_STRENGTH,
    width:WIDTH,
    height:HEIGHT,
    steps:group.steps,
    cfg:group.cfg,
    sampler:group.sampler,
    scheduler:group.scheduler,
    seed:seed,
    character:'natsume',
  });
  workflow['4'].inputs.lora_name = candidate.file;
  workflow['10'].inputs.filename_prefix = [
    'anima_natsume_unified_sweep', group.label, candidate.id, scene.id, 'seed-' + seed,
  ].join('/');
  return workflow;
}

async function main() {
  var group = paramsGroup();
  var modelId = 'anima-base-v1.0';
  var modelRaw = process.argv.find(function (a) { return a.startsWith('--model='); });
  if (modelRaw) modelId = modelRaw.split('=')[1];
  else if (process.argv.includes('--model')) modelId = process.argv[process.argv.indexOf('--model') + 1];
  if (!['anima-base-v1.0', 'anima-aesthetic-v1.1'].includes(modelId)) {
    throw new Error('Unknown --model: ' + modelId + ' (anima-base-v1.0|anima-aesthetic-v1.1)');
  }
  var onlyRaw = process.argv.find(function (a) { return a.startsWith('--only='); });
  var only = null;
  if (onlyRaw) only = onlyRaw.split('=')[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  else if (process.argv.includes('--only')) only = process.argv[process.argv.indexOf('--only') + 1].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var outRootRaw = process.argv.find(function (a) { return a.startsWith('--out-root='); });
  var outRoot = outRootRaw ? outRootRaw.split('=')[1] : null;
  if (!outRoot && process.argv.includes('--out-root')) outRoot = process.argv[process.argv.indexOf('--out-root') + 1];

  var scenes = buildScenes();
  var candidates = checkedCandidates().filter(function (c) { return !only || only.includes(c.id); });
  var modelTag = modelId === 'anima-aesthetic-v1.1' ? '_aesthetic' : '';
  var outputRoot = outRoot || path.join(AI_ROOT, 'Reviews', 'AnimaNatsumeUnifiedSweep', '2026-08-14_' + group.label + modelTag);
  var manifestFile = path.join(outputRoot, 'manifest.json');
  var manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : {
    version:1,
    purpose:'Unified sweep: shiki_natsume_v20_anima_scientific_unified epochs on the Natsume scene matrix',
    comfy:COMFY,
    paramGroup:group.label,
    modelId:modelId,
    settings:{ width:WIDTH, height:HEIGHT, steps:group.steps, cfg:group.cfg, sampler:group.sampler, scheduler:group.scheduler, loraStrength:LORA_STRENGTH, seeds:SEEDS },
    scenes:scenes,
    candidates:candidates,
    records:[],
  };
  manifest.paramGroup = group.label;
  manifest.settings = { width:WIDTH, height:HEIGHT, steps:group.steps, cfg:group.cfg, sampler:group.sampler, scheduler:group.scheduler, loraStrength:LORA_STRENGTH, seeds:SEEDS };
  manifest.scenes = scenes;
  manifest.candidates = candidates;

  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ outputRoot:outputRoot, paramGroup:group.label, modelId:modelId, scenes:scenes.map(function (s) { return { id:s.id, title:s.title, mature:s.mature, prompt:s.prompt.slice(0, 120) + '…' }; }), candidates:candidates }, null, 2));
    return;
  }

  fs.mkdirSync(outputRoot, { recursive:true });
  var concurrency = concurrencyFromArgs();

  var pending = [];
  for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    var candidate = candidates[candidateIndex];
    for (var sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
      var scene = scenes[sceneIndex];
      for (var seedIndex = 0; seedIndex < SEEDS.length; seedIndex += 1) {
        var seed = SEEDS[seedIndex];
        var existing = manifest.records.find(function (item) {
          return item.candidate === candidate.id && item.sceneId === scene.id && item.seed === seed && item.status === 'succeeded';
        });
        if (existing && fs.existsSync(path.join(outputRoot, existing.image))) continue;
        pending.push({ candidate:candidate, scene:scene, seed:seed });
      }
    }
  }
  console.log('待生成: ' + pending.length + ' 张，并发窗口: ' + concurrency);

  var next = 0;
  async function runOne() {
    while (true) {
      var index = next;
      next += 1;
      if (index >= pending.length) return;
      var task = pending[index];
      var c = task.candidate;
      var s = task.scene;
      var seed = task.seed;
      try {
        var promptId = await requestJson('/prompt', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ prompt:workflowFor(s, c, seed, group, modelId), client_id:CLIENT_ID }),
        }).then(function (data) { return data.prompt_id; });
        var image = await waitFor(promptId);
        var body = await requestImage(image);
        var rel = path.join('images', s.id, 'seed-' + seed + '-' + c.id + '.png').replace(/\\/g, '/');
        var file = path.join(outputRoot, rel);
        fs.mkdirSync(path.dirname(file), { recursive:true });
        fs.writeFileSync(file, body);
        var entry = {
          candidate:c.id, epoch:c.epoch, step:c.step,
          loraFile:c.file, loraSha256:c.sha256,
          sceneId:s.id, sceneTitle:s.title, mature:s.mature,
          seed:seed, image:rel, bytes:body.length, sha256:sha256(body),
          promptId:promptId,
          startedAt:new Date(Date.now() - 15000).toISOString(),
          finishedAt:new Date().toISOString(),
          status:'succeeded',
        };
        manifest.records = manifest.records.filter(function (item) {
          return !(item.candidate === c.id && item.sceneId === s.id && item.seed === seed);
        });
        manifest.records.push(entry);
        writeJson(manifestFile, manifest);
        console.log('[ok] ' + c.id + ' ' + s.id + ' seed-' + seed + ' (' + body.length + ' bytes)');
      } catch (error) {
        console.error('[fail] ' + c.id + ' ' + s.id + ' seed-' + seed + ': ' + (error && error.message || error));
      }
    }
  }

  var workers = [];
  for (var w = 0; w < concurrency; w += 1) workers.push(runOne());
  await Promise.all(workers);

  manifest.finishedAt = new Date().toISOString();
  writeJson(manifestFile, manifest);
  var succeeded = manifest.records.filter(function (r) { return r.status === 'succeeded'; }).length;
  console.log('\n完成: ' + succeeded + '/' + manifest.records.length + ' 张成功 → ' + outputRoot);
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
