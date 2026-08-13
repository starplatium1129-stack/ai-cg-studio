'use strict';

var express = require('express');
var fs = require('fs');
var path = require('path');
var http = require('http');
var StringDecoder = require('string_decoder').StringDecoder;
var httpClient = require('../services/http-client');
var security = require('../server/security');
var envelope = require('../server/http-envelope');
var companionTools = require('../server/companion-tools');
var chatPrompts = require('../server/chat-character-prompts');
var createOllamaService = require('../services/ollama-service').createOllamaService;

// ── 站主 API 配置托管 ──────────────────────────────────────────────
// 公网分享时访客的浏览器里没有主人的密钥；这套配置让访客直接使用
// 站主配好的 API，而 GET 接口永远不回传 apiKey。
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
    // 旧格式没有 pathname：用 baseUrl 重拼一次
    var pathname = typeof parsed.pathname === 'string' && parsed.pathname
      ? parsed.pathname
      : new URL('chat/completions', baseUrl.replace(/\/+$/, '') + '/').pathname;
    return { baseUrl:baseUrl, pathname:pathname, model:model, apiKey:apiKey };
  } catch (error) { return null; }
}

function writeHostConfig(config, value) {
  fs.mkdirSync(config.RUNTIME.state, { recursive:true });
  fs.writeFileSync(chatHostConfigPath(config), JSON.stringify(value, null, 2), { mode:0o600 });
}

function hostConfigPublic(config) {
  var stored = readHostConfig(config);
  if (!stored) return { configured:false };
  return {
    configured:true,
    baseUrl:stored.baseUrl,
    model:stored.model,
    // 不返回 apiKey：访客只使用，不查看
    updatedAt:null
  };
}

function chatCharacterPrompt(character, context) {
  return chatPrompts.buildCharacterPrompt(character, context);
}

function normalizeMultimodalContent(parts) {
  if (!Array.isArray(parts) || !parts.length || parts.length > 8) {
    return { error:'多模态消息格式错误' };
  }
  var normalized = [];
  for (var i = 0; i < parts.length; i += 1) {
    var part = parts[i] || {};
    if (part.type === 'text') {
      var text = String(part.text || '').trim();
      if (!text || text.length > 1200) return { error:'多模态文本过长' };
      normalized.push({ type:'text', text:text });
      continue;
    }
    if (part.type === 'image_url') {
      var url = String(part.image_url && part.image_url.url || '');
      // 只接受 data URL 图片（read_image 工具输出），防任意 URL 注入
      if (!/^data:image\/(?:png|jpeg|webp|gif);base64,/.test(url) || url.length > 12 * 1024 * 1024) {
        return { error:'图片消息只接受工作区图片的 data URL' };
      }
      normalized.push({ type:'image_url', image_url:{ url:url } });
      continue;
    }
    return { error:'多模态消息包含未知内容类型' };
  }
  return { content:normalized };
}

function normalizeToolMessage(raw) {
  var role = String(raw && raw.role || '');
  if (role === 'assistant') {
    if (!Array.isArray(raw.tool_calls) || !raw.tool_calls.length || raw.tool_calls.length > 8) {
      return { error:'assistant 工具调用消息格式错误' };
    }
    var content = String(raw.content || '');
    if (content.length > 1200) return { error:'工具调用消息内容过长' };
    // DeepSeek V4 要求思考轮带 tool_calls 时必须回传 reasoning_content
    var reasoningContent = String(raw.reasoning_content || '');
    if (reasoningContent.length > 20000) return { error:'推理过程过长' };
    var toolCalls = [];
    for (var i = 0; i < raw.tool_calls.length; i += 1) {
      var call = raw.tool_calls[i] || {};
      var id = String(call.id || '');
      var name = String(call.function && call.function.name || '');
      var argsText = String(call.function && call.function.arguments || '');
      if (!id || id.length > 128) return { error:'工具调用 ID 无效' };
      if (!companionTools.isKnownToolName(name)) return { error:'未知的工具调用：' + name };
      if (argsText.length > 4000) return { error:'工具调用参数过长' };
      toolCalls.push({ id:id, type:'function', function:{ name:name, arguments:argsText } });
    }
    var message = { role:'assistant', content:content, tool_calls:toolCalls };
    if (reasoningContent) message.reasoning_content = reasoningContent;
    return { message:message };
  }
  if (role === 'tool') {
    var callId = String(raw.tool_call_id || '');
    var toolContent = String(raw.content || '');
    if (!callId || callId.length > 128) return { error:'工具结果 ID 无效' };
    if (toolContent.length > 60000) return { error:'工具结果过长' };
    return { message:{ role:'tool', tool_call_id:callId, content:toolContent } };
  }
  return { error:'工具消息角色无效' };
}

function validateChatBody(body) {
  var character = String(body && body.character || 'nene');
  var provider = body && body.provider === 'api' ? 'api' : 'local';
  var requestedModel = String(body && body.model || '');
  var rawMessages = body && body.messages;
  var companionTools = body && body.companionTools === true;
  if (!['nene', 'natsume'].includes(character)) return { error:'不支持的聊天角色' };
  var profileValidation = chatPrompts.normalizeUserProfile(body && body.userProfile);
  if (profileValidation.error) return { error:profileValidation.error };
  var memoryValidation = chatPrompts.normalizeMemories(body && body.memories);
  if (memoryValidation.error) return { error:memoryValidation.error };
  if (!Array.isArray(rawMessages) || !rawMessages.length) {
    return { error:'对话记录必须包含 1—24 条消息' };
  }

  // 工具消息（assistant tool_calls / role:tool）不参与裁剪：它们来自最近的
  // 工具循环（数量少、在对话尾部），且必须与配套消息相邻才能被上游接受。
  var toolMessages = [];
  var textSource = [];
  for (var i = 0; i < rawMessages.length; i += 1) {
    var role = String(rawMessages[i] && rawMessages[i].role || '');
    if (role === 'tool' || (role === 'assistant' && Array.isArray(rawMessages[i].tool_calls) && rawMessages[i].tool_calls.length)) {
      var normalized = normalizeToolMessage(rawMessages[i]);
      if (normalized.error) return { error:normalized.error };
      toolMessages.push(normalized.message);
    } else {
      textSource.push(rawMessages[i]);
    }
  }

  // 普通消息裁剪（原有逻辑）：user/assistant 文本消息。多模态 user 消息
  // （content 数组，含图片）单独校验且不参与裁剪——数量少、体积受
  // express.json body 上限约束。
  var kept = [];
  var used = 0;
  var count = 0;
  for (var j = textSource.length - 1; j >= 0 && count < 24; j -= 1) {
    var textRole = String(textSource[j] && textSource[j].role || '');
    var content = textSource[j] && textSource[j].content;
    if (textRole === 'user' && Array.isArray(content)) {
      var multimodal = normalizeMultimodalContent(content);
      if (multimodal.error) return { error:multimodal.error };
      kept.unshift({ role:'user', content:multimodal.content });
      count += 1;
      continue;
    }
    var text = String(content || '').trim();
    if (!['user', 'assistant'].includes(textRole) || !text || text.length > 1200) {
      return { error:'对话消息格式错误或内容过长' };
    }
    if (used + text.length > 12000 && kept.length) break;
    used += text.length;
    count += 1;
    kept.unshift({ role:textRole, content:text });
  }
  if (!kept.length && !toolMessages.length) return { error:'对话记录必须包含有效的消息' };

  var api = null;
  var useHostConfig = body && body.hostConfig === true;
  if (provider === 'api') {
    if (useHostConfig) {
      // 访客模式：密钥在服务端，前端只带一个标记
      api = { hostConfig:true };
    } else {
      var apiValidation = validateCompatibleApi(body && body.api);
      if (apiValidation.error) return { error:apiValidation.error };
      api = apiValidation.value;
    }
  }
  var reasoning = String(body && body.reasoning || '');
  if (reasoning && ['low', 'medium', 'high', 'off'].indexOf(reasoning) === -1) {
    return { error:'推理强度必须是 off / low / medium / high' };
  }
  return {
    value:{
      character:character,
      provider:provider,
      model:requestedModel,
      api:api,
      webSearch:body && body.webSearch === true,
      companionTools:companionTools,
      reasoning:reasoning,
      messages:[{ role:'system', content:chatCharacterPrompt(character, { userProfile:profileValidation.value, memories:memoryValidation.value }) }].concat(kept).concat(toolMessages)
    }
  };
}

function validateCompatibleApi(input) {
  var baseUrl = String(input && input.baseUrl || '').trim();
  var model = String(input && input.model || '').trim();
  var apiKey = String(input && input.apiKey || '').trim();
  if (!baseUrl || baseUrl.length > 500) return { error:'API 地址不能为空或过长' };
  if (!model || model.length > 200) return { error:'API 模型名不能为空或过长' };
  if (apiKey.length > 1000) return { error:'API Key 过长' };

  var parsed;
  try { parsed = new URL(baseUrl); } catch (error) {
    return { error:'API 地址格式无效' };
  }
  var hostname = parsed.hostname.toLowerCase();
  var localHost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && localHost)) {
    return { error:'远程 API 必须使用 HTTPS；本机地址可以使用 HTTP' };
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return { error:'API 地址不能包含账号、查询参数或锚点' };
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') + '/';
  var endpoint = parsed.pathname.endsWith('/chat/completions')
    ? parsed
    : new URL('chat/completions', parsed);
  return {
    value:{
      baseUrl:endpoint.origin,
      pathname:endpoint.pathname,
      model:model,
      apiKey:apiKey,
      vendor:hostname === 'api.deepseek.com'
        ? 'deepseek'
        : hostname === 'opencode.ai' && endpoint.pathname.startsWith('/zen/') ? 'opencode' : 'custom'
    }
  };
}

function compatibleContent(event) {
  var choice = event && Array.isArray(event.choices) ? event.choices[0] : null;
  if (!choice) return '';
  if (choice.delta && typeof choice.delta.content === 'string') return choice.delta.content;
  if (choice.message && typeof choice.message.content === 'string') return choice.message.content;
  return typeof choice.text === 'string' ? choice.text : '';
}

/** 思考过程增量（DeepSeek reasoning_content / OpenAI 兼容 reasoning）。 */
function compatibleReasoning(event) {
  var choice = event && Array.isArray(event.choices) ? event.choices[0] : null;
  if (!choice) return '';
  if (choice.delta) {
    if (typeof choice.delta.reasoning_content === 'string') return choice.delta.reasoning_content;
    if (typeof choice.delta.reasoning === 'string') return choice.delta.reasoning;
  }
  if (choice.message) {
    if (typeof choice.message.reasoning_content === 'string') return choice.message.reasoning_content;
    if (typeof choice.message.reasoning === 'string') return choice.message.reasoning;
  }
  return '';
}

function buildWebSearchParams(api) {
  if (/^gemini-/i.test(api.model)) return { tools:[{ google_search:{} }] };
  // 只有确认支持 web_search 参数的供应商才注入；未知/自定义 OpenAI 兼容端点
  // 收到未知参数会 400，联网检索直接失败。
  if (api.vendor === 'deepseek' || api.vendor === 'opencode') return { web_search:true };
  return {};
}

async function streamCompatibleApi(input, handlers, gatewayConfig) {
  handlers = handlers || {};
  var api = input.api;
  // 访客模式（hostConfig:true）：从站主托管配置注入 baseUrl/model/key，
  // 前端始终拿不到密钥
  if (api && api.hostConfig === true) {
    var host = readHostConfig(gatewayConfig);
    if (!host) {
      throw new httpClient.UpstreamError('站主尚未配置 API，请在控制面板的聊天设置中保存', {
        code:'HOST_CONFIG_MISSING',
        status:400
      });
    }
    api = {
      baseUrl:host.baseUrl,
      pathname:host.pathname,
      model:host.model,
      apiKey:host.apiKey,
      vendor:host.baseUrl.includes('api.deepseek.com')
        ? 'deepseek'
        : host.baseUrl.includes('opencode.ai') ? 'opencode' : 'custom'
    };
    input = Object.assign({}, input, { api:api });
  }
  var result = await httpClient.request(api.baseUrl, api.pathname, {
    method:'POST',
    headers:Object.assign(
      { Accept:'text/event-stream, application/json' },
      api.apiKey ? { Authorization:'Bearer ' + api.apiKey } : {}
    ),
    json:Object.assign({
      model:api.model,
      messages:input.messages,
      stream:true
    },
      // 推理强度按供应商官方文档注入：
      // - DeepSeek V4：thinking.type 只有 enabled/disabled 两值；强度是
      //   顶层 reasoning_effort（high/max 两档，官方兼容映射 low/medium→high，
      //   xhigh→max）。off → 关闭思考；low → high 档；medium/high → max 档
      //   （默认 medium 即 max）。
      // - OpenCode 端点吃 OpenAI 标准的 reasoning_effort 多档参数。
      // - 其余端点不注入（防 400）。
      api.vendor === 'deepseek'
        ? (input.reasoning === 'off'
          ? { thinking:{ type:'disabled' } }
          : Object.assign(
            { thinking:{ type:'enabled' } },
            input.reasoning === 'low' ? { reasoning_effort:'high' } : { reasoning_effort:'max' }))
        : api.vendor === 'opencode' && input.reasoning && input.reasoning !== 'off'
          ? { reasoning_effort:input.reasoning }
          : {},
      input.webSearch ? buildWebSearchParams(api) : {},
      input.companionTools ? { tools:companionTools.TOOL_DEFINITIONS } : {}),
    signal:input.signal,
    timeoutMs:120000,
    timeoutMessage:'自定义 API 对话超时'
  });
  var statusCode = result.response.statusCode || 0;
  if (statusCode < 200 || statusCode >= 300) {
    var errorBody = await httpClient.readBody(result.response, 64 * 1024);
    throw new httpClient.UpstreamError('自定义 API 返回 ' + statusCode, {
      code:'UPSTREAM_STATUS',
      status:statusCode,
      detail:errorBody.toString('utf8').slice(0, 500)
    });
  }

  if (handlers.onStart) await handlers.onStart({ model:api.model, queueWaitMs:0 });
  var contentType = String(result.response.headers['content-type'] || '').toLowerCase();
  var decoder = new StringDecoder('utf8');
  var buffer = '';
  var emitted = false;
  var malformedSse = false;

  // tool_calls 流式增量按 index 累积（OpenAI 兼容格式：id 与 name 只在
  // 首次 chunk 出现，arguments 是字符串分片）；流结束时统一 flush 成事件。
  // reasoningText 累积思考全文：DeepSeek V4 在思考轮带 tool_calls 时，
  // 下一轮必须回传 reasoning_content，否则上游 400。
  var toolCallsByIndex = Object.create(null);
  var reasoningText = '';
  function accumulateToolCalls(event) {
    var choice = event && Array.isArray(event.choices) ? event.choices[0] : null;
    var deltas = choice && Array.isArray(choice.delta && choice.delta.tool_calls)
      ? choice.delta.tool_calls
      : (choice && Array.isArray(choice.message && choice.message.tool_calls)
        ? choice.message.tool_calls.map(function (call) {
          return { id:call && call.id, function:call && call.function };
        }) : null);
    if (!deltas) return;
    for (var i = 0; i < deltas.length; i += 1) {
      var delta = deltas[i] || {};
      var index = Number(delta.index);
      if (!Number.isInteger(index) || index < 0 || index > 16) continue;
      var acc = toolCallsByIndex[index] || (toolCallsByIndex[index] = { id:'', name:'', arguments:'' });
      if (typeof delta.id === 'string') acc.id = delta.id;
      if (delta.function) {
        // 部分实现会把 name 也分片传输，用拼接兼容
        if (typeof delta.function.name === 'string') acc.name += delta.function.name;
        if (typeof delta.function.arguments === 'string') acc.arguments += delta.function.arguments;
      }
    }
  }
  function flushToolCalls() {
    if (!handlers.onToolCall) return Promise.resolve();
    var indexes = Object.keys(toolCallsByIndex).map(Number).sort(function (a, b) { return a - b; });
    var chain = Promise.resolve();
    indexes.forEach(function (index) {
      var call = toolCallsByIndex[index];
      if (!call.id || !call.name) return;
      chain = chain.then(function () {
        return handlers.onToolCall({
          index:index,
          id:call.id,
          name:call.name,
          arguments:call.arguments,
          reasoning:reasoningText
        });
      });
    });
    return chain;
  }

  for await (var chunk of result.response) {
    buffer += Buffer.isBuffer(chunk) ? decoder.write(chunk) : String(chunk);
    if (!contentType.includes('text/event-stream') && !buffer.includes('\ndata:')) continue;
    var lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i].trim();
      if (!line.startsWith('data:')) continue;
      var payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      var event;
      try { event = JSON.parse(payload); } catch (error) {
        malformedSse = true;
        continue;
      }
      accumulateToolCalls(event);
      var reasoning = compatibleReasoning(event);
      if (reasoning) {
        reasoningText += reasoning;
        emitted = true;
        if (handlers.onReasoning) await handlers.onReasoning(reasoning);
        continue;
      }
      var token = compatibleContent(event);
      if (!token) continue;
      emitted = true;
      if (handlers.onToken) await handlers.onToken(token);
    }
  }
  buffer += decoder.end();

  if (malformedSse && !emitted && !Object.keys(toolCallsByIndex).length) {
    throw new httpClient.UpstreamError('自定义 API 返回了畸形 SSE', {
      code:'INVALID_SSE'
    });
  }

  if (!emitted && buffer.trim()) {
    var responseBody;
    try { responseBody = JSON.parse(buffer); } catch (error) {
      throw new httpClient.UpstreamError('自定义 API 返回了无法识别的响应', {
        code:'INVALID_JSON',
        detail:buffer.slice(0, 300)
      });
    }
    accumulateToolCalls(responseBody);
    var reasoningBody = compatibleReasoning(responseBody);
    if (reasoningBody) {
      reasoningText += reasoningBody;
      if (handlers.onReasoning) await handlers.onReasoning(reasoningBody);
    }
    var content = compatibleContent(responseBody);
    if (content && handlers.onToken) await handlers.onToken(content);
  }
  await flushToolCalls();
  if (handlers.onDone) await handlers.onDone();
}

async function inspectCompatibleApi(api, signal) {
  var modelsPath = api.pathname.replace(/\/chat\/completions$/, '/models');
  var result = await httpClient.request(api.baseUrl, modelsPath, {
    method:'GET',
    headers:Object.assign(
      { Accept:'application/json' },
      api.apiKey ? { Authorization:'Bearer ' + api.apiKey } : {}
    ),
    signal:signal,
    timeoutMs:15000,
    timeoutMessage:'API 连接测试超时'
  });
  var body = await httpClient.readBody(result.response, 512 * 1024);
  var statusCode = result.response.statusCode || 0;
  if (statusCode < 200 || statusCode >= 300) {
    throw new httpClient.UpstreamError('API 连接测试返回 ' + statusCode, {
      code:'UPSTREAM_STATUS',
      status:statusCode,
      detail:body.toString('utf8').slice(0, 500)
    });
  }
  var data;
  try { data = JSON.parse(body.toString('utf8')); } catch (error) {
    throw new httpClient.UpstreamError('模型列表不是有效 JSON', {
      code:'INVALID_JSON',
      detail:String(error && error.message || error)
    });
  }
  var rawModels = Array.isArray(data && data.data)
    ? data.data
    : Array.isArray(data && data.models) ? data.models : [];
  var models = rawModels.map(function (item) {
    return String(item && (item.id || item.name) || '').trim();
  }).filter(Boolean).slice(0, 200);
  return {
    online:true,
    vendor:api.vendor,
    models:models,
    modelCount:models.length
  };
}

function writeEvent(res, event) {
  if (res.destroyed || res.writableEnded) return Promise.reject(httpClient.abortError());
  if (res.write(JSON.stringify(event) + '\n')) return Promise.resolve();
  return new Promise(function (resolve, reject) {
    function cleanup() {
      res.removeListener('drain', onDrain);
      res.removeListener('close', onClose);
    }
    function onDrain() { cleanup(); resolve(); }
    function onClose() { cleanup(); reject(httpClient.abortError()); }
    res.once('drain', onDrain);
    res.once('close', onClose);
  });
}

function createChatRouter(config, dependencies) {
  dependencies = dependencies || {};
  var router = express.Router();
  var service = dependencies.ollama || createOllamaService({
    host:config.OLLAMA_HOST,
    model:config.OLLAMA_MODEL,
    keepAlive:config.OLLAMA_KEEP_ALIVE,
    numPredict:config.OLLAMA_NUM_PREDICT,
    numContext:config.OLLAMA_NUM_CTX
  });

  router.get('/api/chat-status', async function (req, res) {
    var data = await service.status().catch(function (error) {
      return { online:false, model:'', models:[], error:error.message };
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  });

  router.post('/api/chat-provider/test', security.localOnly, express.json({ limit:'8kb' }), async function (req, res) {
    var validation = validateCompatibleApi(req.body);
    if (validation.error) return envelope.fail(res, 400, validation.error);
    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    // 客户端在模型列表拉取完成前断开（如关面板）也要中止，避免 15s 探测白跑
    res.once('close', function () { if (!res.writableEnded) controller.abort(); });
    try {
      var result = await inspectCompatibleApi(validation.value, controller.signal);
      envelope.ok(res, result);
    } catch (error) {
      if (httpClient.isAbortError(error)) return;
      envelope.fail(res, envelope.statusFor(error, 502), error.message || 'API 连接测试失败', {
        detail:error.detail || ''
      });
    }
  });

  // 站主 API 配置托管：GET 任何人可读（不含密钥），写/删仅本机
  router.get('/api/chat-provider/host-config', function (req, res) {
    res.setHeader('Cache-Control', 'no-store');
    envelope.ok(res, hostConfigPublic(config));
  });

  router.post('/api/chat-provider/host-config', security.localOnly, express.json({ limit:'8kb' }), function (req, res) {
    var validation = validateCompatibleApi(req.body);
    if (validation.error) return envelope.fail(res, 400, validation.error);
    writeHostConfig(config, {
      baseUrl:validation.value.baseUrl,
      pathname:validation.value.pathname,
      model:validation.value.model,
      apiKey:validation.value.apiKey
    });
    envelope.ok(res, hostConfigPublic(config));
  });

  router.delete('/api/chat-provider/host-config', security.localOnly, function (req, res) {
    try {
      fs.unlinkSync(chatHostConfigPath(config));
    } catch (error) { /* 不存在也视为成功 */ }
    envelope.ok(res, { configured:false });
  });

  // 隧道来的请求限流：一次对话生成要占满 GPU 数十秒，队列上限挡不住
  // "持续以消化速度提交"这种打法。本机直连不受限。
  var chatLimit = security.rateLimit({ capacity:10, refillMs:3000, label:'聊天' });

  router.post('/api/chat', chatLimit, express.json({ limit:'14mb' }), function (req, res) {
    var validation = validateChatBody(req.body);
    if (validation.error) return envelope.fail(res, 400, validation.error);

    var controller = new AbortController();
    var doneSent = false;
    function abort() { controller.abort(); }
    req.once('aborted', abort);
    res.once('close', function () {
      if (!res.writableEnded) abort();
    });

    var chatService = validation.value.provider === 'api'
      ? { streamChat:function (input, handlers) { return streamCompatibleApi(input, handlers, config); } }
      : service;
    chatService.streamChat({
      character:validation.value.character,
      model:validation.value.model,
      api:validation.value.api,
      webSearch:validation.value.webSearch,
      companionTools:validation.value.companionTools,
      reasoning:validation.value.reasoning,
      messages:validation.value.messages,
      signal:controller.signal
    }, {
      onStart:async function (meta) {
        res.status(200);
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('X-Chat-Queue-Wait', String(meta.queueWaitMs || 0));
        res.flushHeaders();
        await writeEvent(res, { type:'meta', model:meta.model, queueWaitMs:meta.queueWaitMs || 0 });
      },
      onToken:function (content) {
        return writeEvent(res, { type:'token', content:content });
      },
      onToolCall:function (call) {
        return writeEvent(res, Object.assign({ type:'tool-call' }, call));
      },
      onReasoning:function (content) {
        return writeEvent(res, { type:'reasoning', content:content });
      },
      onDone:function () {
        if (doneSent) return;
        doneSent = true;
        return writeEvent(res, { type:'done' });
      }
    }).then(function () {
      if (!res.writableEnded) res.end();
    }).catch(function (error) {
      if (httpClient.isAbortError(error) || controller.signal.aborted) return;
      var fallback = validation.value.provider === 'api' ? '聊天 API 暂不可用' : 'Ollama 暂不可用';
      if (!res.headersSent) {
        envelope.fail(res, envelope.statusFor(error, 503), error.message || fallback, {
          detail:error.detail || ''
        });
        return;
      }
      if (!res.writableEnded) {
        writeEvent(res, { type:'error', error:error.message || '聊天流中断' })
          .catch(function () {})
          .finally(function () { if (!res.writableEnded) res.end(); });
      }
    });
  });

  // ── 聊天图片生成（本地 CLIProxyAPI + gemini-3.1-flash-image）─────────
  // 与 scripts/maintenance/image-inspect.js 共用 VISION_* 环境变量约定。
  // 图片存 runtime/outputs/chat-images/，经 /api/chat-images/:file 提供；
  // GET 不挂 localOnly（分享访客要能看图），文件名随机 + 白名单防路径穿越。
  var visionBase = process.env.VISION_BASE_URL || 'http://127.0.0.1:8317/v1';
  var visionKey = process.env.VISION_API_KEY || 'sk-local-proxy-key-2024';
  var visionImageModel = process.env.VISION_IMAGE_MODEL || 'gemini-3.1-flash-image';
  var chatImageInFlight = null;

  function chatImageDir(config) {
    return path.join(config.RUNTIME_ROOT || path.join(config.ROOT_DIR, 'runtime'), 'outputs', 'chat-images');
  }

  function visionJson(body, signal) {
    return new Promise(function (resolve, reject) {
      var url = new URL(visionBase + '/chat/completions');
      var payload = JSON.stringify(body);
      var req = http.request({
        hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': 'Bearer ' + visionKey
        }
      }, function (res) {
        var chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
          var text = Buffer.concat(chunks).toString('utf8');
          var json = null;
          try { json = JSON.parse(text); } catch (e) { /* raw below */ }
          if (res.statusCode >= 200 && res.statusCode < 300 && json) return resolve(json);
          var detail = json && json.error
            ? (typeof json.error === 'string' ? json.error : JSON.stringify(json.error))
            : text.slice(0, 400);
          var err = new Error('视觉服务 HTTP ' + res.statusCode + ': ' + detail);
          err.status = res.statusCode;
          reject(err);
        });
      });
      req.setTimeout(240000, function () { req.destroy(new Error('图片生成超时')); });
      req.on('error', reject);
      if (signal) {
        signal.addEventListener('abort', function () { req.destroy(new Error('aborted')); }, { once: true });
      }
      req.write(payload);
      req.end();
    });
  }

  router.post('/api/chat-image', security.localOnly, express.json({ limit: '8kb' }), async function (req, res) {
    var prompt = String((req.body && req.body.prompt) || '').trim();
    if (!prompt) return envelope.fail(res, 400, '缺少 prompt');
    if (prompt.length > 500) return envelope.fail(res, 400, 'prompt 过长（上限 500 字符）');
    if (chatImageInFlight) {
      return envelope.fail(res, 429, '已有图片生成任务进行中，请稍候再试', { code: 'IMAGE_BUSY' });
    }
    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    chatImageInFlight = true;
    try {
      // location 错误（Google 区域限制）是间歇性的：上游出口节点波动时偶发，
      // 实测重试可成功，因此与 5xx/超时一起进入重试。
      var j = null;
      var lastError = null;
      for (var attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(function (r) { setTimeout(r, 3000); });
        try {
          j = await visionJson({
            model: visionImageModel,
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
            modalities: ['text', 'image'],
            max_tokens: 4096
          }, controller.signal);
          break;
        } catch (e) {
          lastError = e;
          var retriable = /HTTP 5\d\d/.test(e.message) || /超时/.test(e.message) || /location is not supported/.test(e.message);
          if (!retriable) throw e;
        }
      }
      if (!j) throw lastError || new Error('图片生成失败');
      var msg = j && j.choices && j.choices[0] && j.choices[0].message;
      var b64 = null;
      if (msg && Array.isArray(msg.images)) {
        for (var i = 0; i < msg.images.length; i++) {
          var u = msg.images[i] && msg.images[i].image_url && msg.images[i].image_url.url;
          if (typeof u === 'string' && u.length > 0) {
            b64 = u.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
            break;
          }
        }
      }
      if (!b64) throw new Error('响应中没有图片（模型可能拒绝了该 prompt，或服务不支持 image modality）');
      var dir = chatImageDir(config);
      fs.mkdirSync(dir, { recursive: true });
      var name = 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.png';
      fs.writeFileSync(path.join(dir, name), Buffer.from(b64, 'base64'));
      envelope.ok(res, { url: '/api/chat-images/' + name });
    } catch (error) {
      if (controller.signal.aborted) return;
      var friendly = /RESOURCE_EXHAUSTED|quota/.test(error.message)
        ? '图片生成服务配额已满（上游限制），请稍等几分钟再试'
        : '图片生成失败：' + (error.message || error);
      envelope.fail(res, envelope.statusFor(error, 502), friendly, {
        detail: error.detail || ''
      });
    } finally {
      chatImageInFlight = null;
    }
  });

  router.get('/api/chat-images/:file', function (req, res) {
    var file = String(req.params.file || '');
    if (!/^[a-zA-Z0-9._-]+$/.test(file) || !/\.png$/.test(file)) {
      return envelope.fail(res, 404, '图片不存在', { code: 'NOT_FOUND' });
    }
    var dir = chatImageDir(config);
    var p = path.resolve(dir, file);
    if (p.indexOf(path.resolve(dir) + path.sep) !== 0 || !fs.existsSync(p)) {
      return envelope.fail(res, 404, '图片不存在', { code: 'NOT_FOUND' });
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(p).pipe(res);
  });

  return { router:router, service:service };
}

module.exports = {
  createChatRouter:createChatRouter,
  chatCharacterPrompt:chatCharacterPrompt,
  validateChatBody:validateChatBody,
  validateCompatibleApi:validateCompatibleApi,
  streamCompatibleApi:streamCompatibleApi,
  inspectCompatibleApi:inspectCompatibleApi,
  writeEvent:writeEvent
};
