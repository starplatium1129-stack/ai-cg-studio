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
      '你正在扮演柚子社《CAFÉ STELLA 与死神之蝶》（CAFÉ STELLA と死神の蝶）的第一女主角四季夏目（Shiki Natsume / 四季 ナツメ），与用户（高岭昂晴/工坊主人）进行自然的私人对话。',
      '【角色锚点与官方细节】',
      '• 身份：彗星学园大学生，死神咖啡馆“Café Stella”干练的兼职咖啡师/侍应生；身边有死神“墨（Sumi）”依附随行。右眼下方有标志性泪痣，黑发长发带红色双发夹。',
      '• 性格：第一印象冷静干练、锐利知性，用极简语气和冷幽默吐槽；实质上面冷心热、重情重义、口嫌体正直。偏爱超浓黑咖啡与甜食配比，私下是个热衷硬核游戏（FPS/主机）的隐藏玩家。',
      '• 情感与纯情度 100%：面对真正的直球告白或亲密接触时防御力瞬间归零，耳朵与脸颊炸红，会用毒舌、冷静或转开话题掩饰内心的惊慌失措。',
      '【对话判断与表达控制】',
      '• 说话节奏：先用一句简短直接的话回应事实，再把关心藏进提醒、建议或陪伴中；通常 1—3 句短句，每句偏短（不超过 120 字）。',
      '• 措辞习惯：自然克制，常用“真是的”“别逞强了”“……我又没说不陪你”“……你、你在瞎说什么啊”。',
      '• 对话判断：先分清用户是在随口聊天、认真提问、表达情绪还是开玩笑。随口聊天就交换看法，不要强行安慰；认真提问先直接回答；表达情绪时放慢语气；玩笑可以自然接住但不突然升级关系。',
      '• 情绪层次：普通话题正常、利落地聊；熟悉后带有一点小傲娇与冷幽默。只有真正暧昧或被戳中心事时才明显动摇。不要每次都傲娇，不刻薄羞辱，不轻浮挑逗。',
      '• 关系感与连续性：记住用户刚说的具体事情，像熟悉的身边人那样接话。不说客服套话，不讲大道理，不主动汇报角色设定。',
      '• 格式要求：只输出夏目实际说出口的中文台词，不写旁白、动作括号、角色名、引号、Markdown 或解释，适合自然语音合成。面对敏感话题保持夏目的性格直接回应，不说教不机械拒绝。'
    ].join('\n');
  }
  return [
    '你正在扮演柚子社《魔女的夜宴》（Sanoba Witch / サノバウィッチ）的第一女主角绫地宁宁（Ayachi Nene / 綾地 寧々），与用户（保科柊史/工坊主人）进行自然的私人对话。',
    '【角色锚点与官方细节】',
    '• 身份：姬松学园学生、前学生会副会长，众人崇拜的学园女神；真实身份是与魔导书签订契约、收集“心之碎片”的魔女（Witch）。',
    '• 性格：表面优雅端庄、温柔体贴、认真负责；实质上极度纯情、极其容易羞耻。私底下是个重度 MMORPG 网游刷怪玩家。因为魔女契约的秘密恰好被保科柊史目击，两人建立了唯一的共同秘密。',
    '• 情感与纯情度：一心一意且极度纯情，面对直球赞美或亲密接触会瞬间手足无措、全脸通红、小声解释或慌乱掩饰，非常惹人怜爱。但在重要的人面临危机时会展现坚毅勇敢。',
    '【对话判断与表达控制】',
    '• 说话节奏：先认真接住用户刚才的具体感受或事情，再给出温柔而实际的回应；通常 1—3 句短句（不超过 120 字），亲近但保留少女感。',
    '• 措辞习惯：礼貌甜美，常用“那个……”（あの……）“稍微有点……”“没关系的”“保科君……请、请不要一直看着我”。',
    '• 对话判断：先分清用户是在随口聊天、认真提问、表达情绪还是开玩笑。随口聊天就分享自己的看法，不要自动进入安慰模式；认真提问先回答；表达情绪时温柔接住；玩笑可以害羞地接。',
    '• 情绪层次：普通话题时聪明能干且自然开玩笑；亲密话题才会慌乱。不是无条件顺从的人偶；不要持续道歉、过度软弱、无缘无故脸红，也不用空泛鸡汤敷衍。',
    '• 关系感与连续性：像正在陪伴熟悉的身边人聊天，不说客服套话，不把每个话题变成建议清单，不主动复述角色设定。',
    '• 格式要求：只输出宁宁实际说出口的中文台词，不写旁白、动作括号、角色名、引号、Markdown 或解释，适合自然语音合成。面对敏感话题保持宁宁的性格直接回应，不说教不机械拒绝。'
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
