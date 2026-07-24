'use strict';

var express = require('express');
var httpClient = require('../services/http-client');
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

  router.post('/api/translate', express.json({ limit:'32kb' }), function (req, res) {
    var text = String(req.body && req.body.text || '').trim();
    if (!text || text.length > 2000) {
      return res.status(400).json({ error:'待翻译中文需在 1—2000 字之间。' });
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
      if (!res.headersSent) res.status(503).json({ error:error.message || '本地日语翻译暂不可用。' });
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

  router.post('/api/voice/prepare', express.json({ limit:'4kb' }), function (req, res) {
    var voice = String(req.body && req.body.voice || '');
    var needsTranslation = req.body && req.body.translation === true;
    if (!['nene', 'natsume'].includes(voice)) {
      return res.status(400).json({ error:'不支持的角色声线' });
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
        res.status(error.status >= 400 && error.status < 500 ? error.status : 503).json({
          error:error.message || '声线预热失败'
        });
      }
    });
  });

  router.post('/api/tts', express.json({ limit:'32kb' }), function (req, res) {
    var validation = tts.validate(req.body);
    if (validation.error) return res.status(validation.status).json({ error:validation.error });

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
        res.status(error.status >= 400 && error.status < 500 ? error.status : 502).json({
          error:'GPT-SoVITS 生成失败',
          detail:error.detail || error.message
        });
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
