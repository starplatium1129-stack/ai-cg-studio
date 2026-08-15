'use strict';

var crypto = require('crypto');
var express = require('express');
var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');
var security = require('../server/security');
var envelope = require('../server/http-envelope');

var MAX_BODY = '32kb';
var MAX_PENDING = 2;
var MAX_PROMPT_LENGTH = 4000;
var MAX_NEGATIVE_LENGTH = 2000;
var MAX_VIDEO_BYTES = 256 * 1024 * 1024;
var MAX_IMAGE_BYTES = 20 * 1024 * 1024;
var IMAGE_INPUT_PREFIX = 'aics_video_input_';
var JOB_TIMEOUT_MS = 45 * 60 * 1000;
var JOB_TTL_MS = 2 * 60 * 60 * 1000;
var POLL_INTERVAL_MS = 1000;
var OUTPUT_NODE_ID = '11';
var OUTPUT_FILENAME_PREFIX = 'aics_video';

var WAN_NEGATIVE = [
  '色调艳丽', '过曝', '静态', '细节模糊不清', '字幕', '水印',
  '整体发灰', '最差质量', '低质量', 'JPEG压缩残留',
  '肢体畸形', '多余的手指', '画得不好的手部', '画得不好的脸部',
  '静止不动的画面', '杂乱的背景',
].join('，');

var MODEL_CATALOG = Object.freeze([
  {
    id:'wan2.2-ti2v-5b',
    label:'Wan 2.2 TI2V 5B',
    family:'wan2.2',
    tier:'本机推荐',
    summary:'16GB 显存优先路线，先从短片稳定闭环开始。',
    executable:true,
    modes:['text'],
    requirements:[
      ['diffusion_models', 'wan2.2_ti2v_5B_fp16.safetensors'],
      ['text_encoders', 'umt5_xxl_fp8_e4m3fn_scaled.safetensors'],
      ['vae', 'wan2.2_vae.safetensors'],
    ],
  },
  {
    id:'minimax-h3',
    label:'MiniMax H3',
    family:'minimax-h3',
    tier:'高上限成片',
    summary:'本地 768p 原生立体声音频与口型，画质上限最高；16GB 显存建议从 3 秒短片起步。',
    executable:true,
    modes:['text', 'image', 'first-last-frame'],
    requirements:[
      ['diffusion_models', 'minimax_h3_fl2va_pruned_int8_convrot.safetensors'],
      ['text_encoders', 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors'],
      ['vae', 'minimax_h3_video_vae_fp16.safetensors'],
      ['vae', 'minimax_h3_audio_vae_fp32.safetensors'],
      ['loras', 'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors'],
    ],
  },
  {
    id:'wan2.2-14b',
    label:'Wan 2.2 14B',
    family:'wan2.2',
    tier:'高质量扩展',
    summary:'更高质量的文生/图生视频路线，需独立工作流和显存实测。',
    executable:false,
    modes:['text', 'image', 'first-last-frame'],
    requirements:[],
  },
  {
    id:'hunyuan-video-1.5',
    label:'HunyuanVideo 1.5',
    family:'hunyuan',
    tier:'高质量扩展',
    summary:'面向 720p 与超分链路，待本机资源和耗时验证。',
    executable:false,
    modes:['text', 'image'],
    requirements:[],
  },
  {
    id:'ltx-2.3',
    label:'LTX-2.3',
    family:'ltx',
    tier:'快速迭代扩展',
    summary:'适合快速预演与音视频扩展，待适配官方子图工作流。',
    executable:false,
    modes:['text', 'image', 'first-last-frame'],
    requirements:[],
  },
]);

var MODEL_BY_ID = Object.freeze(MODEL_CATALOG.reduce(function (result, model) {
  result[model.id] = model;
  return result;
}, {}));

var ASPECTS = Object.freeze({
  landscape:{ width:832, height:480, label:'横屏 16:9' },
  portrait:{ width:480, height:832, label:'竖屏 9:16' },
  square:{ width:640, height:640, label:'方形 1:1' },
});

// 画质档位（16GB 显存实测区间 0.2—0.5MP；h3lite 部署矩阵与官方 ResolutionSelector
// 对齐：0.4MP 是官方常规画布，0.5MP 是 16GB 探索上限，720p(≈0.9MP) 需大显存或超分）。
// 所有尺寸均为 32 倍数、短边 ≤768、面积 ≤768×1344。
var QUALITIES = Object.freeze({
  fast:Object.freeze({
    label:'快速',
    summary:'约 1—2 分钟/条 · 试镜与找方向',
    sizes:Object.freeze({
      landscape:Object.freeze({ width:608, height:352 }),
      portrait:Object.freeze({ width:352, height:608 }),
      square:Object.freeze({ width:448, height:448 }),
    }),
  }),
  standard:Object.freeze({
    label:'标准',
    summary:'约 2.5—4.5 分钟/条 · 日常主力（官方常规画布）',
    sizes:Object.freeze({
      landscape:Object.freeze({ width:832, height:480 }),
      portrait:Object.freeze({ width:480, height:832 }),
      square:Object.freeze({ width:640, height:640 }),
    }),
  }),
  fine:Object.freeze({
    label:'精细',
    summary:'约 3.5—6 分钟/条 · 16GB 上限档',
    sizes:Object.freeze({
      landscape:Object.freeze({ width:960, height:544 }),
      portrait:Object.freeze({ width:544, height:960 }),
      square:Object.freeze({ width:768, height:768 }),
    }),
  }),
});

var DURATIONS = Object.freeze({
  3:{ seconds:3, frames:73 },
  5:{ seconds:5, frames:121 },
});

// MiniMax H3 按 24fps 换算帧数后向上对齐到 17k+5 网格（模型训练网格，
// 与官方模板 ComfyMathExpression 一致：count + (5 - count % 17) % 17）。
function h3FrameCount(seconds) {
  var count = Math.max(5, Math.round(seconds * 24));
  return count + (5 - (count % 17)) % 17;
}

var CAMERA = Object.freeze({
  still:'固定镜头，画面稳定，仅保留自然的微小运动。',
  push:'镜头缓慢推进，保持主体居中且运动连续。',
  pull:'镜头缓慢拉远，逐步显露环境关系。',
  pan:'镜头平稳横移，速度均匀，不要突然变焦。',
  orbit:'镜头轻微环绕主体，运动克制并保持身份稳定。',
});

var MOTION = Object.freeze({
  subtle:'主体只有呼吸、眨眼、发丝和衣摆等细微运动。',
  natural:'主体做一个清晰、自然、连续的动作，避免反复和突变。',
  expressive:'主体动作更有表现力，但肢体结构和身份始终保持一致。',
});

// H3 是自然语言模型：镜头/主体运动按官方提示词规范
// （MiniMax-AI/MiniMax-H3 h3-prompt-writing skill，base-en.txt）写成英文自然句——
// 镜头运动 = 运动类型 + 幅度 + 速度，写进镜头描述而不是堆叠标签。
var H3_CAMERA = Object.freeze({
  still:'The camera holds a static shot.',
  push:'The camera pushes in at a slow, steady pace.',
  pull:'The camera pulls out at a slow, steady pace.',
  pan:'The camera pans steadily to the side, without abrupt zooms.',
  orbit:'The camera arcs around the subject with restrained motion, keeping the composition stable.',
});

var H3_MOTION = Object.freeze({
  subtle:'The subject moves only subtly: breathing, blinking, hair and clothing swaying.',
  natural:'The subject performs one clear, natural, continuous action, avoiding repetition or abrupt changes.',
  expressive:'The subject\'s action is more expressive while body structure and identity stay consistent.',
});

// H3 官方 base-en.txt 要求 [Shot 1] 开头声明整体风格与初始构图（4.1）；
// 本项目出图链路全是二次元风格，默认 2D-animated, cinematic。
var H3_STYLE = '2D-animated, cinematic';

// 官方 4.6/4.7：soundscape 用 1-4 句具体声音；music 写乐器/速度/节奏/动态，
// 禁止抽象情绪词（"fits the mood" 之类）或解释配乐的情绪功能。
// 无音频输入时用下面这组具体化的默认模板。
var H3_SOUNDSCAPE = 'Quiet ambient room tone with subtle movement sounds — soft fabric rustle and gentle breathing; no dialogue, no voiceover.';
var H3_MUSIC = 'Soft piano notes at a slow tempo joined by sustained low strings, volume gently rising then fading at the end.';

var ALLOWED_INPUT_KEYS = new Set([
  'prompt', 'negative', 'modelId', 'aspectRatio', 'duration',
  'camera', 'motion', 'seed', 'image', 'quality',
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

function modelRoot(config) {
  return path.resolve(
    config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI'),
    'ComfyUI',
    'models'
  );
}

// 首帧图片写入 ComfyUI/input，由 LoadImage 节点按文件名读取。
function imageInputRoot(config) {
  return path.resolve(
    config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI'),
    'ComfyUI',
    'input'
  );
}

function imageInputAvailable(config, name) {
  if (typeof name !== 'string' || !IMAGE_INPUT_PATTERN.test(name)) return false;
  var target = path.resolve(imageInputRoot(config), name);
  try { return fs.statSync(target).isFile(); } catch (error) { return false; }
}

var IMAGE_INPUT_PATTERN = /^aics_video_input_[a-f0-9]{16,40}\.(png|jpg|jpeg|webp)$/i;

// 魔数识别：只信任解码后的真实格式，不信任客户端声称的 type。
function sniffImageExtension(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50
    && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// 只读文件头取真实像素尺寸（PNG IHDR / JPEG SOF / WebP VP8*），不整图解码。
function readImageSize(file) {
  var buffer = fs.readFileSync(file);
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50
    && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width:buffer.readUInt32BE(16), height:buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    var offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      var marker = buffer[offset + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { offset += 2; continue; }
      var length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height:buffer.readUInt16BE(offset + 5), width:buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP') {
    var chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8 ' && buffer.length >= 30) {
      return { width:buffer.readUInt16LE(26) & 0x3fff, height:buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && buffer.length >= 25) {
      var bits = buffer.readUInt32LE(21);
      return { width:(bits & 0x3fff) + 1, height:((bits >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return { width:buffer.readUIntLE(24, 3) + 1, height:buffer.readUIntLE(27, 3) + 1 };
    }
  }
  return null;
}

// 按原图比例 + 档位目标面积计算 H3 画布：32 对齐、短边 ≤768、面积 ≤768×1344。
// 比例收敛到 0.5—2 防极端画幅；对齐后比例偏差 ≤~3%，肉眼无感。
function fitCanvasToRatio(width, height, quality) {
  var ratio = Math.min(2, Math.max(0.5, width / height));
  var targetArea = quality.sizes.landscape.width * quality.sizes.landscape.height;
  var canvasW = Math.max(32, Math.round(Math.sqrt(targetArea * ratio) / 32) * 32);
  var canvasH = Math.max(32, Math.round(Math.sqrt(targetArea / ratio) / 32) * 32);
  if (Math.min(canvasW, canvasH) > 768) {
    var edgeScale = 768 / Math.min(canvasW, canvasH);
    canvasW = Math.max(32, Math.round(canvasW * edgeScale / 32) * 32);
    canvasH = Math.max(32, Math.round(canvasH * edgeScale / 32) * 32);
  }
  if (canvasW * canvasH > 768 * 1344) {
    var areaScale = Math.sqrt((768 * 1344) / (canvasW * canvasH));
    canvasW = Math.max(32, Math.round(canvasW * areaScale / 32) * 32);
    canvasH = Math.max(32, Math.round(canvasH * areaScale / 32) * 32);
  }
  return { width:canvasW, height:canvasH };
}

function resourceAvailable(root, kind, file) {
  var base = path.resolve(root, kind);
  var target = path.resolve(base, file);
  if (target.indexOf(base + path.sep) !== 0) return false;
  try { return fs.statSync(target).isFile(); } catch (error) { return false; }
}

function modelAvailability(config, model) {
  var root = modelRoot(config);
  var missing = model.requirements.filter(function (requirement) {
    return !resourceAvailable(root, requirement[0], requirement[1]);
  }).map(function (requirement) {
    return requirement[0] + '/' + requirement[1];
  });
  return {
    available:model.executable && missing.length === 0,
    missing:missing,
    reason:!model.executable ? '适配器待验证' : (missing.length ? '缺少本机模型文件' : ''),
  };
}

function validateInput(body, config) {
  if (!isPlainObject(body)) throw serviceError(400, 'INVALID_BODY', '请求体必须是 JSON 对象');
  Object.keys(body).forEach(function (key) {
    if (!ALLOWED_INPUT_KEYS.has(key)) {
      throw serviceError(400, 'UNKNOWN_PARAMETER', '不支持的参数：' + key);
    }
  });

  ['prompt', 'modelId', 'aspectRatio', 'duration', 'camera', 'motion'].forEach(function (key) {
    if (!hasOwn(body, key)) throw serviceError(400, 'MISSING_PARAMETER', '缺少参数：' + key);
  });
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_LENGTH) {
    throw serviceError(400, 'INVALID_PARAMETER', '画面描述需为 1—' + MAX_PROMPT_LENGTH + ' 字符');
  }
  if (body.negative !== undefined && (typeof body.negative !== 'string' || body.negative.length > MAX_NEGATIVE_LENGTH)) {
    throw serviceError(400, 'INVALID_PARAMETER', '负向描述需为不超过 ' + MAX_NEGATIVE_LENGTH + ' 字符的文本');
  }
  var model = MODEL_BY_ID[body.modelId];
  if (!model) throw serviceError(400, 'UNKNOWN_MODEL', '未知视频模型');
  if (!model.executable) throw serviceError(409, 'MODEL_ADAPTER_UNAVAILABLE', '该模型仍在适配与实测阶段');
  var quality = body.quality === undefined || body.quality === null || body.quality === ''
    ? 'standard'
    : body.quality;
  if (typeof quality !== 'string' || !QUALITIES[quality]) {
    throw serviceError(400, 'INVALID_PARAMETER', '不支持的画质档位');
  }
  var image = body.image;
  if (image !== undefined && image !== null && image !== '') {
    // 只接受本服务上传接口写入的受控文件名，杜绝任意路径/文件名注入。
    if (typeof image !== 'string' || !IMAGE_INPUT_PATTERN.test(image)) {
      throw serviceError(400, 'INVALID_PARAMETER', '图片引用格式不受支持');
    }
    if (config && !imageInputAvailable(config, image)) {
      throw serviceError(400, 'INVALID_PARAMETER', '图片文件不存在或已过期');
    }
  }
  var aspect;
  if (body.aspectRatio === 'original') {
    // 跟随首帧图比例：读图片真实尺寸 → 按档位面积 + 原图比例计算画布（等比例无变形）。
    if (!image) throw serviceError(400, 'INVALID_PARAMETER', '跟随原图比例需要先上传首帧图');
    if (!config) throw serviceError(400, 'INVALID_PARAMETER', '缺少图片文件上下文');
    if (!imageInputAvailable(config, image)) throw serviceError(400, 'INVALID_PARAMETER', '图片文件不存在或已过期');
    var imageSize = readImageSize(path.resolve(imageInputRoot(config), image));
    if (!imageSize || !(imageSize.width > 0) || !(imageSize.height > 0)) {
      throw serviceError(400, 'INVALID_PARAMETER', '无法解析首帧图尺寸');
    }
    aspect = fitCanvasToRatio(imageSize.width, imageSize.height, QUALITIES[quality]);
  } else {
    aspect = QUALITIES[quality].sizes[body.aspectRatio];
    if (!aspect) throw serviceError(400, 'INVALID_PARAMETER', '不支持的画面比例');
  }
  var duration = DURATIONS[body.duration];
  if (!duration) throw serviceError(400, 'INVALID_PARAMETER', '时长只支持 3 秒或 5 秒');
  if (!CAMERA[body.camera]) throw serviceError(400, 'INVALID_PARAMETER', '不支持的镜头运动');
  if (!MOTION[body.motion]) throw serviceError(400, 'INVALID_PARAMETER', '不支持的主体运动');
  var seed = body.seed;
  if (seed === undefined || seed === null || seed === '') {
    seed = crypto.randomInt(0, 0x7fffffff);
  }
  if (typeof seed !== 'number' || !Number.isSafeInteger(seed) || seed < 0 || seed > 0x7fffffff) {
    throw serviceError(400, 'INVALID_PARAMETER', 'seed 需为 0—2147483647 的整数');
  }

  var isH3 = model.family === 'minimax-h3';
  var isI2va = isH3 && Boolean(image);

  return Object.freeze({
    // H3 按官方三段式组装（MiniMax-AI/MiniMax-H3 h3-prompt-writing skill，
    // references/base-en.txt）：
    // - I2VA 首行 <Picture 1> 引用指令（逐字按官方模板），空一行再进三段式；
    // - [Shot 1] 开头声明整体风格（官方 4.1）；
    // - 镜头/运动写成自然句（官方 4.3）；
    // - soundscape/music 写具体声音与器乐节奏，不用抽象情绪词（官方 4.6/4.7）。
    prompt:isH3 ? (isI2va ? [
      'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.',
      '',
      'integrated_multimodal_description: [Shot 1] ' + H3_STYLE + ' — preserve the subject, clothing, hairstyle, and scene from <Picture 1>, then ' + body.prompt.trim(),
      H3_CAMERA[body.camera],
      H3_MOTION[body.motion],
      'Character identity, clothing, lighting, and scene structure remain consistent from start to finish.',
      '',
      'overall_soundscape: ' + H3_SOUNDSCAPE,
      '',
      'non_diegetic_music: ' + H3_MUSIC,
    ].join('\n') : [
      'integrated_multimodal_description: [Shot 1] ' + H3_STYLE + ', ' + body.prompt.trim(),
      H3_CAMERA[body.camera],
      H3_MOTION[body.motion],
      'Character identity, clothing, lighting, and scene structure remain consistent from start to finish.',
      '',
      'overall_soundscape: ' + H3_SOUNDSCAPE,
      '',
      'non_diegetic_music: ' + H3_MUSIC,
    ].join('\n')) : [
      body.prompt.trim(),
      CAMERA[body.camera],
      MOTION[body.motion],
      '动作从开始到结束保持连续，角色身份、服装、光照和场景结构一致。',
    ].join('\n'),
    originalPrompt:body.prompt.trim(),
    // H3 是自然语言模型：负向词会污染语义，保持空；Wan 仍走中文负面清单。
    negative:isH3 ? '' : [WAN_NEGATIVE, String(body.negative || '').trim()].filter(Boolean).join('，'),
    modelId:model.id,
    aspectRatio:body.aspectRatio,
    quality:quality,
    width:aspect.width,
    height:aspect.height,
    duration:duration.seconds,
    frames:isH3 ? h3FrameCount(duration.seconds) : duration.frames,
    fps:24,
    camera:body.camera,
    motion:body.motion,
    seed:seed,
    image:image || null,
    steps:isH3 ? 8 : 20,
    cfg:5,
  });
}

function buildWorkflow(input) {
  if (input.modelId === 'minimax-h3') return buildH3Workflow(input);
  return buildWanWorkflow(input);
}

// MiniMax H3 原生工作流（lightx2v Turbo 版，官方 ModelTC 推荐 T2VA 图）。
// 节点图与官方模板
// （ModelTC/Minimax-H3-Turbo example_workflows/video_minimax_h3_t2v_lightx2v_turbo.json）
// 保持一致，全部为 ComfyUI 核心节点：
// UNETLoader → LoraLoaderModelOnly（Turbo LoRA，strength 1.0）→
// MiniMaxH3SigmaShift（shift_video 12 / shift_audio 3）→
// BasicGuider + BasicScheduler(simple, 8 步) + KSamplerSelect(euler) +
// SamplerCustomAdvanced + VAEDecode + VAEDecodeAudio + CreateVideo + SaveVideo。
// 20 步 → 8 步蒸馏采样（官方推荐 8 或 4 步）。SaveVideo 固定在节点 11，
// 与任务结果读取（outputs['11'].videos）契约一致。
function buildH3Workflow(input) {
  var graph = {
    '1': { class_type:'UNETLoader', inputs:{
      unet_name:'minimax_h3_fl2va_pruned_int8_convrot.safetensors',
      weight_dtype:'default',
    } },
    '2': { class_type:'CLIPLoader', inputs:{
      clip_name:'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
      type:'minimax',
      device:'default',
    } },
    '3': { class_type:'VAELoader', inputs:{ vae_name:'minimax_h3_video_vae_fp16.safetensors' } },
    '4': { class_type:'VAELoader', inputs:{ vae_name:'minimax_h3_audio_vae_fp32.safetensors' } },
    '5': { class_type:'MiniMaxH3ImageToVideo', inputs:{
      clip:['2', 0],
      vae:['3', 0],
      prompt:input.prompt,
      width:input.width,
      height:input.height,
      length:input.frames,
    } },
    '15': { class_type:'LoraLoaderModelOnly', inputs:{
      model:['1', 0],
      lora_name:'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors',
      strength_model:1,
    } },
    '16': { class_type:'MiniMaxH3SigmaShift', inputs:{
      model:['15', 0],
      shift_video:12,
      shift_audio:3,
    } },
    '6': { class_type:'RandomNoise', inputs:{ noise_seed:input.seed } },
    '7': { class_type:'KSamplerSelect', inputs:{ sampler_name:'euler' } },
    '8': { class_type:'BasicScheduler', inputs:{
      model:['16', 0],
      scheduler:'simple',
      steps:input.steps,
      denoise:1,
    } },
    '9': { class_type:'BasicGuider', inputs:{
      model:['16', 0],
      conditioning:['5', 0],
    } },
    '10': { class_type:'SamplerCustomAdvanced', inputs:{
      noise:['6', 0],
      guider:['9', 0],
      sampler:['7', 0],
      sigmas:['8', 0],
      latent_image:['5', 1],
    } },
    '12': { class_type:'VAEDecode', inputs:{ samples:['10', 0], vae:['3', 0] } },
    '13': { class_type:'VAEDecodeAudio', inputs:{ samples:['10', 0], vae:['4', 0] } },
    '14': { class_type:'CreateVideo', inputs:{
      images:['12', 0],
      audio:['13', 0],
      fps:input.fps,
      bit_depth:8,
    } },
    '11': { class_type:'SaveVideo', inputs:{
      video:['14', 0],
      filename_prefix:OUTPUT_FILENAME_PREFIX,
      // 官方模板值：format/codec 用 'auto'。SaveVideo 的 codec 是 COMFY_DYNAMICCOMBO_V3，
      // 真实执行不接受对象结构（2026-08-15 实测 execution_error: missing 'codec'）。
      format:'auto',
      codec:'auto',
    } },
  };
  // I2VA：首帧图经 LoadImage 读入 ComfyUI/input，作为 <Picture 1> 几何锚点。
  if (input.image) {
    graph['17'] = { class_type:'LoadImage', inputs:{ image:input.image } };
    graph['5'].inputs.first_frame = ['17', 0];
  }
  return graph;
}

function buildWanWorkflow(input) {
  return {
    '1': { class_type:'UNETLoader', inputs:{
      unet_name:'wan2.2_ti2v_5B_fp16.safetensors',
      weight_dtype:'default',
    } },
    '2': { class_type:'CLIPLoader', inputs:{
      clip_name:'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
      type:'wan',
      device:'default',
    } },
    '3': { class_type:'VAELoader', inputs:{ vae_name:'wan2.2_vae.safetensors' } },
    '4': { class_type:'CLIPTextEncode', inputs:{ clip:['2', 0], text:input.prompt } },
    '5': { class_type:'CLIPTextEncode', inputs:{ clip:['2', 0], text:input.negative } },
    '6': { class_type:'ModelSamplingSD3', inputs:{ model:['1', 0], shift:8 } },
    '7': { class_type:'Wan22ImageToVideoLatent', inputs:{
      vae:['3', 0],
      width:input.width,
      height:input.height,
      length:input.frames,
      batch_size:1,
    } },
    '8': { class_type:'KSampler', inputs:{
      model:['6', 0],
      positive:['4', 0],
      negative:['5', 0],
      latent_image:['7', 0],
      seed:input.seed,
      steps:input.steps,
      cfg:input.cfg,
      sampler_name:'uni_pc',
      scheduler:'simple',
      denoise:1,
    } },
    '9': { class_type:'VAEDecode', inputs:{ samples:['8', 0], vae:['3', 0] } },
    '10': { class_type:'CreateVideo', inputs:{ images:['9', 0], fps:input.fps, bit_depth:8 } },
    '11': { class_type:'SaveVideo', inputs:{
      video:['10', 0],
      filename_prefix:OUTPUT_FILENAME_PREFIX,
      // 同 H3：format/codec 用官方模板的 'auto'（动态 combo 不接受对象值）。
      format:'auto',
      codec:'auto',
    } },
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
      timeout:timeoutMs || 10000,
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
        resolve({
          status:response.statusCode || 0,
          headers:response.headers,
          body:Buffer.concat(chunks),
        });
      });
    });
    request.on('error', function (error) {
      if (error && error.code) reject(error);
      else reject(serviceError(502, 'COMFY_UNAVAILABLE', error && error.message || 'ComfyUI 不可用'));
    });
    request.on('timeout', function () {
      request.destroy(serviceError(504, 'COMFY_TIMEOUT', 'ComfyUI 请求超时'));
    });
    if (payload) request.write(payload);
    request.end();
  });
}

async function requestComfyJson(config, method, pathname, body, timeoutMs) {
  var response = await requestComfy(config, method, pathname, body, timeoutMs, 2 * 1024 * 1024);
  var data = null;
  try { data = response.body.length ? JSON.parse(response.body.toString('utf8')) : null; } catch (error) {
    throw serviceError(502, 'COMFY_INVALID_RESPONSE', 'ComfyUI 返回了无效 JSON');
  }
  if (response.status < 200 || response.status >= 300) {
    throw serviceError(502, 'COMFY_UPSTREAM_ERROR', 'ComfyUI 请求失败', {
      upstreamStatus:response.status,
    });
  }
  return data;
}

function requestOwner(req) {
  if (security.isDirectLocalRequest(req)) return 'local';
  var cookie = String(req.headers.cookie || '').match(/(?:^|;\s*)aics_token=([^;]+)/);
  var token = req.headers['x-token'] || cookie && cookie[1] || req.query && req.query.token || '';
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function ensureMediaRoot(config) {
  var outputs = config.RUNTIME && config.RUNTIME.outputs
    ? config.RUNTIME.outputs
    : path.join(config.RUNTIME_ROOT || path.join(config.ROOT_DIR, 'runtime'), 'outputs');
  var root = path.resolve(outputs, 'video');
  fs.mkdirSync(root, { recursive:true });
  return root;
}

function safeMediaPath(root, file) {
  var resolvedRoot = path.resolve(root);
  var resolved = path.resolve(root, file);
  return resolved.indexOf(resolvedRoot + path.sep) === 0 ? resolved : null;
}

function cleanupMediaRoot(config) {
  var root = ensureMediaRoot(config);
  var entries = [];
  try { entries = fs.readdirSync(root); } catch (error) { return; }
  entries.forEach(function (name) {
    var target = safeMediaPath(root, name);
    if (!target) return;
    try {
      var stat = fs.lstatSync(target);
      if (stat.isFile()) fs.unlinkSync(target);
    } catch (error) {}
  });
}

// 启动时清理由本服务写入的孤儿首帧图（网关重启后无活动任务引用它们）。
function cleanupImageInput(config) {
  var root = imageInputRoot(config);
  var entries = [];
  try { entries = fs.readdirSync(root); } catch (error) { return; }
  entries.forEach(function (name) {
    if (!IMAGE_INPUT_PATTERN.test(name)) return;
    try { fs.unlinkSync(path.resolve(root, name)); } catch (error) {}
  });
}

// 任务生命周期结束时删除其专属首帧图（文件名唯一、只被本 job 引用）。
function removeInputImage(config, name) {
  if (!IMAGE_INPUT_PATTERN.test(String(name || ''))) return;
  try { fs.unlinkSync(path.resolve(imageInputRoot(config), name)); } catch (error) {}
}

function decodePathValue(value) {
  var decoded = String(value || '');
  for (var i = 0; i < 3; i += 1) {
    var next;
    try { next = decodeURIComponent(decoded); } catch (error) {
      throw serviceError(400, 'INVALID_RESULT', '结果路径编码无效');
    }
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function validateVideoReference(value) {
  if (!isPlainObject(value)) throw serviceError(400, 'INVALID_RESULT', 'ComfyUI 视频描述无效');
  var type = String(value.type || 'output').toLowerCase();
  var filename = decodePathValue(value.filename);
  var subfolder = decodePathValue(value.subfolder || '');
  if (type !== 'output' || subfolder || filename !== path.basename(filename) || /[\\/\0]/.test(filename)) {
    throw serviceError(400, 'INVALID_RESULT', '视频结果路径不在应用允许范围内');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(?:mp4|webm|mov)$/i.test(filename)) {
    throw serviceError(400, 'INVALID_RESULT', '结果必须是受支持的视频文件');
  }
  if (!new RegExp('^' + OUTPUT_FILENAME_PREFIX + '(?:[_.-]|$)', 'i').test(filename)) {
    throw serviceError(400, 'INVALID_RESULT', '视频结果文件名前缀不受支持');
  }
  return { filename:filename, subfolder:'', type:'output' };
}

function videoMimeAndExtension(contentType, body, filename) {
  var mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  var extension = path.extname(filename).slice(1).toLowerCase();
  if ((extension === 'mp4' || extension === 'mov')
    && body.length >= 12
    && body.toString('ascii', 4, 8) === 'ftyp') {
    return { mime:extension === 'mov' ? 'video/quicktime' : 'video/mp4', extension:extension };
  }
  if (extension === 'webm'
    && body.length >= 4
    && body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mime:'video/webm', extension:'webm' };
  }
  if (mime === 'video/mp4' && extension === 'mp4') return { mime:mime, extension:extension };
  return null;
}

async function materializeResult(config, job, output) {
  var reference = validateVideoReference(output);
  var query = '?filename=' + encodeURIComponent(reference.filename) + '&type=output';
  var response = await requestComfy(config, 'GET', '/view' + query, null, 120000, MAX_VIDEO_BYTES);
  if (response.status < 200 || response.status >= 300) {
    throw serviceError(502, 'COMFY_RESULT_ERROR', 'ComfyUI 视频读取失败');
  }
  var info = videoMimeAndExtension(response.headers['content-type'], response.body, reference.filename);
  if (!info || !response.body.length || response.body.length > MAX_VIDEO_BYTES) {
    throw serviceError(502, 'INVALID_RESULT', 'ComfyUI 返回的视频格式无效');
  }
  var root = ensureMediaRoot(config);
  var target = safeMediaPath(root, job.id + '.' + info.extension);
  if (!target) throw serviceError(500, 'VIDEO_STORAGE_INVALID', '视频运行时目录无效');
  var temporary = target + '.tmp';
  fs.writeFileSync(temporary, response.body, { flag:'wx' });
  fs.renameSync(temporary, target);
  return { path:target, mime:info.mime, bytes:response.body.length };
}

function outputReference(entry) {
  var output = entry && entry.outputs && entry.outputs[OUTPUT_NODE_ID];
  var values = output && (output.images || output.videos);
  return Array.isArray(values) && values.length ? values[0] : null;
}

function createVideoService(config, dependencies) {
  dependencies = dependencies || {};
  var jobs = new Map();
  var closed = false;
  var clientId = 'aics-video-' + crypto.randomBytes(8).toString('hex');
  var jobTimeoutMs = dependencies.jobTimeoutMs || JOB_TIMEOUT_MS;
  var jobTtlMs = dependencies.jobTtlMs || JOB_TTL_MS;
  var pollIntervalMs = dependencies.pollIntervalMs || POLL_INTERVAL_MS;

  cleanupMediaRoot(config);
  cleanupImageInput(config);

  function pendingCount() {
    var count = 0;
    jobs.forEach(function (job) {
      if (job.status === 'queued' || job.status === 'running' || job.status === 'cancelling') count += 1;
    });
    return count;
  }

  function publicJob(job) {
    return {
      id:job.id,
      status:job.status,
      provider:'comfy',
      progress:job.status === 'succeeded' ? 1 : (job.status === 'running' ? 0.12 : 0),
      modelId:job.input.modelId,
      prompt:job.input.originalPrompt,
      width:job.input.width,
      height:job.input.height,
      duration:job.input.duration,
      fps:job.input.fps,
      seed:job.input.seed,
      createdAt:job.createdAt,
      resultAvailable:Boolean(job.result),
      resultUrl:job.result ? '/api/video/jobs/' + encodeURIComponent(job.id) + '/result' : null,
      error:job.error || null,
      code:job.errorCode || null,
    };
  }

  function removeJob(job) {
    if (job.pollTimer) clearTimeout(job.pollTimer);
    if (job.gcTimer) clearTimeout(job.gcTimer);
    if (job.result && job.result.path) {
      try { fs.unlinkSync(job.result.path); } catch (error) {}
    }
    if (job.input && job.input.image) removeInputImage(config, job.input.image);
    jobs.delete(job.id);
  }

  function schedulePoll(job, delay) {
    if (closed || job.status !== 'running') return;
    if (job.pollTimer) clearTimeout(job.pollTimer);
    job.pollTimer = setTimeout(function () {
      job.pollTimer = null;
      void poll(job);
    }, delay);
  }

  function failJob(job, error, fallbackCode) {
    if (job.status === 'cancelled') return;
    job.status = 'failed';
    job.errorCode = error && error.code || fallbackCode || 'VIDEO_FAILED';
    job.error = error && error.code === 'INVALID_RESULT'
      ? '视频结果未通过安全校验'
      : (error && error.status >= 500 ? '视频生成上游暂不可用' : error && error.message || '视频生成失败');
    if (job.pollTimer) clearTimeout(job.pollTimer);
    job.pollTimer = null;
  }

  async function poll(job) {
    if (closed || job.status !== 'running' || !job.upstreamId) return;
    if (Date.now() > job.deadline) {
      failJob(job, serviceError(504, 'VIDEO_TIMEOUT', '视频生成超时'), 'VIDEO_TIMEOUT');
      return;
    }
    try {
      var history = await requestComfyJson(
        config,
        'GET',
        '/history/' + encodeURIComponent(job.upstreamId),
        null,
        10000
      );
      var entry = history && history[job.upstreamId];
      if (!entry) {
        schedulePoll(job, pollIntervalMs);
        return;
      }
      var status = entry.status && entry.status.status_str;
      if (status === 'error' || status === 'failed') {
        failJob(job, serviceError(502, 'COMFY_EXECUTION_FAILED', 'ComfyUI 执行视频工作流失败'));
        return;
      }
      if (status !== 'success') {
        schedulePoll(job, pollIntervalMs);
        return;
      }
      var output = outputReference(entry);
      if (!output) {
        failJob(job, serviceError(502, 'COMFY_NO_VIDEO', 'ComfyUI 未返回视频'));
        return;
      }
      job.result = await materializeResult(config, job, output);
      job.status = 'succeeded';
      job.error = null;
      job.errorCode = null;
    } catch (error) {
      job.pollFailures += 1;
      if (error && (error.code === 'INVALID_RESULT' || error.code === 'COMFY_NO_VIDEO')) {
        failJob(job, error);
        return;
      }
      if (Date.now() > job.deadline || job.pollFailures >= 60) {
        failJob(job, error, 'VIDEO_POLL_FAILED');
        return;
      }
      schedulePoll(job, Math.min(5000, pollIntervalMs * Math.max(1, job.pollFailures)));
    }
  }

  async function submit(job) {
    var availability = modelAvailability(config, MODEL_BY_ID[job.input.modelId]);
    if (!availability.available) {
      throw serviceError(503, 'VIDEO_MODEL_UNAVAILABLE', '视频模型文件尚未安装', {
        missing:availability.missing,
      });
    }
    var response = await requestComfyJson(config, 'POST', '/prompt', {
      prompt:buildWorkflow(job.input),
      client_id:clientId,
    }, 20000);
    var promptId = response && response.prompt_id;
    if (typeof promptId !== 'string' || !promptId || promptId.length > 200) {
      throw serviceError(502, 'COMFY_INVALID_RESPONSE', 'ComfyUI 未返回有效任务 ID');
    }
    job.upstreamId = promptId;
    job.status = 'running';
    schedulePoll(job, 0);
  }

  function create(input, owner) {
    if (pendingCount() >= MAX_PENDING) {
      throw serviceError(429, 'VIDEO_QUEUE_FULL', '视频队列已满，请等待当前任务完成');
    }
    var id = crypto.randomBytes(18).toString('hex');
    var createdAt = Date.now();
    var job = {
      id:id,
      owner:owner,
      input:input,
      status:'queued',
      createdAt:createdAt,
      deadline:createdAt + jobTimeoutMs,
      upstreamId:'',
      result:null,
      error:null,
      errorCode:null,
      pollTimer:null,
      gcTimer:null,
      pollFailures:0,
    };
    jobs.set(id, job);
    job.gcTimer = setTimeout(function () { removeJob(job); }, jobTtlMs).unref();
    return job;
  }

  function get(id, owner) {
    var job = jobs.get(String(id || ''));
    return job && job.owner === owner ? job : null;
  }

  async function cancel(job) {
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') return job;
    job.status = 'cancelling';
    if (job.pollTimer) clearTimeout(job.pollTimer);
    job.pollTimer = null;
    if (job.upstreamId) {
      try {
        await requestComfyJson(
          config,
          'POST',
          '/api/jobs/' + encodeURIComponent(job.upstreamId) + '/cancel',
          null,
          10000
        );
      } catch (error) {
        job.status = 'failed';
        job.error = '无法安全取消上游视频任务';
        job.errorCode = 'VIDEO_CANCEL_FAILED';
        return job;
      }
    }
    job.status = 'cancelled';
    job.error = '任务已取消';
    job.errorCode = 'VIDEO_CANCELLED';
    return job;
  }

  async function probe() {
    var response = await requestComfy(config, 'GET', '/system_stats', null, 2500, 256 * 1024);
    return response.status >= 200 && response.status < 300;
  }

  function close() {
    closed = true;
    jobs.forEach(removeJob);
    cleanupMediaRoot(config);
  }

  return {
    create:create,
    submit:submit,
    get:get,
    cancel:cancel,
    publicJob:publicJob,
    pendingCount:pendingCount,
    probe:probe,
    close:close,
  };
}

function streamVideo(req, res, result) {
  var stat = fs.statSync(result.path);
  var range = String(req.headers.range || '');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', result.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!range) {
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(result.path).pipe(res);
    return;
  }
  var match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    res.status(416).setHeader('Content-Range', 'bytes */' + stat.size);
    res.end();
    return;
  }
  var start = match[1] ? Number(match[1]) : 0;
  var end = match[2] ? Number(match[2]) : stat.size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= stat.size) {
    res.status(416).setHeader('Content-Range', 'bytes */' + stat.size);
    res.end();
    return;
  }
  res.status(206);
  res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + stat.size);
  res.setHeader('Content-Length', String(end - start + 1));
  fs.createReadStream(result.path, { start:start, end:end }).pipe(res);
}

function createVideoRouter(config, dependencies) {
  var router = express.Router();
  var service = dependencies && dependencies.videoService
    ? dependencies.videoService
    : createVideoService(config, dependencies);
  var jobLimit = security.rateLimit({ capacity:3, refillMs:60000, label:'视频生成' });

  router.get('/api/video/status', async function (req, res) {
    var online = false;
    try { online = await service.probe(); } catch (error) {}
    var models = MODEL_CATALOG.map(function (model) {
      return Object.assign({}, model, modelAvailability(config, model), {
        requirements:model.requirements.map(function (requirement) {
          return requirement[0] + '/' + requirement[1];
        }),
      });
    });
    var qualities = Object.keys(QUALITIES).map(function (id) {
      var quality = QUALITIES[id];
      return {
        id:id,
        label:quality.label,
        summary:quality.summary,
        sizes:Object.keys(quality.sizes).reduce(function (sizes, aspectId) {
          sizes[aspectId] = quality.sizes[aspectId].width + ' × ' + quality.sizes[aspectId].height;
          return sizes;
        }, {}),
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    envelope.ok(res, {
      online:online,
      pending:service.pendingCount(),
      maxPending:MAX_PENDING,
      models:models,
      qualities:qualities,
      defaults:{
        modelId:'wan2.2-ti2v-5b',
        aspectRatio:'landscape',
        duration:3,
        camera:'still',
        motion:'subtle',
        quality:'standard',
      },
    });
  });

  // 首帧图上传：base64 JSON → 魔数校验 → 写入 ComfyUI/input（受控文件名）。
  // 浏览器把 IndexedDB 图片 blob 转 base64 传来即可，后续 jobs 用返回的 name。
  router.post('/api/video/images', jobLimit, express.json({ limit:'28mb' }), function (req, res) {
    var body = req.body;
    var data = body && body.data;
    if (typeof data !== 'string' || !data) {
      return envelope.fail(res, 400, '缺少图片数据', { code:'INVALID_IMAGE' });
    }
    var buffer;
    try { buffer = Buffer.from(data, 'base64'); } catch (error) {
      return envelope.fail(res, 400, '图片数据编码无效', { code:'INVALID_IMAGE' });
    }
    if (buffer.length < 16 || buffer.length > MAX_IMAGE_BYTES) {
      return envelope.fail(res, 400, '图片大小需在 16B—20MB 之间', { code:'INVALID_IMAGE' });
    }
    var ext = sniffImageExtension(buffer);
    if (!ext) {
      return envelope.fail(res, 400, '仅支持 PNG / JPEG / WebP 图片', { code:'INVALID_IMAGE' });
    }
    var name = IMAGE_INPUT_PREFIX + crypto.randomBytes(8).toString('hex') + '.' + ext;
    var root = imageInputRoot(config);
    var resolvedRoot = path.resolve(root);
    var target = path.resolve(root, name);
    if (target.indexOf(resolvedRoot + path.sep) !== 0) {
      return envelope.fail(res, 500, '图片存储路径无效', { code:'IMAGE_STORAGE_INVALID' });
    }
    try {
      fs.mkdirSync(resolvedRoot, { recursive:true });
      fs.writeFileSync(target, buffer, { flag:'wx' });
    } catch (error) {
      return envelope.fail(res, 500, '图片写入失败', { code:'IMAGE_WRITE_FAILED' });
    }
    envelope.ok(res, { name:name, bytes:buffer.length });
  });

  router.post('/api/video/jobs', jobLimit, express.json({ limit:MAX_BODY }), async function (req, res) {
    var input;
    try { input = validateInput(req.body, config); } catch (error) {
      return envelope.fail(res, error.status || 400, error.message, {
        code:error.code,
        detail:error.detail,
      });
    }
    var job;
    try {
      job = service.create(input, requestOwner(req));
      await service.submit(job);
    } catch (error) {
      if (job) await service.cancel(job);
      return envelope.fail(res, error.status || 502,
        error.status >= 500 ? '视频生成环境尚未就绪' : error.message,
        { code:error.code || 'VIDEO_SUBMIT_FAILED', detail:error.detail });
    }
    res.status(202);
    envelope.ok(res, { job:service.publicJob(job) });
  });

  router.get('/api/video/jobs/:id', function (req, res) {
    var job = service.get(req.params.id, requestOwner(req));
    if (!job) return envelope.fail(res, 404, '视频任务不存在', { code:'JOB_NOT_FOUND' });
    res.setHeader('Cache-Control', 'no-store');
    envelope.ok(res, { job:service.publicJob(job) });
  });

  router.delete('/api/video/jobs/:id', async function (req, res) {
    var job = service.get(req.params.id, requestOwner(req));
    if (!job) return envelope.fail(res, 404, '视频任务不存在', { code:'JOB_NOT_FOUND' });
    var cancelled = await service.cancel(job);
    envelope.ok(res, { job:service.publicJob(cancelled) });
  });

  router.get('/api/video/jobs/:id/result', function (req, res) {
    var job = service.get(req.params.id, requestOwner(req));
    if (!job || job.status !== 'succeeded' || !job.result) {
      return envelope.fail(res, 404, '视频结果不存在', { code:'RESULT_NOT_FOUND' });
    }
    try {
      streamVideo(req, res, job.result);
    } catch (error) {
      if (!res.headersSent) envelope.fail(res, 404, '视频结果不存在', { code:'RESULT_NOT_FOUND' });
      else res.destroy();
    }
  });

  return { router:router, service:service, close:service.close };
}

module.exports = {
  createVideoRouter:createVideoRouter,
  createVideoService:createVideoService,
  validateInput:validateInput,
  buildWorkflow:buildWorkflow,
  validateVideoReference:validateVideoReference,
  constants:{
    MODEL_CATALOG:MODEL_CATALOG,
    ASPECTS:ASPECTS,
    QUALITIES:QUALITIES,
    DURATIONS:DURATIONS,
    OUTPUT_NODE_ID:OUTPUT_NODE_ID,
    OUTPUT_FILENAME_PREFIX:OUTPUT_FILENAME_PREFIX,
  },
};
