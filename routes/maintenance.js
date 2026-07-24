var path = require('path');
var fs = require('fs');
var cp = require('child_process');
var express = require('express');

module.exports = function (app, cfg) {
  var sceneStore = require('../scripts/runtime/scene-store');

  var SCENE_SHOWCASE_DIR = cfg.SCENE_SHOWCASE_DIR;
  var MAINTENANCE_BACKUP_DIR = path.join(cfg.RUNTIME_ROOT, 'maintenance-backups');

  function isDirectLocalRequest(req) {
    var address = (req.socket && req.socket.remoteAddress) || '';
    var loopback = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
    var forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.headers.forwarded;
    return loopback && !forwarded;
  }

  function maintenanceLocalOnly(req, res, next) {
    if (!isDirectLocalRequest(req)) return res.status(403).json({ error: '维护操作仅允许在本机执行' });
    next();
  }

  function maintenanceSnapshot() {
    var files = [sceneStore.aggregatePath, path.join(__dirname, '..', 'data', 'retired-scenes.json')];
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
      ['scripts/maintenance/classify-scene-ratings.js', ['--write']],
      ['scripts/maintenance/optimize-scenes.js', ['--write']],
      ['scripts/maintenance/validate-scenes.js', []]
    ];
    for (var i = 0; i < commands.length; i += 1) {
      var result = cp.spawnSync(process.execPath, [commands[i][0]].concat(commands[i][1]), {
        cwd:path.join(__dirname, '..'), encoding:'utf8', timeout:120000, windowsHide:true
      });
      if (result.error || result.status !== 0) {
        throw new Error((result.stderr || result.stdout || result.error && result.error.message || '维护校验失败').trim().slice(-1200));
      }
    }
  }

  function readSceneShowcaseManifest() {
    if (!SCENE_SHOWCASE_DIR) return null;
    try {
      var manifest = JSON.parse(fs.readFileSync(path.join(SCENE_SHOWCASE_DIR, 'manifest.json'), 'utf8'));
      if (!manifest || !Array.isArray(manifest.entries)) return null;
      return manifest;
    } catch (e) { return null; }
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
      if (snapshot) { try { restoreMaintenanceSnapshot(snapshot); } catch (re) {} }
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
      fs.mkdirSync(imageDir, { recursive:true }); fs.mkdirSync(thumbDir, { recursive:true });
      fs.writeFileSync(path.join(imageDir, id + ext), buffer);
      fs.writeFileSync(path.join(thumbDir, id + ext), buffer);
      res.json({ ok:true, file:'images/' + id + ext, message:'样张与缩略图已保存，刷新页面即可看到新版本' });
    } catch (error) { res.status(400).json({ ok:false, error:error.message }); }
  });

  app.post('/api/save-backup', express.json({ limit:'22mb' }), function (req, res) {
    try {
      var imageBase64 = req.body.imageBase64, filename = req.body.filename;
      if (!imageBase64) return res.status(400).json({ error:'No image data' });
      var match = String(imageBase64).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/);
      if (!match) return res.status(400).json({ error:'仅支持 PNG、JPEG 或 WebP 图片' });
      var imageBuffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
      if (!imageBuffer.length || imageBuffer.length > 15 * 1024 * 1024) return res.status(413).json({ error:'图片大小必须在 15MB 以内' });
      var backupDir = path.join(cfg.RUNTIME_ROOT, 'outputs');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      var ext = match[1] === 'jpeg' ? '.jpg' : '.' + match[1];
      var stem = filename ? path.parse(path.basename(String(filename))).name : 'backup';
      var safeStem = stem.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'backup';
      var name = safeStem + '_' + Date.now() + ext;
      var target = path.resolve(backupDir, name);
      if (!target.startsWith(path.resolve(backupDir) + path.sep)) return res.status(400).json({ error:'Invalid filename' });
      fs.writeFileSync(target, imageBuffer);
      console.log('  💾 图片已备份: ' + name);
      res.json({ status:'ok', file:name });
    } catch (err) { res.status(500).json({ error:err.message }); }
  });

  app.get('/api/showcase-status', function (req, res) {
    var manifest = readSceneShowcaseManifest();
    res.setHeader('Cache-Control', 'no-store');
    if (!manifest) return res.json({ available:false, sceneCount:0 });
    res.json({ available:true, sceneCount:Number(manifest.sceneCount) || manifest.entries.length, counts:manifest.counts || {}, sourceAudit:manifest.sourceAudit || '' });
  });
};
