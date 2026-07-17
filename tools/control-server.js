var express = require('express');
var cp = require('child_process');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var app = express();
var PORT = 3001;
var dir = path.join(__dirname, '..');
var cf = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';

// ─── State ───
var state = {
  running: false,
  token: '',
  domain: '',
  startTime: null,
  sdOnline: false,
  logs: []
};

// ─── Helpers ───
function log(msg) {
  var line = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  state.logs.push(line);
  if (state.logs.length > 200) state.logs.shift();
  console.log(line);
}

function checkSD() {
  try {
    cp.execSync('curl -s -o nul -w "%{http_code}" http://127.0.0.1:7860/sdapi/v1/sd-models', { stdio: 'pipe' });
    state.sdOnline = true;
  } catch (e) {
    state.sdOnline = false;
  }
}

function readTunnelDomain() {
  try {
    var logFile = path.join(dir, 'tunnel.log');
    var content = fs.readFileSync(logFile, 'utf8');
    var m = content.match(/https:\/\/\S+trycloudflare\.com/);
    if (m) state.domain = m[0];
  } catch (e) {}
}

function killByPidFile(pidFile) {
  try {
    if (!fs.existsSync(pidFile)) return;
    var pid = fs.readFileSync(pidFile, 'utf8').trim();
    if (pid) {
      try { cp.execSync('taskkill /pid ' + pid + ' /f', { stdio: 'pipe' }); } catch (e) {}
    }
    fs.unlinkSync(pidFile);
  } catch (e) {}
}

// Check if gateway is already running on startup
(function checkExisting() {
  try {
    var pidFile = path.join(dir, '.gateway_pid');
    if (fs.existsSync(pidFile)) {
      var pid = fs.readFileSync(pidFile, 'utf8').trim();
      // Check if process is still alive
      try {
        cp.execSync('tasklist /fi "PID eq ' + pid + '" | findstr node', { stdio: 'pipe' });
        state.running = true;
        state.token = fs.readFileSync(path.join(dir, '.gateway_token'), 'utf8').trim();
        state.startTime = Date.now();
        readTunnelDomain();
        log('Detected running gateway (PID ' + pid + ')');
      } catch (e) {
        // Process not running, clean up stale PID files
        fs.unlinkSync(pidFile);
        try { fs.unlinkSync(path.join(dir, '.tunnel_pid')); } catch (e2) {}
      }
    }
  } catch (e) {}
  checkSD();
})();

// ─── API ───
app.use(express.json());

// Serve control panel
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'control.html'));
});

// Status endpoint
app.get('/api/status', function (req, res) {
  if (state.running) readTunnelDomain();
  checkSD();
  res.json({
    running: state.running,
    token: state.token,
    domain: state.domain,
    sdOnline: state.sdOnline,
    uptime: state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0,
    shareLink: state.domain && state.token ? state.domain + '?token=' + state.token : ''
  });
});

// Start gateway
app.post('/api/start', function (req, res) {
  if (state.running) {
    return res.json({ ok: true, msg: 'Already running' });
  }

  state.token = crypto.randomBytes(8).toString('hex');
  state.domain = '';
  state.startTime = Date.now();
  log('Starting gateway...');

  // Start gateway server
  var server = cp.spawn('node', ['server.js'], {
    cwd: dir,
    env: Object.assign({}, process.env, { TOKEN: state.token, PORT: '3000', SD_HOST: 'http://127.0.0.1:7860' }),
    stdio: 'ignore',
    detached: true
  });
  server.unref();

  fs.writeFileSync(path.join(dir, '.gateway_token'), state.token);
  fs.writeFileSync(path.join(dir, '.gateway_pid'), String(server.pid));
  log('Gateway started (PID ' + server.pid + ', token ' + state.token + ')');

  // Start tunnel after 2s
  setTimeout(function () {
    log('Starting Cloudflare Tunnel...');
    var tunnelLog = path.join(dir, 'tunnel.log');
    var logFd = fs.openSync(tunnelLog, 'w');
    var tunnel = cp.spawn(cf, ['tunnel', '--url', 'http://localhost:3000'], {
      stdio: ['ignore', logFd, logFd],
      detached: true
    });
    tunnel.unref();
    fs.closeSync(logFd);
    fs.writeFileSync(path.join(dir, '.tunnel_pid'), String(tunnel.pid));
    log('Tunnel started (PID ' + tunnel.pid + ')');

    // Poll for domain
    var tries = 0;
    var poll = setInterval(function () {
      readTunnelDomain();
      tries++;
      if (state.domain) {
        log('Tunnel domain: ' + state.domain);
        clearInterval(poll);
      } else if (tries > 20) {
        log('Tunnel domain not ready yet');
        clearInterval(poll);
      }
    }, 1000);
  }, 2000);

  state.running = true;
  res.json({ ok: true, token: state.token });
});

// Stop gateway
app.post('/api/stop', function (req, res) {
  if (!state.running) {
    return res.json({ ok: true, msg: 'Already stopped' });
  }

  log('Stopping gateway...');
  killByPidFile(path.join(dir, '.gateway_pid'));
  killByPidFile(path.join(dir, '.tunnel_pid'));

  state.running = false;
  state.domain = '';
  state.token = '';
  state.startTime = null;
  log('All processes stopped');

  res.json({ ok: true });
});

// Logs endpoint (simple polling)
app.get('/api/logs', function (req, res) {
  var since = parseInt(req.query.since) || 0;
  res.json({ logs: state.logs.slice(since) });
});

// ─── Kill old instance if port is occupied ───
function killPortOccupant(port) {
  try {
    var out = cp.execSync('netstat -ano | findstr ":' + port + '.*LISTENING"', { encoding: 'utf8', stdio: 'pipe' });
    var m = out.match(/LISTENING\s+(\d+)/);
    if (m && m[1]) {
      console.log('  Port ' + port + ' occupied by PID ' + m[1] + ', killing...');
      try { cp.execSync('taskkill /pid ' + m[1] + ' /f', { stdio: 'pipe' }); } catch (e) {}
    }
  } catch (e) {} // port is free
}

killPortOccupant(PORT);

// ─── Start control server ───
app.listen(PORT, function () {
  console.log('');
  console.log('  ==============================================');
  console.log('  AI-CG-Studio Control Panel');
  console.log('  http://localhost:' + PORT);
  console.log('  ==============================================');
  console.log('');

  // Auto-open browser
  try {
    var start = (process.platform === 'darwin') ? 'open' : (process.platform === 'win32') ? 'start' : 'xdg-open';
    cp.exec(start + ' http://localhost:' + PORT);
  } catch (e) {}
});
