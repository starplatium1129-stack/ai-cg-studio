#!/usr/bin/env node
'use strict';

/**
 * Generate showcase candidates for EVERY popular character × EVERY scene
 * blueprint (SFW + R18), unified contract:
 *
 *   - engine : anima-aesthetic-v1.1, no-LoRA mode (identity anchored by tokens)
 *   - prompt : buildPopularPromptPlan (identity + outfit + blueprint scene +
 *              inferred shot/lighting/composition) with artist tag @rella
 *   - params : 30 steps / CFG 4.5 (global Anima default since 2026-08-14)
 *   - R18 blueprints: adultEnabled=true, fail-closed on adultEligibility.
 *
 * Output goes to AI/Reviews/ShowcaseRefresh/<round>/ (never the public dir).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const popularContent = require('../../src/utils/popularContent.ts');
const { artistTagsForEngine } = require('../../src/config/artistStyles.ts');
const animaConstants = require('../../routes/anima.js').constants;
const animaGenerationContract = require('../../server/anima-generation-contract.js');

const popularData = require('../../data/popular-characters.json');
const blueprintData = require('../../data/scene-blueprints.json');
const presets = require('../../data/presets.json');

const ROOT = path.resolve(__dirname, '..', '..');
const AI_ROOT = path.resolve(ROOT, '..', 'AI');
const SHOWCASE_ROOT = path.resolve(AI_ROOT, 'SceneShowcase');
const DEFAULT_OUTPUT = path.join(AI_ROOT, 'Reviews', 'ShowcaseRefresh', '2026-08-14_v18-popular-all-rella');
const MANIFEST_NAME = 'generation-manifest.json';
const ANIMA_MODEL_ID = 'anima-aesthetic-v1.1';
const ANIMA_PROFILE_ID = 'anima_aesthetic_v11';
const ARTIST_TAG = 'rella';

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
  const digest = crypto.createHash('sha256').update(`popular-all-rella:${characterId}:${blueprintId}:${attempt}`).digest();
  return digest.readUInt32BE(0) & 0x7fffffff;
}
function assertIsolated(output) {
  const resolved = path.resolve(output);
  if (resolved === SHOWCASE_ROOT || resolved.startsWith(SHOWCASE_ROOT + path.sep)) {
    throw new Error(`refusing to write candidates into public showcase: ${resolved}`);
  }
  return resolved;
}
function resolveProfile() {
  const profile = (presets.model_profiles || []).find(item => item.id === ANIMA_PROFILE_ID);
  if (!profile) throw new Error(`presets.json missing profile ${ANIMA_PROFILE_ID}`);
  return profile;
}
function nearestAnimaSize(blueprint) {
  const explicit = String(blueprint.recommendedSize || '832x1216');
  const match = explicit.match(/(\d+)\s*[x×]\s*(\d+)/i);
  const desired = match ? `${Number(match[1])}x${Number(match[2])}` : '832x1216';
  const sizes = animaConstants.MODELS[ANIMA_MODEL_ID].sizes;
  if (sizes.includes(desired)) return desired;
  const [desiredWidth, desiredHeight] = desired.split('x').map(Number);
  const ratio = desiredWidth / desiredHeight;
  return [...sizes].sort((left, right) => {
    const [lw, lh] = left.split('x').map(Number);
    const [rw, rh] = right.split('x').map(Number);
    return Math.abs(lw / lh - ratio) - Math.abs(rw / rh - ratio);
  })[0];
}
function buildCandidate(character, blueprint, profile, attempt, seedAttempt = attempt) {
  // 蓝图指定服装（outfitId）优先；缺失时回退默认服装。
  const outfit = (blueprint.outfitId && popularContent.findOutfit(character, blueprint.outfitId))
    || popularContent.defaultOutfit(character);
  const decisions = popularContent.inferBlueprintDecisions(blueprint);
  const adult = Boolean(blueprint.adult);
  const result = popularContent.buildPopularPromptPlan({
    character,
    outfit,
    blueprint,
    engine: 'anima',
    profile,
    adultEnabled: true,
    shot: decisions.shot,
    lighting: decisions.lighting,
    composition: decisions.composition,
    // artistTags 需传入 Anima 引擎格式（前导 @），renderPromptPlan 不做转换。
    artistTags: artistTagsForEngine([ARTIST_TAG], 'anima'),
  });
  if (!result) throw new Error(`popular prompt build failed for ${character.id} / ${blueprint.id}`);
  // 单人主体强化：压制主画面第二人（背景路人可接受，不强压 bystanders）。
  const soloGuard = '(single girl only:1.4), (one person only:1.4), no second person, no other person';
  const prompt = result.prompt.includes('\n')
    ? result.prompt.replace('\n', `, ${soloGuard}\n`)
    : `${result.prompt}, ${soloGuard}`;
  const [width, height] = nearestAnimaSize(blueprint).split('x').map(Number);
  return {
    batch: 'popular', key: `popular:${character.id}:${blueprint.id}`,
    recordId: `popular:${character.id}:${blueprint.id}@attempt-${attempt}`,
    characterId: character.id, blueprintId: blueprint.id, blueprintTitle: blueprint.title,
    displayName: `${character.displayName} / ${blueprint.title}${adult ? ' (R18)' : ''}`,
    adult, outfitId: outfit.id,
    engine: 'anima', profileId: profile.id, modelId: ANIMA_MODEL_ID,
    checkpoint: animaConstants.MODELS[ANIMA_MODEL_ID].file,
    artistTag: '@' + ARTIST_TAG,
    width, height,
    steps: animaGenerationContract.ANIMA_DEFAULTS.steps,
    cfg: animaGenerationContract.ANIMA_DEFAULTS.cfg,
    sampler: animaGenerationContract.ANIMA_DEFAULTS.sampler,
    scheduler: animaGenerationContract.ANIMA_DEFAULTS.scheduler,
    seed: stableSeed(character.id, blueprint.id, seedAttempt),
    attempt,
    prompt, negative: result.negative,
    inferred: decisions,
  };
}
function planAll(attempt, seedAttempt = attempt) {
  const characters = popularContent.parsePopularCharacters(popularData);
  const blueprints = popularContent.parseSceneBlueprints(blueprintData);
  const profile = resolveProfile();
  const candidates = [];
  for (const character of characters) {
    const owned = blueprints.filter(bp => bp.characterId === character.id);
    if (!owned.length) throw new Error(`no blueprints for ${character.id}`);
    for (const blueprint of owned) {
      candidates.push(buildCandidate(character, blueprint, profile, attempt, seedAttempt));
    }
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
  // no-LoRA 模式：不传 loraId / loraStrength / character。
  return {
    prompt: candidate.prompt, negative: candidate.negative,
    modelId: candidate.modelId, width: candidate.width, height: candidate.height,
    steps: candidate.steps, cfg: candidate.cfg, seed: candidate.seed,
  };
}
async function submitCandidate(base, candidate) {
  const route = '/api/anima/jobs';
  let submitted = null;
  // 429 队列满：退避重试（网关 MAX_PENDING=4，并发脚本撞队列时自愈）。
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
  const attempt = Math.max(1, Number(argument('--attempt', '1')) || 1);
  const seedAttempt = Math.max(1, Number(argument('--seed-attempt', String(attempt))) || attempt);
  const output = assertIsolated(path.resolve(argument('--output', DEFAULT_OUTPUT)));
  const gateway = argument('--gateway', 'http://127.0.0.1:3000');
  const limit = Math.max(1, Number(argument('--limit', '9999')) || 9999);
  const concurrency = Math.max(1, Math.min(4, Number(argument('--concurrency', '3')) || 3));
  const force = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  const planned = planAll(attempt, seedAttempt);
  const selected = keys.length ? planned.filter(c => keys.includes(c.key)) : planned;
  if (keys.length && selected.length !== keys.length) {
    const found = new Set(selected.map(c => c.key));
    throw new Error(`unknown keys: ${keys.filter(k => !found.has(k)).join(', ')}`);
  }
  const manifestPath = path.join(output, MANIFEST_NAME);
  const existing = fs.existsSync(manifestPath) ? readJson(manifestPath) : [];
  const records = new Map(existing.map(record => [record.recordId, record]));
  if (dryRun) {
    console.log(JSON.stringify({ output, gateway, count: selected.length, candidates: selected }, null, 2));
    return;
  }
  fs.mkdirSync(output, { recursive: true });
  const pending = selected.filter(candidate => {
    const previous = records.get(candidate.recordId);
    const imageRel = `images/${candidate.characterId}/${candidate.blueprintId}/attempt-${attempt}.png`;
    const imageFile = path.join(output, imageRel.split('/').join(path.sep));
    if (!force && previous?.status === 'succeeded' && fs.existsSync(imageFile) && fs.statSync(imageFile).size > 1000) {
      console.log(`[reuse] ${candidate.recordId}`);
      return false;
    }
    return true;
  });
  if (limit < pending.length) pending.length = limit;
  console.log(`[plan] ${selected.length} candidates, ${pending.length} to generate (concurrency ${concurrency})`);
  let generated = 0;
  let failed = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const candidate = pending[cursor];
      cursor += 1;
      const imageRel = `images/${candidate.characterId}/${candidate.blueprintId}/attempt-${attempt}.png`;
      const imageFile = path.join(output, imageRel.split('/').join(path.sep));
      console.log(`[generate] ${candidate.recordId} ${candidate.width}x${candidate.height} seed ${candidate.seed}`);
      const result = await submitCandidate(gateway, candidate);
      if (!result.ok) {
        records.set(candidate.recordId, Object.assign({}, candidate, {
          status: 'failed', error: result.error, jobId: result.jobId || '', image: '', generatedAt: new Date().toISOString(),
        }));
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
  const normalized = [...records.values()].sort((left, right) =>
    left.characterId.localeCompare(right.characterId) || left.blueprintId.localeCompare(right.blueprintId) || left.attempt - right.attempt);
  writeJsonAtomic(manifestPath, normalized);
  console.log(JSON.stringify({ output, planned: selected.length, generated, failed }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error && error.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCandidate,
  planAll,
  buildSubmissionBody,
  nearestAnimaSize,
  stableSeed,
  constants: { DEFAULT_OUTPUT, ANIMA_MODEL_ID, ANIMA_PROFILE_ID, ARTIST_TAG },
};
