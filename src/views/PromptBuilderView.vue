<template>
  <article
    class="pb"
    :data-character="pb.subject.kind === 'popular' ? pb.subject.characterId : pb.char"
    :data-subject="pb.subject.kind"
    :data-director-mode="pb.directorMode"
    :class="{
      'focus-mode': pb.focusMode,
      'has-result': Boolean(displayResultUrl),
      'character-shifting': characterShifting,
    }"
  >
    <a @click.prevent="$router.push('/')" href="/" class="nav-back">← 回首页</a>

    <WorkspaceArchiveBar
      chapter="01"
      title="DIRECTOR CONSOLE"
      :subtitle="pb.isPopular ? popularCharacter?.displayName || '热门角色' : (pb.activeScene?.title || (pb.directorMode === 'basic' ? '场景模式' : '专家模式'))"
      :status="pb.isPopular ? 'POPULAR · NO LORA' : (pb.directorMode === 'basic' ? 'SCENE MODE' : 'PRO MODE')"
      :state="pb.isPopular ? 'active' : (pb.directorMode === 'basic' ? 'success' : 'active')"
      :shape="archiveBarShape"
    />

    <div class="pb-topline">
      <div class="pb-header">
        <div class="pb-kicker">Nene &amp; Natsume Private Atelier</div>
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
            <span>{{ engineOnline ? `${drawEngineLabel} 已连接` : engineStatusText }}</span>
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

    <div class="director-workspace">

      <!-- ─── 左栏：剧本 ──────────────────────────────────── -->
      <div class="director-col col-left">

        <DirectorStoryPanel />

        <DirectorCharacterPanel :current-traits="currentTraits" @selectSource="selectPopularSource" @selectCharacter="selectPopularCharacter" @selectOutfit="selectPopularOutfit" />

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
        <HistoryPanel class="advanced-decision"
          :history="pb.history"
          @resume="resumeHistory"
          @duplicate="duplicateHistory"
          @delete="deleteHistory"
          @to-shots="handleHistoryToShots"
          @to-shots-batch="handleHistoryToShotsBatch"
        />
      </div>

      <!-- ─── 中栏：监视器 ────────────────────────────────── -->
      <div class="director-col col-center">

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
          @generate="callGenerate()"
          @openInpaint="inpaintOpen = true"
          @exploreScenes="router.push('/scene-explorer')"
          @update:inpaintCompareActive="inpaintCompareActive = $event"
          @upscale="upscaleCurrentResult"
          @goVideo="goToVideo"
          @addToShots="addToShots"
          @goShots="goToShots"
          @saveResult="saveResult"
          @openCompare="compareOpen = true"
          @clearResult="clearDisplayedResult"
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
          @save="saveHistory"
        />

        <ArtistStylePicker
          v-if="pb.directorMode === 'pro'"
          :selected="pb.artistStyleIds"
          :engine="drawEngine"
          :curated-artist-styles="currentCuratedArtistStyles"
          @update:selected="pb.setArtistStyleIds"
          @limit-reached="onArtistLimitReached"
        />

        <!-- SD params -->
        <GenerationParamsPanel v-if="drawEngine === 'sd' && pb.directorMode === 'pro'"
          v-model:params="pb.sdParams"
          :samplers="sd.samplers.value"
          :schedulers="sd.schedulers.value"
          :result-seed="displayResultSeed"
          @touch="pb.markParamTouched"
          @reuse-seed="reuseLastSeed"
          @reset="resetSdParams"
        />

        <!-- Result panel -->
        <div class="result-frame step-panel" id="stepResult">
          <div class="panel-title">出图结果</div>

          <div v-if="pb.directorMode === 'pro'" class="engine-switch" role="group" aria-label="出图引擎">
            <button type="button" class="engine-btn" :class="{ active: drawEngine === 'sd' }"
              :disabled="generationBusy || pb.isPopular"
              :title="engineTitle('sd')"
              @click="setDrawEngine('sd')">
              SD 引擎 <span class="engine-sub">{{ pb.isPopular ? '仅工作室角色' : 'WebUI · v18 LoRA' }}</span>
            </button>
            <button type="button" class="engine-btn" :class="{ active: drawEngine === 'anima' }"
              :disabled="generationBusy || (!pb.isPopular && !supportsDualCharacter('anima'))" :title="engineTitle('anima')"
              @click="setDrawEngine('anima')">
              Anima 引擎 <span class="engine-sub">{{ pb.isPopular ? 'Aesthetic · 无需 LoRA' : 'v21 LoRA' }}</span>
            </button>
            <button type="button" class="engine-btn" :class="{ active: drawEngine === 'krea2' }"
              :disabled="generationBusy || (!pb.isPopular && !supportsDualCharacter('krea2'))" :title="engineTitle('krea2')" @click="setDrawEngine('krea2')">
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

          <!-- 出图自动入册偏好（2026-08-31 用户偏好：默认关；开则直出成片自动进作品册，
               批量/队列不受此开关影响，它们按收集语义始终入册） -->
          <div class="auto-save-gallery-row" role="group" aria-label="出图自动入册">
            <ToggleSwitch v-model="autoSaveToGallery" label="出图自动存入作品册" />
            <span class="auto-save-gallery-label">出图自动存入作品册</span>
            <span class="auto-save-gallery-hint">{{ autoSaveToGallery ? '直出成片将自动进作品册' : '直出成片需手动点「保存快照」' }}</span>
          </div>

          <!-- 批量出图入口（多场景 / 多角色） -->
          <div class="batch-entry-row">
            <button
              class="btn btn-ghost"
              type="button"
              :disabled="generationBusy || batchRunning"
              :title="generationBusy ? BUSY_HINT : (batchRunning ? '批量任务正在跑，等它出完' : '多选场景蓝图或同词条多角色漫游，成片在面板里直接预览挑选，全部自动入册历史')"
              @click="batchOpen = true"
            >批量出图 · 场景 / 多角色</button>
            <span v-if="shotsPending" class="batch-entry-count">
              分镜待带入 {{ shotsPending }} 镜 · <button class="linklike" type="button" @click="goToShots">去分镜短片</button>
            </span>
          </div>

          <!-- 进度统一由画布舞台的 is-generating 态承担（魔法阵 + 进度环，
               2026-08-28 审计后舞台在生成期间保持可见，不再在此重复进度条） -->

          <SDRecoveryPanel :report="sdErrorReport" @recover="runRecovery" @dismiss="dismissError" />
          <GenerationQueuePanel v-if="drawEngine === 'sd'"
            :total="sdQueue.total.value"
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

          <BatchSceneDrawPanel
            :open="batchOpen"
            :scenes="sceneStore.sceneBlueprints"
            :sd-available="sd.online.value"
            :anima-available="animaState.online"
            :deps="batchPanelDeps"
            @close="batchOpen = false"
            @running-change="batchRunning = $event"
          />
        </div>

        <AnimaQuickPanel v-if="drawEngine !== 'sd' && pb.directorMode === 'pro'"
          :state="animaState"
          :no-lora="animaNoLoraMode"
          @update:state="patchAnimaState"
          @retry="retryAnima"
        />
      </div>

      <DirectorDecisionsRail
        :emotion-summary="emotionSummary"
        :shot-summary="shotSummary"
        :lighting-summary="lightingSummary"
        :composition-summary="compositionSummary"
        :mood-summary="moodSummary"
      />
    </div>

    <!-- Toast 已于 2026-08-29 UX 收编退役，统一走全局 useToast（AppToast）；空壳 Transition 一并清除 -->

    <!-- 出图大图对比：上一张 vs 当前 -->
    <Teleport to="body">
      <Transition name="layer-pop">
        <div v-if="compareOpen && prevResult && lastResult" class="pb-compare-overlay" @click.self="closeCompare">
          <div ref="compareEl" class="pb-compare" role="dialog" aria-modal="true" aria-label="出图对比">
          <div class="pb-compare-head">
            <div>
              <div class="pb-compare-kicker">Result compare</div>
              <h3>与上一张对比</h3>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" @click="closeCompare">关闭</button>
          </div>
          <div class="pb-compare-grid">
            <figure v-for="(snap, index) in [prevResult, lastResult]" :key="index" class="pb-compare-card">
              <div class="pb-compare-visual">
                <img :src="snap.url" :alt="'对比图 ' + (index + 1)" loading="eager" decoding="async" />
                <span class="pb-compare-tag" :class="{ current: index === 1 }">{{ index === 0 ? '上一张' : '当前' }}</span>
              </div>
              <figcaption class="pb-compare-facts">
                <span>Seed {{ snap.seed ?? '随机' }}</span>
                <span>{{ snap.size }}</span>
                <span>{{ snap.sampler }}</span>
                <span>CFG {{ snap.cfg }}</span>
                <span>Steps {{ snap.steps }}</span>
                <span>Hires {{ snap.hires }}</span>
                <span class="pb-compare-time">{{ snap.at }}</span>
              </figcaption>
            </figure>
          </div>
        </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Anima 智能局部换装弹窗 -->
    <Teleport to="body">
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
    </Teleport>
  </article>
</template>

<script setup lang="ts">
// 导演台专属样式（91.6KB）随本路由块加载，不再进全局包
import '@/assets/css/director.css'
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch, defineAsyncComponent } from 'vue'
import { onBeforeRouteLeave, useRouter, useRoute } from 'vue-router'
import {
  usePromptBuilderStore,
  type CharKey,
  type HistoryEntry,
  type Scene,
} from '@/stores/promptBuilderStore'
import { useSceneStore } from '@/stores/sceneStore'
import { usePopularPromptAssembly } from '@/composables/prompt/usePopularPromptAssembly'
import { usePromptVideoBridge } from '@/composables/prompt/usePromptVideoBridge'
import { usePromptHistoryApply } from '@/composables/prompt/usePromptHistoryApply'
import { usePromptTagTools } from '@/composables/prompt/usePromptTagTools'
import { usePromptDeepLink } from '@/composables/prompt/usePromptDeepLink'
import type { AnimaResult } from '@/types/anima'
import { useAnimaSession } from '@/composables/generation/useAnimaSession'
import { useAnimaInpaint } from '@/composables/generation/useAnimaInpaint'
import { useSDGenerate } from '@/composables/generation/useSDGenerate'
import { usePromptAssembly } from '@/composables/prompt/usePromptAssembly'
import { useUnifiedPromptAssembly } from '@/composables/useUnifiedPromptAssembly'
import { EMOTION, SHOT, LIGHTING, COMPOSITION, COLOR_MOODS, SCENE_THEMES } from '@/config/promptConstants'
import { usePromptSdQueue } from '@/composables/prompt/usePromptSdQueue'
import { imgGet } from '@/composables/useImageStore'
import { classifySDError, SAFE_SAMPLING, LIGHT_LOAD, type SDErrorReport, type SDRecoveryId } from '@/utils/sdError'
import { defaultOutfit, findBlueprint, findCharacter, findOutfit } from '@/utils/popularContent'
import { characterConflictNote, collectInterrogateContext, mergeInterrogatedTags } from '@/utils/interrogateMerge'
import { useDirectorCatalog } from '@/composables/scene/useDirectorCatalog'
import { useDirectorDerived } from '@/composables/scene/useDirectorDerived'
import { useDirectorEngine } from '@/composables/scene/useDirectorEngine'
import { useDirectorPopular } from '@/composables/scene/useDirectorPopular'
import { useCompareSnapshots } from '@/composables/useCompareSnapshots'
// 折叠面板内的重量级组件走异步加载：它们不参与首屏渲染，按需下载可显著
// 降低导演台路由块体积（预算上限 JS 140KB / CSS 115KB）。
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
import ArchiveIcon, { type ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'
import CornerFrame from '@/components/visual/CornerFrame.vue'
import ToggleSwitch from '@/components/visual/ToggleSwitch.vue'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
// 吸附出图条承载主行动（生成按钮），同步导入保证首屏即位；体量小，不进异步分片。
import GenerationActionBar from '@/components/director/GenerationActionBar.vue'
import { readHiddenScenes, rememberRecent, recordSceneUsage } from '@/utils/sceneUX'
import { scrollBehavior } from '@/utils/motionPreference'
import {
  quickCreateSummary,
  readQuickCreate,
  type QuickCreateSettings,
} from '@/utils/quickCreate'
import { confirmAction } from '@/composables/useConfirm'
import {
  AUTO_SAVE_TO_GALLERY_SETTING,
  DRAW_ENGINE_SETTING,
  settingsRepository,
  type DrawEngine,
} from '@/storage/settingsRepository'

// 热门角色面板按需懒加载：仅在 isPopular 时渲染，避免常驻占用主 chunk。
const PopularCharacterPicker = defineAsyncComponent(() => import('@/components/popular/PopularCharacterPicker.vue'))
const PopularBlueprintPicker = defineAsyncComponent(() => import('@/components/popular/PopularBlueprintPicker.vue'))

const router = useRouter()
const route = useRoute()
const pb = usePromptBuilderStore()
const sceneStore = useSceneStore()
const sd = useSDGenerate()

const {
  storyChips,
  charOptions,
} = useDirectorCatalog()

// 与 config/characters.ts 共用 Express 服务的同一份角色立绘 URL。
// 之前写成静态 src="/assets/..."，Vite transformAssetUrls 会在构建时把它
// 打包进 dist/_app 生成 hashed 副本 —— 同一张图两套缓存，还多占 ~163KB。
const stageMuseUrl = {
  nene: '/assets/characters/nene-official.webp',
  natsume: '/assets/characters/natsume-official.webp',
}

// ── UI state ──────────────────────────────────────────────────────────────
const sceneLimit = ref(20)
const sdSize = ref('832x1216')
const sceneCollection = ref<'core' | 'curated' | 'all'>('core')
const hiddenSceneIds = ref(readHiddenScenes())
const tagSearch = ref('')
const tagCategory = ref('all')
const voiceStudioRef = ref<{ setSuggestedCaption?: (caption: string) => void } | null>(null)
const DIRECTOR_MODE_KEY = 'aics_pb_director_mode'

const storedDrawEngine = settingsRepository.get(DRAW_ENGINE_SETTING)
const drawEngine = ref<DrawEngine>(storedDrawEngine ?? 'sd')
// 出图自动入册偏好（2026-08-31 用户偏好：默认关；开则直出成片自动写作品册）。
const autoSaveToGallery = ref(settingsRepository.get(AUTO_SAVE_TO_GALLERY_SETTING) ?? false)
watch(autoSaveToGallery, (value) => settingsRepository.set(AUTO_SAVE_TO_GALLERY_SETTING, value))
const animaSession = useAnimaSession({
  getCharacter: () => pb.char,
  isPopular: () => pb.isPopular,
  getFamily: () => drawEngine.value === 'krea2' ? 'krea2' : 'anima',
  getRequest: () => buildAnimaRequest(),
  onResult: result => onAnimaResult(result),
  flash: message => pb.flash(message),
  preferredSize: () => pb.lastRecommendedSize,
})
const {
  state: animaState,
  patchState: patchAnimaState,
  modelId: animaModelId,
  refreshBackend: refreshAnimaBackend,
  syncCharacter: syncAnimaCharacter,
  applyModel,
  generate: generateAnima,
  cancel: cancelAnimaJob,
  clearResult: clearAnimaResult,
  startStatusPolling,
} = animaSession

// Anima 会话先于引擎协调层创建：请求装配与结果协调经桥接函数转发到
// useDirectorEngine（生成/结果事件均在 setup 完成后才触发，沿用提升函数模式）。
function buildAnimaRequest() {
  return engine.buildAnimaRequest()
}
function onAnimaResult(result: AnimaResult) {
  engine.onAnimaResult(result)
  // 直出自动入册（2026-08-30 UX 审计 P0-8，2026-08-31 起受偏好开关控制，
  // 默认关——用户不想每次出图都自动进作品册；要开在出图结果面板打开开关）。
  // 字段口径对齐批量路径（usePromptBatchRunners.runBatchAnima）；inpaint 换装
  // 结果同样入册——它也是成片，且 parent_id 打通后将成为重绘对比的锚点。
  if (!autoSaveToGallery.value) {
    displayedResultHistoryId.value = null
    return
  }
  void (async () => {
    try {
      if (!result.blob.size) throw new Error('成片数据为空')
      // 2026-08-30 UX 审计 P1-14：initImage 非空即说明这次是 inpaint 重绘，
      // 把来源条目记进 parent_id，作品册对比滑块才有「重绘前 vs 重绘后」的
      // 真实语义。来源是上传图等无条目场景时为 null，退回旧的自身对比。
      const isInpaint = Boolean(result.metadata.initImage)
      const saved = await pb.commitHistoryEntry({
        blob: result.blob,
        seed: result.metadata.seed,
        negative: result.metadata.negative ?? '',
        prompt: result.metadata.prompt,
        ...historyGenerationFields(),
        story: String(pb.story || '').trim(),
        scene: pb.sceneId,
        hiresFix: result.metadata.hiresFix === true,
        hiresScale: typeof result.metadata.hiresScale === 'number' ? result.metadata.hiresScale : undefined,
        hiresDenoise: typeof result.metadata.hiresDenoise === 'number' ? result.metadata.hiresDenoise : undefined,
        parentId: isInpaint ? (inpaintSourceHistoryId.value ?? undefined) : undefined,
      })
      if (saved) displayedResultHistoryId.value = saved.id
      pb.flash('已自动存入作品册')
    } catch (e) {
      console.warn('anima direct autosave failed', e)
      pb.flash('自动入册失败，可手动点「保存快照」')
    }
  })()
}

const currentCuratedArtistStyles = computed<string[]>(() => {
  if (pb.isPopular) {
    const charId = pb.subject.kind === 'popular' ? pb.subject.characterId : ''
    const char = pb.popularCharacters.find(c => c.id === charId)
    return char?.curatedArtistStyles || []
  }
  // 工作室角色（宁宁 / 夏目 -> 柚子社画风 Kobuichi / Muririn / Kantoku）
  return ['kobuichi', 'muririn', 'kantoku']
})

// ── Derived（场景筛选 / 词条目录 / 摘要 / 显存提示）──────────────────────
const {
  emotionSummary,
  shotSummary,
  lightingSummary,
  compositionSummary,
  moodSummary,
  personaCoreIds,
  availableScenes,
  visibleScenes,
  personaCoreCount,
  curatedCount,
  tagCategories,
  tagCatalog,
  visibleTags,
  visibleOutfitBundles,
  visibleR18Controls,
  modeDescription,
  vramLevel,
  baseResolutionRisk,
  vramHint,
  baseResolutionHint,
  canUseFaceDetailer,
} = useDirectorDerived({
  pb,
  hiddenSceneIds,
  sceneCollection,
  sceneLimit,
  tagSearch,
  tagCategory,
  sdSize,
})

// ── Prompt 组装（统一出口，消除视图三元分发）──────────────────────
const {
  currentTraits,
  modelProfile,
  effectiveScene,
  loraSpecs,
  positivePrompt,
  negativePrompt,
  promptReport,
  artViolations,
  previewPrompt,
} = usePromptAssembly(pb, sd.checkpoint, drawEngine, animaModelId, computed(() => animaState.value.loraId))

const unified = useUnifiedPromptAssembly(pb, sd.checkpoint, drawEngine, animaModelId, computed(() => animaState.value.loraId))
const livePrompt = unified.positivePrompt
const effectiveNegative = unified.negativePrompt
const previewPromptView = unified.previewPrompt
const modelProfileView = unified.modelProfile
const reportView = unified.promptReport
const artViolationsView = unified.artViolations
const popular = unified.popular

// ── 反推服装顶替（2026-08-29）────────────────────────────────────────────
// 热门角色默认会注入 12 个服装 tag 加一整段 "She wears ..." 散文，参考图服装
// 追加在末尾会被淹没。故反推出跨族服装时改为整体顶替，并给用户一键恢复的入口。
const outfitOverridden = computed(() => pb.isPopular && Boolean(pb.outfitOverride?.tokens.length))
const outfitOverrideTokens = computed(() => pb.outfitOverride?.tokens ?? [])
const outfitReplacedLabel = computed(() => pb.outfitOverride?.replaced ?? '')

// ── 引擎协调层（2026-08-28 编排下沉）：引擎切换守卫、能力表、在线/进度/错误
// 聚合展示、Anima 请求装配与推荐尺寸收敛，照 useAnimaInpaint 的依赖注入样板。
const engine = useDirectorEngine({
  pb,
  sd,
  sdSize,
  drawEngine,
  animaState,
  patchAnimaState,
  refreshAnimaBackend,
  syncAnimaCharacter,
  applyModel,
  cancelAnimaJob,
  clearAnimaResult,
  livePrompt,
  effectiveNegative,
  modelProfile,
  modelProfileView,
  popularProfile: popular.profile,
  flash: message => pb.flash(message),
})
const {
  currentCapabilities,
  animaNoLoraMode,
  supportsDualCharacter,
  setDrawEngine,
  applyRecommendedSize,
  clearDisplayedResult,
  displayResultUrl,
  displayResultSeed,
  drawEngineLabel,
  generationStatusText,
  engineOnline,
  generationBusy,
  generationProgress,
  generationProgressStyle,
  generationError,
  generationStopped,
  engineStatusText,
  recheckEngineConnection,
  generationPresetSummary,
  cancelGeneration,
  selectAnimaModel,
  updateAnimaPromptState,
} = engine

// ── 吸附出图条尺寸源：SD 直写 sdSize；Anima/Krea2 走 applyRecommendedSize，
// 先收敛到当前底模白名单（closestSupportedSize）再同步双引擎，防服务端 400。
const genBarSize = computed({
  get: () => drawEngine.value === 'sd'
    ? sdSize.value
    : `${animaState.value.width}x${animaState.value.height}`,
  set: (value: string) => {
    if (drawEngine.value === 'sd') sdSize.value = value
    else applyRecommendedSize(value)
  },
})
/** 出图条候选尺寸：当前底模白名单；当前生效值不在列时兜底置顶，避免 select 空显。 */
const animaBarSizes = computed<string[]>(() => {
  const activeModel = animaState.value.models.find(model => model.id === animaState.value.modelId)
  const sizes = activeModel?.sizes?.length ? [...activeModel.sizes] : ['832x1216', '1024x1024', '1216x832']
  const current = `${animaState.value.width}x${animaState.value.height}`
  if (!sizes.includes(current)) sizes.unshift(current)
  return sizes
})

// ── 热门角色编排层（2026-08-28 编排下沉）：subject/服装/蓝图选择与轮换、
// 蓝图池过滤与推荐、受控绘图路线、热门草稿恢复。
const {
  popularCategory,
  showAllBlueprints,
  popularCharacter,
  archiveBarShape,
  managedRoute,
  refreshManagedRoute,
  popularBlueprintPool,
  filteredPopularBlueprints,
  blueprintCategories,
  recommendedBlueprints,
  resetBlueprintRotation,
  applyRecommendedEngine,
  selectPopularSource,
  selectPopularCharacter,
  selectPopularOutfit,
  selectBlueprint,
  rotateBlueprintSet,
  toggleBlueprintList,
  applyManagedRoute,
  syncManagedRoute,
  restorePopularDraft,
} = useDirectorPopular({
  pb,
  sd,
  drawEngine,
  setDrawEngine,
  applyRecommendedSize,
  generationBusy,
  animaState,
  patchAnimaState,
  refreshAnimaBackend,
  applyModel,
  sdSize,
  flash: message => pb.flash(message),
})

// ── 出图对比：记住上一张结果，生成新图后可并排大图对比 ──────────────
// URL 克隆保活/延迟释放/token 防乱序/焦点陷阱等生命周期归
// useCompareSnapshots（2026-08-21 拆出）；这里只保留业务元数据组装。
interface ResultSnapshot {
  url: string
  seed: number | null
  styleLoraId: string | null
  size: string
  sampler: string
  cfg: number
  steps: number
  hires: string
  at: string
}
const compare = useCompareSnapshots<ResultSnapshot>({
  build: (url) => buildResultSnapshot(url),
})
// 模板沿用原名绑定
const { prevResult, lastResult, compareOpen, compareEl, close: closeCompare } = compare

/** 快照业务字段：URL 已由 composable 克隆保活，这里只读引擎状态组装元数据。 */
function buildResultSnapshot(persistentUrl: string): ResultSnapshot {
  const metadata = animaState.value.result?.metadata
  const isComfy = drawEngine.value !== 'sd'
  return {
    url: persistentUrl,
    seed: displayResultSeed.value ?? (isComfy ? metadata?.seed ?? null : (pb.sdParams.seedLock && pb.sdParams.seed >= 0 ? pb.sdParams.seed : null)),
    styleLoraId: isComfy ? ((metadata?.styleLoraId ?? animaState.value.styleLoraId) || null) : null,
    size: isComfy ? `${metadata?.width ?? animaState.value.width}x${metadata?.height ?? animaState.value.height}` : sdSize.value,
    sampler: isComfy ? (metadata?.sampler ?? animaState.value.sampler) : (pb.sdParams.sampler || sd.samplers.value[0] || '—'),
    cfg: isComfy ? (metadata?.cfg ?? animaState.value.cfg) : pb.sdParams.cfg,
    steps: isComfy ? (metadata?.steps ?? animaState.value.steps) : pb.sdParams.steps,
    hires: isComfy ? '关' : (pb.sdParams.hiresFix ? `×${pb.sdParams.hiresScale ?? 1.5}` : '关'),
    at: new Date().toLocaleTimeString(),
  }
}

// ── Actions ───────────────────────────────────────────────────────────────
function setDirectorMode(mode: 'basic' | 'pro') {
  pb.directorMode = mode
  sceneCollection.value = mode === 'basic' ? 'core' : 'all'
  sceneLimit.value = 20
  syncManagedRoute()
}

function setSceneCollection(collection: 'core' | 'curated' | 'all') {
  if (collection === 'all' && pb.directorMode === 'basic') {
    setDirectorMode('pro')
    return
  }
  sceneCollection.value = collection
  sceneLimit.value = 20
}

const currentBlueprintData = computed(() => ({
  char: pb.char,
  sceneId: pb.sceneId,
  story: pb.story,
  manualTags: Array.from(pb.manualTags),
  drawEngine: drawEngine.value,
  sdParams: { ...pb.sdParams },
  size: sdSize.value,
}))

function handleLoadBlueprint(data: Record<string, unknown>) {
  if (data.char && (data.char === 'nene' || data.char === 'natsume' || data.char === 'triad')) {
    pb.setChar(data.char)
  }
  if (typeof data.sceneId === 'string' && data.sceneId) {
    const sc = pb.scenes.find(s => s.id === data.sceneId)
    if (sc) selectScene(sc)
  }
  if (typeof data.story === 'string') {
    pb.story = data.story
  }
  if (Array.isArray(data.manualTags)) {
    pb.manualTags = new Set(data.manualTags.map(String))
  }
  if (typeof data.drawEngine === 'string' && (data.drawEngine === 'anima' || data.drawEngine === 'sd' || data.drawEngine === 'krea2')) {
    setDrawEngine(data.drawEngine as DrawEngine)
  }
  if (data.sdParams && typeof data.sdParams === 'object') {
    Object.assign(pb.sdParams, data.sdParams)
  }
  if (typeof data.size === 'string' && data.size) {
    sdSize.value = data.size
  }
}

function selectScene(scene: Scene) {
  if (pb.isPopular) {
    // 热门角色模式直接切到工作室场景（?scene= 深链/左侧场景卡）：立即刷新 Anima
    // 后端白名单，让 studio 的宁宁/夏目模型与 LoRA 立即可选（不等 15s 轮询）；
    // subject 切回 studio 由 loadScene 内部兜底，保证提示词跟随本场景。
    void refreshAnimaBackend()
  }
  pb.loadScene(scene)
  pb.applyModelProfile(pb.sdModelName || sd.checkpoint.value, { applySize: false })
  applyRecommendedSize(pb.lastRecommendedSize)
  patchAnimaState({ styleLoraId: '' })
  voiceStudioRef.value?.setSuggestedCaption?.(scene.story ?? '')
  rememberRecent(scene)
  recordSceneUsage(scene)
  sceneLimit.value = 20
  syncManagedRoute()
}

function detachScene() {
  if (!pb.sceneId) return
  pb.clearScene({ keepStory: true })
  pb.flash('已脱离场景，仅保留故事')
}

function handleInterrogateResult(result: unknown) {
  if (!result || typeof result !== 'object') return
  const payload = result as { mode?: string; caption?: string; tags?: unknown; characterTags?: unknown; warning?: string }
  if (payload.mode === 'caption' && typeof payload.caption === 'string' && payload.caption.trim()) {
    pb.visualDescription = String(payload.caption).trim()
    pb.flash('已反推为自然语言，已填入画面描述（Krea2 直出，切人保留）')
    const warning = payload.warning
    if (warning) setTimeout(() => pb.flash(warning), 2600)
    return
  }
  const tags: string[] = Array.isArray(payload.tags) ? (payload.tags as string[]) : []
  const characterTags: string[] = Array.isArray(payload.characterTags) ? (payload.characterTags as string[]) : []
  // 三重去重 + 身份域冲突消解（studio：charPrompt+场景行；popular：角色词条+蓝图行）
  const subject = pb.subject
  const popularChar = subject.kind === 'popular' ? findCharacter(pb.popularCharacters, subject.characterId) : null
  const context = collectInterrogateContext(subject.kind === 'popular'
    ? {
        kind: 'popular',
        character: popularChar
          ? {
              identityTokens: popularChar.identityTokens,
              exactTokens: popularChar.exactTokens,
              outfitTokens: (findOutfit(popularChar, subject.outfitId) ?? defaultOutfit(popularChar))?.tokens,
            }
          : null,
        blueprintTokens: subject.blueprintId ? findBlueprint(pb.sceneBlueprints, subject.blueprintId)?.promptTokens ?? [] : [],
      }
    : {
        kind: 'studio',
        charPrompt: pb.charPrompt,
        scenePrompt: pb.activeScene?.prompt,
        sceneTags: pb.activeScene?.tags,
      })
  const merged = mergeInterrogatedTags({
    tags,
    manualTags: pb.manualTags,
    identityTokens: context.identityTokens,
    sceneTokens: context.sceneTokens,
  })
  for (const tag of merged.accepted) pb.toggleManualTag(tag)
  // 服装跨族：顶替角色默认服装，而不是追加到 manualTags —— 追加会被角色那 12 个
  // 服装 tag 与 "She wears ..." 散文淹没，参考图服装根本出不来（2026-08-29 实测）。
  // 仅 popular 需要：studio（宁宁/夏目）无默认服装注入，反推词直接生效。
  if (subject.kind === 'popular' && merged.outfitReplacement.length) {
    pb.setOutfitOverride(merged.outfitReplacement, merged.replacedOutfitGroup)
  }
  const note = characterConflictNote(characterTags, context.identityTokens)
  const parts: string[] = []
  if (merged.accepted.length) parts.push(`本地反推已叠加 ${merged.accepted.length} 个词条，可切人直出`)
  if (merged.duplicates.length) parts.push(`跳过已有词条 ${merged.duplicates.length} 个`)
  if (merged.outfitReplacement.length) {
    const from = merged.replacedOutfitGroup ? `（原${merged.replacedOutfitGroup}）` : ''
    parts.push(`已用参考图服装顶替角色默认服装${from}：${merged.outfitReplacement.slice(0, 3).join('、')}`)
  }
  if (merged.conflicts.length) {
    // 只列 tag 名（swimsuit）用户看不懂为什么被拦，故优先展示 reason
    // （含「反推出什么 / 当前是什么 / 怎么改」）。冲突含身份域与互斥组两类。
    const first = merged.conflicts[0]
    const detail = merged.conflicts.length === 1
      ? first.reason
      : `${first.reason} 等 ${merged.conflicts.length} 项`
    parts.push(`跳过冲突词条 ${merged.conflicts.length} 个：${detail}`)
  }
  if (note) parts.push(note)
  pb.flash(parts.length ? parts.join('；') : '反推完成，无新增词条')
  const warning = payload.warning
  if (warning) setTimeout(() => pb.flash(warning), 2600)
}

function handleInterrogateError(message: string) {
  pb.flash('反推失败：' + message)
}

function onStoryInput() {
  // Clear scene context if user edits story away from scene's default
  if (pb.sceneId && pb.story !== pb.sceneBaseStory) {
    detachScene()
  }
}

// 新一轮生成开始时结果会被清空，完成后再写入新值；
// 因此只在"有值且与上一张不同"时轮转快照（SD 与 Anima 结果共用）。
// 快照 blob 克隆保活与 token 防乱序在 useCompareSnapshots 内部处理。
watch(displayResultUrl, (url, oldUrl) => {
  if (!url || url === oldUrl) return
    compare.rotate(url)
})

/**
 * 舞台当前结果对应的作品册条目 id（2026-08-30 UX 审计 P1-14）。
 *
 * 作品册的对比滑块靠 `parent_id` 找 before 图，而全库唯一的写入点一直是
 * null——于是拿同一张图的缩略图当 before，拉滑块看到的是「糊版 vs 高清版」，
 * 会得出错误的重绘判断。
 *
 * 这里记录「舞台这张图是作品册里的哪一条」，供 inpaint 结果回指来源。换
 * result 即清空：来源不明的图（上传/Remix 载入/历史回看）不配对比锚点，
 * 宁可没有也不能指错——指错会让用户以为自己看到的是重绘前后。
 */
const displayedResultHistoryId = ref<number | null>(null)
watch(displayResultUrl, () => { displayedResultHistoryId.value = null })

/** 重绘来源条目：在换装弹窗打开的瞬间定格，弹窗期间舞台结果不变。 */
const inpaintSourceHistoryId = ref<number | null>(null)

// ── SD 出图任务执行 + 队列（已下沉 usePromptSdQueue）──────────────────────
// 一条 runJob 路径三处消费：直出 callGenerate / 队列串行 / 批量 runners 注入。
const {
  sdErrorReport,
  dismissError,
  captureJob,
  historyGenerationFields,
  runJob,
  commitJobResult,
  sdQueue,
  restoredCount,
  enqueueCurrent,
  enqueue3Variants,
} = usePromptSdQueue({
  pb,
  sd,
  sdSize,
  drawEngine,
  livePrompt,
  negativePrompt,
  effectiveScene,
  loraSpecs,
  modelProfile,
  animaState,
  displayResultSeed,
})

// ── 多场景批量出图（编排由 BatchSceneDrawPanel 持有，宿主只注入依赖快照）──
// 选 N 个场景蓝图 → 逐张串行出图（SD 走 runJob 同路径 / Anima 直接提交
// ComfyUI 任务）→ 每张自动入册历史 → 面板内直接预览挑选。
const batchOpen = ref(false)
const batchRunning = ref(false)
// ref/函数引用在 setup 期即稳定，面板内部用这份快照接线 usePromptBatchRunners。
const batchPanelDeps = {
  pb,
  sd,
  sdSize,
  negativePrompt,
  loraSpecs,
  modelProfile,
  animaState,
  runJob,
  historyGenerationFields,
  sceneBlueprints: () => sceneStore.sceneBlueprints,
  popularCharacters: () => sceneStore.popularCharacters,
  currentLivePrompt: () => livePrompt.value,
}

/**
 * 离开导演台前拦一次（2026-08-30 UX 审计 P0-5）。
 *
 * sd.dispose() 挂在 onUnmounted，组件一卸载就 cancel() 在途任务；出图队列只
 * 活在本视图作用域、无持久化。于是「排了 8 张、切到角色页看个设定再回来」
 * 的结果是队列空了、正在跑的那张也没了，**且没有任何解释**——用户不会归因
 * 于切换页面，只会觉得软件不稳定。
 *
 * 防泄漏的设计意图是对的，这里补的是代价：在途 / 有队列 / 批量跑着的时候
 * 先问一次，让用户自己决定要不要付这个代价。
 */
onBeforeRouteLeave(async () => {
  const queued = sdQueue.queue.value.length
  if (!generationBusy.value && !queued && !batchRunning.value) return true
  const detail = [
    generationBusy.value ? '正在生成的这一张会被取消' : '',
    queued ? `队列中还有 ${queued} 张未开始` : '',
    batchRunning.value ? '批量出图会被中断' : '',
  ].filter(Boolean).join('，')
  return await confirmAction({
    title: '离开会中断出图，确定吗？',
    message: `${detail}。离开后无法恢复；已经完成的成片不受影响。`,
    confirmLabel: '仍要离开',
    danger: true,
  })
})

/**
 * 出图前的可见校验（2026-08-30 UX 审计 P1）。
 *
 * 规则必须与 callGenerate 里的守卫保持一致：两处一旦漂移，结果就是「按钮亮着
 * 但点了才报错」，比没校验更让人困惑。callGenerate 的守卫保留作防御，这里
 * 负责让原因在点之前就看得见。
 */
/**
 * 出图参数恢复底模推荐值（2026-08-30 UX 审计 P1）。
 *
 * 默认值按 checkpoint 匹配 profile，只有 store 知道，所以实际动作在 store 里；
 * 这里只负责如实反馈结果——套不上档位时也要说，不能点了没反应。
 */
function resetSdParams() {
  if (pb.resetParamsToProfile()) pb.flash('已恢复这套底模的推荐参数')
  else pb.flash('当前底模没有对应的推荐参数档位，未能恢复')
}

/**
 * 生成中禁用控件的统一说明（2026-08-30 UX 审计 P2）。
 *
 * 同样的文案在 DirectorStagePanel 里也有一份，改动时记得两边一起改。
 */
const BUSY_HINT = '生成中，等这一张出完就能用'

/**
 * 引擎按钮的悬停说明：优先讲「为什么点不了」。
 *
 * 顺序是 生成中 > 该引擎不支持当前配置。原先这些按钮在生成中冒出来的仍是
 * 功能介绍，用户面对「点不动 + 一堆功能说明」只会以为软件坏了。
 */
function engineTitle(engine: DrawEngine) {
  if (generationBusy.value) return BUSY_HINT
  if (engine === 'sd') return pb.isPopular ? '热门角色仅支持 Anima 无 LoRA 或 Krea 2' : undefined
  if (!pb.isPopular && !supportsDualCharacter(engine)) {
    return engine === 'anima'
      ? '双人模式不支持 Anima，请使用 SD 引擎'
      : 'Krea 2 首版暂不支持双角色身份构图，请使用 SD 引擎'
  }
  return undefined
}

const generateBlockReason = computed(() => {
  if (!livePrompt.value) return '先选一个场景，或写点故事，我才知道要画什么'
  if (pb.isPopular && drawEngine.value === 'sd') return '热门角色请切到 Anima 或 Krea 2'
  return ''
})

async function callGenerate(opts: { disableLora?: boolean } = {}) {
  if (pb.directorMode === 'basic') {
    await applyManagedRoute({ silent: true })
  }
  if (pb.isPopular && drawEngine.value === 'sd') {
    pb.flash('热门角色仅支持 Anima 无 LoRA 或 Krea 2')
    return
  }
  if (!livePrompt.value) { pb.flash('请先选择场景或填写故事'); return }
  if (drawEngine.value !== 'sd') {
    if (opts.disableLora && currentCapabilities.value.lora && currentCapabilities.value.characterIdentity && !pb.isPopular) { pb.flash('Anima 引擎固定使用角色 LoRA，无法跳过') }
    await generateAnima()
    return
  }
  sdErrorReport.value = null
  const job = captureJob()
  if (!job) return
  const url = await runJob(job, opts)
  if (!url && sd.errorMsg.value) {
    sdErrorReport.value = classifySDError({ message: sd.errorMsg.value })
    return
  }
  // 直出自动入册（2026-08-30 UX 审计 P0-8，2026-08-31 起受偏好开关控制，
  // 默认关——用户不想每次出图都自动进作品册；要开在出图结果面板打开开关）。
  // 与队列/批量同路径写历史；后台写不阻塞舞台展示；失败只提示不重试。
  if (url && autoSaveToGallery.value) {
    try {
      const saved = await commitJobResult(job, url)
      if (saved) displayedResultHistoryId.value = saved.id
      pb.flash('已自动存入作品册')
    } catch (e) {
      console.warn('direct autosave failed', e)
      pb.flash('自动入册失败，可手动点「保存快照」')
    }
  }
}

/** 分类恢复：对应旧版 runSDRecovery */
async function runRecovery(id: SDRecoveryId) {
  sdErrorReport.value = null
  if (id === 'retry_light') {
    sdSize.value = LIGHT_LOAD.size
    pb.sdParams.hiresFix = LIGHT_LOAD.hiresFix
    pb.markParamTouched('size')
    pb.flash('已降到 832×1216 并关闭 hires.fix，正在重试')
    await callGenerate()
    return
  }
  if (id === 'retry_without_lora') {
    pb.flash('本次临时跳过角色 LoRA')
    await callGenerate({ disableLora: true })
    return
  }
  if (id === 'retry_current_model') {
    pb.sdModelName = ''
    pb.flash('已改用 WebUI 当前模型，正在重试')
    await callGenerate()
    return
  }
  if (id === 'retry_safe_sampler') {
    pb.sdParams.sampler = SAFE_SAMPLING.sampler
    pb.sdParams.scheduler = SAFE_SAMPLING.scheduler
    pb.markParamTouched('sampler')
    pb.markParamTouched('scheduler')
    pb.flash('已恢复稳定采样器，正在重试')
    await callGenerate()
    return
  }
  if (id === 'recheck_connection') {
    const ok = await sd.checkStatus()
    pb.flash(ok ? 'SD WebUI 已连接' : 'SD WebUI 仍未响应')
    return
  }
  if (id === 'open_settings') {
    const el = document.querySelector('details.generation-settings') as HTMLDetailsElement | null
    if (el) { el.open = true; el.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }) }
  }
}

async function copyPrompt() {
  try { await navigator.clipboard.writeText(previewPromptView.value); pb.flash('Prompt 已复制') }
  catch { pb.flash('复制失败，请手动选取') }
}

async function saveHistory() {
  try {
    const url = displayResultUrl.value
    if (!url) { pb.flash('暂无可保存的成片'); return }
    let blob: Blob
    let prompt = livePrompt.value
    let negative = negativePrompt.value
    if (drawEngine.value !== 'sd') {
      const result = animaState.value.result
      if (!result) { pb.flash('成片数据已失效，请重新生成'); return }
      blob = result.blob
      prompt = result.metadata.prompt
      negative = result.metadata.negative
    } else {
      // SD blob URL 仍由浏览器生成，写入 IndexedDB 前检查响应类型。
      const response = await fetch(url, { cache: 'no-store' })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.startsWith('image/')) {
        pb.flash('成片响应无效，请重新生成')
        return
      }
      blob = await response.blob()
      // 按图取词：SD 结果记录的是提交时实际使用的提示词，面板后续修改不漂移。
      prompt = sd.resultPrompt.value || prompt
    }
    // 空 blob 会入册成一条打不开的记录，宁可报错
    if (!blob.size) { pb.flash('成片数据已失效，请重新生成'); return }
    const entry = await pb.commitHistoryEntry({
      blob,
      seed: displayResultSeed.value ?? undefined,
      size: sdSize.value,
      negative,
      prompt,
      ...historyGenerationFields(),
    })
    if (entry) pb.flash('快照已存入本地作品册')
    else pb.flash('保存失败')
  } catch (e) { pb.flash('保存失败'); console.warn(e) }
}


// ── 出视频 / 分镜短片（编排已下沉 usePromptVideoBridge）──────────────────
const {
  videoTargetData,
  goToVideo: goVideoBridge,
  shotsPending,
  refreshShotsPending,
  addToShots,
  goToShots: goShotsNav,
  handleHistoryToShots,
  handleHistoryToShotsBatch,
} = usePromptVideoBridge({
  displayResultUrl,
  drawEngine,
  livePrompt,
  sdResultPrompt: sd.resultPrompt,
  animaState,
  story: () => pb.story,
  sceneId: () => pb.sceneId,
  subject: () => pb.subject,
  flash: message => pb.flash(message),
})
async function goToVideo() { await goVideoBridge(path => router.push(path)) }
async function goToShots() { await goShotsNav(path => router.push(path)) }


function saveResult() { saveHistory() }

async function upscaleCurrentResult() {
  if (drawEngine.value === 'anima') {
    const currentResult = animaState.value.result
    const baseSeed = currentResult?.metadata?.seed ?? animaState.value.seed
    if (baseSeed == null || baseSeed < 0) {
      pb.flash('当前图片缺少 Seed 信息，无法执行精准超分')
      return
    }
    // 锁定当前图的 seed 进行 2.0x 潜空间重绘放大
    patchAnimaState({ seed: baseSeed })
    pb.flash('正在使用当前 Seed 执行 2x 高清超分精修…')
    await generateAnima({ hiresFix: true, hiresScale: 2.0, hiresDenoise: 0.35 })
    return
  }
  if (drawEngine.value === 'sd') {
    const seed = displayResultSeed.value ?? pb.lastSeed
    if (seed != null && seed >= 0) {
      pb.sdParams.seed = seed
      pb.sdParams.seedLock = true
    }
    pb.sdParams.hiresFix = true
    pb.sdParams.hiresScale = 2.0
    pb.sdParams.hiresDenoise = 0.35
    pb.markParamTouched('hiresFix')
    pb.markParamTouched('hiresScale')
    pb.markParamTouched('hiresDenoise')
    pb.flash('正在使用当前 Seed 执行 SD 2x 高清修复…')
    await callGenerate()
  }
}

// ── Anima 智能局部换装（编排已下沉 useAnimaInpaint）───────────────────────
// 热门角色换装：取出角色 Danbooru 身份标签（exactTokens + identityTokens），
// 换装时拼入提示词锁定「衣服穿在谁身上」；studio 桌宠角色为空数组不影响。
const inpaintPopularTokens = computed(() => {
  const subject = pb.subject
  if (subject.kind !== 'popular') return []
  const match = sceneStore.popularCharacters.find(c => c.id === subject.characterId)
  if (!match) return []
  return [...(match.exactTokens ?? []), ...(match.identityTokens ?? [])]
})
const {
  inpaintOpen,
  inpaintOriginalUrl,
  inpaintCompareActive,
  inpaintCharacter,
  handleInpaintSubmit,
} = useAnimaInpaint({
  pb,
  drawEngine,
  animaState,
  displayResultUrl,
  generateAnima,
  isPopular: computed(() => pb.isPopular),
  popularIdentityTokens: inpaintPopularTokens,
})

// 弹窗一打开就定格来源：此时舞台上的正是要被重绘的那张图；等结果回来再取
// 就已经是新图了（inpaint 是覆盖式提交，结果直接顶掉舞台）。
watch(inpaintOpen, (open) => {
  if (open) inpaintSourceHistoryId.value = displayedResultHistoryId.value
})

/**
 * 画师选满后再点（2026-08-30 UX 审计 P1）：面板内已有就地提示，这里补一条
 * toast——画师网格在折叠面板里，提示有可能被滚出视野。
 */
function onArtistLimitReached(max: number) {
  pb.flash(`最多同时选 ${max} 位画师，先取消一位再选`)
}

/**
 * 队列为什么暂停（2026-08-30 UX 审计 P1）。
 *
 * 队列面板原本只写「已暂停」——用户不知道是任务失败了、还是自己按的暂停。
 * 失败时 sdErrorReport 里已有分类结论（中文标题 + 建议），直接引过来；快照
 * 恢复导致的暂停单独说明来源。手动暂停不需要解释，返回空串。
 */
const queuePausedReason = computed(() => {
  if (!sdQueue.paused.value) return ''
  if (sdErrorReport.value) return `${sdErrorReport.value.title}：${sdErrorReport.value.message}`
  if (restoredCount > 0) return '这些任务来自上次离开时的队列，确认参数后点「继续」'
  return ''
})

/**
 * Anima / Krea 2 失败后重试（2026-08-30 UX 审计）。
 *
 * 面板里的「重试」按当前面板配置原样重发一次——Comfy 侧最常命中 OOM 与模型
 * 未就绪，重发是确定有效的动作；SD 那套「切回 WebUI 当前模型」之类的恢复在
 * 这里并不适用，所以不复用 SDRecoveryPanel 的动作集。
 */
function retryAnima() {
  if (generationBusy.value) return
  void generateAnima()
}

function reuseLastSeed() {
  const seed = displayResultSeed.value ?? pb.lastSeed
  if (seed == null || seed < 0) { pb.flash('还没有可复用的 seed'); return }
  pb.sdParams.seed = seed
  pb.sdParams.seedLock = true
  pb.flash(`已锁定 seed ${seed}`)
}

function applyQuickCreateSettings(settings: QuickCreateSettings | null) {
  if (!settings) return
  // 快速出图参数等同于用户已经确认过的参数。先标记 touched，避免 checkpoint
  // 变更触发的异步 watcher 再用 model profile 覆盖刚恢复的值。
  ;['sampler', 'scheduler', 'cfg', 'steps', 'size', 'hiresFix', 'hiresUpscaler', 'hiresScale']
    .forEach(key => pb.markParamTouched(key))
  if (settings.checkpoint && sd.models.value.includes(settings.checkpoint)) {
    pb.sdModelName = settings.checkpoint
    pb.applyModelProfile(settings.checkpoint)
  }
  if (settings.sampler && sd.samplers.value.includes(settings.sampler)) pb.sdParams.sampler = settings.sampler
  if (!settings.scheduler || sd.schedulers.value.includes(settings.scheduler)) pb.sdParams.scheduler = settings.scheduler
  if (settings.cfg > 0) pb.sdParams.cfg = settings.cfg
  if (settings.steps > 0) pb.sdParams.steps = settings.steps
  if (settings.size) sdSize.value = settings.size.replace('×', 'x')
  pb.sdParams.hiresFix = settings.hiresFix
  if (settings.hiresUpscaler && sd.upscalers.value.includes(settings.hiresUpscaler)) {
    pb.sdParams.hiresUpscaler = settings.hiresUpscaler
  }
  if (settings.hiresScale > 0) pb.sdParams.hiresScale = settings.hiresScale
}

// ── 历史应用（恢复/复制/删除/复用配方）已下沉 usePromptHistoryApply ────────
const {
  applyHistory,
  reuseSuccessfulRecipe,
  resumeHistory,
  duplicateHistory,
  deleteHistory,
} = usePromptHistoryApply({
  pb,
  animaState,
  patchAnimaState,
  clearAnimaResult,
  refreshAnimaBackend,
  setDrawEngine,
  resetBlueprintRotation,
  sdSize,
})

/** 「清空并重来」：会清空故事、场景关联、全部词条与导演决策，先确认再执行 */
async function resetAll() {
  if (!(await confirmAction('清空当前故事、场景与全部词条，重新开始？此操作不可撤销。'))) return
  if (pb.isPopular) {
    pb.setStudioSubject()
    pb.manualTags = new Set()
  }
  pb.setArtistStyleIds([])
  pb.clearScene()
  resetBlueprintRotation()
  pb.flash('已清空，可以开始新的一幅')
}

// ── 词条工作台工具（释义字典懒加载已随簇下沉 usePromptTagTools）──────────
const { addTag, tagMeaning, tagLabel, tagWeightTier, toggleOutfitBundle } = usePromptTagTools(pb)

// ── 深链参数应用（已下沉 usePromptDeepLink）───────────────────────────────
// onMounted 首放 + watch(route.query) 按 deepLinkNeeded 条件重放：
// 组件复用 / 后退恢复（bfcache）时组件不会重挂载、onMounted 不重跑，
// URL 变了状态却不更新——按「URL 与当前选中不一致」重放，保证
// 「点场景卡片后提示词跟随新场景」。八类参数全部走视图注入的同一路径动作。
const { applyDeepLink, deepLinkNeeded } = usePromptDeepLink({
  pb,
  sdSize,
  patchAnimaState,
  showAllBlueprints,
  selectPopularSource,
  selectBlueprint,
  selectScene,
  applyRecommendedEngine,
  setDirectorMode,
  applyHistory,
})

// 组件复用 / 后退恢复（bfcache）时 onMounted 不重跑：URL 场景参数变化但组件还是旧实例，
// 这里按「状态与 URL 不一致」重放深链，让场景与提示词跟随新选择。
watch(() => route.query, (q) => {
  if (!deepLinkNeeded(q)) return
  if (applyDeepLink(q) && !generationBusy.value) {
    if (pb.directorMode === 'basic') void applyManagedRoute({ silent: true })
    else void refreshManagedRoute()
  }
})

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  void refreshShotsPending()
  void refreshAnimaBackend()
  // Anima 后端只在引擎激活时轮询：SD 引擎下每 15s 打一次 /api/creative/status
  // 会让网关反复探测 ComfyUI（2.5s 超时 + 磁盘资源检查），纯属浪费。
  if (drawEngine.value !== 'sd') startStatusPolling()
  const savedMode = localStorage.getItem(DIRECTOR_MODE_KEY)
  if (savedMode === 'pro' || savedMode === 'basic') {
    pb.directorMode = savedMode
    sceneCollection.value = savedMode === 'pro' ? 'all' : 'core'
  }
  await pb.loadData()
  await refreshAnimaBackend()
  await sd.checkStatus()
  // 拿到 WebUI 真实 checkpoint 后，再按对应 model profile 填参数
  pb.applyModelProfile(pb.sdModelName || sd.checkpoint.value)
  // 历史载入（IndexedDB）
  await pb.loadHistory()

  // 深链参数恢复（?scene / ?char / ?mood / ?scenario / ?regen / ?resume / ?quick / ?variant / ?generate）
  const handledDeepLink = applyDeepLink(route.query)
  if (!handledDeepLink) pb.restoreDraft()
  // 推荐尺寸同步到出图选择
  if (pb.lastRecommendedSize) sdSize.value = pb.lastRecommendedSize
  if (pb.directorMode === 'basic') await applyManagedRoute({ silent: true })
  else await refreshManagedRoute()

  // 热门角色草稿恢复（底模/蓝图尺寸/导演决策/后端白名单收敛）已下沉 useDirectorPopular
  restorePopularDraft()

  if (route.query.quick === '1') {
    const savedQuick = readQuickCreate()
    applyQuickCreateSettings(savedQuick)
    // 快速出图深链：Anima 引擎必须收敛到受控路线推荐的底模（工作室角色 → Aesthetic v1.1），
    // pro 模式不会走 applyManagedRoute，这里显式对齐，避免落到 anima-base-v1.0。
    if (drawEngine.value !== 'sd' && !pb.isPopular) {
      const route = await refreshManagedRoute()
      if ((route.engine === 'anima' || route.engine === 'krea2')
        && animaState.value.modelId !== route.modelId
        && animaState.value.models.some(model => model.id === route.modelId)) {
        patchAnimaState({ modelId: route.modelId })
      }
    }
    await nextTick()
    if (!engineOnline.value) {
      pb.flash('快速出图未启动：SD WebUI 当前未连接，Prompt 已保留')
    } else if (livePrompt.value) {
      const reused = quickCreateSummary(savedQuick)
      pb.flash(reused ? `正在快速出图 · ${reused}` : '正在使用当前推荐参数快速出图')
      await callGenerate()
    }
  } else if (route.query.generate === '1') {
    // 样张/场景抽屉的「调整后生成」：场景与词条已在上面载入，这里直接出图
    await nextTick()
    if (!engineOnline.value) {
       pb.flash(`${drawEngine.value === 'anima' ? 'Anima' : drawEngine.value === 'krea2' ? 'Krea 2' : 'SD WebUI'} 未连接，场景与词条已就位，可稍后生成`)
    } else if (livePrompt.value) {
      pb.flash('正在按调整后的场景生成')
      await callGenerate()
    }
  }
})
// 离开导演台时的 Anima 会话清理（轮询停止、在途任务取消、结果 URL 释放）
// 由 useAnimaSession 的自动 onUnmounted(dispose) 承担。

// Autosave draft
watch([() => pb.story, () => pb.visualDescription, () => pb.char, () => pb.sceneId, () => pb.selections, () => pb.manualTags, () => pb.artistStyleIds, () => pb.colorMood, () => pb.subject], () => {
  pb.saveDraft?.()
}, { deep: true })

watch([livePrompt, effectiveNegative], () => updateAnimaPromptState(), { immediate: true })

watch(() => pb.directorMode, mode => {
  localStorage.setItem(DIRECTOR_MODE_KEY, mode)
})

// 热门角色恢复草稿/历史后保证引擎不是 SD（SD 已对热门角色禁用）。
watch(() => pb.subject, subject => {
  if (subject.kind === 'popular' && drawEngine.value === 'sd') {
    setDrawEngine('anima')
  }
  syncManagedRoute()
})

// plans/002 Step 6：character-shifting 舞台类挂载——CSS 侧（DirectorStagePanel.css
// 扫光 characterGlassSweep + tokens.css 侧栏/令牌过渡）早已备好但从未挂载，属死代码。
// 有效身份 = studio 的 pb.char 或 popular 的 characterId；切换后 760ms 清理类名
// （扫光 .72s + 余量），快速连切只重置计时不会堆叠；卸载清计时器防泄漏。
const characterShifting = ref(false)
let characterShiftTimer: ReturnType<typeof setTimeout> | null = null
watch(() => pb.subject.kind === 'popular' ? pb.subject.characterId : pb.char, () => {
  characterShifting.value = true
  if (characterShiftTimer) clearTimeout(characterShiftTimer)
  characterShiftTimer = setTimeout(() => { characterShifting.value = false }, 760)
})
onBeforeUnmount(() => { if (characterShiftTimer) clearTimeout(characterShiftTimer) })

// 角色变化 / 成熟内容开关变化后，若当前 category 已无合格蓝图（如"成人"），
// 自动回到"全部"并触发推荐重算，避免空面板。
watch([popularBlueprintPool, () => pb.showMatureScenes, () => pb.isPopular], () => {
  const categories = blueprintCategories.value
  if (popularCategory.value !== 'all' && !categories.includes(popularCategory.value)) {
    popularCategory.value = 'all'
  }
})

watch(() => pb.char, char => {
  if (pb.isPopular) return
  if (pb.directorMode === 'basic') {
    syncManagedRoute()
  } else if (drawEngine.value !== 'sd') {
    void refreshManagedRoute()
    syncAnimaCharacter(char)
    void refreshAnimaBackend()
    if (char === 'triad') {
      setDrawEngine('sd')
       pb.flash('Anima 与 Krea 2 首版暂不支持双角色身份构图，已切回 SD')
     }
  } else void refreshManagedRoute()
})

watch([() => pb.char, () => pb.sceneSearch, () => pb.sceneTheme, sceneCollection], () => {
  sceneLimit.value = 20
})

// 切换 SD 模型时重新套用对应 profile 的推荐参数
watch(() => pb.sdModelName, (name) => {
  const sceneSize = pb.activeScene ? pb.lastRecommendedSize : ''
  const profile = pb.applyModelProfile(name || sd.checkpoint.value, { applySize: !sceneSize })
  const targetSize = sceneSize || String(profile?.size || '').replace('×', 'x')
  if (targetSize) applyRecommendedSize(targetSize)
})

// Anima 状态轮询跟随激活引擎：SD 引擎下停止，切到 Anima/Krea 恢复。
// 切换动作本身会触发一次 refreshAnimaBackend，这里只管理周期轮询。
watch(() => drawEngine.value, engine => {
  if (engine === 'sd') animaSession.stopStatusPolling()
  else animaSession.startStatusPolling()
})
</script>

<style scoped>
/* 反推服装顶替提示条（2026-08-29）：热门角色服装被参考图顶替时的告知与恢复 */
.outfit-override-note {
  display: flex; align-items: center; gap: var(--s-2);
  margin-bottom: var(--s-3); padding: var(--s-2) var(--s-3);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--border-soft));
  border-radius: var(--r-md); background: var(--accent-soft);
  font-size: var(--fs-label-xs); line-height: var(--lh-label);
}
.outfit-override-icon { flex: 0 0 auto; width: 15px; height: 15px; color: var(--accent); }
.outfit-override-text { flex: 1 1 auto; min-width: 0; color: var(--text-secondary); }
.outfit-override-restore {
  flex: 0 0 auto; padding: 4px 10px; border: 1px solid var(--border-strong);
  border-radius: var(--r-pill); background: var(--bg-elevated);
  color: var(--text-primary); font-size: var(--fs-label-xs); cursor: pointer;
  transition: border-color var(--motion-hover), background var(--motion-hover);
}
.outfit-override-restore:hover { border-color: var(--accent); background: var(--bg-hover); }
.outfit-override-restore:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* 多场景批量出图入口行 */
.batch-entry-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-3); margin: var(--s-2) 0; }
.batch-entry-count { color: var(--text-secondary); font-size: var(--fs-label-xs); }
.linklike { border: 0; padding: 0; background: none; color: var(--accent); font: inherit; text-decoration: underline; cursor: pointer; }

/* 出图自动入册偏好行（2026-08-31 用户偏好：默认关） */
.auto-save-gallery-row {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: var(--s-2) 0;
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: var(--bg-elevated);
  color: var(--text-primary);
}
.auto-save-gallery-label { font-size: var(--fs-label-sm); color: var(--text-primary); }
.auto-save-gallery-hint { font-size: var(--fs-label-xs); color: var(--text-secondary); }
.pb {
  --pb-active: var(--mood-love);
  --pb-active-text: var(--mood-love-text);
  --pb-active-grad: var(--mood-tension);
  --pb-badge-blue: var(--info);
  --pb-badge-green: var(--success);
  /* 2026-08-15 rella 化：导演台静态夜空衬底（工作台不浮动，只留静谧辉光） */
  position: relative;
  isolation: isolate;
}
.pb::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: var(--z-below);
  pointer-events: none;
  background:
    radial-gradient(30rem 20rem at 92% -6%, var(--rella-glow-cyan), transparent 64%),
    radial-gradient(26rem 18rem at -4% 88%, var(--rella-glow-violet), transparent 62%);
}
.engine-switch {
  --engine-active-border: var(--mood-love);
  --engine-active-text: var(--mood-love-text);
  display: flex;
  gap: 8px;
  margin: 4px 0 10px;
  flex-wrap: wrap;
}
.engine-btn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
  padding: 7px 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-soft);
  background: var(--glass-fill);
  color: inherit;
  font-size: var(--fs-label);
  cursor: pointer;
  transition: border-color var(--motion-hover), background var(--motion-hover);
}
.engine-btn.active {
  border-color: var(--engine-active-border);
  background: color-mix(in srgb, var(--mood-love) 14%, transparent);
  color: var(--engine-active-text);
}
.engine-sub {
  font-size: var(--fs-mono-sm);
  opacity: 0.6;
}
.base-model-picker {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin: 0 0 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: var(--bg-deep);
}
.base-model-picker label { color: var(--text-muted); font-size: var(--fs-label-xs); font-weight: 700; }
.base-model-picker select {
  width: 100%;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-sm);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: var(--fs-label-sm);
}

/* char-source / popular-tags-note / btn-video-action 已外移至 src/assets/css/director/panels.css（.pb 全局），scoped 内不再保留以免抽离后失活 */
</style>
