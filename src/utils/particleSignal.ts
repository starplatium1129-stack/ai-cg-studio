import type { ParticleShapeId } from '@/utils/particleShapes'

export type ParticleSignalState = 'idle' | 'active' | 'success' | 'warning'

export interface ParticleSignalDetail {
  state: ParticleSignalState
  shape?: ParticleShapeId
  label?: string
  duration?: number
}

export const PARTICLE_SIGNAL_EVENT = 'aics:particle-signal'

export function emitParticleSignal(detail: ParticleSignalDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ParticleSignalDetail>(PARTICLE_SIGNAL_EVENT, { detail }))
}
