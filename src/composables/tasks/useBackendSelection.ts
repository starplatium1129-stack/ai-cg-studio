import { onScopeDispose, watch } from 'vue'

/** Follow a backend identity through cached-page navigation without accepting stale replies. */
export function useBackendSelection<T>(
  selectedId: () => string,
  currentId: () => string | undefined,
  fetch: (id: string, signal: AbortSignal) => Promise<T>,
  apply: (value: T) => void,
  failed: (error: unknown) => void,
) {
  let request: AbortController | undefined
  watch(selectedId, async id => {
    request?.abort()
    if (!id || id === currentId()) return
    const next = new AbortController()
    request = next
    try {
      const value = await fetch(id, next.signal)
      if (!next.signal.aborted && selectedId() === id) apply(value)
    } catch (error) {
      if (!next.signal.aborted && selectedId() === id) failed(error)
    }
  }, { immediate: true })
  onScopeDispose(() => request?.abort())
}
