'use strict';

var assert = require('assert');
var security = require('../../server/security');
var diagnostics = require('../../server/diagnostics');
var maintenance = require('../../routes/maintenance');

function mockReq(overrides) {
  return Object.assign({
    socket:{ remoteAddress:'127.0.0.1' },
    headers:{},
    query:{},
    path:'/',
    originalUrl:'/',
    secure:false
  }, overrides || {});
}

function mockRes() {
  var res = {
    statusCode:200,
    headers:{},
    body:null,
    redirected:null,
    status:function (code) { this.statusCode = code; return this; },
    json:function (body) { this.body = body; return this; },
    send:function (body) { this.body = body; return this; },
    setHeader:function (key, value) { this.headers[key] = value; },
    redirect:function (code, url) { this.statusCode = code; this.redirected = url; }
  };
  return res;
}

function runMiddleware(mw, req) {
  return new Promise(function (resolve) {
    var res = mockRes();
    var nextCalled = false;
    mw(req, res, function () { nextCalled = true; resolve({ res:res, nextCalled:nextCalled }); });
    // If middleware ends the response without next, settle shortly.
    setTimeout(function () {
      if (!nextCalled) resolve({ res:res, nextCalled:nextCalled });
    }, 0);
  });
}

async function main() {
  assert.strictEqual(security.tokenMatches('abc12345', 'abc12345'), true);
  assert.strictEqual(security.tokenMatches('abc12345', 'abc1234x'), false);
  assert.strictEqual(security.tokenMatches('abc12345', 'short'), false);
  assert.strictEqual(security.tokenMatches('abc12345', null), false);

  assert.strictEqual(security.isDirectLocalRequest(mockReq()), true);
  assert.strictEqual(security.isDirectLocalRequest(mockReq({
    socket:{ remoteAddress:'::1' }
  })), true);
  assert.strictEqual(security.isDirectLocalRequest(mockReq({
    headers:{ 'x-forwarded-for':'1.2.3.4' }
  })), false);
  assert.strictEqual(security.isDirectLocalRequest(mockReq({
    socket:{ remoteAddress:'8.8.8.8' }
  })), false);

  var auth = security.tokenAuth('secret-token-value-32chars-aaaaaa');
  var local = await runMiddleware(auth, mockReq({ path:'/api/health' }));
  assert.strictEqual(local.nextCalled, true, 'local loopback must bypass token');

  var denied = await runMiddleware(auth, mockReq({
    socket:{ remoteAddress:'8.8.8.8' },
    path:'/api/health',
    originalUrl:'/api/health'
  }));
  assert.strictEqual(denied.nextCalled, false);
  assert.strictEqual(denied.res.statusCode, 401);

  var allowed = await runMiddleware(auth, mockReq({
    socket:{ remoteAddress:'8.8.8.8' },
    path:'/api/health',
    headers:{ 'x-token':'secret-token-value-32chars-aaaaaa' }
  }));
  assert.strictEqual(allowed.nextCalled, true);

  // maintenanceLocalOnly: remote must 403
  var localOnly = maintenance._test.maintenanceLocalOnly;
  var remoteBackup = await runMiddleware(localOnly, mockReq({
    socket:{ remoteAddress:'8.8.8.8' },
    path:'/api/backup'
  }));
  assert.strictEqual(remoteBackup.nextCalled, false);
  assert.strictEqual(remoteBackup.res.statusCode, 403);

  var localBackup = await runMiddleware(localOnly, mockReq({ path:'/api/backup' }));
  assert.strictEqual(localBackup.nextCalled, true);

  // safeLocalUrl: 上游 host 只允许本机 http
  assert.strictEqual(security.safeLocalUrl('http://127.0.0.1:7860'), 'http://127.0.0.1:7860');
  assert.strictEqual(security.safeLocalUrl('http://localhost:9880/'), 'http://localhost:9880');
  assert.strictEqual(security.safeLocalUrl('http://169.254.169.254'), '', 'metadata host must be rejected');
  assert.strictEqual(security.safeLocalUrl('http://evil.example.com'), '', 'remote host must be rejected');
  assert.strictEqual(security.safeLocalUrl('https://127.0.0.1:7860'), '', 'non-http must be rejected');
  assert.strictEqual(security.safeLocalUrl('http://u:p@127.0.0.1:7860'), '', 'credentials must be rejected');
  assert.strictEqual(security.safeLocalUrl(''), '');
  assert.strictEqual(security.safeLocalUrl('not a url'), '');

  // hostAllowed: 阻断 DNS rebinding
  assert.strictEqual(security.hostAllowed('127.0.0.1:3000', 3000, ''), true);
  assert.strictEqual(security.hostAllowed('localhost:3000', 3000, ''), true);
  assert.strictEqual(security.hostAllowed('127.0.0.1', 3000, ''), true, 'default port is allowed');
  assert.strictEqual(security.hostAllowed('127.0.0.1:54321', 3000, ''), true,
    'ephemeral listeners on loopback are still loopback');
  assert.strictEqual(security.hostAllowed('evil.example.com', 3000, ''), false, 'foreign Host must be rejected');
  assert.strictEqual(security.hostAllowed('evil.example.com:3000', 3000, ''), false);
  assert.strictEqual(security.hostAllowed('', 3000, ''), false);
  assert.strictEqual(
    security.hostAllowed('abc.trycloudflare.com', 3000, 'abc.trycloudflare.com'), true,
    'active tunnel host must be allowed');
  assert.strictEqual(
    security.hostAllowed('other.trycloudflare.com', 3000, 'abc.trycloudflare.com'), false,
    'only the active tunnel host is allowed');

  // localOnly 必须是 server/security.js 这一份共享实现。
  // 历史 bug：routes/control.js 自己复制了一份只比对 req.ip 的弱版本，
  // 而 cloudflared 从 127.0.0.1 连入 → 隧道一开所有公网请求都被判成本机。
  assert.strictEqual(typeof security.localOnly, 'function', 'localOnly must be exported from server/security');
  var sharedLocalOnly = security.localOnly;
  var forwardedControl = await runMiddleware(sharedLocalOnly, mockReq({
    path:'/api/config',
    headers:{ 'x-forwarded-for':'9.9.9.9' }
  }));
  assert.strictEqual(forwardedControl.nextCalled, false,
    'loopback socket + x-forwarded-for (tunnel) must NOT count as local');
  assert.strictEqual(forwardedControl.res.statusCode, 403);

  var cfControl = await runMiddleware(sharedLocalOnly, mockReq({
    path:'/api/config',
    headers:{ 'cf-connecting-ip':'9.9.9.9' }
  }));
  assert.strictEqual(cfControl.nextCalled, false, 'cf-connecting-ip must NOT count as local');

  // req.ip 是可伪造的输入，localOnly 不能依赖它
  var spoofedIp = await runMiddleware(sharedLocalOnly, mockReq({
    path:'/api/config',
    ip:'127.0.0.1',
    socket:{ remoteAddress:'8.8.8.8' }
  }));
  assert.strictEqual(spoofedIp.nextCalled, false, 'localOnly must use socket address, not req.ip');

  var directControl = await runMiddleware(sharedLocalOnly, mockReq({ path:'/api/config' }));
  assert.strictEqual(directControl.nextCalled, true, 'direct loopback must pass');

  // control.js 与 maintenance.js 必须共用同一份判定，避免副本再次漂移
  var control = require('../../routes/control');
  assert.strictEqual(control._test.localOnly, security.localOnly,
    'routes/control.js must reuse server/security.localOnly, not a local copy');
  assert.strictEqual(maintenance._test.isDirectLocalRequest, security.isDirectLocalRequest,
    'routes/maintenance.js must reuse server/security.isDirectLocalRequest');

  var redacted = diagnostics.redactText('Tunnel https://x.trycloudflare.com?token=abcdef0123456789 and token=deadbeefcafebabe');
  assert.ok(!/abcdef0123456789/.test(redacted), 'URL tokens must be redacted');
  assert.ok(!/deadbeefcafebabe/.test(redacted), 'kv tokens must be redacted');
  assert.ok(diagnostics.maskSecret('abcdefghijklmnop').endsWith('mnop'));
  assert.deepStrictEqual(diagnostics.summarizeToken('1234567890abcdef'), {
    present:true,
    length:16,
    suffix:'…cdef'
  });

  function scriptSrcDirective(csp) {
    var match = String(csp || '').match(/script-src([^;]+)/);
    return match ? match[1] : '';
  }

  var defaultCsp = security.buildContentSecurityPolicy('/tools/gallery.html');
  var defaultScript = scriptSrcDirective(defaultCsp);
  assert.ok(defaultScript.includes("'self'"), 'migrated pages must use script-src self');
  assert.ok(!defaultScript.includes("'unsafe-inline'"), 'migrated pages must not allow script unsafe-inline');
  assert.ok(!defaultScript.includes("'unsafe-eval'"), 'non-chat pages must not allow unsafe-eval');

  var chatScript = scriptSrcDirective(security.buildContentSecurityPolicy('/tools/chat.html'));
  assert.ok(chatScript.includes("'unsafe-eval'"), 'chat CSP must allow Live2D runtime');
  assert.ok(!chatScript.includes("'unsafe-inline'"), 'chat should not need script unsafe-inline');

  var builderScript = scriptSrcDirective(security.buildContentSecurityPolicy('/tools/prompt-builder.html'));
  assert.ok(builderScript.includes("'self'"), 'prompt-builder must use script-src self');
  assert.ok(!builderScript.includes("'unsafe-inline'"), 'prompt-builder handlers migrated — no script unsafe-inline');
  assert.ok(!builderScript.includes("'unsafe-eval'"), 'prompt-builder must not get eval');

  var headers = await runMiddleware(security.responseHeaders, mockReq({ path:'/tools/control.html' }));
  assert.strictEqual(headers.nextCalled, true);
  var headerScript = scriptSrcDirective(headers.res.headers['Content-Security-Policy']);
  assert.ok(headerScript.includes("'self'"));
  assert.ok(!headerScript.includes("'unsafe-inline'"));

  console.log('Security tests passed: token match, local auth, backup local-only, log redaction, path CSP');
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
