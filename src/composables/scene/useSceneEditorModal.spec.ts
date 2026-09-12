import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { SceneDraft, CurationData } from '@/types/api'
import { useSceneEditorModal } from './useSceneEditorModal'
vi.mock('@/composables/useConfirm', () => ({ confirmAction: vi.fn(async () => true) }))
vi.mock('@/composables/useCopyFeedback', () => ({ copyWithFeedback: vi.fn() }))

function setup(nextSceneId = vi.fn(async (): Promise<string | null> => 'sc002')) {
  const scenes = ref([{ id: 'sc001', title: 'original', story: 'story' }] as SceneDraft[])
  const editor = useSceneEditorModal({ scenes, curation: ref<CurationData>({}), markDirty: vi.fn(), nextSceneId })
  return { scenes, editor }
}

describe('scene draft ID allocation', () => {
  it('keeps consecutive and concurrent duplicates unique before saving to the server', async () => {
    const { scenes, editor } = setup()
    await Promise.all([editor.duplicateScene('sc001'), editor.duplicateScene('sc001')])
    await editor.duplicateScene('sc001')
    expect(scenes.value.map(scene => scene.id)).toEqual(['sc001', 'sc002', 'sc003', 'sc004'])
  })
  it('does not reuse a draft ID when adding again before project save', async () => {
    const { editor } = setup()
    await editor.openAddModal()
    editor.editing.value!.title = 'new'
    editor.editing.value!.story = 'story'
    editor.saveScene()
    await editor.openAddModal()
    expect(editor.editing.value!.id).toBe('sc003')
  })
  it('does not invent an ID when state is unavailable or capacity is exhausted', async () => {
    const unavailable = setup(vi.fn(async () => { throw new Error('offline') }))
    await unavailable.editor.duplicateScene('sc001')
    expect(unavailable.scenes.value).toHaveLength(1)
    const exhausted = setup(vi.fn(async () => null))
    await exhausted.editor.openAddModal()
    expect(exhausted.editor.editing.value).toBeNull()
  })
})
