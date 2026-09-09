import { ref } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { toggleFavoriteAction } from './galleryMutations'
import type { ArtworkRecord } from '@/types/artwork'

const patch = vi.hoisted(() => vi.fn())
vi.mock('@/storage/artworkRepository', () => ({ artworkRepository: { patchArtwork: patch } }))
beforeEach(() => patch.mockReset())
const context = () => ({ history: ref<ArtworkRecord[]>([]), showToast: vi.fn() })
const artwork = () => ({ id: 1, favorite: false } as ArtworkRecord)

it('rapid toggles serialize writes and preserve the latest click', async () => {
  let finish!: (value: { updated: boolean }) => void
  patch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue({ updated: true })
  const ctx = context(), item = artwork()
  const first = toggleFavoriteAction(ctx, item)
  const second = toggleFavoriteAction(ctx, item)
  await Promise.resolve()
  expect(item.favorite).toBe(false)
  expect(patch).toHaveBeenCalledTimes(1)
  finish({ updated: true })
  await Promise.all([first, second])
  expect(patch.mock.calls.map(call => call[1].favorite)).toEqual([true, false])
  expect(item.favorite).toBe(false)
})

it('a failed final write rolls back to the last confirmed value', async () => {
  patch.mockResolvedValueOnce({ updated: true }).mockRejectedValueOnce(new Error('quota'))
  const ctx = context(), item = artwork()
  await Promise.all([toggleFavoriteAction(ctx, item), toggleFavoriteAction(ctx, item)])
  expect(item.favorite).toBe(true)
  expect(ctx.showToast).toHaveBeenCalledOnce()
  patch.mockResolvedValue({ updated: true })
  await toggleFavoriteAction(ctx, item)
  expect(item.favorite).toBe(false)
})

it('an earlier failure cannot roll back a newer successful choice', async () => {
  patch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ updated: true })
  const ctx = context(), item = artwork()
  await Promise.all([toggleFavoriteAction(ctx, item), toggleFavoriteAction(ctx, item)])
  expect(item.favorite).toBe(false)
})
