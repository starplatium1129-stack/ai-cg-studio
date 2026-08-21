#!/usr/bin/env node
'use strict';

/* probe-nsfw-scenes.js — Krea 2 NSFW 放开验证探针（2026-08-14）
 *
 * 验证链路：popularContent.buildPopularPromptPlan（fail-closed 放行，adult blueprint）
 *   → routes/anima.js buildWorkflow（Heretic 未审查编码器 + aggressive rebalance 预设）
 *   → 本地 ComfyUI /prompt → 下载图片到独立输出目录。
 *
 * 覆盖：3 个角色人设化 NSFW 场景 + 1 个对照组（同角色普通原型场景，确认无 nsfw 注入）。
 *
 * 用法：node scripts/tests/probe-nsfw-scenes.js [--dry-run] [--seed N] [--only <sceneId>]
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var COMFY = process.env.COMFY_HOST || 'http://127.0.0.1:8188';
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var OUTPUT_ROOT = process.env.NSFW_PROBE_OUT || path.join(AI_ROOT, 'Reviews', 'NsfwProbe', '2026-08-14');

var popular = require('../../src/utils/popularContent.ts');
var animaRoute = require('../../routes/anima.js');

var SEED_BASE = 20260814;
var KREA_SIZE = [1024, 1536];

// 验证矩阵：角色人设化成人场景（从 CHAR_ADULT_SCENES 全集中挑选代表）+
// 对照组（普通原型场景，断言 nsfw 不注入）。
var CASES = [
  { label:'rem_maid_serving', characterId:'rem_rezero', sceneId:'rem_rezero_r18_chamber' },
  { label:'makima_office_night', characterId:'makima', sceneId:'makima_r18_office' },
  { label:'frieren_inn_bath', characterId:'frieren', sceneId:'frieren_r18_inn_bath' },
  { label:'control_rem_mansion', characterId:'rem_rezero', sceneId:'rem_rezero_mansion' },
];

async function requestJson(pathname, opts) {
  var response = await fetch(COMFY + pathname, opts || {});
  assert(response.ok, 'HTTP ' + response.status + ' on ' + pathname);
  return await response.json();
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

async function downloadImage(image, dest) {
  var query = new URLSearchParams({
    filename: String(image.filename || ''),
    subfolder: String(image.subfolder || ''),
    type: String(image.type || 'output'),
  });
  var response = await fetch(COMFY + '/view?' + query.toString(), { cache:'no-store' });
  var mime = String(response.headers.get('content-type') || '');
  assert(response.ok && mime.startsWith('image/'), 'result was not an image: HTTP ' + response.status + ' ' + mime);
  var body = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(dest, body);
  return body.length;
}

async function main() {
  var only = null;
  var onlyIndex = process.argv.indexOf('--only');
  if (onlyIndex >= 0) only = process.argv[onlyIndex + 1];

  var characters = popular.parsePopularCharacters(require('../../data/popular-characters.json'));
  var blueprints = popular.parseSceneBlueprints(require('../../data/scene-blueprints.json'));
  var byId = {};
  blueprints.forEach(function (bp) { byId[bp.id] = bp; });

  var cases = CASES.filter(function (item) { return !only || item.sceneId === only || item.label === only; });
  if (!cases.length) throw new Error('--only matched nothing');

  console.log('NSFW 探针: ' + cases.length + ' 组，输出 ' + OUTPUT_ROOT);

  if (process.argv.includes('--dry-run')) {
    cases.forEach(function (item) {
      var character = popular.findCharacter(characters, item.characterId);
      var blueprint = byId[item.sceneId];
      var built = popular.buildPopularPromptPlan({
        character: character,
        outfit: popular.defaultOutfit(character),
        blueprint: blueprint,
        engine: 'krea2',
        profile: null,
        adultEnabled: true,
      });
      console.log('--- ' + item.label + ' (adult=' + blueprint.adult + ') ---');
      console.log((built ? built.prompt : 'BUILD NULL (fail-closed)'));
      console.log('nsfw 注入:', built ? /nude|naked|nipples|breasts|topless/i.test(built.prompt) : 'n/a');
    });
    return;
  }

  fs.mkdirSync(path.join(OUTPUT_ROOT, 'images'), { recursive: true });
  var manifestPath = path.join(OUTPUT_ROOT, 'manifest.json');
  var manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { version: 1, purpose:'Krea 2 NSFW 放开验证', comfy:COMFY, records:[] };

  var clientId = 'aics-nsfw-probe-' + Math.random().toString(36).slice(2, 10);
  await requestJson('/prompt', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ client_id:clientId }) }).catch(function () { /* warm */ });

  var index = 0;
  for (const item of cases) {
    index += 1;
    var label = item.label;
    var existing = manifest.records.find(function (r) { return r.label === label && r.status === 'succeeded'; });
    if (existing && !process.argv.includes('--force')) {
      console.log('[' + index + '/' + cases.length + '] 跳过（已成功）: ' + label);
      continue;
    }
    var character = popular.findCharacter(characters, item.characterId);
    var blueprint = byId[item.sceneId];
    var built = popular.buildPopularPromptPlan({
      character: character,
      outfit: popular.defaultOutfit(character),
      blueprint: blueprint,
      engine: 'krea2',
      profile: null,
      adultEnabled: true,
    });
    if (!built) {
      console.error('[' + index + '/' + cases.length + '] 构建被 fail-closed 拒绝: ' + label + ' (意外，应为放行)');
      manifest.records.push({ label:label, status:'rejected', at:new Date().toISOString() });
      continue;
    }
    var workflow = animaRoute.buildWorkflow({
      prompt: built.prompt,
      negative: built.negative || '',
      modelId: 'krea2-turbo-fp8',
      width: KREA_SIZE[0],
      height: KREA_SIZE[1],
      seed: SEED_BASE + index * 13,
      character: null,
    });
    workflow['10'].inputs.filename_prefix = ['nsfw_probe', label].join('/');
    console.log('[' + index + '/' + cases.length + '] 提交 ' + label + ' (adult=' + blueprint.adult + ', nsfw=' + /nude|naked|nipples|breasts|topless/i.test(built.prompt) + ')');
    var resp = await requestJson('/prompt', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ prompt:workflow, client_id:clientId }),
    });
    var image = await waitFor(resp.prompt_id);
    var dest = path.join(OUTPUT_ROOT, 'images', label + '.png');
    var bytes = await downloadImage(image, dest);
    manifest.records.push({
      label:label,
      characterId:item.characterId,
      sceneId:item.sceneId,
      blueprintAdult:blueprint.adult === true,
      nsfwInjected:/nude|naked|nipples|breasts|topless/i.test(built.prompt),
      prompt:built.prompt,
      seed:SEED_BASE + index * 13,
      file:path.relative(OUTPUT_ROOT, dest),
      bytes:bytes,
      status:'succeeded',
      at:new Date().toISOString(),
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log('    → 完成 ' + dest + ' (' + bytes + ' B)');
  }
  console.log('\n完成。图片目录: ' + path.join(OUTPUT_ROOT, 'images'));
}

main().catch(function (error) {
  console.error('探针失败:', error.message);
  process.exit(1);
});
