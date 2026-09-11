'use strict';
var security = require('./security');
var envelope = require('./http-envelope');
var READ_PATHS = [
  '/sdapi/v1/sd-models', '/sdapi/v1/samplers', '/sdapi/v1/schedulers',
  '/sdapi/v1/upscalers', '/sdapi/v1/options', '/sdapi/v1/progress'
];
var WRITE_PATHS = ['/sdapi/v1/txt2img', '/sdapi/v1/options', '/sdapi/v1/interrupt'];
var paths = Array.from(new Set(READ_PATHS.concat(WRITE_PATHS)));

function denial(req, pathname, upgrade) {
  if (paths.indexOf(pathname) === -1) return 404;
  var read = /^(GET|HEAD)$/.test(req.method) && READ_PATHS.indexOf(pathname) !== -1;
  var write = req.method === 'POST' && WRITE_PATHS.indexOf(pathname) !== -1;
  if ((!read && !write) || (upgrade && req.method !== 'GET')) return 405;
  // A WebSocket is bidirectional, even when its HTTP handshake looks like a read.
  if ((write || upgrade) && !security.isDirectLocalRequest(req)) return 403;
  return null;
}

function middleware(req, res, next) {
  if (paths.indexOf(req.path) === -1) return next();
  var status = denial(req, req.path, false);
  if (!status) return next();
  return envelope.fail(res, status, status === 403
    ? '原生 SD 写操作仅限本机；请使用应用生成与取消接口'
    : '该原生 SD 接口不支持此请求方法', { code: status === 403 ? 'SD_NATIVE_LOCAL_ONLY' : 'METHOD_NOT_ALLOWED' });
}

module.exports = { paths: paths, denial: denial, middleware: middleware };
