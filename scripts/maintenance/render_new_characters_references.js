#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
// 2026-08-29 参考图迁出项目 → AI 工作区 CharacterReferences（运行时 /character-references 服务根）；
// 新渲染直接落服务根（与 render-all-outfits-references.js 同一解析规则）。
const OUT_BASE = (() => {
  const ws = process.env.AI_WORKSPACE_ROOT || path.resolve(ROOT, '..', 'AI');
  const candidate = path.join(ws, 'CharacterReferences');
  return fs.existsSync(candidate) ? candidate : path.join(ROOT, 'assets', 'character-references');
})();
const BASE = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const CONCURRENCY = 3;

const standards = JSON.parse(fs.readFileSync(STANDARDS_FILE, 'utf8'));

const NEW_CHAR_IDS = new Set([
  'gotoh_hitori',
  'ayanami_rei',
  'asuka_langley',
  'furina',
  'hu_tao',
  'kafka',
  'hayase_yuuka',
  'shiromi_iori',
  'texas_arknights',
  'lappland_arknights',
  'viviana_arknights'
]);

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

function buildPrompt(charProfile, outfit, persId) {
  const pConfig = PERSPECTIVE_CONFIGS[persId];
  const isNude = outfit.isNsfw || outfit.outfitId === 'nsfw_nude';

  const promptParts = [
    isNude ? "nude, completely naked, uncensored, full body bare, natural skin" : "",
    charProfile.identityProse,
    outfit.prose,
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

function collectTasks() {
  const tasks = [];
  for (const cid of Object.keys(standards)) {
    if (!NEW_CHAR_IDS.has(cid)) continue;
    const charProfile = standards[cid];
    for (const outfit of charProfile.outfits) {
      const targetDir = path.join(OUT_BASE, cid, outfit.outfitId);
      fs.mkdirSync(targetDir, { recursive: true });

      for (const pers of outfit.references) {
        const targetPath = path.join(targetDir, pers.fileName);
        if (fs.existsSync(targetPath)) {
          const stat = fs.statSync(targetPath);
          if (stat.size > 20000) continue;
        }

        tasks.push({
          charId: cid,
          charName: charProfile.displayName,
          outfitId: outfit.outfitId,
          outfitName: outfit.outfitName,
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
  const charProfile = standards[task.charId];
  const outfit = charProfile.outfits.find(o => o.outfitId === task.outfitId);
  const { prompt, negative } = buildPrompt(charProfile, outfit, task.persId);

  const payload = {
    modelId: 'anima-miaomiao-v1.6',
    prompt,
    negative,
    width: 832,
    height: 1216,
    steps: 28,
    cfg: 4.5,
    teaCache: true,
    teaCacheThresh: 0.08,
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
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(`${BASE}/api/anima/jobs/${encodeURIComponent(jobId)}`);
    const statusJson = await statusRes.json();
    if (!statusRes.ok || !statusJson.ok || !statusJson.job) continue;

    const job = statusJson.job;
    if (job.status === 'succeeded' && job.resultUrl) {
      const imgRes = await fetch(`${BASE}${job.resultUrl}`);
      if (!imgRes.ok) throw new Error(`下载结果图失败: ${imgRes.status}`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(task.targetPath, buf);
      return;
    } else if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(`生成失败: ${job.error || job.status}`);
    }
  }
  throw new Error(`渲染超时 (10m)`);
}

async function main() {
  const tasks = collectTasks();
  console.log(`[New Characters Reference Pipeline] 待渲染参考图总数: ${tasks.length} 张`);

  let completed = 0;
  let failed = 0;

  async function worker(workerId) {
    while (tasks.length > 0) {
      const task = tasks.shift();
      const idx = completed + failed + 1;
      console.log(`[Worker ${workerId}][${idx}] 开始: [${task.charName}] - [${task.outfitName}] - [${task.persName}]...`);
      try {
        await renderImage(task);
        completed++;
        console.log(`[Worker ${workerId}][${idx}] ✓ 完成: ${task.targetPath}`);
      } catch (err) {
        failed++;
        console.error(`[Worker ${workerId}][${idx}] ✗ 失败: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  console.log(`\n=== 渲染完成! 成功: ${completed} 张, 失败: ${failed} 张 ===`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
