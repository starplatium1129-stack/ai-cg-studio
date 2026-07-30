type ParticleFrame = (now: number) => void

interface ScheduledParticle {
  frame: ParticleFrame
  interval: number
  nextAt: number
}

const particles = new Map<number, ScheduledParticle>()
let nextId = 0
let rafId = 0
let visibilityBound = false

function schedule(): void {
  if (rafId || !particles.size || (typeof document !== 'undefined' && document.hidden)) return
  rafId = requestAnimationFrame(tick)
}

function tick(now: number): void {
  rafId = 0
  if (document.hidden) return
  for (const item of particles.values()) {
    if (now < item.nextAt) continue
    item.nextAt = now + item.interval
    item.frame(now)
  }
  schedule()
}

function bindVisibility(): void {
  if (visibilityBound || typeof document === 'undefined') return
  visibilityBound = true
  document.addEventListener('visibilitychange', schedule)
}

/** One RAF drives every particle canvas; ambient layers are intentionally throttled. */
export function registerParticleFrame(frame: ParticleFrame, fps = 30): () => void {
  bindVisibility()
  const id = ++nextId
  particles.set(id, { frame, interval: 1000 / Math.max(12, fps), nextAt: 0 })
  schedule()
  return () => {
    particles.delete(id)
    if (!particles.size && rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }
}
