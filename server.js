'use strict';

var express = require('express');
var path = require('path');
var fs = require('fs');
var cp = require('child_process');
var createProxyMiddleware = require('http-proxy-middleware').createProxyMiddleware;
var loadGatewayConfig = require('./server/config').loadGatewayConfig;
var security = require('./server/security');
var createChatRouter = require('./routes/chat').createChatRouter;
var createVoiceRouter = require('./routes/tts').createVoiceRouter;
var createLive2dRouter = require('./routes/live2d').createLive2dRouter;

function createGateway(options) {
  options = options || {};
  var config = options.config || loadGatewayConfig(__dirname, options.env || process.env);
  var app = express();
  var tunnelUrl = '';
  var pendingTunnelUrl = '';
  var tunnelProcess = null;

  app.disable('x-powered-by');
  app.use(security.responseHeaders);
  app.use(security.tokenAuth(config.TOKEN));

  var chat = createChatRouter(config, options.services);
  var voice = createVoiceRouter(config, options.services);
  var live2d = createLive2dRouter(config, options.services);
  app.use(chat.router);
  app.use(voice.router);
  app.use(live2d.router);
  require('./routes/maintenance')(app, config);

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

  app.get(['/', '/index.html'], function (req, res) {
    res.sendFile(path.join(config.ROOT_DIR, 'index.html'));
  });
  app.use('/css', express.static(path.join(config.ROOT_DIR, 'css'), { dotfiles:'deny', index:false }));
  app.use('/assets', express.static(path.join(config.ROOT_DIR, 'assets'), { dotfiles:'deny', index:false }));
  app.use('/data', express.static(path.join(config.ROOT_DIR, 'data'), { dotfiles:'deny', index:false }));
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
  app.use('/docs', express.static(path.join(config.ROOT_DIR, 'docs'), { dotfiles:'deny' }));
  app.use('/tools', function (req, res, next) {
    if (req.path === '/control-server.js') return res.status(404).end();
    next();
  }, express.static(path.join(config.ROOT_DIR, 'tools'), { dotfiles:'deny' }));

  app.use(createProxyMiddleware({
    target:config.SD_HOST,
    changeOrigin:true,
    ws:true,
    pathFilter:function (pathname) {
      return pathname.startsWith('/sdapi') || pathname.startsWith('/controlnet') || pathname.startsWith('/adetailer');
    },
    proxyTimeout:20 * 60 * 1000,
    auth:config.SD_API_AUTH || undefined,
    on:{
      proxyReq:function () { console.log('  → SD API 请求已转发'); },
      error:function (error, req, res) {
        console.error('  ❌ SD 代理错误:', error.message);
        if (!res.headersSent) {
          res.status(502).json({ error:'SD WebUI 未响应，请确认已经启动 (' + config.SD_HOST + ')' });
        }
      }
    }
  }));

  app.use(function (error, req, res, next) {
    if (res.headersSent) return next(error);
    var invalidJson = error && error.type === 'entity.parse.failed';
    res.status(invalidJson ? 400 : 500).json({
      error:invalidJson ? '请求 JSON 格式错误' : '网关内部错误',
      detail:invalidJson ? '' : error.message
    });
  });

  function startTunnel() {
    if (config.DISABLE_TUNNEL) return;
    if (!fs.existsSync(config.CLOUDFLARED_PATH)) {
      console.log('  ⚠ cloudflared not found, tunnel disabled');
      return;
    }
    console.log('  🌪 Starting Cloudflare Tunnel...');
    var runtimeTools = require('./scripts/runtime-paths');
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

    var attempts = 0;
    var poll = setInterval(function () {
      try {
        var log = fs.readFileSync(config.RUNTIME.tunnelLog, 'utf8');
        var match = log.match(/https:\/\/\S+trycloudflare\.com/);
        if (match) pendingTunnelUrl = match[0];
        if (pendingTunnelUrl && /Registered tunnel connection/i.test(log)) {
          tunnelUrl = pendingTunnelUrl;
          console.log('  🌪 Tunnel: ' + tunnelUrl + '?token=' + config.TOKEN);
          clearInterval(poll);
        }
      } catch (error) {}
      attempts += 1;
      if (attempts > 30) clearInterval(poll);
    }, 1000);
  }

  function close() {
    voice.close();
    if (tunnelProcess && tunnelProcess.pid) {
      try { process.kill(tunnelProcess.pid); } catch (error) {}
    }
    tunnelProcess = null;
  }

  return {
    app:app,
    config:config,
    services:{ chat:chat.service, tts:voice.tts, translation:voice.translation, live2d:live2d.service },
    startTunnel:startTunnel,
    close:close
  };
}

function startGateway(options) {
  var gateway = createGateway(options);
  var config = gateway.config;
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
    console.log('  🔐 Token: ' + config.TOKEN);
    console.log('  ══════════════════════════════════════════');
    console.log('');
    gateway.startTunnel();
  });

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
