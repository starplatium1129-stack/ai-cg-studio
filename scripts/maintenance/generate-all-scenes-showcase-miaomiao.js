#!/usr/bin/env node
'use strict';

/**
 * scripts/maintenance/generate-all-scenes-showcase-miaomiao.js
 * 
 * 全库场景样张一站式批量生成与发布流水线（MiaoMiao Harem v1.2 专属正规编译版）：
 * 
 * 核心特性：
 * - 提示词编译：通过 buildPopularPromptPlan 完整绑定【角色核心DNA + 专属服装 + 场景蓝图 + @rella 画风 + 防分身/Solo守护】
 * - 专属女主角：宁宁/夏目 强制绑定官方 v21 LoRA (0.85 强度) 保证 100% 角色神韵
 * - 底模：MiaoMiao Harem Anima v1.2 (anima-miaomiao-v1.2)
 * - 极速画幅：832x1216 (竖版) / 1216x832 (横版)
 * - 加速机制：TeaCache (0.08 阈值, 1.9x 加速)
 * - 存储对齐：输出至 AI/SceneShowcase/2026-09-02_v27-miaomiao/ (大图+560px WebP缩略图+manifest.json)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const AI_ROOT = path.resolve(ROOT, '..', 'AI');
const SHOWCASE_ROOT = path.join(AI_ROOT, 'SceneShowcase');
const VERSION_TAG = '2026-09-02_v27-miaomiao';
const TARGET_VERSION_DIR = path.join(SHOWCASE_ROOT, VERSION_TAG);
const IMAGES_DIR = path.join(TARGET_VERSION_DIR, 'images');
const THUMBS_DIR = path.join(TARGET_VERSION_DIR, 'thumbs');

const BASE = process.env.GATEWAY_URL || process.env.BASE || 'http://127.0.0.1:3123';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3', 10);
const MODEL_ID = 'anima-miaomiao-v1.2';
const PROFILE_ID = 'anima_miaomiao_v12';
const ARTIST_TAG = 'rella';

const popularContent = require(path.join(ROOT, 'src', 'utils', 'popularContent.ts'));
const { artistTagsForEngine } = require(path.join(ROOT, 'src', 'config', 'artistStyles.ts'));

const BLUEPRINTS_FILE = path.join(ROOT, 'data', 'scene-blueprints.json');
const SCENES_FILE = path.join(ROOT, 'data', 'scenes.json');
const POPULAR_FILE = path.join(ROOT, 'data', 'popular-characters.json');
const PRESETS_FILE = path.join(ROOT, 'data', 'presets.json');

fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(THUMBS_DIR, { recursive: true });

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    force: args.includes('--force'),
    character: '',
    limit: 0,
  };
  const charIdx = args.indexOf('--character');
  if (charIdx !== -1 && args[charIdx + 1]) opts.character = args[charIdx + 1];
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) opts.limit = parseInt(args[limitIdx + 1], 10);
  return opts;
}

function resolveProfile() {
  const presets = JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf8'));
  const profile = (presets.model_profiles || []).find(item => item.id === PROFILE_ID || item.id === 'anima_base_v10');
  if (!profile) throw new Error(`presets.json missing profile for anima`);
  return profile;
}

function collectAllSceneTasks(opts) {
  const tasks = [];
  const popularRaw = JSON.parse(fs.readFileSync(POPULAR_FILE, 'utf8'));
  const characters = popularContent.parsePopularCharacters(popularRaw);
  const blueprintsRaw = JSON.parse(fs.readFileSync(BLUEPRINTS_FILE, 'utf8'));
  const blueprints = popularContent.parseSceneBlueprints(blueprintsRaw);
  const profile = resolveProfile();

  // 1. 热门角色场景蓝图（必须走 buildPopularPromptPlan 保证角色DNA）
  for (const character of characters) {
    if (opts.character && character.id !== opts.character) continue;
    const owned = blueprints.filter(bp => bp.characterId === character.id);
    
    for (const bp of owned) {
      const isHorizontal = bp.recommendedSize && (bp.recommendedSize.includes('1536x1152') || bp.recommendedSize.includes('1216x832') || bp.recommendedSize.includes('1344x768'));
      const width = isHorizontal ? 1216 : 832;
      const height = isHorizontal ? 832 : 1216;

      const outfit = (bp.outfitId && popularContent.findOutfit(character, bp.outfitId)) || popularContent.defaultOutfit(character);
      const decisions = popularContent.inferBlueprintDecisions(bp);
      const adult = Boolean(bp.adult);

      const plan = popularContent.buildPopularPromptPlan({
        character,
        outfit,
        blueprint: bp,
        engine: 'anima',
        profile,
        adultEnabled: true,
        shot: decisions.shot,
        lighting: decisions.lighting,
        composition: decisions.composition,
        artistTags: artistTagsForEngine([ARTIST_TAG], 'anima'),
      });

      if (!plan) continue;

      const cloneGuard = '(no clone:1.4), (no duplicate:1.4), (no twin:1.3), no duplicated character, no second copy, single subject only';
      const soloGuard = adult
        ? `(solo:1.5), (1girl:1.4), (single girl only:1.6), (one person only:1.6), no other person, no bystanders, ${cloneGuard}`
        : `(single girl only:1.4), (one person only:1.4), no second person, ${cloneGuard}`;
      
      const fullPrompt = plan.prompt.includes('\n')
        ? plan.prompt.replace('\n', `, ${soloGuard}\n`)
        : `${plan.prompt}, ${soloGuard}`;

      const bpNeg = Array.isArray(bp.negativeTokens) ? bp.negativeTokens.join(', ') : String(bp.negativeTokens || '');
      const cloneNegative = 'duplicate, clone, copy, doppelganger, twin, multiple girls, extra girl';
      const fullNegative = [plan.negative, bpNeg, cloneNegative].filter(Boolean).join(', ');

      tasks.push({
        id: bp.id,
        title: bp.title,
        characterId: character.id,
        prompt: fullPrompt,
        negative: fullNegative,
        width,
        height,
        targetPng: path.join(IMAGES_DIR, `${bp.id}.png`),
        targetBigJpg: path.join(IMAGES_DIR, `${bp.id}.jpg`),
        targetThumbJpg: path.join(THUMBS_DIR, `${bp.id}.jpg`),
        seed: Math.floor(Math.random() * 1000000000) + 100000000
      });
    }
  }

  // 2. 经典主线场景 (scenes.json - 宁宁/夏目主线)
  if (fs.existsSync(SCENES_FILE)) {
    const scenes = JSON.parse(fs.readFileSync(SCENES_FILE, 'utf8'));
    for (const sc of scenes) {
      if (opts.character && sc.char !== opts.character) continue;
      if (tasks.some(t => t.id === sc.id)) continue;

      const isHorizontal = sc.recommendedSize && (sc.recommendedSize.includes('1536x1152') || sc.recommendedSize.includes('1216x832') || sc.recommendedSize.includes('1344x768'));
      const width = isHorizontal ? 1216 : 832;
      const height = isHorizontal ? 832 : 1216;

      let prompt = sc.prompt || sc.title;
      if (!/@rella\b/i.test(prompt)) {
        prompt = `@rella, ${prompt}`;
      }
      const negative = sc.negative || 'worst quality, low quality, bad anatomy, blurry, watermark, duplicate, 2girls';

      tasks.push({
        id: sc.id,
        title: sc.title,
        characterId: sc.char || 'generic',
        prompt,
        negative,
        width,
        height,
        targetPng: path.join(IMAGES_DIR, `${sc.id}.png`),
        targetBigJpg: path.join(IMAGES_DIR, `${sc.id}.jpg`),
        targetThumbJpg: path.join(THUMBS_DIR, `${sc.id}.jpg`),
        seed: Math.floor(Math.random() * 1000000000) + 100000000
      });
    }
  }

  if (opts.limit > 0) return tasks.slice(0, opts.limit);
  return tasks;
}

async function renderSceneImage(task) {
  const payload = {
    modelId: MODEL_ID,
    prompt: task.prompt,
    negative: task.negative,
    width: task.width,
    height: task.height,
    steps: 30,
    cfg: 4.5,
    teaCache: true,
    teaCacheThresh: 0.08,
    seed: task.seed
  };

  // 专属女主角绑定官方 v21 训练 LoRA
  if (task.characterId === 'nene') {
    payload.character = 'nene';
    payload.loraId = 'L_NENE_V21_ANIMA';
    payload.loraStrength = 0.85;
  } else if (task.characterId === 'natsume') {
    payload.character = 'natsume';
    payload.loraId = 'L_NAT_V21_ANIMA';
    payload.loraStrength = 0.85;
  }

  const submitRes = await fetch(`${BASE}/api/anima/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const submitJson = await submitRes.json();
  if (!submitRes.ok || !submitJson.ok || !submitJson.job?.id) {
    throw new Error(`提交失败: ${JSON.stringify(submitJson)}`);
  }

  const jobId = submitJson.job.id;
  const deadline = Date.now() + 10 * 60 * 1000;
  let jobState = null;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const queryRes = await fetch(`${BASE}/api/anima/jobs/${encodeURIComponent(jobId)}`);
    const queryJson = await queryRes.json();
    if (queryRes.ok && queryJson.ok && queryJson.job) {
      jobState = queryJson.job;
      if (jobState.status === 'succeeded' && jobState.resultUrl) break;
      if (jobState.status === 'failed' || jobState.status === 'cancelled') {
        throw new Error(`渲染失败: ${jobState.error || jobState.status}`);
      }
    }
  }

  if (!jobState?.resultUrl) {
    throw new Error('渲染超时未返回图片');
  }

  const imgRes = await fetch(`${BASE}${jobState.resultUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(task.targetPng, buffer);

  // 转码为高质量 Progressive JPEG + 560px 缩略图
  try {
    const convertCmd = `python scripts/maintenance/convert-showcase-image.py "${task.targetPng}" "${task.targetBigJpg}" "${task.targetThumbJpg}"`;
    execSync(convertCmd, { cwd: ROOT, stdio: 'ignore' });
    if (fs.existsSync(task.targetPng)) fs.unlinkSync(task.targetPng);
  } catch (e) {
    console.warn(`[Warn] 转换缩略图失败: ${task.id}`);
  }
}

async function runWorker(tasksQueue, progress, total) {
  while (tasksQueue.length > 0) {
    const task = tasksQueue.shift();
    progress.current++;
    const idx = progress.current;
    
    console.log(`[${idx}/${total}] 🚀 正在出图: ${task.id} (${task.title}) [${task.width}x${task.height}]...`);
    
    try {
      await renderSceneImage(task);
      progress.success++;
      console.log(`[${idx}/${total}] ✅ 完成: ${task.id}`);
    } catch (err) {
      progress.fail++;
      console.error(`[${idx}/${total}] ❌ 失败: ${task.id} - ${err.message}`);
    }
  }
}

function updateManifest(allTasks) {
  const manifestFile = path.join(TARGET_VERSION_DIR, 'manifest.json');
  const manifest = {
    version: VERSION_TAG,
    generatedAt: new Date().toISOString(),
    engine: 'anima',
    modelId: MODEL_ID,
    count: allTasks.length,
    scenes: {}
  };

  allTasks.forEach(t => {
    manifest.scenes[t.id] = {
      id: t.id,
      title: t.title,
      character: t.characterId,
      image: `images/${t.id}.jpg`,
      thumb: `thumbs/${t.id}.jpg`,
      seed: t.seed,
      model: MODEL_ID
    };
  });

  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n📋 样张清单已生成: ${manifestFile}`);
}

async function main() {
  const opts = parseArgs();
  console.log(`\n======================================================`);
  console.log(`🎨 全库场景样张批量生成流水线 (MiaoMiao Harem v1.2 正规编译版)`);
  console.log(`   - 目标版本: ${VERSION_TAG}`);
  console.log(`   - 底模: ${MODEL_ID}`);
  console.log(`   - 极速画幅: 832x1216 (竖) / 1216x832 (横)`);
  console.log(`   - 并发: ${CONCURRENCY}`);
  console.log(`   - 强制重绘: ${opts.force}`);
  if (opts.character) console.log(`   - 过滤角色: ${opts.character}`);
  console.log(`======================================================\n`);

  const allTasks = collectAllSceneTasks(opts);
  const pendingTasks = allTasks.filter(t => {
    if (opts.force) return true;
    const hasThumb = fs.existsSync(t.targetThumbJpg) && fs.statSync(t.targetThumbJpg).size > 2048;
    return !hasThumb;
  });

  console.log(`全库场景总数: ${allTasks.length} | 待出图: ${pendingTasks.length} | 已有样张跳过: ${allTasks.length - pendingTasks.length}\n`);

  if (pendingTasks.length > 0) {
    const progress = { current: 0, success: 0, fail: 0 };
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      workers.push(runWorker(pendingTasks, progress, pendingTasks.length));
    }
    await Promise.all(workers);
    console.log(`\n🎉 出图批次结束: 成功 ${progress.success} 张 / 失败 ${progress.fail} 张`);
  } else {
    console.log(`✨ 本版本目录已有全部有效样张！`);
  }

  updateManifest(allTasks);
}

main().catch(err => {
  console.error('流水线异常终止:', err);
  process.exit(1);
});
