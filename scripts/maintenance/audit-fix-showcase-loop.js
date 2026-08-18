#!/usr/bin/env node
'use strict';

/**
 * 2026-08-18：场景样张「审核 fail → 定向负面 → 重出 → 复审」全自动闭环（单命令）。
 *
 * 数据层先决（已做）：场景 prose 已补「她独自一人」约束句；soloGuard/clone 负面已增强。
 * 机制：
 *   1. 找 per-key 最新 attempt 仍 fail/review 的场景
 *   2. 读 fail summary（中文）→ 追加定向负面（分身/背景/崩坏）
 *   3. attempt+1 重出（新 seed + 追加负面）
 *   4. spawnSync 调 audit-showcase-rella.js --resume 复审（实时输出）
 *   5. 循环至通过或达 --rounds 上限
 *
 * 用法：node scripts/maintenance/audit-fix-showcase-loop.js \
 *       --output <candidates dir> --legacy <旧manifest> --rounds 3 [--keys a,b]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const generate = require('./generate-popular-showcase-anima11.js');
const popularContent = require('../../src/utils/popularContent.ts');

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}
async function gatewayJson(base, pathname, options) {
  let response;
  try {
    response = await fetch(base.replace(/\/$/, '') + pathname, Object.assign({ cache: 'no-store' }, options || {}));
  } catch (error) {
    return { response: null, data: null, error: error instanceof Error ? error.message : String(error) };
  }
  let data = null;
  try { data = await response.json(); } catch (error) { /* keep null */ }
  return { response, data };
}

function negativeFromReason(summary) {
  const s = String(summary || '');
  const extras = [];
  if (/(分身|复制|第二个|同款|双人|第二人|两个.{0,4}(人物|角色|女孩)|克隆)/.test(s)) {
    extras.push('multiple instances of the girl, duplicated character, clone of the girl, a copy of her, doppelganger, twin version, second identical girl, two identical girls, same girl twice');
  }
  if (/(背景.{0,6}(人物|人)|路人|宾客|顾客|人群|其他人)/.test(s)) {
    extras.push('no visible background people, no other figures, no bystanders, no crowd, no onlookers, empty background');
  }
  if (/(手.{0,4}(崩|坏|畸形)|崩坏|穿模|畸形|扭曲|遮挡)/.test(s)) {
    extras.push('bad hands, extra fingers, twisted fingers, broken proportions');
  }
  if (/(动作|姿势|坐|躺|睡|站).{0,8}(不符|不像|没|未|错误)/.test(s)) {
    extras.push('(correct specific pose:1.3), requested pose only');
  }
  if (/(脸|五官|表情).{0,6}(崩|糊|走形)|blurry face/.test(s)) {
    extras.push('clear distinctive face, sharp facial features');
  }
  return extras;
}

async function submitCandidate(base, candidate, extraNegative) {
  const body = {
    prompt: candidate.prompt,
    negative: [candidate.negative, extraNegative].filter(Boolean).join(', '),
    modelId: candidate.modelId,
    width: candidate.width, height: candidate.height,
    steps: candidate.steps, cfg: candidate.cfg, seed: candidate.seed,
  };
  const route = '/api/anima/jobs';
  let submitted = null;
  for (let retry = 0; retry < 5; retry += 1) {
    submitted = await gatewayJson(base, route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const busy = submitted.response && submitted.response.status === 429;
    if (!busy) break;
    await new Promise(resolve => setTimeout(resolve, 5000 * (retry + 1)));
  }
  if (!submitted.response || submitted.response.status !== 202 || submitted.data?.ok !== true || !submitted.data.job?.id) {
    return { ok: false, error: `submission failed (${submitted.response ? submitted.response.status : 'network'}): ${submitted.error || JSON.stringify(submitted.data).slice(0, 120)}` };
  }
  let job = submitted.data.job;
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const state = await gatewayJson(base, `${route}/${encodeURIComponent(job.id)}`);
    if (state.response?.ok && state.data?.ok && state.data.job) job = state.data.job;
    if (job.status === 'failed' || job.status === 'cancelled') return { ok: false, error: `job failed: ${job.error || job.status}` };
    if (job.status === 'succeeded' && job.resultUrl) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (job.status !== 'succeeded' || !job.resultUrl) return { ok: false, error: `job timed out: ${job.status}` };
  const result = await fetch(base.replace(/\/$/, '') + job.resultUrl, { cache: 'no-store' });
  if (!result.ok) return { ok: false, error: `result fetch failed (HTTP ${result.status})` };
  return { ok: true, buffer: Buffer.from(await result.arrayBuffer()), jobId: job.id, actualSeed: job.metadata?.seed ?? job.seed ?? candidate.seed, metadata: job.metadata || {}, mime: result.headers.get('content-type') || 'image/png' };
}

function runAudit(manifestFile, auditFile, legacy, concurrency) {
  const script = path.join(ROOT, 'scripts', 'maintenance', 'audit-showcase-rella.js');
  const args = ['--manifest', manifestFile, '--out', auditFile, '--concurrency', String(concurrency), '--resume'];
  if (legacy) args.push('--legacy', legacy);
  const r = spawnSync(process.execPath, [script].concat(args), { encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  const out = ((r.stdout || '') + (r.stderr || ''));
  const tail = out.trim().split('\n').slice(-6).join('\n');
  console.log('\n[audit] ' + tail);
  return out;
}

async function main() {
  const output = path.resolve(argument('--output', ''));
  const legacy = argument('--legacy', '');
  const gateway = argument('--gateway', 'http://127.0.0.1:3000');
  const rounds = Math.max(1, Number(argument('--rounds', '3')) || 3);
  const genConcurrency = Math.max(1, Math.min(3, Number(argument('--concurrency', '2')) || 2));
  const auditConcurrency = Math.max(1, Math.min(6, Number(argument('--audit-concurrency', '4')) || 4));
  const keysFilter = argument('--keys', '').split(',').map(s => s.trim()).filter(Boolean);
  if (!output) throw new Error('--output 必填');

  const manifestFile = path.join(output, 'generation-manifest.json');
  const auditFile = path.join(output, 'audit-results.json');
  let manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : [];
  let audit = fs.existsSync(auditFile) ? readJson(auditFile) : {};

  const popularData = require('../../data/popular-characters.json');
  const blueprintData = require('../../data/scene-blueprints.json');
  const presets = readJson(path.join(ROOT, 'data', 'presets.json'));
  const profile = (presets.model_profiles || []).find(p => p.id === 'anima_aesthetic_v11');
  if (!profile) throw new Error('missing anima_aesthetic_v11 profile');
  const characters = popularContent.parsePopularCharacters(popularData);
  const blueprints = popularContent.parseSceneBlueprints(blueprintData);

  for (let round = 1; round <= rounds; round += 1) {
    // per-key 最新 attempt
    const best = new Map();
    for (const r of manifest) {
      if (r.status !== 'succeeded') continue;
      const prev = best.get(r.key);
      if (!prev || r.attempt > prev.attempt) best.set(r.key, r);
    }
    const need = [];
    for (const [key, rec] of best) {
      if (keysFilter.length && !keysFilter.includes(key)) continue;
      const v = audit[rec.recordId] && audit[rec.recordId].verdict;
      if (!v || v === 'fail' || v === 'review') need.push({ key, rec });
    }
    if (!need.length) {
      console.log(`\n[闭环] 第 ${round} 轮：无残留 fail/review，全部通过 ✅`);
      break;
    }
    console.log(`\n[闭环] 第 ${round}/${rounds} 轮：待修复 ${need.length} 个`);

    // 组装重出任务
    const tasks = [];
    for (const { key, rec } of need) {
      const [, characterId, blueprintId] = key.split(':');
      const character = characters.find(c => c.id === characterId);
      const blueprint = blueprints.find(b => b.id === blueprintId && b.characterId === characterId);
      if (!character || !blueprint) { console.log('  [skip no-data]', key); continue; }
      const prevAudit = rec ? audit[rec.recordId] : null;
      const extraNegative = negativeFromReason(prevAudit ? prevAudit.summary : '').join(', ');
      const attempt = (rec ? rec.attempt : 0) + 1;
      const candidate = generate.buildCandidate(character, blueprint, profile, attempt);
      tasks.push({ key, candidate, extraNegative });
      console.log(`  [regen] ${key} -> attempt-${attempt}${extraNegative ? '\n        +neg: ' + extraNegative.slice(0, 110) : ''}`);
    }

    // 并行重出
    let cursor = 0;
    let okCount = 0;
    async function worker() {
      while (cursor < tasks.length) {
        const t = tasks[cursor];
        cursor += 1;
        const imageRel = `images/${t.candidate.characterId}/${t.candidate.blueprintId}/attempt-${t.candidate.attempt}.png`;
        const imageFile = path.join(output, imageRel.split('/').join(path.sep));
        console.log(`  [gen] ${t.candidate.recordId} seed ${t.candidate.seed}`);
        const result = await submitCandidate(gateway, t.candidate, t.extraNegative);
        if (!result.ok) {
          console.log(`  [fail] ${t.candidate.recordId}: ${result.error}`);
          manifest.push(Object.assign({}, t.candidate, { status: 'failed', error: result.error, image: '', generatedAt: new Date().toISOString() }));
          writeJsonAtomic(manifestFile, manifest);
          continue;
        }
        fs.mkdirSync(path.dirname(imageFile), { recursive: true });
        fs.writeFileSync(imageFile, result.buffer);
        manifest.push(Object.assign({}, t.candidate, {
          status: 'succeeded', error: '', image: imageRel, generatedAt: new Date().toISOString(),
          bytes: result.buffer.length, mime: result.mime,
          sha256: crypto.createHash('sha256').update(result.buffer).digest('hex'),
          jobId: result.jobId, actualSeed: result.actualSeed, metadata: result.metadata,
        }));
        okCount += 1;
        console.log(`  [ok] ${t.candidate.recordId} (${result.buffer.length} bytes)`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(genConcurrency, tasks.length) }, () => worker()));
    writeJsonAtomic(manifestFile, manifest);
    if (!okCount) { console.log('  本轮重出全部提交失败，终止。'); break; }

    // 复审（子进程，实时输出）+ 刷新 audit
    runAudit(manifestFile, auditFile, legacy, auditConcurrency);
    audit = readJson(auditFile);
  }
  console.log('\n[闭环] 完成。final per-key status:');
  const finalBest = new Map();
  for (const r of manifest) {
    if (r.status !== 'succeeded') continue;
    const prev = finalBest.get(r.key);
    if (!prev || r.attempt > prev.attempt) finalBest.set(r.key, r);
  }
  const stats = { pass: 0, skip: 0, fail: 0, review: 0 };
  for (const rec of finalBest.values()) {
    const v = audit[rec.recordId] ? audit[rec.recordId].verdict : 'NO-AUDIT';
    stats[v] = (stats[v] || 0) + 1;
    if (v === 'fail' || v === 'review') console.log('  仍未通过:', rec.key, '@attempt-' + rec.attempt, '->', v);
  }
  console.log('  ', JSON.stringify(stats));
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
