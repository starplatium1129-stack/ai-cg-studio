import { ref, type Ref } from 'vue'
import { usePromptBuilderStore, CHAR_PROMPT, type HistoryEntry } from '@/stores/promptBuilderStore'
import { apiClient } from '@/api/client'
import { findCharacter as findPopularCharacter, type SceneBlueprint, type PopularCharacter } from '@/utils/popularContent'
import {
  ANIMA_CHARACTER_BY_CHARACTER,
  animaRequestPayload,
  type useAnimaSession,
  type AnimaPublicJob,
  type AnimaRequest,
} from '@/composables/generation/useAnimaSession'
import type { useSDGenerate } from '@/composables/generation/useSDGenerate'
import type { usePromptAssembly } from '@/composables/prompt/usePromptAssembly'
import { useBatchDraw, type BatchDrawRunnerInput, type BatchDrawRunnerResult, type BatchEngine, type BatchTargetItem } from '@/composables/generation/useBatchDraw'
import type { SDQueueJob } from '@/composables/generation/useSDQueue'

type PromptBuilderStore = ReturnType<typeof usePromptBuilderStore>
type AnimaSession = ReturnType<typeof useAnimaSession>
type PromptAssembly = ReturnType<typeof usePromptAssembly>

export interface PromptBatchRunnersDeps {
  pb: PromptBuilderStore
  sd: ReturnType<typeof useSDGenerate>
  sdSize: Ref<string>
  negativePrompt: PromptAssembly['negativePrompt']
  loraSpecs: PromptAssembly['loraSpecs']
  modelProfile: PromptAssembly['modelProfile']
  animaState: AnimaSession['state']
  /** 视图持有的 SD 执行路径（队列/直出/批量共用同一条 runJob）。 */
  runJob: (job: Omit<SDQueueJob, 'id'>, opts?: { disableLora?: boolean }) => Promise<string | null>
  /** 历史入册的引擎字段快照（Anima 读 result/job metadata，SD 读面板状态）。 */
  historyGenerationFields: () => Partial<HistoryEntry>
  sceneBlueprints: () => SceneBlueprint[]
  popularCharacters?: () => PopularCharacter[]
  currentBasePrompt?: () => string
  /** 绘图台当前完整编译出的实时提示词（含所有标签、镜头、光影、画面指令） */
  currentLivePrompt?: () => string
}

/**
 * 绘图页批量出图 runner 编排（支持「多场景蓝图」与「同词条多角色漫游」）。
 *
 * 调度与进度归 useBatchDraw，这里承担引擎差异、蓝图/角色 → prompt/任务 的组装，
 * 以及历史记录精准归属入册。
 */
export function usePromptBatchRunners(deps: PromptBatchRunnersDeps) {
  const { pb, sd, sdSize, negativePrompt, loraSpecs, modelProfile, animaState, runJob, historyGenerationFields } = deps

  const batchEngine = ref<BatchEngine>('sd')

  function getPopularList(): PopularCharacter[] {
    return deps.popularCharacters?.() || pb.popularCharacters || []
  }

  /**
   * 从当前完整提示词中剥离原角色的特征、专属服装与 LoRA 标签，
   * 提炼出干净的「环境、构图、光影、画面指令」通用基底。
   */
  function extractUniversalPrompt(rawPrompt: string): string {
    let text = String(rawPrompt || '').trim()
    if (!text) return ''

    // 1. 去除原 studio 角色的锚点
    Object.values(CHAR_PROMPT).forEach(anchor => {
      if (anchor) text = text.replace(anchor, '')
    })

    // 2. 去除热门角色的 identityProse 与 identityTokens
    const popularChars = getPopularList()
    popularChars.forEach((pop: PopularCharacter) => {
      if (pop.identityProse) text = text.replace(pop.identityProse, '')
      if (pop.outfits) {
        pop.outfits.forEach(o => {
          if (o.prose) text = text.replace(o.prose, '')
          if (o.tokens) {
            o.tokens.forEach(tok => {
              text = text.replace(new RegExp(`\\b${tok}\\b`, 'gi'), '')
            })
          }
        })
      }
      if (pop.identityTokens) {
        pop.identityTokens.forEach(tok => {
          text = text.replace(new RegExp(`\\b${tok}\\b`, 'gi'), '')
        })
      }
    })

    // 3. 去除通用角色前缀、LoRA 标签与衣物类描述
    text = text.replace(/<lora:[^>]+>/gi, '')
    text = text.replace(/\b(1girl|2girls|solo)\b/gi, '')
    text = text.replace(/\b(?:She wears|wearing|dressed in|outfit)\b[^,.;]*/gi, '')

    // 4. 互斥服装族与通用衣物 Tag 清洗（彻底剥离旧服装，避免串入新角色）
    const parts = text.split(',').map(p => p.trim()).filter(Boolean)
    const cleanParts = parts.filter(part => {
      const lower = part.toLowerCase()
      // 匹配明确的衣物/鞋袜/制服类 tag
      if (/^(?:[a-z0-9]+_)*(?:clothes|clothing|outfit|costume|coat|overcoat|trench_coat|jacket|dress|sundress|skirt|miniskirt|shirt|blouse|pants|trousers|jeans|shorts|hotpants|crop_top|tank_top|bodysuit|leotard|corset|bra|panties|underwear|boots|shoes|heels|sneakers|sandals|socks|tights|pantyhose|stockings|leggings|thighhighs|thigh_highs|over_knee_socks|knee_socks|uniform|serafuku|suit|robe|cloak|cape|capelet|hoodie|sweater|cardigan|vest|apron|kimono|yukata|qipao|cheongsam|swimsuit|swimwear|bikini|pajamas|sleepwear|nightgown|lingerie|gloves|scarf|necktie|belt|hat|helmet|armor|footwear|headdress)$/.test(lower)) {
        return false
      }
      return true
    })

    return cleanParts.join(', ')
  }

  function resolveTargetCharacter(target: BatchTargetItem) {
    if (target.kind !== 'character') return null
    const charId = target.characterId || target.id
    const popularChars = getPopularList()
    const popChar = findPopularCharacter(popularChars, charId)
    if (popChar) return { kind: 'popular' as const, char: popChar }
    if (charId === 'nene' || charId === 'natsume') {
      return { kind: 'studio' as const, charKey: charId as 'nene' | 'natsume' }
    }
    return null
  }

  /** 组装最终出图 prompt：根据目标是场景还是多角色自适应。 */
  function buildTargetPrompt(input: BatchDrawRunnerInput, isSd: boolean): string {
    const target = input.scene
    const baseText = String(target.prose || '').trim()

    if (target.kind === 'character') {
      const charInfo = resolveTargetCharacter(target)
      if (charInfo?.kind === 'popular') {
        const pop = charInfo.char
        const outfit = pop.outfits?.[0]
        if (isSd) {
          // SD 标签流：角色基础特征 + 专属服装标签 + 场景通用基底
          const tokens = [
            '1girl',
            'solo',
            ...(pop.exactTokens || pop.identityTokens || []),
            ...(outfit?.tokens || []),
            baseText,
          ].filter(Boolean)
          return tokens.join(', ')
        } else {
          // Anima / 自然语言流：遵循 renderPromptPlan 规范，标签在前，人物 Prose + 专属服装 Prose 在后
          const tags = [
            '1girl',
            'solo',
            ...(pop.exactTokens || pop.identityTokens || []),
            ...(outfit?.tokens || []),
            baseText,
          ].filter(Boolean).join(', ')

          const outfitProse = outfit?.prose ? `She wears ${outfit.prose}.` : ''
          const proseParts = [
            pop.identityProse,
            outfitProse,
          ].filter(Boolean).join(' ')

          return proseParts ? `${tags}\n${proseParts}` : tags
        }
      } else if (charInfo?.kind === 'studio') {
        const anchor = CHAR_PROMPT[charInfo.charKey] || ''
        return baseText ? `${anchor}, ${baseText}` : anchor
      }
    }

    // 默认场景蓝图模式
    return buildBatchPrompt(baseText)
  }

  /** 场景模式批量 prompt 组装：场景 prose + 当前角色锚点。 */
  function buildBatchPrompt(prose: string): string {
    const text = String(prose || '').trim()
    if (!text) return ''
    if (pb.isPopular) {
      const character = pb.subject.kind === 'popular'
        ? findPopularCharacter(getPopularList(), pb.subject.characterId || '')
        : null
      const identity = character?.identityProse
      if (identity) return `${text}, ${identity}`
    }
    const anchor = CHAR_PROMPT[pb.char]
    if (anchor) return `${text}, ${anchor}`
    return text
  }

  function batchSceneProse(blueprint: SceneBlueprint | undefined): string {
    const prose = String(blueprint?.promptProse || '').trim()
    if (prose) return prose
    return [blueprint?.description, blueprint?.action, blueprint?.lighting].filter(Boolean).join('，')
  }

  async function runBatchSd(input: BatchDrawRunnerInput): Promise<BatchDrawRunnerResult> {
    const prompt = buildTargetPrompt(input, true)
    if (!prompt) return { ok: false, error: '出图描述或角色配置为空' }
    const target = input.scene
    const charInfo = target.kind === 'character' ? resolveTargetCharacter(target) : null

    // 多角色模式下，若为热门角色/非当前 studio 角色，解除当前宁宁/夏目的 LoRA 绑定，防止人脸与服装串扰
    const isTargetPopular = charInfo?.kind === 'popular'
    const isTargetOtherStudio = charInfo?.kind === 'studio' && charInfo.charKey !== pb.char
    const effectiveLora = (isTargetPopular || isTargetOtherStudio)
      ? ''
      : loraSpecs.value.map(spec => `${spec.name}:${spec.weight}`).join(', ')

    const effectiveChar = charInfo?.kind === 'studio'
      ? charInfo.charKey
      : (isTargetPopular ? 'nene' : pb.char)

    const job: Omit<SDQueueJob, 'id'> = {
      title: target.title,
      prompt,
      negative: negativePrompt.value,
      sceneId: target.id,
      sceneTitle: target.title,
      char: effectiveChar,
      story: target.prose || '',
      size: sdSize.value,
      seed: input.seed,
      cfg: pb.sdParams.cfg,
      steps: pb.sdParams.steps,
      sampler: pb.sdParams.sampler,
      scheduler: pb.sdParams.scheduler || '',
      checkpoint: pb.sdModelName || sd.checkpoint.value || '',
      lora: effectiveLora,
      hiresFix: pb.sdParams.hiresFix,
      hiresScale: pb.sdParams.hiresScale,
      hiresUpscaler: pb.sdParams.hiresUpscaler,
      hiresSteps: pb.sdParams.hiresSteps,
      denoisingStrength: pb.sdParams.hiresDenoise,
      faceDetailer: pb.sdParams.faceDetailer,
    }
    try {
      const url = await runJob(job, { disableLora: isTargetPopular || isTargetOtherStudio })
      if (!url) return { ok: false, error: sd.errorMsg.value || 'SD 生成失败' }
      const response = await fetch(url, { cache: 'no-store' })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.startsWith('image/')) return { ok: false, error: '成片响应不是图片' }
      const blob = await response.blob()
      if (!blob.size) return { ok: false, error: '成片数据已失效' }

      await pb.commitHistoryEntry({
        blob,
        seed: input.seed >= 0 ? input.seed : (sd.resultSeed.value ?? undefined),
        size: job.size,
        negative: job.negative,
        prompt: job.prompt,
        ...historyGenerationFields(),
        // 精准覆盖角色元数据
        ...(isTargetPopular ? {
          subject: 'popular' as const,
          characterId: charInfo.char.id,
          outfitId: charInfo.char.outfits?.[0]?.id,
        } : charInfo?.kind === 'studio' ? {
          character: charInfo.charKey,
          subject: 'studio' as const,
          characterId: undefined,
        } : {}),
        story: target.prose || '',
        scene: target.kind === 'scene' ? target.id : null,
        sceneTitle: target.title || undefined,
        hiresFix: job.hiresFix,
        hiresScale: job.hiresScale,
        hiresUpscaler: job.hiresUpscaler,
        hiresSteps: job.hiresSteps,
        hiresDenoise: job.denoisingStrength,
        faceDetailer: job.faceDetailer,
      })
      return { ok: true, resultUrl: URL.createObjectURL(blob) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'SD 生成失败' }
    }
  }

  async function runBatchAnima(input: BatchDrawRunnerInput): Promise<BatchDrawRunnerResult> {
    if (!animaState.value.online) return { ok: false, error: 'Anima 当前未连接' }
    const prompt = buildTargetPrompt(input, false)
    if (!prompt) return { ok: false, error: '出图描述或角色配置为空' }
    const target = input.scene
    const charInfo = target.kind === 'character' ? resolveTargetCharacter(target) : null
    const isTargetPopular = charInfo?.kind === 'popular'

    const selectedModel = animaState.value.models.find(model => model.id === animaState.value.modelId)
    const profileId = modelProfile.value?.id || selectedModel?.profileId || ''

    // Anima 角色绑定：如果是 studio 角色（nene/natsume）走映射，若是热门角色走 no-lora 或 null
    const animaCharKey = charInfo?.kind === 'studio'
      ? charInfo.charKey
      : (charInfo?.kind === 'popular' ? null : pb.char)

    const request: AnimaRequest = {
      prompt,
      negative: '',
      profileId,
      modelId: animaState.value.modelId,
      loraId: (isTargetPopular || (charInfo?.kind === 'studio' && charInfo.charKey !== pb.char))
        ? null
        : animaState.value.loraId,
      loraStrength: animaState.value.loraStrength,
      width: animaState.value.width,
      height: animaState.value.height,
      steps: animaState.value.steps,
      cfg: animaState.value.cfg,
      ...(input.seed >= 0 ? { seed: input.seed } : {}),
      character: (animaState.value.family === 'krea2' || !animaCharKey || animaCharKey === 'triad')
        ? null
        : ANIMA_CHARACTER_BY_CHARACTER[animaCharKey as 'nene' | 'natsume'] || null,
      hiresFix: Boolean(animaState.value.hiresFix),
      hiresScale: animaState.value.hiresScale,
      hiresDenoise: animaState.value.hiresDenoise,
    }
    try {
      const jobRoute = animaState.value.family === 'krea2' ? '/api/creative/jobs' : '/api/anima/jobs'
      const data = await apiClient.request<{ ok?: boolean; job?: AnimaPublicJob; error?: string }>(jobRoute, {
        method: 'POST',
        body: animaRequestPayload(request),
        timeoutMs: 30_000,
      })
      if (data.ok !== true || !data.job?.id) throw new Error(data.error || 'Anima 任务创建失败')
      const jobId = data.job.id
      const deadline = Date.now() + 10 * 60 * 1000
      let job = data.job
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const state = await apiClient.request<{ ok?: boolean; job?: AnimaPublicJob; error?: string }>(
          `${jobRoute}/${encodeURIComponent(jobId)}`, { cache: 'no-store', timeoutMs: 15_000 })
        if (state.ok !== true || !state.job) throw new Error(state.error || 'Anima 状态无效')
        job = state.job
        if (job.status === 'failed') throw new Error(job.error || 'Anima 生成失败')
        if (job.status === 'cancelled') return { ok: false, error: '任务已取消' }
        if (job.status === 'succeeded' && job.resultAvailable && job.resultUrl) break
      }
      if (job.status !== 'succeeded' || !job.resultUrl) throw new Error('Anima 生成超时')
      const blob = await fetchImageBlob(job.resultUrl)
      if (!blob.size) throw new Error('生成结果为空')

      await pb.commitHistoryEntry({
        blob,
        seed: job.seed,
        negative: '',
        prompt,
        ...historyGenerationFields(),
        // 精准覆盖角色元数据
        ...(isTargetPopular ? {
          subject: 'popular' as const,
          characterId: charInfo.char.id,
          outfitId: charInfo.char.outfits?.[0]?.id,
        } : charInfo?.kind === 'studio' ? {
          character: charInfo.charKey,
          subject: 'studio' as const,
          characterId: undefined,
        } : {}),
        story: target.prose || '',
        scene: target.kind === 'scene' ? target.id : null,
        sceneTitle: target.title || undefined,
        hiresFix: Boolean(animaState.value.hiresFix),
        hiresScale: animaState.value.hiresScale,
        hiresDenoise: animaState.value.hiresDenoise,
      })
      return { ok: true, resultUrl: URL.createObjectURL(blob) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Anima 生成失败' }
    }
  }

  async function fetchImageBlob(url: string): Promise<Blob> {
    const response = await fetch(url, { cache: 'no-store' })
    const contentType = String(response.headers.get('content-type') || '')
    if (!response.ok) throw new Error(`图片读取失败（HTTP ${response.status}）`)
    if (!contentType.startsWith('image/')) throw new Error('网关返回的结果不是图片')
    const blob = await response.blob()
    if (!blob.size) throw new Error('生成结果为空')
    return blob
  }

  const batchDraw = useBatchDraw({
    onFlash: (message) => pb.flash(message),
    run: (input) => batchEngine.value === 'sd' ? runBatchSd(input) : runBatchAnima(input),
  })

  /** 按场景蓝图启动批量出图 */
  async function onBatchStart(payload: { sceneIds: string[]; count: number }) {
    const scenes: BatchTargetItem[] = payload.sceneIds.map(id => {
      const blueprint = deps.sceneBlueprints().find(item => item.id === id)
      return {
        id,
        title: blueprint?.title || id,
        prose: batchSceneProse(blueprint),
        subtitle: blueprint?.location || blueprint?.category,
        kind: 'scene' as const,
      }
    }).filter(item => item.prose)
    if (!scenes.length) { pb.flash('所选场景没有可用的描述'); return }
    const baseSeed = pb.sdParams.seedLock && pb.sdParams.seed >= 0
      ? pb.sdParams.seed
      : Math.floor(Math.random() * 900000000)
    await batchDraw.start(scenes, payload.count, baseSeed, '个场景')
  }

  /** 按多角色启动批量漫游出图（相同词条，不同角色） */
  async function onBatchStartCharacters(payload: { characterIds: string[]; count: number; basePrompt?: string }) {
    // 优先读取当前绘图台完整编译的实时提示词，若无再回退故事/描述
    const liveRaw = deps.currentLivePrompt?.() || ''
    const fallbackRaw = payload.basePrompt || deps.currentBasePrompt?.() || pb.story || pb.visualDescription || ''
    const basePrompt = extractUniversalPrompt(liveRaw || fallbackRaw) || String(fallbackRaw).trim()
    const popularChars = getPopularList()

    const targets: BatchTargetItem[] = payload.characterIds.map(id => {
      const pop = findPopularCharacter(popularChars, id)
      if (pop) {
        return {
          id: pop.id,
          characterId: pop.id,
          title: pop.displayName,
          subtitle: pop.franchise,
          avatarUrl: `/assets/characters/thumbs/popular-${pop.id}.webp`,
          prose: basePrompt,
          kind: 'character',
        }
      }
      if (id === 'nene' || id === 'natsume') {
        const name = id === 'nene' ? '绫地宁宁' : '四季夏目'
        return {
          id,
          characterId: id,
          title: name,
          subtitle: '星光咖啡馆与死神之蝶',
          avatarUrl: `/assets/characters/thumbs/popular-${id}.webp`,
          prose: basePrompt,
          kind: 'character',
        }
      }
      return null
    }).filter(Boolean) as BatchTargetItem[]

    if (!targets.length) { pb.flash('所选角色无效'); return }
    const baseSeed = pb.sdParams.seedLock && pb.sdParams.seed >= 0
      ? pb.sdParams.seed
      : Math.floor(Math.random() * 900000000)
    await batchDraw.start(targets, payload.count, baseSeed, '位角色')
  }

  /** 只重跑失败/已取消的张：自适应从场景蓝图或角色表恢复 */
  async function onRetryFailed() {
    if (batchDraw.running.value) return
    const failedJobs = batchDraw.jobs.value
      .filter(job => job.status === 'failed' || job.status === 'cancelled')
    if (!failedJobs.length) return

    const popularChars = getPopularList()
    const blueprints = deps.sceneBlueprints()
    const targets: BatchTargetItem[] = []
    const seenIds = new Set<string>()

    for (const job of failedJobs) {
      if (seenIds.has(job.sceneId)) continue
      seenIds.add(job.sceneId)

      if (job.kind === 'character') {
        const pop = findPopularCharacter(popularChars, job.sceneId)
        if (pop) {
          targets.push({
            id: pop.id,
            characterId: pop.id,
            title: pop.displayName,
            subtitle: pop.franchise,
            avatarUrl: `/assets/characters/thumbs/popular-${pop.id}.webp`,
            prose: job.subtitle || deps.currentBasePrompt?.() || pb.story || '',
            kind: 'character',
          })
        } else if (job.sceneId === 'nene' || job.sceneId === 'natsume') {
          targets.push({
            id: job.sceneId,
            characterId: job.sceneId,
            title: job.sceneTitle || job.sceneId,
            subtitle: '星光咖啡馆与死神之蝶',
            avatarUrl: `/assets/characters/thumbs/popular-${job.sceneId}.webp`,
            prose: deps.currentBasePrompt?.() || pb.story || '',
            kind: 'character',
          })
        }
      } else {
        const blueprint = blueprints.find(item => item.id === job.sceneId)
        if (blueprint) {
          targets.push({
            id: blueprint.id,
            title: blueprint.title || blueprint.id,
            prose: batchSceneProse(blueprint),
            subtitle: blueprint.location || blueprint.category,
            kind: 'scene',
          })
        }
      }
    }

    if (!targets.length) { pb.flash('失败项已不可用，无法重跑'); return }
    await batchDraw.retryFailed(targets)
  }

  return { batchEngine, batchDraw, onBatchStart, onBatchStartCharacters, onRetryFailed }
}
