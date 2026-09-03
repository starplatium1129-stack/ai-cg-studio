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

export interface BatchTargetItem {
  /** 蓝图 id 或角色 id。 */
  id: string
  /** 标题/角色名，用于任务展示与历史入册。 */
  title: string
  /** 提示词素材（场景 promptProse 或通用词条）。 */
  prose?: string
  /** 副标题（场景地点或角色作品 franchise）。 */
  subtitle?: string
  /** 缩略图/头像 URL（角色模式时直出头像）。 */
  avatarUrl?: string
  /** 目标类型：scene 场景 | character 角色。 */
  kind?: 'scene' | 'character'
  /** 角色专用 ID（在 kind === 'character' 时对齐 popularCharacter.id）。 */
  characterId?: string
}

/** 兼容旧代码引用 */
export type BatchSceneItem = BatchTargetItem

export type BatchEngine = 'sd' | 'anima'

export interface BatchDrawJob {
  id: string
  sceneId: string
  sceneTitle: string
  subtitle?: string
  avatarUrl?: string
  kind?: 'scene' | 'character'
  seed: number
  variant: number
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  error?: string
  /** 成功张的预览 objectURL（面板缩略图直出；下一批 start/reset 统一 revoke）。 */
  resultUrl?: string
}

export interface BatchDrawRunnerInput {
  scene: BatchTargetItem
  seed: number
  /** 候选序号（0 起；同场景第 2、3 张 = 1、2）。 */
  variant: number
}

export interface BatchDrawRunnerResult {
  ok: boolean
  error?: string
  /** 成功时回传预览 URL（从入册 blob 克隆的 objectURL，归本执行器统一释放）。 */
  resultUrl?: string
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
   * 构建任务清单：items × count（候选种子 baseSeed + i*1000 递增，锁定可复现）。
   */
  function buildJobs(items: BatchTargetItem[], count: number, baseSeed: number): BatchDrawJob[] {
    const list: BatchDrawJob[] = []
    for (const item of items) {
      for (let i = 0; i < count; i += 1) {
        list.push({
          id: makeId(),
          sceneId: item.id,
          sceneTitle: item.title,
          subtitle: item.subtitle,
          avatarUrl: item.avatarUrl,
          kind: item.kind,
          seed: baseSeed >= 0 ? baseSeed + i * 1000 : -1,
          variant: i,
          status: 'pending',
        })
      }
    }
    return list
  }

  async function start(items: BatchTargetItem[], count: number, baseSeed: number, unitLabel = '个项目'): Promise<void> {
    if (running.value) return
    if (!items.length) return
    releaseResultUrls()
    const list = buildJobs(items, Math.max(1, Math.min(3, count)), baseSeed)
    jobs.value = list
    running.value = true
    cancelRequested.value = false
    onFlash(`批量出图开始：${list.length} 张（${items.length} ${unitLabel}）`)

    await runList(list, items)

    running.value = false
    currentSeed.value = -1
    const { total, succeeded, failed } = progress.value
    onFlash(failed
      ? `批量完成：${succeeded}/${total} 张成功，${failed} 张失败（可在结果里只重跑失败项）`
      : `批量完成：${succeeded}/${total} 张全部入册`)
  }

  /** 只重跑失败/已取消的张（同目标同 seed 同候选序号）。 */
  async function retryFailed(items: BatchTargetItem[]): Promise<void> {
    if (running.value) return
    const list = jobs.value.filter(j => j.status === 'failed' || j.status === 'cancelled')
    if (!list.length) return
    list.forEach(job => { job.status = 'pending'; job.error = undefined })
    running.value = true
    cancelRequested.value = false
    onFlash(`重跑 ${list.length} 张失败任务`)

    await runList(list, items)

    running.value = false
    currentSeed.value = -1
    const failed = progress.value.failed
    onFlash(failed ? `重跑完成：仍有 ${failed} 张失败` : '重跑完成：全部成功')
  }

  async function runList(list: BatchDrawJob[], items: BatchTargetItem[]): Promise<void> {
    for (let index = 0; index < list.length; index += 1) {
      const job = list[index]
      if (cancelRequested.value) {
        job.status = 'cancelled'
        continue
      }
      job.status = 'running'
      currentSeed.value = job.seed
      const target = items.find(s => s.id === job.sceneId)
      const input: BatchDrawRunnerInput = {
        scene: target ?? { id: job.sceneId, title: job.sceneTitle, prose: '' },
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
      else if (result.resultUrl) job.resultUrl = result.resultUrl
      if (cancelRequested.value) {
        for (let rest = index + 1; rest < list.length; rest += 1) list[rest].status = 'cancelled'
        break
      }
    }
  }

  function releaseResultUrls() {
    jobs.value.forEach(job => {
      if (job.resultUrl) {
        URL.revokeObjectURL(job.resultUrl)
        job.resultUrl = undefined
      }
    })
  }

  function cancel() {
    if (!running.value) return
    cancelRequested.value = true
    onFlash('正在停止批量…（当前张完成后停止）')
  }

  function reset() {
    releaseResultUrls()
    jobs.value = []
    running.value = false
    cancelRequested.value = false
  }

  return {
    jobs: readonly(jobs),
    running: readonly(running),
    progress,
    start,
    retryFailed,
    cancel,
    reset,
  }
}
