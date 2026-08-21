#!/usr/bin/env node
'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = process.env.AI_WORKSPACE_ROOT || path.resolve(ROOT, '..', 'AI');
var APP_URL = process.env.AICS_APP_URL || 'http://127.0.0.1:3000';
var EVIDENCE_ROOT = path.join(AI_ROOT, 'Reviews', 'AnimaNatsumeV19PreviewSmoke', '2026-08-10');
var LORA_ID = 'L_NAT_V19_ANIMA_PREVIEW';

var cases = [
  {
    id:'identity-cafe',
    filename:'natsume-identity-cafe-seed-20260809.png',
    prompt:'shiki_natsume, 1girl, solo, very long black hair, golden yellow eyes, two red hairclips, mole under eye, natsume_cafe_uniform, white shirt, suspenders, suspender skirt, brown skirt, collared shirt, purple ribbon, standing behind a cafe counter, warm cafe light, medium shot, looking at viewer',
    seed:20260809,
    width:832,
    height:1216
  },
  {
    id:'ordinary-fullbody',
    filename:'natsume-ordinary-fullbody-seed-20260810.png',
    prompt:'shiki_natsume, 1girl, solo, very long black hair, golden yellow eyes, two red hairclips, mole under eye, casual clothes, standing, full body, head to toe, feet visible, long shot, camera pulled back, centered composition, simple indoor background, soft light',
    seed:20260810,
    width:1216,
    height:832
  }
];

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
async function json(url, options) {
  var response = await fetch(url, options);
  var data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error((data && data.error) || (response.status + ' ' + response.statusText));
  return data;
}
function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

async function runCase(item) {
  var created = await json(APP_URL + '/api/anima/jobs', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({
      prompt:item.prompt,
      negative:'worst quality, low quality, normal quality, lowres, blurry, bad anatomy, bad hands, extra fingers, extra arms, extra legs, deformed, cropped, duplicate, text, watermark, logo',
      modelId:'anima-base-v1.0',
      loraId:LORA_ID,
      loraStrength:0.85,
      width:item.width,
      height:item.height,
      steps:24,
      cfg:3,
      seed:item.seed,
      character:'natsume'
    })
  });
  var job = created.job;
  var deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await wait(1000);
    var state = await json(APP_URL + '/api/anima/jobs/' + encodeURIComponent(job.id));
    job = state.job;
    if (job.status === 'failed' || job.status === 'cancelled') throw new Error(item.id + ': ' + (job.error || job.status));
    if (job.status === 'succeeded' && job.resultUrl) break;
  }
  if (job.status !== 'succeeded' || !job.resultUrl) throw new Error(item.id + ': timed out');
  var result = await fetch(APP_URL + job.resultUrl);
  if (!result.ok) throw new Error(item.id + ': result fetch failed ' + result.status);
  var buffer = Buffer.from(await result.arrayBuffer());
  var output = path.join(EVIDENCE_ROOT, item.filename);
  fs.writeFileSync(output, buffer, { flag:'wx' });
  return { id:item.id, file:item.filename, seed:item.seed, width:item.width, height:item.height, character:job.character, loraId:job.loraId, preview:job.metadata && job.metadata.preview === true, bytes:buffer.length, sha256:sha256(buffer), prompt:item.prompt };
}

async function main() {
  fs.mkdirSync(EVIDENCE_ROOT, { recursive:true });
  if (process.env.AICS_SMOKE_REPORT_ONLY === '1') {
    var existing = JSON.parse(fs.readFileSync(path.join(EVIDENCE_ROOT, 'manifest.json'), 'utf8'));
    fs.writeFileSync(path.join(EVIDENCE_ROOT, 'visual-audit.md'), [
      '# Visual audit',
      '',
      '逐图由当前视觉能力检查：身份、两枚红发夹、金瞳、眼下泪痣、服装、肢体、单人、构图与光照。',
      '',
      '## identity-cafe · seed 20260809',
      '',
      '- 通过身份检查：黑色长发、金黄色眼睛、两枚红色发夹和眼下泪痣可见。',
      '- 通过服装检查：咖啡馆制服的白衬衫、背带裙与紫色蝴蝶结清晰，单人且肢体未见结构性错误。',
      '- 通过构图/光照检查：中近景单人构图，暖色咖啡馆环境光与叙事一致。',
      '',
      '## ordinary-fullbody · seed 20260810',
      '',
      '- 身份锚点基本通过：黑色长发、金瞳、两枚红色发夹与泪痣可见，单人。',
      '- 普通全身 hard gate 失败复现：画面被桌面截断在上半身/大腿附近，脚部不可见，不满足 head-to-toe；手部可辨识但不改变构图失败结论。',
      '- 光照与构图为简单室内柔光，但该图不能作为生产全身稳定性的证据。',
      '',
      '该 smoke 只证明实验预览链路可真实出图，不改变 E08 的 rejected 生产结论。',
      '',
    ].join('\n'), 'utf8');
    console.log(JSON.stringify(existing, null, 2));
    return;
  }
  var status = await json(APP_URL + '/api/anima/status', { cache:'no-store' });
  var preview = (status.loras || []).find(function (lora) { return lora.id === LORA_ID; });
  if (!preview || !preview.preview || preview.available !== true) throw new Error('authorized preview is not available');
  var results = [];
  for (var i = 0; i < cases.length; i += 1) results.push(await runCase(cases[i]));
  var manifest = { generatedAt:new Date().toISOString(), appUrl:APP_URL, loraId:LORA_ID, loraName:'shiki_natsume_v19_anima_preview', checkpoint:'E08 / step 312', loraStrength:0.85, loraSha256:'389d3153ac05fbe0ea9bd74a9823e5cb8ee6fdc5ed0ecfd9e0b08ff9215036d2', results:results };
  fs.writeFileSync(path.join(EVIDENCE_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(manifest, null, 2));
}
main().catch(function (error) { console.error(error && error.stack || error); process.exitCode = 1; });
