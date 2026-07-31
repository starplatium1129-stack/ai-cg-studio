'use strict';

/**
 * HTTP client 测试 — 已迁移到 node:test。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  UpstreamError,
  abortError,
  isAbortError,
  readJson,
  expectSuccess,
  request,
} = require('../../services/http-client');

test('abortError 识别', () => {
  assert.equal(isAbortError(abortError()), true, 'abortError must be recognized');
  assert.equal(isAbortError(new Error('nope')), false, 'normal errors must not look like aborts');
});

test('UpstreamError 字段', () => {
  const badUrl = new UpstreamError('boom', { code: 'X', status: 502, detail: 'd' });
  assert.equal(badUrl.name, 'UpstreamError');
  assert.equal(badUrl.code, 'X');
  assert.equal(badUrl.status, 502);
  assert.equal(badUrl.detail, 'd');
});

test('真实 HTTP：JSON 成功 / 状态错误 / 二进制 / 预中止', async (t) => {
  const server = http.createServer(function (req, res) {
    if (req.url === '/ok.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hello: 'world' }));
      return;
    }
    if (req.url === '/fail') {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('down');
      return;
    }
    if (req.url === '/blob') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(Buffer.from([1, 2, 3]));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  t.after(() => server.close());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port + '/';

  const json = await readJson(baseUrl, '/ok.json');
  assert.deepEqual(json, { hello: 'world' });

  let statusError = null;
  try {
    await readJson(baseUrl, '/fail');
  } catch (error) {
    statusError = error;
  }
  assert.ok(statusError instanceof UpstreamError);
  assert.equal(statusError.code, 'UPSTREAM_STATUS');
  assert.equal(statusError.status, 503);
  assert.ok(String(statusError.detail).includes('down'));

  const blob = await expectSuccess(baseUrl, '/blob');
  assert.deepEqual([...blob.body], [1, 2, 3]);
  assert.ok(String(blob.contentType).includes('octet-stream'));

  const controller = new AbortController();
  controller.abort();
  let aborted = null;
  try {
    await request(baseUrl, '/ok.json', { signal: controller.signal });
  } catch (error) {
    aborted = error;
  }
  assert.ok(isAbortError(aborted), 'pre-aborted signal must reject as AbortError');
});
