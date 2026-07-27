import { ref } from 'vue'
import { SentenceBuffer, fixWavHeader, inferEmotion, isAbortError, responseError } from '@/utils/stream'

export interface VoiceAvailability {
  online: boolean
  voices?: Record<string, boolean>
  translation?: { ready: boolean }
  activeVoice?: string
  error?: string
}

interface AudioWithSource extends HTMLAudioElement { __sourceNode?: AudioNode | null }

function removeAudioSource(audio: AudioWithSource) {
  try { if (audio?.__sourceNode) (audio.__sourceNode as any).disconnect() } catch {}
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
  let sentenceBuffer = new SentenceBuffer({ immediateFirst: true })
  let session = 0, controller: AbortController | null = null
  let translateChain: Promise<unknown> = Promise.resolve()
  let synthChain: Promise<unknown> = Promise.resolve()
  let pending = 0, queue: any[] = [], playing = false
  let currentAudio: AudioWithSource | null = null, replayAudio: AudioWithSource | null = null
  const messageAudio = new Map<string, { url: string; emotion: string }[]>()
  let audioContext: AudioContext | null = null, analyser: AnalyserNode | null = null
  let gainNode: GainNode | null = null, lipFrame = 0, lipSmooth = 0
  let prepareKey = '', preparing: Promise<boolean> | null = null
  let turn: any = null, _lastEmotion = 'neutral', _neutralStreak = 0
  let _warnedTranslation = false, _warnedAnalyser = false

  async function refreshAvailability() {
    try {
      const r = await fetch('/api/tts-status', { cache: 'no-store' })
      if (!r.ok) throw new Error('语音状态接口不可用')
      availability.value = await r.json()
    } catch (e) { availability.value = { online: false, voices: {}, error: String((e as any)?.message ?? e) } }
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
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext
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
    sentenceBuffer.reset(); translateChain = Promise.resolve(); synthChain = Promise.resolve()
    pending = 0; turn = { ...meta, session, referenceEmotion: '' }
    _lastEmotion = 'neutral'; _neutralStreak = 0
    prepare(meta.voice, true)
    if (enabled() && !readyFor(meta.voice)) onStatus(availability.value.online ? '当前角色声线未配置' : '语音服务未启动')
  }

  function append(text: string) {
    if (!turn || !enabled() || !readyFor(turn.voice)) return
    sentenceBuffer.push(text, false).forEach(s => enqueue(s, turn))
  }

  function finishTurn() {
    if (!turn || !enabled() || !readyFor(turn.voice)) return
    sentenceBuffer.push('', true).forEach(s => enqueue(s, turn))
  }

  function enqueue(sentence: string, meta: any) {
    const sess = meta.session
    if (sess !== session || !controller) return
    const signal = controller.signal; pending++; onStatus('语音合成中…'); notifyActivity()
    const prepared = (translateChain = translateChain
      .then(() => sess !== session || signal.aborted ? null : prepareSentence(sentence, meta, signal))
      .catch(e => { if (!isAbortError(e) && sess === session) onError('一句配音失败（不影响聊天）：' + (e as any).message); return null }))
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
    }).catch(e => { if (!isAbortError(e) && sess === session) onError('一句配音失败（不影响聊天）：' + (e as any).message) })
    .finally(() => {
      if (sess !== session) return; pending = Math.max(0, pending - 1)
      if (pending === 0) onStatus(playing || queue.length ? '播放中…' : '')
      notifyActivity()
    })
  }

  async function prepareSentence(sourceText: string, meta: any, signal: AbortSignal) {
    const cleaned = String(sourceText || '').replace(/[「」『』"""'()（）*＊]/g, '').trim()
    if (!cleaned) return null
    const rawEmotion = inferEmotion(cleaned, meta.character)
    let emotion: string
    if (rawEmotion === 'neutral') { _neutralStreak++; emotion = _neutralStreak >= 3 ? 'neutral' : _lastEmotion }
    else { _neutralStreak = 0; emotion = rawEmotion }
    _lastEmotion = emotion
    if (!meta.referenceEmotion) meta.referenceEmotion = rawEmotion === 'neutral' ? 'gentle' : rawEmotion
    let translated = '', translationFailed = false
    try {
      const tr = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: cleaned }), signal })
      if (tr.ok) { const d = await tr.json(); translated = String(d.translation || '').replace(/\n+/g, '。').trim() }
      else translationFailed = true
    } catch (e) { if (isAbortError(e)) throw e; translationFailed = true }
    if (translationFailed && !_warnedTranslation) { _warnedTranslation = true; onError('日文翻译不可用，本次改用中文发音。') }
    return { text: translated || cleaned, language: translated ? 'ja' : 'zh', emotion }
  }

  async function synthesize(request: any, meta: any, signal: AbortSignal) {
    let ttsError: Error | undefined
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const r = await fetch('/api/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
          body: JSON.stringify({ voice: meta.voice, text: request.text, language: request.language, emotion: request.emotion, referenceEmotion: meta.referenceEmotion, consistency: 'locked', speed: 1 }),
        })
        if (!r.ok) { const e = await responseError(r, '语音服务暂不可用'); (e as any).status = r.status; throw e }
        let buffer = await r.arrayBuffer(); buffer = fixWavHeader(buffer)
        return { url: URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' })), emotion: request.emotion }
      } catch (e) {
        if (isAbortError(e) || signal.aborted) throw e
        if (attempt === 0 && ((e as any).name === 'TypeError' || Number((e as any).status) >= 500)) {
          await new Promise(res => setTimeout(res, 220)); if (signal.aborted) throw e; ttsError = e as Error; continue
        }
        throw e
      }
    }
    throw ttsError
  }

  function attachAnalyser(audio: AudioWithSource) {
    if (!audioContext || !analyser || audio.__sourceNode) return
    try { audio.__sourceNode = audioContext.createMediaElementSource(audio); (audio.__sourceNode as any).connect(analyser) }
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
        target = Math.min(1, Math.sqrt(sum / samples.length) * 3.4)
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
    playing = true; const item = queue.shift()
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
    audio.play().then(() => startLipSync()).catch(e => { onError('浏览器阻止了自动播放，请点击消息下方的"重播"。'); done() })
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
    sentenceBuffer.reset(); translateChain = Promise.resolve(); synthChain = Promise.resolve(); pending = 0
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
