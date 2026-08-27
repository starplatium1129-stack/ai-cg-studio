import { computed, type Ref } from 'vue'
import { usePromptBuilderStore } from '@/stores/promptBuilderStore'
import {
  buildPopularPromptPlan,
  defaultOutfit,
  findBlueprint,
  findCharacter,
  findOutfit,
} from '@/utils/popularContent.ts'
import {
  KREA_STYLE_RECIPES,
  resolveStyleRecipe,
  type ResolvedStyle,
} from '@/config/kreaStyleRecipes.ts'
import {
  analyzeParts,
  checkArtDirection,
  resolveModelProfile,
  type PromptEngine,
} from '@/utils/promptPolicy.ts'
import { plainEnglish } from '@/utils/promptCompiler.ts'
import { artistStyleProse, artistTagsForEngine } from '@/config/artistStyles.ts'

type PromptBuilderStore = ReturnType<typeof usePromptBuilderStore>

/**
 * 热门角色无 LoRA 模式的 Prompt 组装。
 *
 * 与 usePromptAssembly 完全正交：热门角色绝不流经 pb.charPrompt /
 * characterControlTokens，也就不会注入 ayachi_nene / shiki_natsume /
 * nene_* / natsume_*。渲染仍以 createPromptPlan + renderPromptPlan 为唯一
 * 模型渲染层。
 */
export function usePopularPromptAssembly(
  pb: PromptBuilderStore,
  engine: Readonly<Ref<PromptEngine>>,
  modelName: Readonly<Ref<string>>,
) {
  /** 无 LoRA 模式下直接取模型 profile，不叠加任何角色 LoRA 契约。 */
  const profile = computed(() =>
    engine.value === 'anima' || engine.value === 'krea2'
      ? resolveModelProfile(pb.modelProfiles, modelName.value, engine.value)
      : null,
  )

  const character = computed(() => {
    const subject = pb.subject
    if (subject.kind !== 'popular') return null
    return findCharacter(pb.popularCharacters, subject.characterId)
  })

  const outfit = computed(() => {
    const current = character.value
    if (!current) return null
    const subject = pb.subject
    if (subject.kind !== 'popular') return null
    return findOutfit(current, subject.outfitId) ?? defaultOutfit(current)
  })

  const blueprint = computed(() => {
    const subject = pb.subject
    if (subject.kind !== 'popular' || !subject.blueprintId) return null
    return findBlueprint(pb.sceneBlueprints, subject.blueprintId)
  })

  const adultEnabled = computed(() => pb.showMatureScenes)
  const activeArtistStyleIds = computed(() => pb.directorMode === 'pro' ? pb.artistStyleIds : [])

  /** 风格由蓝图 hint 或引擎默认值自动确定；成人配方在此 fail-closed。 */
  const resolvedStyle = computed<ResolvedStyle | null>(() => {
    const subject = pb.subject
    if (subject.kind !== 'popular' || !character.value) return null
    const targetEngine = engine.value === 'krea2' ? 'krea2' : 'anima'
    return resolveStyleRecipe(
      KREA_STYLE_RECIPES,
      targetEngine,
      blueprint.value,
      null,
      character.value,
      { adultEnabled: adultEnabled.value },
    )
  })

  const result = computed(() => {
    const subject = pb.subject
    if (subject.kind !== 'popular' || !character.value || !outfit.value) return null
    if (engine.value !== 'anima' && engine.value !== 'krea2') return null
    return buildPopularPromptPlan({
      character: character.value,
      outfit: outfit.value,
      blueprint: blueprint.value,
      engine: engine.value,
      profile: profile.value,
      manual: [...pb.manualTags],
      emotion: pb.emotionPrompt ? [pb.emotionPrompt] : [],
      shot: pb.selections.shot,
      lighting: pb.selections.lighting,
      composition: pb.selections.composition,
      adultEnabled: adultEnabled.value,
      visualDescription: pb.visualDescription,
      style: resolvedStyle.value,
      artistTags: artistTagsForEngine(activeArtistStyleIds.value, engine.value),
      artistProse: artistStyleProse(activeArtistStyleIds.value, engine.value),
    })
  })

  const structuredPlan = computed(() => result.value?.plan ?? null)
  const positivePrompt = computed(() => result.value?.prompt ?? '')
  const negativePrompt = computed(() => result.value?.negative ?? '')
  const previewPrompt = computed(() => {
    const positive = positivePrompt.value
    if (!positive) return ''
    return negativePrompt.value ? `${positive}\n[NEG]\n${negativePrompt.value}` : positive
  })
  const promptReport = computed(() => {
    const parts: Array<{ cls: 'q' | 'n'; text: string }> = []
    if (positivePrompt.value) parts.push({ cls: 'q', text: positivePrompt.value })
    if (negativePrompt.value) parts.push({ cls: 'n', text: negativePrompt.value })
    // engine 传入后 analyzeParts 启用 Krea/Anima 契约违规检测（真实渲染文本）。
    const report = analyzeParts(parts, engine.value)
    if (pb.visualDescription && !plainEnglish(pb.visualDescription)) {
      report.warnings.push('视觉描述含非 ASCII 字符，已按英文模型门控丢弃（请在画面描述里使用英文）')
    }
    return report
  })
  const artViolations = computed(() => checkArtDirection(positivePrompt.value))

  return {
    profile,
    character,
    outfit,
    blueprint,
    resolvedStyle,
    structuredPlan,
    positivePrompt,
    negativePrompt,
    previewPrompt,
    promptReport,
    artViolations,
  }
}
