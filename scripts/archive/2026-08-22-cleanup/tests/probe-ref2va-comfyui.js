'use strict';
/* 临时诊断：构造 T8 Ref2VA workflow 直接 POST ComfyUI /prompt，打印精确拒绝原因。 */
var video = require('../../routes/video');

async function main() {
  video.setT8Available(true);
  var input = video.validateInput({
    prompt: '深夜街道，一家亮着暖黄灯光的小咖啡店即将打烊，<Picture 1>站在吧台后，低头擦拭咖啡杯。',
    modelId: 'minimax-h3',
    aspectRatio: 'landscape',
    quality: 'standard',
    steps: 4,
    duration: 5,
    camera: 'still',
    motion: 'subtle',
    dialogue: '',
    references: ['aics_video_ref_17918b24c9aa3ded.png', 'aics_video_ref_942bcd08e4e4b94c.png', 'aics_video_ref_951a353e3c2c1625.png'],
  }, { ROOT_DIR: process.cwd(), AI_WORKSPACE_ROOT: 'E:\\code\\2\\lora\\AI' });
  var graph = video.buildWorkflow(input);
  console.log('task_type:', graph['5'].inputs.task_type);
  console.log('ref slots:', Object.keys(graph['5'].inputs).filter(function (k) { return k.indexOf('ref_images') === 0; }));
  console.log('with <Picture>:', /<Picture 1>/.test(graph['5'].inputs.prompt));

  var res = await fetch('http://127.0.0.1:8188/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: 'probe-ref2va' }),
  });
  var body = await res.text();
  console.log('HTTP', res.status);
  console.log(body.slice(0, 2000));
}

main().catch(function (err) { console.error('[probe fail]', err); process.exitCode = 1; });