'use strict';
const SerialQueue = require("./serial-queue");
const httpClient = require("./http-client");
const VOICES = ['nene', 'natsume'];
const LANGUAGES = ['ja', 'zh'];
const EMOTIONS = ['neutral', 'gentle', 'happy', 'shy', 'serious', 'sad'];
function normalizeSpeechText(value, language) {
    let text = String(value || '')
        .normalize('NFKC')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
        // GPT-SoVITS' Windows-side Japanese tokenizer can fail while logging U+30FB
        // through a GBK console.  It is an emphasis separator, not spoken content.
        .replace(/\u30fb/g, '')
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
    const voice = String((input && input.voice) || '');
    const rawText = String((input && input.text) || '').trim();
    const language = String((input && input.language) || 'ja').toLowerCase();
    let emotion = String((input && input.emotion) || 'neutral').toLowerCase();
    let consistency = String((input && input.consistency) || 'adaptive').toLowerCase();
    let referenceEmotion = String((input && input.referenceEmotion) || emotion).toLowerCase();
    let speed = Number(input && input.speed);
    const profile = profiles[voice];
    if (!VOICES.includes(voice)) {
        return { error: '不支持的角色声线', status: 400 };
    }
    if (!LANGUAGES.includes(language)) {
        return { error: '语音语言仅支持日语或中文', status: 400 };
    }
    if (!rawText || rawText.length > 2000) {
        return { error: '台词长度必须在 1—2000 字之间', status: 400 };
    }
    if (!profile || !profile.refAudioPath || !profile.promptText) {
        return { error: '该角色尚未在启动控制面板配置 GPT-SoVITS 参考音频', status: 409 };
    }
    if (!EMOTIONS.includes(emotion))
        emotion = 'neutral';
    if (!EMOTIONS.includes(referenceEmotion))
        referenceEmotion = emotion;
    if (consistency !== 'locked')
        consistency = 'adaptive';
    if (!Number.isFinite(speed))
        speed = 1;
    speed = Math.max(0.75, Math.min(1.35, speed));
    const text = normalizeSpeechText(rawText, language);
    if (!text)
        return { error: '台词规范化后为空', status: 400 };
    const referenceKey = consistency === 'locked' ? referenceEmotion : emotion;
    const emotionReference = language === 'ja' && profile.references
        ? profile.references[referenceKey]
        : undefined;
    const seed = Number.isFinite(Number(profile.seed))
        ? Math.max(0, Math.min(2147483647, Math.round(Number(profile.seed))))
        : 1234;
    const topK = Number.isFinite(Number(profile.topK))
        ? Math.max(1, Math.min(100, Math.round(Number(profile.topK))))
        : 15;
    const topP = Number.isFinite(Number(profile.topP))
        ? Math.max(0.1, Math.min(1, Number(profile.topP)))
        : 1;
    const temperature = Number.isFinite(Number(profile.temperature))
        ? Math.max(0.1, Math.min(2, Number(profile.temperature)))
        : 1;
    return {
        value: {
            voice: voice,
            profile: profile,
            consistency: consistency,
            referenceEmotion: referenceKey,
            payload: {
                text: text,
                text_lang: language,
                ref_audio_path: (emotionReference && emotionReference.refAudioPath) || profile.refAudioPath,
                prompt_lang: (emotionReference && emotionReference.promptLang) || profile.promptLang || 'ja',
                prompt_text: (emotionReference && emotionReference.promptText) || profile.promptText,
                // cut5 is the stable Japanese sentence splitter for the installed
                // GPT-SoVITS v2Pro/v2ProPlus API; cut0 rejects ordinary Japanese text.
                text_split_method: 'cut5',
                batch_size: 1,
                split_bucket: false,
                speed_factor: speed,
                seed: seed,
                top_k: topK,
                top_p: topP,
                temperature: temperature,
                parallel_infer: false,
                media_type: 'wav',
                streaming_mode: false
            }
        }
    };
}
function statusError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}
function createTtsService(options) {
    const host = options.host;
    const profiles = options.profiles || {};
    const queue = new SerialQueue('gpt-sovits');
    let activeGptWeights = '';
    let activeSoVitsWeights = '';
    let activeVoice = '';
    function voiceMap() {
        const result = {};
        for (const id of VOICES) {
            const profile = profiles[id] || {};
            result[id] = !!(profile.refAudioPath && profile.promptText);
        }
        return result;
    }
    async function isOnline(signal) {
        try {
            const result = await httpClient.request(host, '/docs', {
                timeoutMs: 1500,
                timeoutMessage: 'GPT-SoVITS status request timed out',
                signal: signal
            });
            result.response.resume();
            const statusCode = result.response.statusCode || 0;
            return statusCode >= 200 && statusCode < 500;
        }
        catch (error) {
            if (httpClient.isAbortError(error))
                throw error;
            return false;
        }
    }
    async function setWeights(pathname, signal) {
        await httpClient.expectSuccess(host, pathname, {
            timeoutMs: 30000,
            signal: signal
        });
    }
    async function activate(voice, profile, signal) {
        if (profile.sovitsWeightsPath && profile.sovitsWeightsPath !== activeSoVitsWeights) {
            await setWeights('/set_sovits_weights?weights_path=' + encodeURIComponent(profile.sovitsWeightsPath), signal);
        }
        if (profile.gptWeightsPath && profile.gptWeightsPath !== activeGptWeights) {
            await setWeights('/set_gpt_weights?weights_path=' + encodeURIComponent(profile.gptWeightsPath), signal);
        }
        // Commit cache state only after the entire upstream switch succeeds. A
        // partial switch must be retried in full because the engine state is unknown.
        activeSoVitsWeights = profile.sovitsWeightsPath || '';
        activeGptWeights = profile.gptWeightsPath || '';
        activeVoice = voice;
    }
    function prepare(voice, signal) {
        const voiceId = String(voice || '');
        const profile = profiles[voiceId];
        if (!VOICES.includes(voiceId) ||
            !profile ||
            !profile.refAudioPath ||
            !profile.promptText) {
            return Promise.reject(statusError('该角色尚未配置可用声线', 409));
        }
        return queue.run(async function (queueMeta) {
            if (signal && signal.aborted)
                throw httpClient.abortError();
            await activate(voiceId, profile, signal);
            return { voice: voiceId, queueWaitMs: queueMeta.waitMs };
        }, { signal: signal });
    }
    function stream(input, optionsForStream) {
        const streamOpts = optionsForStream || {};
        const validation = validateInput(input, profiles);
        if (!validation.value) {
            return Promise.reject(statusError(validation.error || 'invalid TTS input', validation.status || 400));
        }
        const validated = validation.value;
        return queue.run(async function (queueMeta) {
            if (streamOpts.signal && streamOpts.signal.aborted)
                throw httpClient.abortError();
            await activate(validated.voice, validated.profile, streamOpts.signal);
            const upstream = await httpClient.request(host, '/tts', {
                method: 'POST',
                json: validated.payload,
                // 单句 44 字内正常生成 10-30s；180s 上限覆盖排队（16 项队列）
                // 也足以兜住异常。5 分钟超时会卡死整条 GPU 队列 5 分钟，
                // 缩短后挂起的引擎更快失败并释放队列（客户端会自动提示重播）。
                timeoutMs: 180 * 1000,
                timeoutMessage: 'GPT-SoVITS 生成超时',
                signal: streamOpts.signal
            });
            const statusCode = upstream.response.statusCode || 0;
            if (statusCode < 200 || statusCode >= 300) {
                const errorBody = await httpClient.readBody(upstream.response, 1024 * 1024);
                throw new httpClient.UpstreamError('GPT-SoVITS returned ' + statusCode, {
                    code: 'TTS_FAILED',
                    status: statusCode,
                    detail: errorBody.toString('utf8').slice(0, 500)
                });
            }
            if (streamOpts.onResponse) {
                await streamOpts.onResponse({
                    response: upstream.response,
                    request: upstream.request,
                    contentType: upstream.response.headers['content-type'] || 'audio/wav',
                    queueWaitMs: queueMeta.waitMs
                });
            }
            else {
                for await (const chunk of upstream.response)
                    void chunk;
            }
            return { queueWaitMs: queueMeta.waitMs };
        }, { signal: streamOpts.signal });
    }
    async function status(signal) {
        return {
            online: await isOnline(signal),
            engine: 'GPT-SoVITS',
            voices: voiceMap(),
            activeVoice: activeVoice,
            queue: queue.status()
        };
    }
    return {
        status: status,
        prepare: prepare,
        stream: stream,
        validate: function (input) {
            return validateInput(input, profiles);
        },
        queueStatus: function () {
            return queue.status();
        }
    };
}
module.exports = {
    createTtsService: createTtsService,
    validateInput: validateInput,
    normalizeSpeechText: normalizeSpeechText,
    VOICES: VOICES,
    LANGUAGES: LANGUAGES,
    EMOTIONS: EMOTIONS
};
