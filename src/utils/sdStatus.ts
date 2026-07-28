export interface SDStatus {
  online: boolean
  checkpoint: string
  samplers: string[]
  models: string[]
  schedulers: string[]
  upscalers: string[]
}

export interface SDProgress {
  ratio: number
  etaSeconds: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionName(value: unknown, fields: string[]): string {
  if (typeof value === 'string') return value.trim()
  if (!isRecord(value)) return ''
  for (const field of fields) {
    if (typeof value[field] === 'string' && value[field].trim()) return value[field].trim()
  }
  return ''
}

export function parseSDOptionList(value: unknown, fields: string[] = ['name']): string[] {
  return Array.isArray(value)
    ? value.map(item => optionName(item, fields)).filter(Boolean)
    : []
}

export function parseSDStatus(value: unknown): SDStatus {
  const status = isRecord(value) ? value : {}
  return {
    online: status.online === true,
    checkpoint: typeof status.checkpoint === 'string' ? status.checkpoint : '',
    models: parseSDOptionList(status.models, ['title', 'model_name', 'name']),
    samplers: parseSDOptionList(status.samplers),
    schedulers: parseSDOptionList(status.schedulers, ['name', 'label']),
    upscalers: parseSDOptionList(status.upscalers),
  }
}

export function parseSDProgress(value: unknown): SDProgress {
  const progress = isRecord(value) ? value : {}
  const state = isRecord(progress.state) ? progress.state : {}
  const reported = Number(progress.progress)
  const samplingSteps = Number(state.sampling_steps)
  const stepProgress = samplingSteps > 0
    ? Number(state.sampling_step ?? 0) / samplingSteps
    : 0
  const ratio = Math.max(
    Number.isFinite(reported) ? reported : 0,
    Number.isFinite(stepProgress) ? stepProgress : 0,
  )
  return {
    ratio: Math.min(1, Math.max(0, ratio)),
    etaSeconds: Math.max(0, Math.ceil(Number(progress.eta_relative) || 0)),
  }
}
