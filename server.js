var express = require('express');
var { createProxyMiddleware } = require('http-proxy-middleware');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var app = express();
var PORT = process.env.PORT || 3000;
var SD_HOST = process.env.SD_HOST || 'http://127.0.0.1:7860';
var TOKEN = process.env.TOKEN || crypto.randomBytes(8).toString('hex');

// ─── Token 认证中间件 ───
app.use(function (req, res, next) {
  // 静态文件和 save-backup 都需要 token
  var t = req.query.token || req.headers['x-token'];
  if (t === TOKEN) return next();
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

// ─── 静态文件托管 ───
app.use(express.static(path.join(__dirname)));

// ─── 图片备份接口 ───
app.use(express.json({ limit: '50mb' }));
app.post('/api/save-backup', function (req, res) {
  try {
    var imageBase64 = req.body.imageBase64;
    var filename = req.body.filename;
    if (!imageBase64) return res.status(400).json({ error: 'No image data' });

    var backupDir = path.join(__dirname, 'friend_outputs');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    var base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    var name = filename || ('backup_' + Date.now() + '.png');
    fs.writeFileSync(path.join(backupDir, name), base64Data, 'base64');

    console.log('  💾 图片已备份: ' + name);
    res.json({ status: 'ok', file: name });
  } catch (err) {
    console.error('  ❌ 备份失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── SD API 反代 ───
app.use('/sdapi', createProxyMiddleware({
  target: SD_HOST,
  changeOrigin: true,
  ws: true,
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
app.listen(PORT, function () {
  console.log('');
  console.log('  ═══════════════════════════════════════════');
  console.log('  🔗 AI-CG-Studio 联机网关已启动');
  console.log('  📡 端口: ' + PORT);
  console.log('  🎨 SD 后端: ' + SD_HOST);
  console.log('  🔑 Token: ' + TOKEN);
  console.log('');
  console.log('  本地访问:');
  console.log('    http://localhost:' + PORT + '/?token=' + TOKEN);
  console.log('');
  console.log('  朋友访问（穿透后替换域名）:');
  console.log('    https://你的域名/?token=' + TOKEN);
  console.log('  ═══════════════════════════════════════════');
  console.log('');
});
