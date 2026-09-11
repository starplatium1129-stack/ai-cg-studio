import { computed, effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTempResult, type TempResultDeps } from './useTempResult'
import { clearTempResult } from '@/utils/tempResult'

vi.mock('@/composables/useImageStore', () => ({ imgDelete: vi.fn().mockResolvedValue(undefined), imgGet: vi.fn(), imgPut: vi.fn() }))
vi.mock('@/utils/tempResult', () => ({ clearTempResult: vi.fn(), readTempResult: vi.fn(() => null), writeTempResult: vi.fn(() => true) }))
const scopes: ReturnType<typeof effectScope>[] = []
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { resolve, promise }
}
function setup() {
  const url = ref('blob:original')
  const seed = ref(41)
  const submittedPrompt = ref('original submitted prompt')
  const context = ref({ char: 'nene', story: 'original story', sceneId: 'sc001' })
  const commit = vi.fn().mockResolvedValue({ id: 101 })
  const flash = vi.fn()
  const scope = effectScope(); scopes.push(scope)
  const tools = scope.run(() => useTempResult({
    pb: { commitHistoryEntry: commit, flash }, sd: { resultPrompt: submittedPrompt },
    drawEngine: ref('sd'), displayResultUrl: computed(() => url.value), displayResultSeed: computed(() => seed.value),
    livePrompt: computed(() => 'edited prompt'), negativePrompt: computed(() => 'negative'),
    resultContext: context, animaState: ref({}), historyGenerationFields: () => ({ sdSteps: seed.value }),
  } as unknown as TempResultDeps))!
  return { tools, url, seed, submittedPrompt, context, commit, flash }
}
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('manual archive ownership', () => {
  it('freezes metadata before reading an image and does not mark a replacement as archived', async () => {
    const image = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => image.promise))
    const { tools, url, seed, submittedPrompt, context, commit } = setup()
    const first = tools.saveCurrentResult()
    expect(tools.savingResult.value).toBe(true)
    await tools.saveCurrentResult()
    expect(fetch).toHaveBeenCalledTimes(1)
    url.value = 'blob:replacement'; seed.value = 99
    submittedPrompt.value = 'replacement prompt'; context.value.story = 'replacement story'
    image.resolve(new Response(new Blob(['pixels'], { type: 'image/png' }), { headers: { 'content-type': 'image/png' } }))
    await first
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit.mock.calls[0][0]).toMatchObject({ seed: 41, prompt: 'original submitted prompt', story: 'original story', context: { story: 'original story' } })
    expect(tools.resultArchived.value).toBe(false)
    expect(clearTempResult).not.toHaveBeenCalled()
    expect(tools.savingResult.value).toBe(false)
  })
  it('permits retry after storage failure and prevents duplicate saves after success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['pixels'], { type: 'image/png' }), { headers: { 'content-type': 'image/png' } })))
    const { tools, commit, flash } = setup()
    commit.mockResolvedValueOnce(null)
    await tools.saveCurrentResult()
    expect(tools.resultArchived.value).toBe(false)
    expect(tools.savingResult.value).toBe(false)
    expect(clearTempResult).not.toHaveBeenCalled()
    expect(flash).toHaveBeenLastCalledWith(expect.stringContaining('重试'))
    await tools.saveCurrentResult()
    expect(tools.resultArchived.value).toBe(true)
    expect(clearTempResult).toHaveBeenCalledTimes(1)
    await tools.saveCurrentResult()
    expect(commit).toHaveBeenCalledTimes(2)
  })
})
