'use strict';
// 真实 GPU 验证：H3 FL2VA（首尾帧）与 H3 对白（T2VA + dialogue）。
// 直接对 ComfyUI 提交（不经过网关），client_id 独立，避免与网关轮询冲突。
// 用法：node scripts/tests/gpu-validate-fl2va.js
var fs = require('fs');
var path = require('path');
var http = require('http');
var video = require('../../routes/video');

var COMFY = 'http://127.0.0.1:8188';
var CLIENT = 'aics-gpu-validate';
var INPUT_DIR = 'E:\\code\\2\\lora\\AI\\ComfyUI\\input';
var OUT_DIR = 'E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review';
var CONFIG = { AI_WORKSPACE_ROOT: 'E:\\code\\2\\lora\\AI', ROOT_DIR: path.resolve(__dirname, '..', '..') };

function req(method, url, body) {
  return new Promise(function (resolve, reject) {
    var u = new URL(COMFY + url);
    var payload = body ? Buffer.from(JSON.stringify(body)) : null;
    var r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: method, headers: payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {} }, function (res) {
      // 注意：视频二进制必须按 Buffer 累积，绝不能走 utf8 字符串（会损坏数据）。
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks) });
      });
    });
    r.on('error', reject);
    r.setTimeout(60000, function () { r.destroy(new Error('request timeout')); });
    if (payload) r.write(payload);
    r.end();
  });
}

function controlledName() {
  return 'aics_video_input_' + require('crypto').randomBytes(8).toString('hex') + '.png';
}

async function runJob(label, input) {
  var graph = video.buildWorkflow(input);
  console.log('[' + label + '] submitting…');
  var submitted = await req('POST', '/prompt', { prompt: graph, client_id: CLIENT });
  if (submitted.status !== 200) {
    console.error('[' + label + '] submit failed', submitted.status, submitted.body.toString('utf8', 0, 500));
    return null;
  }
  var promptId = JSON.parse(submitted.body.toString('utf8')).prompt_id;
  var t0 = Date.now();
  while (true) {
    await new Promise(function (r) { setTimeout(r, 10000); });
    var h = await req('GET', '/history/' + promptId);
    var entry = JSON.parse(h.body.toString('utf8'))[promptId];
    if (!entry) continue;
    var st = entry.status && entry.status.status_str;
    if (st === 'error' || st === 'failed') {
      console.error('[' + label + '] FAILED after ' + Math.round((Date.now() - t0) / 1000) + 's');
      console.error(JSON.stringify(entry.status).slice(0, 800));
      return null;
    }
    if (st === 'success') {
      var secs = Math.round((Date.now() - t0) / 1000);
      console.log('[' + label + '] succeeded in ' + secs + 's');
      var out = entry.outputs['11'];
      var vids = (out && (out.videos || out.images)) || [];
      if (!vids.length) { console.error('no video output'); return null; }
      var fname = vids[0].filename;
      var view = await req('GET', '/view?filename=' + encodeURIComponent(fname) + '&type=output');
      var target = path.join(OUT_DIR, label + '.mp4');
      fs.writeFileSync(target, view.body);
      console.log('[' + label + '] saved ' + target + ' (' + fs.statSync(target).size + ' bytes)');
      return target;
    }
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // FL2VA：首帧 + 尾帧（用 T2V 验证成片抽出的首尾帧，检验模型侧首尾帧收敛）。
  var first = controlledName();
  var last = controlledName();
  fs.copyFileSync(path.join(OUT_DIR, 'h3-frame-first.png'), path.join(INPUT_DIR, first));
  fs.copyFileSync(path.join(OUT_DIR, 'h3-frame-last.png'), path.join(INPUT_DIR, last));
  var fl2vaInput = video.validateInput({
    prompt: 'The girl with silver hair stands on the rain-soaked rooftop, wind lifting her coat as she slowly raises her katana.',
    modelId: 'minimax-h3', aspectRatio: 'landscape', duration: 5, camera: 'still', motion: 'subtle',
    quality: 'standard', seed: 7, image: first, lastFrame: last,
  }, CONFIG);
  await runJob('h3-fl2va-validation', fl2vaInput);

  // 对白：T2VA + dialogue（官方 4.4 (S1) + <d> 原文块，模型原生语音/口型）。
  var dialogueInput = video.validateInput({
    prompt: 'A young woman in a café looks out of the rain-streaked window, holding a cup of coffee.',
    modelId: 'minimax-h3', aspectRatio: 'landscape', duration: 5, camera: 'push', motion: 'subtle',
    quality: 'standard', seed: 8, dialogue: '雨，什么时候才停呢。',
  }, CONFIG);
  await runJob('h3-dialogue-validation', dialogueInput);

  // 清理本脚本上传的受控文件（模拟网关生命周期）。
  try { fs.unlinkSync(path.join(INPUT_DIR, first)); } catch (e) {}
  try { fs.unlinkSync(path.join(INPUT_DIR, last)); } catch (e) {}
  console.log('GPU VALIDATION DONE');
}

main().catch(function (e) { console.error(e); process.exitCode = 1; });
