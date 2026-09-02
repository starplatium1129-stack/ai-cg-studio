/**
 * 等高行展墙排版（justified rows，也称「画廊挂画布局」）。
 *
 * 解决的问题：固定列网格要求同一行所有卡片等高，横图会被挤到顶部、下方
 * 留出整片空白；纯瀑布流虽然无空洞，但底边参差、收尾难看，横图也永远被
 * 限死在一列宽里。
 *
 * 等高行的做法：把作品按时间顺序（行优先）依次往一行里塞，直到这一行的
 * 总宽达到容器宽度，再回头把这一行的高度设成「容器宽 ÷ 该行宽高比之和」。
 * 于是每一行都刚好左右铺满、行内没有空洞，行与行之间高度可以不同——横图
 * 自然占得宽、竖图自然占得窄，和美术馆沙龙挂墙的排布逻辑一致。
 *
 * 关键性质：**顺序严格保持**。只做「在哪儿断行」的贪心，绝不重排数组，
 * 因此时间轴（最新在前）和键盘 Tab 顺序都不受影响。
 */

export interface JustifyItem {
  id: string | number
  /** 宽高比 w/h，越大越横 */
  ratio: number
}

export interface JustifiedCell {
  id: string | number
  /** 该图在这一行里的像素宽度 */
  width: number
}

export interface JustifiedRow {
  cells: JustifiedCell[]
  /** 这一行的像素高度，行内所有图共用 */
  height: number
}

export interface JustifyOptions {
  /** 展墙可用宽度（px） */
  containerWidth: number
  /** 期望行高（px），实际行高会在它上下浮动 */
  targetHeight: number
  /** 图与图的间距（px），同样用于行间距 */
  gap: number
  /** 末行填满阈值：末行自然宽度达到容器宽的该比例才拉伸铺满（默认 0.72） */
  tailFillRatio?: number
}

/**
 * 把一批已知宽高比的作品排成若干等高行。
 *
 * 纯函数、无 DOM、无 Vue 依赖，方便单测覆盖各种极端比例。
 */
export function justifyRows(items: JustifyItem[], o: JustifyOptions): JustifiedRow[] {
  const rows: JustifiedRow[] = []
  const { containerWidth, targetHeight, gap } = o
  const tailFill = o.tailFillRatio ?? 0.72
  if (!(containerWidth > 0) || !(targetHeight > 0) || !items.length) return rows

  // 脏比例（0、NaN、Infinity）会让整行高度算成天文数字，兜底成 3:4
  const safe = items
    .map(it => ({ id: it.id, ratio: Number.isFinite(it.ratio) && it.ratio > 0 ? it.ratio : 0.75 }))
    .filter(it => it.ratio > 0)
  if (!safe.length) return rows

  let row: JustifyItem[] = []
  let sum = 0

  /** 结算当前行：算出统一高度，再按各自比例分配宽度。 */
  const emit = (isTail: boolean): JustifiedRow => {
    const gaps = gap * Math.max(0, row.length - 1)
    const ideal = (containerWidth - gaps) / sum
    // 末行凑得够宽才拉满，否则最后一张会被硬拉成横跨整屏的横幅
    const h = isTail && sum * targetHeight + gaps < containerWidth * tailFill ? targetHeight : ideal
    const height = Math.max(1, Math.round(h))
    const cells = row.map(it => ({ id: it.id, width: Math.max(1, Math.round(it.ratio * height)) }))

    // 宽度取整会累积出几像素误差，摊回最宽的那张，保证右边缘严格齐平
    if (h === ideal && cells.length) {
      const drift = containerWidth - (gaps + cells.reduce((acc, c) => acc + c.width, 0))
      if (Math.abs(drift) <= gap) {
        let wide = 0
        for (let i = 1; i < cells.length; i += 1) if (cells[i].width > cells[wide].width) wide = i
        cells[wide].width = Math.max(1, cells[wide].width + Math.round(drift))
      }
    }

    row = []
    sum = 0
    return { cells, height }
  }

  for (const item of safe) {
    row.push(item)
    sum += item.ratio
    if (sum * targetHeight + gap * (row.length - 1) < containerWidth) continue

    // 这张是「塞进本行」还是「留给下一行」更贴近目标行高？选更优的那个，
    // 否则一张超宽图会把整行压得又扁又矮。
    if (row.length > 1) {
      const prevSum = sum - item.ratio
      const withIt = (containerWidth - gap * (row.length - 1)) / sum
      const withoutIt = (containerWidth - gap * (row.length - 2)) / prevSum
      if (Math.abs(withoutIt - targetHeight) < Math.abs(withIt - targetHeight)) {
        row.pop()
        sum = prevSum
        rows.push(emit(false))
        row.push(item)
        sum = item.ratio
        continue
      }
    }
    rows.push(emit(false))
  }
  if (row.length) rows.push(emit(true))

  return rows
}
