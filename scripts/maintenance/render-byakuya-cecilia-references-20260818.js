#!/usr/bin/env node
'use strict';

/**
 * 2026-08-18 重渲染：深森白夜 / 圣塞西莉亚 参考图（官方设定校准版）
 *
 * 背景：两角色参考图是按旧设定（白夜深蓝发姬发式 / 塞西莉亚银白双钻卷蓝眼）渲染的，
 * 今日审视校准为官方设定（银白发双螺旋角发包 / 薄荷绿发低盘发绿瞳），需全量重渲染。
 *
 * - 引擎：Anima Aesthetic v1.1（无 LoRA），3 并发
 * - 尺寸：832 × 1216
 * - 输出：assets/character-references/<id>/<outfit>/<id>_<outfit>_<pers>.png（带前缀，与 TS URL 一致）
 * - 断点：已存在且 > 20KB 跳过；异常自动重试（最多 5 次）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const BASE = process.env.GATEWAY || 'http://127.0.0.1:3000';
const CONCURRENCY = 3;
const FORCE = process.argv.includes('--force');

const TARGET_CHARS = ['mimori_byakuya', 'saint_cecilia'];

const standards = JSON.parse(fs.readFileSync(STANDARDS_FILE, 'utf8'));

const PERSPECTIVE_CONFIGS = {
  ref_01_face_closeup: {
    suffix: 'straight-on eye-level face and eyes extreme close-up portrait, 85mm f/1.4 shallow depth of field, soft bokeh, expressive anime eyes, looking at viewer, subtle gentle expression, soft cinematic studio key light, highly detailed facial features and skin texture, face centered in frame',
    negSuffix: 'full body, upper body, hands, extra limbs, blurry face, bad eyes, lowres, dutch angle, extreme low angle, extreme high angle',
  },
  ref_02_half_medium: {
    suffix: 'upper body focus, medium shot, waist up, cowboy shot, 3/4 view angle, hands visible resting naturally near waist, detailed outfit layers, fabric folds, cinematic soft studio lighting',
    negSuffix: 'full body, legs, feet, shoes, boots, bad anatomy, bad hands, extra limbs, cropped shoulders, blurry',
  },
  ref_03_full_dynamic: {
    suffix: '(standing upright:1.4), full body standing pose, entire figure visible from head to toe, straight vertical posture, legs straight and feet planted on the ground, front view, facing camera, looking at viewer, complete head, entire legs, full feet and shoes completely on the ground without cropping, clean studio floor shadow, balanced standing posture, full outfit details',
    negSuffix: 'sitting, seated, lying, reclining, back view, from behind, rear view, cropped head, cropped feet, cut off feet, out of frame, bad proportions, distorted legs',
  },
  ref_04_back_rear: {
    suffix: '45 degree angle from behind, looking back over shoulder toward camera, back view focus, back of hair, hair flow, rear outfit details, cinematic rim lighting, dramatic backlight, edge glow',
    negSuffix: 'front view, facing camera, frontal face, bad anatomy, lowres',
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
    isNude ? 'nude, completely naked, uncensored, full body bare, natural skin' : '',
    charTokens,
    outfitTokens,
    outfitProse,
    pConfig.suffix,
    '@rella, masterpiece, best quality, pristine anime aesthetic, clean cinematic lighting',
  ].filter(Boolean);

  const negParts = [
    'bad anatomy, bad hands, extra limbs, extra arms, extra legs, poorly drawn face, poorly drawn hands, missing fingers, extra digits, cropped, split image, split screen, multiple views, comic panel, collaged, sketch, lowres, blurry, jpeg artifacts, watermark, signature',
    isNude ? 'clothes, clothing, shirt, pants, dress, kimono, robe, towel, underwear, bra, panties, swimsuit, bikini, skirt, socks, footwear, shoes, fabric covering' : '',
    pConfig.negSuffix,
  ].filter(Boolean);

  return { prompt: promptParts.join(', '), negative: negParts.join(', ') };
}

function collectTasks() {
  const tasks = [];
  for (const char of standards.characters) {
    if (!TARGET_CHARS.includes(char.id)) continue;
    for (const outfit of char.outfits) {
      const targetDir = path.join(OUT_BASE, char.id, outfit.id);
      fs.mkdirSync(targetDir, { recursive: true });
      for (const pers of standards.perspectives) {
        // 带前缀文件名（与磁盘现状 / TS URL 一致）
        const targetPath = path.join(targetDir, `${char.id}_${outfit.id}_${pers.id}.png`);
        if (!FORCE && fs.existsSync(targetPath)) {
          const stat = fs.statSync(targetPath);
          if (stat.size > 20000) continue; // 已存在跳过（断点续跑）
        }
        if (FORCE && fs.existsSync(targetPath)) fs.unlinkSync(targetPath); // 强制重渲染：先删旧图
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

  const submitRes = await fetch(`${BASE}/api/anima/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

  if (!jobState?.resultUrl) throw new Error('渲染超时未返回图片');

  const imgRes = await fetch(`${BASE}${jobState.resultUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(task.targetPath, buffer);
}

async function main() {
  const tasks = collectTasks();
  console.log(`[重渲染] 目标角色: ${TARGET_CHARS.join(', ')} | 待渲染: ${tasks.length} 张`);

  if (tasks.length === 0) {
    console.log('所有目标参考图已就绪，无需重渲染');
    return;
  }

  let finishedCount = 0;
  let cursor = 0;

  async function worker(workerId) {
    while (cursor < tasks.length) {
      const idx = cursor++;
      const task = tasks[idx];
      const prefix = `[Worker ${workerId}][${idx + 1}/${tasks.length}]`;
      console.log(`${prefix} 开始渲染: [${task.charName}] - [${task.outfitName}] - [${task.persName}]...`);

      let success = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await renderImage(task);
          success = true;
          finishedCount++;
          console.log(`${prefix} ✓ 成功落盘: ${task.targetPath}`);
          break;
        } catch (err) {
          console.warn(`${prefix} ⚠️ 第 ${attempt} 次失败 (${err.message})，等待 4 秒重试...`);
          task.seed = Math.floor(Math.random() * 1000000000) + 100000000;
          await new Promise(r => setTimeout(r, 4000));
        }
      }
      if (!success) {
        console.error(`${prefix} ❌ 最终失败: [${task.charName}] [${task.outfitName}] [${task.persName}]`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);
  console.log(`[重渲染] 结束！完成: ${finishedCount}/${tasks.length}`);
}

main().catch(console.error);
