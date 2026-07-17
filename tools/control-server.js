var express = require('express');
var http = require('http');
var cp = require('child_process');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var app = express();
var PORT = 3001;
var GW_PORT = 3000;
var dir = path.join(__dirname, '..');

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

// Query gateway's /api/tunnel-status for domain + token
function fetchTunnelStatus(cb) {
  try {
    http.get('http://localhost:' + GW_PORT + '/api/tunnel-status', function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        try {
          var d = JSON.parse(body);
          if (d.url) state.domain = d.url;
          if (d.token) state.token = d.token;
        } catch (e) {}
        if (cb) cb();
      });
    }).on('error', function () { if (cb) cb(); });
  } catch (e) { if (cb) cb(); }
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
      try {
        cp.execSync('tasklist /fi "PID eq ' + pid + '" | findstr node', { stdio: 'pipe' });
        state.running = true;
        state.token = fs.readFileSync(path.join(dir, '.gateway_token'), 'utf8').trim();
        state.startTime = Date.now();
        fetchTunnelStatus();
        log('Detected running gateway (PID ' + pid + ')');
      } catch (e) {
        fs.unlinkSync(pidFile);
        try { fs.unlinkSync(path.join(dir, '.tunnel_pid')); } catch (e2) {}
      }
    }
  } catch (e) {}
  checkSD();
})();

// ─── API ───
app.use(express.json());

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'control.html'));
});

app.get('/api/status', function (req, res) {
  if (state.running) fetchTunnelStatus();
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

app.post('/api/start', function (req, res) {
  if (state.running) {
    return res.json({ ok: true, msg: 'Already running' });
  }

  state.token = crypto.randomBytes(8).toString('hex');
  state.domain = '';
  state.startTime = Date.now();
  log('Starting gateway...');

  // server.js now auto-starts the tunnel internally
  var server = cp.spawn('node', ['server.js'], {
    cwd: dir,
    env: Object.assign({}, process.env, { TOKEN: state.token, PORT: String(GW_PORT), SD_HOST: 'http://127.0.0.1:7860' }),
    stdio: 'ignore',
    detached: true
  });
  server.unref();

  fs.writeFileSync(path.join(dir, '.gateway_token'), state.token);
  fs.writeFileSync(path.join(dir, '.gateway_pid'), String(server.pid));
  log('Gateway started (PID ' + server.pid + ')');

  // Poll for tunnel domain (server.js spawns tunnel internally)
  var tries = 0;
  var poll = setInterval(function () {
    fetchTunnelStatus(function () {
      tries++;
      if (state.domain) {
        log('Tunnel ready: ' + state.domain);
        clearInterval(poll);
      } else if (tries > 30) {
        log('Tunnel domain not ready yet');
        clearInterval(poll);
      }
    });
  }, 1500);

  state.running = true;
  res.json({ ok: true, token: state.token });
});

app.post('/api/stop', function (req, res) {
  if (!state.running) {
    return res.json({ ok: true, msg: 'Already stopped' });
  }

  log('Stopping gateway...');
  // Kill gateway — tunnel is its child process, dies automatically
  killByPidFile(path.join(dir, '.gateway_pid'));

  state.running = false;
  state.domain = '';
  state.token = '';
  state.startTime = null;
  log('All processes stopped');

  res.json({ ok: true });
});

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
  } catch (e) {}
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

  try {
    var start = (process.platform === 'darwin') ? 'open' : (process.platform === 'win32') ? 'start' : 'xdg-open';
    cp.exec(start + ' http://localhost:' + PORT);
  } catch (e) {}
});
