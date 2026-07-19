var express = require('express');
var http = require('http');
var https = require('https');
var net = require('net');
var cp = require('child_process');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var runtimeTools = require('../scripts/runtime-paths');

var app = express();
app.disable('x-powered-by');
var PORT = 3001;
var GW_PORT = Number(process.env.GATEWAY_PORT) || 3000;
var HOST = '127.0.0.1';
var SD_HOST = process.env.SD_HOST || 'http://127.0.0.1:7860';
var TTS_HOST = process.env.TTS_HOST || 'http://127.0.0.1:9880';
var VOICE_PROFILES = { nene:{}, natsume:{} };
var SD_API_AUTH = process.env.SD_API_AUTH || '';
var dir = path.join(__dirname, '..');
var RUNTIME = runtimeTools.createRuntimePaths(dir);
runtimeTools.migrateLegacyRuntime(dir, RUNTIME);
runtimeTools.rotateLog(RUNTIME.controlLog, 2 * 1024 * 1024);
var CONFIG_FILE = RUNTIME.config;
var CLOUDFLARED_PATH = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';

// ─── State ───
var state = {
  running: false,
  token: '',
  domain: '',
  startTime: null,
  gatewayPort: GW_PORT,
  tunnelStatus: 'idle',
  sdOnline: false,
  ttsOnline: false,
  logs: []
};

// ─── Helpers ───
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
    throw new Error(label + ' 地址必须是本机 http(s) 地址');
  }
  if (target.username || target.password || (target.pathname && target.pathname !== '/') || target.search || target.hash) {
    throw new Error('请只填写' + label + '的地址和端口');
  }
  return target.origin;
}
function normalizeSDHost(value) { return normalizeLocalHost(value, 'SD WebUI'); }
function normalizeTTSHost(value) { return normalizeLocalHost(value, 'GPT-SoVITS'); }

function sanitizeVoiceProfile(value) {
  value = value && typeof value === 'object' ? value : {};
  return {
    refAudioPath: String(value.refAudioPath || '').trim().slice(0, 1000),
    promptText: String(value.promptText || '').trim().slice(0, 500),
    promptLang: String(value.promptLang || 'ja').trim().slice(0, 12) || 'ja',
    textLang: String(value.textLang || 'zh').trim().slice(0, 12) || 'zh'
  };
}

if (fs.existsSync(CONFIG_FILE)) {
  try {
    var savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (!process.env.SD_HOST && savedConfig.sdHost) SD_HOST = normalizeSDHost(savedConfig.sdHost);
    if (!process.env.TTS_HOST && savedConfig.ttsHost) TTS_HOST = normalizeTTSHost(savedConfig.ttsHost);
    if (savedConfig.voices) {
      VOICE_PROFILES.nene = sanitizeVoiceProfile(savedConfig.voices.nene);
      VOICE_PROFILES.natsume = sanitizeVoiceProfile(savedConfig.voices.natsume);
    }
  } catch (error) {
    console.warn('Ignoring invalid saved gateway config:', error.message);
  }
}

function findAvailableGatewayPort(callback) {
  var port = GW_PORT;
  var lastPort = GW_PORT + 20;
  function probe() {
    if (port > lastPort) return callback(new Error('端口 ' + GW_PORT + '-' + lastPort + ' 均被占用'));
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
})();

// ─── API ───
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

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'control.html'));
});

app.get('/api/status', function (req, res) {
  if (state.running) fetchTunnelStatus();
  checkSD();
  checkTTS();
  res.json({
    running: state.running,
    token: state.token,
    domain: state.domain,
    sdOnline: state.sdOnline,
    sdHost: SD_HOST,
    ttsOnline: !!state.ttsOnline,
    ttsHost: TTS_HOST,
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
  if (state.running) return res.status(409).json({ ok:false, error:'请先停止网关，再修改生成服务配置' });
  try {
    if (req.body && req.body.sdHost != null) SD_HOST = normalizeSDHost(req.body.sdHost);
    if (req.body && req.body.ttsHost != null) TTS_HOST = normalizeTTSHost(req.body.ttsHost);
    if (req.body && req.body.voices) {
      VOICE_PROFILES.nene = sanitizeVoiceProfile(req.body.voices.nene);
      VOICE_PROFILES.natsume = sanitizeVoiceProfile(req.body.voices.natsume);
    }
    state.sdOnline = false;
    state.ttsOnline = false;
    lastSDCheck = 0;
    lastTTSCheck = 0;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ sdHost:SD_HOST, ttsHost:TTS_HOST, voices:VOICE_PROFILES }, null, 2));
    checkSD();
    checkTTS();
    log('SD WebUI address: ' + SD_HOST);
    log('GPT-SoVITS address: ' + TTS_HOST);
    res.json({ ok:true, sdHost:SD_HOST, ttsHost:TTS_HOST, voices:VOICE_PROFILES });
  } catch (error) {
    res.status(400).json({ ok:false, error:error.message });
  }
});

app.post('/api/start', function (req, res) {
  if (state.running) {
    return res.json({ ok: true, msg: 'Already running' });
  }
  findAvailableGatewayPort(function (portError, gatewayPort) {
    if (portError) return res.status(503).json({ ok:false, msg:portError.message });
    state.gatewayPort = gatewayPort;
    state.token = crypto.randomBytes(8).toString('hex');
    state.domain = '';
    state.startTime = Date.now();
    state.tunnelStatus = process.env.DISABLE_TUNNEL === '1' ? 'disabled' : (fs.existsSync(CLOUDFLARED_PATH) ? 'connecting' : 'unavailable');
    log('Starting gateway on port ' + gatewayPort + '...');
    if (gatewayPort !== GW_PORT) log('Port ' + GW_PORT + ' is busy; using ' + gatewayPort + ' instead');

    runtimeTools.rotateLog(RUNTIME.gatewayLog, 2 * 1024 * 1024);
    var gatewayLogFd = fs.openSync(RUNTIME.gatewayLog, 'a');
    var server = cp.spawn('node', ['server.js'], {
      cwd: dir,
      env: Object.assign({}, process.env, { TOKEN: state.token, PORT: String(gatewayPort), SD_HOST: SD_HOST, TTS_HOST:TTS_HOST }),
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
  if (!state.running) {
    return res.json({ ok: true, msg: 'Already stopped' });
  }

  log('Stopping gateway...');
  // cloudflared runs detached, so stop it separately before the gateway.
  killTunnelByPidFile(RUNTIME.tunnelPid, state.gatewayPort);
  killByPidFile(RUNTIME.gatewayPid, state.gatewayPort);

  state.running = false;
  state.domain = '';
  state.token = '';
  state.startTime = null;
  state.tunnelStatus = 'idle';
  state.gatewayPort = GW_PORT;
  try { fs.unlinkSync(RUNTIME.gatewayPort); } catch (e) {}
  log('All processes stopped');

  res.json({ ok: true });
});

app.get('/api/logs', function (req, res) {
  var since = parseInt(req.query.since) || 0;
  res.json({ logs: state.logs.slice(since) });
});

// ─── Start control server ───
var listener = app.listen(PORT, HOST, function () {
  console.log('');
  console.log('  ==============================================');
  console.log('  AI-CG-Studio Control Panel');
  console.log('  http://' + HOST + ':' + PORT);
  console.log('  ==============================================');
  console.log('');

  if (process.env.NO_OPEN !== '1') {
    try {
      var start = (process.platform === 'darwin') ? 'open' : (process.platform === 'win32') ? 'start' : 'xdg-open';
      cp.exec(start + ' http://localhost:' + PORT);
    } catch (e) {}
  }
});

listener.on('error', function (err) {
  if (err && err.code === 'EADDRINUSE') {
    console.error('控制面板端口 ' + PORT + ' 已被占用，请先关闭旧实例。');
  } else {
    console.error('控制面板启动失败:', err && err.message ? err.message : err);
  }
  process.exitCode = 1;
});
