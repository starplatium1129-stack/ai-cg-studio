'use strict';
/* 临时诊断：纯 Ref2VA 双角色单镜（无尾帧衔接）提交，验证 <Picture 2> 是否生效。 */
var video = require('../../routes/video');

async function main() {
  video.setT8Available(true);
  // shot08 剧本：<Picture 2>拆开信低头阅读…<Picture 1> 在场。无 image/lastFrame → Ref2VA。
  var input = video.validateInput({
    prompt: 'A quiet night cafe. <Picture 2> sits at the counter, opens a letter and reads it, eyes reddening; <Picture 1> stands behind the counter watching. Character identity anchors: <Picture 1> is the white-haired purple-eyed girl, <Picture 2> is the black-haired girl with golden yellow eyes and red hairclips - keep each character distinct and consistent with their picture throughout the shot.',
    modelId: 'minimax-h3',
    aspectRatio: 'landscape',
    quality: 'standard',
    steps: 4,
    duration: 5,
    camera: 'push',
    motion: 'subtle',
    dialogue: '',
    references: ['aics_video_ref_cdef7858c081ea8c.png', 'aics_video_ref_191c877cdbdfab9c.png'],
  }, { ROOT_DIR: process.cwd(), AI_WORKSPACE_ROOT: 'E:\\code\\2\\lora\\AI' });
  var graph = video.buildWorkflow(input);
  console.log('task_type:', graph['5'].inputs.task_type);
  console.log('ref slots:', Object.keys(graph['5'].inputs).filter(function (k) { return k.indexOf('ref_images') === 0; }));

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
      camera: 'push',
      motion: 'subtle',
      seed: 777001,
      references: ['aics_video_ref_cdef7858c081ea8c.png', 'aics_video_ref_191c877cdbdfab9c.png'],
    }),
  });
  var body = await res.json();
  if (res.status !== 202 || !body.job) { console.log('HTTP', res.status, JSON.stringify(body).slice(0, 400)); return; }
  console.log('job:', body.job.id);
  // 轮询到结束
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