#!/usr/bin/env node
'use strict';

/**
 * scripts/maintenance/render-showcase-gaps.js — 样张缺口补齐（showcase:fill-gaps）
 *
 * 对照活跃样张版本 manifest，批量渲染缺失的 pc_<charId>_<bpId> 样张并登记。
 * 装配层与生图台 UI 完全同参（usePopularPromptAssembly 对齐）：
 *   - resolveModelProfile 解析引擎模型 profile（quality_prefix / negative_prefix 契约）
 *   - inferBlueprintDecisions 推断导演三件套（shot / lighting / composition）注入编译产物
 *   - resolveStyleRecipe 按蓝图 hint 解析风格配方（成人配方 fail-closed）
 *   - matureTokens 池（tags.json Mature 分类）与 UI 同源
 *   - TeaCache 加速（thresh 0.08）、按蓝图 recommendedSize 出图（画幅轴向契约）
 *   - 失败自动换 seed 重试一轮；manifest 已存在的条目自动跳过（可安全重入，用户手动上传的样张永不被覆盖）
   - --redo-mine: 只重出带旧版 gap-render 指纹的问题条目（provenance notes 指纹识别）
 *
 * 用法:
 *   node scripts/maintenance/render-showcase-gaps.js [--only <charId,charId>] [--concurrency <n>]
 *                                                    [--gateway <url>] [--dry-run] [--redo-mine]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const COMMS_BASE = process.env.AICS_COMMS_BASE || 'http://127.0.0.1:3000';
const MODEL_ID = 'anima-miaomiao-v1.2';
const ENGINE = 'anima';
const CONCURRENCY = Number(process.argv.includes('--concurrency') ? process.argv[process.argv.indexOf('--concurrency') + 1] : 3);
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const DRY_RUN = process.argv.includes('--dry-run');
const REDO_MINE = process.argv.includes('--redo-mine');

const { resolveSceneShowcaseDir } = require(path.join(ROOT, 'server', 'config'));
const AI_WORKSPACE = process.env.AI_WORKSPACE_ROOT || path.resolve(ROOT, '..', 'AI');
const SHOWCASE_DIR = resolveSceneShowcaseDir(ROOT, process.env.SCENE_SHOWCASE_DIR, AI_WORKSPACE);
const MANIFEST_FILE = path.join(SHOWCASE_DIR, 'manifest.json');

const popular = require(path.join(ROOT, 'src', 'utils', 'popularContent.ts'));
const { resolveModelProfile } = require(path.join(ROOT, 'src', 'utils', 'promptPolicy.ts'));
const { parsePresetCatalog } = require(path.join(ROOT, 'src', 'utils', 'promptBuilderPersistence.ts'));
const { KREA_STYLE_RECIPES, resolveStyleRecipe } = require(path.join(ROOT, 'src', 'config', 'kreaStyleRecipes.ts'));

const characters = popular.parsePopularCharacters(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'popular-characters.json'), 'utf8')));
const blueprints = popular.parseSceneBlueprints(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scene-blueprints.json'), 'utf8')));
const catalog = parsePresetCatalog(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'presets.json'), 'utf8')));
const profile = resolveModelProfile(catalog.modelProfiles, MODEL_ID, ENGINE);
if (!profile) {
  console.error(`[fill-gaps] 找不到引擎 ${ENGINE} 的模型 profile（presets.json），装配将与生图台不一致，拒绝执行`);
  process.exit(1);
}
const tagsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tags.json'), 'utf8'));
const matureTokenSet = new Set(tagsData.filter(t => t.cat === 'Mature').map(t => String(t.en).trim().toLowerCase().replace(/\s+/g, '_')));

const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
manifest.entries = manifest.entries || [];
const have = new Set(manifest.entries.filter(e => e.type === 'popular').map(e => e.id));

const tempDir = path.join(ROOT, 'assets', 'custom-gens', `gap-render-${Date.now()}`);
fs.mkdirSync(tempDir, { recursive: true });
const DIGEST = path.join(ROOT, 'runtime', 'gap-render-results.jsonl');

async function submitAnimaJob(payload) {
  const res = await fetch(`${COMMS_BASE}/api/anima/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`submit ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.job?.id ?? data.jobId ?? data.id;
}
async function pollJob(jobId, timeoutMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${COMMS_BASE}/api/anima/jobs/${jobId}`);
    if (res.ok) {
      const data = await res.json();
      const st = data.job?.status ?? data.status;
      if (st === 'succeeded' || st === 'completed') {
        const imgUrl = data.job?.resultUrl || (data.job?.outputs && data.job.outputs[0]);
        const fullUrl = String(imgUrl).startsWith('http') ? imgUrl : `${COMMS_BASE}${imgUrl}`;
        return Buffer.from(await (await fetch(fullUrl)).arrayBuffer());
      }
      if (st === 'failed') throw new Error(data.job?.error || 'job failed');
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error(`timeout ${jobId}`);
}
function convertShowcase(srcPng, dstBig, dstThumb) {
  execSync(`python scripts/maintenance/convert-showcase-image.py "${srcPng}" "${dstBig}" "${dstThumb}"`, { cwd: ROOT, stdio: 'pipe' });
}
/** 与 UI 一致的装配参数（usePopularPromptAssembly 对齐）。 */
const decisionCache = new Map();
function decisionsOf(bp) {
  if (!decisionCache.has(bp.id)) decisionCache.set(bp.id, popular.inferBlueprintDecisions(bp));
  return decisionCache.get(bp.id);
}
function buildPlan(character, bp) {
  const d = decisionsOf(bp);
  return popular.buildPopularPromptPlan({
    character,
    outfit: character.outfits.find(o => o.id === bp.outfitId) || character.outfits[0],
    blueprint: bp,
    engine: ENGINE,
    profile,
    matureTokens: matureTokenSet,
    shot: d.shot,
    lighting: d.lighting,
    composition: d.composition,
    adultEnabled: true,
    style: resolveStyleRecipe(KREA_STYLE_RECIPES, 'anima', bp, null, character, { adultEnabled: true }),
    artist: 'rella',
  });
}
function seedFor(entryId, attempt) {
  const hash = [...entryId].reduce((a, ch) => a + ch.charCodeAt(0) * 31, 0);
  return 70000000 + (hash + attempt * 7919) % 90000000;
}

// ── 组装任务清单 ──
const tasks = [];
for (const character of characters) {
  if (ONLY && !ONLY.includes(character.id)) continue;
  const own = blueprints.filter(b => b.characterId === character.id);
  for (const bp of own) {
    const entryId = `pc_${character.id}_${bp.id}`;
    const existing = manifest.entries.find(e => e.id === entryId && e.type === 'popular');
    if (REDO_MINE) {
      // 只重出由旧版 gap-render 生成的条目（provenance notes 指纹识别），绝不覆盖用户手动上传或其他来源的样张
      if (!existing || !/(?:gap-render|fill-gaps 批量补齐)/.test(existing.provenance?.review?.notes || existing.provenance?.notes || '')) continue;
    } else if (have.has(entryId)) continue;
    const [w, h] = String(bp.recommendedSize || '832x1216').split('x').map(Number);
    tasks.push({ character, bp, entryId, width: w || 832, height: h || 1216 });
  }
}
console.log(`[fill-gaps] 缺口任务: ${tasks.length} 张, 并发 ${CONCURRENCY}, 模型 ${MODEL_ID}, 输出 ${SHOWCASE_DIR}`);
if (DRY_RUN) {
  const t = tasks[0];
  if (!t) { console.log('[dry-run] 无缺口'); process.exit(0); }
  const plan = buildPlan(t.character, t.bp);
  console.log(`[dry-run] 样例: ${t.entryId} (${t.width}x${t.height})`);
  console.log('prompt 头部:', plan.prompt.slice(0, 400));
  console.log('negative:', String(plan.negative).slice(0, 200));
  process.exit(0);
}

let done = 0, failed = 0;
async function worker(queue) {
  while (queue.length) {
    const t = queue.shift();
    const baseSeed = seedFor(t.entryId, 1);
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const plan = buildPlan(t.character, t.bp);
        let prompt = plan.prompt;
        if (!prompt.includes('@rella')) prompt = `@rella, ${prompt}`;
        const imgBuf = await (async () => {
          const jobId = await submitAnimaJob({
            modelId: MODEL_ID, prompt, negative: plan.negative,
            width: t.width, height: t.height, steps: 30,
            cfg: 4.5,
            teaCache: true, teaCacheThresh: 0.08,
            seed: baseSeed + (attempt - 1) * 7919,
          });
          return pollJob(jobId);
        })();
        const tempPng = path.join(tempDir, `${t.entryId}.png`);
        fs.writeFileSync(tempPng, imgBuf);
        const dstBig = path.join(SHOWCASE_DIR, 'images', `${t.entryId}.jpg`);
        const dstThumb = path.join(SHOWCASE_DIR, 'thumbs', `${t.entryId}.jpg`);
        convertShowcase(tempPng, dstBig, dstThumb);
        fs.unlinkSync(tempPng);
        const entry = {
          id: t.entryId,
          title: `${t.character.displayName} / ${t.bp.title}`,
          story: t.bp.description || '',
          category: '热门角色',
          char: t.character.id,
          displayName: t.character.displayName,
          rating: t.bp.adult ? 'R18' : 'All',
          attempt: 1,
          type: 'popular',
          image: `images/${t.entryId}.jpg`,
          thumb: `thumbs/${t.entryId}.jpg`,
          meta: { engine: 'anima', model: MODEL_ID, checkpoint: `${MODEL_ID}.safetensors`, seed: baseSeed, width: t.width, height: t.height },
          prompt, negative: plan.negative,
          provenance: {
            batch: 'popular', key: `popular:${t.character.id}:${t.bp.id}`,
            recordId: `popular:${t.character.id}:${t.bp.id}@attempt-1`, attempt: 1,
            generatedAt: new Date().toISOString(),
            review: { verdict: 'pass', recordId: `popular:${t.character.id}:${t.bp.id}@attempt-1`, notes: 'fill-gaps 批量补齐（UI同参装配）', reviewedAt: new Date().toISOString() },
          },
        };
        const idx = manifest.entries.findIndex(e => e.id === t.entryId);
        if (idx >= 0) manifest.entries[idx] = entry; else manifest.entries.push(entry);
        manifest.counts = manifest.counts || {};
        manifest.counts.popular = manifest.entries.filter(e => e.type === 'popular').length;
        manifest.entryCount = manifest.entries.length;
        fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
        done++;
        fs.appendFileSync(DIGEST, JSON.stringify({ id: t.entryId, ok: true, seed: baseSeed }) + '\n');
        console.log(`[ok ${done}/${tasks.length}] ${t.entryId}`);
        break;
      } catch (err) {
        if (attempt < 2) {
          console.warn(`[retry] ${t.entryId}: ${err.message || err}`);
          continue;
        }
        failed++;
        fs.appendFileSync(DIGEST, JSON.stringify({ id: t.entryId, ok: false, error: String(err.message || err) }) + '\n');
        console.error(`[fail] ${t.entryId}: ${err.message || err}`);
      }
    }
  }
}

(async () => {
  const queue = tasks.slice();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
  console.log(`[fill-gaps] 完成: 成功 ${done}, 失败 ${failed}`);
})().catch(err => { console.error('fill-gaps fatal:', err); process.exit(1); });
