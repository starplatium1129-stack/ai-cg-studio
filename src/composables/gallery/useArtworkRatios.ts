import { reactive } from 'vue'
import { jpegThumbDataUrl } from '@/utils/imageThumb'
import type { ArtworkRecord } from '@/types/artwork'

/** 宽高比的合理区间：超出就是脏数据或极端长条，钳住避免把展墙行撑爆 */
const RATIO_MIN = 0.36
const RATIO_MAX = 2.8

export interface ArtworkRatioDeps {
  /** 缩略图去重集合，与 HD 加载路径共用，同一张图并发只生成一次 */
  pending: Set<string>
  /** 该作品是否已有缩略图 */
  hasThumb: (item: ArtworkRecord) => boolean
  /** 缩略图落盘并写回运行时缓存；imageId 由调用方保证非空 */
  saveThumb: (item: ArtworkRecord, dataUrl: string, imageId: string) => Promise<void>
}

/**
 * 作品画幅（宽高比）的实测与纠正。
 *
 * 等高行展墙完全依赖准确的宽高比：比例错了，画框和图片就会对不上，行也排不齐。
 * 而 `size` 字段记的是保存快照那一刻下拉框里的值，不是真实像素——中途切场景
 * 把尺寸改成横图再保存，竖图就会套上横构图的框。所以真正解码出来的
 * naturalWidth/Height 优先，元数据只在还没解码时兜底。
 */
export function useArtworkRatios(deps: ArtworkRatioDeps) {
  /** 图片解码后回填的真实比例，reactive 以便排版 computed 自动重排 */
  const measuredRatios = reactive<Record<string, number>>({})

  function clampRatio(r: number) { return Math.max(RATIO_MIN, Math.min(RATIO_MAX, r)) }

  function ratioOf(item: ArtworkRecord): number {
    const measured = measuredRatios[item.id]
    if (measured) return clampRatio(measured)
    let w = Number(item.width || item.image_width || item.actual?.width)
    let h = Number(item.height || item.image_height || item.actual?.height)
    if (!(w > 0 && h > 0)) {
      const m = String(item.size || '').match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i)
      if (m) { w = Number(m[1]); h = Number(m[2]) }
    }
    return clampRatio(w > 0 && h > 0 ? w / h : 3 / 4)
  }

  /** 高清图解码成功后顺手回填缩略图缓存，用已解码的 img 绘制，零额外解码 */
  async function backfillThumb(item: ArtworkRecord, img: HTMLImageElement) {
    const imageId = item.image_id
    if (!imageId || deps.pending.has(imageId) || deps.hasThumb(item)) return
    deps.pending.add(imageId)
    try {
      const dataUrl = jpegThumbDataUrl(img)
      if (dataUrl) await deps.saveThumb(item, dataUrl, imageId)
    } catch { /* 缩略图只是缓存，失败不影响展示 */ }
    finally { deps.pending.delete(imageId) }
  }

  /** 图片解码完成后用真实像素纠正画框 */
  function measure(item: ArtworkRecord, e: Event) {
    const img = e.target as HTMLImageElement
    if (!img.naturalWidth || !img.naturalHeight) return
    const r = img.naturalWidth / img.naturalHeight
    if (Math.abs((measuredRatios[item.id] ?? 0) - r) > 0.001) measuredRatios[item.id] = r
    if (img.naturalWidth >= 700) void backfillThumb(item, img)
  }

  /** 作品被删除后丢掉它的实测值 */
  function forgetRatio(id: string | number) { delete measuredRatios[id] }

  return { measuredRatios, ratioOf, measure, forgetRatio }
}
