import { computed, getCurrentInstance, onUnmounted, ref } from 'vue'
import { ApiClientError, apiClient, type ApiClient } from '../api/client.ts'
import type {
  AnimaGenerationState,
  AnimaJobMetadata,
  AnimaOption,
  AnimaResult,
} from '../types/anima'
import type { CharKey } from '../stores/promptBuilderStore'

/**
 * Anima / Krea 2 生成会话 —— 「useGenerationSession：生成、进度、取消和错误」。
 *
 * 拥有 Anima 家族引擎的完整生命周期：后端发现与 15s 状态轮询、任务提交、
 * 轮询、取消、结果持有与卸载清理。导演台的 prompt 组装（buildAnimaRequest）
 * 和跨引擎协调（SD 结果互斥）通过注入的选项回调保留在视图侧。
 */

export interface AnimaPublicJob {
  id: string
  status: 'queued' | AnimaGenerationState['phase']
  seed: number
  resultAvailable: boolean
  resultUrl: string | null
  metadata?: AnimaJobMetadata
  error: string | null
  code: string | null
}

export interface AnimaStatusResponse {
  ok?: boolean
  online?: boolean
  models?: AnimaOption[]
  loras?: AnimaOption[]
  styleLoras?: AnimaGenerationState['styleLoras']
  error?: string
}

export interface AnimaRequest {
  prompt: string
  negative: string
  profileId: string
  modelId: string
  loraId: string | null
  loraStrength: number | null
  width: number
  height: number
  steps: number
  cfg: number
  seed?: number
  character: 'nene' | 'nene_b' | 'natsume' | 'triad' | null
  styleLoraId?: string
  hiresFix?: boolean
  hiresScale?: number
  hiresDenoise?: number
}

export interface AnimaSessionOptions {
  getCharacter: () => CharKey
  isPopular: () => boolean
  /** 当前绘图表面的引擎族：'krea2' 或 'anima'（SD 时不调用） */
  getFamily: () => 'anima' | 'krea2'
  /** 视图侧 prompt 组装；返回 null 表示拒绝生成（内部已提示原因） */
  getRequest: () => AnimaRequest | null
  /** 出图成功：视图做跨引擎协调（如清空 SD 结果） */
  onResult: (result: AnimaResult) => void
  flash: (message: string) => void
  /** applyModel 时优先采纳的推荐尺寸（如导演台 lastRecommendedSize） */
  preferredSize: () => string
  client?: ApiClient
}

const INITIAL_STATE: AnimaGenerationState = {
  phase: 'idle', online: false, checkMsg: 'Anima 状态检查中…', models: [], loras: [], styleLoras: [], styleLoraId: '',
  prompt: '', negative: '', modelId: 'anima-base-v1.0', loraId: 'L_NENE_V20B_ANIMA',
  loraStrength: 0.85, width: 832, height: 1216, steps: 24, cfg: 3.0,
  family: 'anima',
  sampler: 'res_multistep', scheduler: 'simple', seed: null,
  job: null, result: null, statusText: '', errorMsg: '',
}

export const ANIMA_LORA_BY_CHARACTER = {
  nene: 'L_NENE_V20B_ANIMA',
  natsume: 'L_NAT_V20_ANIMA',
} as const

export const ANIMA_CHARACTER_BY_CHARACTER = {
  nene: 'nene_b',
  natsume: 'natsume',
} as const

function jobPath(family: 'anima' | 'krea2', id?: string): string {
  const base = family === 'krea2' ? '/api/creative/jobs' : '/api/anima/jobs'
  return id ? `${base}/${encodeURIComponent(id)}` : base
}

/** 请求载荷按服务端白名单收敛；空字段不发送（服务端 400 INVALID_PARAMETER） */
export function animaRequestPayload(
  request: AnimaRequest,
): Omit<AnimaRequest, 'profileId' | 'loraId' | 'loraStrength'> & Partial<Pick<AnimaRequest, 'loraId' | 'loraStrength'>> {
  return {
    prompt: request.prompt,
    negative: request.negative,
    modelId: request.modelId,
    ...(request.loraId ? { loraId: request.loraId, loraStrength: request.loraStrength } : {}),
    ...(request.styleLoraId ? { styleLoraId: request.styleLoraId } : {}),
    width: request.width,
    height: request.height,
    steps: request.steps,
    cfg: request.cfg,
    ...(request.seed === undefined ? {} : { seed: request.seed }),
    character: request.character,
    ...(request.hiresFix ? {
      hiresFix: true,
      hiresScale: request.hiresScale || 2.0,
      hiresDenoise: request.hiresDenoise || 0.35,
    } : {}),
  }
}

/** 目标尺寸不在底模白名单时，收敛到比例最接近的受支持尺寸 */
export function closestSupportedSize(
  model: { sizes?: ReadonlyArray<string> | string[] } | undefined,
  desired: string,
): string {
  const sizes = model?.sizes || []
  if (!sizes.length || sizes.includes(desired)) return desired
  const [desiredWidth, desiredHeight] = desired.split('x').map(Number)
  if (!desiredWidth || !desiredHeight) return sizes[0]
  const desiredRatio = desiredWidth / desiredHeight
  return [...sizes].sort((left, right) => {
    const [leftWidth, leftHeight] = left.split('x').map(Number)
    const [rightWidth, rightHeight] = right.split('x').map(Number)
    return Math.abs(leftWidth / leftHeight - desiredRatio) - Math.abs(rightWidth / rightHeight - desiredRatio)
  })[0]
}

export function useAnimaSession(options: AnimaSessionOptions) {
  const client = options.client ?? apiClient
  const state = ref<AnimaGenerationState>({ ...INITIAL_STATE })

  let statusTimer: ReturnType<typeof setInterval> | null = null
  let requestSerial = 0
  let statusRequest: AbortController | null = null
  let jobRequest: AbortController | null = null

  const modelId = computed({
    get: () => state.value.modelId,
    set: value => applyModel(value),
  })

  function patchState(patch: Partial<AnimaGenerationState>) {
    state.value = { ...state.value, ...patch }
  }

  function syncCharacter(character: CharKey = options.getCharacter()) {
    if (options.isPopular()) {
      // 热门角色：无 LoRA 模式，不依赖角色 LoRA 白名单。
      patchState({ loraId: '' })
      return
    }
    if (character === 'triad') {
      patchState({ loraId: '' })
      return
    }
    const expected = ANIMA_LORA_BY_CHARACTER[character]
    const available = state.value.loras.some(lora => lora.id === expected && lora.available !== false)
    patchState({ loraId: available ? expected : '' })
  }

  function applyModel(modelIdToApply: string) {
    const model = state.value.models.find(item => item.id === modelIdToApply)
    const size = closestSupportedSize(model, options.preferredSize() || `${state.value.width}x${state.value.height}`)
    const [width, height] = size.split('x').map(Number)
    patchState({
      modelId: modelIdToApply,
      family: model?.family === 'krea2' ? 'krea2' : 'anima',
      steps: Number(model?.defaults?.steps) || state.value.steps,
      cfg: Number(model?.defaults?.cfg) || state.value.cfg,
      sampler: String(model?.defaults?.sampler || state.value.sampler),
      scheduler: String(model?.defaults?.scheduler || state.value.scheduler),
      styleLoraId: '',
      ...(Number.isInteger(width) && Number.isInteger(height) ? { width, height } : {}),
    })
    syncCharacter(options.getCharacter())
  }

  /**
   * 拉取 ComfyUI / 网关状态并按当前角色与引擎族收敛 model / lora 白名单。
   * 成功响应即使 offline 也采用（清空列表）；只有请求失败才标记离线。
   */
  async function refreshBackend(): Promise<void> {
    statusRequest?.abort()
    const controller = new AbortController()
    statusRequest = controller
    try {
      const data = await client.request<AnimaStatusResponse>('/api/creative/status', {
        cache: 'no-store', signal: controller.signal, timeoutMs: 10_000,
        validate: value => value.ok === true,
      })
      const models = Array.isArray(data.models) ? data.models : []
      const loras = (Array.isArray(data.loras) ? data.loras : [])
        .filter(lora => lora.character === options.getCharacter())
      const family = options.getFamily()
      const styleLoras = family === 'krea2' ? (data.styleLoras || []) : []
      const familyModels = models.filter(model => model.family === family)
      const visibleModels = options.isPopular()
        // 热门角色只暴露 no-LoRA 底模（Krea 家族天然无 LoRA）。
        ? familyModels.filter(model => model.capabilities?.noLora === true || model.family === 'krea2')
        : familyModels
      const familyLoras = family === 'krea2' ? [] : (options.isPopular() ? [] : loras)
      const modelIdCurrent = visibleModels.some(model => model.id === state.value.modelId)
        ? state.value.modelId
        : (visibleModels[0]?.id || '')
      const loraId = familyLoras.some(lora => lora.id === state.value.loraId)
        ? state.value.loraId
        : (familyLoras[0]?.id || '')
      const selectedModel = visibleModels.find(model => model.id === modelIdCurrent)
      // 切到新 family 时若当前尺寸不在该底模支持范围内，落到该底模推荐尺寸。
      // （Krea 与 Anima 尺寸白名单不同；否则请求会以 400 INVALID_PARAMETER 失败。）
      let width = state.value.width
      let height = state.value.height
      if (selectedModel && Array.isArray(selectedModel.sizes) && selectedModel.sizes.length
        && !selectedModel.sizes.includes(`${width}x${height}`)) {
        const [nextWidth, nextHeight] = String(selectedModel.sizes[0]).split('x').map(Number)
        if (Number.isInteger(nextWidth) && Number.isInteger(nextHeight)) { width = nextWidth; height = nextHeight }
      }
      const familyLabel = family === 'krea2' ? 'Krea 2' : 'Anima'
      patchState({
        online: data.online === true,
        checkMsg: data.online === true
          ? `${familyLabel} 在线 · ${visibleModels.length} 个底模 · ${familyLoras.length} 个 LoRA`
          : `${familyLabel} 离线（ComfyUI 未启动或网关不可用）`,
        models: visibleModels, loras: familyLoras, styleLoras, styleLoraId: '', modelId: modelIdCurrent, loraId, width, height,
        family: selectedModel?.family === 'krea2' ? 'krea2' : 'anima',
        steps: Number(selectedModel?.defaults?.steps) || state.value.steps,
        cfg: Number(selectedModel?.defaults?.cfg) || state.value.cfg,
        sampler: String(selectedModel?.defaults?.sampler || state.value.sampler),
        scheduler: String(selectedModel?.defaults?.scheduler || state.value.scheduler),
      })
      syncCharacter(options.getCharacter())
    } catch (error) {
      if (error instanceof ApiClientError && error.kind === 'aborted') return
      patchState({ online: false, checkMsg: `${options.getFamily() === 'krea2' ? 'Krea 2' : 'Anima'} 离线（网关状态接口不可用）` })
    } finally {
      if (statusRequest === controller) statusRequest = null
    }
  }

  function startStatusPolling(intervalMs = 15_000) {
    stopStatusPolling()
    statusTimer = setInterval(() => { void refreshBackend() }, intervalMs) as unknown as ReturnType<typeof setInterval>
  }

  function stopStatusPolling() {
    if (statusTimer) clearInterval(statusTimer)
    statusTimer = null
  }

  function metadataFromJob(job: AnimaPublicJob, request: AnimaRequest): AnimaJobMetadata {
    const supplied = job.metadata
    const metadata = supplied && supplied.prompt === request.prompt && supplied.negative === request.negative
      ? supplied
      : {
          engine: state.value.family,
          id: job.id,
          prompt: request.prompt,
          negative: request.negative,
          profileId: request.profileId,
          modelId: request.modelId,
          loraId: request.loraId,
          loraStrength: request.loraStrength,
          styleLoraId: request.styleLoraId ?? null,
          width: request.width,
          height: request.height,
          steps: request.steps,
          cfg: request.cfg,
          sampler: state.value.sampler,
          scheduler: state.value.scheduler,
          seed: job.seed,
          character: request.character,
          preview: false,
          hiresFix: Boolean(request.hiresFix),
          hiresScale: request.hiresScale,
          hiresDenoise: request.hiresDenoise,
          createdAt: Date.now(),
          resultUrl: job.resultUrl,
        }
    return Object.freeze({ ...metadata, resultUrl: job.resultUrl || metadata.resultUrl || null }) as AnimaJobMetadata
  }

  async function fetchImage(url: string, signal: AbortSignal): Promise<Blob> {
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal.addEventListener('abort', onAbort, { once: true })
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
      const contentType = String(response.headers.get('content-type') || '')
      if (!response.ok) throw new Error(`图片读取失败（HTTP ${response.status}）`)
      if (!contentType.startsWith('image/')) throw new Error('网关返回的结果不是图片')
      const blob = await response.blob()
      if (!blob.size) throw new Error('生成结果为空')
      return blob
    } catch (error) {
      if (controller.signal.aborted) throw new Error(signal.aborted ? '请求已取消' : '图片读取超时（30 秒）')
      throw error
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', onAbort)
    }
  }

  async function pollJob(jobId: string, request: AnimaRequest, serial: number, signal: AbortSignal): Promise<void> {
    const deadline = Date.now() + 10 * 60 * 1000
    while (Date.now() < deadline && serial === requestSerial) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (serial !== requestSerial) return
      let data: { ok?: boolean; job?: AnimaPublicJob; error?: string }
      try {
        data = await client.request<{ ok?: boolean; job?: AnimaPublicJob; error?: string }>(jobPath(state.value.family, jobId), {
          cache: 'no-store', signal, timeoutMs: 15_000,
        })
      } catch (error) {
        if (error instanceof ApiClientError && error.kind === 'http' && error.status >= 500) continue
        throw error
      }
      if (serial !== requestSerial) return
      const job = data.job
      if (data.ok !== true || !job) throw new Error(data.error || 'Anima 状态无效')
      if (job.metadata) patchState({ job: metadataFromJob(job, request) })
      if (job.status === 'cancelling') {
        patchState({ phase: 'cancelling', statusText: '取消中…' })
        continue
      }
      if (job.status === 'cancelled') {
        patchState({ phase: 'cancelled', statusText: '任务已取消', errorMsg: '' })
        return
      }
      if (job.status === 'failed') throw new Error(job.error || 'Anima 生成失败')
      if (job.status !== 'succeeded' || !job.resultAvailable || !job.resultUrl) continue

      const blob = await fetchImage(job.resultUrl, signal)
      if (serial !== requestSerial) return
      const metadata = metadataFromJob(job, request)
      const result: AnimaResult = { url: URL.createObjectURL(blob), blob, metadata }
      // 会话拥有成功态与结果持有：先释放旧结果再写入新结果。
      const previous = state.value.result
      if (previous && previous.url !== result.url) URL.revokeObjectURL(previous.url)
      patchState({ result, job: metadata, phase: 'succeeded', statusText: '生成完成', errorMsg: '' })
      options.onResult(result)
      return
    }
    if (serial === requestSerial) throw new Error('Anima 生成超时')
  }

  function clearResult() {
    const previous = state.value.result
    if (previous) URL.revokeObjectURL(previous.url)
    patchState({ result: null, job: null })
  }

  async function generate(overrides: Partial<AnimaRequest> = {}): Promise<void> {
    if (['submitting', 'running', 'cancelling'].includes(state.value.phase)) return
    const baseRequest = options.getRequest()
    if (!baseRequest) return
    const request: AnimaRequest = { ...baseRequest, ...overrides }
    if (!state.value.online) { options.flash('Anima ComfyUI 当前未连接'); return }
    const serial = ++requestSerial
    jobRequest?.abort()
    const controller = new AbortController()
    jobRequest = controller
    clearResult()
    patchState({ phase: 'submitting', statusText: '提交任务…', errorMsg: '' })
    try {
      const data = await client.request<{ ok?: boolean; job?: AnimaPublicJob; error?: string }>(jobPath(state.value.family), {
        method: 'POST',
        body: animaRequestPayload(request),
        signal: controller.signal,
        timeoutMs: 30_000,
      })
      if (data.ok !== true || !data.job?.id) throw new Error(data.error || 'Anima 任务创建失败')
      const metadata = metadataFromJob(data.job, request)
      patchState({ phase: 'running', statusText: '生成中…', job: metadata })
      await pollJob(data.job.id, request, serial, controller.signal)
    } catch (error) {
      if (serial !== requestSerial) return
      if (error instanceof ApiClientError && error.kind === 'aborted') return
      patchState({ phase: 'failed', statusText: '生成失败', errorMsg: error instanceof Error ? error.message : String(error) })
    } finally {
      if (jobRequest === controller) jobRequest = null
    }
  }

  async function cancel(): Promise<void> {
    const job = state.value.job
    if (!job && state.value.phase === 'submitting') {
      options.flash('任务正在登记，取得任务编号后即可安全取消')
      return
    }
    if (!job || !['running', 'cancelling'].includes(state.value.phase)) return
    patchState({ phase: 'cancelling', statusText: '取消中…', errorMsg: '' })
    try {
      const data = await client.request<{ job?: AnimaPublicJob }>(jobPath(state.value.family, job.id), {
        method: 'DELETE', timeoutMs: 15_000,
      })
      if (data.job?.status === 'cancelled') patchState({ phase: 'cancelled', statusText: '任务已取消' })
    } catch (error) {
      patchState({ phase: 'failed', statusText: '取消失败', errorMsg: error instanceof Error ? error.message : String(error) })
    }
  }

  /** 离开导演台：停止轮询、取消在途任务、释放结果 URL（防止 GPU 任务悬挂与 blob 泄漏） */
  function dispose() {
    requestSerial += 1
    statusRequest?.abort()
    statusRequest = null
    jobRequest?.abort()
    jobRequest = null
    stopStatusPolling()
    const activeJob = state.value.job
    if (activeJob && ['running', 'cancelling'].includes(state.value.phase)) {
      void client.request<{ ok?: boolean }>(jobPath(state.value.family, activeJob.id), { method: 'DELETE', timeoutMs: 10_000 }).catch(() => {})
    }
    const result = state.value.result
    if (result) URL.revokeObjectURL(result.url)
  }

  // 在组件上下文里自动挂载清理；被普通函数调用时（如测试）跳过
  if (getCurrentInstance()) onUnmounted(dispose)

  return {
    state,
    modelId,
    patchState,
    syncCharacter,
    applyModel,
    refreshBackend,
    startStatusPolling,
    stopStatusPolling,
    generate,
    cancel,
    clearResult,
    dispose,
  }
}
