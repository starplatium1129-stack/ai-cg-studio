'use strict';

/**
 * server/upstream-health 测试 — node:test。
 * 用真实本地 HTTP 桩验证 requestJson 与各服务探活谓词的判定口径。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const health = require('../../server/upstream-health');

function listen(server) {
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      resolve('http://127.0.0.1:' + server.address().port);
    });
  });
}

test('requestJson：解析 JSON、保留 raw、非 2xx 不 throw', async () => {
  const server = http.createServer(function (req, res) {
    if (req.url === '/api/ps') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: 'qwen' }] }));
      return;
    }
    if (req.url === '/broken') {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('down');
      return;
    }
    if (req.url === '/garbage') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('<html>not json</html>');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await listen(server).then(async function (baseUrl) {
    try {
      const ok = await health.requestJson(baseUrl, '/api/ps', null, 2000);
      assert.equal(ok.status, 200);
      assert.deepEqual(ok.data, { models: [{ name: 'qwen' }] });
      assert.ok(ok.raw.indexOf('qwen') !== -1, 'raw body must be preserved');

      const degraded = await health.requestJson(baseUrl, '/broken', null, 2000);
      assert.equal(degraded.status, 503);
      assert.equal(degraded.data, null);

      const garbage = await health.requestJson(baseUrl, '/garbage', null, 2000);
      assert.equal(garbage.status, 200);
      assert.equal(garbage.data, null, 'non-JSON body must resolve with data:null');
    } finally {
      server.close();
    }
  });
});

test('requestJson：POST body 与响应体上限', async () => {
  let seenBody = '';
  const server = http.createServer(function (req, res) {
    if (req.url === '/api/generate') {
      req.on('data', function (c) { seenBody += c; });
      req.on('end', function () {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      return;
    }
    if (req.url === '/huge') {
      res.writeHead(200);
      res.end('x'.repeat(64 * 1024));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await listen(server).then(async function (baseUrl) {
    try {
      const posted = await health.requestJson(baseUrl, '/api/generate', { model: 'm', keep_alive: 0 }, 2000);
      assert.equal(posted.status, 200);
      assert.deepEqual(posted.data, { ok: true });
      assert.ok(seenBody.indexOf('"model"') !== -1, 'POST body must reach upstream');

      await assert.rejects(
        function () { return health.requestJson(baseUrl, '/huge', null, 2000, 1024); },
        /response too large/,
        'oversized body must reject'
      );
    } finally {
      server.close();
    }
  });
});

test('pingSd/pingTts/pingComfy 判定口径', async () => {
  const server = http.createServer(function (req, res) {
    if (req.url === '/sdapi/v1/sd-models') { res.writeHead(200); res.end('[]'); return; }
    if (req.url === '/docs') { res.writeHead(404); res.end(); return; }
    if (req.url === '/') { res.writeHead(200); res.end('tts-root'); return; }
    if (req.url === '/system_stats') { res.writeHead(500); res.end(); return; }
    res.writeHead(404);
    res.end();
  });
  await listen(server).then(async function (baseUrl) {
    try {
      assert.equal(await health.pingSd(baseUrl, 1500), true, 'SD 2xx must be online');
      assert.equal(await health.pingTts(baseUrl, 1500), true, 'TTS /docs 404 must fall back to /');
      assert.equal(await health.pingComfy(baseUrl, 1500), false, 'Comfy 5xx must be offline');

      server.close();
      const dead = 'http://127.0.0.1:1';
      assert.equal(await health.pingSd(dead, 300), false, 'connection refused must be offline');
      assert.equal(await health.pingComfy(dead, 300), false);
      assert.deepEqual(
        await health.pingOllamaDetail(dead, 300),
        { online: false, models: [], vram: 0 },
        'dead ollama must report offline detail'
      );
    } catch (error) {
      server.close();
      throw error;
    }
  });
});

test('pingOllamaDetail：/api/ps 汇总模型与显存，非 2xx 回落 /api/tags', async () => {
  let phase = 'ps';
  const server = http.createServer(function (req, res) {
    if (req.url === '/api/ps') {
      if (phase === 'ps') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models: [
          { name: 'a', size_vram: 100 },
          { model: 'b', size: 50 },
          { size_vram: 'NaN' }
        ] }));
        return;
      }
      // 仅网络错误触发 /api/tags 回落（HTTP 5xx 不回落，与原 control.js 一致）：
      // 用连接重置模拟网络层失败。
      req.destroy();
      return;
    }
    if (req.url === '/api/tags') {
      res.writeHead(phase === 'tags-ok' ? 200 : 503);
      res.end('{}');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await listen(server).then(async function (baseUrl) {
    try {
      const detail = await health.pingOllamaDetail(baseUrl, 1500);
      assert.equal(detail.online, true);
      assert.deepEqual(detail.models, ['a', 'b']);
      assert.equal(detail.vram, 150);

      phase = 'tags-ok';
      const fallbackOk = await health.pingOllamaDetail(baseUrl, 1500);
      assert.deepEqual(fallbackOk, { online: true, models: [], vram: 0 });

      phase = 'tags-fail';
      const fallbackFail = await health.pingOllamaDetail(baseUrl, 1500);
      assert.deepEqual(fallbackFail, { online: false, models: [], vram: 0 });
    } finally {
      server.close();
    }
  });
});
