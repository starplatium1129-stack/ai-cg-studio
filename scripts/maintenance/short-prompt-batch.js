// 短 prompt 批量生成器：场景库 × 5 seed（sc300 手工链路）。
// 用法: node scripts/maintenance/short-prompt-batch.js [--scenes sc001,sc002] [--base N] [--dry]
// 输出: AI/Reviews/ShortPromptBatch/<sceneId>_<seed>.png + picks.json
const fs = require('fs');
const path = require('path');
const { buildShortPrompt } = require('./short-prompt-builder.js');

const OUT = 'E:/code/2/lora/AI/Reviews/ShortPromptBatch';
const GATEWAY = 'http://127.0.0.1:3000';
// 20-seed 采样（sc300 手工挑 seed 执行化：密度决定 93+ 天花板）。
const SEEDS = [];
for (let i = 0; i < 20; i += 1) SEEDS.push(20260809 + i * 997);
const R18_TOKEN = { nene: 'nene_r18', natsume: 'natsume_r18' };
const CHAR_IDS = { sc001: 'nene', sc003: 'nene', sc006: 'nene', sc021: 'nene', sc036: 'nene', sc044: 'nene', sc075: 'nene', sc141: 'nene', sc252: 'nene', sc005: 'natsume', sc016: 'natsume', sc031: 'natsume' };
const LORAS = { nene: 'L_NENE_V20_ANIMA', natsume: 'L_NAT_V20_ANIMA' };
const PROFILE_BY_CHAR = { nene: 'anima_base_v10', natsume: 'anima_base_v10' };
const MODEL_BY_CHAR = { nene: 'anima-base-v1.0', natsume: 'anima-base-v1.0' };
const R18_LORA = { nene: 'L_NENE_V20_ANIMA', natsume: 'L_NAT_V20_ANIMA' };

const NEGATIVE = 'worst quality, low quality, blurry, jpeg artifacts, watermark, text, extra fingers, mutated hands, bad anatomy, split image, multiple panels, comic strip, second person, multiple girls';

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function splitList(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}
function readScenes() {
  const all = [];
  for (const [file, charId] of [
    ['data/scenes-nene.json', 'nene'],
    ['data/scenes-natsume.json', 'natsume'],
    ['data/scenes-shared.json', 'shared'],
    ['data/scenes-core.json', 'shared'],
  ]) {
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = Array.isArray(data) ? data : (data.scenes || []);
    all.push(...list.map(scene => ({ ...scene, _char: charId })));
  }
  return all;
}

async function submit(body) {
  const res = await fetch(GATEWAY + '/api/anima/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (res.status !== 202 || !data.ok || !data.job) return { ok: false, error: JSON.stringify(data) };
  const deadline = Date.now() + 10 * 60 * 1000;
  let job = data.job;
  while (Date.now() < deadline) {
    const poll = await fetch(`${GATEWAY}/api/anima/jobs/${encodeURIComponent(job.id)}`, { cache: 'no-store' });
    const pd = await poll.json();
    if (pd.ok && pd.job) job = pd.job;
    if (job.status === 'failed' || job.status === 'cancelled') return { ok: false, error: `${job.status}: ${job.error || job.code || ''}` };
    if (job.status === 'succeeded' && job.resultUrl) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  if (job.status !== 'succeeded' || !job.resultUrl) return { ok: false, error: `timeout ${job.status}` };
  const img = await fetch(GATEWAY + job.resultUrl, { cache: 'no-store' });
  if (!img.ok) return { ok: false, error: 'result fetch failed' };
  return { ok: true, buffer: Buffer.from(await img.arrayBuffer()), jobId: job.id, seed: (job.metadata && job.metadata.seed) || body.seed };
}

async function main() {
  const sceneFilter = splitList(argument('--scenes'));
  const base = Number(argument('--base', '0')) || 0;
  const dry = process.argv.includes('--dry');
  const scenes = readScenes();
  const targets = sceneFilter.length ? scenes.filter(s => sceneFilter.includes(String(s.id))) : scenes;
  fs.mkdirSync(OUT, { recursive: true });
  const picksPath = path.join(OUT, 'picks.json');
  const picks = fs.existsSync(picksPath) ? JSON.parse(fs.readFileSync(picksPath, 'utf8')) : [];
  let generated = 0;
  for (const scene of targets) {
    const id = String(scene.id);
    const charId = scene._char === 'shared' ? null : scene._char;
    if (!charId) { console.log(`[skip] ${id}: shared scene, not covered`); continue; }
    const built = buildShortPrompt(scene, charId);
    const rating = String(scene.rating || 'all');
    const r18 = rating === 'r18';
    // r18 token 全场景注入（sc300 复现验证：显著提升渲染质感且内容安全）。
    const prompt = [
      ...built.prompt.split(', '),
      R18_TOKEN[charId],
      ...(r18 ? ['nude', 'naked', 'no_clothes', 'breasts', 'nipples'] : []),
    ].filter((t, i, arr) => arr.indexOf(t) === i).join(', ');
    const loraId = LORAS[charId];
    for (let i = 0; i < SEEDS.length; i += 1) {
      if (i < base) continue;
      const seed = SEEDS[i];
      const file = path.join(OUT, `${id}_${seed}.png`);
      if (fs.existsSync(file)) { console.log(`[exists] ${id} seed ${seed}`); continue; }
      const body = {
        prompt, modelId: MODEL_BY_CHAR[charId],
        width: 832, height: 1216,
        seed, steps: 24, cfg: 3.0,
        negative: NEGATIVE,
        loraId, loraStrength: 0.85, character: charId,
      };
      console.log(`[generate] ${id} seed ${seed}${r18 ? ' (R18)' : ''}`);
      if (dry) continue;
      const result = await submit(body);
      if (!result.ok) { console.log(`[failed] ${id} seed ${seed}: ${result.error}`); continue; }
      fs.writeFileSync(file, result.buffer);
      generated += 1;
      console.log(`[ok] ${id} seed ${seed} (${result.buffer.length} bytes)`);
    }
  }
  console.log(JSON.stringify({ output: OUT, generated }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
