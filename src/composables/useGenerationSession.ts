// @ts-nocheck
import { ref, type Ref } from 'vue'

/**
 * 统一生成会话抽象（P1 重构）
 * 消除 `useSDGenerate` (700ms interval) 与 `useAnimaSession` (1s timeout loop) 的双写轮询。
 * 子类只需提供三钩子：`buildRequest` / `fetchJob` / `mapResult`，其余 `refreshBackend/poll/cancel/dispose`
 * 由基类统一实现，超时/取消/重试语义一致。
 */

export interface GenerationSessionOptions<Req, Job, Result> {
  buildRequest: () => Req | null
  fetchJob: (req: Req, signal?: AbortSignal) => Promise<Job>
  mapResult: (job: Job) => Result | null
  pollInterval?: number
  timeoutMs?: number
}

export function useGenerationSession<Req, Job, Result>(options: GenerationSessionOptions<Req, Job, Result>) {
  const busy = ref(false)
  const progress: Ref<number | null> = ref(null)
  const error: Ref<string | null> = ref(null)
  const result: Ref<Result | null> = ref(null)

  let abort: AbortController | null = null
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const pollInterval = options.pollInterval ?? 700
  const timeoutMs = options.timeoutMs ?? 120_000

  async function refreshBackend() {
    // 子类可重写：探测后端在线状态
  }

  async function pollJob(job: Job) {
    if (disposed) return
    try {
      const mapped = options.mapResult(job)
      if (mapped) {
        result.value = mapped
        busy.value = false
        return
      }
    } catch (e) {
      error.value = String((e as Error)?.message ?? e)
      busy.value = false
      return
    }
    pollTimer = setTimeout(() => void pollJob(job), pollInterval)
  }

  async function generate(signal?: AbortSignal) {
    if (busy.value) return null
    const req = options.buildRequest()
    if (!req) return null
    busy.value = true
    error.value = null
    progress.value = 0
    result.value = null
    abort = new AbortController()
    const combinedSignal = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal
    const timeout = setTimeout(() => abort?.abort(), timeoutMs)
    try {
      const job = await options.fetchJob(req, combinedSignal)
      await pollJob(job)
      return job
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') error.value = '已取消'
      else error.value = String((e as Error)?.message ?? e)
      busy.value = false
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  function cancel() {
    abort?.abort()
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
    busy.value = false
  }

  function dispose() {
    disposed = true
    cancel()
  }

  return {
    busy,
    progress,
    error,
    result,
    refreshBackend,
    generate,
    cancel,
    dispose,
  }
}
