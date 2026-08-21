'use strict';

/**
 * ab-exact-tokens-space.js — exactTokens 括号消歧 A/B 出图验证（2026-08-21 待办）。
 *
 * 背景：Anima 官方规则「标签一律小写+空格，唯一例外 score_」；括号消歧角色 tag
 * 应写 `rem (re zero)` 而非 `rem_(re_zero)`（tokenizer 不做下划线转换，下划线=字面
 * 字符）。项目数据当前是下划线形式，且被 formatPromptForEngine 的 exact 保护原样
 * 送进 prompt——需要 A/B 实测空格形式还原度不降后再批量改数据。
 *
 * 用法：
 *   node scripts/maintenance/ab-exact-tokens-space.js --characters rem_rezero,surtr_arknights --gateway http://127.0.0.1:3000
 *
 * 对每组角色出两张图：A=现网数据（下划线），B=同数据仅把括号消歧 tag 改空格形式。
 * 同 blueprint、同 seed、同参数，唯一变量是 tag 形式。输出 runtime/ab-exact-tokens/。
 */

const fs = require('fs');
const path = require('path');

const popularContent = require('../../src/utils/popularContent.ts');
const { artistTagsForEngine } = require('../../src/config/artistStyles.ts');
const animaConstants = require('../../routes/anima.js').constants;
const animaGenerationContract = require('../../server/anima-generation-contract.js');

const popularData = require('../../data/popular-characters.json');
const blueprintData = require('../../data/scene-blueprints.json');
const presets = require('../../data/presets.json');

const ANIMA_PROFILE_ID = 'anima_aesthetic_v11';
const ANIMA_MODEL_ID = 'anima-aesthetic-v1.1';
// 每个角色用于对比的场景：选非 R18、能体现角色身份的默认场景（第一个原型场景）。
const ARTIST_TAG = 'muririn';

function argument(name, fallback) {
  const index = process.argv.indexOf('--' + name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

/** 把括号消歧 tag 的下划线形式改写为 Anima 官方空格形式；其余 token 不动。 */
function toSpacedDisambiguation(token) {
  // rem_(re_zero) → rem (re zero)；jeanne_d'arc_alter_(fate) → jeanne d'arc alter (fate)
  const match = String(token).match(/^([a-z0-9_'’]+)_\(([a-z0-9_’']+)\)$/i);
  if (!match) return null;
  const name = match[1].replace(/_/g, ' ');
  const qualifier = match[2].replace(/_/g, ' ');
  return `${name} (${qualifier})`;
}

function spacedVariant(character) {
  const clone = JSON.parse(JSON.stringify(character));
  let renamed = [];
  const map = new Map();
  for (const field of ['exactTokens', 'identityTokens', 'aliases']) {
    clone[field] = clone[field].map(token => {
      const spaced = toSpacedDisambiguation(token);
      if (!spaced) return token;
      map.set(token, spaced);
      renamed.push(`${field}: ${token} -> ${spaced}`);
      return spaced;
    });
  }
  return { character: clone, renamed };
}

function resolveProfile() {
  const profile = (presets.model_profiles || []).find(item => item.id === ANIMA_PROFILE_ID);
  if (!profile) throw new Error(`presets.json missing profile ${ANIMA_PROFILE_ID}`);
  return profile;
}

function stableSeed(text) {
  const hash = require('crypto').createHash('sha256').update(text).digest();
  return hash.readUInt32BE(0) % 4294967295;
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

async function main() {
  const gateway = argument('--gateway', 'http://127.0.0.1:3000');
  const characterIds = String(argument('--characters', 'rem_rezero,surtr_arknights')).split(',').map(s => s.trim()).filter(Boolean);

  const characters = popularContent.parsePopularCharacters(popularData);
  const blueprints = popularContent.parseSceneBlueprints(blueprintData);
  const profile = resolveProfile();

  const outputDir = path.resolve('runtime', 'ab-exact-tokens');
  fs.mkdirSync(outputDir, { recursive: true });

  // 网关与 ComfyUI 就绪检查
  const status = await gatewayJson(gateway, '/api/anima/status');
  if (!status.data || !status.data.online) {
    throw new Error('Anima backend not online; start gateway + ComfyUI first. status=' + JSON.stringify(status.data || status.error));
  }

  const jobs = [];
  for (const id of characterIds) {
    const base = characters.find(c => c.id === id);
    if (!base) throw new Error(`unknown character ${id}`);
    const variant = spacedVariant(base);
    console.log(`[variant] ${id}\n  ${variant.renamed.join('\n  ')}`);

    const blueprint = blueprints.find(bp => bp.characterId === id && !bp.adult);
    if (!blueprint) throw new Error(`no non-adult blueprint for ${id}`);

    for (const [label, character] of [['a-underscore', base], ['b-spaced', variant.character]]) {
      const outfit = (blueprint.outfitId && popularContent.findOutfit(character, blueprint.outfitId))
        || popularContent.defaultOutfit(character);
      const decisions = popularContent.inferBlueprintDecisions(blueprint);
      const result = popularContent.buildPopularPromptPlan({
        character, outfit, blueprint,
        engine: 'anima', profile,
        adultEnabled: true,
        shot: decisions.shot, lighting: decisions.lighting, composition: decisions.composition,
        artistTags: artistTagsForEngine([ARTIST_TAG], 'anima'),
      });
      if (!result) throw new Error(`prompt build failed for ${id}/${label}`);
      const seed = stableSeed(`ab-exact-tokens:${id}`);
      jobs.push({
        label, characterId: id, blueprintId: blueprint.id,
        seed,
        prompt: result.prompt,
        body: {
          prompt: result.prompt, negative: result.negative,
          modelId: ANIMA_MODEL_ID,
          width: 832, height: 1216,
          steps: animaGenerationContract.ANIMA_DEFAULTS.steps,
          cfg: animaGenerationContract.ANIMA_DEFAULTS.cfg,
          seed,
        },
      });
    }
  }

  // 提交并轮询
  const results = [];
  for (const job of jobs) {
    const submitted = await gatewayJson(gateway, '/api/anima/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job.body),
    });
    if (!submitted.response || !submitted.response.ok) {
      throw new Error(`submit failed for ${job.characterId}/${job.label}: ${submitted.response && submitted.response.status} ${JSON.stringify(submitted.data)}`);
    }
    const createdBody = submitted.data || {};
    const created = (createdBody.data && createdBody.data.job) || createdBody.job;
    if (!created || !created.id) throw new Error(`no job id in response for ${job.characterId}/${job.label}: ${JSON.stringify(createdBody).slice(0, 300)}`);
    console.log(`[submitted] ${job.characterId}/${job.label} job=${created.id} seed=${job.seed}`);
    results.push({ meta: job, job: created });
    fs.writeFileSync(path.join(outputDir, 'ab-jobs-pending.json'), JSON.stringify(results.map(r => ({
      id: r.job.id, label: r.meta.label, characterId: r.meta.characterId,
      promptFile: `${r.meta.characterId}_${r.meta.label}.prompt.txt`,
    })), null, 2));
    const promptFile = path.join(outputDir, `${job.characterId}_${job.label}.prompt.txt`);
    fs.writeFileSync(promptFile, job.prompt);
  }

  // 轮询到全部完成（单队列串行出图，每张最长 10 分钟）
  const deadline = Date.now() + 60 * 60 * 1000;
  while (results.some(r => !r.file)) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    for (const r of results) {
      if (r.file) continue;
      const state = await gatewayJson(gateway, `/api/anima/jobs/${encodeURIComponent(r.job.id)}`);
      const body = state.data || {};
      const job = (body.data && body.data.job) || body.job;
      if (!job) continue;
      if (job.status === 'succeeded' && job.resultUrl) {
        const imageResponse = await fetch(gateway.replace(/\/$/, '') + job.resultUrl, { cache: 'no-store' });
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        r.file = `${r.meta.characterId}_${r.meta.label}.png`;
        fs.writeFileSync(path.join(outputDir, r.file), buffer);
        console.log(`[done] ${r.file} (${Math.round(buffer.length / 1024)} KB)`);
      } else if (job.status === 'failed') {
        r.error = job.error || 'failed';
        console.log(`[failed] ${r.meta.characterId}/${r.meta.label}: ${r.error}`);
      }
    }
    if (Date.now() > deadline) {
      console.error('[timeout] waiting for jobs exceeded 60min');
      break;
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    outputDir,
    pairs: [],
  };
  for (let i = 0; i < results.length; i += 2) {
    const a = results[i];
    const b = results[i + 1];
    summary.pairs.push({
      characterId: a.meta.characterId,
      a: { file: a.file || null, error: a.error || null, promptFile: `${a.meta.characterId}_a-underscore.prompt.txt` },
      b: { file: b ? b.file || null : null, error: b ? b.error || null : null, promptFile: b ? `${b.meta.characterId}_b-spaced.prompt.txt` : null },
    });
  }
  fs.writeFileSync(path.join(outputDir, 'ab-summary.json'), JSON.stringify(summary, null, 2));
  console.log('[summary] ' + JSON.stringify(summary.pairs, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
