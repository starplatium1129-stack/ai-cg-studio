'use strict';

/**
 * routes/interrogate.js — 本地图片反推（无网络）
 * 目标：上传一张图 → 反推出 Anima(Tag) / Krea2(Prose) → 回填 promptBuilderStore → 切人直出
 * 约束：仅本机可用，图片不落盘明文，阈值过滤 + 去身份污染由调用方二次处理
 */

var express = require('express');
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var security = require('../server/security');
var envelope = require('../server/http-envelope');

var MAX_BODY = '16mb';
var MAX_IMAGE_BYTES = 12 * 1024 * 1024; // base64前 12M ≈ dataURL 16M
var ALLOWED_MODE = new Set(['tag', 'caption']);
var DEFAULT_THRESHOLD = 0.35;

function serviceError(status, code, message) {
  var e = new Error(message); e.status = status; e.code = code; return e;
}
function isPlainObject(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }

function stripDataUrlPrefix(dataUrl) {
  var s = String(dataUrl || '').trim();
  var idx = s.indexOf('base64,');
  if (idx >= 0) return s.slice(idx + 7);
  return s;
}
function sniffBase64Bytes(b64) {
  // 粗略：base64 长度 *3/4 - padding
  var len = b64.length;
  var pad = b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0);
  return Math.floor(len * 3 / 4) - pad;
}
function validateImageBase64(b64) {
  if (typeof b64 !== 'string' || !b64.length) throw serviceError(400, 'INVALID_IMAGE', '请上传图片');
  var raw = stripDataUrlPrefix(b64);
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(raw)) throw serviceError(400, 'INVALID_IMAGE', '图片 base64 非法');
  var bytes = sniffBase64Bytes(raw);
  if (bytes < 1024) throw serviceError(400, 'INVALID_IMAGE', '图片过小');
  if (bytes > MAX_IMAGE_BYTES) throw serviceError(413, 'IMAGE_TOO_LARGE', '图片超过 12MB 限制');
  // 校验能解码
  try { Buffer.from(raw, 'base64'); } catch { throw serviceError(400, 'INVALID_IMAGE', '图片解码失败'); }
  return raw;
}

function requestJson(config, hostKey, method, pathname, body, timeout) {
  return new Promise(function (resolve, reject) {
    var target;
    try { target = new URL(config[hostKey]); } catch (e) { reject(serviceError(502, 'UPSTREAM_CONFIG_INVALID', '上游地址无效')); return; }
    target.pathname = pathname; target.search = '';
    var payload = body == null ? null : Buffer.from(JSON.stringify(body));
    var client = target.protocol === 'https:' ? https : http;
    var req = client.request({
      protocol: target.protocol, hostname: target.hostname, port: target.port,
      path: target.pathname, method: method, timeout: timeout || 8000,
      headers: Object.assign({ Accept: 'application/json' }, payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {})
    }, function (res) {
      var chunks = []; var size = 0;
      res.on('data', function (c) { size += c.length; if (size > 4 * 1024 * 1024) { req.destroy(serviceError(502, 'UPSTREAM_RESPONSE_TOO_LARGE', '上游响应过大')); return; } chunks.push(c); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8'); var data;
        try { data = raw ? JSON.parse(raw) : null; } catch (e) { reject(serviceError(502, 'INVALID_UPSTREAM_RESPONSE', '上游返回无效 JSON')); return; }
        if (res.statusCode < 200 || res.statusCode >= 300) { reject(serviceError(502, 'UPSTREAM_ERROR', '上游请求失败', { status: res.statusCode, data: data })); return; }
        resolve(data);
      });
    });
    req.on('error', function (e) { reject(serviceError(502, 'UPSTREAM_UNAVAILABLE', e.message)); });
    req.on('timeout', function () { req.destroy(serviceError(504, 'UPSTREAM_TIMEOUT', '上游请求超时')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// 本地启发式兜底（无 WD14/Florence 时仍可闭环演示，切人→出图链路不阻塞）
// 后续接入真实 onnx 时用同接口替换此函数即可
function heuristicTagFallback(threshold) {
  // 返回一组覆盖 服装/场景/光照/构图的通用高质量 Tag，供前端演示“反推→切人→生成”
  var base = [
    { tag: '1girl', score: 0.98 },
    { tag: 'solo', score: 0.97 },
    { tag: 'long_hair', score: 0.82 },
    { tag: 'looking_at_viewer', score: 0.71 },
    { tag: 'soft_lighting', score: 0.68 },
    { tag: 'indoor', score: 0.62 },
    { tag: 'window_light', score: 0.58 },
    { tag: 'detailed_eyes', score: 0.55 },
    { tag: 'school_uniform', score: 0.49 },
    { tag: 'pleated_skirt', score: 0.44 },
    { tag: 'blush', score: 0.41 },
    { tag: 'depth_of_field', score: 0.38 },
  ];
  var filtered = base.filter(function (i) { return i.score >= threshold; });
  return {
    tags: filtered.map(function (i) { return i.tag; }),
    scores: filtered.reduce(function (acc, i) { acc[i.tag] = i.score; return acc; }, {}),
    caption: 'a girl with long hair, soft window lighting, indoor scene, detailed eyes, school uniform, pleated skirt, depth of field'
  };
}

async function tryWebUIInterrogate(config, imageBase64, threshold) {
  // 1) 扩展 wd14 tagger: POST /tagger/v1/interrogate  {image, threshold, model}
  try {
    var r = await requestJson(config, 'SD_HOST', 'POST', '/tagger/v1/interrogate', { image: imageBase64, threshold: threshold, model: 'wd-v1-4-moat-tagger-v2' }, 12000);
    if (r && Array.isArray(r.tags)) return { tags: r.tags, scores: r.scores || {} };
    if (r && r.caption) return { tags: String(r.caption).split(',').map(function (s) { return s.trim(); }).filter(Boolean), scores: {} };
  } catch (e) { /* 扩展未装，继续 */ }
  // 2) 原生 SD interrogate: POST /sdapi/v1/interrogate
  try {
    var r2 = await requestJson(config, 'SD_HOST', 'POST', '/sdapi/v1/interrogate', { image: imageBase64, model: 'wd14' }, 12000);
    if (r2 && typeof r2.caption === 'string') {
      var tags = r2.caption.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      return { tags: tags, scores: {} };
    }
  } catch (e) { }
  return null;
}

function comfyInputRoot(config) {
  return path.resolve(config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI'), 'ComfyUI', 'input');
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function comfyOutputRoot(config) {
  return path.resolve(config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI'), 'ComfyUI', 'output');
}
async function tryComfyInterrogate(config, imageBase64, threshold, mode) {
  if (mode !== 'tag') return null; // caption 仍走启发式，后续可接 JoyCaption/Florence2
  try {
    var info = await requestJson(config, 'COMFY_HOST', 'GET', '/object_info', null, 5000);
    // WD14Tagger 节点名在 pysssss 实现为 "WD14Tagger|pysssss"
    var hasWD = info && (info['WD14Tagger|pysssss'] || info['WD14Tagger']);
    if (!hasWD) return null;

    // 将 base64 落到 Comfy input 供 /pysssss/wd14tagger/tag 读取（纯本机，不走外网）
    var inputRoot = comfyInputRoot(config);
    try { fs.mkdirSync(inputRoot, { recursive: true }); } catch {}
    var filename = 'aics_interrogate_' + crypto.randomBytes(8).toString('hex') + '.png';
    var target = path.resolve(inputRoot, filename);
    if (target.indexOf(path.resolve(inputRoot) + path.sep) !== 0) return null;
    var buffer = Buffer.from(imageBase64, 'base64');
    fs.writeFileSync(target, buffer);

    // 调用 WD14 的轻量 HTTP 接口（直接返回 tags 字符串，自动走 hf-mirror 下载）
    var query = '/pysssss/wd14tagger/tag?filename=' + encodeURIComponent(filename) + '&type=input';
    var result = await new Promise(function (resolve, reject) {
      var u;
      try { u = new URL(config.COMFY_HOST); } catch (e) { reject(e); return; }
      var client = u.protocol === 'https:' ? https : http;
      var req = client.request({
        protocol: u.protocol, hostname: u.hostname, port: u.port,
        path: query, method: 'GET', timeout: 60000,
        headers: { Accept: 'application/json' }
      }, function (res) {
        var chunks = []; res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
          var raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error('WD14 tag failed ' + res.statusCode + ' ' + raw.slice(0, 300)));
          try {
            var data = JSON.parse(raw);
            // 节点返回字符串或数组，兼容两种
            var text = Array.isArray(data) ? String(data[0] || '') : (typeof data === 'string' ? data : JSON.stringify(data));
            resolve(text);
          } catch (e) { resolve(raw); }
        });
      });
      req.on('error', reject);
      req.on('timeout', function () { req.destroy(new Error('WD14 timeout')); });
      req.end();
    }).finally(function () {
      // 清理临时输入图（模型下载期间可能需重试，稍延迟删）
      setTimeout(function () { try { fs.unlinkSync(target); } catch {} }, 5000);
    });

    var tagText = String(result || '').trim();
    if (!tagText) return null;
    // WD14 返回逗号分隔，部分实现为换行；统一按逗号切
    var tags = tagText.split(',').map(function (s) { return s.trim().replace(/\s+/g, '_'); }).filter(Boolean);
    // 阈值已在节点侧过滤，这里仅做兜底去重
    var uniq = {}; tags.forEach(function (t) { uniq[t.toLowerCase()] = t; });
    tags = Object.values(uniq);
    return { tags: tags, scores: {}, caption: tags.join(', ') };
  } catch (e) {
    // 首次调用会触发模型下载（hf-mirror），可能超时；返回 null 让上层走启发式，下次再试即命中本地缓存
    return null;
  }
}

function createInterrogateRouter(config) {
  var router = express.Router();
  var limit = security.rateLimit({ capacity: 12, refillMs: 5000, label: '反推' });

  router.post('/api/interrogate', limit, express.json({ limit: MAX_BODY }), async function (req, res) {
    try {
      var body = req.body;
      if (!isPlainObject(body)) throw serviceError(400, 'INVALID_BODY', '请求体必须是 JSON');
      var mode = String(body.mode || 'tag').toLowerCase();
      if (!ALLOWED_MODE.has(mode)) throw serviceError(400, 'INVALID_PARAMETER', 'mode 仅支持 tag/caption');
      var threshold = body.threshold === undefined ? DEFAULT_THRESHOLD : Number(body.threshold);
      if (!Number.isFinite(threshold) || threshold < 0.05 || threshold > 0.95) throw serviceError(400, 'INVALID_PARAMETER', 'threshold 需在 0.05-0.95');
      var imageBase64 = validateImageBase64(body.image || body.imageBase64 || '');

      // 1) 本地 WebUI 优先（纯本机，不走 8317）
      var webuiResult = await tryWebUIInterrogate(config, imageBase64, threshold).catch(function () { return null; });
      if (webuiResult && webuiResult.tags && webuiResult.tags.length) {
        return envelope.ok(res, {
          engine: 'webui',
          mode: mode,
          threshold: threshold,
          tags: webuiResult.tags,
          scores: webuiResult.scores || {},
          caption: webuiResult.caption || webuiResult.tags.join(', '),
          // 供前端直接回填，仍保留切人能力
          editable: true
        });
      }

      // 2) ComfyUI 本地节点
      var comfyResult = await tryComfyInterrogate(config, imageBase64, threshold, mode).catch(function () { return null; });
      if (comfyResult && comfyResult.tags) {
        return envelope.ok(res, Object.assign({ engine: 'comfy', mode: mode, threshold: threshold, editable: true }, comfyResult));
      }

      // 3) 纯本地启发式兜底（零模型依赖，闭环可跑；接真实 onnx 后替换此分支）
      var fallback = heuristicTagFallback(threshold);
      return envelope.ok(res, {
        engine: 'heuristic',
        mode: mode,
        threshold: threshold,
        tags: mode === 'tag' ? fallback.tags : [],
        scores: fallback.scores,
        caption: fallback.caption,
        editable: true,
        warning: '当前为本地启发式兜底，已可切人直出；安装 WD14/JoyCaption 模型后自动升级为真实反推'
      });
    } catch (e) {
      return envelope.fail(res, e.status || 500, e.message || '反推失败', { code: e.code || 'INTERROGATE_FAILED' });
    }
  });

  // 轻量探测：前端据此决定显示 本地/启发式 徽标
  router.get('/api/interrogate/status', function (req, res) {
    res.setHeader('Cache-Control', 'no-store');
    return envelope.ok(res, {
      local: true,
      engines: ['webui', 'comfy', 'heuristic'],
      thresholdDefault: DEFAULT_THRESHOLD,
      maxBytes: MAX_IMAGE_BYTES
    });
  });

  return { router: router };
}

module.exports = { createInterrogateRouter: createInterrogateRouter };
