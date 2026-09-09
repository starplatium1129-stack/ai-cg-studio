import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useShotAiTools } from './useShotAiTools'
import type { ShotDraft } from './shotListTypes'
import * as api from '@/api/videoApi'
vi.mock('@/api/videoApi', () => ({ fetchVideoAiStatus: vi.fn(), rewriteVideoShot: vi.fn(), polishVideoShots: vi.fn(), generateVideoScript: vi.fn(), suggestDialogue: vi.fn(), reviewVideoShots: vi.fn() }))
const shot = (): ShotDraft => ({ prompt: 'Original scene', dialogue: 'Original dialogue', camera: 'still', motion: 'subtle', shotSize: 'wide', duration: 3, seedText: '', imageUrl: 'blob:original', imageName: 'frame.png', imageId: 'frame', cast: '' })
function setup() {
  const shots = ref([shot(), shot()])
  return { shots, tools: useShotAiTools({ shots, identityCard: ref(''), batchActive: computed(() => false), referenceCards: ref([]) }) }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.fetchVideoAiStatus).mockResolvedValue({ available: true, label: 'test' } as Awaited<ReturnType<typeof api.fetchVideoAiStatus>>)
  vi.mocked(api.rewriteVideoShot).mockResolvedValue({ shot: { prompt: 'Rewritten', camera: 'push', motion: 'natural', dialogue: 'New' } } as Awaited<ReturnType<typeof api.rewriteVideoShot>>)
})
describe('shot AI editing integrity', () => {
  it('writes prompt suggestions to the prompt, without replacing dialogue', async () => {
    vi.mocked(api.reviewVideoShots).mockResolvedValue({ ok: true, source: 'api', model: 'test', issues: [{ index: 0, field: 'prompt', severity: 'warn', message: 'test', suggestion: 'Better scene description' }] } as Awaited<ReturnType<typeof api.reviewVideoShots>>)
    const { shots, tools } = setup()
    await tools.runAiReview()
    tools.applyReviewSuggestion(tools.reviewIssues.value[0])
    expect(shots.value[0].prompt).toBe('Better scene description')
    expect(shots.value[0].dialogue).toBe('Original dialogue')
  })
  it('undoes text edits without revoking or replacing the current frame image', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { shots, tools } = setup()
    await tools.runAiRewrite()
    shots.value[0].imageUrl = 'blob:new-user-frame'
    shots.value[0].imageId = 'new-frame'
    tools.restoreAiSnapshot()
    expect(shots.value[0]).toMatchObject({ prompt: 'Original scene', imageUrl: 'blob:new-user-frame', imageId: 'new-frame' })
    expect(revoke).not.toHaveBeenCalled()
  })
  it('prevents duplicate rewrites while AI availability is being checked', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof api.fetchVideoAiStatus>>) => void
    vi.mocked(api.fetchVideoAiStatus).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const { tools } = setup()
    const pending = tools.runAiRewrite()
    await tools.runAiRewrite()
    expect(api.fetchVideoAiStatus).toHaveBeenCalledTimes(1)
    resolve({ available: false, reason: 'offline' } as Awaited<ReturnType<typeof api.fetchVideoAiStatus>>)
    await pending
    expect(tools.aiBusy.value).toBe(false)
  })
  it('keeps edits made while a rewrite response was pending', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof api.rewriteVideoShot>>) => void
    vi.mocked(api.rewriteVideoShot).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const { tools, shots } = setup()
    const pending = tools.runAiRewrite()
    await vi.waitFor(() => expect(api.rewriteVideoShot).toHaveBeenCalled())
    shots.value[0].prompt = 'User edited while waiting'
    resolve({ shot: { prompt: 'Late response' } } as Awaited<ReturnType<typeof api.rewriteVideoShot>>)
    await pending
    expect(shots.value[0].prompt).toBe('User edited while waiting')
  })
  it('does not apply old review suggestions to a reordered shot', async () => {
    vi.mocked(api.reviewVideoShots).mockResolvedValue({ ok: true, source: 'api', model: 'test', issues: [{ index: 0, field: 'prompt', severity: 'warn', message: 'test', suggestion: 'Old suggestion' }] } as Awaited<ReturnType<typeof api.reviewVideoShots>>)
    const { tools, shots } = setup()
    await tools.runAiReview()
    shots.value.reverse()
    tools.applyReviewSuggestion(tools.reviewIssues.value[0])
    expect(shots.value[0].prompt).toBe('Original scene')
  })
})
