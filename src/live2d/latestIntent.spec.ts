import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLatestIntent } from './latestIntent'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('bounded native animation intent delivery', () => {
  it('sends a constant idle value once across many animation frames', async () => {
    vi.useFakeTimers()
    const send = vi.fn(async (_value: number) => {})
    const channel = createLatestIntent(send, Object.is, 50)
    for (let i = 0; i < 120; i++) {
      channel.push(0)
      await vi.advanceTimersByTimeAsync(16)
    }
    expect(send).toHaveBeenCalledExactlyOnceWith(0)
    channel.dispose()
  })

  it('a busy bridge sends only the newest sample and preserves terminal mouth zero', async () => {
    vi.useFakeTimers()
    const completions: (() => void)[] = []
    const send = vi.fn((_value: number) => new Promise<void>(resolve => completions.push(resolve)))
    const channel = createLatestIntent(send, Object.is, 16)
    channel.push(0.3)
    channel.push(0.5)
    channel.push(0.9)
    channel.push(0, true)
    expect(send).toHaveBeenCalledOnce()
    completions.shift()!()
    await vi.advanceTimersByTimeAsync(0)
    expect(send.mock.calls).toEqual([[0.3], [0]])
    completions.shift()!()
    channel.dispose()
  })

  it('throttles changing samples but sends a new emotion immediately', async () => {
    vi.useFakeTimers()
    const send = vi.fn(async (_value: number) => {})
    const channel = createLatestIntent(send, Object.is, 50)
    channel.push(0.1)
    await vi.advanceTimersByTimeAsync(1)
    channel.push(0.2)
    channel.push(0.3)
    expect(send).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(49)
    expect(send.mock.calls).toEqual([[0.1], [0.3]])
    channel.push(1, true)
    expect(send).toHaveBeenLastCalledWith(1)
    channel.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('permits a later retry after rejection without an automatic retry loop', async () => {
    vi.useFakeTimers()
    const send = vi.fn(async (_value: number) => {}).mockRejectedValueOnce(new Error('bridge unavailable'))
    const channel = createLatestIntent(send, Object.is, 50)
    channel.push(0.4)
    await vi.advanceTimersByTimeAsync(200)
    expect(send).toHaveBeenCalledOnce()
    channel.push(0.4)
    expect(send).toHaveBeenCalledTimes(2)
    channel.dispose()
  })

  it('does not send stale samples after pause or disposal, including a late bridge reply', async () => {
    vi.useFakeTimers()
    let done!: () => void
    const send = vi.fn((_value: number) => new Promise<void>(resolve => { done = resolve }))
    const channel = createLatestIntent(send, Object.is, 50)
    channel.push(0.2)
    channel.push(0.8)
    channel.clear()
    done()
    await vi.advanceTimersByTimeAsync(100)
    expect(send).toHaveBeenCalledOnce()
    channel.push(0.2)
    channel.push(0.9)
    channel.dispose()
    done()
    await vi.advanceTimersByTimeAsync(100)
    channel.push(1)
    expect(send).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})
