import { ref } from 'vue'
import type { TrainingJob, TrainingJobId } from '@/types/training'

export interface TrainingStepSample {
  t: number
  step: number
}

export function formatTrainingEta(samples: TrainingStepSample[], step: number, steps: number): string {
  if (steps <= 0 || step <= 0 || samples.length < 2) return ''
  const first = samples[0]
  const last = samples[samples.length - 1]
  const seconds = Math.max(1, (last.t - first.t) / 1000)
  const rate = Math.max(0, (last.step - first.step) / seconds)
  if (rate <= 0) return ''
  const remaining = Math.round((steps - step) / rate)
  if (remaining < 60) return '预计不足 1 分钟'
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.round((remaining % 3600) / 60)
  return hours > 0 ? `预计约 ${hours} 小时 ${minutes} 分` : `预计约 ${minutes} 分钟`
}

export function trainingLossPolyline(points: number[]): string {
  if (points.length < 2) return ''
  const width = 160
  const height = 30
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = Math.max(1e-9, max - min)
  const stepX = width / (points.length - 1)
  return points
    .map((value, index) => {
      const x = (index * stepX).toFixed(1)
      const y = (height - 3 - ((value - min) / span) * (height - 6)).toFixed(1)
      return `${x},${y}`
    })
    .join(' ')
}

export function useTrainingTelemetry(now: () => number = () => Date.now()) {
  const lossHistory = ref<Partial<Record<TrainingJobId, number[]>>>({})
  const stepSamples = ref<Partial<Record<TrainingJobId, TrainingStepSample[]>>>({})

  function sampleStep(job: TrainingJob): void {
    if (typeof job.progress.step !== 'number' || typeof job.progress.steps !== 'number') return
    if (job.progress.steps <= 0) return
    let samples = stepSamples.value[job.id]
    if (!samples) {
      samples = []
      stepSamples.value[job.id] = samples
    }
    const last = samples[samples.length - 1]
    if (last && job.progress.step === last.step) return
    samples.push({ t: now(), step: job.progress.step })
    if (samples.length > 8) samples.shift()
  }

  function etaText(job: TrainingJob): string {
    if (typeof job.progress.step !== 'number' || typeof job.progress.steps !== 'number') return ''
    return formatTrainingEta(stepSamples.value[job.id] ?? [], job.progress.step, job.progress.steps)
  }

  function sampleLoss(job: TrainingJob): void {
    if (typeof job.progress.loss !== 'number') return
    let points = lossHistory.value[job.id]
    if (!points) {
      points = []
      lossHistory.value[job.id] = points
    }
    if (points.length === 0 || points[points.length - 1] !== job.progress.loss) {
      points.push(job.progress.loss)
      if (points.length > 40) points.shift()
    }
  }

  function lossPolyline(id: TrainingJobId): string {
    return trainingLossPolyline(lossHistory.value[id] ?? [])
  }

  function resetJobTelemetry(id: TrainingJobId): void {
    lossHistory.value[id] = []
    stepSamples.value[id] = []
  }

  return {
    lossHistory,
    stepSamples,
    sampleStep,
    etaText,
    sampleLoss,
    lossPolyline,
    resetJobTelemetry,
  }
}
