import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  TRAINING_JOB_IDS,
  type TrainingApiError,
  type TrainingDataset,
  type TrainingJob,
  type TrainingJobConfig,
  type TrainingJobId,
  type TrainingLogResponse,
  type TrainingLogState,
  type TrainingOverview,
  type TrainingParamOverrides,
} from '@/types/training'

interface SuccessEnvelope {
  ok: true
}

interface JobEnvelope extends SuccessEnvelope {
  job: TrainingJob
}

type OverviewEnvelope = SuccessEnvelope & TrainingOverview
type LogsEnvelope = SuccessEnvelope & TrainingLogResponse
type ConfigEnvelope = SuccessEnvelope & { config: TrainingJobConfig }

const MAX_VISIBLE_LOG_CHARS = 180_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function apiError(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback
  const error = value as Partial<TrainingApiError>
  if (typeof error.error === 'string' && error.error.trim()) {
    return typeof error.detail === 'string' && error.detail.trim()
      ? `${error.error}：${error.detail}`
      : error.error
  }
  return fallback
}

async function request<T extends SuccessEnvelope>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const body = await response.json().catch(() => null) as unknown
  if (!response.ok || !isRecord(body) || body.ok !== true) {
    throw new Error(apiError(body, `训练服务请求失败（HTTP ${response.status}）`))
  }
  return body as T
}

function emptyLogState(): TrainingLogState {
  return {
    text: '',
    cursor: 0,
    version: 0,
    loading: false,
    error: '',
  }
}

export const useTrainingStore = defineStore('training', () => {
  const overview = ref<TrainingOverview | null>(null)
  const loading = ref(false)
  const error = ref('')
  const actionJobId = ref<TrainingJobId | null>(null)
  const selectedJobId = ref<TrainingJobId>('lora-nene-v18')
  const logs = ref<Record<TrainingJobId, TrainingLogState>>({
    'lora-nene-v18': emptyLogState(),
    'lora-natsume-v18': emptyLogState(),
    'voice-nene': emptyLogState(),
    'voice-natsume': emptyLogState(),
  })

  let refreshPromise: Promise<void> | null = null

  const jobs = computed(() => overview.value?.jobs ?? [])
  const datasets = computed(() => overview.value?.datasets ?? [])
  const activeJob = computed(
    () => jobs.value.find((job) => job.id === overview.value?.activeJobId) ?? null,
  )
  const selectedJob = computed(
    () => jobs.value.find((job) => job.id === selectedJobId.value) ?? null,
  )
  const selectedLogs = computed(() => logs.value[selectedJobId.value])
  const readyCount = computed(() => overview.value?.readyJobs.length ?? 0)

  function jobById(id: TrainingJobId): TrainingJob | null {
    return jobs.value.find((job) => job.id === id) ?? null
  }

  function datasetFor(job: TrainingJob): TrainingDataset | null {
    return datasets.value.find((dataset) => dataset.id === job.datasetId) ?? null
  }

  async function refresh(silent = false): Promise<void> {
    if (refreshPromise) return refreshPromise
    loading.value = overview.value === null
    if (!silent) error.value = ''
    refreshPromise = request<OverviewEnvelope>('/api/training/overview')
      .then((payload) => {
        const hadOverview = overview.value !== null
        const selectedIsKnown = payload.jobs.some((job) => job.id === selectedJobId.value)
        overview.value = {
          workspace: payload.workspace,
          activeJobId: payload.activeJobId,
          readyJobs: payload.readyJobs,
          datasets: payload.datasets,
          jobs: payload.jobs,
        }
        if (payload.activeJobId && (!hadOverview || !selectedIsKnown)) {
          selectedJobId.value = payload.activeJobId
        }
      })
      .catch((cause: unknown) => {
        if (!silent || overview.value === null) {
          error.value = cause instanceof Error ? cause.message : String(cause)
        }
      })
      .finally(() => {
        loading.value = false
        refreshPromise = null
      })
    return refreshPromise
  }

  function updateJob(job: TrainingJob): void {
    if (!overview.value) return
    overview.value.jobs = overview.value.jobs.map((current) => current.id === job.id ? job : current)
    overview.value.activeJobId =
      job.status === 'running' || job.status === 'stopping'
        ? job.id
        : overview.value.activeJobId === job.id
          ? null
          : overview.value.activeJobId
  }

  async function start(id: TrainingJobId, overrides?: TrainingParamOverrides): Promise<void> {
    actionJobId.value = id
    error.value = ''
    try {
      const payload = await request<JobEnvelope>('/api/training/jobs', {
        method: 'POST',
        body: JSON.stringify({ id, overrides: overrides ?? {} }),
      })
      updateJob(payload.job)
      selectedJobId.value = id
      logs.value[id] = emptyLogState()
      await loadLogs(id)
      await refresh()
    } catch (cause: unknown) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      actionJobId.value = null
    }
  }

  async function stop(id: TrainingJobId): Promise<void> {
    actionJobId.value = id
    error.value = ''
    try {
      const payload = await request<JobEnvelope>(`/api/training/jobs/${encodeURIComponent(id)}/stop`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      updateJob(payload.job)
      selectedJobId.value = id
      await loadLogs(id)
      await refresh()
    } catch (cause: unknown) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      actionJobId.value = null
    }
  }

  async function loadLogs(id: TrainingJobId): Promise<void> {
    const state = logs.value[id]
    if (state.loading) return
    state.loading = true
    state.error = ''
    try {
      const params = new URLSearchParams({
        cursor: String(state.cursor),
        version: String(state.version),
      })
      const payload = await request<LogsEnvelope>(
        `/api/training/jobs/${encodeURIComponent(id)}/logs?${params.toString()}`,
      )
      const nextText = payload.reset ? payload.text : state.text + payload.text
      state.text = nextText.length > MAX_VISIBLE_LOG_CHARS
        ? nextText.slice(-MAX_VISIBLE_LOG_CHARS)
        : nextText
      state.cursor = payload.nextCursor
      state.version = payload.version
    } catch (cause: unknown) {
      state.error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      state.loading = false
    }
  }

  async function loadJobConfig(id: TrainingJobId): Promise<TrainingJobConfig | null> {
    try {
      const payload = await request<ConfigEnvelope>(`/api/training/jobs/${encodeURIComponent(id)}/config`)
      return payload.config
    } catch (cause: unknown) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return null
    }
  }

  function selectJob(id: TrainingJobId): void {
    selectedJobId.value = id
  }

  function clearError(): void {
    error.value = ''
  }

  function reset(): void {
    overview.value = null
    error.value = ''
    actionJobId.value = null
    selectedJobId.value = TRAINING_JOB_IDS[0]
    for (const id of TRAINING_JOB_IDS) logs.value[id] = emptyLogState()
  }

  return {
    overview,
    loading,
    error,
    actionJobId,
    selectedJobId,
    logs,
    jobs,
    datasets,
    activeJob,
    selectedJob,
    selectedLogs,
    readyCount,
    jobById,
    datasetFor,
    refresh,
    start,
    stop,
    loadJobConfig,
    loadLogs,
    selectJob,
    clearError,
    reset,
  }
})
