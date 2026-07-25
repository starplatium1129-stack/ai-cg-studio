'use strict';

var SerialQueue = require('./serial-queue');
var httpClient = require('./http-client');

var VOICES = ['nene', 'natsume'];
var LANGUAGES = ['ja', 'zh'];
var EMOTIONS = ['neutral', 'gentle', 'happy', 'shy', 'serious', 'sad'];

function normalizeSpeechText(value, language) {
  var text = String(value || '').normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '。')
    .replace(/。{2,}/g, '。')
    .trim();
  if (language === 'ja') {
    text = text
      .replace(/绫地宁宁|綾地寧々|綾地寧寧/g, 'あやち ねね')
      .replace(/四季夏目|四季ナツメ/g, 'しき なつめ')
      .replace(/\.\.\.|…{2,}/g, '……');
  }
  return text;
}

function validateInput(input, profiles) {
  var voice = String(input && input.voice || '');
  var rawText = String(input && input.text || '').trim();
  var language = String(input && input.language || 'ja').toLowerCase();
  var emotion = String(input && input.emotion || 'neutral').toLowerCase();
  var consistency = String(input && input.consistency || 'adaptive').toLowerCase();
  var referenceEmotion = String(input && input.referenceEmotion || emotion).toLowerCase();
  var speed = Number(input && input.speed);
  var profile = profiles[voice];

  if (!VOICES.includes(voice)) return { error:'不支持的角色声线', status:400 };
  if (!LANGUAGES.includes(language)) return { error:'语音语言仅支持日语或中文', status:400 };
  if (!rawText || rawText.length > 2000) return { error:'台词长度必须在 1—2000 字之间', status:400 };
  if (!profile || !profile.refAudioPath || !profile.promptText) {
    return { error:'该角色尚未在启动控制面板配置 GPT-SoVITS 参考音频', status:409 };
  }
  if (!EMOTIONS.includes(emotion)) emotion = 'neutral';
  if (!EMOTIONS.includes(referenceEmotion)) referenceEmotion = emotion;
  if (consistency !== 'locked') consistency = 'adaptive';
  if (!Number.isFinite(speed)) speed = 1;
  speed = Math.max(0.75, Math.min(1.35, speed));

  var text = normalizeSpeechText(rawText, language);
  if (!text) return { error:'台词规范化后为空', status:400 };
  var referenceKey = consistency === 'locked' ? referenceEmotion : emotion;
  var emotionReference = language === 'ja' && profile.references && profile.references[referenceKey];
  var seed = Number.isFinite(Number(profile.seed)) ? Math.max(0, Math.min(2147483647, Math.round(Number(profile.seed)))) : 1234;
  var topK = Number.isFinite(Number(profile.topK)) ? Math.max(1, Math.min(100, Math.round(Number(profile.topK)))) : 15;
  var topP = Number.isFinite(Number(profile.topP)) ? Math.max(0.1, Math.min(1, Number(profile.topP))) : 1;
  var temperature = Number.isFinite(Number(profile.temperature)) ? Math.max(0.1, Math.min(2, Number(profile.temperature))) : 1;
  return {
    value:{
      voice:voice,
      profile:profile,
      consistency:consistency,
      referenceEmotion:referenceKey,
      payload:{
        text:text,
        text_lang:language,
        ref_audio_path:emotionReference && emotionReference.refAudioPath || profile.refAudioPath,
        prompt_lang:emotionReference && emotionReference.promptLang || profile.promptLang || 'ja',
        prompt_text:emotionReference && emotionReference.promptText || profile.promptText,
        // 前端已经按完整句切分；再次按长度切分会制造句中音高和停顿跳变。
        text_split_method:'cut0',
        batch_size:1,
        split_bucket:false,
        speed_factor:speed,
        seed:seed,
        top_k:topK,
        top_p:topP,
        temperature:temperature,
        parallel_infer:false,
        media_type:'wav',
        // 浏览器会等待完整短句 WAV 后播放；流式音频并不能降低实际
        // 开口延迟，反而会增加片段边界不一致的风险。
        streaming_mode:false
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
  var activeVoice = '';

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

  async function activate(voice, profile, signal) {
    if (profile.sovitsWeightsPath && profile.sovitsWeightsPath !== activeSoVitsWeights) {
      await setWeights('/set_sovits_weights?weights_path=' + encodeURIComponent(profile.sovitsWeightsPath), signal);
      activeSoVitsWeights = profile.sovitsWeightsPath;
    }
    if (profile.gptWeightsPath && profile.gptWeightsPath !== activeGptWeights) {
      await setWeights('/set_gpt_weights?weights_path=' + encodeURIComponent(profile.gptWeightsPath), signal);
      activeGptWeights = profile.gptWeightsPath;
    }
    activeVoice = voice;
  }

  function prepare(voice, signal) {
    voice = String(voice || '');
    var profile = profiles[voice];
    if (!VOICES.includes(voice) || !profile || !profile.refAudioPath || !profile.promptText) {
      var error = new Error('该角色尚未配置可用声线');
      error.status = 409;
      return Promise.reject(error);
    }
    return queue.run(async function (queueMeta) {
      if (signal && signal.aborted) throw httpClient.abortError();
      await activate(voice, profile, signal);
      return { voice:voice, queueWaitMs:queueMeta.waitMs };
    });
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
      await activate(validation.value.voice, validation.value.profile, optionsForStream.signal);
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
      activeVoice:activeVoice,
      queue:queue.status()
    };
  }

  return {
    status:status,
    prepare:prepare,
    stream:stream,
    validate:function (input) { return validateInput(input, profiles); },
    queueStatus:function () { return queue.status(); }
  };
}

module.exports = {
  createTtsService:createTtsService,
  validateInput:validateInput,
  normalizeSpeechText:normalizeSpeechText,
  VOICES:VOICES,
  LANGUAGES:LANGUAGES,
  EMOTIONS:EMOTIONS
};
