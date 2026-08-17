#!/usr/bin/env node
'use strict';

/**
 * 批量渲染全量热门角色的 4 视角标准参考资产库
 *
 * 采用 Anima Aesthetic v1.1 底模，严格执行摄影学 4 视角约束：
 *   - ref_01_face_closeup: 85mm 浅景深正脸特写
 *   - ref_02_half_medium: 3/4 侧身半身定妆
 *   - ref_03_full_dynamic: 正面完整全身立姿（强正面与完整脚底约束）
 *   - ref_04_back_rear: 45° 侧后背影与回眸
 *
 * 支持：断点续跑、进度落盘、错误重试、跳过已就绪角色。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const POPULAR_FILE = path.join(ROOT, 'data', 'popular-characters.json');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const MANIFEST_FILE = path.join(OUT_BASE, 'generation-progress.json');
const BASE = 'http://127.0.0.1:3000';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

// 4 视角标准模板
const PERSPECTIVE_CONFIGS = [
  {
    id: 'ref_01_face_closeup',
    name: '面部与微表情特写',
    buildPrompt: (identity, outfit) => `${identity}, extreme close-up portrait, head and shoulders, 85mm lens, looking slightly off-camera with a nuanced focused gaze, diffused soft studio lighting, subtle rim light on hair, catchlight in eyes, neutral clean solid background, sharp facial focus, @rella`,
    negative: 'bad anatomy, bad hands, deformed, blurry, lowres, split image, split panel, multiple frames, comic strip, extra person, duplicate subject, extreme expression, wide shot'
  },
  {
    id: 'ref_02_half_medium',
    name: '3/4侧身半身定妆',
    buildPrompt: (identity, outfit) => `${identity}, ${outfit}, medium shot, upper body, 3/4 view angle, hands visible resting naturally near waist, cinematic soft studio lighting, accurate fabric textures and seams, clean minimalistic studio background, @rella`,
    negative: 'bad anatomy, bad hands, extra limbs, cropped shoulders, blurry, lowres, split image, split panel, comic strip, multiple people, extra person'
  },
  {
    id: 'ref_03_full_dynamic',
    name: '正面全身立姿',
    buildPrompt: (identity, outfit) => `${identity}, ${outfit}, front view, facing camera, looking at viewer, full body shot, standing from head to toe, wide 50mm framing, subtle dynamic elegant stance with weight on one leg, complete footwear visible, neutral seamless studio cyclorama, floor reflection, @rella`,
    negative: 'back view, from behind, rear view, bad anatomy, cropped feet, high-heels cut off, sitting, lying down, ground clutter, multiple people, split image, split panel'
  },
  {
    id: 'ref_04_back_rear',
    name: '45°侧后背影',
    buildPrompt: (identity, outfit) => `${identity}, ${outfit}, rear 3/4 back view, from behind, character looking slightly over shoulder towards the side, showing hair structure from behind and back of outfit, soft backlighting, detailed hair structure, clean neutral background, cinematic edge light, @rella`,
    negative: 'facing camera directly, frontal view, bad anatomy, deformed, blurry, lowres, split image, split panel, multiple people, extra arms'
  }
];

function buildIdentityTokens(character) {
  const tokens = character.identityTokens || [];
  return tokens.join(', ');
}

function buildOutfitTokens(character) {
  const outfit = (character.outfits || []).find(o => o.default) || character.outfits?.[0];
  return (outfit?.tokens || []).join(', ');
}

async function renderJob(job) {
  const payload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt: job.prompt,
    negative: job.negative,
    width: 832,
    height: 1216,
    steps: 30,
    cfg: 4.5,
    seed: job.seed
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
    await new Promise(r => setTimeout(r, 2500));
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

  const imgRes = await fetch(`${BASE}${jobState.resultUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  fs.mkdirSync(path.dirname(job.targetFile), { recursive: true });
  fs.writeFileSync(job.targetFile, buffer);
  return { jobId, size: buffer.length };
}

async function main() {
  console.log(`[Batch Reference Renderer] 启动全量热门角色参考资产渲染管线...`);

  // 已就绪的角色（宁宁、夏目、雷电将军已完成）
  const completedCharacters = new Set(['nene', 'natsume', 'raiden_shogun']);

  let progress = { completed: {}, failed: {} };
  if (fs.existsSync(MANIFEST_FILE)) {
    try { progress = readJson(MANIFEST_FILE); } catch (e) {}
  }

  const popular = readJson(POPULAR_FILE);
  const targetCharacters = popular.characters.filter(c => !completedCharacters.has(c.id));

  console.log(`[Batch Reference Renderer] 待渲染角色: ${targetCharacters.length} 位 (共 ${targetCharacters.length * 4} 张基准图)`);

  let totalTasks = 0;
  let finishedTasks = 0;

  for (const char of targetCharacters) {
    const charDir = path.join(OUT_BASE, char.id);
    const identity = buildIdentityTokens(char);
    const outfit = buildOutfitTokens(char);

    console.log(`\n================================================================`);
    console.log(`>>> 处理角色 [${char.displayName}] (${char.id}) - ${char.franchise}`);

    for (let i = 0; i < PERSPECTIVE_CONFIGS.length; i++) {
      const p = PERSPECTIVE_CONFIGS[i];
      const targetFile = path.join(charDir, `${p.id}.png`);
      const taskKey = `${char.id}:${p.id}`;

      if (progress.completed[taskKey] && fs.existsSync(targetFile)) {
        console.log(`  [已完成·跳过] ${p.name} (${p.id})`);
        continue;
      }

      totalTasks++;
      const seed = 2026081700 + (char.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 10) + i;
      const prompt = p.buildPrompt(identity, outfit);

      const job = {
        characterId: char.id,
        perspectiveId: p.id,
        name: p.name,
        targetFile,
        seed,
        prompt,
        negative: p.negative
      };

      console.log(`  正在渲染: ${p.name} (Seed: ${seed})...`);

      try {
        const res = await renderJob(job);
        progress.completed[taskKey] = {
          time: new Date().toISOString(),
          jobId: res.jobId,
          size: res.size
        };
        delete progress.failed[taskKey];
        writeJson(MANIFEST_FILE, progress);
        finishedTasks++;
        console.log(`  ✓ 渲染成功 [${(res.size / 1024).toFixed(1)} KB]`);
      } catch (err) {
        console.error(`  ✗ 渲染失败 [${p.id}]:`, err.message);
        progress.failed[taskKey] = {
          time: new Date().toISOString(),
          error: err.message
        };
        writeJson(MANIFEST_FILE, progress);
      }
    }
  }

  console.log(`\n================================================================`);
  console.log(`[Batch Reference Renderer] 全部任务处理完毕！成功完成: ${finishedTasks}/${totalTasks}`);
}

main().catch(err => {
  console.error('[Batch Reference Renderer] 致命错误:', err);
  process.exit(1);
});
