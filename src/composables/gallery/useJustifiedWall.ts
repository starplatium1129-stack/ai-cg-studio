import { computed, onActivated, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { justifyRows, type JustifyItem, type JustifiedRow } from './justifiedRows'

export interface WallGroup<T> {
  key: string
  rows: { height: number; cells: { item: T; width: number }[] }[]
}

/**
 * 把若干「时间分组」各自排成等高行，并把排版结果映射回原始对象。
 *
 * 时间分组要独立排版：组标题会打断行流，跨组拼行等于把不同日期的作品挤进
 * 同一条视觉带。每组内部仍是严格行优先，顺序不变。
 */
export function buildWallGroups<T extends { id: string | number }>(
  groups: { key: string; items: T[] }[],
  ratioOf: (item: T) => number,
  layout: (items: JustifyItem[]) => JustifiedRow[],
): WallGroup<T>[] {
  return groups.map(group => {
    const byId = new Map(group.items.map(item => [String(item.id), item]))
    return {
      key: group.key,
      rows: layout(group.items.map(item => ({ id: item.id, ratio: ratioOf(item) })))
        .map(row => ({
          height: row.height,
          cells: row.cells
            .map(cell => {
              const item = byId.get(String(cell.id))
              return item ? { item, width: cell.width } : null
            })
            .filter((cell): cell is { item: T; width: number } => cell !== null),
        }))
        .filter(row => row.cells.length),
    }
  })
}

/**
 * 展墙可用宽度的响应式测量 + 等高行排版入口。
 *
 * 宽度必须实测：展墙是 `max-width` 居中的流式容器，媒体查询给不出真实像素。
 * 用 ResizeObserver 而不是 window.resize——侧栏折叠、滚动条出现、系统缩放
 * 这些都不会触发 window 事件，但都会改变展墙宽度。
 */
export function useJustifiedWall(containerRef: Ref<HTMLElement | null>) {
  const width = ref(0)

  let observer: ResizeObserver | null = null
  let frame = 0

  function readWidth() {
    const el = containerRef.value
    if (!el) return
    const next = Math.round(el.getBoundingClientRect().width)
    // 组件被 KeepAlive 摘出 DOM 时宽度是 0，此时保持上一次的真实宽度，
    // 否则回到画廊的瞬间整墙会塌成一行一张
    if (next > 0 && next !== width.value) width.value = next
  }

  function scheduleRead() {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      readWidth()
    })
  }

  onMounted(() => {
    readWidth()
    if (typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(scheduleRead)
    if (containerRef.value) observer.observe(containerRef.value)
  })

  // KeepAlive 复用时不重跑 onMounted，回来要补一次测量
  onActivated(readWidth)

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
    if (frame) cancelAnimationFrame(frame)
  })

  /** 期望行高：宽屏 280（中等密度），窄屏逐级降低，免得手机上两行就占满一屏 */
  const targetHeight = computed(() => {
    const w = width.value
    if (!w) return 280
    if (w < 520) return 190
    if (w < 900) return 230
    return 280
  })

  /** 间距：与 clamp(12px, 1.6vw, 24px) 同手感 */
  const gap = computed(() => {
    const w = width.value || 1400
    return Math.round(Math.min(24, Math.max(12, w * 0.016)))
  })

  /**
   * 把一组作品排成等高行。
   *
   * 在 computed 里调用即可——它读 width，宽度变了会自动重排。
   * ratios 建议传「实测像素比例优先、元数据兜底」的值；图片解码后比例被
   * 纠正时（见 GalleryView 的 measuredRatios）会触发依赖更新并重新排版。
   */
  function layout(items: JustifyItem[]): JustifiedRow[] {
    const w = width.value
    if (!w) return []
    return justifyRows(items, {
      containerWidth: w,
      targetHeight: targetHeight.value,
      gap: gap.value,
    })
  }

  return { width, targetHeight, gap, layout, remeasure: readWidth }
}
