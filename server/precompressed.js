'use strict';

/**
 * 优先发预压产物（.br / .gz）的静态中间件。
 *
 * compression 中间件是每个请求现场压一次，而且只有 gzip；
 * 预压之后既省 CPU 又能用上 brotli（实测 scenes.json gzip 229.7KB →
 * brotli 155.2KB）。产物由 scripts/maintenance/precompress.js 生成。
 */

var path = require('path');
var fs = require('fs');
var publicDataFiles = require('./public-data');

var PRECOMPRESSIBLE = /\.(?:js|css|html|json|svg|txt|map)$/i;

/** 与 PRECOMPRESSIBLE 同范围的内容类型映射（含文本类 charset） */
var MIME_BY_EXT = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function precompressed(rootDir) {
  return function (req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!PRECOMPRESSIBLE.test(req.path)) return next();

    var accept = String(req.headers['accept-encoding'] || '');
    var encoding = /\bbr\b/.test(accept) ? 'br' : (/\bgzip\b/.test(accept) ? 'gzip' : '');
    if (!encoding) return next();

    // 只服务白名单目录，且必须落在 root 内（防目录穿越）
    var allowed = /^\/(?:_app\/|data\/|assets\/|css\/|docs\/|index\.html$)/.test(req.path);
    if (!allowed) return next();

    var base = req.path === '/index.html' || req.path.indexOf('/_app/') === 0
      ? path.join(rootDir, 'dist', req.path)
      : path.join(rootDir, req.path);
    var resolved = path.resolve(base);
    if (resolved.indexOf(path.resolve(rootDir) + path.sep) !== 0) return next();

    var suffix = encoding === 'br' ? '.br' : '.gz';
    var compressedFile = resolved + suffix;
    if (!fs.existsSync(compressedFile)) return next();

    // data/ 的公开白名单与 server.js 同源（server/public-data.js）：防止 data/
    // 下新增 json（如个人内容）经由预压产物绕过白名单直接外发。
    if (req.path.indexOf('/data/') === 0) {
      var name = req.path.replace(/^\/data\//, '');
      if (publicDataFiles.indexOf(name) === -1) return next();
    }

    // 直接把预压文件发出去。改写 req.url 交给下游是不行的：
    // 后面的 /data 白名单会看到 "scenes.json.br" 而拒掉。
    res.setHeader('Content-Encoding', encoding);
    res.setHeader('Vary', 'Accept-Encoding');
    // 必须手工设置 Content-Type：实际文件名是双扩展名（如 scenes.json.br），
    // send 库按完整扩展名判定会得到错误类型；且 send 对已存在的头不覆盖，
    // 所以先在这里按"原始扩展名"给出正确类型。Express 5 起 serve-static v2
    // 移除了 express.static.mime，这里用与 PRECOMPRESSIBLE 同范围的零依赖映射。
    var type = MIME_BY_EXT[path.extname(resolved).toLowerCase()];
    if (type) {
      res.setHeader('Content-Type', type);
    }
    // 缓存策略要与未压缩版本一致
    if (req.path.indexOf('/_app/') === 0 || req.path.indexOf('/data/') === 0) {
      // _app 带内容 hash；data 由客户端 ?v=DATA_VERSION 版本化，均可长期缓存
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(?:html|json)$/i.test(req.path)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
    res.sendFile(compressedFile, function (error) {
      // 发送失败（文件刚被删等）就回退到未压缩路径
      if (error && !res.headersSent) {
        res.removeHeader('Content-Encoding');
        next();
      }
    });
  };
}

module.exports = {
  precompressed:precompressed
};
