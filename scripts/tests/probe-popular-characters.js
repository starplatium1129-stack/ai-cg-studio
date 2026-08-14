#!/usr/bin/env node
'use strict';

/* probe-popular-characters.js — 实测 Anima aesthetic（无 LoRA）与 Krea 2 对 18 个热门角色的识别能力。
 *
 * 复用项目 popularContent.buildPopularPromptPlan 组装提示词（角色身份 tokens + 默认服装），
 * 经 routes/anima.js buildWorkflow 提交真实 ComfyUI，每角色每引擎 1 张，
 * 输出 manifest 供后续识别审核（audit-popular-probe.js）。
 *
 * 用法：node scripts/tests/probe-popular-characters.js [--dry-run] [--engine anima|krea2|both] [--concurrency <n>]
 */

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var animaRoute = require('../../routes/anima');
var popular = require('../../src/utils/popularContent.ts');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var COMFY = process.env.COMFY_HOST || 'http://127.0.0.1:8188';
var OUTPUT_ROOT = path.join(AI_ROOT, 'Reviews', 'PopularProbe', '2026-08-14');
var CLIENT_ID = 'aics-popular-probe-' + crypto.randomUUID();
var CONCURRENCY = 4;
var ANIMA_SIZE = [832, 1216];
var KREA_SIZE = [1024, 1536];
var SEED_BASE = 20260814;

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
  assert(['127.0.0.1', 'localhost', '::1'].includes(base.hostname), 'Probe only allows a local ComfyUI host');
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

function workflowFor(engine, prompt, negative, seed) {
  if (engine === 'anima') {
    var workflow = animaRoute.buildWorkflow({
      prompt: prompt,
      negative: negative,
      modelId: 'anima-aesthetic-v1.1',
      width: ANIMA_SIZE[0],
      height: ANIMA_SIZE[1],
      seed: seed,
      character: null,
    });
    workflow['10'].inputs.filename_prefix = ['popular_probe', 'anima', 'seed-' + seed].join('/');
    return workflow;
  }
  var krea = animaRoute.buildWorkflow({
    prompt: prompt,
    modelId: 'krea2-turbo-fp8',
    width: KREA_SIZE[0],
    height: KREA_SIZE[1],
    seed: seed,
    character: null,
  });
  krea['10'].inputs.filename_prefix = ['popular_probe', 'krea2', 'seed-' + seed].join('/');
  return krea;
}

async function main() {
  var engines = ['anima', 'krea2'];
  var rawEngine = process.argv.find(function (a) { return a.startsWith('--engine='); });
  if (rawEngine) {
    var value = rawEngine.split('=')[1];
    if (value === 'anima' || value === 'krea2') engines = [value];
    else if (value === 'both') engines = ['anima', 'krea2'];
    else throw new Error('Unknown --engine: ' + value);
  }
  var concIndex = process.argv.indexOf('--concurrency');
  if (concIndex >= 0) CONCURRENCY = Number(process.argv[concIndex + 1]);

  var characters = popular.parsePopularCharacters(readJson(path.join(ROOT, 'data', 'popular-characters.json')));
  console.log('角色数: ' + characters.length + '，引擎: ' + engines.join(', '));

  var manifestFile = path.join(OUTPUT_ROOT, 'manifest.json');
  var manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : {
    version: 1,
    purpose: 'Popular character recognition probe: Anima aesthetic v1.1 (no LoRA) vs Krea 2, default outfit, one image per character per engine',
    comfy: COMFY,
    engines: engines,
    records: [],
  };
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ outputRoot: OUTPUT_ROOT, engines: engines, characters: characters.map(function (c) { return c.id; }) }, null, 2));
    return;
  }

  // 构建任务：角色 × 引擎
  var pending = [];
  characters.forEach(function (character, index) {
    var outfit = popular.defaultOutfit(character);
    engines.forEach(function (engine) {
      var built = popular.buildPopularPromptPlan({
        character: character,
        outfit: outfit,
        blueprint: null,
        engine: engine,
        profile: null,
        adultEnabled: true,
      });
      if (!built) {
        console.error('[跳过] ' + character.id + ' ' + engine + ' 构建失败');
        return;
      }
      pending.push({
        characterId: character.id,
        displayName: character.displayName,
        franchise: character.franchise || '',
        engine: engine,
        prompt: built.prompt,
        negative: built.negative || '',
        seed: SEED_BASE + index * 100 + (engine === 'krea2' ? 50 : 0),
        outfit: outfit.id,
      });
    });
  });
  pending = pending.filter(function (job) {
    var existing = manifest.records.find(function (item) {
      return item.characterId === job.characterId && item.engine === job.engine && item.status === 'succeeded';
    });
    return !(existing && fs.existsSync(path.join(OUTPUT_ROOT, existing.image)));
  });
  console.log('待生成: ' + pending.length + ' 张（并发 ' + CONCURRENCY + '）');

  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  var next = 0;
  async function runOne() {
    while (true) {
      var index = next;
      next += 1;
      if (index >= pending.length) return;
      var job = pending[index];
      var workflow = workflowFor(job.engine, job.prompt, job.negative, job.seed);
      var startedAt = new Date().toISOString();
      var submitted = await requestJson('/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: CLIENT_ID }),
      });
      assert(submitted && submitted.prompt_id, 'ComfyUI did not return prompt_id');
      var image = await waitFor(submitted.prompt_id);
      var body = await requestImage(image);
      var relative = path.join('images', job.engine + '-' + job.characterId + '.png');
      var outputFile = path.join(OUTPUT_ROOT, relative);
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      fs.writeFileSync(outputFile, body);
      manifest.records = manifest.records.filter(function (item) {
        return !(item.characterId === job.characterId && item.engine === job.engine);
      });
      manifest.records.push({
        characterId: job.characterId,
        displayName: job.displayName,
        franchise: job.franchise,
        engine: job.engine,
        outfit: job.outfit,
        prompt: job.prompt,
        negative: job.negative,
        seed: job.seed,
        image: relative.replace(/\\/g, '/'),
        bytes: body.length,
        sha256: sha256(body),
        promptId: submitted.prompt_id,
        startedAt: startedAt,
        finishedAt: new Date().toISOString(),
        status: 'succeeded',
      });
      writeJson(manifestFile, manifest);
      console.log(job.engine + ' ' + job.characterId + ': ' + outputFile);
    }
  }
  var workers = [];
  for (var w = 0; w < Math.min(CONCURRENCY, pending.length || 1); w += 1) workers.push(runOne());
  await Promise.all(workers);
  manifest.finishedAt = new Date().toISOString();
  writeJson(manifestFile, manifest);
  console.log('Probe done. Manifest: ' + manifestFile);
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
