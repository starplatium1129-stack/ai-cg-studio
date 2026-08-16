'use strict';
// cu130 升级后基准：standard 5s 8步（对照 cu126 基线 228s）。
var fs = require('fs');
var path = require('path');
var http = require('http');
var video = require('../../routes/video');
var COMFY = 'http://127.0.0.1:8188';
var CLIENT = 'aics-gpu-bench';
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
async function runJob(label, input) {
  var graph = video.buildWorkflow(input);
  var submitted = await req('POST', '/prompt', { prompt: graph, client_id: CLIENT });
  if (submitted.status !== 200) { console.error('[' + label + '] submit failed', submitted.status, submitted.body.toString('utf8', 0, 400)); return null; }
  var promptId = JSON.parse(submitted.body.toString('utf8')).prompt_id;
  var t0 = Date.now();
  while (true) {
    await new Promise(function (r) { setTimeout(r, 10000); });
    var h = await req('GET', '/history/' + promptId);
    var entry = JSON.parse(h.body.toString('utf8'))[promptId];
    if (!entry) continue;
    var st = entry.status && entry.status.status_str;
    if (st === 'error' || st === 'failed') { console.error('[' + label + '] FAILED: ' + JSON.stringify(entry.status).slice(0, 500)); return null; }
    if (st === 'success') {
      var secs = Math.round((Date.now() - t0) / 1000);
      console.log('[' + label + '] succeeded in ' + secs + 's');
      return secs;
    }
  }
}
async function main() {
  var base = {
    prompt: 'A girl with long silver hair stands on a rain-soaked rooftop at night, wind blowing her hair and coat, she slowly turns her head toward the camera, city lights glowing behind her.',
    modelId: 'minimax-h3', aspectRatio: 'landscape', camera: 'push', motion: 'subtle',
  };
  var t1 = await runJob('cu130-std-5s-8step', video.validateInput(Object.assign({}, base, { quality: 'standard', duration: 5, seed: 21 }), CONFIG));
  var t2 = await runJob('cu130-std-5s-8step-2nd', video.validateInput(Object.assign({}, base, { quality: 'standard', duration: 5, seed: 31 }), CONFIG));
  console.log('BENCH: std5-1st=' + t1 + 's std5-2nd=' + t2 + 's (cu126 基线 228s)');
  console.log('BENCH DONE');
}
main().catch(function (e) { console.error(e); process.exitCode = 1; });
