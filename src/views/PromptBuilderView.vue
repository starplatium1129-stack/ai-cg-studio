<template>
  <article
    class="pb journal-workspace"
    :data-character="pb.subject.kind === 'popular' ? pb.subject.characterId : pb.char"
    :data-onboarding-theme="hasOnboardingTheme(popularCharacter?.id)"
    :data-subject="pb.subject.kind"
    :data-director-mode="pb.directorMode"
    :class="{
      'focus-mode': pb.focusMode,
      'has-result': Boolean(displayResultUrl),
      'character-shifting': characterShifting,
    }"
  >

    <DrawingTaskObserver :sd="sd" :anima="animaSession" />
    <WorkspaceArchiveBar v-if="pb.directorMode !== 'pro'"
      chapter="01"
      title="绘遇工作台"
      :subtitle="pb.isPopular ? popularCharacter?.displayName || '热门角色' : (pb.activeScene?.title || (pb.directorMode === 'basic' ? '场景模式' : '专家模式'))"
      :status="pb.isPopular ? '角色创作' : (pb.directorMode === 'basic' ? '场景模式' : '专家模式')"
      :state="pb.isPopular ? 'active' : (pb.directorMode === 'basic' ? 'success' : 'active')"
      :shape="archiveBarShape"
    />

    <div class="pb-topline">
      <div class="pb-header">
        <h1 class="pb-title">开始绘制</h1>
        <p class="pb-sub">{{ modeDescription }}</p>
      </div>
      <div class="pb-top-actions">
        <div class="director-mode-switch" role="group" aria-label="切换绘图工作模式">
          <button class="director-mode-option" type="button"
            :class="{ active: pb.directorMode === 'basic' }"
            :aria-pressed="pb.directorMode === 'basic'"
            @click="setDirectorMode('basic')">场景模式</button>
          <button class="director-mode-option" type="button"
            :class="{ active: pb.directorMode === 'pro' }"
            :aria-pressed="pb.directorMode === 'pro'"
            @click="setDirectorMode('pro')">专家模式</button>
        </div>
        <button class="focus-mode-btn" type="button"
          :aria-label="pb.focusMode ? '退出专注成片模式' : '进入专注成片模式'"
          :aria-pressed="pb.focusMode"
          @click="pb.focusMode = !pb.focusMode">
          <ArchiveIcon :name="pb.focusMode ? 'compress' : 'expand'" class="focus-mode-icon" aria-hidden="true" />
          <span class="focus-mode-label">{{ pb.focusMode ? '退出专注' : '专注成片' }}</span>
        </button>
        <RandomInspirationButton />
        <div class="api-status">
          <button class="badge" :class="engineOnline ? 'badge-online' : 'badge-offline'" type="button"
            :title="engineOnline ? '点击重新检测' : `${engineStatusText}；点击重新检测`"
            @click="recheckEngineConnection">
            <ArchiveIcon :name="engineOnline ? 'success' : 'warning'" />
            <span>{{ engineOnline ? `${drawEngineLabel} 已连接` : (pb.directorMode === 'pro' ? `${drawEngineLabel} 未连接` : engineStatusText) }}</span>
          </button>
          <RouterLink v-if="!engineOnline" class="api-recovery-link" to="/control">控制面板</RouterLink>
        </div>

        <PromptDataTools
          :blueprint-data="currentBlueprintData"
          @flash="pb.flash"
          @load-blueprint="handleLoadBlueprint"
        />
      </div>
    </div>

    <nav v-if="pb.directorMode !== 'pro'" class="drawing-jump-links" aria-label="绘制区快捷导航">
      <a href="#drawing-materials">创作素材</a><a href="#drawing-canvas">画布预览</a><a href="#stepResult">输出设置</a>
    </nav>
    <div class="director-workspace">

      <!-- ─── 左栏：剧本 ──────────────────────────────────── -->
      <div class="director-col col-left" id="drawing-materials">
        <DirectorMaterialDrawer ref="materialDrawer" :expert="pb.directorMode === 'pro'" :scene-context="String(route.query.scene || route.query.blueprint || '')">
        <template #story>

        <DirectorStoryPanel />

        </template>
        <template #character>
        <DirectorCharacterPanel :current-traits="currentTraits" @selectSource="selectPopularSource" @selectCharacter="selectPopularCharacter" @selectOutfit="selectPopularOutfit" />

        </template>
        <template #scenes>
        <DirectorScenesPanel
          :popular-blueprint-pool="popularBlueprintPool"
          :blueprint-categories="blueprintCategories"
          :recommended-blueprints="recommendedBlueprints"
          :filtered-popular-blueprints="filteredPopularBlueprints"
          :popular-category="popularCategory"
          :show-all-blueprints="showAllBlueprints"
          :available-scenes="availableScenes"
          :visible-scenes="visibleScenes"
          :scene-collection="sceneCollection"
          :persona-core-count="personaCoreCount"
          :curated-count="curatedCount"
          :persona-core-ids="personaCoreIds"
          :scene-limit="sceneLimit"
          @update:popularCategory="popularCategory = $event"
          @update:showAllBlueprints="showAllBlueprints = $event"
          @selectBlueprint="selectBlueprint"
          @rotateBlueprintSet="rotateBlueprintSet"
          @toggleBlueprintList="toggleBlueprintList"
          @update:sceneCollection="setSceneCollection($event)"
          @selectScene="selectScene"
          @update:sceneLimit="sceneLimit = $event"
        />
        </template>
        <template #history>
        <HistoryPanel class="advanced-decision"
          :history="pb.history"
          @resume="resumeHistory"
          @duplicate="duplicateHistory"
          @delete="deleteHistory"
          @to-shots="handleHistoryToShots"
          @to-shots-batch="handleHistoryToShotsBatch"
        />
        </template>
        </DirectorMaterialDrawer>
      </div>

      <!-- ─── 中栏：监视器 ────────────────────────────────── -->
      <div class="director-col col-center" id="drawing-canvas">

        <DirectorStagePanel
          :display-result-url="displayResultUrl"
          :generation-busy="generationBusy"
          :generation-error="generationError"
          :generation-stopped="generationStopped"
          :generation-status-text="generationStatusText"
          :generation-progress="generationProgress"
          :generation-progress-style="generationProgressStyle"
          :anima-elapsed="animaState.elapsedSeconds"
          :anima-current-node="animaState.currentNode || ''"
          :draw-engine="drawEngine"
          :inpaint-original-url="inpaintOriginalUrl"
          :inpaint-compare-active="inpaintCompareActive"
          :shots-pending="shotsPending"
          :has-prev-result="!!prevResult"
          :result-archived="resultArchived"
          :saving-result="savingResult"
          :result-temporary="resultTemporary"
          :has-stashed-result="hasStashedResult"
          @generate="callGenerate()"
          @openInpaint="inpaintOpen = true"
          @openRecovery="inspector?.selectSection(drawEngine === 'sd' ? 'delivery' : 'render')"
          @exploreScenes="materialDrawer?.selectSection('scenes')"
          @update:inpaintCompareActive="inpaintCompareActive = $event"
          @upscale="upscaleCurrentResult"
          @goVideo="goToVideo"
          @addToShots="addToShots"
          @goShots="goToShots"
          @saveResult="saveResult"
          @openCompare="compareOpen = true"
          @clearResult="onClearResult"
          @restoreStashed="onRestoreStashed"
          @interrogateResult="handleInterrogateResult"
          @interrogateError="handleInterrogateError"
        />
        <!-- 吸附出图条：尺寸 + 生成紧跟画布，滚动时钉在导航下沿（同步加载保首屏） -->
        <GenerationActionBar
          :engine="drawEngine"
          :busy="generationBusy"
          :online="engineOnline"
          :size="genBarSize"
          :anima-sizes="animaBarSizes"
          :preset-summary="generationPresetSummary"
          :blocked-reason="generateBlockReason"
          @update:size="genBarSize = $event"
          @generate="callGenerate()"
          @cancel="cancelGeneration"
        />
        <!-- 特典服装换装提示：当服装被通用特典或反推顶替时出现，附一键恢复 -->
        <div v-if="outfitOverridden" class="outfit-override-note" role="status">
          <ArchiveIcon name="wardrobe" class="outfit-override-icon" />
          <span class="outfit-override-text">
            已换装为「{{ outfitReplacedLabel || outfitOverrideTokens.slice(0, 3).join('、') }}」
          </span>
          <button type="button" class="outfit-override-restore" @click="pb.clearOutfitOverride()">
            恢复默认服装
          </button>
        </div>

      </div>
      <DirectorInspector ref="inspector" :expert="pb.directorMode === 'pro'" :queue-count="sdQueue.total.value" :busy="generationBusy">
        <template #render>
          <details class="inspector-route" :open="pb.directorMode === 'basic'"><summary>推荐配方与复用</summary>
<ManagedDrawingRouteCard v-if="managedRoute"
      class="pb-managed-route-banner"
      :route="managedRoute"
      :history="pb.history"
      :subject="pb.subject"
      :expert="pb.directorMode === 'pro'"
      :busy="generationBusy"
      @apply="applyManagedRoute"
      @reuse="reuseSuccessfulRecipe"
    />
          </details>
        <!-- Result panel -->
        <div class="result-frame step-panel" id="stepResult">
          <div class="panel-title">引擎与输出</div>

          <div v-if="pb.directorMode === 'pro'" class="engine-switch" role="group" aria-label="出图引擎">
            <button type="button" class="engine-btn" :class="{ active: drawEngine === 'sd' }"
              :disabled="generationBusy || pb.isPopular"
              :title="engineTitle('sd')"
              @click="setDrawEngine('sd')">
              SD 引擎 <span class="engine-sub">{{ pb.isPopular ? '仅工作室角色' : 'WebUI · v18 LoRA' }}</span>
            </button>
            <button type="button" class="engine-btn" :class="{ active: drawEngine === 'anima' }"
              :disabled="generationBusy || (!pb.isPopular && pb.char === 'triad' && !supportsDualCharacter('anima'))" :title="engineTitle('anima')"
              @click="setDrawEngine('anima')">
              Anima 引擎 <span class="engine-sub">{{ pb.isPopular ? 'Aesthetic · 无需 LoRA' : 'v21 LoRA' }}</span>
            </button>
            <button type="button" class="engine-btn" :class="{ active: drawEngine === 'krea2' }"
              :disabled="generationBusy || (!pb.isPopular && pb.char === 'triad' && !supportsDualCharacter('krea2'))" :title="engineTitle('krea2')" @click="setDrawEngine('krea2')">
              Krea 2 <span class="engine-sub">{{ pb.isPopular ? '自然语言 · 身份优先' : 'ComfyUI · 自然语言实验' }}</span>
            </button>
          </div>

          <div v-if="pb.directorMode === 'pro'" class="base-model-picker">
            <label for="baseModel">底模</label>
            <select v-if="drawEngine === 'sd'" id="baseModel" v-model="pb.sdModelName" :disabled="generationBusy"
              :title="generationBusy ? BUSY_HINT : undefined">
              <option value="">使用 WebUI 当前模型</option>
              <option v-for="model in sd.models.value" :key="model" :value="model">{{ model }}</option>
            </select>
            <select v-else id="baseModel" :value="animaState.modelId" :disabled="generationBusy"
              :title="generationBusy ? BUSY_HINT : undefined" @change="selectAnimaModel">
              <option v-for="model in animaState.models" :key="model.id" :value="model.id" :disabled="model.available === false">
                {{ model.label || model.id }}{{ model.available === false ? ' · 资源缺失' : '' }}
              </option>
            </select>
          </div>




        </div>
        <!-- SD params -->
        <GenerationParamsPanel :open="true" v-if="drawEngine === 'sd' && pb.directorMode === 'pro'"
          v-model:params="pb.sdParams"
          :samplers="sd.samplers.value"
          :schedulers="sd.schedulers.value"
          :result-seed="displayResultSeed"
          @touch="pb.markParamTouched"
          @reuse-seed="reuseLastSeed"
          @reset="resetSdParams"
        />

        <AnimaQuickPanel :open="true" v-if="drawEngine !== 'sd' && pb.directorMode === 'pro'"
          :state="animaState"
          :no-lora="animaNoLoraMode"
          @update:state="patchAnimaState"
          @retry="retryAnima"
        />

          <GenerationOutputControls
            :engine="drawEngine"
            :expert="pb.directorMode === 'pro'"
            :preset-summary="generationPresetSummary"
            v-model:params="pb.sdParams"
            :vram-hint="vramHint"
            :vram-level="vramLevel"
            :base-resolution-risk="baseResolutionRisk"
            :base-resolution-hint="baseResolutionHint"
            :can-use-face-detailer="canUseFaceDetailer"
            :generating="generationBusy"
            :result-seed="displayResultSeed"
            :has-result="Boolean(displayResultUrl)"
            :anima-hires-fix="Boolean(animaState.hiresFix)"
            :queue-available="pb.isPopular ? false : sdQueue.canEnqueue.value"
            @update:anima-hires-fix="patchAnimaState({ hiresFix: $event })"
            @upscale-current="upscaleCurrentResult"
            @touch="pb.markParamTouched"
            @enqueue="enqueueCurrent"
            @enqueue-variants="enqueue3Variants"
            @reuse-seed="reuseLastSeed"
            @reset="resetAll"
          />
        </template>
        <template #style>
      <DirectorDecisionsRail
        :emotion-summary="emotionSummary"
        :shot-summary="shotSummary"
        :lighting-summary="lightingSummary"
        :composition-summary="compositionSummary"
        :mood-summary="moodSummary"
      />
        <ArtistStylePicker
          v-if="pb.directorMode === 'pro'"
          :selected="pb.artistStyleIds"
          :engine="drawEngine"
          :curated-artist-styles="pb.currentCuratedArtistStyles"
          @update:selected="pb.setArtistStyleIds"
          @limit-reached="onArtistLimitReached"
        />


        </template>
        <template #prompt>
        <DirectorTagWorkbench />

        <PromptHealthPanel
          class="advanced-decision basic-visible"
          :prompt="previewPromptView"
          :model-name="modelProfileView?.name"
          :report="reportView"
          :art-violations="artViolationsView"
          :lora-text="pb.isPopular ? '' : loraSpecs.map(s => s.name + ':' + s.weight).join(' · ')"
          :open="pb.directorMode === 'pro'"
          @copy="copyPrompt"
          @save="saveCurrentResult"
        />


        </template>
        <template #delivery>
          <div class="result-frame inspector-delivery">
          <!-- 出图自动入册偏好（2026-08-31 用户偏好：默认关；开则直出成片自动进作品册，
               批量/队列不受此开关影响，它们按收集语义始终入册） -->
          <div class="auto-save-gallery-row" role="group" aria-label="出图自动入册">
            <ToggleSwitch v-model="autoSaveToGallery" label="出图自动存入作品册" />
            <span class="auto-save-gallery-label">出图自动存入作品册</span>
            <span class="auto-save-gallery-hint">{{ autoSaveToGallery ? '画面生成后自动存入作品册' : '生成后，点「存入作品册」保存喜欢的画面' }}</span>
          </div>

          <!-- 批量出图入口（多场景 / 多角色） -->
          <div class="batch-entry-row">
            <button
              class="btn btn-ghost"
              type="button"
              :disabled="generationBusy"
              :title="generationBusy ? BUSY_HINT : (batchRunning ? '查看本批出图进度' : '批量选择场景或角色，生成后预览成片并自动入册')"
              @click="batchOpen = true"
            >{{ batchRunning ? '查看批量进度' : '批量出图 · 场景 / 多角色' }}</button>
            <span v-if="shotsPending" class="batch-entry-count">
              分镜待带入 {{ shotsPending }} 镜 · <button class="linklike" type="button" @click="goToShots">去分镜短片</button>
            </span>
          </div>

          <!-- 进度统一由画布舞台的 is-generating 态承担（魔法阵 + 进度环，
               2026-08-28 审计后舞台在生成期间保持可见，不再在此重复进度条） -->

          <SDRecoveryPanel :report="sdErrorReport" @recover="runRecovery" @dismiss="dismissError" />
          <GenerationQueuePanel v-if="drawEngine === 'sd'"
            :total="sdQueue.total.value"
            :done="sdQueue.done.value"
            :paused="sdQueue.paused.value"
            :active-job="sdQueue.activeJob.value"
            :queue="sdQueue.queue.value"
            :progress="generationProgress"
            :paused-reason="queuePausedReason"
            @pause="sdQueue.pause"
            @resume="sdQueue.resume"
            @clear="sdQueue.clear"
            @remove="sdQueue.remove"
          />

          <VoiceStudio
            ref="voiceStudioRef"
            :initial-voice="pb.char === 'natsume' ? 'natsume' : 'nene'"
            :suggested-caption="pb.activeScene?.story || pb.story"
          />

          <DeferredPanel :active="batchOpen">
          <BatchSceneDrawPanel
            :open="batchOpen"
            :scenes="sceneStore.sceneBlueprints"
            :sd-available="sd.online.value"
            :anima-available="animaState.online"
            :deps="batchPanelDeps"
            @close="batchOpen = false"
            @running-change="batchRunning = $event"
          />
          </DeferredPanel>

          </div>
        </template>
      </DirectorInspector>
    </div>

    <!-- Toast 已于 2026-08-29 UX 收编退役，统一走全局 useToast（AppToast）；空壳 Transition 一并清除 -->

    <!-- 出图大图对比：上一张 vs 当前 -->
    <Teleport to="body">
      <Transition name="layer-pop">
        <PromptComparePanel v-if="compareOpen && prevResult && lastResult"
          :previous="prevResult" :current="lastResult" @ready="compareEl = $event" @close="closeCompare" />
      </Transition>
    </Teleport>

    <!-- Anima 智能局部换装弹窗 -->
    <Teleport to="body">
      <DeferredPanel :active="inpaintOpen">
      <AnimaInpaintModal
        :open="inpaintOpen"
        :image-url="displayResultUrl"
        :image-blob="animaState.result?.blob"
        :current-prompt="livePrompt"
        :current-negative="negativePrompt"
        :character="inpaintCharacter"
        :adult-enabled="pb.showMatureScenes"
        :seed="displayResultSeed"
        :submitting="generationBusy"
        @close="inpaintOpen = false"
        @submit="handleInpaintSubmit"
      />
      </DeferredPanel>
    </Teleport>
  </article>
</template>

<script setup lang="ts">
import '@/assets/css/director.css'
import { defineAsyncComponent } from 'vue'
import DeferredPanel from '@/components/director/DeferredPanel.vue'
const PromptComparePanel = defineAsyncComponent(() => import('@/components/director/PromptComparePanel.vue'))
const DirectorMaterialDrawer = defineAsyncComponent(() => import('@/components/director/DirectorMaterialDrawer.vue'))
const DirectorInspector = defineAsyncComponent(() => import('@/components/director/DirectorInspector.vue'))
const VoiceStudio = defineAsyncComponent(() => import('@/components/VoiceStudio.vue'))
const PromptDataTools = defineAsyncComponent(() => import('@/components/PromptDataTools.vue'))
const PromptHealthPanel = defineAsyncComponent(() => import('@/components/PromptHealthPanel.vue'))
const GenerationQueuePanel = defineAsyncComponent(() => import('@/components/GenerationQueuePanel.vue'))
const GenerationParamsPanel = defineAsyncComponent(() => import('@/components/GenerationParamsPanel.vue'))
const GenerationOutputControls = defineAsyncComponent(() => import('@/components/GenerationOutputControls.vue'))
const SDRecoveryPanel = defineAsyncComponent(() => import('@/components/SDRecoveryPanel.vue'))
const AnimaQuickPanel = defineAsyncComponent(() => import('@/components/AnimaQuickPanel.vue'))
const BatchSceneDrawPanel = defineAsyncComponent(() => import('@/components/BatchSceneDrawPanel.vue'))
const AnimaInpaintModal = defineAsyncComponent(() => import('@/components/AnimaInpaintModal.vue'))
const RandomInspirationButton = defineAsyncComponent(() => import('@/components/RandomInspirationButton.vue'))
const DrawingTaskObserver = defineAsyncComponent(() => import('@/components/tasks/DrawingTaskObserver.vue'))
const ArtistStylePicker = defineAsyncComponent(() => import('@/components/ArtistStylePicker.vue'))
const HistoryPanel = defineAsyncComponent(() => import('@/components/HistoryPanel.vue'))
const DirectorStoryPanel = defineAsyncComponent(() => import('@/components/director/DirectorStoryPanel.vue'))
const DirectorCharacterPanel = defineAsyncComponent(() => import('@/components/director/DirectorCharacterPanel.vue'))
const DirectorScenesPanel = defineAsyncComponent(() => import('@/components/director/DirectorScenesPanel.vue'))
const DirectorTagWorkbench = defineAsyncComponent(() => import('@/components/director/DirectorTagWorkbench.vue'))
const DirectorStagePanel = defineAsyncComponent(() => import('@/components/director/DirectorStagePanel.vue'))
const DirectorDecisionsRail = defineAsyncComponent(() => import('@/components/director/DirectorDecisionsRail.vue'))
const ManagedDrawingRouteCard = defineAsyncComponent(() => import('@/components/ManagedDrawingRouteCard.vue'))
const ImageSplitCompare = defineAsyncComponent(() => import('@/components/visual/ImageSplitCompare.vue'))
const PopularCharacterPicker = defineAsyncComponent(() => import('@/components/popular/PopularCharacterPicker.vue'))
const PopularBlueprintPicker = defineAsyncComponent(() => import('@/components/popular/PopularBlueprintPicker.vue'))
import ArchiveIcon, { type ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'
import CornerFrame from '@/components/visual/CornerFrame.vue'
import ToggleSwitch from '@/components/visual/ToggleSwitch.vue'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import GenerationActionBar from '@/components/director/GenerationActionBar.vue'
import { usePromptWorkspace } from "@/composables/prompt/usePromptWorkspace"
import { usePromptLifecycle } from '@/composables/prompt/usePromptLifecycle'
const workspace = usePromptWorkspace()
usePromptLifecycle(workspace)
const {
compareEl,voiceStudioRef,pb,
displayResultUrl,
characterShifting,
hasOnboardingTheme,
popularCharacter,
sd,
animaSession,
archiveBarShape,
modeDescription,
setDirectorMode,
engineOnline,
engineStatusText,
recheckEngineConnection,
drawEngineLabel,
currentBlueprintData,
handleLoadBlueprint,
route,
currentTraits,
selectPopularSource,
selectPopularCharacter,
selectPopularOutfit,
popularBlueprintPool,
blueprintCategories,
recommendedBlueprints,
filteredPopularBlueprints,
popularCategory,
showAllBlueprints,
availableScenes,
visibleScenes,
sceneCollection,
personaCoreCount,
curatedCount,
personaCoreIds,
sceneLimit,
selectBlueprint,
rotateBlueprintSet,
toggleBlueprintList,
setSceneCollection,
selectScene,
resumeHistory,
duplicateHistory,
deleteHistory,
handleHistoryToShots,
handleHistoryToShotsBatch,
generationBusy,
generationError,
generationStopped,
generationStatusText,
generationProgress,
generationProgressStyle,
animaState,
drawEngine,
inpaintOriginalUrl,
inpaintCompareActive,
shotsPending,
prevResult,
resultArchived, savingResult,
resultTemporary,
hasStashedResult,
callGenerate,
inpaintOpen,
inspector,
materialDrawer,
upscaleCurrentResult,
goToVideo,
addToShots,
goToShots,
saveResult,
compareOpen,
onClearResult,
onRestoreStashed,
handleInterrogateResult,
handleInterrogateError,
genBarSize,
animaBarSizes,
generationPresetSummary,
generateBlockReason,
cancelGeneration,
outfitOverridden,
outfitReplacedLabel,
outfitOverrideTokens,
sdQueue,
managedRoute,
applyManagedRoute,
reuseSuccessfulRecipe,
engineTitle,
setDrawEngine,
supportsDualCharacter,
BUSY_HINT,
selectAnimaModel,
displayResultSeed,
reuseLastSeed,
resetSdParams,
animaNoLoraMode,
patchAnimaState,
retryAnima,
vramHint,
vramLevel,
baseResolutionRisk,
baseResolutionHint,
canUseFaceDetailer,
enqueueCurrent,
enqueue3Variants,
resetAll,
emotionSummary,
shotSummary,
lightingSummary,
compositionSummary,
moodSummary,
onArtistLimitReached,
previewPromptView,
modelProfileView,
reportView,
artViolationsView,
loraSpecs,
copyPrompt,
saveCurrentResult,
autoSaveToGallery,
batchRunning,
batchOpen,
sdErrorReport,
runRecovery,
dismissError,
queuePausedReason,
sceneStore,
batchPanelDeps,
lastResult,
closeCompare,
livePrompt,
negativePrompt,
inpaintCharacter,
handleInpaintSubmit
} = workspace
</script>

<style scoped src="@/assets/css/director/view-shell.css"></style>
