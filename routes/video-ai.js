'use strict';

/**
 * routes/video-ai.js — 分镜短片「AI 整理」服务
 *
 * 给 ShotListEditor 的「AI 整理分镜」提供两个端点：
 *   GET  /api/video-ai/status   可用性探测（公开，不含密钥）
 *   POST /api/video-ai/rewrite  单镜改写（localOnly：批量改写会消耗站主 LLM 额度）
 *
 * LLM 源复用聊天链路现有配置，不新增任何设置：
 *   1. 站主 API 托管配置优先（chat_api_config.json，与 routes/chat.js 同源）；
 *   2. 没有则回退本地 Ollama（OLLAMA_HOST + OLLAMA_MODEL，模型缺失时取已装第一个）。
 *
 * 改写契约：输入静态绘图提示词 → LLM 输出 JSON
 *   { prompt, shotSize, camera, motion, dialogue }
 * prompt 是英文自然句（H3 是自然语言模型）；其余字段服务端按白名单清洗，
 * 非法值回退输入原值，模型输出永远无法把镜头参数弄坏。
 */

var express = require('express');
var fs = require('fs');
var path = require('path');
var httpClient = require('../services/http-client');
var security = require('../server/security');
var envelope = require('../server/http-envelope');
var createOllamaService = require('../services/ollama-service').createOllamaService;

// ── 站主 API 托管配置（与 routes/chat.js 完全同源，避免两套配置漂移）──────
function chatHostConfigPath(config) {
  return path.join(config.RUNTIME.state, 'chat_api_config.json');
}

function readHostConfig(config) {
  try {
    var parsed = JSON.parse(fs.readFileSync(chatHostConfigPath(config), 'utf8'));
    var baseUrl = String(parsed && parsed.baseUrl || '').trim();
    var model = String(parsed && parsed.model || '').trim();
    var apiKey = String(parsed && parsed.apiKey || '').trim();
    if (!baseUrl || !model) return null;
    // 旧格式没有 pathname：用 baseUrl 重拼一次（与 chat.js 一致）
    var pathname = typeof parsed.pathname === 'string' && parsed.pathname
      ? parsed.pathname
      : new URL('chat/completions', baseUrl.replace(/\/+$/, '') + '/').pathname;
    return { baseUrl:baseUrl, pathname:pathname, model:model, apiKey:apiKey };
  } catch (error) { return null; }
}

// ── 改写提示词（纯 ASCII；输出 JSON 是硬约束，逐字段规则给足）──────────────
var REWRITE_SYSTEM_PROMPT = [
  'You are an expert anime storyboard director and cinematic prompt engineer.',
  'The video model (MiniMax H3) is a natural-language model driven by initial frames and Ref2VA character reference sheets,',
  'so the shot description must describe what HAPPENS in the shot (dynamic actions, expressive gestures, camera trajectory, atmospheric motion), not static pixel details.',
  '',
  'Rewrite the given prompt into a cinematic video shot description and reply with ONLY a JSON object',
  'with exactly these keys: "prompt", "shotSize", "camera", "motion", "dialogue".',
  'No markdown, no code fences, no commentary, no extra text outside the JSON object.',
  '',
  '"prompt": 1-3 concise English sentences about the dynamic subject action, camera movement, and time progression of the shot.',
  'When multiple characters are referenced in the identity anchor (e.g. Character 1 and Character 2), clearly distinguish who performs which action or interaction.',
  'Keep the subject, outfit, scene, and lighting consistent with the input. Do not restate static identity tokens that reference sheets already lock.',
  'Do not describe composition details that the reference images already define. Focus on cinematic movement, expression transition, and atmospheric motion.',
  '"shotSize": "wide", "medium", "closeup", or null.',
  '"camera": "still", "push", "pull", "pan", or "orbit" - camera movement only when it serves the action, otherwise "still".',
  '"motion": "subtle" (breathing/blinking only), "natural" (one clear continuous action), or "expressive" (dramatic action).',
  '"dialogue": one short line the subject speaks, matching the scene language (Chinese scene -> Chinese line),',
  'at most 20 Chinese characters or 60 English characters; use "" when the shot needs no speech.',
  'If the input already describes motion or camera movement, keep and refine it; never contradict it.'
].join('\n');

var SHOT_SIZE_VALUES = ['wide', 'medium', 'closeup'];
var CAMERA_VALUES = ['still', 'push', 'pull', 'pan', 'orbit'];
var MOTION_VALUES = ['subtle', 'natural', 'expressive'];

function buildRewriteUserPrompt(value) {
  return [
    'Identity anchor (for reference only, do not restate it in the shot description): ' + (value.identity || '(none)'),
    '',
    'Still-image prompt (what generated the first frame):',
    value.prompt,
    '',
    'Current shot parameters: shotSize=' + (value.shotSize || 'default')
      + ', camera=' + value.camera + ', motion=' + value.motion
      + (value.dialogue ? ', dialogue=' + value.dialogue : ''),
    '',
    'Rewrite this shot for video:'
  ].join('\n');
}

var REWRITE_BODY_KEYS = new Set(['identity', 'prompt', 'shotSize', 'camera', 'motion', 'dialogue']);

// ── 整批节奏编排（/api/video-ai/polish）────────────────────────────────
// 与逐镜 rewrite 的分工：rewrite 逐镜独立改写描述；polish 用全局视角审
// 整批镜头，只调整构图字段（景别/镜头/运动/对白），让全片有节奏——
// 景别不连续扎堆、镜头运动不全是固定、台词不连续挤爆、动作强度匹配。
// 输出按 index 对齐，字段为 null = 保持当前值，绝不改动描述本身。
var POLISH_SYSTEM_PROMPT = [
  'You are a storyboard rhythm editor for an anime video.',
  'Review the WHOLE shot list and adjust ONLY the composition choices so the sequence has rhythm and variety.',
  '',
  'Reply with ONLY a JSON object: {"shots":[{"index":0,"shotSize":null,"camera":null,"motion":null,"dialogue":null}, ...]}',
  'with exactly one entry per shot, in the same order. No markdown, no commentary.',
  '',
  'Rules:',
  '- Only set a field when you have a concrete reason; null keeps the current value.',
  '- "shotSize": "wide" | "medium" | "closeup" - avoid long runs of the same size; open scenes wide, emotional beats closeup.',
  '- "camera": "still" | "push" | "pull" | "pan" | "orbit" - avoid every shot being "still"; camera movement must serve the action described.',
  '- "motion": "subtle" | "natural" | "expressive" - match the action intensity in the description.',
  '- "dialogue": a short line (at most 20 Chinese characters); thin out dialogue when too many consecutive shots have lines; use "" when silence is better.',
  '- NEVER change the shot description (prompt) itself, NEVER contradict explicit actions in the descriptions, NEVER invent new characters.',
  '- If the whole list is already well varied, set every field to null (keep all).'
].join('\n');

var MAX_POLISH_SHOTS = 30;

function validatePolishBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error:'请求体必须是 JSON 对象' };
  }
  var identity = String(body.identity || '').trim().slice(0, 600);
  if (!Array.isArray(body.shots) || body.shots.length < 2 || body.shots.length > MAX_POLISH_SHOTS) {
    return { error:'分镜数量需为 2—' + MAX_POLISH_SHOTS };
  }
  var shots = [];
  for (var i = 0; i < body.shots.length; i += 1) {
    var shot = body.shots[i];
    if (!shot || typeof shot !== 'object' || Array.isArray(shot)) {
      return { error:'第 ' + (i + 1) + ' 个分镜必须是对象' };
    }
    var prompt = String(shot.prompt || '').trim();
    if (!prompt || prompt.length > 4000) return { error:'第 ' + (i + 1) + ' 个分镜描述需为 1—4000 字符' };
    var shotSize = shot.shotSize === null || shot.shotSize === undefined || shot.shotSize === ''
      ? null
      : String(shot.shotSize);
    if (shotSize !== null && SHOT_SIZE_VALUES.indexOf(shotSize) === -1) {
      return { error:'第 ' + (i + 1) + ' 个分镜景别不支持' };
    }
    var camera = String(shot.camera || 'still');
    if (CAMERA_VALUES.indexOf(camera) === -1) return { error:'第 ' + (i + 1) + ' 个分镜镜头运动不支持' };
    var motion = String(shot.motion || 'subtle');
    if (MOTION_VALUES.indexOf(motion) === -1) return { error:'第 ' + (i + 1) + ' 个分镜主体运动不支持' };
    var dialogue = String(shot.dialogue || '').trim().slice(0, 300);
    shots.push({ prompt:prompt, shotSize:shotSize, camera:camera, motion:motion, dialogue:dialogue });
  }
  return { value:{ identity:identity, shots:shots } };
}

function buildPolishUserPrompt(value) {
  var lines = [
    'Identity anchor (for reference only): ' + (value.identity || '(none)'),
    '',
    'Shot list (index | shotSize | camera | motion | dialogue | description):'
  ];
  value.shots.forEach(function (shot, index) {
    lines.push((index + 1) + '. ' + (shot.shotSize || 'default') + ' | ' + shot.camera + ' | ' + shot.motion
      + ' | ' + (shot.dialogue ? JSON.stringify(shot.dialogue) : '""')
      + ' | ' + shot.prompt.slice(0, 160));
  });
  lines.push('', 'Adjust the rhythm of this shot list:');
  return lines.join('\n');
}

// 清洗编排输出：index 对齐 + 字段白名单；非法/越界条目整体跳过（保持原值）。
function cleanPolishOutput(parsed, value) {
  var out = value.shots.map(function () {
    return { shotSize:null, camera:null, motion:null, dialogue:null };
  });
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.shots)) return out;
  for (var i = 0; i < parsed.shots.length; i += 1) {
    var item = parsed.shots[i];
    if (!item || typeof item !== 'object') continue;
    var index = Number(item.index);
    if (!Number.isInteger(index) || index < 0 || index >= out.length) continue;
    var entry = out[index];
    if (item.shotSize === null || item.shotSize === undefined || item.shotSize === '') {
      entry.shotSize = null;
    } else {
      var shotSize = String(item.shotSize);
      entry.shotSize = SHOT_SIZE_VALUES.indexOf(shotSize) !== -1 ? shotSize : null;
    }
    var camera = String(item.camera || '').trim();
    entry.camera = CAMERA_VALUES.indexOf(camera) !== -1 ? camera : null;
    var motion = String(item.motion || '').trim();
    entry.motion = MOTION_VALUES.indexOf(motion) !== -1 ? motion : null;
    // dialogue 语义：'' = 清空台词；合法短句 = 替换；null/undefined = 保持；超长 = 保持。
    if (item.dialogue !== null && item.dialogue !== undefined) {
      var dialogue = String(item.dialogue).trim();
      entry.dialogue = dialogue.length <= 300 ? dialogue : null;
    }
  }
  return out;
}

function validateRewriteBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error:'请求体必须是 JSON 对象' };
  }
  for (var key of Object.keys(body)) {
    if (!REWRITE_BODY_KEYS.has(key)) return { error:'不支持的参数：' + key };
  }
  var prompt = String(body.prompt || '').trim();
  if (!prompt || prompt.length > 4000) return { error:'画面描述需为 1—4000 字符' };
  var identity = String(body.identity || '').trim().slice(0, 600);
  var shotSize = body.shotSize === null || body.shotSize === undefined || body.shotSize === ''
    ? null
    : String(body.shotSize);
  if (shotSize !== null && SHOT_SIZE_VALUES.indexOf(shotSize) === -1) {
    return { error:'不支持的景别' };
  }
  var camera = String(body.camera || 'still');
  if (CAMERA_VALUES.indexOf(camera) === -1) return { error:'不支持的镜头运动' };
  var motion = String(body.motion || 'subtle');
  if (MOTION_VALUES.indexOf(motion) === -1) return { error:'不支持的主体运动' };
  var dialogue = String(body.dialogue || '').trim().slice(0, 300);
  return { value:{ prompt:prompt, identity:identity, shotSize:shotSize, camera:camera, motion:motion, dialogue:dialogue } };
}

// 宽容提取 JSON 对象：模型可能包 markdown 围栏或前后缀，取首个 { 到末个 }。
function extractJsonObject(text) {
  var start = text.indexOf('{');
  var end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

// 字段清洗：枚举白名单之外一律回退输入原值；prompt 为空回退原描述，
// 保证模型输出再离谱也不会把镜头参数或描述弄坏。
function cleanRewriteOutput(parsed, original) {
  var out = {
    prompt:original.prompt,
    shotSize:null,
    camera:original.camera,
    motion:original.motion,
    dialogue:''
  };
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out;
  var prompt = String(parsed.prompt || '').trim();
  if (prompt && prompt.length <= 4000) out.prompt = prompt;
  if (parsed.shotSize === null || parsed.shotSize === undefined || parsed.shotSize === '') {
    out.shotSize = null;
  } else {
    var shotSize = String(parsed.shotSize);
    out.shotSize = SHOT_SIZE_VALUES.indexOf(shotSize) !== -1 ? shotSize : null;
  }
  var camera = String(parsed.camera || '').trim();
  if (CAMERA_VALUES.indexOf(camera) !== -1) out.camera = camera;
  var motion = String(parsed.motion || '').trim();
  if (MOTION_VALUES.indexOf(motion) !== -1) out.motion = motion;
  var dialogue = String(parsed.dialogue || '').trim();
  if (dialogue && dialogue.length <= 300) out.dialogue = dialogue;
  return out;
}

async function callCompatibleApi(source, messages, signal) {
  var result = await httpClient.request(source.api.baseUrl, source.api.pathname, {
    method:'POST',
    headers:source.api.apiKey ? { Authorization:'Bearer ' + source.api.apiKey } : {},
    json:Object.assign({
      model:source.api.model,
      messages:messages,
      stream:false,
      temperature:0.6
    },
      // DeepSeek：改写是机械任务，关思考更快更省（官方 thinking.type 开关）
      source.vendor === 'deepseek' ? { thinking:{ type:'disabled' } } : {}),
    signal:signal,
    timeoutMs:120000,
    timeoutMessage:'AI 分镜整理（API）超时'
  });
  var statusCode = result.response.statusCode || 0;
  if (statusCode < 200 || statusCode >= 300) {
    var errorBody = await httpClient.readBody(result.response, 64 * 1024);
    throw new httpClient.UpstreamError('AI 上游返回 ' + statusCode, {
      code:'UPSTREAM_STATUS',
      status:statusCode,
      detail:errorBody.toString('utf8').slice(0, 500)
    });
  }
  var body;
  try {
    body = JSON.parse((await httpClient.readBody(result.response, 1024 * 1024)).toString('utf8'));
  } catch (error) {
    throw new httpClient.UpstreamError('AI 上游返回了无法解析的响应', { code:'INVALID_UPSTREAM_JSON' });
  }
  var content = body && body.choices && body.choices[0]
    && body.choices[0].message && body.choices[0].message.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new httpClient.UpstreamError('AI 上游返回空内容', { code:'EMPTY_RESPONSE' });
  }
  return content;
}

// Ollama 走 ollama-service.streamChat（NDJSON 流 + 串行队列 + 模型选择全复用），
// onToken 累积全文。模型名传空串 = 交给 service 选（OLLAMA_MODEL 或已装第一个）。
async function callOllama(ollama, messages, signal) {
  var fullText = '';
  await ollama.streamChat({ model:'', messages:messages, signal:signal }, {
    onToken:async function (token) { fullText += token; }
  });
  if (!fullText.trim()) {
    throw new httpClient.UpstreamError('Ollama 返回空内容', { code:'EMPTY_RESPONSE' });
  }
  return fullText;
}

function createVideoAiRouter(config, dependencies) {
  dependencies = dependencies || {};
  var router = express.Router();
  var ollama = dependencies.ollama || createOllamaService({
    host:config.OLLAMA_HOST,
    model:config.OLLAMA_MODEL,
    keepAlive:config.OLLAMA_KEEP_ALIVE,
    numPredict:config.OLLAMA_NUM_PREDICT,
    numContext:config.OLLAMA_NUM_CTX
  });

  // 改写源解析：站主 API 优先 → Ollama 兜底；两者皆无返回 null。
  async function resolveSource() {
    var host = readHostConfig(config);
    if (host) {
      return {
        source:'api',
        model:host.model,
        api:host,
        vendor:host.baseUrl.includes('api.deepseek.com') ? 'deepseek' : 'custom'
      };
    }
    var status = await ollama.status().catch(function () {
      return { online:false, models:[] };
    });
    if (status.online && status.models.length) {
      return { source:'ollama', model:status.model || '', host:config.OLLAMA_HOST };
    }
    return null;
  }

  router.get('/api/video-ai/status', async function (req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      var source = await resolveSource();
      if (!source) {
        envelope.ok(res, {
          available:false,
          source:null,
          model:'',
          label:'',
          reason:'没有可用的 AI 模型：请在控制面板的聊天设置中配置 API，或启动本地 Ollama。'
        });
        return;
      }
      envelope.ok(res, {
        available:true,
        source:source.source,
        model:source.model,
        label:source.source === 'api'
          ? 'API · ' + source.model
          : 'Ollama · ' + (source.model || '本地模型')
      });
    } catch (error) {
      envelope.fail(res, 502, error.message || 'AI 状态探测失败');
    }
  });

  router.post('/api/video-ai/rewrite', security.localOnly, express.json({ limit:'64kb' }), async function (req, res) {
    var validation = validateRewriteBody(req.body);
    if (validation.error) return envelope.fail(res, 400, validation.error);
    var value = validation.value;
    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    res.once('close', function () { if (!res.writableEnded) controller.abort(); });
    try {
      var source = await resolveSource();
      if (!source) {
        return envelope.fail(res, 409, 'AI 整理暂不可用：请先在聊天设置中配置 API 或启动 Ollama', {
          code:'AI_LLM_UNAVAILABLE'
        });
      }
      var messages = [
        { role:'system', content:REWRITE_SYSTEM_PROMPT },
        { role:'user', content:buildRewriteUserPrompt(value) }
      ];
      var content = source.source === 'api'
        ? await callCompatibleApi(source, messages, controller.signal)
        : await callOllama(ollama, messages, controller.signal);
      var shot = cleanRewriteOutput(extractJsonObject(content), value);
      envelope.ok(res, { source:source.source, model:source.model, shot:shot });
    } catch (error) {
      if (httpClient.isAbortError(error)) return;
      envelope.fail(res, envelope.statusFor(error, 502), error.message || 'AI 整理失败', {
        detail:error.detail || ''
      });
    }
  });

  router.post('/api/video-ai/polish', security.localOnly, express.json({ limit:'256kb' }), async function (req, res) {
    var validation = validatePolishBody(req.body);
    if (validation.error) return envelope.fail(res, 400, validation.error);
    var value = validation.value;
    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    res.once('close', function () { if (!res.writableEnded) controller.abort(); });
    try {
      var source = await resolveSource();
      if (!source) {
        return envelope.fail(res, 409, 'AI 编排暂不可用：请先在聊天设置中配置 API 或启动 Ollama', {
          code:'AI_LLM_UNAVAILABLE'
        });
      }
      var messages = [
        { role:'system', content:POLISH_SYSTEM_PROMPT },
        { role:'user', content:buildPolishUserPrompt(value) }
      ];
      var content = source.source === 'api'
        ? await callCompatibleApi(source, messages, controller.signal)
        : await callOllama(ollama, messages, controller.signal);
      var shots = cleanPolishOutput(extractJsonObject(content), value);
      envelope.ok(res, { source:source.source, model:source.model, shots:shots });
    } catch (error) {
      if (httpClient.isAbortError(error)) return;
      envelope.fail(res, envelope.statusFor(error, 502), error.message || 'AI 编排失败', {
        detail:error.detail || ''
      });
    }
  });

  // 统一 LLM 调用：选源 → 提示词 → 调用 → 返回原始文本。
  async function callLlm(source, messages, signal) {
    return source.source === 'api'
      ? await callCompatibleApi(source, messages, signal)
      : await callOllama(ollama, messages, signal);
  }

  router.post('/api/video-ai/dialogue', security.localOnly, express.json({ limit:'64kb' }), async function (req, res) {
    var validation = validateDialogueBody(req.body);
    if (validation.error) return envelope.fail(res, 400, validation.error);
    var value = validation.value;
    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    res.once('close', function () { if (!res.writableEnded) controller.abort(); });
    try {
      var source = await resolveSource();
      if (!source) return envelope.fail(res, 409, 'AI 台词暂不可用：请先在聊天设置中配置 API 或启动 Ollama', { code:'AI_LLM_UNAVAILABLE' });
      var content = await callLlm(source, [
        { role:'system', content:DIALOGUE_SYSTEM_PROMPT },
        { role:'user', content:buildDialogueUserPrompt(value) }
      ], controller.signal);
      envelope.ok(res, { source:source.source, model:source.model, options:cleanDialogueOutput(extractJsonObject(content)) });
    } catch (error) {
      if (httpClient.isAbortError(error)) return;
      envelope.fail(res, envelope.statusFor(error, 502), error.message || 'AI 台词失败', { detail:error.detail || '' });
    }
  });

  router.post('/api/video-ai/review', security.localOnly, express.json({ limit:'256kb' }), async function (req, res) {
    var validation = validateReviewBody(req.body);
    if (validation.error) return envelope.fail(res, 400, validation.error);
    var value = validation.value;
    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    res.once('close', function () { if (!res.writableEnded) controller.abort(); });
    try {
      var source = await resolveSource();
      if (!source) return envelope.fail(res, 409, 'AI 质检暂不可用：请先在聊天设置中配置 API 或启动 Ollama', { code:'AI_LLM_UNAVAILABLE' });
      var content = await callLlm(source, [
        { role:'system', content:REVIEW_SYSTEM_PROMPT },
        { role:'user', content:buildReviewUserPrompt(value) }
      ], controller.signal);
      envelope.ok(res, { source:source.source, model:source.model, issues:cleanReviewOutput(extractJsonObject(content), value) });
    } catch (error) {
      if (httpClient.isAbortError(error)) return;
      envelope.fail(res, envelope.statusFor(error, 502), error.message || 'AI 质检失败', { detail:error.detail || '' });
    }
  });

  router.post('/api/video-ai/script', security.localOnly, express.json({ limit:'64kb' }), async function (req, res) {
    var validation = validateScriptBody(req.body);
    if (validation.error) return envelope.fail(res, 400, validation.error);
    var value = validation.value;
    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    res.once('close', function () { if (!res.writableEnded) controller.abort(); });
    try {
      var source = await resolveSource();
      if (!source) return envelope.fail(res, 409, 'AI 脚本暂不可用：请先在聊天设置中配置 API 或启动 Ollama', { code:'AI_LLM_UNAVAILABLE' });
      var content = await callLlm(source, [
        { role:'system', content:SCRIPT_SYSTEM_PROMPT },
        { role:'user', content:buildScriptUserPrompt(value) }
      ], controller.signal);
      envelope.ok(res, { source:source.source, model:source.model, shots:cleanScriptOutput(extractJsonObject(content)) });
    } catch (error) {
      if (httpClient.isAbortError(error)) return;
      envelope.fail(res, envelope.statusFor(error, 502), error.message || 'AI 脚本失败', { detail:error.detail || '' });
    }
  });

  return { router:router };
}

// ── 台词润色 / 质量检查 / 全自动脚本（2026-08-17 短片流水线扩展）─────────
var DIALOGUE_SYSTEM_PROMPT = [
  'You are a dialogue writer for an anime video shot.',
  'Write short natural spoken lines based on the shot description and character context.',
  '',
  'Reply with ONLY a JSON object: {"options":[{"text":"...","label":"..."}, ...]} with exactly 3 options.',
  'No markdown, no commentary.',
  '',
  'Rules:',
  '- Each line is at most 20 Chinese characters (or 60 English characters), natural spoken language, matching the scene language (Chinese scene -> Chinese line).',
  '- The three options must differ in tone: one short and plain, one gentle/emotional, one slightly playful or dramatic.',
  '- The line must fit the action and emotion of the shot; do not invent off-screen dialogue.',
  '- "label" is a short Chinese tone tag (e.g. "简洁", "温柔", "俏皮").',
  '- If a current dialogue is provided, the FIRST option must be a polished version of it (keep the meaning), the other two are fresh alternatives.',
  '- If the shot does not need dialogue, still give 3 short fitting lines - never return empty options.'
].join('\n');

var REVIEW_SYSTEM_PROMPT = [
  'You are a quality inspector for an anime video storyboard.',
  'Review each shot for problems and reply with ONLY a JSON object:',
  '{"issues":[{"index":0,"severity":"warn","field":"camera","message":"...","suggestion":"..."}]}',
  'No markdown, no commentary. Use an empty "issues" array when everything is fine.',
  '',
  'Check for:',
  '1. Description problems: too static (reads like a still image, no action or time flow), too short, or missing camera intent.',
  '2. Field contradictions: e.g. description says running but motion is "subtle"; says close framing but shotSize is "wide".',
  '3. Dialogue problems: longer than 20 Chinese characters, language mismatch (Chinese scene with English line), or too many consecutive shots with dialogue.',
  '4. Continuity: a shot that clearly jumps in space/time from the previous one without a transition cue.',
  '',
  '"severity" is "error" (must fix) or "warn" (should improve).',
  '"field" is one of "prompt","shotSize","camera","motion","dialogue","continuity".',
  '"message" is a short Chinese explanation; "suggestion" is a concrete fix (max 60 chars each).'
].join('\n');

var SCRIPT_SYSTEM_PROMPT = [
  'You are a director turning a story synopsis into an anime video shot list.',
  'Reply with ONLY a JSON object:',
  '{"shots":[{"prompt":"...","shotSize":"medium","camera":"still","motion":"natural","dialogue":"...","duration":5}, ...]}',
  'No markdown, no commentary.',
  '',
  'Rules:',
  '- Split the story into 8-15 shots (fewer for short synopses).',
  '- "prompt": 1-3 English sentences describing what HAPPENS in the shot: subject action, camera intent, time flow. Keep identity, outfit and scene consistent.',
  '- Use <Picture 1> / <Picture 2> labels when multiple characters are defined and appear in the shot (e.g. "Nene hands the letter to <Picture 2>.").',
  '- "shotSize": "wide"|"medium"|"closeup" - vary for rhythm: open scenes wide, emotional beats closeup.',
  '- "camera": "still"|"push"|"pull"|"pan"|"orbit" - vary; movement must serve the action.',
  '- "motion": "subtle"|"natural"|"expressive" - match action intensity.',
  '- "dialogue": a short line (at most 20 Chinese characters) for shots that need speech; "" for silent shots.',
  '- "duration": 3, 5, 10 or 15 seconds - 5s is the default; use 10/15s sparingly for key shots.',
  '- If a target total duration is given, keep the sum close to it.'
].join('\n');

function validateDialogueBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error:'请求体必须是 JSON 对象' };
  var prompt = String(body.prompt || '').trim();
  if (!prompt || prompt.length > 4000) return { error:'镜头描述需为 1—4000 字符' };
  var identity = String(body.identity || '').trim().slice(0, 600);
  var currentDialogue = String(body.currentDialogue || '').trim().slice(0, 300);
  var mood = String(body.mood || '').trim().slice(0, 60);
  return { value:{ prompt:prompt, identity:identity, currentDialogue:currentDialogue, mood:mood } };
}

function buildDialogueUserPrompt(value) {
  return [
    'Identity anchor (for reference only): ' + (value.identity || '(none)'),
    'Shot description: ' + value.prompt,
    value.currentDialogue ? 'Current dialogue: ' + value.currentDialogue : '',
    value.mood ? 'Requested mood: ' + value.mood : '',
    '',
    value.currentDialogue ? 'Polish the current dialogue and give two alternatives:' : 'Write three dialogue options for this shot:'
  ].filter(Boolean).join('\n');
}

function cleanDialogueOutput(parsed) {
  var options = [];
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.options)) {
    for (var i = 0; i < parsed.options.length && options.length < 3; i += 1) {
      var item = parsed.options[i];
      if (!item || typeof item !== 'object') continue;
      var text = String(item.text || '').trim();
      if (!text || text.length > 60) continue;
      options.push({ text:text, label:String(item.label || '').trim().slice(0, 12) });
    }
  }
  return options;
}

function validateReviewBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error:'请求体必须是 JSON 对象' };
  if (!Array.isArray(body.shots) || body.shots.length < 1 || body.shots.length > MAX_POLISH_SHOTS) {
    return { error:'分镜数量需为 1—' + MAX_POLISH_SHOTS };
  }
  var shots = [];
  for (var i = 0; i < body.shots.length; i += 1) {
    var shot = body.shots[i];
    if (!shot || typeof shot !== 'object') return { error:'第 ' + (i + 1) + ' 个分镜必须是对象' };
    var prompt = String(shot.prompt || '').trim();
    if (!prompt || prompt.length > 4000) return { error:'第 ' + (i + 1) + ' 个分镜描述需为 1—4000 字符' };
    shots.push({
      prompt:prompt,
      shotSize:shot.shotSize === null || shot.shotSize === undefined || shot.shotSize === '' ? null : String(shot.shotSize),
      camera:String(shot.camera || 'still'),
      motion:String(shot.motion || 'subtle'),
      dialogue:String(shot.dialogue || '').trim().slice(0, 300),
    });
  }
  return { value:{ shots:shots } };
}

function buildReviewUserPrompt(value) {
  var lines = ['Shot list (index | shotSize | camera | motion | dialogue | description):'];
  value.shots.forEach(function (shot, index) {
    lines.push((index + 1) + '. ' + (shot.shotSize || 'default') + ' | ' + shot.camera + ' | ' + shot.motion
      + ' | ' + (shot.dialogue ? JSON.stringify(shot.dialogue) : '""')
      + ' | ' + shot.prompt.slice(0, 200));
  });
  lines.push('', 'Inspect this shot list:');
  return lines.join('\n');
}

var REVIEW_FIELDS = ['prompt', 'shotSize', 'camera', 'motion', 'dialogue', 'continuity'];

function cleanReviewOutput(parsed, value) {
  var issues = [];
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.issues)) return issues;
  for (var i = 0; i < parsed.issues.length; i += 1) {
    var item = parsed.issues[i];
    if (!item || typeof item !== 'object') continue;
    var index = Number(item.index);
    if (!Number.isInteger(index) || index < 0 || index >= value.shots.length) continue;
    var severity = String(item.severity || '').trim();
    if (severity !== 'error' && severity !== 'warn') continue;
    var field = String(item.field || '').trim();
    if (REVIEW_FIELDS.indexOf(field) === -1) continue;
    var message = String(item.message || '').trim().slice(0, 120);
    if (!message) continue;
    issues.push({
      index:index,
      severity:severity,
      field:field,
      message:message,
      suggestion:String(item.suggestion || '').trim().slice(0, 120),
    });
  }
  return issues;
}

function validateScriptBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error:'请求体必须是 JSON 对象' };
  var story = String(body.story || '').trim();
  if (!story || story.length > 2000) return { error:'故事梗概需为 1—2000 字符' };
  var identity = String(body.identity || '').trim().slice(0, 600);
  var shotCount = body.shotCount === undefined || body.shotCount === null || body.shotCount === ''
    ? null
    : Number(body.shotCount);
  if (shotCount !== null && (!Number.isInteger(shotCount) || shotCount < 4 || shotCount > 20)) {
    return { error:'镜头数需为 4—20 的整数' };
  }
  var totalSeconds = body.totalSeconds === undefined || body.totalSeconds === null || body.totalSeconds === ''
    ? null
    : Number(body.totalSeconds);
  if (totalSeconds !== null && (!Number.isInteger(totalSeconds) || totalSeconds < 15 || totalSeconds > 300)) {
    return { error:'总时长需为 15—300 秒' };
  }
  var characterLabels = Array.isArray(body.characterLabels)
    ? body.characterLabels.map(String).filter(Boolean).slice(0, 6)
    : [];
  return { value:{ story:story, identity:identity, shotCount:shotCount, totalSeconds:totalSeconds, characterLabels:characterLabels } };
}

function buildScriptUserPrompt(value) {
  var lines = [
    'Identity anchor (for reference only): ' + (value.identity || '(none)'),
  ];
  if (value.characterLabels.length) {
    lines.push('Characters: ' + value.characterLabels.map(function (label, i) {
      return '<Picture ' + (i + 1) + '> = ' + label;
    }).join('; '));
  }
  lines.push('Story synopsis: ' + value.story);
  if (value.shotCount) lines.push('Target shot count: ' + value.shotCount);
  if (value.totalSeconds) lines.push('Target total duration: ' + value.totalSeconds + ' seconds');
  lines.push('', 'Create the shot list:');
  return lines.join('\n');
}

function cleanScriptOutput(parsed) {
  var shots = [];
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.shots)) return shots;
  for (var i = 0; i < parsed.shots.length && shots.length < 20; i += 1) {
    var item = parsed.shots[i];
    if (!item || typeof item !== 'object') continue;
    var prompt = String(item.prompt || '').trim();
    if (!prompt || prompt.length > 4000) continue;
    var shotSize = String(item.shotSize || '');
    var camera = String(item.camera || 'still');
    var motion = String(item.motion || 'subtle');
    var dialogue = String(item.dialogue || '').trim().slice(0, 300);
    var duration = Number(item.duration);
    if (![3, 5, 10, 15].includes(duration)) duration = 5;
    shots.push({
      prompt:prompt,
      shotSize:SHOT_SIZE_VALUES.indexOf(shotSize) !== -1 ? shotSize : null,
      camera:CAMERA_VALUES.indexOf(camera) !== -1 ? camera : 'still',
      motion:MOTION_VALUES.indexOf(motion) !== -1 ? motion : 'subtle',
      dialogue:dialogue,
      duration:duration,
    });
  }
  return shots;
}

module.exports = { createVideoAiRouter:createVideoAiRouter };
