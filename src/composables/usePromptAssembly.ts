import { computed, type Ref } from 'vue'
import {
  NEGATIVE_DEFAULT,
  usePromptBuilderStore,
} from '@/stores/promptBuilderStore'
import {
  analyzeParts,
  applyFraming,
  assembleNegative,
  characterControlTokens,
  checkArtDirection,
  dedupeParts,
  enrichDualPrompt,
  formatPromptForProfile,
  loraSpecText,
  normalizeKey,
  qualityPrefix,
  resolveLoraSpecs,
  resolveModelProfile,
  sceneRating,
  profileRatingTag,
  sanitizePrompt,
  sceneSupportsCharacter,
  sceneTemplateText,
  splitBreaks,
  tokenize,
  type PromptEngine,
  type PromptPart,
} from '@/utils/promptPolicy'
import { COLOR_MOODS, LIGHTING, SHOT, COMPOSITION } from '@/config/promptConstants'
import { createPromptPlan, renderPromptPlan } from '@/utils/promptCompiler'
import { artistStyleProse, artistTagsForEngine } from '@/config/artistStyles'

type PromptBuilderStore = ReturnType<typeof usePromptBuilderStore>

function studioSubjectProse(character: string): string {
  if (character === 'nene') {
    return 'Ayachi Nene is the only prominent character, a young adult woman with white hair, purple eyes, an ahoge, and pink hair ribbons'
  }
  if (character === 'natsume') {
    return 'Shiki Natsume is the only prominent character, a young adult woman with black hair, golden-yellow eyes, two red hairclips, and a small mole beneath one eye'
  }
  return ''
}

function sceneContext(scene: PromptBuilderStore['activeScene']) {
  if (!scene) return null
  return {
    title: scene.title,
    category: scene.category,
    tags: scene.tags,
    location: typeof scene.location === 'string' ? scene.location : undefined,
    time: typeof scene.time === 'string' ? scene.time : undefined,
    timeOfDay: scene.timeOfDay,
    weather: typeof scene.weather === 'string' ? scene.weather : undefined,
    camera: scene.camera,
    lighting: scene.lighting,
    emotion: typeof scene.emotion === 'string' ? scene.emotion : undefined,
    rating: scene.rating,
    recommendedSize: typeof scene.recommendedSize === 'string' ? scene.recommendedSize : undefined,
    usage: Array.isArray(scene.usage) ? scene.usage.filter((item): item is string => typeof item === 'string') : undefined,
    animaCaption: typeof scene.animaCaption === 'string' ? scene.animaCaption : undefined,
  }
}

/**
 * Director prompt composition has no UI or SD lifecycle ownership. Keeping it
 * here makes the generated prompt reusable by preview, direct generation, and
 * queued generation without letting the view duplicate policy decisions.
 *
 * Studio 组装只面向工作室角色。画师风格只在专家模式显式选择时进入模型原生位置；Anima 的精确
 * token 契约从视图传入的服务端 LoRA id（L_NENE_V20_ANIMA / L_NAT_V20_ANIMA）解析。
 */
export function usePromptAssembly(
  pb: PromptBuilderStore,
  checkpoint: Readonly<Ref<string>>,
  engine: Readonly<Ref<PromptEngine>>,
  modelName: Readonly<Ref<string>>,
  selectedLoraId: Readonly<Ref<string>>,
) {
  /** 当前引擎 + 模型对应的 profile，禁止跨引擎回退规则。 */
  const modelProfile = computed(() => {
    const base = resolveModelProfile(
      pb.modelProfiles,
      engine.value !== 'sd' ? modelName.value : (pb.sdModelName || checkpoint.value),
      engine.value,
    )
    if (!base || engine.value !== 'anima') return base
    const selected = pb.char === 'triad' ? '' : String(selectedLoraId.value || '')
    const contract = selected ? pb.loraMeta.flatMap(meta => {
      const name = String(meta.name || '')
      const metaId = String(meta.id || '')
      const selectedMeta = metaId === selected || name === selected
        || metaId.includes(selected) || name.includes(selected)
      if (!selectedMeta) return []
      const promptContract = meta.prompt_contract
      if (!promptContract || typeof promptContract !== 'object') return []
      const value = promptContract as { exact_tokens?: unknown; exact_prefixes?: unknown }
      const tokens = Array.isArray(value.exact_tokens) ? value.exact_tokens.filter((token): token is string => typeof token === 'string') : []
      const prefixes = Array.isArray(value.exact_prefixes) ? value.exact_prefixes.filter((token): token is string => typeof token === 'string') : []
      return [{ tokens, prefixes }]
    }) : []
    const exactTokens = contract.flatMap(item => item.tokens)
    const exactPrefixes = contract.flatMap(item => item.prefixes)
    return contract.length
      ? { ...base, exact_tokens: [...new Set([...(base.exact_tokens || []), ...exactTokens])], exact_prefixes: [...new Set([...(base.exact_prefixes || []), ...exactPrefixes])] }
      : base
  })

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

  /** Anima 只认视图传入的服务端 LoRA id；SD 用 characters.json 的正式模型名。 */
  const controlLoraIds = computed<Record<string, string>>(() => {
    if (engine.value !== 'anima') return loraIdByChar.value
    const selected = String(selectedLoraId.value || '')
    if (pb.char === 'triad' || !selected) return {}
    return { [pb.char]: selected }
  })

  /** SD LoRA 按场景显式 <lora:name:weight> 解析；Anima 的 LoRA 由固定工作流加载，不进 Prompt。 */
  const loraSpecs = computed(() =>
    engine.value === 'anima'
      ? (pb.char !== 'triad' && controlLoraIds.value[pb.char]
        ? [{ name: controlLoraIds.value[pb.char], weight: Number(pb.loraMeta.find(meta => meta.id === controlLoraIds.value[pb.char] || meta.name === controlLoraIds.value[pb.char])?.strength?.default) || 0.85 }]
        : [])
      : resolveLoraSpecs(
          pb.char,
          effectiveScene.value,
          pb.loraMeta,
          loraIdByChar.value,
          { shot: pb.selections.shot, manualTags: pb.manualTags },
        ),
  )

  const format = (text: string) => formatPromptForProfile(text, modelProfile.value, engine.value)
  const activeArtistStyleIds = computed(() => pb.directorMode === 'pro' ? pb.artistStyleIds : [])
  const artistTags = computed(() => artistTagsForEngine(activeArtistStyleIds.value, engine.value))
  const artistProse = computed(() => artistStyleProse(activeArtistStyleIds.value))

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
      engine: engine.value,
      profile,
    })

    // 1) 质量前缀（模型 profile + rating 标签）
    if (pb.sdParams.quality) parts.push({ cls: 'q', text: qualityPrefix(profile, scene, engine.value) })

    // 2) 角色行 + 已勾选特征
    const traitTags = currentTraits.value
      .filter(trait => pb.manualTags.has(trait.tag))
      .map(trait => trait.tag)
    const controlTags = characterControlTokens(scene, pb.char, controlLoraIds.value)
    const charLine = pb.charPrompt
    if (charLine) {
      const identityTags = [...controlTags, ...traitTags]
      parts.push({ cls: 'c', text: format(identityTags.length ? `${charLine}, ${identityTags.join(', ')}` : charLine) })
    }
    if (artistTags.value.length) parts.push({ cls: 't', text: artistTags.value.join(', ') })

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
        parts.push({ cls: 't', text: format([...pb.manualTags].slice(0, 5).join(', ')) })
      }
      if (selections.shot) {
        const shot = SHOT.find(option => option.id === selections.shot)
        if (shot?.prompt) parts.push({ cls: 't', text: format(shot.prompt) })
      }
      if (engine.value === 'sd') loraSpecs.value.forEach(spec => parts.push({ cls: 'l', text: `<lora:${loraSpecText(spec)}>` }))
      return dedupeParts(applyFraming(parts, selections.shot))
    }

    // 5) 色彩情调
    if (pb.colorMood) {
      const mood = COLOR_MOODS.find(option => option.id === pb.colorMood)
      if (mood?.prompt) parts.push({ cls: 't', text: format(mood.prompt) })
    }
    // 6) 情绪
    if (pb.emotionPrompt) parts.push({ cls: 't', text: format(pb.emotionPrompt) })
    // 7) 镜头
    if (selections.shot) {
      const shot = SHOT.find(option => option.id === selections.shot)
      if (shot?.prompt) parts.push({ cls: 't', text: format(shot.prompt) })
    }
    // 8) 光照
    if (selections.lighting) {
      const lighting = LIGHTING.find(option => option.id === selections.lighting)
      if (lighting?.prompt) parts.push({ cls: 'c', text: format(lighting.prompt) })
    }
    // 9) 构图
    if (selections.composition) {
      const composition = COMPOSITION.find(option => option.id === selections.composition)
      if (composition?.prompt) parts.push({ cls: 't', text: format(composition.prompt) })
    }

    // 10) 手动标签（剔除与场景模板重复的）
    if (pb.manualTags.size) {
      const templateKeys = new Set(
        splitBreaks(sceneTemplate).flatMap(segment => tokenize(segment)).map(normalizeKey),
      )
      const manual = [...pb.manualTags].filter(tag => !templateKeys.has(normalizeKey(tag)))
      if (manual.length) parts.push({ cls: 't', text: format(manual.join(', ')) })
    }

    // 11) 智能 tail：全身走 deep_focus，其余 depth_of_field
    if (pb.sdParams.tail) {
      const isWide = selections.shot
        ? selections.shot === 'wide'
        : (pb.manualTags.has('wide_shot') || pb.manualTags.has('full_body'))
      parts.push({ cls: 'c', text: format(isWide ? 'deep_focus' : 'depth_of_field') })
    }

    // 12) LoRA
    if (engine.value === 'sd') loraSpecs.value.forEach(spec => parts.push({ cls: 'l', text: `<lora:${loraSpecText(spec)}>` }))

    return dedupeParts(applyFraming(parts, selections.shot))
  })

  const structuredPlan = computed(() => createPromptPlan({
    profile: modelProfile.value,
    identity: pb.charPrompt,
    controls: characterControlTokens(effectiveScene.value, pb.char, controlLoraIds.value),
    artists: artistTags.value,
    artistProse: artistProse.value,
    scenePrompt: sceneTemplateText(effectiveScene.value, { char: pb.char, shot: pb.selections.shot, engine: engine.value, profile: modelProfile.value }),
    emotion: pb.emotionPrompt ? [pb.emotionPrompt] : [],
    camera: pb.selections.shot ? [SHOT.find(item => item.id === pb.selections.shot)?.prompt || ''] : [],
    lighting: pb.selections.lighting ? [LIGHTING.find(item => item.id === pb.selections.lighting)?.prompt || ''] : [],
    composition: pb.selections.composition ? [COMPOSITION.find(item => item.id === pb.selections.composition)?.prompt || ''] : [],
    manual: [...pb.manualTags],
    negative: effectiveScene.value?.negative || NEGATIVE_DEFAULT,
    rating: profileRatingTag(modelProfile.value, effectiveScene.value) || sceneRating(effectiveScene.value).toLowerCase(),
    visualDescription: pb.visualDescription,
    subjectProse: studioSubjectProse(pb.char),
    scene: sceneContext(effectiveScene.value),
  }))

  /**
   * WAI（SD）：质量前缀官方空格原样保留一次，rating 一次，单一标签流。
   * 各 part 已按 Danbooru 契约 norm 过，只在这里去重，不再整体 norm 回下划线。
   */
  const positivePrompt = computed(() => {
    if (engine.value !== 'sd') {
      return renderPromptPlan(structuredPlan.value, engine.value, modelProfile.value).prompt
    }
    return sanitizePrompt(
      promptParts.value.filter(part => part.cls !== 'n').map(part => part.text).join(', '),
    )
  })

  /** 模型原生负面统一装配：官方前缀 + 手/解剖/文字保护 + 场景排除 + rating 安全。 */
  const negativePrompt = computed(() =>
    assembleNegative(modelProfile.value, effectiveScene.value, engine.value, {
      shot: pb.selections.shot,
      character: pb.char,
      custom: pb.sdParams.negativeCustom,
      sdNegativeEnabled: pb.sdParams.negative,
    }),
  )

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
    structuredPlan,
  }
}
