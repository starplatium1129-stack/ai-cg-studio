import { ref, defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSceneMaintenance } from './useSceneMaintenance'
import { ApiClientError } from '@/api/client'
import { maintenanceApi } from '@/api/maintenanceApi'
vi.mock('@/api/maintenanceApi', () => ({ maintenanceApi: { saveScenes: vi.fn(), run: vi.fn() } }))
let wrapper: ReturnType<typeof mount> | undefined
afterEach(() => { wrapper?.unmount(); vi.clearAllMocks(); vi.useRealTimers() })
function setup() {
  const deps = {
    scenes: ref([{ id: 'test', title: 'original' }]),
    tags: ref([]),
    curation: ref({}),
    blueprints: ref([]),
    dirty: ref(true),
    maintenanceHint: ref(''),
    /** 读取基线版本（计划 006 D5）：随保存提交，成功后采纳服务端回执版本 */
    baseVersion: vi.fn(() => 42),
    adoptSceneStateVersion: vi.fn(),
    invalidateSceneCache: vi.fn(),
  }
  let tools!: ReturnType<typeof useSceneMaintenance>
  wrapper = mount(defineComponent({ setup() {
    tools = useSceneMaintenance(deps as unknown as Parameters<typeof useSceneMaintenance>[0])
    return () => null
  } }))
  return { deps, tools }
}
describe('maintenance save snapshots', () => {
  it('preserves the dirty marker for edits made after saving started', async () => {
    vi.useFakeTimers()
    let resolve!: (value: Awaited<ReturnType<typeof maintenanceApi.saveScenes>>) => void
    vi.mocked(maintenanceApi.saveScenes).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const { deps, tools } = setup()
    const pending = tools.saveToProject()
    deps.scenes.value[0].title = 'new unsaved edit'
    resolve({ ok: true, count: 1, backup: 'test', version: 43, snapshot: { scenes: [{ id: 'test', title: 'normalized' }], tags: [], curation: {}, blueprints: [] } } as unknown as Awaited<ReturnType<typeof maintenanceApi.saveScenes>>)
    await pending
    expect(deps.dirty.value).toBe(true)
    expect(deps.maintenanceHint.value).toContain('合并')
    expect(deps.adoptSceneStateVersion).not.toHaveBeenCalled()
    expect(vi.mocked(maintenanceApi.saveScenes).mock.calls[0][0].scenes[0].title).toBe('original')
    expect(vi.mocked(maintenanceApi.saveScenes).mock.calls[0][0].baseVersion).toBe(42)
  })
  it('prevents maintenance tools from writing while a save is in flight', async () => {
    vi.useFakeTimers()
    let resolve!: (value: Awaited<ReturnType<typeof maintenanceApi.saveScenes>>) => void
    vi.mocked(maintenanceApi.saveScenes).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const { tools, deps } = setup()
    const pending = tools.saveToProject()
    await tools.runTool('classify')
    expect(maintenanceApi.run).not.toHaveBeenCalled()
    resolve({ ok: true, count: 1, backup: 'test', version: 43, snapshot: { scenes: [{ id: 'test', title: 'normalized' }], tags: [], curation: {}, blueprints: [] } } as unknown as Awaited<ReturnType<typeof maintenanceApi.saveScenes>>)
    await pending
    expect(deps.dirty.value).toBe(false)
  })
  it('sends the loaded baseline version and adopts the server receipt on success', async () => {
    vi.mocked(maintenanceApi.saveScenes).mockResolvedValueOnce({ ok: true, count: 1, backup: 'b1', version: 43, snapshot: { scenes: [{ id: 'test', title: 'normalized' }], tags: [], curation: {}, blueprints: [] } } as unknown as Awaited<ReturnType<typeof maintenanceApi.saveScenes>>)
    const { deps, tools } = setup()
    await tools.saveToProject()
    expect(vi.mocked(maintenanceApi.saveScenes).mock.calls[0][0].baseVersion).toBe(42)
    expect(deps.adoptSceneStateVersion).toHaveBeenCalledWith(43)
    expect(deps.scenes.value[0].title).toBe('normalized')
  })
  it('renders a 409 stale-snapshot conflict as an actionable hint without adopting a version', async () => {
    vi.mocked(maintenanceApi.saveScenes).mockRejectedValueOnce(new ApiClientError('场景库在本次编辑期间已被更新', {
      kind: 'http',
      status: 409,
      responseBody: {
        ok: false,
        error: '场景库在本次编辑期间已被更新',
        conflict: { baseVersion: 42, currentVersion: 99, changedIds: ['sc001'], serverOnlyIds: ['sc308'] },
      },
    } as never))
    const { deps, tools } = setup()
    await tools.saveToProject()
    expect(deps.maintenanceHint.value).toContain('保存已拒绝')
    expect(deps.maintenanceHint.value).toContain('重新读取')
    expect(deps.maintenanceHint.value).toContain('sc001')
    expect(deps.maintenanceHint.value).toContain('sc308')
    expect(deps.adoptSceneStateVersion).not.toHaveBeenCalled()
    expect(deps.invalidateSceneCache).not.toHaveBeenCalled()
  })
})
