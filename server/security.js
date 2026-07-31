'use strict';

var crypto = require('crypto');
var envelope = require('./http-envelope');

function tokenMatches(expectedToken, value) {
  if (typeof value !== 'string') return false;
  var actual = Buffer.from(value);
  var expected = Buffer.from(expectedToken);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function isDirectLocalRequest(req) {
  var address = req.socket && req.socket.remoteAddress || '';
  var loopback = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  var forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.headers.forwarded;
  return loopback && !forwarded;
}

// 唯一的 localOnly 中间件。routes/control.js 与 routes/maintenance.js 都必须用这一份 ——
// 曾经各自复制过一份，其中 control.js 的版本只比对 req.ip，隧道一开就全部失效。
function localOnly(req, res, next) {
  if (!isDirectLocalRequest(req)) return envelope.fail(res, 403, '该操作仅限本机使用');
  next();
}

var LOOPBACK_HOSTNAMES = ['127.0.0.1', 'localhost', '::1', '[::1]'];

// 上游 host（SD / TTS / Ollama）只允许指向本机 http。
// 未校验时这里是 SSRF；又因为值会落盘、而代理构造时读它，重启后会变成通用开放代理。
function safeLocalUrl(value) {
  var raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  var url;
  try { url = new URL(raw); } catch (error) { return ''; }
  if (url.protocol !== 'http:') return '';
  if (LOOPBACK_HOSTNAMES.indexOf(url.hostname.toLowerCase()) === -1) return '';
  if (url.username || url.password) return '';
  if (url.port && !(Number(url.port) >= 1 && Number(url.port) <= 65535)) return '';
  return url.origin;
}

// Host 白名单：阻断 DNS rebinding。
// isDirectLocalRequest 对任何 loopback socket 无条件放行，所以若不校验 Host，
// 用户访问的任意网页都能把域名 rebind 到 127.0.0.1，进而以「本机」身份调用控制接口。
// 只校验 hostname，不校验端口：rebinding 攻击靠的是把域名解析到 127.0.0.1，
// 端口本来就是攻击者已知的；而比对端口会误杀挂在其他 listener 上的合法访问（含测试）。
function hostAllowed(hostHeader, port, tunnelHost) {
  var host = String(hostHeader || '').trim().toLowerCase();
  if (!host) return false;
  var withoutPort = host.replace(/:\d+$/, '');
  if (withoutPort === '127.0.0.1' || withoutPort === 'localhost' ||
      withoutPort === '[::1]' || withoutPort === '::1') return true;
  if (tunnelHost) {
    var allowedTunnel = String(tunnelHost).toLowerCase().replace(/:\d+$/, '');
    if (withoutPort === allowedTunnel) return true;
  }
  return false;
}

function hostGuard(config, getTunnelUrl) {
  return function (req, res, next) {
    var tunnelHost = '';
    try {
      var tunnelUrl = getTunnelUrl && getTunnelUrl();
      if (tunnelUrl) tunnelHost = new URL(tunnelUrl).host;
    } catch (error) { tunnelHost = ''; }
    if (hostAllowed(req.headers.host, config.PORT, tunnelHost)) return next();
    return envelope.fail(res, 421, 'Misdirected Request — Host 不在允许列表内');
  };
}

/**
 * GPU 路由限流（token bucket）。
 *
 * 威胁模型：隧道一开，分享链接持有者能无限提交 txt2img / chat / tts。
 * SerialQueue 的 maxPending 只挡住"堆积"，挡不住"持续以队列消化速度提交"——
 * 那会把 GPU 永久占满，而本机用户看到的只是"一直在排队"。
 *
 * 直连本机（也就是电脑主人）不限流：他跟 GPU 的关系不是敌对的。
 * 隧道来的请求共用一个桶 —— 按 IP 分桶没有意义，cloudflared 转出来的
 * socket 全是 127.0.0.1，而 x-forwarded-for 是客户端可伪造的。
 */
function createTokenBucket(options) {
  var capacity = Math.max(1, Number(options && options.capacity) || 10);
  var refillMs = Math.max(1, Number(options && options.refillMs) || 1000);
  var tokens = capacity;
  var updatedAt = Date.now();

  function refill() {
    var now = Date.now();
    var gained = Math.floor((now - updatedAt) / refillMs);
    if (gained <= 0) return;
    tokens = Math.min(capacity, tokens + gained);
    updatedAt = now - ((now - updatedAt) % refillMs);
  }

  return {
    /** 取一个令牌；取不到时返回建议的重试秒数 */
    take:function () {
      refill();
      if (tokens > 0) {
        tokens -= 1;
        if (tokens === capacity - 1) updatedAt = Date.now();
        return { ok:true };
      }
      return { ok:false, retryAfterSeconds:Math.ceil(refillMs / 1000) };
    },
    state:function () { refill(); return { tokens:tokens, capacity:capacity }; }
  };
}

function rateLimit(options) {
  var bucket = createTokenBucket(options);
  var label = (options && options.label) || '该接口';
  return function (req, res, next) {
    if (isDirectLocalRequest(req)) return next();
    var result = bucket.take();
    if (result.ok) return next();
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    return envelope.fail(res, 429, label + '请求过于频繁，请稍后再试', {
      code:'RATE_LIMITED',
      retryAfterSeconds:result.retryAfterSeconds
    });
  };
}

function normalizeRequestPath(pathValue) {
  var value = String(pathValue || '/');
  var q = value.indexOf('?');
  if (q >= 0) value = value.slice(0, q);
  if (value.length > 1 && value.charAt(value.length - 1) === '/') value = value.slice(0, -1);
  return value || '/';
}

function buildContentSecurityPolicy(pathValue) {
  var path = normalizeRequestPath(pathValue);
  // Live2D（PixiJS）需要 unsafe-eval 才能编译着色器。
  // 只对角色房间放行；Vue SPA 的路由是 /chat，重构后漏掉了这一条，
  // 导致 Live2D 报 "Current environment does not allow unsafe-eval"。
  var chatPage = path === '/chat';
  var scriptSrc = "'self'";
  if (chatPage) scriptSrc += " 'unsafe-eval'";
  return "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; " +
    'script-src ' + scriptSrc + '; ' +
    "style-src 'self' 'unsafe-inline'; " +
    // 字体已本地自托管（@fontsource），不再放行 Google Fonts
    "font-src 'self' data:; " +
    "connect-src 'self' data: blob: https:; " +
    "object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
}

function responseHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', buildContentSecurityPolicy(req.path));
  next();
}

function tokenAuth(token) {
  return function (req, res, next) {
    if (isDirectLocalRequest(req)) return next();
    var cookieMatch = (req.headers.cookie || '').match(/(?:^|;\s*)aics_token=([^;]+)/);
    var supplied = req.query.token || req.headers['x-token'] || cookieMatch && cookieMatch[1];
    if (tokenMatches(token, supplied)) {
      if (req.query.token) {
        var secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
        res.setHeader('Set-Cookie',
          'aics_token=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400' + (secure ? '; Secure' : ''));
        var cleanUrl = new URL(req.originalUrl, 'http://localhost');
        cleanUrl.searchParams.delete('token');
        return res.redirect(302, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      }
      return next();
    }
    if (req.path.startsWith('/sdapi') || req.path.startsWith('/controlnet') ||
        req.path.startsWith('/adetailer') || req.path.startsWith('/api/')) {
      return envelope.fail(res, 401, 'Unauthorized — 缺少 token 参数');
    }
    return res.status(403).send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>绫季绘境</title>' +
      '<style>body{background:#1a1a2e;color:#e8e8f0;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}' +
      '.card{background:#2a2a40;border-radius:16px;padding:40px;max-width:480px;text-align:center}h1{margin-top:0;color:#f06292}' +
      'code{color:#90caf9}</style></head><body><div class="card">' +
      '<h1>🔗 绫季绘境</h1><p>请使用包含 token 的链接访问，格式：</p>' +
      '<code>http://地址:端口/?token=你的token</code>' +
      '<p style="margin-top:24px;color:#a8a8c0">朋友分享的链接中应当已经包含 token。</p>' +
      '</div></body></html>');
  };
}

module.exports = {
  tokenMatches:tokenMatches,
  isDirectLocalRequest:isDirectLocalRequest,
  localOnly:localOnly,
  safeLocalUrl:safeLocalUrl,
  hostAllowed:hostAllowed,
  hostGuard:hostGuard,
  createTokenBucket:createTokenBucket,
  rateLimit:rateLimit,
  normalizeRequestPath:normalizeRequestPath,
  buildContentSecurityPolicy:buildContentSecurityPolicy,
  responseHeaders:responseHeaders,
  tokenAuth:tokenAuth
};
