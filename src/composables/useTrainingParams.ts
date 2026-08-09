import { ref } from 'vue'
import type { TrainingJobConfig, TrainingJobId, TrainingParamOverrides } from '@/types/training'

export const loraParamFields = [
  { key: 'epochs', label: '训练轮数', unit: 'epoch', step: 1, min: 1, max: 500 },
  { key: 'batch_size', label: '批量大小', unit: '', step: 1, min: 1, max: 16 },
  { key: 'gradient_accumulation_steps', label: '梯度累积', unit: '步', step: 1, min: 1, max: 8 },
  { key: 'lora_rank', label: 'LoRA 秩', unit: '', step: 1, min: 4, max: 128 },
  { key: 'lora_alpha', label: 'LoRA Alpha', unit: '', step: 1, min: 4, max: 128 },
  { key: 'unet_learning_rate', label: 'UNet 学习率', unit: '', step: 1e-5, min: 1e-7, max: 1e-3 },
  { key: 'text_encoder_learning_rate', label: '文本编码器学习率', unit: '', step: 1e-6, min: 1e-7, max: 1e-3 },
  { key: 'text_encoder_stop_epoch', label: '文本编码器停训', unit: '轮', step: 1, min: 0, max: 500 },
] as const

export type ParamKey = (typeof loraParamFields)[number]['key']

export interface ParamDraft {
  loading: boolean
  error: string
  values: Record<string, number> | null
  recommended: Record<string, number> | null
}

interface TrainingStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface UseTrainingParamsOptions {
  loadJobConfig: (id: TrainingJobId) => Promise<TrainingJobConfig | null>
  showToast: (message: string) => void
  storage?: TrainingStorage
}

function browserStorage(): TrainingStorage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function safeGet(storage: TrainingStorage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(storage: TrainingStorage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch {
    // Private browsing storage failures must not break the workbench.
  }
}

function safeRemove(storage: TrainingStorage | undefined, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    // Private browsing storage failures must not break the workbench.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function useTrainingParams(options: UseTrainingParamsOptions) {
  const storage = options.storage ?? browserStorage()
  const paramDrafts = ref<Partial<Record<TrainingJobId, ParamDraft>>>({})
  const pending: Partial<Record<TrainingJobId, Promise<void>>> = {}

  function paramsKey(id: TrainingJobId): string {
    return `aics_training_params_${id}`
  }

  function draftFor(id: TrainingJobId): ParamDraft {
    let draft = paramDrafts.value[id]
    if (!draft) {
      draft = { loading: false, error: '', values: null, recommended: null }
      paramDrafts.value[id] = draft
    }
    return draft
  }

  async function ensureParams(id: TrainingJobId): Promise<void> {
    const draft = draftFor(id)
    if (draft.values) return
    if (pending[id]) return pending[id]

    let request: Promise<void>
    request = (async () => {
      draft.loading = true
      draft.error = ''
      try {
        const config = await options.loadJobConfig(id)
        if (!config?.available || !config.fields) {
          draft.error = '无法读取训练配置，参数面板不可用。'
          return
        }
        draft.recommended = { ...config.recommended }
        const values = { ...config.recommended }
        const savedText = safeGet(storage, paramsKey(id))
        if (savedText) {
          try {
            const saved: unknown = JSON.parse(savedText)
            if (isRecord(saved)) {
              for (const field of loraParamFields) {
                const value = saved[field.key]
                if (typeof value === 'number' && Number.isFinite(value)) values[field.key] = value
              }
            }
          } catch {
            // Invalid drafts are ignored and replaced by recommended values.
          }
        }
        draft.values = values
      } catch (cause: unknown) {
        draft.error = `无法读取训练配置：${cause instanceof Error ? cause.message : String(cause)}`
      } finally {
        draft.loading = false
      }
    })()
    pending[id] = request
    try {
      await request
    } finally {
      if (pending[id] === request) delete pending[id]
    }
  }

  function paramValue(id: TrainingJobId, key: string): number | '' {
    const draft = draftFor(id)
    const value = draft.values?.[key] ?? draft.recommended?.[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : ''
  }

  function persist(id: TrainingJobId, values: Record<string, number>): void {
    safeSet(storage, paramsKey(id), JSON.stringify(values))
  }

  function setParam(id: TrainingJobId, key: string, raw: string): void {
    const draft = draftFor(id)
    if (!draft.values || !draft.recommended) return
    const field = loraParamFields.find((item) => item.key === key)
    if (!field) return
    if (raw === '') {
      delete draft.values[key]
      persist(id, draft.values)
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    if (parsed < field.min) {
      draft.values[key] = field.min
      persist(id, draft.values)
      options.showToast(`${field.label} 不能低于 ${field.min}，已设为 ${field.min}`)
      return
    }
    if (parsed > field.max) {
      draft.values[key] = field.max
      persist(id, draft.values)
      options.showToast(`${field.label} 不能高于 ${field.max}，已设为 ${field.max}`)
      return
    }
    draft.values[key] = parsed
    persist(id, draft.values)
  }

  function resetParams(id: TrainingJobId): void {
    const draft = draftFor(id)
    if (!draft.recommended) return
    draft.values = { ...draft.recommended }
    safeRemove(storage, paramsKey(id))
  }

  function overridesFor(id: TrainingJobId): TrainingParamOverrides {
    const draft = draftFor(id)
    const overrides: TrainingParamOverrides = {}
    if (!draft.values || !draft.recommended) return overrides
    for (const field of loraParamFields) {
      const current = draft.values[field.key]
      const recommended = draft.recommended[field.key]
      if (typeof current === 'number' && Number.isFinite(current)
        && typeof recommended === 'number' && Number.isFinite(recommended)
        && current !== recommended) {
        ;(overrides as Record<string, number>)[field.key] = current
      }
    }
    return overrides
  }

  function formatLr(value: number | ''): string {
    if (value === '') return '—'
    if (value >= 1e-3) return String(value)
    if (value >= 1e-5) return String(value).replace(/0+$/, '')
    return value.toExponential(1).replace(/\.0/, '')
  }

  return {
    loraParamFields,
    paramDrafts,
    paramsKey,
    draftFor,
    ensureParams,
    paramValue,
    setParam,
    resetParams,
    overridesFor,
    formatLr,
  }
}
