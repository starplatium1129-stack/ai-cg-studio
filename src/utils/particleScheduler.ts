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
    // interval === 0（fps<=0 原生模式）跟随每个 rAF；节流条目按 interval 跳帧。
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

/** One RAF drives every particle canvas; throttled layers skip frames. */
export function registerParticleFrame(frame: ParticleFrame, fps = 30): () => void {
  bindVisibility()
  const id = ++nextId
  // fps <= 0 走原生刷新率（每个 rAF 都渲染，跑满显示器刷新率）；
  // fps > 0 均视为节流请求（interval = 1000/fps）。
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
