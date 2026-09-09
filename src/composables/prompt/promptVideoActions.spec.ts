import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createPromptVideoActions } from './promptVideoActions'
import type { PromptVideoBridgeDeps } from './usePromptVideoBridge'

vi.mock('@/utils/videoPromptProse', () => ({ tagsToVideoProse: (text: string) => text }))
describe('deferred video transfer', () => {
  it('uses the displayed result snapshot instead of later character and outfit edits', async () => {
    const flash = vi.fn()
    const deps = {
      displayResultUrl: ref('/finished.png'), drawEngine: ref('anima'), livePrompt: ref('edited prompt'),
      sdResultPrompt: ref(''), animaState: ref({ result: { blob: new Blob(['image']), metadata: { prompt: 'rendered prompt' } } }),
      story: () => 'edited story', sceneId: () => 'edited scene',
      subject: () => ({ kind: 'popular', characterId: 'other', outfitId: 'other outfit' }),
      resultContext: () => ({ characterId: 'original', outfitId: 'original outfit', story: 'original story', sceneId: 'original scene', blueprintId: 'original blueprint' }),
      flash,
    } as unknown as PromptVideoBridgeDeps
    const result = await createPromptVideoActions(deps, ref(0)).videoTargetData()
    expect(result).toMatchObject({
      prompt: 'rendered prompt', characterId: 'original', outfitId: 'original outfit',
      story: 'original story', sceneId: 'original scene', blueprintId: 'original blueprint',
    })
    expect(flash).not.toHaveBeenCalled()
  })
})
