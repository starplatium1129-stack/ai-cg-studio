import type { Ref } from 'vue'
import { usePromptBuilderStore, type HistoryEntry } from '@/stores/promptBuilderStore'
import type { DrawEngine } from '@/storage/settingsRepository'
import { restoreHistorySceneStory } from '@/utils/promptBuilderPersistence'
import {
  findBlueprint as findPopularBlueprint,
  findCharacter as findPopularCharacter,
  findOutfit as findPopularOutfit,
  inferBlueprintDecisions,
} from '@/utils/popularContent'
import { ANIMA_LORA_BY_CHARACTER, type useAnimaSession } from '@/composables/generation/useAnimaSession'
import { confirmAction } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'

type PromptBuilderStore = ReturnType<typeof usePromptBuilderStore>
type AnimaSession = ReturnType<typeof useAnimaSession>

export interface PromptHistoryApplyDeps {
  pb: PromptBuilderStore
  animaState: AnimaSession['state']
  patchAnimaState: AnimaSession['patchState']
  clearAnimaResult: AnimaSession['clearResult']
  refreshAnimaBackend: AnimaSession['refreshBackend']
  /** 视图持有的引擎切换动作（含 settingsRepository 持久化与角色互斥校验）。 */
  setDrawEngine: (engine: DrawEngine) => void
  /** 热门蓝图推荐游标重置（视图持有轮换状态）。 */
  resetBlueprintRotation: () => void
  sdSize: Ref<string>
}

/**
 * 绘图页「历史应用」链路（2026-08-22 自 PromptBuilderView 下沉）。
 *
 * 恢复 / 复制历史条目回导演台：按 entry.subject 分流——热门角色走
 * setPopularSubject + 蓝图决策回放 + Anima 面板收敛；工作室角色走
 * setChar / loadScene / 决策与词条回放，旧历史（无 engine 字段）按
 * 既有 SD 契约恢复。删除历史与「复用成功成片配方」同归此处。
 */
export function usePromptHistoryApply(deps: PromptHistoryApplyDeps) {
  const { pb, animaState, patchAnimaState, clearAnimaResult, refreshAnimaBackend, setDrawEngine, resetBlueprintRotation, sdSize } = deps
  const { show: showToast } = useToast()

  function applyHistory(entry: HistoryEntry, keepAsVariant = false) {
    const popularEntry = entry.subject === 'popular' || (entry.noLora && entry.characterId)
    if (popularEntry) {
      const character = findPopularCharacter(pb.popularCharacters, entry.characterId || '')
      const outfit = character ? findPopularOutfit(character, entry.outfitId || '') : null
      if (character && outfit) {
        pb.setPopularSubject(character.id, outfit.id, entry.blueprintId ?? null)
        const blueprint = entry.blueprintId ? findPopularBlueprint(pb.sceneBlueprints, entry.blueprintId) : null
        if (blueprint) {
          const decision = inferBlueprintDecisions(blueprint)
          if (decision.shot) pb.setShot(decision.shot)
          if (decision.lighting) pb.setLighting(decision.lighting)
          pb.setComposition(decision.composition)
          pb.setColorMood(decision.colorMood)
        }
        resetBlueprintRotation()
        const [width, height] = String(entry.size || '832x1216').replace('×', 'x').split('x').map(Number)
        clearAnimaResult()
        patchAnimaState({
          phase: 'idle', progress: null, elapsedSeconds: 0, progressText: '', currentNode: null, statusText: '', errorMsg: '',
          modelId: entry.model && animaState.value.models.some(model => model.id === entry.model)
            ? entry.model
            : 'anima-aesthetic-v1.1',
           loraId: '', loraStrength: animaState.value.loraStrength,
           styleLoraId: '',
           width: Number.isInteger(width) ? width : animaState.value.width,
          height: Number.isInteger(height) ? height : animaState.value.height,
          steps: Number(entry.steps) || animaState.value.steps,
          cfg: Number(entry.cfg) || animaState.value.cfg,
          sampler: entry.sampler || animaState.value.sampler,
          scheduler: entry.scheduler || animaState.value.scheduler,
          seed: entry.seed >= 0 ? entry.seed : animaState.value.seed,
        })
        setDrawEngine(entry.engine === 'krea2' ? 'krea2' : 'anima')
        void refreshAnimaBackend()
      } else {
        pb.setStudioSubject()
        setDrawEngine('sd')
      }
    } else {
      if (entry.character) pb.setChar(entry.character)
      if ((entry.engine === 'anima' || entry.engine === 'krea2') && (entry.character === 'nene' || entry.character === 'natsume')) {
        const [width, height] = String(entry.size || '832x1216').replace('×', 'x').split('x').map(Number)
        clearAnimaResult()
        patchAnimaState({
          phase: 'idle', progress: null, elapsedSeconds: 0, progressText: '', currentNode: null, statusText: '', errorMsg: '',
          modelId: entry.model || 'anima-aesthetic-v1.1',
           loraId: entry.loraId === ANIMA_LORA_BY_CHARACTER[entry.character] ? entry.loraId : ANIMA_LORA_BY_CHARACTER[entry.character],
           loraStrength: entry.loraStrength ?? animaState.value.loraStrength,
           styleLoraId: '',
           width: Number.isInteger(width) ? width : animaState.value.width,
          height: Number.isInteger(height) ? height : animaState.value.height,
          steps: Number(entry.steps) || animaState.value.steps,
          cfg: Number(entry.cfg) || animaState.value.cfg,
          sampler: entry.sampler || animaState.value.sampler,
          scheduler: entry.scheduler || animaState.value.scheduler,
          seed: entry.seed >= 0 ? entry.seed : animaState.value.seed,
        })
         setDrawEngine(entry.engine)
      } else {
        // 旧历史没有 engine 字段，必须按既有 SD 契约恢复。
        setDrawEngine('sd')
      }
    }
    if (!popularEntry) {
      const restoredContext = restoreHistorySceneStory(entry, pb.scenes)
      if (restoredContext.scene) pb.loadScene(restoredContext.scene)
      else pb.clearScene({ keepStory: true })
      // loadScene seeds the scene story; restore the historical user story last.
      pb.setStory(restoredContext.story)
      pb.selections.emotion.splice(0, pb.selections.emotion.length, ...(entry.emotion || []))
      pb.setShot(entry.shot || null)
      pb.setLighting(entry.lighting || null)
      pb.setComposition(entry.composition || null)
      pb.setColorMood(entry.colorMood || null)
      pb.manualTags = new Set(entry.manual_tags || [])
    } else {
      pb.setStory(entry.story || '')
      pb.manualTags = new Set((entry.manual_tags || []).filter(tag => !/(?:ayachi_nene|shiki_natsume|nene_|natsume_)/i.test(tag)))
      pb.visualDescription = entry.visualDescription ?? ''
    }
    pb.setArtistStyleIds(entry.artistStyleIds || [])
    if (entry.seed >= 0) { pb.sdParams.seed = entry.seed; pb.sdParams.seedLock = true }
    pb.sdParams.cfg = Number(entry.cfg) || pb.sdParams.cfg
    pb.sdParams.steps = Number(entry.steps) || pb.sdParams.steps
    if (entry.sampler) pb.sdParams.sampler = entry.sampler
    if (entry.scheduler) pb.sdParams.scheduler = entry.scheduler
    if (entry.model && entry.engine !== 'anima' && entry.engine !== 'krea2' && !popularEntry) pb.sdModelName = entry.model
    if (entry.negative) { pb.sdParams.negative = true }
    // 历史成片负面是"当时场景+当时 profile"的快照，不得写回 negativeCustom ——
    // 否则会作为自定义负面跨场景/跨 profile 泄漏。恢复时由当前场景+profile
    // 重新生成模型原生负面。
    if (entry.size) sdSize.value = entry.size.replace('×', 'x')
    if (keepAsVariant) pb.flash('已复制为新变体草稿')
    else pb.flash('已恢复历史参数')
  }

  function reuseSuccessfulRecipe(id: number) {
    const entry = pb.history.find(item => item.id === id)
    if (!entry) return
    applyHistory(entry, true)
    if (pb.directorMode === 'basic') pb.flash('已复用这张成功成片的参数，可直接生成新变体')
  }

  function resumeHistory(entry: HistoryEntry) { applyHistory(entry) }
  function duplicateHistory(entry: HistoryEntry) { applyHistory(entry, true) }
  /**
   * 删除历史条目（2026-08-30 UX 审计 P0-8）。
   *
   * 底层已改软删，确认文案不再写「不可撤销」，并给 5 秒撤销窗口——原图在
   * 回收站留 30 天，但用户真正会后悔的就是点下去的这几秒。
   */
  async function deleteHistory(entry: HistoryEntry) {
    if (!(await confirmAction(`删除历史「${entry.sceneTitle || entry.scene || '未命名'}」？`))) return
    try {
      await pb.removeHistoryEntry(entry.id)
      pb.flash('历史记录已删除')
      showToast('已移入回收站，30 天内可撤销', 'info', 5000, {
        label: '撤销',
        onClick: () => {
          void pb.restoreHistoryEntry(entry.id).then(ok => {
            showToast(ok ? '已恢复' : '这条记录已不在回收站，无法恢复', ok ? 'success' : 'warning')
          })
        },
      })
    } catch {
      pb.flash('删除失败，请重试')
    }
  }

  return { applyHistory, reuseSuccessfulRecipe, resumeHistory, duplicateHistory, deleteHistory }
}
