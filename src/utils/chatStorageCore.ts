export interface ChatStorageOptions {
  characterIds: string[]
  maxMessages: number
  version: number
  createMessageId: () => string
}

export interface PersistedChatMessage {
  role: 'user' | 'assistant'
  content: string
  mid: string
  stopped: boolean
}

export interface PersistedChatState {
  version: number
  active: string
  histories: Record<string, PersistedChatMessage[]>
  settings: {
    model: string
    provider: 'local' | 'api'
    apiBaseUrl: string
    apiModel: string
    live2dEnabled: boolean
    live2dOutfit: string
    autoVoice: boolean
    volume: number
    drafts: Record<string, string>
  }
}

const LIVE2D_OUTFIT_IDS = new Set(['school', 'casual', 'sleepwear', 'cosplay', 'witch'])

export interface NormalizedChatStorage {
  state: PersistedChatState
  migratedApiKey: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function normalizeMessages(
  value: unknown,
  maxMessages: number,
  createMessageId: () => string,
): PersistedChatMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((message): message is Record<string, unknown> =>
      isRecord(message) && (message.role === 'user' || message.role === 'assistant'))
    .map(message => ({
      role: message.role as 'user' | 'assistant',
      content: text(message.content, 1200),
      mid: message.role === 'assistant'
        ? text(message.mid, 160) || text(message.id, 160) || createMessageId()
        : '',
      stopped: message.stopped === true,
    }))
    .filter(message => message.content)
    .slice(-maxMessages)
}

export function normalizeChatStorage(
  value: unknown,
  legacyModel: unknown,
  options: ChatStorageOptions,
): NormalizedChatStorage {
  const raw = isRecord(value) ? value : {}
  const settings = isRecord(raw.settings) ? raw.settings : {}
  const legacyApi = isRecord(raw.api) ? raw.api : {}
  const histories = isRecord(raw.histories) ? raw.histories : {}
  const drafts = isRecord(settings.drafts) ? settings.drafts : {}
  const ids = options.characterIds.length ? options.characterIds : ['nene']
  const activeCandidate = text(raw.active, 80) || text(raw.activeCharacter, 80)
  const active = ids.includes(activeCandidate) ? activeCandidate : ids[0]

  const normalizedHistories: Record<string, PersistedChatMessage[]> = {}
  const normalizedDrafts: Record<string, string> = {}
  for (const id of ids) {
    normalizedHistories[id] = normalizeMessages(
      histories[id], options.maxMessages, options.createMessageId,
    )
    normalizedDrafts[id] = text(drafts[id], 1200)
  }

  const providerCandidate = settings.provider ?? raw.provider
  const rawVolume = Number(settings.volume)
  const volume = Number.isFinite(rawVolume)
    ? Math.max(0, Math.min(100, Math.round(rawVolume)))
    : 80
  const outfitCandidate = text(settings.live2dOutfit, 40)

  return {
    state: {
      version: options.version,
      active,
      histories: normalizedHistories,
      settings: {
        model: text(settings.model, 200) || text(raw.model, 200) || text(legacyModel, 200),
        provider: providerCandidate === 'api' ? 'api' : 'local',
        apiBaseUrl: text(settings.apiBaseUrl, 500)
          || text(settings.baseUrl, 500)
          || text(legacyApi.baseUrl, 500)
          || 'https://api.deepseek.com',
        apiModel: text(settings.apiModel, 200)
          || text(legacyApi.model, 200)
          || 'deepseek-v4-flash',
        live2dEnabled: settings.live2dEnabled === true,
        live2dOutfit: LIVE2D_OUTFIT_IDS.has(outfitCandidate) ? outfitCandidate : 'school',
        autoVoice: settings.autoVoice !== false,
        volume,
        drafts: normalizedDrafts,
      },
    },
    // Legacy versions persisted credentials in localStorage. The composable moves
    // this value into sessionStorage, then rewrites durable data through an allowlist.
    migratedApiKey: text(settings.apiKey, 1000)
      || text(raw.apiKey, 1000)
      || text(legacyApi.apiKey, 1000),
  }
}

export function serializeChatStorage(state: PersistedChatState): string {
  return JSON.stringify({
    version: state.version,
    active: state.active,
    histories: state.histories,
    settings: state.settings,
  })
}
