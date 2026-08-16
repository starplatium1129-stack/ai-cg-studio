'use strict';

/**
 * scripts/maintenance/repro-h3-15s.js — 端到端复现：场景出图 → 15s 图生视频
 *
 * 链路（全部走 3123 sidecar API）：
 *   1. 场景蓝图 → Anima 出图（anima-aesthetic-v1.1 无 LoRA）
 *   2. 结果图上传为首帧（POST /api/video/images）
 *   3. 提交 H3 15s 4 步图生视频（POST /api/video/jobs）
 *   4. 轮询至完成，分阶段计时；总预算 480s，超时判定 FAIL
 *
 * 用法：node scripts/maintenance/repro-h3-15s.js [baseUrl] [sceneTitleSubstr]
 */

const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://127.0.0.1:3123';
const SCENE_MATCH = process.argv[3] || '';
const BUDGET_MS = (Number(process.env.BUDGET) || 480) * 1000;
const DURATION = Number(process.env.DURATION) || 15;
const DATA_FILE = 'C:\\Program Files\\AI-CG-Studio\\gateway\\data\\scene-blueprints.json';

const started = Date.now();
function elapsed() {
  return ((Date.now() - started) / 1000).toFixed(1);
}
function log(msg) {
  console.log(`[${elapsed()}s] ${msg}`);
}

// SKIP_DRAW=1：跳过 Anima 出图，用 ComfyUI input 里已有的受控图片直接提交视频
const SKIP_DRAW = process.env.SKIP_DRAW === '1';
const SKIP_IMAGE = process.env.SKIP_IMAGE || '';

async function poll(base, pathname, isDone, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(base + pathname, { cache: 'no-store' });
    const data = await res.json();
    if (isDone(data)) return data;
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error(label + ' 超时');
}

async function main() {
  log(`预算 ${BUDGET_MS / 1000}s，起点 ${BASE}`);
  if (Date.now() + BUDGET_MS - started <= 0) throw new Error('预算已耗尽');

  // 1. 选场景（strip BOM：sidecar 数据文件带 UTF-8 BOM）
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^\uFEFF/, '');
  const blueprints = JSON.parse(raw);
  const list = Array.isArray(blueprints) ? blueprints : (blueprints.blueprints || blueprints.items || []);
  const scene = SCENE_MATCH
    ? list.find(b => String(b.title || '').includes(SCENE_MATCH))
    : list.find(b => b.promptProse && !b.adult);
  if (!scene) throw new Error('未找到可用场景');
  log(`场景：${scene.title}`);

  // 2. Anima 出图（SKIP_DRAW 时跳过）
  let imageName = SKIP_IMAGE;
  if (!SKIP_DRAW) {
    const animaRes = await fetch(BASE + '/api/anima/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: scene.promptProse,
        negative: '',
        modelId: 'anima-aesthetic-v1.1',
        width: 1216,
        height: 832,
        steps: 30,
        cfg: 4.5,
      }),
    });
    const animaBody = await animaRes.json();
    if (animaRes.status !== 202 || !animaBody.job?.id) {
      throw new Error('Anima 提交失败: ' + JSON.stringify(animaBody).slice(0, 300));
    }
    const animaJob = await poll(BASE, '/api/anima/jobs/' + animaBody.job.id,
      d => d.job && d.job.status === 'succeeded', 180_000, 'Anima 出图');
    log(`Anima 出图完成 (${animaJob.job.resultUrl})`);

    // 3. 首帧上传
    const imageRes = await fetch(BASE + animaJob.job.resultUrl, { cache: 'no-store' });
    const blob = await imageRes.arrayBuffer();
    log(`首帧 ${(blob.byteLength / 1024 / 1024).toFixed(2)}MB`);
    const uploadRes = await fetch(BASE + '/api/video/images', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: Buffer.from(blob).toString('base64') }),
    });
    const upload = await uploadRes.json();
    if (uploadRes.status !== 200 || !upload.name) throw new Error('首帧上传失败');
    imageName = upload.name;
    log(`首帧已上传: ${upload.name}`);
  } else {
    log(`跳过出图，使用已有首帧: ${imageName}`);
  }

  // 4. H3 15s 图生视频
  const videoRes = await fetch(BASE + '/api/video/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: scene.promptProse,
      modelId: 'minimax-h3',
      aspectRatio: 'landscape',
      duration: DURATION,
      steps: 4,
      camera: 'still',
      motion: 'subtle',
      quality: 'standard',
      image: imageName,
    }),
  });
  const videoBody = await videoRes.json();
  if (videoRes.status !== 202 || !videoBody.job?.id) {
    throw new Error('视频提交失败: ' + JSON.stringify(videoBody).slice(0, 300));
  }
  log(`H3 15s 任务已提交: ${videoBody.job.id}`);

  const remainMs = BUDGET_MS - (Date.now() - started);
  if (remainMs <= 0) throw new Error('出图阶段已超预算');
  const videoJob = await poll(BASE, '/api/video/jobs/' + videoBody.job.id,
    d => d.job && (d.job.status === 'succeeded' || d.job.status === 'failed'),
    remainMs, 'H3 视频');
  if (videoJob.job.status !== 'succeeded') {
    throw new Error('视频生成失败: ' + (videoJob.job.error || '未知错误'));
  }

  log(`✅ 全链路完成：总耗时 ${elapsed()}s（预算内）`);
  log(`成片: ${BASE}${videoJob.job.resultUrl}`);
}

main().catch(err => {
  console.error(`[${elapsed()}s] ❌ ${err.message}`);
  console.error(`[${elapsed()}s] 总耗时 ${elapsed()}s，预算 480s → 判定：${err.message.includes('超时') ? 'FAIL（超时/卡死）' : 'FAIL'}`);
  process.exitCode = 1;
});
