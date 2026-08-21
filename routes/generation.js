'use strict';

var crypto = require('crypto');
var express = require('express');
var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');
var security = require('../server/security');
var envelope = require('../server/http-envelope');
var anima = require('./anima');
var superres = require('./superres');

var MAX_PENDING = 4;
var MAX_BODY = '64kb';
var MAX_UPSTREAM_JSON_BYTES = 8 * 1024 * 1024;
var WEB_JOB_TTL_MS = 2 * 60 * 60 * 1000;
var CHECKPOINT = 'waiIllustriousSDXL_v170.safetensors';
var OUTPUT_PREFIX = 'wai_app';
var LORAS = Object.freeze({
  L_NENE_V18_WD14: { file:'ayachi_nene_v18_wd14.safetensors', character:'nene', min:0.65, max:1 },
  L_NAT_V18_WD14: { file:'shiki_natsume_v18_wd14.safetensors', character:'natsume', min:0.65, max:1 }
});
var DUAL_LORA_IDS = Object.freeze(['L_NENE_V18_WD14', 'L_NAT_V18_WD14']);
var WEBUI_UPSCALERS = new Set(['Auto', 'Remacri', 'Latent', 'Latent (nearest-exact)', 'R-ESRGAN 4x+ Anime6B', 'R-ESRGAN 4x+']);
// Comfy 本地真超分模型见 routes/superres.js（Remacri 优先，按优先级探测 upscale_models）。
var COMFY_SUPERRES_FILES = superres.COMFY_SUPERRES_FILES;
var SUPER_RES_UPSALERS = superres.SUPER_RES_UPSALERS;
var SAMPLERS = Object.freeze({
  'DPM++ 2M': { sampler:'dpmpp_2m', scheduler:'normal' },
  'DPM++ 2M Karras': { sampler:'dpmpp_2m', scheduler:'karras' },
  'Euler a': { sampler:'euler_ancestral', scheduler:'normal' },
  'Euler': { sampler:'euler', scheduler:'normal' }
});
var ALLOWED = new Set([
  'prompt', 'negative', 'profile', 'modelId', 'character', 'loras', 'width', 'height',
  'steps', 'cfg', 'seed', 'sampler', 'scheduler', 'hiresFix', 'hiresScale',
  'hiresUpscaler', 'hiresSteps', 'denoisingStrength', 'faceDetailer'
]);

function error(status, code, message, detail) {
  var e = new Error(message); e.status = status; e.code = code; e.detail = detail; return e;
}
function plain(o) { return Boolean(o) && typeof o === 'object' && !Array.isArray(o); }
function number(v, name, min, max, integer) {
  if (typeof v !== 'number' || !Number.isFinite(v) || (integer && !Number.isInteger(v)) || v < min || v > max) {
    throw error(400, 'INVALID_PARAMETER', name + ' 超出允许范围');
  }
  return v;
}
function owner(req) {
  if (security.isDirectLocalRequest(req)) return 'local';
  var cookie = String(req.headers.cookie || '').match(/(?:^|;\s*)aics_token=([^;]+)/);
  var token = req.headers['x-token'] || cookie && cookie[1] || req.query && req.query.token || '';
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
function comfyModelsRoot(config, kind) {
  return path.resolve(config.AI_WORKSPACE_ROOT || '', 'ComfyUI', 'models', kind);
}
function safeComfyResource(config, kind, file) {
  var root = comfyModelsRoot(config, kind);
  var target = path.resolve(root, file);
  if (target.indexOf(root + path.sep) !== 0) return false;
  try { return fs.statSync(target).isFile(); } catch (error) { return false; }
}
// 2026-08-18：探测本机可用的 ESRGAN 超分模型（按优先顺序），返回文件名或 null。
// 供 upstream 无 WebUI 时的本地真 super-res hires（generation.js 原生 Comfy 链路）。
// 复用共享模块 routes/superres.js（WAI 与 Anima 两条链路同一份清单与探测逻辑）。
function availableSuperRes(config) {
  return superres.availableSuperRes(config);
}
function normalizeCheckpointName(value) {
  var text = String(value || '').trim().replace(/^.*[\\/]/, '');
  text = text.replace(/\s*(?:\[[^\]]*\]|\([^)]*\))\s*$/, '').trim();
  text = text.replace(/\.(?:safetensors|ckpt|pt)$/i, '').trim();
  return text.replace(/[\s-]+/g, '_').replace(/_+/g, '_').toLowerCase();
}
function isWaiCheckpoint(value) {
  return normalizeCheckpointName(value) === normalizeCheckpointName(CHECKPOINT);
}
function comfyResourcesAvailable(config, input) {
  if (!safeComfyResource(config, 'checkpoints', CHECKPOINT)) return false;
  return (input.loras || []).every(function (lora) { return safeComfyResource(config, 'loras', lora.file); });
}
function validateWaiResources(config, input) {
  if (!comfyResourcesAvailable(config, input)) throw error(503, 'COMFY_RESOURCES_UNAVAILABLE', 'WAI checkpoint 或所选 LoRA 资源不可用');
}
function freezeLoras(loras) {
  return Object.freeze((loras || []).map(function (lora) { return Object.freeze({ id:lora.id, strength:lora.strength }); }));
}
function validate(body) {
  if (!plain(body)) throw error(400, 'INVALID_BODY', '请求体必须是 JSON 对象');
  Object.keys(body).forEach(function (key) { if (!ALLOWED.has(key)) throw error(400, 'UNKNOWN_PARAMETER', '不支持的参数：' + key); });
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 12000) throw error(400, 'INVALID_PARAMETER', 'prompt 无效');
  if (body.negative !== undefined && (typeof body.negative !== 'string' || body.negative.length > 8000)) throw error(400, 'INVALID_PARAMETER', 'negative 无效');
  if (body.modelId !== undefined && body.modelId !== 'waiIllustriousSDXL_v170') throw error(400, 'UNKNOWN_MODEL', '未知 WAI checkpoint');
  var loras = body.loras === undefined ? [] : body.loras;
  if (!Array.isArray(loras) || loras.length > 2) throw error(400, 'INVALID_PARAMETER', 'LoRA 列表无效');
  loras = loras.map(function (item) {
    if (!plain(item) || !LORAS[item.id]) throw error(400, 'UNKNOWN_LORA', '未知 WAI LoRA');
    var spec = LORAS[item.id];
     return { id:item.id, strength:number(item.strength, 'loraStrength', 0, 2, false), file:spec.file };
  });
  var ids = loras.map(function (item) { return item.id; });
  if (new Set(ids).size !== ids.length) throw error(400, 'INVALID_PARAMETER', 'LoRA 不得重复');
  var dual = ids.length === 2 && DUAL_LORA_IDS.every(function (id) { return ids.indexOf(id) !== -1; });
  loras = loras.map(function (item) {
    var spec = LORAS[item.id];
    var min = dual ? 0.45 : spec.min;
    var max = dual ? 0.70 : spec.max;
    return { id:item.id, strength:number(body.loras.find(function (raw) { return raw.id === item.id; }).strength, 'loraStrength', min, max, false), file:spec.file };
  });
  var width = number(body.width, 'width', 512, 1536, true);
  var height = number(body.height, 'height', 512, 2048, true);
  if (width % 8 || height % 8 || width % 64 || height % 64) throw error(400, 'INVALID_PARAMETER', '输出尺寸必须符合 64 对齐契约');
  var sampler = body.sampler || 'DPM++ 2M';
  var mapped = SAMPLERS[sampler];
  if (!mapped && (typeof sampler !== 'string' || sampler.length > 80)) throw error(400, 'UNSUPPORTED_SAMPLER', '采样器名称无效');
  var comfyUnsupported = !mapped;
  if (mapped && body.scheduler !== undefined && body.scheduler !== '' && body.scheduler !== mapped.scheduler && !(sampler === 'DPM++ 2M' && (body.scheduler === 'Karras' || body.scheduler === 'karras'))) comfyUnsupported = true;
  var seed = body.seed === undefined || body.seed < 0 ? crypto.randomInt(0, 2147483647) : number(body.seed, 'seed', 0, 9007199254740991, true);
  var loraTags = [];
  var loraTagPattern = /<lora:([^:>]+):([^>]+)>/gi;
  var tagMatch;
  while ((tagMatch = loraTagPattern.exec(body.prompt)) !== null) {
    var tagName = String(tagMatch[1]).trim();
    var tagWeight = Number(tagMatch[2]);
    var matchingLora = loras.find(function (lora) { return path.basename(lora.file, path.extname(lora.file)).toLowerCase() === tagName.toLowerCase(); });
    if (!matchingLora || !Number.isFinite(tagWeight) || Math.abs(tagWeight - matchingLora.strength) > 0.0001) comfyUnsupported = true;
    loraTags.push({ name:tagName, weight:tagWeight });
  }
  var cleanPrompt = body.prompt.replace(/<lora:[^>]+>/gi, '').replace(/,\s*,/g, ',').replace(/^\s*,|,\s*$/g, '').trim();
  var input = {
    prompt:body.prompt.trim(), cleanPrompt:cleanPrompt, loraTags:loraTags, negative:typeof body.negative === 'string' ? body.negative.trim() : '',
    profile:typeof body.profile === 'string' ? body.profile : '', modelId:'waiIllustriousSDXL_v170', character:body.character || '',
    loras:loras, width:width, height:height, steps:number(body.steps === undefined ? 28 : body.steps, 'steps', 1, 60, true),
    cfg:number(body.cfg === undefined ? 5.5 : body.cfg, 'cfg', 0.5, 20, false), seed:seed, sampler:sampler,
    scheduler:((body.scheduler === 'Karras' || body.scheduler === 'karras') ? 'karras' : (mapped ? mapped.scheduler : 'normal')), webuiScheduler:typeof body.scheduler === 'string' ? body.scheduler : '', comfyUnsupported:comfyUnsupported, hiresFix:Boolean(body.hiresFix), hiresScale:body.hiresScale === undefined ? 1.5 : number(body.hiresScale, 'hiresScale', 1, 2, false),
     hiresUpscaler:typeof body.hiresUpscaler === 'string' ? body.hiresUpscaler : 'Latent',
     hiresSteps:body.hiresSteps === undefined ? 14 : number(body.hiresSteps, 'hiresSteps', 1, 60, true),
     denoisingStrength:body.denoisingStrength === undefined ? 0.35 : number(body.denoisingStrength, 'denoisingStrength', 0, 1, false),
     faceDetailer:Boolean(body.faceDetailer)
  };
  if (!WEBUI_UPSCALERS.has(input.hiresUpscaler)) throw error(400, 'UNSUPPORTED_UPSCALER', '放大器不在服务端白名单');
  input.autoHires = input.hiresFix && input.hiresUpscaler === 'Auto';
  // 2026-08-18：Comfy 本地真 super-res 意图（Remacri / R-ESRGAN 系）也算 Comfy 能力，
  // 但具体 ESRGAN 模型文件可用性由路由层（有 config / fs）决定并注入 input.superResModel。
  input.superResWanted = input.hiresFix && SUPER_RES_UPSALERS.has(input.hiresUpscaler);
  input.comfyHires = input.hiresFix && (input.autoHires || input.hiresUpscaler === 'Latent' || input.hiresUpscaler === 'Latent (nearest-exact)' || input.superResWanted)
    && input.hiresScale >= 1.25 && input.hiresScale <= 1.5 && input.hiresSteps >= 8 && input.hiresSteps <= 24
    && input.denoisingStrength >= 0.25 && input.denoisingStrength <= 0.5
    && input.width * input.height * input.hiresScale * input.hiresScale <= 3200000;
  input.comfyUnsupported = input.comfyUnsupported || (input.hiresFix && !input.comfyHires);
  return input;
}

function buildWorkflow(input) {
  var model = '1'; var clip = '1'; var vae = '1';
  var graph = { '1': { class_type:'CheckpointLoaderSimple', inputs:{ ckpt_name:CHECKPOINT } } };
  input.loras.forEach(function (lora, index) {
    var id = String(2 + index);
    graph[id] = { class_type:'LoraLoader', inputs:{ model:[model, 0], clip:[clip, 1], lora_name:lora.file, strength_model:lora.strength, strength_clip:lora.strength } };
    model = id; clip = id;
  });
  var positive = '4'; var negative = '5'; var latent = '6'; var sample = '7'; var decoded = '8'; var output = '10';
  graph[positive] = { class_type:'CLIPTextEncode', inputs:{ clip:[clip, 1], text:input.cleanPrompt || input.prompt.replace(/<lora:[^>]+>/gi, '').trim() } };
  graph[negative] = { class_type:'CLIPTextEncode', inputs:{ clip:[clip, 1], text:input.negative.replace(/<lora:[^>]+>/gi, '').trim() } };
  graph[latent] = { class_type:'EmptyLatentImage', inputs:{ width:input.width, height:input.height, batch_size:1 } };
   graph[sample] = { class_type:'KSampler', inputs:{ model:[model, 0], positive:[positive, 0], negative:[negative, 0], latent_image:[latent, 0], seed:input.seed, steps:input.steps, cfg:input.cfg, sampler_name:SAMPLERS[input.sampler].sampler, scheduler:input.scheduler, denoise:1 } };
   var finalSamples = [sample, 0];
   if (input.hiresFix && input.comfyHires) {
     // 2026-08-18 真 super-res 链路：ESRGAN（Remacri）像素级放大 + 缩到目标尺寸
     // + VAE 编码 + 低 denoise 二阶段精修；替代潜空间 nearest-exact 二阶段
     // （动漫线条/脸部更锐利，无块状伪影）。
     if (input.superResModel) {
       var targetW = Math.round(input.width * input.hiresScale / 8) * 8;
       var targetH = Math.round(input.height * input.hiresScale / 8) * 8;
       graph['11'] = { class_type:'UpscaleModelLoader', inputs:{ model_name:input.superResModel } };
       graph['12'] = { class_type:'VAEDecode', inputs:{ samples:finalSamples, vae:[vae, 2] } };
       graph['13'] = { class_type:'ImageUpscaleWithModel', inputs:{ upscale_model:['11', 0], image:['12', 0] } };
       graph['14'] = { class_type:'ImageScale', inputs:{ image:['13', 0], upscale_method:'lanczos', width:targetW, height:targetH, crop:'disabled' } };
       graph['15'] = { class_type:'VAEEncode', inputs:{ pixels:['14', 0], vae:[vae, 2] } };
       graph['16'] = { class_type:'KSampler', inputs:{ model:[model, 0], positive:[positive, 0], negative:[negative, 0], latent_image:['15', 0], seed:input.seed, steps:input.hiresSteps, cfg:input.cfg, sampler_name:SAMPLERS[input.sampler].sampler, scheduler:input.scheduler, denoise:input.denoisingStrength } };
       finalSamples = ['16', 0];
     } else {
       graph['11'] = { class_type:'LatentUpscaleBy', inputs:{ samples:finalSamples, upscale_method:'nearest-exact', scale_by:input.hiresScale } };
       graph['12'] = { class_type:'KSampler', inputs:{ model:[model, 0], positive:[positive, 0], negative:[negative, 0], latent_image:['11', 0], seed:input.seed, steps:input.hiresSteps, cfg:input.cfg, sampler_name:SAMPLERS[input.sampler].sampler, scheduler:input.scheduler, denoise:input.denoisingStrength } };
       finalSamples = ['12', 0];
     }
   }
   graph[decoded] = { class_type:'VAEDecode', inputs:{ samples:finalSamples, vae:[vae, 2] } };
  graph[output] = { class_type:'SaveImage', inputs:{ images:[decoded, 0], filename_prefix:OUTPUT_PREFIX } };
  return graph;
}

function requestJson(config, hostKey, method, pathname, body, timeout) {
  return new Promise(function (resolve, reject) {
    var target; try { target = new URL(config[hostKey]); } catch (e) { reject(error(502, 'UPSTREAM_CONFIG_INVALID', '上游地址无效')); return; }
    target.pathname = pathname; target.search = '';
    var payload = body == null ? null : Buffer.from(JSON.stringify(body));
    var client = target.protocol === 'https:' ? https : http;
    var req = client.request({ protocol:target.protocol, hostname:target.hostname, port:target.port, path:target.pathname, method:method, timeout:timeout || 10000,
      headers:Object.assign({ Accept:'application/json' }, payload ? { 'Content-Type':'application/json', 'Content-Length':payload.length } : {}) }, function (res) {
      // 2026-08-16 审计：响应体必须设上限，防止上游（本机 SD）返回超大 JSON 时
      // 网关内存被无界撑高（之前 chunks 无限累加）；超过即掐断并按错误处理。
      var chunks = []; var size = 0;
      res.on('data', function (c) {
        size += c.length;
        if (size > MAX_UPSTREAM_JSON_BYTES) {
          req.destroy(error(502, 'UPSTREAM_RESPONSE_TOO_LARGE', '上游响应过大'));
          return;
        }
        chunks.push(c);
      });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8'); var data; try { data = raw ? JSON.parse(raw) : null; } catch (e) { reject(error(502, 'INVALID_UPSTREAM_RESPONSE', '上游返回无效 JSON')); return; }
        if (res.statusCode < 200 || res.statusCode >= 300) { reject(error(502, 'UPSTREAM_ERROR', '上游请求失败', { status:res.statusCode, data:data })); return; }
        resolve(data);
      });
    });
    req.on('error', function (e) { reject(error(502, 'UPSTREAM_UNAVAILABLE', e.message)); });
    req.on('timeout', function () { req.destroy(error(504, 'UPSTREAM_TIMEOUT', '上游请求超时')); });
    if (payload) req.write(payload); req.end();
  });
}

// 探测结果短 TTL 缓存 + 在途合并（2026-08-21 性能审计 #3）：/api/generation/status
// 与每次提交任务都调用本探测；五个请求已并行化，但无缓存时提交仍要多等一个
// 并行探测往返。默认缓存 3s；**提交路径必须传 {fresh:true} 绕过缓存**——上游刚
// 下线时路由决策必须立刻看到（否则 faceDetailer 任务会被送进注定失败的 WebUI
// 异步失败，而不是立即 503，见 test-generation-routes.js 的离线路径断言）。
var WEBUI_PROBE_TTL_MS = 3000;
var webuiProbeCache = { key:'', at:0, value:null, pending:null };

function probeWebUI(config, options) {
  var key = String(config.SD_HOST || '');
  var now = Date.now();
  if (webuiProbeCache.key === key && webuiProbeCache.pending) return webuiProbeCache.pending;
  if (!(options && options.fresh)
    && webuiProbeCache.key === key && webuiProbeCache.value
    && now - webuiProbeCache.at < WEBUI_PROBE_TTL_MS) {
    return Promise.resolve(webuiProbeCache.value);
  }
  var pending = doProbeWebUI(config).then(function (value) {
    webuiProbeCache.key = key;
    webuiProbeCache.at = Date.now();
    webuiProbeCache.value = value;
    webuiProbeCache.pending = null;
    return value;
  });
  webuiProbeCache.key = key;
  webuiProbeCache.pending = pending;
  return pending;
}

async function doProbeWebUI(config) {
  try {
    // 五个端点并行探测（对照 control.js /api/sd-status 的并行口径）；options 是
    // 唯一的硬依赖，其余失败按空列表降级——与原串行版本行为一致。
    var probeResults = await Promise.all([
      requestJson(config, 'SD_HOST', 'GET', '/sdapi/v1/options', null, 3000),
      requestJson(config, 'SD_HOST', 'GET', '/sdapi/v1/samplers', null, 3000).catch(function () { return []; }),
      requestJson(config, 'SD_HOST', 'GET', '/sdapi/v1/schedulers', null, 3000).catch(function () { return []; }),
      requestJson(config, 'SD_HOST', 'GET', '/sdapi/v1/upscalers', null, 3000).catch(function () { return []; }),
      requestJson(config, 'SD_HOST', 'GET', '/sdapi/v1/sd-models', null, 3000).catch(function () { return []; }),
    ]);
    var options = probeResults[0];
    var samplerList = probeResults[1];
    var schedulerList = probeResults[2];
    var upscalerList = probeResults[3];
    var models = probeResults[4];
     var catalog = Array.isArray(models) ? models : [];
     var match = catalog.find(function (item) {
       var values = [item && item.filename, item && item.title, item && item.model_name, item && item.name].filter(Boolean).map(String);
       return values.some(isWaiCheckpoint);
     });
     var checkpoint = match ? String(match.title || match.filename || match.model_name || match.name) : '';
     var current = options && options.sd_model_checkpoint ? String(options.sd_model_checkpoint) : '';
      var exact = Boolean(match) && isWaiCheckpoint(current) && isWaiCheckpoint(checkpoint);
     return {
       online:true,
       waiAvailable:Boolean(match),
       checkpoint:exact ? checkpoint : '',
      samplers:Array.isArray(samplerList) ? samplerList.map(function (item) { return item && (item.name || item.label); }).filter(Boolean) : [],
      schedulers:Array.isArray(schedulerList) ? schedulerList.map(function (item) { return item && (item.name || item.label); }).filter(Boolean) : [],
      upscalers:Array.isArray(upscalerList) ? upscalerList.map(function (item) { return item && (item.name || item.label); }).filter(Boolean) : [],
       models:catalog.map(function (item) { return item && (item.title || item.filename || item.model_name || item.name); }).filter(Boolean)
    };
  } catch (e) {
    return { online:false, waiAvailable:false, checkpoint:'', samplers:[], schedulers:[], upscalers:[], models:[] };
  }
}

function publicJob(job) {
  return { id:job.id, status:job.status, provider:job.provider, seed:job.input.seed, resultAvailable:Boolean(job.result), resultUrl:job.result ? '/api/generation/jobs/' + encodeURIComponent(job.id) + '/result' : null, metadata:Object.assign({}, job.metadata, { provider:job.provider }), error:job.error || null, code:job.code || null };
}

function createWebUIJob(config, input, ownerId) {
  var id = crypto.randomBytes(18).toString('hex');
   var webJob = { id:id, owner:ownerId, input:input, provider:'webui', status:'running', result:null, error:null, code:null, metadata:{ engine:'sd', provider:'webui', id:id, modelId:input.modelId, profileId:input.profile, loras:freezeLoras(input.loras), loraId:input.loras[0] && input.loras[0].id || null, loraStrength:input.loras[0] && input.loras[0].strength || null, width:input.width, height:input.height, steps:input.steps, cfg:input.cfg, sampler:input.sampler, scheduler:input.scheduler, seed:input.seed, hiresFix:Boolean(input.hiresFix), hiresUpscaler:input.hiresFix ? input.hiresUpscaler : null, hiresScale:input.hiresFix ? input.hiresScale : null } };
   var payload = { prompt:input.prompt, negative_prompt:input.negative, width:input.width, height:input.height, cfg_scale:input.cfg, steps:input.steps, sampler_name:input.sampler, seed:input.seed, batch_size:1, n_iter:1, send_images:true, save_images:false,
     override_settings:{ sd_model_checkpoint:CHECKPOINT }, override_settings_restore_afterwards:true };
  if (input.webuiScheduler) payload.scheduler = input.webuiScheduler;
  if (input.hiresFix) { payload.enable_hr=true; payload.hr_scale=input.hiresScale; payload.hr_upscaler=input.hiresUpscaler; payload.hr_second_pass_steps=input.hiresSteps; payload.denoising_strength=input.denoisingStrength; }
  if (input.faceDetailer) payload.alwayson_scripts = { ADetailer:{ args:[true, false, { ad_model:'face_yolov8s.pt', ad_prompt:'detailed eyes, clean face, character-accurate facial features', ad_negative_prompt:'deformed face, asymmetrical eyes, cross-eyed', is_api:true }, { ad_model:'hand_yolov8n.pt', ad_prompt:'detailed hands, five fingers, natural fingers', ad_negative_prompt:'extra fingers, missing fingers, fused fingers, malformed hands', is_api:true }] } };
  void requestJson(config, 'SD_HOST', 'POST', '/sdapi/v1/txt2img', payload, 20 * 60 * 1000).then(function (result) {
    if (webJob.status === 'cancelled') return;
    if (!result || !Array.isArray(result.images) || !result.images[0]) throw error(502, 'SD_NO_IMAGE', 'WebUI 未返回图片');
    webJob.result = Buffer.from(String(result.images[0]), 'base64'); webJob.mime='image/png'; webJob.status='succeeded';
     var info = result.info;
     if (typeof info === 'string') { try { info = JSON.parse(info); } catch (ignore) { info = null; } }
     webJob.metadata.seed = info && info.seed || input.seed;
  }).catch(function (e) { if (webJob.status !== 'cancelled') { webJob.status='failed'; webJob.error=e.detail && e.detail.data && e.detail.data.error ? String(e.detail.data.error) : e.message; webJob.code=e.code || 'WEBUI_FAILED'; } });
  return webJob;
}

function createGenerationRouter(config, dependencies) {
  dependencies = dependencies || {};
  var comfy = dependencies.waiComfy || anima.createAnimaService(config, { buildWorkflow:buildWorkflow, validateResources:function (input) { validateWaiResources(config, input); }, outputPrefix:OUTPUT_PREFIX, outputNodeId:'10', mediaNamespace:'wai', engine:'sd', routeBase:'/api/generation' });
  var jobs = new Map();
  // 2026-08-16 审计：WebUI 出图任务此前只进 Map 从不回收（内存无上限泄漏）。
  // 统一走 trackWebJob：TTL 后删除（含释放 result Buffer），与 Comfy 分支的
  // gcTimer 对齐；结果送达后 result=null 已由取图端点处理。
  function trackWebJob(webJob) {
    jobs.set(webJob.id, webJob);
    var timer = setTimeout(function () {
      if (webJob.result) webJob.result = null;
      jobs.delete(webJob.id);
    }, WEB_JOB_TTL_MS);
    if (typeof timer.unref === 'function') timer.unref();
    return webJob;
  }
  var router = express.Router();
  var limit = security.rateLimit({ capacity:12, refillMs:5000, label:'WAI 出图' });

  function status() {
      return { online:false, provider:null, webuiOnline:false, comfyFallbackOnline:false, checkpoint:'', samplers:[], schedulers:[], models:[], loras:Object.keys(LORAS).map(function (id) { return { id:id, character:LORAS[id].character, available:safeComfyResource(config, 'loras', LORAS[id].file) }; }), capabilities:{ basic:false, hires:false, hiresUpscalers:[], faceDetailer:false }, pending:comfy.status().pending, maxPending:MAX_PENDING };
  }
  router.get('/api/generation/status', async function (req, res) {
    var webui = await probeWebUI(config);
    var comfyOnline = await comfy.probe().catch(function () { return false; });
    var data = status();
    data.online = webui.online || comfyOnline;
    data.webuiOnline = webui.online;
    data.comfyFallbackOnline = comfyOnline;
      var comfyModelAvailable = safeComfyResource(config, 'checkpoints', CHECKPOINT);
      data.checkpoint = webui.checkpoint || (comfyOnline && comfyModelAvailable ? CHECKPOINT : '');
      data.webuiOnline = Boolean(webui.online && webui.waiAvailable);
      data.comfyFallbackOnline = Boolean(comfyOnline && comfyModelAvailable);
      data.online = data.webuiOnline || data.comfyFallbackOnline;
      data.provider = data.comfyFallbackOnline ? 'comfy' : (data.webuiOnline ? 'webui' : null);
      var autoHiresAvailable = data.comfyFallbackOnline || (data.webuiOnline && (webui.upscalers.length === 0 || webui.upscalers.indexOf('R-ESRGAN 4x+ Anime6B') !== -1));
      var comfySuperRes = availableSuperRes(config);
      var hiresUpscalers = [];
      if (autoHiresAvailable) hiresUpscalers.push('Auto');
      if (data.comfyFallbackOnline && comfySuperRes) hiresUpscalers.push('Remacri');
      if (data.comfyFallbackOnline || webui.upscalers.indexOf('Latent') !== -1) hiresUpscalers.push('Latent','Latent (nearest-exact)');
      if (data.webuiOnline) webui.upscalers.forEach(function (name) { if (WEBUI_UPSCALERS.has(name) && hiresUpscalers.indexOf(name) === -1) hiresUpscalers.push(name); });
      data.capabilities = { basic:Boolean(data.comfyFallbackOnline || data.webuiOnline), hires:Boolean(data.comfyFallbackOnline || data.webuiOnline), hiresUpscalers:hiresUpscalers, faceDetailer:Boolean(data.webuiOnline), superResModel:data.comfyFallbackOnline ? comfySuperRes : null };
    data.samplers = webui.samplers;
    data.schedulers = webui.schedulers;
    data.models = webui.models;
    res.setHeader('Cache-Control', 'no-store');
    return envelope.ok(res, data);
  });
  router.post('/api/generation/jobs', limit, express.json({ limit:MAX_BODY }), async function (req, res) {
    var input; try { input = validate(req.body); } catch (e) { return envelope.fail(res, e.status || 400, e.message, { code:e.code }); }
    // fresh：路由决策不能吃缓存——上游刚下线时必须立即失败而不是送进注定失败的分支
    var webui = await probeWebUI(config, { fresh:true });
    var comfyOnline = await comfy.probe().catch(function () { return false; });
    var webuiSupportsSampler = webui.samplers.length === 0 || webui.samplers.indexOf(input.sampler) !== -1;
    var webuiSupportsScheduler = !input.webuiScheduler || webui.schedulers.length === 0 || webui.schedulers.indexOf(input.webuiScheduler) !== -1 || webui.schedulers.indexOf(input.webuiScheduler === 'karras' ? 'Karras' : input.webuiScheduler) !== -1;
    var webuiSupportsAnimeUpscaler = webui.upscalers.length === 0 || webui.upscalers.indexOf('R-ESRGAN 4x+ Anime6B') !== -1;
    var webuiSupportsRequestedUpscaler = !input.hiresFix || input.autoHires || webui.upscalers.length === 0 || webui.upscalers.indexOf(input.hiresUpscaler) !== -1;
    var comfyUsable = comfyOnline && comfyResourcesAvailable(config, input);
    var webuiUsable = webui.online && webui.waiAvailable;
      if (input.autoHires && webuiUsable && webuiSupportsSampler && webuiSupportsScheduler && webuiSupportsAnimeUpscaler) {
        var animeInput = Object.assign({}, input, { autoHires:false, hiresUpscaler:'R-ESRGAN 4x+ Anime6B', comfyHires:false, comfyUnsupported:true });
        var animeJob = createWebUIJob(config, animeInput, owner(req)); trackWebJob(animeJob);
        return res.status(202).json({ ok:true, job:publicJob(animeJob) });
      }
      if (comfyUsable && !input.faceDetailer && !input.comfyUnsupported) {
       var superResModel = availableSuperRes(config);
       // Auto 在纯 Comfy 侧：有 ESRGAN 模型走真超分，否则回落潜空间 Latent。
       var preferredInput = input.autoHires
         ? (superResModel
             ? Object.assign({}, input, { autoHires:false, hiresUpscaler:'Remacri', superResModel:superResModel, comfyHires:true, comfyUnsupported:false })
             : Object.assign({}, input, { autoHires:false, hiresUpscaler:'Latent (nearest-exact)', comfyHires:true, comfyUnsupported:false }))
         : (input.superResWanted
             ? (superResModel
                 ? Object.assign({}, input, { superResModel:superResModel, comfyHires:true, comfyUnsupported:false })
                 : null)
             : input);
       if (!preferredInput) {
         return envelope.fail(res, 503, 'Comfy 本地未安装 ESRGAN 超分模型（Remacri / R-ESRGAN 4x+），请改用 WebUI 或 Latent', { code:'SUPER_RES_MODEL_UNAVAILABLE' });
       }
       var preferred; try { preferred = comfy.create(preferredInput, owner(req)); await comfy.submit(preferred); } catch (e) {
         if (preferred && preferred.upstreamId) return envelope.fail(res, 502, 'ComfyUI 已接受任务但提交响应异常', { code:e.code || 'COMFY_SUBMIT_UNCERTAIN' });
         if (preferred) comfy.cancel(preferred);
         return envelope.fail(res, 502, 'ComfyUI 提交失败', { code:e.code || 'COMFY_SUBMIT_FAILED' });
       }
       return res.status(202).json({ ok:true, job:comfy.publicJob(preferred) });
     }
      if (webuiUsable && (!webuiSupportsSampler || !webuiSupportsScheduler)) {
        return envelope.fail(res, 400, 'WebUI 不支持当前采样器或调度器', { code:'WEBUI_CAPABILITY_UNAVAILABLE' });
      }
      if (webuiUsable && !webuiSupportsRequestedUpscaler) {
        return envelope.fail(res, 400, 'WebUI 未安装所选放大器', { code:'WEBUI_UPSCALER_UNAVAILABLE' });
      }
      if (input.autoHires && webuiUsable) {
        var directInput = Object.assign({}, input, { autoHires:false, hiresFix:false, comfyHires:false, comfyUnsupported:false });
        var directJob = createWebUIJob(config, directInput, owner(req)); trackWebJob(directJob);
        return res.status(202).json({ ok:true, job:publicJob(directJob) });
      }
      if (webuiUsable) {
      var webJob = createWebUIJob(config, input, owner(req)); trackWebJob(webJob);
      return res.status(202).json({ ok:true, job:publicJob(webJob) });
    }
     if (input.faceDetailer) {
       return envelope.fail(res, 503, '当前功能需要包含 WAI checkpoint 的 SD WebUI / reForge', { code:'WEBUI_RESOURCES_UNAVAILABLE' });
     }
    var provider = 'comfy';
     if (!comfyUsable) return envelope.fail(res, 503, 'WAI checkpoint 或角色 LoRA 资源不可用，未选择 ComfyUI', { code:'COMFY_RESOURCES_UNAVAILABLE' });
     if (input.comfyUnsupported) return envelope.fail(res, 503, '当前请求不符合 ComfyUI 能力，请启用 WebUI 或改用 Latent hires', { code:'COMFY_CAPABILITY_UNAVAILABLE' });
    if (provider === 'comfy') {
      var job; try { job = comfy.create(input, owner(req)); await comfy.submit(job); } catch (e) {
        if (job && job.upstreamId) return envelope.fail(res, 502, 'ComfyUI 已接受任务但提交响应异常', { code:e.code || 'COMFY_SUBMIT_UNCERTAIN' });
       if (job) void comfy.cancel(job);
        return envelope.fail(res, 502, 'ComfyUI fallback 提交失败', { code:e.code || 'COMFY_SUBMIT_FAILED' });
      }
      return res.status(202).json({ ok:true, job:comfy.publicJob(job) });
    }
  });
  router.get('/api/generation/jobs/:id', function (req, res) { var comfyJob = comfy.get(req.params.id, owner(req)); var job = comfyJob || jobs.get(req.params.id); if (!job || job.owner !== owner(req)) return envelope.fail(res, 404, '任务不存在', { code:'JOB_NOT_FOUND' }); res.setHeader('Cache-Control','no-store'); return envelope.ok(res, { job:comfyJob ? comfy.publicJob(job) : publicJob(job) }); });
  router.get('/api/generation/jobs/:id/result', function (req, res) { var comfyJob = comfy.get(req.params.id, owner(req)); var job = comfyJob || jobs.get(req.params.id); if (!job || job.owner !== owner(req) || job.status !== 'succeeded' || !job.result) return envelope.fail(res, 404, '结果不存在', { code:'RESULT_NOT_FOUND' }); if (!comfyJob) { res.setHeader('Content-Type', job.mime); res.setHeader('Content-Length', String(job.result.length)); res.end(job.result); job.result=null; return; } var root = path.resolve((config.RUNTIME && config.RUNTIME.outputs) || path.join(config.RUNTIME_ROOT, 'outputs'), 'wai'); var file = path.resolve(job.result.path); if (file.indexOf(root + path.sep) !== 0) return envelope.fail(res, 404, '结果不存在', { code:'RESULT_NOT_FOUND' }); res.setHeader('Content-Type', job.result.mime); res.setHeader('Content-Length', String(job.result.bytes)); var stream = fs.createReadStream(file); stream.on('error', function () { if (!res.headersSent) envelope.fail(res, 404, '结果不存在', { code:'RESULT_NOT_FOUND' }); else res.destroy(); }); res.once('finish', function () { comfy.consumeResult(job); }); stream.pipe(res); });
  router.delete('/api/generation/jobs/:id', async function (req, res) { var job = comfy.get(req.params.id, owner(req)); if (job) { await comfy.cancel(job); return envelope.ok(res, { job:comfy.publicJob(job) }); } var webJob=jobs.get(req.params.id); if (!webJob || webJob.owner !== owner(req)) return envelope.fail(res, 404, '任务不存在', { code:'JOB_NOT_FOUND' }); if (webJob.status === 'running') await requestJson(config, 'SD_HOST', 'POST', '/sdapi/v1/interrupt', {}, 10000).catch(function () {}); webJob.status='cancelled'; webJob.code='WEBUI_CANCELLED'; return envelope.ok(res, { job:publicJob(webJob) }); });
  return { router:router, service:comfy, close:comfy.close };
}

module.exports = { createGenerationRouter:createGenerationRouter, validateInput:validate, buildWorkflow:buildWorkflow, normalizeCheckpointName:normalizeCheckpointName, isWaiCheckpoint:isWaiCheckpoint, availableSuperRes:availableSuperRes, constants:{ CHECKPOINT:CHECKPOINT, LORAS:LORAS, SAMPLERS:SAMPLERS, COMFY_SUPERRES_FILES:COMFY_SUPERRES_FILES } };
