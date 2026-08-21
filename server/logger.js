'use strict';
/* eslint-disable no-console -- console 输出是本模块的职责（终端/sidecar 可见性契约），文件行另落 */

/**
 * server/logger.js — 网关最小日志设施（2026-08-21 收口）。
 *
 * 背景：网关此前 console.* 直出，无级别过滤、无时间戳、无落盘——dev 靠终端，
 * 打包模式靠 Tauri sidecar 捕获，长期运行排障只能靠重启复现。本模块保持零生产
 * 依赖，提供：
 *   1. 级别方法 info/warn/error/debug（debug 默认静默，DEBUG=1 或选项开启）；
 *   2. 按天轮转：写入 <dir>/<prefix>-YYYYMMDD.log（文件名即轮转，无重命名步骤）；
 *   3. 保留期清理：init 与日期翻转时删除超过 retainDays 的旧日志；
 *   4. 落盘 fire-and-forget：appendFile 失败静默吞掉——日志永远不能弄崩网关。
 *
 * 约定：console 输出保持原样（终端/sidecar 可见性不变），文件行格式为
 * `[ISO] [LEVEL] message`；error 级别额外追加 detail（如 stack）。
 */

var fs = require('fs');
var path = require('path');

function dateKey(d) {
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return '' + d.getFullYear() + mm + dd;
}

function createLogger(options) {
  options = options || {};
  var dir = options.dir || '';
  var prefix = options.prefix || 'gateway';
  var retainDays = Number(options.retainDays) > 0 ? Number(options.retainDays) : 14;
  var debugEnabled = options.debug === true || process.env.DEBUG === '1';
  var currentKey = '';

  function sweepRetention(now) {
    if (!dir) return;
    var cutoff = new Date(now.getTime() - retainDays * 24 * 60 * 60 * 1000);
    var cutoffKey = dateKey(cutoff);
    try {
      fs.readdirSync(dir).forEach(function (name) {
        var match = /^([a-zA-Z0-9_-]+)-(\d{8})\.log$/.exec(name);
        if (!match || match[1] !== prefix) return;
        if (match[2] < cutoffKey) {
          try { fs.unlinkSync(path.join(dir, name)); } catch (error) {}
        }
      });
    } catch (error) {}
  }

  // init 即清理一次过期日志：即使本会话一行日志都不写，陈旧文件也该被回收。
  if (dir) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (error) {}
    sweepRetention(new Date());
  }

  function logFile(now) {
    return path.join(dir, prefix + '-' + dateKey(now) + '.log');
  }

  function write(level, message, detail) {
    var now = new Date();
    // 日期翻转时再做一次旧日志清理（每天最多触发一次）。
    var key = dateKey(now);
    if (key !== currentKey && dir) {
      currentKey = key;
      sweepRetention(now);
    }
    if (level === 'debug') {
      if (!debugEnabled) return;
      console.log('  [debug] ' + message);
    } else if (level === 'warn') {
      console.warn(message);
    } else if (level === 'error') {
      console.error(message);
    } else {
      console.log(message);
    }
    if (!dir) return;
    var line = '[' + now.toISOString() + '] [' + level.toUpperCase() + '] ' + message;
    if (detail) line += ' | ' + String(detail.stack || detail.message || detail);
    fs.appendFile(logFile(now), line + '\n', 'utf8', function () {});
  }

  return {
    info: function (message, detail) { write('info', message, detail); },
    warn: function (message, detail) { write('warn', message, detail); },
    error: function (message, detail) { write('error', message, detail); },
    debug: function (message) { write('debug', message); }
  };
}

module.exports = { createLogger: createLogger };
