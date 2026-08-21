'use strict';
// 耗时实测：① fast 5s（0.2MP，对标线上 480p）② standard 10s（243 帧，16GB VRAM 可行性）
// ③ fast 5s 4 步极速（Turbo 官方 4 步档）。直接对 ComfyUI 提交，Buffer 方式下载。
var fs = require('fs');
var path = require('path');
var http = require('http');
var video = require('../../routes/video');

var COMFY = 'http://127.0.0.1:8188';
var CLIENT = 'aics-gpu-timing';
var OUT_DIR = 'E:\\code\\2\\lora\\AI-CG-Studio\\runtime\\review';
var CONFIG = { AI_WORKSPACE_ROOT: 'E:\\code\\2\\lora\\AI', ROOT_DIR: path.resolve(__dirname, '..', '..') };

function req(method, url, body) {
  return new Promise(function (resolve, reject) {
    var u = new URL(COMFY + url);
    var payload = body ? Buffer.from(JSON.stringify(body)) : null;
    var r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: method, headers: payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {} }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { resolve({ status: res.statusCode, body: Buffer.concat(chunks) }); });
    });
    r.on('error', reject);
    r.setTimeout(60000, function () { r.destroy(new Error('request timeout')); });
    if (payload) r.write(payload);
    r.end();
  });
}

async function runJob(label, input, stepsOverride) {
  var graph = video.buildWorkflow(input);
  if (stepsOverride) graph['8'].inputs.steps = stepsOverride;
  var submitted = await req('POST', '/prompt', { prompt: graph, client_id: CLIENT });
  if (submitted.status !== 200) {
    console.error('[' + label + '] submit failed', submitted.status, submitted.body.toString('utf8', 0, 400));
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
      console.error('[' + label + '] FAILED after ' + Math.round((Date.now() - t0) / 1000) + 's: ' + JSON.stringify(entry.status).slice(0, 600));
      return null;
    }
    if (st === 'success') {
      var secs = Math.round((Date.now() - t0) / 1000);
      console.log('[' + label + '] succeeded in ' + secs + 's');
      var out = entry.outputs['11'];
      var vids = (out && (out.videos || out.images)) || [];
      if (vids.length) {
        var view = await req('GET', '/view?filename=' + encodeURIComponent(vids[0].filename) + '&type=output');
        fs.writeFileSync(path.join(OUT_DIR, label + '.mp4'), view.body);
        console.log('[' + label + '] saved ' + view.body.length + ' bytes');
      }
      return secs;
    }
  }
}

async function main() {
  var base = {
    prompt: 'A girl with long silver hair stands on a rain-soaked rooftop at night, wind blowing her hair and coat, she slowly turns her head toward the camera, city lights glowing behind her.',
    modelId: 'minimax-h3', aspectRatio: 'landscape', camera: 'push', motion: 'subtle',
  };
  var tFast5 = await runJob('timing-fast-5s', video.validateInput(Object.assign({}, base, {
    quality: 'fast', duration: 5, seed: 21,
  }), CONFIG));
  var tStd10 = await runJob('timing-std-10s', video.validateInput(Object.assign({}, base, {
    quality: 'standard', duration: 10, seed: 22,
  }), CONFIG));
  var tFast4step = await runJob('timing-fast-5s-4step', video.validateInput(Object.assign({}, base, {
    quality: 'fast', duration: 5, seed: 23,
  }), CONFIG), 4);
  var tStd15 = await runJob('timing-std-15s', video.validateInput(Object.assign({}, base, {
    quality: 'standard', duration: 15, seed: 24,
  }), CONFIG));
  console.log('TIMING SUMMARY: fast5=' + tFast5 + 's std10=' + tStd10 + 's fast5-4step=' + tFast4step + 's std15=' + tStd15 + 's');
  console.log('TIMING DONE');
}

main().catch(function (e) { console.error(e); process.exitCode = 1; });
