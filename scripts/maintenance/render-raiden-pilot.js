#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'http://127.0.0.1:3000';
const OUT_BASE = path.join(ROOT, 'assets', 'character-references', 'raiden_shogun');

const JOBS = [
  {
    id: 'ref_01_face_closeup',
    name: '面部与微表情特写',
    seed: 2026081721,
    prompt: "raiden_shogun, raiden_ei, 1girl, solo, long_purple_hair, single_braid, glowing_purple_eyes, mole_under_right_eye, golden_hairpin, hair_flower, tassel, genshin_impact, extreme close-up portrait, head and shoulders, 85mm lens, looking slightly off-camera with a serene regal gaze, diffused soft studio lighting, subtle rim light on hair, catchlight in eyes, neutral clean solid background, sharp facial focus, @rella",
    negative: "bad anatomy, bad hands, deformed, blurry, lowres, split image, split panel, multiple frames, comic strip, extra person, duplicate subject, extreme expression, wide shot"
  },
  {
    id: 'ref_02_half_medium',
    name: '3/4侧身半身定妆',
    seed: 2026081722,
    prompt: "raiden_shogun, raiden_ei, 1girl, solo, long_purple_hair, single_braid, glowing_purple_eyes, mole_under_right_eye, golden_hairpin, japanese_clothes, kimono, purple_clothes, gold_trim, pauldron, black_fingerless_gloves, obi, sash, bare_shoulders, genshin_impact, medium shot, upper body, 3/4 view angle, hands visible resting naturally near waist, cinematic soft studio lighting, accurate fabric textures and seams, clean minimalistic studio background, @rella",
    negative: "bad anatomy, bad hands, extra limbs, cropped shoulders, blurry, lowres, split image, split panel, comic strip, multiple people, extra person"
  },
  {
    id: 'ref_03_full_dynamic',
    name: '全身立姿动态',
    seed: 2026081723,
    prompt: "raiden_shogun, raiden_ei, 1girl, solo, long_purple_hair, single_braid, glowing_purple_eyes, golden_hairpin, japanese_clothes, kimono, purple_clothes, gold_trim, pauldron, black_fingerless_gloves, obi, sash, black_thighhighs, genshin_impact, full body shot, standing from head to toe, wide 50mm framing, subtle dynamic stance with weight on one leg, complete footwear visible, neutral seamless studio cyclorama, floor reflection, @rella",
    negative: "bad anatomy, cropped feet, high-heels cut off, sitting, lying down, ground clutter, multiple people, split image, split panel"
  },
  {
    id: 'ref_04_back_rear',
    name: '45°侧后背影',
    seed: 2026081724,
    prompt: "raiden_shogun, raiden_ei, 1girl, solo, long_purple_hair, single_braid, golden_hairpin, japanese_clothes, kimono, purple_clothes, obi, sash, genshin_impact, rear 3/4 back view, character looking slightly over shoulder towards the side, showing long purple braid structure from behind and back of kimono obi, soft backlighting, detailed hair structure, clean neutral background, cinematic edge light, @rella",
    negative: "facing camera directly, frontal view, bad anatomy, deformed, blurry, lowres, split image, split panel, multiple people, extra arms"
  }
];

async function generateJob(jobConfig) {
  console.log(`\n================================================================`);
  console.log(`[生成开始] raiden_shogun -> ${jobConfig.name} (${jobConfig.id})`);
  console.log(`  Seed: ${jobConfig.seed}`);

  const payload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt: jobConfig.prompt,
    negative: jobConfig.negative,
    width: 832,
    height: 1216,
    steps: 30,
    cfg: 4.5,
    seed: jobConfig.seed
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
  console.log(`  任务已提交, JobId: ${jobId}, 等待 GPU 渲染...`);

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

  fs.mkdirSync(OUT_BASE, { recursive: true });
  const targetFile = path.join(OUT_BASE, `${jobConfig.id}.png`);
  fs.writeFileSync(targetFile, buffer);
  console.log(`  [已保存] ${targetFile} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  console.log(`[Raiden Pilot] 开始为「雷电将军」渲染 4 视角基准参考图...`);
  for (const job of JOBS) {
    await generateJob(job);
  }
  console.log(`\n[Raiden Pilot] 雷电将军 4 视角参考图全部渲染完成！`);
}

main().catch(console.error);
