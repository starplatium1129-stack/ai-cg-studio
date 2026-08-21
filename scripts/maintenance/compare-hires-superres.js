'use strict';

// 2026-08-20 一次性真机对比：latent 二阶段 vs Remacri 真超分（hires.fix）
// 用法：node scripts/maintenance/compare-hires-superres.js [--seed N] [--prompt "..."]
// 相同 prompt/seed 各出两张：A=旧 latent（nearest-exact）、B=新 Remacri（ESRGAN 像素放大+低 denoise）
// 产物落 runtime/hires-compare/，供审核与人工对比。

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var COMFY = 'http://127.0.0.1:8188';
var OUT = path.join(ROOT, 'runtime', 'hires-compare');
fs.mkdirSync(OUT, { recursive: true });

var generation = require(path.join(ROOT, 'routes', 'generation'));
var INPUT = {
  prompt: multi(),
  negative: 'bad quality, worst quality, worst detail, sketch, censor, lowres, jpeg artifacts',
  loras: [{ id: 'L_NENE_V18_WD14', strength: 0.85 }],
  width: 832, height: 1216,
  steps: 28, cfg: 5.5,
  seed: seedArg(),
  sampler: 'DPM++ 2M', scheduler: 'Karras',
  hiresFix: true, hiresScale: 1.5, hiresSteps: 20, denoisingStrength: 0.4
};

function seedArg() { var i = process.argv.indexOf('--seed'); return i > -1 ? Number(process.argv[i + 1]) : 12345; }
function multi() {
  var i = process.argv.indexOf('--prompt');
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  return '1girl, solo, masterpiece, best quality, amazing quality, detailed face, long silver hair, blue eyes, school uniform, upper body, soft lighting, anime style';
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
        resolve({ status: res.statusCode, raw: raw, json: function () { try { return JSON.parse(raw.toString('utf8')); } catch (e) { return null; } } });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function submit(graphLabel, graph) {
  var res = await reqJson('POST', '/prompt', { prompt: graph, client_id: 'compare-hires-superres' });
  var body = res.json();
  if (!body || !body.prompt_id) throw new Error(graphLabel + ' 提交失败: ' + res.raw.toString().slice(0, 300));
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
  throw new Error('等待超时 ' + (maxMs / 1000) + 's');
}

async function download(image, label) {
  var pathname = '/view?filename=' + encodeURIComponent(image.filename) + '&subfolder=' + encodeURIComponent(image.subfolder || '') + '&type=' + encodeURIComponent(image.type || 'output');
  var res = await reqJson('GET', pathname);
  var target = path.join(OUT, label + '.png');
  fs.writeFileSync(target, res.raw);
  return target;
}

async function run() {
  var latent = generation.buildWorkflow(generation.validateInput(Object.assign({}, INPUT, { hiresUpscaler: 'Latent' })));
  var superInput = generation.validateInput(Object.assign({}, INPUT, { hiresUpscaler: 'Remacri' }));
  var superRes = generation.buildWorkflow(Object.assign({}, superInput, { superResModel: '4x_foolhardy_Remacri.safetensors' }));

  console.log('[i] latent hires graph nodes:', Object.keys(latent).length, '| super-res graph nodes:', Object.keys(superRes).length);
  console.log('[i] super-res uses UpscaleModelLoader:', Object.values(superRes).some(function (n) { return n.class_type === 'UpscaleModelLoader'; }));

  console.log('[i] A: latent hires 提交中...');
  var idA = await submit('latent-hires', latent);
  console.log('[i]   prompt_id', idA);
  console.log('[i] B: Remacri super-res 提交中...');
  var idB = await submit('remacri-superres', superRes);
  console.log('[i]   prompt_id', idB);

  var minA = await waitDone(idA, 8 * 60 * 1000);
  var imgA = await download(minA, 'A_latent_2pass');
  console.log('[i] A saved:', imgA);

  var minB = await waitDone(idB, 12 * 60 * 1000);
  var imgB = await download(minB, 'B_remacri_superres');
  console.log('[i] B saved:', imgB);

  console.log('DONE');
}

run().catch(function (e) { console.error('FAIL:', e.message); process.exitCode = 1; });
