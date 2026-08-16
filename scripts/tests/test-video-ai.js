'use strict';

/**
 * scripts/tests/test-video-ai.js — 分镜「AI 整理」端点回归
 *
 * 覆盖：
 *   1. 无 LLM 源（API 未托管 + Ollama 不可达）→ status unavailable / rewrite 409
 *   2. API 源（chat_api_config.json 托管，自建 OpenAI 兼容 mock）：
 *      状态探测、请求体（Bearer/stream:false/提示词结构）、JSON 清洗、
 *      markdown 围栏提取、非法枚举回退、非 JSON 回退、输入白名单 400
 *   3. Ollama 源（mock /api/tags + /api/chat NDJSON）：状态探测 + 改写
 */

var assert = require('assert/strict');
var fs = require('fs');
var http = require('http');
var path = require('path');
var gatewayStack = require('./gateway-test-stack');

var DEAD_OLLAMA_URL = 'http://127.0.0.1:9';

// 自建 OpenAI 兼容 mock：记录请求、按队列逐次返回预设 content。
function createApiMock() {
  var state = { requests:[], replies:[] };
  var server = http.createServer(function (req, res) {
    var chunks = [];
    req.on('data', function (chunk) { chunks.push(chunk); });
    req.on('end', function () {
      var body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (error) { /* 保持空 */ }
      state.requests.push({ method:req.method, url:req.url, headers:req.headers, body:body });
      var reply = state.replies.length ? state.replies.shift() : DEFAULT_REPLY;
      res.writeHead(200, { 'Content-Type':'application/json' });
      res.end(JSON.stringify({ choices:[{ message:{ role:'assistant', content:reply } }] }));
    });
  });
  return { server:server, state:state };
}

var DEFAULT_REPLY = JSON.stringify({
  prompt:'She turns toward the counter.',
  shotSize:'medium',
  camera:'still',
  motion:'natural',
  dialogue:''
});

function listen(server) {
  return new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', function () { resolve(server.address().port); });
  });
}

function closeServer(server) {
  return new Promise(function (resolve) {
    if (!server || !server.listening) return resolve();
    server.close(function () { resolve(); });
  });
}

async function postRewrite(base, body) {
  return fetch(base + '/api/video-ai/rewrite', {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body:JSON.stringify(body)
  });
}

async function run() {
  // ── 1. 无 LLM 源：Ollama 不可达 + 未托管 API ──────────────────────────
  var stackNone = await gatewayStack.start({
    prefix:'video-ai-none-',
    configureConfig:function (config) { config.OLLAMA_HOST = DEAD_OLLAMA_URL; }
  });
  try {
    var statusNone = await (await fetch(stackNone.baseUrl + '/api/video-ai/status')).json();
    assert.equal(statusNone.available, false, 'no source -> unavailable');
    assert.match(statusNone.reason || '', /API|Ollama/, 'unavailable reason must point at the missing source');

    var rewriteNone = await postRewrite(stackNone.baseUrl, { prompt:'雨夜，她走进便利店。' });
    assert.equal(rewriteNone.status, 409, 'rewrite without a source must be 409');
  } finally {
    await stackNone.close();
  }

  // ── 2. API 源：host-config 托管 + OpenAI 兼容 mock ────────────────────
  var apiMock = createApiMock();
  var apiPort = await listen(apiMock.server);
  var stackApi = await gatewayStack.start({
    prefix:'video-ai-api-',
    prepare:async function (ctx) {
      fs.writeFileSync(path.join(ctx.runtime.state, 'chat_api_config.json'), JSON.stringify({
        baseUrl:'http://127.0.0.1:' + apiPort,
        pathname:'/v1/chat/completions',
        model:'mock-rewrite',
        apiKey:'sk-test-key'
      }, null, 2), { mode:0o600 });
    }
  });
  try {
    var statusApi = await (await fetch(stackApi.baseUrl + '/api/video-ai/status')).json();
    assert.equal(statusApi.available, true);
    assert.equal(statusApi.source, 'api', 'host-config must take priority over the online Ollama mock');
    assert.equal(statusApi.model, 'mock-rewrite');
    assert.match(statusApi.label, /API/);

    // 合法 JSON：字段全部应用
    var okRes = await postRewrite(stackApi.baseUrl, {
      identity:'a girl with silver hair',
      prompt:'车站前，少女回头微笑，黄昏逆光。',
      shotSize:'medium',
      camera:'still',
      motion:'subtle'
    });
    assert.equal(okRes.status, 200);
    var ok = await okRes.json();
    assert.equal(ok.shot.prompt, 'She turns toward the counter.');
    assert.equal(ok.shot.shotSize, 'medium');
    assert.equal(ok.shot.camera, 'still');
    assert.equal(ok.shot.motion, 'natural');
    assert.equal(ok.shot.dialogue, '');

    // 请求体断言：Bearer、非流式、提示词结构（system 规则 + user 输入）
    var req = apiMock.state.requests[0];
    assert.equal(req.headers.authorization, 'Bearer sk-test-key');
    assert.equal(req.body.stream, false);
    assert.equal(req.body.model, 'mock-rewrite');
    assert.match(req.body.messages[0].content, /storyboard/);
    assert.match(req.body.messages[1].content, /a girl with silver hair/);
    assert.match(req.body.messages[1].content, /车站前/);
    assert.equal(req.body.messages.length, 2, 'no tool/web_search noise for the rewrite call');

    // markdown 围栏 + 非法枚举：非法值回退输入原值，非法景别回退 null
    apiMock.state.replies.push('```json\n{"prompt":"She walks away.","shotSize":"bogus","camera":"fly","motion":"dance","dialogue":"走吧。"}\n```');
    var fenceRes = await postRewrite(stackApi.baseUrl, {
      prompt:'她转身离开。', shotSize:null, camera:'push', motion:'subtle'
    });
    assert.equal(fenceRes.status, 200);
    var fence = await fenceRes.json();
    assert.equal(fence.shot.prompt, 'She walks away.', 'markdown fences must be stripped');
    assert.equal(fence.shot.shotSize, null, 'unknown shot size falls back to null (safe)');
    assert.equal(fence.shot.camera, 'push', 'unknown camera falls back to the input value');
    assert.equal(fence.shot.motion, 'subtle', 'unknown motion falls back to the input value');
    assert.equal(fence.shot.dialogue, '走吧。');

    // 非 JSON 回复：prompt 回退原描述，其余保持输入
    apiMock.state.replies.push('sorry, I cannot help with that request');
    var gibberishRes = await postRewrite(stackApi.baseUrl, {
      prompt:'原始描述', camera:'still', motion:'subtle'
    });
    assert.equal(gibberishRes.status, 200);
    var gibberish = await gibberishRes.json();
    assert.equal(gibberish.shot.prompt, '原始描述', 'unparseable output must keep the original prompt');
    assert.equal(gibberish.shot.camera, 'still');
    assert.equal(gibberish.shot.motion, 'subtle');
    assert.equal(gibberish.shot.shotSize, null);

    // 输入白名单：空 prompt / 非法枚举 / 未知字段一律 400
    assert.equal((await postRewrite(stackApi.baseUrl, { prompt:'   ' })).status, 400);
    assert.equal((await postRewrite(stackApi.baseUrl, { prompt:'x', camera:'fly' })).status, 400);
    assert.equal((await postRewrite(stackApi.baseUrl, { prompt:'x', unknown:1 })).status, 400);
    assert.equal((await postRewrite(stackApi.baseUrl, { prompt:'x'.repeat(4001) })).status, 400);
  } finally {
    await stackApi.close();
    await closeServer(apiMock.server);
  }

  // ── 3. Ollama 源：mock /api/tags + /api/chat NDJSON 流 ────────────────
  var stackOllama = await gatewayStack.start({ prefix:'video-ai-ollama-' });
  try {
    var statusOllama = await (await fetch(stackOllama.baseUrl + '/api/video-ai/status')).json();
    assert.equal(statusOllama.available, true);
    assert.equal(statusOllama.source, 'ollama');
    assert.equal(statusOllama.model, 'qwen3:8b', 'preferred model must come from the Ollama model list');

    // 注入 NDJSON 回复（每 3 字符一帧，验证流式累积 + JSON 提取）
    await fetch(stackOllama.upstreams.ollama.url + '/__mock/fault', {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ reply:'{"prompt":"She steps into the rain.","shotSize":"wide","camera":"pan","motion":"natural","dialogue":"下雨了。"}' })
    });
    var ollamaOkRes = await postRewrite(stackOllama.baseUrl, { prompt:'雨夜，她走进便利店。' });
    assert.equal(ollamaOkRes.status, 200);
    var ollamaOk = await ollamaOkRes.json();
    assert.equal(ollamaOk.source, 'ollama');
    assert.equal(ollamaOk.shot.prompt, 'She steps into the rain.');
    assert.equal(ollamaOk.shot.shotSize, 'wide');
    assert.equal(ollamaOk.shot.camera, 'pan');
    assert.equal(ollamaOk.shot.motion, 'natural');
    assert.equal(ollamaOk.shot.dialogue, '下雨了。');

    // 上游失败 → 502 统一错误信封（不把上游错误裸透给前端）
    await fetch(stackOllama.upstreams.ollama.url + '/__mock/fault', {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ chatStatus:503, chatError:'mock ollama overloaded' })
    });
    var failRes = await postRewrite(stackOllama.baseUrl, { prompt:'测试失败路径。' });
    assert.equal(failRes.status, 502);
    var failBody = await failRes.json();
    assert.equal(failBody.ok, false, 'upstream failure must use the unified error envelope');
  } finally {
    await stackOllama.close();
  }
}

if (require.main === module) {
  run().then(function () {
    console.log('test-video-ai: ok');
  }).catch(function (error) {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { run:run };
