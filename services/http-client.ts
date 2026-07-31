'use strict';

import * as http from 'http';
import * as https from 'https';
import type { IncomingMessage, ClientRequest } from 'http';

interface UpstreamErrorOptions {
  code?: string;
  status?: number;
  detail?: string;
}

class UpstreamError extends Error {
  code: string;
  status: number;
  detail: string;

  constructor(message: string, options?: UpstreamErrorOptions) {
    super(message);
    this.name = 'UpstreamError';
    this.message = message;
    this.code = (options && options.code) || 'UPSTREAM_ERROR';
    this.status = (options && options.status) || 0;
    this.detail = (options && options.detail) || '';
    if (Error.captureStackTrace) Error.captureStackTrace(this, UpstreamError);
  }
}

interface AbortError extends Error {
  code: string;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string | number | string[] | undefined>;
  json?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  timeoutMessage?: string;
  limit?: number;
}

interface RequestResult {
  request: ClientRequest;
  response: IncomingMessage;
  url: string;
}

interface SuccessBody {
  body: Buffer;
  contentType: string;
}

function abortError(message?: string): AbortError {
  const error = new Error(message || 'Request aborted') as AbortError;
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; code?: string };
  return value.name === 'AbortError' || value.code === 'ABORT_ERR';
}

function request(baseUrl: string, pathname: string, options?: RequestOptions): Promise<RequestResult> {
  const opts = options || {};
  return new Promise(function (resolve, reject) {
    let target: URL;
    try {
      target = new URL(pathname, baseUrl);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      reject(new UpstreamError('Invalid upstream URL', { code: 'INVALID_URL', detail: detail }));
      return;
    }

    if (opts.signal && opts.signal.aborted) {
      reject(abortError());
      return;
    }

    const payload = opts.json === undefined ? null : JSON.stringify(opts.json);
    const headers: Record<string, string | number | string[] | undefined> = Object.assign({}, opts.headers || {});
    if (payload !== null) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const transport = target.protocol === 'https:' ? https : http;
    let settled = false;
    let responseRef: IncomingMessage | null = null;
    const req = transport.request(target, {
      method: opts.method || (payload === null ? 'GET' : 'POST'),
      headers: headers
    }, function (response) {
      settled = true;
      responseRef = response;
      response.once('close', cleanupAbort);
      resolve({ request: req, response: response, url: target.toString() });
    });

    function onAbort() {
      if (responseRef && !responseRef.destroyed) responseRef.destroy(abortError());
      req.destroy(abortError());
    }
    function cleanupAbort() {
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
    }

    if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true });
    req.setTimeout(opts.timeoutMs || 15000, function () {
      req.destroy(new UpstreamError(opts.timeoutMessage || 'Upstream request timed out', { code: 'UPSTREAM_TIMEOUT' }));
    });
    req.on('error', function (error) {
      cleanupAbort();
      if (!settled) {
        reject(error);
        return;
      }
      // 响应头已发出（流式场景）：不能静默吞掉 socket 错误，
      // 否则 TTS 音频流 / SSE 聊天流中途断连时调用方只看到"流提前结束"，
      // 无法区分正常结束与上游截断。把错误传给 response 流，让
      // for await / data 读取方能感知并抛给调用方的 catch。
      if (responseRef && !responseRef.destroyed && !responseRef.complete) {
        responseRef.destroy(error);
      }
    });
    req.end(payload === null ? undefined : payload);
  });
}

async function readBody(response: IncomingMessage, limit?: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  const max = limit || 2 * 1024 * 1024;
  for await (const chunk of response) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > max) {
      response.destroy();
      throw new UpstreamError('Upstream response exceeded the size limit', { code: 'RESPONSE_TOO_LARGE' });
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

async function readJson(baseUrl: string, pathname: string, options?: RequestOptions): Promise<unknown> {
  const opts = options || {};
  const result = await request(baseUrl, pathname, opts);
  const body = await readBody(result.response, opts.limit);
  const statusCode = result.response.statusCode || 0;
  if (statusCode < 200 || statusCode >= 300) {
    throw new UpstreamError('Upstream returned ' + statusCode, {
      code: 'UPSTREAM_STATUS',
      status: statusCode,
      detail: body.toString('utf8').slice(0, 500)
    });
  }
  try {
    return JSON.parse(body.toString('utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new UpstreamError('Upstream returned invalid JSON', { code: 'INVALID_JSON', detail: detail });
  }
}

async function expectSuccess(baseUrl: string, pathname: string, options?: RequestOptions): Promise<SuccessBody> {
  const opts = options || {};
  const result = await request(baseUrl, pathname, opts);
  const body = await readBody(result.response, opts.limit || 1024 * 1024);
  const statusCode = result.response.statusCode || 0;
  if (statusCode < 200 || statusCode >= 300) {
    throw new UpstreamError('Upstream returned ' + statusCode, {
      code: 'UPSTREAM_STATUS',
      status: statusCode,
      detail: body.toString('utf8').slice(0, 500)
    });
  }
  return {
    body: body,
    contentType: result.response.headers['content-type'] || 'application/octet-stream'
  };
}

export = {
  UpstreamError: UpstreamError,
  abortError: abortError,
  isAbortError: isAbortError,
  request: request,
  readBody: readBody,
  readJson: readJson,
  expectSuccess: expectSuccess
};
