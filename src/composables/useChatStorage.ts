import { reactive } from 'vue'
import { CHARACTERS, STORAGE_KEY, MAX_LOCAL_MESSAGES, createMessageId } from '@/config/characters'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  mid: string
  stopped: boolean
}

export interface ChatState {
  active: string
  histories: Record<string, ChatMessage[]>
  settings: {
    model: string
    autoVoice: boolean
    volume: number
    drafts: Record<string, string>
  }
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return (value as any[])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content || '').slice(0, 1200),
      mid: m.role === 'assistant' ? String(m.mid || createMessageId()) : '',
      stopped: m.stopped === true,
    }))
    .filter(m => m.content)
    .slice(-MAX_LOCAL_MESSAGES)
}

export function useChatStorage(onError: (msg: string) => void = () => {}) {
  const state = reactive<ChatState>({
    active: 'nene',
    histories: Object.fromEntries(Object.keys(CHARACTERS).map(k => [k, []])),
    settings: { model: '', autoVoice: true, volume: 80, drafts: Object.fromEntries(Object.keys(CHARACTERS).map(k => [k, ''])) },
  })

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      state.active = raw.active === 'natsume' ? 'natsume' : 'nene'
      for (const char of Object.keys(CHARACTERS)) {
        state.histories[char] = normalizeMessages(raw.histories?.[char])
      }
      const savedModel = raw.settings?.model || localStorage.getItem('aics_chat_model') || ''
      state.settings.model = String(savedModel)
      state.settings.autoVoice = raw.settings ? raw.settings.autoVoice !== false : true
      state.settings.volume = typeof raw.settings?.volume === 'number' ? raw.settings.volume : 80
      for (const char of Object.keys(CHARACTERS)) {
        state.settings.drafts[char] = String(raw.settings?.drafts?.[char] || '').slice(0, 1200)
      }
    } catch {
      onError('本地聊天记录损坏，已使用空白会话。')
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
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

  return { state, load, save, messages, setActive, setModel, setAutoVoice, setVolume, draft, setDraft, trim, clear }
}
