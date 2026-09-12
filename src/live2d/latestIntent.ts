/** One in-flight call and one latest value; obsolete animation samples never queue up. */
export function createLatestIntent<T>(
  send: (value: T) => Promise<unknown>,
  equals: (a: T, b: T) => boolean,
  intervalMs: number,
) {
  let pending: { value: T; urgent: boolean } | null = null
  let sent: { value: T } | null = null
  let inFlight = false
  let disposed = false
  let lastStart = -Infinity
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0

  function drain() {
    if (disposed || inFlight || !pending) return
    clearTimeout(timer)
    timer = undefined
    if (sent && equals(sent.value, pending.value)) { pending = null; return }
    const wait = pending.urgent ? 0 : Math.max(0, intervalMs - (performance.now() - lastStart))
    if (wait > 0) { timer = setTimeout(drain, wait); return }
    const current = pending
    const token = generation
    pending = null
    inFlight = true
    lastStart = performance.now()
    void (async () => {
      try {
        await send(current.value)
        if (token === generation) sent = { value: current.value }
      } catch {
        // The next sample may retry; never spin on a broken bridge.
        if (token === generation) sent = null
      } finally {
        inFlight = false
        drain()
      }
    })()
  }

  function clear() {
    generation += 1
    pending = null
    sent = null
    clearTimeout(timer)
    timer = undefined
  }

  return {
    push(value: T, urgent = false) {
      if (disposed) return
      pending = { value, urgent }
      drain()
    },
    clear,
    dispose() { disposed = true; clear() },
  }
}
