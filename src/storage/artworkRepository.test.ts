/**
 * artworkRepository 单测（2026-08-31 七维审计 P1：补测试盲区）。
 *
 * 被测模块通过 ArtworkRepositoryDependencies 注入 KV / 图片适配器，
 * 这里用内存 Map 假实现，不触 IndexedDB（useKVStore/useImageStore 均
 * 惰性访问，import 无副作用，无需 mock）。
 */
import { describe, expect, it, vi } from 'vitest'
import {
  createArtworkRepository,
  ArtworkDeletionError,
  ARTWORK_TRASH_RETENTION_DAYS,
} from './artworkRepository'
import { thumbKey } from '../utils/imageThumb'
import type { StoredImageRecord } from '../composables/useImageStore'
import {
  ARTWORK_HISTORY_KV_KEY,
  ARTWORK_PROJECTS_KV_KEY,
  ARTWORK_TRASH_KV_KEY,
} from '../utils/storageKeys'

const KV = {
  history: ARTWORK_HISTORY_KV_KEY,
  projects: ARTWORK_PROJECTS_KV_KEY,
  trash: ARTWORK_TRASH_KV_KEY,
}

function makeKv(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial))
  const adapter = {
    get: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
    set: vi.fn(async (key: string, value: unknown) => { store.set(key, value) }),
    remove: vi.fn(async (key: string) => { store.delete(key) }),
  }
  return { adapter, store }
}

function makeImages(initial: StoredImageRecord[] = []) {
  const store = new Map<string, StoredImageRecord>(initial.map(rec => [rec.id, rec]))
  const adapter = {
    get: vi.fn(async (id: string) => store.get(id) ?? null),
    putRecord: vi.fn(async (rec: { id: string; blob: Blob }) => {
      const full: StoredImageRecord = {
        id: rec.id, blob: rec.blob, name: '', type: '', size: 0, created_at: Date.now(),
      }
      store.set(rec.id, full)
      return rec.id
    }),
    deleteMany: vi.fn(async (ids: string[]) => { for (const id of ids) store.delete(id) }),
  }
  return { adapter, store }
}

const fakeBlob = new Blob(['x'], { type: 'image/png' })

/** 组装一份「2 条历史 + 1 个项目引用其中一条」的仓库 */
function makeRepo() {
  const kv = makeKv()
  const images = makeImages([
    { id: 'img-a', blob: fakeBlob, name: 'a.png', type: 'image/png', size: 1, created_at: 1 },
    { id: 'img-b', blob: fakeBlob, name: 'b.png', type: 'image/png', size: 1, created_at: 2 },
  ])
  const history = [
    { id: 'a1', image_id: 'img-a', favorite: false },
    { id: 'b2', image_id: 'img-b', favorite: false },
  ]
  const projects = [{ id: 'p1', name: '项目一', history_ids: ['a1'] }]
  kv.store.set(KV.history, history)
  kv.store.set(KV.projects, projects)
  const repo = createArtworkRepository({ kv: kv.adapter, images: images.adapter })
  return { repo, kv, images }
}

function historyIds(kv: ReturnType<typeof makeKv>): string[] {
  return (kv.store.get(KV.history) as Array<{ id: string }>).map(h => h.id)
}

describe('artworkRepository 软删 / 恢复', () => {
  it('softDelete：history 移除、项目引用摘除、图片保留、快照进 trash', async () => {
    const { repo, kv, images } = makeRepo()
    const result = await repo.softDeleteArtwork('a1')

    expect(result.deleted).toBe(true)
    expect(historyIds(kv)).toEqual(['b2'])
    const projects = kv.store.get(KV.projects) as Array<{ history_ids: string[] }>
    expect(projects[0].history_ids).toEqual([])
    // 软删不真删图片
    expect(images.store.has('img-a')).toBe(true)
    expect(images.adapter.deleteMany).not.toHaveBeenCalled()

    const trash = kv.store.get(KV.trash) as Array<{ id: string; imageIds: string[]; historyEntries: unknown[] }>
    expect(trash).toHaveLength(1)
    expect(trash[0].id).toBe('a1')
    expect(trash[0].imageIds).toEqual(['img-a'])
    expect(trash[0].historyEntries).toHaveLength(1)
  })

  it('softDelete 不存在的 id：deleted=false 且不写 trash', async () => {
    const { repo, kv } = makeRepo()
    const result = await repo.softDeleteArtwork('ghost')
    expect(result.deleted).toBe(false)
    expect(kv.store.has(KV.trash)).toBe(false)
  })

  it('restore：history 条目与项目引用增量补回、trash 清空', async () => {
    const { repo, kv } = makeRepo()
    await repo.softDeleteArtwork('a1')
    const result = await repo.restoreArtwork('a1')

    expect(result.restored).toBe(true)
    expect(historyIds(kv)).toContain('a1')
    const projects = kv.store.get(KV.projects) as Array<{ history_ids: string[] }>
    expect(projects[0].history_ids).toEqual(['a1'])
    expect(kv.store.get(KV.trash)).toEqual([])
  })

  it('restore 不在 trash 的 id：restored=false', async () => {
    const { repo } = makeRepo()
    const result = await repo.restoreArtwork('never-deleted')
    expect(result.restored).toBe(false)
  })

  it('同 id 重复软删：trash 只保留一条快照', async () => {
    const { repo, kv } = makeRepo()
    await repo.softDeleteArtwork('a1')
    await repo.restoreArtwork('a1')
    await repo.softDeleteArtwork('a1')
    const trash = kv.store.get(KV.trash) as unknown[]
    expect(trash).toHaveLength(1)
  })
})

describe('artworkRepository 惰性清理', () => {
  it('purge：只真删超期条目的独占图片，仍被引用的图片保留', async () => {
    const { repo, kv, images } = makeRepo()
    await repo.softDeleteArtwork('a1')
    await repo.softDeleteArtwork('b2')
    const day = 24 * 60 * 60 * 1000
    const trash = kv.store.get(KV.trash) as Array<{ id: string; deletedAt: number }>
    trash.find(t => t.id === 'a1')!.deletedAt = Date.now() - (ARTWORK_TRASH_RETENTION_DAYS + 1) * day

    // img-b 被人为加回 history（防御性兜底路径：条目超期也不删活图）
    ;(kv.store.get(KV.history) as unknown[]).push({ id: 'b2', image_id: 'img-b' })

    const result = await repo.purgeExpiredTrash()
    expect(result.purged).toBe(1)
    expect(images.store.has('img-a')).toBe(false)
    expect(images.store.has('img-b')).toBe(true)
    expect(kv.store.has(thumbKey('img-a'))).toBe(false)
    const rest = kv.store.get(KV.trash) as Array<{ id: string }>
    expect(rest.map(t => t.id)).toEqual(['b2'])
  })

  it('purge：trash 为空时返回 0 且不动图片', async () => {
    const { repo, images } = makeRepo()
    expect((await repo.purgeExpiredTrash()).purged).toBe(0)
    expect(images.adapter.deleteMany).not.toHaveBeenCalled()
  })
})

describe('artworkRepository 元数据补丁', () => {
  it('patchArtwork：就地更新标量字段（收藏/备注）', async () => {
    const { repo, kv } = makeRepo()
    const result = await repo.patchArtwork('b2', { favorite: true, notes: '神图' })
    expect(result.updated).toBe(true)
    const history = kv.store.get(KV.history) as Array<{ id: string; favorite: boolean; notes?: string }>
    expect(history.find(h => h.id === 'b2')).toMatchObject({ favorite: true, notes: '神图' })
  })

  it('patchArtwork：未知 id 返回 updated=false', async () => {
    const { repo } = makeRepo()
    expect((await repo.patchArtwork('ghost', { favorite: true })).updated).toBe(false)
  })
})

describe('artworkRepository 硬删与回滚', () => {
  it('deleteArtwork：history/图片/缩略图全部清除并返回清单', async () => {
    const { repo, kv, images } = makeRepo()
    kv.store.set(thumbKey('img-a'), { data: 'tiny' })
    const result = await repo.deleteArtwork('a1')

    expect(result.deleted).toBe(true)
    expect(result.removedImageIds).toEqual(['img-a'])
    expect(images.store.has('img-a')).toBe(false)
    expect(kv.store.has(thumbKey('img-a'))).toBe(false)
    expect(historyIds(kv)).toEqual(['b2'])
  })

  it('deleteArtwork：图片删除失败时补偿回滚 history 与项目引用', async () => {
    const { repo, kv, images } = makeRepo()
    const historySnapshot = kv.store.get(KV.history)
    const projectsSnapshot = kv.store.get(KV.projects)
    images.adapter.deleteMany.mockRejectedValueOnce(new Error('IDB 炸了'))

    await expect(repo.deleteArtwork('a1')).rejects.toBeInstanceOf(ArtworkDeletionError)
    // history 与项目引用回到删除前快照
    expect(kv.store.get(KV.history)).toEqual(historySnapshot)
    expect(kv.store.get(KV.projects)).toEqual(projectsSnapshot)
  })

  it('无效 id：直接抛错', async () => {
    const { repo } = makeRepo()
    await expect(repo.deleteArtwork('  ')).rejects.toThrow('作品 ID 无效')
  })
})

describe('artworkRepository 写串行化', () => {
  it('并发两个软删按序执行，两个条目都入 trash', async () => {
    const { repo, kv } = makeRepo()
    await Promise.all([repo.softDeleteArtwork('a1'), repo.softDeleteArtwork('b2')])
    const trash = kv.store.get(KV.trash) as Array<{ id: string }>
    expect(trash.map(t => t.id).sort()).toEqual(['a1', 'b2'])
    expect(historyIds(kv)).toEqual([])
  })
})
