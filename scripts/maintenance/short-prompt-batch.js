// 短 prompt 批量生成器：场景库 × 固定 3 seed（sc300 手工链路）。
// 用法: node scripts/maintenance/short-prompt-batch.js [--scenes sc001,sc002] [--dry]
// 合格标准由 review.json 五维人工评分决定，三张必须全部 >=90。
const fs = require('fs');
const path = require('path');
const { buildShortPrompt } = require('./short-prompt-builder.js');
const generationContract = require('../../server/anima-generation-contract.js');
const promptContract = require('./quality-prompt-contract.js');

const OUT = 'E:/code/2/lora/AI/Reviews/ShortPromptBatch';
const GATEWAY = 'http://127.0.0.1:3000';
const SEEDS = [20260809, 20261806, 20262803];
const LORAS = { nene: 'L_NENE_V20B_ANIMA', natsume: 'L_NAT_V20_ANIMA' };
const CHARACTERS = { nene: 'nene_b', natsume: 'natsume' };
const MODEL_BY_CHAR = { nene: 'anima-base-v1.0', natsume: 'anima-base-v1.0' };

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
  const dry = process.argv.includes('--dry');
  const scenes = readScenes();
  const targets = sceneFilter.length ? scenes.filter(s => sceneFilter.includes(String(s.id))) : scenes;
  const planned = targets.map(scene => {
    const id = String(scene.id);
    const characterId = scene._char === 'shared' ? null : scene._char;
    if (!characterId) return { scene, id, characterId, built: null };
    return { scene, id, characterId, built: buildShortPrompt(scene, characterId) };
  });
  const invalid = planned.filter(item => item.characterId && !item.built.health.ok);
  if (invalid.length) {
    throw new Error([
      `prompt preflight failed for ${invalid.length} scene(s); no images generated`,
      ...invalid.slice(0, 20).map(item => `${item.id}: ${item.built.health.errors.join('；')}`),
      invalid.length > 20 ? `... and ${invalid.length - 20} more` : '',
    ].filter(Boolean).join('\n'));
  }
  fs.mkdirSync(OUT, { recursive: true });
  let generated = 0;
  for (const item of planned) {
    const { id, characterId: charId, built } = item;
    if (!charId) { console.log(`[skip] ${id}: shared scene, not covered`); continue; }
    const prompt = built.prompt;
    const loraId = LORAS[charId];
    const sceneDir = path.join(OUT, id);
    fs.mkdirSync(sceneDir, { recursive: true });
    fs.writeFileSync(path.join(sceneDir, 'prompt.txt'), `${prompt}\n`, 'utf8');
    const reviewPath = path.join(sceneDir, 'review.json');
    if (!fs.existsSync(reviewPath)) {
      fs.writeFileSync(reviewPath, `${JSON.stringify(promptContract.buildSeedReview(SEEDS), null, 2)}\n`, 'utf8');
    }
    for (let i = 0; i < SEEDS.length; i += 1) {
      const seed = SEEDS[i];
      const file = path.join(sceneDir, `${id}_${seed}.png`);
      if (fs.existsSync(file)) { console.log(`[exists] ${id} seed ${seed}`); continue; }
      const body = {
        prompt, modelId: MODEL_BY_CHAR[charId],
        width: 832, height: 1216,
        seed,
        steps: generationContract.MANUAL_REPAIR_PRESET.steps,
        cfg: generationContract.MANUAL_REPAIR_PRESET.cfg,
        negative: NEGATIVE,
        loraId, loraStrength: 0.85, character: CHARACTERS[charId],
      };
      console.log(`[generate] ${id} seed ${seed}`);
      if (dry) continue;
      const result = await submit(body);
      if (!result.ok) { console.log(`[failed] ${id} seed ${seed}: ${result.error}`); continue; }
      fs.writeFileSync(file, result.buffer);
      generated += 1;
      console.log(`[ok] ${id} seed ${seed} (${result.buffer.length} bytes)`);
    }
  }
  console.log(JSON.stringify({
    output: OUT,
    seeds: SEEDS,
    planned: planned.filter(item => item.characterId).length,
    generated,
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
