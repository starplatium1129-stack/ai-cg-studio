'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const outDir = path.resolve(__dirname, '../../runtime/outputs/emiya_gohan_style_test');
fs.mkdirSync(outDir, { recursive: true });

function requestJson(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(dataStr ? { 'Content-Length': Buffer.byteLength(dataStr) } : {})
      }
    }, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          resolve({ status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

function fetchBinary(urlPath, destFile) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destFile);
    http.get(`http://127.0.0.1:3000${urlPath}`, res => {
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destFile)));
    }).on('error', reject);
  });
}

async function runJob(name, payload) {
  console.log(`[${name}] Submitting genuine Emiya Gohan job...`);
  const createRes = await requestJson('POST', '/api/anima/jobs', payload);
  if (!createRes.ok || !createRes.job) {
    console.error(`[${name}] Failed:`, JSON.stringify(createRes));
    return null;
  }
  const jobId = createRes.job.id;
  const start = Date.now();
  while (Date.now() - start < 180000) {
    await new Promise(r => setTimeout(r, 1500));
    const statusRes = await requestJson('GET', `/api/anima/jobs/${jobId}`);
    const job = statusRes.job;
    if (!job) continue;
    process.stdout.write(`\r[${name}] Status: ${job.status}...`);
    if (job.status === 'succeeded') {
      console.log(`\n[${name}] Succeeded!`);
      const targetFile = path.join(outDir, `${name}.png`);
      await fetchBinary(job.resultUrl, targetFile);
      const stat = fs.statSync(targetFile);
      console.log(`[${name}] Saved to ${targetFile} (${Math.round(stat.size / 1024)} KB)`);
      return targetFile;
    } else if (job.status === 'failed') {
      console.error(`\n[${name}] Failed: ${job.error}`);
      return null;
    }
  }
  return null;
}

async function main() {
  const tests = [
    // 方案 A: 注入《卫宫家今天的饭》原作漫画家 TAa (@taa) + 动画柔和水彩粉彩
    {
      name: 'saber_emiya_gohan_taa_manga',
      payload: {
        modelId: 'anima-aesthetic-v1.1',
        prompt: [
          '@taa, emiya-san chi no kyou no gohan',
          'soft pastel coloring, watercolor aesthetic, warm cozy palette, gentle soft lines, light brown lineart, soft diffuse lighting, medium shot',
          'artoria pendragon, saber (fate), 1girl, solo, blonde hair in neat braided bun, blue hair ribbon, bouncy ahoge, bright round emerald-green eyes, soft round pink blush on cheeks, blissful joyful smile, open mouth, casual clothes, dark blue knit cardigan, white collared shirt, clean face',
          'traditional japanese dining room, low wooden kotatsu table, steaming rice bowl and miso soup, delicious homemade meal, warm soft ambient morning sunlight, tatami mat, sliding paper shoji screen, gentle healing slice of life atmosphere',
          'A heartwarming, gentle scene in authentic Emiya-san Chi no Kyou no Gohan style by TAa: Saber sits happily at the warm wooden dining table enjoying a delicious home-cooked meal, her expressive emerald eyes round and full of wonder with soft pink blushing cheeks, rendered with soft pastel watercolor tones, delicate light linework, and warm diffuse sunlight.'
        ].join(', '),
        negative: 'worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration, bad anatomy, bad hands, dark shadowed face, harsh shadows, heavy black lines, sharp digital shading, fighting, armor, swords, extra characters',
        width: 832,
        height: 1216,
        steps: 30,
        cfg: 4.5,
        seed: 112233
      }
    },

    // 方案 B: 动画官方人设内村瞳子 / ufotable 治愈粉彩动画风 (高明度、水彩柔光、温润赛璐珞)
    {
      name: 'saber_emiya_gohan_pastel_anime',
      payload: {
        modelId: 'anima-aesthetic-v1.1',
        prompt: [
          'emiya-san chi no kyou no gohan, ufotable, official anime screencap, soft pastel colors, warm watercolor palette, flat soft shading, thin clean lines, medium shot',
          'artoria pendragon, saber (fate), 1girl, solo, soft blonde hair, neat braided bun, sky blue hair ribbon, bouncy ahoge, large expressive green eyes, cute round blush, gentle peaceful smile, casual clothing, dark navy cardigan sweater, white shirt with collar, sitting at dining table, clean face, flawless soft skin',
          'cozy japanese dining table, ceramic teacup with steam, delicious breakfast tamagoyaki and rice, soft warm morning window light, tatami floor, peaceful home, comforting atmosphere',
          'In the beloved comforting art style of Today\'s Menu for the Emiya Family, Saber relaxes at the sunny wooden dining table in casual blue cardigan with a blissful smile, bathed in gentle warm morning light and soft pastel colors with delicate clean lines and no harsh shadows.'
        ].join(', '),
        negative: 'worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration, bad anatomy, bad hands, dark shadowed face, harsh contrast, heavy black ink lines, dramatic dark shadows, armor, dark background, extra characters',
        width: 832,
        height: 1216,
        steps: 30,
        cfg: 4.5,
        seed: 445566
      }
    }
  ];

  const files = [];
  for (const t of tests) {
    const f = await runJob(t.name, t.payload);
    if (f) files.push(f);
  }

  console.log('\nEmiya Gohan comparison images saved:');
  files.forEach(f => console.log(' -', f));
}

main().catch(console.error);
