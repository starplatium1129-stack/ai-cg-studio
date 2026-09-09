import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBackup } from './useBackup'
import { imgList, imgDeleteMany } from './useImageStore'
import { kvGet } from './useKVStore'
import { ARTWORK_TRASH_KV_KEY, ARTWORK_PROJECTS_KV_KEY, VIDEO_DRAFT_KEY } from '@/utils/storageKeys'
vi.mock('./useImageStore', () => ({ imgList: vi.fn(), imgGet: vi.fn(), imgDeleteMany: vi.fn(), imgPutRecord: vi.fn() }))
vi.mock('./useKVStore', () => ({ kvGet: vi.fn(), kvSetMany: vi.fn() }))
vi.mock('@/storage/backupRestore', () => ({ restoreBackupData: vi.fn() }))
const contents = JSON.stringify({ history: [{ id: 'one' }] })
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); vi.mocked(kvGet).mockResolvedValue([]) })
afterEach(() => vi.unstubAllGlobals())
describe('backup selection and cleanup', () => {
  it('does not restore a previous backup after selecting an oversized file', async () => {
    const tool = useBackup()
    await tool.loadFile(new File([contents], 'valid.json'))
    expect(tool.pending.value).not.toBeNull()
    await tool.loadFile({ size: 513 * 1024 * 1024 } as File)
    expect(tool.pending.value).toBeNull()
    expect(tool.pendingName.value).toBe('')
  })
  it('ignores an old file read that completes after a newer selection', async () => {
    let resolve!: (value: string) => void
    const tool = useBackup()
    const pending = tool.loadFile({ name: 'old.json', size: 1, text: () => new Promise(done => { resolve = done }) } as File)
    await tool.loadFile(new File([contents], 'new.json'))
    resolve(contents); await pending
    expect(tool.pendingName.value).toBe('new.json')
  })
  it('protects project, trash and video-draft images during cleanup', async () => {
    vi.mocked(kvGet).mockImplementation(async key => key === ARTWORK_TRASH_KV_KEY ? [{ imageIds: ['trash'] }] : key === ARTWORK_PROJECTS_KV_KEY ? [{ imageId: 'project' }] : [])
    vi.mocked(imgList).mockResolvedValue(['trash', 'project', 'video', 'orphan'].map(id => ({ id })) as Awaited<ReturnType<typeof imgList>>)
    sessionStorage.setItem(VIDEO_DRAFT_KEY, JSON.stringify({ videoImageId: 'video' }))
    vi.stubGlobal('confirm', () => true)
    const tool = useBackup()
    expect(await tool.cleanOrphanImages()).toBe(1)
    expect(imgDeleteMany).toHaveBeenCalledWith(['orphan'])
    expect(tool.busy.value).toBe(false)
  })
  it('stops cleanup when a draft cannot be read', async () => {
    vi.mocked(imgList).mockResolvedValue([{ id: 'protected' }] as Awaited<ReturnType<typeof imgList>>)
    sessionStorage.setItem(VIDEO_DRAFT_KEY, '{invalid')
    const flash = vi.fn(), tool = useBackup(flash)
    expect(await tool.cleanOrphanImages()).toBe(0)
    expect(imgDeleteMany).not.toHaveBeenCalled()
    expect(flash).toHaveBeenCalledWith(expect.stringContaining('停止清理'))
  })
})
