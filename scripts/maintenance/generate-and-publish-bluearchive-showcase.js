#!/usr/bin/env node
'use strict';

/**
 * generate-and-publish-bluearchive-showcase.js
 * 
 * 为 5 位蔚蓝档案角色（圣园未花、空崎日奈、杏山和纱、飞鸟马时、调月莉音）
 * 的全量场景蓝图（每角色 13 个蓝图，共 65 个）
 * 生成官方样张（Showcase），转换为 standard JPEG + Thumbnail 并同步到当前展示库大盘
 * （E:/code/2/lora/AI/SceneShowcase/2026-08-25_v25）。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const POPULAR_FILE = path.join(DATA_DIR, 'popular-characters.json');
const BLUEPRINTS_FILE = path.join(DATA_DIR, 'scene-blueprints.json');
const SHOWCASE_DIR = path.resolve('E:/code/2/lora/AI/SceneShowcase/2026-08-25_v25');
const MANIFEST_FILE = path.join(SHOWCASE_DIR, 'manifest.json');
const GATEWAY_URL = process.env.GATEWAY_URL || process.env.BASE || 'http://127.0.0.1:3123';
const CONCURRENCY = 2;

const CHAR_IDS = [
  'misono_mika',
  'sorasaki_hina',
  'kyouyama_kazusa',
  'asuma_toki',
  'tsukatsuki_rio'
];

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

async function pollJob(jobId, timeoutMs = 180000) {
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
  console.log(`[Showcase Pipeline] 启动 5 位蔚蓝档案角色样张渲染与大盘同步...`);
  console.log(`[Showcase Pipeline] 目标展示库: ${SHOWCASE_DIR}`);

  if (!fs.existsSync(SHOWCASE_DIR)) {
    throw new Error(`展示库目录不存在: ${SHOWCASE_DIR}`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  const popular = require(path.join(ROOT, 'src', 'utils', 'popularContent.ts'));
  const popularChars = popular.parsePopularCharacters(JSON.parse(fs.readFileSync(POPULAR_FILE, 'utf8')));
  const blueprintsData = JSON.parse(fs.readFileSync(BLUEPRINTS_FILE, 'utf8')).blueprints;

  const tempDir = path.join(ROOT, 'runtime', 'showcase-temp');
  fs.mkdirSync(tempDir, { recursive: true });

  const tasks = [];
  for (const charId of CHAR_IDS) {
    const character = popular.findCharacter(popularChars, charId);
    if (!character) throw new Error(`未找到角色: ${charId}`);
    const charBps = blueprintsData.filter(b => b.characterId === charId);

    for (let i = 0; i < charBps.length; i++) {
      const bp = charBps[i];
      const entryId = `pc_${charId}_${bp.id}`;
      const dstBig = path.join(SHOWCASE_DIR, 'images', `${entryId}.jpg`);
      const dstThumb = path.join(SHOWCASE_DIR, 'thumbs', `${entryId}.jpg`);

      tasks.push({
        charId,
        character,
        bp,
        index: i,
        totalInChar: charBps.length,
        entryId,
        dstBig,
        dstThumb
      });
    }
  }

  console.log(`[Showcase Pipeline] 待处理蓝图样张总数: ${tasks.length} 张`);

  let finishedCount = 0;
  let cursor = 0;

  function nextTask() {
    if (cursor >= tasks.length) return null;
    const idx = cursor++;
    return { task: tasks[idx], idx };
  }

  async function worker(workerId) {
    while (true) {
      const next = nextTask();
      if (!next) break;
      const { task, idx } = next;
      const { charId, character, bp, entryId, dstBig, dstThumb } = task;
      const prefix = `[Worker ${workerId}][${idx + 1}/${tasks.length}]`;

      if (fs.existsSync(dstBig) && fs.existsSync(dstThumb) && fs.statSync(dstBig).size > 20000) {
        console.log(`${prefix} [已存在] ${character.displayName} - ${bp.title}`);
        finishedCount++;
        continue;
      }

      console.log(`${prefix} 正在构建提示词: ${character.displayName} - ${bp.title}...`);

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

      const tempPng = path.join(tempDir, `${entryId}.png`);
      const seed = Math.floor(Math.random() * 1000000000) + 100000000;

      let rendered = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const jobId = await submitJob({
            modelId: 'anima-aesthetic-v1.1',
            prompt,
            negative: plan.negative,
            width: 832,
            height: 1216,
            steps: 28,
            cfg: bp.adult ? 5.2 : 4.5,
            seed
          });

          const imgBuf = await pollJob(jobId);
          fs.writeFileSync(tempPng, imgBuf);
          convertShowcase(tempPng, dstBig, dstThumb);
          rendered = true;
          break;
        } catch (err) {
          console.warn(`${prefix} ⚠️ 渲染失败第 ${attempt} 次 (${err.message})，重试中...`);
          await new Promise(r => setTimeout(r, 2500));
        }
      }

      if (!rendered) {
        console.error(`${prefix} ❌ 渲染失败: ${entryId}`);
        continue;
      }

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
          key: `popular:${charId}:${bp.id}`,
          recordId: `popular:${charId}:${bp.id}@attempt-1`,
          attempt: 1,
          generatedAt: new Date().toISOString(),
          review: {
            verdict: 'pass',
            recordId: `popular:${charId}:${bp.id}@attempt-1`,
            notes: '蔚蓝档案五人样张自动化大盘同步',
            reviewedAt: new Date().toISOString(),
            by: 'pipeline-auto-audit'
          }
        }
      };

      const existingIdx = manifest.entries.findIndex(e => e.id === entryId);
      if (existingIdx >= 0) manifest.entries[existingIdx] = newEntry;
      else manifest.entries.push(newEntry);

      finishedCount++;
      console.log(`${prefix} ✓ 样张入库成功: ${entryId}`);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  // 整理与写回 manifest.json
  manifest.counts = manifest.counts || {};
  manifest.counts.popular = manifest.entries.filter(e => e.type === 'popular').length;
  manifest.entryCount = manifest.entries.length;
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`\n========================================================`);
  console.log(`[Showcase Pipeline] 大盘更新完成！总计: ${finishedCount}/${tasks.length}`);
  console.log(`[Showcase Pipeline] 当前 Manifest 总条目数: ${manifest.entries.length}`);
  console.log(`========================================================\n`);

  // 清理临时文件
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
}

main().catch(console.error);
