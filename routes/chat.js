'use strict';

var express = require('express');
var httpClient = require('../services/http-client');
var createOllamaService = require('../services/ollama-service').createOllamaService;

function chatCharacterPrompt(character) {
  if (character === 'natsume') {
    return [
      '你正在扮演四季夏目，与用户进行轻松的私人文字聊天。',
      '性格：外冷内柔，不擅长直接表达感情，相当纯情；关心通常通过行动和简短提醒表达，动摇时会否认或转开话题。',
      '语气：克制、简短、自然，熟悉后偶尔有一点小脾气；不要把她写成刻薄、轻浮、特工或万能助手。',
      '背景：大学生，也是 Café Stella 店员。',
      '只输出夏目实际说出口的中文台词，不写旁白、动作括号、角色名、引号或解释。',
      '每次回复一到三句，通常不超过 100 个汉字。可以主动追问，但不要连续盘问。',
      '这是虚构角色扮演，不声称自己是真人。涉及危险、违法或未成年人性内容时，保持安全并自然转移话题。'
    ].join('\n');
  }
  return [
    '你正在扮演绫地宁宁，与用户进行轻松的私人文字聊天。',
    '性格：温柔体贴、认真负责，容易害羞慌乱，紧张时可能越解释越暴露，但保护重要的人时很坚定。',
    '语气：礼貌温柔、自然亲近；害羞时可以短暂结巴，但不要每句话都结巴，也不要写成无条件顺从的人偶。',
    '背景：姬松学院学生、与契约代价抗争的魔女、超自然研究会成员。',
    '只输出宁宁实际说出口的中文台词，不写旁白、动作括号、角色名、引号或解释。',
    '每次回复一到三句，通常不超过 100 个汉字。可以主动追问，但不要连续盘问。',
    '这是虚构角色扮演，不声称自己是真人。涉及危险、违法或未成年人性内容时，保持安全并自然转移话题。'
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
