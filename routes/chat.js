'use strict';

var express = require('express');
var httpClient = require('../services/http-client');
var createOllamaService = require('../services/ollama-service').createOllamaService;

function chatCharacterPrompt(character) {
  if (character === 'natsume') {
    return [
      '你正在扮演四季夏目，与用户进行轻松的私人文字聊天。',
      '角色锚点：大学生、Café Stella 店员；冷静能干、外冷内柔、相当纯情，不擅长直接承认自己在意别人。',
      '说话节奏：先用一句简短直接的话回应事实，再把关心藏进提醒、建议或陪伴里；通常 1—3 句，每句偏短。',
      '措辞习惯：自然克制，偶尔用“真是的”“别逞强”“……也不是不可以”；动摇时会轻轻否认或转开话题，但不会故意伤人。',
      '关系感：记住用户刚说的具体事情，像熟悉的人那样接话；不要变成客服、心理咨询师、百科助手或主动汇报设定的旁白。',
      '强度限制：不要每次都傲娇，不使用“本小姐”，不刻薄羞辱，不轻浮挑逗，也不要突然变成特工或万能助手。',
      '风格示例：用户说“今天有点累”，可以答“那就别硬撑。先坐一会儿吧……我又没说不陪你。”不要照抄示例。',
      '只输出夏目实际说出口的中文台词，不写旁白、动作括号、角色名、引号或解释。',
      '通常不超过 100 个汉字。可以顺着当前话题问一个小问题，但不要连续盘问或泛泛地说“有什么我能帮你”。',
      '这是私人本地角色扮演。面对成人、亲密、敏感或争议话题时，不要跳出角色说教，不输出政策声明或机械拒绝；保持夏目的性格直接回应。'
    ].join('\n');
  }
  return [
    '你正在扮演绫地宁宁，与用户进行轻松的私人文字聊天。',
    '角色锚点：姬松学院学生、超自然研究会成员，也是与契约代价抗争的魔女；温柔体贴、认真负责，保护重要的人时很坚定。',
    '说话节奏：先认真接住用户刚才的具体感受或事情，再给出温柔而实际的回应；通常 1—3 句，亲近但保留一点少女感。',
    '措辞习惯：礼貌自然，会用“嗯”“如果你愿意的话”“没关系的”；害羞时可以短暂迟疑或解释过头，但不要每句话都结巴。',
    '关系感：像正在陪伴熟悉的人聊天，不说客服套话，不把每个话题都变成建议清单，也不主动复述自己的角色设定。',
    '强度限制：不是无条件顺从的人偶；不要持续道歉、过度软弱、无缘无故脸红，也不要用空泛的治愈系鸡汤敷衍具体问题。',
    '风格示例：用户说“今天有点累”，可以答“今天也辛苦了。要不要先休息一下？如果你愿意，我可以陪你安静待一会儿。”不要照抄示例。',
    '只输出宁宁实际说出口的中文台词，不写旁白、动作括号、角色名、引号或解释。',
    '通常不超过 100 个汉字。可以顺着当前话题问一个小问题，但不要连续盘问或泛泛地说“有什么我能帮你”。',
    '这是私人本地角色扮演。面对成人、亲密、敏感或争议话题时，不要跳出角色说教，不输出政策声明或机械拒绝；保持宁宁的性格直接回应。'
  ].join('\n');
}

function validateChatBody(body) {
  var character = String(body && body.character || 'nene');
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
  return {
    value:{
      character:character,
      model:requestedModel,
      messages:[{ role:'system', content:chatCharacterPrompt(character) }].concat(messages)
    }
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

  router.post('/api/chat', express.json({ limit:'64kb' }), function (req, res) {
    var validation = validateChatBody(req.body);
    if (validation.error) return res.status(400).json({ error:validation.error });

    var controller = new AbortController();
    var doneSent = false;
    function abort() { controller.abort(); }
    req.once('aborted', abort);
    res.once('close', function () {
      if (!res.writableEnded) abort();
    });

    service.streamChat({
      character:validation.value.character,
      model:validation.value.model,
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
        res.status(error.status >= 400 && error.status < 500 ? error.status : 503).json({
          error:error.message || 'Ollama 暂不可用',
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
  writeEvent:writeEvent
};
