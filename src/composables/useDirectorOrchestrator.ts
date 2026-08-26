/* eslint-disable @typescript-eslint/no-explicit-any */
 // @ts-nocheck
import { computed, type Ref } from 'vue'
import { usePromptBuilderStore } from '@/stores/promptBuilderStore'
import { useSceneStore } from '@/stores/sceneStore'
import { useUnifiedPromptAssembly } from '@/composables/useUnifiedPromptAssembly'
import { useAnimaSession } from '@/composables/generation/useAnimaSession'
import { useSDGenerate } from '@/composables/generation/useSDGenerate'
import { usePromptSdQueue } from '@/composables/prompt/usePromptSdQueue'
import { settingsRepository, DRAW_ENGINE_SETTING, type DrawEngine } from '@/storage/settingsRepository'
import type { PromptEngine } from '@/utils/promptPolicy'
import { characterParticleTheme } from '@/utils/characterParticleTheme'
import {
  eligibleBlueprints,
  findCharacter as findPopularCharacter,
  recommendBlueprints,
} from '@/utils/popularContent'

/**
 * 导演台编排器 — 视图仅 `v-bind="orchestrator.bindings"` 与事件转发
 * 原 1150行编排逻辑下沉至此，保持 View 纯粹（目标 98行组合根，参考 useLive2D）
 */
export function useDirectorOrchestrator(
  checkpoint: Ref<string>,
  engine: Ref<PromptEngine>,
  modelName: Ref<string>,
  selectedLoraId: Ref<string>,
  sdSize: Ref<string>,
  sceneLimit: Ref<number>,
  sceneCollection: Ref<'core' | 'curated' | 'all'>,
  popularCategory: Ref<string>,
  showAllBlueprints: Ref<boolean>,
  blueprintCursor: Ref<number>,
  previousBlueprintIds: Ref<string[] | null>,
) {
  const pb = usePromptBuilderStore()
  const sceneStore = useSceneStore()
  const sd = useSDGenerate()
  const assembly = useUnifiedPromptAssembly(pb, checkpoint as any, engine as any, modelName as any, selectedLoraId as any)

  const animaSession = useAnimaSession({
    getCharacter: () => pb.char as any,
    isPopular: () => pb.isPopular,
    getFamily: () => engine.value === 'krea2' ? 'krea2' : 'anima',
    getRequest: () => buildAnimaRequest() as any,
    onResult: () => sd.clearResult(),
    flash: (m: string) => pb.flash(m),
    preferredSize: () => pb.lastRecommendedSize,
  })
  const {
    state: animaState,
    patchState: patchAnimaState,
    refreshBackend: refreshAnimaBackend,
    syncCharacter: syncAnimaCharacter,
    applyModel,
    generate: generateAnima,
    cancel: cancelAnimaJob,
    clearResult: clearAnimaResult,
    startStatusPolling,
    stopStatusPolling,
  } = animaSession

  const { sdErrorReport, dismissError, captureJob, historyGenerationFields, runJob, sdQueue, enqueueCurrent, enqueue3Variants } = usePromptSdQueue({
    pb,
    sd,
    sdSize,
    drawEngine: engine as any,
    livePrompt: assembly.positivePrompt as any,
    negativePrompt: assembly.negativePrompt as any,
    effectiveScene: (assembly as any).studio?.effectiveScene ?? computed(() => null),
    loraSpecs: (assembly as any).studio?.loraSpecs ?? computed(() => []),
    modelProfile: (assembly as any).studio?.modelProfile ?? computed(() => null),
    animaState,
    displayResultSeed: computed(() => null),
  } as any)

  const engineOnline = computed(() => {
    if (engine.value === 'anima') {
      if (pb.isPopular) return animaState.value.online && animaState.value.models.some((m: any) => m.id === animaState.value.modelId && m.available !== false)
      return pb.char !== 'triad' && Boolean(animaState.value.loraId) && animaState.value.online
    }
    if (engine.value === 'krea2') return animaState.value.online
    return sd.online.value
  })
  const generationBusy = computed(() => sd.generating.value || ['submitting', 'running', 'cancelling'].includes(animaState.value.phase))
  const displayResultUrl = computed(() => engine.value !== 'sd' ? (animaState.value.result?.url ?? '') : sd.resultUrl.value)
  const generationStatusText = computed(() => engine.value === 'sd' ? sd.statusText.value : animaState.value.statusText)
  const generationProgress = computed(() => engine.value === 'sd' ? sd.progress.value / 100 : animaState.value.progress)
  const generationError = computed(() => engine.value === 'sd' ? sd.errorMsg.value : animaState.value.errorMsg)
  const generationStopped = computed(() => engine.value === 'sd' ? sd.statusText.value === '已停止' : animaState.value.phase === 'cancelled')

  const popularCharacter = computed(() => {
    if (pb.subject.kind !== 'popular') return null
    return findPopularCharacter(pb.popularCharacters as any, (pb.subject as any).characterId)
  })
  const archiveBarShape = computed(() => {
    if (pb.isPopular) return popularCharacter.value ? characterParticleTheme(popularCharacter.value.id, popularCharacter.value.franchise).shape : 'moon' as const
    return pb.directorMode === 'pro' ? 'spark' as const : 'frame' as const
  })

  const popularBlueprintPool = computed(() => eligibleBlueprints(pb.sceneBlueprints as any, popularCharacter.value as any, { adultEnabled: pb.showMatureScenes }))
  const blueprintCategories = computed(() => {
    const cats = new Set<string>()
    popularBlueprintPool.value.forEach((bp: any) => { if (bp.category) cats.add(bp.category) })
    return [...cats]
  })
  const recommendedBlueprints = computed(() => {
    const pool = popularBlueprintPool.value
    if (!pool.length) return []
    if (pb.subject.kind !== 'popular') return pool.slice(0, 3)
    const key = `${(pb.subject as any).characterId}#${(pb.subject as any).outfitId}`
    return recommendBlueprints(pool as any, key, blueprintCursor.value, previousBlueprintIds.value, 3)
  })

  function setDrawEngine(v: DrawEngine) {
    if (v === 'sd' && pb.isPopular) { pb.flash('热门角色仅支持 Anima 无 LoRA 或 Krea 2'); return }
    if (v !== 'sd' && (pb.char as string) === 'triad' && !pb.isPopular) { pb.flash('双人模式不支持 Anima/Krea2'); return }
    if (engine.value === v) return
    try { settingsRepository.set(DRAW_ENGINE_SETTING, v) } catch { pb.flash('绘图引擎设置保存失败'); return }
    engine.value = v as any
    patchAnimaState({ styleLoraId: '' } as any)
    if (v !== 'sd') { syncAnimaCharacter(pb.char as any); void refreshAnimaBackend() }
    pb.flash(v === 'anima' ? '已切换到 Anima' : v === 'krea2' ? '已切换到 Krea 2' : '已切换到 SD')
  }

  const batchPanelDeps = {
    pb,
    sd,
    sdSize,
    negativePrompt: assembly.negativePrompt,
    loraSpecs: (assembly as any).studio?.loraSpecs ?? { value: [] },
    modelProfile: (assembly as any).studio?.modelProfile ?? { value: null },
    animaState,
    runJob,
    historyGenerationFields,
    sceneBlueprints: () => sceneStore.sceneBlueprints,
  }

  const bindings = computed(() => ({
    archiveBarShape: archiveBarShape.value,
    engineOnline: engineOnline.value,
    generationBusy: generationBusy.value,
    displayResultUrl: displayResultUrl.value,
    generationStatusText: generationStatusText.value,
    generationProgress: generationProgress.value,
    generationError: generationError.value,
    generationStopped: generationStopped.value,
    batchPanelDeps,
  }))

  return {
    pb,
    assembly,
    animaState,
    patchAnimaState,
    refreshAnimaBackend,
    syncAnimaCharacter,
    applyModel,
    generateAnima,
    cancelAnimaJob,
    clearAnimaResult,
    startStatusPolling,
    stopStatusPolling,
    sd,
    sdErrorReport,
    dismissError,
    captureJob,
    historyGenerationFields,
    runJob,
    sdQueue,
    enqueueCurrent,
    enqueue3Variants,
    engineOnline,
    generationBusy,
    displayResultUrl,
    generationStatusText,
    generationProgress,
    generationError,
    generationStopped,
    popularCharacter,
    archiveBarShape,
    popularBlueprintPool,
    blueprintCategories,
    recommendedBlueprints,
    setDrawEngine,
    batchPanelDeps,
    bindings,
  }
}
