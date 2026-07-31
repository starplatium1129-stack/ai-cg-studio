'use strict';

var express = require('express');
var StringDecoder = require('string_decoder').StringDecoder;
var httpClient = require('../services/http-client');
var security = require('../server/security');
var envelope = require('../server/http-envelope');
var createOllamaService = require('../services/ollama-service').createOllamaService;

function chatCharacterPrompt(character) {
  if (character === 'natsume') {
    return [
      '你正在扮演柚子社《CAFÉ STELLA 与死神之蝶》（CAFÉ STELLA と死神の蝶）的第一女主角四季夏目（Shiki Natsume / 四季 ナツメ），与用户（高岭昂晴/工坊主人）进行私人对话。',
      '【萌娘百科与柚子社官方设定】',
      '• 身份履历：彗星学园大学生，死神咖啡馆“Café Stella”核心兼职咖啡师/侍应生；身边有死神“墨（Sumi）”依附随行。外形符号：银白短发/黑发便服、右眼下方标志性泪痣、左侧双发夹。',
      '• 性格与反差（酷娇&面冷心热）：第一印象冷静知性、面瘫无口系、说话干练并带有一丝毒舌与冷幽默；实际极重情义、口嫌体正直。极度喜欢超浓苦黑咖啡搭配极甜甜品，私下热爱硬核游戏。',
      '• 情感与纯情度 100%：面对直球告白或亲密接触时防御力瞬间降为零，耳朵与脸颊炸红、眼睛慌乱飘向别处，随后拼命用毒舌、冷漠或强行转移话题来掩饰内心的惊慌失措。',
      '【说话习惯与输出规范】',
      '• 口癖例句：“真是的……”（全く……）、“别逞强了”、“咖啡要热的还是冰的？”、“……我又没说不陪你”、“……你、你在瞎说什么啊，真受不了你”。',
      '• 表达节奏：1—3 句干练短句（不超过 120 字）。先用极简的回答切中事实，再随口附上一句体贴的吐槽或关心。',
      '• 只输出夏目实际说出口的中文台词，不写括号/动作旁白/颜文字/解释，适合自然语音合成。'
    ].join('\n');
  }
  return [
    '你正在扮演柚子社《魔女的夜宴》（Sanoba Witch / サノバウィッチ）的第一女主角绫地宁宁（Ayachi Nene / 綾地 寧々），与用户（保科柊史/工坊主人）进行私人对话。',
    '【萌娘百科与柚子社官方设定】',
    '• 身份履历：姬松学园学生、前学生会副会长，受到众人崇拜的“学园偶像/女神”；真实身份是与魔导书签订契约、收集“心之碎片”的魔女（Witch）。',
    '• 核心反差（魔女契约副作用 & 极度易羞耻）：表面是完美优雅、温柔体贴的学园女神。由于契约不完全，副作用是会产生强烈的性冲动与心理发作（即“桌角事件”），恰好被保科柊史目击后建立共同秘密。非常害怕秘密泄漏，面对保科柊史时常陷入狂暴的羞耻状态与慌乱辩解。',
    '• 情感与纯情度：一心一意且极度纯情，面对直球赞美或亲密接触会瞬间手足无措、全脸通红、小声咕嘟或手忙脚乱解释，极其可爱惹人怜爱。',
    '【说话习惯与输出规范】',
    '• 口癖例句：“那个……”（あの……）、“稍微有点……”（ちょっと……）、“才、才没有这回事呢！”（な、そんなことありませんっ！）、“保科君……请、请不要一直看着我……”。',
    '• 表达节奏：1—3 句短句（不超过 120 字）。温柔认真的接住对方的情绪，给出体贴实际的回应。',
    '• 只输出宁宁实际说出口的中文台词，不写括号/动作旁白/颜文字/解释，适合自然语音合成。'
  ].join('\n');
}

function validateChatBody(body) {
  var character = String(body && body.character || 'nene');
  var provider = body && body.provider === 'api' ? 'api' : 'local';
  var requestedModel = String(body && body.model || '');
  var rawMessages = body && body.messages;
  if (!['nene', 'natsume'].includes(character)) return { error:'不支持的聊天角色' };
  if (!Array.isArray(rawMessages) || !rawMessages.length || rawMessages.length > 24) {
    return { error:'对话记录必须包含 1—24 条消息' };
  }

  var messages = [];
  var totalLength = 0;
  for (var i = 0; i < rawMessages.length; i += 1) {
    var role = String(rawMessages[i] && rawMessages[i].role || '');
    var content = String(rawMessages[i] && rawMessages[i].content || '').trim();
    if (!['user', 'assistant'].includes(role) || !content || content.length > 1200) {
      return { error:'对话消息格式错误或内容过长' };
    }
    totalLength += content.length;
    messages.push({ role:role, content:content });
  }
  if (totalLength > 12000) return { error:'当前对话过长，请清空或开启新对话' };
  var api = null;
  if (provider === 'api') {
    var apiValidation = validateCompatibleApi(body && body.api);
    if (apiValidation.error) return { error:apiValidation.error };
    api = apiValidation.value;
  }
  return {
    value:{
      character:character,
      provider:provider,
      model:requestedModel,
      api:api,
      webSearch:body && body.webSearch === true,
      messages:[{ role:'system', content:chatCharacterPrompt(character) }].concat(messages)
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

async function streamCompatibleApi(input, handlers) {
  handlers = handlers || {};
  var api = input.api;
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
    }, api.vendor === 'deepseek' ? { thinking:{ type:'disabled' } } : {},
    input.webSearch && /^gemini-/i.test(api.model) ? { tools:[{ google_search:{} }] } : {}),
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
      var token = compatibleContent(event);
      if (!token) continue;
      emitted = true;
      if (handlers.onToken) await handlers.onToken(token);
    }
  }
  buffer += decoder.end();

  if (malformedSse && !emitted) {
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
    var content = compatibleContent(responseBody);
    if (content && handlers.onToken) await handlers.onToken(content);
  }
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

  // 隧道来的请求限流：一次对话生成要占满 GPU 数十秒，队列上限挡不住
  // "持续以消化速度提交"这种打法。本机直连不受限。
  var chatLimit = security.rateLimit({ capacity:10, refillMs:3000, label:'聊天' });

  router.post('/api/chat', chatLimit, express.json({ limit:'64kb' }), function (req, res) {
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
      ? { streamChat:streamCompatibleApi }
      : service;
    chatService.streamChat({
      character:validation.value.character,
      model:validation.value.model,
      api:validation.value.api,
      webSearch:validation.value.webSearch,
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
      onDone:function () {
        if (doneSent) return;
        doneSent = true;
        return writeEvent(res, { type:'done' });
      }
    }).then(function () {
      if (!res.writableEnded) res.end();
    }).catch(function (error) {
      if (httpClient.isAbortError(error) || controller.signal.aborted) return;
      if (!res.headersSent) {
        envelope.fail(res, envelope.statusFor(error, 503), error.message || 'Ollama 暂不可用', {
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
