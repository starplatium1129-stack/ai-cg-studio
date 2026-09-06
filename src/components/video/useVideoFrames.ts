import type { Ref } from 'vue'
import {
  uploadVideoImage,
  type VideoDefaults,
  type VideoMode,
  type VideoStatusResponse,
} from '@/api/videoApi'
import { imgGet, imgPut } from '@/composables/useImageStore'
import { useVideoStore, type VideoCtxPayload } from '@/stores/videoStore'
import { useSceneStore } from '@/stores/sceneStore'

/**
 * 视频页首帧/尾帧素材与绘图页跨页上下文（2026-09-06 自 VideoStudioView 下沉，
 * 体验报告 F1 草稿化的前置拆分）。
 *
 * 职责：帧图上传/移除/预览 URL 生命周期、绘图页「出视频」ctx 的一次性消费应用、
 * 提交时的帧图解析（受控名优先，IndexedDB 凭据重上传兜底——服务端
 * aics_video_input_ 前缀会随任务结束清理，刷新后旧名可能已失效）。
 */

export interface VideoFramesDeps {
  selectedMode: Ref<VideoMode | 'shots'>
  aspectRatio: Ref<VideoDefaults['aspectRatio']>
  selectedModelId: Ref<string>
  prompt: Ref<string>
  videoImageId: Ref<string>
  videoImageUrl: Ref<string>
  firstFrameName: Ref<string>
  lastFrameImageId: Ref<string>
  lastFrameUrl: Ref<string>
  lastFrameName: Ref<string>
  uploadingImage: Ref<boolean>
  status: Ref<VideoStatusResponse | null>
  statusError: Ref<string>
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('图片编码失败'))
    reader.readAsDataURL(blob)
  })
}

export function useVideoFrames(deps: VideoFramesDeps) {
  const {
    selectedMode, aspectRatio, selectedModelId, prompt,
    videoImageId, videoImageUrl, firstFrameName,
    lastFrameImageId, lastFrameUrl, lastFrameName,
    uploadingImage, status, statusError,
  } = deps
  const videoStore = useVideoStore()
  const sceneStore = useSceneStore()

  /**
   * 跨页上下文 → 视频提示词（确定性组装，不做 tag 翻译）：
   * 1. 实际出图提示词（ctx.prompt）直接作为视频主描述；
   * 2. prompt 为空时回退用户写的 story；
   * 3. story 为空时，用场景预设的结构化字段——优先英文 promptProse，
   *    缺失时才回退中文 description + action + lighting；
   * 4. I2VA 首帧图已在后端按官方规范锁定角色/服装/场景（<Picture 1> 指令），
   *    身份描述如与画面冲突可在文本框手动删减，这里只做搬运不做裁剪。
   */
  function composeVideoPrompt(ctx: VideoCtxPayload): string {
    const ctxPrompt = (ctx.prompt || '').trim()
    if (ctxPrompt) return ctxPrompt
    const story = (ctx.story || '').trim()
    if (story) return story
    if (ctx.blueprintId) {
      const bp = sceneStore.sceneBlueprints.find(item => item.id === ctx.blueprintId)
      if (bp) {
        const prose = (bp.promptProse || '').trim()
        if (prose) return prose
        return [bp.description, bp.action, bp.lighting].filter(Boolean).join('，')
      }
    }
    return ''
  }

  async function applyVideoCtx(ctx: VideoCtxPayload) {
    try {
      const blob = await imgGet(ctx.imageId)
      if (blob) {
        if (videoImageUrl.value) URL.revokeObjectURL(videoImageUrl.value)
        videoImageUrl.value = URL.createObjectURL(blob)
        videoImageId.value = ctx.imageId
      }
    } catch { /* 图失效则不挂预览，上下文其余部分照常 */ }
    selectedMode.value = 'image'
    // 首帧比例跟随原图，避免固定画幅拉伸（如 832x1216 出图 → 480x832 画布会变形）。
    aspectRatio.value = 'original'
    // 图生视频只有支持 image 的模型可用（本机目录里即 MiniMax H3）；Wan 5B 会静默丢掉首帧，
    // 这里直接选到 H3，避免用户带着首帧落到「文字成片」模型上。
    if (status.value?.models.some(model => model.id === 'minimax-h3')) {
      selectedModelId.value = 'minimax-h3'
    }
    const composed = composeVideoPrompt(ctx)
    if (composed && composed.trim().length >= 4) prompt.value = composed
  }

  /** 绘图页「出视频」跨页上下文（一次性消费，videoStore 承载）。 */
  function consumeVideoCtx() {
    const ctx = videoStore.consumeImageCtx()
    if (!ctx || !ctx.imageId) return
    void applyVideoCtx(ctx)
  }

  function clearFirstFrame() {
    if (videoImageUrl.value) URL.revokeObjectURL(videoImageUrl.value)
    videoImageUrl.value = ''
    videoImageId.value = ''
    firstFrameName.value = ''
  }

  function clearLastFrame() {
    if (lastFrameUrl.value) URL.revokeObjectURL(lastFrameUrl.value)
    lastFrameUrl.value = ''
    lastFrameName.value = ''
    lastFrameImageId.value = ''
  }

  /**
   * 本地上传首帧/尾帧：base64 → 网关 → 受控文件名 + 本地预览。
   * 同时写 IndexedDB 留耐久凭据（F1）：受控名随任务清理，草稿恢复靠 imageId 重上传。
   */
  async function handleFrameFile(event: Event, slot: 'first' | 'last') {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      statusError.value = '仅支持图片文件（PNG / JPEG / WebP）'
      return
    }
    uploadingImage.value = true
    statusError.value = ''
    try {
      const upload = await uploadVideoImage(await blobToBase64(file))
      const preview = URL.createObjectURL(file)
      const imageId = await imgPut(file).catch(() => '')
      if (slot === 'first') {
        if (videoImageUrl.value) URL.revokeObjectURL(videoImageUrl.value)
        videoImageUrl.value = preview
        firstFrameName.value = upload.name
        videoImageId.value = imageId
      } else {
        if (lastFrameUrl.value) URL.revokeObjectURL(lastFrameUrl.value)
        lastFrameUrl.value = preview
        lastFrameName.value = upload.name
        lastFrameImageId.value = imageId
      }
    } catch (error) {
      statusError.value = error instanceof Error ? error.message : '图片上传失败'
    } finally {
      uploadingImage.value = false
    }
  }

  /**
   * 提交时的帧图解析：本会话的新鲜受控名优先；草稿恢复场景（只有 IndexedDB
   * 凭据）重新上传换新名，避免拿着已被服务端清理的旧文件名提交 400。
   */
  async function resolveSubmitFrames(mode: VideoMode | 'shots'): Promise<{ image?: string; lastFrame?: string }> {
    if (mode !== 'image' && mode !== 'first-last-frame') return {}
    let image: string | undefined
    if (firstFrameName.value) {
      image = firstFrameName.value
    } else if (videoImageId.value) {
      const blob = await imgGet(videoImageId.value)
      if (!blob) throw new Error('首帧图片读取失败，请重新带入')
      uploadingImage.value = true
      const upload = await uploadVideoImage(await blobToBase64(blob))
      image = upload.name
    }
    let lastFrame: string | undefined
    if (mode === 'first-last-frame') {
      if (lastFrameName.value) {
        lastFrame = lastFrameName.value
      } else if (lastFrameImageId.value) {
        const blob = await imgGet(lastFrameImageId.value)
        if (!blob) throw new Error('尾帧图片读取失败，请重新上传')
        uploadingImage.value = true
        const upload = await uploadVideoImage(await blobToBase64(blob))
        lastFrame = upload.name
      } else {
        throw new Error('尾帧图片读取失败，请重新上传')
      }
    }
    return { image, lastFrame }
  }

  return {
    applyVideoCtx,
    consumeVideoCtx,
    clearFirstFrame,
    clearLastFrame,
    handleFrameFile,
    resolveSubmitFrames,
  }
}
