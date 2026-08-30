import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { usePromptBuilderStore } from '@/stores/promptBuilderStore'
import type { DrawEngine } from '@/storage/settingsRepository'
import { resolveInpaintRequestBinding, type useAnimaSession } from '@/composables/generation/useAnimaSession'
import type { InpaintSubmitPayload } from '@/components/AnimaInpaintModal.vue'
import { apiClient } from '@/api/client'

type PromptBuilderStore = ReturnType<typeof usePromptBuilderStore>
type AnimaSession = ReturnType<typeof useAnimaSession>

export interface AnimaInpaintDeps {
  pb: PromptBuilderStore
  drawEngine: Ref<DrawEngine>
  animaState: AnimaSession['state']
  displayResultUrl: ComputedRef<string>
  generateAnima: AnimaSession['generate']
  /** 当前是否热门角色（popular）模式；热门角色无 LoRA，换装必须走无 LoRA 底模。 */
  isPopular: ComputedRef<boolean>
  /** 热门角色的 Danbooru 身份标签（exactTokens + identityTokens），换装时拼入提示词头部，
   *  让模型知道「衣服穿在谁身上」——此前热门角色换装只传衣服词，新衣光影/气质与原图脱节。 */
  popularIdentityTokens: ComputedRef<string[]>
}

/**
 * 绘图页「Anima 智能局部换装」编排（2026-08-22 自 PromptBuilderView 下沉）。
 *
 * 原图/遮罩 FileReader → base64 → /api/anima/images 落盘，按目标尺寸与
 * 角色 LoRA 形态解析无 LoRA 绑定（resolveInpaintRequestBinding），组装
 * 换装提示词后走 generateAnima 覆盖式提交。同时持有弹窗开关与
 * 「换装前后对比」的原图 URL / 对比开关状态。
 */
export function useAnimaInpaint(deps: AnimaInpaintDeps) {
  const { pb, drawEngine, animaState, displayResultUrl, generateAnima, isPopular, popularIdentityTokens } = deps

  const inpaintOpen = ref(false)
  const inpaintOriginalUrl = ref<string | null>(null)
  const inpaintCompareActive = ref(false)

  const inpaintCharacter = computed<'nene' | 'natsume' | null>(() => {
    // 热门角色（popular）模式没有 LoRA 绑定，必须返回 null 走无 LoRA 底模；
    // 否则 pb.char 仍是默认 'nene'，会把热门角色图误绑 nene LoRA 导致「换衣变脸」。
    if (isPopular.value) return null
    return pb.char === 'nene' || pb.char === 'natsume' ? pb.char : null
  })

  async function handleInpaintSubmit(payload: InpaintSubmitPayload) {
    if (drawEngine.value !== 'anima') {
      pb.flash('局部换装目前专属于 Anima 引擎')
      return
    }
    try {
      pb.flash('正在上传原图并准备智能换装…')
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(payload.imageBlob)
      })
      const base64Data = await base64Promise

      const uploadJson = await apiClient.request<{ ok: boolean; name: string; error?: string }>('/api/anima/images', {
        method: 'POST',
        body: { image: base64Data },
        timeoutMs: 30_000,
      } as unknown as Record<string, unknown>)
      if (!uploadJson.ok || !uploadJson.name) {
        throw new Error((uploadJson as { error?: string }).error || '原图上传失败')
      }

      const initImage = uploadJson.name
      let maskImage: string | undefined
      if (payload.maskBlob) {
        const maskReader = new FileReader()
        const maskData = await new Promise<string>((resolve, reject) => {
          maskReader.onload = () => resolve(maskReader.result as string)
          maskReader.onerror = reject
          maskReader.readAsDataURL(payload.maskBlob as Blob)
        })
        const maskJson = await apiClient.request<{ ok: boolean; name: string; error?: string }>('/api/anima/images', {
          method: 'POST',
          body: { image: maskData },
          timeoutMs: 30_000,
        } as unknown as Record<string, unknown>)
        if (!maskJson.ok || !maskJson.name) throw new Error((maskJson as { error?: string }).error || '遮罩上传失败')
        maskImage = maskJson.name
      }
      inpaintOpen.value = false
      inpaintOriginalUrl.value = displayResultUrl.value
      inpaintCompareActive.value = false
      pb.flash('正在执行 AI 智能识别与局部换装 (~6秒)…')

      const effectiveChar = payload.characterOverride !== undefined
        ? payload.characterOverride
        : inpaintCharacter.value
      // 热门角色强制走无 LoRA 底模（即使 characterOverride 误传 nene/natsume 也纠正），
      // 避免 nene/夏目 LoRA 污染热门角色脸型；身份靠 Danbooru 标签（popularIdentityTokens）锁定。
      const charLocked = isPopular.value ? 'none' : effectiveChar
      const isCharacterLora = charLocked === 'nene' || charLocked === 'natsume'
      const inpaintMode = isCharacterLora || charLocked === 'none' ? charLocked : null
      const desiredSize = payload.targetWidth && payload.targetHeight
        ? `${payload.targetWidth}x${payload.targetHeight}`
        : `${animaState.value.width}x${animaState.value.height}`
      const binding = resolveInpaintRequestBinding(
        animaState.value.models,
        animaState.value.modelId,
        inpaintMode,
        desiredSize,
      )

      let promptText = payload.newOutfitPrompt
      if (charLocked === 'nene' && !promptText.includes('ayachi_nene')) {
        promptText = `ayachi_nene, ${promptText}`
      } else if (charLocked === 'natsume' && !promptText.includes('shiki_natsume')) {
        promptText = `shiki_natsume, ${promptText}`
      } else if (charLocked === 'none' && popularIdentityTokens.value.length && isPopular.value) {
        // 2026-08-30 热门角色换装修复：身份标签前置（hina (blue archive), halo, silver_hair…），
        // 模型才知道衣服穿在谁身上——此前只传衣服词导致新衣光影/气质与原图脱节。
        promptText = `${popularIdentityTokens.value.join(', ')}, ${promptText}`
      }

      const negativePrompt = charLocked === 'none'
        ? `${payload.negativePrompt}, face, head, hair, duplicate person, extra person`
        : payload.negativePrompt
      if (!binding) {
        pb.flash('当前没有可用的无 LoRA Anima 底模，无法处理外部通用图片')
        return
      }

      await generateAnima({
        prompt: promptText,
        modelId: binding.modelId,
        negative: negativePrompt,
        initImage,
        ...(maskImage ? { maskImage } : { maskPrompt: payload.maskPrompt, maskThreshold: payload.maskThreshold }),
        denoisingStrength: payload.denoisingStrength,
        growMaskBy: payload.growMaskBy,
        seed: payload.seed ?? undefined,
        character: binding.character,
        loraId: binding.loraId,
        loraStrength: isCharacterLora ? animaState.value.loraStrength : null,
        width: binding.width,
        height: binding.height,
        teaCache: true,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      pb.flash(`换装失败：${message}`)
    }
  }

  return {
    inpaintOpen,
    inpaintOriginalUrl,
    inpaintCompareActive,
    inpaintCharacter,
    handleInpaintSubmit,
  }
}
