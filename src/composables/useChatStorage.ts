import { reactive } from 'vue'
import {
  CHARACTERS, STORAGE_KEY, STORAGE_VERSION, MAX_LOCAL_MESSAGES, createMessageId,
} from '@/config/characters'
import {
  CLIPROXY_BASE_URL, CLIPROXY_API_KEY, CLIPROXY_DEFAULT_MODEL,
} from '@/config/chatApi'
import {
  normalizeChatStorage, serializeChatStorage, type PersistedChatState,
} from '@/utils/chatStorageCore'

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
    webSearchEnabled: boolean
    live2dEnabled: boolean
    live2dOutfit: string
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
      provider: 'api',
      apiBaseUrl: CLIPROXY_BASE_URL,
      apiModel: CLIPROXY_DEFAULT_MODEL,
      apiKey: CLIPROXY_API_KEY,
      webSearchEnabled: false,
      live2dEnabled: false,
      live2dOutfit: 'school',
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
    state.settings.apiKey = persisted.settings.apiKey
    state.settings.webSearchEnabled = persisted.settings.webSearchEnabled
    state.settings.live2dEnabled = persisted.settings.live2dEnabled
    state.settings.live2dOutfit = persisted.settings.live2dOutfit
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
        apiKey: state.settings.apiKey,
        webSearchEnabled: state.settings.webSearchEnabled,
        live2dEnabled: state.settings.live2dEnabled,
        live2dOutfit: state.settings.live2dOutfit,
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

      state.settings.apiKey = String(normalized.state.settings.apiKey || normalized.migratedApiKey).trim().slice(0, 1000)

      // Rewriting existing records through the allowlist removes unsupported
      // authorization headers, tokens and unknown fields from localStorage.
      if (stored) localStorage.setItem(STORAGE_KEY, serializeChatStorage(persistedState()))
    } catch {
      const clean = normalizeChatStorage({}, '', normalizeOptions).state
      applyPersisted(clean)
      try { localStorage.setItem(STORAGE_KEY, serializeChatStorage(clean)) } catch {}
      onError('本地聊天记录损坏，已恢复为空白会话。')
    }
  }

  function save() {
    try {
      state.version = STORAGE_VERSION
      localStorage.setItem(STORAGE_KEY, serializeChatStorage(persistedState()))
      localStorage.setItem('aics_chat_model', state.settings.model || '')
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
  function setWebSearchEnabled(value: boolean) { state.settings.webSearchEnabled = Boolean(value); save() }
  function setLive2dEnabled(value: boolean) { state.settings.live2dEnabled = Boolean(value); save() }
  function setLive2dOutfit(value: string) {
    state.settings.live2dOutfit = String(value || 'school').slice(0, 40)
    save()
  }
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
    setActive, setModel, setProvider, setApiSettings, setWebSearchEnabled,
    setLive2dEnabled, setLive2dOutfit, setAutoVoice, setVolume, draft, setDraft, trim, clear,
  }
}
