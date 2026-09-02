#!/usr/bin/env node
'use strict';

/**
 * 全量 35 角色 × 多服装形态（177 套服装 · 708 张）4 视角电影级资产批量渲染与断点续跑脚本
 * 
 * 规范：
 * - 引擎：MiaoMiao Harem Anima v1.2（半厚涂通透质感、二次元肉感解剖、高稳定性）
 * - 并发：3 并发任务池（安全稳定不爆显存）
 * - 尺寸：832 × 1216（兼顾出图速度与画面精细度）
 * - 容错与断点：已存在且体积 > 10KB 的图片自动跳过；异常自动重试
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const BASE = process.env.GATEWAY_URL || process.env.BASE || 'http://127.0.0.1:3123';
const CONCURRENCY = 3;

const standards = JSON.parse(fs.readFileSync(STANDARDS_FILE, 'utf8'));

const PERSPECTIVE_CONFIGS = {
  ref_01_face_closeup: {
    suffix: "face and eyes extreme close-up portrait, 85mm f/1.4 shallow depth of field, soft bokeh, expressive anime eyes, looking at viewer, subtle gentle expression, soft cinematic studio key light, highly detailed facial features and skin texture",
    negSuffix: "full body, upper body, hands, extra limbs, blurry face, bad eyes, lowres",
  },
  ref_02_half_medium: {
    suffix: "upper body focus, medium shot, waist up, cowboy shot, 3/4 view angle, hands visible resting naturally near waist, detailed outfit layers, fabric folds, cinematic soft studio lighting",
    negSuffix: "full body, legs, feet, shoes, boots, bad anatomy, bad hands, extra limbs, cropped shoulders, blurry",
  },
  ref_03_full_dynamic: {
    suffix: "full body standing, entire figure visible from head to toe, front view, facing camera, looking at viewer, complete head, entire legs, full feet and shoes completely on the ground without cropping, clean studio floor shadow, balanced standing posture, full outfit details",
    negSuffix: "back view, from behind, rear view, cropped head, cropped feet, cut off feet, out of frame, bad proportions, distorted legs",
  },
  ref_04_back_rear: {
    suffix: "45 degree angle from behind, looking back over shoulder toward camera, back view focus, back of hair, hair flow, rear outfit details, cinematic rim lighting, dramatic backlight, edge glow",
    negSuffix: "front view, facing camera, frontal face, bad anatomy, lowres",
  }
};

function buildPrompt(char, outfit, persId) {
  const pConfig = PERSPECTIVE_CONFIGS[persId];
  const isNude = outfit.id === 'nsfw_nude' || outfit.name.includes('全裸') || outfit.name.includes('纯粹');

  let charTokens = Array.isArray(char.identityTokens) ? char.identityTokens.join(', ') : char.id;
  // 如果是全裸形态，剥离角色特征里可能自带的衣物 token
  if (isNude) {
    charTokens = charTokens.replace(/\b(witch_hat|cape|dress|uniform|blazer|skirt|shoes|boots|gloves|jacket|coat|hoodie|thighhighs|socks)\b/gi, '');
  }

  const outfitTokens = Array.isArray(outfit.tokens) && outfit.tokens.length > 0 ? outfit.tokens.join(', ') : '';
  const outfitProse = outfit.prose || '';

  const promptParts = [
    isNude ? "nude, completely naked, uncensored, full body bare, natural skin" : "",
    charTokens,
    outfitTokens,
    outfitProse,
    pConfig.suffix,
    "@rella, masterpiece, best quality, pristine anime aesthetic, clean cinematic lighting"
  ].filter(Boolean);

  const negParts = [
    "bad anatomy, bad hands, extra limbs, extra arms, extra legs, poorly drawn face, poorly drawn hands, missing fingers, extra digits, cropped, split image, split screen, multiple views, comic panel, collaged, sketch, lowres, blurry, jpeg artifacts, watermark, signature",
    isNude ? "clothes, clothing, shirt, pants, dress, kimono, robe, towel, underwear, bra, panties, panties_pull, swimsuit, bikini, skirt, socks, footwear, shoes, fabric covering" : "",
    pConfig.negSuffix
  ].filter(Boolean);

  return {
    prompt: promptParts.join(', '),
    negative: negParts.join(', ')
  };
}

// 收集所有待渲染任务
function collectTasks() {
  const tasks = [];
  for (const char of standards.characters) {
    for (const outfit of char.outfits) {
      // 目标目录：如果是默认服装且主目录已存在旧单服装图，则放入 outfit 子目录；非默认服装放 outfit 子目录
      const targetDir = path.join(OUT_BASE, char.id, outfit.id);
      fs.mkdirSync(targetDir, { recursive: true });

      for (const pers of standards.perspectives) {
        const targetPath = path.join(targetDir, `${pers.id}.png`);
        
        // 检查是否已经存在（并且大小合格）
        if (fs.existsSync(targetPath)) {
          const stat = fs.statSync(targetPath);
          if (stat.size > 20000) {
            continue; // 已存在跳过
          }
        }

        tasks.push({
          charId: char.id,
          charName: char.displayName,
          outfitId: outfit.id,
          outfitName: outfit.name,
          persId: pers.id,
          persName: pers.name,
          targetPath,
          seed: Math.floor(Math.random() * 1000000000) + 100000000
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
    modelId: 'anima-miaomiao-v1.2',
    prompt,
    negative,
    width: 832,
    height: 1216,
    steps: 28,
    cfg: 4.5,
    seed: task.seed
  };

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
  fs.writeFileSync(task.targetPath, buffer);
}

async function main() {
  const tasks = collectTasks();
  console.log(`[Batch Outfits Pipeline] 待渲染任务总数: ${tasks.length} 张`);

  if (tasks.length === 0) {
    console.log(`[Batch Outfits Pipeline] 所有服装形态 4 视角参考图已全部就绪！`);
    return;
  }

  let finishedCount = 0;
  let cursor = 0;
  // 原子取任务：同步递增，避免未来在取任务前插入 await 导致竞态
  function nextTask() {
    if (cursor >= tasks.length) return null;
    const idx = cursor++;
    return { task: tasks[idx], idx };
  }

  async function worker(workerId) {
    while (true) {
      const next = nextTask();
      if (!next) break;
      const { task, idx } = next;
      const prefix = `[Worker ${workerId}][${idx + 1}/${tasks.length}]`;
      console.log(`${prefix} 开始渲染: [${task.charName}] - [${task.outfitName}] - [${task.persName}]...`);

      let success = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await renderImage(task);
          success = true;
          finishedCount++;
          console.log(`${prefix} ✓ 成功完成并落盘: ${task.targetPath}`);
          break;
        } catch (err) {
          console.warn(`${prefix} ⚠️ 第 ${attempt} 次失败 (${err.message})，等待 4 秒重试...`);
          task.seed = Math.floor(Math.random() * 1000000000) + 100000000;
          await new Promise(r => setTimeout(r, 4000));
        }
      }
      if (!success) {
        console.error(`${prefix} ❌ 最终渲染失败: [${task.charName}] [${task.outfitName}] [${task.persName}]`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);
  console.log(`[Batch Outfits Pipeline] 全量多服装 4 视角渲染任务全部结束！共完成: ${finishedCount}/${tasks.length}`);
}

main().catch(console.error);
