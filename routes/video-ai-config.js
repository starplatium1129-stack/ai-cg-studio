'use strict';


// 与 routes/chat.js 完全同源的读取缓存：按 (mtimeMs,size) 失效，命中时零磁盘 IO
// （2026-08-21 性能审计 #9）。本路由对配置只读，写路径在 chat.js 侧已失效。
var hostConfigCache = { mtimeMs:-1, size:-1, value:null };

var path = require('path');

var fs = require('fs');


// ── 站主 API 托管配置（与 routes/chat.js 完全同源，避免两套配置漂移）──────
function chatHostConfigPath(config) {
  return path.join(config.RUNTIME.state, 'chat_api_config.json');
}


function readHostConfig(config) {
  var filePath = chatHostConfigPath(config);
  var stat = null;
  try { stat = fs.statSync(filePath); } catch (error) { return null; }
  if (hostConfigCache.value && hostConfigCache.mtimeMs === stat.mtimeMs
    && hostConfigCache.size === stat.size) {
    return Object.assign({}, hostConfigCache.value);
  }
  try {
    var parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    var baseUrl = String(parsed && parsed.baseUrl || '').trim();
    var model = String(parsed && parsed.model || '').trim();
    var apiKey = String(parsed && parsed.apiKey || '').trim();
    if (!baseUrl || !model) return null;
    // 旧格式没有 pathname：用 baseUrl 重拼一次（与 chat.js 一致）
    var pathname = typeof parsed.pathname === 'string' && parsed.pathname
      ? parsed.pathname
      : new URL('chat/completions', baseUrl.replace(/\/+$/, '') + '/').pathname;
    var result = { baseUrl:baseUrl, pathname:pathname, model:model, apiKey:apiKey };
    hostConfigCache = { mtimeMs:stat.mtimeMs, size:stat.size, value:result };
    return Object.assign({}, result);
  } catch (error) {
    // 半写状态/损坏文件不缓存
    return null;
  }
}
module.exports = { chatHostConfigPath, readHostConfig };
