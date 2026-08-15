import { imgPut } from '@/composables/useImageStore'

/**
 * 绘图页 → 视频页「出视频」桥接（动态 import，独立 chunk，不进 PromptBuilder 路由块）。
 * 图片本体不跨页传（sessionStorage 容量限制），先入 IndexedDB 再只传 imageId；
 * 场景/角色上下文随行，视频页据此自动组装视频提示词。
 */

export const VIDEO_CTX_KEY = 'aics_video_ctx'

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

export async function bridgeToVideo(target: VideoBridgeTarget): Promise<boolean> {
  try {
    let blob: Blob
    if (target.animaBlob) {
      blob = target.animaBlob
    } else {
      const response = await fetch(target.displayUrl, { cache: 'no-store' })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.startsWith('image/')) {
        target.flash('成片响应无效，请重新生成')
        return false
      }
      blob = await response.blob()
    }
    if (!blob.size) {
      target.flash('成片数据已失效，请重新生成')
      return false
    }
    const imageId = await imgPut(blob)
    try {
      sessionStorage.setItem(VIDEO_CTX_KEY, JSON.stringify({
        imageId,
        prompt: target.prompt,
        story: target.story,
        blueprintId: target.blueprintId,
        characterId: target.characterId,
        sceneId: target.sceneId,
      }))
    } catch {
      target.flash('跨页上下文写入失败')
      return false
    }
    await target.push('/video-studio')
    return true
  } catch (error) {
    target.flash('跳转视频页失败')
    console.warn(error)
    return false
  }
}
