'use strict';

var http = require('http');
var https = require('https');

function UpstreamError(message, options) {
  Error.call(this, message);
  this.name = 'UpstreamError';
  this.message = message;
  this.code = options && options.code || 'UPSTREAM_ERROR';
  this.status = options && options.status || 0;
  this.detail = options && options.detail || '';
  if (Error.captureStackTrace) Error.captureStackTrace(this, UpstreamError);
}
UpstreamError.prototype = Object.create(Error.prototype);
UpstreamError.prototype.constructor = UpstreamError;

function abortError(message) {
  var error = new Error(message || 'Request aborted');
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function isAbortError(error) {
  return !!error && (error.name === 'AbortError' || error.code === 'ABORT_ERR');
}

function request(baseUrl, pathname, options) {
  options = options || {};
  return new Promise(function (resolve, reject) {
    var target;
    try {
      target = new URL(pathname, baseUrl);
    } catch (error) {
      reject(new UpstreamError('Invalid upstream URL', { code:'INVALID_URL', detail:error.message }));
      return;
    }

    if (options.signal && options.signal.aborted) {
      reject(abortError());
      return;
    }

    var payload = options.json === undefined ? null : JSON.stringify(options.json);
    var headers = Object.assign({}, options.headers || {});
    if (payload !== null) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    var transport = target.protocol === 'https:' ? https : http;
    var settled = false;
    var responseRef = null;
    var req = transport.request(target, {
      method:options.method || (payload === null ? 'GET' : 'POST'),
      headers:headers
    }, function (response) {
      settled = true;
      responseRef = response;
      response.once('close', cleanupAbort);
      resolve({ request:req, response:response, url:target.toString() });
    });

    function onAbort() {
      if (responseRef && !responseRef.destroyed) responseRef.destroy(abortError());
      req.destroy(abortError());
    }
    function cleanupAbort() {
      if (options.signal) options.signal.removeEventListener('abort', onAbort);
    }

    if (options.signal) options.signal.addEventListener('abort', onAbort, { once:true });
    req.setTimeout(options.timeoutMs || 15000, function () {
      req.destroy(new UpstreamError(options.timeoutMessage || 'Upstream request timed out', { code:'UPSTREAM_TIMEOUT' }));
    });
    req.on('error', function (error) {
      cleanupAbort();
      if (!settled) reject(error);
    });
    req.end(payload === null ? undefined : payload);
  });
}

async function readBody(response, limit) {
  var chunks = [];
  var total = 0;
  var max = limit || 2 * 1024 * 1024;
  for await (var chunk of response) {
    total += chunk.length;
    if (total > max) {
      response.destroy();
      throw new UpstreamError('Upstream response exceeded the size limit', { code:'RESPONSE_TOO_LARGE' });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(baseUrl, pathname, options) {
  options = options || {};
  var result = await request(baseUrl, pathname, options);
  var body = await readBody(result.response, options.limit);
  if (result.response.statusCode < 200 || result.response.statusCode >= 300) {
    throw new UpstreamError('Upstream returned ' + result.response.statusCode, {
      code:'UPSTREAM_STATUS',
      status:result.response.statusCode,
      detail:body.toString('utf8').slice(0, 500)
    });
  }
  try {
    return JSON.parse(body.toString('utf8'));
  } catch (error) {
    throw new UpstreamError('Upstream returned invalid JSON', { code:'INVALID_JSON', detail:error.message });
  }
}

async function expectSuccess(baseUrl, pathname, options) {
  options = options || {};
  var result = await request(baseUrl, pathname, options);
  var body = await readBody(result.response, options.limit || 1024 * 1024);
  if (result.response.statusCode < 200 || result.response.statusCode >= 300) {
    throw new UpstreamError('Upstream returned ' + result.response.statusCode, {
      code:'UPSTREAM_STATUS',
      status:result.response.statusCode,
      detail:body.toString('utf8').slice(0, 500)
    });
  }
  return {
    body:body,
    contentType:result.response.headers['content-type'] || 'application/octet-stream'
  };
}

module.exports = {
  UpstreamError:UpstreamError,
  abortError:abortError,
  isAbortError:isAbortError,
  request:request,
  readBody:readBody,
  readJson:readJson,
  expectSuccess:expectSuccess
};
