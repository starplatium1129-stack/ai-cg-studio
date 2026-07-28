import { reactive } from 'vue'
import {
  CHARACTERS, STORAGE_KEY, STORAGE_VERSION, MAX_LOCAL_MESSAGES, createMessageId,
} from '@/config/characters'
import {
  normalizeChatStorage, serializeChatStorage, type PersistedChatState,
} from '@/utils/chatStorageCore'

export const CHAT_API_KEY_SESSION_KEY = 'aics_chat_api_key_v1'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  mid: string
  stopped: boolean
}

export interface ChatState {
  version: number
  active: string
  histories: Record<string, ChatMessage[]>
  settings: {
    model: string
    provider: 'local' | 'api'
    apiBaseUrl: string
    apiModel: string
    apiKey: string
    live2dEnabled: boolean
    autoVoice: boolean
    volume: number
    drafts: Record<string, string>
  }
}

export function useChatStorage(onError: (msg: string) => void = () => {}) {
  const state = reactive<ChatState>({
    version: STORAGE_VERSION,
    active: 'nene',
    histories: Object.fromEntries(Object.keys(CHARACTERS).map(k => [k, []])),
    settings: {
      model: '',
      provider: 'local',
      apiBaseUrl: 'https://api.deepseek.com',
      apiModel: 'deepseek-v4-flash',
      apiKey: '',
      live2dEnabled: false,
      autoVoice: true,
      volume: 80,
      drafts: Object.fromEntries(Object.keys(CHARACTERS).map(k => [k, ''])),
    },
  })

  const normalizeOptions = {
    characterIds: Object.keys(CHARACTERS),
    maxMessages: MAX_LOCAL_MESSAGES,
    version: STORAGE_VERSION,
    createMessageId,
  }

  function sessionStore(): Storage | null {
    try { return typeof sessionStorage === 'undefined' ? null : sessionStorage } catch { return null }
  }

  function readSessionApiKey(): string {
    try { return sessionStore()?.getItem(CHAT_API_KEY_SESSION_KEY) || '' } catch { return '' }
  }

  function writeSessionApiKey(value: string) {
    try {
      const session = sessionStore()
      if (value) session?.setItem(CHAT_API_KEY_SESSION_KEY, value)
      else session?.removeItem(CHAT_API_KEY_SESSION_KEY)
    } catch {}
  }

  function applyPersisted(persisted: PersistedChatState) {
    state.version = persisted.version
    state.active = persisted.active
    for (const char of Object.keys(CHARACTERS)) {
      state.histories[char] = persisted.histories[char] || []
      state.settings.drafts[char] = persisted.settings.drafts[char] || ''
    }
    state.settings.model = persisted.settings.model
    state.settings.provider = persisted.settings.provider
    state.settings.apiBaseUrl = persisted.settings.apiBaseUrl
    state.settings.apiModel = persisted.settings.apiModel
    state.settings.live2dEnabled = persisted.settings.live2dEnabled
    state.settings.autoVoice = persisted.settings.autoVoice
    state.settings.volume = persisted.settings.volume
  }

  function persistedState(): PersistedChatState {
    return {
      version: STORAGE_VERSION,
      active: state.active,
      histories: state.histories,
      settings: {
        model: state.settings.model,
        provider: state.settings.provider,
        apiBaseUrl: state.settings.apiBaseUrl,
        apiModel: state.settings.apiModel,
        live2dEnabled: state.settings.live2dEnabled,
        autoVoice: state.settings.autoVoice,
        volume: state.settings.volume,
        drafts: state.settings.drafts,
      },
    }
  }

  function load() {
    let stored = ''
    try {
      stored = localStorage.getItem(STORAGE_KEY) || ''
      const normalized = normalizeChatStorage(
        stored ? JSON.parse(stored) : {},
        localStorage.getItem('aics_chat_model') || '',
        normalizeOptions,
      )
      applyPersisted(normalized.state)

      const sessionKey = readSessionApiKey()
      state.settings.apiKey = String(sessionKey || normalized.migratedApiKey).trim().slice(0, 1000)
      writeSessionApiKey(state.settings.apiKey)

      // Rewriting existing records through the allowlist removes legacy API keys,
      // custom authorization headers, tokens and unknown fields from localStorage.
      if (stored) localStorage.setItem(STORAGE_KEY, serializeChatStorage(persistedState()))
    } catch {
      const clean = normalizeChatStorage({}, '', normalizeOptions).state
      applyPersisted(clean)
      state.settings.apiKey = ''
      writeSessionApiKey('')
      try { localStorage.setItem(STORAGE_KEY, serializeChatStorage(clean)) } catch {}
      onError('本地聊天记录损坏，已恢复为空白会话。')
    }
  }

  function save() {
    try {
      state.version = STORAGE_VERSION
      localStorage.setItem(STORAGE_KEY, serializeChatStorage(persistedState()))
      localStorage.setItem('aics_chat_model', state.settings.model || '')
      writeSessionApiKey(state.settings.apiKey)
    } catch {
      onError('浏览器存储空间不足，本轮聊天可能无法长期保存。')
    }
  }

  function messages(char = state.active): ChatMessage[] {
    return state.histories[char] || []
  }

  function setActive(char: string) { state.active = char === 'natsume' ? 'natsume' : 'nene'; save() }
  function setModel(model: string) { state.settings.model = String(model || ''); save() }
  function setProvider(provider: 'local' | 'api') { state.settings.provider = provider === 'api' ? 'api' : 'local'; save() }
  function setApiSettings(settings: { baseUrl: string; model: string; apiKey: string }) {
    state.settings.apiBaseUrl = String(settings.baseUrl || '').trim().slice(0, 500)
    state.settings.apiModel = String(settings.model || '').trim().slice(0, 200)
    state.settings.apiKey = String(settings.apiKey || '').trim().slice(0, 1000)
    save()
  }
  function setLive2dEnabled(value: boolean) { state.settings.live2dEnabled = Boolean(value); save() }
  function setAutoVoice(v: boolean) { state.settings.autoVoice = Boolean(v); save() }
  function setVolume(v: number) { state.settings.volume = Math.max(0, Math.min(100, Math.round(Number(v) || 80))); save() }
  function draft(char = state.active) { return state.settings.drafts[char] || '' }
  function setDraft(char: string, val: string) {
    if (!CHARACTERS[char]) return
    state.settings.drafts[char] = String(val || '').slice(0, 1200)
    save()
  }
  function trim(char = state.active) {
    const msgs = messages(char)
    if (msgs.length > MAX_LOCAL_MESSAGES) msgs.splice(0, msgs.length - MAX_LOCAL_MESSAGES)
  }
  function clear(char?: string) {
    if (char) { state.histories[char] = [] }
    else { for (const k of Object.keys(CHARACTERS)) state.histories[k] = [] }
    save()
  }

  return {
    state, load, save, messages,
    setActive, setModel, setProvider, setApiSettings,
    setLive2dEnabled, setAutoVoice, setVolume, draft, setDraft, trim, clear,
  }
}
