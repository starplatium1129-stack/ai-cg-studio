import { useTrackedTask } from '@/composables/useTaskCenter'
import { ref, shallowRef, type Ref } from 'vue'
import { isLocalStudioHost } from '@/utils/runtimeEnvironment'
import { identityDomainOf } from '@/utils/interrogateMerge'
import { artistStyleProse, artistTagsForEngine } from '@/config/artistStyles'
import { popularPortraitSrc } from '@/utils/popularPortraitSource'
import { usePromptBuilderStore, CHAR_PROMPT, type HistoryEntry } from '@/stores/promptBuilderStore'
import { apiClient, ApiClientError } from '@/api/client'
import {
  findCharacter as findPopularCharacter,
  buildPopularPromptPlan, defaultOutfit, findOutfit, inferBlueprintDecisions,
  type SceneBlueprint,
  type PopularCharacter,
} from '@/utils/popularContent'
import { mutualGroupWithCategory, normalizeKey } from '@/utils/promptPolicy'
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
  const { sd, runJob } = deps
  let pb = deps.pb
  const sdSize = shallowRef(deps.sdSize.value), negativePrompt = shallowRef(deps.negativePrompt.value)
  const loraSpecs = shallowRef(deps.loraSpecs.value), modelProfile = shallowRef(deps.modelProfile.value)
  const animaState = shallowRef(deps.animaState.value)
  let characters: PopularCharacter[] | null = null
  let blueprints: SceneBlueprint[] | null = null
  let fields: Partial<HistoryEntry> = {}
  let runEngine: BatchEngine = 'sd'
  const plans = new Map<string, { negative: string; outfitId?: string; size?: string }>()
  const clone = <T,>(value: T): T => value == null ? value : JSON.parse(JSON.stringify(value)) as T
  const historyGenerationFields = () => fields
  function captureBatch() {
    const live = deps.pb
    pb = { ...live, subject: clone(live.subject), selections: clone(live.selections), sdParams: clone(live.sdParams),
      manualTags: new Set(live.manualTags), outfitOverride: clone(live.outfitOverride) } as PromptBuilderStore
    characters = clone(deps.popularCharacters?.() || live.popularCharacters)
    blueprints = clone(deps.sceneBlueprints())
    sdSize.value = deps.sdSize.value; negativePrompt.value = deps.negativePrompt.value
    loraSpecs.value = clone(deps.loraSpecs.value); modelProfile.value = clone(deps.modelProfile.value)
    animaState.value = clone(deps.animaState.value); fields = clone(deps.historyGenerationFields())
    runEngine = batchEngine.value; plans.clear(); pendingSaves.clear()
  }
  const blueprintList = () => blueprints || deps.sceneBlueprints()

  const batchEngine = ref<BatchEngine>('sd')

  function getPopularList(): PopularCharacter[] {
    return characters || deps.popularCharacters?.() || pb.popularCharacters || []
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
    const popularChars = pb.subject.kind === 'popular' ? getPopularList().filter(item => item.id === (pb.subject.kind === 'popular' ? pb.subject.characterId : '')) : []
    popularChars.forEach((pop: PopularCharacter) => {
      if (pop.identityProse) text = text.replace(pop.identityProse, '')
      if (pop.outfits) {
        pop.outfits.forEach(o => {
          if (o.prose) text = text.replace(o.prose, '')
          if (o.tokens) {
            o.tokens.forEach(tok => {
              text = text.split(',').filter(part => normalizeKey(part) !== normalizeKey(tok)).join(',')
            })
          }
        })
      }
      if (pop.identityTokens) {
        [...pop.identityTokens, ...pop.exactTokens, ...pop.aliases].forEach(tok => {
              text = text.split(',').filter(part => normalizeKey(part) !== normalizeKey(tok)).join(',')
        })
      }
    })

    // 3. 去除通用角色前缀、LoRA 标签与衣物类描述
    text = text.replace(/<lora:[^>]+>/gi, '')
    text = text.replace(/\b(1girl|2girls|solo)\b/gi, '')
    text = text.replace(/\b(?:She wears|wearing|dressed in|outfit)\b[^,.;]*/gi, '')

    // 4. 互斥服装族与通用衣物 Tag 清洗（彻底剥离旧服装，避免串入新角色）
    const studioKeys = new Set(Object.values(CHAR_PROMPT).flatMap(anchor => anchor.split(',').map(normalizeKey)))
    const parts = text.split(',').map(p => p.trim()).filter(part => part && !studioKeys.has(normalizeKey(part)))
    const cleanParts = parts.filter(part => {
      if (identityDomainOf(part) || mutualGroupWithCategory(part)?.category === 'outfit') return false
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
    const charId = target.kind === 'character' ? target.characterId || target.id : blueprintList().find(item => item.id === target.id)?.characterId
    if (!charId) return null
    const popularChars = getPopularList()
    const popChar = findPopularCharacter(popularChars, charId)
    if (popChar) return { kind: 'popular' as const, char: popChar }
    if (charId === 'nene' || charId === 'natsume') {
      return { kind: 'studio' as const, charKey: charId as 'nene' | 'natsume' }
    }
    return null
  }

  /**
   * 从当前手动词条/提示词中检测是否指定了互斥服装（如泳装、女仆等），
   * 若有则返回该服装的 tokens，供所有角色全员换装顶替。
   */
  function detectOutfitOverrideFromContext(): string[] | null {
    if (pb.outfitOverride?.tokens?.length) {
      return [...pb.outfitOverride.tokens]
    }
    const tags = [...pb.manualTags]
    const outfitTokens: string[] = []
    for (const tag of tags) {
      const hit = mutualGroupWithCategory(tag)
      if (hit && hit.category === 'outfit') {
        outfitTokens.push(tag)
      }
    }
    return outfitTokens.length ? outfitTokens : null
  }

  /** 组装最终出图 prompt：根据目标是场景还是多角色自适应。 */
  function buildTargetPrompt(input: BatchDrawRunnerInput, isSd: boolean): string {
    const target = input.scene
    const baseText = String(target.prose || '').trim()

    const charInfo = resolveTargetCharacter(target)
    if (charInfo?.kind === 'popular') {
      if (isSd) throw new Error('热门角色蓝图和漫游请使用 Anima / Krea 2 引擎')
      const pop = charInfo.char
      const blueprint = target.kind === 'scene' ? blueprintList().find(item => item.id === target.id) || null : null
      const outfit = (blueprint?.outfitId ? findOutfit(pop, blueprint.outfitId) : null) || defaultOutfit(pop)
      if (!outfit) throw new Error('目标角色没有可用服装')
      const source = pb.subject.kind === 'popular' ? findPopularCharacter(getPopularList(), pb.subject.characterId) : null
      const sourceKeys = new Set([...(source?.identityTokens || []), ...(source?.exactTokens || []), ...(source?.aliases || []), ...(CHAR_PROMPT[pb.char] || '').split(',')].map(normalizeKey))
      const engine = animaState.value.family === 'krea2' ? 'krea2' : 'anima'
      const decisions = blueprint ? inferBlueprintDecisions(blueprint) : null
      const planResult = buildPopularPromptPlan({
        character: pop, outfit, blueprint, engine, profile: modelProfile.value,
        manual: [...pb.manualTags].filter(tag => !identityDomainOf(tag) && !sourceKeys.has(normalizeKey(tag))),
        emotion: pb.emotionPrompt ? [pb.emotionPrompt] : [],
        shot: decisions?.shot ?? pb.selections.shot,
        lighting: decisions?.lighting ?? pb.selections.lighting,
        composition: decisions?.composition ?? pb.selections.composition,
        visualDescription: target.kind === 'character' ? baseText : pb.visualDescription,
        outfitOverride: detectOutfitOverrideFromContext(),
        adultEnabled: isLocalStudioHost() && pb.showMatureScenes,
        matureTokens: new Set(pb.tags.filter(tag => tag.cat === 'Mature').map(tag => normalizeKey(tag.en))),
        artistTags: artistTagsForEngine(pb.artistStyleIds, engine), artistProse: artistStyleProse(pb.artistStyleIds, engine),
      })
      if (!planResult) throw new Error('该蓝图未获当前环境或角色分级授权')
      plans.set(target.id, { negative: planResult.negative, outfitId: outfit.id, size: blueprint?.recommendedSize })
      return planResult.prompt
    }
    if (charInfo?.kind === 'studio') {
      return [CHAR_PROMPT[charInfo.charKey], detectOutfitOverrideFromContext()?.join(', '), baseText].filter(Boolean).join(', ')
    }
    if (target.kind === 'character') throw new Error('目标角色已不可用')
    throw new Error('场景蓝图缺少有效的角色绑定')
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
    const charInfo = resolveTargetCharacter(target)

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

      return await persist(input, {
        blob,
        seed: input.seed >= 0 ? input.seed : (sd.resultSeed.value ?? undefined),
        size: job.size,
        negative: job.negative,
        prompt: job.prompt,
        ...historyGenerationFields(),
        visualDescription: pb.visualDescription, manual_tags: [...pb.manualTags], artistStyleIds: [...pb.artistStyleIds],
        // 精准覆盖角色元数据
        ...(isTargetPopular ? {
          subject: 'popular' as const,
          characterId: charInfo.char.id,
          outfitId: plans.get(target.id)?.outfitId || defaultOutfit(charInfo.char)?.id,
          blueprintId: target.kind === 'scene' ? target.id : null,
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
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'SD 生成失败' }
    }
  }

  async function runBatchAnima(input: BatchDrawRunnerInput): Promise<BatchDrawRunnerResult> {
    if (!animaState.value.online) return { ok: false, error: 'Anima 当前未连接' }
    const prompt = buildTargetPrompt(input, false)
    if (!prompt) return { ok: false, error: '出图描述或角色配置为空' }
    const target = input.scene
    const charInfo = resolveTargetCharacter(target)
    const isTargetPopular = charInfo?.kind === 'popular'

    const selectedModel = animaState.value.models.find(model => model.id === animaState.value.modelId)
    const profileId = modelProfile.value?.id || selectedModel?.profileId || ''

    // Anima 角色绑定：如果是 studio 角色（nene/natsume）走映射，若是热门角色走 no-lora 或 null
    const animaCharKey = charInfo?.kind === 'studio'
      ? charInfo.charKey
      : (charInfo?.kind === 'popular' ? null : pb.char)

    const dimensions = /^(\d+)\s*[x×]\s*(\d+)$/.exec(plans.get(target.id)?.size || '')
    const request: AnimaRequest = {
      prompt,
      negative: plans.get(target.id)?.negative ?? (animaState.value.family === 'krea2' ? '' : negativePrompt.value),
      profileId,
      modelId: animaState.value.modelId,
      loraId: (isTargetPopular || (charInfo?.kind === 'studio' && charInfo.charKey !== pb.char))
        ? null
        : animaState.value.loraId,
      loraStrength: animaState.value.loraStrength,
      width: dimensions ? Number(dimensions[1]) : animaState.value.width,
      height: dimensions ? Number(dimensions[2]) : animaState.value.height,
      steps: animaState.value.steps,
      cfg: animaState.value.cfg,
      ...(input.seed >= 0 ? { seed: input.seed } : {}),
      adultEnabled: isLocalStudioHost() && pb.showMatureScenes,
      character: (animaState.value.family === 'krea2' || !animaCharKey || animaCharKey === 'triad')
        ? null
        : ANIMA_CHARACTER_BY_CHARACTER[animaCharKey as 'nene' | 'natsume'] || null,
      hiresFix: Boolean(animaState.value.hiresFix),
      hiresScale: animaState.value.hiresScale,
      hiresDenoise: animaState.value.hiresDenoise,
    }
    try {
      const jobRoute = animaState.value.family === 'krea2' ? '/api/creative/jobs' : '/api/anima/jobs'
      let data: { ok?: boolean; job?: AnimaPublicJob; error?: string } | undefined
      const admissionDeadline = Date.now() + 120_000
      while (!data && Date.now() < admissionDeadline) {
        if (batchDraw.cancelRequested.value) return { ok: false, cancelled: true }
        try {
          data = await apiClient.request(jobRoute, { method: 'POST', body: animaRequestPayload(request), timeoutMs: 30_000 })
        } catch (error) {
          if (!(error instanceof ApiClientError) || error.status !== 429) throw error
          input.report?.('队列暂满，等待空位…可点停止结束等待')
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }
      if (!data) throw new Error('队列持续繁忙，请稍后重试本项')
      if (data.ok !== true || !data.job?.id) throw new Error(data.error || 'Anima 任务创建失败')
      const jobId = data.job.id
      const deadline = Date.now() + 10 * 60 * 1000
      let job = data.job
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const state = await apiClient.request<{ ok?: boolean; job?: AnimaPublicJob; error?: string }>(
          `${jobRoute}/${encodeURIComponent(jobId)}`, { cache: 'no-store', timeoutMs: 15_000 }).catch(error => {
            if (error instanceof ApiClientError && ['network', 'timeout'].includes(error.kind)) return null
            throw error
          })
        if (!state) { input.report?.('连接暂时中断，正在重连同一任务…'); continue }
        if (state.ok !== true || !state.job) throw new Error(state.error || 'Anima 状态无效')
        job = state.job
        input.report?.(job.status === 'queued' ? '已接收，等待生成…' : '正在生成…')
        if (job.status === 'failed') throw new Error(job.error || 'Anima 生成失败')
        if (job.status === 'cancelled') return { ok: false, error: '任务已取消' }
        if (job.status === 'succeeded' && job.resultAvailable && job.resultUrl) break
      }
      if (job.status !== 'succeeded' || !job.resultUrl) {
        await apiClient.request(`${jobRoute}/${encodeURIComponent(jobId)}`, { method: 'DELETE', timeoutMs: 15_000 }).catch(() => undefined)
        throw new Error('Anima 等待超时，已尝试停止该任务；请核对任务状态后重试')
      }
      const blob = await fetchImageBlob(job.resultUrl)
      if (!blob.size) throw new Error('生成结果为空')

      return await persist(input, {
        blob,
        ...historyGenerationFields(),
        seed: job.seed, negative: request.negative, prompt,
        size: `${request.width}x${request.height}`, engine: animaState.value.family === 'krea2' ? 'krea2' : 'anima',
        model: request.modelId, profile: request.profileId, loraId: request.loraId, loraStrength: request.loraStrength,
        cfg: request.cfg, steps: request.steps, sampler: animaState.value.sampler, scheduler: animaState.value.scheduler,
        visualDescription: pb.visualDescription, manual_tags: [...pb.manualTags], artistStyleIds: [...pb.artistStyleIds],
        // 精准覆盖角色元数据
        ...(isTargetPopular ? {
          subject: 'popular' as const,
          characterId: charInfo.char.id,
          outfitId: plans.get(target.id)?.outfitId || defaultOutfit(charInfo.char)?.id,
          blueprintId: target.kind === 'scene' ? target.id : null,
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

  type HistoryInput = Parameters<PromptBuilderStore['commitHistoryEntry']>[0]
  const pendingSaves = new Map<string, HistoryInput>()
  const saveKey = (input: BatchDrawRunnerInput) => `${input.scene.id}:${input.seed}:${input.variant}`
  async function persist(input: BatchDrawRunnerInput, entry: HistoryInput): Promise<BatchDrawRunnerResult> {
    const key = saveKey(input)
    pendingSaves.set(key, entry)
    const saved = await pb.commitHistoryEntry(entry)
    if (!saved) return { ok: false, error: '图片已生成，入册失败；重试会重新保存，不重复出图', resultUrl: URL.createObjectURL(entry.blob) }
    pendingSaves.delete(key)
    return { ok: true, resultUrl: URL.createObjectURL(entry.blob), historyId: saved.id }
  }

  const batchDraw = useBatchDraw({
    onFlash: (message) => pb.flash(message),
    run: (input) => {
      const saved = pendingSaves.get(saveKey(input))
      return saved ? persist(input, saved) : runEngine === 'sd' ? runBatchSd(input) : runBatchAnima(input)
    },
  })

  function selectedSeed() {
    const seed = runEngine === 'anima' ? animaState.value.seed : pb.sdParams.seedLock ? pb.sdParams.seed : null
    return typeof seed === 'number' && Number.isFinite(seed) && seed >= 0 ? seed : Math.floor(Math.random() * 900000000)
  }

  /** 按场景蓝图启动批量出图 */
  async function onBatchStart(payload: { sceneIds: string[]; count: number }) {
    if (batchDraw.running.value) return
    captureBatch()
    const scenes: BatchTargetItem[] = payload.sceneIds.map(id => {
      const blueprint = blueprintList().find(item => item.id === id)
      return {
        id,
        title: blueprint?.title || id,
        prose: batchSceneProse(blueprint),
        subtitle: blueprint?.location || blueprint?.category,
        kind: 'scene' as const,
      }
    }).filter(item => item.prose)
    if (!scenes.length) { pb.flash('所选场景没有可用的描述'); return }
    const baseSeed = selectedSeed()
    await batchDraw.start(scenes, payload.count, baseSeed, '个场景')
  }

  /** 按多角色启动批量漫游出图（相同词条，不同角色） */
  async function onBatchStartCharacters(payload: { characterIds: string[]; count: number; basePrompt?: string }) {
    if (batchDraw.running.value) return
    captureBatch()
    // 优先读取当前绘图台完整编译的实时提示词，若无再回退故事/描述
    const liveRaw = deps.currentLivePrompt?.() || ''
    const fallbackRaw = payload.basePrompt || deps.currentBasePrompt?.() || pb.story || pb.visualDescription || ''
    const basePrompt = extractUniversalPrompt(liveRaw || fallbackRaw)
    const popularChars = getPopularList()

    const targets: BatchTargetItem[] = payload.characterIds.map(id => {
      const pop = findPopularCharacter(popularChars, id)
      if (pop) {
        return {
          id: pop.id,
          characterId: pop.id,
          title: pop.displayName,
          subtitle: pop.franchise,
          avatarUrl: popularPortraitSrc(pop.id),
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
          avatarUrl: popularPortraitSrc(id),
          prose: basePrompt,
          kind: 'character',
        }
      }
      return null
    }).filter(Boolean) as BatchTargetItem[]

    if (!targets.length) { pb.flash('所选角色无效'); return }
    const baseSeed = selectedSeed()
    await batchDraw.start(targets, payload.count, baseSeed, '位角色')
  }

  /** 只重跑失败/已取消的张：自适应从场景蓝图或角色表恢复 */
  async function onRetryFailed() {
    if (batchDraw.running.value) return
    const failedJobs = batchDraw.jobs.value
      .filter(job => job.status === 'failed' || job.status === 'cancelled')
    if (!failedJobs.length) return

    await batchDraw.retryFailed()
  }

  useTrackedTask(() => ({ kind: 'batch', title: `批量出图 · ${batchDraw.progress.value.total} 张`, route: '/prompt-builder?taskCenter=batch', resultRoute: batchDraw.progress.value.succeeded ? '/gallery?batch=' + encodeURIComponent(String(batchDraw.jobs.value.filter(job => job.historyId != null).at(-1)?.historyId || '')) : undefined, status: batchDraw.running.value ? 'running' : !batchDraw.jobs.value.length ? 'idle' : batchDraw.progress.value.failed ? 'failed' : batchDraw.progress.value.cancelled ? 'cancelled' : 'succeeded', progress: batchDraw.progress.value.total ? batchDraw.progress.value.done / batchDraw.progress.value.total * 100 : null, message: `${batchDraw.jobs.value.find(job => job.status === 'running')?.message || ''} ${batchDraw.progress.value.succeeded} 张成功 · ${batchDraw.progress.value.failed} 张失败 · ${batchDraw.progress.value.cancelled} 张未执行` }), { cancel: batchDraw.cancel, retry: onRetryFailed })
  return { batchEngine, batchDraw, onBatchStart, onBatchStartCharacters, onRetryFailed }
}
