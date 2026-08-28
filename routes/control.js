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
var security = require('../server/security');
var diagnostics = require('../server/diagnostics');
var envelope = require('../server/http-envelope');
// P3 收口：本机上游 JSON 请求与 SD/TTS/Comfy/Ollama 探活统一走 server/upstream-health
var upstreamHealth = require('../server/upstream-health');
var localOnly = security.localOnly;
var createOperationManager = require('../services/control-operation').createOperationManager;
var createServiceWatchdog = require('../services/service-watchdog').createServiceWatchdog;
// 子进程登记表与进程树回收：构建进程与维护脚本共用同一份，网关退出时一并回收
var maintenanceRuntime = require('./maintenance');
var webBuild = require('./control/web-build');
var webBuildInfo = webBuild.webBuildInfo;
var runWebBuild = webBuild.runWebBuild;
var createScriptRunner = require('./control/script-runner').createScriptRunner;

// ── 前端构建状态与触发已拆至 routes/control/web-build.js（2026-08-29 审计 P1-10）──
var WEBUI_START_TIMEOUT_MS = 6 * 60 * 1000;

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

const pingSd = upstreamHealth.pingSd;
const pingTts = upstreamHealth.pingTts;
const pingComfy = upstreamHealth.pingComfy;
const pingOllamaDetail = upstreamHealth.pingOllamaDetail;

function createControlRouter(config, gatewayRef, dependencies) {
  dependencies = dependencies || {};
  var router = express.Router();
  var persistConfig = typeof dependencies.writeJson === 'function' ? dependencies.writeJson : writeJson;
  var startTime = Date.now();
  var rootDir = config.ROOT_DIR || path.join(__dirname, '..');
  // 桌面打包版把 AI 工作区放在 AI_WORKSPACE_ROOT（可在安装目录之外），
  // 语音启停脚本必须在工作区内；回退到 appRoot 的兄弟目录（源码运行布局）。
  var voiceRoot = config.AI_WORKSPACE_ROOT || path.resolve(rootDir, '..', 'AI');
  var VOICE_START_SCRIPT = path.resolve(voiceRoot, 'Voice', 'Start-Voice.ps1');
  var VOICE_STOP_SCRIPT  = path.resolve(voiceRoot, 'Voice', 'Stop-Voice.ps1');
  var scriptsRoot = config.SCRIPTS_ROOT || path.join(rootDir, 'scripts');
  var WEBUI_MANAGER_SCRIPT = path.join(scriptsRoot, 'lib', 'managed-webui.ps1');
  var COMFY_MANAGER_SCRIPT = path.join(scriptsRoot, 'lib', 'managed-comfyui.ps1');
  var WEBUI_PACKAGE_ROOT = path.join(voiceRoot, 'Data', 'Packages', 'Stable Diffusion WebUI reForge');
  var WEBUI_IMAGES_ROOT = path.join(voiceRoot, 'Data', 'Images');
  var WEBUI_CONTROLNET_ROOT = path.join(voiceRoot, 'Data', 'Models', 'ControlNet');
  var runtimeRoot = config.RUNTIME_ROOT || (config.RUNTIME && config.RUNTIME.root) || path.join(rootDir, 'runtime');

  var state = {
    operation: null,
    modeBusy: false,
    webuiManaged: false,
    comfyManaged: false,
    comfyOnline: false,
    desiredWebui: false,
    desiredComfy: false,
    ttsManaged: false,
    ollamaModels: [],
    ollamaVram: 0,
    controlLogs: [],
    // 2026-08-16 审计：控制日志游标要用单调递增序号，而不是环形缓冲长度——
    // 缓冲满 200 后长度恒 200，纯长度游标再也拿不到新行。controlLogSeq 只增不减。
    controlLogSeq: 0
  };
  var ops = createOperationManager(state);
  var watchdog = null;
  try {
    var savedManaged = readJson(config.RUNTIME.config).managedServices || {};
    state.desiredWebui = savedManaged.webui === true;
    state.desiredComfy = savedManaged.comfy === true;
  } catch (error) {}

  function saveManagedDesired() {
    var saved = readJson(config.RUNTIME.config);
    saved.managedServices = { webui:!!state.desiredWebui, comfy:!!state.desiredComfy };
    persistConfig(config.RUNTIME.config, saved);
  }

  function managedScriptArgs(service, action) {
    if (service === 'webui') return [
      '-Action', action, '-PackageRoot', WEBUI_PACKAGE_ROOT, '-RuntimeRoot', runtimeRoot,
      '-WebuiHost', config.SD_HOST, '-ImagesRoot', WEBUI_IMAGES_ROOT, '-ControlNetRoot', WEBUI_CONTROLNET_ROOT
    ];
    return ['-Action', action, '-AIWorkspaceRoot', voiceRoot, '-RuntimeRoot', runtimeRoot, '-ComfyHost', config.COMFY_HOST];
  }

  function controlLog(msg) {
    var line = '[' + new Date().toLocaleTimeString('zh-CN', { hour12:false }) + '] ' + msg;
    state.controlLogs.push(line);
    state.controlLogSeq += 1;
    if (state.controlLogs.length > 200) state.controlLogs.shift();
    try {
      if (config.RUNTIME && config.RUNTIME.controlLog) {
        fs.appendFileSync(config.RUNTIME.controlLog, line + '\n', 'utf8');
      }
    } catch {}
    console.log(line);
  }

  // localOnly 由 server/security.js 统一提供。
  // 曾经这里有一份只比对 req.ip 的副本，而 cloudflared 是从 127.0.0.1 连进来的，
  // 于是隧道一开，所有公网请求都被判成「本机」，控制面板的启停/改 host 全部敞开。

  // PowerShell 脚本执行器已拆至 routes/control/script-runner.js（2026-08-29
  // 审计 P1-10）：连子孙终止的行为原样搬走（processTree.killProcessTree）。
  var scriptRunner = createScriptRunner({ rootDir: rootDir });
  var runScriptAsync = scriptRunner.runScriptAsync;

  var runManagedScript = typeof dependencies.runScriptAsync === 'function'
    ? dependencies.runScriptAsync
    : runScriptAsync;

  // managed-webui.ps1 -Action Status 单次实测 ~2.2 秒，而控制面板 3 秒轮询一次 →
  // 不缓存的话面板一开就永久重叠 spawn PowerShell。缓存 + in-flight 去重 + fresh=1 强制刷新。
  var WEBUI_STATUS_TTL = 15000;
  var webuiStatusCache = { at:0, managed:false, comfy:false };
  var webuiStatusInflight = null;

  function readWebuiManaged(force) {
    if (!fs.existsSync(WEBUI_MANAGER_SCRIPT)) return Promise.resolve(state.webuiManaged);
    var cacheFresh = Date.now() - webuiStatusCache.at < WEBUI_STATUS_TTL;
    if (!force && cacheFresh) return Promise.resolve(webuiStatusCache.managed);
    // 已有探测在飞就复用，避免并发轮询叠加 spawn
    if (webuiStatusInflight) return webuiStatusInflight;

    webuiStatusInflight = runManagedScript(WEBUI_MANAGER_SCRIPT, managedScriptArgs('webui', 'Status'), 15000)
      .then(function (status) {
        webuiStatusCache.at = Date.now();
        if (status.ok && status.message) {
          try {
            webuiStatusCache.managed = !!JSON.parse(status.message).managed;
          } catch (error) {
            // 输出不是合法 JSON：留个痕，别静默把旧值当新值
            controlLog('WebUI 状态脚本输出无法解析，沿用上一次结果');
          }
        }
        return webuiStatusCache.managed;
      })
      .catch(function (error) {
        controlLog('WebUI 状态探测失败: ' + error.message);
        return webuiStatusCache.managed;
      })
      .finally(function () { webuiStatusInflight = null; });

    return webuiStatusInflight;
  }

  function readComfyManaged(force) {
    if (!fs.existsSync(COMFY_MANAGER_SCRIPT)) return Promise.resolve(state.comfyManaged);
    var cacheFresh = Date.now() - webuiStatusCache.at < WEBUI_STATUS_TTL;
    if (!force && cacheFresh) return Promise.resolve(webuiStatusCache.comfy);
    return runManagedScript(COMFY_MANAGER_SCRIPT, managedScriptArgs('comfy', 'Status'), 15000)
      .then(function (status) {
        webuiStatusCache.at = Date.now();
        if (status.ok && status.message) {
          try { webuiStatusCache.comfy = !!JSON.parse(status.message).managed; }
          catch (error) { controlLog('ComfyUI 状态脚本输出无法解析，沿用上一次结果'); }
        }
        return webuiStatusCache.comfy;
      })
      .catch(function (error) {
        controlLog('ComfyUI 状态探测失败: ' + error.message);
        return webuiStatusCache.comfy;
      });
  }

  async function refreshServiceStates(force) {
    if (typeof dependencies.refreshServiceStates === 'function') {
      var supplied = await dependencies.refreshServiceStates(force) || {};
      state.sdOnline = !!supplied.sdOnline;
      state.comfyOnline = !!supplied.comfyOnline;
      state.ttsOnline = !!supplied.ttsOnline;
      state.ollamaOnline = !!supplied.ollamaOnline;
      state.ollamaModels = Array.isArray(supplied.ollamaModels) ? supplied.ollamaModels : [];
      state.ollamaVram = Number(supplied.ollamaVram) || 0;
      if (typeof supplied.webuiManaged === 'boolean') state.webuiManaged = supplied.webuiManaged;
      if (typeof supplied.comfyManaged === 'boolean') state.comfyManaged = supplied.comfyManaged;
      return {
        sdOnline: state.sdOnline,
        comfyOnline: state.comfyOnline,
        ttsOnline: state.ttsOnline,
        ollamaOnline: state.ollamaOnline,
        ollamaModels: state.ollamaModels,
        ollamaVram: state.ollamaVram,
        webuiManaged: state.webuiManaged,
        comfyManaged: state.comfyManaged
      };
    }
    var results = await Promise.all([
      pingSd(config.SD_HOST, 2500),
      pingComfy(config.COMFY_HOST, 2500),
      pingTts(config.TTS_HOST, 2500),
      pingOllamaDetail(config.OLLAMA_HOST, 3000),
      readWebuiManaged(!!force),
      readComfyManaged(!!force)
    ]);
    state.sdOnline = results[0];
    state.comfyOnline = results[1];
    state.ttsOnline = results[2];
    state.ollamaOnline = results[3].online;
    state.ollamaModels = results[3].models;
    state.ollamaVram = results[3].vram;
    state.webuiManaged = results[4];
    state.comfyManaged = results[5];
    return {
      sdOnline: state.sdOnline,
      comfyOnline: state.comfyOnline,
      ttsOnline: state.ttsOnline,
      ollamaOnline: state.ollamaOnline,
      ollamaModels: state.ollamaModels,
      ollamaVram: state.ollamaVram,
      webuiManaged: state.webuiManaged,
      comfyManaged: state.comfyManaged
    };
  }

  async function unloadOllamaModels() {
    var listed = await upstreamHealth.requestJson(config.OLLAMA_HOST, '/api/ps', null, 4000).catch(function () { return null; });
    if (!listed || listed.status >= 300) return { ok:false, error:'Ollama 未响应' };
    var models = Array.isArray(listed.data && listed.data.models) ? listed.data.models : [];
    if (!models.length) return { ok:true, message:'Ollama 没有已加载的模型' };
    var unloaded = 0;
    for (var i = 0; i < models.length; i += 1) {
      var name = String(models[i].name || models[i].model || '');
      if (!name) continue;
      var result = await upstreamHealth.requestJson(config.OLLAMA_HOST, '/api/generate', { model:name, keep_alive:0, stream:false }, 20000).catch(function () { return null; });
      if (result && result.status < 300) unloaded += 1;
    }
    await refreshServiceStates();
    return { ok: unloaded > 0 || models.length === 0, message: '已卸载 ' + unloaded + ' 个 Ollama 模型，显存已释放' };
  }

  // GET /api/sd-status — 导演台 / 出图页连接检测
  router.get('/api/sd-status', function (req, res) {
    var host = config.SD_HOST;
    Promise.all([
      upstreamHealth.requestJson(host, '/sdapi/v1/sd-models', null, 5000).catch(function () { return null; }),
      upstreamHealth.requestJson(host, '/sdapi/v1/samplers', null, 5000).catch(function () { return null; }),
      upstreamHealth.requestJson(host, '/sdapi/v1/schedulers', null, 5000).catch(function () { return null; }),
      upstreamHealth.requestJson(host, '/sdapi/v1/upscalers', null, 5000).catch(function () { return null; }),
      upstreamHealth.requestJson(host, '/sdapi/v1/options', null, 5000).catch(function () { return null; })
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
      // 状态契约（刻意不走 envelope）：无 ok 字段，前端 mediaStatusApi.isSDStatus
      // 直接按 online/models/... 校验；探活同族端点（tts/chat-status）同形状。
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
      // 同上：降级路径也保持无 ok 的状态形状
      res.json({ online:false, host:host, models:[], samplers:[], schedulers:[], upscalers:[], error:e.message });
    });
  });

  // GET /api/status
  router.get('/api/status', localOnly, function(req, res) {
    // fresh=1 绕过 WebUI 状态缓存（面板的「重新检测」按钮）。
    // 这个参数以前解析了却从未被使用。
    refreshServiceStates(req.query.fresh === '1').then(function(services) {
      var gw = gatewayRef ? gatewayRef() : null;
      var tunnelUrl = gw ? gw.tunnelUrl : '';
      var tunnelStatus = tunnelUrl ? 'active' : (config.DISABLE_TUNNEL ? 'disabled' : 'waiting');
      var saved = readJson(config.RUNTIME.config);
      res.setHeader('Cache-Control', 'no-store');
      envelope.ok(res, {
        running: true,
        sdOnline: services.sdOnline,
        comfyOnline: services.comfyOnline,
        ttsOnline: services.ttsOnline,
        ollamaOnline: services.ollamaOnline,
        ollamaModels: services.ollamaModels,
        ollamaVram: services.ollamaVram,
        webuiManaged: services.webuiManaged,
        comfyManaged: services.comfyManaged,
        modeBusy: !!state.modeBusy,
        operation: state.operation,
        sdHost: config.SD_HOST,
        comfyHost: config.COMFY_HOST,
        ttsHost: config.TTS_HOST,
        ollamaHost: config.OLLAMA_HOST,
        localLink: 'http://127.0.0.1:' + config.PORT + '/',
        // 原始 token 不再随状态返回 —— 见 GET /api/share-link。
        shareLinkAvailable: !!tunnelUrl,
        tunnelStatus: tunnelStatus,
        tunnelAvailable: !config.DISABLE_TUNNEL && !!config.CLOUDFLARED_PATH,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        autoStartVoice: !!saved.autoStartVoice,
        voices: config.VOICE_PROFILES || {},
        selfHealing: watchdog ? watchdog.status() : null,
        webBuild: webBuildInfo(config),
        scripts: {
          voiceStart: fs.existsSync(VOICE_START_SCRIPT),
          voiceStop: fs.existsSync(VOICE_STOP_SCRIPT),
          webui: fs.existsSync(WEBUI_MANAGER_SCRIPT),
          comfy: fs.existsSync(COMFY_MANAGER_SCRIPT)
        }
      });
    }).catch(function(e) {
      // 探测失败不是 500。三个同族接口（/api/sd-status、/api/tts-status、
      // /api/chat-status）都回 200 + online:false，只有这里回 500，
      // 于是前端 `if (!r.ok) return` 会把整块状态墙冻在上一次的值上，
      // 而用户看到的是"没反应"而不是"探测失败"。
      res.setHeader('Cache-Control', 'no-store');
      envelope.fail(res, 200, e.message || '服务状态探测失败', {
        running:true,
        degraded:true,
        sdOnline:false, comfyOnline:false, ttsOnline:false, ollamaOnline:false,
        ollamaModels:[], ollamaVram:0, webuiManaged:false, comfyManaged:false,
        modeBusy:!!state.modeBusy,
        operation:state.operation,
        sdHost:config.SD_HOST, comfyHost:config.COMFY_HOST, ttsHost:config.TTS_HOST, ollamaHost:config.OLLAMA_HOST,
        localLink:'http://127.0.0.1:' + config.PORT + '/',
        shareLinkAvailable:false,
        tunnelStatus:config.DISABLE_TUNNEL ? 'disabled' : 'waiting',
        tunnelAvailable:!config.DISABLE_TUNNEL && !!config.CLOUDFLARED_PATH,
        uptime:Math.floor((Date.now() - startTime) / 1000),
        voices:config.VOICE_PROFILES || {},
        selfHealing:watchdog ? watchdog.status() : null,
        scripts:{
          voiceStart:fs.existsSync(VOICE_START_SCRIPT),
          voiceStop:fs.existsSync(VOICE_STOP_SCRIPT),
          webui:fs.existsSync(WEBUI_MANAGER_SCRIPT), comfy:fs.existsSync(COMFY_MANAGER_SCRIPT)
        }
      });
    });
  });

  // GET /api/share-link — 含 token 的分享链接，仅本机可读。
  // 从 /api/status 拆出来：状态接口会被前端 3 秒轮询一次，
  // 把原始 token 放在里面等于任何拿到链接的人都能反过来提取 token。
  router.get('/api/share-link', localOnly, function(req, res) {
    var gw = gatewayRef ? gatewayRef() : null;
    var tunnelUrl = gw ? gw.tunnelUrl : '';
    res.setHeader('Cache-Control', 'no-store');
    envelope.ok(res, {
      shareLink: tunnelUrl ? (tunnelUrl + '/?token=' + encodeURIComponent(config.TOKEN)) : ''
    });
  });

  // POST /api/start — 启动公网隧道
  // enableTunnel=false（控制面板开关关闭）时不得启动：UI 承诺与实际行为
  // 必须一致，否则用户关掉开关后点主按钮照样开隧道。
  router.post('/api/start', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    try {
      var enableTunnel = req.body && req.body.enableTunnel === false ? false : true;
      if (!enableTunnel) {
        return envelope.ok(res, { message:'公网分享已保持关闭（开关未开启）' });
      }
      var gw = gatewayRef ? gatewayRef() : null;
      if (gw && typeof gw.startTunnel === 'function') gw.startTunnel();
      // 记住偏好：下次启动网关时自动开分享
      try {
        var saved = readJson(config.RUNTIME.config);
        saved.autoTunnel = true;
        persistConfig(config.RUNTIME.config, saved);
      } catch (e) {}
      controlLog('公网分享通道已请求启动');
      envelope.ok(res, { message:'公网分享通道已启动' });
    } catch(e) {
      envelope.fail(res, 500, e.message);
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
        persistConfig(config.RUNTIME.config, saved);
      } catch (e) {}
      controlLog('公网分享通道已停止');
      envelope.ok(res, { message:'公网分享通道已停止' });
    } catch(e) {
      envelope.fail(res, 500, e.message);
    }
  });

  // POST /api/config
  router.post('/api/config', localOnly, express.json({ limit:'8kb' }), function(req, res) {
    try {
      var body = req.body || {};
      var saved = readJson(config.RUNTIME.config);
      var configUpdates = [];
      var nextVoiceProfiles = null;
      // 三个上游 host 必须落在本机 http。不校验的话这里是 SSRF，
      // 而且值会落盘 → 重启后 /sdapi 代理会指向攻击者选定的地址。
      var hostFields = [
        { key:'sdHost',     configKey:'SD_HOST',     label:'SD' },
        { key:'comfyHost',  configKey:'COMFY_HOST',  label:'ComfyUI' },
        { key:'ttsHost',    configKey:'TTS_HOST',    label:'语音' },
        { key:'ollamaHost', configKey:'OLLAMA_HOST', label:'Ollama' }
      ];
      for (var i = 0; i < hostFields.length; i += 1) {
        var field = hostFields[i];
        if (!body[field.key]) continue;
        var safe = security.safeLocalUrl(body[field.key]);
        if (!safe) {
          return envelope.fail(res, 400,
            field.label + ' 地址只接受本机 http，例如 http://127.0.0.1:7860');
        }
        saved[field.key] = safe;
        configUpdates.push({ key:field.configKey, value:safe });
      }
      if (body.voices && typeof body.voices === 'object') {
        saved.voices = body.voices;
        nextVoiceProfiles = body.voices;
      }
      if (typeof body.autoStartVoice === 'boolean') saved.autoStartVoice = body.autoStartVoice;
      persistConfig(config.RUNTIME.config, saved);
      configUpdates.forEach(function (update) { config[update.key] = update.value; });
      if (nextVoiceProfiles) config.VOICE_PROFILES = nextVoiceProfiles;
      controlLog('服务配置已保存');
      envelope.ok(res, { sdHost:config.SD_HOST, comfyHost:config.COMFY_HOST, ttsHost:config.TTS_HOST, ollamaHost:config.OLLAMA_HOST });
    } catch(e) {
      envelope.fail(res, 500, e.message);
    }
  });

  // POST /api/preference
  router.post('/api/preference', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    try {
      var body = req.body || {};
      var saved = readJson(config.RUNTIME.config);
      if (typeof body.autoStartVoice === 'boolean') saved.autoStartVoice = body.autoStartVoice;
      persistConfig(config.RUNTIME.config, saved);
      envelope.ok(res, { autoStartVoice: !!saved.autoStartVoice });
    } catch(e) {
      envelope.fail(res, 500, e.message);
    }
  });

  // POST /api/service/voice
  router.post('/api/service/voice', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    var action = req.body && req.body.action;
    if (!['start', 'stop'].includes(action)) return envelope.fail(res, 400, 'action 必须是 start 或 stop');
    if (ops.rejectConflict(res)) return;
    if (action === 'start' && state.ttsOnline) {
      var fastOp = ops.begin('voice-start', '语音已在运行', ['语音已在运行', '正在验证语音服务状态']);
      ops.update(fastOp, 1);
      envelope.ok(res, { pending:true, operation:fastOp, message:'语音已在运行，正在验证…' });
      refreshServiceStates(true).then(function () {
        if (state.ttsOnline) {
          controlLog('语音已在运行，无需重复启动');
          ops.finish(fastOp, null, '语音服务已就绪');
        } else {
          ops.finish(fastOp, '语音验证失败，请检查 ' + config.TTS_HOST);
        }
      }).catch(function (e) { ops.finish(fastOp, e.message); });
      return;
    }
    var operation = ops.begin('voice-' + action, action === 'start' ? '启动语音服务' : '停止语音服务', [
      action === 'start' ? '正在启动 GPT-SoVITS' : '正在停止 GPT-SoVITS',
      '正在验证语音服务状态'
    ]);
    var task = action === 'start'
      ? runManagedScript(VOICE_START_SCRIPT, ['-WaitSeconds', '60'], 90000)
      : runManagedScript(VOICE_STOP_SCRIPT, [], 30000);
    task.then(async function (result) {
      ops.update(operation, 1);
      await refreshServiceStates(true); // 启停后缓存必然过期
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
      state.ttsManaged = action === 'start';
      ops.finish(operation, null, action === 'start' ? '语音服务已就绪' : '语音服务已停止');
    }).catch(function (error) {
      controlLog('GPT-SoVITS ' + action + ' 失败: ' + error.message);
      ops.finish(operation, error.message);
    });
    envelope.ok(res, {
      pending:true, operation:operation,
      message:'语音服务正在' + (action === 'start' ? '启动（约需 30–60 秒）' : '停止')
    });
  });

  // POST /api/service/webui
  router.post('/api/service/webui', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    var action = req.body && req.body.action;
    if (!['start', 'stop'].includes(action)) return envelope.fail(res, 400, 'action 必须是 start 或 stop');
    if (ops.rejectConflict(res)) return;
    if (action === 'start' && state.sdOnline) {
      var fastOp = ops.begin('webui-start', 'WebUI 已在运行', ['WebUI 已在运行', '正在验证绘图服务状态']);
      ops.update(fastOp, 1);
      envelope.ok(res, { pending:true, operation:fastOp, message:'WebUI 已在运行，正在验证…' });
      refreshServiceStates(true).then(function () {
        if (state.sdOnline) {
          controlLog('WebUI 已在运行，无需重复启动');
          ops.finish(fastOp, null, '绘图服务已就绪');
        } else {
          ops.finish(fastOp, 'WebUI 验证失败，请检查 ' + config.SD_HOST);
        }
      }).catch(function (e) { ops.finish(fastOp, e.message); });
      return;
    }
    var operation = ops.begin('webui-' + action, action === 'start' ? '启动绘图服务' : '停止绘图服务', [
      action === 'start' ? '正在启动 SD WebUI' : '正在停止 SD WebUI',
      '正在验证绘图服务状态'
    ]);
    if (action === 'stop') {
      state.desiredWebui = false;
      saveManagedDesired();
    }
    runManagedScript(
      WEBUI_MANAGER_SCRIPT,
      managedScriptArgs('webui', action === 'start' ? 'Start' : 'Stop'),
      action === 'start' ? WEBUI_START_TIMEOUT_MS : 120000
    ).then(async function (result) {
      if (result.ok && result.message) {
        try {
          var parsed = JSON.parse(result.message);
          state.webuiManaged = !!parsed.managed;
          if (parsed.message) result.message = parsed.message;
        } catch {}
      }
      ops.update(operation, 1);
      await refreshServiceStates(true); // 启停后缓存必然过期
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
      state.desiredWebui = action === 'start' && state.webuiManaged;
      saveManagedDesired();
      ops.finish(operation, null, action === 'start' ? '绘图服务已就绪' : '绘图服务已停止');
    }).catch(function (error) {
      controlLog('WebUI ' + action + ' 失败: ' + error.message);
      ops.finish(operation, error.message);
    });
    envelope.ok(res, {
      pending:true, operation:operation,
      message:'WebUI 正在' + (action === 'start' ? '启动' : '停止')
    });
  });

  // POST /api/service/ollama
  router.post('/api/service/ollama', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    var action = req.body && req.body.action;
    if (action !== 'unload') return envelope.fail(res, 400, 'action 目前只支持 unload');
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
    envelope.ok(res, { pending:true, operation:operation, message:'正在卸载 Ollama 已加载模型…' });
  });

  // POST /api/mode — 绘图优先 / 聊天优先
  router.post('/api/mode', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    var mode = req.body && req.body.mode;
    if (!['draw', 'chat'].includes(mode)) return envelope.fail(res, 400, 'mode 必须是 draw 或 chat');
    if (ops.rejectConflict(res)) return;
    var stages = mode === 'draw'
      ? ['正在停止语音服务', '正在卸载聊天模型', '正在启动 SD WebUI', '正在验证绘图环境']
      : ['正在释放受管 WebUI', '正在启动语音服务', '正在验证聊天环境'];
    var operation = ops.begin('mode-' + mode, mode === 'draw' ? '切换到绘图优先' : '切换到聊天优先', stages);
    state.modeBusy = true;
    envelope.ok(res, {
      pending:true, operation:operation,
      message: mode === 'draw'
        ? '正在切换到绘图优先：先释放语音与聊天模型显存，再启动 WebUI'
        : '正在切换到聊天优先：释放受管 WebUI，启动语音服务'
    });

    (async function () {
      if (mode === 'draw') {
        controlLog('模式切换：绘图优先 — 停止语音服务');
        var stopVoice = await runManagedScript(VOICE_STOP_SCRIPT, [], 30000);
        state.ttsManaged = false;
        if (!stopVoice.ok) controlLog('停止语音服务时出现提示: ' + stopVoice.error);
        ops.update(operation, 1);
        controlLog('模式切换：绘图优先 — 卸载 Ollama 模型');
        var unload = await unloadOllamaModels();
        if (!unload.ok) controlLog('Ollama 卸载提示: ' + (unload.error || unload.message || ''));
        ops.update(operation, 2);
        controlLog('模式切换：绘图优先 — 启动 WebUI');
        var startWebui = await runManagedScript(WEBUI_MANAGER_SCRIPT, managedScriptArgs('webui', 'Start'), WEBUI_START_TIMEOUT_MS);
        if (startWebui.ok) {
          try { state.webuiManaged = !!JSON.parse(startWebui.message || '{}').managed; } catch {}
          state.desiredWebui = state.webuiManaged;
          saveManagedDesired();
          controlLog('绘图优先模式就绪：显存已优先让给 WebUI');
        } else {
          throw new Error('WebUI 启动失败: ' + startWebui.error);
        }
        ops.update(operation, 3);
      } else {
        if (state.webuiManaged) {
          controlLog('模式切换：聊天优先 — 停止受管 WebUI 释放显存');
          var stopWebui = await runManagedScript(WEBUI_MANAGER_SCRIPT, managedScriptArgs('webui', 'Stop'), 60000);
          if (stopWebui.ok) {
            try { state.webuiManaged = !!JSON.parse(stopWebui.message || '{}').managed; } catch {}
            state.desiredWebui = false;
            saveManagedDesired();
          } else {
            controlLog('停止 WebUI 时出现提示: ' + stopWebui.error);
          }
        } else {
          controlLog('模式切换：聊天优先 — WebUI 为手动启动或非受管，保持不动');
        }
        ops.update(operation, 1);
        controlLog('模式切换：聊天优先 — 启动语音服务');
        var startVoice = await runManagedScript(VOICE_START_SCRIPT, ['-WaitSeconds', '60'], 90000);
        if (startVoice.ok) controlLog('聊天优先模式就绪：语音服务已启动');
        else throw new Error('语音服务启动失败: ' + startVoice.error);
        state.ttsManaged = true;
        ops.update(operation, 2);
      }
      await refreshServiceStates(true); // 模式切换刚动过服务，必须重新探测
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

  // GET /api/logs — 仅本机；日志过 redactText，避免把隧道 URL / token 原样回出去
  router.get('/api/logs', localOnly, function(req, res) {
    var since  = parseInt(req.query.since, 10) || 0;
    // 单调序号游标：缓冲首条序号 head = seq - length；客户端落后于裁剪头时从
    // 当前头开始给（被裁掉的行此前已显示过）。total 恒为最新 seq。
    var seq = state.controlLogSeq;
    var head = seq - state.controlLogs.length;
    var from = Math.min(seq, Math.max(since, head));
    var lines  = state.controlLogs.slice(from - head).map(diagnostics.redactText);
    var logFiles = [
      config.RUNTIME && config.RUNTIME.gatewayLog,
      config.RUNTIME && config.RUNTIME.tunnelLog,
      config.RUNTIME && config.RUNTIME.controlLog,
    ].filter(Boolean);
    logFiles.forEach(function(f) {
      // readLogTail 只 seek 尾部 64KB；旧的 tailLog(f, 0) 会把整份日志读进内存再丢掉 99%
      var tail = diagnostics.readLogTail(f, 64 * 1024);
      if (!tail.available || !tail.text) return;
      lines = lines.concat(tail.text.split(/\r?\n/).filter(Boolean).slice(-30));
    });
    if (!lines.length && since === 0) {
      lines = ['[' + new Date().toISOString().slice(0,19) + '] 网关已就绪，端口 ' + config.PORT];
    }
    res.setHeader('Cache-Control', 'no-store');
    // total 是权威游标（controlLogs 单调序号），不含文件尾行（尾行每次重读、
    // 由前端按内容去重显示，不参与游标推进）。2026-08-16 审计：此前 total =
    // since + lines.length 把 ≤30×3 行文件尾算进游标且纯按环形长度计数，
    // 前端按数据长度自增 → 游标推过头/环形裁掉后，新 controlLogs 永不上屏。
    // 状态契约（刻意不走 envelope）：无 ok 字段，前端 controlApi.isLogs 按
    // logs/total/operation 直接校验。
    res.json({ logs:lines, total: seq, operation: state.operation });
  });

  // 重新构建前端：公网分享伺服 dist/，源码改动后不重建分享出去就是旧版
  router.post('/api/maintenance/build-web', localOnly, function (req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (maintenanceRuntime.isDesktopPackagedMode(config)) {
      return envelope.fail(res, 501, '桌面应用模式下无法重新构建前端（源码不在安装包内）。' +
        '请在源码开发模式中执行 npm run build。', { code:'DESKTOP_MAINTENANCE_UNAVAILABLE' });
    }
    runWebBuild(config, function (result) {
      var payload = Object.assign({ durationMs:result.durationMs, error:result.error, tail:result.tail }, { webBuild:webBuildInfo(config) });
      if (!result.ok) return envelope.fail(res, 500, result.error || '前端构建失败', payload);
      return envelope.ok(res, payload);
    });
  });

  // GET /api/diagnostics
  router.get('/api/diagnostics', localOnly, function(req, res) {
    var saved = readJson(config.RUNTIME.config);
    // 状态契约（刻意不走 envelope）：无 ok 字段，前端 controlApi.isDiagnostics 按
    // timestamp/port/... 直接校验。
    res.json({
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      port: config.PORT,
      sdHost: config.SD_HOST,
      comfyHost: config.COMFY_HOST,
      ttsHost: config.TTS_HOST,
      ollamaHost: config.OLLAMA_HOST,
      sceneShowcaseDir: config.SCENE_SHOWCASE_DIR || '',
      disableTunnel: !!config.DISABLE_TUNNEL,
      runtimeConfig: diagnostics.redactConfig(saved),
      token: diagnostics.summarizeToken(config.TOKEN),
      scripts: {
        voiceStart: VOICE_START_SCRIPT,
        voiceStop: VOICE_STOP_SCRIPT,
        webui: WEBUI_MANAGER_SCRIPT,
        comfy: COMFY_MANAGER_SCRIPT,
        voiceStartExists: fs.existsSync(VOICE_START_SCRIPT),
        voiceStopExists: fs.existsSync(VOICE_STOP_SCRIPT),
        webuiExists: fs.existsSync(WEBUI_MANAGER_SCRIPT),
        comfyExists: fs.existsSync(COMFY_MANAGER_SCRIPT)
      },
      nodeVersion: process.version,
      platform: process.platform,
      operation: state.operation
    });
  });

  // 服务自愈看门狗：GPT-SoVITS / 翻译进程崩溃后自动拉起（指数退避）。
  // 只有"曾在线且受管"的服务才自动重启，未启动过的一律不动。
  watchdog = createServiceWatchdog({
    intervalMs: Number(config.SELF_HEALING_INTERVAL_MS) || 5000,
    maxBackoffMs: 30000,
    services: [
      {
        name: 'webui',
        probe: function () { return pingSd(config.SD_HOST, 2500); },
        restart: function () {
          return runManagedScript(WEBUI_MANAGER_SCRIPT, managedScriptArgs('webui', 'Start'), WEBUI_START_TIMEOUT_MS)
            .then(function (result) { return { ok:!!result.ok, error:result.error }; });
        },
        shouldManage: function () { return state.desiredWebui; },
        recoverOnStart: function () { return state.desiredWebui; }
      },
      {
        name: 'comfy',
        probe: function () { return pingComfy(config.COMFY_HOST, 2500); },
        restart: function () {
          return runManagedScript(COMFY_MANAGER_SCRIPT, managedScriptArgs('comfy', 'Start'), 120000)
            .then(function (result) { return { ok:!!result.ok, error:result.error }; });
        },
        shouldManage: function () { return state.desiredComfy; },
        recoverOnStart: function () { return state.desiredComfy; }
      },
      {
        name: 'tts',
        probe: function () { return pingTts(config.TTS_HOST, 2500); },
        restart: function () {
          return runManagedScript(VOICE_START_SCRIPT, ['-WaitSeconds', '60'], 90000)
            .then(function (result) { return { ok: !!result.ok, error: result.error }; });
        },
        shouldManage: function () {
          if (state.ttsManaged) return true;
          try { return !!readJson(config.RUNTIME.config).autoStartVoice; } catch (error) { return false; }
        }
      },
      {
        name: 'translation',
        probe: function () {
          return dependencies.translation ? dependencies.translation.ping() : Promise.resolve(false);
        },
        restart: function () {
          if (!dependencies.translation) return Promise.resolve({ ok: false, error: '翻译服务不可用' });
          return dependencies.translation.prepare()
            .then(function () { return { ok: true }; })
            .catch(function (error) {
              return { ok: false, error: (error && error.message) || '翻译服务重启失败' };
            });
        },
        shouldManage: function () {
          if (!dependencies.translation) return false;
          return fs.existsSync(config.TRANSLATION_PYTHON) && fs.existsSync(config.TRANSLATION_SCRIPT);
        }
      }
    ],
    onEvent: function (event) {
      controlLog('自愈看门狗 ' + event.service + ' → ' + event.kind
        + (event.error ? '：' + event.error : '')
        + (event.attempt ? '（第 ' + event.attempt + ' 次）' : ''));
    }
  });

  // POST /api/service/comfy
  router.post('/api/service/comfy', localOnly, express.json({ limit:'2kb' }), function(req, res) {
    var action = req.body && req.body.action;
    if (!['start', 'stop'].includes(action)) return envelope.fail(res, 400, 'action 必须是 start 或 stop');
    if (ops.rejectConflict(res)) return;
    // 已在线时的“启动”不应再卡在 17.5%（脚本 2s 探测 + 120s 启动等待），直接走快速验证路径
    if (action === 'start' && state.comfyOnline) {
      var fastOp = ops.begin('comfy-start', 'ComfyUI 已在运行', ['ComfyUI 已在运行', '正在验证 ComfyUI /system_stats']);
      // 立即推进到 67.5%（stage 1），避免“一点点”假象
      ops.update(fastOp, 1);
      envelope.ok(res, { pending:true, operation:fastOp, message:'ComfyUI 已在运行，正在验证…' });
      refreshServiceStates(true).then(function () {
        if (state.comfyOnline) {
          state.desiredComfy = state.comfyManaged || false;
          // 若原本是手动启动，验证通过后也标记为已期望在线，避免看门狗误判
          if (!state.comfyManaged) state.desiredComfy = false;
          controlLog('ComfyUI 已在运行，无需重复启动');
          ops.finish(fastOp, null, 'ComfyUI 已在运行');
        } else {
          ops.finish(fastOp, 'ComfyUI 验证失败，请检查端口 ' + config.COMFY_HOST);
        }
      }).catch(function (e) { ops.finish(fastOp, e.message); });
      return;
    }
    var operation = ops.begin('comfy-' + action, action === 'start' ? '启动 ComfyUI' : '停止 ComfyUI', [
      action === 'start' ? '正在启动 ComfyUI' : '正在停止 ComfyUI',
      '正在验证 ComfyUI /system_stats'
    ]);
    if (action === 'stop') {
      state.desiredComfy = false;
      saveManagedDesired();
    }
    runManagedScript(COMFY_MANAGER_SCRIPT, managedScriptArgs('comfy', action === 'start' ? 'Start' : 'Stop'), 120000).then(async function (result) {
      if (result.ok && result.message) {
        try {
          var parsed = JSON.parse(result.message);
          state.comfyManaged = !!parsed.managed;
          if (parsed.message) result.message = parsed.message;
        } catch (error) {}
      }
      ops.update(operation, 1);
      await refreshServiceStates(true);
      var expected = action === 'start';
      if (!result.ok && state.comfyOnline === expected) {
        controlLog('ComfyUI 脚本返回提示，但目标状态已达成: ' + (result.error || '未知提示'));
      } else if (!result.ok) throw new Error(result.error || 'ComfyUI 操作失败');
      if (state.comfyOnline !== expected) throw new Error(action === 'start'
        ? 'ComfyUI 启动脚本已结束，但 /system_stats 尚未就绪'
        : 'ComfyUI 停止脚本已结束，但接口仍可访问');
      state.desiredComfy = action === 'start' && state.comfyManaged;
      saveManagedDesired();
      controlLog('ComfyUI ' + (action === 'start' ? '已启动' : '已停止'));
      ops.finish(operation, null, action === 'start' ? 'ComfyUI 已就绪' : 'ComfyUI 已停止');
    }).catch(function (error) {
      controlLog('ComfyUI ' + action + ' 失败: ' + error.message);
      ops.finish(operation, error.message);
    });
    envelope.ok(res, { pending:true, operation:operation, message:'ComfyUI 正在' + (action === 'start' ? '启动' : '停止') });
  });
  watchdog.start();

  // 启动时探测一次受管 WebUI 状态
  refreshServiceStates().catch(function () {});

  router.watchdog = watchdog;
  router.close = function () { if (watchdog) watchdog.stop(); };
  return router;
}

module.exports = {
  createControlRouter,
  // 暴露给测试：断言这里用的是 server/security 的共享实现，而不是又一份本地副本
  _test:{ localOnly }
};
