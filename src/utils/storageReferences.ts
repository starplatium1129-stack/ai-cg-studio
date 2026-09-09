import { TEMP_RESULT_KEY, VIDEO_CONTEXT_KEY, VIDEO_SHOTS_CONTEXT_KEY, VIDEO_DRAFT_KEY, VIDEO_SHOTS_DRAFT_KEY } from './storageKeys'

/** Conservatively protect every stored image ID mentioned by persisted drafts, projects or trash. */
export function collectImageReferences(values: unknown[]): Set<string> {
  const references = new Set<string>()
  const visit = (value: unknown) => {
    if (typeof value === 'string') references.add(value)
    else if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
  }
  values.forEach(visit)
  return references
}

export function readSessionImageReferences(storage: Pick<Storage, 'getItem'>): unknown[] {
  return [TEMP_RESULT_KEY, VIDEO_CONTEXT_KEY, VIDEO_SHOTS_CONTEXT_KEY, VIDEO_DRAFT_KEY, VIDEO_SHOTS_DRAFT_KEY].map(key => {
    const raw = storage.getItem(key)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { throw new Error('创作草稿无法读取，已停止清理以保护原图') }
  })
}
