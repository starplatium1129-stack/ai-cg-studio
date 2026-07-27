'use strict';

var crypto = require('crypto');

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
  var chatPage = path === '/chat' || path === '/tools/chat.html' || path === '/tools/chat';
  var scriptSrc = "'self'";
  if (chatPage) scriptSrc += " 'unsafe-eval'";
  return "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; " +
    'script-src ' + scriptSrc + '; ' +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
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
      return res.status(401).json({ error:'Unauthorized — 缺少 token 参数' });
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
  normalizeRequestPath:normalizeRequestPath,
  buildContentSecurityPolicy:buildContentSecurityPolicy,
  responseHeaders:responseHeaders,
  tokenAuth:tokenAuth
};
