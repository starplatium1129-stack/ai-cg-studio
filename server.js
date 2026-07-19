var express = require('express');
var { createProxyMiddleware } = require('http-proxy-middleware');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var cp = require('child_process');
var runtimeTools = require('./scripts/runtime-paths');

var RUNTIME = runtimeTools.createRuntimePaths(__dirname);
runtimeTools.migrateLegacyRuntime(__dirname, RUNTIME);
var runtimeConfig = {};
try { runtimeConfig = JSON.parse(fs.readFileSync(RUNTIME.config, 'utf8')); } catch (error) {}

var app = express();
app.disable('x-powered-by');
var PORT = process.env.PORT || 3000;
var HOST = process.env.HOST || '127.0.0.1';
var SD_HOST = process.env.SD_HOST || runtimeConfig.sdHost || 'http://127.0.0.1:7860';
var TTS_HOST = process.env.TTS_HOST || runtimeConfig.ttsHost || 'http://127.0.0.1:9880';
var VOICE_PROFILES = runtimeConfig.voices && typeof runtimeConfig.voices === 'object' ? runtimeConfig.voices : {};
var SD_API_AUTH = process.env.SD_API_AUTH || '';
var DISABLE_TUNNEL = process.env.DISABLE_TUNNEL === '1';
var TOKEN = process.env.TOKEN || crypto.randomBytes(8).toString('hex');
var CF = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
var tunnelUrl = '';

function tokenMatches(value) {
  if (typeof value !== 'string') return false;
  var actual = Buffer.from(value);
  var expected = Buffer.from(TOKEN);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function isDirectLocalRequest(req) {
  var address = (req.socket && req.socket.remoteAddress) || '';
  var loopback = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  var forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.headers.forwarded;
  return loopback && !forwarded;
}

// ─── 基础安全响应头 ───
app.use(function (req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' data: blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});

// ─── Token 认证中间件（cookie 持久化，解决子资源无 token 问题）───
app.use(function (req, res, next) {
  // 本机直接访问无需 token；Cloudflare 隧道请求带转发来源头，仍必须验证 token。
  if (isDirectLocalRequest(req)) return next();
  // 从 query / header / cookie 三个位置取 token
  var t = req.query.token || req.headers['x-token'] || (req.headers.cookie || '').match(/aics_token=([^;]+)/);
  if (t && typeof t === 'object') t = t[1]; // regex match group
  if (tokenMatches(t)) {
    // 首次带 ?token= 来访时种 Cookie，并跳转到干净 URL，避免 Token 留在历史/Referrer 中
    if (req.query.token) {
      var secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      res.setHeader('Set-Cookie', 'aics_token=' + TOKEN + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400' + (secure ? '; Secure' : ''));
      var cleanUrl = new URL(req.originalUrl, 'http://localhost');
      cleanUrl.searchParams.delete('token');
      return res.redirect(302, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    }
    return next();
  }
  // API 请求返回 401
  if (req.path.startsWith('/sdapi') || req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized — 缺少 token 参数' });
  }
  // 静态页面没有 token 时显示引导页
  return res.status(403).send(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI-CG-Studio</title>' +
    '<style>body{background:#1a1a2e;color:#e8e8f0;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}' +
    '.card{background:#2a2a40;border-radius:16px;padding:40px;max-width:480px;text-align:center}h1{margin-top:0;color:#f06292}' +
    'a{color:#64b5f6}</style></head><body><div class="card">' +
    '<h1>🔗 AI-CG-Studio</h1><p>请使用包含 token 的链接访问，格式：</p>' +
    '<code>http://地址:端口/?token=你的token</code>' +
    '<p style="margin-top:24px;color:#a8a8c0">如果你是朋友分享的链接，链接里应该已经带了 token。</p>' +
    '</div></body></html>'
  );
});

// ─── 图片备份接口（express.json 只挂在这条路由上，不影响 proxy 的 body 流）───
app.post('/api/save-backup', express.json({ limit: '22mb' }), function (req, res) {
  try {
    var imageBase64 = req.body.imageBase64;
    var filename = req.body.filename;
    if (!imageBase64) return res.status(400).json({ error: 'No image data' });

    var match = String(imageBase64).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) return res.status(400).json({ error: '仅支持 PNG、JPEG 或 WebP 图片' });

    var imageBuffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!imageBuffer.length || imageBuffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({ error: '图片大小必须在 15MB 以内' });
    }

    var backupDir = RUNTIME.outputs;
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    var ext = match[1] === 'jpeg' ? '.jpg' : '.' + match[1];
    var requestedStem = filename ? path.parse(path.basename(String(filename))).name : 'backup';
    var safeStem = requestedStem.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'backup';
    var name = safeStem + '_' + Date.now() + ext;
    var target = path.resolve(backupDir, name);
    if (!target.startsWith(path.resolve(backupDir) + path.sep)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    fs.writeFileSync(target, imageBuffer);

    console.log('  💾 图片已备份: ' + name);
    res.json({ status: 'ok', file: name });
  } catch (err) {
    console.error('  ❌ 备份失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 网关能力检测（不依赖固定端口，控制面板换端口后仍可识别）───
app.get('/api/health', function (req, res) {
  res.json({ ok: true, app: 'ai-cg-studio', gateway: true, port: Number(PORT), tts: true });
});

function configuredVoiceMap() {
  var result = {};
  ['nene', 'natsume'].forEach(function (id) {
    var profile = VOICE_PROFILES[id] || {};
    result[id] = !!(profile.refAudioPath && profile.promptText);
  });
  return result;
}

function requestTTSStatus(callback) {
  try {
    var target = new URL('/docs', TTS_HOST);
    var transport = target.protocol === 'https:' ? require('https') : require('http');
    var request = transport.get(target, function (response) {
      response.resume();
      callback(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.setTimeout(1500, function () { request.destroy(new Error('timeout')); });
    request.on('error', function () { callback(false); });
  } catch (error) { callback(false); }
}

app.get('/api/tts-status', function (req, res) {
  requestTTSStatus(function (online) {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ online: online, engine: 'GPT-SoVITS', voices: configuredVoiceMap() });
  });
});

app.post('/api/tts', express.json({ limit:'32kb' }), function (req, res) {
  var voice = String(req.body && req.body.voice || '');
  var text = String(req.body && req.body.text || '').trim();
  var speed = Number(req.body && req.body.speed);
  var profile = VOICE_PROFILES[voice];
  if (!['nene', 'natsume'].includes(voice)) return res.status(400).json({ error:'不支持的角色声线' });
  if (!text || text.length > 2000) return res.status(400).json({ error:'台词长度必须在 1–2000 字之间' });
  if (!profile || !profile.refAudioPath || !profile.promptText) return res.status(409).json({ error:'该角色尚未在启动控制面板配置 GPT-SoVITS 参考音频' });
  if (!Number.isFinite(speed)) speed = 1;
  speed = Math.max(0.75, Math.min(1.35, speed));

  var payload = JSON.stringify({
    text: text,
    text_lang: profile.textLang || 'zh',
    ref_audio_path: profile.refAudioPath,
    prompt_lang: profile.promptLang || 'ja',
    prompt_text: profile.promptText,
    text_split_method: 'cut5',
    batch_size: 1,
    speed_factor: speed,
    media_type: 'wav',
    streaming_mode: false
  });
  try {
    var target = new URL('/tts', TTS_HOST);
    var transport = target.protocol === 'https:' ? require('https') : require('http');
    var upstream = transport.request(target, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(payload) }
    }, function (response) {
      var chunks = [];
      var total = 0;
      response.on('data', function (chunk) {
        total += chunk.length;
        if (total > 32 * 1024 * 1024) return upstream.destroy(new Error('语音返回超过 32MB'));
        chunks.push(chunk);
      });
      response.on('end', function () {
        var body = Buffer.concat(chunks);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          var detail = body.toString('utf8').slice(0, 500);
          return res.status(502).json({ error:'GPT-SoVITS 生成失败', detail:detail });
        }
        res.setHeader('Content-Type', response.headers['content-type'] || 'audio/wav');
        res.setHeader('Content-Length', body.length);
        res.setHeader('Cache-Control', 'no-store');
        res.end(body);
      });
    });
    upstream.setTimeout(5 * 60 * 1000, function () { upstream.destroy(new Error('GPT-SoVITS 请求超时')); });
    upstream.on('error', function (error) {
      if (!res.headersSent) res.status(502).json({ error:'无法连接 GPT-SoVITS', detail:error.message });
    });
    upstream.end(payload);
  } catch (error) {
    res.status(500).json({ error:'TTS 请求构建失败', detail:error.message });
  }
});

// ─── Tunnel 状态接口（已受 Token 中间件保护，且不再回传 Token）───
app.get('/api/tunnel-status', function (req, res) {
  res.json({ url: tunnelUrl });
});

// ─── 静态文件托管白名单 ───
app.get(['/', '/index.html'], function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.use('/css', express.static(path.join(__dirname, 'css'), { dotfiles: 'deny', index: false }));
app.use('/data', express.static(path.join(__dirname, 'data'), { dotfiles: 'deny', index: false }));
app.use('/docs', express.static(path.join(__dirname, 'docs'), { dotfiles: 'deny' }));
app.use('/tools', function (req, res, next) {
  if (req.path === '/control-server.js') return res.status(404).end();
  next();
}, express.static(path.join(__dirname, 'tools'), { dotfiles: 'deny' }));

// ─── SD API 反代（pathFilter 而非 app.use，避免 Express 剥前缀）───
app.use(createProxyMiddleware({
  target: SD_HOST,
  changeOrigin: true,
  ws: true,
  pathFilter: '/sdapi',
  proxyTimeout: 20 * 60 * 1000,
  auth: SD_API_AUTH || undefined,
  on: {
    proxyReq: function () {
      console.log('  → SD API 请求已转发');
    },
    error: function (err, req, res) {
      console.error('  ❌ SD 代理错误:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'SD WebUI 未响应，请确认已启动 (' + SD_HOST + ')' });
      }
    }
  }
}));

// ─── 启动 ───
app.listen(PORT, HOST, function () {
  console.log('');
  console.log('  ═══════════════════════════════════════════');
  console.log('  🔗 AI-CG-Studio 联机网关已启动');
  console.log('  📡 端口: ' + PORT);
  console.log('  🛡️ 监听: ' + HOST);
  console.log('  🎨 SD 后端: ' + SD_HOST);
  console.log('  🔊 TTS 后端: ' + TTS_HOST);
  console.log('  🔑 Token: ' + TOKEN);
  console.log('  ═══════════════════════════════════════════');
  console.log('');

  // 自动启动 Cloudflare Tunnel（本地测试可用 DISABLE_TUNNEL=1 关闭）
  if (!DISABLE_TUNNEL) startTunnel();
});

// ─── Cloudflare Tunnel ───
function startTunnel() {
  if (!fs.existsSync(CF)) {
    console.log('  ⚠ cloudflared not found, tunnel disabled');
    return;
  }
  console.log('  🌐 Starting Cloudflare Tunnel...');
  runtimeTools.rotateLog(RUNTIME.tunnelLog, 2 * 1024 * 1024);
  var logFile = RUNTIME.tunnelLog;
  var logFd = fs.openSync(logFile, 'w');
  var tunnel = cp.spawn(CF, ['tunnel', '--url', 'http://localhost:' + PORT], {
    stdio: ['ignore', logFd, logFd],
    detached: true
  });
  tunnel.unref();
  fs.closeSync(logFd);

  // Save tunnel PID
  try { fs.writeFileSync(RUNTIME.tunnelPid, String(tunnel.pid)); } catch (e) {}

  // Poll tunnel.log for domain
  var tries = 0;
  var poll = setInterval(function () {
    try {
      var log = fs.readFileSync(logFile, 'utf8');
      var m = log.match(/https:\/\/\S+trycloudflare\.com/);
      if (m) {
        tunnelUrl = m[0];
        console.log('  🌐 Tunnel: ' + tunnelUrl + '?token=' + TOKEN);
        clearInterval(poll);
      }
    } catch (e) {}
    tries++;
    if (tries > 30) clearInterval(poll);
  }, 1000);
}
