import { getCurrentScope, onScopeDispose, type Ref } from 'vue'
import type { TrainingJob, TrainingJobId } from '@/types/training'

interface UseTrainingPollingOptions {
  mounted: Ref<boolean>
  activeJob: Ref<TrainingJob | null>
  selectedJobId: Ref<TrainingJobId>
  isActive: (job: TrainingJob) => boolean
  refresh: (silent?: boolean) => Promise<void>
  loadLogs: (id: TrainingJobId) => Promise<void>
  onJobProgress: (job: TrainingJob) => void
  intervalMs?: number
  setInterval?: (handler: () => void, timeout: number) => number
  clearInterval?: (id: number) => void
}

export function useTrainingPolling(options: UseTrainingPollingOptions) {
  const setTimer = options.setInterval ?? ((handler, timeout) => window.setInterval(handler, timeout))
  const clearTimer = options.clearInterval ?? ((id) => window.clearInterval(id))
  const intervalMs = options.intervalMs ?? 3000
  let pollTimer: number | null = null
  let generation = 0
  let request: Promise<void> | null = null

  function stop(): void {
    generation += 1
    if (pollTimer !== null) clearTimer(pollTimer)
    pollTimer = null
  }

  async function poll(): Promise<void> {
    if (!options.mounted.value || !options.activeJob.value || !options.isActive(options.activeJob.value)) return
    if (request) return request
    const currentGeneration = generation
    const jobId = options.activeJob.value.id
    request = (async () => {
      await options.refresh(true)
      if (currentGeneration !== generation || !options.mounted.value) return
      const job = options.activeJob.value
      if (!job || job.id !== jobId || !options.isActive(job)) return
      options.onJobProgress(job)
      await options.loadLogs(options.selectedJobId.value)
    })()
    try {
      await request
    } finally {
      request = null
    }
  }

  function sync(): void {
    if (!options.mounted.value || !options.activeJob.value || !options.isActive(options.activeJob.value)) {
      stop()
      return
    }
    if (pollTimer === null) pollTimer = setTimer(() => { void poll() }, intervalMs)
  }

  if (getCurrentScope()) onScopeDispose(stop)

  return { poll, sync, stop }
}
