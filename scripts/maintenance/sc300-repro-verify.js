// sc300 复现验证：精简场景词（cafe 级）+ r18 质量控制词 + 固定 3 seed。
// 用法: node scripts/maintenance/sc300-repro-verify.js
// 输出: AI/Reviews/Sc300Repro/<key>_<seed>.png
const fs = require('fs');
const path = require('path');

const OUT = 'E:/code/2/lora/AI/Reviews/Sc300Repro';
const GATEWAY = 'http://127.0.0.1:3000';
const NEGATIVE = 'worst quality, low quality, blurry, jpeg artifacts, watermark, text, extra fingers, mutated hands, bad anatomy';

const SEEDS = [20260809, 20261806, 20262803];

const ANCHORS = 'ayachi_nene, 1girl, solo, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons';

const PILOTS = [
  {
    key: 'sc252-minimal-r18',
    prompt: `${ANCHORS}, nene_school_uniform, cafe, warm_lighting, nene_r18, masterpiece, best_quality, score_7`,
  },
  {
    key: 'sc252-fewwords-no-r18',
    prompt: `${ANCHORS}, nene_school_uniform, beret, oversized_sweater, cafe, afternoon, sunlight, holding_spoon, heavy_blush, medium_shot, window_light, masterpiece, best_quality, score_7`,
  },
  {
    key: 'sc252-minimal-no-r18',
    prompt: `${ANCHORS}, nene_school_uniform, cafe, warm_lighting, masterpiece, best_quality, score_7`,
  },
];

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
  fs.mkdirSync(OUT, { recursive: true });
  let generated = 0;
  for (const pilot of PILOTS) {
    for (const seed of SEEDS) {
      const file = path.join(OUT, `${pilot.key}_${seed}.png`);
      if (fs.existsSync(file)) continue;
      const body = {
        prompt: pilot.prompt, modelId: 'anima-base-v1.0',
        width: 832, height: 1216,
        seed, steps: 24, cfg: 3.0,
        negative: NEGATIVE,
        loraId: 'L_NENE_V20_ANIMA', loraStrength: 0.85, character: 'nene',
      };
      console.log(`[generate] ${pilot.key} seed ${seed}`);
      const result = await submit(body);
      if (!result.ok) { console.log(`[failed] ${pilot.key} seed ${seed}: ${result.error}`); continue; }
      fs.writeFileSync(file, result.buffer);
      generated += 1;
      console.log(`[ok] ${pilot.key} seed ${seed} (${result.buffer.length} bytes)`);
    }
  }
  console.log(JSON.stringify({ output: OUT, generated }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
