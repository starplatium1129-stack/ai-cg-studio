#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'http://127.0.0.1:3000';
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');

const JOBS = [
  // Nene (绫地宁宁)
  {
    character: 'nene',
    id: 'ref_01_face_closeup',
    name: '面部与微表情特写',
    loraId: 'L_NENE_V21_ANIMA',
    loraStrength: 0.85,
    seed: 2026081701,
    prompt: "ayachi_nene, 1girl, solo, silver_hair, long_hair, low_twintails, purple_eyes, ahoge, pink_ribbon, nene_witch_canonical, witch_hat, black_cape, extreme close-up portrait, head and shoulders, 85mm lens, looking slightly off-camera with a gentle subtle smile, diffused soft studio lighting, subtle rim light on hair, catchlight in eyes, clean studio background, sharp facial focus, @rella",
    negative: "bad anatomy, bad hands, deformed, blurry, lowres, split image, split panel, multiple frames, comic strip, extra person, duplicate subject, extreme expression, wide shot"
  },
  {
    character: 'nene',
    id: 'ref_02_half_medium',
    name: '3/4侧身半身定妆',
    loraId: 'L_NENE_V21_ANIMA',
    loraStrength: 0.85,
    seed: 2026081702,
    prompt: "ayachi_nene, 1girl, solo, silver_hair, long_hair, low_twintails, purple_eyes, ahoge, pink_ribbon, nene_witch_canonical, witch_hat, black_cape, criss-cross_halter, crop_top, pink_bow, black_skirt, medium shot, upper body, 3/4 view angle, hands visible resting naturally, cinematic soft studio lighting, accurate fabric textures, clean minimalistic background, @rella",
    negative: "bad anatomy, bad hands, extra limbs, cropped shoulders, blurry, lowres, split image, split panel, comic strip, multiple people, extra person"
  },
  {
    character: 'nene',
    id: 'ref_03_full_dynamic',
    name: '全身立姿动态',
    loraId: 'L_NENE_V21_ANIMA',
    loraStrength: 0.85,
    seed: 2026081703,
    prompt: "ayachi_nene, 1girl, solo, silver_hair, long_hair, low_twintails, purple_eyes, ahoge, pink_ribbon, nene_witch_canonical, witch_hat, black_cape, criss-cross_halter, crop_top, pink_bow, black_skirt, asymmetrical_legwear, striped_thighhighs, single_thighhigh, full body shot, standing head to toe, wide 50mm, subtle dynamic stance with weight on one leg, complete footwear visible, neutral studio cyclorama, @rella",
    negative: "bad anatomy, cropped feet, shoes cut off, bad hands, sitting, ground clutter, blurry, lowres, split image, split panel, multiple people"
  },
  {
    character: 'nene',
    id: 'ref_04_back_rear',
    name: '45°侧后背影',
    loraId: 'L_NENE_V21_ANIMA',
    loraStrength: 0.85,
    seed: 2026081704,
    prompt: "ayachi_nene, 1girl, solo, silver_hair, long_hair, low_twintails, ahoge, pink_ribbon, nene_witch_canonical, black_cape, black_skirt, rear 3/4 back view, from behind, character looking slightly over shoulder towards side, showing low twintails and back outfit design, soft backlighting, cinematic edge light, clean studio background, @rella",
    negative: "facing camera directly, frontal view, bad anatomy, deformed, blurry, lowres, split image, split panel, multiple people, extra arms"
  },

  // Natsume (四季夏目)
  {
    character: 'natsume',
    id: 'ref_01_face_closeup',
    name: '面部与微表情特写',
    loraId: 'L_NAT_V21_ANIMA',
    loraStrength: 0.85,
    seed: 2026081711,
    prompt: "shiki_natsume, 1girl, solo, very_long_black_hair, golden_yellow_eyes, mole_under_eye, two_red_hairclips, natsume_cafe_uniform, white_shirt, collared_shirt, necktie, extreme close-up portrait, head and shoulders, 85mm lens, looking slightly off-camera with a calm reserved gaze, diffused soft studio lighting, subtle rim light on hair, catchlight in eyes, clean studio background, @rella",
    negative: "bad anatomy, bad hands, deformed, blurry, lowres, split image, split panel, multiple frames, comic strip, extra person, duplicate subject, extreme expression"
  },
  {
    character: 'natsume',
    id: 'ref_02_half_medium',
    name: '3/4侧身半身定妆',
    loraId: 'L_NAT_V21_ANIMA',
    loraStrength: 0.85,
    seed: 2026081712,
    prompt: "shiki_natsume, 1girl, solo, very_long_black_hair, golden_yellow_eyes, mole_under_eye, two_red_hairclips, natsume_cafe_uniform, white_shirt, collared_shirt, necktie, apron, brown_skirt, medium shot, upper body, 3/4 view angle, natural posture, hands visible near waist, cinematic soft studio lighting, clean background, @rella",
    negative: "bad anatomy, bad hands, extra limbs, cropped shoulders, blurry, lowres, split image, split panel, multiple people"
  },
  {
    character: 'natsume',
    id: 'ref_03_full_dynamic',
    name: '全身立姿动态',
    loraId: 'L_NAT_V21_ANIMA',
    loraStrength: 0.85,
    seed: 2026081713,
    prompt: "shiki_natsume, 1girl, solo, very_long_black_hair, golden_yellow_eyes, mole_under_eye, two_red_hairclips, natsume_cafe_uniform, white_shirt, collared_shirt, necktie, apron, brown_skirt, black_thighhighs, full body shot, standing head to toe, wide 50mm, subtle relaxed stance, complete footwear visible, neutral studio cyclorama, @rella",
    negative: "bad anatomy, cropped feet, shoes cut off, sitting, blurry, lowres, split image, split panel, multiple people"
  },
  {
    character: 'natsume',
    id: 'ref_04_back_rear',
    name: '45°侧后背影',
    loraId: 'L_NAT_V21_ANIMA',
    loraStrength: 0.85,
    seed: 2026081714,
    prompt: "shiki_natsume, 1girl, solo, very_long_black_hair, two_red_hairclips, natsume_cafe_uniform, white_shirt, apron, brown_skirt, rear 3/4 back view, from behind, character looking slightly over shoulder towards side, showing straight black hair structure and back of cafe apron, soft backlighting, clean studio background, @rella",
    negative: "facing camera directly, frontal view, bad anatomy, deformed, blurry, lowres, split image, split panel, multiple people, extra arms"
  }
];

async function generateJob(jobConfig) {
  console.log(`\n================================================================`);
  console.log(`[生成开始] ${jobConfig.character} -> ${jobConfig.name} (${jobConfig.id})`);
  console.log(`  Seed: ${jobConfig.seed}`);
  console.log(`  Prompt: ${jobConfig.prompt.substring(0, 100)}...`);

  const payload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt: jobConfig.prompt,
    negative: jobConfig.negative,
    width: 832,
    height: 1216,
    steps: 30,
    cfg: 4.5,
    seed: jobConfig.seed,
    loraId: jobConfig.loraId,
    loraStrength: jobConfig.loraStrength,
    character: jobConfig.character
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
  console.log(`  任务已提交, JobId: ${jobId}, 等待渲染完成...`);

  const deadline = Date.now() + 10 * 60 * 1000;
  let jobState = null;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const queryRes = await fetch(`${BASE}/api/anima/jobs/${encodeURIComponent(jobId)}`);
    const queryJson = await queryRes.json();
    if (queryRes.ok && queryJson.ok && queryJson.job) {
      jobState = queryJson.job;
      if (jobState.status === 'succeeded' && jobState.resultUrl) {
        break;
      }
      if (jobState.status === 'failed' || jobState.status === 'cancelled') {
        throw new Error(`任务失败: ${jobState.error || jobState.status}`);
      }
    }
  }

  if (!jobState || jobState.status !== 'succeeded' || !jobState.resultUrl) {
    throw new Error(`渲染超时`);
  }

  console.log(`  渲染成功！拉取图像: ${jobState.resultUrl}`);
  const imgRes = await fetch(`${BASE}${jobState.resultUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const targetDir = path.join(OUT_BASE, jobConfig.character);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetFile = path.join(targetDir, `${jobConfig.id}.png`);
  fs.writeFileSync(targetFile, buffer);
  console.log(`  [已保存] ${targetFile} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  console.log(`[CharRef Generator] 开始基于 Anima Aesthetic v1.1 + v21 LoRA 渲染全部基准参考图...`);
  for (const job of JOBS) {
    try {
      await generateJob(job);
    } catch (err) {
      console.error(`  [失败] ${job.id}:`, err.message);
    }
  }
  console.log(`\n[CharRef Generator] 全部任务处理完成！`);
}

main().catch(console.error);
