import { describe, expect, it } from 'vitest'
import { createApiClient, type FetchImplementation } from './client'

function response(revision: number): Response {
  return new Response(JSON.stringify({ ok: true, revision }), { status: 200 })
}
function pendingClient() {
  const pending: Array<(value: Response) => void> = []
  const fetch: FetchImplementation = () => new Promise(resolve => pending.push(resolve))
  return { client: createApiClient(fetch), pending }
}
const cached = { cacheTtlMs: 30_000, timeoutMs: 1_000 }

describe('apiClient explicit refresh ordering', () => {
  it('a late ordinary GET cannot replace the result of a newer explicit refresh', async () => {
    const { client, pending } = pendingClient()
    const old = client.request('/config', cached)
    const fresh = client.request('/config', { ...cached, cachePolicy: 'refresh' })
    pending[1](response(2))
    await expect(fresh).resolves.toMatchObject({ revision: 2 })
    pending[0](response(1))
    await expect(old).resolves.toMatchObject({ revision: 1 })
    await expect(client.request('/config', cached)).resolves.toMatchObject({ revision: 2 })
    expect(pending).toHaveLength(2)
  })

  it('two overlapping refreshes keep the newest refresh generation in the cache', async () => {
    const { client, pending } = pendingClient()
    const first = client.request('/config', { ...cached, cachePolicy: 'refresh' })
    const second = client.request('/config', { ...cached, cachePolicy: 'refresh' })
    pending[1](response(2))
    await second
    pending[0](response(1))
    await first
    await expect(client.request('/config', cached)).resolves.toMatchObject({ revision: 2 })
    expect(pending).toHaveLength(2)
  })

  it('a successful refresh without a TTL invalidates an older cached response', async () => {
    const { client, pending } = pendingClient()
    const initial = client.request('/config', cached)
    pending[0](response(1))
    await initial
    const refresh = client.request('/config', { cachePolicy: 'refresh', timeoutMs: 1_000 })
    pending[1](response(2))
    await expect(refresh).resolves.toMatchObject({ revision: 2 })
    const next = client.request('/config', cached)
    if (pending[2]) pending[2](response(3))
    await expect(next).resolves.toMatchObject({ revision: 3 })
    expect(pending).toHaveLength(3)
  })

  it('a failed explicit refresh leaves the last successful cache entry usable', async () => {
    const { client, pending } = pendingClient()
    const initial = client.request('/config', cached)
    pending[0](response(1))
    await initial
    const refresh = client.request('/config', { ...cached, cachePolicy: 'refresh' })
    const rejected = expect(refresh).rejects.toMatchObject({ kind: 'http', status: 503 })
    pending[1](new Response(JSON.stringify({ error: 'temporarily unavailable' }), { status: 503 }))
    await rejected
    await expect(client.request('/config', cached)).resolves.toMatchObject({ revision: 1 })
    expect(pending).toHaveLength(2)
  })
})
