#!/usr/bin/env node
'use strict';

/**
 * 菲伦（Fern）全套形态 4 视角 Character Reference 重新渲染脚本（去肥胖/官方高挑匀称沙漏身材精调版）
 *
 * - 引擎：Anima Aesthetic v1.1
 * - 尺寸：832 × 1216
 * - 特性：强制正向修长匀称体态 + 强力负向拦截（fat/chubby/plump/obese/double chin/thick waist）
 * - 用法：
 *     node scripts/maintenance/render-fern-references-fixed.js          # 自动断点续跑
 *     node scripts/maintenance/render-fern-references-fixed.js --force  # 强制重新出全部 24 张
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const BASE = process.env.GATEWAY || 'http://127.0.0.1:3000';
const CONCURRENCY = 1;
const FORCE = process.argv.includes('--force');

const TARGET_CHAR = 'fern_frieren';

const standards = JSON.parse(fs.readFileSync(STANDARDS_FILE, 'utf8'));

const PERSPECTIVE_CONFIGS = {
  ref_01_face_closeup: {
    suffix: 'straight-on eye-level face and eyes extreme close-up portrait, 85mm f/1.4 shallow depth of field, soft bokeh, expressive anime eyes, looking at viewer, subtle gentle expression, soft cinematic studio key light, highly detailed delicate facial features and skin texture, face centered in frame, slender neck',
    negSuffix: 'full body, upper body, hands, extra limbs, blurry face, bad eyes, lowres, dutch angle, double chin, chubby face, fat cheeks',
  },
  ref_02_half_medium: {
    suffix: 'upper body focus, medium shot, waist up, cowboy shot, 3/4 view angle, hands visible resting naturally near waist, detailed outfit layers, fabric folds, cinematic soft studio lighting, slender waist, graceful anime proportions',
    negSuffix: 'full body, legs, feet, shoes, boots, bad anatomy, bad hands, extra limbs, cropped shoulders, blurry, fat, chubby, thick waist',
  },
  ref_03_full_dynamic: {
    suffix: '(standing upright:1.4), full body standing pose, entire figure visible from head to toe, straight vertical posture, slender shapely legs straight and feet planted on the ground, front view, facing camera, looking at viewer, complete head, entire legs, full feet and shoes completely on the ground without cropping, clean studio floor shadow, balanced standing posture, slender curvy silhouette with large breasts, full outfit details',
    negSuffix: 'sitting, seated, lying, reclining, back view, from behind, rear view, cropped head, cropped feet, cut off feet, out of frame, bad proportions, distorted legs, fat, chubby, plump, obese, overweight, heavy build, thick waist, wide hips, massive thighs, double chin',
  },
  ref_04_back_rear: {
    suffix: '45 degree angle from behind, looking back over shoulder toward camera, back view focus, back of hair, hair flow, slender waist, rear outfit details, cinematic rim lighting, dramatic backlight, edge glow',
    negSuffix: 'front view, facing camera, frontal face, bad anatomy, lowres, fat, chubby, thick waist, wide hips',
  },
};

function buildPrompt(char, outfit, persId) {
  const pConfig = PERSPECTIVE_CONFIGS[persId];
  const isNude = outfit.id === 'nsfw_nude' || (outfit.name || '').includes('全裸') || (outfit.name || '').includes('纯粹');

  let charTokens = Array.isArray(char.identityTokens) ? char.identityTokens.join(', ') : char.id;
  if (isNude) {
    charTokens = charTokens.replace(/\b(witch_hat|cape|dress|uniform|blazer|skirt|shoes|boots|gloves|jacket|coat|hoodie|thighhighs|socks|robe|veil|habit)\b/gi, '');
  }

  const outfitTokens = Array.isArray(outfit.tokens) && outfit.tokens.length > 0 ? outfit.tokens.join(', ') : '';
  const outfitProse = outfit.prose || '';

  const promptParts = [
    isNude ? 'nude, completely naked, uncensored, full body bare, natural skin, slender body, narrow waist' : '',
    charTokens,
    outfitTokens,
    outfitProse,
    pConfig.suffix,
    '@rella, masterpiece, best quality, pristine anime aesthetic, clean cinematic lighting',
  ].filter(Boolean);

  const negParts = [
    'bad anatomy, bad hands, extra limbs, extra arms, extra legs, poorly drawn face, poorly drawn hands, missing fingers, extra digits, cropped, split image, split screen, multiple views, comic panel, collaged, sketch, lowres, blurry, jpeg artifacts, watermark, signature',
    'fat, chubby, plump, obese, overweight, heavy build, double chin, thick waist, belly flab, massive hips, disproportionate thighs',
    isNude ? 'clothes, clothing, shirt, pants, dress, kimono, robe, towel, underwear, bra, panties, swimsuit, bikini, skirt, socks, footwear, shoes, fabric covering' : '',
    pConfig.negSuffix,
  ].filter(Boolean);

  return { prompt: promptParts.join(', '), negative: negParts.join(', ') };
}

function collectTasks() {
  const tasks = [];
  const char = standards.characters.find(c => c.id === TARGET_CHAR);
  if (!char) {
    console.error(`未在 standards 中找到角色: ${TARGET_CHAR}`);
    return [];
  }

  for (const outfit of char.outfits) {
    const targetDir = path.join(OUT_BASE, char.id, outfit.id);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const pers of standards.perspectives) {
      const targetPath = path.join(targetDir, `${char.id}_${outfit.id}_${pers.id}.png`);
      if (!FORCE && fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        if (stat.size > 20000) continue;
      }
      if (FORCE && fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      tasks.push({
        charId: char.id,
        charName: char.displayName,
        outfitId: outfit.id,
        outfitName: outfit.name,
        persId: pers.id,
        persName: pers.name,
        targetPath,
        seed: Math.floor(Math.random() * 1000000000) + 100000000,
      });
    }
  }
  return tasks;
}

async function renderImage(task) {
  const char = standards.characters.find(c => c.id === task.charId);
  const outfit = char.outfits.find(o => o.id === task.outfitId);
  const { prompt, negative } = buildPrompt(char, outfit, task.persId);

  const payload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt,
    negative,
    width: 832,
    height: 1216,
    steps: 28,
    cfg: 4.5,
    seed: task.seed,
  };

  let submitJson = null;
  for (let sAttempt = 0; sAttempt < 15; sAttempt++) {
    const submitRes = await fetch(`${BASE}/api/anima/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    submitJson = await submitRes.json();
    if (submitRes.ok && submitJson.ok && submitJson.job?.id) break;
    if (submitJson?.code === 'ANIMA_QUEUE_FULL') {
      await new Promise(r => setTimeout(r, 4000));
      continue;
    }
    throw new Error(`提交失败: ${JSON.stringify(submitJson)}`);
  }
  if (!submitJson?.job?.id) {
    throw new Error(`提交超时未进入队列: ${JSON.stringify(submitJson)}`);
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

  if (!jobState?.resultUrl) throw new Error('渲染超时未返回图片');

  const imgRes = await fetch(`${BASE}${jobState.resultUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(task.targetPath, buffer);
}

async function main() {
  const tasks = collectTasks();
  console.log(`[菲伦重渲染] 待渲染任务数: ${tasks.length} 张`);

  if (tasks.length === 0) {
    console.log('所有目标参考图已就绪。如需全量重出请添加 --force 参数。');
    return;
  }

  let finishedCount = 0;
  let errorCount = 0;
  const pool = [];

  async function worker(task) {
    const label = `[${task.outfitName}] ${task.persName} (${task.outfitId}/${task.persId})`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[渲染中] ${label} (尝试 ${attempt}/3)...`);
        await renderImage(task);
        finishedCount++;
        console.log(`[已完成 ${finishedCount}/${tasks.length}] ✓ ${label}`);
        return;
      } catch (err) {
        console.error(`[重试 ${attempt}/3] ✗ ${label} 错误: ${err.message}`);
        task.seed = Math.floor(Math.random() * 1000000000) + 100000000;
        if (attempt === 3) {
          errorCount++;
          console.error(`[失败] ${label} 达到最大重试次数`);
        } else {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }
  }

  for (let i = 0; i < tasks.length; i++) {
    const p = worker(tasks[i]);
    pool.push(p);
    if (pool.length >= CONCURRENCY) {
      await Promise.race(pool);
      for (let j = pool.length - 1; j >= 0; j--) {
        // clean settled promises
        pool[j].then(() => {
          const idx = pool.indexOf(pool[j]);
          if (idx !== -1) pool.splice(idx, 1);
        }).catch(() => {});
      }
    }
  }

  await Promise.all(pool);
  console.log(`\n[全部结束] 成功完成: ${finishedCount} / 失败: ${errorCount}`);
}

main().catch(err => {
  console.error('[致命错误]', err);
  process.exit(1);
});
