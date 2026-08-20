'use strict';

// 2026-08-20 一次性真机验证：Anima 引擎 hires 接入 Remacri 真超分
// 用法：node scripts/maintenance/compare-hires-anima.js [--seed N] [--prompt "..."]
// 相同 prompt/seed 各出一张：A=旧 latent bicubic、B=新 Remacri（ESRGAN 像素放大+低 denoise）
// 用 anima-aesthetic-v1.1（noLora）避免依赖角色 LoRA 文件存在与否。
// 产物落 runtime/hires-compare/anima-*，供视觉审核对比。

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var COMFY = 'http://127.0.0.1:8188';
var OUT = path.join(ROOT, 'runtime', 'hires-compare');
fs.mkdirSync(OUT, { recursive: true });

var anima = require(path.join(ROOT, 'routes', 'anima'));
var INPUT = {
  prompt: multi(),
  negative: 'worst quality, low quality, artist name, blurry, jpeg artifacts',
  modelId: 'anima-aesthetic-v1.1',
  width: 832, height: 1216,
  seed: seedArg(),
  hiresFix: true, hiresScale: 2.0, hiresDenoise: 0.35,
  teaCache: false
};

function seedArg() { var i = process.argv.indexOf('--seed'); return i > -1 ? Number(process.argv[i + 1]) : 4321; }
function multi() {
  var i = process.argv.indexOf('--prompt');
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  return '1girl, solo, masterpiece, best quality, long pink hair, amber eyes, sailor fuku, upper body, soft lighting, anime style';
}

function reqJson(method, pathname, body) {
  return new Promise(function (resolve, reject) {
    var u = new URL(pathname, COMFY);
    var payload = body == null ? null : Buffer.from(JSON.stringify(body));
    var client = u.protocol === 'https:' ? require('https') : require('http');
    var r = client.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: method, headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {} }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error('HTTP ' + res.statusCode + ' ' + raw.toString().slice(0, 300)));
        resolve({ raw: raw, json: function () { try { return JSON.parse(raw.toString('utf8')); } catch (e) { return null; } } });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function submit(label, graph) {
  var res = await reqJson('POST', '/prompt', { prompt: graph, client_id: 'compare-anima-superres' });
  var body = res.json();
  if (!body || !body.prompt_id) throw new Error(label + ' 提交失败');
  return body.prompt_id;
}

async function waitDone(promptId, maxMs) {
  var deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    var res = await reqJson('GET', '/history/' + encodeURIComponent(promptId));
    var entry = res.json();
    var h = entry && entry[promptId];
    if (h) {
      var status = h.status && h.status.status_str;
      if (status === 'error' || status === 'failed') throw new Error('任务失败: ' + JSON.stringify(h.status && h.status.messages).slice(0, 500));
      if (status === 'success') {
        for (var id of Object.keys(h.outputs || {})) {
          var out = h.outputs[id];
          if (out && out.images && out.images.length) return out.images[0];
        }
        throw new Error('成功但无输出图');
      }
    }
    await new Promise(function (r) { setTimeout(r, 2000); });
  }
  throw new Error('等待超时');
}

async function download(image, label) {
  var pathname = '/view?filename=' + encodeURIComponent(image.filename) + '&subfolder=' + encodeURIComponent(image.subfolder || '') + '&type=' + encodeURIComponent(image.type || 'output');
  var res = await reqJson('GET', pathname);
  var target = path.join(OUT, label + '.png');
  fs.writeFileSync(target, res.raw);
  return target;
}

async function run() {
  var latent = anima.buildWorkflow(anima.validateInput(INPUT));
  var superInput = Object.assign({}, anima.validateInput(Object.assign({}, INPUT)), { superResModel: '4x_foolhardy_Remacri.safetensors' });
  var superRes = anima.buildWorkflow(superInput);
  console.log('[i] anima latent hires graph nodes:', Object.keys(latent).length, '| super-res nodes:', Object.keys(superRes).length);
  console.log('[i] super-res uses UpscaleModelLoader:', Object.values(superRes).some(function (n) { return n.class_type === 'UpscaleModelLoader'; }));

  console.log('[i] A: anima latent bicubic 提交中...');
  var idA = await submit('anima-latent', latent);
  console.log('[i]   prompt_id', idA);
  console.log('[i] B: anima Remacri super-res 提交中...');
  var idB = await submit('anima-remacri', superRes);
  console.log('[i]   prompt_id', idB);

  var imgA = await download(await waitDone(idA, 8 * 60 * 1000), 'anima-A_latent_bicubic');
  console.log('[i] A saved:', imgA);
  var imgB = await download(await waitDone(idB, 12 * 60 * 1000), 'anima-B_remacri_superres');
  console.log('[i] B saved:', imgB);
  console.log('DONE');
}

run().catch(function (e) { console.error('FAIL:', e.message); process.exitCode = 1; });
