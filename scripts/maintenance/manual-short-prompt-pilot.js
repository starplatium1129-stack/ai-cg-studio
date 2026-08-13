// sc300 同款手工链路试点：短标签 prompt + 多 seed 候选，挑最优。
// 用法: node scripts/maintenance/manual-short-prompt-pilot.js [--base N] [--dry]
// 输出: AI/Reviews/ShortPromptPilot/<key>_<seed>.png + picks.json
const fs = require('fs');
const path = require('path');

const OUT = 'E:/code/2/lora/AI/Reviews/ShortPromptPilot';
const GATEWAY = 'http://127.0.0.1:3000';

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const SEEDS = [20260809, 20261806, 20262803];

// 短标签 prompt（sc300 结构：角色锚点 + 核心场景词 + 质量词），每 key 一个候选。
const PILOTS = [
  {
    key: 'sc001-nene-uniform-classroom',
    engine: 'anima',
    modelId: 'anima-base-v1.0',
    loraId: 'L_NENE_V20_ANIMA',
    loraStrength: 0.85,
    character: 'nene',
    width: 832, height: 1216,
    prompt: 'ayachi_nene, 1girl, solo, nene_school_uniform, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, classroom, window_light, afternoon, clear_sky, holding_papers, one_hand_adjusting_hair_ribbon, gentle_smile, looking_at_viewer, medium_shot, masterpiece, best_quality, score_7',
    negative: 'worst quality, low quality, blurry, jpeg artifacts, watermark, text, extra fingers, mutated hands, bad anatomy, split image, multiple panels, comic strip, second person, multiple girls',
  },
  {
    key: 'makima-flower-field-backlight',
    engine: 'anima',
    modelId: 'anima-aesthetic-v1.1',
    loraId: '',
    character: '',
    width: 832, height: 1216,
    prompt: 'makima, 1girl, solo, long_hair, braid, pink_orange_hair, red_eyes, ringed_eyes, white_shirt, black_tie, black_skirt, flower_field, backlight, golden_hour, wind, day, medium_shot, rule_of_thirds, backlit, rim_light, volumetric_lighting',
    negative: 'worst quality, low quality, blurry, jpeg artifacts, watermark, text, extra fingers, mutated hands, bad anatomy, split image, multiple panels, comic strip, second person, multiple girls',
  },
  {
    key: 'makima-candlelight-nsfw',
    engine: 'anima',
    modelId: 'anima-aesthetic-v1.1',
    loraId: '',
    character: '',
    width: 832, height: 1216,
    prompt: 'makima, 1girl, solo, long_hair, braid, pink_orange_hair, red_eyes, ringed_eyes, nude, naked, no_clothes, breasts, nipples, bedroom, candle, night, warm_light, lying_on_bed, spread_legs, nsfw',
    negative: 'worst quality, low quality, blurry, jpeg artifacts, watermark, text, extra fingers, mutated hands, bad anatomy, split image, multiple panels, comic strip, second person, multiple girls',
  },
  {
    key: 'sc005-natsume-fireworks-yukata',
    engine: 'anima',
    modelId: 'anima-base-v1.0',
    loraId: 'L_NAT_V20_ANIMA',
    loraStrength: 0.85,
    character: 'natsume',
    width: 832, height: 1216,
    prompt: 'shiki_natsume, 1girl, solo, very_long_black_hair, golden_yellow_eyes, two_red_hairclips, mole_under_eye, no_hair_ribbon, yukata, fireworks, night, summer_festival, lanterns, looking_back, smile, medium_shot, lantern_light, warm_lighting, masterpiece, best_quality, score_7',
    negative: 'worst quality, low quality, blurry, jpeg artifacts, watermark, text, extra fingers, mutated hands, bad anatomy, split image, multiple panels, comic strip, second person, multiple girls',
  },
  {
    key: 'sc252-nene-cafe-blush',
    engine: 'anima',
    modelId: 'anima-base-v1.0',
    loraId: 'L_NENE_V20_ANIMA',
    loraStrength: 0.85,
    character: 'nene',
    width: 832, height: 1216,
    prompt: 'ayachi_nene, 1girl, solo, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, beret, oversized_sweater, off_shoulder_sweater, cafe, coffee, holding_spoon, heavy_blush, panicked, open_mouth, medium_shot, window_light, masterpiece, best_quality, score_7',
    negative: 'worst quality, low quality, blurry, jpeg artifacts, watermark, text, extra fingers, mutated hands, bad anatomy, split image, multiple panels, comic strip, second person, multiple girls',
  },
  {
    key: 'kisara-candlelight-nsfw',
    engine: 'anima',
    modelId: 'anima-aesthetic-v1.1',
    loraId: '',
    character: '',
    width: 832, height: 1216,
    prompt: 'kisara_engage_kiss, 1girl, solo, long_hair, pink_hair, red_eyes, ahoge, nude, naked, no_clothes, breasts, nipples, bedroom, candle, night, warm_light, lying_on_bed, spread_legs, nsfw',
    negative: 'worst quality, low quality, blurry, jpeg artifacts, watermark, text, extra fingers, mutated hands, bad anatomy, split image, multiple panels, comic strip, second person, multiple girls, school uniform, sailor collar, grey jacket',
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
  const base = Number(argument('--base', '0')) || 0;
  const dry = process.argv.includes('--dry');
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  for (const pilot of PILOTS) {
    for (let i = 0; i < SEEDS.length; i += 1) {
      if (i < base) continue;
      const seed = SEEDS[i];
      const file = path.join(OUT, `${pilot.key}_${seed}.png`);
      if (fs.existsSync(file)) { console.log(`[exists] ${pilot.key} seed ${seed}`); continue; }
      const body = {
        prompt: pilot.prompt, modelId: pilot.modelId,
        width: pilot.width, height: pilot.height,
        seed, steps: 24, cfg: 3.0,
        negative: pilot.negative,
      };
      if (pilot.loraId) { body.loraId = pilot.loraId; body.loraStrength = pilot.loraStrength; body.character = pilot.character; }
      console.log(`[generate] ${pilot.key} seed ${seed}`);
      if (dry) { results.push({ key: pilot.key, seed }); continue; }
      const res = await submit(body);
      if (!res.ok) { console.log(`[failed] ${pilot.key} seed ${seed}: ${res.error}`); continue; }
      fs.writeFileSync(file, res.buffer);
      console.log(`[ok] ${pilot.key} seed ${seed} -> ${file} (${res.buffer.length} bytes)`);
    }
  }
  console.log(JSON.stringify({ output: OUT, done: results.length }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
