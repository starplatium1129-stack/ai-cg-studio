export interface AnimaOption {
  id: string
  label?: string
  name?: string
  character?: string
  preview?: boolean
  validation?: string
  available?: boolean
  family?: 'anima' | 'krea2'
  profileId?: string
  defaults?: Record<string, unknown>
  capabilities?: { negative: boolean; lora: boolean; noLora?: boolean; characterIdentity: boolean; experimental: boolean }
  sizes?: string[]
}

export interface KreaStyleLoraOption {
  id: string
  trigger: string
  recommendedStrength: number
  available: boolean
}

export type AnimaPhase = 'idle' | 'submitting' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled'

export interface AnimaJobMetadata {
  engine: 'anima' | 'krea2'
  id: string
  prompt: string
  negative: string
  profileId: string
  modelId: string
  loraId: string | null
  loraStrength: number | null
  loras?: Array<{ id: string; strength: number }>
  styleLoraId?: string | null
  width: number
  height: number
  steps: number
  cfg: number
  sampler: string
  scheduler: string
  seed: number
  character: 'nene' | 'natsume' | 'triad' | null
  preview?: boolean
  hiresFix?: boolean
  hiresScale?: number
  hiresDenoise?: number
  teaCache?: boolean
  teaCacheThresh?: number
  initImage?: string | null
  maskImage?: string | null
  maskPrompt?: string | null
  denoisingStrength?: number
  growMaskBy?: number
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
  /** ComfyUI 当前只通过轮询提供阶段；未知采样步数时保持 null，禁止伪造百分比。 */
  progress: number | null
  elapsedSeconds: number
  progressText: string
  currentNode: string | null
  online: boolean
  checkMsg: string
  models: AnimaOption[]
  loras: AnimaOption[]
  styleLoras: KreaStyleLoraOption[]
  styleLoraId: string
  prompt: string
  negative: string
  modelId: string
  loraId: string
  loraStrength: number
  family: 'anima' | 'krea2'
  width: number
  height: number
  steps: number
  cfg: number
  sampler: string
  scheduler: string
  seed: number | null
  hiresFix?: boolean
  hiresScale?: number
  hiresDenoise?: number
  teaCache?: boolean
  teaCacheThresh?: number
  job: AnimaJobMetadata | null
  result: AnimaResult | null
  statusText: string
  errorMsg: string
}
