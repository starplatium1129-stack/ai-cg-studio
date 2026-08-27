'use strict';

/**
 * routes/video/comfy.js —— 视频链路的结果物化与流式传输。
 *
 * 缓冲式 JSON 传输（requestComfy/requestComfyJson）已于 2026-08-27 审计收口到
 * server/comfy-client.js 全站唯一实现，此处仅保留别名转发以稳定 video 调用面；
 * 流式一侧（requestComfyStream：视频结果最大 256MB 不缓冲——2026-08-21 性能审计 #1，
 * 整段 Buffer.concat 会瞬时占用约 2 倍文件大小内存并冻结事件循环）为视频专属，
 * materializeResult 据此边收边写落盘。
 */

var fs = require('fs');
var http = require('http');
var https = require('https');
var errors = require('./errors');
var constants = require('./constants');
var media = require('./media');
var sharedClient = require('../../server/comfy-client');

var serviceError = errors.serviceError;
var requestComfy = sharedClient.requestComfy;
async function requestComfyJson(config, method, pathname, body, timeoutMs) {
  return sharedClient.requestComfyJson(config, method, pathname, body, timeoutMs);
}

// 与 requestComfy 相同的 URL/超时约定，但不缓冲 body：把原始响应流交给调用方。
function requestComfyStream(config, method, pathname, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var target;
    try { target = new URL(config.COMFY_HOST); } catch (error) {
      reject(serviceError(502, 'COMFY_CONFIG_INVALID', 'ComfyUI 地址无效'));
      return;
    }
    var rawPath = String(pathname || '/');
    var queryIndex = rawPath.indexOf('?');
    target.pathname = queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath;
    target.search = queryIndex >= 0 ? rawPath.slice(queryIndex) : '';
    var client = target.protocol === 'https:' ? https : http;
    var request = client.request({
      protocol:target.protocol,
      hostname:target.hostname,
      port:target.port,
      method:method,
      path:target.pathname + target.search,
      headers:{ Accept:'application/octet-stream' },
      timeout:timeoutMs || 10000,
    }, function (response) {
      resolve({ status:response.statusCode || 0, headers:response.headers, response:response });
    });
    request.on('error', function (error) {
      if (error && error.code) reject(error);
      else reject(serviceError(502, 'COMFY_UNAVAILABLE', error && error.message || 'ComfyUI 不可用'));
    });
    request.on('timeout', function () {
      request.destroy(serviceError(504, 'COMFY_TIMEOUT', 'ComfyUI 请求超时'));
    });
    request.end();
  });
}

// 取首个数据块用于魔数嗅探（ftyp/EBML 只需前 12 字节），随后回到暂停模式，
// 校验通过后由 pipe 恢复流动；响应立即结束时返回 null（等价于空 body）。
function firstResponseChunk(response) {
  return new Promise(function (resolve, reject) {
    var settled = false;
    var onData = function (chunk) {
      response.pause();
      done(null, chunk);
    };
    var onEnd = function () { done(null, null); };
    var onError = function (error) { done(error); };
    var done = function (error, chunk) {
      if (settled) return;
      settled = true;
      response.off('data', onData);
      response.off('end', onEnd);
      response.off('error', onError);
      if (error) reject(error);
      else resolve(chunk || null);
    };
    response.on('data', onData);
    response.on('end', onEnd);
    response.on('error', onError);
  });
}

// 把上游 /view 的视频结果安全落盘：校验引用 → 流式请求 → 魔数嗅探 →
// 边收边写（按 MAX_VIDEO_BYTES 计数拦截）→ 原子 rename。
async function materializeResult(config, job, output) {
  var reference = media.validateVideoReference(output);
  var query = '?filename=' + encodeURIComponent(reference.filename) + '&type=output';
  var upstream = await requestComfyStream(config, 'GET', '/view' + query, 120000);
  var upstreamResponse = upstream.response;
  if (upstream.status < 200 || upstream.status >= 300) {
    upstreamResponse.resume();
    throw serviceError(502, 'COMFY_RESULT_ERROR', 'ComfyUI 视频读取失败');
  }
  var head = await firstResponseChunk(upstreamResponse);
  var info = head ? media.videoMimeAndExtension(upstream.headers['content-type'], head, reference.filename) : null;
  if (!info || !head || !head.length) {
    upstreamResponse.resume();
    throw serviceError(502, 'INVALID_RESULT', 'ComfyUI 返回的视频格式无效');
  }
  var root = media.ensureMediaRoot(config);
  var target = media.safeMediaPath(root, job.id + '.' + info.extension);
  if (!target) {
    upstreamResponse.resume();
    throw serviceError(500, 'VIDEO_STORAGE_INVALID', '视频运行时目录无效');
  }
  // 流式落盘：边收边写、按 MAX_VIDEO_BYTES 计数拦截，任一环节失败都清掉半成品
  var temporary = target + '.tmp';
  var bytes = await new Promise(function (resolve, reject) {
    var out = fs.createWriteStream(temporary, { flags:'wx' });
    var total = head.length;
    var settled = false;
    var finish = function (error, value) {
      if (settled) return;
      settled = true;
      if (error) {
        upstreamResponse.destroy();
        out.destroy();
        try { fs.unlinkSync(temporary); } catch (cleanupError) {}
        reject(error);
      } else {
        resolve(value);
      }
    };
    upstreamResponse.on('data', function (chunk) {
      total += chunk.length;
      if (total > constants.MAX_VIDEO_BYTES) {
        finish(serviceError(502, 'INVALID_RESULT', 'ComfyUI 返回的视频格式无效'));
      }
    });
    upstreamResponse.on('error', function (error) {
      finish(error && error.code ? error
        : serviceError(502, 'COMFY_RESULT_ERROR', 'ComfyUI 视频读取失败'));
    });
    out.on('error', function (error) {
      finish(serviceError(500, 'VIDEO_STORAGE_INVALID', error && error.message || '视频落盘失败'));
    });
    out.on('finish', function () { finish(null, total); });
    out.write(head);
    upstreamResponse.pipe(out);
  });
  await fs.promises.rename(temporary, target);
  return { path:target, mime:info.mime, bytes:bytes };
}

module.exports = {
  requestComfy:requestComfy,
  requestComfyJson:requestComfyJson,
  requestComfyStream:requestComfyStream,
  firstResponseChunk:firstResponseChunk,
  materializeResult:materializeResult,
};
