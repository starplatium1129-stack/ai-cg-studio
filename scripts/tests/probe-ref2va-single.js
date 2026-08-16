'use strict';
/* 临时诊断：单参考 Ref2VA 镜头（宁宁独擦杯）验证「仅一人、无分身」约束。 */
var video = require('../../routes/video');

async function main() {
  video.setT8Available(true);
  var input = video.validateInput({
    prompt: '咖啡店内空无一人，<Picture 1>站在吧台后，低头用白布仔细擦拭最后一个咖啡杯。墙上时钟指向深夜，气氛安静。',
    modelId: 'minimax-h3',
    aspectRatio: 'landscape',
    quality: 'standard',
    steps: 4,
    duration: 5,
    camera: 'still',
    motion: 'natural',
    dialogue: '',
    references: ['aics_video_ref_cdef7858c081ea8c.png'],
  }, { ROOT_DIR: process.cwd(), AI_WORKSPACE_ROOT: 'E:\\code\\2\\lora\\AI' });
  var graph = video.buildWorkflow(input);
  console.log('task_type:', graph['5'].inputs.task_type);
  console.log('ref slots:', Object.keys(graph['5'].inputs).filter(function (k) { return k.indexOf('ref_images') === 0; }));
  console.log('anchors:', graph['5'].inputs.prompt.split('\n').filter(function (l) { return l.indexOf('Character identity') === 0; })[0]);

  var res = await fetch('http://127.0.0.1:3123/api/video/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: input.prompt,
      modelId: 'minimax-h3',
      aspectRatio: 'landscape',
      quality: 'standard',
      steps: 4,
      duration: 5,
      camera: 'still',
      motion: 'natural',
      seed: 777002,
      references: ['aics_video_ref_cdef7858c081ea8c.png'],
    }),
  });
  var body = await res.json();
  if (res.status !== 202 || !body.job) { console.log('HTTP', res.status, JSON.stringify(body).slice(0, 400)); return; }
  console.log('job:', body.job.id);
  var deadline = Date.now() + 12 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(function (r) { setTimeout(r, 5000); });
    var st = await (await fetch('http://127.0.0.1:3123/api/video/jobs/' + body.job.id, { cache: 'no-store' })).json();
    var j = st.job;
    console.log(j.status, j.error || '');
    if (j.status === 'succeeded' || j.status === 'failed') {
      if (j.resultUrl) console.log('result:', 'http://127.0.0.1:3123' + j.resultUrl);
      break;
    }
  }
}

main().catch(function (err) { console.error('[probe fail]', err.message); process.exitCode = 1; });