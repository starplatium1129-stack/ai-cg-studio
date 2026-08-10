'use strict';

var crypto = require('crypto');
var express = require('express');
var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');
var security = require('../server/security');
var envelope = require('../server/http-envelope');

var MAX_BODY = '64kb';
var MAX_PENDING = 4;
var MAX_PROMPT_LENGTH = 12000;
var MAX_NEGATIVE_LENGTH = 8000;
var MAX_IMAGE_BYTES = 16 * 1024 * 1024;
var JOB_TIMEOUT_MS = 10 * 60 * 1000;
var POLL_INTERVAL_MS = 500;
var JOB_TTL_MS = 30 * 60 * 1000;
var CANCEL_POLL_INTERVAL_MS = 250;
var CANCEL_TIMEOUT_MS = 30 * 1000;
var OUTPUT_NODE_ID = '10';
var OUTPUT_FILENAME_PREFIX = 'anima_app';

var MODELS = Object.freeze({
  'anima-base-v1.0': { file:'anima-base-v1.0.safetensors', label:'Anima Base v1.0', family:'anima', profileId:'anima_base_v10', steps:30, cfg:4.5, sampler:'er_sde', scheduler:'sgm_uniform', sizes:['832x1216','1024x1024','1216x832'] },
  'anima-aesthetic-v1.1': { file:'anima-aesthetic-v1.1.safetensors', label:'Anima Aesthetic v1.1', family:'anima', profileId:'anima_aesthetic_v11', steps:30, cfg:4.5, sampler:'er_sde', scheduler:'sgm_uniform', sizes:['832x1216','1024x1024','1216x832'], noLora:true },
  'krea2-turbo-fp8': { file:'krea2_turbo_fp8_scaled.safetensors', label:'Krea 2 Turbo', family:'krea2', profileId:'krea2_turbo_fp8', steps:8, cfg:1, sampler:'euler', scheduler:'simple', sizes:['1024x1024','1024x1536','1536x1024'], rebalance:{ preset:'standard', multiplier:1.1, normalizeTaps:false } }
});

var PROFILE_BY_MODEL = Object.freeze({
  'anima-base-v1.0':'anima_base_v10',
  'anima-aesthetic-v1.1':'anima_aesthetic_v11',
  'krea2-turbo-fp8':'krea2_turbo_fp8'
});

var LORAS = Object.freeze({
  L_NENE_V20_ANIMA: {
    file:'ayachi_nene_v20_anima.safetensors',
    name:'ayachi_nene_v20_anima',
    character:'nene',
    compatibleModels:['anima-base-v1.0', 'anima-aesthetic-v1.1'],
    minStrength:0.65,
    maxStrength:1
  },
  L_NENE_V20B_ANIMA: {
    file:'ayachi_nene_v20_anima_scientific_b_e16.safetensors',
    name:'ayachi_nene_v20_anima_scientific_b_e16',
    character:'nene',
    compatibleModels:['anima-base-v1.0', 'anima-aesthetic-v1.1'],
    minStrength:0.65,
    maxStrength:1
  },
  L_NAT_V19_ANIMA_PREVIEW: {
    file:'shiki_natsume_v19_anima_preview.safetensors',
    name:'shiki_natsume_v19_anima_preview',
    character:'natsume',
    preview:true,
    validation:'experimental_preview',
    compatibleModels:['anima-base-v1.0', 'anima-aesthetic-v1.1'],
    minStrength:0.65,
    maxStrength:1
  }
});

var CHARACTERS = Object.freeze({
  nene: { id:'nene', label:'绫地宁宁', loraId:'L_NENE_V20B_ANIMA' },
  natsume: { id:'natsume', label:'四季夏目', loraId:'L_NAT_V19_ANIMA_PREVIEW', preview:true, validation:'experimental_preview' }
});

var ALLOWED_INPUT_KEYS = new Set([
  'prompt', 'negative', 'modelId', 'loraId', 'loraStrength',
  'width', 'height', 'steps', 'cfg', 'seed', 'character'
]);

function serviceError(status, code, message, detail) {
  var error = new Error(message);
  error.status = status;
  error.code = code;
  error.detail = detail;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateNumber(value, name, min, max, integer) {
  if (!finiteNumber(value) || (integer && !Number.isInteger(value)) || value < min || value > max) {
    throw serviceError(400, 'INVALID_PARAMETER', name + ' 超出允许范围');
  }
  return value;
}

function decodePathValue(value) {
  var decoded = String(value || '');
  for (var i = 0; i < 3; i += 1) {
    var next;
    try { next = decodeURIComponent(decoded); } catch (error) { throw serviceError(400, 'INVALID_RESULT', '结果路径编码无效'); }
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function validateInput(body, expectedFamily) {
  if (!isPlainObject(body)) throw serviceError(400, 'INVALID_BODY', '请求体必须是 JSON 对象');

  Object.keys(body).forEach(function (key) {
    if (!ALLOWED_INPUT_KEYS.has(key)) {
      throw serviceError(400, 'UNKNOWN_PARAMETER', '不支持的参数：' + key);
    }
  });

  var required = ['prompt', 'modelId', 'width', 'height'];
  required.forEach(function (key) {
    if (!hasOwn(body, key)) throw serviceError(400, 'MISSING_PARAMETER', '缺少参数：' + key);
  });

  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_LENGTH) {
    throw serviceError(400, 'INVALID_PARAMETER', 'prompt 需为 1—' + MAX_PROMPT_LENGTH + ' 字符');
  }
  if (body.negative !== undefined && (typeof body.negative !== 'string' || body.negative.length > MAX_NEGATIVE_LENGTH)) {
    throw serviceError(400, 'INVALID_PARAMETER', 'negative 需为不超过 ' + MAX_NEGATIVE_LENGTH + ' 字符的文本');
  }
  var model = MODELS[body.modelId];
  if (!model) throw serviceError(400, 'UNKNOWN_MODEL', '未知生成模型');
  if (expectedFamily && model.family !== expectedFamily) throw serviceError(400, 'WRONG_ROUTE_FAMILY', '请求路径与模型 family 不匹配');
  var expectedProfile = PROFILE_BY_MODEL[body.modelId];
  var lora = body.loraId ? LORAS[body.loraId] : null;
  if (model.family === 'krea2') {
    if (body.loraId || body.loraStrength !== undefined || (body.negative && String(body.negative).trim())) throw serviceError(400, 'KREA_UNSUPPORTED_PARAMETER', 'Krea 2 不接受 LoRA 或负向 Prompt');
  } else if (model.noLora === true && !body.loraId) {
    // 无 LoRA 创作模式：loraId/character 缺省或 character=null 即放行。
    // 若调用方提供了 lora，则落到下面的原校验，UNKNOWN_LORA /
    // INCOMPATIBLE_MODEL_LORA / INCOMPATIBLE_CHARACTER 全部保持生效。
    // loraStrength 无 lora 时是自相矛盾参数，直接拒绝；非空 character 不当作
    // 身份锁定元数据接受（fail closed，避免客户端绕过 LoRA 却声称角色身份）。
    if (body.loraStrength !== undefined) {
      throw serviceError(400, 'INVALID_PARAMETER', 'no-LoRA 模式不接受 loraStrength');
    }
    if (body.character !== undefined && body.character !== null) {
      throw serviceError(400, 'INVALID_PARAMETER', 'no-LoRA 模式不接受角色身份字段');
    }
  } else {
    if (!lora) throw serviceError(400, 'UNKNOWN_LORA', '未知 Anima LoRA');
    if (lora.compatibleModels.indexOf(body.modelId) === -1) throw serviceError(400, 'INCOMPATIBLE_MODEL_LORA', '底模与 LoRA 组合不受支持');
    var character = CHARACTERS[body.character];
    if (!character || character.loraId !== body.loraId) throw serviceError(400, 'INCOMPATIBLE_CHARACTER', '角色与 LoRA 组合不受支持');
  }
  var loraStrength = lora ? validateNumber(body.loraStrength, 'loraStrength', lora.minStrength, lora.maxStrength, false) : null;
  var width = validateNumber(body.width, 'width', 512, 1536, true);
  var height = validateNumber(body.height, 'height', 512, 1536, true);
  if (model.sizes.indexOf(width + 'x' + height) === -1) {
    throw serviceError(400, 'INVALID_PARAMETER', '不支持的输出尺寸');
  }
  if (model.family !== 'krea2' && width * height > 1_500_000) throw serviceError(400, 'INVALID_PARAMETER', '输出尺寸超过允许面积');
  var steps;
  var cfg;
  if (model.family === 'krea2') {
    if (body.steps !== undefined && body.steps !== 8) throw serviceError(400, 'INVALID_PARAMETER', 'Krea 2 steps 固定为 8');
    if (body.cfg !== undefined && body.cfg !== 1) throw serviceError(400, 'INVALID_PARAMETER', 'Krea 2 CFG 固定为 1');
    steps = 8;
    cfg = 1;
  } else {
    steps = body.steps === undefined ? model.steps : validateNumber(body.steps, 'steps', 1, 60, true);
    cfg = body.cfg === undefined ? model.cfg : validateNumber(body.cfg, 'cfg', 0.5, 10, false);
  }
  var seed = body.seed === undefined
    ? crypto.randomInt(0, 2147483647)
    : validateNumber(body.seed, 'seed', 0, 9007199254740991, true);

  return {
    prompt:body.prompt.trim(),
    negative:model.family === 'krea2' ? '' : (typeof body.negative === 'string' ? body.negative.trim() : ''),
    family:model.family,
    profileId:expectedProfile,
    modelId:body.modelId,
    loraId:body.loraId,
    loraStrength:loraStrength,
    width:width,
    height:height,
    steps:steps,
    cfg:cfg,
    sampler:model.sampler,
    scheduler:model.scheduler,
    seed:seed,
    character:body.character
  };
}

function buildWorkflow(input) {
  var model = MODELS[input.modelId];
  if (model.family === 'krea2') {
    var rebalance = model.rebalance;
    var workflow = {
      '1': { class_type:'UNETLoader', inputs:{ unet_name:model.file, weight_dtype:'default' } },
      '2': { class_type:'CLIPLoader', inputs:{ clip_name:'qwen3vl_4b_fp8_scaled.safetensors', type:'krea2' } },
      '3': { class_type:'VAELoader', inputs:{ vae_name:'qwen_image_vae.safetensors' } },
      '4': { class_type:'CLIPTextEncode', inputs:{ clip:['2', 0], text:input.prompt } },
      '5': { class_type:'ConditioningZeroOut', inputs:{ conditioning:['4', 0] } },
      '6': { class_type:'EmptyLatentImage', inputs:{ width:input.width, height:input.height, batch_size:1 } },
      '8': { class_type:'VAEDecode', inputs:{ samples:['7', 0], vae:['3', 0] } },
      '10': { class_type:'SaveImage', inputs:{ images:['8', 0], filename_prefix:'creative_app' } }
    };
    var positive = ['4', 0];
    if (rebalance) {
      workflow['11'] = { class_type:'ConditioningKrea2Rebalance', inputs:{
        conditioning:['4', 0],
        preset:rebalance.preset || 'standard',
        multiplier:rebalance.multiplier || 1,
        per_layer_weights:'1.0,1.0,1.0,1.0,1.0,1.0,1.0,2.5,5.0,1.1,4.0,1.0',
        normalize_taps:Boolean(rebalance.normalizeTaps)
      } };
      positive = ['11', 0];
    }
    workflow['7'] = { class_type:'KSampler', inputs:{ model:['1', 0], positive:positive, negative:['5', 0], latent_image:['6', 0], seed:input.seed, steps:8, cfg:1, sampler_name:'euler', scheduler:'simple', denoise:1 } };
    return workflow;
  }
  if (model.noLora === true && !input.loraId) return {
    '1': { class_type:'UNETLoader', inputs:{ unet_name:model.file, weight_dtype:'default' } },
    '2': { class_type:'CLIPLoader', inputs:{ clip_name:'qwen_3_06b_base.safetensors', type:'qwen_image' } },
    '3': { class_type:'VAELoader', inputs:{ vae_name:'qwen_image_vae.safetensors' } },
    '4': { class_type:'CLIPTextEncode', inputs:{ clip:['2', 0], text:input.prompt } },
    '5': { class_type:'CLIPTextEncode', inputs:{ clip:['2', 0], text:input.negative } },
    '6': { class_type:'EmptyLatentImage', inputs:{ width:input.width, height:input.height, batch_size:1 } },
    '7': { class_type:'KSampler', inputs:{
      model:['1', 0],
      positive:['4', 0],
      negative:['5', 0],
      latent_image:['6', 0],
      seed:input.seed,
      steps:input.steps,
      cfg:input.cfg,
      sampler_name:input.sampler,
      scheduler:input.scheduler,
      denoise:1
    } },
    '8': { class_type:'VAEDecode', inputs:{ samples:['7', 0], vae:['3', 0] } },
    '10': { class_type:'SaveImage', inputs:{ images:['8', 0], filename_prefix:OUTPUT_FILENAME_PREFIX } }
  };
  var lora = LORAS[input.loraId];
  return {
    '1': { class_type:'UNETLoader', inputs:{ unet_name:model.file, weight_dtype:'default' } },
    '2': { class_type:'CLIPLoader', inputs:{ clip_name:'qwen_3_06b_base.safetensors', type:'qwen_image' } },
    '3': { class_type:'VAELoader', inputs:{ vae_name:'qwen_image_vae.safetensors' } },
    '4': { class_type:'LoraLoader', inputs:{
      model:['1', 0],
      clip:['2', 0],
      lora_name:lora.file,
      strength_model:input.loraStrength,
      strength_clip:input.loraStrength
    } },
    '5': { class_type:'CLIPTextEncode', inputs:{ clip:['4', 1], text:input.prompt } },
    '6': { class_type:'CLIPTextEncode', inputs:{ clip:['4', 1], text:input.negative } },
    '7': { class_type:'EmptyLatentImage', inputs:{ width:input.width, height:input.height, batch_size:1 } },
    '8': { class_type:'KSampler', inputs:{
      model:['4', 0],
      positive:['5', 0],
      negative:['6', 0],
      latent_image:['7', 0],
      seed:input.seed,
      steps:input.steps,
      cfg:input.cfg,
      sampler_name:input.sampler,
      scheduler:input.scheduler,
      denoise:1
    } },
    '9': { class_type:'VAEDecode', inputs:{ samples:['8', 0], vae:['3', 0] } },
     '10': { class_type:'SaveImage', inputs:{ images:['9', 0], filename_prefix:OUTPUT_FILENAME_PREFIX } }
  };
}

function requestComfy(config, method, pathname, body, timeoutMs, maxBytes) {
  return new Promise(function (resolve, reject) {
    var target;
    try { target = new URL(config.COMFY_HOST); } catch (error) {
      reject(serviceError(502, 'COMFY_CONFIG_INVALID', 'ComfyUI 地址无效'));
      return;
    }
    var rawPath = String(pathname || '/');
    var queryIndex = rawPath.indexOf('?');
    target.pathname = queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath;
    target.search = queryIndex >= 0 ? rawPath.slice(queryIndex) : '';
    var payload = body === undefined || body === null ? null : Buffer.from(JSON.stringify(body));
    var client = target.protocol === 'https:' ? https : http;
    var headers = { Accept:'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
    var request = client.request({
      protocol:target.protocol,
      hostname:target.hostname,
      port:target.port,
      method:method,
      path:target.pathname + target.search,
      headers:headers,
      timeout:timeoutMs || 10000
    }, function (response) {
      var chunks = [];
      var size = 0;
      response.on('data', function (chunk) {
        size += chunk.length;
        if (size > (maxBytes || 2 * 1024 * 1024)) {
          request.destroy(serviceError(502, 'COMFY_RESPONSE_TOO_LARGE', 'ComfyUI 响应过大'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', function () {
        resolve({ status:response.statusCode || 0, headers:response.headers, body:Buffer.concat(chunks) });
      });
    });
    request.on('error', function (error) {
      if (error && error.code) reject(error);
      else reject(serviceError(502, 'COMFY_UNAVAILABLE', error && error.message || 'ComfyUI 不可用'));
    });
    request.on('timeout', function () { request.destroy(serviceError(504, 'COMFY_TIMEOUT', 'ComfyUI 请求超时')); });
    if (payload) request.write(payload);
    request.end();
  });
}

async function requestComfyJson(config, method, pathname, body, timeoutMs) {
  var response = await requestComfy(config, method, pathname, body, timeoutMs, 2 * 1024 * 1024);
  var text = response.body.toString('utf8');
  var data = null;
  try { data = text ? JSON.parse(text) : null; } catch (error) {
    throw serviceError(502, 'COMFY_INVALID_RESPONSE', 'ComfyUI 返回了无效 JSON');
  }
  if (response.status < 200 || response.status >= 300) {
    throw serviceError(502, 'COMFY_UPSTREAM_ERROR', 'ComfyUI 请求失败', { upstreamStatus:response.status, upstream:data });
  }
  return data;
}

function requestOwner(req) {
  if (security.isDirectLocalRequest(req)) return 'local';
  var cookie = String(req.headers.cookie || '').match(/(?:^|;\s*)aics_token=([^;]+)/);
  var token = req.headers['x-token'] || cookie && cookie[1] || req.query && req.query.token || '';
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function publicJob(job, routeBase) {
  routeBase = routeBase || (job.input && job.input.family === 'krea2' ? '/api/creative' : '/api/anima');
  var result = {
    id:job.id,
    status:job.status,
    provider:job.provider || 'comfy',
    progress:job.status === 'succeeded' ? 1 : (job.status === 'running' ? 0.1 : 0),
    modelId:job.input.modelId,
    loraId:job.input.loraId,
    character:job.input.character,
    seed:job.input.seed,
    createdAt:job.createdAt,
    resultAvailable:Boolean(job.result && !job.resultConsumed),
    resultUrl:job.result && !job.resultConsumed ? routeBase + '/jobs/' + encodeURIComponent(job.id) + '/result' : null,
    metadata:Object.assign({}, job.metadata, {
      resultUrl:job.result && !job.resultConsumed ? routeBase + '/jobs/' + encodeURIComponent(job.id) + '/result' : null
    }),
    error:job.error || null,
    code:job.errorCode || null
  };
  return result;
}

function imageMimeAndExtension(contentType, body) {
  var mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (mime === 'image/png' && body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime:'image/png', extension:'png' };
  if (mime === 'image/jpeg' && body.length >= 3 && body.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return { mime:'image/jpeg', extension:'jpg' };
  if (mime === 'image/webp' && body.length >= 12 && body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP') return { mime:'image/webp', extension:'webp' };
  return null;
}

function validateImageReference(image, outputPrefix) {
  if (!isPlainObject(image)) throw serviceError(400, 'INVALID_RESULT', 'ComfyUI 图片描述无效');
  var type = String(image.type || 'output').toLowerCase();
  if (type !== 'output') throw serviceError(400, 'INVALID_RESULT', '只允许读取 output 图片');
  var filename = decodePathValue(image.filename);
  var subfolder = decodePathValue(image.subfolder || '');
  if (!filename || subfolder || filename !== path.basename(filename) || /[\\/\0]/.test(filename)) {
    throw serviceError(400, 'INVALID_RESULT', '结果路径不在应用允许范围内');
  }
  if (/^[a-z]:/i.test(filename) || /^\\\\|^\//.test(filename) || filename.split(/[\\/]/).some(function (part) { return part === '..' || part === '.'; })) {
    throw serviceError(400, 'INVALID_RESULT', '结果路径不安全');
  }
  if (/(?:^|[-_.])(input|temp|annotation|annotations|hash)(?:[-_.]|$)/i.test(filename)) {
    throw serviceError(400, 'INVALID_RESULT', '结果类型或路径不允许');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(?:png|jpe?g|webp)$/i.test(filename)) {
    throw serviceError(400, 'INVALID_RESULT', '结果必须是图片文件');
  }
  var prefix = outputPrefix || OUTPUT_FILENAME_PREFIX;
  if (!new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[_.-]|$)', 'i').test(filename)) {
    throw serviceError(400, 'INVALID_RESULT', '结果文件名前缀不受支持');
  }
  return { filename:filename, subfolder:'', type:'output' };
}

function ensureMediaRoot(config, namespace) {
  var outputs = config.RUNTIME && config.RUNTIME.outputs
    ? config.RUNTIME.outputs
    : path.join(config.RUNTIME_ROOT || path.join(config.ROOT_DIR, 'runtime'), 'outputs');
  var root = path.resolve(outputs, namespace || 'anima');
  fs.mkdirSync(root, { recursive:true });
  return root;
}

function safeMediaPath(root, file) {
  var resolvedRoot = path.resolve(root);
  var resolved = path.resolve(root, file);
  if (resolved.indexOf(resolvedRoot + path.sep) !== 0) return null;
  return resolved;
}

function cleanupMediaRoot(config, namespace) {
  var root = ensureMediaRoot(config, namespace);
  var entries = [];
  try { entries = fs.readdirSync(root); } catch (error) { return; }
  entries.forEach(function (name) {
    var target = safeMediaPath(root, name);
    if (!target) return;
    try {
      var stat = fs.lstatSync(target);
      if (stat.isDirectory()) fs.rmSync(target, { recursive:true, force:true });
      else fs.unlinkSync(target);
    } catch (error) {}
  });
}

async function materializeResult(config, job, image, options) {
  var reference = validateImageReference(image, options.outputPrefix);
  var query = '?filename=' + encodeURIComponent(reference.filename) + '&type=output';
  var response = await requestComfy(config, 'GET', '/view' + query, null, 20000, MAX_IMAGE_BYTES);
  if (response.status < 200 || response.status >= 300) throw serviceError(502, 'COMFY_RESULT_ERROR', 'ComfyUI 图片读取失败');
  var info = imageMimeAndExtension(response.headers['content-type'], response.body);
  if (!info || !response.body.length || response.body.length > MAX_IMAGE_BYTES) {
    throw serviceError(502, 'INVALID_RESULT', 'ComfyUI 返回的结果不是受支持的图片');
  }

  var root = ensureMediaRoot(config, options.mediaNamespace);
  var filename = job.id + '.' + info.extension;
  var target = safeMediaPath(root, filename);
  if (!target) throw serviceError(500, 'MEDIA_PATH_INVALID', '应用媒体路径无效');
  var temporary = target + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(temporary, response.body, { flag:'wx', mode:0o600 });
  try {
    fs.renameSync(temporary, target);
    var realRoot = fs.realpathSync(root);
    var realTarget = fs.realpathSync(target);
    if (realTarget.indexOf(realRoot + path.sep) !== 0) throw serviceError(500, 'MEDIA_PATH_INVALID', '应用媒体路径无效');
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (ignore) {}
    throw error;
  }
  return { path:target, mime:info.mime, bytes:response.body.length };
}

function createAnimaService(config, options) {
  options = options || {};
  var buildWorkflowForJob = options.buildWorkflow || buildWorkflow;
  var outputPrefix = options.outputPrefix || OUTPUT_FILENAME_PREFIX;
  var outputNodeId = options.outputNodeId || OUTPUT_NODE_ID;
  var mediaNamespace = options.mediaNamespace || 'anima';
  var engine = options.engine || 'anima';
  var provider = options.provider || 'comfy';
  var routeBase = options.routeBase || '/api/anima';
  var loraRoot = options.loraRoot || path.join(config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI'), 'ComfyUI', 'models', 'loras');
  var jobTtlMs = Number(options.jobTtlMs) > 0 ? Number(options.jobTtlMs) : JOB_TTL_MS;
  var cancelPollIntervalMs = Number(options.cancelPollIntervalMs) > 0
    ? Number(options.cancelPollIntervalMs) : CANCEL_POLL_INTERVAL_MS;
  var cancelTimeoutMs = Number(options.cancelTimeoutMs) > 0
    ? Number(options.cancelTimeoutMs) : CANCEL_TIMEOUT_MS;
  var jobs = new Map();
  var clientId = 'aics-' + crypto.randomBytes(12).toString('hex');
  var closed = false;

  cleanupMediaRoot(config, mediaNamespace);

  function pendingCount() {
    var count = 0;
    jobs.forEach(function (job) {
      if (job.status === 'queued' || job.status === 'running' || job.status === 'cancelling') count += 1;
    });
    return count;
  }

  function schedulePoll(job, delay) {
    if (closed || job.status === 'cancelled' || job.status === 'cancelling' || job.status === 'succeeded' || job.status === 'failed') return;
    if (job.pollTimer) clearTimeout(job.pollTimer);
    job.pollTimer = setTimeout(function () {
      job.pollTimer = null;
      poll(job);
    }, delay);
  }

  function failJob(job, error, fallbackCode) {
    if (job.status === 'cancelled' || job.status === 'cancelling') return;
    job.status = 'failed';
    job.errorCode = error && error.code || fallbackCode || 'ANIMA_FAILED';
    job.error = error && error.code === 'INVALID_RESULT'
      ? '生成结果未通过安全校验'
      : (error && error.status >= 500 ? 'Anima 上游暂不可用' : error && error.message || 'Anima 生成失败');
    if (job.pollTimer) { clearTimeout(job.pollTimer); job.pollTimer = null; }
  }

  function queueHasPrompt(items, promptId) {
    return Array.isArray(items) && items.some(function (item) {
      return Array.isArray(item) ? item[1] === promptId : item && item.prompt_id === promptId;
    });
  }

  async function requestTargetedCancel(job) {
    if (!job.upstreamId) return;
    try {
      // Current ComfyUI exposes a state-agnostic, prompt-id-scoped cancel API.
      await requestComfyJson(config, 'POST', '/api/jobs/' + encodeURIComponent(job.upstreamId) + '/cancel', null, 10000);
      return;
    } catch (error) {
      var upstreamStatus = error && error.detail && Number(error.detail.upstreamStatus);
      if (upstreamStatus !== 404 && upstreamStatus !== 405) throw error;
    }

    // Older ComfyUI can safely remove a specific pending prompt. Do not fall
    // back to a potentially global /interrupt implementation for running work.
    var queue = await requestComfyJson(config, 'GET', '/queue', null, 10000);
    var running = queue && (queue.queue_running || queue.running);
    var pending = queue && (queue.queue_pending || queue.pending);
    if (queueHasPrompt(pending, job.upstreamId)) {
      await requestComfyJson(config, 'POST', '/queue', { delete:[job.upstreamId] }, 10000);
      return;
    }
    if (queueHasPrompt(running, job.upstreamId)) {
      throw serviceError(502, 'COMFY_TARGETED_CANCEL_UNAVAILABLE', '当前 ComfyUI 不支持安全的定向运行中取消');
    }
  }

  function finishCancellation(job) {
    if (job.pollTimer) { clearTimeout(job.pollTimer); job.pollTimer = null; }
    job.status = 'cancelled';
    job.error = '任务已取消';
    job.errorCode = 'ANIMA_CANCELLED';
    removeResult(job);
  }

  function failCancellation(job) {
    if (job.pollTimer) { clearTimeout(job.pollTimer); job.pollTimer = null; }
    job.status = 'failed';
    job.error = '无法确认上游任务已安全取消';
    job.errorCode = 'ANIMA_CANCEL_FAILED';
    removeResult(job);
  }

  async function confirmCancellation(job) {
    if (closed || job.status !== 'cancelling' || !job.upstreamId) return;
    if (Date.now() > job.cancelDeadline) {
      failCancellation(job);
      return;
    }
    try {
      var queue = await requestComfyJson(config, 'GET', '/queue', null, 10000);
      var running = queue && (queue.queue_running || queue.running);
      var pending = queue && (queue.queue_pending || queue.pending);
      if (queueHasPrompt(running, job.upstreamId) || queueHasPrompt(pending, job.upstreamId)) {
        job.cancelChecks = 0;
        scheduleCancelPoll(job);
        return;
      }
      var history = await requestComfyJson(config, 'GET', '/history/' + encodeURIComponent(job.upstreamId), null, 10000);
      var entry = history && history[job.upstreamId];
      var status = entry && entry.status && entry.status.status_str;
      if (entry && status !== 'success' && status !== 'error' && status !== 'failed') {
        job.cancelChecks = 0;
        scheduleCancelPoll(job);
        return;
      }
      // Require two consecutive queue/history observations so an interrupt
      // acknowledgement is not mistaken for actual upstream termination.
      job.cancelChecks += 1;
      if (job.cancelChecks < 2) {
        scheduleCancelPoll(job);
        return;
      }
      finishCancellation(job);
    } catch (error) {
      job.cancelFailures += 1;
      scheduleCancelPoll(job);
    }
  }

  function scheduleCancelPoll(job) {
    if (closed || job.status !== 'cancelling') return;
    if (job.pollTimer) clearTimeout(job.pollTimer);
    job.pollTimer = setTimeout(function () {
      job.pollTimer = null;
      void confirmCancellation(job);
    }, cancelPollIntervalMs);
  }

  async function poll(job) {
    if (closed || job.status === 'cancelled' || !job.upstreamId) return;
    if (job.status === 'cancelling') {
      await confirmCancellation(job);
      return;
    }
    if (Date.now() > job.deadline) {
      failJob(job, serviceError(504, 'ANIMA_TIMEOUT', 'Anima 生成超时'), 'ANIMA_TIMEOUT');
      return;
    }
    try {
      var history = await requestComfyJson(config, 'GET', '/history/' + encodeURIComponent(job.upstreamId), null, 10000);
      var entry = history && history[job.upstreamId];
      if (!entry) {
        schedulePoll(job, POLL_INTERVAL_MS);
        return;
      }
      var status = entry.status && entry.status.status_str;
      if (status === 'error' || status === 'failed') {
        failJob(job, serviceError(502, 'COMFY_EXECUTION_FAILED', 'ComfyUI 执行失败'), 'COMFY_EXECUTION_FAILED');
        return;
      }
      if (status !== 'success') {
        schedulePoll(job, POLL_INTERVAL_MS);
        return;
      }
       var image = null;
       var output = entry.outputs && entry.outputs[outputNodeId];
       var images = output && output.images;
       if (Array.isArray(images) && images.length) image = images[0];
       if (!image) {
         failJob(job, serviceError(502, 'COMFY_NO_IMAGE', 'ComfyUI 未返回图片'), 'COMFY_NO_IMAGE');
        return;
      }
       job.result = await materializeResult(config, job, image, { outputPrefix:job.input.family === 'krea2' ? 'creative_app' : outputPrefix, mediaNamespace:mediaNamespace });
       job.resultConsumed = false;
      job.status = 'succeeded';
      job.error = null;
      job.errorCode = null;
      if (job.pollTimer) { clearTimeout(job.pollTimer); job.pollTimer = null; }
    } catch (error) {
      if (job.status === 'cancelled') return;
      if (error && (error.code === 'INVALID_RESULT' || error.code === 'COMFY_NO_IMAGE')) {
        failJob(job, error, error.code);
        return;
      }
      job.pollFailures += 1;
      if (Date.now() > job.deadline || job.pollFailures >= 60) {
        failJob(job, error, 'ANIMA_POLL_FAILED');
        return;
      }
      // 轮询失败只延迟下一次读取，绝不再次提交工作流。
      schedulePoll(job, Math.min(3000, POLL_INTERVAL_MS * Math.max(1, job.pollFailures)));
    }
  }

  async function submit(job) {
    if (engine === 'anima' && LORAS[job.input.loraId] && LORAS[job.input.loraId].preview) {
      var loraFile = path.resolve(loraRoot, LORAS[job.input.loraId].file);
      if (loraFile.indexOf(path.resolve(loraRoot) + path.sep) !== 0 || !fs.existsSync(loraFile)) {
        throw serviceError(503, 'ANIMA_LORA_UNAVAILABLE', '所选 Anima LoRA 文件不可用');
      }
    }
    var response = await requestComfyJson(config, 'POST', '/prompt', {
      prompt:buildWorkflowForJob(job.input),
      client_id:clientId
    }, 20000);
    var promptId = response && response.prompt_id;
    if (typeof promptId !== 'string' || !promptId || promptId.length > 200) {
      throw serviceError(502, 'COMFY_INVALID_RESPONSE', 'ComfyUI 未返回有效任务 ID');
    }
    job.upstreamId = promptId;
    if (job.status === 'cancelling' || job.status === 'cancelled') {
      void requestTargetedCancel(job).catch(function () {});
      return;
    }
    job.status = 'running';
    schedulePoll(job, 0);
  }

  function create(input, owner) {
    if (pendingCount() >= MAX_PENDING) throw serviceError(429, 'ANIMA_QUEUE_FULL', 'Anima 队列已满，请稍后再试');
    var id = crypto.randomBytes(18).toString('hex');
    var createdAt = Date.now();
    var frozenInput = Object.freeze(Object.assign({}, input));
    var job = {
      id:id,
      owner:owner,
      provider:provider,
      input:frozenInput,
      metadata:Object.freeze({
         engine:frozenInput.family || engine, id:id, prompt:frozenInput.prompt, negative:frozenInput.negative,
        profileId:frozenInput.profileId || '', modelId:frozenInput.modelId, loraId:frozenInput.loraId,
        loraStrength:frozenInput.loraStrength, width:frozenInput.width, height:frozenInput.height,
        steps:frozenInput.steps, cfg:frozenInput.cfg, sampler:frozenInput.sampler || 'res_multistep', scheduler:frozenInput.scheduler || 'simple',
         seed:frozenInput.seed, character:frozenInput.character || null, preview:Boolean(LORAS[frozenInput.loraId] && LORAS[frozenInput.loraId].preview), createdAt:createdAt, resultUrl:null,
        provider:provider
      }),
      status:'queued',
      createdAt:createdAt,
      deadline:createdAt + JOB_TIMEOUT_MS,
      upstreamId:'',
      result:null,
      resultConsumed:false,
      error:null,
      errorCode:null,
      pollTimer:null,
      gcTimer:null,
      pollFailures:0,
      cancelFailures:0,
      cancelChecks:0,
      cancelDeadline:0
    };
    jobs.set(job.id, job);
    function collect() {
      var current = jobs.get(job.id);
      if (current !== job) return;
      if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') removeJob(job);
      else job.gcTimer = setTimeout(collect, jobTtlMs).unref();
    }
    job.gcTimer = setTimeout(collect, jobTtlMs).unref();
    return job;
  }

  function get(id, owner) {
    var job = jobs.get(String(id || ''));
    if (!job || job.owner !== owner) return null;
    return job;
  }

  function removeResult(job) {
    if (job.result && job.result.path) {
      try { fs.unlinkSync(job.result.path); } catch (error) {}
    }
    job.result = null;
    job.resultConsumed = true;
  }

  function removeJob(job) {
    if (job.pollTimer) { clearTimeout(job.pollTimer); job.pollTimer = null; }
    if (job.gcTimer) { clearTimeout(job.gcTimer); job.gcTimer = null; }
    removeResult(job);
    jobs.delete(job.id);
  }

  function consumeResult(job) {
    if (!job.result || job.resultConsumed) return;
    removeResult(job);
  }

  async function cancel(job) {
    if (job.status === 'queued' || job.status === 'running') {
      if (!job.upstreamId) {
        finishCancellation(job);
        return job;
      }
      job.status = 'cancelling';
      job.error = '任务取消中';
      job.errorCode = 'ANIMA_CANCELLING';
      job.cancelChecks = 0;
      job.cancelDeadline = Date.now() + cancelTimeoutMs;
      try {
        await requestTargetedCancel(job);
      } catch (error) {
        job.cancelFailures += 1;
      }
      scheduleCancelPoll(job);
    } else if (job.status === 'cancelling') {
      scheduleCancelPoll(job);
    } else if (job.status === 'succeeded') {
      removeResult(job);
      job.status = 'cancelled';
      job.error = '任务已删除';
      job.errorCode = 'ANIMA_CANCELLED';
    }
    return job;
  }

  function status() {
    var modelRoot = path.resolve(config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI'), 'ComfyUI', 'models');
    function available(model) {
      var encoder = model.family === 'krea2' ? 'qwen3vl_4b_fp8_scaled.safetensors' : 'qwen_3_06b_base.safetensors';
      return fs.existsSync(path.join(modelRoot, 'diffusion_models', model.file))
        && fs.existsSync(path.join(modelRoot, 'text_encoders', encoder))
        && fs.existsSync(path.join(modelRoot, 'vae', 'qwen_image_vae.safetensors'));
    }
    return {
      online:false,
        models:Object.keys(MODELS).map(function (id) { var model = MODELS[id]; return { id:id, label:model.label, family:model.family, profileId:model.profileId, available:available(model), defaults:{ steps:model.steps, cfg:model.cfg, sampler:model.sampler, scheduler:model.scheduler }, sizes:model.sizes, capabilities:{ negative:model.family !== 'krea2', lora:model.family === 'anima', noLora:model.noLora === true, characterIdentity:model.family === 'anima', experimental:model.family === 'krea2' || model.noLora === true } }; }),
      loras:Object.keys(LORAS).map(function (id) {
        var lora = LORAS[id];
        var file = path.resolve(loraRoot, lora.file);
        return { id:id, name:lora.name, character:lora.character, preview:Boolean(lora.preview), validation:lora.validation || 'production', available:!lora.preview || fs.existsSync(file) };
      }),
      characters:Object.keys(CHARACTERS).map(function (id) { return CHARACTERS[id]; }),
      pending:pendingCount(),
      maxPending:MAX_PENDING
    };
  }

  async function probe() {
    try {
      var response = await requestComfy(config, 'GET', '/system_stats', null, 2500, 256 * 1024);
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      return false;
    }
  }

  function close() {
    closed = true;
    jobs.forEach(function (job) {
      if (job.pollTimer) clearTimeout(job.pollTimer);
      job.pollTimer = null;
      if (job.gcTimer) clearTimeout(job.gcTimer);
      job.gcTimer = null;
      if (job.status === 'queued' || job.status === 'running' || job.status === 'cancelling') {
        void requestTargetedCancel(job).catch(function () {});
      }
      removeResult(job);
    });
    jobs.clear();
    cleanupMediaRoot(config, mediaNamespace);
  }

  return {
    create:create,
    submit:submit,
    get:get,
    cancel:cancel,
    consumeResult:consumeResult,
      publicJob:function (job) { return publicJob(job, job.input && job.input.family === 'krea2' ? '/api/creative' : routeBase); },
    probe:probe,
    status:status,
    close:close,
     constants:{ MODELS:MODELS, LORAS:LORAS, MAX_PENDING:MAX_PENDING, JOB_TTL_MS:jobTtlMs, CANCEL_TIMEOUT_MS:cancelTimeoutMs }
  };
}

function createAnimaRouter(config, dependencies) {
  dependencies = dependencies || {};
  var router = express.Router();
  var service = dependencies.anima || createAnimaService(config);
  var jobLimit = security.rateLimit({ capacity:12, refillMs:5000, label:'Anima 出图' });
  function routeFamily(req) { return String(req.path || '').startsWith('/api/anima') ? 'anima' : 'creative'; }
  function routeOwnsJob(req, job) { return Boolean(job) && (routeFamily(req) === 'anima' ? job.input.family === 'anima' : job.input.family === 'krea2'); }

  router.get(['/api/anima/status', '/api/creative/status'], function (req, res) {
    service.probe().then(function (online) {
      var data = service.status();
      data.online = online;
      if (routeFamily(req) === 'anima') data.models = data.models.filter(function (model) { return model.family === 'anima'; });
      res.setHeader('Cache-Control', 'no-store');
      envelope.ok(res, data);
    }).catch(function () {
      var data = service.status();
      if (routeFamily(req) === 'anima') data.models = data.models.filter(function (model) { return model.family === 'anima'; });
      res.setHeader('Cache-Control', 'no-store');
      envelope.ok(res, data);
    });
  });

  router.post(['/api/anima/jobs', '/api/creative/jobs'], jobLimit, express.json({ limit:MAX_BODY }), async function (req, res) {
    var input;
    try { input = validateInput(req.body, routeFamily(req) === 'anima' ? 'anima' : 'krea2'); } catch (error) {
      return envelope.fail(res, error.status || 400, error.message, { code:error.code });
    }
    var job;
    try {
      job = service.create(input, requestOwner(req));
      await service.submit(job);
    } catch (error) {
      if (job) {
        service.cancel(job);
      }
      return envelope.fail(res, error.status >= 500 ? 502 : (error.status || 502),
        error.status >= 500 ? 'ComfyUI 暂不可用' : error.message || 'Anima 提交失败',
        { code:error.code || 'ANIMA_SUBMIT_FAILED' });
    }
    res.status(202);
    return envelope.ok(res, { job:service.publicJob(job) });
  });

  router.get(['/api/anima/jobs/:id/result', '/api/creative/jobs/:id/result'], function (req, res) {
    var job = service.get(req.params.id, requestOwner(req));
    if (!routeOwnsJob(req, job)) return envelope.fail(res, 404, '生成任务不存在', { code:'JOB_NOT_FOUND' });
    if (job.resultConsumed) return envelope.fail(res, 404, '结果已消费或不存在', { code:'RESULT_NOT_FOUND' });
    if (job.status !== 'succeeded' || !job.result) {
      return envelope.fail(res, job.status === 'failed' ? 502 : 409,
        job.error || '结果尚未就绪', { code:job.errorCode || 'RESULT_NOT_READY' });
    }
    var root = ensureMediaRoot(config);
    var target = safeMediaPath(root, path.basename(job.result.path));
    if (!target || target !== path.resolve(job.result.path)) return envelope.fail(res, 404, '结果不存在', { code:'RESULT_NOT_FOUND' });
    try {
      var realRoot = fs.realpathSync(root);
      var realTarget = fs.realpathSync(target);
      var stat = fs.statSync(realTarget);
      if (!stat.isFile() || realTarget.indexOf(realRoot + path.sep) !== 0) throw new Error('unsafe result');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', job.result.mime);
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('X-Content-Type-Options', 'nosniff');
       res.once('finish', function () { service.consumeResult(job); });
       var stream = fs.createReadStream(realTarget);
       stream.on('error', function () {
         if (!res.headersSent) envelope.fail(res, 404, '结果不存在', { code:'RESULT_NOT_FOUND' });
         else res.destroy();
       });
       stream.pipe(res);
    } catch (error) {
      return envelope.fail(res, 404, '结果不存在', { code:'RESULT_NOT_FOUND' });
    }
  });

  router.get(['/api/anima/jobs/:id', '/api/creative/jobs/:id'], function (req, res) {
    var job = service.get(req.params.id, requestOwner(req));
    if (!routeOwnsJob(req, job)) return envelope.fail(res, 404, '生成任务不存在', { code:'JOB_NOT_FOUND' });
    res.setHeader('Cache-Control', 'no-store');
    return envelope.ok(res, { job:service.publicJob(job) });
  });

  router.delete(['/api/anima/jobs/:id', '/api/creative/jobs/:id'], async function (req, res) {
    var job = service.get(req.params.id, requestOwner(req));
    if (!routeOwnsJob(req, job)) return envelope.fail(res, 404, '生成任务不存在', { code:'JOB_NOT_FOUND' });
     var cancelled = await service.cancel(job);
     res.status(cancelled.status === 'cancelling' ? 202 : 200);
     return envelope.ok(res, { job:service.publicJob(cancelled) });
  });

  return { router:router, service:service, close:service.close };
}

module.exports = {
  createAnimaRouter:createAnimaRouter,
  createAnimaService:createAnimaService,
  validateInput:validateInput,
  buildWorkflow:buildWorkflow,
  validateImageReference:validateImageReference
};
