'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const http = __importStar(require("http"));
const https = __importStar(require("https"));
class UpstreamError extends Error {
    code;
    status;
    detail;
    constructor(message, options) {
        super(message);
        this.name = 'UpstreamError';
        this.message = message;
        this.code = (options && options.code) || 'UPSTREAM_ERROR';
        this.status = (options && options.status) || 0;
        this.detail = (options && options.detail) || '';
        if (Error.captureStackTrace)
            Error.captureStackTrace(this, UpstreamError);
    }
}
function abortError(message) {
    const error = new Error(message || 'Request aborted');
    error.name = 'AbortError';
    error.code = 'ABORT_ERR';
    return error;
}
function isAbortError(error) {
    if (!error || typeof error !== 'object')
        return false;
    const value = error;
    return value.name === 'AbortError' || value.code === 'ABORT_ERR';
}
function request(baseUrl, pathname, options) {
    const opts = options || {};
    return new Promise(function (resolve, reject) {
        let target;
        try {
            target = new URL(pathname, baseUrl);
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            reject(new UpstreamError('Invalid upstream URL', { code: 'INVALID_URL', detail: detail }));
            return;
        }
        if (opts.signal && opts.signal.aborted) {
            reject(abortError());
            return;
        }
        const payload = opts.json === undefined ? null : JSON.stringify(opts.json);
        const headers = Object.assign({}, opts.headers || {});
        if (payload !== null) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
            headers['Content-Length'] = Buffer.byteLength(payload);
        }
        const transport = target.protocol === 'https:' ? https : http;
        let settled = false;
        let responseRef = null;
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
            if (responseRef && !responseRef.destroyed)
                responseRef.destroy(abortError());
            req.destroy(abortError());
        }
        function cleanupAbort() {
            if (opts.signal)
                opts.signal.removeEventListener('abort', onAbort);
        }
        if (opts.signal)
            opts.signal.addEventListener('abort', onAbort, { once: true });
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
async function readBody(response, limit) {
    const chunks = [];
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
async function readJson(baseUrl, pathname, options) {
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
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new UpstreamError('Upstream returned invalid JSON', { code: 'INVALID_JSON', detail: detail });
    }
}
async function expectSuccess(baseUrl, pathname, options) {
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
module.exports = {
    UpstreamError: UpstreamError,
    abortError: abortError,
    isAbortError: isAbortError,
    request: request,
    readBody: readBody,
    readJson: readJson,
    expectSuccess: expectSuccess
};
