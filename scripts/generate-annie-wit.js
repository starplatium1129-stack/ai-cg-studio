'use strict';

const fs = require('fs');
const path = require('path');

async function run() {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const prompt = [
    'score_9, score_8_up, score_7_up, masterpiece, best quality, very aesthetic, absurdres',
    'annie_leonhart, 1girl, solo, shingeki_no_kyojin',
    'blonde hair, tied hair, low bun, parted bangs, sharp blue eyes, piercing gaze, slight cold smirk',
    'casual clothes, oversized white hoodie, grey dolphin shorts, tight shorts',
    'curvy figure, round ass, big ass, wide hips, looking back, looking at viewer, from behind, standing',
    'cozy sunlit bedroom, rustic wooden room, vintage window, morning dust particles',
    'wit studio \\(style\\), anime screencap, thick outlines, bold lineart, heavy ink lines, cel shading, dramatic shadow, high contrast anime coloring, 2010s anime style, key visual',
  ].join(', ');

  const negative = 'score_4, score_5, score_6, worst quality, low quality, normal quality, blurry, 3d, cgi, photorealistic, bad anatomy, bad hands, missing fingers, extra digit, cropped, text, signature, watermark, multiple girls';

  console.log(`Submitting Annie Leonhart WIT Studio original anime style generation (seed: ${seed})...`);

  const payload = {
    prompt,
    negative,
    modelId: 'anima-aesthetic-v1.1',
    width: 832,
    height: 1216,
    steps: 26,
    cfg: 3.5,
    seed,
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
  console.log(`Job submitted: ${jobId}, polling status...`);

  const start = Date.now();
  let resultUrl = '';
  while (Date.now() - start < 180_000) {
    await new Promise(r => setTimeout(r, 1500));
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

  if (!resultUrl) {
    console.error('Timeout waiting for job completion');
    process.exit(1);
  }

  const fullUrl = resultUrl.startsWith('http') ? resultUrl : `http://127.0.0.1:3000${resultUrl}`;
  console.log(`Downloading result image from ${fullUrl}...`);
  const imgRes = await fetch(fullUrl);
  if (!imgRes.ok) {
    console.error('Download failed:', imgRes.status);
    process.exit(1);
  }

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const outDir = path.resolve(__dirname, '../runtime/exports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `annie_leonhart_wit_anime_${seed}.png`);
  fs.writeFileSync(outPath, buffer);

  console.log(`\nSuccessfully saved WIT Anime style image to: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

run().catch(console.error);
