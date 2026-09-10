import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVoiceApi, VOICE_API_TIMEOUTS, type VoiceSynthesisPayload } from './voiceApi'
import type { FetchImplementation } from './client'

const payload: VoiceSynthesisPayload = {
  voice: 'nene', text: '你好', language: 'zh', emotion: 'neutral',
  referenceEmotion: 'neutral', consistency: 'locked', speed: 1,
}

afterEach(() => vi.useRealTimers())

describe('voiceApi 二进制合成', () => {
  it('发送完整声线设置并保留音频与排队时长', async () => {
    const fetchAudio = vi.fn<FetchImplementation>().mockResolvedValue(new Response('RIFFaudio', {
      headers: { 'Content-Type': 'audio/wav', 'X-Voice-Queue-Wait': '1350' },
    }))
    const result = await createVoiceApi(undefined, fetchAudio).synthesize(payload)
    const [url, init] = fetchAudio.mock.calls[0]
    expect(url).toBe('/api/tts')
    expect(JSON.parse(String(init?.body))).toEqual(payload)
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(result.blob.size).toBe(9)
    expect(result.queueWaitMs).toBe(1350)
  })

  it('拒绝空音频并保留服务端离线恢复提示', async () => {
    const fetchAudio = vi.fn<FetchImplementation>()
      .mockResolvedValueOnce(new Response(''))
      .mockResolvedValueOnce(Response.json({ error: 'tts failed', detail: 'connect ECONNREFUSED 127.0.0.1:9880' }, { status: 502 }))
    const api = createVoiceApi(undefined, fetchAudio)
    await expect(api.synthesize(payload)).rejects.toMatchObject({ kind: 'invalid-response' })
    await expect(api.synthesize(payload)).rejects.toMatchObject({
      kind: 'http', status: 502, message: expect.stringContaining('到控制面板点「启动语音」'),
    })
  })

  it('调用前已取消时不会发出合成请求', async () => {
    const fetchAudio = vi.fn<FetchImplementation>()
    const controller = new AbortController()
    controller.abort()
    await expect(createVoiceApi(undefined, fetchAudio).synthesize(payload, { signal: controller.signal })).rejects.toMatchObject({ kind: 'aborted' })
    expect(fetchAudio).not.toHaveBeenCalled()
  })

  for (const cause of ['caller', 'timeout'] as const) {
    it(`${cause} 会取消待返回的网络请求并清理定时器`, async () => {
      vi.useFakeTimers()
      const fetchAudio = vi.fn<FetchImplementation>((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      }))
      const controller = new AbortController()
      const pending = createVoiceApi(undefined, fetchAudio).synthesize(payload, { signal: controller.signal })
      const assertion = expect(pending).rejects.toMatchObject({ kind: cause === 'caller' ? 'aborted' : 'timeout' })
      if (cause === 'caller') controller.abort()
      else await vi.advanceTimersByTimeAsync(VOICE_API_TIMEOUTS.synthesize)
      await assertion
      expect(fetchAudio.mock.calls[0][1]?.signal?.aborted).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    })
  }
})
