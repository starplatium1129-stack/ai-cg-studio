#!/usr/bin/env node
'use strict';

/**
 * render-inori-kisara-references.js
 *
 * 针对楪祈（Yuzuriha Inori）与木更（Kisara Engage Kiss）进行全形态 4 视角参考图重绘与立绘更新：
 * 1. 楪祈：修正发型（自然披散长发 + 前侧细束小发管，负向杜绝夸张大双马尾）；
 * 2. 木更：修正发色（浅粉色极长发 + 红瞳 + 黑色发带 + 腿部绷带，负向彻底杜绝黑发与杂色）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'http://127.0.0.1:3000';
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const CHAR_DIR = path.join(ROOT, 'assets', 'characters');

const CHARACTERS = [
  {
    id: "yuzuriha_inori",
    name: "楪祈",
    baseTokens: "yuzuriha_inori, 1girl, solo, long_hair, flowing_hair, (gradient_hair:1.2), (pink_hair:1.2), orange_hair, two_side_up, small_twintails, hair_tubes, red_eyes, red_hair_clips, hair_ornament, ahoge, guilty_crown",
    baseNegative: "high_twintails, huge_twintails, thick_pigtails, bulky_twintails, short_hair, bob_cut, black_hair",
    outfits: [
      {
        id: "funeral_parade",
        name: "葬仪社装",
        isDefault: true,
        tokens: "white_shirt, sleeveless, black_shorts, red_ribbon, thighhighs, combat_gear"
      },
      {
        id: "school_uniform",
        name: "校服",
        tokens: "school_uniform, white_shirt, blue_skirt, ribbon, white_socks"
      },
      {
        id: "red_dress",
        name: "红裙 / 歌姬金鱼装",
        tokens: "red_dress, sleeveless_dress, flowing_fabric, layered_skirt, gold_accents"
      },
      {
        id: "nsfw_nude",
        name: "私密全裸 / 纯粹形态",
        isNude: true,
        tokens: "completely_naked, uncensored, full body bare, natural skin, delicate small breasts, pink_nipples, navel, bare_shoulders, collarbone, bare_legs, bare_feet"
      }
    ]
  },
  {
    id: "kisara_engage_kiss",
    name: "木更",
    baseTokens: "kisara_(engage_kiss), 1girl, solo, (pastel_pink_hair:1.35), (very_long_pink_hair:1.3), pink_hair, very_long_hair, crimson_eyes, red_eyes, ahoge, (black_ribbon:1.1), hair_ribbon, (bandage_on_thigh:1.2), thigh_bandage, engage_kiss",
    baseNegative: "black_hair, dark_hair, brown_hair, blue_hair, purple_hair, blonde_hair, green_hair, dark_skin, camera, holding_camera",
    outfits: [
      {
        id: "school_uniform",
        name: "校服",
        isDefault: true,
        tokens: "school_uniform, sailor_collar, red_bow, grey_jacket, puffy_sleeves, white_pleated_skirt, black_kneehighs, bandage_on_leg"
      },
      {
        id: "demon_dress",
        name: "恶魔装",
        tokens: "black_dress, sleeveless_dress, side_slit, black_thighhighs, gloves, red_bow"
      },
      {
        id: "casual",
        name: "便服",
        tokens: "casual_clothes, stylish_jacket, inner_shirt, shorts, bare_legs"
      },
      {
        id: "nsfw_nude",
        name: "私密全裸 / 纯粹形态",
        isNude: true,
        tokens: "completely_naked, uncensored, full body bare, natural skin, small_breasts, pink_nipples, navel, slender_waist, bare_shoulders, collarbone, bare_legs, bare_feet"
      }
    ]
  }
];

const PERSPECTIVES = [
  {
    id: "ref_01_face_closeup",
    name: "面部特写",
    suffix: "eye-level straight-on portrait, close-up face shot, head and shoulders portrait, 85mm f/1.4 lens, shallow depth of field, looking straight at viewer, calm expressive anime eyes, detailed skin and hair texture, cinematic soft portrait studio lighting",
    negative: "bird's eye view, extreme high angle, top-down view, foreshortening, full body, lower body, legs, feet, shoes, wide shot, distant shot, out of frame"
  },
  {
    id: "ref_02_half_medium",
    name: "3/4半身定妆",
    suffix: "medium shot, waist up, cowboy shot, 3/4 view angle, hands visible resting naturally near waist, detailed outfit layers, fabric folds, cinematic studio lighting",
    negative: "full body, legs, feet, shoes, boots, extreme closeup, face only, cropped shoulders"
  },
  {
    id: "ref_03_full_dynamic",
    name: "正面全身立姿",
    suffix: "full body standing, entire figure visible from head to toe, front view, facing camera, looking at viewer, complete head, entire legs, full feet and shoes completely on the ground without cropping, clean studio floor shadow, balanced standing posture",
    negative: "back view, from behind, rear view, cropped head, cropped feet, cut off feet, out of frame, bad proportions"
  },
  {
    id: "ref_04_back_rear",
    name: "45°侧后背影",
    suffix: "45 degree angle from behind, looking back over shoulder toward camera, back view focus, back of hair, hair flow, rear outfit details, cinematic rim lighting, dramatic backlight, edge glow",
    negative: "front view, facing camera, frontal face, front of chest"
  }
];

function buildPrompt(charConfig, outfit, pers) {
  const isNude = outfit.isNude;
  let charTokens = charConfig.baseTokens;
  if (isNude) {
    charTokens = charTokens.replace(/\b(jacket|dress|uniform|blazer|skirt|shorts|shoes|boots|gloves|coat|hoodie|thighhighs|socks|kneehighs)\b/gi, '');
  }

  const promptParts = [
    isNude ? "nude, completely naked, uncensored, full body bare, natural skin" : "",
    charTokens,
    outfit.tokens,
    pers.suffix,
    "@rella, masterpiece, best quality, pristine anime aesthetic, clean cinematic lighting"
  ].filter(Boolean);

  const negParts = [
    "bad anatomy, bad hands, extra limbs, extra arms, extra legs, poorly drawn face, poorly drawn hands, missing fingers, extra digits, cropped, split image, split screen, multiple views, comic panel, collaged, sketch, lowres, blurry, jpeg artifacts, watermark, signature",
    charConfig.baseNegative,
    isNude ? "clothes, clothing, shirt, pants, dress, kimono, robe, towel, underwear, bra, panties, swimsuit, bikini, skirt, socks, footwear, shoes, fabric covering" : "",
    pers.negative
  ].filter(Boolean);

  return {
    prompt: promptParts.join(', '),
    negative: negParts.join(', ')
  };
}

async function renderJob(charConfig, outfit, pers, targetPath) {
  const { prompt, negative } = buildPrompt(charConfig, outfit, pers);
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
    if (submitJson.error?.includes('ANIMA_QUEUE_FULL') || submitRes.status === 429) {
      throw new Error('ANIMA_QUEUE_FULL');
    }
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
        throw new Error(`生成失败: ${jobState.error || jobState.status}`);
      }
    }
  }

  const imgRes = await fetch(`${BASE}${jobState.resultUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const targetChar = args.find(a => a.startsWith('--char='))?.split('=')[1] || null;

  console.log(`================================================`);
  console.log(`[Inori & Kisara Reference Re-Renderer] 启动 Anima 高精修复渲染`);
  console.log(`  Force: ${force ? '是' : '否'}`);
  if (targetChar) console.log(`  过滤角色: ${targetChar}`);
  console.log(`================================================\n`);

  for (const charConfig of CHARACTERS) {
    if (targetChar && charConfig.id !== targetChar) continue;
    for (const outfit of charConfig.outfits) {
      for (const pers of PERSPECTIVES) {
        const targetPath = path.join(OUT_BASE, charConfig.id, outfit.id, `${pers.id}.png`);
        if (fs.existsSync(targetPath) && !force) {
          console.log(`⏭️ 已存在跳过: [${charConfig.name}] - [${outfit.name}] - [${pers.name}]`);
          continue;
        }

        console.log(`🎨 正在渲染 [${charConfig.name}] - [${outfit.name}] - [${pers.name}]...`);
        let success = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            await renderJob(charConfig, outfit, pers, targetPath);
            console.log(`  ✓ 成功落盘: ${targetPath}`);
            success = true;
            break;
          } catch (err) {
            const waitMs = err.message === 'ANIMA_QUEUE_FULL' ? 5000 : 3000;
            console.warn(`  ⚠️ 第 ${attempt} 次失败 (${err.message})，等待 ${waitMs}ms 后重试...`);
            await new Promise(r => setTimeout(r, waitMs));
          }
        }
        if (!success) {
          console.error(`  ❌ 最终渲染失败: [${charConfig.name}] [${outfit.name}] [${pers.name}]`);
        }
      }
    }

    // 更新角色默认 4 视角根目录参考图（取 default outfit）
    const defaultOutfit = charConfig.outfits.find(o => o.isDefault) || charConfig.outfits[0];
    for (const pers of PERSPECTIVES) {
      const src = path.join(OUT_BASE, charConfig.id, defaultOutfit.id, `${pers.id}.png`);
      const dest = path.join(OUT_BASE, charConfig.id, `${pers.id}.png`);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }

    // 更新角色立绘头像 assets/characters/popular-<id>.png（使用默认服装的 3/4 半身或特写）
    const avatarSrc = path.join(OUT_BASE, charConfig.id, defaultOutfit.id, 'ref_02_half_medium.png');
    const avatarDest = path.join(CHAR_DIR, `popular-${charConfig.id}.png`);
    if (fs.existsSync(avatarSrc)) {
      fs.copyFileSync(avatarSrc, avatarDest);
      console.log(`🌟 已更新角色立绘/头像: ${avatarDest}`);
    }
  }

  console.log(`\n🎉 [Inori & Kisara Reference Re-Renderer] 楪祈与木更全部形态与立绘更新完成！`);
}

main().catch(console.error);
