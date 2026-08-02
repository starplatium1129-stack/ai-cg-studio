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
    // The hero field follows every native RAF. Comparing against 16.67ms
    // is enough to accidentally skip alternate frames on a 60Hz display.
    if (item.interval && now + 0.5 < item.nextAt) continue
    if (item.interval) {
      item.nextAt = item.nextAt ? item.nextAt + item.interval : now + item.interval
      if (item.nextAt < now - item.interval) item.nextAt = now + item.interval
    }
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
  const nativeRefresh = fps <= 0 || fps >= 55
  const requestedFps = Math.max(12, fps)
  particles.set(id, { frame, interval: nativeRefresh ? 0 : 1000 / requestedFps, nextAt: 0 })
  schedule()
  return () => {
    particles.delete(id)
    if (!particles.size && rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }
}
