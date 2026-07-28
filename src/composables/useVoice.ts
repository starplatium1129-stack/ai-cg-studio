import { ref } from 'vue'
import {
  SentenceBuffer, extractSpokenDialogue, fixWavHeader, inferEmotion, isAbortError, responseError,
} from '@/utils/stream'

export interface VoiceAvailability {
  online: boolean
  voices?: Record<string, boolean>
  translation?: { ready: boolean }
  activeVoice?: string
  error?: string
}

interface VoiceTurn {
  mid: string
  voice: string
  character: string
  session: number
  referenceEmotion: string
}

interface PreparedSentence {
  text: string
  language: 'ja' | 'zh'
  emotion: string
  consistency: 'locked' | 'adaptive'
}

interface SynthesizedClip {
  url: string
  emotion: string
}

interface QueuedClip extends SynthesizedClip {
  mid: string
  session: number
}

interface TranslationResponse {
  translation?: string
}

interface AudioWithSource extends HTMLAudioElement {
  __sourceNode?: MediaElementAudioSourceNode | null
}

interface StatusError extends Error {
  status?: number
  detail?: unknown
}

type AudioContextConstructor = new () => AudioContext

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const rawDetail = (error as StatusError).detail
  const detail = typeof rawDetail === 'string'
    ? rawDetail.replace(/\s+/g, ' ').trim().slice(0, 240)
    : ''
  return detail && !error.message.includes(detail) ? `${error.message}：${detail}` : error.message
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readVoiceAvailability(value: unknown): VoiceAvailability {
  if (!isRecord(value)) throw new Error('语音状态响应格式无效')
  const voices = isRecord(value.voices)
    ? Object.fromEntries(Object.entries(value.voices).map(([key, available]) => [key, Boolean(available)]))
    : {}
  const translation = isRecord(value.translation)
    ? { ready: Boolean(value.translation.ready) }
    : undefined
  return {
    online: Boolean(value.online),
    voices,
    translation,
    activeVoice: typeof value.activeVoice === 'string' ? value.activeVoice : undefined,
    error: typeof value.error === 'string' ? value.error : undefined,
  }
}

function readTranslation(value: unknown): TranslationResponse {
  if (!isRecord(value)) return {}
  return { translation: typeof value.translation === 'string' ? value.translation : undefined }
}

function removeAudioSource(audio: AudioWithSource) {
  try { audio.__sourceNode?.disconnect() } catch {}
  if (audio) audio.__sourceNode = null
}

export function useVoice(options: {
  enabled: () => boolean
  onStatus?: (text: string) => void
  onError?: (msg: string) => void
  onSpeaking?: (v: boolean, mid?: string) => void
  onExpression?: (emotion: string) => void
  onMouth?: (v: number) => void
  onAudioReady?: (mid: string) => void
  onActivity?: (active: boolean) => void
}) {
  const { enabled, onStatus = () => {}, onError = () => {}, onSpeaking = () => {},
    onExpression = () => {}, onMouth = () => {}, onAudioReady = () => {}, onActivity = () => {} } = options

  const availability = ref<VoiceAvailability>({ online: false, voices: {} })

  // 内部不需要响应式的可变状态
  // GPT-SoVITS is much more stable with a little sentence context. Holding a
  // short interjection for the following sentence avoids clipped, repeated
  // "诶…那个…" style fragments.
  let sentenceBuffer = new SentenceBuffer({ minimumLength: 16, maximumLength: 72 })
  let session = 0, controller: AbortController | null = null
  let translateChain: Promise<PreparedSentence | null> = Promise.resolve(null)
  let synthChain: Promise<void> = Promise.resolve()
  let pending = 0, queue: QueuedClip[] = [], playing = false
  let currentAudio: AudioWithSource | null = null, replayAudio: AudioWithSource | null = null
  const messageAudio = new Map<string, SynthesizedClip[]>()
  let audioContext: AudioContext | null = null, analyser: AnalyserNode | null = null
  let gainNode: GainNode | null = null, lipFrame = 0, lipSmooth = 0
  let prepareKey = '', preparing: Promise<boolean> | null = null
  let turn: VoiceTurn | null = null, _lastEmotion = 'neutral', _neutralStreak = 0
  let _warnedTranslation = false, _warnedAnalyser = false

  async function refreshAvailability() {
    try {
      const r = await fetch('/api/tts-status', { cache: 'no-store' })
      if (!r.ok) throw new Error('语音状态接口不可用')
      availability.value = readVoiceAvailability(await r.json())
    } catch (e) { availability.value = { online: false, voices: {}, error: errorMessage(e) } }
    return availability.value
  }

  function readyFor(voice: string) {
    return Boolean(availability.value.online && availability.value.voices?.[voice])
  }

  function prepare(voice: string, needsTranslation = true): Promise<boolean> {
    if (!readyFor(voice)) return Promise.resolve(false)
    const translationReady = !needsTranslation || Boolean(availability.value.translation?.ready)
    if (availability.value.activeVoice === voice && translationReady) { prepareKey = voice + ':' + needsTranslation; return Promise.resolve(true) }
    const key = voice + ':' + needsTranslation
    if (preparing && prepareKey === key) return preparing
    prepareKey = key
    onStatus(needsTranslation ? '正在预热声线与翻译…' : '正在预热角色声线…')
    preparing = fetch('/api/voice/prepare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice, translation: needsTranslation }),
    }).then(async (r) => {
      if (!r.ok) throw await responseError(r, '声线预热失败')
      if (prepareKey !== key) return false
      availability.value.activeVoice = voice
      if (needsTranslation) availability.value.translation = { ...(availability.value.translation ?? {}), ready: true }
      onStatus(''); return true
    }).catch((e) => {
      if (prepareKey === key && !isAbortError(e)) onStatus('声线会在首次播放时加载')
      return false
    }).finally(() => { if (prepareKey === key) preparing = null })
    return preparing
  }

  function ensureAudioContext() {
    if (!audioContext) {
      try {
        const audioWindow = window as Window & typeof globalThis & {
          webkitAudioContext?: AudioContextConstructor
        }
        const AC: AudioContextConstructor | undefined = audioWindow.AudioContext || audioWindow.webkitAudioContext
        if (!AC) return
        audioContext = new AC()
        const ac = audioContext!
        analyser = ac.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.5
        gainNode = ac.createGain(); gainNode.gain.value = 1
        analyser.connect(gainNode); gainNode.connect(ac.destination)
      } catch { audioContext = null; analyser = null }
    }
    if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {})
  }

  function isActive() { return Boolean(pending > 0 || playing || queue.length || replayAudio) }
  function notifyActivity() { onActivity(isActive()) }

  function startTurn(meta: { mid: string; voice: string; character: string }) {
    stop({ preserveMessageAudio: true, silent: true })
    ensureAudioContext(); session++
    controller = new AbortController()
    sentenceBuffer.reset(); translateChain = Promise.resolve(null); synthChain = Promise.resolve()
    pending = 0; turn = { ...meta, session, referenceEmotion: '' }
    _lastEmotion = 'neutral'; _neutralStreak = 0
    prepare(meta.voice, true)
    if (enabled() && !readyFor(meta.voice)) onStatus(availability.value.online ? '当前角色声线未配置' : '语音服务未启动')
  }

  function append(text: string) {
    if (!turn || !enabled() || !readyFor(turn.voice)) return
    const activeTurn = turn
    sentenceBuffer.push(text, false).forEach(s => enqueue(s, activeTurn))
  }

  function finishTurn() {
    if (!turn || !enabled() || !readyFor(turn.voice)) return
    const activeTurn = turn
    sentenceBuffer.push('', true).forEach(s => enqueue(s, activeTurn))
  }

  function enqueue(sentence: string, meta: VoiceTurn) {
    const sess = meta.session
    if (sess !== session || !controller) return
    const signal = controller.signal; pending++; onStatus('语音合成中…'); notifyActivity()
    const prepared = (translateChain = translateChain
      .then(() => sess !== session || signal.aborted ? null : prepareSentence(sentence, meta, signal))
      .catch(e => { if (!isAbortError(e) && sess === session) onError('一句配音失败（不影响聊天）：' + errorMessage(e)); return null }))
    synthChain = synthChain.then(async () => {
      const req = await prepared
      if (!req || sess !== session || signal.aborted) return null
      return synthesize(req, meta, signal)
    }).then(item => {
      if (!item) return
      if (sess !== session) { URL.revokeObjectURL(item.url); return }
      const clips = messageAudio.get(meta.mid) || []; clips.push({ url: item.url, emotion: item.emotion || 'neutral' })
      messageAudio.set(meta.mid, clips); queue.push({ ...item, mid: meta.mid, session: sess })
      onAudioReady(meta.mid); pump(sess)
    }).catch(e => { if (!isAbortError(e) && sess === session) onError('一句配音失败（不影响聊天）：' + errorMessage(e)) })
    .finally(() => {
      if (sess !== session) return; pending = Math.max(0, pending - 1)
      if (pending === 0) onStatus(playing || queue.length ? '播放中…' : '')
      notifyActivity()
    })
  }

  async function prepareSentence(sourceText: string, meta: VoiceTurn, signal: AbortSignal): Promise<PreparedSentence | null> {
    const dialogue = extractSpokenDialogue(sourceText)
    const cleaned = dialogue.text.replace(/[「」『』"""']/g, '').trim()
    if (!cleaned) return null
    const directionText = dialogue.directions.join(' ')
    const rawEmotion = inferEmotion(directionText ? `${directionText} ${cleaned}` : cleaned, meta.character)
    let emotion: string
    if (rawEmotion === 'neutral') { _neutralStreak++; emotion = _neutralStreak >= 3 ? 'neutral' : _lastEmotion }
    else { _neutralStreak = 0; emotion = rawEmotion }
    _lastEmotion = emotion
    if (!meta.referenceEmotion) meta.referenceEmotion = rawEmotion === 'neutral' ? 'gentle' : rawEmotion
    let translated = '', translationFailed = false
    try {
      const tr = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: cleaned }), signal })
      if (tr.ok) { const d = readTranslation(await tr.json()); translated = String(d.translation || '').replace(/\n+/g, '。').trim() }
      else translationFailed = true
    } catch (e) { if (isAbortError(e)) throw e; translationFailed = true }
    if (translationFailed && !_warnedTranslation) { _warnedTranslation = true; onError('日文翻译不可用，本次改用中文发音。') }
    return {
      text: translated || cleaned,
      language: translated ? 'ja' : 'zh',
      emotion,
      // A written direction is an explicit request for a new delivery. Keep
      // normal sentences locked to one reference for a coherent identity, but
      // let the configured emotion reference take effect for that cue.
      consistency: directionText && rawEmotion !== 'neutral' ? 'adaptive' : 'locked',
    }
  }

  async function requestTts(request: PreparedSentence, meta: VoiceTurn, signal: AbortSignal): Promise<Response> {
    const timeoutController = new AbortController()
    let timedOut = false
    const stopOnTurnAbort = () => timeoutController.abort()
    signal.addEventListener('abort', stopOnTurnAbort, { once: true })
    const timer = window.setTimeout(() => { timedOut = true; timeoutController.abort() }, 90_000)
    try {
      return await fetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: timeoutController.signal,
        body: JSON.stringify({
          voice: meta.voice, text: request.text, language: request.language,
          emotion: request.emotion, referenceEmotion: meta.referenceEmotion,
          consistency: request.consistency, speed: 1,
        }),
      })
    } catch (error) {
      if (signal.aborted) throw error
      if (timedOut) {
        const timeout = new Error('单句语音合成超过 90 秒') as StatusError
        timeout.status = 504
        throw timeout
      }
      throw error
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', stopOnTurnAbort)
    }
  }

  async function synthesize(request: PreparedSentence, meta: VoiceTurn, signal: AbortSignal): Promise<SynthesizedClip> {
    let ttsError: Error | undefined
    // GPT-SoVITS 偶发瞬时失败（模型换权重 / 队列抖动 / 空音频）。
    // A stuck upstream used to block the entire reply for several minutes.
    // Bound one sentence and retry once so later dialogue can still continue.
    const MAX_ATTEMPTS = 2
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const r = await requestTts(request, meta, signal)
        if (!r.ok) {
          const error = await responseError(r, '语音服务暂不可用') as StatusError
          error.status = r.status
          throw error
        }
        let buffer = await r.arrayBuffer()
        // 空音频（44 字节以下连 WAV 头都不完整）视为瞬时失败，值得重试
        if (!buffer || buffer.byteLength < 64) {
          const empty: StatusError = new Error('语音服务返回空音频')
          empty.status = 502
          throw empty
        }
        buffer = fixWavHeader(buffer)
        return { url: URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' })), emotion: request.emotion }
      } catch (e) {
        if (isAbortError(e) || signal.aborted) throw e
        const error = e as StatusError
        const status = Number(error.status)
        // A client timeout or a full server queue may leave the upstream worker
        // busy even after this request is aborted. Retrying that same sentence
        // creates duplicate GPU work and is the usual source of repeated audio.
        const transient = error.name === 'TypeError' || status === 429 || status === 500 || status === 502
        if (transient && attempt < MAX_ATTEMPTS - 1) {
          // Give a recovering GPT-SoVITS worker one short, bounded retry.
          const backoff = 350 * Math.pow(2, attempt)
          await new Promise(res => setTimeout(res, backoff))
          if (signal.aborted) throw e
          ttsError = error
          continue
        }
        throw e
      }
    }
    throw ttsError ?? new Error('语音合成失败')
  }

  function attachAnalyser(audio: AudioWithSource) {
    if (!audioContext || !analyser || audio.__sourceNode) return
    try { audio.__sourceNode = audioContext.createMediaElementSource(audio); audio.__sourceNode.connect(analyser) }
    catch { if (!_warnedAnalyser) { _warnedAnalyser = true; onError('浏览器阻止了音频分析，口型同步本次不可用。') } }
  }

  function startLipSync() {
    if (lipFrame || !analyser) return
    const samples = new Uint8Array(analyser.fftSize)
    const tick = () => {
      const audio = currentAudio || replayAudio; let target = 0
      if (audio && !audio.paused && !audio.ended) {
        analyser!.getByteTimeDomainData(samples); let sum = 0
        for (const s of samples) { const n = (s - 128) / 128; sum += n * n }
        // GPT-SoVITS WAV peaks are comparatively quiet after browser mixing.
        // Keep real RMS data, but calibrate it into Cubism's 0..1 mouth range.
        target = Math.min(1, Math.sqrt(sum / samples.length) * 6.5)
      }
      lipSmooth += (target - lipSmooth) * 0.35
      if (lipSmooth < 0.015) lipSmooth = 0
      onMouth(lipSmooth)
      if ((audio && !audio.ended) || lipSmooth > 0.01) lipFrame = requestAnimationFrame(tick)
      else stopLipSync()
    }
    lipFrame = requestAnimationFrame(tick)
  }

  function stopLipSync() { if (lipFrame) cancelAnimationFrame(lipFrame); lipFrame = 0; lipSmooth = 0; onMouth(0) }
  function setVolume(value: number) {
    value = Math.max(0, Math.min(1, Number(value) || 1))
    if (audioContext && gainNode) gainNode.gain.linearRampToValueAtTime(value, audioContext.currentTime + 0.05)
  }

  function pump(sess: number) {
    if (playing || !queue.length || sess !== session) return
    const item = queue.shift()
    if (!item) return
    playing = true
    const audio = new Audio(item.url) as AudioWithSource
    currentAudio = audio; attachAnalyser(audio)
    onExpression(item.emotion); onSpeaking(true, item.mid); onStatus('播放中…'); notifyActivity()
    let finished = false
    const done = () => {
      if (finished) return; finished = true
      audio.removeEventListener('ended', done); audio.removeEventListener('error', done)
      removeAudioSource(audio)
      if (currentAudio === audio) currentAudio = null; playing = false
      if (!queue.length) { onSpeaking(false, item.mid); onExpression('neutral'); onStatus(pending > 0 ? '语音合成中…' : '') }
      pump(sess); notifyActivity()
    }
    audio.addEventListener('ended', done); audio.addEventListener('error', done)
    audio.play().then(() => startLipSync()).catch(() => { onError('浏览器阻止了自动播放，请点击消息下方的"重播"。'); done() })
  }

  async function playMessage(mid: string): Promise<boolean> {
    const clips = (messageAudio.get(mid) || []).slice()
    if (!clips.length) return false
    stop({ preserveMessageAudio: true, silent: true }); ensureAudioContext()
    const rs = session; onSpeaking(true, mid); onStatus('重播中…'); notifyActivity()
    for (const clip of clips) {
      if (rs !== session) return false
      const audio = new Audio(clip.url) as AudioWithSource
      replayAudio = audio; attachAnalyser(audio); onExpression(clip.emotion || 'neutral')
      await new Promise<void>(res => {
        const done = () => { audio.removeEventListener('ended', done); audio.removeEventListener('error', done); removeAudioSource(audio); res() }
        audio.addEventListener('ended', done); audio.addEventListener('error', done)
        audio.play().then(() => startLipSync()).catch(done)
      })
    }
    if (rs === session) { replayAudio = null; onSpeaking(false, mid); onExpression('neutral'); onStatus(''); stopLipSync(); notifyActivity() }
    return true
  }

  function hasAudio(mid: string) { const c = messageAudio.get(mid); return Boolean(c?.length) }

  function clearMessages(mids: string[]) {
    mids.forEach(mid => { const c = messageAudio.get(mid) || []; c.forEach(cl => URL.revokeObjectURL(cl.url)); messageAudio.delete(mid) })
  }

  function stop(opts: { preserveMessageAudio?: boolean; silent?: boolean } = {}) {
    session++; controller?.abort(); controller = null; turn = null
    sentenceBuffer.reset(); translateChain = Promise.resolve(null); synthChain = Promise.resolve(); pending = 0
    const refs = new Set<string>(); messageAudio.forEach(c => c.forEach(cl => refs.add(cl.url)))
    queue.forEach(it => { if (!refs.has(it.url)) URL.revokeObjectURL(it.url) }); queue = []
    if (currentAudio) { currentAudio.pause(); removeAudioSource(currentAudio); currentAudio.removeAttribute('src') }
    if (replayAudio) { replayAudio.pause(); removeAudioSource(replayAudio); replayAudio.removeAttribute('src') }
    currentAudio = null; replayAudio = null; playing = false; stopLipSync()
    _lastEmotion = 'neutral'; _neutralStreak = 0
    onSpeaking(false); onExpression('neutral')
    if (!opts.silent) onStatus('')
    if (!opts.preserveMessageAudio) clearMessages([...messageAudio.keys()])
    notifyActivity()
  }

  function destroy() {
    stop({ preserveMessageAudio: false, silent: true })
    if (gainNode) { try { gainNode.disconnect() } catch {}; gainNode = null }
    if (audioContext) audioContext.close().catch(() => {}); audioContext = null; analyser = null
  }

  return { availability, refreshAvailability, readyFor, prepare, ensureAudioContext, isActive, startTurn, append, finishTurn, stop, destroy, playMessage, hasAudio, clearMessages, setVolume }
}
