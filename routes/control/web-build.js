'use strict';

/**
 * routes/control/web-build.js —— 前端构建状态与触发（2026-08-29 审计 P1-10
 * 自 routes/control.js 拆出，规则文本未改）。
 *
 * 公网分享伺服的是 dist/ 产物，源码改动后不重建分享出去的就是旧版。
 * 这里对比 dist/index.html 与最近修改的源文件，并提供受锁保护的重建触发。
 */

var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var maintenanceRuntime = require('../maintenance');

var BUILD_SOURCE_GLOBS = ['index.html', 'vite.config.ts', 'src', 'public'];
var WEB_BUILD_LOCK = null;
var WEB_BUILD_TIMEOUT_MS = 10 * 60 * 1000;

function newestSourceMtime(rootDir) {
  var newest = 0;
  var walk = function (dir) {
    var entries;
    try { entries = fs.readdirSync(dir, { withFileTypes:true }); } catch (error) { return; }
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      var full = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) walk(full);
        else {
          var stat = fs.statSync(full);
          if (stat.mtimeMs > newest) newest = stat.mtimeMs;
        }
      } catch (error) { /* 跳过不可读文件 */ }
    }
  };
  for (var i = 0; i < BUILD_SOURCE_GLOBS.length; i += 1) {
    var target = path.join(rootDir, BUILD_SOURCE_GLOBS[i]);
    var stat;
    try { stat = fs.statSync(target); } catch (error) { continue; }
    if (stat.isDirectory()) walk(target);
    else if (stat.mtimeMs > newest) newest = stat.mtimeMs;
  }
  return newest;
}

// /api/status 每 3s 被控制面板轮询；newestSourceMtime 要递归 stat 整个源码树
// （~200 个文件），不能每次都走。缓存键含 dist/index.html 的 mtime——构建完成
// 后键自动变化失效，无需手动清理（2026-08-21 性能审计 #2）。
var WEB_BUILD_CACHE_TTL_MS = 30 * 1000;
var WEB_BUILD_CACHE_LIMIT = 4;
var webBuildCache = new Map();

function webBuildInfo(config) {
  var distIndex = path.join(config.ROOT_DIR, 'dist', 'index.html');
  var distStat = null;
  try { distStat = fs.statSync(distIndex); } catch (error) { /* 无构建 */ }
  var distMtimeMs = distStat ? distStat.mtimeMs : -1;
  var now = Date.now();
  var cached = webBuildCache.get(config.ROOT_DIR);
  if (!cached || cached.distMtimeMs !== distMtimeMs || now - cached.at > WEB_BUILD_CACHE_TTL_MS) {
    cached = { distMtimeMs:distMtimeMs, at:now, sourceNewest:newestSourceMtime(config.ROOT_DIR) };
    if (webBuildCache.size >= WEB_BUILD_CACHE_LIMIT) webBuildCache.clear();
    webBuildCache.set(config.ROOT_DIR, cached);
  }
  return {
    distReady:Boolean(distStat),
    builtAt:distStat ? new Date(distStat.mtimeMs).toISOString() : null,
    stale:Boolean(distStat && cached.sourceNewest > distStat.mtimeMs + 5000),
    sourceNewest:new Date(cached.sourceNewest).toISOString()
  };
}

function runWebBuild(config, callback) {
  if (WEB_BUILD_LOCK) {
    callback({ ok:false, error:'已有构建在进行中' });
    return;
  }
  WEB_BUILD_LOCK = true;
  var startedAt = Date.now();
  var timedOut = false;
  var child = cp.spawn('npm', ['run', 'build'], {
    cwd:config.ROOT_DIR,
    shell:process.platform === 'win32',
    env:Object.assign({}, process.env, { NODE_ENV:'production' }),
    stdio:['ignore', 'pipe', 'pipe']
  });
  // 构建挂起（磁盘满、npm 网络等）时不能永久占用锁：超时强制终止并释放。
  // 同时登记进维护链的 activeChildren，网关退出时随进程树一起回收。
  maintenanceRuntime.trackChild(child);
  var timeout = setTimeout(function () {
    timedOut = true;
    maintenanceRuntime.killProcessTree(child);
  }, WEB_BUILD_TIMEOUT_MS);
  var tail = '';
  var onOutput = function (chunk) {
    var text = String(chunk || '');
    tail = (tail + text).slice(-4000);
  };
  child.stdout.on('data', onOutput);
  child.stderr.on('data', onOutput);
  child.on('error', function (error) {
    clearTimeout(timeout);
    WEB_BUILD_LOCK = false;
    callback({ ok:false, error:error.message, durationMs:Date.now() - startedAt, tail:tail });
  });
  child.on('close', function (code) {
    clearTimeout(timeout);
    WEB_BUILD_LOCK = false;
    callback({
      ok:code === 0 && !timedOut,
      error:timedOut ? '构建超时（' + Math.round(WEB_BUILD_TIMEOUT_MS / 60000) + ' 分钟）已终止'
        : (code === 0 ? null : '构建失败（退出码 ' + code + '）'),
      durationMs:Date.now() - startedAt,
      tail:tail.slice(-2000)
    });
  });
}

module.exports = { webBuildInfo:webBuildInfo, runWebBuild:runWebBuild };
