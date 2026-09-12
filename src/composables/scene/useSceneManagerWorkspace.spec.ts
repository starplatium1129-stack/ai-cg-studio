import { defineComponent, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSceneManagerWorkspace } from './useSceneManagerWorkspace'

const mock = vi.hoisted(() => ({
  getState: vi.fn(), load: vi.fn(), reload: vi.fn(), confirm: vi.fn(),
  maintenanceDeps: null as unknown as { baseVersion: () => number | null },
}))
vi.mock('@/api/maintenanceApi', () => ({ maintenanceApi: { getScenesState: mock.getState } }))
vi.mock('@/stores/sceneStore', () => ({ useSceneStore: () => ({
  load: mock.load, reload: mock.reload, popularCharacters: [], sceneBlueprints: [],
  scenes: [{ id: 'sc001', title: 'stale cache' }], tags: [], curation: {},
}) }))
vi.mock('@/composables/useConfirm', () => ({ confirmAction: mock.confirm }))
vi.mock('@/composables/useFocusTrap', () => ({ useFocusTrap: vi.fn() }))
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }))
vi.mock('./useSceneTagManager', () => ({ useSceneTagManager: () => ({}) }))
vi.mock('./useSceneImportExport', () => ({ useSceneImportExport: () => ({}) }))
vi.mock('./useSceneShowcaseUpload', () => ({ useSceneShowcaseUpload: () => ({ loadHomeHeroes: vi.fn() }) }))
vi.mock('./useSceneMaintenance', () => ({ useSceneMaintenance: (deps: typeof mock.maintenanceDeps) => {
  mock.maintenanceDeps = deps
  return { saving: ref(false), desktopPackaged: ref(false) }
} }))
let wrapper: ReturnType<typeof mount> | undefined
afterEach(() => { wrapper?.unmount(); vi.clearAllMocks() })
function setup() {
  let workspace!: ReturnType<typeof useSceneManagerWorkspace>
  wrapper = mount(defineComponent({ setup() { workspace = useSceneManagerWorkspace(); return () => null } }))
  return workspace
}
describe('scene editor snapshot loading', () => {
  it('loads content and its baseline from one response instead of pairing cached data with a new version', async () => {
    mock.getState.mockResolvedValue({ version: 7, snapshot: {
      scenes: [{ id: 'sc002', title: 'current' }], tags: [], curation: {}, blueprints: [],
    } })
    const workspace = setup()
    await flushPromises()
    expect(workspace.scenes.value[0].title).toBe('current')
    expect(mock.maintenanceDeps.baseVersion()).toBe(7)
    expect(mock.load).not.toHaveBeenCalled()
    expect(mock.reload).toHaveBeenCalledTimes(1)
    workspace.dirty.value = true
    mock.confirm.mockResolvedValue(false)
    await workspace.loadFromStore(true)
    expect(mock.getState).toHaveBeenCalledTimes(1)
    expect(workspace.dirty.value).toBe(true)
  })
  it('does not turn a failed state request into a writable cached baseline', async () => {
    mock.getState.mockRejectedValue(new Error('offline'))
    const workspace = setup()
    await flushPromises()
    expect(mock.maintenanceDeps.baseVersion()).toBeNull()
    expect(workspace.loadError.value).toBe('offline')
    expect(mock.load).not.toHaveBeenCalled()
  })
})
