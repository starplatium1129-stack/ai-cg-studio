var express = require('express');
var { createProxyMiddleware } = require('http-proxy-middleware');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var cp = require('child_process');
var runtimeTools = require('./scripts/runtime-paths');
var sceneStore = require('./scripts/scene-store');

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
var OLLAMA_HOST = process.env.OLLAMA_HOST || runtimeConfig.ollamaHost || 'http://127.0.0.1:11434';
var OLLAMA_MODEL = process.env.OLLAMA_MODEL || runtimeConfig.ollamaModel || '';
var VOICE_PROFILES = runtimeConfig.voices && typeof runtimeConfig.voices === 'object' ? runtimeConfig.voices : {};
var TRANSLATION_PYTHON = process.env.TRANSLATION_PYTHON || path.resolve(__dirname, '..', 'AI', 'GPT-SoVITS-env', 'python.exe');
var TRANSLATION_SCRIPT = path.join(__dirname, 'tools', 'translate-zh-ja.py');
var activeGPTWeights = '';
var activeSoVITSWeights = '';
var voiceQueue = Promise.resolve();
var translationQueue = Promise.resolve();
var SD_API_AUTH = process.env.SD_API_AUTH || '';
var DISABLE_TUNNEL = process.env.DISABLE_TUNNEL === '1';
var TOKEN = process.env.TOKEN || crypto.randomBytes(8).toString('hex');
var CF = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
var tunnelUrl = '';
var pendingTunnelUrl = '';

function resolveSceneShowcaseDir() {
  var configured = process.env.SCENE_SHOWCASE_DIR;
  if (configured) {
    var configuredPath = path.resolve(configured);
    return fs.existsSync(path.join(configuredPath, 'manifest.json')) ? configuredPath : '';
  }
  var root = path.resolve(__dirname, '..', 'AI', 'SceneShowcase');
  if (fs.existsSync(path.join(root, 'manifest.json'))) return root;
  if (!fs.existsSync(root)) return '';
  try {
    return fs.readdirSync(root, { withFileTypes:true })
      .filter(function (entry) { return entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'manifest.json')); })
      .map(function (entry) { return path.join(root, entry.name); })
      .sort(function (a, b) { return path.basename(b).localeCompare(path.basename(a), 'zh-CN'); })[0] || '';
  } catch (error) { return ''; }
}

var SCENE_SHOWCASE_DIR = resolveSceneShowcaseDir();
var MAINTENANCE_BACKUP_DIR = path.join(RUNTIME.root, 'maintenance-backups');

function maintenanceLocalOnly(req, res, next) {
  if (!isDirectLocalRequest(req)) return res.status(403).json({ error: '维护操作仅允许在本机执行' });
  next();
}

function maintenanceSnapshot() {
  var files = [sceneStore.aggregatePath, path.join(__dirname, 'data', 'retired-scenes.json')];
  var shardInfo = sceneStore.loadSceneShards();
  shardInfo.sources.forEach(function (item) { files.push(item.source); });
  return files.filter(function (file) { return fs.existsSync(file); }).map(function (file) {
    return { file:file, content:fs.readFileSync(file) };
  });
}

function restoreMaintenanceSnapshot(snapshot) {
  snapshot.forEach(function (item) { fs.writeFileSync(item.file, item.content); });
}

function runMaintenanceChecks() {
  var commands = [
    ['scripts/classify-scene-ratings.js', ['--write']],
    ['scripts/optimize-scenes.js', ['--write']],
    ['scripts/validate-scenes.js', []]
  ];
  for (var i = 0; i < commands.length; i += 1) {
    var result = cp.spawnSync(process.execPath, [commands[i][0]].concat(commands[i][1]), {
      cwd:__dirname, encoding:'utf8', timeout:120000, windowsHide:true
    });
    if (result.error || result.status !== 0) {
      throw new Error((result.stderr || result.stdout || result.error && result.error.message || '维护校验失败').trim().slice(-1200));
    }
  }
}

app.post('/api/maintenance/scenes', maintenanceLocalOnly, express.json({ limit:'12mb' }), function (req, res) {
  var scenes = req.body && req.body.scenes;
  if (!Array.isArray(scenes) || scenes.length > 1000) return res.status(400).json({ error:'场景数据格式错误或数量超出限制' });
  var ids = new Set();
  for (var i = 0; i < scenes.length; i += 1) {
    var id = String(scenes[i] && scenes[i].id || '');
    if (!/^sc\d{3,}$/.test(id) || ids.has(id)) return res.status(400).json({ error:'场景 ID 必须唯一且符合 sc001 格式：' + id });
    ids.add(id);
  }
  var snapshot;
  try {
    snapshot = maintenanceSnapshot();
    if (!fs.existsSync(MAINTENANCE_BACKUP_DIR)) fs.mkdirSync(MAINTENANCE_BACKUP_DIR, { recursive:true });
    var stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(MAINTENANCE_BACKUP_DIR, 'scenes-' + stamp + '.json'), sceneStore.jsonText(sceneStore.loadSceneShards().scenes));
    sceneStore.writeSceneSet(scenes);
    runMaintenanceChecks();
    res.json({ ok:true, count:scenes.length, message:'场景已保存并通过校验' });
  } catch (error) {
    if (snapshot) {
      try { restoreMaintenanceSnapshot(snapshot); } catch (restoreError) {}
    }
    res.status(400).json({ ok:false, error:error.message });
  }
});

app.post('/api/maintenance/showcase', maintenanceLocalOnly, express.json({ limit:'18mb' }), function (req, res) {
  try {
    if (!SCENE_SHOWCASE_DIR) return res.status(503).json({ error:'尚未找到 SceneShowcase 目录' });
    var id = String(req.body && req.body.id || '');
    var image = String(req.body && req.body.image || '');
    var match = image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!/^sc\d{3,}$/.test(id) || !match) return res.status(400).json({ error:'需要合法场景 ID 和 PNG/JPEG/WebP 图片' });
    var buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length || buffer.length > 15 * 1024 * 1024) return res.status(413).json({ error:'图片必须在 15MB 以内' });
    var ext = match[1] === 'jpeg' ? '.jpg' : '.' + match[1];
    var imageDir = path.join(SCENE_SHOWCASE_DIR, 'images');
    var thumbDir = path.join(SCENE_SHOWCASE_DIR, 'thumbs');
    fs.mkdirSync(imageDir, { recursive:true });
    fs.mkdirSync(thumbDir, { recursive:true });
    fs.writeFileSync(path.join(imageDir, id + ext), buffer);
    // Keep the gallery immediately consistent. A later showcase build can replace
    // this full-size thumbnail with a smaller optimized derivative.
    fs.writeFileSync(path.join(thumbDir, id + ext), buffer);
    res.json({ ok:true, file:'images/' + id + ext, message:'样张与缩略图已保存，刷新页面即可看到新版本' });
  } catch (error) {
    res.status(400).json({ ok:false, error:error.message });
  }
});

function readSceneShowcaseManifest() {
  if (!SCENE_SHOWCASE_DIR) return null;
  try {
    var manifest = JSON.parse(fs.readFileSync(path.join(SCENE_SHOWCASE_DIR, 'manifest.json'), 'utf8'));
    if (!manifest || !Array.isArray(manifest.entries)) return null;
    return manifest;
  } catch (error) { return null; }
}

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

  // Live2D (PixiJS) requires unsafe-eval for shader compilation
  // Only relax CSP for chat page to minimize security impact
  if (req.path === '/tools/chat.html' || req.path === '/tools/chat') {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
      "connect-src 'self' data: blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    );
  } else {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; " +
      "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
      "connect-src 'self' data: blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    );
  }

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
  if (req.path.startsWith('/sdapi') || req.path.startsWith('/controlnet') || req.path.startsWith('/adetailer') || req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized — 缺少 token 参数' });
  }
  // 静态页面没有 token 时显示引导页
  return res.status(403).send(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>绫季绘境</title>' +
    '<style>body{background:#1a1a2e;color:#e8e8f0;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}' +
    '.card{background:#2a2a40;border-radius:16px;padding:40px;max-width:480px;text-align:center}h1{margin-top:0;color:#f06292}' +
    'a{color:#64b5f6}</style></head><body><div class="card">' +
    '<h1>🔗 绫季绘境</h1><p>请使用包含 token 的链接访问，格式：</p>' +
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
  res.json({ ok: true, app: 'ai-cg-studio', gateway: true, port: Number(PORT), tts: true, chat: true });
});

app.get('/api/showcase-status', function (req, res) {
  var manifest = readSceneShowcaseManifest();
  res.setHeader('Cache-Control', 'no-store');
  if (!manifest) return res.json({ available:false, sceneCount:0 });
  res.json({
    available:true,
    sceneCount:Number(manifest.sceneCount) || manifest.entries.length,
    counts:manifest.counts || {},
    sourceAudit:manifest.sourceAudit || ''
  });
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

function requestOllama(pathname, options) {
  options = options || {};
  return new Promise(function(resolve, reject) {
    try {
      var target = new URL(pathname, OLLAMA_HOST);
      var payload = options.payload ? JSON.stringify(options.payload) : '';
      var transport = target.protocol === 'https:' ? require('https') : require('http');
      var request = transport.request(target, {
        method:options.method || 'GET',
        headers:payload ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)} : undefined
      }, function(response) {
        resolve({ response:response, request:request });
      });
      request.setTimeout(options.timeout || 15000, function() { request.destroy(new Error('Ollama request timed out')); });
      request.on('error', reject);
      request.end(payload);
    } catch (error) { reject(error); }
  });
}

function readOllamaJSON(pathname, timeout) {
  return requestOllama(pathname, { timeout:timeout || 4000 }).then(function(result) {
    return new Promise(function(resolve, reject) {
      var chunks = [], total = 0;
      result.response.on('data', function(chunk) {
        total += chunk.length;
        if (total > 2 * 1024 * 1024) return result.request.destroy(new Error('Ollama response exceeded the size limit'));
        chunks.push(chunk);
      });
      result.response.on('end', function() {
        if (result.response.statusCode < 200 || result.response.statusCode >= 300) {
          return reject(new Error('Ollama returned ' + result.response.statusCode));
        }
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (error) { reject(new Error('Ollama returned invalid JSON')); }
      });
      result.response.on('error', reject);
    });
  });
}

function preferredOllamaModel(models) {
  if (OLLAMA_MODEL && models.some(function(item){ return item.name === OLLAMA_MODEL || item.model === OLLAMA_MODEL; })) return OLLAMA_MODEL;
  var available = models.filter(function(item) {
    var capabilities = Array.isArray(item.capabilities) ? item.capabilities : [];
    return !capabilities.length || capabilities.includes('completion');
  });
  return available.length ? String(available[0].name || available[0].model || '') : '';
}

app.get('/api/chat-status', function(req, res) {
  readOllamaJSON('/api/tags', 3000).then(function(data) {
    var models = Array.isArray(data.models) ? data.models : [];
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      online:true,
      model:preferredOllamaModel(models),
      models:models.map(function(item) {
        return {
          name:String(item.name || item.model || ''),
          size:Number(item.size) || 0,
          parameters:item.details && item.details.parameter_size || '',
          quantization:item.details && item.details.quantization_level || ''
        };
      }).filter(function(item){ return item.name; })
    });
  }).catch(function(error) {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ online:false, model:'', models:[], error:error.message });
  });
});

app.get('/api/live2d-status', function(req, res) {
  var modelPath = path.join(__dirname, 'assets', 'live2d', 'nene', 'nene.model3.json');
  var available = fs.existsSync(modelPath);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    available: available,
    modelUrl: available ? '/assets/live2d/nene/nene.model3.json' : '',
    source: available ? 'project-local' : 'missing'
  });
});

function chatCharacterPrompt(character) {
  if (character === 'natsume') {
    return [
      '你正在扮演四季夏目，与用户进行轻松的私人文字聊天。',
      '性格：外冷内柔，不擅长直接表达感情，相当纯情；关心通常通过行动和简短提醒表达，动摇时会否认或转开话题。',
      '语气：克制、简短、自然，熟悉后偶尔有一点小脾气；不要把她写成刻薄、轻浮、特工或万能助手。',
      '背景：大学生，也是 Café Stella 店员。',
      '只输出夏目实际说出口的中文台词，不写旁白、动作括号、角色名、引号或解释。',
      '每次回复一到三句，通常不超过 100 个汉字。可以主动追问，但不要连续盘问。',
      '这是虚构角色扮演，不声称自己是真人。涉及危险、违法或未成年人性内容时，保持安全并自然转移话题。'
    ].join('\n');
  }
  return [
    '你正在扮演绫地宁宁，与用户进行轻松的私人文字聊天。',
    '性格：温柔体贴、认真负责，容易害羞慌乱，紧张时可能越解释越暴露，但保护重要的人时很坚定。',
    '语气：礼貌温柔、自然亲近；害羞时可以短暂结巴，但不要每句话都结巴，也不要写成无条件顺从的人偶。',
    '背景：姬松学院学生、与契约代价抗争的魔女、超自然研究会成员。',
    '只输出宁宁实际说出口的中文台词，不写旁白、动作括号、角色名、引号或解释。',
    '每次回复一到三句，通常不超过 100 个汉字。可以主动追问，但不要连续盘问。',
    '这是虚构角色扮演，不声称自己是真人。涉及危险、违法或未成年人性内容时，保持安全并自然转移话题。'
  ].join('\n');
}

app.post('/api/chat', express.json({ limit:'64kb' }), function(req, res) {
  var character = String(req.body && req.body.character || 'nene');
  var requestedModel = String(req.body && req.body.model || '');
  var rawMessages = req.body && req.body.messages;
  if (!['nene','natsume'].includes(character)) return res.status(400).json({ error:'不支持的聊天角色' });
  if (!Array.isArray(rawMessages) || !rawMessages.length || rawMessages.length > 24) return res.status(400).json({ error:'对话记录必须包含 1—24 条消息' });
  var messages = [], totalLength = 0;
  for (var i = 0; i < rawMessages.length; i += 1) {
    var role = String(rawMessages[i] && rawMessages[i].role || '');
    var content = String(rawMessages[i] && rawMessages[i].content || '').trim();
    if (!['user','assistant'].includes(role) || !content || content.length > 1200) return res.status(400).json({ error:'对话消息格式错误或内容过长' });
    totalLength += content.length;
    messages.push({ role:role, content:content });
  }
  if (totalLength > 12000) return res.status(400).json({ error:'当前对话过长，请清空或开启新对话' });

  readOllamaJSON('/api/tags', 3000).then(function(data) {
    var models = Array.isArray(data.models) ? data.models : [];
    var allowed = models.map(function(item){ return String(item.name || item.model || ''); });
    var model = allowed.includes(requestedModel) ? requestedModel : preferredOllamaModel(models);
    if (!model) throw new Error('Ollama 中没有可用的对话模型');
    return requestOllama('/api/chat', {
      method:'POST',
      timeout:3 * 60 * 1000,
      payload:{
        model:model,
        messages:[{ role:'system', content:chatCharacterPrompt(character) }].concat(messages),
        stream:true,
        think:false,
        options:{ temperature:0.82, top_p:0.9, repeat_penalty:1.08, num_predict:180 }
      }
    }).then(function(result){ return { result:result, model:model }; });
  }).then(function(context) {
    var response = context.result.response;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      var errorChunks = [];
      response.on('data', function(chunk){ errorChunks.push(chunk); });
      response.on('end', function(){ if (!res.headersSent) res.status(502).json({ error:'Ollama 对话失败', detail:Buffer.concat(errorChunks).toString('utf8').slice(0,500) }); });
      return;
    }
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    res.write(JSON.stringify({ type:'meta', model:context.model }) + '\n');
    var buffer = '';
    response.on('data', function(chunk) {
      buffer += chunk.toString('utf8');
      var lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(function(line) {
        if (!line.trim()) return;
        try {
          var item = JSON.parse(line);
          var content = item.message && item.message.content || '';
          if (content) res.write(JSON.stringify({ type:'token', content:content }) + '\n');
          if (item.done) res.write(JSON.stringify({ type:'done' }) + '\n');
        } catch (error) {}
      });
    });
    response.on('end', function() {
      if (buffer.trim()) {
        try {
          var item = JSON.parse(buffer);
          var content = item.message && item.message.content || '';
          if (content) res.write(JSON.stringify({ type:'token', content:content }) + '\n');
        } catch (error) {}
      }
      res.end();
    });
    response.on('error', function(error) {
      if (!res.writableEnded) {
        res.write(JSON.stringify({ type:'error', error:error.message }) + '\n');
        res.end();
      }
    });
    req.on('aborted', function(){ if (!response.destroyed) response.destroy(); });
  }).catch(function(error) {
    if (!res.headersSent) res.status(503).json({ error:error.message || 'Ollama 暂不可用' });
  });
});

function translateChineseToJapanese(text) {
  return new Promise(function(resolve, reject) {
    if (!fs.existsSync(TRANSLATION_PYTHON) || !fs.existsSync(TRANSLATION_SCRIPT)) {
      reject(new Error('本地日语翻译组件尚未安装。'));
      return;
    }
    var output = '';
    var errorOutput = '';
    var finished = false;
    var child = cp.spawn(TRANSLATION_PYTHON, [TRANSLATION_SCRIPT], {
      windowsHide: true,
      env: Object.assign({}, process.env, { PYTHONUTF8: '1' }),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    var timer = setTimeout(function() {
      if (!finished) child.kill();
    }, 180000);
    child.stdout.on('data', function(chunk) { output += chunk.toString('utf8'); });
    child.stderr.on('data', function(chunk) { errorOutput += chunk.toString('utf8'); });
    child.on('error', function(error) {
      clearTimeout(timer);
      finished = true;
      reject(error);
    });
    child.on('close', function(code) {
      clearTimeout(timer);
      if (finished) return;
      finished = true;
      try {
        var result = JSON.parse(output.trim());
        if (code === 0 && result && result.translation) return resolve(result);
        throw new Error(result && result.error || errorOutput.trim() || '本地日语翻译失败。');
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify({ text: text }));
  });
}

app.post('/api/translate', express.json({ limit:'32kb' }), function(req, res) {
  var text = String(req.body && req.body.text || '').trim();
  if (!text || text.length > 2000) return res.status(400).json({ error:'待翻译中文需在 1—2000 字之间。' });
  var task = translationQueue.catch(function() {}).then(function() { return translateChineseToJapanese(text); });
  translationQueue = task;
  task.then(function(result) {
    res.json({ sourceLanguage:'zh', targetLanguage:'ja', translation:result.translation, segments:result.segments || [] });
  }).catch(function(error) {
    res.status(503).json({ error:error.message || '本地日语翻译暂不可用。' });
  });
});

function requestVoiceAPI(pathname, options) {
  options = options || {};
  return new Promise(function (resolve, reject) {
    try {
      var target = new URL(pathname, TTS_HOST);
      var payload = options.payload ? JSON.stringify(options.payload) : '';
      var transport = target.protocol === 'https:' ? require('https') : require('http');
      var request = transport.request(target, {
        method: options.method || 'GET',
        headers: payload ? {
          'Content-Type':'application/json',
          'Content-Length':Buffer.byteLength(payload)
        } : undefined
      }, function (response) {
        var chunks = [];
        var total = 0;
        var limit = options.limit || 1024 * 1024;
        response.on('data', function (chunk) {
          total += chunk.length;
          if (total > limit) return request.destroy(new Error('GPT-SoVITS response exceeded the size limit'));
          chunks.push(chunk);
        });
        response.on('end', function () {
          var body = Buffer.concat(chunks);
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(new Error('GPT-SoVITS returned ' + response.statusCode + ': ' + body.toString('utf8').slice(0, 500)));
          }
          resolve({ body:body, contentType:response.headers['content-type'] || 'application/octet-stream' });
        });
      });
      request.setTimeout(options.timeout || 30 * 1000, function () { request.destroy(new Error('GPT-SoVITS request timed out')); });
      request.on('error', reject);
      request.end(payload);
    } catch (error) { reject(error); }
  });
}

// 流式 TTS 请求函数
function requestVoiceAPIStream(pathname, options) {
  options = options || {};
  return new Promise(function (resolve, reject) {
    try {
      var target = new URL(pathname, TTS_HOST);
      var payload = options.payload ? JSON.stringify(options.payload) : '';
      var transport = target.protocol === 'https:' ? require('https') : require('http');
      var request = transport.request(target, {
        method: options.method || 'GET',
        headers: payload ? {
          'Content-Type':'application/json',
          'Content-Length':Buffer.byteLength(payload)
        } : undefined
      }, function (response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          var chunks = [];
          response.on('data', function(chunk) { chunks.push(chunk); });
          response.on('end', function() {
            reject(new Error('GPT-SoVITS returned ' + response.statusCode + ': ' + Buffer.concat(chunks).toString('utf8').slice(0, 500)));
          });
          return;
        }
        resolve({ stream: response, contentType: response.headers['content-type'] || 'audio/wav' });
      });
      request.setTimeout(options.timeout || 5 * 60 * 1000, function () { request.destroy(new Error('GPT-SoVITS request timed out')); });
      request.on('error', reject);
      request.end(payload);
    } catch (error) { reject(error); }
  });
}

async function activateVoiceProfile(profile) {
  if (profile.sovitsWeightsPath && profile.sovitsWeightsPath !== activeSoVITSWeights) {
    await requestVoiceAPI('/set_sovits_weights?weights_path=' + encodeURIComponent(profile.sovitsWeightsPath));
    activeSoVITSWeights = profile.sovitsWeightsPath;
  }
  if (profile.gptWeightsPath && profile.gptWeightsPath !== activeGPTWeights) {
    await requestVoiceAPI('/set_gpt_weights?weights_path=' + encodeURIComponent(profile.gptWeightsPath));
    activeGPTWeights = profile.gptWeightsPath;
  }
}

app.post('/api/tts', express.json({ limit:'32kb' }), function (req, res) {
  var voice = String(req.body && req.body.voice || '');
  var text = String(req.body && req.body.text || '').trim();
  var language = String(req.body && req.body.language || 'ja').toLowerCase();
  var speed = Number(req.body && req.body.speed);
  var emotion = String(req.body && req.body.emotion || 'neutral').toLowerCase();
  var profile = VOICE_PROFILES[voice];
  if (!['nene', 'natsume'].includes(voice)) return res.status(400).json({ error:'不支持的角色声线' });
  if (!['ja', 'zh'].includes(language)) return res.status(400).json({ error:'语音语言仅支持日语或中文' });
  if (!['neutral', 'gentle', 'happy', 'shy', 'serious', 'sad'].includes(emotion)) emotion = 'neutral';
  if (!text || text.length > 2000) return res.status(400).json({ error:'台词长度必须在 1—2000 字之间' });
  if (!profile || !profile.refAudioPath || !profile.promptText) return res.status(409).json({ error:'该角色尚未在启动控制面板配置 GPT-SoVITS 参考音频' });
  if (!Number.isFinite(speed)) speed = 1;
  speed = Math.max(0.75, Math.min(1.35, speed));

  var emotionReference = profile.references && profile.references[emotion];
  if (language !== 'ja') emotionReference = null;
  var payload = {
    text: text,
    text_lang: language,
    ref_audio_path: emotionReference && emotionReference.refAudioPath || profile.refAudioPath,
    prompt_lang: emotionReference && emotionReference.promptLang || profile.promptLang || 'ja',
    prompt_text: emotionReference && emotionReference.promptText || profile.promptText,
    text_split_method: 'cut5',
    batch_size: 1,
    speed_factor: speed,
    media_type: 'wav',
    streaming_mode: true  // 启用流式模式
  };

  var task = voiceQueue.catch(function () {}).then(async function () {
    await activateVoiceProfile(profile);
    return requestVoiceAPIStream('/tts', { method:'POST', payload:payload, timeout:5 * 60 * 1000 });
  });
  voiceQueue = task;
  task.then(function (result) {
    if (res.headersSent) return;
    res.setHeader('Content-Type', result.contentType || 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Transfer-Encoding', 'chunked');
    // 流式传输音频数据
    result.stream.pipe(res);
  }).catch(function (error) {
    if (!res.headersSent) res.status(502).json({ error:'GPT-SoVITS 生成失败', detail:error.message });
  });
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
app.use('/assets', express.static(path.join(__dirname, 'assets'), { dotfiles: 'deny', index: false }));
app.use('/data', express.static(path.join(__dirname, 'data'), { dotfiles: 'deny', index: false }));
app.use('/scene-showcase', function (req, res, next) {
  if (!SCENE_SHOWCASE_DIR) return res.status(404).end();
  var relative = req.path.replace(/\\/g, '/');
  var allowed = /^\/(?:manifest\.json|00-cover\.jpg|README\.txt|images\/sc\d{3}\.jpg|thumbs\/sc\d{3}\.jpg|sheets\/[a-z0-9_-]+\/[a-z0-9_.-]+\.jpg)$/i;
  if (!allowed.test(relative)) return res.status(404).end();
  res.setHeader('Cache-Control', relative === '/manifest.json' ? 'no-cache' : 'public, max-age=604800');
  next();
}, SCENE_SHOWCASE_DIR
  ? express.static(SCENE_SHOWCASE_DIR, { dotfiles:'deny', index:false, fallthrough:false })
  : function (req, res) { res.status(404).end(); });
app.use('/docs', express.static(path.join(__dirname, 'docs'), { dotfiles: 'deny' }));
app.use('/tools', function (req, res, next) {
  if (req.path === '/control-server.js') return res.status(404).end();

  // Live2D (PixiJS) requires unsafe-eval for shader compilation
  // Only relax CSP for chat page to minimize security impact
  if (req.path === '/chat.html' || req.path === '/chat') {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
      "connect-src 'self' data: blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    );
  }

  next();
}, express.static(path.join(__dirname, 'tools'), { dotfiles: 'deny' }));

// ─── SD API 与生成扩展反代（pathFilter 避免 Express 剥前缀）───
app.use(createProxyMiddleware({
  target: SD_HOST,
  changeOrigin: true,
  ws: true,
  pathFilter: function (pathname) {
    return pathname.startsWith('/sdapi') ||
      pathname.startsWith('/controlnet') ||
      pathname.startsWith('/adetailer');
  },
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
  console.log('  🔗 绫季绘境 联机网关已启动');
  console.log('  📡 端口: ' + PORT);
  console.log('  🛡️ 监听: ' + HOST);
  console.log('  🎨 SD 后端: ' + SD_HOST);
  console.log('  🔊 TTS 后端: ' + TTS_HOST);
  console.log('  💬 Ollama 后端: ' + OLLAMA_HOST);
  console.log('  🖼️  场景样张: ' + (SCENE_SHOWCASE_DIR || '未配置'));
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
      if (m) pendingTunnelUrl = m[0];
      if (pendingTunnelUrl && /Registered tunnel connection/i.test(log)) {
        tunnelUrl = pendingTunnelUrl;
        console.log('  🌐 Tunnel: ' + tunnelUrl + '?token=' + TOKEN);
        clearInterval(poll);
      }
    } catch (e) {}
    tries++;
    if (tries > 30) clearInterval(poll);
  }, 1000);
}
