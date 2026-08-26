'use strict';

/**
 * routes/interrogate.js — 本地图片反推（无网络）
 * 目标：上传一张图 → 反推出 Anima(Tag) / Krea2(Prose) → 回填 promptBuilderStore → 切人直出
 * 约束：仅本机可用，图片不落盘明文，阈值过滤 + 去身份污染由调用方二次处理
 */

var express = require('express');
var http = require('http');
var https = require('https');
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

async function tryComfyInterrogate(config, imageBase64, threshold, mode) {
  // 探测 Comfy 是否在线且装有 WD14Tagger / Florence2
  // 为保持零依赖，这里仅做轻量探测，不直接提交工作流；真实工作流可按需在 comfy-client 上扩展
  // 若探测成功，后续可在此处构造 workflow 并通过 comfyClient.submit 执行
  try {
    var info = await requestJson(config, 'COMFY_HOST', 'GET', '/object_info', null, 5000);
    var hasWD = info && !!info.WD14Tagger;
    var hasFlorence = info && (!!info.Florence2Run || !!info.JoyCaption);
    if (mode === 'tag' && hasWD) {
      // TODO: 构造 Comfy workflow 并提交，当前先回 null 走兜底，避免阻塞
      return null;
    }
    if (mode === 'caption' && hasFlorence) return null;
  } catch (e) { }
  return null;
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
