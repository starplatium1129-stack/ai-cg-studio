import { imgPut } from '@/composables/useImageStore'

/**
 * 绘图页 → 视频页「出视频」桥接（动态 import，独立 chunk，不进 PromptBuilder 路由块）。
 * 图片本体不跨页传（sessionStorage 容量限制），先入 IndexedDB 再只传 imageId；
 * 场景/角色上下文随行，视频页据此自动组装视频提示词。
 * 2026-08-16 扩展：多图「加入分镜」→ 分镜短片（VIDEO_SHOTS_CTX_KEY 数组载荷）。
 */

export const VIDEO_CTX_KEY = 'aics_video_ctx'
/** 分镜短片批量带入：绘图页逐张「加入分镜」累积，视频页分镜模式一次性消费。 */
export const VIDEO_SHOTS_CTX_KEY = 'aics_video_shots_ctx'

/** 视频页一次性消费的跨页上下文（sessionStorage 载荷）。 */
export interface VideoCtxPayload {
  imageId: string
  /** 最近一次实际出图的完整提示词（视频提示词首选源，跟随用户对词条/角色/场景的修改）。 */
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
  /** 最近一次实际出图的完整提示词：视频提示词首选源，跟随出图修改实时更新。 */
  prompt: string
  /** 用户出图时写的场景描述：视频提示词次选源。 */
  story: string
  /** 场景预设 id（热门角色 = blueprintId，工作室 = sceneId）。 */
  blueprintId: string | null
  characterId: string
  sceneId: string | null
  flash: (message: string) => void
  push: (path: string) => Promise<unknown> | void
}

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

/** 把一张出图追加到「分镜短片」待带入列表（sessionStorage）。 */
export function appendShotsCtx(ctx: VideoCtxPayload): number {
  const list = readShotsCtx()
  list.push(ctx)
  try {
    sessionStorage.setItem(VIDEO_SHOTS_CTX_KEY, JSON.stringify(list))
  } catch {
    /* 超限时丢弃最旧一张，保住已加入的其余镜头 */
    list.shift()
    try { sessionStorage.setItem(VIDEO_SHOTS_CTX_KEY, JSON.stringify(list)) } catch { /* 忽略 */ }
  }
  return list.length
}

export function readShotsCtx(): VideoCtxPayload[] {
  try {
    const raw = sessionStorage.getItem(VIDEO_SHOTS_CTX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is VideoCtxPayload =>
        typeof item === 'object' && item !== null && typeof (item as VideoCtxPayload).imageId === 'string')
      : []
  } catch {
    return []
  }
}

export function clearShotsCtx(): void {
  try { sessionStorage.removeItem(VIDEO_SHOTS_CTX_KEY) } catch { /* 忽略 */ }
}

export async function bridgeToVideo(target: VideoBridgeTarget): Promise<boolean> {
  const ctx = await prepareVideoCtx(target)
  if (!ctx) return false
  try {
    sessionStorage.setItem(VIDEO_CTX_KEY, JSON.stringify(ctx))
  } catch {
    target.flash('跨页上下文写入失败')
    return false
  }
  await target.push('/video-studio')
  return true
}

/** 多图带入分镜短片：全部准备完成后一次性跳转（失败单图跳过，不阻塞其余）。 */
export async function bridgeShotsToVideo(targets: VideoBridgeTarget[]): Promise<boolean> {
  const prepared: VideoCtxPayload[] = []
  for (const target of targets) {
    const ctx = await prepareVideoCtx(target)
    if (ctx) prepared.push(ctx)
  }
  if (!prepared.length) return false
  clearShotsCtx()
  try {
    sessionStorage.setItem(VIDEO_SHOTS_CTX_KEY, JSON.stringify(prepared))
  } catch {
    return false
  }
  await targets[0].push('/video-studio?mode=shots')
  return true
}
