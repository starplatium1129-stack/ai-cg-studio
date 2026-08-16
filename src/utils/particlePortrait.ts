import type { ParticlePoint } from './particleShapes'

/**
 * 角色形象粒子（2026-08-16）：粒子直接重组为「这个角色的剪影」，形状与
 * 配色都来自立绘本身。离线脚本（scripts/maintenance/build-particle-portraits.py，
 * rembg 抠图 + k-means 主色）预生成覆盖网格到 `assets/particles/p_<角色id>.json`。
 *
 * 前端在运行时按场域实际尺寸把覆盖网格重建成**等距点阵**（明日方舟官网式
 * 点阵成像）：点距恒定均匀、人物明暗由网点大小/颜色表达——非均匀的加权
 * 采样会产生疏密空洞，已废弃。
 */
export interface PortraitCloud {
  id: string
  /** 图片宽高比（w/h）。 */
  aspect: number
  /** k-means 主色（按占比降序，最多 36 色支持 base36 索引）。 */
  palette: string[]
  /** 覆盖网格：'.'=透明，其余为 base36 调色板序号（0-9a-v），按行拼接。 */
  grid: {
    w: number
    h: number
    cells: string
  }
}

/** 点阵采样结果：粒子目标点 + 内容盒尺寸 + 网点间距（像素）。 */
export interface PortraitSample {
  points: ParticlePoint[]
  /** 内容盒在场域归一化坐标中的宽/高（0..1）。 */
  boxW: number
  boxH: number
  /** 点阵间距（场域 CSS 像素）——网点半径按它与明暗调制。 */
  spacing: number
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
        && Array.isArray(cloud.palette) && cloud.palette.length > 0
        && cloud.grid && cloud.grid.w > 4 && cloud.grid.h > 4
        && typeof cloud.grid.cells === 'string'
        && cloud.grid.cells.length >= cloud.grid.w * cloud.grid.h * 0.9
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

/**
 * 背景剔除（2026-08-16，对齐参考实现 Arknights-FlowingPoints 的「透明底剪影」）：
 * 整图点云把立绘背景也编进了网格，粒子场会呈现「矩形贴纸感」。这里取网格最外
 * 两圈的调色板序号分布：
 * - 外圈填充率 ≥30%（说明素材无透明通道、背景被整块编码）→ 把占比 ≥15% 的外圈
 *   主色视为背景色，采样时整块剔除（立绘背景常为单一主色/渐变优势色，剔除后
 *   人物剪影浮现，内部同色背景块一并消失）；
 * - 外圈近乎透明（已是抠图素材）→ 返回 null 跳过，避免误删人物边缘发色/肤色。
 * 保守上限 3 个背景色：超过说明背景杂乱（多色噪点底），不剔除以免误伤。
 */
function backgroundPaintIndices(cloud: PortraitCloud): Set<number> | null {
  const { w, h, cells } = cloud.grid
  if (w < 8 || h < 8) return null
  const counts = new Map<number, number>()
  let borderFilled = 0
  let borderTotal = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const onBorder = x < 2 || y < 2 || x >= w - 2 || y >= h - 2
      if (!onBorder) continue
      borderTotal += 1
      const cell = cells[y * w + x]
      if (cell === '.') continue
      borderFilled += 1
      const paint = parseInt(cell, 36)
      if (!Number.isNaN(paint)) counts.set(paint, (counts.get(paint) ?? 0) + 1)
    }
  }
  if (borderFilled / Math.max(1, borderTotal) < 0.3) return null
  const threshold = borderFilled * 0.15
  const backgrounds = new Set<number>()
  counts.forEach((count, paint) => {
    if (count >= threshold) backgrounds.add(paint)
  })
  return backgrounds.size > 0 && backgrounds.size <= 3 ? backgrounds : null
}

/**
 * 在场域内重建等距点阵：
 * 1. 内容盒——人物按宽高比等比放进场域（最长边 0.96，居中，不变形）；
 * 2. 网格——以「boxW·width × boxH·height 像素 / 目标粒子数」求正方形单元边长，
 *    得到 cols×rows 的均匀点阵（屏幕上点距处处相等，无各向异性）；
 * 3. 采样——每个点阵单元中心映射到覆盖网格最近格，'.' 或背景色跳过、数字取色调；
 * 4. 输出按行带排序（形变动画按行过渡更稳）。
 */
export function samplePortraitPoints(
  cloud: PortraitCloud,
  count: number,
  fieldWidth: number,
  fieldHeight: number,
): PortraitSample {
  if (!cloud.grid || count < 8 || fieldWidth < 2 || fieldHeight < 2) {
    return { points: [], boxW: 1, boxH: 1, spacing: 1 }
  }
  const fieldAspect = fieldWidth / fieldHeight
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

  const boxPxW = Math.max(8, boxW * fieldWidth)
  const boxPxH = Math.max(8, boxH * fieldHeight)
  const { w: gw, h: gh, cells } = cloud.grid
  const backgrounds = backgroundPaintIndices(cloud)
  // 覆盖网格里人物平均占比约 0.55（含空洞）；背景剔除后按有效占比重新估计，
  // 点阵单元据此放大间距避免超采。
  const coverage = estimateCoverage(cloud, backgrounds)
  const spacing = Math.sqrt(boxPxW * boxPxH * coverage / count)
  const cols = Math.max(2, Math.round(boxPxW / spacing))
  const rows = Math.max(2, Math.round(boxPxH / spacing))

  const points: ParticlePoint[] = []
  for (let row = 0; row < rows; row += 1) {
    const yNorm = (row + 0.5) / rows
    const gy = Math.min(gh - 1, Math.floor(yNorm * gh))
    const rowBase = gy * gw
    for (let col = 0; col < cols; col += 1) {
      const xNorm = (col + 0.5) / cols
      const gx = Math.min(gw - 1, Math.floor(xNorm * gw))
      const cell = cells[rowBase + gx]
      if (cell === '.') continue
      const paint = parseInt(cell, 36)
      if (Number.isNaN(paint) || paint >= cloud.palette.length) continue
      if (backgrounds?.has(paint)) continue
      points.push({
        x: 0.5 + (xNorm - 0.5) * boxW,
        y: 0.5 + (yNorm - 0.5) * boxH,
        tone: 0,
        paint,
      })
    }
  }

  points.sort((a, b) => {
    const rowA = Math.round(a.y * 18)
    const rowB = Math.round(b.y * 18)
    return rowA === rowB ? a.x - b.x : rowA - rowB
  })
  return { points, boxW, boxH, spacing }
}

function estimateCoverage(cloud: PortraitCloud, backgrounds: Set<number> | null): number {
  const { cells } = cloud.grid
  let filled = 0
  for (let index = 0; index < cells.length; index += 1) {
    if (cells[index] === '.') continue
    if (backgrounds) {
      const paint = parseInt(cells[index], 36)
      if (!Number.isNaN(paint) && backgrounds.has(paint)) continue
    }
    filled += 1
  }
  const ratio = filled / Math.max(1, cells.length)
  return Math.min(0.98, Math.max(0.25, ratio))
}
