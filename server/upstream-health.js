'use strict';

/**
 * server/upstream-health.js — 本机上游 JSON 请求与健康探测收口（P3）。
 *
 * 此前同一份「本机 JSON 请求 + 响应体上限 + 超时」在 routes/control.js、
 * routes/generation.js、routes/anima.js 各有一份拷贝，SD/TTS/Comfy/Ollama
 * 的探活谓词也分散在各路由里。这里收敛为唯一实现：
 *   - requestJson：低层本机上游 JSON 请求（非 2xx 不 throw，返回 {status,data,raw}，
 *     探活与目录拉取共用）；响应体超限与网络错误才 reject。
 *   - pingSd / pingTts / pingComfy / pingOllamaDetail：各服务探活谓词，
 *     判定口径与迁移前逐字一致（SD/TTS 宽容 2xx-4xx，Comfy 严格 2xx）。
 *
 * 面向公网的上游请求（带代理/信封语义）继续走 services/http-client.ts；
 * 这里只服务本机回环上游，不走代理。
 */

var http = require('http');
var https = require('https');

var MAX_JSON_BYTES = 8 * 1024 * 1024;

function requestJson(baseUrl, apiPath, body, timeoutMs, maxBytes) {
  return new Promise(function (resolve, reject) {
    var u;
    try {
      u = new URL(apiPath, baseUrl);
    } catch (e) { reject(e); return; }
    var lib = u.protocol === 'https:' ? https : http;
    var payload = body ? JSON.stringify(body) : null;
    var req = lib.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + (u.search || ''),
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
      timeout: timeoutMs || 4000
    }, function (res) {
      // 响应体上限：防止被探测的本机服务返回异常大响应时网关内存无界累积。
      var chunks = [];
      var size = 0;
      res.on('data', function (c) {
        size += c.length;
        if (size > (maxBytes || MAX_JSON_BYTES)) {
          req.destroy(new Error('response too large'));
          return;
        }
        chunks.push(c);
      });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8');
        var data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch {}
        resolve({ status: res.statusCode || 0, data: data, raw: raw });
      });
    });
    req.on('error', reject);
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

function reachable(status) {
  return status >= 200 && status < 500;
}

function pingSd(urlStr, timeoutMs) {
  return requestJson(urlStr, '/sdapi/v1/sd-models', null, timeoutMs || 2500)
    .then(function (r) { return reachable(r.status); })
    .catch(function () { return false; });
}

function pingTts(urlStr, timeoutMs) {
  return requestJson(urlStr, '/docs', null, timeoutMs || 2500)
    .then(function (r) { return reachable(r.status); })
    .catch(function () {
      return requestJson(urlStr, '/', null, timeoutMs || 2500)
        .then(function (r) { return reachable(r.status); })
        .catch(function () { return false; });
    });
}

function pingComfy(urlStr, timeoutMs) {
  return requestJson(urlStr, '/system_stats', null, timeoutMs || 2500)
    .then(function (r) { return r.status >= 200 && r.status < 300; })
    .catch(function () { return false; });
}

function pingOllamaDetail(urlStr, timeoutMs) {
  return requestJson(urlStr, '/api/ps', null, timeoutMs || 3000)
    .then(function (r) {
      if (!(r.status >= 200 && r.status < 300)) return { online: false, models: [], vram: 0 };
      var models = Array.isArray(r.data && r.data.models) ? r.data.models : [];
      var vram = 0;
      models.forEach(function (m) {
        var size = Number(m.size_vram || m.size || 0);
        if (Number.isFinite(size)) vram += size;
      });
      return {
        online: true,
        models: models.map(function (m) { return String(m.name || m.model || ''); }).filter(Boolean),
        vram: vram
      };
    })
    .catch(function () {
      return requestJson(urlStr, '/api/tags', null, timeoutMs || 3000)
        .then(function (r) { return { online: r.status === 200, models: [], vram: 0 }; })
        .catch(function () { return { online: false, models: [], vram: 0 }; });
    });
}

module.exports = {
  requestJson: requestJson,
  pingSd: pingSd,
  pingTts: pingTts,
  pingComfy: pingComfy,
  pingOllamaDetail: pingOllamaDetail,
};
