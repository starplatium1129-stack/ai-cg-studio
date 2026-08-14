'use strict';

const fs = require('fs');
const path = require('path');

async function run() {
  const seed = 138127115;
  const prompt = [
    'score_9, score_8_up, score_7_up, masterpiece, best quality, very aesthetic, absurdres',
    'annie_leonhart, 1girl, solo',
    'blonde hair, tied hair, low bun, blue eyes, piercing gaze, slight smirk',
    'casual clothes, oversized white hoodie, dolphin shorts, tight grey shorts',
    'curvy figure, round ass, big ass, wide hips, hourglass figure, looking back, looking at viewer, from behind, standing',
    'cozy sunlit bedroom, messy bed background, wooden floor',
    '@rella, cinematic lighting, window light, golden hour, floating dust particles, rim light, volumetric lighting, photorealistic anime shading',
  ].join(', ');

  const negative = 'score_4, score_5, score_6, worst quality, low quality, normal quality, blurry, bad anatomy, bad hands, missing fingers, extra digit, cropped, text, signature, watermark, multiple girls, 2girls';

  console.log(`Submitting 2x Hires.fix upscale job (seed: ${seed})...`);

  const payload = {
    prompt,
    negative,
    modelId: 'anima-aesthetic-v1.1',
    width: 832,
    height: 1216,
    steps: 26,
    cfg: 3.5,
    seed,
    hiresFix: true,
    hiresScale: 2.0,
    hiresDenoise: 0.35,
  };

  const createRes = await fetch('http://127.0.0.1:3000/api/anima/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const createData = await createRes.json();
  if (!createData.ok || !createData.job?.id) {
    console.error('Submit failed:', createData);
    process.exit(1);
  }

  const jobId = createData.job.id;
  console.log(`Hires job submitted: ${jobId}, polling...`);

  const start = Date.now();
  let resultUrl = '';
  while (Date.now() - start < 300_000) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(`http://127.0.0.1:3000/api/anima/jobs/${encodeURIComponent(jobId)}`);
    const statusData = await statusRes.json();
    const job = statusData.job;
    if (!job) continue;
    console.log(`Status: ${job.status}`);
    if (job.status === 'succeeded' && job.resultAvailable && job.resultUrl) {
      resultUrl = job.resultUrl;
      break;
    }
    if (job.status === 'failed' || job.status === 'cancelled') {
      console.error('Job failed:', job.error);
      process.exit(1);
    }
  }

  const fullUrl = resultUrl.startsWith('http') ? resultUrl : `http://127.0.0.1:3000${resultUrl}`;
  console.log(`Downloading 4K image from ${fullUrl}...`);
  const imgRes = await fetch(fullUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const outPath = path.resolve(__dirname, `../runtime/exports/annie_leonhart_rella_${seed}_4k.png`);
  fs.writeFileSync(outPath, buffer);
  console.log(`Saved 4K image: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

run().catch(console.error);
