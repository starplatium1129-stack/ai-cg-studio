'use strict';

const assert = require('assert');
const http = require('http');
const {
  UpstreamError,
  abortError,
  isAbortError,
  readJson,
  expectSuccess,
  request
} = require('../../services/http-client');

assert.strictEqual(isAbortError(abortError()), true, 'abortError must be recognized');
assert.strictEqual(isAbortError(new Error('nope')), false, 'normal errors must not look like aborts');

const badUrl = new UpstreamError('boom', { code: 'X', status: 502, detail: 'd' });
assert.strictEqual(badUrl.name, 'UpstreamError');
assert.strictEqual(badUrl.code, 'X');
assert.strictEqual(badUrl.status, 502);
assert.strictEqual(badUrl.detail, 'd');

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

server.listen(0, '127.0.0.1', async function () {
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port + '/';
  try {
    const json = await readJson(baseUrl, '/ok.json');
    assert.deepStrictEqual(json, { hello: 'world' });

    let statusError = null;
    try {
      await readJson(baseUrl, '/fail');
    } catch (error) {
      statusError = error;
    }
    assert(statusError instanceof UpstreamError);
    assert.strictEqual(statusError.code, 'UPSTREAM_STATUS');
    assert.strictEqual(statusError.status, 503);
    assert(String(statusError.detail).includes('down'));

    const blob = await expectSuccess(baseUrl, '/blob');
    assert.deepStrictEqual([...blob.body], [1, 2, 3]);
    assert(String(blob.contentType).includes('octet-stream'));

    const controller = new AbortController();
    controller.abort();
    let aborted = null;
    try {
      await request(baseUrl, '/ok.json', { signal: controller.signal });
    } catch (error) {
      aborted = error;
    }
    assert(isAbortError(aborted), 'pre-aborted signal must reject as AbortError');

    console.log('HTTP client tests passed: JSON success, status errors, binary success, and abort');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
