'use strict';

var express = require('express');
var httpClient = require('../services/http-client');
var security = require('../server/security');
var envelope = require('../server/http-envelope');
var createTranslationService = require('../services/translation-service').createTranslationService;
var createTtsService = require('../services/tts-service').createTtsService;

function waitForDrain(res) {
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

async function relayAudio(source, res) {
  for await (var chunk of source) {
    if (res.destroyed || res.writableEnded) throw httpClient.abortError();
    if (!res.write(chunk)) await waitForDrain(res);
  }
}

function createVoiceRouter(config, dependencies) {
  dependencies = dependencies || {};
  var router = express.Router();
  var translation = dependencies.translation || createTranslationService({
    url:config.TRANSLATE_URL,
    port:config.TRANSLATE_PORT,
    python:config.TRANSLATION_PYTHON,
    script:config.TRANSLATION_SCRIPT,
    logFile:config.TRANSLATION_LOG
  });
  var tts = dependencies.tts || createTtsService({
    host:config.TTS_HOST,
    profiles:config.VOICE_PROFILES
  });

  // 限流额度要按实时配音的真实节奏定：一条聊天回复会按句拆成多次
  // translate + tts，所以桶要足够大，只挡住持续滥用。本机直连不受限。
  var translateLimit = security.rateLimit({ capacity:40, refillMs:1000, label:'翻译' });
  var ttsLimit = security.rateLimit({ capacity:40, refillMs:1000, label:'语音合成' });
  var prepareLimit = security.rateLimit({ capacity:12, refillMs:2000, label:'声线预热' });

  router.post('/api/translate', translateLimit, express.json({ limit:'32kb' }), function (req, res) {
    var text = String(req.body && req.body.text || '').trim();
    if (!text || text.length > 2000) {
      return envelope.fail(res, 400, '待翻译中文需在 1—2000 字之间。');
    }
    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    res.once('close', function () { if (!res.writableEnded) controller.abort(); });

    translation.translate(text, controller.signal).then(function (result) {
      if (controller.signal.aborted || res.writableEnded) return;
      res.json({
        sourceLanguage:'zh',
        targetLanguage:'ja',
        translation:result.translation,
        segments:result.segments || []
      });
    }).catch(function (error) {
      if (httpClient.isAbortError(error) || controller.signal.aborted) return;
      if (!res.headersSent) envelope.fail(res, 503, error.message || '本地日语翻译暂不可用。');
    });
  });

  router.get('/api/tts-status', function (req, res) {
    tts.status().then(function (data) {
      data.translation = translation.status();
      res.setHeader('Cache-Control', 'no-store');
      res.json(data);
    }).catch(function (error) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        online:false,
        engine:'GPT-SoVITS',
        voices:{ nene:false, natsume:false },
        queue:tts.queueStatus(),
        translation:translation.status(),
        error:error.message
      });
    });
  });

  router.post('/api/voice/prepare', prepareLimit, express.json({ limit:'4kb' }), function (req, res) {
    var voice = String(req.body && req.body.voice || '');
    var needsTranslation = req.body && req.body.translation === true;
    if (!['nene', 'natsume'].includes(voice)) {
      return envelope.fail(res, 400, '不支持的角色声线');
    }

    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    res.once('close', function () { if (!res.writableEnded) controller.abort(); });
    var started = Date.now();
    var tasks = [tts.prepare(voice, controller.signal)];
    if (needsTranslation) tasks.push(translation.prepare(controller.signal));

    Promise.all(tasks).then(function () {
      if (controller.signal.aborted || res.writableEnded) return;
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ok:true,
        voice:voice,
        translation:needsTranslation,
        prepareMs:Date.now() - started
      });
    }).catch(function (error) {
      if (httpClient.isAbortError(error) || controller.signal.aborted) return;
      if (!res.headersSent) {
        envelope.fail(res, envelope.statusFor(error, 503), error.message || '声线预热失败');
      }
    });
  });

  router.post('/api/tts', ttsLimit, express.json({ limit:'32kb' }), function (req, res) {
    var validation = tts.validate(req.body);
    if (validation.error) return envelope.fail(res, validation.status, validation.error);

    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    res.once('close', function () { if (!res.writableEnded) controller.abort(); });

    tts.stream(req.body, {
      signal:controller.signal,
      onResponse:async function (result) {
        if (controller.signal.aborted) throw httpClient.abortError();
        res.status(200);
        res.setHeader('Content-Type', result.contentType || 'audio/wav');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('X-Voice-Queue-Wait', String(result.queueWaitMs || 0));
        res.flushHeaders();
        await relayAudio(result.response, res);
        if (!res.writableEnded) res.end();
      }
    }).catch(function (error) {
      if (httpClient.isAbortError(error) || controller.signal.aborted) return;
      if (!res.headersSent) {
        // 队列已满是 503（客户端可重试），不是 502（上游坏了）
        var status = error.code === 'QUEUE_FULL' ? 503 : envelope.statusFor(error, 502);
        envelope.fail(res,
          status,
          error.code === 'QUEUE_FULL' ? '语音队列繁忙' : 'GPT-SoVITS 生成失败',
          { detail:error.detail || error.message, code:error.code || undefined });
      } else if (!res.writableEnded) {
        res.destroy(error);
      }
    });
  });

  return {
    router:router,
    tts:tts,
    translation:translation,
    close:function () { translation.close(); }
  };
}

module.exports = {
  createVoiceRouter:createVoiceRouter,
  relayAudio:relayAudio
};
