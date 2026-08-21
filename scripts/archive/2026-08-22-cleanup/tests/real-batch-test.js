'use strict';
// 真实端到端批量验证（走开发网关 :3000 → 真实 ComfyUI）：
// 上传两张关键帧 → 2 镜批量（linkLastFrame）→ 自动尾帧衔接 → 拼接成片。
var fs = require('fs');
var path = require('path');
var BASE = 'http://127.0.0.1:3000';
var REVIEW = 'E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review';

function b64(file) {
  return fs.readFileSync(file).toString('base64');
}
async function post(url, body) {
  var res = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}
async function get(url) {
  var res = await fetch(BASE + url, { cache: 'no-store' });
  return { status: res.status, body: await res.json() };
}

(async () => {
  var up1 = await post('/api/video/images', { data: b64(path.join(REVIEW, 'h3-frame-first.png')) });
  var up2 = await post('/api/video/images', { data: b64(path.join(REVIEW, 'h3-frame-last.png')) });
  console.log('uploads:', up1.status, up2.status, up1.body.name, up2.body.name);

  var created = await post('/api/video/batches', {
    modelId: 'minimax-h3',
    aspectRatio: 'landscape',
    quality: 'standard',
    linkLastFrame: true,
    shots: [
      {
        prompt: 'A girl with long silver hair stands on a rain-soaked rooftop at night, wind blowing her hair and coat, she slowly turns her head toward the camera, city lights glowing behind her.',
        image: up1.body.name,
        shotSize: 'wide',
      },
      {
        prompt: 'Close view of the same girl lifting her katana slowly, rain streaking past the city lights behind her.',
        image: up2.body.name,
        shotSize: 'closeup',
      },
    ],
  });
  console.log('batch create:', created.status, created.body.batch ? created.body.batch.id : created.body.error);
  if (created.status !== 202) process.exit(1);
  var id = created.body.batch.id;

  var deadline = Date.now() + 15 * 60 * 1000;
  var final;
  while (Date.now() < deadline) {
    await new Promise(function (r) { setTimeout(r, 8000); });
    var poll = await get('/api/video/batches/' + id);
    final = poll.body.batch;
    var states = final.shots.map(function (s) { return s.index + ':' + s.status; }).join(' ');
    console.log('batch', final.status, '|', states, '| attempts', final.shots.map(function (s) { return s.attempts; }).join(','));
    if (final.status === 'done' || final.status === 'paused' || final.status === 'cancelled') break;
  }
  if (!final || final.status !== 'done') { console.error('batch did not finish:', final && final.status); process.exit(1); }

  var concatRes = await post('/api/video/batches/' + id + '/concat', {});
  console.log('concat:', concatRes.status, concatRes.body.batch && concatRes.body.batch.concatUrl);
  if (concatRes.status !== 200) { console.error(JSON.stringify(concatRes.body)); process.exit(1); }
  var url = concatRes.body.batch.concatUrl;
  var out = path.join(REVIEW, 'batch-real.mp4');
  var res = await fetch(BASE + url);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log('saved', out, fs.statSync(out).size, 'bytes');
  console.log('REAL BATCH OK');
})().catch(function (e) { console.error('REAL BATCH FAIL:', e.message); process.exitCode = 1; });
