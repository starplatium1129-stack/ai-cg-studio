import { describe, expect, it, vi } from 'vitest'
import { parseNdjsonResponse } from './stream'

describe('chat stream completion', () => {
  it('finishes at done without waiting for a server socket to close', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"type":"done"}\n'))
    }, cancel })
    await parseNdjsonResponse(new Response(body), vi.fn())
    expect(cancel).toHaveBeenCalledOnce()
    expect(body.locked).toBe(false)
  })
  it('releases the stream when a malformed event fails consumption', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('broken\n'))
    }, cancel })
    await expect(parseNdjsonResponse(new Response(body), vi.fn())).rejects.toThrow('无效数据')
    expect(cancel).toHaveBeenCalledOnce()
    expect(body.locked).toBe(false)
  })
})
