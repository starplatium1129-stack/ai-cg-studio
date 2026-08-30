import { apiClient, type ApiClient, type ApiResponseObject } from './client.ts'

/**
 * /api/generation/* 统一客户端 —— 出图引擎网关（Comfy / WebUI 任务路由）。
 * 二进制结果（/jobs/:id/result）不属于 JSON 信封契约，仍由调用方直接 fetch。
 */

export const GENERATION_API_TIMEOUTS = {
  status: 15_000,
  create: 60_000,
  job: 15_000,
  delete: 10_000,
} as const

export interface GenerationJob {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  provider: 'comfy' | 'webui'
  /**
   * Comfy 路径的真实执行进度（0–1，来自 ComfyUI ws 步骤事件；generation.js
   * 的 Comfy 分支复用 anima 服务，进度桥已在后端就位）。WebUI 路径与未知
   * 进度为 null——此时 UI 应走 indeterminate 兜底，而非假装 0%。
   */
  progress?: number | null
  /** 后端组装的进度文案（如「采样 12 / 30 · 节点 10」），Comfy 路径才有。 */
  progressText?: string | null
  /** 当前执行中的 ComfyUI 节点号。 */
  currentNode?: string | null
  /** 任务已运行秒数（服务端时钟）。 */
  elapsedSeconds?: number
  seed?: number | null
  resultAvailable?: boolean
  resultUrl?: string | null
  metadata?: Record<string, unknown> & { seed?: number; provider?: string }
  error?: string | null
  code?: string | null
}

export interface GenerationStatus {
  ok: boolean
  online: boolean
  provider: string | null
  webuiOnline: boolean
  comfyFallbackOnline: boolean
  checkpoint: string
  samplers: string[]
  schedulers: string[]
  models: string[]
  loras: Array<{ id: string; character: string; available: boolean }>
  capabilities: {
    basic: boolean
    hires: boolean
    hiresUpscalers: string[]
    faceDetailer: boolean
  }
  pending: number
  maxPending: number
}

/** 服务端白名单字段（routes/generation.js ALLOWED） */
export interface GenerationJobPayload {
  prompt: string
  negative?: string
  profile?: string
  modelId?: string
  character?: string
  loras?: Array<{ id: string; strength: number }>
  width?: number
  height?: number
  steps?: number
  cfg?: number
  seed?: number
  sampler?: string
  scheduler?: string
  hiresFix?: boolean
  hiresScale?: number
  hiresUpscaler?: string
  hiresSteps?: number
  denoisingStrength?: number
  faceDetailer?: boolean
  adultEnabled?: boolean
}

export interface GenerationJobEnvelope {
  ok: boolean
  job: GenerationJob
}

export interface GenerationCallOptions {
  signal?: AbortSignal
}

function isObject(value: unknown): value is ApiResponseObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStatus(value: ApiResponseObject): boolean {
  return typeof value.online === 'boolean'
    && Array.isArray(value.samplers)
    && Array.isArray(value.schedulers)
}

function isJobEnvelope(value: ApiResponseObject): boolean {
  return isObject(value.job) && typeof (value.job as ApiResponseObject).id === 'string'
}

export interface GenerationApi {
  getStatus(options?: GenerationCallOptions): Promise<GenerationStatus>
  createJob(payload: GenerationJobPayload, options?: GenerationCallOptions): Promise<GenerationJobEnvelope>
  getJob(id: string, options?: GenerationCallOptions): Promise<GenerationJobEnvelope>
  deleteJob(id: string, options?: GenerationCallOptions): Promise<GenerationJobEnvelope>
}

export function createGenerationApi(client: ApiClient = apiClient): GenerationApi {
  return {
    getStatus(options = {}) {
      return client.request<GenerationStatus>('/api/generation/status', {
        cache: 'no-store',
        signal: options.signal,
        timeoutMs: GENERATION_API_TIMEOUTS.status,
        validate: isStatus,
      })
    },
    createJob(payload, options = {}) {
      return client.request<GenerationJobEnvelope>('/api/generation/jobs', {
        method: 'POST',
        cache: 'no-store',
        body: payload,
        signal: options.signal,
        timeoutMs: GENERATION_API_TIMEOUTS.create,
        validate: isJobEnvelope,
      })
    },
    getJob(id, options = {}) {
      return client.request<GenerationJobEnvelope>(
        `/api/generation/jobs/${encodeURIComponent(id)}`,
        { cache: 'no-store', signal: options.signal, timeoutMs: GENERATION_API_TIMEOUTS.job, validate: isJobEnvelope },
      )
    },
    deleteJob(id, options = {}) {
      return client.request<GenerationJobEnvelope>(
        `/api/generation/jobs/${encodeURIComponent(id)}`,
        { method: 'DELETE', cache: 'no-store', signal: options.signal, timeoutMs: GENERATION_API_TIMEOUTS.delete, validate: isJobEnvelope },
      )
    },
  }
}

export const generationApi = createGenerationApi()
