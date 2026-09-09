import { onScopeDispose, watch } from 'vue'

/** Follow a backend identity through cached-page navigation without accepting stale replies. */
export function useBackendSelection<T>(
  selectedId: () => string,
  currentId: () => string | undefined,
  fetch: (id: string, signal: AbortSignal) => Promise<T>,
  apply: (value: T) => void,
  failed: (error: unknown) => void,
) {
  let pending: { id: string; controller: AbortController; promise: Promise<void> } | undefined
  let disposed = false
  function load(force: boolean): Promise<void> {
    const id = selectedId()
    if (disposed) return Promise.resolve()
    if (id && pending?.id === id) return pending.promise
    pending?.controller.abort()
    pending = undefined
    if (!id || (!force && id === currentId())) return Promise.resolve()
    const controller = new AbortController()
    const promise = Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      try {
        const value = await fetch(id, controller.signal)
        if (!controller.signal.aborted && selectedId() === id) apply(value)
      } catch (error) {
        if (!controller.signal.aborted && selectedId() === id) failed(error)
      }
    }).finally(() => { if (pending?.controller === controller) pending = undefined })
    pending = { id, controller, promise }
    return promise
  }
  watch(selectedId, () => { void load(false) }, { immediate: true })
  onScopeDispose(() => { disposed = true; pending?.controller.abort() })
  return { retry: () => load(true) }
}
