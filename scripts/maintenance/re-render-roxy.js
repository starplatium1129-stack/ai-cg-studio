#!/usr/bin/env node
'use strict';

/**
 * 洛琪希（Roxy Migurdia）特征精准纠偏与 4 视角全量形态重绘：
 * - 纠偏点：洛琪希为【米格路德族 (Migurd)】，长相幼态、正常圆圆的人类耳朵（normal_ears, round_ears），绝非精灵耳！
 * - 负向全面封杀：elf_ears, pointy_ears, long_ears, fake_ears
 * - 特征锁定：long_blue_hair, twin_braids (双麻花辫), deep blue eyes, mole on left collarbone
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'http://127.0.0.1:3000';
const OUT_BASE = path.join(ROOT, 'assets', 'character-references', 'roxy_migurdia');

const OUTFITS = [
  {
    id: "witch_outfit",
    name: "魔女服",
    tokens: "witch, witch_hat, white_shirt, blue_skirt, frills, thighhighs, wooden_staff",
    prose: "her iconic short witch outfit with a blue hat, white blouse, and blue pleated skirt"
  },
  {
    id: "casual",
    name: "便服",
    tokens: "casual_clothes, dress, blue_clothes, long_sleeves",
    prose: "a relaxed casual dress in soft blue tones"
  },
  {
    id: "adventurer",
    name: "冒险装",
    tokens: "adventurer, cape, boots, pants, travel_bag",
    prose: "a practical adventurer outfit with a travel cape and boots"
  },
  {
    id: "nsfw_nude",
    name: "私密全裸 / 纯粹形态",
    isNude: true,
    tokens: "completely_naked, uncensored, full body bare, natural skin, small_breasts, pink_nipples, navel, bare_shoulders, collarbone, bare_legs, bare_feet",
    prose: "her bare natural form, soft youthful skin, small breasts, and slender figure"
  }
];

const PERSPECTIVES = [
  {
    id: "ref_01_face_closeup",
    name: "面部特写",
    suffix: "tight headshot portrait, extreme close-up on face, chin to forehead framing, 85mm macro lens, face focus, eye level straight-on, calm intelligent blue eyes, soft gentle expression, soft cinematic studio lighting",
    negative: "torso, body, arms, hands, legs, waist, skirt, cleavage, wide shot, high angle, bird's eye view, full body"
  },
  {
    id: "ref_02_half_medium",
    name: "3/4半身定妆",
    suffix: "medium cowboy shot, waist up, angled body, 3/4 turn angle, torso turned 45 degrees from camera, hands resting naturally, detailed outfit layers, clean studio lighting",
    negative: "straight front view, facing camera squarely, full body, feet, shoes, boots, extreme closeup, face only"
  },
  {
    id: "ref_03_full_dynamic",
    name: "正面全身立姿",
    suffix: "full body shot from head to toe, entire petite figure visible, front view, standing straight on ground, shoes completely visible without cut-off, balanced standing posture",
    negative: "cropped feet, cut off feet, cropped head, knees up, waist up, sitting, out of frame, rear view"
  },
  {
    id: "ref_04_back_rear",
    name: "45°侧后背影",
    suffix: "view from behind, back view focus, 45 degree angle rear shot, turned away from camera, looking back over shoulder, back of hair, twin braids flow, dramatic backlight, rim lighting",
    negative: "front view, frontal chest, facing camera directly"
  }
];

function buildRoxyPrompt(outfit, pers) {
  const isNude = outfit.isNude;
  const baseTokens = "roxy_migurdia, 1girl, solo, long_blue_hair, twin_braids, blue_eyes, normal human ears, round ears, ears covered by hair, mole_on_collarbone, petite_female, mushoku_tensei";
  
  let outfitTokens = outfit.tokens;
  if (pers.id === 'ref_01_face_closeup') {
    outfitTokens = outfitTokens.replace(/\b(boots|shoes|socks|thighhighs|skirt|pants|wooden_staff)\b/gi, '');
  }

  const promptParts = [
    isNude ? "nude, completely naked, uncensored, full body bare, natural skin" : "",
    baseTokens,
    outfitTokens,
    outfit.prose,
    pers.suffix,
    "@rella, masterpiece, best quality, pristine anime aesthetic, clean cinematic lighting"
  ].filter(Boolean);

  const negParts = [
    "(elf_ears:1.4), (pointy_ears:1.4), (long_ears:1.3), (fake_ears:1.3), (animal_ears:1.3)",
    "bad anatomy, bad hands, extra limbs, extra arms, extra legs, poorly drawn face, poorly drawn hands, missing fingers, extra digits, cropped, split image, split screen, multiple views, comic panel, collaged, sketch, lowres, blurry, jpeg artifacts, watermark, signature",
    isNude ? "clothes, clothing, shirt, pants, dress, kimono, robe, towel, underwear, bra, panties, swimsuit, bikini, skirt, socks, footwear, shoes, fabric covering" : "",
    pers.negative
  ].filter(Boolean);

  return {
    prompt: promptParts.join(', '),
    negative: negParts.join(', ')
  };
}

async function renderImage(outfit, pers, targetPath) {
  const { prompt, negative } = buildRoxyPrompt(outfit, pers);
  const payload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt,
    negative,
    width: 832,
    height: 1216,
    steps: 28,
    cfg: 4.5,
    seed: Math.floor(Math.random() * 1000000000) + 100000000
  };

  const submitRes = await fetch(`${BASE}/api/anima/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const submitJson = await submitRes.json();
  if (!submitRes.ok || !submitJson.ok || !submitJson.job?.id) {
    throw new Error(`提交重绘失败: ${JSON.stringify(submitJson)}`);
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
        throw new Error(`重绘失败: ${jobState.error || jobState.status}`);
      }
    }
  }

  const imgRes = await fetch(`${BASE}${jobState.resultUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
}

async function main() {
  console.log(`================================================`);
  console.log(`[Roxy Precision Re-Renderer] 启动洛琪希特征纠偏重绘`);
  console.log(`================================================\n`);

  for (const outfit of OUTFITS) {
    for (const pers of PERSPECTIVES) {
      const targetPath = path.join(OUT_BASE, outfit.id, `${pers.id}.png`);
      console.log(`🎨 正在渲染洛琪希 [${outfit.name}] - [${pers.name}] (锁定正常圆耳/双麻花辫/锁骨痣)...`);
      let done = false;
      for (let i = 1; i <= 3; i++) {
        try {
          await renderImage(outfit, pers, targetPath);
          console.log(`  ✓ 成功落盘: ${targetPath}`);
          done = true;
          break;
        } catch (e) {
          console.warn(`  ⚠️ 第 ${i} 次失败: ${e.message}`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!done) console.error(`  ❌ 失败: [${outfit.name}] [${pers.name}]`);
    }
  }

  console.log(`\n🎉 洛琪希全服装 4 视角参考图纠偏重绘完成！`);
}

main().catch(console.error);
