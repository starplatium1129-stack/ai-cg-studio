/**
 * 语音输入采集 composable（长按说话）。
 *
 * 生命周期：按住 → start() 采集（getUserMedia + 16kHz AudioContext +
 * ScriptProcessor），松开 → stop() 用 VAD 切段并识别，取消 → cancel() 丢弃。
 * 识别结果经 onText 回调交给视图（默认填入输入框，由用户确认发送）。
 *
 * 纯逻辑（VAD / 重采样 / WAV / ASR 请求）都在 src/utils 下，本文件只做
 * 浏览器音频管线与状态编排，不承载可测算法。
 */

import { ref, type Ref } from 'vue'
import { createVadSegmenter } from '@/utils/vadSegmenter'
import { resampleTo16k, encodeWav16k, recognizeWithAsr } from '@/utils/voiceApi'
import type { SpeechInputConfig } from '@/utils/speechInputConfig'

export type VoiceInputState = 'idle' | 'acquiring' | 'capturing' | 'recognizing' | 'error'

export interface UseVoiceInputOptions {
  /** 实时读取当前语音输入配置（响应式） */
  config: () => SpeechInputConfig
  onText?: (text: string) => void
  onError?: (message: string) => void
  onStateChange?: (state: VoiceInputState, detail?: string) => void
}

export interface UseVoiceInput {
  state: Ref<VoiceInputState>
  errorMessage: Ref<string>
  /** 浏览器是否支持麦克风采集 */
  supported: boolean
  start(): Promise<void>
  /** 停止采集并识别当前段（无语音则静默忽略） */
  stop(): void
  /** 停止采集并丢弃当前段 */
  cancel(): void
  /** 释放媒体资源（组件卸载时调用） */
  release(): void
}

const TARGET_RATE = 16_000
/** 停止时补入的尾静音（ms），让 VAD 自然完结当前段 */
const TAIL_SILENCE_MS = 500
/** 合并段的总时长上限（ms），超出丢弃尾部 */
const MAX_COMBINED_MS = 30_000

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInput {
  const state = ref<VoiceInputState>('idle')
  const errorMessage = ref('')
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  let stream: MediaStream | null = null
  let context: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let processor: ScriptProcessorNode | null = null
  let muted: GainNode | null = null
  let vad: ReturnType<typeof createVadSegmenter> | null = null
  let capturing = false
  let disposed = false

  function setState(next: VoiceInputState, detail?: string): void {
    state.value = next
    if (detail !== undefined) errorMessage.value = detail
    options.onStateChange?.(next, detail)
  }

  function cleanupTracks(): void {
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
    }
  }

  function teardownGraph(): void {
    if (processor) {
      try { processor.disconnect() } catch { /* 已断开 */ }
      processor = null
    }
    if (source) {
      try { source.disconnect() } catch { /* 已断开 */ }
      source = null
    }
    if (muted) {
      try { muted.disconnect() } catch { /* 已断开 */ }
      muted = null
    }
    if (context && context.state !== 'closed') {
      void context.close().catch(() => { /* 关闭失败可忽略 */ })
    }
    context = null
  }

  async function start(): Promise<void> {
    if (disposed) return
    if (state.value === 'capturing' || state.value === 'acquiring' || state.value === 'recognizing') return
    setState('acquiring')
    errorMessage.value = ''
    vad = createVadSegmenter({ sampleRate: TARGET_RATE })

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      const message = name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在浏览器设置中允许后重试'
        : name === 'NotFoundError'
          ? '未找到可用的麦克风设备'
          : `无法访问麦克风：${error instanceof Error ? error.message : String(error)}`
      setState('error', message)
      options.onError?.(message)
      cleanupTracks()
      return
    }

    try {
      context = new AudioContext({ sampleRate: TARGET_RATE })
    } catch {
      context = new AudioContext()
    }
    try {
      source = context.createMediaStreamSource(stream)
      processor = context.createScriptProcessor(4096, 1, 1)
      muted = context.createGain()
      muted.gain.value = 0
      source.connect(processor)
      processor.connect(muted)
      muted.connect(context.destination)
    } catch (error) {
      const message = `无法创建音频处理链：${error instanceof Error ? error.message : String(error)}`
      setState('error', message)
      options.onError?.(message)
      cleanupTracks()
      teardownGraph()
      return
    }

    processor.onaudioprocess = (event: AudioProcessingEvent): void => {
      if (!capturing || !vad) return
      const channel = event.inputBuffer.getChannelData(0)
      vad.push(resampleTo16k(channel, context?.sampleRate ?? TARGET_RATE))
    }

    capturing = true
    setState('capturing')
  }

  function stop(): void {
    if (!capturing || !vad) return
    capturing = false
    // 补尾静音让 VAD 完结当前段，再取全部段。
    vad.push(new Float32Array(Math.round((TAIL_SILENCE_MS / 1000) * TARGET_RATE)))
    const segments = vad.takeSegments()
    cleanupTracks()
    teardownGraph()

    if (segments.length === 0) {
      setState('idle')
      return
    }

    // 长按期间的多段按序合并（停顿会被 VAD 切成多段，合并回完整一句）。
    const maxSamples = Math.round((MAX_COMBINED_MS / 1000) * TARGET_RATE)
    const merged: number[] = []
    for (const segment of segments) {
      if (merged.length >= maxSamples) break
      for (let i = 0; i < segment.length && merged.length < maxSamples; i += 1) merged.push(segment[i])
    }
    if (merged.length === 0) {
      setState('idle')
      return
    }

    const wav = encodeWav16k(new Float32Array(merged), TARGET_RATE)
    setState('recognizing')
    void recognizeWithAsr(options.config(), wav)
      .then(result => {
        if (disposed) return
        setState('idle')
        if (result.text) options.onText?.(result.text)
      })
      .catch(error => {
        if (disposed) return
        const message = error instanceof Error ? error.message : '语音识别失败'
        setState('error', message)
        options.onError?.(message)
      })
  }

  function cancel(): void {
    capturing = false
    cleanupTracks()
    teardownGraph()
    if (state.value === 'error') {
      setState('idle')
      return
    }
    setState('idle')
  }

  function release(): void {
    disposed = true
    capturing = false
    cleanupTracks()
    teardownGraph()
  }

  return { state, errorMessage, supported, start, stop, cancel, release }
}
