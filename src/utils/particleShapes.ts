export type ParticleShapeId =
  | 'atelier'
  | 'heart'
  | 'cup'
  | 'moon'
  | 'book'
  | 'mountain'
  | 'lantern'
  | 'frame'
  | 'spark'

export interface ParticlePoint {
  x: number
  y: number
  tone: 0 | 1 | 2
}

interface MutablePoint {
  x: number
  y: number
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = seed + 0x6d2b79f5 | 0
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

function line(a: MutablePoint, b: MutablePoint, t: number): MutablePoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function samplePolyline(points: MutablePoint[], t: number): MutablePoint {
  const segments = points.length - 1
  const position = Math.min(segments - Number.EPSILON, t * segments)
  const index = Math.floor(position)
  return line(points[index], points[index + 1], position - index)
}

function boundaryPoint(shape: ParticleShapeId, t: number, random: () => number): MutablePoint {
  const angle = t * Math.PI * 2

  if (shape === 'heart') {
    const x = 16 * Math.sin(angle) ** 3
    const y = 13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)
    return { x: 0.5 + x / 38, y: 0.5 - y / 38 }
  }

  if (shape === 'cup') {
    const cup = [
      { x: 0.24, y: 0.35 }, { x: 0.28, y: 0.72 }, { x: 0.65, y: 0.72 },
      { x: 0.7, y: 0.35 }, { x: 0.24, y: 0.35 },
    ]
    if (t < 0.72) return samplePolyline(cup, t / 0.72)
    const handleAngle = (t - 0.72) / 0.28 * Math.PI * 2
    return { x: 0.7 + Math.cos(handleAngle) * 0.13, y: 0.51 + Math.sin(handleAngle) * 0.16 }
  }

  if (shape === 'moon') {
    const ring = t < 0.64
    const local = ring ? t / 0.64 : (t - 0.64) / 0.36
    const arc = ring ? local * Math.PI * 2 : Math.PI * 0.56 + local * Math.PI * 0.88
    const radius = ring ? 0.3 : 0.24
    const cx = ring ? 0.47 : 0.57
    return { x: cx + Math.cos(arc) * radius, y: 0.5 + Math.sin(arc) * radius }
  }

  if (shape === 'book') {
    const outline = [
      { x: 0.16, y: 0.28 }, { x: 0.46, y: 0.34 }, { x: 0.5, y: 0.74 },
      { x: 0.54, y: 0.34 }, { x: 0.84, y: 0.28 }, { x: 0.8, y: 0.7 },
      { x: 0.5, y: 0.78 }, { x: 0.2, y: 0.7 }, { x: 0.16, y: 0.28 },
    ]
    return samplePolyline(outline, t)
  }

  if (shape === 'mountain') {
    const ridge = [
      { x: 0.1, y: 0.72 }, { x: 0.27, y: 0.48 }, { x: 0.37, y: 0.6 },
      { x: 0.56, y: 0.3 }, { x: 0.86, y: 0.72 }, { x: 0.1, y: 0.72 },
    ]
    return samplePolyline(ridge, t)
  }

  if (shape === 'lantern') {
    if (t < 0.16) return line({ x: 0.5, y: 0.14 }, { x: 0.5, y: 0.26 }, t / 0.16)
    if (t < 0.86) {
      const local = (t - 0.16) / 0.7
      const a = local * Math.PI * 2
      const width = 0.22 + 0.05 * Math.cos(a * 2)
      return { x: 0.5 + Math.cos(a) * width, y: 0.5 + Math.sin(a) * 0.27 }
    }
    return line({ x: 0.5, y: 0.74 }, { x: 0.5 + (random() - 0.5) * 0.08, y: 0.88 }, (t - 0.86) / 0.14)
  }

  if (shape === 'frame') {
    const frame = [
      { x: 0.17, y: 0.25 }, { x: 0.83, y: 0.25 }, { x: 0.83, y: 0.75 },
      { x: 0.17, y: 0.75 }, { x: 0.17, y: 0.25 },
    ]
    if (t < 0.78) return samplePolyline(frame, t / 0.78)
    return line({ x: 0.35, y: 0.5 }, { x: 0.65, y: 0.5 }, (t - 0.78) / 0.22)
  }

  if (shape === 'spark') {
    const rays = 8
    const scaled = t * rays
    const ray = Math.floor(scaled)
    const local = scaled - ray
    const rayAngle = ray / rays * Math.PI * 2
    const radius = local < 0.5 ? 0.06 + local * 0.62 : 0.37 - (local - 0.5) * 0.62
    return { x: 0.5 + Math.cos(rayAngle) * radius, y: 0.5 + Math.sin(rayAngle) * radius }
  }

  // Atelier：双轨椭圆与一条穿过中心的创作轴，作为首页原创母题。
  if (t < 0.42) return { x: 0.5 + Math.cos(angle / 0.42) * 0.32, y: 0.5 + Math.sin(angle / 0.42) * 0.22 }
  if (t < 0.8) {
    const localAngle = (t - 0.42) / 0.38 * Math.PI * 2
    return { x: 0.5 + Math.cos(localAngle) * 0.19, y: 0.5 + Math.sin(localAngle) * 0.31 }
  }
  return line({ x: 0.18, y: 0.72 }, { x: 0.82, y: 0.28 }, (t - 0.8) / 0.2)
}

export function createParticleShape(shape: ParticleShapeId, count: number): ParticlePoint[] {
  const seed = [...shape].reduce((value, character) => value + character.charCodeAt(0), 1729)
  const random = mulberry32(seed + count)
  const points: ParticlePoint[] = []

  for (let index = 0; index < count; index += 1) {
    const t = (index + random() * 0.42) / count
    const boundary = boundaryPoint(shape, t, random)
    const isInner = index % 5 === 0
    const depth = isInner ? 0.22 + random() * 0.72 : 0.88 + random() * 0.12
    const jitter = isInner ? 0.012 : 0.006
    const x = 0.5 + (boundary.x - 0.5) * depth + (random() - 0.5) * jitter
    const y = 0.5 + (boundary.y - 0.5) * depth + (random() - 0.5) * jitter
    points.push({ x, y, tone: index % 17 === 0 ? 2 : index % 4 === 0 ? 1 : 0 })
  }

  return points.sort((a, b) => {
    const rowA = Math.round(a.y * 18)
    const rowB = Math.round(b.y * 18)
    return rowA === rowB ? a.x - b.x : rowA - rowB
  })
}
