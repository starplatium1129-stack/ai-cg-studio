export const BACKUP_APP = 'ai-cg-studio'
export const BACKUP_TYPE = 'aics-personal-backup'
export const BACKUP_SCHEMA_VERSION = 2

export type BackupRecord = Record<string, unknown> & {
  id?: unknown
  timestamp?: unknown
  updatedAt?: unknown
  createdAt?: unknown
  image_id?: unknown
}

export interface BackupImage {
  id: string
  name?: string
  type?: string
  size?: number
  created_at?: number
  dataUrl: string
}

export interface BackupFile {
  app: string
  appVersion: string
  schemaVersion: number
  createdAt: string
  data: {
    history: BackupRecord[]
    projects: BackupRecord[]
    settings: Record<string, string>
  }
  images: BackupImage[]
}

export interface BackupSummary {
  history: number
  projects: number
  images: number
  settings: number
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function finite(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function records(value: unknown): BackupRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is BackupRecord => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : []
}

function settings(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(object(value))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function image(value: unknown): BackupImage | null {
  const source = object(value)
  const id = typeof source.id === 'string' ? source.id.trim() : ''
  const dataUrl = typeof source.dataUrl === 'string' ? source.dataUrl : ''
  if (!id || !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(dataUrl)) return null
  return {
    id,
    name: typeof source.name === 'string' ? source.name : '',
    type: typeof source.type === 'string' ? source.type : '',
    size: Math.max(0, finite(source.size)),
    created_at: Math.max(0, finite(source.created_at)),
    dataUrl,
  }
}

export function normalizeBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('备份文件不是有效对象')
  const source = raw as Record<string, unknown>
  const version = Math.max(0, Math.floor(finite(source.schemaVersion)))
  if (version > BACKUP_SCHEMA_VERSION) throw new Error('该备份来自更新版本，请先升级网站')
  if (source.type != null && source.type !== BACKUP_TYPE) throw new Error('该文件不是绫季绘境备份')
  if (source.app != null && source.app !== BACKUP_APP) throw new Error('该文件不是绫季绘境备份')

  const hasLegacyData = ['history', 'projects', 'settings', 'images']
    .some(key => Object.prototype.hasOwnProperty.call(source, key))
  const hasNestedData = Object.prototype.hasOwnProperty.call(source, 'data')
    && Boolean(source.data && typeof source.data === 'object' && !Array.isArray(source.data))
  const nested = object(source.data)
  if (!hasNestedData && !hasLegacyData) throw new Error('该文件不包含可恢复的绫季绘境数据')

  const data = hasNestedData ? nested : source
  const normalized: BackupFile = {
    app: String(source.app || BACKUP_APP),
    appVersion: String(source.appVersion || ''),
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: String(source.createdAt || source.exportedAt || new Date(0).toISOString()),
    data: {
      history: records(data.history),
      projects: records(data.projects),
      settings: settings(data.settings),
    },
    images: (Array.isArray(source.images) ? source.images : []).map(image).filter((item): item is BackupImage => Boolean(item)),
  }
  if (!normalized.data.history.length && !normalized.data.projects.length
      && !normalized.images.length && !Object.keys(normalized.data.settings).length) {
    throw new Error('备份文件里没有可恢复的数据')
  }
  return normalized
}

export function createBackup(payload: {
  appVersion: string
  history?: BackupRecord[]
  projects?: BackupRecord[]
  settings?: Record<string, string>
  images?: BackupImage[]
  createdAt?: string
}): BackupFile {
  return normalizeBackup({
    app: BACKUP_APP,
    type: BACKUP_TYPE,
    appVersion: payload.appVersion,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: payload.createdAt || new Date().toISOString(),
    data: {
      history: payload.history || [],
      projects: payload.projects || [],
      settings: payload.settings || {},
    },
    images: payload.images || [],
  })
}

function recordTimestamp(record: BackupRecord): number {
  return finite(record.timestamp ?? record.updatedAt ?? record.createdAt)
}

export function mergeBackupRecords(current: BackupRecord[], incoming: BackupRecord[]): BackupRecord[] {
  const merged = new Map<string, BackupRecord>()
  const insert = (item: BackupRecord, index: number, source: 'current' | 'incoming') => {
    const timestamp = recordTimestamp(item)
    const key = item.id != null
      ? `id:${String(item.id)}`
      : timestamp ? `legacy:${timestamp}` : `${source}:${index}`
    const previous = merged.get(key)
    if (!previous || recordTimestamp(item) >= recordTimestamp(previous)) {
      merged.set(key, previous ? { ...previous, ...item } : { ...item })
    }
  }
  records(current).forEach((item, index) => insert(item, index, 'current'))
  records(incoming).forEach((item, index) => insert(item, index, 'incoming'))
  return [...merged.values()].sort((a, b) => recordTimestamp(b) - recordTimestamp(a))
}

export function summarizeBackup(backup: BackupFile): BackupSummary {
  return {
    history: backup.data.history.length,
    projects: backup.data.projects.length,
    images: backup.images.length,
    settings: Object.keys(backup.data.settings).length,
  }
}
