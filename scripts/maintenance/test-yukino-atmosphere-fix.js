'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const outDir = path.resolve(__dirname, '../../runtime/outputs/refined_atmosphere_test');

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
  console.log(`[${name}] Submitting Yukino fix job...`);
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
  // 1. 雪乃 · 侍奉部静谧黄昏（极具空气感与电影氛围，剔除产生光斑伪影的杂质词）
  const yukinoTeaPayload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt: [
      'feel. (studio), cinematic anime screencap, anime coloring, clean crisp lines, upper body, medium shot',
      'yukinoshita yukino, 1girl, solo, long straight silky black hair, sidelocks tied with red hair ribbons, ahoge, sharp cool blue eyes, delicate eyelashes, slight gentle smile, sobu high school uniform, dark blazer, white collared shirt, red ribbon necktie, sitting at wooden desk, teacup on saucer with gentle rising steam, clean face, flawless skin, front warm fill light',
      'service club classroom, large window, golden sunset, slanting orange sunbeams, glowing dust motes, gentle breeze blowing white curtains, soft bokeh background, volumetric lighting, atmospheric depth of field, warm nostalgia',
      'In the quiet Service Club classroom bathed in rich golden sunset light, Yukinoshita Yukino sits gracefully by the window, sheer white curtains swaying gently in the evening breeze, looking at the viewer with her signature composed yet tender gaze; golden sunlight illuminates her porcelain skin and glossy black hair in feel. studio\'s iconic television anime quality.'
    ].join(', '),
    negative: 'worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration, bad anatomy, bad hands, dark shadowed face, extra characters, white spots on face, light artifacts, blush overload',
    width: 832,
    height: 1216,
    steps: 30,
    cfg: 4.5,
    seed: 771122
  };

  // 2. 雪乃 · 夏夜祭典花火浴衣（极强冷暖光影：漫天花火冷光 vs 提灯暖光）
  const yukinoYukataPayload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt: [
      'feel. (studio), cinematic anime screencap, anime coloring, clean linework, upper body, medium shot',
      'yukinoshita yukino, 1girl, solo, black hair in neat side bun, hair flower ornament, ahoge, cool blue eyes, soft pink blush, looking at viewer with gentle wistful expression, dark blue floral yukata, white sash obi, clean face, flawless skin',
      'summer festival at night, brilliant fireworks bursting in night sky, warm glowing paper lantern light, soft bokeh festival lights in background, dramatic contrast of golden lantern warmth and colorful fireworks glow, volumetric lighting, rich optical depth of field',
      'During a memorable summer festival night, Yukinoshita Yukino turns toward the viewer in a lovely dark blue yukata, vibrant fireworks exploding across the dark sky above and warm glowing lanterns illuminating her delicate face and dark hair with breathtaking cinematic atmosphere in feel. studio anime art style.'
    ].join(', '),
    negative: 'worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration, bad anatomy, bad hands, dark shadowed face, extra characters, messy face, light spots on face',
    width: 832,
    height: 1216,
    steps: 30,
    cfg: 4.5,
    seed: 882233
  };

  const results = [];
  results.push(await runJob('yukino_afternoon_tea_feel_v2', yukinoTeaPayload));
  results.push(await runJob('yukino_festival_yukata_fireworks', yukinoYukataPayload));
  console.log('\nYukino fixes generated:', results);
}

main().catch(console.error);
