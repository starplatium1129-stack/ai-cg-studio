'use strict';
/**
 * routes/control.js — 控制面板 API
 * 恢复重构前 control-server 的服务启停能力：
 *   /api/status /api/start /api/stop /api/config /api/preference
 *   /api/service/voice|webui|ollama  /api/mode
 *   /api/logs /api/diagnostics
 */

var express = require('express');
var fs      = require('fs');
var path    = require('path');
var http    = require('http');
var https   = require('https');
var cp      = require('child_process');
var createOperationManager = require('../services/control-operation').createOperationManager;

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

function requestLocalJson(baseUrl, apiPath, body, timeoutMs) {
  return new Promise(function (resolve, reject) {
    try {
      var u = new URL(apiPath, baseUrl);
      var lib = u.protocol === 'https:' ? https : http;
      var payload = body ? JSON.stringify(body) : null;
      var req = lib.request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + (u.search || ''),
        method: payload ? 'POST' : 'GET',
        headers: payload ? { 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
        timeout: timeoutMs || 4000
      }, function (res) {
        var chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
          var raw = Buffer.concat(chunks).toString('utf8');
          var data = null;
          try { data = raw ? JSON.parse(raw) : null; } catch {}
          resolve({ status: res.statusCode || 0, data: data, raw: raw });
        });
      });
      req.on('error', reject);
      req.on('timeout', function () { req.destroy(new Error('timeout')); });
      if (payload) req.write(payload);
      req.end();
    } catch (e) { reject(e); }
  });
}

function pingSd(urlStr, timeoutMs) {
  return requestLocalJson(urlStr, '/sdapi/v1/sd-models', null, timeoutMs || 2500)
    .then(function (r) { return r.status >= 200 && r.status < 500; })
    .catch(function () { return false; });
}
function pingTts(urlStr, timeoutMs) {
  return requestLocalJson(urlStr, '/docs', null, timeoutMs || 2500)
    .then(function (r) { return r.status >= 200 && r.status < 500; })
    .catch(function () {
      return requestLocalJson(urlStr, '/', null, timeoutMs || 2500)
        .then(function (r) { return r.status >= 200 && r.status < 500; })
        .catch(function () { return false; });
    });
}
function pingOllamaDetail(urlStr, timeoutMs) {
  return requestLocalJson(urlStr, '/api/ps', null, timeoutMs || 3000)
    .then(function (r) {
      if (!(r.status >= 200 && r.status < 300)) return { online:false, models:[], vram:0 };
      var models = Array.isArray(r.data && r.data.models) ? r.data.models : [];
      var vram = 0;
      models.forEach(function (m) {
        var size = Number(m.size_vram || m.size || 0);
        if (Number.isFinite(size)) vram += size;
      });
      return {
        online: true,
        models: models.map(function (m) { return String(m.name || m.model || ''); }).filter(Boolean),
        vram: vram
      };
    })
    .catch(function () {
      return requestLocalJson(urlStr, '/api/tags', null, timeoutMs || 3000)
        .then(function (r) { return { online: r.status === 200, models:[], vram:0 }; })
        .catch(function () { return { online:false, models:[], vram:0 }; });
    });
}

function tailLog(file, since) {
  try {
    if (!fs.existsSync(file)) return [];
    var lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    return lines.slice(Math.max(0, since || 0));
  } catch { return []; }
}

function createControlRouter(config, gatewayRef) {
  var router = express.Router();
  var startTime = Date.now();
  var rootDir = config.ROOT_DIR || path.join(__dirname, '..');
  var VOICE_START_SCRIPT = path.resolve(rootDir, '..', 'AI', 'Voice', 'Start-Voice.ps1');
  var VOICE_STOP_SCRIPT  = path.resolve(rootDir, '..', 'AI', 'Voice', 'Stop-Voice.ps1');
  var WEBUI_MANAGER_SCRIPT = path.join(rootDir, 'scripts', 'runtime', 'managed-webui.ps1');

  var state = {
    operation: null,
    modeBusy: false,
    webuiManaged: false,
    ollamaModels: [],
    ollamaVram: 0,
    controlLogs: []
  };
  var ops = createOperationManager(state);

  function controlLog(msg) {
    var line = '[' + new Date().toLocaleTimeString('zh-CN', { hour12:false }) + '] ' + msg;
    state.controlLogs.push(line);
    if (state.controlLogs.length > 200) state.controlLogs.shift();
    try {
      if (config.RUNTIME && config.RUNTIME.controlLog) {
        fs.appendFileSync(config.RUNTIME.controlLog, line + '\n', 'utf8');
      }
    } catch {}
    console.log(line);
  }

  function localOnly(req, res, next) {
    var ip = req.ip || '';
    var local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
    if (!local) return res.status(403).json({ error:'该操作仅限本机使用' });
    next();
  }

  function runScriptAsync(scriptPath, args, timeoutMs) {
    return new Promise(function (resolve) {
      if (!fs.existsSync(scriptPath)) {
        resolve({ ok:false, error:'脚本未安装：' + path.basename(scriptPath) });
        return;
      }
      var child;
      try {
        child = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath].concat(args || []), {
          cwd: rootDir,
          windowsHide: true
        });
      } catch (error) {
        resolve({ ok:false, error:error.message });
        return;
      }
      var stdout = '';
      var stderr = '';
      var finished = false;
      function done(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(result);
      }
      var timer = setTimeout(function () {
        try { child.kill(); } catch {}
        done({ ok:false, error:'操作超时（' + Math.round((timeoutMs || 60000) / 1000) + ' 秒）' });
      }, timeoutMs || 60000);
      child.stdout.on('data', function (chunk) { stdout += chunk.toString('utf8'); });
      child.stderr.on('data', function (chunk) { stderr += chunk.toString('utf8'); });
      child.on('error', function (error) { done({ ok:false, error:error.message }); });
      child.on('close', function (code) {
        var output = String(stdout || '').trim();
        if (code === 0) done({ ok:true, message: output, stdout: output, stderr: String(stderr || '').trim() });
        else done({ ok:false, error:(stderr || stdout || '脚本退出码 ' + code).trim(), message: output });
      });
    });
  }

  async function refreshServiceStates() {
    var results = await Promise.all([
      pingSd(config.SD_HOST, 2500),
      pingTts(config.TTS_HOST, 2500),
      pingOllamaDetail(config.OLLAMA_HOST, 3000)
    ]);
    state.sdOnline = results[0];
    state.ttsOnline = results[1];
    state.ollamaOnline = results[2].online;
    state.ollamaModels = results[2].models;
    state.ollamaVram = results[2].vram;
    if (fs.existsSync(WEBUI_MANAGER_SCRIPT)) {
      var status = await runScriptAsync(WEBUI_MANAGER_SCRIPT, ['-Action', 'Status'], 15000);
      if (status.ok && status.message) {
        try {
          var parsed = JSON.parse(status.message);
          state.webuiManaged = !!parsed.managed;
        } catch {}
      }
    }
    return {
      sdOnline: state.sdOnline,
      ttsOnline: state.ttsOnline,
      ollamaOnline: state.ollamaOnline,
      ollamaModels: state.ollamaModels,
      ollamaVram: state.ollamaVram,
      webuiManaged: state.webuiManaged
    };
  }

  async function unloadOllamaModels() {
    var listed = await requestLocalJson(config.OLLAMA_HOST, '/api/ps', null, 4000).catch(function () { return null; });
    if (!listed || listed.status >= 300) return { ok:false, error:'Ollama 未响应' };
    var models = Array.isArray(listed.data && listed.data.models) ? listed.data.models : [];
    if (!models.length) return { ok:true, message:'Ollama 没有已加载的模型' };
    var unloaded = 0;
    for (var i = 0; i < models.length; i += 1) {
      var name = String(models[i].name || models[i].model || '');
      if (!name) continue;
      var result = await requestLocalJson(config.OLLAMA_HOST, '/api/generate', { model:name, keep_alive:0, stream:false }, 20000).catch(function () { return null; });
      if (result && result.status < 300) unloaded += 1;
    }
    await refreshServiceStates();
    return { ok: unloaded > 0 || models.length === 0, message: '已卸载 ' + unloaded + ' 个 Ollama 模型，显存已释放' };
  }

  // GET /api/sd-status — 导演台 / 出图页连接检测
  router.get('/api/sd-status', function (req, res) {
    var host = config.SD_HOST;
    Promise.all([
      requestLocalJson(host, '/sdapi/v1/sd-models', null, 5000).catch(function () { return null; }),
      requestLocalJson(host, '/sdapi/v1/samplers', null, 5000).catch(function () { return null; }),
      requestLocalJson(host, '/sdapi/v1/schedulers', null, 5000).catch(function () { return null; }),
      requestLocalJson(host, '/sdapi/v1/upscalers', null, 5000).catch(function () { return null; }),
      requestLocalJson(host, '/sdapi/v1/options', null, 5000).catch(function () { return null; })
    ]).then(function (parts) {
      var modelsRes = parts[0];
      var online = !!(modelsRes && modelsRes.status >= 200 && modelsRes.status < 300);
      var models = online && Array.isArray(modelsRes.data)
        ? modelsRes.data.map(function (m) { return m.title || m.model_name || m.name || ''; }).filter(Boolean)
        : [];
      var samplers = parts[1] && Array.isArray(parts[1].data)
        ? parts[1].data.map(function (s) { return s.name || s; }).filter(Boolean)
        : [];
      var schedulers = parts[2] && Array.isArray(parts[2].data)
        ? parts[2].data.map(function (s) { return s.name || s.label || s; }).filter(Boolean)
        : [];
      var upscalers = parts[3] && Array.isArray(parts[3].data)
        ? parts[3].data.map(function (s) { return s.name || s; }).filter(Boolean)
        : [];
      var options = parts[4] && parts[4].data && typeof parts[4].data === 'object' ? parts[4].data : {};
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        online: online,
        host: host,
        models: models,
        samplers: samplers,
        schedulers: schedulers,
        upscalers: upscalers,
        checkpoint: options.sd_model_checkpoint || '',
        error: online ? '' : 'SD WebUI 未响应（' + host + '）'
      });
    }).catch(function (e) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ online:false, host:host, models:[], samplers:[], schedulers:[], upscalers:[], error:e.message });
    });
  });

  // GET /api/status
  router.get('/api/status', function(req, res) {
    var force = req.query.fresh === '1';
    refreshServiceStates().then(function(services) {
      var gw = gatewayRef ? gatewayRef() : null;
      var tunnelUrl = gw ? gw.tunnelUrl : '';
      var tunnelStatus = tunnelUrl ? 'active' : (config.DISABLE_TUNNEL ? 'disabled' : 'waiting');
      var saved = readJson(config.RUNTIME.config);
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok: true,
        running: true,
        sdOnline: services.sdOnline,
        ttsOnline: services.ttsOnline,
        ollamaOnline: services.ollamaOnline,
        ollamaModels: services.ollamaModels,
        ollamaVram: services.ollamaVram,
        webuiManaged: services.webuiManaged,
        modeBusy: !!state.modeBusy,
        operation: state.operation,
        sdHost: config.SD_HOST,
        ttsHost: config.TTS_HOST,
        ollamaHost: config.OLLAMA_HOST,
        localLink: 'http://127.0.0.1:' + config.PORT + '/',
        shareLink: tunnelUrl ? (tunnelUrl + '/?token=' + encodeURIComponent(config.TOKEN)) : '',
        tunnelStatus: tunnelStatus,
        tunnelAvailable: !config.DISABLE_TUNNEL && !!config.CLOUDFLARED_PATH,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        autoStartVoice: !!saved.autoStartVoice,
        voices: config.VOICE_PROFILES || {},
        scripts: {
          voiceStart: fs.existsSync(VOICE_START_SCRIPT),
          voiceStop: fs.existsSync(VOICE_STOP_SCRIPT),
          webui: fs.existsSync(WEBUI_MANAGER_SCRIPT)
        }
      });
    }).catch(function(e) {
      res.status(500).json({ error: e.message });
    });
  });

  // POST /api/start — 启动公网隧道
  router.post('/api/start', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    try {
      var gw = gatewayRef ? gatewayRef() : null;
      if (gw && typeof gw.startTunnel === 'function') gw.startTunnel();
      // 记住偏好：下次启动网关时自动开分享
      try {
        var saved = readJson(config.RUNTIME.config);
        saved.autoTunnel = true;
        writeJson(config.RUNTIME.config, saved);
      } catch (e) {}
      controlLog('公网分享通道已请求启动');
      res.json({ ok:true, msg:'公网分享通道已启动' });
    } catch(e) {
      res.status(500).json({ ok:false, msg:e.message });
    }
  });

  // POST /api/stop — 停止公网隧道（不动网关与生成服务）
  router.post('/api/stop', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    try {
      var gw = gatewayRef ? gatewayRef() : null;
      if (gw && typeof gw.stopTunnel === 'function') gw.stopTunnel();
      // 记住偏好：下次不再自动开分享，否则重启后又会“自己打开”
      try {
        var saved = readJson(config.RUNTIME.config);
        saved.autoTunnel = false;
        writeJson(config.RUNTIME.config, saved);
      } catch (e) {}
      controlLog('公网分享通道已停止');
      res.json({ ok:true, msg:'公网分享通道已停止' });
    } catch(e) {
      res.status(500).json({ ok:false, msg:e.message });
    }
  });

  // POST /api/config
  router.post('/api/config', localOnly, express.json({ limit:'8kb' }), function(req, res) {
    try {
      var body = req.body || {};
      var saved = readJson(config.RUNTIME.config);
      if (body.sdHost)  { saved.sdHost  = String(body.sdHost).trim();  config.SD_HOST  = saved.sdHost;  }
      if (body.ttsHost) { saved.ttsHost = String(body.ttsHost).trim(); config.TTS_HOST = saved.ttsHost; }
      if (body.ollamaHost) { saved.ollamaHost = String(body.ollamaHost).trim(); config.OLLAMA_HOST = saved.ollamaHost; }
      if (body.voices && typeof body.voices === 'object') {
        saved.voices = body.voices;
        config.VOICE_PROFILES = body.voices;
      }
      if (typeof body.autoStartVoice === 'boolean') saved.autoStartVoice = body.autoStartVoice;
      writeJson(config.RUNTIME.config, saved);
      controlLog('服务配置已保存');
      res.json({ ok:true, sdHost:config.SD_HOST, ttsHost:config.TTS_HOST, ollamaHost:config.OLLAMA_HOST });
    } catch(e) {
      res.status(500).json({ error:e.message });
    }
  });

  // POST /api/preference
  router.post('/api/preference', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    try {
      var body = req.body || {};
      var saved = readJson(config.RUNTIME.config);
      if (typeof body.autoStartVoice === 'boolean') saved.autoStartVoice = body.autoStartVoice;
      writeJson(config.RUNTIME.config, saved);
      res.json({ ok:true, autoStartVoice: !!saved.autoStartVoice });
    } catch(e) {
      res.status(500).json({ error:e.message });
    }
  });

  // POST /api/service/voice
  router.post('/api/service/voice', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    var action = req.body && req.body.action;
    if (!['start', 'stop'].includes(action)) return res.status(400).json({ ok:false, error:'action 必须是 start 或 stop' });
    if (ops.rejectConflict(res)) return;
    var operation = ops.begin('voice-' + action, action === 'start' ? '启动语音服务' : '停止语音服务', [
      action === 'start' ? '正在启动 GPT-SoVITS' : '正在停止 GPT-SoVITS',
      '正在验证语音服务状态'
    ]);
    var task = action === 'start'
      ? runScriptAsync(VOICE_START_SCRIPT, ['-WaitSeconds', '60'], 90000)
      : runScriptAsync(VOICE_STOP_SCRIPT, [], 30000);
    task.then(async function (result) {
      ops.update(operation, 1);
      await refreshServiceStates();
      var expected = action === 'start';
      if (!result.ok && !!state.ttsOnline === expected) {
        controlLog('GPT-SoVITS 脚本返回提示，但目标状态已达成: ' + (result.error || '未知提示'));
      } else if (!result.ok) {
        throw new Error(result.error || '语音服务操作失败');
      }
      if (!!state.ttsOnline !== expected) {
        throw new Error(action === 'start'
          ? '启动脚本已结束，但语音接口尚未通过健康检查'
          : '停止脚本已结束，但语音接口仍可访问');
      }
      controlLog('GPT-SoVITS ' + (action === 'start' ? '已启动' : '已停止'));
      ops.finish(operation, null, action === 'start' ? '语音服务已就绪' : '语音服务已停止');
    }).catch(function (error) {
      controlLog('GPT-SoVITS ' + action + ' 失败: ' + error.message);
      ops.finish(operation, error.message);
    });
    res.json({
      ok:true, pending:true, operation:operation,
      message:'语音服务正在' + (action === 'start' ? '启动（约需 30–60 秒）' : '停止')
    });
  });

  // POST /api/service/webui
  router.post('/api/service/webui', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    var action = req.body && req.body.action;
    if (!['start', 'stop'].includes(action)) return res.status(400).json({ ok:false, error:'action 必须是 start 或 stop' });
    if (ops.rejectConflict(res)) return;
    var operation = ops.begin('webui-' + action, action === 'start' ? '启动绘图服务' : '停止绘图服务', [
      action === 'start' ? '正在启动 SD WebUI' : '正在停止 SD WebUI',
      '正在验证绘图服务状态'
    ]);
    runScriptAsync(WEBUI_MANAGER_SCRIPT, ['-Action', action === 'start' ? 'Start' : 'Stop'], 90000).then(async function (result) {
      if (result.ok && result.message) {
        try {
          var parsed = JSON.parse(result.message);
          state.webuiManaged = !!parsed.managed;
          if (parsed.message) result.message = parsed.message;
        } catch {}
      }
      ops.update(operation, 1);
      await refreshServiceStates();
      var expected = action === 'start';
      if (!result.ok && !!state.sdOnline === expected) {
        controlLog('WebUI 脚本返回提示，但目标状态已达成: ' + (result.error || '未知提示'));
      } else if (!result.ok) {
        throw new Error(result.error || 'WebUI 操作失败');
      }
      if (!!state.sdOnline !== expected) {
        throw new Error(action === 'start'
          ? '启动脚本已结束，但 WebUI API 尚未通过健康检查'
          : '停止脚本已结束，但 WebUI API 仍可访问');
      }
      controlLog('WebUI ' + (action === 'start' ? '已启动' : '已停止'));
      ops.finish(operation, null, action === 'start' ? '绘图服务已就绪' : '绘图服务已停止');
    }).catch(function (error) {
      controlLog('WebUI ' + action + ' 失败: ' + error.message);
      ops.finish(operation, error.message);
    });
    res.json({
      ok:true, pending:true, operation:operation,
      message:'WebUI 正在' + (action === 'start' ? '启动' : '停止')
    });
  });

  // POST /api/service/ollama
  router.post('/api/service/ollama', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    var action = req.body && req.body.action;
    if (action !== 'unload') return res.status(400).json({ ok:false, error:'action 目前只支持 unload' });
    if (ops.rejectConflict(res)) return;
    var operation = ops.begin('ollama-unload', '释放聊天模型显存', ['正在卸载 Ollama 模型', '正在验证显存释放结果']);
    unloadOllamaModels().then(function (result) {
      if (!result.ok) throw new Error(result.error || 'Ollama 卸载失败');
      ops.update(operation, 1);
      return refreshServiceStates().then(function () {
        if (state.ollamaModels.length) throw new Error('仍有 ' + state.ollamaModels.length + ' 个模型占用显存');
        controlLog(result.message || 'Ollama 模型已卸载');
        ops.finish(operation, null, '聊天模型显存已释放');
      });
    }).catch(function (error) {
      controlLog('Ollama 卸载失败: ' + error.message);
      ops.finish(operation, error.message);
    });
    res.json({ ok:true, pending:true, operation:operation, message:'正在卸载 Ollama 已加载模型…' });
  });

  // POST /api/mode — 绘图优先 / 聊天优先
  router.post('/api/mode', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    var mode = req.body && req.body.mode;
    if (!['draw', 'chat'].includes(mode)) return res.status(400).json({ ok:false, error:'mode 必须是 draw 或 chat' });
    if (ops.rejectConflict(res)) return;
    var stages = mode === 'draw'
      ? ['正在停止语音服务', '正在卸载聊天模型', '正在启动 SD WebUI', '正在验证绘图环境']
      : ['正在释放受管 WebUI', '正在启动语音服务', '正在验证聊天环境'];
    var operation = ops.begin('mode-' + mode, mode === 'draw' ? '切换到绘图优先' : '切换到聊天优先', stages);
    state.modeBusy = true;
    res.json({
      ok:true, pending:true, operation:operation,
      message: mode === 'draw'
        ? '正在切换到绘图优先：先释放语音与聊天模型显存，再启动 WebUI'
        : '正在切换到聊天优先：释放受管 WebUI，启动语音服务'
    });

    (async function () {
      if (mode === 'draw') {
        controlLog('模式切换：绘图优先 — 停止语音服务');
        var stopVoice = await runScriptAsync(VOICE_STOP_SCRIPT, [], 30000);
        if (!stopVoice.ok) controlLog('停止语音服务时出现提示: ' + stopVoice.error);
        ops.update(operation, 1);
        controlLog('模式切换：绘图优先 — 卸载 Ollama 模型');
        var unload = await unloadOllamaModels();
        if (!unload.ok) controlLog('Ollama 卸载提示: ' + (unload.error || unload.message || ''));
        ops.update(operation, 2);
        controlLog('模式切换：绘图优先 — 启动 WebUI');
        var startWebui = await runScriptAsync(WEBUI_MANAGER_SCRIPT, ['-Action', 'Start'], 90000);
        if (startWebui.ok) {
          try { state.webuiManaged = !!JSON.parse(startWebui.message || '{}').managed; } catch {}
          controlLog('绘图优先模式就绪：显存已优先让给 WebUI');
        } else {
          throw new Error('WebUI 启动失败: ' + startWebui.error);
        }
        ops.update(operation, 3);
      } else {
        if (state.webuiManaged) {
          controlLog('模式切换：聊天优先 — 停止受管 WebUI 释放显存');
          var stopWebui = await runScriptAsync(WEBUI_MANAGER_SCRIPT, ['-Action', 'Stop'], 60000);
          if (stopWebui.ok) {
            try { state.webuiManaged = !!JSON.parse(stopWebui.message || '{}').managed; } catch {}
          } else {
            controlLog('停止 WebUI 时出现提示: ' + stopWebui.error);
          }
        } else {
          controlLog('模式切换：聊天优先 — WebUI 为手动启动或非受管，保持不动');
        }
        ops.update(operation, 1);
        controlLog('模式切换：聊天优先 — 启动语音服务');
        var startVoice = await runScriptAsync(VOICE_START_SCRIPT, ['-WaitSeconds', '60'], 90000);
        if (startVoice.ok) controlLog('聊天优先模式就绪：语音服务已启动');
        else throw new Error('语音服务启动失败: ' + startVoice.error);
        ops.update(operation, 2);
      }
      await refreshServiceStates();
      if (mode === 'draw' && !state.sdOnline) throw new Error('WebUI 未通过最终健康检查');
      if (mode === 'chat' && !state.ttsOnline) throw new Error('语音服务未通过最终健康检查');
      state.modeBusy = false;
      ops.finish(operation, null, mode === 'draw' ? '绘图环境已就绪' : '聊天环境已就绪');
    })().catch(function (error) {
      controlLog('模式切换失败: ' + error.message);
      refreshServiceStates();
      state.modeBusy = false;
      ops.finish(operation, error.message);
    });
  });

  // GET /api/logs
  router.get('/api/logs', function(req, res) {
    var since  = parseInt(req.query.since, 10) || 0;
    var lines  = state.controlLogs.slice(since);
    var logFiles = [
      config.RUNTIME && config.RUNTIME.gatewayLog,
      config.RUNTIME && config.RUNTIME.tunnelLog,
      config.RUNTIME && config.RUNTIME.controlLog,
    ].filter(Boolean);
    logFiles.forEach(function(f) {
      lines = lines.concat(tailLog(f, 0).slice(-30));
    });
    if (!lines.length && since === 0) {
      lines = ['[' + new Date().toISOString().slice(0,19) + '] 网关已就绪，端口 ' + config.PORT];
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ logs:lines, total: since + lines.length, operation: state.operation });
  });

  // GET /api/diagnostics
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
      scripts: {
        voiceStart: VOICE_START_SCRIPT,
        voiceStop: VOICE_STOP_SCRIPT,
        webui: WEBUI_MANAGER_SCRIPT,
        voiceStartExists: fs.existsSync(VOICE_START_SCRIPT),
        voiceStopExists: fs.existsSync(VOICE_STOP_SCRIPT),
        webuiExists: fs.existsSync(WEBUI_MANAGER_SCRIPT)
      },
      nodeVersion: process.version,
      platform: process.platform,
      operation: state.operation
    });
  });

  // 启动时探测一次受管 WebUI 状态
  refreshServiceStates().catch(function () {});

  return router;
}

module.exports = { createControlRouter };
