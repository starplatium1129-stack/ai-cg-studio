#!/usr/bin/env node
'use strict';

/**
 * Generate an auditable v15 replacement candidate set for the public showcase.
 * Images are intentionally stored outside the v14 showcase until visual review
 * selects a single approved attempt for every scene.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const AI_ROOT = path.resolve(ROOT, '..', 'AI');
const API = process.env.SD_HOST || 'http://127.0.0.1:7860';
const DEFAULT_OUTPUT = path.join(AI_ROOT, 'Reviews', 'SceneAudits', '2026-07-28_v15_core');
const EXPECTED_MODEL = 'waiillustrioussdxlv170';

// v14's curated set has 29 scenes. sc262 completes the official-CG Nene set.
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

function splitList(value) {
  return String(value || '').split(',').map(value => value.trim()).filter(Boolean);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function stableSeed(sceneId, attempt) {
  const digest = crypto.createHash('sha256').update(`v15-core-2026-07-28:${sceneId}:${attempt}`).digest();
  return digest.readUInt32BE(0) & 0x7fffffff;
}

function normalizeModelName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function dimensionsFor(scene) {
  const explicit = String(scene.recommendedSize || '').match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (explicit) return { width: Number(explicit[1]), height: Number(explicit[2]) };
  return { width: 1024, height: 1344 };
}

function buildPrompt(scene) {
  const template = String(scene.prompt || '')
    .replace(/<lora:[^>]+>\s*,?\s*/gi, '')
    .replace(/_BREAK_/gi, ' BREAK ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .trim();
  const lora = String(scene.lora || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => value.startsWith('<lora:') ? value : `<lora:${value}>`)
    .join(', ');
  return ['masterpiece, best quality, amazing quality', template, lora].filter(Boolean).join(', ');
}

function buildNegative(scene) {
  const sceneNegative = String(scene.negative || '').trim();
  return ['bad quality, worst quality, worst detail, sketch, censor', sceneNegative]
    .filter(Boolean)
    .join(', ');
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function generate(scene, attempt, checkpoint) {
  const { width, height } = dimensionsFor(scene);
  const seed = stableSeed(scene.id, attempt);
  const payload = {
    prompt: buildPrompt(scene),
    negative_prompt: buildNegative(scene),
    width,
    height,
    cfg_scale: 6,
    steps: 30,
    sampler_name: 'Euler a',
    seed,
    batch_size: 1,
    n_iter: 1,
    send_images: true,
    save_images: false,
    override_settings: { sd_model_checkpoint: checkpoint },
    override_settings_restore_afterwards: true,
  };
  const response = await fetch(`${API}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
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
  if (!normalizeModelName(checkpoint).includes(EXPECTED_MODEL)) {
    throw new Error(`Expected WAI Illustrious v17, found ${checkpoint || 'no active checkpoint'}`);
  }

  const selectionPath = path.join(output, 'selection.json');
  const manifestPath = path.join(output, 'generation-manifest.json');
  const selection = {
    version: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'v15 core showcase candidates; retain v14 until visual review approves replacements',
    model: checkpoint,
    sceneCount: scenes.length,
    sceneIds: ids,
    settings: { steps: 30, cfg: 6, sampler: 'Euler a', attemptsPerScene: attempts },
  };
  if (dryRun) {
    console.log(JSON.stringify(selection, null, 2));
    return;
  }
  writeJson(selectionPath, selection);
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : [];
  const records = new Map(manifest.map(record => [`${record.sceneId}:${record.attempt}`, record]));

  for (const scene of scenes) {
    for (let offset = 0; offset < attempts; offset += 1) {
      const attempt = startAttempt + offset;
      const imagePath = path.join(output, 'images', scene.id, `attempt-${attempt}.png`);
      if (!force && fs.existsSync(imagePath) && fs.statSync(imagePath).size > 100000) {
        console.log(`[reuse] ${scene.id} attempt ${attempt}`);
        continue;
      }
      const { payload, result, seed, width, height } = await generate(scene, attempt, checkpoint);
      fs.mkdirSync(path.dirname(imagePath), { recursive: true });
      fs.writeFileSync(imagePath, Buffer.from(result.images[0], 'base64'));
      const record = {
        sceneId: scene.id,
        title: scene.title,
        char: scene.char,
        rating: scene.rating,
        attempt,
        seed,
        image: imagePath,
        generatedAt: new Date().toISOString(),
        model: checkpoint,
        width,
        height,
        steps: 30,
        cfg: 6,
        sampler: 'Euler a',
        prompt: payload.prompt,
        negative: payload.negative_prompt,
        infotexts: result.info ? JSON.parse(result.info).infotexts || [] : [],
      };
      records.set(`${scene.id}:${attempt}`, record);
      writeJson(manifestPath, [...records.values()].sort((a, b) =>
        a.sceneId.localeCompare(b.sceneId) || a.attempt - b.attempt,
      ));
      console.log(`[generated] ${scene.id} attempt ${attempt} seed ${seed} ${width}x${height}`);
    }
  }
  console.log(JSON.stringify({ output, scenes: scenes.length, attempts, model: checkpoint }, null, 2));
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
