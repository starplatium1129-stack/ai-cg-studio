import { computed, readonly, ref } from 'vue'

/**
 * useBatchDraw — 多场景批量出图执行器（引擎无关）。
 *
 * 职责：把「N 个场景 × 每场景 M 张」的任务清单串行跑完，逐张汇报进度；
 * 单张失败不打断整批（计数继续），全部结束后可看失败清单重跑。
 * 引擎差异（SD 走 WebUI、Anima 走 ComfyUI）由视图注入的 run 回调承担，
 * 这里只管调度与状态，不碰任何引擎 API。
 *
 * 与 useSDQueue 的分工：SD 队列是「同面板状态排队」，批量是「按场景清单
 * 逐张执行」——批量场景各自的 prompt 不同，不能复用单状态队列。
 */

export interface BatchSceneItem {
  /** 场景蓝图 id（sceneBlueprints 的 id）。 */
  id: string
  /** 场景标题，用于任务展示与历史入册。 */
  title: string
  /** 该场景的提示词素材（promptProse 或 description/action/lighting 拼接）。 */
  prose: string
}

export type BatchEngine = 'sd' | 'anima'

export interface BatchDrawJob {
  id: string
  sceneId: string
  sceneTitle: string
  seed: number
  variant: number
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  error?: string
}

export interface BatchDrawRunnerInput {
  scene: BatchSceneItem
  seed: number
  /** 候选序号（0 起；同场景第 2、3 张 = 1、2）。 */
  variant: number
}

export interface BatchDrawRunnerResult {
  ok: boolean
  error?: string
}

export interface BatchDrawRunOptions {
  /** 串行执行单张；返回 ok:false 表示该张失败（整批继续）。 */
  run: (input: BatchDrawRunnerInput) => Promise<BatchDrawRunnerResult>
  onFlash?: (message: string) => void
}

export function useBatchDraw(options: BatchDrawRunOptions) {
  const { run, onFlash = () => {} } = options

  const jobs = ref<BatchDrawJob[]>([])
  const running = ref(false)
  const cancelRequested = ref(false)
  const currentSeed = ref(-1)

  const progress = computed(() => {
    const total = jobs.value.length
    const done = jobs.value.filter(j => j.status === 'succeeded' || j.status === 'failed' || j.status === 'cancelled').length
    const succeeded = jobs.value.filter(j => j.status === 'succeeded').length
    const failed = jobs.value.filter(j => j.status === 'failed').length
    return { total, done, succeeded, failed }
  })

  function makeId() {
    return 'batch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
  }

  /**
   * 构建任务清单：scenes × count（候选种子 baseSeed + i*1000 递增，锁定可复现）。
   */
  function buildJobs(scenes: BatchSceneItem[], count: number, baseSeed: number): BatchDrawJob[] {
    const list: BatchDrawJob[] = []
    for (const scene of scenes) {
      for (let i = 0; i < count; i += 1) {
        list.push({
          id: makeId(),
          sceneId: scene.id,
          sceneTitle: scene.title,
          seed: baseSeed >= 0 ? baseSeed + i * 1000 : -1,
          variant: i,
          status: 'pending',
        })
      }
    }
    return list
  }

  async function start(scenes: BatchSceneItem[], count: number, baseSeed: number): Promise<void> {
    if (running.value) return
    if (!scenes.length) return
    const list = buildJobs(scenes, Math.max(1, Math.min(3, count)), baseSeed)
    jobs.value = list
    running.value = true
    cancelRequested.value = false
    onFlash(`批量出图开始：${list.length} 张（${scenes.length} 个场景）`)

    for (let index = 0; index < list.length; index += 1) {
      const job = list[index]
      if (cancelRequested.value) {
        job.status = 'cancelled'
        continue
      }
      job.status = 'running'
      currentSeed.value = job.seed
      const scene = scenes.find(s => s.id === job.sceneId)
      const input: BatchDrawRunnerInput = {
        scene: scene ?? { id: job.sceneId, title: job.sceneTitle, prose: '' },
        seed: job.seed,
        variant: job.variant,
      }
      let result: BatchDrawRunnerResult
      try {
        result = await run(input)
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
      // 当前张的结果先落定（run 内部可能已请求取消——取消只影响后续张）。
      job.status = result.ok ? 'succeeded' : 'failed'
      if (!result.ok) job.error = result.error || '生成失败'
      if (cancelRequested.value) {
        for (let rest = index + 1; rest < list.length; rest += 1) list[rest].status = 'cancelled'
        break
      }
    }

    running.value = false
    currentSeed.value = -1
    const { total, succeeded, failed } = progress.value
    onFlash(failed
      ? `批量完成：${succeeded}/${total} 张成功，${failed} 张失败（可在结果里重试）`
      : `批量完成：${succeeded}/${total} 张全部入册`)
  }

  function cancel() {
    if (!running.value) return
    cancelRequested.value = true
    onFlash('正在停止批量…（当前张完成后停止）')
  }

  function reset() {
    jobs.value = []
    running.value = false
    cancelRequested.value = false
  }

  return {
    jobs: readonly(jobs),
    running: readonly(running),
    progress,
    start,
    cancel,
    reset,
  }
}
