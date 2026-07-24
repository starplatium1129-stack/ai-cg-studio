'use strict';

var SerialQueue = require('./serial-queue');
var httpClient = require('./http-client');

var VOICES = ['nene', 'natsume'];
var LANGUAGES = ['ja', 'zh'];
var EMOTIONS = ['neutral', 'gentle', 'happy', 'shy', 'serious', 'sad'];

function validateInput(input, profiles) {
  var voice = String(input && input.voice || '');
  var text = String(input && input.text || '').trim();
  var language = String(input && input.language || 'ja').toLowerCase();
  var emotion = String(input && input.emotion || 'neutral').toLowerCase();
  var speed = Number(input && input.speed);
  var profile = profiles[voice];

  if (!VOICES.includes(voice)) return { error:'不支持的角色声线', status:400 };
  if (!LANGUAGES.includes(language)) return { error:'语音语言仅支持日语或中文', status:400 };
  if (!text || text.length > 2000) return { error:'台词长度必须在 1—2000 字之间', status:400 };
  if (!profile || !profile.refAudioPath || !profile.promptText) {
    return { error:'该角色尚未在启动控制面板配置 GPT-SoVITS 参考音频', status:409 };
  }
  if (!EMOTIONS.includes(emotion)) emotion = 'neutral';
  if (!Number.isFinite(speed)) speed = 1;
  speed = Math.max(0.75, Math.min(1.35, speed));

  var emotionReference = language === 'ja' && profile.references && profile.references[emotion];
  return {
    value:{
      voice:voice,
      profile:profile,
      payload:{
        text:text,
        text_lang:language,
        ref_audio_path:emotionReference && emotionReference.refAudioPath || profile.refAudioPath,
        prompt_lang:emotionReference && emotionReference.promptLang || profile.promptLang || 'ja',
        prompt_text:emotionReference && emotionReference.promptText || profile.promptText,
        text_split_method:'cut5',
        batch_size:1,
        speed_factor:speed,
        media_type:'wav',
        streaming_mode:true
      }
    }
  };
}

function createTtsService(options) {
  var host = options.host;
  var profiles = options.profiles || {};
  var queue = new SerialQueue('gpt-sovits');
  var activeGptWeights = '';
  var activeSoVitsWeights = '';

  function voiceMap() {
    var result = {};
    VOICES.forEach(function (id) {
      var profile = profiles[id] || {};
      result[id] = !!(profile.refAudioPath && profile.promptText);
    });
    return result;
  }

  async function isOnline(signal) {
    try {
      var result = await httpClient.request(host, '/docs', {
        timeoutMs:1500,
        timeoutMessage:'GPT-SoVITS status request timed out',
        signal:signal
      });
      result.response.resume();
      return result.response.statusCode >= 200 && result.response.statusCode < 500;
    } catch (error) {
      if (httpClient.isAbortError(error)) throw error;
      return false;
    }
  }

  async function setWeights(pathname, signal) {
    await httpClient.expectSuccess(host, pathname, {
      timeoutMs:30000,
      signal:signal
    });
  }

  async function activate(profile, signal) {
    if (profile.sovitsWeightsPath && profile.sovitsWeightsPath !== activeSoVitsWeights) {
      await setWeights('/set_sovits_weights?weights_path=' + encodeURIComponent(profile.sovitsWeightsPath), signal);
      activeSoVitsWeights = profile.sovitsWeightsPath;
    }
    if (profile.gptWeightsPath && profile.gptWeightsPath !== activeGptWeights) {
      await setWeights('/set_gpt_weights?weights_path=' + encodeURIComponent(profile.gptWeightsPath), signal);
      activeGptWeights = profile.gptWeightsPath;
    }
  }

  function stream(input, optionsForStream) {
    optionsForStream = optionsForStream || {};
    var validation = validateInput(input, profiles);
    if (validation.error) {
      var validationError = new Error(validation.error);
      validationError.status = validation.status;
      return Promise.reject(validationError);
    }

    return queue.run(async function (queueMeta) {
      if (optionsForStream.signal && optionsForStream.signal.aborted) throw httpClient.abortError();
      await activate(validation.value.profile, optionsForStream.signal);
      var upstream = await httpClient.request(host, '/tts', {
        method:'POST',
        json:validation.value.payload,
        timeoutMs:5 * 60 * 1000,
        timeoutMessage:'GPT-SoVITS 生成超时',
        signal:optionsForStream.signal
      });

      if (upstream.response.statusCode < 200 || upstream.response.statusCode >= 300) {
        var errorBody = await httpClient.readBody(upstream.response, 1024 * 1024);
        throw new httpClient.UpstreamError('GPT-SoVITS returned ' + upstream.response.statusCode, {
          code:'TTS_FAILED',
          status:upstream.response.statusCode,
          detail:errorBody.toString('utf8').slice(0, 500)
        });
      }

      if (optionsForStream.onResponse) {
        await optionsForStream.onResponse({
          response:upstream.response,
          request:upstream.request,
          contentType:upstream.response.headers['content-type'] || 'audio/wav',
          queueWaitMs:queueMeta.waitMs
        });
      } else {
        // A caller that does not relay the body must still drain it before the
        // queue is released; otherwise another voice could swap model weights
        // while GPT-SoVITS is still producing the previous sentence.
        for await (var chunk of upstream.response) void chunk;
      }
      return { queueWaitMs:queueMeta.waitMs };
    });
  }

  async function status(signal) {
    return {
      online:await isOnline(signal),
      engine:'GPT-SoVITS',
      voices:voiceMap(),
      queue:queue.status()
    };
  }

  return {
    status:status,
    stream:stream,
    validate:function (input) { return validateInput(input, profiles); },
    queueStatus:function () { return queue.status(); }
  };
}

module.exports = {
  createTtsService:createTtsService,
  validateInput:validateInput,
  VOICES:VOICES,
  LANGUAGES:LANGUAGES,
  EMOTIONS:EMOTIONS
};
