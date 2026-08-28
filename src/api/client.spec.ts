import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError, createApiClient, type FetchImplementation } from './client'

function okResponse(value: Record<string, unknown>): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function deferredFetch(handler: (url: string, init: RequestInit | undefined) => Promise<Response>): {
  fetch: FetchImplementation
  calls: string[]
  flush: () => Promise<void>
} {
  const calls: string[] = []
  const pending: Array<() => void> = []
  const fetch: FetchImplementation = (input, init) => {
    calls.push(String(input))
    return new Promise<Response>((resolve, reject) => {
      pending.push(() => {
        handler(String(input), init).then(resolve, reject)
      })
    })
  }
  return {
    fetch,
    calls,
    flush: async () => {
      while (pending.length) pending.shift()!()
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

describe('apiClient GET inflight 去重与 TTL 缓存', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('同 URL 并发 GET 只发一次底层请求，消费者各自拿到结果', async () => {
    const { fetch, calls, flush } = deferredFetch(async () => okResponse({ ok: true, value: 1 }))
    const client = createApiClient(fetch)

    const first = client.request('/api/shared')
    const second = client.request('/api/shared')
    const third = client.request('/api/shared')
    await flush()

    const [a, b, c] = await Promise.all([first, second, third])
    expect(calls).toEqual(['/api/shared'])
    expect(a).toEqual({ ok: true, value: 1 })
    expect(b).not.toBe(a)
    expect(c).not.toBe(a)
  })

  it('搭车者 abort 只取消自己，不影响共享请求与其他消费者', async () => {
    const { fetch, calls, flush } = deferredFetch(async () => okResponse({ ok: true }))
    const client = createApiClient(fetch)

    const initiator = client.request('/api/ride')
    const controller = new AbortController()
    const rider = client.request('/api/ride', { signal: controller.signal })
    controller.abort() // 共享请求尚未完成

    await expect(rider).rejects.toMatchObject({ kind: 'aborted' })
    await flush()
    await expect(initiator).resolves.toEqual({ ok: true })
    expect(calls).toEqual(['/api/ride'])
  })

  it('失败的共享请求从 inflight 移除，后续 GET 重新发起', async () => {
    let fail = true
    const fetch: FetchImplementation = async () => {
      if (fail) {
        return new Response(JSON.stringify({ ok: false, error: 'boom' }), { status: 500 })
      }
      return okResponse({ ok: true })
    }
    const client = createApiClient(fetch)

    await expect(client.request('/api/flaky')).rejects.toBeInstanceOf(ApiClientError)
    fail = false
    await expect(client.request('/api/flaky')).resolves.toEqual({ ok: true })
  })

  it('显式 cacheTtlMs 的 GET 在 TTL 内命中缓存，过期后重新请求', async () => {
    let counter = 0
    const fetch: FetchImplementation = async () => okResponse({ ok: true, n: ++counter })
    const client = createApiClient(fetch)

    await expect(client.request('/api/static', { cacheTtlMs: 30_000 })).resolves.toEqual({ ok: true, n: 1 })
    await expect(client.request('/api/static', { cacheTtlMs: 30_000 })).resolves.toEqual({ ok: true, n: 1 })

    vi.advanceTimersByTime(30_001)
    await expect(client.request('/api/static', { cacheTtlMs: 30_000 })).resolves.toEqual({ ok: true, n: 2 })
  })

  it('未声明 cacheTtlMs 的 GET 不缓存（任务态端点默认直连）', async () => {
    let counter = 0
    const fetch: FetchImplementation = async () => okResponse({ ok: true, n: ++counter })
    const client = createApiClient(fetch)

    await expect(client.request('/api/job-state')).resolves.toEqual({ ok: true, n: 1 })
    await expect(client.request('/api/job-state')).resolves.toEqual({ ok: true, n: 2 })
  })

  it('写请求成功后失效同 URL 的 GET 缓存', async () => {
    let configured = false
    const fetch: FetchImplementation = async (_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        configured = true
        return okResponse({ ok: true, configured: true })
      }
      return okResponse({ ok: true, configured })
    }
    const client = createApiClient(fetch)

    await expect(client.request('/api/config', { cacheTtlMs: 30_000 })).resolves.toEqual({ ok: true, configured: false })
    await expect(client.request('/api/config', { cacheTtlMs: 30_000 })).resolves.toEqual({ ok: true, configured: false })
    await expect(client.request('/api/config', { method: 'POST', body: { host: 'x' } })).resolves.toEqual({ ok: true, configured: true })
    await expect(client.request('/api/config', { cacheTtlMs: 30_000 })).resolves.toEqual({ ok: true, configured: true })
  })
})
