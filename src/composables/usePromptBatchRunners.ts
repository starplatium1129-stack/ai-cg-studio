import { ref, type Ref } from 'vue'
import { usePromptBuilderStore, CHAR_PROMPT, type HistoryEntry } from '@/stores/promptBuilderStore'
import { apiClient } from '@/api/client'
import { findCharacter as findPopularCharacter, type SceneBlueprint } from '@/utils/popularContent'
import {
  ANIMA_CHARACTER_BY_CHARACTER,
  animaRequestPayload,
  type useAnimaSession,
  type AnimaPublicJob,
  type AnimaRequest,
} from '@/composables/useAnimaSession'
import type { useSDGenerate } from '@/composables/useSDGenerate'
import type { usePromptAssembly } from '@/composables/usePromptAssembly'
import { useBatchDraw, type BatchDrawRunnerInput, type BatchDrawRunnerResult, type BatchEngine, type BatchSceneItem } from '@/composables/useBatchDraw'
import type { SDQueueJob } from '@/composables/useSDQueue'

type PromptBuilderStore = ReturnType<typeof usePromptBuilderStore>
type AnimaSession = ReturnType<typeof useAnimaSession>
type PromptAssembly = ReturnType<typeof usePromptAssembly>

export interface PromptBatchRunnersDeps {
  pb: PromptBuilderStore
  sd: ReturnType<typeof useSDGenerate>
  sdSize: Ref<string>
  negativePrompt: PromptAssembly['negativePrompt']
  loraSpecs: PromptAssembly['loraSpecs']
  modelProfile: PromptAssembly['modelProfile']
  animaState: AnimaSession['state']
  /** 视图持有的 SD 执行路径（队列/直出/批量共用同一条 runJob）。 */
  runJob: (job: Omit<SDQueueJob, 'id'>, opts?: { disableLora?: boolean }) => Promise<string | null>
  /** 历史入册的引擎字段快照（Anima 读 result/job metadata，SD 读面板状态）。 */
  historyGenerationFields: () => Partial<HistoryEntry>
  sceneBlueprints: () => SceneBlueprint[]
}

/**
 * 绘图页「多场景批量出图」runner 编排（2026-08-22 自 PromptBuilderView 下沉）。
 *
 * 选 N 个场景蓝图 → 逐张串行出图（SD 复用视图 runJob 同路径 / Anima 直接
 * 提交 ComfyUI 任务并轮询到终态）→ 每张自动入册历史。调度与进度归
 * useBatchDraw，这里只承担引擎差异与「蓝图 → prompt/任务」的组装。
 */
export function usePromptBatchRunners(deps: PromptBatchRunnersDeps) {
  const { pb, sd, sdSize, negativePrompt, loraSpecs, modelProfile, animaState, runJob, historyGenerationFields } = deps

  const batchOpen = ref(false)
  const batchEngine = ref<BatchEngine>('sd')

  /** 批量 prompt 组装：场景 prose + 当前角色锚点（SD 补 tag 锚点，Anima 用自然语言）。 */
  function buildBatchPrompt(prose: string): string {
    const text = String(prose || '').trim()
    if (!text) return ''
    if (pb.isPopular) {
      const character = pb.subject.kind === 'popular'
        ? findPopularCharacter(pb.popularCharacters, pb.subject.characterId || '')
        : null
      const identity = character?.identityProse
      if (identity) return `${text}, ${identity}`
    }
    const anchor = CHAR_PROMPT[pb.char]
    if (anchor) return `${text}, ${anchor}`
    return text
  }

  function batchSceneProse(blueprint: SceneBlueprint | undefined): string {
    const prose = String(blueprint?.promptProse || '').trim()
    if (prose) return prose
    return [blueprint?.description, blueprint?.action, blueprint?.lighting].filter(Boolean).join('，')
  }

  async function runBatchSd(input: BatchDrawRunnerInput): Promise<BatchDrawRunnerResult> {
    const prompt = buildBatchPrompt(input.scene.prose)
    if (!prompt) return { ok: false, error: '场景描述为空' }
    const job: Omit<SDQueueJob, 'id'> = {
      title: input.scene.title,
      prompt,
      negative: negativePrompt.value,
      sceneId: input.scene.id,
      sceneTitle: input.scene.title,
      char: pb.char,
      story: input.scene.prose,
      size: sdSize.value,
      seed: input.seed,
      cfg: pb.sdParams.cfg,
      steps: pb.sdParams.steps,
      sampler: pb.sdParams.sampler,
      scheduler: pb.sdParams.scheduler || '',
      checkpoint: pb.sdModelName || sd.checkpoint.value || '',
      lora: loraSpecs.value.map(spec => `${spec.name}:${spec.weight}`).join(', '),
      hiresFix: pb.sdParams.hiresFix,
      hiresScale: pb.sdParams.hiresScale,
      hiresUpscaler: pb.sdParams.hiresUpscaler,
      hiresSteps: pb.sdParams.hiresSteps,
      denoisingStrength: pb.sdParams.hiresDenoise,
      faceDetailer: pb.sdParams.faceDetailer,
    }
    try {
      const url = await runJob(job)
      if (!url) return { ok: false, error: sd.errorMsg.value || 'SD 生成失败' }
      const response = await fetch(url, { cache: 'no-store' })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.startsWith('image/')) return { ok: false, error: '成片响应不是图片' }
      const blob = await response.blob()
      if (!blob.size) return { ok: false, error: '成片数据已失效' }
      await pb.commitHistoryEntry({
        blob,
        seed: input.seed >= 0 ? input.seed : (sd.resultSeed.value ?? undefined),
        size: job.size,
        negative: job.negative,
        prompt: job.prompt,
        ...historyGenerationFields(),
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'SD 生成失败' }
    }
  }

  async function runBatchAnima(input: BatchDrawRunnerInput): Promise<BatchDrawRunnerResult> {
    if (!animaState.value.online) return { ok: false, error: 'Anima 当前未连接' }
    const prompt = buildBatchPrompt(input.scene.prose)
    if (!prompt) return { ok: false, error: '场景描述为空' }
    const selectedModel = animaState.value.models.find(model => model.id === animaState.value.modelId)
    const profileId = modelProfile.value?.id || selectedModel?.profileId || ''
    const request: AnimaRequest = {
      prompt,
      negative: '',
      profileId,
      modelId: animaState.value.modelId,
      loraId: animaState.value.loraId,
      loraStrength: animaState.value.loraStrength,
      width: animaState.value.width,
      height: animaState.value.height,
      steps: animaState.value.steps,
      cfg: animaState.value.cfg,
      ...(input.seed >= 0 ? { seed: input.seed } : {}),
      character: animaState.value.family === 'krea2' || pb.char === 'triad'
        ? null
        : ANIMA_CHARACTER_BY_CHARACTER[pb.char],
      hiresFix: Boolean(animaState.value.hiresFix),
      hiresScale: animaState.value.hiresScale,
      hiresDenoise: animaState.value.hiresDenoise,
    }
    try {
      const jobRoute = animaState.value.family === 'krea2' ? '/api/creative/jobs' : '/api/anima/jobs'
      const data = await apiClient.request<{ ok?: boolean; job?: AnimaPublicJob; error?: string }>(jobRoute, {
        method: 'POST',
        body: animaRequestPayload(request),
        timeoutMs: 30_000,
      })
      if (data.ok !== true || !data.job?.id) throw new Error(data.error || 'Anima 任务创建失败')
      const jobId = data.job.id
      const deadline = Date.now() + 10 * 60 * 1000
      let job = data.job
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const state = await apiClient.request<{ ok?: boolean; job?: AnimaPublicJob; error?: string }>(
          `${jobRoute}/${encodeURIComponent(jobId)}`, { cache: 'no-store', timeoutMs: 15_000 })
        if (state.ok !== true || !state.job) throw new Error(state.error || 'Anima 状态无效')
        job = state.job
        if (job.status === 'failed') throw new Error(job.error || 'Anima 生成失败')
        if (job.status === 'cancelled') return { ok: false, error: '任务已取消' }
        if (job.status === 'succeeded' && job.resultAvailable && job.resultUrl) break
      }
      if (job.status !== 'succeeded' || !job.resultUrl) throw new Error('Anima 生成超时')
      const blob = await fetchImageBlob(job.resultUrl)
      if (!blob.size) throw new Error('生成结果为空')
      await pb.commitHistoryEntry({
        blob,
        seed: job.seed,
        negative: '',
        prompt,
        ...historyGenerationFields(),
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Anima 生成失败' }
    }
  }

  async function fetchImageBlob(url: string): Promise<Blob> {
    const response = await fetch(url, { cache: 'no-store' })
    const contentType = String(response.headers.get('content-type') || '')
    if (!response.ok) throw new Error(`图片读取失败（HTTP ${response.status}）`)
    if (!contentType.startsWith('image/')) throw new Error('网关返回的结果不是图片')
    const blob = await response.blob()
    if (!blob.size) throw new Error('生成结果为空')
    return blob
  }

  const batchDraw = useBatchDraw({
    onFlash: (message) => pb.flash(message),
    run: (input) => batchEngine.value === 'sd' ? runBatchSd(input) : runBatchAnima(input),
  })

  async function onBatchStart(payload: { sceneIds: string[]; count: number }) {
    const scenes: BatchSceneItem[] = payload.sceneIds.map(id => {
      const blueprint = deps.sceneBlueprints().find(item => item.id === id)
      return {
        id,
        title: blueprint?.title || id,
        prose: batchSceneProse(blueprint),
      }
    }).filter(item => item.prose)
    if (!scenes.length) { pb.flash('所选场景没有可用的描述'); return }
    const baseSeed = pb.sdParams.seedLock && pb.sdParams.seed >= 0
      ? pb.sdParams.seed
      : Math.floor(Math.random() * 900000000)
    await batchDraw.start(scenes, payload.count, baseSeed)
  }

  return { batchOpen, batchEngine, batchDraw, onBatchStart }
}
