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
    summary:'本地 768p 原生立体声音频，适合最终成片；模型更重、速度待实测。',
    executable:false,
    modes:['text', 'image', 'first-last-frame'],
    requirements:[
      ['diffusion_models', 'minimax_h3_fl2va_pruned_int8_convrot.safetensors'],
      ['text_encoders', 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors'],
      ['vae', 'minimax_h3_video_vae_fp16.safetensors'],
      ['vae', 'minimax_h3_audio_vae_fp32.safetensors'],
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

var DURATIONS = Object.freeze({
  3:{ seconds:3, frames:73 },
  5:{ seconds:5, frames:121 },
});

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

var ALLOWED_INPUT_KEYS = new Set([
  'prompt', 'negative', 'modelId', 'aspectRatio', 'duration',
  'camera', 'motion', 'seed',
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

function validateInput(body) {
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
  var aspect = ASPECTS[body.aspectRatio];
  if (!aspect) throw serviceError(400, 'INVALID_PARAMETER', '不支持的画面比例');
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

  return Object.freeze({
    prompt:[
      body.prompt.trim(),
      CAMERA[body.camera],
      MOTION[body.motion],
      '动作从开始到结束保持连续，角色身份、服装、光照和场景结构一致。',
    ].join('\n'),
    originalPrompt:body.prompt.trim(),
    negative:[WAN_NEGATIVE, String(body.negative || '').trim()].filter(Boolean).join('，'),
    modelId:model.id,
    aspectRatio:body.aspectRatio,
    width:aspect.width,
    height:aspect.height,
    duration:duration.seconds,
    frames:duration.frames,
    fps:24,
    camera:body.camera,
    motion:body.motion,
    seed:seed,
    steps:20,
    cfg:5,
  });
}

function buildWorkflow(input) {
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
      format:'mp4',
      codec:{ codec:'h264', encoding:{ encoding:'re-encode', crf:20 } },
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
    res.setHeader('Cache-Control', 'no-store');
    envelope.ok(res, {
      online:online,
      pending:service.pendingCount(),
      maxPending:MAX_PENDING,
      models:models,
      defaults:{
        modelId:'wan2.2-ti2v-5b',
        aspectRatio:'landscape',
        duration:3,
        camera:'still',
        motion:'subtle',
      },
    });
  });

  router.post('/api/video/jobs', jobLimit, express.json({ limit:MAX_BODY }), async function (req, res) {
    var input;
    try { input = validateInput(req.body); } catch (error) {
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
    DURATIONS:DURATIONS,
    OUTPUT_NODE_ID:OUTPUT_NODE_ID,
    OUTPUT_FILENAME_PREFIX:OUTPUT_FILENAME_PREFIX,
  },
};
