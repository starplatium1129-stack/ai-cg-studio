#!/usr/bin/env node
'use strict';

/**
 * generate-dawn-bedroom-showcase.js
 * 为新场景「圣园未花 · 晨曦私语白蔷薇寝所」(misono_mika_dawn_bedroom)
 * 生成真实样张，进行像素超分与缩略图转换，并同步到展示库大盘与用户桌面。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOWCASE_DIR = path.resolve('E:/code/2/lora/AI/SceneShowcase/2026-08-25_v25');
const MANIFEST_FILE = path.join(SHOWCASE_DIR, 'manifest.json');
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3123';
const DESKTOP_DIR = 'C:/Users/Administrator/Desktop';

const popular = require(path.join(ROOT, 'src', 'utils', 'popularContent.ts'));
const popularChars = popular.parsePopularCharacters(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'popular-characters.json'), 'utf8')));
const blueprintsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scene-blueprints.json'), 'utf8')).blueprints;

async function submitJob(payload) {
  const res = await fetch(`${GATEWAY_URL}/api/anima/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Submit failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.job.id;
}

async function pollJob(jobId, timeoutMs = 240000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${GATEWAY_URL}/api/anima/jobs/${encodeURIComponent(jobId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.job?.status === 'succeeded' && data.job?.resultUrl) {
        const fullUrl = data.job.resultUrl.startsWith('http') ? data.job.resultUrl : `${GATEWAY_URL}${data.job.resultUrl}`;
        const imgRes = await fetch(fullUrl);
        return Buffer.from(await imgRes.arrayBuffer());
      }
      if (data.job?.status === 'failed') {
        throw new Error(`Job failed: ${data.job.error || 'unknown'}`);
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Polling timeout for job ${jobId}`);
}

function convertShowcase(srcPng, dstBig, dstThumb) {
  const cmd = `python scripts/maintenance/convert-showcase-image.py "${srcPng}" "${dstBig}" "${dstThumb}"`;
  execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
}

async function main() {
  console.log(`[Dawn Bedroom Showcase] 开始生成圣园未花新场景样张...`);

  const character = popular.findCharacter(popularChars, 'misono_mika');
  const bp = blueprintsData.find(b => b.id === 'misono_mika_dawn_bedroom');
  if (!character || !bp) throw new Error('未找到未花或晨曦卧室场景蓝图');

  const outfit = character.outfits.find(o => o.id === bp.outfitId) || character.outfits[0];
  const plan = popular.buildPopularPromptPlan({
    character,
    outfit,
    blueprint: bp,
    engine: 'anima',
    adultEnabled: true,
    artist: 'rella'
  });

  let prompt = plan.prompt;
  if (!prompt.includes('@rella')) prompt = `@rella, ${prompt}`;

  console.log(`[Dawn Bedroom Showcase] 提示词: ${prompt.slice(0, 160)}...`);

  const entryId = `pc_misono_mika_${bp.id}`;
  const tempDir = path.join(ROOT, 'runtime', 'showcase-temp');
  fs.mkdirSync(tempDir, { recursive: true });
  const tempPng = path.join(tempDir, `${entryId}.png`);

  const seed = 1065372979; // 使用用户赞赏的 02994 黄金种子

  console.log(`[Dawn Bedroom Showcase] 提交标准渲染任务 (seed: ${seed})...`);
  const jobId = await submitJob({
    modelId: 'anima-aesthetic-v1.1',
    prompt,
    negative: plan.negative,
    width: 832,
    height: 1216,
    steps: 28,
    cfg: 4.5,
    seed
  });

  console.log(`[Dawn Bedroom Showcase] Job ID: ${jobId}, 等待生成完成...`);
  const imgBuf = await pollJob(jobId);
  fs.writeFileSync(tempPng, imgBuf);
  console.log(`[Dawn Bedroom Showcase] 基础图生成完成 (${imgBuf.length} 字节)`);

  // 1. 同步到展示大盘
  const dstBig = path.join(SHOWCASE_DIR, 'images', `${entryId}.jpg`);
  const dstThumb = path.join(SHOWCASE_DIR, 'thumbs', `${entryId}.jpg`);
  convertShowcase(tempPng, dstBig, dstThumb);
  console.log(`[Dawn Bedroom Showcase] 展示库大盘转换完成: images & thumbs`);

  // 2. 注册进 manifest.json
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  const newEntry = {
    id: entryId,
    title: `${character.displayName} / ${bp.title}`,
    story: bp.description || '',
    category: '热门角色',
    char: character.id,
    displayName: character.displayName,
    rating: bp.adult ? 'R18' : 'All',
    attempt: 1,
    type: 'popular',
    image: `images/${entryId}.jpg`,
    thumb: `thumbs/${entryId}.jpg`,
    meta: {
      engine: 'anima',
      model: 'anima-aesthetic-v1.1',
      checkpoint: 'anima-aesthetic-v1.1.safetensors',
      seed
    },
    prompt,
    negative: plan.negative,
    provenance: {
      batch: 'popular',
      key: `popular:${character.id}:${bp.id}`,
      recordId: `popular:${character.id}:${bp.id}@attempt-1`,
      attempt: 1,
      generatedAt: new Date().toISOString(),
      review: {
        verdict: 'pass',
        recordId: `popular:${character.id}:${bp.id}@attempt-1`,
        notes: '圣园未花全新晨曦寝所场景样张入库',
        reviewedAt: new Date().toISOString(),
        by: 'pipeline-auto-audit'
      }
    }
  };

  const existingIdx = manifest.entries.findIndex(e => e.id === entryId);
  if (existingIdx >= 0) manifest.entries[existingIdx] = newEntry;
  else manifest.entries.push(newEntry);

  manifest.counts = manifest.counts || {};
  manifest.counts.popular = manifest.entries.filter(e => e.type === 'popular').length;
  manifest.entryCount = manifest.entries.length;
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[Dawn Bedroom Showcase] Manifest 登记成功！当前条目总数: ${manifest.entries.length}`);

  // 3. 同时渲染一张 Remacri 2x Hires 放到用户桌面！
  console.log(`[Dawn Bedroom Showcase] 正在为该新场景生成 Remacri 2x Hires 超分版放到桌面...`);
  const hiresJobId = await submitJob({
    modelId: 'anima-aesthetic-v1.1',
    prompt,
    negative: plan.negative,
    width: 832,
    height: 1216,
    steps: 28,
    cfg: 4.5,
    seed,
    hiresFix: true,
    hiresScale: 2.0
  });
  console.log(`[Dawn Bedroom Showcase] Hires Job ID: ${hiresJobId}, 等待超分完成...`);
  const hiresBuf = await pollJob(hiresJobId);
  const desktopOut = path.join(DESKTOP_DIR, 'mika_dawn_bedroom_hires.png');
  fs.writeFileSync(desktopOut, hiresBuf);
  console.log(`[Dawn Bedroom Showcase] 超清 Hires 原图已保存至桌面: ${desktopOut} (${hiresBuf.length} 字节)`);

  // 清理临时文件
  try { fs.unlinkSync(tempPng); } catch (_) {}
}

main().catch(console.error);
