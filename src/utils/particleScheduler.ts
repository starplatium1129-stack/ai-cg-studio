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
  // fps <= 0 走原生刷新率；fps > 0 均视为节流请求（60fps hero 在 165Hz 屏上
  // 会被限制到 60fps，45/30fps 氛围层同理）。
  const interval = fps <= 0 ? 0 : 1000 / Math.max(12, fps)
  particles.set(id, { frame, interval, nextAt: 0 })
  schedule()
  return () => {
    particles.delete(id)
    if (!particles.size && rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }
}
