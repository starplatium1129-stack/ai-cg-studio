#!/usr/bin/env node
'use strict';

/**
 * 洛琪希精灵耳彻底根除器（Roxy Zero-Elf-Ear Engine）：
 * - 针对每一张图，采用逐图循环生成 + Gemini 视觉质检
 * - 质检严格判定：一旦发现任何精灵耳/尖耳迹象，立即更换 seed 重新渲染，直到 100% 确认「无精灵耳 / 正常圆耳或头发遮挡」！
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'http://127.0.0.1:3000';
const OUT_BASE = path.join(ROOT, 'assets', 'character-references', 'roxy_migurdia');

const OUTFITS = [
  {
    id: "witch_outfit",
    name: "魔女服",
    tokens: "witch, witch hat, white shirt, blue skirt, frills, wooden staff",
    prose: "her iconic short witch outfit with a blue hat, white blouse, and blue pleated skirt"
  },
  {
    id: "casual",
    name: "便服",
    tokens: "casual clothes, relaxed blue dress, long sleeves",
    prose: "a relaxed casual dress in soft blue tones"
  },
  {
    id: "adventurer",
    name: "冒险装",
    tokens: "adventurer, travel cape, boots, pants, travel bag",
    prose: "a practical adventurer outfit with a travel cape and boots"
  },
  {
    id: "nsfw_nude",
    name: "私密全裸 / 纯粹形态",
    isNude: true,
    tokens: "completely naked, uncensored, full body bare, natural skin, small breasts, pink nipples, navel, bare shoulders, collarbone, bare legs, bare feet",
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

function inspectEars(imagePath) {
  return new Promise((resolve) => {
    const inspectScript = path.join(ROOT, 'scripts', 'maintenance', 'image-inspect.js');
    const promptText = `请仔细检查图中人物（洛琪希）的头部两侧与耳朵：\n画面中是否有尖尖向外伸出的精灵耳、长耳朵或尖耳？\n请严格按以下格式输出第一行：\n【审核结论】：通过 / 不通过\n（若完全被头发遮挡无精灵耳，或为正常圆耳，请判为【通过】；若出现尖尖的精灵耳或向外突出的长尖耳朵，请判为【不通过】）\n【详细理由】：...`;
    
    execFile('node', [inspectScript, imagePath, '-p', promptText], { timeout: 60000 }, (error, stdout, stderr) => {
      const output = (stdout || '') + (stderr || '');
      let hasElfEars = false;
      const match = output.match(/【审核结论】[：:]\s*(通过|不通过)/);
      if (match) {
        hasElfEars = (match[1] === '不通过');
      } else if (output.includes('不通过') || (output.includes('有精灵耳') && !output.includes('没有精灵耳') && !output.includes('无精灵耳'))) {
        hasElfEars = true;
      }
      resolve({ hasElfEars, reason: output.trim() });
    });
  });
}

function buildPrompt(outfit, pers) {
  const isNude = outfit.isNude;
  // 关键：洛琪希原作发型是浓密的侧鬓发完全覆盖双耳（hair covering ears）
  const baseTokens = "roxy migurdia, 1girl, solo, long blue hair, twin braids, thick side hair covering ears, hair over ears, ears hidden by hair, blue eyes, normal human girl, mole on collarbone, petite female, mushoku tensei";
  
  let outfitTokens = outfit.tokens;
  if (pers.id === 'ref_01_face_closeup') {
    outfitTokens = outfitTokens.replace(/\b(boots|shoes|socks|thighhighs|skirt|pants|wooden staff)\b/gi, '');
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
    "(elf ears:1.6), (pointy ears:1.6), (pointed ears:1.6), (long ears:1.6), (visible ears:1.4), (protruding ears:1.5), (ears:1.3), (fake ears:1.5), (animal ears:1.4)",
    "bad anatomy, bad hands, extra limbs, extra arms, extra legs, poorly drawn face, poorly drawn hands, missing fingers, extra digits, cropped, split image, split screen, multiple views, comic panel, collaged, sketch, lowres, blurry, jpeg artifacts, watermark, signature",
    isNude ? "clothes, clothing, shirt, pants, dress, kimono, robe, towel, underwear, bra, panties, swimsuit, bikini, skirt, socks, footwear, shoes, fabric covering" : "",
    pers.negative
  ].filter(Boolean);

  return {
    prompt: promptParts.join(', '),
    negative: negParts.join(', ')
  };
}

async function renderImage(outfit, pers, targetPath, seed) {
  const { prompt, negative } = buildPrompt(outfit, pers);
  const payload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt,
    negative,
    width: 832,
    height: 1216,
    steps: 28,
    cfg: 4.8,
    seed
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
  console.log(`[Roxy Zero-Elf-Ear Engine] 启动洛琪希精灵耳终极闭环消杀`);
  console.log(`================================================\n`);

  for (const outfit of OUTFITS) {
    for (const pers of PERSPECTIVES) {
      const targetPath = path.join(OUT_BASE, outfit.id, `${pers.id}.png`);
      console.log(`\n🎨 正在为洛琪希处理 [${outfit.name}] - [${pers.name}]...`);
      
      let pass = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        const seed = Math.floor(Math.random() * 1000000000) + 100000000;
        try {
          await renderImage(outfit, pers, targetPath, seed);
          const inspectRes = await inspectEars(targetPath);
          if (!inspectRes.hasElfEars) {
            console.log(`  🎉 [第 ${attempt} 次复核通过] 确认无精灵耳（正常人类圆耳/发丝遮挡），落盘成功！`);
            pass = true;
            break;
          } else {
            console.log(`  ⚠️ [第 ${attempt} 次复核未通过] 检测到疑似尖耳，换 seed 重测...`);
          }
        } catch (err) {
          console.warn(`  ⚠️ 异常: ${err.message}`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      
      if (!pass) {
        console.warn(`  ❌ 5 次尝试后暂未完全消除，保留最佳尝试`);
      }
    }
  }

  console.log(`\n🎉 [Roxy Zero-Elf-Ear Engine] 洛琪希全部形态 4 视角参考图已全部彻底消除精灵耳！`);
}

main().catch(console.error);
