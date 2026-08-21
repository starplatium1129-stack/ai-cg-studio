import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { imgPut } from '@/composables/useImageStore'

/**
 * 视频工作台领域 Store（2026-08-22 从 useVideoBridge 的 sessionStorage 黑盒收敛）。
 *
 * 职责：
 * 1. 绘图页 → 视频页的跨页交接载荷（单图出视频 / 多图分镜短片），类型化 + 响应式；
 * 2. 底层仍持久化到 sessionStorage（键名不变）：跨 SPA 路由与整页刷新都存活，
 *    且保持「视频页一次性消费」语义——消费即清除，不产生幽灵预填。
 * 图片本体不入 store：走 IndexedDB（useImageStore.imgPut），载荷只带 imageId。
 */

export interface VideoCtxPayload {
  imageId: string
  /** 最近一次实际出图的完整提示词（视频提示词首选源）。 */
  prompt: string
  /** 用户出图时写的场景描述（prompt 为空时的次选源）。 */
  story: string
  blueprintId: string | null
  characterId: string
  sceneId: string | null
}

export interface VideoBridgeTarget {
  /** 当前显示结果 url（sd 引擎用于 fetch 原图 blob）。 */
  displayUrl: string
  /** anima/krea 结果 blob（非 sd 引擎直用；null 时走 fetch displayUrl）。 */
  animaBlob: Blob | null
  prompt: string
  story: string
  blueprintId: string | null
  characterId: string
  sceneId: string | null
  flash: (message: string) => void
  push: (path: string) => Promise<unknown> | void
}

const IMAGE_CTX_KEY = 'aics_video_ctx'
/** 分镜短片批量带入：绘图页逐张「加入分镜」累积，视频页分镜模式一次性消费。 */
const SHOTS_CTX_KEY = 'aics_video_shots_ctx'

function isVideoCtxPayload(value: unknown): value is VideoCtxPayload {
  return typeof value === 'object' && value !== null && typeof (value as VideoCtxPayload).imageId === 'string'
}

function readJson<T>(key: string, validate: (value: unknown) => value is T): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return validate(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function removeKey(key: string): void {
  try { sessionStorage.removeItem(key) } catch { /* 忽略 */ }
}

function readStoredShots(): VideoCtxPayload[] {
  const list = readJson<VideoCtxPayload[]>(SHOTS_CTX_KEY, Array.isArray)
  return Array.isArray(list) ? list.filter(isVideoCtxPayload) : []
}

export const useVideoStore = defineStore('videoStudio', () => {
  // ── 状态（初始化时从 sessionStorage 水合，刷新不丢） ──
  const pendingImageCtx = ref<VideoCtxPayload | null>(readJson(IMAGE_CTX_KEY, isVideoCtxPayload))
  const pendingShotCtxs = ref<VideoCtxPayload[]>(readStoredShots())

  // ── 派生 ──
  /** 绘图页「已加入分镜」角标计数。 */
  const shotsPending = computed(() => pendingShotCtxs.value.length)

  // ── 单图出视频交接 ──
  function stageImageCtx(ctx: VideoCtxPayload): boolean {
    pendingImageCtx.value = ctx
    if (!writeJson(IMAGE_CTX_KEY, ctx)) {
      pendingImageCtx.value = null
      return false
    }
    return true
  }

  /** 视频页一次性消费：取走并清除。 */
  function consumeImageCtx(): VideoCtxPayload | null {
    const ctx = pendingImageCtx.value
    if (!ctx) return null
    pendingImageCtx.value = null
    removeKey(IMAGE_CTX_KEY)
    return ctx
  }

  // ── 分镜短片批量交接 ──
  /** 追加一张；sessionStorage 超限时丢弃最旧一张保住其余（历史语义）。 */
  function appendShotCtx(ctx: VideoCtxPayload): number {
    const list = [...pendingShotCtxs.value, ctx]
    if (writeJson(SHOTS_CTX_KEY, list)) {
      pendingShotCtxs.value = list
      return list.length
    }
    list.shift()
    pendingShotCtxs.value = list
    writeJson(SHOTS_CTX_KEY, list)
    return list.length
  }

  function stageShotCtxs(list: VideoCtxPayload[]): boolean {
    pendingShotCtxs.value = list
    if (!writeJson(SHOTS_CTX_KEY, list)) {
      pendingShotCtxs.value = []
      removeKey(SHOTS_CTX_KEY)
      return false
    }
    return true
  }

  /** 视频页分镜模式一次性消费：取走全部并清除。 */
  function consumeShotCtxs(): VideoCtxPayload[] {
    const list = pendingShotCtxs.value
    if (!list.length) return []
    pendingShotCtxs.value = []
    removeKey(SHOTS_CTX_KEY)
    return list
  }

  return {
    pendingImageCtx,
    pendingShotCtxs,
    shotsPending,
    stageImageCtx,
    consumeImageCtx,
    appendShotCtx,
    stageShotCtxs,
    consumeShotCtxs,
  }
})

// ── IndexedDB 相关桥接（blob 处理不属于 store，保留在组合层） ──────────────

/** 图片入 IndexedDB + 组装跨页上下文（不导航；单图/多图共用）。 */
export async function prepareVideoCtx(target: VideoBridgeTarget): Promise<VideoCtxPayload | null> {
  try {
    let blob: Blob
    if (target.animaBlob) {
      blob = target.animaBlob
    } else {
      const response = await fetch(target.displayUrl, { cache: 'no-store' })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.startsWith('image/')) {
        target.flash('成片响应无效，请重新生成')
        return null
      }
      blob = await response.blob()
    }
    if (!blob.size) {
      target.flash('成片数据已失效，请重新生成')
      return null
    }
    const imageId = await imgPut(blob)
    return {
      imageId,
      prompt: target.prompt,
      story: target.story,
      blueprintId: target.blueprintId,
      characterId: target.characterId,
      sceneId: target.sceneId,
    }
  } catch (error) {
    target.flash('成片处理失败')
    console.warn(error)
    return null
  }
}
