'use strict';

var crypto = require('crypto');
var express = require('express');
var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');
var security = require('../server/security');
var envelope = require('../server/http-envelope');
var generationContract = require('../server/anima-generation-contract');
var comfyClient = require('../server/comfy-client');
var comfyProgress = require('../server/comfy-progress');
// P3 收口：ComfyUI 探活统一走 server/upstream-health
var upstreamHealth = require('../server/upstream-health');
// 2026-08-21 收口：模型/LoRA/角色白名单数据表外移；任务注册表骨架统一
var modelCatalog = require('../server/anima-model-catalog');
var jobRunner = require('../server/job-runner');
var superres = require('./superres');

var MAX_BODY = '64kb';
var MAX_PENDING = 4;
var MAX_PROMPT_LENGTH = 12000;
var MAX_NEGATIVE_LENGTH = 8000;
var MAX_IMAGE_BYTES = 16 * 1024 * 1024;
var INPUT_IMAGE_TTL_MS = 60 * 60 * 1000;
var JOB_TIMEOUT_MS = 10 * 60 * 1000;
var POLL_INTERVAL_MS = 500;
var JOB_TTL_MS = 30 * 60 * 1000;
var CANCEL_POLL_INTERVAL_MS = 250;
var CANCEL_TIMEOUT_MS = 30 * 1000;
var OUTPUT_NODE_ID = '10';
var OUTPUT_FILENAME_PREFIX = 'anima_app';

// 模型/LoRA/角色白名单：2026-08-21 起由 server/anima-model-catalog.js 承载
var MODELS = modelCatalog.MODELS;
var PROFILE_BY_MODEL = modelCatalog.PROFILE_BY_MODEL;
var LORAS = modelCatalog.LORAS;
var KREA_STYLE_LORAS = modelCatalog.KREA_STYLE_LORAS;
var CHARACTERS = modelCatalog.CHARACTERS;

var ALLOWED_INPUT_KEYS = new Set(generationContract.ALLOWED_INPUT_KEYS);

// 放大二阶段参数：固定 sgm_uniform + res_multistep（首轮 res_multistep/simple）
var HIRES_SAMPLER = generationContract.HIRES_SAMPLER;
var HIRES_SCHEDULER = generationContract.HIRES_SCHEDULER;

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
function modelRoot(config) {
  return path.resolve(config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI'), 'ComfyUI', 'models');
}
function imageInputRoot(config) {
  return path.resolve(config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI'), 'ComfyUI', 'input');
}

var IMAGE_INPUT_PATTERN = /^aics_anima_input_[a-f0-9]{16,40}\.(png|jpg|jpeg|webp)$/i;

function imageInputAvailable(config, name) {
  if (typeof name !== 'string') return false;
  if (!IMAGE_INPUT_PATTERN.test(name)) return false;
  var target = path.resolve(imageInputRoot(config), name);
  try { return fs.statSync(target).isFile(); } catch (error) { return false; }
}

function cleanupImageInputs(config, protectedNames, ttlMs) {
  var root = imageInputRoot(config);
  var keep = protectedNames || new Set();
  var cutoff = Date.now() - (Number(ttlMs) > 0 ? Number(ttlMs) : INPUT_IMAGE_TTL_MS);
  var entries = [];
  try { entries = fs.readdirSync(root); } catch (error) { return; }
  entries.forEach(function (name) {
    if (!IMAGE_INPUT_PATTERN.test(name) || keep.has(name)) return;
    var target = path.resolve(root, name);
    if (target.indexOf(path.resolve(root) + path.sep) !== 0) return;
    try {
      var stat = fs.statSync(target);
      if (stat.isFile() && stat.mtimeMs < cutoff) fs.unlinkSync(target);
    } catch (error) {}
  });
}

function sniffImageExtension(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50
    && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function resourceExists(root, kind, file) {
  var base = path.resolve(root, kind);
  var target = path.resolve(base, file);
  if (target.indexOf(base + path.sep) !== 0) return false;
  try { return fs.statSync(target).isFile(); } catch (error) { return false; }
}
function requiredResources(config, input, loraRoot) {
  var root = modelRoot(config);
  var model = MODELS[input.modelId];
  var encoder = model.family === 'krea2' ? 'qwen3-vl-4b-heretic_fp8_e4m3fn.safetensors' : 'qwen_3_06b_base.safetensors';
  if (!resourceExists(root, 'diffusion_models', model.file)) throw serviceError(503, 'ANIMA_MODEL_UNAVAILABLE', '所选生成底模资源不可用');
  if (!resourceExists(root, 'text_encoders', encoder)) throw serviceError(503, 'ANIMA_ENCODER_UNAVAILABLE', '所选底模的文本编码器资源不可用');
  if (!resourceExists(root, 'vae', 'qwen_image_vae.safetensors')) throw serviceError(503, 'ANIMA_VAE_UNAVAILABLE', '所选底模的 VAE 资源不可用');
  if (input.loraId) {
    var lora = LORAS[input.loraId];
    if (!lora || !resourceExists(loraRoot, '', lora.file)) throw serviceError(503, 'ANIMA_LORA_UNAVAILABLE', '所选 Anima LoRA 文件不可用');
  }
  if (input.styleLoraId) {
    var styleLora = KREA_STYLE_LORAS[input.styleLoraId];
    if (!styleLora || !resourceExists(loraRoot, '', styleLora.file)) throw serviceError(503, 'KREA_STYLE_LORA_UNAVAILABLE', '所选 Krea 2 Style LoRA 文件不可用');
  }
  if (input.initImage && !imageInputAvailable(config, input.initImage)) {
    throw serviceError(503, 'ANIMA_IMAGE_UNAVAILABLE', '局部重绘底图不存在或已过期');
  }
  if (input.maskImage && !imageInputAvailable(config, input.maskImage)) {
    throw serviceError(503, 'ANIMA_MASK_UNAVAILABLE', '局部重绘遮罩图不存在或已过期');
  }
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
  if (model.family !== 'krea2' && body.styleLoraId !== undefined) throw serviceError(400, 'WRONG_ROUTE_FAMILY', 'Style LoRA 仅适用于 Krea 2');
  if (model.family === 'krea2') {
    if (body.loraId || body.loraStrength !== undefined || (body.negative && String(body.negative).trim())) throw serviceError(400, 'KREA_UNSUPPORTED_PARAMETER', 'Krea 2 不接受角色 LoRA 或负向 Prompt');
    if (body.styleLoraId !== undefined && !KREA_STYLE_LORAS[body.styleLoraId]) throw serviceError(400, 'UNKNOWN_STYLE_LORA', '未知 Krea 2 官方 Style LoRA');
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
  var isAspectPreservingInpaint = model.family !== 'krea2'
    && typeof body.initImage === 'string' && body.initImage.trim();
  // 只有局部重绘可使用非白名单尺寸：前端按原图比例计算 16 对齐的安全画布。
  // 普通文生图继续严格锁定已验证的模型尺寸，避免任意分辨率撑爆显存。
  if (!isAspectPreservingInpaint && model.sizes.indexOf(width + 'x' + height) === -1) {
    throw serviceError(400, 'INVALID_PARAMETER', '不支持的输出尺寸');
  }
  if (isAspectPreservingInpaint && (width % 16 !== 0 || height % 16 !== 0)) {
    throw serviceError(400, 'INVALID_PARAMETER', '局部重绘尺寸必须是 16 的倍数');
  }
  // 尺寸上限防护：支持最大 1152x1536 (1.77 MP)，上限放宽至 1.85 MP
  if (model.family !== 'krea2' && width * height > 1_850_000) throw serviceError(400, 'INVALID_PARAMETER', '输出尺寸超过允许面积');
  var steps;
  var cfg;
  if (model.family === 'krea2') {
    if (body.steps !== undefined && body.steps !== 8) throw serviceError(400, 'INVALID_PARAMETER', 'Krea 2 steps 固定为 8');
    if (body.cfg !== undefined && body.cfg !== 1) throw serviceError(400, 'INVALID_PARAMETER', 'Krea 2 CFG 固定为 1');
    steps = 8;
    cfg = 1;
  } else {
    steps = body.steps === undefined ? model.steps : validateNumber(
      body.steps,
      'steps',
      generationContract.PARAMETER_LIMITS.steps.min,
      generationContract.PARAMETER_LIMITS.steps.max,
      generationContract.PARAMETER_LIMITS.steps.integer
    );
    cfg = body.cfg === undefined ? model.cfg : validateNumber(
      body.cfg,
      'cfg',
      generationContract.PARAMETER_LIMITS.cfg.min,
      generationContract.PARAMETER_LIMITS.cfg.max,
      generationContract.PARAMETER_LIMITS.cfg.integer
    );
  }
  var seed = body.seed === undefined
    ? crypto.randomInt(0, 2147483647)
    : validateNumber(
      body.seed,
      'seed',
      generationContract.PARAMETER_LIMITS.seed.min,
      generationContract.PARAMETER_LIMITS.seed.max,
      generationContract.PARAMETER_LIMITS.seed.integer
    );

  return {
    prompt:model.family === 'krea2' && body.styleLoraId
      ? body.prompt.trim() + ', ' + KREA_STYLE_LORAS[body.styleLoraId].trigger
      : body.prompt.trim(),
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
    character:body.character,
    styleLoraId:model.family === 'krea2' ? (body.styleLoraId || null) : null,
    hiresFix:Boolean(body.hiresFix),
    hiresScale:body.hiresFix ? validateNumber(body.hiresScale || 2.0, 'hiresScale', 1.1, 3.0, false) : 1.0,
    hiresDenoise:body.hiresFix ? validateNumber(body.hiresDenoise || 0.35, 'hiresDenoise', 0.1, 0.7, false) : 0.35,
    // 2026-08-25 放大器可选：'Remacri'（ESRGAN 像素超分，默认 Auto 探测注入）| 'Latent'（潜空间放大，不做像素超分）
    hiresUpscaler:typeof body.hiresUpscaler === 'string' && (body.hiresUpscaler === 'Remacri' || body.hiresUpscaler === 'Latent') ? body.hiresUpscaler : (body.hiresFix ? 'Auto' : null),
    teaCache:body.teaCache !== undefined ? Boolean(body.teaCache) : true,
    teaCacheThresh:body.teaCacheThresh !== undefined ? validateNumber(body.teaCacheThresh, 'teaCacheThresh', 0.0, 1.0, false) : 0.08,
    initImage:typeof body.initImage === 'string' && body.initImage.trim() ? body.initImage.trim() : null,
    maskImage:typeof body.maskImage === 'string' && body.maskImage.trim() ? body.maskImage.trim() : null,
    maskPrompt:typeof body.maskPrompt === 'string' && body.maskPrompt.trim() ? body.maskPrompt.trim() : null,
    denoisingStrength:body.denoisingStrength !== undefined ? validateNumber(body.denoisingStrength, 'denoisingStrength', 0.1, 1.0, false) : 0.80,
    growMaskBy:body.growMaskBy !== undefined ? validateNumber(body.growMaskBy, 'growMaskBy', 0, 32, true) : 6,
    // 2026-08-21 换装完善：CLIPSeg 自动识别阈值可调。实测 threshold 0.20 会把身体/
    // 背景大片拉进 mask（denoise 0.85 下整块重绘 → 构图漂移），0.45+ 才聚焦服装主体。
    maskThreshold:body.maskThreshold !== undefined ? validateNumber(body.maskThreshold, 'maskThreshold', 0.05, 0.95, false) : 0.45,
  };
}

// 2026-08-20：Anima hires 真超分辅助——与 WAI 链路同款（Remacri ESRGAN 像素级放大 +
// 低 denoise 二阶段），替代潜空间 bicubic 放大（动漫线条块状/噪感根源之一）。
// 只在 input.superResModel 存在时启用；否则回退原有 LatentUpscaleBy(bicubic)。
// 2026-08-25 实测转正：二阶段 KSampler 低 denoise 重绘在 4MP 外推 latent 上实测
// 全脏（参数/调度器/TeaCache/RCAS/显存机制穷举排除，X1r 连 433f93f 逐字复刻亦脏；
// P1 纯像素直出与 Z1 VAE 往返直出均干净），Remacri 路径改纯像素放大直出：
// Remacri 4x → lanczos 精确缩放 → 保存（无 VAEEncode/KSampler 重绘段）。
function appendSuperResHires(wf, input, opts) {
  var targetW = Math.round(input.width * input.hiresScale / 8) * 8;
  var targetH = Math.round(input.height * input.hiresScale / 8) * 8;
  wf['20'] = { class_type:'VAEDecode', inputs:{ samples:opts.firstPass, vae:opts.vae } };
  wf['21'] = { class_type:'UpscaleModelLoader', inputs:{ model_name:input.superResModel } };
  wf['22'] = { class_type:'ImageUpscaleWithModel', inputs:{ upscale_model:['21', 0], image:['20', 0] } };
  wf['23'] = { class_type:'ImageScale', inputs:{ image:['22', 0], upscale_method:'lanczos', width:targetW, height:targetH, crop:'disabled' } };
  wf['10'].inputs.images = ['23', 0];
}

function buildWorkflow(input) {
  var model = MODELS[input.modelId];
  if (model.family === 'krea2') {
    var rebalance = model.rebalance;
    var workflow = {
      '1': { class_type:'UNETLoader', inputs:{ unet_name:model.file, weight_dtype:'default' } },
      '2': { class_type:'CLIPLoader', inputs:{ clip_name:'qwen3-vl-4b-heretic_fp8_e4m3fn.safetensors', type:'krea2' } },
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
     var kreaModel = ['1', 0];
     if (input.styleLoraId) {
       var styleLora = KREA_STYLE_LORAS[input.styleLoraId];
       workflow['12'] = { class_type:'LoraLoaderModelOnly', inputs:{ model:kreaModel, lora_name:styleLora.file, strength_model:1 } };
       kreaModel = ['12', 0];
     }
     // 2026-08-22 社区工作流回流（来源 comfyui-mcp krea2-txt2img-manual V2，本机复现
     // 样张 seed 20260822 审核通过）。2026-08-23 实测增强链路与原 euler 标准链路出图
     // 时间一致，原链路退役：LoRA 栈后固定挂 T-Enhancer 细节补丁，采样器固定社区
     // 验证的 er_sde，解码后固定 RCAS 锐化，不再暴露关闭开关。
    workflow['14'] = { class_type:'ComfyUI-Krea2T-Enhancer', inputs:{ model:kreaModel, enabled:true, strength:1, debug:false } };
    kreaModel = ['14', 0];
    workflow['7'] = { class_type:'KSampler', inputs:{ model:kreaModel, positive:positive, negative:['5', 0], latent_image:['6', 0], seed:input.seed, steps:8, cfg:1, sampler_name:'er_sde', scheduler:'simple', denoise:1 } };
    workflow['15'] = { class_type:'ImageSharpenKJ', inputs:{ image:['8', 0], method:'rcas', 'method.strength':0.75 } };
    workflow['10'].inputs.images = ['15', 0];
    return workflow;
  }

  var isHires = input.hiresFix === true && input.hiresScale > 1.0;

  if (model.noLora === true && !input.loraId) {
    var noLoraModel = ['1', 0];
    var noLoraWf = {
      '1': { class_type:'UNETLoader', inputs:{ unet_name:model.file, weight_dtype:'default' } },
      '2': { class_type:'CLIPLoader', inputs:{ clip_name:'qwen_3_06b_base.safetensors', type:'qwen_image' } },
      '3': { class_type:'VAELoader', inputs:{ vae_name:'qwen_image_vae.safetensors' } },
      '4': { class_type:'CLIPTextEncode', inputs:{ clip:['2', 0], text:input.prompt } },
      '5': { class_type:'CLIPTextEncode', inputs:{ clip:['2', 0], text:input.negative } },
      '6': { class_type:'EmptyLatentImage', inputs:{ width:input.width, height:input.height, batch_size:1 } },
      '7': { class_type:'KSampler', inputs:{
        model:noLoraModel,
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
    if (input.teaCache) {
      noLoraWf['13'] = { class_type:'AnimaTeaCache', inputs:{ model:['1', 0], rel_l1_thresh:input.teaCacheThresh || 0.08, start_percent:0, end_percent:1, cache_device:'cuda' } };
      noLoraModel = ['13', 0];
      noLoraWf['7'].inputs.model = noLoraModel;
    }
    if (!input.initImage && !isHires) {
    // 2026-08-23 社区增强回流：纯文生图末端 RCAS 锐化（与 Krea2 转正链路同款，
    // 实测 0.75 强度约 +1s，线条/发丝细节显著提升且无振铃白边）。inpaint 有像素级
    // 回贴保真契约、hires 走超分路径，一律不挂。
    noLoraWf['35'] = { class_type:'ImageSharpenKJ', inputs:{ image:['8', 0], method:'rcas', 'method.strength':0.75 } };
    noLoraWf['10'].inputs.images = ['35', 0];
  }
  if (input.initImage) {
      noLoraWf['15'] = { class_type:'LoadImage', inputs:{ image:input.initImage } };
      noLoraWf['19'] = { class_type:'ResizeAndPadImage', inputs:{ image:['15', 0], target_width:input.width, target_height:input.height, padding_color:'black', interpolation:'lanczos' } };
      noLoraWf['18'] = { class_type:'VAEEncode', inputs:{ pixels:['19', 0], vae:['3', 0] } };
      if (input.maskImage) {
        noLoraWf['15_mask'] = { class_type:'LoadImage', inputs:{ image:input.maskImage } };
        noLoraWf['19_mask'] = { class_type:'ResizeAndPadImage', inputs:{ image:['15_mask', 0], target_width:input.width, target_height:input.height, padding_color:'black', interpolation:'lanczos' } };
        noLoraWf['16'] = { class_type:'ImageToMask', inputs:{ image:['19_mask', 0], channel:'red' } };
        noLoraWf['16_grow'] = { class_type:'GrowMask', inputs:{ mask:['16', 0], expand:input.growMaskBy !== undefined ? input.growMaskBy : 6, tapered_corners:true } };
        noLoraWf['17'] = { class_type:'SetLatentNoiseMask', inputs:{ samples:['18', 0], mask:['16_grow', 0] } };
        noLoraWf['30'] = { class_type:'ImageCompositeMasked', inputs:{ destination:['19', 0], source:['8', 0], x:0, y:0, resize_source:false, mask:['16_grow', 0] } };
        noLoraWf['10'].inputs.images = ['30', 0];
      } else if (input.maskPrompt) {
        // 2026-08-21 换装完善：threshold 可调（默认 0.45）+ 补 ImageCompositeMasked 回贴，
        // 与手绘遮罩分支行为一致——非重绘区像素级保真，不再整图 VAE 往返。
        var clipsegThreshold = input.maskThreshold !== undefined ? input.maskThreshold : 0.45;
        noLoraWf['16'] = { class_type:'AP_CLIPSeg_TextMask', inputs:{ image:['19', 0], prompt:input.maskPrompt, threshold:clipsegThreshold, smooth_radius:2, soft_mask:false, invert:false, model:'clipseg_rd64', mask_dilate:input.growMaskBy !== undefined ? input.growMaskBy : 8, mask_blur:4, device:'auto', unload_after_run:false } };
        noLoraWf['17'] = { class_type:'SetLatentNoiseMask', inputs:{ samples:['18', 0], mask:['16', 0] } };
        noLoraWf['30'] = { class_type:'ImageCompositeMasked', inputs:{ destination:['19', 0], source:['8', 0], x:0, y:0, resize_source:false, mask:['16', 0] } };
        noLoraWf['10'].inputs.images = ['30', 0];
      }
      if (noLoraWf['17']) {
        noLoraWf['7'].inputs.latent_image = ['17', 0];
        noLoraWf['7'].inputs.denoise = input.denoisingStrength !== undefined ? input.denoisingStrength : 0.80;
      }
    }
    if (isHires) {
      // inpaint（手绘遮罩或 CLIPSeg 自动识别）+ hires：对 composite 回贴结果 ['30',0] 超分。
      if (input.initImage && (input.maskImage || input.maskPrompt)) {
        if (input.superResModel) {
          var tw = Math.round(input.width * input.hiresScale / 8) * 8;
          var th = Math.round(input.height * input.hiresScale / 8) * 8;
          noLoraWf['20'] = { class_type:'UpscaleModelLoader', inputs:{ model_name:input.superResModel } };
          noLoraWf['21'] = { class_type:'ImageUpscaleWithModel', inputs:{ upscale_model:['20', 0], image:['30', 0] } };
          noLoraWf['22'] = { class_type:'ImageScale', inputs:{ image:['21', 0], upscale_method:'lanczos', width:tw, height:th, crop:'disabled' } };
          noLoraWf['23'] = { class_type:'VAEEncode', inputs:{ pixels:['22', 0], vae:['3', 0] } };
          // 2026-08-25 修复：二阶段不再走 TeaCache（跳步丢细节 = 放大发糊根因），
          // 直接连 UNET 原模型全量重绘补细节。
          noLoraWf['24'] = { class_type:'KSampler', inputs:{ model:noLoraModel, positive:['4', 0], negative:['5', 0], latent_image:['23', 0], seed:input.seed + 1, steps:Math.max(12, Math.round(input.steps * 0.6)), cfg:input.cfg, sampler_name:HIRES_SAMPLER, scheduler:HIRES_SCHEDULER, denoise:input.hiresDenoise || 0.35 } };
          noLoraWf['25'] = { class_type:'VAEDecode', inputs:{ samples:['24', 0], vae:['3', 0] } };
          noLoraWf['10'].inputs.images = ['25', 0];
        } else {
          noLoraWf['31'] = { class_type:'VAEEncode', inputs:{ pixels:['30', 0], vae:['3', 0] } };
          noLoraWf['32'] = { class_type:'LatentUpscaleBy', inputs:{ samples:['31', 0], upscale_method:'bicubic', scale_by:input.hiresScale } };
          noLoraWf['33'] = { class_type:'KSampler', inputs:{ model:noLoraModel, positive:['4', 0], negative:['5', 0], latent_image:['32', 0], seed:input.seed + 1, steps:Math.max(12, Math.round(input.steps * 0.6)), cfg:input.cfg, sampler_name:HIRES_SAMPLER, scheduler:HIRES_SCHEDULER, denoise:input.hiresDenoise || 0.35 } };
          noLoraWf['34'] = { class_type:'VAEDecode', inputs:{ samples:['33', 0], vae:['3', 0] } };
          noLoraWf['10'].inputs.images = ['34', 0];
        }
      } else if (input.superResModel) {
        appendSuperResHires(noLoraWf, input, { firstPass:['7', 0], vae:['3', 0] });
      } else {
        noLoraWf['11'] = { class_type:'LatentUpscaleBy', inputs:{ samples:['7', 0], upscale_method:'bicubic', scale_by:input.hiresScale } };
        noLoraWf['12'] = { class_type:'KSampler', inputs:{
          model:noLoraModel,
          positive:['4', 0],
          negative:['5', 0],
          latent_image:['11', 0],
          seed:input.seed + 1,
          steps:Math.max(12, Math.round(input.steps * 0.6)),
          cfg:input.cfg,
          sampler_name:HIRES_SAMPLER,
          scheduler:HIRES_SCHEDULER,
          denoise:input.hiresDenoise || 0.35
        } };
        noLoraWf['8'].inputs.samples = ['12', 0];
      }
    }
    if (isHires && !input.superResModel) {
      // Keep hires output on parity with the base route: the ESRGAN/VAE round trip
      // otherwise bypasses the proven RCAS finishing pass and visibly softens line art.
      // Remacri 纯像素路径（superResModel 存在）不挂 RCAS（2026-08-25 P1 实测状态直出）。
      noLoraWf['35'] = { class_type:'ImageSharpenKJ', inputs:{ image:noLoraWf['10'].inputs.images, method:'rcas', 'method.strength':0.75 } };
      noLoraWf['10'].inputs.images = ['35', 0];
    }
    return noLoraWf;
  }

  var lora = LORAS[input.loraId];
  var loraModel = ['4', 0];
  var loraWf = {
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
      model:loraModel,
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
  if (input.teaCache) {
    loraWf['13'] = { class_type:'AnimaTeaCache', inputs:{ model:['4', 0], rel_l1_thresh:input.teaCacheThresh || 0.08, start_percent:0, end_percent:1, cache_device:'cuda' } };
    loraModel = ['13', 0];
    loraWf['8'].inputs.model = loraModel;
  }
  if (input.initImage) {
    loraWf['15'] = { class_type:'LoadImage', inputs:{ image:input.initImage } };
    loraWf['19'] = { class_type:'ResizeAndPadImage', inputs:{ image:['15', 0], target_width:input.width, target_height:input.height, padding_color:'black', interpolation:'lanczos' } };
    loraWf['18'] = { class_type:'VAEEncode', inputs:{ pixels:['19', 0], vae:['3', 0] } };
    if (input.maskImage) {
      loraWf['15_mask'] = { class_type:'LoadImage', inputs:{ image:input.maskImage } };
      loraWf['19_mask'] = { class_type:'ResizeAndPadImage', inputs:{ image:['15_mask', 0], target_width:input.width, target_height:input.height, padding_color:'black', interpolation:'lanczos' } };
      loraWf['16'] = { class_type:'ImageToMask', inputs:{ image:['19_mask', 0], channel:'red' } };
      loraWf['16_grow'] = { class_type:'GrowMask', inputs:{ mask:['16', 0], expand:input.growMaskBy !== undefined ? input.growMaskBy : 6, tapered_corners:true } };
      loraWf['17'] = { class_type:'SetLatentNoiseMask', inputs:{ samples:['18', 0], mask:['16_grow', 0] } };
      loraWf['30'] = { class_type:'ImageCompositeMasked', inputs:{ destination:['19', 0], source:['9', 0], x:0, y:0, resize_source:false, mask:['16_grow', 0] } };
      loraWf['10'].inputs.images = ['30', 0];
    } else if (input.maskPrompt) {
      // 2026-08-21 换装完善：threshold 可调（默认 0.45）+ 补 ImageCompositeMasked 回贴，
      // 与手绘遮罩分支行为一致——非重绘区像素级保真，不再整图 VAE 往返。
      var loraClipsegThreshold = input.maskThreshold !== undefined ? input.maskThreshold : 0.45;
      loraWf['16'] = { class_type:'AP_CLIPSeg_TextMask', inputs:{ image:['19', 0], prompt:input.maskPrompt, threshold:loraClipsegThreshold, smooth_radius:2, soft_mask:false, invert:false, model:'clipseg_rd64', mask_dilate:input.growMaskBy !== undefined ? input.growMaskBy : 8, mask_blur:4, device:'auto', unload_after_run:false } };
      loraWf['17'] = { class_type:'SetLatentNoiseMask', inputs:{ samples:['18', 0], mask:['16', 0] } };
      loraWf['30'] = { class_type:'ImageCompositeMasked', inputs:{ destination:['19', 0], source:['9', 0], x:0, y:0, resize_source:false, mask:['16', 0] } };
      loraWf['10'].inputs.images = ['30', 0];
    }
    if (loraWf['17']) {
      loraWf['8'].inputs.latent_image = ['17', 0];
      loraWf['8'].inputs.denoise = input.denoisingStrength !== undefined ? input.denoisingStrength : 0.80;
    }
  }
  if (isHires) {
    // inpaint（手绘遮罩或 CLIPSeg 自动识别）+ hires：对 composite 回贴结果 ['30',0] 超分。
    // 2026-08-21 换装完善：此前只认 maskImage，CLIPSeg 任务会误走普通生图超分分支。
    if (input.initImage && (input.maskImage || input.maskPrompt)) {
      if (input.superResModel) {
        var ltw = Math.round(input.width * input.hiresScale / 8) * 8;
        var lth = Math.round(input.height * input.hiresScale / 8) * 8;
        loraWf['20'] = { class_type:'UpscaleModelLoader', inputs:{ model_name:input.superResModel } };
        loraWf['21'] = { class_type:'ImageUpscaleWithModel', inputs:{ upscale_model:['20', 0], image:['30', 0] } };
        loraWf['22'] = { class_type:'ImageScale', inputs:{ image:['21', 0], upscale_method:'lanczos', width:ltw, height:lth, crop:'disabled' } };
        loraWf['23'] = { class_type:'VAEEncode', inputs:{ pixels:['22', 0], vae:['3', 0] } };
        // 2026-08-25 修复：二阶段不再走 TeaCache（跳步丢细节 = 放大发糊根因），
        // 直接连 LoraLoader 原模型全量重绘补细节。
        loraWf['24'] = { class_type:'KSampler', inputs:{ model:loraModel, positive:['5', 0], negative:['6', 0], latent_image:['23', 0], seed:input.seed + 1, steps:Math.max(12, Math.round(input.steps * 0.6)), cfg:input.cfg, sampler_name:HIRES_SAMPLER, scheduler:HIRES_SCHEDULER, denoise:input.hiresDenoise || 0.35 } };
        loraWf['25'] = { class_type:'VAEDecode', inputs:{ samples:['24', 0], vae:['3', 0] } };
        loraWf['10'].inputs.images = ['25', 0];
      } else {
        loraWf['31'] = { class_type:'VAEEncode', inputs:{ pixels:['30', 0], vae:['3', 0] } };
        loraWf['32'] = { class_type:'LatentUpscaleBy', inputs:{ samples:['31', 0], upscale_method:'bicubic', scale_by:input.hiresScale } };
        loraWf['33'] = { class_type:'KSampler', inputs:{ model:loraModel, positive:['5', 0], negative:['6', 0], latent_image:['32', 0], seed:input.seed + 1, steps:Math.max(12, Math.round(input.steps * 0.6)), cfg:input.cfg, sampler_name:HIRES_SAMPLER, scheduler:HIRES_SCHEDULER, denoise:input.hiresDenoise || 0.35 } };
        loraWf['34'] = { class_type:'VAEDecode', inputs:{ samples:['33', 0], vae:['3', 0] } };
        loraWf['10'].inputs.images = ['34', 0];
      }
    } else if (input.superResModel) {
      appendSuperResHires(loraWf, input, { firstPass:['8', 0], vae:['3', 0] });
    } else {
      loraWf['11'] = { class_type:'LatentUpscaleBy', inputs:{ samples:['8', 0], upscale_method:'bicubic', scale_by:input.hiresScale } };
      loraWf['12'] = { class_type:'KSampler', inputs:{
        model:loraModel,
        positive:['5', 0],
        negative:['6', 0],
        latent_image:['11', 0],
        seed:input.seed + 1,
        steps:Math.max(12, Math.round(input.steps * 0.6)),
        cfg:input.cfg,
        sampler_name:HIRES_SAMPLER,
        scheduler:HIRES_SCHEDULER,
        denoise:input.hiresDenoise || 0.35
      } };
      loraWf['9'].inputs.samples = ['12', 0];
    }
  }
  if (isHires && !input.superResModel) {
    // Remacri/VAE and latent hires both need the same finishing pass as base output;
    // without it, the final enlarged image is softer than the unscaled preview.
    // Remacri 纯像素路径（superResModel 存在）不挂 RCAS（2026-08-25 P1 实测状态直出）。
    loraWf['35'] = { class_type:'ImageSharpenKJ', inputs:{ image:loraWf['10'].inputs.images, method:'rcas', 'method.strength':0.75 } };
    loraWf['10'].inputs.images = ['35', 0];
  } else if (!isHires && !input.initImage) {
    // 同 no-LoRA 路线：非 hires 纯文生图末端 RCAS 锐化；inpaint 保持像素级回贴保真。
    // 2026-08-25 修复：必须排除 isHires——否则覆盖 appendSuperResHires 的像素直出
    // （10←23），Remacri 节点变孤立、ComfyUI 跳过未消费节点，输出退回原尺寸
    // （gateway 全链路实测 832x1216 的根因；node23 孤立被复现）。
    loraWf['35'] = { class_type:'ImageSharpenKJ', inputs:{ image:['9', 0], method:'rcas', 'method.strength':0.75 } };
    loraWf['10'].inputs.images = ['35', 0];
  }
  return loraWf;
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
  var elapsedSeconds = Math.max(0, Math.floor(((job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') ? (job.finishedAt || Date.now()) : Date.now()) - job.createdAt) / 1000);
  var progress = job.status === 'succeeded' ? 1 : (typeof job.progress === 'number' ? job.progress : (job.status === 'queued' ? 0 : null));
  var result = {
    id:job.id,
    status:job.status,
    provider:job.provider || 'comfy',
    progress:progress,
    elapsedSeconds:elapsedSeconds,
    currentNode:job.currentNode || null,
     progressText:job.progressText || (job.status === 'queued' ? '等待 ComfyUI 调度…' : job.status === 'running' ? 'ComfyUI 正在推理…' : job.status === 'succeeded' ? '生成完成' : job.status === 'failed' ? '生成失败' : job.status === 'cancelling' ? '正在取消…' : ''),
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
  // 异步落盘（2026-08-21 性能审计 #1）：≤20MB 的 writeFileSync 同步写会短暂
  // 冻结事件循环，与视频/聊天流共享同一个进程。
  await fs.promises.writeFile(temporary, response.body, { flag:'wx', mode:0o600 });
  try {
    await fs.promises.rename(temporary, target);
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
  var validateResources = options.validateResources || function (input) { requiredResources(config, input, loraRoot); };
  var jobTtlMs = Number(options.jobTtlMs) > 0 ? Number(options.jobTtlMs) : JOB_TTL_MS;
  var inputImageTtlMs = Number(options.inputImageTtlMs) > 0 ? Number(options.inputImageTtlMs) : INPUT_IMAGE_TTL_MS;
  var cancelPollIntervalMs = Number(options.cancelPollIntervalMs) > 0
    ? Number(options.cancelPollIntervalMs) : CANCEL_POLL_INTERVAL_MS;
  var cancelTimeoutMs = Number(options.cancelTimeoutMs) > 0
    ? Number(options.cancelTimeoutMs) : CANCEL_TIMEOUT_MS;
  // 任务注册表骨架（Map + pendingCount + closed 标志）收口到 server/job-runner.js；
  // poll/cancel 状态机保持本路由引擎专属实现。
  var registry = jobRunner.createJobRegistry();
  var jobs = registry.jobs;
  function cleanupOwnedInputs() {
    var activeInputs = new Set();
    jobs.forEach(function (job) {
      if (job.input.initImage) activeInputs.add(job.input.initImage);
      if (job.input.maskImage) activeInputs.add(job.input.maskImage);
    });
    cleanupImageInputs(config, activeInputs, inputImageTtlMs);
  }
  // 2026-08-16 审计（方案 A）：client_id 持久化复用 + 启动清理重启遗留的 ComfyUI
  // 任务（立即 + 30s 后各试一次，重试幂等无害）；2026-08-21 收口到 comfy-client。
  var clientId = comfyClient.clientIdFor(config, 'anima');
  comfyClient.sweepOrphanPromptsAfterStart(config, clientId, 'anima');
  var progressMonitor = comfyProgress.createComfyProgressMonitor(config, clientId);

  cleanupMediaRoot(config, mediaNamespace);
  cleanupOwnedInputs();
  var inputCleanupTimer = setInterval(cleanupOwnedInputs, Math.min(inputImageTtlMs, 5 * 60 * 1000));
  if (typeof inputCleanupTimer.unref === 'function') inputCleanupTimer.unref();

  var pendingCount = registry.pendingCount;

  function schedulePoll(job, delay) {
    if (registry.isClosed() || job.status === 'cancelled' || job.status === 'cancelling' || job.status === 'succeeded' || job.status === 'failed') return;
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
    if (registry.isClosed() || job.status !== 'cancelling' || !job.upstreamId) return;
    // 2026-08-16 审计：cancel() 的确认定时器与 poll() 的 cancelling 分支可能并发
    // 进入本函数——两路同时推进 cancelChecks 会把「两次观测」误算成四次（提前
    // 判定取消完成），或双跑完成路径。加 in-flight 串行锁，多余进入直接返回。
    if (job.cancelPolling) return;
    job.cancelPolling = true;
    try {
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
    } finally {
      job.cancelPolling = false;
    }
  }

  function scheduleCancelPoll(job) {
    if (registry.isClosed() || job.status !== 'cancelling') return;
    if (job.pollTimer) clearTimeout(job.pollTimer);
    job.pollTimer = setTimeout(function () {
      job.pollTimer = null;
      void confirmCancellation(job);
    }, cancelPollIntervalMs);
  }

  async function poll(job) {
    if (registry.isClosed() || job.status === 'cancelled' || !job.upstreamId) return;
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
       job.progress = null;
       job.progressText = status === 'success' ? '生成完成' : status === 'error' || status === 'failed' ? 'ComfyUI 执行失败' : 'ComfyUI 正在推理…';
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
      // 2026-08-16 审计（与 video.js 同款）：materialize 期间用户可能已取消——
      // 状态离开 running 时丢弃结果并保持取消流程，避免「取消后任务复活为
      // succeeded」且残留结果文件。
      if (job.status !== 'running') {
        removeResult(job);
        return;
      }
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
    validateResources(job.input);
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
    job.progressText = '已提交，等待 ComfyUI 执行…';
    progressMonitor.watch(promptId, job);
    schedulePoll(job, 0);
  }

  function create(input, owner) {
    if (pendingCount() >= MAX_PENDING) throw serviceError(429, 'ANIMA_QUEUE_FULL', 'Anima 队列已满，请稍后再试');
    var id = crypto.randomBytes(18).toString('hex');
    var createdAt = Date.now();
    // 2026-08-20：Anima hires 接入本地 ESRGAN 真超分（Remacri）。buildWorkflow 是纯函数
    // 无法探测模型文件，这里在入队前探测并注入；只对 anima family（非 krea2）hires 生效，
    // 未安装模型时保持原 latent bicubic 回退；'Latent' 放大器显式跳过像素超分（2026-08-25 可选）。
    if (input.hiresFix && input.family !== 'krea2' && !input.superResModel && input.hiresUpscaler !== 'Latent') {
      var localSuperRes = superres.availableSuperRes(config);
      if (localSuperRes) input.superResModel = localSuperRes;
    }
    var frozenInput = Object.freeze(Object.assign({}, input));
    var metadataLoras = frozenInput.loras
      ? Object.freeze(frozenInput.loras.map(function (lora) { return Object.freeze({ id:lora.id, strength:lora.strength }); }))
      : Object.freeze(frozenInput.loraId ? [Object.freeze({ id:frozenInput.loraId, strength:frozenInput.loraStrength })] : []);
    var job = {
      id:id,
      owner:owner,
      provider:provider,
      input:frozenInput,
      metadata:Object.freeze({
         engine:frozenInput.family || engine, id:id, prompt:frozenInput.prompt, negative:frozenInput.negative,
        profileId:frozenInput.profileId || '', modelId:frozenInput.modelId, loraId:frozenInput.loraId,
          loras:metadataLoras, loraStrength:frozenInput.loraStrength, styleLoraId:frozenInput.styleLoraId || null, width:frozenInput.width, height:frozenInput.height,
         hiresFix:Boolean(frozenInput.hiresFix), hiresScale:frozenInput.hiresScale, hiresUpscaler:frozenInput.superResModel ? 'Remacri' : frozenInput.hiresUpscaler,
         hiresSteps:frozenInput.hiresSteps, denoisingStrength:frozenInput.denoisingStrength, faceDetailer:Boolean(frozenInput.faceDetailer),
        steps:frozenInput.steps, cfg:frozenInput.cfg, sampler:frozenInput.sampler || 'res_multistep', scheduler:frozenInput.scheduler || 'simple',
        hiresSampler:frozenInput.family !== 'krea2' && Boolean(frozenInput.hiresFix) && !frozenInput.superResModel ? HIRES_SAMPLER : null,
        hiresScheduler:frozenInput.family !== 'krea2' && Boolean(frozenInput.hiresFix) && !frozenInput.superResModel ? HIRES_SCHEDULER : null,
        teaCache:Boolean(frozenInput.teaCache), teaCacheThresh:frozenInput.teaCacheThresh,
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
       progress:null,
       progressText:'等待提交到 ComfyUI…',
       currentNode:null,
      cancelFailures:0,
      cancelChecks:0,
      cancelDeadline:0,
      cancelPolling:false
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
    if (job.upstreamId) progressMonitor.unwatch(job.upstreamId);
    if (job.pollTimer) { clearTimeout(job.pollTimer); job.pollTimer = null; }
    if (job.gcTimer) { clearTimeout(job.gcTimer); job.gcTimer = null; }
    removeResult(job);
    jobs.delete(job.id);
    cleanupOwnedInputs();
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
    var modelRootPath = modelRoot(config);
    function available(model) {
      var encoder = model.family === 'krea2' ? 'qwen3-vl-4b-heretic_fp8_e4m3fn.safetensors' : 'qwen_3_06b_base.safetensors';
       return resourceExists(modelRootPath, 'diffusion_models', model.file)
         && resourceExists(modelRootPath, 'text_encoders', encoder)
         && resourceExists(modelRootPath, 'vae', 'qwen_image_vae.safetensors');
    }
    return {
      online:false,
        models:Object.keys(MODELS).map(function (id) { var model = MODELS[id]; return { id:id, label:model.label, family:model.family, profileId:model.profileId, available:available(model), defaults:{ steps:model.steps, cfg:model.cfg, sampler:model.sampler, scheduler:model.scheduler }, sizes:model.sizes, capabilities:{ negative:model.family !== 'krea2', lora:model.family === 'anima', noLora:model.noLora === true, characterIdentity:model.family === 'anima', experimental:model.family === 'krea2' || model.noLora === true } }; }),
      loras:Object.keys(LORAS).map(function (id) {
        var lora = LORAS[id];
        return { id:id, name:lora.name, character:lora.character, preview:Boolean(lora.preview), validation:lora.validation || 'production', available:resourceExists(loraRoot, '', lora.file) };
      }),
      styleLoras:Object.keys(KREA_STYLE_LORAS).map(function (id) { var style = KREA_STYLE_LORAS[id]; return { id:id, trigger:style.trigger, recommendedStrength:1, available:resourceExists(loraRoot, '', style.file) }; }),
      characters:Object.keys(CHARACTERS).map(function (id) { return CHARACTERS[id]; }),
      // 2026-08-20：本地 ESRGAN 真超分可用性（Anima hires 默认自动走 Remacri）。
      hires:{ superResModel:superres.availableSuperRes(config) || null },
      pending:pendingCount(),
      maxPending:MAX_PENDING
    };
  }

  async function probe() {
    // P3 收口：探活统一走 server/upstream-health（与控制面板同一份判定口径）
    return upstreamHealth.pingComfy(config.COMFY_HOST, 2500);
  }

  function close() {
    registry.close();
    progressMonitor.close();
    clearInterval(inputCleanupTimer);
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
    cleanupOwnedInputs();
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
      constants:{ MODELS:MODELS, LORAS:LORAS, KREA_STYLE_LORAS:KREA_STYLE_LORAS, MAX_PENDING:MAX_PENDING, JOB_TTL_MS:jobTtlMs, CANCEL_TIMEOUT_MS:cancelTimeoutMs }
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
      if (routeFamily(req) === 'anima') data.models = data.models.filter(function (model) { return model.family === 'anima'; });
      data.online = online && data.models.some(function (model) { return model.available === true; });
      res.setHeader('Cache-Control', 'no-store');
      envelope.ok(res, data);
    }).catch(function () {
       var data = service.status();
       if (routeFamily(req) === 'anima') data.models = data.models.filter(function (model) { return model.family === 'anima'; });
       data.online = false;
      res.setHeader('Cache-Control', 'no-store');
      envelope.ok(res, data);
    });
  });

  router.post(['/api/anima/images', '/api/creative/images'], jobLimit, express.json({ limit:'28mb' }), async function (req, res) {
    try {
      if (!isPlainObject(req.body) || typeof req.body.image !== 'string') {
        return envelope.fail(res, 400, '请求体必须包含 image base64 字符串', { code:'INVALID_BODY' });
      }
      var base64Data = req.body.image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      var buffer = Buffer.from(base64Data, 'base64');
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
        return envelope.fail(res, 400, '图片数据超出大小限制', { code:'INVALID_IMAGE' });
      }
      var ext = sniffImageExtension(buffer);
      if (!ext) {
        return envelope.fail(res, 400, '不支持的图片格式（仅限 PNG、JPEG、WebP）', { code:'INVALID_IMAGE_FORMAT' });
      }
      var hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 24);
      var filename = 'aics_anima_input_' + hash + '.' + ext;
      var targetDir = imageInputRoot(config);
      fs.mkdirSync(targetDir, { recursive:true });
      var targetPath = path.resolve(targetDir, filename);
      // 异步写盘，避免 ≤20MB 同步写冻结事件循环（2026-08-21 性能审计 #1）
      await fs.promises.writeFile(targetPath, buffer);
      return envelope.ok(res, { ok:true, name:filename });
    } catch (error) {
      return envelope.fail(res, 500, error.message || '图片保存失败', { code:'IMAGE_SAVE_FAILED' });
    }
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
      return envelope.fail(res, error.status === 503 ? 503 : (error.status >= 500 ? 502 : (error.status || 502)),
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
  validateImageReference:validateImageReference,
  cleanupImageInputs:cleanupImageInputs,
  constants:{
    MODELS:MODELS,
    LORAS:LORAS,
    KREA_STYLE_LORAS:KREA_STYLE_LORAS,
    generationContract:generationContract
  }
};
