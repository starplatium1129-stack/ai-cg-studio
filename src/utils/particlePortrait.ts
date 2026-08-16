import type { ParticlePoint } from './particleShapes'

/**
 * 角色形象粒子（2026-08-16）：粒子不再只是抽象形状+主色，而是直接重组出
 * 「这个角色的剪影」。点云由离线维护脚本（scripts/maintenance/
 * build-particle-portraits.py，rembg 抠图 + 轮廓加权采样）预生成到
 * `assets/particles/p_<角色id>.json`，前端按需懒加载、按粒子数二次采样；
 * 没有点云的角色自动回落到 characterParticleTheme 的抽象形状。
 */
export interface PortraitCloud {
  id: string
  /** 抠图后包围盒的宽高比（w/h）。 */
  aspect: number
  /** k-means 提取的人物主色（按占比降序），粒子按真实配色成像。 */
  palette: string[]
  /** 扁平数组 [x, y, c, ...]；x/y 已量化到 0..1000（相对包围盒），c 为调色板序号。 */
  points: number[]
}

const cloudCache = new Map<string, PortraitCloud | null>()
const pendingLoads = new Map<string, Promise<PortraitCloud | null>>()

export function portraitCloudUrl(id: string): string {
  return `/assets/particles/p_${encodeURIComponent(id)}.json`
}

/** 懒加载角色点云；不存在（404）或失败返回 null，结果缓存（含失败，避免反复 404）。 */
export function loadPortraitCloud(id: string): Promise<PortraitCloud | null> {
  if (!id) return Promise.resolve(null)
  const cached = cloudCache.get(id)
  if (cached !== undefined) return Promise.resolve(cached)
  const pending = pendingLoads.get(id)
  if (pending) return pending
  const task = fetch(portraitCloudUrl(id))
    .then(async res => {
      const cloud = res.ok ? await res.json() as PortraitCloud : null
      const usable = cloud
        && Array.isArray(cloud.points) && cloud.points.length >= 90
        && Array.isArray(cloud.palette) && cloud.palette.length > 0
      cloudCache.set(id, usable ? cloud : null)
      return cloudCache.get(id) ?? null
    })
    .catch(() => {
      cloudCache.set(id, null)
      return null
    })
    .finally(() => { pendingLoads.delete(id) })
  pendingLoads.set(id, task)
  return task
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

function idHash(id: string): number {
  let hash = 5381
  for (let index = 0; index < id.length; index += 1) hash = (hash * 33) ^ id.charCodeAt(index)
  return hash >>> 0
}

/**
 * 把点云二次采样到目标粒子数，并按场域宽高做等比缩放（人物不变形）：
 * 点云坐标先归一到「高=1、宽=aspect」的盒子，再整体缩放到场域内接、居中。
 * 返回按行带排序的点（与 createParticleShape 一致，形变动画按行过渡更稳）。
 */
export function samplePortraitPoints(cloud: PortraitCloud, count: number, fieldAspect: number): ParticlePoint[] {
  const flat = cloud.points
  const total = Math.floor(flat.length / 3)
  if (!total || !fieldAspect) return []

  const random = mulberry32(idHash(cloud.id) ^ (count * 2654435761))
  const order = Array.from({ length: total }, (_, index) => index)
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const take = Math.min(count, total)
  const picked = order.slice(0, take)

  // 人物等比放进场域：以场域短边为限内接，最长边贴边
  const charAspect = cloud.aspect > 0 ? cloud.aspect : 1
  let boxW: number
  let boxH: number
  if (charAspect >= fieldAspect) {
    boxW = 0.96
    boxH = 0.96 * (fieldAspect / charAspect)
  } else {
    boxH = 0.96
    boxW = 0.96 * (charAspect / fieldAspect)
  }

  const points: ParticlePoint[] = picked.map(index => ({
    x: 0.5 + ((flat[index * 3] / 1000) - 0.5) * boxW,
    y: 0.5 + ((flat[index * 3 + 1] / 1000) - 0.5) * boxH,
    tone: 0,
    paint: flat[index * 3 + 2],
  }))

  points.sort((a, b) => {
    const rowA = Math.round(a.y * 18)
    const rowB = Math.round(b.y * 18)
    return rowA === rowB ? a.x - b.x : rowA - rowB
  })
  return points
}
