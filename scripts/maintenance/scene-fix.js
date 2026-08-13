// 单场景手工修复工具（sc300 链路）：手写 prompt + N seed 挑优。
// 用法: node scripts/maintenance/scene-fix.js --scene sc001 --prompt "<tags>" [--seeds 5] [--extra extra_seed]
// 输出: AI/Reviews/SceneFix/<sceneId>/<sceneId>_<seed>.png
const fs = require('fs');
const path = require('path');

const GATEWAY = 'http://127.0.0.1:3000';
const NEGATIVE = 'worst quality, low quality, blurry, jpeg artifacts, watermark, text, extra fingers, mutated hands, bad anatomy, split image, multiple panels, comic strip, second person, multiple girls';
const DEFAULT_SEEDS = [20260809, 20261806, 20262803, 20263800, 20264797];
const CHAR_BY_ID = {};

const CHAR_MAP = {
  nene: { loraId: 'L_NENE_V20_ANIMA', model: 'anima-base-v1.0', character: 'nene' },
  natsume: { loraId: 'L_NAT_V20_ANIMA', model: 'anima-base-v1.0', character: 'natsume' },
};function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function loadCharMap() {
  for (const file of ['data/scenes-nene.json', 'data/scenes-natsume.json']) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = Array.isArray(data) ? data : (data.scenes || []);
    const char = file.includes('nene') ? 'nene' : 'natsume';
    for (const scene of list) CHAR_BY_ID[String(scene.id)] = char;
  }
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
  return { ok: true, buffer: Buffer.from(await img.arrayBuffer()), jobId: job.id };
}

async function main() {
  loadCharMap();
  const sceneId = argument('--scene');
  const prompt = argument('--prompt');
  if (!sceneId || !prompt) {
    console.log('usage: node scripts/maintenance/scene-fix.js --scene sc001 --prompt "<tags>" [--seeds 5]');
    process.exit(1);
  }
  const char = CHAR_BY_ID[sceneId];
  if (!char) { console.log(`[error] unknown scene ${sceneId}`); process.exit(1); }
  const cfg = CHAR_MAP[char];
  const count = Math.max(1, Number(argument('--seeds', '5')) || 5);
  const extra = Number(argument('--extra', '0')) || 0;
  const loraArg = argument('--lora');
  const strengthArg = argument('--strength');
  const characterArg = argument('--character');
  if (loraArg) {
    cfg.loraId = loraArg;
    cfg.loraStrength = strengthArg ? Number(strengthArg) : 0.85;
  }
  if (characterArg) cfg.character = characterArg;
  const seeds = [];
  for (let i = 0; i < count; i += 1) seeds.push(20260809 + (i + extra) * 997);
  const outDir = path.join('E:/code/2/lora/AI/Reviews/SceneFix', sceneId);
  fs.mkdirSync(outDir, { recursive: true });
  let generated = 0;
  for (const seed of seeds) {
    const file = path.join(outDir, `${sceneId}_${seed}.png`);
    if (fs.existsSync(file)) { console.log(`[exists] ${seed}`); continue; }
    const body = {
      prompt, modelId: cfg.model, width: 832, height: 1216,
      seed, steps: Number(argument('--steps', '24')) || 24,
      cfg: Number(argument('--cfg', '3.0')) || 3.0,
      negative: NEGATIVE,
      loraId: cfg.loraId, loraStrength: cfg.loraStrength, character: cfg.character,
    };
    console.log(`[generate] ${sceneId} seed ${seed}`);
    const result = await submit(body);
    if (!result.ok) { console.log(`[failed] seed ${seed}: ${result.error}`); continue; }
    fs.writeFileSync(file, result.buffer);
    generated += 1;
    console.log(`[ok] ${sceneId} seed ${seed} (${result.buffer.length} bytes)`);
  }
  const promptFile = path.join(outDir, 'prompt.txt');
  fs.writeFileSync(promptFile, prompt, 'utf8');
  console.log(JSON.stringify({ scene: sceneId, outDir, generated, prompt }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
