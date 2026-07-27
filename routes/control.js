'use strict';
/**
 * routes/control.js — 控制面板专用 API
 * 提供 /api/status /api/start /api/stop /api/config /api/preference
 *      /api/logs /api/diagnostics
 */

var express = require('express');
var fs      = require('fs');
var path    = require('path');
var http    = require('http');
var https   = require('https');

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function writeJson(file, data) {
  var dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive:true });
  var tmp = file + '.' + process.pid + '.tmp';
  try { fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n'); fs.renameSync(tmp, file); }
  catch (err) { try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {} throw err; }
}

/** 快速 HTTP/HTTPS HEAD 或 GET，超时2s，返回 true/false */
function pingUrl(urlStr, timeoutMs) {
  return new Promise(function(resolve) {
    try {
      var u = new URL(urlStr);
      var lib = u.protocol === 'https:' ? https : http;
      var req = lib.request({ hostname:u.hostname, port:u.port, path:u.pathname + '/sdapi/v1/sd-models', method:'GET', timeout:timeoutMs || 2000 }, function(res) {
        resolve(res.statusCode < 500);
      });
      req.on('error', function() { resolve(false); });
      req.on('timeout', function() { req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });
}
function pingTts(urlStr, timeoutMs) {
  return new Promise(function(resolve) {
    try {
      var u = new URL(urlStr);
      var lib = u.protocol === 'https:' ? https : http;
      var req = lib.request({ hostname:u.hostname, port:u.port, path:'/', method:'GET', timeout:timeoutMs || 2000 }, function(res) {
        resolve(res.statusCode < 500);
      });
      req.on('error', function() { resolve(false); });
      req.on('timeout', function() { req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });
}
function pingOllama(urlStr, timeoutMs) {
  return new Promise(function(resolve) {
    try {
      var u = new URL(urlStr);
      var lib = u.protocol === 'https:' ? https : http;
      var req = lib.request({ hostname:u.hostname, port:u.port, path:'/api/tags', method:'GET', timeout:timeoutMs || 2000 }, function(res) {
        resolve(res.statusCode === 200);
      });
      req.on('error', function() { resolve(false); });
      req.on('timeout', function() { req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });
}

/** 读取日志文件最后 N 行 */
function tailLog(file, since) {
  try {
    if (!fs.existsSync(file)) return [];
    var lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    return lines.slice(Math.max(0, since || 0));
  } catch { return []; }
}

// ── 路由工厂 ──────────────────────────────────────────────────────────────────

function createControlRouter(config, gatewayRef) {
  var router = express.Router();
  var startTime = Date.now();

  // 本地 only 中间件（控制面板操作不允许从公网调用）
  function localOnly(req, res, next) {
    var ip = req.ip || '';
    var local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
    if (!local) return res.status(403).json({ error:'该操作仅限本机使用' });
    next();
  }

  // GET /api/status
  router.get('/api/status', function(req, res) {
    Promise.all([
      pingUrl(config.SD_HOST, 2500),
      pingTts(config.TTS_HOST, 2500),
      pingOllama(config.OLLAMA_HOST, 2500)
    ]).then(function(results) {
      var sdOnline = results[0], ttsOnline = results[1], ollamaOnline = results[2];
      var gw = gatewayRef ? gatewayRef() : null;
      var tunnelUrl = gw ? gw.tunnelUrl : '';
      var tunnelStatus = tunnelUrl ? 'active' : (config.DISABLE_TUNNEL ? 'disabled' : 'waiting');
      var saved = readJson(config.RUNTIME.config);
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        running: true,
        sdOnline: sdOnline,
        ttsOnline: ttsOnline,
        ollamaOnline: ollamaOnline,
        sdHost: config.SD_HOST,
        ttsHost: config.TTS_HOST,
        ollamaHost: config.OLLAMA_HOST,
        localLink: 'http://127.0.0.1:' + config.PORT + '/',
        shareLink: tunnelUrl ? (tunnelUrl + '/?t=' + config.TOKEN) : '',
        tunnelStatus: tunnelStatus,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        autoStartVoice: !!saved.autoStartVoice,
        voices: config.VOICE_PROFILES || {}
      });
    }).catch(function(e) {
      res.status(500).json({ error: e.message });
    });
  });

  // POST /api/start — 启动隧道（网关本身已在运行）
  router.post('/api/start', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    try {
      var gw = gatewayRef ? gatewayRef() : null;
      if (gw && typeof gw.startTunnel === 'function') {
        gw.startTunnel();
      }
      res.json({ ok:true, msg:'网关隧道已启动' });
    } catch(e) {
      res.status(500).json({ ok:false, msg:e.message });
    }
  });

  // POST /api/stop — 停止隧道
  router.post('/api/stop', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    try {
      var gw = gatewayRef ? gatewayRef() : null;
      if (gw && typeof gw.stopTunnel === 'function') {
        gw.stopTunnel();
      } else if (gw && typeof gw.close === 'function') {
        // close 只停隧道进程，不关 Express
        gw.close();
      }
      res.json({ ok:true, msg:'隧道已停止' });
    } catch(e) {
      res.status(500).json({ ok:false, msg:e.message });
    }
  });

  // POST /api/config — 保存服务配置
  router.post('/api/config', localOnly, express.json({ limit:'8kb' }), function(req, res) {
    try {
      var body = req.body || {};
      var saved = readJson(config.RUNTIME.config);
      if (body.sdHost)  { saved.sdHost  = String(body.sdHost).trim();  config.SD_HOST  = saved.sdHost;  }
      if (body.ttsHost) { saved.ttsHost = String(body.ttsHost).trim(); config.TTS_HOST = saved.ttsHost; }
      if (body.voices && typeof body.voices === 'object') {
        saved.voices = body.voices;
        config.VOICE_PROFILES = body.voices;
      }
      writeJson(config.RUNTIME.config, saved);
      res.json({ ok:true });
    } catch(e) {
      res.status(500).json({ error:e.message });
    }
  });

  // POST /api/preference — 保存偏好设置（autoStartVoice 等）
  router.post('/api/preference', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    try {
      var body = req.body || {};
      var saved = readJson(config.RUNTIME.config);
      if (typeof body.autoStartVoice === 'boolean') saved.autoStartVoice = body.autoStartVoice;
      writeJson(config.RUNTIME.config, saved);
      res.json({ ok:true });
    } catch(e) {
      res.status(500).json({ error:e.message });
    }
  });

  // GET /api/logs?since=N — 返回运行日志
  router.get('/api/logs', function(req, res) {
    var since  = parseInt(req.query.since, 10) || 0;
    var lines  = [];
    var logFiles = [
      config.RUNTIME && config.RUNTIME.gatewayLog,
      config.RUNTIME && config.RUNTIME.tunnelLog,
    ].filter(Boolean);
    logFiles.forEach(function(f) {
      lines = lines.concat(tailLog(f, since));
    });
    // 如果没有日志文件，返回进程启动信息
    if (!lines.length && since === 0) {
      lines = ['[' + new Date().toISOString().slice(0,19) + '] 网关已就绪，端口 ' + config.PORT];
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ logs:lines, total:since + lines.length });
  });

  // GET /api/diagnostics — 诊断包
  router.get('/api/diagnostics', localOnly, function(req, res) {
    var saved = readJson(config.RUNTIME.config);
    res.json({
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      port: config.PORT,
      sdHost: config.SD_HOST,
      ttsHost: config.TTS_HOST,
      ollamaHost: config.OLLAMA_HOST,
      sceneShowcaseDir: config.SCENE_SHOWCASE_DIR || '',
      disableTunnel: !!config.DISABLE_TUNNEL,
      runtimeConfig: saved,
      nodeVersion: process.version,
      platform: process.platform
    });
  });

  return router;
}

module.exports = { createControlRouter };
