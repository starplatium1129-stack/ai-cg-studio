import { ref, computed, readonly } from 'vue'

/**
 * 串行出图队列 — 从重构前 tools/prompt-builder/queue.js 迁移。
 * 规则：最多 8 个任务；一次只跑一个；失败保留在队首并自动暂停，
 * 让用户先处理原因（降尺寸 / 跳 LoRA / 换采样器）再恢复。
 */

export const SD_QUEUE_LIMIT = 8

export interface SDQueueJob {
  id: string
  title: string
  prompt: string
  negative: string
  sceneId: string | null
  sceneTitle: string
  char: string
  story: string
  size: string
  seed: number
  cfg: number
  steps: number
  sampler: string
  scheduler: string
  checkpoint: string
  lora?: string
  hiresFix: boolean
  hiresScale: number
  hiresUpscaler: string
  hiresSteps: number
  denoisingStrength: number
  faceDetailer: boolean
}

export interface SDJobOutcome {
  status: 'success' | 'cancelled' | 'failure'
  error?: unknown
}

export type SDJobRunner = (job: SDQueueJob) => Promise<SDJobOutcome>

export function useSDQueue(options: {
  run: SDJobRunner
  onFlash?: (msg: string) => void
  isBusy?: () => boolean
}) {
  const { run, onFlash = () => {}, isBusy = () => false } = options

  const queue = ref<SDQueueJob[]>([])
  const activeJob = ref<SDQueueJob | null>(null)
  const paused = ref(false)

  const total = computed(() => queue.value.length + (activeJob.value ? 1 : 0))
  const canEnqueue = computed(() => total.value < SD_QUEUE_LIMIT)

  function makeId() {
    return 'queue_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
  }

  function enqueue(job: Omit<SDQueueJob, 'id'>): boolean {
    if (!canEnqueue.value) {
      onFlash(`生成队列最多保留 ${SD_QUEUE_LIMIT} 个`)
      return false
    }
    if (!job.prompt) { onFlash('请先生成 Prompt'); return false }
    queue.value.push({ ...job, id: makeId() } as SDQueueJob)
    onFlash('已加入队列：' + (job.title || '未命名'))
    void process()
    return true
  }

  function remove(id: string) {
    queue.value = queue.value.filter(j => j.id !== id)
  }

  function clear() {
    queue.value = []
  }

  async function process(): Promise<void> {
    if (paused.value || activeJob.value || !queue.value.length) return
    if (isBusy()) return

    const job = queue.value.shift()!
    activeJob.value = job
    let retained = false
    const retain = (message?: string) => {
      if (retained) return
      retained = true
      // 失败任务放回队首并暂停，避免连环失败烧显卡
      queue.value.unshift(job)
      paused.value = true
      if (message) onFlash(message)
    }

    try {
      const outcome = await run(job)
      if (!outcome || outcome.status !== 'success') {
        retain(outcome?.status === 'cancelled'
          ? '队列已停止并暂停，当前任务已保留'
          : '队列已暂停，失败任务已保留在队首')
      }
    } catch (e) {
      console.error('queue task failed unexpectedly', e)
      retain('队列已暂停，失败任务已保留在队首')
    } finally {
      activeJob.value = null
      if (!paused.value) void process()
    }
  }

  function pause() { paused.value = true }
  function resume() { paused.value = false; void process() }

  return {
    queue: readonly(queue),
    activeJob: readonly(activeJob),
    paused: readonly(paused),
    total, canEnqueue,
    enqueue, remove, clear, pause, resume, process,
  }
}
