import { reactive, ref } from 'vue'
import {
  CHARACTERS, STORAGE_KEY, STORAGE_VERSION, MAX_LOCAL_MESSAGES, createMessageId,
} from '@/config/characters'
import {
  CLIPROXY_BASE_URL, CLIPROXY_API_KEY, CLIPROXY_DEFAULT_MODEL,
} from '@/config/chatApi'
import {
  normalizeChatStorage, serializeChatStorage, type PersistedChatState,
} from '@/utils/chatStorageCore'
import {
  CHAT_ARCHIVE_KEY,
  archiveCounts,
  archiveMessages,
  chatArchiveToMarkdown,
  emptyChatArchive,
  mergeArchiveIntoHistory,
  mergeChatArchives,
  normalizeChatArchive,
  serializeChatArchive,
  type ChatArchive,
} from '@/utils/chatArchive'

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

  /** 用户从未配置过 API（当前是开箱即用兜底值）；站主配置优先于此标记 */
  const neverConfigured = ref(true)
  const archive = ref<ChatArchive>(emptyChatArchive(Object.keys(CHARACTERS)))

  function loadArchive() {
    try {
      archive.value = normalizeChatArchive(
        JSON.parse(localStorage.getItem(CHAT_ARCHIVE_KEY) || 'null'),
        Object.keys(CHARACTERS),
      )
    } catch {
      archive.value = emptyChatArchive(Object.keys(CHARACTERS))
    }
  }

  function saveArchive() {
    try {
      localStorage.setItem(CHAT_ARCHIVE_KEY, serializeChatArchive(archive.value))
    } catch {
      onError('浏览器存储空间不足，聊天归档可能无法长期保存。')
    }
  }

  /** 把超限消息转入归档，而不是直接丢弃。 */
  function archiveOverflow(char: string, messages: ChatMessage[], limit: number) {
    if (messages.length <= limit) return
    const removed = messages.splice(0, messages.length - limit)
    archive.value = archiveMessages(archive.value, char, removed)
    saveArchive()
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
      const raw = stored ? JSON.parse(stored) : {}
      // 先把持久化里的超限消息归档，再走白名单归一化，保证旧消息不丢。
      const rawHistories = raw && typeof raw === 'object' && (raw as Record<string, unknown>).histories
      if (rawHistories && typeof rawHistories === 'object') {
        for (const char of Object.keys(CHARACTERS)) {
          const list = (rawHistories as Record<string, unknown>)[char]
          if (Array.isArray(list) && list.length > MAX_LOCAL_MESSAGES) {
            const overflow = list.slice(0, list.length - MAX_LOCAL_MESSAGES)
            archive.value = archiveMessages(archive.value, char, overflow as ChatMessage[])
          }
        }
      }
      const normalized = normalizeChatStorage(
        raw,
        localStorage.getItem('aics_chat_model') || '',
        normalizeOptions,
      )
      applyPersisted(normalized.state)
      neverConfigured.value = normalized.neverConfigured

      state.settings.apiKey = String(normalized.state.settings.apiKey || normalized.migratedApiKey).trim().slice(0, 1000)

      // Rewriting existing records through the allowlist removes unsupported
      // authorization headers, tokens and unknown fields from localStorage.
      if (stored) localStorage.setItem(STORAGE_KEY, serializeChatStorage(persistedState()))
      saveArchive()
    } catch {
      const clean = normalizeChatStorage({}, '', normalizeOptions).state
      applyPersisted(clean)
      neverConfigured.value = true
      try { localStorage.setItem(STORAGE_KEY, serializeChatStorage(clean)) } catch {}
      saveArchive()
      onError('本地聊天记录损坏，已恢复为空白会话。')
    }
  }

  loadArchive()

  function save() {
    try {
      state.version = STORAGE_VERSION
      localStorage.setItem(STORAGE_KEY, serializeChatStorage(persistedState()))
      localStorage.setItem('aics_chat_model', state.settings.model || '')
      saveArchive()
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
    // 用户显式保存过 API 配置，不再是"从未配置"，站主配置不再抢占
    neverConfigured.value = false
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
    archiveOverflow(char, msgs, MAX_LOCAL_MESSAGES)
  }
  function archiveCount(): Record<string, number>
  function archiveCount(char: string): number
  function archiveCount(char?: string) {
    const counts = archiveCounts(archive.value, Object.keys(CHARACTERS))
    return char ? counts[char] || 0 : counts
  }
  function exportArchiveJson(): string {
    return serializeChatArchive(archive.value)
  }
  function exportArchiveMarkdown(): string {
    const names: Record<string, string> = {}
    for (const id of Object.keys(CHARACTERS)) names[id] = CHARACTERS[id].name
    return chatArchiveToMarkdown(archive.value, names)
  }
  /** 导入归档 JSON：合并去重后落盘，返回导入条数。 */
  function importArchiveJson(textValue: string): number {
    const incoming = normalizeChatArchive(JSON.parse(textValue), Object.keys(CHARACTERS))
    const before = archiveCounts(archive.value, Object.keys(CHARACTERS))
    archive.value = mergeChatArchives(archive.value, incoming)
    saveArchive()
    const after = archiveCounts(archive.value, Object.keys(CHARACTERS))
    return Object.keys(after).reduce((sum, id) => sum + Math.max(0, after[id] - (before[id] || 0)), 0)
  }
  /** 把该角色归档并回当前对话；返回并入条数。 */
  function restoreFromArchive(char = state.active): number {
    if (!CHARACTERS[char]) return 0
    const archived = archive.value.archived[char] || []
    if (!archived.length) return 0
    const history = messages(char)
    const merged = mergeArchiveIntoHistory(history, archived)
    const added = merged.length - history.length
    if (added > 0) {
      // 完整并回（不截断）：超过 20 条的部分在下次 trim 时会再次归档，
      // 归档按 mid 去重，不会产生副本，也不会丢失。
      state.histories[char] = merged
      save()
    }
    return added
  }
  function clearArchive(char?: string) {
    if (char) archive.value.archived[char] = []
    else archive.value = emptyChatArchive(Object.keys(CHARACTERS))
    saveArchive()
  }
  function clear(char?: string) {
    if (char) { state.histories[char] = [] }
    else { for (const k of Object.keys(CHARACTERS)) state.histories[k] = [] }
    save()
  }

  return {
    state, load, save, messages, neverConfigured,
    setActive, setModel, setProvider, setApiSettings, setWebSearchEnabled,
    setLive2dEnabled, setLive2dOutfit, setAutoVoice, setVolume, draft, setDraft, trim, clear,
    archiveCount, exportArchiveJson, exportArchiveMarkdown, importArchiveJson,
    restoreFromArchive, clearArchive,
  }
}
