export const TRAINING_JOB_IDS = [
  'lora-nene-v18',
  'lora-natsume-v18',
  'voice-nene',
  'voice-natsume',
] as const

export type TrainingJobId = (typeof TRAINING_JOB_IDS)[number]
export type TrainingKind = 'lora' | 'voice'
export type TrainingCharacter = 'nene' | 'natsume'
export type TrainingJobStatus =
  | 'idle'
  | 'running'
  | 'stopping'
  | 'completed'
  | 'failed'
  | 'stopped'

export interface TrainingProgress {
  stage: string
  message: string
  percent: number
  epoch?: number
  epochs?: number
  step?: number
  steps?: number
  loss?: number
}

export interface TrainingDataset {
  id: string
  kind: TrainingKind
  character: TrainingCharacter
  version: string
  ready: boolean
  images: number
  captions: number
  bytes: number
  categories: Record<string, number>
  trainSamples?: number
  evalSamples?: number
  testSamples?: number
  wavs?: number
  missing: string[]
  preview: {
    available: boolean
    label: string
    blurred: boolean
  }
  adultPreview: {
    available: boolean
    label: string
    blurred: boolean
  }
}

export interface TrainingJob {
  id: TrainingJobId
  kind: TrainingKind
  character: TrainingCharacter
  label: string
  datasetId: string
  ready: boolean
  missing: string[]
  configName?: string
  status: TrainingJobStatus
  pid: number
  startedAt: number
  finishedAt: number
  exitCode: number | null
  error: string
  runCount: number
  logVersion: number
  progress: TrainingProgress
}

export interface TrainingOverview {
  workspace: {
    available: boolean
    name: string
  }
  activeJobId: TrainingJobId | null
  readyJobs: TrainingJobId[]
  datasets: TrainingDataset[]
  jobs: TrainingJob[]
}

export interface TrainingLogResponse {
  id: TrainingJobId
  cursor: number
  nextCursor: number
  reset: boolean
  version: number
  text: string
  lines: string[]
}

export interface TrainingLogState {
  text: string
  cursor: number
  version: number
  loading: boolean
  error: string
}

export interface TrainingPlan {
  character: TrainingCharacter
  identity: string[]
  outfit: {
    label: string
    token: string
  }
  epochs: number
}

export interface TrainingParamOverrides {
  epochs?: number
  batch_size?: number
  gradient_accumulation_steps?: number
  lora_rank?: number
  lora_alpha?: number
  unet_learning_rate?: number
  text_encoder_learning_rate?: number
  text_encoder_stop_epoch?: number
}

export interface TrainingJobConfig {
  id: TrainingJobId
  kind: TrainingKind
  available: boolean
  fields: Record<string, number>
  recommended: Record<string, number>
}

export interface TrainingApiError {
  ok: false
  error: string
  detail?: string
  code?: string
}
