'use strict';

/**
 * 安全中间件测试 — 已迁移到 node:test。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const security = require('../../server/security');
const diagnostics = require('../../server/diagnostics');
const maintenance = require('../../routes/maintenance');

function mockReq(overrides) {
  return Object.assign({
    socket: { remoteAddress: '127.0.0.1' },
    headers: {},
    query: {},
    path: '/',
    originalUrl: '/',
    secure: false,
  }, overrides || {});
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    redirected: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    redirect(code, url) { this.statusCode = code; this.redirected = url; },
  };
  return res;
}

function runMiddleware(mw, req) {
  return new Promise(function (resolve) {
    const res = mockRes();
    let nextCalled = false;
    mw(req, res, function () { nextCalled = true; resolve({ res, nextCalled }); });
    setTimeout(function () {
      if (!nextCalled) resolve({ res, nextCalled });
    }, 0);
  });
}

function scriptSrcDirective(csp) {
  const match = String(csp || '').match(/script-src([^;]+)/);
  return match ? match[1] : '';
}

test('tokenMatches：等长比对与空值拒绝', () => {
  assert.equal(security.tokenMatches('abc12345', 'abc12345'), true);
  assert.equal(security.tokenMatches('abc12345', 'abc1234x'), false);
  assert.equal(security.tokenMatches('abc12345', 'short'), false);
  assert.equal(security.tokenMatches('abc12345', null), false);
});

test('isDirectLocalRequest：本机直连识别与转发头拒绝', () => {
  assert.equal(security.isDirectLocalRequest(mockReq()), true);
  assert.equal(security.isDirectLocalRequest(mockReq({ socket: { remoteAddress: '::1' } })), true);
  assert.equal(security.isDirectLocalRequest(mockReq({ headers: { 'x-forwarded-for': '1.2.3.4' } })), false);
  assert.equal(security.isDirectLocalRequest(mockReq({ socket: { remoteAddress: '8.8.8.8' } })), false);
});

test('tokenAuth：本机放行、远程拒绝、token 放行', async () => {
  const auth = security.tokenAuth('secret-token-value-32chars-aaaaaa');
  const local = await runMiddleware(auth, mockReq({ path: '/api/health' }));
  assert.equal(local.nextCalled, true, 'local loopback must bypass token');

  const denied = await runMiddleware(auth, mockReq({
    socket: { remoteAddress: '8.8.8.8' },
    path: '/api/health',
    originalUrl: '/api/health',
  }));
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.res.statusCode, 401);

  const allowed = await runMiddleware(auth, mockReq({
    socket: { remoteAddress: '8.8.8.8' },
    path: '/api/health',
    headers: { 'x-token': 'secret-token-value-32chars-aaaaaa' },
  }));
  assert.equal(allowed.nextCalled, true);
});

test('maintenanceLocalOnly：远程 403、本机放行', async () => {
  const localOnly = maintenance._test.maintenanceLocalOnly;
  const remoteMaintenance = await runMiddleware(localOnly, mockReq({
    socket: { remoteAddress: '8.8.8.8' },
    path: '/api/maintenance/scenes',
  }));
  assert.equal(remoteMaintenance.nextCalled, false);
  assert.equal(remoteMaintenance.res.statusCode, 403);

  const localMaintenance = await runMiddleware(localOnly, mockReq({ path: '/api/maintenance/scenes' }));
  assert.equal(localMaintenance.nextCalled, true);
});

test('safeLocalUrl：只接受本机 http', () => {
  assert.equal(security.safeLocalUrl('http://127.0.0.1:7860'), 'http://127.0.0.1:7860');
  assert.equal(security.safeLocalUrl('http://localhost:9880/'), 'http://localhost:9880');
  assert.equal(security.safeLocalUrl('http://169.254.169.254'), '', 'metadata host must be rejected');
  assert.equal(security.safeLocalUrl('http://evil.example.com'), '', 'remote host must be rejected');
  assert.equal(security.safeLocalUrl('https://127.0.0.1:7860'), '', 'non-http must be rejected');
  assert.equal(security.safeLocalUrl('http://u:p@127.0.0.1:7860'), '', 'credentials must be rejected');
  assert.equal(security.safeLocalUrl(''), '');
  assert.equal(security.safeLocalUrl('not a url'), '');
});

test('hostAllowed：DNS rebinding 阻断与隧道放行', () => {
  assert.equal(security.hostAllowed('127.0.0.1:3000', 3000, ''), true);
  assert.equal(security.hostAllowed('localhost:3000', 3000, ''), true);
  assert.equal(security.hostAllowed('127.0.0.1', 3000, ''), true, 'default port is allowed');
  assert.equal(security.hostAllowed('127.0.0.1:54321', 3000, ''), true, 'ephemeral listeners on loopback are still loopback');
  assert.equal(security.hostAllowed('evil.example.com', 3000, ''), false, 'foreign Host must be rejected');
  assert.equal(security.hostAllowed('evil.example.com:3000', 3000, ''), false);
  assert.equal(security.hostAllowed('', 3000, ''), false);
  assert.equal(security.hostAllowed('abc.trycloudflare.com', 3000, 'abc.trycloudflare.com'), true, 'active tunnel host must be allowed');
  assert.equal(security.hostAllowed('other.trycloudflare.com', 3000, 'abc.trycloudflare.com'), false, 'only the active tunnel host is allowed');
});

test('localOnly 单一来源：转发头/伪造 ip 拒绝，control/maintenance 复用同一份', async () => {
  const sharedLocalOnly = security.localOnly;
  const forwardedControl = await runMiddleware(sharedLocalOnly, mockReq({
    path: '/api/config',
    headers: { 'x-forwarded-for': '9.9.9.9' },
  }));
  assert.equal(forwardedControl.nextCalled, false, 'loopback socket + x-forwarded-for (tunnel) must NOT count as local');
  assert.equal(forwardedControl.res.statusCode, 403);

  const cfControl = await runMiddleware(sharedLocalOnly, mockReq({
    path: '/api/config',
    headers: { 'cf-connecting-ip': '9.9.9.9' },
  }));
  assert.equal(cfControl.nextCalled, false, 'cf-connecting-ip must NOT count as local');

  const spoofedIp = await runMiddleware(sharedLocalOnly, mockReq({
    path: '/api/config',
    ip: '127.0.0.1',
    socket: { remoteAddress: '8.8.8.8' },
  }));
  assert.equal(spoofedIp.nextCalled, false, 'localOnly must use socket address, not req.ip');

  const directControl = await runMiddleware(sharedLocalOnly, mockReq({ path: '/api/config' }));
  assert.equal(directControl.nextCalled, true, 'direct loopback must pass');

  const control = require('../../routes/control');
  assert.equal(control._test.localOnly, security.localOnly, 'routes/control.js must reuse server/security.localOnly, not a local copy');
  assert.equal(maintenance._test.isDirectLocalRequest, security.isDirectLocalRequest, 'routes/maintenance.js must reuse server/security.isDirectLocalRequest');
});

test('诊断脱敏：URL 与 KV token 全部遮蔽', () => {
  const redacted = diagnostics.redactText('Tunnel https://x.trycloudflare.com?token=abcdef0123456789 and token=deadbeefcafebabe');
  assert.ok(!/abcdef0123456789/.test(redacted), 'URL tokens must be redacted');
  assert.ok(!/deadbeefcafebabe/.test(redacted), 'kv tokens must be redacted');
  assert.ok(diagnostics.maskSecret('abcdefghijklmnop').endsWith('mnop'));
  assert.deepEqual(diagnostics.summarizeToken('1234567890abcdef'), {
    present: true,
    length: 16,
    suffix: '…cdef',
  });
});

test('CSP：按路由收紧，非聊天页无 unsafe-eval，字体本地化后无 Google 源', async () => {
  const defaultCsp = security.buildContentSecurityPolicy('/gallery');
  const defaultScript = scriptSrcDirective(defaultCsp);
  assert.ok(defaultScript.includes("'self'"), 'migrated pages must use script-src self');
  assert.ok(!defaultScript.includes("'unsafe-inline'"), 'migrated pages must not allow script unsafe-inline');
  assert.ok(!defaultScript.includes("'unsafe-eval'"), 'non-chat pages must not allow unsafe-eval');
  assert.ok(!defaultCsp.includes('fonts.gstatic.com'), 'self-hosted fonts must drop Google Fonts CSP source');

  const chatScript = scriptSrcDirective(security.buildContentSecurityPolicy('/chat'));
  assert.ok(chatScript.includes("'unsafe-eval'"), 'chat CSP must allow Live2D runtime');
  assert.ok(!chatScript.includes("'unsafe-inline'"), 'chat should not need script unsafe-inline');

  const companionScript = scriptSrcDirective(security.buildContentSecurityPolicy('/companion'));
  assert.ok(companionScript.includes("'unsafe-eval'"), 'companion CSP must allow Live2D runtime');
  assert.ok(!companionScript.includes("'unsafe-inline'"), 'companion should not need script unsafe-inline');

  const builderScript = scriptSrcDirective(security.buildContentSecurityPolicy('/prompt-builder'));
  assert.ok(builderScript.includes("'self'"), 'prompt-builder must use script-src self');
  assert.ok(!builderScript.includes("'unsafe-inline'"), 'prompt-builder handlers migrated — no script unsafe-inline');
  assert.ok(!builderScript.includes("'unsafe-eval'"), 'prompt-builder must not get eval');

  const headers = await runMiddleware(security.responseHeaders, mockReq({ path: '/control' }));
  assert.equal(headers.nextCalled, true);
  const headerScript = scriptSrcDirective(headers.res.headers['Content-Security-Policy']);
  assert.ok(headerScript.includes("'self'"));
  assert.ok(!headerScript.includes("'unsafe-inline'"));
});
