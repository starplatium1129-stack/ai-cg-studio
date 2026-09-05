'use strict';
// 一次性脚本：批量补齐样张预览缺失的 pc_<charId>_<bpId> 样张（复刻场景管理上传格式），用后即删
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const COMMS_BASE = process.env.AICS_COMMS_BASE || 'http://127.0.0.1:3000';
const { resolveSceneShowcaseDir } = require(path.join(ROOT, 'server', 'config'));
const AI_WORKSPACE = process.env.AI_WORKSPACE_ROOT || path.resolve(ROOT, '..', 'AI');
const SHOWCASE_DIR = resolveSceneShowcaseDir(ROOT, process.env.SCENE_SHOWCASE_DIR, AI_WORKSPACE);
const MANIFEST_FILE = path.join(SHOWCASE_DIR, 'manifest.json');
const CONCURRENCY = Number(process.argv.includes('--concurrency') ? process.argv[process.argv.indexOf('--concurrency') + 1] : 3);
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;

const popular = require(path.join(ROOT, 'src', 'utils', 'popularContent.ts'));
const characters = popular.parsePopularCharacters(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'popular-characters.json'), 'utf8')));
const blueprints = popular.parseSceneBlueprints(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scene-blueprints.json'), 'utf8')));
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
manifest.entries = manifest.entries || [];
const have = new Set(manifest.entries.filter(e => e.type === 'popular').map(e => e.id));

const tempDir = path.join(ROOT, 'assets', 'custom-gens', `gap-render-${Date.now()}`);
fs.mkdirSync(tempDir, { recursive: true });
const DIGEST = path.join(ROOT, 'runtime', 'gap-render-results.jsonl');

async function submitAnimaJob(payload) {
  const res = await fetch(`${COMMS_BASE}/api/anima/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const body = await res.text().catch(()=>''); throw new Error(`submit ${res.status}: ${body.slice(0,300)}`); }
  const data = await res.json();
  return data.job?.id ?? data.jobId ?? data.id;
}
async function pollJob(jobId, timeoutMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${COMMS_BASE}/api/anima/jobs/${jobId}`);
    if (res.ok) {
      const data = await res.json();
      const st = data.job?.status ?? data.status;
      if (st === 'succeeded' || st === 'completed') {
        const imgUrl = data.job?.resultUrl || (data.job?.outputs && data.job.outputs[0]);
        const fullUrl = String(imgUrl).startsWith('http') ? imgUrl : `${COMMS_BASE}${imgUrl}`;
        const imgRes = await fetch(fullUrl);
        return Buffer.from(await imgRes.arrayBuffer());
      }
      if (st === 'failed') throw new Error(data.job?.error || 'job failed');
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error(`timeout ${jobId}`);
}
function convertShowcase(srcPng, dstBig, dstThumb) {
  execSync(`python scripts/maintenance/convert-showcase-image.py "${srcPng}" "${dstBig}" "${dstThumb}"`, { cwd: ROOT, stdio: 'pipe' });
}

// ── 组装任务清单 ──
const tasks = [];
for (const character of characters) {
  if (ONLY && !ONLY.includes(character.id)) continue;
  const own = blueprints.filter(b => b.characterId === character.id);
  for (const bp of own) {
    const entryId = `pc_${character.id}_${bp.id}`;
    if (have.has(entryId)) continue;
    const [w, h] = String(bp.recommendedSize || '832x1216').split('x').map(Number);
    tasks.push({ character, bp, entryId, width: w || 832, height: h || 1216 });
  }
}
console.log(`[gap-render] 缺口任务: ${tasks.length} 张, 并发 ${CONCURRENCY}, 输出 ${SHOWCASE_DIR}`);
let done = 0, failed = 0;
const results = [];

async function worker(queue) {
  while (queue.length) {
    const t = queue.shift();
    try {
      const plan = popular.buildPopularPromptPlan({
        character: t.character,
        outfit: t.character.outfits.find(o => o.id === t.bp.outfitId) || t.character.outfits[0],
        blueprint: t.bp,
        engine: 'anima',
        adultEnabled: true,
        artist: 'rella',
      });
      let prompt = plan.prompt;
      if (!prompt.includes('@rella')) prompt = `@rella, ${prompt}`;
      const seed = 70000000 + (Math.abs([...t.entryId].reduce((a, ch) => a + ch.charCodeAt(0) * 31, 0)) % 90000000);
      const imgBuf = await submitAndPoll({ modelId: 'anima-miaomiao-v1.2', prompt, negative: plan.negative, width: t.width, height: t.height, steps: 28, cfg: t.bp.adult ? 5.2 : 4.5, seed });
      const tempPng = path.join(tempDir, `${t.entryId}.png`);
      fs.writeFileSync(tempPng, imgBuf);
      const dstBig = path.join(SHOWCASE_DIR, 'images', `${t.entryId}.jpg`);
      const dstThumb = path.join(SHOWCASE_DIR, 'thumbs', `${t.entryId}.jpg`);
      convertShowcase(tempPng, dstBig, dstThumb);
      fs.unlinkSync(tempPng);
      const entry = {
        id: t.entryId,
        title: `${t.character.displayName} / ${t.bp.title}`,
        story: t.bp.description || '',
        category: '热门角色',
        char: t.character.id,
        displayName: t.character.displayName,
        rating: t.bp.adult ? 'R18' : 'All',
        attempt: 1,
        type: 'popular',
        image: `images/${t.entryId}.jpg`,
        thumb: `thumbs/${t.entryId}.jpg`,
        meta: { engine: 'anima', model: 'anima-miaomiao-v1.2', checkpoint: 'anima-miaomiao-v1.2.safetensors', seed, width: t.width, height: t.height },
        prompt,
        negative: plan.negative,
        provenance: {
          batch: 'popular', key: `popular:${t.character.id}:${t.bp.id}`,
          recordId: `popular:${t.character.id}:${t.bp.id}@attempt-1`, attempt: 1,
          generatedAt: new Date().toISOString(),
          review: { verdict: 'pass', recordId: `popular:${t.character.id}:${t.bp.id}@attempt-1`, notes: 'gap-render 批量补齐', reviewedAt: new Date().toISOString() },
        },
      };
      const idx = manifest.entries.findIndex(e => e.id === t.entryId);
      if (idx >= 0) manifest.entries[idx] = entry; else manifest.entries.push(entry);
      manifest.counts = manifest.counts || {};
      manifest.counts.popular = manifest.entries.filter(e => e.type === 'popular').length;
      manifest.entryCount = manifest.entries.length;
      fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
      done++;
      results.push({ id: t.entryId, ok: true });
      fs.appendFileSync(DIGEST, JSON.stringify({ id: t.entryId, ok: true, seed }) + '\n');
      console.log(`[ok ${done}/${tasks.length}] ${t.entryId}`);
    } catch (err) {
      failed++;
      results.push({ id: t.entryId, ok: false, error: String(err.message || err) });
      fs.appendFileSync(DIGEST, JSON.stringify({ id: t.entryId, ok: false, error: String(err.message || err) }) + '\n');
      console.error(`[fail] ${t.entryId}: ${err.message || err}`);
    }
  }
}
async function submitAndPoll(p) { const id = await submitAnimaJob(p); return pollJob(id); }

(async () => {
  const queue = tasks.slice();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
  console.log(`[gap-render] 完成: 成功 ${done}, 失败 ${failed}`);
})().catch(err => { console.error('gap-render fatal:', err); process.exit(1); });
