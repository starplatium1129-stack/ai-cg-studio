#!/usr/bin/env node
'use strict';

/**
 * Generate reproducible, website-equivalent candidates for every dual scene.
 *
 * This intentionally executes tools/sd-api.js instead of maintaining a second
 * implementation of the Regional Prompter / ControlNet / ADetailer payload.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.resolve(ROOT, '..', 'AI', 'Reviews', 'DualShowcase', '2026-07-23_regional_v1');
const DEFAULT_IDS = ['sc028', 'sc031', 'sc144', 'sc151', 'sc154', 'sc157'];
const API = process.env.SD_HOST || 'http://127.0.0.1:7860';

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function splitList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function stableSeed(sceneId, attempt) {
  const digest = crypto.createHash('sha256').update(`${sceneId}:dual-regional-v1:${attempt}`).digest();
  return digest.readUInt32BE(0) & 0x7fffffff;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, file);
}

function stripLoras(prompt) {
  return String(prompt || '')
    .replace(/<lora:[^>]+>/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .trim();
}

function makeRuntime() {
  const context = {
    console,
    fetch,
    AbortController,
    Promise,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    TextEncoder,
    TextDecoder
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'tools', 'prompt-policy.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'tools', 'sd-api.js'), 'utf8'), context);
  return context;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const ids = splitList(argument('--ids')).length ? splitList(argument('--ids')) : DEFAULT_IDS;
  const attempts = Math.max(1, Number(argument('--attempts', '1')) || 1);
  const startAttempt = Math.max(1, Number(argument('--start-attempt', '1')) || 1);
  const output = path.resolve(argument('--output', DEFAULT_OUTPUT));
  const disableControl = new Set(splitList(argument('--disable-control')));
  const force = process.argv.includes('--force');

  const scenes = readJson(path.join(ROOT, 'data', 'scenes.json')).filter((scene) => ids.includes(scene.id));
  if (scenes.length !== ids.length) {
    const found = new Set(scenes.map((scene) => scene.id));
    throw new Error(`Unknown scene ids: ${ids.filter((id) => !found.has(id)).join(', ')}`);
  }

  const [modelInfo, scriptInfo, controlInfo, adetailerInfo] = await Promise.all([
    getJson(`${API}/sdapi/v1/options`),
    getJson(`${API}/sdapi/v1/scripts`),
    getJson(`${API}/controlnet/model_list`),
    getJson(`${API}/adetailer/v1/ad_model`)
  ]);
  const scripts = [].concat(scriptInfo.txt2img || []).map((name) => String(name).toLowerCase());
  const controlModel = (controlInfo.model_list || []).find((name) => /xinsir.*openpose.*sdxl/i.test(name)) || '';
  if (!scripts.includes('regional prompter')) throw new Error('Regional Prompter is unavailable');
  if (!controlModel) throw new Error('Xinsir SDXL OpenPose model is unavailable');
  if (!(adetailerInfo.ad_model || []).includes('face_yolov8s.pt')) throw new Error('face_yolov8s.pt is unavailable');

  const runtime = makeRuntime();
  const connector = new runtime.SDWebUIConnector(API);
  const manifestPath = path.join(output, 'generation-manifest.json');
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : [];
  const records = new Map(manifest.map((item) => [`${item.sceneId}:${item.attempt}`, item]));

  for (const scene of scenes) {
    for (let offset = 0; offset < attempts; offset += 1) {
      const attempt = startAttempt + offset;
      const imageDir = path.join(output, 'images', scene.id);
      const imagePath = path.join(imageDir, `attempt-${attempt}.png`);
      if (!force && fs.existsSync(imagePath) && fs.statSync(imagePath).size > 100000) {
        console.log(`[reuse] ${scene.id} attempt ${attempt}`);
        continue;
      }

      const seed = stableSeed(scene.id, attempt);
      const basePrompt = stripLoras(scene.prompt);
      const prompt = [
        'masterpiece, best quality, amazing quality',
        runtime.AICPromptPolicy.enrichDualPrompt(
          basePrompt,
          ['ayachi_nene', 'white_hair', 'very_long_hair', 'low_twintails', 'purple_eyes', 'ahoge', 'pink_hair_ribbons'],
          ['shiki_natsume', 'black_hair', 'long_hair', 'yellow_eyes', 'two_red_hairclips', 'mole_under_eye']
        )
      ].join(', ');
      const posePath = path.join(ROOT, 'assets', 'dual-poses', `${scene.id}.png`);
      const useControl = !disableControl.has(scene.id) && fs.existsSync(posePath);
      const pose = useControl ? `data:image/png;base64,${fs.readFileSync(posePath).toString('base64')}` : '';
      const wide = (scene.tags || []).some((tag) => tag === 'wide_shot' || tag === 'full_body');

      console.log(`[generate] ${scene.id} attempt ${attempt} seed ${seed}` +
        ` regional=on control=${useControl ? 'on' : 'off'} adetailer=${wide ? 'on' : 'off'}`);
      const result = await connector.generateImage(prompt, scene.negative || '', {
        char: 'triad',
        lora: scene.lora,
        checkpoint: modelInfo.sd_model_checkpoint || '',
        width: 1344,
        height: 896,
        steps: 30,
        cfg: 6,
        sampler: 'Euler a',
        scheduler: '',
        seed,
        timeoutMs: 30 * 60 * 1000,
        dualEnhancement: {
          regional: true,
          ratios: '1,1',
          baseRatio: '0.3',
          generationMode: 'Attention',
          controlModel,
          controlImage: pose,
          controlWeight: 0.65,
          controlEnd: 0.72,
          resizeMode: 'Resize and Fill',
          adetailer: wide,
          adModel: 'face_yolov8s.pt'
        }
      });

      fs.mkdirSync(imageDir, { recursive: true });
      fs.writeFileSync(imagePath, Buffer.from(result.image.split(',', 2)[1], 'base64'));
      const record = {
        sceneId: scene.id,
        title: scene.title,
        rating: scene.rating,
        attempt,
        seed,
        image: imagePath,
        generatedAt: new Date().toISOString(),
        model: modelInfo.sd_model_checkpoint || '',
        width: 1344,
        height: 896,
        steps: 30,
        cfg: 6,
        sampler: 'Euler a',
        enhancements: result.enhancements,
        controlPose: useControl ? path.relative(ROOT, posePath).replace(/\\/g, '/') : '',
        prompt: result.payload.prompt,
        negative: result.payload.negative_prompt,
        infotexts: result.infotexts
      };
      records.set(`${scene.id}:${attempt}`, record);
      writeJson(manifestPath, [...records.values()].sort((a, b) =>
        a.sceneId.localeCompare(b.sceneId) || a.attempt - b.attempt
      ));
    }
  }

  console.log(JSON.stringify({
    output,
    scenes: scenes.length,
    attempts,
    model: modelInfo.sd_model_checkpoint,
    controlModel
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
