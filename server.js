'use strict';

var express = require('express');
var compression = require('compression');
var path = require('path');
var fs = require('fs');
var cp = require('child_process');
var createProxyMiddleware = require('http-proxy-middleware').createProxyMiddleware;
var loadGatewayConfig = require('./server/config').loadGatewayConfig;
var security = require('./server/security');
var envelope = require('./server/http-envelope');
var { precompressed } = require('./server/precompressed');
var { createTunnelManager } = require('./server/tunnel');
var createChatRouter = require('./routes/chat').createChatRouter;
var createVoiceRouter = require('./routes/voice').createVoiceRouter;
var createLive2dRouter = require('./routes/live2d').createLive2dRouter;
var createMaintenanceRouter = require('./routes/maintenance').createMaintenanceRouter;
var createControlRouter = require('./routes/control').createControlRouter;
var createTrainingRouter = require('./routes/training').createTrainingRouter;
var createAnimaRouter = require('./routes/anima').createAnimaRouter;
var createGenerationRouter = require('./routes/generation').createGenerationRouter;

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

function createGateway(options) {
  options = options || {};
  var spawn = options.spawn || cp.spawn;
  var config = options.config || loadGatewayConfig(__dirname, options.env || process.env);
  var app = express();

  app.disable('x-powered-by');
  app.use(security.responseHeaders);
  // Host 白名单必须在 tokenAuth 之前：tokenAuth 对 loopback socket 无条件放行，
  // 不校验 Host 时任意网页都能把域名 rebind 到 127.0.0.1 并以「本机」身份调控制接口。
  // precompressed 也必须在两者之后：否则远程无 token / rebinding 请求能直接拿到
  // _app、assets、docs 等预压产物，绕过 tokenAuth 与 hostGuard。
  var tunnelManager = null;
  app.use(security.hostGuard(config, function () { return tunnelManager ? tunnelManager.getUrl() : ''; }));
  app.use(security.tokenAuth(config.TOKEN));
  app.use(precompressed(config.ROOT_DIR));
  app.use(compression({ threshold:1024 }));

  var chat = createChatRouter(config, options.services);
  var voice = createVoiceRouter(config, options.services);
  var live2d = createLive2dRouter(config, options.services);
  var maintenance = createMaintenanceRouter(config);
  var training = createTrainingRouter(config, options.services);
  var anima = createAnimaRouter(config, options.services);
  var generation = createGenerationRouter(config, options.services);
  var desktopTools = require('./routes/desktop-tools').createDesktopToolsRouter({ security: security });

  // 控制面板路由需要访问 gateway 对象（tunnelUrl、startTunnel/stopTunnel）
  // 用闭包延迟引用，避免循环依赖
  var gatewayState = { tunnelUrl:'', startTunnel:null, stopTunnel:null };
  tunnelManager = createTunnelManager({
    config:config,
    spawn:spawn,
    onStateChange:function () { gatewayState.tunnelUrl = tunnelManager.getUrl(); }
  });
  var controlDependencies = Object.assign({}, options.control || {});
  if (!controlDependencies.translation) controlDependencies.translation = voice.translation;
  var control = createControlRouter(config, function() { return gatewayState; }, controlDependencies);

  app.use(chat.router);
  app.use(voice.router);
  app.use(live2d.router);
  app.use(maintenance.router);
  app.use(control);
  app.use(training.router);
  app.use(anima.router);
  app.use(generation.router);
  app.use(desktopTools);

  app.get('/api/health', function (req, res) {
    var live2dStatus = live2d.service.status();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok:true,
      app:'ai-cg-studio',
      gateway:true,
      desktopProtocol:1,
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
  // Live2D manifests reference unhashed moc/texture/motion files. Revalidate
  // them so model fixes do not leave existing browsers on a week-old asset set.
  app.use(['/assets/live2d', '/assets/live2d-current'], function (req, res, next) {
    res.setHeader('Cache-Control', 'no-cache');
    next();
  }, express.static(config.LIVE2D_ROOT, {
    dotfiles:'deny',
    index:false,
    fallthrough:false
  }));
  app.use('/assets', express.static(config.ASSETS_ROOT, staticOptions(ONE_WEEK)));
  // 只放行 SPA 真正读取的数据文件。
  // 之前整个 data/ 目录对外可读，包括 history.json / projects.json / prompts.json
  // 这类个人内容，以及 data/scenes/*.json（build-scenes.js 的输入，共 893KB，
  // 客户端从不读取）。
  var PUBLIC_DATA_FILES = [
    'scenes.json', 'scenes-index.json', 'scenes-core.json',
    'scenes-nene.json', 'scenes-natsume.json', 'scenes-shared.json',
    'curation.json', 'characters.json',
    'loras.json', 'tags.json', 'presets.json'
  ];
  // 客户端统一经 sceneStore 带 ?v=DATA_VERSION 读取，版本号变即换 URL，
  // 因此这里可以放心给一年 immutable 缓存；改动 data/*.json 只需升版本号。
  // 之前是 no-cache：scenes.json 230KB gzip 等 6 个文件每次刷新都重传。
  app.use('/data', function (req, res, next) {
    var name = req.path.replace(/^\//, '');
    if (PUBLIC_DATA_FILES.indexOf(name) === -1) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    next();
  }, express.static(path.join(config.ROOT_DIR, 'data'), {
    dotfiles:'deny',
    index:false,
    maxAge:ONE_YEAR
  }));
  // scene-showcase 是运行时媒体（换图即时生效）：no-cache + ETag，
  // 文件没变回 304 零流量，变了立即出新图。
  // 之前是 7 天强缓存且封面 URL 无版本号 —— 换图后浏览器继续显示旧图，
  // 用户会误以为"网站还是以前的"。
  app.use('/scene-showcase', function (req, res, next) {
    if (!config.SCENE_SHOWCASE_DIR) return res.status(404).end();
    var relative = req.path.replace(/\\/g, '/');
    var allowed = /^\/(?:manifest\.json|00-cover\.jpg|README\.txt|home\/nene\.jpg|home\/natsume\.jpg|images\/sc\d{3}\.(?:jpg|png|webp)|thumbs\/sc\d{3}\.(?:jpg|png|webp)|sheets\/[a-z0-9_-]+\/[a-z0-9_.-]+\.jpg)$/i;
    if (!allowed.test(relative)) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-cache');
    next();
  }, config.SCENE_SHOWCASE_DIR
    ? express.static(config.SCENE_SHOWCASE_DIR, { dotfiles:'deny', index:false, fallthrough:false })
    : function (req, res) { res.status(404).end(); });
  app.use('/docs', express.static(path.join(config.ROOT_DIR, 'docs'), Object.assign(staticOptions(ONE_DAY), { index:'index.html' })));
  app.use('/tools', function (req, res, next) {
    if (req.path === '/control-server.js') return res.status(404).end();
    next();
  }, express.static(config.TOOLS_ROOT, staticOptions(ONE_DAY)));

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
      // 每次转发都打日志会把长时运行的日志刷成噪音；需要排查时用 DEBUG=1。
      proxyReq:function () {
        if (process.env.DEBUG === '1') console.log('  → SD API 请求已转发');
      },
      error:function (error, req, res) {
        console.error('  ❌ SD 代理错误:', error.message);
        // upgrade 失败时第三个参数是裸 net.Socket，不是 Express response。
        // 直接调 res.status() 会抛 TypeError 并带走整个进程。
        if (res && typeof res.status === 'function') {
          if (!res.headersSent) {
            envelope.fail(res, 502, 'SD WebUI 未响应，请确认已经启动 (' + config.SD_HOST + ')');
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
  // txt2img 是唯一真正吃 GPU 的 SD 端点，单独限流。
  // 容量按前端出图队列的上限（8 个任务）留余量；补充速率远慢于单张出图耗时，
  // 所以正常使用碰不到，持续刷才会碰到。其余白名单端点是廉价读，不限。
  app.post('/sdapi/v1/txt2img', security.rateLimit({
    capacity:12, refillMs:5000, label:'出图'
  }));
  app.use(sdProxy);

  // ComfyUI 原生端点不再对浏览器暴露。Anima 只能通过 /api/anima/* 访问
  // 服务端固定工作流；根 prompt/history/queue/view 等路径统一回 JSON 404。
  app.use([
    '/sdapi', '/controlnet', '/adetailer', '/comfy',
    '/prompt', '/queue', '/history', '/object_info', '/interrupt', '/view'
  ], function (req, res) {
    envelope.fail(res, 404, '该接口未开放：' + req.baseUrl + req.path);
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
    envelope.fail(res, 404, '接口不存在: ' + req.method + ' ' + req.baseUrl + req.path);
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
    envelope.fail(res, status, messages[status] || (status >= 500 ? '网关内部错误' : '请求无法处理'));
  });

  function close() {
    voice.close();
    training.close();
    if (anima && typeof anima.close === 'function') anima.close();
    if (generation && typeof generation.close === 'function') generation.close();
    if (maintenance && typeof maintenance.close === 'function') maintenance.close();
    if (control && typeof control.close === 'function') control.close();
    if (tunnelManager) tunnelManager.stop();
  }

  // 将控制函数暴露给 gatewayState，供 control 路由调用
  gatewayState.startTunnel = function () { if (tunnelManager) tunnelManager.start(); };
  gatewayState.stopTunnel  = function () { if (tunnelManager) tunnelManager.stop(); };

  // upgrade 请求不经过 Express 中间件，所以在这里复刻 hostGuard + tokenAuth 的判定。
  function handleUpgrade(req, socket, head) {
    try {
      var pathname = String(req.url || '/').split('?')[0];
      if (SD_PROXY_ALLOWLIST.indexOf(pathname) === -1) { socket.destroy(); return; }
      // hostGuard 的 DNS rebinding 防御必须同样覆盖 WebSocket 升级路径。
      // 这里直接复用纯函数 hostAllowed（hostGuard 是 Express 中间件，依赖 res）。
      if (!security.hostAllowed(req.headers.host, config.PORT, tunnelManager ? tunnelManager.getUrl() : '')) { socket.destroy(); return; }

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
    } catch (error) {
      console.error('  ❌ WebSocket 升级失败:', error && error.stack || error);
      try { socket.destroy(); } catch (ignore) {}
    }
  }

  return {
    app:app,
    config:config,
    services:{
      chat:chat.service,
      tts:voice.tts,
      translation:voice.translation,
      live2d:live2d.service,
      training:training.service,
      anima:anima.service
    },
    startTunnel:function () { if (tunnelManager) tunnelManager.start(); },
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

  var server = gateway.app.listen(config.PORT, config.HOST, function () {    console.log('');
    console.log('  ══════════════════════════════════════════');
    console.log('  🔗 绫季绘境 联机网关已启动');
    console.log('  📗 端口: ' + config.PORT);
    console.log('  🛡️ 监听: ' + config.HOST);
    console.log('  🎨 SD 后端: ' + config.SD_HOST);
    console.log('  🔊 TTS 后端: ' + config.TTS_HOST);
    console.log('  💬 Ollama 后端: ' + config.OLLAMA_HOST);
    console.log('  🖼️ 场景样张: ' + (config.SCENE_SHOWCASE_DIR || '未配置'));
    console.log('  🔐 Token: ' + (config.TOKEN_SOURCE || 'runtime/state')
      + ' (length ' + String(config.TOKEN || '').length + ')');
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

  // 端口占用 / 权限错误等监听失败必须立刻退出，不能留一个没有监听器的僵尸进程，
  // 否则后续 startTunnel 还会指向一个死端口。
  server.once('error', function (error) {
    console.error('  ❌ 网关监听失败:', error && error.message || error);
    process.exit(1);
  });

  // 显式 HTTP 超时，不依赖 Node 默认值：
  // headersTimeout 覆盖慢隧道上的请求头接收；requestTimeout 覆盖大上传
  // （26MB 样张经 cloudflared）的完整接收窗口；keepAliveTimeout 给复用连接留余量。
  server.requestTimeout = 600000;
  server.headersTimeout = 120000;
  server.keepAliveTimeout = 6000;

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
