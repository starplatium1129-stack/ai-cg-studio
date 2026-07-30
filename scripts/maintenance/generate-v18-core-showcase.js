#!/usr/bin/env node
'use strict';

/**
 * Produce a reproducible, isolated v18 candidate set before any public
 * showcase replacement.  Every file records its scene prompt, seed and the
 * active checkpoint; acceptance remains a separate visual-review decision.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildTxt2ImgRequest } = require('../../src/utils/sdRequest.ts');

const ROOT = path.resolve(__dirname, '..', '..');
const AI_ROOT = path.resolve(ROOT, '..', 'AI');
const API = process.env.SD_HOST || 'http://127.0.0.1:7860';
const DEFAULT_OUTPUT = path.join(AI_ROOT, 'Reviews', 'SceneAudits', '2026-07-30_v18_core');
const EXPECTED_CHECKPOINT = 'waiillustrioussdxlv170';
const CORE_SCENE_IDS = [
  'sc260', 'sc261', 'sc262', 'sc263', 'sc264', 'sc268', 'sc269', 'sc272',
  'sc273', 'sc274', 'sc277', 'sc278', 'sc279', 'sc281', 'sc282', 'sc285',
  'sc002', 'sc105', 'sc033', 'sc085', 'sc256', 'sc028', 'sc006', 'sc019',
  'sc061', 'sc078', 'sc096', 'sc142', 'sc215', 'sc014',
];

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function splitList(value) { return String(value || '').split(',').map(value => value.trim()).filter(Boolean); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}
function stableSeed(sceneId, attempt) {
  const digest = crypto.createHash('sha256').update(`v18-core-2026-07-30:${sceneId}:${attempt}`).digest();
  return digest.readUInt32BE(0) & 0x7fffffff;
}
function normalizeModelName(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function dimensionsFor(scene) {
  const explicit = String(scene.recommendedSize || '').match(/(\d+)\s*[x×]\s*(\d+)/i);
  return explicit ? { width:Number(explicit[1]), height:Number(explicit[2]) } : { width:1024, height:1344 };
}
function buildPrompt(scene) {
  const template = String(scene.prompt || '')
    .replace(/<lora:[^>]+>\s*,?\s*/gi, '').replace(/_BREAK_/gi, ' BREAK ')
    .replace(/,\s*,/g, ',').replace(/,\s*$/g, '').trim();
  const lora = String(scene.lora || '').split(',').map(value => value.trim()).filter(Boolean)
    .map(value => value.startsWith('<lora:') ? value : `<lora:${value}>`).join(', ');
  return ['masterpiece, best quality, amazing quality', template, lora].filter(Boolean).join(', ');
}
function buildNegative(scene) {
  return ['bad quality, worst quality, worst detail, sketch, censor', String(scene.negative || '').trim()].filter(Boolean).join(', ');
}
async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}
async function generate(scene, attempt, checkpoint) {
  const { width, height } = dimensionsFor(scene);
  const seed = stableSeed(scene.id, attempt);
  const { payload } = buildTxt2ImgRequest({
    prompt:buildPrompt(scene), negative_prompt:buildNegative(scene), width, height,
    cfg_scale:6, steps:30, sampler_name:'Euler a', seed, model:checkpoint,
  });
  const response = await fetch(`${API}/sdapi/v1/txt2img`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(payload) });
  if (!response.ok) throw new Error(`txt2img ${scene.id} attempt ${attempt} returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const result = await response.json();
  if (!result.images?.[0]) throw new Error(`txt2img ${scene.id} attempt ${attempt} returned no image`);
  return { payload, result, seed, width, height };
}

async function main() {
  const requestedIds = splitList(argument('--ids'));
  const ids = requestedIds.length ? requestedIds : CORE_SCENE_IDS;
  const attempts = Math.max(1, Number(argument('--attempts', '2')) || 2);
  const startAttempt = Math.max(1, Number(argument('--start-attempt', '1')) || 1);
  const output = path.resolve(argument('--output', DEFAULT_OUTPUT));
  const force = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  const scenesById = new Map(readJson(path.join(ROOT, 'data', 'scenes.json')).map(scene => [scene.id, scene]));
  const scenes = ids.map(id => scenesById.get(id));
  const missing = ids.filter((id, index) => !scenes[index]);
  if (missing.length) throw new Error(`Unknown scene ids: ${missing.join(', ')}`);
  if (new Set(ids).size !== ids.length) throw new Error('Scene ids must be unique');
  const options = await getJson(`${API}/sdapi/v1/options`);
  const checkpoint = String(options.sd_model_checkpoint || '');
  if (!normalizeModelName(checkpoint).includes(EXPECTED_CHECKPOINT)) throw new Error(`Expected WAI Illustrious v17, found ${checkpoint || 'no active checkpoint'}`);
  const selection = {
    version:1, generatedAt:new Date().toISOString(), purpose:'v18 core showcase candidates; do not replace public samples before direct visual approval',
    model:checkpoint, sceneCount:scenes.length, sceneIds:ids, settings:{ steps:30, cfg:6, sampler:'Euler a', attemptsPerScene:attempts },
  };
  if (dryRun) return console.log(JSON.stringify(selection, null, 2));
  writeJson(path.join(output, 'selection.json'), selection);
  const batchesPath = path.join(output, 'generation-batches.json');
  const batches = fs.existsSync(batchesPath) ? readJson(batchesPath) : [];
  batches.push(selection);
  writeJson(batchesPath, batches);
  const manifestPath = path.join(output, 'generation-manifest.json');
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : [];
  const records = new Map(manifest.map(record => [`${record.sceneId}:${record.attempt}`, record]));
  for (const scene of scenes) for (let offset = 0; offset < attempts; offset += 1) {
    const attempt = startAttempt + offset;
    const imagePath = path.join(output, 'images', scene.id, `attempt-${attempt}.png`);
    if (!force && fs.existsSync(imagePath) && fs.statSync(imagePath).size > 100000) { console.log(`[reuse] ${scene.id} attempt ${attempt}`); continue; }
    const { payload, result, seed, width, height } = await generate(scene, attempt, checkpoint);
    fs.mkdirSync(path.dirname(imagePath), { recursive:true }); fs.writeFileSync(imagePath, Buffer.from(result.images[0], 'base64'));
    records.set(`${scene.id}:${attempt}`, { sceneId:scene.id, title:scene.title, char:scene.char, rating:scene.rating, attempt, seed, image:imagePath, generatedAt:new Date().toISOString(), model:checkpoint, width, height, steps:30, cfg:6, sampler:'Euler a', prompt:payload.prompt, negative:payload.negative_prompt, infotexts:result.info ? JSON.parse(result.info).infotexts || [] : [] });
    writeJson(manifestPath, [...records.values()].sort((a, b) => a.sceneId.localeCompare(b.sceneId) || a.attempt - b.attempt));
    console.log(`[generated] ${scene.id} attempt ${attempt} seed ${seed} ${width}x${height}`);
  }
  console.log(JSON.stringify({ output, scenes:scenes.length, attempts, model:checkpoint }, null, 2));
}
main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
