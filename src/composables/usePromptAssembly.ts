import { computed, type Ref } from 'vue'
import {
  NEGATIVE_DEFAULT,
  usePromptBuilderStore,
} from '@/stores/promptBuilderStore'
import {
  adaptNegative,
  analyzeParts,
  applyFraming,
  checkArtDirection,
  dedupeParts,
  enrichDualPrompt,
  loraSpecText,
  mergeTokenText,
  modelNegativePrompt,
  norm,
  normalizeKey,
  qualityPrefix,
  resolveLoraSpecs,
  resolveModelProfile,
  sanitizePrompt,
  sceneSupportsCharacter,
  sceneTemplateText,
  splitBreaks,
  tokenize,
  type PromptPart,
} from '@/utils/promptPolicy'
import { COLOR_MOODS, LIGHTING, SHOT, COMPOSITION } from '@/config/promptConstants'

type PromptBuilderStore = ReturnType<typeof usePromptBuilderStore>

/**
 * Director prompt composition has no UI or SD lifecycle ownership. Keeping it
 * here makes the generated prompt reusable by preview, direct generation, and
 * queued generation without letting the view duplicate policy decisions.
 */
export function usePromptAssembly(
  pb: PromptBuilderStore,
  checkpoint: Readonly<Ref<string>>,
) {
  /** 当前 checkpoint 对应的 model profile（决定质量前缀 / 负面策略 / rating 标签） */
  const modelProfile = computed(() =>
    resolveModelProfile(pb.modelProfiles, pb.sdModelName || checkpoint.value),
  )

  /** 场景必须支持当前角色，否则不套用场景模板。 */
  const effectiveScene = computed(() => {
    const scene = pb.activeScene
    if (!scene) return null
    return sceneSupportsCharacter(scene, pb.char) ? scene : null
  })

  const currentTraits = computed(() => {
    const charDef = pb.characters.find(character =>
      character.id.includes(pb.char) || (character.lora?.name ?? '').toLowerCase().includes(pb.char),
    )
    return charDef?.traits ?? []
  })

  const loraIdByChar = computed<Record<string, string>>(() => {
    const result: Record<string, string> = {}
    const find = (key: string) =>
      pb.characters.find(character =>
        character.id.includes(key) || (character.lora?.name ?? '').toLowerCase().includes(key),
      )
    const nene = find('nene')
    const natsume = find('natsume')
    if (nene?.lora?.name) result.nene = nene.lora.name
    if (natsume?.lora?.name) result.natsume = natsume.lora.name
    if (nene?.lora?.name && natsume?.lora?.name) {
      result.triad = `${nene.lora.name}, ${natsume.lora.name}`
    }
    return result
  })

  /** LoRA 按镜头动态定权（特写/全身/双人/复杂场景各不同）。 */
  const loraSpecs = computed(() =>
    resolveLoraSpecs(
      pb.char,
      effectiveScene.value,
      pb.loraMeta,
      loraIdByChar.value,
      { shot: pb.selections.shot, manualTags: pb.manualTags },
    ),
  )

  /** 分块 parts：同序同类输出，供预览、健康检查与 SD 请求共用。 */
  const promptParts = computed<PromptPart[]>(() => {
    const parts: PromptPart[] = []
    const selections = pb.selections
    const scene = effectiveScene.value
    const profile = modelProfile.value
    const sceneTemplate = sceneTemplateText(scene, {
      char: pb.char,
      manualTags: pb.manualTags,
      shot: selections.shot,
    })

    // 1) 质量前缀（模型 profile + rating 标签）
    if (pb.sdParams.quality) parts.push({ cls: 'q', text: qualityPrefix(profile, scene) })

    // 2) 角色行 + 已勾选特征
    const traitTags = currentTraits.value
      .filter(trait => pb.manualTags.has(trait.tag))
      .map(trait => trait.tag)
    const charLine = pb.charPrompt
    if (charLine) {
      parts.push({ cls: 'c', text: norm(traitTags.length ? `${charLine}, ${traitTags.join(', ')}` : charLine) })
    }

    // 3) 双人：无场景模板时补构图增强
    if (pb.char === 'triad' && !sceneTemplate) {
      parts.push({
        cls: 't',
        text: enrichDualPrompt(
          '',
          ['ayachi_nene', 'white_hair', 'very_long_hair', 'low_twintails', 'purple_eyes', 'ahoge', 'hair_ribbon'],
          ['shiki_natsume', 'black_hair', 'long_hair', 'yellow_eyes', 'mole_under_eye', 'hairclip'],
        ),
      })
    }

    // 4) 场景模板
    if (sceneTemplate && !pb.concise) parts.push({ cls: 't', text: sceneTemplate })

    // 精简模式：quality + character + top5 tags + shot + LoRA
    if (pb.concise) {
      if (pb.manualTags.size) {
        parts.push({ cls: 't', text: norm([...pb.manualTags].slice(0, 5).join(', ')) })
      }
      if (selections.shot) {
        const shot = SHOT.find(option => option.id === selections.shot)
        if (shot?.prompt) parts.push({ cls: 't', text: norm(shot.prompt) })
      }
      loraSpecs.value.forEach(spec => parts.push({ cls: 'l', text: `<lora:${loraSpecText(spec)}>` }))
      return dedupeParts(applyFraming(parts, selections.shot))
    }

    // 5) 色彩情调
    if (pb.colorMood) {
      const mood = COLOR_MOODS.find(option => option.id === pb.colorMood)
      if (mood?.prompt) parts.push({ cls: 't', text: norm(mood.prompt) })
    }
    // 6) 情绪
    if (pb.emotionPrompt) parts.push({ cls: 't', text: norm(pb.emotionPrompt) })
    // 7) 镜头
    if (selections.shot) {
      const shot = SHOT.find(option => option.id === selections.shot)
      if (shot?.prompt) parts.push({ cls: 't', text: norm(shot.prompt) })
    }
    // 8) 光照
    if (selections.lighting) {
      const lighting = LIGHTING.find(option => option.id === selections.lighting)
      if (lighting?.prompt) parts.push({ cls: 'c', text: norm(lighting.prompt) })
    }
    // 9) 构图
    if (selections.composition) {
      const composition = COMPOSITION.find(option => option.id === selections.composition)
      if (composition?.prompt) parts.push({ cls: 't', text: norm(composition.prompt) })
    }

    // 10) 手动标签（剔除与场景模板重复的）
    if (pb.manualTags.size) {
      const templateKeys = new Set(
        splitBreaks(sceneTemplate).flatMap(segment => tokenize(segment)).map(normalizeKey),
      )
      const manual = [...pb.manualTags].filter(tag => !templateKeys.has(normalizeKey(tag)))
      if (manual.length) parts.push({ cls: 't', text: norm(manual.join(', ')) })
    }

    // 11) 智能 tail：全身走 deep_focus，其余 depth_of_field
    if (pb.sdParams.tail) {
      const isWide = selections.shot
        ? selections.shot === 'wide'
        : (pb.manualTags.has('wide_shot') || pb.manualTags.has('full_body'))
      parts.push({ cls: 'c', text: isWide ? 'deep_focus' : 'depth_of_field' })
    }

    // 12) LoRA
    loraSpecs.value.forEach(spec => parts.push({ cls: 'l', text: `<lora:${loraSpecText(spec)}>` }))

    return dedupeParts(applyFraming(parts, selections.shot))
  })

  const positivePrompt = computed(() =>
    sanitizePrompt(promptParts.value.filter(part => part.cls !== 'n').map(part => part.text).join(', ')),
  )

  const negativePrompt = computed(() => {
    if (!pb.sdParams.negative) return ''
    const scene = effectiveScene.value
    // 场景自带负面优先，其次全站默认；再叠加 model profile 策略。
    const sceneNegativeBase = scene?.negative || NEGATIVE_DEFAULT
    const custom = String(pb.sdParams.negativeCustom || '').trim()
    const withProfile = modelNegativePrompt(modelProfile.value, sceneNegativeBase)
    const merged = custom ? mergeTokenText(custom, withProfile) : withProfile
    return adaptNegative(merged, scene, { shot: pb.selections.shot, character: pb.char })
  })

  const promptReport = computed(() => {
    const parts = [...promptParts.value]
    if (negativePrompt.value) parts.push({ cls: 'n', text: negativePrompt.value })
    return analyzeParts(parts)
  })

  const artViolations = computed(() => checkArtDirection(positivePrompt.value))
  const previewPrompt = computed(() => {
    if (!positivePrompt.value) return ''
    return negativePrompt.value ? `${positivePrompt.value}\n[NEG]\n${negativePrompt.value}` : positivePrompt.value
  })

  return {
    currentTraits,
    modelProfile,
    effectiveScene,
    loraSpecs,
    promptParts,
    positivePrompt,
    negativePrompt,
    promptReport,
    artViolations,
    previewPrompt,
  }
}
