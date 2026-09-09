import { ref } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { loadGalleryStorageAction, type GalleryProject } from './galleryStorage'
import type { ArtworkRecord } from '@/types/artwork'
import { ARTWORK_HISTORY_KV_KEY, ARTWORK_PROJECTS_KV_KEY } from '@/utils/storageKeys'

const storage = vi.hoisted(() => ({ init: vi.fn(), get: vi.fn(), set: vi.fn() }))
vi.mock('@/composables/useKVStore', () => ({ kvInit: storage.init, kvGet: storage.get, kvSet: storage.set }))
beforeEach(() => {
  Object.values(storage).forEach(fn => fn.mockReset())
  storage.init.mockResolvedValue(undefined)
  storage.set.mockResolvedValue(undefined)
  localStorage.clear()
})
const context = () => ({ galleryLoading: ref(false), galleryError: ref(''), history: ref<ArtworkRecord[]>([{ id: 'existing', prompt: 'keep me' } as ArtworkRecord]), projects: ref<GalleryProject[]>([]) })

it('read failure preserves displayed artwork and the next load can recover', async () => {
  const ctx = context()
  storage.get.mockRejectedValueOnce(new Error('temporarily unavailable'))
  await loadGalleryStorageAction(ctx)
  expect(ctx.history.value[0].id).toBe('existing')
  expect(ctx.galleryLoading.value).toBe(false)
  expect(ctx.galleryError.value).toContain('temporarily unavailable')
  storage.get.mockImplementation(key => Promise.resolve(key === ARTWORK_HISTORY_KV_KEY ? [{ id: 'new', prompt: 'new work' }] : []))
  await loadGalleryStorageAction(ctx)
  expect(ctx.history.value[0].id).toBe('new')
  expect(ctx.galleryError.value).toBe('')
})

it('failed migration retains its local source until the write succeeds', async () => {
  const ctx = context()
  localStorage.setItem(ARTWORK_HISTORY_KV_KEY, JSON.stringify([{ id: 'legacy', prompt: 'old work' }]))
  storage.get.mockImplementation(key => Promise.resolve(key === ARTWORK_PROJECTS_KV_KEY ? [] : null))
  storage.set.mockRejectedValueOnce(new Error('quota'))
  await loadGalleryStorageAction(ctx)
  expect(localStorage.getItem(ARTWORK_HISTORY_KV_KEY)).toContain('legacy')
  expect(ctx.history.value[0].id).toBe('existing')
  await loadGalleryStorageAction(ctx)
  expect(localStorage.getItem(ARTWORK_HISTORY_KV_KEY)).toBeNull()
  expect(ctx.history.value[0].id).toBe('legacy')
})
