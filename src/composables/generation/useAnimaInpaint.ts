import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { usePromptBuilderStore } from '@/stores/promptBuilderStore'
import type { DrawEngine } from '@/storage/settingsRepository'
import type { useAnimaSession } from '@/composables/generation/useAnimaSession'
import type { InpaintSubmitPayload } from '@/components/AnimaInpaintModal.vue'

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
  const { pb, drawEngine, isPopular } = deps

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
      const { submitAnimaInpaint } = await import('./animaInpaintSubmit')
      await submitAnimaInpaint(payload, { ...deps, inpaintOpen, inpaintOriginalUrl, inpaintCompareActive, inpaintCharacter })
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
