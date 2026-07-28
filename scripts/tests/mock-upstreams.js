'use strict';
/**
 * scripts/tests/mock-upstreams.js
 *
 * 四个上游服务的可编程假实现：SD WebUI、Ollama、GPT-SoVITS、中日翻译。
 *
 * 为什么是「真 HTTP 服务器」而不是浏览器层 route mock：
 * 六条主流程里有五条会穿过网关代码（/sdapi 代理白名单、/api/chat 的 NDJSON
 * 中继、/api/tts 的音频背压中继、/api/translate 的常驻服务探测、
 * /api/tts-status 的声线判定）。在浏览器里拦 fetch 会把这些服务端逻辑整段
 * 跳过 —— 那样测出来的"流程通过"和真机行为脱钩，正是 2026-07-27 审计
 * 记录的那类假绿灯。
 *
 * 每个 mock 都记录收到的请求，并可通过 /__mock/* 注入故障，供 E2E 断言。
 */

var http = require('http');

/** 44 字节 WAV 头 + 一小段静音采样。useVoice 会拒收 < 64 字节的响应。 */
function silentWav(sampleCount) {
  var samples = Math.max(64, Number(sampleCount) || 512);
  var dataBytes = samples * 2;
  var buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);   // PCM
  buffer.writeUInt16LE(1, 22);   // mono
  buffer.writeUInt32LE(32000, 24);
  buffer.writeUInt32LE(64000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  // 一点极低振幅的波形，避免播放器把纯零当损坏文件
  for (var i = 0; i < samples; i += 1) {
    buffer.writeInt16LE(Math.round(Math.sin(i / 12) * 24), 44 + i * 2);
  }
  return buffer;
}

/** 1×1 PNG。前端只把它转成 blob URL 塞进 <img>，内容无关紧要。 */
var PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
  'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function readBody(req, limitBytes) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > (limitBytes || 8 * 1024 * 1024)) {
        reject(new Error('mock upstream body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  var raw = await readBody(req);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); } catch (error) { return {}; }
}

function sendJson(res, status, payload) {
  var body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(body)
  });
  res.end(body);
}

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, Number(ms) || 0)); });
}

/**
 * 每个 mock 共享的可编程外壳。
 *
 * `state.faults` 由 E2E 通过 POST /__mock/fault 设置，用于驱动错误恢复路径
 * （显存不足、上游 502、超时……）；`state.calls` 记录请求，供断言"网关到底
 * 转发了什么"，而不是只断言 UI 文案。
 */
function createMockServer(name, handler) {
  var state = {
    name:name,
    calls:[],
    faults:{},
    latency:0
  };

  function record(req, body) {
    state.calls.push({
      at:Date.now(),
      method:req.method,
      path:String(req.url || '').split('?')[0],
      query:String(req.url || '').split('?')[1] || '',
      body:body
    });
    if (state.calls.length > 200) state.calls.shift();
  }

  var server = http.createServer(function (req, res) {
    var pathname = String(req.url || '/').split('?')[0];

    // ---- 控制面：清空记录 / 注入故障 / 读回记录 ----
    if (pathname === '/__mock/state' && req.method === 'GET') {
      return sendJson(res, 200, { name:name, calls:state.calls, faults:state.faults });
    }
    if (pathname === '/__mock/reset' && req.method === 'POST') {
      state.calls = [];
      state.faults = {};
      state.latency = 0;
      return sendJson(res, 200, { ok:true });
    }
    if (pathname === '/__mock/fault' && req.method === 'POST') {
      return readJsonBody(req).then(function (body) {
        state.faults = body && typeof body === 'object' ? body : {};
        if (Object.prototype.hasOwnProperty.call(state.faults, 'latency')) {
          state.latency = Number(state.faults.latency) || 0;
        }
        sendJson(res, 200, { ok:true, faults:state.faults });
      });
    }

    Promise.resolve()
      .then(function () {
        var needsBody = req.method === 'POST' || req.method === 'PUT';
        return needsBody ? readJsonBody(req) : null;
      })
      .then(async function (body) {
        record(req, body);
        if (state.latency) await delay(state.latency);
        return handler({ req:req, res:res, path:pathname, body:body, state:state });
      })
      .catch(function (error) {
        if (res.headersSent) { res.end(); return; }
        sendJson(res, 500, { error:'mock ' + name + ' failed: ' + error.message });
      });
  });

  return { server:server, state:state };
}

// ── SD WebUI ────────────────────────────────────────────────────────────────
function createSdMock() {
  return createMockServer('sd', async function (ctx) {
    var res = ctx.res;
    var faults = ctx.state.faults;

    if (ctx.path === '/sdapi/v1/sd-models') {
      if (faults.offline) { res.writeHead(503); res.end(); return; }
      return sendJson(res, 200, [
        { title:'waiNSFWIllustrious_v140.safetensors [abc123]', model_name:'waiNSFWIllustrious_v140' },
        { title:'animagineXL_v31.safetensors [def456]', model_name:'animagineXL_v31' }
      ]);
    }
    if (ctx.path === '/sdapi/v1/samplers') {
      return sendJson(res, 200, [{ name:'DPM++ 2M' }, { name:'Euler a' }, { name:'DPM++ SDE' }]);
    }
    if (ctx.path === '/sdapi/v1/schedulers') {
      return sendJson(res, 200, [{ name:'Karras', label:'Karras' }, { name:'Exponential', label:'Exponential' }]);
    }
    if (ctx.path === '/sdapi/v1/upscalers') {
      return sendJson(res, 200, [{ name:'R-ESRGAN 4x+ Anime6B' }, { name:'Latent' }]);
    }
    if (ctx.path === '/sdapi/v1/options') {
      return sendJson(res, 200, { sd_model_checkpoint:'waiNSFWIllustrious_v140.safetensors [abc123]' });
    }
    if (ctx.path === '/sdapi/v1/progress') {
      return sendJson(res, 200, { progress:0.42, state:{ job_count:1 }, current_image:null });
    }
    if (ctx.path === '/sdapi/v1/interrupt') {
      return sendJson(res, 200, {});
    }
    if (ctx.path === '/sdapi/v1/txt2img') {
      // 只慢 txt2img：进度轮询需要时间触发；出图瞬时返回的话请求永远测不到。
      // 一次都不会触发，"生成期间确实在轮询"就永远测不到。全局 latency 会把
      // 页面加载时的状态探测一起拖慢，所以单独一个开关。
      if (faults.renderMs) await delay(faults.renderMs);
      if (faults.oom) {
        return sendJson(res, 500, {
          error:'OutOfMemoryError',
          detail:'CUDA out of memory. Tried to allocate 2.44 GiB'
        });
      }
      if (faults.txt2imgStatus) {
        return sendJson(res, Number(faults.txt2imgStatus), { error:String(faults.txt2imgError || 'mock failure') });
      }
      var seed = Number(ctx.body && ctx.body.seed);
      var resolved = Number.isFinite(seed) && seed >= 0 ? seed : 918273645;
      return sendJson(res, 200, {
        images:[PNG_1X1],
        parameters:ctx.body || {},
        info:JSON.stringify({ seed:resolved, all_seeds:[resolved], sampler_name:ctx.body && ctx.body.sampler_name })
      });
    }
    res.writeHead(404, { 'Content-Type':'application/json' });
    res.end(JSON.stringify({ error:'mock SD has no ' + ctx.path }));
  });
}

// ── Ollama ──────────────────────────────────────────────────────────────────
function createOllamaMock() {
  return createMockServer('ollama', async function (ctx) {
    var res = ctx.res;
    var faults = ctx.state.faults;

    if (ctx.path === '/api/tags') {
      if (faults.offline) { res.writeHead(503); res.end(); return; }
      return sendJson(res, 200, {
        models:[
          { name:'qwen3:8b', model:'qwen3:8b', size:5_200_000_000, capabilities:['completion'],
            details:{ parameter_size:'8B', quantization_level:'Q4_K_M' } },
          { name:'gemma3:4b', model:'gemma3:4b', size:3_100_000_000, capabilities:['completion'],
            details:{ parameter_size:'4B', quantization_level:'Q4_0' } }
        ]
      });
    }
    if (ctx.path === '/api/ps') {
      return sendJson(res, 200, { models:[{ name:'qwen3:8b', size_vram:5_200_000_000 }] });
    }
    if (ctx.path === '/api/generate') {
      return sendJson(res, 200, { done:true });
    }
    if (ctx.path === '/api/chat') {
      if (faults.chatStatus) {
        return sendJson(res, Number(faults.chatStatus), { error:String(faults.chatError || 'mock chat failure') });
      }
      // 逐句流式返回，让配音管线（SentenceBuffer）真的被触发
      var reply = String(faults.reply ||
        '今天也辛苦了。要不要先休息一下？如果你愿意，我可以陪你安静待一会儿。');
      res.writeHead(200, {
        'Content-Type':'application/x-ndjson; charset=utf-8',
        'Cache-Control':'no-store'
      });
      var chars = Array.from(reply);
      for (var i = 0; i < chars.length; i += 3) {
        res.write(JSON.stringify({
          model:(ctx.body && ctx.body.model) || 'qwen3:8b',
          message:{ role:'assistant', content:chars.slice(i, i + 3).join('') },
          done:false
        }) + '\n');
        await delay(4);
      }
      res.write(JSON.stringify({ done:true, done_reason:'stop' }) + '\n');
      res.end();
      return;
    }
    res.writeHead(404, { 'Content-Type':'application/json' });
    res.end(JSON.stringify({ error:'mock Ollama has no ' + ctx.path }));
  });
}

// ── GPT-SoVITS ──────────────────────────────────────────────────────────────
function createTtsMock() {
  return createMockServer('tts', async function (ctx) {
    var res = ctx.res;
    var faults = ctx.state.faults;

    if (ctx.path === '/docs' || ctx.path === '/') {
      if (faults.offline) { res.destroy(); return; }
      res.writeHead(200, { 'Content-Type':'text/html' });
      res.end('<html><body>mock GPT-SoVITS</body></html>');
      return;
    }
    if (ctx.path === '/set_gpt_weights' || ctx.path === '/set_sovits_weights') {
      return sendJson(res, 200, { ok:true });
    }
    if (ctx.path === '/tts') {
      if (faults.ttsStatus) {
        return sendJson(res, Number(faults.ttsStatus), { error:String(faults.ttsError || 'mock tts failure') });
      }
      if (faults.emptyAudio) {
        res.writeHead(200, { 'Content-Type':'audio/wav' });
        res.end();
        return;
      }
      var wav = silentWav(1024);
      res.writeHead(200, { 'Content-Type':'audio/wav', 'Content-Length':wav.length });
      res.end(wav);
      return;
    }
    res.writeHead(404, { 'Content-Type':'application/json' });
    res.end(JSON.stringify({ error:'mock TTS has no ' + ctx.path }));
  });
}

// ── 中日翻译常驻服务 ─────────────────────────────────────────────────────────
function createTranslateMock() {
  return createMockServer('translate', async function (ctx) {
    var res = ctx.res;
    var faults = ctx.state.faults;

    if (ctx.path === '/health') {
      if (faults.offline) { res.destroy(); return; }
      return sendJson(res, 200, { ok:true });
    }
    if (ctx.path === '/translate') {
      if (faults.translateStatus) {
        return sendJson(res, Number(faults.translateStatus), { error:'mock translate failure' });
      }
      var text = String((ctx.body && ctx.body.text) || '');
      // 固定前缀 + 原文长度，方便断言"译文真的来自上游"而不是前端兜底
      return sendJson(res, 200, {
        translation:'[JA] ' + text,
        segments:[{ source:text, target:'[JA] ' + text }]
      });
    }
    res.writeHead(404, { 'Content-Type':'application/json' });
    res.end(JSON.stringify({ error:'mock translate has no ' + ctx.path }));
  });
}

function listen(server, port, host) {
  return new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(port, host || '127.0.0.1', function () { resolve(server.address()); });
  });
}

module.exports = {
  createSdMock:createSdMock,
  createOllamaMock:createOllamaMock,
  createTtsMock:createTtsMock,
  createTranslateMock:createTranslateMock,
  createMockServer:createMockServer,
  silentWav:silentWav,
  listen:listen,
  PNG_1X1:PNG_1X1
};
