import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { justifyRows, relayoutWithBreaks, type JustifyItem, type JustifiedRow } from './justifiedRows'

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
    // observe 交给下面的 watch 统一负责：wallEl 绑在 v-else 分支，首次挂载时
    // 正处于 loading、DOM 尚未渲染，这里 observe 不到任何东西。
  })

  /**
   * wallEl 绑在 v-else 分支：首次挂载时（loading 状态）该节点还不存在，
   * 数据就绪后才渲染出来。若只在 onMounted 里 observe 一次，宽度会永远
   * 停在 0，`layout` 返回空数组、整墙一张作品都排不出来。
   * 这里改为监听它何时出现：出现即观察并立即测量，消失（切到回收站等分支）
   * 即断开，回来再接上。KeepAlive 场景下 watch 不随 onMounted 重跑，正好补位。
   */
  watch(containerRef, el => {
    if (observer) {
      observer.disconnect()
      if (el) observer.observe(el)
    }
    if (el) readWidth()
  }, { immediate: true })

  // KeepAlive 复用时不重跑 onMounted，回来要补一次测量
  onActivated(readWidth)

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
    if (frame) cancelAnimationFrame(frame)
  })

  /** 期望行高：大图优先（用户偏好），宽屏 420，窄屏逐级降低，手机上两行仍可控 */
  const targetHeight = computed(() => {
    const w = width.value
    if (!w) return 420
    if (w < 520) return 280
    if (w < 900) return 340
    return 420
  })

  /** 间距：与 clamp(12px, 1.6vw, 24px) 同手感 */
  const gap = computed(() => {
    const w = width.value || 1400
    return Math.round(Math.min(24, Math.max(12, w * 0.016)))
  })

  /**
   * 断行缓存：把「一组作品的断行位置」钉死，图片解码回填比例时不再重新断行。
   *
   * 若不锁定，每张图 @load 回填真实比例都会让 justifyRows 重新贪心断行，断行
   * 位置随比例漂移 → 图片跨行移动 → Vue 重建 article/img → img 重新解码（回看
   * 黑屏空位 + 卡顿）。锁定后回填只走 relayoutWithBreaks 微调行高/列宽，图片
   * 留在原行原节点。
   *
   * key = `${容器宽}\u0000${id 序列}`：容器宽变化（resize）或结构变化（分页追加/
   * 删除/筛选）都会让 key 变化，从而正确地重新断行；只有「比例变了、结构没变」
   * 才命中缓存。
   */
  const breakCache = new Map<string, (string | number)[][]>()

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
    const sig = `${w}\u0000${items.map(it => String(it.id)).join('\u0000')}`
    const breaks = breakCache.get(sig)
    if (breaks) {
      return relayoutWithBreaks(items, breaks, {
        containerWidth: w,
        targetHeight: targetHeight.value,
        gap: gap.value,
      })
    }
    const rows = justifyRows(items, {
      containerWidth: w,
      targetHeight: targetHeight.value,
      gap: gap.value,
    })
    breakCache.set(sig, rows.map(r => r.cells.map(c => c.id)))
    return rows
  }

  return { width, targetHeight, gap, layout, remeasure: readWidth }
}
