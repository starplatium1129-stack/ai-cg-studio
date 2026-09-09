import { ref, defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSceneMaintenance } from './useSceneMaintenance'
import { maintenanceApi } from '@/api/maintenanceApi'
vi.mock('@/api/maintenanceApi', () => ({ maintenanceApi: { saveScenes: vi.fn(), run: vi.fn() } }))
let wrapper: ReturnType<typeof mount> | undefined
afterEach(() => { wrapper?.unmount(); vi.clearAllMocks(); vi.useRealTimers() })
function setup() {
  const deps = { scenes: ref([{ id: 'test', title: 'original' }]), tags: ref([]), curation: ref({}), blueprints: ref([]), dirty: ref(true), maintenanceHint: ref(''), invalidateSceneCache: vi.fn() }
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
    resolve({ count: 1, backup: 'test' } as Awaited<ReturnType<typeof maintenanceApi.saveScenes>>)
    await pending
    expect(deps.dirty.value).toBe(true)
    expect(deps.maintenanceHint.value).toContain('再次保存')
    expect(vi.mocked(maintenanceApi.saveScenes).mock.calls[0][0].scenes[0].title).toBe('original')
  })
  it('prevents maintenance tools from writing while a save is in flight', async () => {
    vi.useFakeTimers()
    let resolve!: (value: Awaited<ReturnType<typeof maintenanceApi.saveScenes>>) => void
    vi.mocked(maintenanceApi.saveScenes).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const { tools, deps } = setup()
    const pending = tools.saveToProject()
    await tools.runTool('classify')
    expect(maintenanceApi.run).not.toHaveBeenCalled()
    resolve({ count: 1, backup: 'test' } as Awaited<ReturnType<typeof maintenanceApi.saveScenes>>)
    await pending
    expect(deps.dirty.value).toBe(false)
  })
})
