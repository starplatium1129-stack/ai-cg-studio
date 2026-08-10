export interface AnimaOption {
  id: string
  label?: string
  name?: string
  character?: string
  preview?: boolean
  validation?: string
  available?: boolean
}

export type AnimaPhase = 'idle' | 'submitting' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled'

export interface AnimaJobMetadata {
  engine: 'anima'
  id: string
  prompt: string
  negative: string
  profileId: string
  modelId: string
  loraId: string
  loraStrength: number
  width: number
  height: number
  steps: number
  cfg: number
  sampler: string
  scheduler: string
  seed: number
  character: 'nene' | 'natsume'
  preview?: boolean
  createdAt: number
  resultUrl: string | null
}

export interface AnimaResult {
  url: string
  blob: Blob
  metadata: AnimaJobMetadata
}

export interface AnimaGenerationState {
  phase: AnimaPhase
  online: boolean
  checkMsg: string
  models: AnimaOption[]
  loras: AnimaOption[]
  prompt: string
  negative: string
  modelId: string
  loraId: string
  loraStrength: number
  width: number
  height: number
  steps: number
  cfg: number
  sampler: string
  scheduler: string
  seed: number | null
  job: AnimaJobMetadata | null
  result: AnimaResult | null
  statusText: string
  errorMsg: string
}
