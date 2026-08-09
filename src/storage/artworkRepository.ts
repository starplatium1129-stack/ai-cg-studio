import { kvGet, kvSet } from '../composables/useKVStore.ts'
import {
  imgDeleteMany,
  imgGetRecord,
  imgPutRecord,
  type ImageRecordInput,
  type StoredImageRecord,
} from '../composables/useImageStore.ts'
import { thumbKey } from '../utils/imageThumb.ts'

export const ARTWORK_HISTORY_KEY = 'aics_pb_history'
export const ARTWORK_PROJECTS_KEY = 'aics_pb_projects'

export interface ArtworkKvAdapter {
  get(key: string): Promise<unknown | null>
  set(key: string, value: unknown): Promise<void>
  remove?(key: string): Promise<void>
}

export interface ArtworkImageAdapter {
  get(id: string): Promise<StoredImageRecord | null>
  putRecord(record: ImageRecordInput): Promise<string>
  deleteMany(ids: string[]): Promise<void>
}

export interface ArtworkRepositoryDependencies {
  kv?: Partial<ArtworkKvAdapter>
  images?: Partial<ArtworkImageAdapter>
}

export interface ArtworkDeleteResult {
  deleted: boolean
  historyChanged: boolean
  removedImageIds: string[]
  removedThumbnailIds: string[]
  removedProjectReferences: number
}

export class ArtworkDeletionError extends Error {
  readonly originalError: unknown
  readonly rollbackErrors: unknown[]

  constructor(originalError: unknown, rollbackErrors: unknown[] = []) {
    const detail = originalError instanceof Error ? originalError.message : String(originalError)
    super(rollbackErrors.length
      ? `作品删除失败，补偿回滚也失败：${detail}`
      : `作品删除失败，已补偿回滚：${detail}`)
    this.name = 'ArtworkDeletionError'
    this.originalError = originalError
    this.rollbackErrors = rollbackErrors
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function comparableId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function recordId(value: unknown): string | null {
  return comparableId(record(value)?.id)
}

function imageId(value: unknown): string | null {
  const id = record(value)?.image_id
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

function unique(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function arrayValue(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value.slice() : null
}

function removeProjectReferences(value: unknown, targetId: string): {
  value: unknown
  changed: boolean
  removed: number
} {
  const projects = arrayValue(value)
  if (!projects) return { value, changed: false, removed: 0 }
  let changed = false
  let removed = 0
  const next = projects.map(project => {
    const source = record(project)
    if (!source || !Array.isArray(source.history_ids)) return project
    const historyIds = source.history_ids
    const filtered = historyIds.filter(id => comparableId(id) !== targetId)
    if (filtered.length === historyIds.length) return project
    changed = true
    removed += historyIds.length - filtered.length
    return { ...source, history_ids: filtered }
  })
  return { value: next, changed, removed }
}

function imageRecordInput(record: StoredImageRecord): ImageRecordInput {
  return {
    id: record.id,
    blob: record.blob,
    name: record.name,
    type: record.type,
    created_at: record.created_at,
  }
}

async function callSafely(action: () => Promise<void>, errors: unknown[]): Promise<void> {
  try { await action() } catch (error) { errors.push(error) }
}

export function createArtworkRepository(dependencies: ArtworkRepositoryDependencies = {}) {
  const kv: ArtworkKvAdapter = {
    get: dependencies.kv?.get ?? (key => kvGet(key)),
    set: dependencies.kv?.set ?? ((key, value) => kvSet(key, value)),
    remove: dependencies.kv?.remove ?? (key => kvSet(key, null)),
  }
  const images: ArtworkImageAdapter = {
    get: dependencies.images?.get ?? (id => imgGetRecord(id)),
    putRecord: dependencies.images?.putRecord ?? (value => imgPutRecord(value)),
    deleteMany: dependencies.images?.deleteMany ?? (ids => imgDeleteMany(ids)),
  }

  // All UI callers share one instance; serialize deletes so each snapshot sees the prior commit.
  let mutationTail: Promise<void> = Promise.resolve()

  async function deleteArtworkNow(id: string | number): Promise<ArtworkDeleteResult> {
    const targetId = comparableId(id)
    if (!targetId) throw new Error('作品 ID 无效')

    const [historySnapshot, projectsSnapshot] = await Promise.all([
      kv.get(ARTWORK_HISTORY_KEY),
      kv.get(ARTWORK_PROJECTS_KEY),
    ])
    const history = arrayValue(historySnapshot) ?? []
    const targetEntries = history.filter(item => recordId(item) === targetId)
    const nextHistory = history.filter(item => recordId(item) !== targetId)
    const historyChanged = targetEntries.length > 0
    const projectUpdate = removeProjectReferences(projectsSnapshot, targetId)

    const targetImageIds = unique(targetEntries.map(imageId))
    const remainingImageIds = new Set(unique(nextHistory.map(imageId)))
    const removedImageIds = targetImageIds.filter(image => !remainingImageIds.has(image))
    const removedThumbnailIds = removedImageIds.slice()

    if (!historyChanged && !projectUpdate.changed) {
      return {
        deleted: false,
        historyChanged: false,
        removedImageIds: [],
        removedThumbnailIds: [],
        removedProjectReferences: 0,
      }
    }

    const imageSnapshot = (await Promise.all(removedImageIds.map(image => images.get(image))))
      .filter((item): item is StoredImageRecord => item !== null)
    const thumbnailSnapshot = new Map<string, unknown>()
    for (const image of removedThumbnailIds) {
      thumbnailSnapshot.set(image, await kv.get(thumbKey(image)))
    }

    let historyWriteAttempted = false
    let projectWriteAttempted = false
    let imageDeleteAttempted = false
    let thumbnailDeleteAttempted = false

    try {
      if (historyChanged) {
        historyWriteAttempted = true
        await kv.set(ARTWORK_HISTORY_KEY, nextHistory)
      }
      if (projectUpdate.changed) {
        projectWriteAttempted = true
        await kv.set(ARTWORK_PROJECTS_KEY, projectUpdate.value)
      }
      if (removedImageIds.length) {
        imageDeleteAttempted = true
        await images.deleteMany(removedImageIds)
      }
      if (removedThumbnailIds.length) {
        thumbnailDeleteAttempted = true
        for (const image of removedThumbnailIds) await kv.remove?.(thumbKey(image))
      }
      return {
        deleted: historyChanged,
        historyChanged,
        removedImageIds,
        removedThumbnailIds,
        removedProjectReferences: projectUpdate.removed,
      }
    } catch (originalError) {
      const rollbackErrors: unknown[] = []
      if (imageDeleteAttempted) {
        for (const snapshot of imageSnapshot) {
          await callSafely(() => images.putRecord(imageRecordInput(snapshot)).then(() => undefined), rollbackErrors)
        }
      }
      if (thumbnailDeleteAttempted) {
        for (const [image, snapshot] of thumbnailSnapshot) {
          await callSafely(async () => {
            if (snapshot == null) await kv.remove?.(thumbKey(image))
            else await kv.set(thumbKey(image), snapshot)
          }, rollbackErrors)
        }
      }
      if (projectWriteAttempted) {
        await callSafely(() => kv.set(ARTWORK_PROJECTS_KEY, projectsSnapshot), rollbackErrors)
      }
      if (historyWriteAttempted) {
        await callSafely(() => kv.set(ARTWORK_HISTORY_KEY, historySnapshot), rollbackErrors)
      }
      throw new ArtworkDeletionError(originalError, rollbackErrors)
    }
  }

  function deleteArtwork(id: string | number): Promise<ArtworkDeleteResult> {
    const operation = mutationTail.then(() => deleteArtworkNow(id))
    mutationTail = operation.then(() => undefined, () => undefined)
    return operation
  }

  return { deleteArtwork }
}

export const artworkRepository = createArtworkRepository()

export async function deleteArtwork(id: string | number): Promise<ArtworkDeleteResult> {
  return artworkRepository.deleteArtwork(id)
}
