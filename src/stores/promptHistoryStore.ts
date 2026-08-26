import { ref } from 'vue'
import { defineStore } from 'pinia'
import { kvGet, kvSet } from '@/composables/useKVStore'
import { blobThumbDataUrl, thumbKey } from '@/utils/imageThumb'
import { artworkRepository } from '@/storage/artworkRepository'
import { ARTWORK_HISTORY_KV_KEY, ARTWORK_PROJECTS_KV_KEY } from '@/utils/storageKeys'
import { parseProjectOptions, type ProjectOption } from '@/utils/promptBuilderPersistence'

const HISTORY_STORAGE_KEY = ARTWORK_HISTORY_KV_KEY
const PROJECT_STORAGE_KEY = ARTWORK_PROJECTS_KV_KEY

let historyIdLastMs = 0
let historyIdCounter = 0
function historyIdSeq(now: number): number {
  if (now !== historyIdLastMs) { historyIdLastMs = now; historyIdCounter = 0 }
  historyIdCounter += 1
  return now * 1000 + historyIdCounter
}

async function measureBlob(blob: Blob): Promise<{ width: number | null; height: number | null }> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob)
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close?.()
      return size
    }
  } catch { /* fallback */ }
  return await new Promise(resolve => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve({ width: null, height: null }); URL.revokeObjectURL(url) }
    img.src = url
  })
}

async function cacheThumbnail(imageId: string, blob: Blob): Promise<void> {
  try {
    const dataUrl = await blobThumbDataUrl(blob)
    if (dataUrl) await kvSet(thumbKey(imageId), dataUrl)
  } catch { /* ignore */ }
}

export const usePromptHistoryStore = defineStore('promptHistory', () => {
  const history = ref<unknown[]>([])
  const projects = ref<ProjectOption[]>([])

  async function loadHistory() {
    try {
      const raw = await kvGet<unknown[]>(HISTORY_STORAGE_KEY)
      if (Array.isArray(raw)) history.value = raw
    } catch {}
    await loadProjects()
  }

  async function loadProjects() {
    try {
      let raw: unknown = await kvGet(PROJECT_STORAGE_KEY)
      let parsed = parseProjectOptions(raw)
      if (!parsed.length) {
        raw = await kvGet('aics_projects')
        parsed = parseProjectOptions(raw)
      }
      projects.value = parsed
    } catch {}
  }

  async function removeHistoryEntry(id: number) {
    const result = await artworkRepository.deleteArtwork(id)
    if (result.historyChanged) history.value = (history.value as unknown as Array<{ id: number }>).filter(entry => entry.id !== id) as unknown as typeof history.value
    if (result.removedProjectReferences > 0) await loadProjects()
  }

  return {
    history,
    projects,
    historyIdSeq,
    measureBlob,
    cacheThumbnail,
    loadHistory,
    loadProjects,
    removeHistoryEntry,
  }
})

export type PromptHistoryStore = ReturnType<typeof usePromptHistoryStore>
