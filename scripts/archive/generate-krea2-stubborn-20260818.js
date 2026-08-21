#!/usr/bin/env node
'use strict';

/**
 * 2026-08-18：12 个 Anima 顽固分身场景改用 Krea 2 生成。
 *
 * 根因（Anima 分身）：Anima 为标签模型，单人约束 (solo:1.5)/(no clone:1.4) 等权重语法
 * 对 qwen 编码器遵循弱且 append 在 prompt 末尾；场景 tokens 又暗示社交/开放空间
 * （超市/咖啡店/办公室/运动场/驿站），模型天然补第二主角 → 分身。
 *
 * Krea 2 为自然语言模型：用明确语义句「only she is present, empty scene」做单人约束
 * 比标签权重有效得多；负面恒空；画师走 artistProse（@rella → rella 自然语言）。
 *
 * 用法：
 *   node scripts/maintenance/generate-krea2-stubborn-20260818.js
 *       [--keys <k1,k2,...>] [--output <dir>] [--concurrency 2]
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const popularContent = require('../../src/utils/popularContent.ts');
const animaConstants = require('../../routes/anima.js').constants;

const popularData = require('../../data/popular-characters.json');
const blueprintData = require('../../data/scene-blueprints.json');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_OUTPUT = path.join(ROOT, '..', 'AI', 'Reviews', 'ShowcaseRefresh', '2026-08-18_v24-popular-krea2');
const MANIFEST_NAME = 'generation-manifest.json';
const ANIMA_MODEL_ID = 'krea2-turbo-fp8';
const ARTIST = 'rella';

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function splitList(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}
function stableSeed(characterId, blueprintId, attempt) {
  const digest = crypto.createHash('sha256').update(`krea2-stubborn:${characterId}:${blueprintId}:${attempt}`).digest();
  return digest.readUInt32BE(0) & 0x7fffffff;
}
function resolveProfile() {
  const presets = readJson(path.join(ROOT, 'data', 'presets.json'));
  const profile = (presets.model_profiles || []).find(item => item.id === 'krea2_turbo_fp8');
  if (!profile) throw new Error('presets.json missing profile krea2_turbo_fp8');
  return profile;
}

const STUBBORN_KEYS = [
  'popular:fern_frieren:fern_carriage_stop_snow',
  'popular:mimori_byakuya:byakuya_classroom_nap_afternoon',
  'popular:mimori_byakuya:byakuya_maid_cafe_shift',
  'popular:reze_chainsaw:reze_old_bookstore_reading',
  'popular:saint_cecilia:cecilia_bakery_scone_lesson',
  'popular:saint_cecilia:cecilia_garden_watering_flowers',
  'popular:saint_cecilia:cecilia_riverbank_evening_walk',
  'popular:sylphiette:sylphiette_grayrat_kitchen_morning',
  'popular:yor_forger:yor_city_hall_desk_work',
  'popular:yor_forger:yor_evening_sofa_knitting',
  'popular:yor_forger:yor_supermarket_shopping',
  'popular:yuigahama_yui:yui_tennis_court_afternoon',
];

function buildCandidate(character, blueprint, profile, attempt) {
  // 蓝图指定服装优先；缺失回退默认服装。
  const outfit = (blueprint.outfitId && popularContent.findOutfit(character, blueprint.outfitId))
    || popularContent.defaultOutfit(character);
  const decisions = popularContent.inferBlueprintDecisions(blueprint);
  const adult = Boolean(blueprint.adult);
  const result = popularContent.buildPopularPromptPlan({
    character,
    outfit,
    blueprint,
    engine: 'krea2',
    profile,
    adultEnabled: true,
    shot: decisions.shot,
    lighting: decisions.lighting,
    composition: decisions.composition,
    style: null,
    // Krea 2 画师 = 自然语言 prose（对应 Anima 的 @rella）。
    artistTags: [],
    artistProse: `with visual styling inspired by ${ARTIST}`,
    // Krea 单人约束用自然语言句（比标签权重有效）；场景显式"只有她一人、空无他人"。
    visualDescription: 'She is completely alone; the place around her is empty with no other people anywhere, no second girl, no crowd.',
  });
  if (!result) throw new Error(`krea2 prompt build failed for ${character.id} / ${blueprint.id}`);
  return {
    batch: 'popular',
    key: `popular:${character.id}:${blueprint.id}`,
    recordId: `popular:${character.id}:${blueprint.id}@attempt-1`,
    characterId: character.id,
    blueprintId: blueprint.id,
    blueprintTitle: blueprint.title,
    displayName: `${character.displayName} / ${blueprint.title}${adult ? ' (R18)' : ''}`,
    adult,
    outfitId: outfit.id,
    engine: 'krea2',
    profileId: profile.id,
    modelId: ANIMA_MODEL_ID,
    checkpoint: animaConstants.MODELS[ANIMA_MODEL_ID] ? animaConstants.MODELS[ANIMA_MODEL_ID].file : '',
    artistTag: '@' + ARTIST,
    width: 1024,
    height: 1536,
    steps: profile.steps || 28,
    cfg: profile.cfg || 1,
    sampler: 'euler',
    scheduler: 'simple',
    seed: stableSeed(character.id, blueprint.id, attempt),
    attempt,
    prompt: result.prompt,
    negative: '',
    inferred: decisions,
  };
}

function planAll() {
  const characters = popularContent.parsePopularCharacters(popularData);
  const blueprints = popularContent.parseSceneBlueprints(blueprintData);
  const profile = resolveProfile();
  const candidates = [];
  for (const key of STUBBORN_KEYS) {
    const [, characterId, blueprintId] = key.split(':');
    const character = characters.find(c => c.id === characterId);
    const blueprint = blueprints.find(b => b.id === blueprintId && b.characterId === characterId);
    if (!character || !blueprint) throw new Error(`missing for ${key}`);
    candidates.push(buildCandidate(character, blueprint, profile, 1));
  }
  return candidates;
}

async function gatewayJson(base, pathname, options) {
  let response;
  try {
    response = await fetch(base.replace(/\/$/, '') + pathname, Object.assign({ cache: 'no-store' }, options || {}));
  } catch (error) {
    return { response: null, data: null, error: error instanceof Error ? error.message : String(error) };
  }
  let data = null;
  try { data = await response.json(); } catch (error) { /* keep null */ }
  return { response, data };
}

function buildSubmissionBody(candidate) {
  return {
    prompt: candidate.prompt,
    negative: '', // Krea 负面恒空
    modelId: candidate.modelId,
    width: candidate.width,
    height: candidate.height,
    seed: candidate.seed,
  };
}

async function submitCandidate(base, candidate) {
  const route = '/api/creative/jobs';
  let submitted = null;
  for (let retry = 0; retry < 5; retry += 1) {
    submitted = await gatewayJson(base, route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildSubmissionBody(candidate)),
    });
    const busy = submitted.response && submitted.response.status === 429;
    if (!busy) break;
    await new Promise(resolve => setTimeout(resolve, 5000 * (retry + 1)));
  }
  if (!submitted.response || submitted.response.status !== 202 || submitted.data?.ok !== true || !submitted.data.job?.id) {
    const status = submitted.response ? submitted.response.status : 'network';
    return { ok: false, error: `submission failed (${status}): ${submitted.error || JSON.stringify(submitted.data)}` };
  }
  let job = submitted.data.job;
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const state = await gatewayJson(base, `${route}/${encodeURIComponent(job.id)}`);
    if (state.response?.ok && state.data?.ok && state.data.job) job = state.data.job;
    if (job.status === 'failed' || job.status === 'cancelled') {
      return { ok: false, error: `job failed: ${job.error || job.status} (${job.code || ''})`, jobId: job.id };
    }
    if (job.status === 'succeeded' && job.resultUrl) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (job.status !== 'succeeded' || !job.resultUrl) return { ok: false, error: `job timed out: ${job.status}`, jobId: job.id };
  const result = await fetch(base.replace(/\/$/, '') + job.resultUrl, { cache: 'no-store' });
  if (!result.ok) return { ok: false, error: `result fetch failed (HTTP ${result.status})`, jobId: job.id };
  return {
    ok: true,
    buffer: Buffer.from(await result.arrayBuffer()),
    jobId: job.id,
    provider: job.provider || '',
    actualSeed: job.metadata?.seed ?? job.seed ?? candidate.seed,
    metadata: job.metadata || {},
    mime: result.headers.get('content-type') || 'image/png',
  };
}

async function main() {
  const keys = splitList(argument('--keys'));
  const output = path.resolve(argument('--output', DEFAULT_OUTPUT));
  const gateway = argument('--gateway', 'http://127.0.0.1:3000');
  const concurrency = Math.max(1, Math.min(3, Number(argument('--concurrency', '2')) || 2));

  const planned = planAll();
  const selected = keys.length ? planned.filter(c => keys.includes(c.key)) : planned;
  const manifestPath = path.join(output, MANIFEST_NAME);
  const records = new Map((fs.existsSync(manifestPath) ? readJson(manifestPath) : []).map(r => [r.recordId, r]));

  const pending = selected.filter(candidate => {
    const previous = records.get(candidate.recordId);
    const imageRel = `images/${candidate.characterId}/${candidate.blueprintId}/krea2-attempt-1.png`;
    const imageFile = path.join(output, imageRel.split('/').join(path.sep));
    if (previous?.status === 'succeeded' && fs.existsSync(imageFile) && fs.statSync(imageFile).size > 1000) {
      console.log(`[reuse] ${candidate.recordId}`);
      return false;
    }
    return true;
  });
  console.log(`[krea2] ${selected.length} candidates, ${pending.length} to generate (concurrency ${concurrency})`);

  fs.mkdirSync(output, { recursive: true });
  let generated = 0, failed = 0, cursor = 0;

  async function worker() {
    while (cursor < pending.length) {
      const candidate = pending[cursor];
      cursor += 1;
      const imageRel = `images/${candidate.characterId}/${candidate.blueprintId}/krea2-attempt-1.png`;
      const imageFile = path.join(output, imageRel.split('/').join(path.sep));
      console.log(`[krea2] ${candidate.recordId} seed ${candidate.seed}`);
      const result = await submitCandidate(gateway, candidate);
      if (!result.ok) {
        records.set(candidate.recordId, Object.assign({}, candidate, { status: 'failed', error: result.error, image: '', generatedAt: new Date().toISOString() }));
        writeJsonAtomic(manifestPath, [...records.values()]);
        console.log(`[failed] ${candidate.recordId}: ${result.error}`);
        failed += 1;
        continue;
      }
      fs.mkdirSync(path.dirname(imageFile), { recursive: true });
      fs.writeFileSync(imageFile, result.buffer);
      records.set(candidate.recordId, Object.assign({}, candidate, {
        status: 'succeeded', error: '', image: imageRel, generatedAt: new Date().toISOString(),
        bytes: result.buffer.length, mime: result.mime, sha256: crypto.createHash('sha256').update(result.buffer).digest('hex'),
        jobId: result.jobId, provider: result.provider, actualSeed: result.actualSeed, metadata: result.metadata,
      }));
      writeJsonAtomic(manifestPath, [...records.values()]);
      console.log(`[ok] ${candidate.recordId} -> ${imageRel} (${result.buffer.length} bytes)`);
      generated += 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
  const normalized = [...records.values()].sort((a, b) => a.characterId.localeCompare(b.characterId) || a.blueprintId.localeCompare(b.blueprintId) || a.attempt - b.attempt);
  writeJsonAtomic(manifestPath, normalized);
  console.log(JSON.stringify({ output, planned: selected.length, generated, failed }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error && error.stack || error);
    process.exitCode = 1;
  });
}
