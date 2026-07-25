﻿var express = require('express');
var http = require('http');
var https = require('https');
var net = require('net');
var cp = require('child_process');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var runtimeTools = require('../scripts/runtime/runtime-paths');

var app = express();
app.disable('x-powered-by');
var PORT = 3001;
var GW_PORT = Number(process.env.GATEWAY_PORT) || 3000;
var HOST = '127.0.0.1';
var SD_HOST = process.env.SD_HOST || 'http://127.0.0.1:7860';
var TTS_HOST = process.env.TTS_HOST || 'http://127.0.0.1:9880';
var OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
var AUTO_START_VOICE = false;
var VOICE_PROFILES = { nene:{}, natsume:{} };
var SD_API_AUTH = process.env.SD_API_AUTH || '';
var dir = path.join(__dirname, '..');
var RUNTIME = runtimeTools.createRuntimePaths(dir);
runtimeTools.migrateLegacyRuntime(dir, RUNTIME);
runtimeTools.rotateLog(RUNTIME.controlLog, 2 * 1024 * 1024);
var CONFIG_FILE = RUNTIME.config;
var CLOUDFLARED_PATH = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
var VOICE_START_SCRIPT = path.resolve(dir, '..', 'AI', 'Voice', 'Start-Voice.ps1');
var VOICE_STOP_SCRIPT = path.resolve(dir, '..', 'AI', 'Voice', 'Stop-Voice.ps1');
var VOICE_PROFILE_FILE = path.resolve(dir, '..', 'AI', 'Voice', 'config', 'profiles.json');
var WEBUI_MANAGER_SCRIPT = path.join(dir, 'scripts', 'runtime', 'managed-webui.ps1');

// 鈹€鈹€鈹€ State 鈹€鈹€鈹€
var state = {
  running: false,
  token: '',
  domain: '',
  startTime: null,
  gatewayPort: GW_PORT,
  tunnelStatus: 'idle',
  sdOnline: false,
  webuiManaged: false,
  ttsOnline: false,
  ollamaOnline: false,
  ollamaModels: [],
  ollamaVram: 0,
  modeBusy: false,
  logs: []
};

// 鈹€鈹€鈹€ Helpers 鈹€鈹€鈹€
function log(msg) {
  var line = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  state.logs.push(line);
  if (state.logs.length > 200) state.logs.shift();
  try { fs.appendFileSync(RUNTIME.controlLog, line + '\n', 'utf8'); } catch (error) {}
  console.log(line);
}

function normalizeLocalHost(value, label) {
  var target = new URL(String(value || '').trim());
  var localHosts = ['127.0.0.1', 'localhost', '[::1]', '::1'];
  if ((target.protocol !== 'http:' && target.protocol !== 'https:') || localHosts.indexOf(target.hostname) === -1) {
    throw new Error(label + ' 鍦板潃蹇呴』鏄湰鏈?http(s) 鍦板潃');
  }
  if (target.username || target.password || (target.pathname && target.pathname !== '/') || target.search || target.hash) {
    throw new Error('请只填写' + label + '的地址和端口');
  }
  return target.origin;
}
function normalizeSDHost(value) { return normalizeLocalHost(value, 'SD WebUI'); }
function normalizeTTSHost(value) { return normalizeLocalHost(value, 'GPT-SoVITS'); }

function sanitizeVoiceProfile(value, fallback) {
  value = value && typeof value === 'object' ? value : {};
  fallback = fallback && typeof fallback === 'object' ? fallback : {};
  function pick(key, defaultValue) {
    return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : (fallback[key] == null ? defaultValue : fallback[key]);
  }
  var references = pick('references', {});
  var safeReferences = {};
  if (references && typeof references === 'object') {
    ['neutral', 'gentle', 'happy', 'shy', 'serious', 'sad'].forEach(function (emotion) {
      var reference = references[emotion];
      if (!reference || typeof reference !== 'object') return;
      var refAudioPath = String(reference.refAudioPath || '').trim().slice(0, 1000);
      var promptText = String(reference.promptText || '').trim().slice(0, 500);
      if (refAudioPath && promptText) safeReferences[emotion] = { refAudioPath:refAudioPath, promptText:promptText, promptLang:'ja' };
    });
  }
  var refAudioPath = String(pick('refAudioPath', '') || '').trim().slice(0, 1000);
  var promptText = String(pick('promptText', '') || '').trim().slice(0, 500);
  if (!refAudioPath) refAudioPath = String(fallback.refAudioPath || '').trim().slice(0, 1000);
  if (!promptText) promptText = String(fallback.promptText || '').trim().slice(0, 500);
  return {
    refAudioPath: refAudioPath,
    promptText: promptText,
    promptLang: String(pick('promptLang', 'ja') || 'ja').trim().slice(0, 12),
    textLang: String(pick('textLang', 'ja') || 'ja').trim().slice(0, 12),
    gptWeightsPath: String(pick('gptWeightsPath', '') || '').trim().slice(0, 1000),
    sovitsWeightsPath: String(pick('sovitsWeightsPath', '') || '').trim().slice(0, 1000),
    references: safeReferences
  };
}

if (fs.existsSync(VOICE_PROFILE_FILE)) {
  try {
    var defaultProfiles = JSON.parse(fs.readFileSync(VOICE_PROFILE_FILE, 'utf8'));
    VOICE_PROFILES.nene = sanitizeVoiceProfile(defaultProfiles.nene);
    VOICE_PROFILES.natsume = sanitizeVoiceProfile(defaultProfiles.natsume);
  } catch (error) {
    console.warn('Ignoring invalid default voice profiles:', error.message);
  }
}

if (fs.existsSync(CONFIG_FILE)) {
  try {
    var savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (!process.env.SD_HOST && savedConfig.sdHost) SD_HOST = normalizeSDHost(savedConfig.sdHost);
    if (!process.env.TTS_HOST && savedConfig.ttsHost) TTS_HOST = normalizeTTSHost(savedConfig.ttsHost);
    if (!process.env.OLLAMA_HOST && savedConfig.ollamaHost) OLLAMA_HOST = normalizeLocalHost(savedConfig.ollamaHost, 'Ollama');
    AUTO_START_VOICE = savedConfig.autoStartVoice === true;
    if (savedConfig.voices) {
      VOICE_PROFILES.nene = sanitizeVoiceProfile(savedConfig.voices.nene, VOICE_PROFILES.nene);
      VOICE_PROFILES.natsume = sanitizeVoiceProfile(savedConfig.voices.natsume, VOICE_PROFILES.natsume);
    }
  } catch (error) {
    console.warn('Ignoring invalid saved gateway config:', error.message);
  }
}

function findAvailableGatewayPort(callback) {
  var port = GW_PORT;
  var lastPort = GW_PORT + 20;
  function probe() {
    if (port > lastPort) return callback(new Error('绔彛 ' + GW_PORT + '-' + lastPort + ' 鍧囪鍗犵敤'));
    var tester = net.createServer();
    tester.unref();
    tester.once('error', function () { port++; probe(); });
    tester.once('listening', function () { tester.close(function () { callback(null, port); }); });
    tester.listen({ host:'127.0.0.1', port:port, exclusive:true });
  }
  probe();
}

var sdCheckInFlight = false;
var lastSDCheck = 0;
function checkSD() {
  if (sdCheckInFlight || Date.now() - lastSDCheck < 2000) return;
  sdCheckInFlight = true;
  var finished = false;
  function finish(online) {
    if (finished) return;
    finished = true;
    state.sdOnline = online;
    lastSDCheck = Date.now();
    sdCheckInFlight = false;
  }
  try {
    var target = new URL('/sdapi/v1/sd-models', SD_HOST);
    var transport = target.protocol === 'https:' ? https : http;
    var requestOptions = SD_API_AUTH ? { headers:{ Authorization:'Basic ' + Buffer.from(SD_API_AUTH).toString('base64') } } : {};
    var req = transport.get(target, requestOptions, function (res) {
      res.resume();
      finish(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.setTimeout(1500, function () { req.destroy(new Error('SD health check timeout')); });
    req.on('error', function () { finish(false); });
  } catch (e) {
    finish(false);
  }
}

var ttsCheckInFlight = false;
var lastTTSCheck = 0;
function checkTTS() {
  if (ttsCheckInFlight || Date.now() - lastTTSCheck < 2000) return;
  ttsCheckInFlight = true;
  var finished = false;
  function finish(online) {
    if (finished) return;
    finished = true;
    state.ttsOnline = online;
    lastTTSCheck = Date.now();
    ttsCheckInFlight = false;
  }
  try {
    var target = new URL('/docs', TTS_HOST);
    var transport = target.protocol === 'https:' ? https : http;
    var req = transport.get(target, function (res) {
      res.resume();
      finish(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.setTimeout(1500, function () { req.destroy(new Error('TTS health check timeout')); });
    req.on('error', function () { finish(false); });
  } catch (error) { finish(false); }
}

// Ollama 妫€娴嬶細/api/ps 鍚屾椂杩斿洖宸插姞杞芥ā鍨嬩笌鏄惧瓨鍗犵敤
var ollamaCheckInFlight = false;
var lastOllamaCheck = 0;
function checkOllama() {
  if (ollamaCheckInFlight || Date.now() - lastOllamaCheck < 3000) return;
  ollamaCheckInFlight = true;
  var finished = false;
  function finish(online, models, vram) {
    if (finished) return;
    finished = true;
    state.ollamaOnline = online;
    state.ollamaModels = models || [];
    state.ollamaVram = vram || 0;
    lastOllamaCheck = Date.now();
    ollamaCheckInFlight = false;
  }
  try {
    var target = new URL('/api/ps', OLLAMA_HOST);
    var transport = target.protocol === 'https:' ? https : http;
    var req = transport.get(target, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        try {
          var data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          var models = Array.isArray(data.models) ? data.models : [];
          var vram = 0;
          var names = models.map(function (item) {
            vram += Number(item.size_vram) || 0;
            return String(item.name || item.model || '');
          }).filter(Boolean);
          finish(res.statusCode >= 200 && res.statusCode < 300, names, vram);
        } catch (error) { finish(false, [], 0); }
      });
    });
    req.setTimeout(2000, function () { req.destroy(new Error('Ollama health check timeout')); });
    req.on('error', function () { finish(false, [], 0); });
  } catch (error) { finish(false, [], 0); }
}

// 閫氱敤鏈満 JSON 璇锋眰锛堢敤浜?Ollama 绠＄悊鎺ュ彛锛?function requestLocalJson(baseUrl, pathname, payload, timeout) {
  return new Promise(function (resolve, reject) {
    try {
      var target = new URL(pathname, baseUrl);
      var body = payload ? JSON.stringify(payload) : '';
      var transport = target.protocol === 'https:' ? https : http;
      var req = transport.request(target, {
        method: payload ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : undefined
      }, function (res) {
        var chunks = [];
        res.on('data', function (chunk) { chunks.push(chunk); });
        res.on('end', function () {
          try { resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }); }
          catch (error) { resolve({ status: res.statusCode, data: {} }); }
        });
      });
      req.setTimeout(timeout || 15000, function () { req.destroy(new Error('璇锋眰瓒呮椂')); });
      req.on('error', reject);
      req.end(body);
    } catch (error) { reject(error); }
  });
}

// 鍗歌浇 Ollama 宸插姞杞芥ā鍨嬶紝閲婃斁鏄惧瓨锛坘eep_alive=0 鏄畼鏂规敮鎸佺殑鍗歌浇鏂瑰紡锛?async function unloadOllamaModels() {
  var listed = await requestLocalJson(OLLAMA_HOST, '/api/ps', null, 4000).catch(function () { return null; });
  if (!listed || listed.status >= 300) return { ok:false, error:'Ollama 鏈搷搴? };
  var models = Array.isArray(listed.data.models) ? listed.data.models : [];
  if (!models.length) return { ok:true, message:'Ollama 娌℃湁宸插姞杞界殑妯″瀷' };
  var unloaded = 0;
  for (var i = 0; i < models.length; i += 1) {
    var name = String(models[i].name || models[i].model || '');
    if (!name) continue;
    var result = await requestLocalJson(OLLAMA_HOST, '/api/generate', { model:name, keep_alive:0, stream:false }, 20000).catch(function () { return null; });
    if (result && result.status < 300) unloaded += 1;
  }
  lastOllamaCheck = 0;
  checkOllama();
  return { ok: unloaded > 0, message: '宸插嵏杞?' + unloaded + ' 涓?Ollama 妯″瀷锛屾樉瀛樺凡閲婃斁' };
}

// Query gateway's /api/tunnel-status for domain + token
function fetchTunnelStatus(cb) {
  try {
    var req = http.get({
      hostname: '127.0.0.1',
      port: state.gatewayPort,
      path: '/api/tunnel-status',
      headers: state.token ? { 'X-Token': state.token } : {}
    }, function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        try {
          var d = JSON.parse(body);
          if (d.url) state.domain = d.url;
        } catch (e) {}
        if (cb) cb();
      });
    });
    req.on('error', function () { if (cb) cb(); });
  } catch (e) { if (cb) cb(); }
}

function isManagedGatewayProcess(pid, port) {
  if (!/^\d+$/.test(String(pid || '')) || !Number.isInteger(Number(port))) return false;
  try {
    var script = '$p=Get-CimInstance Win32_Process -Filter "ProcessId=' + Number(pid) + '" -ErrorAction SilentlyContinue;' +
      '$l=Get-NetTCPConnection -State Listen -LocalPort ' + Number(port) + ' -ErrorAction SilentlyContinue | Where-Object {$_.OwningProcess -eq ' + Number(pid) + '};' +
      'if($p -and $l -and $p.CommandLine -like "*server.js*"){"managed"}';
    var output = cp.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding:'utf8', stdio:['ignore','pipe','ignore'] });
    return output.trim() === 'managed';
  } catch (e) { return false; }
}

function killByPidFile(pidFile, expectedPort) {
  try {
    if (!fs.existsSync(pidFile)) return;
    var pid = fs.readFileSync(pidFile, 'utf8').trim();
    if (isManagedGatewayProcess(pid, expectedPort)) {
      try { cp.execFileSync('taskkill', ['/pid', pid, '/f'], { stdio:'pipe' }); } catch (e) {}
    } else if (pid) {
      log('Ignored stale gateway PID ' + pid + '; process identity did not match');
    }
    fs.unlinkSync(pidFile);
  } catch (e) {}
}

function isManagedTunnelProcess(pid, port) {
  if (!/^\d+$/.test(String(pid || '')) || !Number.isInteger(Number(port))) return false;
  try {
    var expectedUrl = 'http://localhost:' + Number(port);
    var script = '$p=Get-CimInstance Win32_Process -Filter "ProcessId=' + Number(pid) + '" -ErrorAction SilentlyContinue;' +
      'if($p -and $p.Name -eq "cloudflared.exe" -and $p.CommandLine -like "*tunnel*" -and $p.CommandLine -like "*' + expectedUrl + '*") {"managed"}';
    var output = cp.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding:'utf8', stdio:['ignore','pipe','ignore'] });
    return output.trim() === 'managed';
  } catch (e) { return false; }
}

function killTunnelByPidFile(pidFile, expectedPort) {
  try {
    if (!fs.existsSync(pidFile)) return;
    var pid = fs.readFileSync(pidFile, 'utf8').trim();
    if (isManagedTunnelProcess(pid, expectedPort)) {
      try { cp.execFileSync('taskkill', ['/pid', pid, '/f'], { stdio:'pipe' }); } catch (e) {}
    } else if (pid) {
      log('Ignored stale tunnel PID ' + pid + '; process identity did not match');
    }
    fs.unlinkSync(pidFile);
  } catch (e) {}
}

function stopManagedVoiceService() {
  if (!fs.existsSync(VOICE_STOP_SCRIPT)) return { attempted:false, message:'Voice stop script is not installed.' };
  var result = cp.spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', VOICE_STOP_SCRIPT
  ], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true
  });
  if (result.error) return { attempted:true, error:result.error.message };
  if (result.status !== 0) return { attempted:true, error:(result.stderr || result.stdout || 'Voice stop script failed').trim() };
  state.ttsOnline = false;
  return { attempted:true, message:(result.stdout || 'GPT-SoVITS stopped.').trim() };
}

function startManagedVoiceService() {
  if (!fs.existsSync(VOICE_START_SCRIPT)) return { attempted:false, message:'Voice start script is not installed.' };
  var result = cp.spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', VOICE_START_SCRIPT, '-WaitSeconds', '60'
  ], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 90000,
    windowsHide: true
  });
  if (result.error) return { attempted:true, error:result.error.message };
  if (result.status !== 0) return { attempted:true, error:(result.stderr || result.stdout || 'Voice start script failed').trim() };
  return { attempted:true, message:(result.stdout || 'GPT-SoVITS started.').trim() };
}

function runManagedWebUI(action) {
  if (!fs.existsSync(WEBUI_MANAGER_SCRIPT)) return { ok:false, error:'Managed WebUI script is not installed.' };
  var result = cp.spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', WEBUI_MANAGER_SCRIPT, '-Action', action
  ], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true
  });
  if (result.error) return { ok:false, error:result.error.message };
  var output = String(result.stdout || '').trim();
  try {
    var parsed = JSON.parse(output);
    state.webuiManaged = !!parsed.managed;
    return parsed;
  } catch (error) {
    return { ok:false, error:(result.stderr || output || 'Managed WebUI script returned invalid status').trim() };
  }
}

// 寮傛鎵ц PowerShell 鑴氭湰锛氭湇鍔″惎鍋滃彲鑳借€楁椂 30-90 绉掞紝鍚屾璋冪敤浼氬喕缁撴暣涓帶鍒堕潰鏉?function runScriptAsync(scriptPath, args, timeoutMs) {
  return new Promise(function (resolve) {
    if (!fs.existsSync(scriptPath)) {
      resolve({ ok:false, error:'鑴氭湰鏈畨瑁咃細' + path.basename(scriptPath) });
      return;
    }
    var child;
    try {
      child = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath].concat(args || []), {
        cwd: dir,
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
      try { child.kill(); } catch (error) {}
      done({ ok:false, error:'鎿嶄綔瓒呮椂锛? + Math.round(timeoutMs / 1000) + ' 绉掞級' });
    }, timeoutMs || 60000);
    child.stdout.on('data', function (chunk) { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', function (chunk) { stderr += chunk.toString('utf8'); });
    child.on('error', function (error) { done({ ok:false, error:error.message }); });
    child.on('close', function (code) {
      if (code === 0) done({ ok:true, message:stdout.trim() });
      else done({ ok:false, error:(stderr || stdout || '鑴氭湰閫€鍑虹爜 ' + code).trim() });
    });
  });
}

function refreshServiceStates() {
  lastSDCheck = 0;
  lastTTSCheck = 0;
  lastOllamaCheck = 0;
  checkSD();
  checkTTS();
  checkOllama();
}

// Check if gateway is already running on startup
(function checkExisting() {
  try {
    var pidFile = RUNTIME.gatewayPid;
    if (fs.existsSync(pidFile)) {
      var pid = fs.readFileSync(pidFile, 'utf8').trim();
      var portFile = RUNTIME.gatewayPort;
      var detectedPort = fs.existsSync(portFile) ? Number(fs.readFileSync(portFile, 'utf8').trim()) || GW_PORT : GW_PORT;
      try {
        if (!isManagedGatewayProcess(pid, detectedPort)) throw new Error('stale gateway pid');
        state.running = true;
        state.token = fs.readFileSync(RUNTIME.gatewayToken, 'utf8').trim();
        state.gatewayPort = detectedPort;
        state.startTime = Date.now();
        state.tunnelStatus = process.env.DISABLE_TUNNEL === '1' ? 'disabled' : (fs.existsSync(CLOUDFLARED_PATH) ? 'connecting' : 'unavailable');
        fetchTunnelStatus(function () {
          if (state.domain) state.tunnelStatus = 'ready';
        });
        log('Detected running gateway (PID ' + pid + ')');
      } catch (e) {
        fs.unlinkSync(pidFile);
        try { fs.unlinkSync(portFile); } catch (e2) {}
        try { fs.unlinkSync(RUNTIME.tunnelPid); } catch (e2) {}
      }
    }
  } catch (e) {}
  checkSD();
  checkTTS();
  checkOllama();
  var webuiStatus = runManagedWebUI('Status');
  if (webuiStatus.ok) state.webuiManaged = !!webuiStatus.managed;
})();

// 鈹€鈹€鈹€ API 鈹€鈹€鈹€
app.use(express.json());
app.use(function (req, res, next) {
  var origin = req.headers.origin;
  var allowed = !origin || origin === 'http://127.0.0.1:' + PORT || origin === 'http://localhost:' + PORT;
  if (!allowed) return res.status(403).json({ error: 'Forbidden origin' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use('/css', express.static(path.join(dir, 'css'), { dotfiles:'deny', index:false }));
app.use('/tools', express.static(path.join(dir, 'tools'), { dotfiles:'deny', index:false }));
app.use('/assets', express.static(path.join(dir, 'assets'), { dotfiles:'deny', index:false }));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'control.html'));
});

app.get('/api/status', function (req, res) {
  if (state.running) fetchTunnelStatus();
  checkSD();
  checkTTS();
  checkOllama();
  res.json({
    running: state.running,
    token: state.token,
    domain: state.domain,
    sdOnline: state.sdOnline,
    webuiManaged: !!state.webuiManaged,
    sdHost: SD_HOST,
    ttsOnline: !!state.ttsOnline,
    ttsHost: TTS_HOST,
    ollamaOnline: !!state.ollamaOnline,
    ollamaHost: OLLAMA_HOST,
    ollamaModels: state.ollamaModels,
    ollamaVram: state.ollamaVram,
    autoStartVoice: AUTO_START_VOICE,
    modeBusy: !!state.modeBusy,
    voices: VOICE_PROFILES,
    gatewayPort: state.gatewayPort,
    uptime: state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0,
    tunnelAvailable: fs.existsSync(CLOUDFLARED_PATH),
    tunnelStatus: state.tunnelStatus,
    localLink: state.running ? 'http://127.0.0.1:' + state.gatewayPort + '/' : '',
    shareLink: state.domain && state.token ? state.domain + '?token=' + state.token : ''
  });
});

app.post('/api/config', function (req, res) {
  if (state.running) return res.status(409).json({ ok:false, error:'璇峰厛鍋滄缃戝叧锛屽啀淇敼鐢熸垚鏈嶅姟閰嶇疆' });
  try {
    if (req.body && req.body.sdHost != null) SD_HOST = normalizeSDHost(req.body.sdHost);
    if (req.body && req.body.ttsHost != null) TTS_HOST = normalizeTTSHost(req.body.ttsHost);
    if (req.body && req.body.ollamaHost != null) OLLAMA_HOST = normalizeLocalHost(req.body.ollamaHost, 'Ollama');
    if (req.body && typeof req.body.autoStartVoice === 'boolean') AUTO_START_VOICE = req.body.autoStartVoice;
    if (req.body && req.body.voices) {
      VOICE_PROFILES.nene = sanitizeVoiceProfile(req.body.voices.nene, VOICE_PROFILES.nene);
      VOICE_PROFILES.natsume = sanitizeVoiceProfile(req.body.voices.natsume, VOICE_PROFILES.natsume);
    }
    state.sdOnline = false;
    state.ttsOnline = false;
    state.ollamaOnline = false;
    lastSDCheck = 0;
    lastTTSCheck = 0;
    lastOllamaCheck = 0;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ sdHost:SD_HOST, ttsHost:TTS_HOST, ollamaHost:OLLAMA_HOST, autoStartVoice:AUTO_START_VOICE, voices:VOICE_PROFILES }, null, 2));
    checkSD();
    checkTTS();
    checkOllama();
    log('SD WebUI address: ' + SD_HOST);
    log('GPT-SoVITS address: ' + TTS_HOST);
    res.json({ ok:true, sdHost:SD_HOST, ttsHost:TTS_HOST, ollamaHost:OLLAMA_HOST, autoStartVoice:AUTO_START_VOICE, voices:VOICE_PROFILES });
  } catch (error) {
    res.status(400).json({ ok:false, error:error.message });
  }
});

// 杞婚噺鍋忓ソ璁剧疆锛氶殢鏃跺彲鏀癸紝涓嶅奖鍝嶈繍琛屼腑鐨勬湇鍔?app.post('/api/preference', function (req, res) {
  try {
    if (req.body && typeof req.body.autoStartVoice === 'boolean') {
      AUTO_START_VOICE = req.body.autoStartVoice;
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ sdHost:SD_HOST, ttsHost:TTS_HOST, ollamaHost:OLLAMA_HOST, autoStartVoice:AUTO_START_VOICE, voices:VOICE_PROFILES }, null, 2));
      log('璇煶鏈嶅姟鑷姩鍚姩宸? + (AUTO_START_VOICE ? '寮€鍚? : '鍏抽棴'));
    }
    res.json({ ok:true, autoStartVoice:AUTO_START_VOICE });
  } catch (error) {
    res.status(400).json({ ok:false, error:error.message });
  }
});

// 鈹€鈹€鈹€ 鏄惧瓨璧勬簮璋冨害锛氬崟鏈嶅姟鍚仠 + 涓€閿ā寮忓垏鎹?鈹€鈹€鈹€
// 缁樺浘锛圵ebUI锛夈€佽闊筹紙GPT-SoVITS锛夈€佽亰澶╂ā鍨嬶紙Ollama锛変换浣曚袱涓悓鏃跺姞杞介兘鍙兘鎵撴弧鏄惧瓨锛?// 杩欓噷鎻愪緵鎸夐渶鍚仠锛屾ā寮忓垏鎹㈡寜鈥滃厛閲婃斁銆佸啀鍔犺浇鈥濈殑椤哄簭鎵ц銆?
app.post('/api/service/voice', function (req, res) {
  var action = req.body && req.body.action;
  if (!['start', 'stop'].includes(action)) return res.status(400).json({ ok:false, error:'action 蹇呴』鏄?start 鎴?stop' });
  var task = action === 'start'
    ? runScriptAsync(VOICE_START_SCRIPT, ['-WaitSeconds', '60'], 90000)
    : runScriptAsync(VOICE_STOP_SCRIPT, [], 30000);
  task.then(function (result) {
    refreshServiceStates();
    if (result.ok) log('GPT-SoVITS ' + (action === 'start' ? '宸插惎鍔? : '宸插仠姝?));
    else log('GPT-SoVITS ' + action + ' 澶辫触: ' + result.error);
  });
  res.json({ ok:true, pending:true, message:'璇煶鏈嶅姟姝ｅ湪' + (action === 'start' ? '鍚姩锛堢害闇€ 30鈥?0 绉掞級' : '鍋滄') + '锛岃鐣欐剰鐘舵€佺伅' });
});

app.post('/api/service/webui', function (req, res) {
  var action = req.body && req.body.action;
  if (!['start', 'stop'].includes(action)) return res.status(400).json({ ok:false, error:'action 蹇呴』鏄?start 鎴?stop' });
  runScriptAsync(WEBUI_MANAGER_SCRIPT, ['-Action', action === 'start' ? 'Start' : 'Stop'], 90000).then(function (result) {
    if (result.ok && result.message) {
      try {
        var parsed = JSON.parse(result.message);
        state.webuiManaged = !!parsed.managed;
        if (parsed.message) result.message = parsed.message;
      } catch (error) {}
    }
    refreshServiceStates();
    if (result.ok) log('WebUI ' + (action === 'start' ? '宸插惎鍔? : '宸插仠姝?));
    else log('WebUI ' + action + ' 澶辫触: ' + result.error);
  });
  res.json({ ok:true, pending:true, message:'WebUI 姝ｅ湪' + (action === 'start' ? '鍚姩' : '鍋滄') + '锛岃鐣欐剰鐘舵€佺伅' });
});

app.post('/api/service/ollama', function (req, res) {
  var action = req.body && req.body.action;
  if (action !== 'unload') return res.status(400).json({ ok:false, error:'action 鐩墠鍙敮鎸?unload' });
  unloadOllamaModels().then(function (result) {
    if (result.ok) log(result.message || 'Ollama 妯″瀷宸插嵏杞?);
    else log('Ollama 鍗歌浇澶辫触: ' + (result.error || '鏈煡閿欒'));
  });
  res.json({ ok:true, pending:true, message:'姝ｅ湪鍗歌浇 Ollama 宸插姞杞芥ā鍨嬧€? });
});

app.post('/api/mode', function (req, res) {
  var mode = req.body && req.body.mode;
  if (!['draw', 'chat'].includes(mode)) return res.status(400).json({ ok:false, error:'mode 蹇呴』鏄?draw 鎴?chat' });
  if (state.modeBusy) return res.status(409).json({ ok:false, error:'姝ｅ湪鍒囨崲妯″紡涓紝璇风◢鍊? });
  state.modeBusy = true;
  res.json({ ok:true, pending:true, message: mode === 'draw' ? '姝ｅ湪鍒囨崲鍒扮粯鍥句紭鍏堬細鍏堥噴鏀捐闊充笌鑱婂ぉ妯″瀷鏄惧瓨锛屽啀鍚姩 WebUI' : '姝ｅ湪鍒囨崲鍒拌亰澶╀紭鍏堬細閲婃斁鍙楃 WebUI锛屽惎鍔ㄨ闊虫湇鍔? });

  (async function () {
    if (mode === 'draw') {
      log('妯″紡鍒囨崲锛氱粯鍥句紭鍏?鈥斺€?鍋滄璇煶鏈嶅姟鈥?);
      var stopVoice = await runScriptAsync(VOICE_STOP_SCRIPT, [], 30000);
      if (!stopVoice.ok) log('鍋滄璇煶鏈嶅姟鏃跺嚭鐜版彁绀? ' + stopVoice.error);
      log('妯″紡鍒囨崲锛氱粯鍥句紭鍏?鈥斺€?鍗歌浇 Ollama 妯″瀷鈥?);
      var unload = await unloadOllamaModels();
      if (!unload.ok) log('Ollama 鍗歌浇鎻愮ず: ' + (unload.error || unload.message || ''));
      log('妯″紡鍒囨崲锛氱粯鍥句紭鍏?鈥斺€?鍚姩 WebUI鈥?);
      var startWebui = await runScriptAsync(WEBUI_MANAGER_SCRIPT, ['-Action', 'Start'], 90000);
      if (startWebui.ok) {
        try { state.webuiManaged = !!JSON.parse(startWebui.message || '{}').managed; } catch (error) {}
        log('缁樺浘浼樺厛妯″紡灏辩华锛氭樉瀛樺凡浼樺厛璁╃粰 WebUI');
      } else {
        log('WebUI 鍚姩澶辫触: ' + startWebui.error);
      }
    } else {
      if (state.webuiManaged) {
        log('妯″紡鍒囨崲锛氳亰澶╀紭鍏?鈥斺€?鍋滄鍙楃 WebUI 閲婃斁鏄惧瓨鈥?);
        var stopWebui = await runScriptAsync(WEBUI_MANAGER_SCRIPT, ['-Action', 'Stop'], 60000);
        if (stopWebui.ok) {
          try { state.webuiManaged = !!JSON.parse(stopWebui.message || '{}').managed; } catch (error) {}
        } else {
          log('鍋滄 WebUI 鏃跺嚭鐜版彁绀? ' + stopWebui.error);
        }
      } else {
        log('妯″紡鍒囨崲锛氳亰澶╀紭鍏?鈥斺€?WebUI 涓烘墜鍔ㄥ惎鍔ㄦ垨闈炲彈绠★紝淇濇寔涓嶅姩');
      }
      log('妯″紡鍒囨崲锛氳亰澶╀紭鍏?鈥斺€?鍚姩璇煶鏈嶅姟鈥?);
      var startVoice = await runScriptAsync(VOICE_START_SCRIPT, ['-WaitSeconds', '60'], 90000);
      if (startVoice.ok) log('鑱婂ぉ浼樺厛妯″紡灏辩华锛氳闊虫湇鍔″凡鍚姩');
      else log('璇煶鏈嶅姟鍚姩澶辫触: ' + startVoice.error);
    }
    refreshServiceStates();
    state.modeBusy = false;
  })().catch(function (error) {
    log('妯″紡鍒囨崲澶辫触: ' + error.message);
    refreshServiceStates();
    state.modeBusy = false;
  });
});

app.post('/api/start', function (req, res) {
  if (state.running) {
    return res.json({ ok: true, msg: 'Already running' });
  }
  var enableTunnel = req.body && typeof req.body.enableTunnel === 'boolean' ? req.body.enableTunnel : true;
  findAvailableGatewayPort(function (portError, gatewayPort) {
    if (portError) return res.status(503).json({ ok:false, msg:portError.message });
    state.gatewayPort = gatewayPort;
    state.token = crypto.randomBytes(8).toString('hex');
    state.domain = '';
    state.startTime = Date.now();
    state.tunnelStatus = enableTunnel ? (fs.existsSync(CLOUDFLARED_PATH) ? 'connecting' : 'unavailable') : 'disabled';
    log('Starting gateway on port ' + gatewayPort + '...');
    if (gatewayPort !== GW_PORT) log('Port ' + GW_PORT + ' is busy; using ' + gatewayPort + ' instead');

    runtimeTools.rotateLog(RUNTIME.gatewayLog, 2 * 1024 * 1024);
    var gatewayLogFd = fs.openSync(RUNTIME.gatewayLog, 'a');
    var server = cp.spawn('node', ['server.js'], {
      cwd: dir,
      env: Object.assign({}, process.env, { TOKEN: state.token, PORT: String(gatewayPort), SD_HOST: SD_HOST, TTS_HOST:TTS_HOST, DISABLE_TUNNEL: enableTunnel ? '' : '1' }),
      stdio: ['ignore', gatewayLogFd, gatewayLogFd],
      detached: true
    });
    fs.closeSync(gatewayLogFd);
    server.unref();

    fs.writeFileSync(RUNTIME.gatewayToken, state.token);
    fs.writeFileSync(RUNTIME.gatewayPid, String(server.pid));
    fs.writeFileSync(RUNTIME.gatewayPort, String(gatewayPort));
    log('Gateway started (PID ' + server.pid + ')');

    var tries = 0;
    var poll = setInterval(function () {
      fetchTunnelStatus(function () {
        tries++;
        if (state.domain) {
          state.tunnelStatus = 'ready';
          log('Tunnel ready: ' + state.domain);
          clearInterval(poll);
        } else if (tries > 30) {
          if (state.tunnelStatus === 'connecting') state.tunnelStatus = 'failed';
          log('Tunnel domain not ready yet');
          clearInterval(poll);
        }
      });
    }, 1500);

    state.running = true;
    res.json({ ok:true, token:state.token, gatewayPort:gatewayPort, localLink:'http://127.0.0.1:' + gatewayPort + '/' });
  });
});

app.post('/api/stop', function (req, res) {
  if (state.running) {
    log('Stopping gateway...');
    // cloudflared runs detached, so stop it separately before the gateway.
    killTunnelByPidFile(RUNTIME.tunnelPid, state.gatewayPort);
    killByPidFile(RUNTIME.gatewayPid, state.gatewayPort);
  }

  var voiceResult = stopManagedVoiceService();
  if (voiceResult.error) log('Voice service stop failed: ' + voiceResult.error);
  else if (voiceResult.attempted) log(voiceResult.message || 'GPT-SoVITS stopped.');
  var webuiResult = runManagedWebUI('Stop');
  if (!webuiResult.ok) log('Managed WebUI stop failed: ' + webuiResult.error);
  else log(webuiResult.message || 'Managed WebUI stopped.');

  state.running = false;
  state.domain = '';
  state.token = '';
  state.startTime = null;
  state.tunnelStatus = 'idle';
  state.gatewayPort = GW_PORT;
  try { fs.unlinkSync(RUNTIME.gatewayPort); } catch (e) {}
  log('Gateway, tunnel, managed voice service, and managed WebUI stopped');

  res.json({ ok: true, voiceStopped:!!voiceResult.attempted, voiceError:voiceResult.error || '', webuiStopped:!!webuiResult.managed, webuiError:webuiResult.error || '' });
});

app.get('/api/logs', function (req, res) {
  var since = parseInt(req.query.since) || 0;
  res.json({ logs: state.logs.slice(since) });
});

// 鈹€鈹€鈹€ Start control server 鈹€鈹€鈹€
var listener = app.listen(PORT, HOST, function () {
  console.log('');
  console.log('  ==============================================');
  console.log('  缁缁樺 Control Panel');
  console.log('  http://' + HOST + ':' + PORT);
  console.log('  ==============================================');
  console.log('');

  // 鍙湁鐢ㄦ埛鏄惧紡寮€鍚悗鎵嶈嚜鍔ㄥ惎鍔?GPT-SoVITS 鈥斺€?璇煶鏈嶅姟甯搁┗鍗犳樉瀛橈紝
  // 涓?WebUI / Ollama 鍚屾椂鎷夎捣瀹规槗鎶婃樉瀛樻墦婊★紝榛樿鏀逛负鎸夐渶鎵嬪姩/妯″紡鍒囨崲鍚姩銆?  if (process.env.NO_VOICE !== '1' && AUTO_START_VOICE) {
    setTimeout(function() {
      checkTTS();
      if (!state.ttsOnline) {
        log('Auto-starting GPT-SoVITS (autoStartVoice enabled)...');
        var voiceResult = startManagedVoiceService();
        if (voiceResult.error) {
          log('Auto-start voice service failed: ' + voiceResult.error);
        } else if (voiceResult.attempted) {
          log(voiceResult.message || 'GPT-SoVITS auto-started.');
        }
        // Re-check after startup
        setTimeout(function() { checkTTS(); }, 3000);
      }
    }, 2000);
  } else if (!AUTO_START_VOICE) {
    log('璇煶鏈嶅姟榛樿涓嶈嚜鍔ㄥ惎鍔紙鍙湪鈥滄樉瀛樿皟搴︹€濋潰鏉挎寜闇€寮€鍚級');
  }

  if (process.env.NO_OPEN !== '1') {
    try {
      var start = (process.platform === 'darwin') ? 'open' : (process.platform === 'win32') ? 'start' : 'xdg-open';
      cp.exec(start + ' http://localhost:' + PORT);
    } catch (e) {}
  }
});

listener.on('error', function (err) {
  if (err && err.code === 'EADDRINUSE') {
    console.error('鎺у埗闈㈡澘绔彛 ' + PORT + ' 宸茶鍗犵敤锛岃鍏堝叧闂棫瀹炰緥銆?);
  } else {
    console.error('鎺у埗闈㈡澘鍚姩澶辫触:', err && err.message ? err.message : err);
  }
  process.exitCode = 1;
});
