import { apiClient } from './client'

export type VideoMode = 'text' | 'image' | 'first-last-frame'
export type VideoJobStatus = 'queued' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled'

export interface VideoModelStatus {
  id: string
  label: string
  family: string
  tier: string
  summary: string
  executable: boolean
  available: boolean
  reason: string
  modes: VideoMode[]
  requirements: string[]
  missing: string[]
}

export interface VideoDefaults {
  modelId: string
  aspectRatio: 'landscape' | 'portrait' | 'square'
  duration: 3 | 5
  camera: 'still' | 'push' | 'pull' | 'pan' | 'orbit'
  motion: 'subtle' | 'natural' | 'expressive'
}

export interface VideoStatusResponse {
  ok: true
  online: boolean
  pending: number
  maxPending: number
  models: VideoModelStatus[]
  defaults: VideoDefaults
}

export interface VideoJob {
  id: string
  status: VideoJobStatus
  provider: 'comfy'
  progress: number
  modelId: string
  prompt: string
  width: number
  height: number
  duration: number
  fps: number
  seed: number
  createdAt: number
  resultAvailable: boolean
  resultUrl: string | null
  error: string | null
  code: string | null
}

export interface VideoJobResponse {
  ok: true
  job: VideoJob
}

export interface CreateVideoJobInput {
  prompt: string
  negative?: string
  modelId: string
  aspectRatio: VideoDefaults['aspectRatio']
  duration: VideoDefaults['duration']
  camera: VideoDefaults['camera']
  motion: VideoDefaults['motion']
  seed?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isVideoJob(value: unknown): value is VideoJob {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && typeof value.status === 'string'
    && typeof value.modelId === 'string'
    && typeof value.prompt === 'string'
    && typeof value.createdAt === 'number'
}

function isVideoStatusResponse(value: Record<string, unknown>): boolean {
  return value.ok === true
    && typeof value.online === 'boolean'
    && typeof value.pending === 'number'
    && Array.isArray(value.models)
    && isRecord(value.defaults)
}

function isVideoJobResponse(value: Record<string, unknown>): boolean {
  return value.ok === true && isVideoJob(value.job)
}

export function fetchVideoStatus(signal?: AbortSignal): Promise<VideoStatusResponse> {
  return apiClient.request<VideoStatusResponse>('/api/video/status', {
    cache: 'no-store',
    signal,
    timeoutMs: 8_000,
    validate: isVideoStatusResponse,
  })
}

export function createVideoJob(input: CreateVideoJobInput, signal?: AbortSignal): Promise<VideoJobResponse> {
  return apiClient.request<VideoJobResponse>('/api/video/jobs', {
    method: 'POST',
    body: input,
    signal,
    timeoutMs: 30_000,
    validate: isVideoJobResponse,
  })
}

export function fetchVideoJob(id: string, signal?: AbortSignal): Promise<VideoJobResponse> {
  return apiClient.request<VideoJobResponse>(`/api/video/jobs/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    signal,
    timeoutMs: 12_000,
    validate: isVideoJobResponse,
  })
}

export function cancelVideoJob(id: string, signal?: AbortSignal): Promise<VideoJobResponse> {
  return apiClient.request<VideoJobResponse>(`/api/video/jobs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
    timeoutMs: 15_000,
    validate: isVideoJobResponse,
  })
}
