#!/usr/bin/env node
'use strict';

/**
 * 基于 Anima 专属 LoRA（ayachi_nene_v21_anima / shiki_natsume_v21_anima）
 * 为绫地宁宁与四季夏目重新渲染全部多服装形态（含全裸纯粹形态）的 4 视角电影级资产！
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'http://127.0.0.1:3000';
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');

const HEROINES = [
  {
    id: "nene",
    name: "绫地宁宁",
    loraId: "L_NENE_V21_ANIMA",
    loraStrength: 0.85,
    baseTokens: "ayachi_nene, 1girl, solo, silver_hair, long_hair, low_twintails, purple_eyes, ahoge, pink_ribbon",
    outfits: [
      {
        id: "witch_canonical",
        name: "经典魔女服",
        tokens: "nene_witch_canonical, witch_hat, black_cape, criss-cross_halter, crop_top, strap_between_breasts, pink_bow, black_skirt, asymmetrical_legwear, striped_thighhighs"
      },
      {
        id: "school_uniform",
        name: "学院校服",
        tokens: "school_uniform, blazer, white_shirt, collared_shirt, necktie, pleated_skirt, knee_socks, black_shoes"
      },
      {
        id: "casual_summer",
        name: "日常夏装",
        tokens: "casual, summer_dress, sundress, short_sleeves, bare_legs, flat_shoes"
      },
      {
        id: "nsfw_nude",
        name: "私密全裸 / 纯粹形态",
        isNude: true,
        tokens: "completely_naked, uncensored, full body bare, natural skin, breasts, pink_nipples, navel, bare_shoulders, collarbone, bare_legs, bare_feet"
      }
    ]
  },
  {
    id: "natsume",
    name: "四季夏目",
    loraId: "L_NAT_V21_ANIMA",
    loraStrength: 0.85,
    baseTokens: "shiki_natsume, 1girl, solo, black_hair, long_hair, amber_eyes, mole_under_eye, mole_under_left_eye, hairclip, side_hairclip",
    outfits: [
      {
        id: "cafe_uniform",
        name: "Café Stella 制服",
        tokens: "natsume_cafe_uniform, cafe_uniform, apron, white_shirt, collared_shirt, necktie, brown_skirt, pleated_skirt, black_thighhighs"
      },
      {
        id: "official_qipao",
        name: "官方旗袍 / 绯红旗袍",
        tokens: "natsume_official_qipao, chinese_clothes, china_dress, red_dress, floral_print, side_slit, long_sleeves, black_thighhighs, hair_bun, double_bun, hair_flower, red_flower"
      },
      {
        id: "casual_knit",
        name: "秋冬针织私服",
        tokens: "casual, sweater, knit_sweater, scarf, black_tights, mini_skirt"
      },
      {
        id: "nsfw_nude",
        name: "私密全裸 / 纯粹形态",
        isNude: true,
        tokens: "completely_naked, uncensored, full body bare, natural skin, small_breasts, breasts, pink_nipples, navel, bare_shoulders, collarbone, bare_legs, bare_feet"
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

function buildAnimaPrompt(heroine, outfit, pers) {
  const isNude = outfit.isNude;
  let charTokens = heroine.baseTokens;
  if (isNude) {
    charTokens = charTokens.replace(/\b(witch_hat|cape|dress|uniform|blazer|skirt|shoes|boots|gloves|jacket|coat|hoodie|thighhighs|socks)\b/gi, '');
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
    isNude ? "clothes, clothing, shirt, pants, dress, kimono, robe, towel, underwear, bra, panties, swimsuit, bikini, skirt, socks, footwear, shoes, fabric covering" : "",
    pers.negative
  ].filter(Boolean);

  return {
    prompt: promptParts.join(', '),
    negative: negParts.join(', ')
  };
}

async function renderAnimaLora(heroine, outfit, pers, targetPath) {
  const { prompt, negative } = buildAnimaPrompt(heroine, outfit, pers);
  const payload = {
    modelId: 'anima-aesthetic-v1.1',
    character: heroine.id,
    loraId: heroine.loraId,
    loraStrength: heroine.loraStrength,
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
  const targetOutfit = args.find(a => a.startsWith('--outfit='))?.split('=')[1] || null;

  console.log(`================================================`);
  console.log(`[Anima LoRA Re-Renderer] 启动 Anima + v21 专属 LoRA 高精渲染`);
  console.log(`  Force 覆写: ${force ? '是' : '否 (已存在则跳过)'}`);
  if (targetChar) console.log(`  过滤角色: ${targetChar}`);
  if (targetOutfit) console.log(`  过滤服装: ${targetOutfit}`);
  console.log(`================================================\n`);

  for (const heroine of HEROINES) {
    if (targetChar && heroine.id !== targetChar) continue;
    for (const outfit of heroine.outfits) {
      if (targetOutfit && outfit.id !== targetOutfit) continue;
      for (const pers of PERSPECTIVES) {
        const targetPath = path.join(OUT_BASE, heroine.id, outfit.id, `${pers.id}.png`);
        if (fs.existsSync(targetPath) && !force) {
          console.log(`⏭️ 已存在跳过: [${heroine.name}] - [${outfit.name}] - [${pers.name}]`);
          continue;
        }
        console.log(`🎨 正在用 Anima + [${heroine.loraId}] 渲染 [${heroine.name}] - [${outfit.name}] - [${pers.name}]...`);

        let success = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await renderAnimaLora(heroine, outfit, pers, targetPath);
            console.log(`  ✓ 成功完成并落盘: ${targetPath}`);
            success = true;
            break;
          } catch (err) {
            console.warn(`  ⚠️ 第 ${attempt} 次失败 (${err.message})，重试中...`);
            await new Promise(r => setTimeout(r, 3000));
          }
        }
        if (!success) {
          console.error(`  ❌ 渲染失败: [${heroine.name}] [${outfit.name}] [${pers.name}]`);
        }
      }
    }
  }

  console.log(`\n🎉 [Anima LoRA Re-Renderer] 绫地宁宁 & 四季夏目 全部服装与全裸 4 视角重绘任务完成！`);
}

main().catch(console.error);
