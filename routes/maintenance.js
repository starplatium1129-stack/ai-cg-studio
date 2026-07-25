'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var express = require('express');

function createMaintenanceRouter(cfg) {
  var router = express.Router();
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

  function readJson(source) {
    return JSON.parse(fs.readFileSync(source, 'utf8'));
  }

  function writeJson(source, data) {
    fs.writeFileSync(source, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  function cleanOrphanedSceneRefs() {
    // 保存场景后自动清理 characters.json 和 loras.json 中引用已删除场景的条目
    var activeIds = new Set(sceneStore.loadSceneShards().scenes.map(function (s) { return s.id; }));
    var dataDir = path.join(__dirname, '..', 'data');
    var changed = false;

    // Clean characters.json
    var charactersPath = path.join(dataDir, 'characters.json');
    var characters = readJson(charactersPath);
    characters.forEach(function (ch) {
      var recs = ch.lora && ch.lora.recommended_scene;
      if (Array.isArray(recs)) {
        var filtered = recs.filter(function (id) { return activeIds.has(id); });
        if (filtered.length !== recs.length) {
          ch.lora.recommended_scene = filtered;
          changed = true;
        }
      }
    });
    if (changed) writeJson(charactersPath, characters);

    // Clean loras.json
    var lorasPath = path.join(dataDir, 'loras.json');
    var loras = readJson(lorasPath);
    changed = false;
    loras.forEach(function (lora) {
      var scenes = lora.related_scenes || lora.scenes;
      if (Array.isArray(scenes)) {
        var filtered = scenes.filter(function (id) { return activeIds.has(id); });
        if (filtered.length !== scenes.length) {
          if (lora.related_scenes) lora.related_scenes = filtered;
          if (lora.scenes) lora.scenes = filtered;
          changed = true;
        }
      }
    });
    if (changed) writeJson(lorasPath, loras);
  }

  function autoRetireDeletedScenes(incomingScenes, previousScenes) {
    var incomingIds = new Set(incomingScenes.map(function (s) { return s.id; }));
    var retiredPath = path.join(__dirname, '..', 'data', 'retired-scenes.json');
    var data = readJson(retiredPath);
    var retiredRecords = data.records || [];
    var retiredIds = new Set(retiredRecords.map(function (r) { return r.id; }));
    var added = [];

    previousScenes.forEach(function (scene) {
      if (!incomingIds.has(scene.id) && !retiredIds.has(scene.id)) {
        retiredRecords.push({ id: scene.id, retiredAt: new Date().toISOString().split('T')[0], reason: '在场景管理中下架' });
        added.push(scene.id);
      }
    });

    if (added.length) {
      data.records = retiredRecords;
      writeJson(retiredPath, data);
      console.log('  🗑 已登记 ' + added.length + ' 个下架场景: ' + added.join(', '));
    }

    // Also remove showcase sample images for retired scenes
    if (added.length && SCENE_SHOWCASE_DIR) {
      added.forEach(function (sceneId) {
        var exts = ['jpg', 'png', 'webp'];
        exts.forEach(function (ext) {
          var imgPath = path.join(SCENE_SHOWCASE_DIR, 'images', sceneId + '.' + ext);
          var thumbPath = path.join(SCENE_SHOWCASE_DIR, 'thumbs', sceneId + '.' + ext);
          try { if (fs.existsSync(imgPath)) { fs.unlinkSync(imgPath); console.log('  🖼 已删除样张: images/' + sceneId + '.' + ext); } } catch (e) {}
          try { if (fs.existsSync(thumbPath)) { fs.unlinkSync(thumbPath); console.log('  🖼 已删除缩略图: thumbs/' + sceneId + '.' + ext); } } catch (e) {}
        });
        // Remove from manifest if it exists
        var manifestPath = path.join(SCENE_SHOWCASE_DIR, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            var m = readJson(manifestPath);
            if (m && Array.isArray(m.entries)) {
              m.entries = m.entries.filter(function (e) { return e.id !== sceneId; });
              m.sceneCount = m.entries.length;
              writeJson(manifestPath, m);
            }
          } catch (e) {}
        }
      });
    }
  }

  router.post('/api/maintenance/scenes', maintenanceLocalOnly, express.json({ limit:'12mb' }), function (req, res) {
    var scenes = req.body && req.body.scenes;
    if (!Array.isArray(scenes) || scenes.length > 1000) return res.status(400).json({ error:'场景数据格式错误或数量超出限制' });
    var ids = new Set();
    for (var i = 0; i < scenes.length; i += 1) {
      var id = String(scenes[i] && scenes[i].id || '');
      if (!/^sc\d{3}$/.test(id) || ids.has(id)) return res.status(400).json({ error:'场景 ID 必须唯一且符合 sc001 格式：' + id });
      ids.add(id);
    }
    var snapshot;
    try {
      snapshot = maintenanceSnapshot();
      if (!fs.existsSync(MAINTENANCE_BACKUP_DIR)) fs.mkdirSync(MAINTENANCE_BACKUP_DIR, { recursive:true });
      var stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync(path.join(MAINTENANCE_BACKUP_DIR, 'scenes-' + stamp + '.json'), sceneStore.jsonText(sceneStore.loadSceneShards().scenes));
      var prevScenes = sceneStore.loadSceneShards().scenes;
      sceneStore.writeSceneSet(scenes);
      autoRetireDeletedScenes(scenes, prevScenes);
      cleanOrphanedSceneRefs();
      runMaintenanceChecks();
      res.json({ ok:true, count:scenes.length, message:'场景已保存并通过校验' });
    } catch (error) {
      if (snapshot) { try { restoreMaintenanceSnapshot(snapshot); } catch (re) {} }
      res.status(400).json({ ok:false, error:error.message });
    }
  });

  router.post('/api/maintenance/showcase', maintenanceLocalOnly, express.json({ limit:'18mb' }), function (req, res) {
    try {
      if (!SCENE_SHOWCASE_DIR) return res.status(503).json({ error:'尚未找到 SceneShowcase 目录' });
      var id = String(req.body && req.body.id || '');
      var image = String(req.body && req.body.image || '');
      var match = image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/);
      if (!/^sc\d{3}$/.test(id) || !match) return res.status(400).json({ error:'需要合法场景 ID 和 PNG/JPEG/WebP 图片' });
      var buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
      if (!buffer.length || buffer.length > 15 * 1024 * 1024) return res.status(413).json({ error:'图片必须在 15MB 以内' });
      var ext = match[1] === 'jpeg' ? '.jpg' : '.' + match[1];
      var imageDir = path.join(SCENE_SHOWCASE_DIR, 'images');
      var thumbDir = path.join(SCENE_SHOWCASE_DIR, 'thumbs');
      fs.mkdirSync(imageDir, { recursive:true }); fs.mkdirSync(thumbDir, { recursive:true });
      fs.writeFileSync(path.join(imageDir, id + ext), buffer);
      fs.writeFileSync(path.join(thumbDir, id + ext), buffer);
      try {
        var manifestPath = path.join(SCENE_SHOWCASE_DIR, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          var manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          var scenes = sceneStore.loadSceneShards().scenes;
          var scene = scenes.find(function(s) { return s.id === id; });
          if (scene) {
            var idx = manifest.entries ? manifest.entries.findIndex(function(e) { return e.id === id; }) : -1;
            var entry = { id:scene.id, title:scene.title, category:scene.category, story:scene.story, char:scene.char, rating:scene.rating, attempt:1, image:'images/' + id + ext, thumb:'thumbs/' + id + ext };
            if (idx >= 0) { manifest.entries[idx] = entry; }
            else { if (!manifest.entries) manifest.entries = []; manifest.entries.push(entry); manifest.sceneCount = manifest.entries.length; }
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
          }
        }
      } catch (manifestError) { console.error('manifest update failed:', manifestError.message); }
      res.json({ ok:true, file:'images/' + id + ext, message:'样张与缩略图已保存，刷新页面即可看到新版本' });
    } catch (error) { res.status(400).json({ ok:false, error:error.message }); }
  });

  router.post('/api/backup', express.json({ limit:'22mb' }), function (req, res) {
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

  router.get('/api/showcase-status', function (req, res) {
    var manifest = readSceneShowcaseManifest();
    res.setHeader('Cache-Control', 'no-store');
    if (!manifest) return res.json({ available:false, sceneCount:0 });
    res.json({ available:true, sceneCount:Number(manifest.sceneCount) || manifest.entries.length, counts:manifest.counts || {}, sourceAudit:manifest.sourceAudit || '' });
  });

  // ---- 维护脚本一键执行 ----
  var MAINTENANCE_TASKS = {
    'lint-colors': { args:[], label:'检查硬编码颜色', desc:'扫描所有 HTML/CSS 中的 #XXXXXX 颜色，确保已替换为设计 token' },
    'validate':    { args:[], label:'完整场景校验', desc:'按模块检查场景数据：ID 唯一性、字段完整性、评级一致性' },
    'classify':    { args:['--write'], label:'更新场景评级', desc:'根据标签内容重新计算 All/R15/R18 评级' },
    'optimize':    { args:['--write'], label:'规范化提示词', desc:'统一标签命名、补全标准负面词、修复占位符' }
  };

  router.post('/api/maintenance/run', maintenanceLocalOnly, express.json({ limit:'2kb' }), function (req, res) {
    var task = String(req.body && req.body.task || '').trim();
    if (!MAINTENANCE_TASKS[task]) {
      return res.status(400).json({ ok:false, error:'不支持的任务：' + task });
    }

    var script = 'scripts/maintenance/' + task + '.js';
    var args = MAINTENANCE_TASKS[task].args;
    var result = cp.spawnSync(process.execPath, [script].concat(args), {
      cwd:path.join(__dirname, '..'), encoding:'utf8', timeout:120000, windowsHide:true
    });

    var output = (result.stdout || '') + (result.stderr || '');
    if (output.length > 8000) output = output.slice(0, 8000) + '\n...(truncated)';
    output = output.trim();
    if (!output) output = (result.error ? '执行出错：' + result.error.message : '任务完成，无输出');
    res.json({
      ok: result.status === 0 && !result.error,
      task: task,
      label: MAINTENANCE_TASKS[task].label,
      output: output,
      exitCode: result.error ? 1 : result.status
    });
  });

  return { router:router, sceneStore:sceneStore };
}

module.exports = { createMaintenanceRouter:createMaintenanceRouter };
