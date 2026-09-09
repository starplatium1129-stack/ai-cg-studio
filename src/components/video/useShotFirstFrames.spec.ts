import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useShotFirstFrames } from './useShotFirstFrames'
import type { ShotDraft } from './shotListTypes'
const mocks = vi.hoisted(() => ({ request: vi.fn(), upload: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: { request: mocks.request } }))
vi.mock('@/api/videoApi', () => ({ uploadVideoImage: mocks.upload }))
vi.mock('@/composables/useImageStore', () => ({ imgPut: vi.fn() }))
vi.mock('@/composables/useTaskCenter', () => ({ useTrackedTask: vi.fn() }))
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })
const shot = () => ({ firstFramePrompt: 'A quiet room', imageName: '', imageUrl: '' } as ShotDraft)
describe('first-frame batch cancellation', () => {
  it('cancels the owned backend job and never starts the next shot', async () => {
    mocks.request.mockImplementation(async (_path, options) => {
      if (options.method === 'POST') return { ok: true, job: { id: 'owned', status: 'running' } }
      if (options.method === 'DELETE') return { ok: true }
      return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason)))
    })
    const scope = effectScope()
    const tools = scope.run(() => useShotFirstFrames({ onError: vi.fn() }))!
    const pending = tools.generateFirstFrames([shot(), shot()], 'landscape')
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2))
    await tools.cancelFirstFrames()
    await pending
    expect(mocks.request.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1)
    expect(mocks.request).toHaveBeenCalledWith('/api/creative/jobs/owned', expect.objectContaining({ method: 'DELETE' }))
    expect(tools.firstFrameBusy.value).toBe(false)
    scope.stop()
  })
  it('rejects failed result downloads instead of uploading an error page as a frame', async () => {
    mocks.request.mockResolvedValue({ ok: true, job: { id: 'one', status: 'succeeded', resultUrl: '/missing.png' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', { status: 404 })))
    const scope = effectScope(), onError = vi.fn()
    const tools = scope.run(() => useShotFirstFrames({ onError }))!
    await tools.generateFirstFrames([shot()], 'landscape')
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('生成失败'))
    scope.stop()
  })
})
