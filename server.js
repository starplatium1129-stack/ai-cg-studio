'use strict';

var express = require('express');
var compression = require('compression');
var path = require('path');
var fs = require('fs');
var cp = require('child_process');
var createProxyMiddleware = require('http-proxy-middleware').createProxyMiddleware;
var loadGatewayConfig = require('./server/config').loadGatewayConfig;
var security = require('./server/security');
var createChatRouter = require('./routes/chat').createChatRouter;
var createVoiceRouter = require('./routes/voice').createVoiceRouter;
var createLive2dRouter = require('./routes/live2d').createLive2dRouter;
var createMaintenanceRouter = require('./routes/maintenance').createMaintenanceRouter;
var createControlRouter = require('./routes/control').createControlRouter;

var ONE_DAY = 24 * 60 * 60 * 1000;
var ONE_WEEK = 7 * ONE_DAY;
var ONE_YEAR = 365 * ONE_DAY;

// SD WebUI 只放行前端真正调用的端点。
// 之前整段透传 /sdapi、/controlnet、/adetailer —— SD 的 API 能换模型，
// 装了扩展还能碰文件系统，等于把这些能力一并交给任何 token 持有者。
var SD_PROXY_ALLOWLIST = [
  '/sdapi/v1/sd-models',
  '/sdapi/v1/samplers',
  '/sdapi/v1/schedulers',
  '/sdapi/v1/upscalers',
  '/sdapi/v1/options',
  '/sdapi/v1/progress',
  '/sdapi/v1/txt2img',
  '/sdapi/v1/interrupt'
];

function staticOptions(maxAge) {
  return {
    dotfiles:'deny',
    index:false,
    maxAge:maxAge,
    setHeaders:function (res, filePath) {
      if (/\.(?:html|json)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  };
}

var PRECOMPRESSIBLE = /\.(?:js|css|html|json|svg|txt|map)$/i;

/**
 * 优先发预压产物（.br / .gz）。
 *
 * compression 中间件是每个请求现场压一次，而且只有 gzip；
 * 预压之后既省 CPU 又能用上 brotli（实测 scenes.json gzip 229.7KB →
 * brotli 155.2KB）。产物由 scripts/maintenance/precompress.js 生成。
 */
function precompressed(rootDir) {
  return function (req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!PRECOMPRESSIBLE.test(req.path)) return next();

    var accept = String(req.headers['accept-encoding'] || '');
    var encoding = /\bbr\b/.test(accept) ? 'br' : (/\bgzip\b/.test(accept) ? 'gzip' : '');
    if (!encoding) return next();

    // 只服务白名单目录，且必须落在 root 内（防目录穿越）
    var allowed = /^\/(?:_app\/|data\/|assets\/|css\/|docs\/|index\.html$)/.test(req.path);
    if (!allowed) return next();

    var base = req.path === '/index.html' || req.path.indexOf('/_app/') === 0
      ? path.join(rootDir, 'dist', req.path)
      : path.join(rootDir, req.path);
    var resolved = path.resolve(base);
    if (resolved.indexOf(path.resolve(rootDir) + path.sep) !== 0) return next();

    var suffix = encoding === 'br' ? '.br' : '.gz';
    var compressedFile = resolved + suffix;
    if (!fs.existsSync(compressedFile)) return next();

    // 直接把预压文件发出去。改写 req.url 交给下游是不行的：
    // 后面的 /data 白名单会看到 "scenes.json.br" 而拒掉。
    res.setHeader('Content-Encoding', encoding);
    res.setHeader('Vary', 'Accept-Encoding');
    var type = express.static.mime.lookup(resolved);
    if (type) {
      res.setHeader('Content-Type', type +
        (/^text\/|json|javascript|svg/.test(type) ? '; charset=utf-8' : ''));
    }
    // 缓存策略要与未压缩版本一致
    if (req.path.indexOf('/_app/') === 0) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(?:html|json)$/i.test(req.path)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
    res.sendFile(compressedFile, function (error) {
      // 发送失败（文件刚被删等）就回退到未压缩路径
      if (error && !res.headersSent) {
        res.removeHeader('Content-Encoding');
        next();
      }
    });
  };
}

function createGateway(options) {
  options = options || {};
  var config = options.config || loadGatewayConfig(__dirname, options.env || process.env);
  var app = express();
  var tunnelUrl = '';
  var pendingTunnelUrl = '';
  var tunnelProcess = null;
  var tunnelPoll = null;
  var tunnelStopped = false;

  app.disable('x-powered-by');
  app.use(security.responseHeaders);
  app.use(precompressed(config.ROOT_DIR));
  // Host 白名单必须在 tokenAuth 之前：tokenAuth 对 loopback socket 无条件放行，
  // 不校验 Host 时任意网页都能把域名 rebind 到 127.0.0.1 并以「本机」身份调控制接口。
  app.use(security.hostGuard(config, function () { return tunnelUrl; }));
  app.use(security.tokenAuth(config.TOKEN));
  app.use(compression({ threshold:1024 }));

  var chat = createChatRouter(config, options.services);
  var voice = createVoiceRouter(config, options.services);
  var live2d = createLive2dRouter(config, options.services);
  var maintenance = createMaintenanceRouter(config);

  // 控制面板路由需要访问 gateway 对象（tunnelUrl、startTunnel/stopTunnel）
  // 用闭包延迟引用，避免循环依赖
  var gatewayState = { tunnelUrl:'', startTunnel:null, stopTunnel:null };
  var control = createControlRouter(config, function() { return gatewayState; });

  app.use(chat.router);
  app.use(voice.router);
  app.use(live2d.router);
  app.use(maintenance.router);
  app.use(control);

  app.get('/api/health', function (req, res) {
    var live2dStatus = live2d.service.status();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok:true,
      app:'ai-cg-studio',
      gateway:true,
      port:Number(config.PORT),
      capabilities:{
        chat:true,
        tts:true,
        translation:true,
        live2d:live2dStatus.available
      },
      queues:{
        chat:chat.service.queueStatus(),
        voice:voice.tts.queueStatus()
      }
    });
  });

  app.get('/api/tunnel-status', function (req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ url:tunnelUrl });
  });

  // Vue SPA — 优先从 dist/ 提供；dist/ 不存在时回退到旧 index.html
  var DIST_DIR = path.join(config.ROOT_DIR, 'dist');
  var distReady = fs.existsSync(path.join(DIST_DIR, 'index.html'));
  if (distReady) {
    // dist/_app 里的文件名带内容 hash，改动必然换名 → 可以永久缓存。
    // 之前统一 max-age=86400 且无 immutable，34 个 JS/CSS 每天都要回验一次。
    app.use('/_app', express.static(path.join(DIST_DIR, '_app'), {
      dotfiles:'deny',
      index:false,
      immutable:true,
      maxAge:ONE_YEAR
    }));
    // 其余产物（favicon 等无 hash 文件）保持一天
    app.use(express.static(DIST_DIR, staticOptions(ONE_DAY)));
  }

  app.get(['/', '/index.html'], function (req, res) {
    res.setHeader('Cache-Control', 'no-cache');
    var spaEntry = path.join(DIST_DIR, 'index.html');
    res.sendFile(fs.existsSync(spaEntry) ? spaEntry : path.join(config.ROOT_DIR, 'index.html'));
  });
  app.use('/css', express.static(path.join(config.ROOT_DIR, 'css'), staticOptions(ONE_DAY)));
  // docs/*.html 引用设计系统的唯一一份实现（src/assets/css）。
  // 之前 css/ 下有一份分叉副本，token 已经开始漂移；只暴露这一个文件而不是整个 src/。
  app.use('/src/assets/css', function (req, res, next) {
    if (req.path !== '/design-system.css') return res.status(404).end();
    next();
  }, express.static(path.join(config.ROOT_DIR, 'src', 'assets', 'css'), staticOptions(ONE_DAY)));
  app.use('/assets', express.static(path.join(config.ROOT_DIR, 'assets'), staticOptions(ONE_WEEK)));
  // 只放行 SPA 真正读取的数据文件。
  // 之前整个 data/ 目录对外可读，包括 history.json / projects.json / prompts.json
  // 这类个人内容，以及 data/scenes/*.json（build-scenes.js 的输入，共 893KB，
  // 客户端从不读取）。
  var PUBLIC_DATA_FILES = [
    'scenes.json', 'curation.json', 'characters.json',
    'loras.json', 'tags.json', 'presets.json'
  ];
  app.use('/data', function (req, res, next) {
    var name = req.path.replace(/^\//, '');
    if (PUBLIC_DATA_FILES.indexOf(name) === -1) return res.status(404).end();
    next();
  }, express.static(path.join(config.ROOT_DIR, 'data'), staticOptions(0)));
  app.use('/scene-showcase', function (req, res, next) {
    if (!config.SCENE_SHOWCASE_DIR) return res.status(404).end();
    var relative = req.path.replace(/\\/g, '/');
    var allowed = /^\/(?:manifest\.json|00-cover\.jpg|README\.txt|images\/sc\d{3}\.(?:jpg|png|webp)|thumbs\/sc\d{3}\.(?:jpg|png|webp)|sheets\/[a-z0-9_-]+\/[a-z0-9_.-]+\.jpg)$/i;
    if (!allowed.test(relative)) return res.status(404).end();
    res.setHeader('Cache-Control', relative === '/manifest.json' ? 'no-cache' : 'public, max-age=604800');
    next();
  }, config.SCENE_SHOWCASE_DIR
    ? express.static(config.SCENE_SHOWCASE_DIR, { dotfiles:'deny', index:false, fallthrough:false })
    : function (req, res) { res.status(404).end(); });
  app.use('/docs', express.static(path.join(config.ROOT_DIR, 'docs'), Object.assign(staticOptions(ONE_DAY), { index:'index.html' })));
  app.use('/tools', function (req, res, next) {
    if (req.path === '/control-server.js') return res.status(404).end();
    next();
  }, express.static(path.join(config.ROOT_DIR, 'tools'), staticOptions(ONE_DAY)));

  var sdProxy = createProxyMiddleware({
    // router 按请求解析 target：控制面板改 SD_HOST 后立即生效。
    // 之前 target 在构造时就被定住，面板报成功而 /sdapi 仍打旧 host 直到重启。
    target:config.SD_HOST,
    router:function () { return config.SD_HOST; },
    changeOrigin:true,
    // ws:false —— http-proxy-middleware 的 ws:true 会直接订阅 server 的 'upgrade' 事件，
    // 完全绕过 Express 中间件栈，于是 tokenAuth 失效。升级请求改由 startGateway 手动鉴权后转交。
    ws:false,
    pathFilter:function (pathname) {
      return SD_PROXY_ALLOWLIST.indexOf(pathname) !== -1;
    },
    proxyTimeout:20 * 60 * 1000,
    auth:config.SD_API_AUTH || undefined,
    on:{
      proxyReq:function () { console.log('  → SD API 请求已转发'); },
      error:function (error, req, res) {
        console.error('  ❌ SD 代理错误:', error.message);
        // upgrade 失败时第三个参数是裸 net.Socket，不是 Express response。
        // 直接调 res.status() 会抛 TypeError 并带走整个进程。
        if (res && typeof res.status === 'function') {
          if (!res.headersSent) {
            res.status(502).json({ error:'SD WebUI 未响应，请确认已经启动 (' + config.SD_HOST + ')' });
          }
          return;
        }
        if (res && typeof res.destroy === 'function') {
          try { res.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n'); } catch (writeError) {}
          try { res.destroy(); } catch (destroyError) {}
        }
      }
    }
  });
  app.use(sdProxy);

  // 白名单外的 SD 路径必须是 JSON 404，不能被 SPA catch-all 吞成 200 text/html
  app.use(['/sdapi', '/controlnet', '/adetailer'], function (req, res) {
    res.status(404).json({ error:'该 SD 接口未开放：' + req.baseUrl + req.path });
  });

  // SPA fallback — Vue Router 的前端路由在刷新时返回 index.html
  app.get('*', function (req, res, next) {
    // 未命中的 API 路由必须是 JSON 404，不能被吞成 200 text/html。
    // /api/xxx 没有扩展名，之前会直接拿到 SPA 外壳且状态 200。
    if (req.path.startsWith('/api/')) return next();
    var spaEntry = path.join(config.ROOT_DIR, 'dist', 'index.html');
    if (!fs.existsSync(spaEntry)) return next();
    var ext = path.extname(req.path);
    if (ext && ext !== '.html') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(spaEntry);
  });

  app.use('/api', function (req, res) {
    res.status(404).json({ error:'接口不存在: ' + req.method + ' ' + req.baseUrl + req.path });
  });

  app.use(function (error, req, res, next) {
    if (res.headersSent) return next(error);
    // 尊重 err.status/err.statusCode：否则 express.static 的 404、body-parser 的 413
    // 都会变成 500，而 detail 还会把主机绝对路径回给客户端。
    var status = Number(error && (error.status || error.statusCode));
    if (!Number.isInteger(status) || status < 400 || status > 599) status = 500;
    if (error && error.type === 'entity.parse.failed') status = 400;
    if (error && error.code === 'ENOENT') status = 404;

    var messages = {
      400:'请求 JSON 格式错误',
      404:'资源不存在',
      413:'请求体过大'
    };
    if (status >= 500) console.error('  ❌ 网关内部错误:', error && error.stack || error);
    res.status(status).json({ error:messages[status] || (status >= 500 ? '网关内部错误' : '请求无法处理') });
  });

  function startTunnel() {
    if (config.DISABLE_TUNNEL) return;
    if (!fs.existsSync(config.CLOUDFLARED_PATH)) {
      console.log('  ⚠ cloudflared not found, tunnel disabled');
      return;
    }
    if (tunnelProcess) return; // 已在运行，避免重复 spawn
    tunnelStopped = false;
    console.log('  🌪 Starting Cloudflare Tunnel...');
    var runtimeTools = require('./scripts/runtime/runtime-paths');
    runtimeTools.rotateLog(config.RUNTIME.tunnelLog, 2 * 1024 * 1024);
    var logFd = fs.openSync(config.RUNTIME.tunnelLog, 'w');
    tunnelProcess = cp.spawn(config.CLOUDFLARED_PATH, [
      'tunnel', '--url', 'http://localhost:' + config.PORT
    ], {
      stdio:['ignore', logFd, logFd],
      detached:true,
      windowsHide:true
    });
    tunnelProcess.unref();
    fs.closeSync(logFd);
    try { fs.writeFileSync(config.RUNTIME.tunnelPid, String(tunnelProcess.pid)); } catch (error) {}

    // cloudflared 自己挂掉时必须清空 tunnelProcess。
    // 否则 startTunnel 顶部的 `if (tunnelProcess) return` 会让后续每一次启动
    // 都变成静默 no-op，而控制面板照样收到 {ok:true}。
    var thisProcess = tunnelProcess;
    function handleTunnelExit(reason) {
      if (tunnelProcess !== thisProcess) return;  // 已经被 stopTunnel 换掉了
      console.log('  🌪 Tunnel process ended (' + reason + ')');
      tunnelProcess = null;
      tunnelUrl = '';
      pendingTunnelUrl = '';
      gatewayState.tunnelUrl = '';
      if (tunnelPoll) { clearInterval(tunnelPoll); tunnelPoll = null; }
    }
    tunnelProcess.on('exit', function (code) { handleTunnelExit('exit ' + code); });
    tunnelProcess.on('error', function (error) { handleTunnelExit(error.message); });

    if (tunnelPoll) { clearInterval(tunnelPoll); tunnelPoll = null; }
    var attempts = 0;
    tunnelPoll = setInterval(function () {
      // 已经点过停止就不要再把 URL 写回来
      if (tunnelStopped) { clearInterval(tunnelPoll); tunnelPoll = null; return; }
      try {
        var log = fs.readFileSync(config.RUNTIME.tunnelLog, 'utf8');
        var match = log.match(/https:\/\/\S+trycloudflare\.com/);
        if (match) pendingTunnelUrl = match[0];
        if (pendingTunnelUrl && /Registered tunnel connection/i.test(log)) {
          tunnelUrl = pendingTunnelUrl;
          gatewayState.tunnelUrl = tunnelUrl;
          console.log('  🌪 Tunnel ready (token redacted; open control panel for share link)');
          clearInterval(tunnelPoll); tunnelPoll = null;
        }
      } catch (error) {}
      attempts += 1;
      if (attempts > 30) { clearInterval(tunnelPoll); tunnelPoll = null; }
    }, 1000);
  }

  function stopTunnel() {
    tunnelStopped = true;
    tunnelUrl = ''; pendingTunnelUrl = ''; gatewayState.tunnelUrl = '';
    if (tunnelPoll) { clearInterval(tunnelPoll); tunnelPoll = null; }

    var pids = [];
    if (tunnelProcess && tunnelProcess.pid) pids.push(tunnelProcess.pid);
    // detached 进程用 taskkill /T 收掉整棵树，process.kill 杀不干净
    try {
      var saved = fs.existsSync(config.RUNTIME.tunnelPid)
        ? String(fs.readFileSync(config.RUNTIME.tunnelPid, 'utf8')).trim()
        : '';
      if (/^\d+$/.test(saved) && pids.indexOf(Number(saved)) === -1) pids.push(Number(saved));
    } catch (error) {}

    pids.forEach(function (pid) {
      if (process.platform === 'win32') {
        try { cp.execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio:'ignore' }); }
        catch (error) { try { process.kill(pid); } catch (e) {} }
      } else {
        try { process.kill(pid); } catch (error) {}
      }
    });
    try { if (fs.existsSync(config.RUNTIME.tunnelPid)) fs.unlinkSync(config.RUNTIME.tunnelPid); } catch (error) {}
    // 清掉日志，避免下次轮询读到上一次的旧 URL
    try { fs.writeFileSync(config.RUNTIME.tunnelLog, ''); } catch (error) {}
    tunnelProcess = null;
    console.log('  🌪 Tunnel stopped');
  }

  function close() {
    voice.close();
    stopTunnel();
  }

  // 将控制函数暴露给 gatewayState，供 control 路由调用
  gatewayState.startTunnel = startTunnel;
  gatewayState.stopTunnel  = stopTunnel;

  // upgrade 请求不经过 Express 中间件，所以在这里复刻 tokenAuth 的判定。
  function handleUpgrade(req, socket, head) {
    var pathname = String(req.url || '/').split('?')[0];
    if (SD_PROXY_ALLOWLIST.indexOf(pathname) === -1) { socket.destroy(); return; }

    var authorized = security.isDirectLocalRequest(req);
    if (!authorized) {
      var query = '';
      var q = String(req.url || '').indexOf('?');
      if (q >= 0) query = String(req.url).slice(q + 1);
      var suppliedToken = new URLSearchParams(query).get('token') || req.headers['x-token'] || '';
      if (!suppliedToken) {
        var cookieMatch = (req.headers.cookie || '').match(/(?:^|;\s*)aics_token=([^;]+)/);
        if (cookieMatch) suppliedToken = cookieMatch[1];
      }
      authorized = security.tokenMatches(config.TOKEN, suppliedToken);
    }
    if (!authorized) {
      try { socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); } catch (error) {}
      socket.destroy();
      return;
    }
    sdProxy.upgrade(req, socket, head);
  }

  return {
    app:app,
    config:config,
    services:{ chat:chat.service, tts:voice.tts, translation:voice.translation, live2d:live2d.service },
    startTunnel:startTunnel,
    handleUpgrade:handleUpgrade,
    close:close
  };
}

function startGateway(options) {
  var gateway = createGateway(options);
  var config = gateway.config;

  // 兜底：未捕获异常不应该带走整个网关。
  process.on('unhandledRejection', function (reason) {
    console.error('  ❌ 未处理的 Promise 拒绝:', reason && reason.stack || reason);
  });
  process.on('uncaughtException', function (error) {
    console.error('  ❌ 未捕获异常:', error && error.stack || error);
  });

  var server = gateway.app.listen(config.PORT, config.HOST, function () {
    console.log('');
    console.log('  ══════════════════════════════════════════');
    console.log('  🔗 绫季绘境 联机网关已启动');
    console.log('  📗 端口: ' + config.PORT);
    console.log('  🛡️ 监听: ' + config.HOST);
    console.log('  🎨 SD 后端: ' + config.SD_HOST);
    console.log('  🔊 TTS 后端: ' + config.TTS_HOST);
    console.log('  💬 Ollama 后端: ' + config.OLLAMA_HOST);
    console.log('  🖼️ 场景样张: ' + (config.SCENE_SHOWCASE_DIR || '未配置'));
    console.log('  🔐 Token: stored in runtime/state (length ' + String(config.TOKEN || '').length + ')');
    console.log('  ══════════════════════════════════════════');
    console.log('');
    // 公网分享不再随网关自动开启：默认仅本机，由控制面板显式启动。
    // 需要开机即分享时设 AUTO_TUNNEL=1。
    var saved = {};
    try { saved = JSON.parse(fs.readFileSync(config.RUNTIME.config, 'utf8')); } catch (error) {}
    var autoTunnel = process.env.AUTO_TUNNEL === '1' || saved.autoTunnel === true;
    if (autoTunnel) gateway.startTunnel();
    else console.log('  🔒 仅本机访问（公网分享可在控制面板启动）');
  });

  server.on('upgrade', gateway.handleUpgrade);

  var closing = false;
  function shutdown() {
    if (closing) return;
    closing = true;
    gateway.close();
    server.close(function () { process.exit(0); });
    setTimeout(function () { process.exit(1); }, 5000).unref();
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { gateway:gateway, server:server, shutdown:shutdown };
}

if (require.main === module) startGateway();

module.exports = {
  createGateway:createGateway,
  startGateway:startGateway
};
