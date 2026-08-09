import { apiClient, type ApiClient, type ApiResponseObject } from './client.ts'
import type { TranslateResult, TtsStatus, VoicePrepareResult } from '../types/api.ts'

export const VOICE_API_TIMEOUTS = {
  status: 10_000,
  prepare: 200_000,
  translate: 200_000,
} as const

export interface VoiceCallOptions { signal?: AbortSignal }
export interface VoicePreparePayload { voice: string; translation: boolean }

function isObject(value: unknown): value is ApiResponseObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTtsStatus(value: ApiResponseObject): boolean {
  return typeof value.online === 'boolean' && isObject(value.voices)
    && Object.values(value.voices).every(item => typeof item === 'boolean')
}

function isPrepare(value: ApiResponseObject): boolean {
  return value.ok === true && typeof value.voice === 'string' && typeof value.translation === 'boolean'
}

function isTranslation(value: ApiResponseObject): boolean {
  return typeof value.translation === 'string'
}

export interface VoiceApi {
  getStatus(options?: VoiceCallOptions): Promise<TtsStatus>
  prepare(payload: VoicePreparePayload, options?: VoiceCallOptions): Promise<VoicePrepareResult>
  translate(text: string, options?: VoiceCallOptions): Promise<TranslateResult>
}

export function createVoiceApi(client: ApiClient = apiClient): VoiceApi {
  return {
    getStatus(options = {}) {
      return client.request<TtsStatus>('/api/tts-status', {
        cache: 'no-store', signal: options.signal, timeoutMs: VOICE_API_TIMEOUTS.status,
        validate: isTtsStatus,
      })
    },
    prepare(payload, options = {}) {
      return client.request<VoicePrepareResult>('/api/voice/prepare', {
        method: 'POST', cache: 'no-store', body: payload, signal: options.signal,
        timeoutMs: VOICE_API_TIMEOUTS.prepare, validate: isPrepare,
      })
    },
    translate(text, options = {}) {
      return client.request<TranslateResult>('/api/translate', {
        method: 'POST', cache: 'no-store', body: { text }, signal: options.signal,
        timeoutMs: VOICE_API_TIMEOUTS.translate, validate: isTranslation,
      })
    },
  }
}

export const voiceApi = createVoiceApi()
