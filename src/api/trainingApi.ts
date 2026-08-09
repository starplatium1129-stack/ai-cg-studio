import { apiClient, type ApiClient, type ApiResponseObject } from './client.ts'
import type {
  TrainingJob,
  TrainingJobConfig,
  TrainingJobId,
  TrainingLogResponse,
  TrainingOverview,
  TrainingParamOverrides,
} from '../types/training.ts'

export const TRAINING_API_TIMEOUTS = {
  query: 10_000,
  action: 30_000,
  logs: 10_000,
} as const

export type TrainingOverviewResult = { ok: true } & TrainingOverview
export interface TrainingJobsResult {
  ok: true
  jobs: TrainingJob[]
}
export interface TrainingJobResult {
  ok: true
  job: TrainingJob
}
export interface TrainingJobConfigResult {
  ok: true
  config: TrainingJobConfig
}
export type TrainingLogsResult = { ok: true } & TrainingLogResponse

export interface TrainingCallOptions {
  signal?: AbortSignal
}

export interface TrainingApi {
  getOverview(options?: TrainingCallOptions): Promise<TrainingOverviewResult>
  getJobs(options?: TrainingCallOptions): Promise<TrainingJobsResult>
  start(
    id: TrainingJobId,
    overrides?: TrainingParamOverrides,
    dataset?: string,
    options?: TrainingCallOptions,
  ): Promise<TrainingJobResult>
  stop(id: TrainingJobId, options?: TrainingCallOptions): Promise<TrainingJobResult>
  getConfig(id: TrainingJobId, options?: TrainingCallOptions): Promise<TrainingJobConfigResult>
  getLogs(
    id: TrainingJobId,
    cursor: number,
    version: number,
    options?: TrainingCallOptions,
  ): Promise<TrainingLogsResult>
}

function isObject(value: unknown): value is ApiResponseObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJob(value: unknown): boolean {
  return isObject(value)
    && typeof value.id === 'string'
    && typeof value.status === 'string'
    && isObject(value.progress)
    && typeof value.progress.percent === 'number'
}

function isJobs(value: ApiResponseObject): boolean {
  return value.ok === true && Array.isArray(value.jobs) && value.jobs.every(isJob)
}

function isOverview(value: ApiResponseObject): boolean {
  return isJobs(value)
    && isObject(value.workspace)
    && typeof value.workspace.available === 'boolean'
    && typeof value.workspace.name === 'string'
    && (value.activeJobId === null || typeof value.activeJobId === 'string')
    && Array.isArray(value.readyJobs)
    && Array.isArray(value.datasets)
}

function isJobResult(value: ApiResponseObject): boolean {
  return value.ok === true && isJob(value.job)
}

function isConfigResult(value: ApiResponseObject): boolean {
  return value.ok === true && isObject(value.config)
}

function isLogs(value: ApiResponseObject): boolean {
  return value.ok === true
    && typeof value.id === 'string'
    && typeof value.cursor === 'number'
    && typeof value.nextCursor === 'number'
    && typeof value.reset === 'boolean'
    && typeof value.version === 'number'
    && typeof value.text === 'string'
    && Array.isArray(value.lines)
    && value.lines.every(line => typeof line === 'string')
}

export function createTrainingApi(client: ApiClient = apiClient): TrainingApi {
  return {
    getOverview(options: TrainingCallOptions = {}) {
      return client.request<TrainingOverviewResult>('/api/training/overview', {
        cache: 'no-store',
        signal: options.signal,
        timeoutMs: TRAINING_API_TIMEOUTS.query,
        validate: isOverview,
      })
    },

    getJobs(options: TrainingCallOptions = {}) {
      return client.request<TrainingJobsResult>('/api/training/jobs', {
        cache: 'no-store',
        signal: options.signal,
        timeoutMs: TRAINING_API_TIMEOUTS.query,
        validate: isJobs,
      })
    },

    start(
      id: TrainingJobId,
      overrides: TrainingParamOverrides = {},
      dataset?: string,
      options: TrainingCallOptions = {},
    ) {
      return client.request<TrainingJobResult>('/api/training/jobs', {
        method: 'POST',
        cache: 'no-store',
        body: { id, overrides, dataset },
        signal: options.signal,
        timeoutMs: TRAINING_API_TIMEOUTS.action,
        validate: isJobResult,
      })
    },

    stop(id: TrainingJobId, options: TrainingCallOptions = {}) {
      return client.request<TrainingJobResult>(`/api/training/jobs/${encodeURIComponent(id)}/stop`, {
        method: 'POST',
        cache: 'no-store',
        body: {},
        signal: options.signal,
        timeoutMs: TRAINING_API_TIMEOUTS.action,
        validate: isJobResult,
      })
    },

    getConfig(id: TrainingJobId, options: TrainingCallOptions = {}) {
      return client.request<TrainingJobConfigResult>(`/api/training/jobs/${encodeURIComponent(id)}/config`, {
        cache: 'no-store',
        signal: options.signal,
        timeoutMs: TRAINING_API_TIMEOUTS.action,
        validate: isConfigResult,
      })
    },

    getLogs(
      id: TrainingJobId,
      cursor: number,
      version: number,
      options: TrainingCallOptions = {},
    ) {
      const params = new URLSearchParams({ cursor: String(cursor), version: String(version) })
      return client.request<TrainingLogsResult>(
        `/api/training/jobs/${encodeURIComponent(id)}/logs?${params.toString()}`,
        {
          cache: 'no-store',
          signal: options.signal,
          timeoutMs: TRAINING_API_TIMEOUTS.logs,
          validate: isLogs,
        },
      )
    },
  }
}

export const trainingApi = createTrainingApi()
