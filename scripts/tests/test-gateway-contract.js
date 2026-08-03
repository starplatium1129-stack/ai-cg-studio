'use strict';
const { test } = require('node:test');

test("gateway-contract", () => {
/**
 * scripts/tests/test-gateway-contract.js
 *
 * 路由级安全 / 正确性回归。断言的是真实 HTTP 响应，而不是 helper 的返回值 ——
 * 2026-07-27 审计的教训：test-security.js 断言了 server/security.js 里正确的那份
 * isDirectLocalRequest，而 bug 在 routes/control.js 自己复制的弱版本里，
 * 于是「测通过」和「线上安全」完全脱钩。
 */

var assert = require('assert');
var http = require('http');
var fs = require('fs');
var path = require('path');
var startGateway = require(path.join(__dirname, '..', '..', 'server.js')).startGateway;

var PORT = 3893;
var TOKEN = 'contract-token-0123456789abcdef0123456789ab';
var LOCAL = { Host:'127.0.0.1:' + PORT };
// 隧道请求的形状：socket 来自 127.0.0.1（cloudflared），但带转发头。
var TUNNELED = { Host:'127.0.0.1:' + PORT, 'x-forwarded-for':'9.9.9.9', 'x-token':TOKEN };

function request(options) {
  return new Promise(function (resolve, reject) {
    var req = http.request({
      host:'127.0.0.1',
      port:options.port || PORT,
      method:options.method || 'GET',
      path:options.path,
      headers:options.headers || {}
    }, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        var body = Buffer.concat(chunks).toString('utf8');
        var json = null;
        try { json = JSON.parse(body); } catch (error) {}
        resolve({ status:res.statusCode, headers:res.headers, body:body, json:json });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function postJson(pathname, payload, headers) {
  var body = JSON.stringify(payload);
  return request({
    method:'POST',
    path:pathname,
    headers:Object.assign({ 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body) },
      headers || LOCAL),
    body:body
  });
}

function upgradeRequest(headers) {
  return new Promise(function (resolve) {
    var req = http.request({
      host:'127.0.0.1',
      port:PORT,
      method:'GET',
      path:'/sdapi/v1/progress',
      headers:Object.assign({
        Connection:'Upgrade',
        Upgrade:'websocket',
        'Sec-WebSocket-Version':'13',
        'Sec-WebSocket-Key':'dGhlIHNhbXBsZSBub25jZQ=='
      }, headers || {})
    });
    req.on('upgrade', function (res, socket) { socket.destroy(); resolve({ status:res.statusCode, kind:'upgraded' }); });
    req.on('response', function (res) { res.resume(); resolve({ status:res.statusCode, kind:'response' }); });
    req.on('error', function (error) { resolve({ status:0, kind:'error', message:error.message }); });
    req.end();
  });
}

async function main() {
  var handle = startGateway({
    env:{ PORT:String(PORT), TOKEN:TOKEN, DISABLE_TUNNEL:'1', HOST:'127.0.0.1' }
  });
  await new Promise(function (resolve) { setTimeout(resolve, 700); });

  try {
    // ---- S-1: 隧道请求不得被当成本机 ----
    var tunneledConfig = await postJson('/api/config', { sdHost:'http://127.0.0.1:1234' }, TUNNELED);
    assert.strictEqual(tunneledConfig.status, 403,
      'POST /api/config over tunnel must be 403, got ' + tunneledConfig.status);

    var localOnlyRoutes = ['/api/status', '/api/logs', '/api/diagnostics', '/api/share-link'];
    for (var i = 0; i < localOnlyRoutes.length; i++) {
      var tunneled = await request({ path:localOnlyRoutes[i], headers:TUNNELED });
      assert.strictEqual(tunneled.status, 403,
        localOnlyRoutes[i] + ' over tunnel must be 403, got ' + tunneled.status);
    }

    var localStatus = await request({ path:'/api/status', headers:LOCAL });
    assert.strictEqual(localStatus.status, 200, 'direct-local /api/status must still work');

    // ---- S-3: 上游 host 只接受本机 http ----
    var ssrfHosts = ['http://169.254.169.254', 'http://evil.example.com:7860', 'https://127.0.0.1:7860'];
    for (var h = 0; h < ssrfHosts.length; h++) {
      var rejected = await postJson('/api/config', { sdHost:ssrfHosts[h] });
      assert.strictEqual(rejected.status, 400, ssrfHosts[h] + ' must be rejected with 400');
    }
    var accepted = await postJson('/api/config', { sdHost:'http://127.0.0.1:7860' });
    assert.strictEqual(accepted.status, 200, 'loopback sdHost must be accepted');

    // ---- S-4: 原始 token 不得出现在轮询接口里；Host 白名单生效 ----
    var status = await request({ path:'/api/status', headers:LOCAL });
    assert.ok(status.body.indexOf(TOKEN) === -1, '/api/status must not leak the raw token');
    assert.ok(status.json && status.json.shareLink === undefined,
      '/api/status must not carry shareLink; use /api/share-link');

    var foreignHost = await request({ path:'/api/health', headers:{ Host:'attacker.example.com' } });
    assert.strictEqual(foreignHost.status, 421, 'foreign Host must be refused (DNS rebinding guard)');

    var diagnostics = await request({ path:'/api/diagnostics', headers:LOCAL });
    assert.strictEqual(diagnostics.status, 200);
    assert.ok(diagnostics.body.indexOf(TOKEN) === -1, '/api/diagnostics must redact the token');

    // ---- S-2: 未鉴权 WS upgrade 被拒，且不能弄死进程 ----
    var unauthUpgrade = await upgradeRequest({ Host:'127.0.0.1:' + PORT, 'x-forwarded-for':'9.9.9.9' });
    assert.ok(unauthUpgrade.status === 401 || unauthUpgrade.status === 0,
      'unauthenticated WS upgrade must be refused, got ' + unauthUpgrade.status);

    await new Promise(function (resolve) { setTimeout(resolve, 300); });
    var aliveAfterUpgrade = await request({ path:'/api/health', headers:LOCAL });
    assert.strictEqual(aliveAfterUpgrade.status, 200,
      'gateway must survive an unauthenticated WS upgrade (it used to crash on res.status)');
    assert.strictEqual(aliveAfterUpgrade.json.desktopProtocol, 1,
      'gateway health must expose the desktop compatibility protocol');

    // ---- B-3: 状态码与错误信封 ----
    var missingImage = await request({ path:'/scene-showcase/images/sc999.jpg', headers:LOCAL });
    assert.strictEqual(missingImage.status, 404, 'missing showcase asset must be 404, not 500');
    assert.ok(missingImage.body.indexOf('E:\\') === -1 && missingImage.body.indexOf(':\\') === -1,
      'error bodies must not leak absolute host paths');

    var oversize = await postJson('/api/translate', { text:'x'.repeat(70000) });
    assert.strictEqual(oversize.status, 413, 'oversize body must be 413, not 500');

    var badJson = await request({
      method:'POST',
      path:'/api/translate',
      headers:Object.assign({ 'Content-Type':'application/json' }, LOCAL),
      body:'{not json'
    });
    assert.strictEqual(badJson.status, 400, 'malformed JSON must be 400');

    // ---- B-4: 未知 API 路由必须是 JSON 404，不能是 SPA 外壳 ----
    var unknownApi = await request({ path:'/api/does-not-exist', headers:LOCAL });
    assert.strictEqual(unknownApi.status, 404, 'unknown /api route must be 404, got ' + unknownApi.status);
    assert.ok(String(unknownApi.headers['content-type'] || '').indexOf('json') !== -1,
      'unknown /api route must return JSON, not text/html');

    // 前端路由仍应回 SPA 外壳
    var spaRoute = await request({ path:'/scene-explorer', headers:LOCAL });
    assert.ok(spaRoute.status === 200 || spaRoute.status === 404,
      'SPA route should resolve (200 with dist/, 404 without)');

    // ---- S-5: /sdapi 只放行前端真正调用的端点 ----
    // 之前整段透传 /sdapi + /controlnet + /adetailer，SD API 能换模型、
    // 装了扩展还能碰文件系统。
    var sdBlocked = ['/sdapi/v1/options-anything', '/controlnet/model_list', '/adetailer/v1/version'];
    for (var b = 0; b < sdBlocked.length; b++) {
      var denied = await request({ path:sdBlocked[b], headers:LOCAL });
      assert.strictEqual(denied.status, 404, sdBlocked[b] + ' must not be proxied, got ' + denied.status);
      assert.ok(String(denied.headers['content-type'] || '').indexOf('json') !== -1,
        sdBlocked[b] + ' must return JSON 404, not the SPA shell');
    }

    // ---- B-6: 错误信封只有一种形状 ----
    // 曾经有四种同时存在（{error} / {ok:false,msg} / {ok:false,error} / {error,detail}），
    // 于是前端到处写 `data.error || data.msg || '操作失败'` —— 少写一个候选就退化成无信息文案。
    var errorCases = [
      { name:'unknown api 404', res:await request({ path:'/api/does-not-exist', headers:LOCAL }) },
      { name:'blocked sdapi 404', res:await request({ path:'/sdapi/v1/nope', headers:LOCAL }) },
      { name:'bad chat body 400', res:await postJson('/api/chat', { messages:[] }) },
      { name:'bad translate body 400', res:await postJson('/api/translate', { text:'' }) },
      { name:'bad voice 400', res:await postJson('/api/voice/prepare', { voice:'nobody' }) },
      { name:'bad tts 400', res:await postJson('/api/tts', { voice:'nobody', text:'x' }) },
      { name:'ssrf host 400', res:await postJson('/api/config', { sdHost:'http://evil.example.com' }) },
      { name:'unknown maintenance task 400', res:await postJson('/api/maintenance/run', { task:'nope' }) },
      { name:'tunneled localOnly 403', res:await request({ path:'/api/logs', headers:TUNNELED }) },
      { name:'oversize body 413', res:await postJson('/api/translate', { text:'x'.repeat(70000) }) }
    ];
    for (var e = 0; e < errorCases.length; e++) {
      var envelopeCase = errorCases[e];
      var body = envelopeCase.res.json;
      assert.ok(body, envelopeCase.name + ' must return a JSON body');
      assert.strictEqual(body.ok, false, envelopeCase.name + ' must carry ok:false');
      assert.strictEqual(typeof body.error, 'string',
        envelopeCase.name + ' must carry a string error');
      assert.ok(body.error.length > 0, envelopeCase.name + ' error must not be empty');
    }

    // 成功信封同样固定：ok:true
    var okConfig = await postJson('/api/config', { sdHost:'http://127.0.0.1:7860' });
    assert.strictEqual(okConfig.json && okConfig.json.ok, true, 'success envelope must carry ok:true');

    // /api/status 探测失败必须回 200 + ok:false，与三个同族 *-status 一致。
    // 回 500 时前端的 `if (!r.ok) return` 会把状态墙冻在上一次的值上。
    var statusSiblings = ['/api/status', '/api/sd-status', '/api/tts-status', '/api/chat-status'];
    for (var s = 0; s < statusSiblings.length; s++) {
      var probe = await request({ path:statusSiblings[s], headers:LOCAL });
      assert.strictEqual(probe.status, 200,
        statusSiblings[s] + ' must report degraded state as 200, got ' + probe.status);
      assert.ok(probe.json, statusSiblings[s] + ' must return JSON');
    }

    // ---- S-5: GPU 路由限流（token bucket）----
    // 队列的 maxPending 只挡"堆积"，挡不住"持续以队列消化速度提交" ——
    // 那会把 GPU 永久占满，而本机用户只看到"一直在排队"。
    // 断言路由的真实响应：隧道形状会拿到 429 + Retry-After，本机直连不受限。
    // 并发突发请求才能测 token bucket。顺序请求会在每次 SD 代理失败的间隙里
    // 慢慢补回令牌，最后测到的是"请求足够慢就不该限"而不是限流本身。
    var burst = await Promise.all(Array.from({ length:24 }, function () {
      return postJson('/sdapi/v1/txt2img', { prompt:'probe' }, TUNNELED);
    }));
    var throttled = burst.find(function (shot) { return shot.status === 429; }) || null;
    var allowedBeforeLimit = burst.filter(function (shot) { return shot.status !== 429; }).length;
    assert.ok(throttled, 'tunneled txt2img must eventually hit the rate limit');
    // 断言具体位置而不只是"最终会挡"：桶容量是 server.js 里的 capacity:12，
    // 留一格余量给补充速率。放行数量若漂到区间外，说明桶被改过而测试没跟上。
    assert.ok(allowedBeforeLimit >= 8 && allowedBeforeLimit <= 13,
      'txt2img bucket should admit ~12 before throttling, admitted ' + allowedBeforeLimit);
    assert.ok(Number(throttled.headers['retry-after']) > 0,
      'rate-limited response must carry Retry-After, got ' + throttled.headers['retry-after']);
    assert.ok(throttled.json && Number(throttled.json.retryAfterSeconds) > 0,
      'rate-limited body must state the retry delay');

    // 本机直连是电脑主人，不该被自己的限流挡住。
    // SD 未启动时代理回 502，这里只断言"不是 429"。
    for (var lg = 0; lg < 8; lg++) {
      var localShot = await postJson('/sdapi/v1/txt2img', { prompt:'probe' }, LOCAL);
      assert.notStrictEqual(localShot.status, 429,
        'direct-local requests must never be rate limited (attempt ' + (lg + 1) + ')');
    }

    // 廉价读端点不该共用出图的桶
    var cheapRead = await request({ path:'/sdapi/v1/samplers', headers:TUNNELED });
    assert.notStrictEqual(cheapRead.status, 429,
      'cheap SD reads must not share the txt2img bucket');

    // ---- P-10: data/ 只暴露 SPA 真正读取的文件 ----
    var privateData = [
      'scenes/nene-core.json',   // build-scenes.js 的输入，客户端从不读
      'history.json', 'projects.json', 'prompts.json',
      'official-cg-candidates.json', 'retired-scenes.json'
    ];
    for (var d = 0; d < privateData.length; d++) {
      var hidden = await request({ path:'/data/' + privateData[d], headers:LOCAL });
      assert.strictEqual(hidden.status, 404, '/data/' + privateData[d] + ' must not be public');
    }
    var publicData = [
      'scenes.json', 'scenes-index.json', 'scenes-core.json',
      'scenes-nene.json', 'scenes-natsume.json', 'scenes-shared.json',
      'curation.json', 'characters.json', 'loras.json', 'tags.json', 'presets.json'
    ];
    for (var pd = 0; pd < publicData.length; pd++) {
      var served = await request({ path:'/data/' + publicData[pd], headers:LOCAL });
      assert.strictEqual(served.status, 200, '/data/' + publicData[pd] + ' must stay served');
    }

    // ---- P-3: 带 hash 的产物永久缓存，SPA 外壳不缓存 ----
    var distApp = path.join(__dirname, '..', '..', 'dist', '_app');
    if (fs.existsSync(distApp)) {
      var hashed = fs.readdirSync(distApp).filter(function (f) { return /-[\w-]{8,}\.js$/.test(f); })[0];
      if (hashed) {
        var assetRes = await request({ path:'/_app/' + hashed, headers:LOCAL });
        var cc = String(assetRes.headers['cache-control'] || '');
        assert.ok(cc.indexOf('immutable') !== -1 && cc.indexOf('max-age=31536000') !== -1,
          'content-hashed assets must be immutable, got ' + cc);
      }
      var shellRes = await request({ path:'/', headers:LOCAL });
      assert.ok(String(shellRes.headers['cache-control'] || '').indexOf('no-cache') !== -1,
        'SPA shell must stay no-cache');
    }

    // ---- D-2: docs 能取到唯一那份设计系统，但 src/ 其余部分不外泄 ----
    var designSystem = await request({ path:'/src/assets/css/design-system.css', headers:LOCAL });
    assert.strictEqual(designSystem.status, 200, 'docs pages need the canonical design system');
    var srcLeak = await request({ path:'/src/main.ts', headers:LOCAL });
    assert.strictEqual(srcLeak.status, 404, 'only design-system.css may be exposed from src/');

    // ---- P-7: 预压产物优先（brotli > gzip > 原文）----
    // 只有跑过 npm run precompress 才有 .br；没有就跳过而不是失败。
    if (fs.existsSync(path.join(__dirname, '..', '..', 'data', 'scenes.json.br'))) {
      var brotli = await request({ path:'/data/scenes.json', headers:Object.assign({ 'Accept-Encoding':'br' }, LOCAL) });
      assert.strictEqual(brotli.headers['content-encoding'], 'br', 'brotli must win when accepted');
      assert.ok(String(brotli.headers['content-type'] || '').indexOf('json') !== -1,
        'precompressed response must keep the original content type');
      assert.ok(String(brotli.headers.vary || '').indexOf('Accept-Encoding') !== -1,
        'precompressed response must Vary on Accept-Encoding');

      var gzipped = await request({ path:'/data/scenes.json', headers:Object.assign({ 'Accept-Encoding':'gzip' }, LOCAL) });
      assert.strictEqual(gzipped.headers['content-encoding'], 'gzip', 'gzip must be the fallback');
      assert.ok(brotli.body.length < gzipped.body.length, 'brotli must be smaller than gzip');

      var identity = await request({ path:'/data/scenes.json', headers:Object.assign({ 'Accept-Encoding':'identity' }, LOCAL) });
      assert.strictEqual(identity.status, 200, 'clients without br/gzip must still get the file');
      assert.ok(!identity.headers['content-encoding'], 'identity response must not claim an encoding');

      // 预压查找不得成为目录穿越入口
      var traversal = await request({ path:'/data/../server.js', headers:Object.assign({ 'Accept-Encoding':'br' }, LOCAL) });
      assert.notStrictEqual(traversal.status, 200, 'precompressed lookup must not escape the data allowlist');
    }

    // ---- 桌面打包模式（AICS_DESKTOP_PACKAGED=1）：内容维护链路必须 501 ----
    var DESKTOP_PORT = 3894;
    var desktopHandle = startGateway({
      env:{ PORT:String(DESKTOP_PORT), TOKEN:TOKEN, DISABLE_TUNNEL:'1', HOST:'127.0.0.1', AICS_DESKTOP_PACKAGED:'1' }
    });
    await new Promise(function (resolve) { setTimeout(resolve, 700); });
    var desktopLocal = { Host:'127.0.0.1:' + DESKTOP_PORT };
    var scenesPost = await request({
      port:DESKTOP_PORT, method:'POST', path:'/api/maintenance/scenes',
      headers:Object.assign({ 'Content-Type':'application/json', 'Content-Length':2 }, desktopLocal),
      body:'{}'
    });
    assert.strictEqual(scenesPost.status, 501, 'desktop packaged mode must refuse scene saves with 501');
    var toolRun = await request({
      port:DESKTOP_PORT, method:'POST', path:'/api/maintenance/run',
      headers:Object.assign({ 'Content-Type':'application/json', 'Content-Length':2 }, desktopLocal),
      body:'{}'
    });
    assert.strictEqual(toolRun.status, 501, 'desktop packaged mode must refuse maintenance tasks with 501');
    var buildWeb = await request({ port:DESKTOP_PORT, method:'POST', path:'/api/maintenance/build-web', headers:desktopLocal });
    assert.strictEqual(buildWeb.status, 501, 'desktop packaged mode must refuse build-web with 501');
    desktopHandle.shutdown();

    console.log('Gateway contract tests passed: tunnel localOnly, host validation, ' +
      'rebinding guard, WS upgrade auth, error envelopes, api 404, sdapi allowlist, ' +
      'data allowlist, immutable assets, precompressed serving, desktop mode 501');
  } finally {
    handle.shutdown();
  }
  setTimeout(function () { process.exit(0); }, 300);
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});

});
