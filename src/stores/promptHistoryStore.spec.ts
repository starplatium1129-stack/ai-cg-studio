import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePromptHistoryStore } from './promptHistoryStore'
import { kvGet } from '@/composables/useKVStore'
import { artworkRepository } from '@/storage/artworkRepository'
import { ARTWORK_HISTORY_KV_KEY, ARTWORK_PROJECTS_KV_KEY } from '@/utils/storageKeys'

vi.mock('@/composables/useKVStore', () => ({ kvGet: vi.fn(), kvSet: vi.fn() }))
vi.mock('@/storage/artworkRepository', () => ({
  artworkRepository: { softDeleteArtwork: vi.fn(), restoreArtwork: vi.fn() },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(kvGet).mockResolvedValue(null)
})

describe('promptHistoryStore 持久化同步', () => {
  it('存储已清空时清除旧列表，并忽略损坏的历史条目', async () => {
    const store = usePromptHistoryStore()
    store.history = [{ id: 1 }]
    await store.loadHistory()
    expect(store.history).toEqual([])
    vi.mocked(kvGet).mockImplementation(async key => key === ARTWORK_HISTORY_KV_KEY ? [null, {}, { id: 2 }] : null)
    await store.loadHistory()
    expect(store.history).toEqual([{ id: 2 }])
  })

  it('已保存的空项目列表不会复活旧键中的项目', async () => {
    const store = usePromptHistoryStore()
    vi.mocked(kvGet).mockImplementation(async key => key === ARTWORK_PROJECTS_KV_KEY ? [] : [{ id: 'legacy', name: '旧项目' }])
    await store.loadProjects()
    expect(store.projects).toEqual([])
    expect(kvGet).not.toHaveBeenCalledWith('aics_projects')
  })

  it('仅在新项目键缺失时兼容旧键', async () => {
    const store = usePromptHistoryStore()
    vi.mocked(kvGet).mockImplementation(async key => key === 'aics_projects' ? [{ id: 'legacy', name: '旧项目' }] : null)
    await store.loadProjects()
    expect(store.projects).toEqual([{ id: 'legacy', name: '旧项目' }])
  })

  it('删除失败保留内存条目，成功时兼容旧数据中的字符串 id', async () => {
    const store = usePromptHistoryStore()
    store.history = [{ id: '12' }, { id: 13 }]
    vi.mocked(artworkRepository.softDeleteArtwork).mockRejectedValueOnce(new Error('quota'))
    await expect(store.removeHistoryEntry(12)).rejects.toThrow('quota')
    expect(store.history).toHaveLength(2)
    vi.mocked(artworkRepository.softDeleteArtwork).mockResolvedValueOnce({ deleted: true })
    await store.removeHistoryEntry(12)
    expect(store.history).toEqual([{ id: 13 }])
  })

  it('删除完成后，较早发起的读取不能把条目加回界面', async () => {
    const store = usePromptHistoryStore()
    let resolveRead!: (value: unknown) => void
    vi.mocked(kvGet).mockImplementationOnce(() => new Promise(resolve => { resolveRead = resolve }))
    store.history = [{ id: 1 }, { id: 2 }]
    const loading = store.loadHistory()
    vi.mocked(artworkRepository.softDeleteArtwork).mockResolvedValueOnce({ deleted: true })
    await store.removeHistoryEntry(1)
    resolveRead([{ id: 1 }, { id: 2 }])
    await loading
    expect(store.history).toEqual([{ id: 2 }])
  })

  it('恢复成功后重新载入历史与项目，恢复失败不改变当前视图', async () => {
    const store = usePromptHistoryStore()
    vi.mocked(artworkRepository.restoreArtwork).mockResolvedValueOnce({ restored: false })
    expect(await store.restoreHistoryEntry(1)).toBe(false)
    expect(kvGet).not.toHaveBeenCalled()
    vi.mocked(artworkRepository.restoreArtwork).mockResolvedValueOnce({ restored: true })
    vi.mocked(kvGet).mockImplementation(async key => key === ARTWORK_HISTORY_KV_KEY ? [{ id: 1 }] : [{ id: 'p1', name: '项目' }])
    expect(await store.restoreHistoryEntry(1)).toBe(true)
    expect(store.history).toEqual([{ id: 1 }])
    expect(store.projects).toEqual([{ id: 'p1', name: '项目' }])
    expect(kvGet).toHaveBeenCalledTimes(2)
  })

  it('时钟回调和单毫秒高并发不会产生重复作品编号', () => {
    const store = usePromptHistoryStore()
    const now = Date.now()
    const ids = Array.from({ length: 1001 }, () => store.historyIdSeq(now))
    ids.push(store.historyIdSeq(now + 1), store.historyIdSeq(now))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id, index) => !index || id > ids[index - 1])).toBe(true)
  })
})
