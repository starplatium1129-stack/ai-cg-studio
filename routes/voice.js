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

// ── 流式播放支持（GET /api/tts）────────────────────────────────────────
// 公网访客配音慢的主因是前端等整段 WAV 下载完才播放。audio 元素直接指向
// GET 端点后浏览器对 PCM WAV 边下边播，播放开始只等"生成完 + 传输首块"。
// 服务端同时缓存最近生成的音频（按文本哈希）：重播/多访客说同一句直接
// 回放缓存，不再重复占用 GPU 队列。
var ttsAudioCache = new Map();
var TTS_CACHE_MAX_ENTRIES = 60;

// 与前端 src/utils/stream.ts 的 fixWavHeader 等价：GPT-SoVITS 的 RIFF 长度
// 字段不可靠，修好后浏览器（含流式解码）才能稳定播放。
function fixWavHeaderServer(buffer) {
  try {
    if (buffer.length < 44) return buffer;
    if (buffer.readUInt32BE(0) !== 0x52494646 || buffer.readUInt32BE(8) !== 0x57415645) return buffer;
    buffer.writeUInt32LE(buffer.length - 8, 4);
    var position = 12;
    while (position + 8 <= buffer.length) {
      var tag = buffer.readUInt32BE(position);
      var size = buffer.readUInt32LE(position + 4);
      if (tag === 0x64617461) { buffer.writeUInt32LE(buffer.length - position - 8, position + 4); break; }
      if (size > buffer.length || position + 8 + size > buffer.length + 1) break;
      position += 8 + size + (size % 2);
    }
  } catch (error) { /* 头损坏时原样返回，浏览器端还有兜底 */ }
  return buffer;
}

function cacheTtsAudio(key, buffer) {
  if (ttsAudioCache.has(key)) ttsAudioCache.delete(key);
  ttsAudioCache.set(key, buffer);
  while (ttsAudioCache.size > TTS_CACHE_MAX_ENTRIES) {
    var oldest = ttsAudioCache.keys().next().value;
    if (oldest === undefined) break;
    ttsAudioCache.delete(oldest);
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

  // 流式播放端点：audio 元素直连（GET），浏览器对 WAV 边下边播。
  // 参数与 POST /api/tts 相同，长文本请走 POST（URL 长度限制）。
  router.get('/api/tts', ttsLimit, function (req, res) {
    var body = {
      voice:String(req.query.voice || ''),
      text:String(req.query.text || ''),
      language:String(req.query.language || 'ja'),
      emotion:String(req.query.emotion || 'neutral'),
      referenceEmotion:String(req.query.referenceEmotion || ''),
      consistency:String(req.query.consistency || 'adaptive'),
      speed:Number(req.query.speed || 1)
    };
    if (body.text.length > 1200) return envelope.fail(res, 413, '长文本请使用 POST /api/tts');
    var validation = tts.validate(body);
    if (validation.error) return envelope.fail(res, validation.status, validation.error);

    var cacheKey = [body.voice, body.language, body.text, body.referenceEmotion, body.consistency, body.speed].join('|');
    var cached = ttsAudioCache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-TTS-Cache', 'hit');
      res.end(cached);
      return;
    }

    var controller = new AbortController();
    req.once('aborted', function () { controller.abort(); });
    res.once('close', function () { if (!res.writableEnded) controller.abort(); });

    tts.stream(body, {
      signal:controller.signal,
      onResponse:async function (result) {
        if (controller.signal.aborted) throw httpClient.abortError();
        var chunks = [];
        for await (var chunk of result.response) { chunks.push(Buffer.from(chunk)); }
        if (controller.signal.aborted) throw httpClient.abortError();
        var audio = fixWavHeaderServer(Buffer.concat(chunks));
        if (audio.length < 64) throw new Error('语音服务返回空音频');
        cacheTtsAudio(cacheKey, audio);
        if (res.destroyed || res.writableEnded) return;
        res.status(200);
        res.setHeader('Content-Type', result.contentType || 'audio/wav');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-TTS-Cache', 'miss');
        res.flushHeaders();
        await relayAudio([audio], res);
        if (!res.writableEnded) res.end();
      }
    }).catch(function (error) {
      if (httpClient.isAbortError(error) || controller.signal.aborted) return;
      if (!res.headersSent) {
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
