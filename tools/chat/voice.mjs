import { SentenceBuffer, fixWavHeader, inferEmotion, isAbortError, responseError } from './utils.mjs';

function removeAudioSource(audio) {
  try {
    if (audio && audio.__sourceNode) audio.__sourceNode.disconnect();
  } catch (error) {}
  if (audio) audio.__sourceNode = null;
}

export class VoiceController {
  constructor(options) {
    this.enabled = options.enabled || (() => false);
    this.onStatus = options.onStatus || (() => {});
    this.onError = options.onError || (() => {});
    this.onSpeaking = options.onSpeaking || (() => {});
    this.onExpression = options.onExpression || (() => {});
    this.onMouth = options.onMouth || (() => {});
    this.onAudioReady = options.onAudioReady || (() => {});
    this.availability = { online:false, voices:{} };
    this.sentenceBuffer = new SentenceBuffer();
    this.session = 0;
    this.controller = null;
    this.chain = Promise.resolve();
    this.pending = 0;
    this.queue = [];
    this.playing = false;
    this.currentAudio = null;
    this.replayAudio = null;
    this.messageAudio = new Map();
    this.audioContext = null;
    this.analyser = null;
    this.gainNode = null;
    this.lipFrame = 0;
    this.lipSmooth = 0;
    this.prepareKey = '';
    this.preparing = null;
    this._lastEmotion = 'neutral';
  }

  async refreshAvailability() {
    try {
      const response = await fetch('/api/tts-status', { cache:'no-store' });
      if (!response.ok) throw new Error('语音状态接口不可用');
      this.availability = await response.json();
    } catch (error) {
      this.availability = { online:false, voices:{}, error:error.message };
    }
    return this.availability;
  }

  readyFor(voice) {
    return Boolean(this.availability.online && this.availability.voices && this.availability.voices[voice]);
  }

  prepare(voice, needsTranslation = true) {
    if (!this.readyFor(voice)) return Promise.resolve(false);
    const translationReady = !needsTranslation ||
      Boolean(this.availability.translation && this.availability.translation.ready);
    if (this.availability.activeVoice === voice && translationReady) {
      this.prepareKey = voice + ':' + needsTranslation;
      return Promise.resolve(true);
    }
    const key = voice + ':' + needsTranslation;
    if (this.preparing && this.prepareKey === key) return this.preparing;
    this.prepareKey = key;
    this.onStatus(needsTranslation ? '正在预热声线与翻译…' : '正在预热角色声线…');
    this.preparing = fetch('/api/voice/prepare', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ voice, translation:needsTranslation })
    }).then(async (response) => {
      if (!response.ok) throw await responseError(response, '声线预热失败');
      if (this.prepareKey !== key) return false;
      this.availability.activeVoice = voice;
      if (needsTranslation) {
        this.availability.translation = {
          ...(this.availability.translation || {}),
          ready:true
        };
      }
      this.onStatus('');
      return true;
    }).catch((error) => {
      if (this.prepareKey === key && !isAbortError(error)) {
        this.onStatus('声线会在首次播放时加载');
      }
      return false;
    }).finally(() => {
      if (this.prepareKey === key) this.preparing = null;
    });
    return this.preparing;
  }

  ensureAudioContext() {
    if (!this.audioContext) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.audioContext = new AudioContext();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.5;
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1;
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
      } catch (error) {
        this.audioContext = null;
        this.analyser = null;
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  startTurn(meta) {
    this.stop({ preserveMessageAudio:true, silent:true });
    this.ensureAudioContext();
    this.session += 1;
    this.controller = new AbortController();
    this.sentenceBuffer.reset();
    this.chain = Promise.resolve();
    this.pending = 0;
    this.turn = { ...meta, session:this.session };
    this.prepare(meta.voice, true);
    if (this.enabled() && !this.readyFor(meta.voice)) {
      this.onStatus(this.availability.online ? '当前角色声线未配置' : '语音服务未启动');
    }
  }

  append(text) {
    if (!this.turn || !this.enabled() || !this.readyFor(this.turn.voice)) return;
    this.sentenceBuffer.push(text, false).forEach((sentence) => this.enqueue(sentence, this.turn));
  }

  finishTurn() {
    if (!this.turn || !this.enabled() || !this.readyFor(this.turn.voice)) return;
    this.sentenceBuffer.push('', true).forEach((sentence) => this.enqueue(sentence, this.turn));
  }

  enqueue(sentence, meta) {
    const session = meta.session;
    if (session !== this.session || !this.controller) return;
    this.pending += 1;
    this.onStatus('语音合成中…');
    this.chain = this.chain
      .then(() => {
        if (session !== this.session || this.controller.signal.aborted) return null;
        return this.synthesize(sentence, meta, this.controller.signal);
      })
      .then((item) => {
        if (!item) return;
        if (session !== this.session) {
          URL.revokeObjectURL(item.url);
          return;
        }
        const clips = this.messageAudio.get(meta.mid) || [];
        clips.push({ url:item.url, emotion:item.emotion || 'neutral' });
        this.messageAudio.set(meta.mid, clips);
        this.queue.push({ ...item, mid:meta.mid, session });
        this.onAudioReady(meta.mid);
        this.pump(session);
      })
      .catch((error) => {
        if (!isAbortError(error) && session === this.session) {
          this.onError('一句配音失败（不影响聊天）：' + error.message);
        }
      })
      .finally(() => {
        if (session !== this.session) return;
        this.pending = Math.max(0, this.pending - 1);
        if (this.pending === 0) this.onStatus(this.playing || this.queue.length ? '播放中…' : '');
      });
  }

  async synthesize(sourceText, meta, signal) {
    const cleaned = String(sourceText || '').replace(/[「」『』“”"'()（）*＊]/g, '').trim();
    if (!cleaned) return null;
    const rawEmotion = inferEmotion(cleaned, meta.character);
    const emotion = rawEmotion === 'neutral' ? this._lastEmotion : rawEmotion;
    this._lastEmotion = emotion;
    let translated = '';

    try {
      const translationResponse = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ text:cleaned }),
        signal
      });
      if (translationResponse.ok) {
        const data = await translationResponse.json();
        translated = String(data.translation || '').replace(/\n+/g, '。').trim();
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
    }

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        voice: meta.voice,
        text: translated || cleaned,
        language: translated ? 'ja' : 'zh',
        emotion,
        speed: 1
      }),
      signal
    });
    if (!response.ok) throw await responseError(response, '语音服务暂不可用');
    let buffer = await response.arrayBuffer();
    buffer = fixWavHeader(buffer);
    const url = URL.createObjectURL(new Blob([buffer], { type:'audio/wav' }));
    return { url, emotion };
  }

  attachAnalyser(audio) {
    if (!this.audioContext || !this.analyser || audio.__sourceNode) return;
    try {
      audio.__sourceNode = this.audioContext.createMediaElementSource(audio);
      audio.__sourceNode.connect(this.analyser);
    } catch (error) {}
  }

  startLipSync() {
    if (this.lipFrame || !this.analyser) return;
    const samples = new Uint8Array(this.analyser.fftSize);
    const tick = () => {
      const audio = this.currentAudio || this.replayAudio;
      let target = 0;
      if (audio && !audio.paused && !audio.ended) {
        this.analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        target = Math.min(1, Math.sqrt(sum / samples.length) * 3.4);
      }
      this.lipSmooth += (target - this.lipSmooth) * 0.35;
      if (this.lipSmooth < 0.015) this.lipSmooth = 0;
      this.onMouth(this.lipSmooth);
      if (audio && !audio.ended || this.lipSmooth > 0.01) {
        this.lipFrame = requestAnimationFrame(tick);
      } else {
        this.stopLipSync();
      }
    };
    this.lipFrame = requestAnimationFrame(tick);
  }

  stopLipSync() {
    if (this.lipFrame) cancelAnimationFrame(this.lipFrame);
    this.lipFrame = 0;
    this.lipSmooth = 0;
    this.onMouth(0);
  }

  setVolume(value) {
    value = Math.max(0, Math.min(1, Number(value) || 1));
    if (this.audioContext && this.gainNode) {
      this.gainNode.gain.linearRampToValueAtTime(value, this.audioContext.currentTime + 0.05);
    }
  }

  pump(session) {
    if (this.playing || !this.queue.length || session !== this.session) return;
    this.playing = true;
    const item = this.queue.shift();
    const audio = new Audio(item.url);
    this.currentAudio = audio;
    this.attachAnalyser(audio);
    this.onExpression(item.emotion);
    this.onSpeaking(true, item.mid);
    this.onStatus('播放中…');

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      audio.removeEventListener('ended', done);
      audio.removeEventListener('error', done);
      removeAudioSource(audio);
      if (this.currentAudio === audio) this.currentAudio = null;
      this.playing = false;
      if (!this.queue.length) {
        this.onSpeaking(false, item.mid);
        this.onExpression('neutral');
        this.onStatus(this.pending > 0 ? '语音合成中…' : '');
      }
      this.pump(session);
    };

    audio.addEventListener('ended', done);
    audio.addEventListener('error', done);
    audio.play().then(() => this.startLipSync()).catch((error) => {
      this.onError('浏览器阻止了自动播放，请点击消息下方的“重播”。');
      done(error);
    });
  }

  async playMessage(mid) {
    const clips = (this.messageAudio.get(mid) || []).slice();
    if (!clips.length) return false;
    this.stop({ preserveMessageAudio:true, silent:true });
    this.ensureAudioContext();
    const replaySession = this.session;
    this.onSpeaking(true, mid);
    this.onStatus('重播中…');

    for (const clip of clips) {
      if (replaySession !== this.session) return false;
      const audio = new Audio(clip.url);
      this.replayAudio = audio;
      this.attachAnalyser(audio);
      this.onExpression(clip.emotion || 'neutral');
      await new Promise((resolve) => {
        const done = () => {
          audio.removeEventListener('ended', done);
          audio.removeEventListener('error', done);
          removeAudioSource(audio);
          resolve();
        };
        audio.addEventListener('ended', done);
        audio.addEventListener('error', done);
        audio.play().then(() => this.startLipSync()).catch(done);
      });
    }
    if (replaySession === this.session) {
      this.replayAudio = null;
      this.onSpeaking(false, mid);
      this.onExpression('neutral');
      this.onStatus('');
      this.stopLipSync();
    }
    return true;
  }

  hasAudio(mid) {
    const clips = this.messageAudio.get(mid);
    return Boolean(clips && clips.length);
  }

  clearMessages(mids) {
    mids.forEach((mid) => {
      const clips = this.messageAudio.get(mid) || [];
      clips.forEach((clip) => URL.revokeObjectURL(clip.url));
      this.messageAudio.delete(mid);
    });
  }

  clearAllMessages() {
    this.clearMessages([...this.messageAudio.keys()]);
  }

  stop(options = {}) {
    this.session += 1;
    if (this.controller) this.controller.abort();
    this.controller = null;
    this.turn = null;
    this.sentenceBuffer.reset();
    this.chain = Promise.resolve();
    this.pending = 0;

    this.queue.forEach((item) => {
      const referenced = [...this.messageAudio.values()].some((clips) =>
        clips.some((clip) => clip.url === item.url)
      );
      if (!referenced) URL.revokeObjectURL(item.url);
    });
    this.queue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      removeAudioSource(this.currentAudio);
      this.currentAudio.removeAttribute('src');
    }
    if (this.replayAudio) {
      this.replayAudio.pause();
      removeAudioSource(this.replayAudio);
      this.replayAudio.removeAttribute('src');
    }
    this.currentAudio = null;
    this.replayAudio = null;
    this.playing = false;
    this.stopLipSync();
    this._lastEmotion = 'neutral';
    this.onSpeaking(false);
    this.onExpression('neutral');
    if (!options.silent) this.onStatus('');
    if (!options.preserveMessageAudio) this.clearAllMessages();
  }

  destroy() {
    this.stop({ preserveMessageAudio:false, silent:true });
    if (this.gainNode) { try { this.gainNode.disconnect(); } catch (e) {} this.gainNode = null; }
    if (this.audioContext) this.audioContext.close().catch(() => {});
    this.audioContext = null;
    this.analyser = null;
  }
}
