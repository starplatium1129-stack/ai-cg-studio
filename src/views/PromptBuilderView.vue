<template>
  <article
    class="pb"
    :data-character="pb.char"
    :data-director-mode="pb.directorMode"
    :class="{
      'focus-mode': pb.focusMode,
      'step-4': Boolean(sd.resultUrl.value || sd.generating.value),
      'has-result': Boolean(sd.resultUrl.value),
    }"
  >
    <a @click.prevent="$router.push('/')" href="/" class="nav-back">← 回首页</a>

    <WorkspaceArchiveBar
      chapter="01"
      title="DIRECTOR CONSOLE"
      :subtitle="pb.activeScene?.title || modeDescription"
      :status="sd.generating.value ? 'RENDERING' : (sd.online.value ? 'SD READY' : 'CONNECTING SD')"
      :state="sd.generating.value ? 'active' : (sd.online.value ? 'success' : 'warning')"
      :shape="pb.directorMode === 'pro' ? 'spark' : 'frame'"
    />

    <div class="pb-topline">
      <div class="pb-header">
        <div class="pb-kicker">Nene &amp; Natsume Private Atelier</div>
        <h1 class="pb-title">开始绘制</h1>
        <p class="pb-sub">选一个场景，定下情绪、镜头与光照；参数会自动备好，你只管出图。</p>
      </div>
      <div class="pb-top-actions">
        <button class="focus-mode-btn" type="button"
          :aria-label="pb.focusMode ? '退出专注成片模式' : '进入专注成片模式'"
          :aria-pressed="pb.focusMode"
          @click="pb.focusMode = !pb.focusMode">
          <span class="focus-mode-icon" aria-hidden="true">{{ pb.focusMode ? '↙' : '⛶' }}</span>
          <span class="focus-mode-label">{{ pb.focusMode ? '退出专注' : '专注成片' }}</span>
        </button>
        <div class="api-status">
          <span class="badge" :class="sd.online.value ? 'badge-online' : 'badge-offline'">
            {{ sd.online.value ? '✓ SD 已连接' : '正在连接 SD…' }}
          </span>
        </div>

        <PromptDataTools @flash="pb.flash" />
      </div>
    </div>

    <div class="setup-strip">
      <div class="guide-bar">{{ guideText }}</div>
    </div>

    <div class="director-mode-bar" aria-label="绘图工作模式">
      <div class="director-mode-head">
        <div>
          <div class="director-mode-title">{{ pb.directorMode === 'basic' ? '场景模式' : '专家模式' }}</div>
          <div class="director-auto-summary">{{ modeDescription }}</div>
        </div>
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
      </div>
    </div>

    <div class="director-workspace">

      <!-- ─── 左栏：剧本 ──────────────────────────────────── -->
      <div class="director-col col-left">

        <!-- Story -->
        <div class="panel step-panel" id="stepStory">
          <div class="panel-title">故事 · Story</div>
          <textarea class="story-input" v-model="pb.story"
            placeholder="一句话描述脑海里的画面…"
            @input="onStoryInput"></textarea>
          <div v-if="pb.activeScene" class="scene-context">
            <span class="scene-context-title">{{ pb.activeScene.title }}</span>
            <button class="scene-context-detach" type="button" @click="pb.clearScene({ keepStory: true })">× 脱离</button>
          </div>
          <div class="story-chips">
            <button v-for="s in storyChips" :key="s" type="button" class="story-chip"
              @click="pb.setStory(s)">{{ s }}</button>
          </div>
        </div>

        <!-- Character -->
        <div class="panel step-panel" id="stepChar">
          <div class="panel-title">角色 · Character</div>
          <div class="char-row">
            <button v-for="c in charOptions" :key="c.id"
              class="char-btn" type="button"
              :class="{ active: pb.char === c.id }"
              :aria-pressed="pb.char === c.id"
              @click="pb.setChar(c.id)">{{ c.label }}</button>
          </div>
          <div class="traits-row">
            <button v-for="t in currentTraits" :key="t.tag"
              class="trait-chip"
              :class="{ active: pb.manualTags.has(t.tag) }"
              type="button"
              @click="pb.toggleManualTag(t.tag)">{{ t.icon }} {{ t.label }}</button>
          </div>
        </div>

        <!-- Scenes -->
        <div class="panel step-panel" id="stepScene">
          <div class="panel-title">Scene · <span class="scene-count-badge">{{ availableScenes.length }}</span></div>
          <div class="scene-scope" role="group" aria-label="场景库范围">
            <button type="button" :class="{ active: sceneCollection === 'core' }"
              :aria-pressed="sceneCollection === 'core'"
              @click="setSceneCollection('core')">人设核心 {{ personaCoreCount }}</button>
            <button type="button" :class="{ active: sceneCollection === 'curated' }"
              :aria-pressed="sceneCollection === 'curated'"
              @click="setSceneCollection('curated')">精选 {{ curatedCount }}</button>
            <button type="button" :class="{ active: sceneCollection === 'all' }"
              :aria-pressed="sceneCollection === 'all'"
              @click="setSceneCollection('all')">完整库</button>
          </div>
          <div class="scene-search-wrap">
            <input type="search" class="scene-search" v-model="pb.sceneSearch"
              placeholder="试试：安静的夏目雨夜">
            <button class="scene-search-clear" type="button" aria-label="清空"
              @click="pb.sceneSearch = ''">×</button>
          </div>
          <div class="scene-filter-summary">
            <span class="scene-result-count" role="status" aria-live="polite">
              {{ availableScenes.length }} 个场景
            </span>
            <button class="scene-filter-reset" type="button" @click="pb.sceneSearch = ''; pb.sceneTheme = 'all'">重置筛选</button>
          </div>
          <div class="scene-filter-label advanced-decision">主题</div>
          <div class="scene-cats advanced-decision">
            <button v-for="t in SCENE_THEMES" :key="t.id"
              class="scene-cat-btn" type="button"
              :class="{ active: pb.sceneTheme === t.id }"
              @click="pb.sceneTheme = t.id">{{ t.icon }} {{ t.label }}</button>
          </div>
          <div class="scene-list">
            <div v-if="!pb.dataReady" class="scene-loading">正在加载场景库…</div>
            <div v-else-if="!availableScenes.length" class="scene-empty">未找到匹配场景</div>
            <button v-for="scene in visibleScenes" :key="scene.id"
              class="scene-card"
              :class="{ active: pb.sceneId === scene.id }"
              type="button"
              @click="selectScene(scene)">
              <div class="scene-card-title">
                {{ scene.title }}
                <span v-if="personaCoreIds.has(scene.id)" class="scene-core-mark">人设核心</span>
              </div>
              <div v-if="scene.story" class="scene-card-story">{{ scene.story }}</div>
              <div class="scene-card-meta">
                <span v-if="scene.category" class="scene-cat-tag">{{ scene.category }}</span>
                <span v-if="scene.rating && scene.rating !== 'All'" class="scene-rating-tag">{{ scene.rating }}</span>
              </div>
            </button>
            <button v-if="availableScenes.length > sceneLimit" class="btn btn-ghost scene-more"
              type="button" @click="sceneLimit += 20">
              显示更多 ({{ availableScenes.length - sceneLimit }} 个)
            </button>
          </div>
        </div>

        <HistoryPanel class="advanced-decision"
          :history="pb.history"
          @resume="resumeHistory"
          @duplicate="duplicateHistory"
          @delete="deleteHistory"
        />
      </div>

      <!-- ─── 中栏：监视器 ────────────────────────────────── -->
      <div class="director-col col-center">

        <!-- Stage placeholder -->
        <section
          v-show="!sd.resultUrl.value"
          class="stage-placeholder"
          :class="{ 'is-generating': sd.generating.value }"
          aria-label="成片监看区"
        >
          <div class="stage-chrome">
            <span>CANVAS</span>
            <span class="stage-ready">{{ sd.generating.value ? 'RENDERING' : 'READY' }}</span>
          </div>
          <img class="stage-muse nene" src="/assets/characters/nene-official.webp" alt="" aria-hidden="true" decoding="async">
          <img class="stage-muse natsume" src="/assets/characters/natsume-official.webp" alt="" aria-hidden="true" decoding="async">
          <div class="stage-message">
            <!-- 生成中：呼吸 + 进度，缓解等待焦虑 -->
            <div v-if="sd.generating.value" class="stage-generating-copy">
              <div class="stage-generating-title">正在绘制这一张</div>
              <div class="stage-generating-sub">{{ sd.statusText.value || '模型正在推理…' }} {{ sd.progress.value }}%</div>
              <div class="stage-progress-ring"><i :style="{ '--progress': sd.progress.value + '%' }"></i></div>
            </div>
            <div v-else class="stage-idle">
              <div class="stage-placeholder-title">成片将在这里出现</div>
              <div class="stage-quick-actions">
                <button class="btn btn-ghost" type="button"
                  @click="pb.sceneSearch = ''">
                  自己找场景
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Result image -->
        <div v-if="sd.resultUrl.value" class="result-image-wrap">
          <img class="result-image" :src="sd.resultUrl.value" alt="生成的图片" />
          <div class="result-image-actions">
            <button class="btn btn-ghost" type="button" @click="saveResult">保存快照</button>
            <button class="btn btn-ghost" type="button" @click="sd.clearResult()">清除</button>
          </div>
        </div>

        <div class="panel step-panel advanced-decision expert-tag-panel" id="stepTags">
          <div class="panel-title">词条工作台 · Tags</div>
          <div class="manual-tags">
            <span v-for="tag in pb.manualTags" :key="tag" class="manual-tag">
              {{ tag }}
              <span class="sr-only">（{{ tagMeaning(tag) }}）</span>
              <button type="button" class="tag-remove" @click="pb.toggleManualTag(tag)">×</button>
            </span>
          </div>
          <div class="outfit-presets" aria-label="v18 官方服装词包">
            <div class="outfit-presets-head">
              <strong>v18 官方服装词包</strong>
              <span>一键加入训练原词，也可以继续单独选 tag</span>
            </div>
            <div class="outfit-preset-list">
              <button v-for="bundle in visibleOutfitBundles" :key="bundle.id"
                type="button" class="outfit-preset"
                :class="{ selected: bundle.tags.every(tag => pb.manualTags.has(tag)) }"
                :aria-pressed="bundle.tags.every(tag => pb.manualTags.has(tag))"
                @click="toggleOutfitBundle(bundle.tags)">
                <strong>{{ bundle.label }}</strong>
                <small>{{ bundle.tags.slice(0, 4).join(', ') }}{{ bundle.tags.length > 4 ? ' …' : '' }}</small>
              </button>
            </div>
            <div class="r18-controls" aria-label="R18 角色门控词">
              <div class="outfit-presets-head r18-controls-head">
                <strong>R18 角色门控词</strong>
                <span>按角色启用，仅在成人场景中选择</span>
              </div>
              <div class="outfit-preset-list">
              <button v-for="control in visibleR18Controls" :key="control.tag"
                type="button" class="outfit-preset r18-control"
                :class="{ selected: pb.manualTags.has(control.tag) }"
                :aria-pressed="pb.manualTags.has(control.tag)"
                @click="pb.toggleManualTag(control.tag)">
                <strong>{{ control.label }}</strong>
                <small>{{ control.tag }}</small>
              </button>
              </div>
            </div>
          </div>
          <div class="tag-browser">
            <input v-model="tagSearch" class="tag-input" type="search" placeholder="搜索中文或 Danbooru 词条" />
            <div class="tag-categories" role="group" aria-label="词条分类">
              <button v-for="cat in tagCategories" :key="cat.id" type="button"
                :class="{ active: tagCategory === cat.id }"
                :aria-pressed="tagCategory === cat.id"
                @click="tagCategory = cat.id">{{ cat.label }}</button>
            </div>
            <div class="tag-results">
              <button v-for="tag in visibleTags" :key="tag.en" type="button"
                :class="{ selected: pb.manualTags.has(tag.en) }"
                :aria-pressed="pb.manualTags.has(tag.en)"
                :title="tagMeaning(tag.en, tag.cn)"
                @click="pb.toggleManualTag(tag.en)">
                <strong>{{ tagMeaning(tag.en, tag.cn) }}</strong><small>{{ tag.en }}</small>
              </button>
            </div>
          </div>
          <input class="tag-input" type="text" placeholder="也可以直接输入 Danbooru 标签后回车"
            @keydown.enter.prevent="addTag($event)" />
        </div>

        <PromptHealthPanel
          :prompt="previewPrompt"
          :model-name="modelProfile?.name"
          :report="promptReport"
          :art-violations="artViolations"
          :lora-text="loraSpecs.map(s => s.name + ':' + s.weight).join(' · ')"
          @copy="copyPrompt"
          @save="saveHistory"
        />

        <!-- SD params -->
        <GenerationParamsPanel
          :params="pb.sdParams"
          v-model:model-name="pb.sdModelName"
          :models="sd.models.value"
          :samplers="sd.samplers.value"
          :schedulers="sd.schedulers.value"
          :result-seed="sd.resultSeed.value"
          @touch="pb.markParamTouched"
          @reuse-seed="reuseLastSeed"
        />

        <!-- Result panel -->
        <div class="result-frame step-panel" id="stepResult">
          <div class="panel-title">输出 Result</div>

          <GenerationOutputControls
            :params="pb.sdParams"
            v-model:size="sdSize"
            :vram-hint="vramHint"
            :vram-level="vramLevel"
            :base-resolution-risk="baseResolutionRisk"
            :base-resolution-hint="baseResolutionHint"
            :can-use-face-detailer="canUseFaceDetailer"
            :generating="sd.generating.value"
            :online="sd.online.value"
            :result-seed="sd.resultSeed.value"
            :queue-available="sdQueue.canEnqueue.value"
            @touch="pb.markParamTouched"
            @generate="callGenerate"
            @cancel="sd.cancel()"
            @enqueue="enqueueCurrent"
            @reuse-seed="reuseLastSeed"
            @reset="pb.clearScene()"
          />

          <!-- Progress -->
          <div v-if="sd.generating.value" class="sd-result-area is-progress">
            <div class="sd-status">{{ sd.statusText.value }}</div>
            <div class="sd-progress"><span class="sd-progress-bar" :style="{ '--progress': sd.progress.value + '%' }"></span></div>
          </div>

          <SDRecoveryPanel :report="sdErrorReport" @recover="runRecovery" @dismiss="dismissError" />
          <GenerationQueuePanel
            :total="sdQueue.total.value"
            :paused="sdQueue.paused.value"
            :active-job="sdQueue.activeJob.value"
            :queue="sdQueue.queue.value"
            @pause="sdQueue.pause"
            @resume="sdQueue.resume"
            @clear="sdQueue.clear"
            @remove="sdQueue.remove"
          />

          <VoiceStudio
            :key="pb.sceneId || 'freeform'"
            ref="voiceStudioRef"
            :initial-voice="pb.char === 'natsume' ? 'natsume' : 'nene'"
            :suggested-caption="pb.activeScene?.story || pb.story"
          />
        </div>
      </div>

      <!-- ─── 右栏：风格 ───────────────────────────────────── -->
      <div class="director-col col-right">

        <!-- Emotion -->
        <details class="panel step-panel decision-fold" id="stepEmotion" :open="pb.directorMode === 'basic'">
          <summary class="panel-title decision-summary">
            <span>情绪 · Emotion</span>
            <span class="decision-current">{{ emotionSummary }}</span>
          </summary>
          <div class="emotion-list">
            <button v-for="e in EMOTION" :key="e.id"
              class="option" type="button"
              :class="{ selected: pb.selections.emotion.includes(e.id) }"
              @click="pb.toggleEmotion(e.id)">
              <span class="opt-icon">{{ e.icon }}</span>
              <span class="opt-name">{{ e.name }}</span>
            </button>
          </div>
        </details>

        <!-- Camera / Shot -->
        <details class="panel step-panel advanced-decision decision-fold" id="stepCamera">
          <summary class="panel-title decision-summary">
            <span>镜头 · Camera</span>
            <span class="decision-current">{{ shotSummary }}</span>
          </summary>
          <div class="camera-list">
            <button v-for="s in SHOT" :key="s.id"
              class="option" type="button"
              :class="{ selected: pb.selections.shot === s.id }"
              @click="pb.setShot(pb.selections.shot === s.id ? null : s.id)">
              <span class="opt-icon">{{ s.icon }}</span>
              <span class="opt-name">{{ s.name }}</span>
            </button>
          </div>
        </details>

        <!-- Lighting -->
        <details class="panel step-panel advanced-decision decision-fold" id="stepLighting">
          <summary class="panel-title decision-summary">
            <span>光照 · Lighting</span>
            <span class="decision-current">{{ lightingSummary }}</span>
          </summary>
          <div class="lighting-list">
            <button v-for="l in LIGHTING" :key="l.id"
              class="option" type="button"
              :class="{ selected: pb.selections.lighting === l.id }"
              @click="pb.setLighting(pb.selections.lighting === l.id ? null : l.id)">
              <span class="opt-icon">{{ l.icon }}</span>
              <span class="opt-name">{{ l.name }}</span>
            </button>
          </div>
        </details>

        <!-- Composition -->
        <details class="panel step-panel advanced-decision decision-fold" id="stepComposition">
          <summary class="panel-title decision-summary">
            <span>构图 · Composition</span>
            <span class="decision-current">{{ compositionSummary }}</span>
          </summary>
          <div class="comp-list">
            <button v-for="c in COMPOSITION" :key="c.id"
              class="option" type="button"
              :class="{ selected: pb.selections.composition === c.id }"
              @click="pb.setComposition(pb.selections.composition === c.id ? null : c.id)">
              <span class="opt-icon">{{ c.icon }}</span>
              <span class="opt-name">{{ c.name }}</span>
            </button>
          </div>
        </details>

        <!-- Color Mood -->
        <details class="panel step-panel decision-fold" id="stepMood" :open="pb.directorMode === 'basic'">
          <summary class="panel-title decision-summary">
            <span>色彩情调 · Mood</span>
            <span class="decision-current">{{ moodSummary }}</span>
          </summary>
          <div class="mood-grid">
            <button v-for="m in COLOR_MOODS" :key="m.id"
              class="mood-card" type="button"
              :class="{ active: pb.colorMood === m.id }"
              @click="pb.setColorMood(pb.colorMood === m.id ? null : m.id)">
              <span class="mood-icon">{{ m.icon }}</span>
              <span class="mood-name">{{ m.name }}</span>
              <span class="mood-desc">{{ m.desc }}</span>
            </button>
          </div>
        </details>

      </div>
    </div>

    <!-- Toast -->
    <div v-if="pb.toastMsg" class="pb-toast" role="status" aria-live="polite">{{ pb.toastMsg }}</div>
  </article>
</template>

<script setup lang="ts">
// 导演台专属样式（91.6KB）随本路由块加载，不再进全局包
import '@/assets/css/director.css'
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  usePromptBuilderStore,
  type CharKey,
  type HistoryEntry,
  type Scene,
} from '@/stores/promptBuilderStore'
import { useSDGenerate } from '@/composables/useSDGenerate'
import { usePromptAssembly } from '@/composables/usePromptAssembly'
import HistoryPanel from '@/components/HistoryPanel.vue'
import { EMOTION, SHOT, LIGHTING, COMPOSITION, COLOR_MOODS, SCENE_THEMES } from '@/config/promptConstants'
import { useSDQueue, type SDQueueJob } from '@/composables/useSDQueue'
import { classifySDError, SAFE_SAMPLING, LIGHT_LOAD, type SDErrorReport, type SDRecoveryId } from '@/utils/sdError'
import VoiceStudio from '@/components/VoiceStudio.vue'
import PromptDataTools from '@/components/PromptDataTools.vue'
import PromptHealthPanel from '@/components/PromptHealthPanel.vue'
import GenerationQueuePanel from '@/components/GenerationQueuePanel.vue'
import GenerationParamsPanel from '@/components/GenerationParamsPanel.vue'
import GenerationOutputControls from '@/components/GenerationOutputControls.vue'
import SDRecoveryPanel from '@/components/SDRecoveryPanel.vue'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import { readHiddenScenes, rememberRecent, recordSceneUsage } from '@/utils/sceneUX'
import { tagMeaning } from '@/utils/tagMeaning'
import {
  quickCreateSummary,
  readQuickCreate,
  writeQuickCreate,
  type QuickCreateSettings,
} from '@/utils/quickCreate'

const router = useRouter()
const route = useRoute()
const pb = usePromptBuilderStore()
const sd = useSDGenerate()

// ── UI state ──────────────────────────────────────────────────────────────
const sceneLimit = ref(20)
const sdSize = ref('832x1216')
const sceneCollection = ref<'core' | 'curated' | 'all'>('core')
const hiddenSceneIds = ref(readHiddenScenes())
const tagSearch = ref('')
const tagCategory = ref('all')
const voiceStudioRef = ref<{ setSuggestedCaption?: (caption: string) => void } | null>(null)
const DIRECTOR_MODE_KEY = 'aics_pb_director_mode'

// ── 显存预算提示（重构前的 sdBudgetHint） ─────────────────────────────────
const vramBudget = computed(() => {
  const [w, h] = sdSize.value.split('x').map(Number)
  const scale = pb.sdParams.hiresFix ? (pb.sdParams.hiresScale || 1.5) : 1
  const finalW = Math.round((w || 832) * scale)
  const finalH = Math.round((h || 1216) * scale)
  return { width: finalW, height: finalH, megapixels: (finalW * finalH) / 1_000_000 }
})
const vramLevel = computed(() => {
  const mp = vramBudget.value.megapixels
  // 16GB 显存下 SDXL：约 4MP 内稳，6MP 起偏紧
  if (mp > 6) return 'danger'
  if (mp > 4) return 'warn'
  return ''
})
const baseResolutionRisk = computed(() => {
  const [w, h] = sdSize.value.split('x').map(Number)
  const megapixels = ((w || 832) * (h || 1216)) / 1_000_000
  // SDXL is most coherent near its 1024^2 training buckets. This is unrelated to VRAM.
  if (megapixels > 1.8) return 'danger'
  if (megapixels > 1.5) return 'warn'
  return ''
})
const vramHint = computed(() => {
  const b = vramBudget.value
  const base = `最终 ${b.width}×${b.height} · ${b.megapixels.toFixed(1)} MP`
  if (vramLevel.value === 'danger') return base + ' · 16G 显存可能 OOM'
  if (vramLevel.value === 'warn') return base + ' · 接近 16G 上限'
  return base
})
const baseResolutionHint = computed(() => {
  const [w, h] = sdSize.value.split('x').map(Number)
  const megapixels = ((w || 832) * (h || 1216)) / 1_000_000
  const base = `基础 ${w}×${h} · ${megapixels.toFixed(1)} MP`
  if (baseResolutionRisk.value === 'danger') return base + ' · SDXL 人物结构风险高'
  return base + ' · SDXL 人物结构风险偏高'
})
const canUseFaceDetailer = computed(() => {
  const [w, h] = sdSize.value.split('x').map(Number)
  return pb.char !== 'triad' && !pb.sdParams.hiresFix && ((w || 832) * (h || 1216)) > 1_500_000
})

// ── Static data ───────────────────────────────────────────────────────────
const storyChips = [
  '放学后在樱花树下等人的宁宁',
  '第一次在海边看日出的夏目',
  '夏夜祭典穿浴衣看烟花',
  '雪天围围巾的温柔一瞬',
]

const charOptions: Array<{ id: CharKey; label: string }> = [
  { id: 'nene',    label: '🌸 宁宁' },
  { id: 'natsume', label: '🍂 夏目' },
  { id: 'triad',   label: '🌸🍂 双人' },
]

function isCharKey(value: unknown): value is CharKey {
  return value === 'nene' || value === 'natsume' || value === 'triad'
}

const TAG_CATEGORY_LABELS: Record<string, string> = {
  all: '全部',
  Clothing: '服装',
  Action: '动作',
  Emotion: '情绪',
  Scene: '场景',
  Lighting: '光照',
  Appearance: '外观',
  Camera: '镜头',
  Style: '画风',
  Quality: '质量',
  Body: '身体',
  Mature: '成人',
  Character: '角色',
  'Official Outfit': '官方服装',
}

type OutfitBundle = { id: string; character: 'nene' | 'natsume'; label: string; tags: string[] }
/**
 * UI catalog key normalization only. Prompt token policy stays inside
 * usePromptAssembly/promptPolicy so this view remains a consumer.
 */
function normalizeCatalogKey(token: string): string {
  return String(token || '')
    .replace(/^\s*\[NEG\]\s*/i, '')
    .replace(/^\s*<lora:|>\s*$/gi, '')
    .replace(/^\s*\(+|\)+\s*$/g, '')
    .replace(/:\s*-?\d+(?:\.\d+)?\s*$/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-/]+/g, '_')
}
const OUTFIT_BUNDLES: OutfitBundle[] = [
  {
    id: 'nene-witch', character: 'nene', label: '宁宁 · 经典魔女服',
    tags: ['nene_witch_canonical', 'witch_hat', 'black_cape', 'criss-cross_halter', 'crop_top', 'strap_between_breasts', 'pink_bow', 'black_skirt', 'asymmetrical_legwear', 'striped_thighhighs', 'frilled_socks'],
  },
  {
    id: 'nene-school', character: 'nene', label: '宁宁 · 学院制服',
    tags: ['nene_school_uniform', 'school_uniform', 'blazer', 'yellow_bowtie', 'plaid_skirt', 'pleated_skirt', 'grey_skirt', 'black_thighhighs'],
  },
  {
    id: 'nene-sailor', character: 'nene', label: '宁宁 · 水手制服',
    tags: ['nene_sailor_uniform', 'grey_sailor_collar', 'black_shirt', 'sailor_shirt', 'serafuku'],
  },
  {
    id: 'nene-blue-pajamas', character: 'nene', label: '宁宁 · 蓝色睡衣',
    tags: ['nene_blue_pajamas', 'pajamas', 'animal_print', 'cat_print', 'long_sleeves'],
  },
  {
    id: 'nene-green-sleepwear', character: 'nene', label: '宁宁 · 绿色睡衣',
    tags: ['nene_green_sleepwear', 'sleepwear', 'nightgown', 'polka_dot', 'short_sleeves', 'twin_braids'],
  },
  {
    id: 'natsume-qipao', character: 'natsume', label: '夏目 · 官方旗袍',
    tags: ['natsume_official_qipao', 'chinese_clothes', 'china_dress', 'red_dress', 'floral_print', 'side_slit', 'long_sleeves', 'black_thighhighs', 'hair_bun', 'double_bun', 'hair_flower', 'red_flower'],
  },
  {
    id: 'natsume-cafe', character: 'natsume', label: '夏目 · 咖啡店制服',
    tags: ['natsume_cafe_uniform', 'white_shirt', 'suspenders', 'suspender_skirt', 'brown_skirt', 'long_sleeves', 'collared_shirt', 'purple_ribbon', 'hair_flower'],
  },
  {
    id: 'natsume-maid', character: 'natsume', label: '夏目 · 女仆服',
    tags: ['natsume_maid_uniform', 'maid', 'maid_apron', 'white_apron', 'maid_headdress', 'long_sleeves', 'frills'],
  },
  {
    id: 'natsume-sleepwear', character: 'natsume', label: '夏目 · 睡衣',
    tags: ['natsume_sleepwear', 'shirt', 'blue_shirt', 'pillow', 'on_bed'],
  },
]
const OUTFIT_TAG_LABELS: Record<string, string> = {
  nene_witch_canonical: '宁宁魔女服主控制词',
  nene_school_uniform: '宁宁校服主控制词',
  nene_sailor_uniform: '宁宁水手服主控制词',
  nene_blue_pajamas: '宁宁蓝色睡衣主控制词',
  nene_green_sleepwear: '宁宁绿色睡衣主控制词',
  nene_red_cardigan_uniform: '宁宁红色开衫制服主控制词',
  natsume_official_qipao: '夏目旗袍主控制词',
  natsume_cafe_uniform: '夏目咖啡制服主控制词',
  natsume_maid_uniform: '夏目女仆服主控制词',
  natsume_sleepwear: '夏目睡衣主控制词',
}
const R18_CONTROLS = [
  { character: 'nene', tag: 'nene_r18', label: '宁宁 R18' },
  { character: 'natsume', tag: 'natsume_r18', label: '夏目 R18' },
] as const
const NON_MANUAL_TAGS = new Set([
  'masterpiece', 'best_quality', 'highly_detailed', 'absurdres', 'very_aesthetic',
  'amazing_quality', 'newest', 'ultra_detailed', 'highres', 'score_9', 'score_8_up',
  'worst_quality', 'low_quality', 'normal_quality', 'lowres', 'blurry', 'jpeg_artifacts',
  'text', 'watermark', 'logo', 'signature', 'bad_anatomy', 'bad_hands', 'extra_fingers',
  'missing_fingers', 'fused_fingers', 'extra_arms', 'extra_legs', 'deformed',
  'bad_proportions', 'duplicate', 'cropped', 'child', 'loli', 'underage',
])

// ── Derived ───────────────────────────────────────────────────────────────
const optionName = (options: readonly { id: string; name: string }[], id: string | null) =>
  options.find(option => option.id === id)?.name ?? '自动'
const emotionSummary = computed(() => {
  const names = pb.selections.emotion
    .map(id => EMOTION.find(option => option.id === id)?.name)
    .filter(Boolean)
  if (!names.length) return '自动'
  return names.length > 2 ? `${names.slice(0, 2).join('、')} +${names.length - 2}` : names.join('、')
})
const shotSummary = computed(() => optionName(SHOT, pb.selections.shot))
const lightingSummary = computed(() => optionName(LIGHTING, pb.selections.lighting))
const compositionSummary = computed(() => optionName(COMPOSITION, pb.selections.composition))
const moodSummary = computed(() => optionName(COLOR_MOODS, pb.colorMood))

const personaCoreIds = computed(() => new Set(
  Array.isArray(pb.curation.personaCoreSceneIds)
    ? pb.curation.personaCoreSceneIds as string[]
    : Array.isArray(pb.curation.signatureSceneIds)
      ? pb.curation.signatureSceneIds as string[]
      : [],
))
const curatedIds = computed(() => new Set(
  Array.isArray(pb.curation.curatedSceneIds) ? pb.curation.curatedSceneIds as string[] : [],
))
const availableScenes = computed(() => {
  const base = pb.filteredScenes.filter(scene => !hiddenSceneIds.value.has(scene.id))
  // 搜索永远扫完整可用库，避免用户必须先猜场景属于哪一层。
  if (pb.sceneSearch.trim() || sceneCollection.value === 'all') return base
  const ids = sceneCollection.value === 'core' ? personaCoreIds.value : curatedIds.value
  return base.filter(scene => ids.has(scene.id))
})
const visibleScenes = computed(() => availableScenes.value.slice(0, sceneLimit.value))
const personaCoreCount = computed(() =>
  pb.filteredScenes.filter(scene => !hiddenSceneIds.value.has(scene.id) && personaCoreIds.value.has(scene.id)).length,
)
const curatedCount = computed(() =>
  pb.filteredScenes.filter(scene => !hiddenSceneIds.value.has(scene.id) && curatedIds.value.has(scene.id)).length,
)

const tagCategories = computed(() => {
  const found = new Set(tagCatalog.value.map(tag => tag.cat).filter(Boolean))
  return ['all', ...found].map(id => ({ id, label: TAG_CATEGORY_LABELS[id] || id }))
})
const tagCatalog = computed(() => {
  const merged = new Map(pb.tags.filter(tag => tag.cat !== 'Quality' && !NON_MANUAL_TAGS.has(normalizeCatalogKey(tag.en))).map(tag => [tag.en, tag]))
  const addSceneTag = (raw: unknown) => {
    const source = String(raw || '').trim()
    if (!source || /^<lora:/i.test(source) || /^break$/i.test(source)) return
    const en = normalizeCatalogKey(source)
    if (!en || en.length > 64 || NON_MANUAL_TAGS.has(en) || merged.has(en)) return
    const mature = /(?:^|_)(?:r18|adult|nsfw|nude|topless|nipples|explicit|pussy|penis|sex|lingerie)(?:_|$)/i.test(en)
    const official = Boolean(OUTFIT_TAG_LABELS[en])
    merged.set(en, {
      en,
      cn: OUTFIT_TAG_LABELS[en] || (mature ? '场景成人词' : '场景词条'),
      cat: official ? 'Official Outfit' : (mature ? 'Mature' : 'Scene'),
    })
  }
  pb.scenes.forEach(scene => {
    ;(scene.tags || []).forEach(addSceneTag)
    String(scene.prompt || '').split(',').forEach(addSceneTag)
  })
  OUTFIT_BUNDLES.forEach(bundle => bundle.tags.forEach(en => {
    if (!merged.has(en)) merged.set(en, {
      en,
      cn: OUTFIT_TAG_LABELS[en] || 'v18 训练服装词',
      cat: 'Official Outfit',
    })
  }))
  return [...merged.values()]
})
const visibleTags = computed(() => {
  const q = tagSearch.value.trim().toLowerCase()
  return tagCatalog.value
    .filter(tag => tagCategory.value === 'all' || tag.cat === tagCategory.value)
    .filter(tag => !q || tag.en.toLowerCase().includes(q) || tag.cn.toLowerCase().includes(q))
    .sort((a, b) => Number(pb.manualTags.has(b.en)) - Number(pb.manualTags.has(a.en)))
    .slice(0, 72)
})
const visibleOutfitBundles = computed(() =>
  OUTFIT_BUNDLES.filter(bundle => pb.char === 'triad' || bundle.character === pb.char),
)
const visibleR18Controls = computed(() =>
  R18_CONTROLS.filter(control => pb.char === 'triad' || control.character === pb.char),
)

const modeDescription = computed(() => pb.directorMode === 'basic'
  ? '从人设核心场景出发，镜头、光照与构图自动预填；只保留影响成片的选择。'
  : '开放完整场景库、词条选择、Prompt 结构与全部生成参数。')

const guideText = computed(() => {
  if (!pb.story && !pb.sceneId) return pb.directorMode === 'basic'
    ? '先选一个贴合人设的场景，导演参数会自动准备'
    : '写一个故事，或从完整场景库与词条开始搭建'
  if (pb.sceneId) return `场景已选：${pb.activeScene?.title ?? ''}`
  return '故事已填写，现在选择导演决策'
})

// ── Prompt 组装 ───────────────────────────────────────────────────────────
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
} = usePromptAssembly(pb, sd.checkpoint)
const livePrompt = positivePrompt

// ── Actions ───────────────────────────────────────────────────────────────
function setDirectorMode(mode: 'basic' | 'pro') {
  pb.directorMode = mode
  sceneCollection.value = mode === 'basic' ? 'core' : 'all'
  sceneLimit.value = 20
}

function setSceneCollection(collection: 'core' | 'curated' | 'all') {
  if (collection === 'all' && pb.directorMode === 'basic') {
    setDirectorMode('pro')
    return
  }
  sceneCollection.value = collection
  sceneLimit.value = 20
}

function selectScene(scene: Scene) {
  pb.loadScene(scene)
  voiceStudioRef.value?.setSuggestedCaption?.(scene.story ?? '')
  rememberRecent(scene)
  recordSceneUsage(scene)
  sceneLimit.value = 20
}

function onStoryInput() {
  // Clear scene context if user edits story away from scene's default
  if (pb.sceneId && pb.story !== pb.sceneBaseStory) {
    pb.clearScene({ keepStory: true })
  }
}

// ── 出图 + 队列 + 错误恢复 ──────────────────────────────────────────────────
const sdErrorReport = ref<SDErrorReport | null>(null)
function dismissError() { sdErrorReport.value = null }

/** 把当前导演台状态快照成一个队列任务 */
function captureJob(): Omit<SDQueueJob, 'id'> | null {
  if (!livePrompt.value) return null
  const scene = effectiveScene.value
  const story = String(pb.story || '').trim()
  return {
    title: scene?.title || (story ? story.slice(0, 28) : (pb.char === 'natsume' ? '夏目构图' : '宁宁构图')),
    prompt: livePrompt.value,
    negative: negativePrompt.value,
    sceneId: pb.sceneId,
    sceneTitle: scene?.title || '',
    char: pb.char,
    story,
    size: sdSize.value,
    seed: pb.sdParams.seedLock && pb.sdParams.seed >= 0 ? pb.sdParams.seed : -1,
    cfg: pb.sdParams.cfg,
    steps: pb.sdParams.steps,
    sampler: pb.sdParams.sampler,
    scheduler: pb.sdParams.scheduler || '',
    checkpoint: pb.sdModelName || sd.checkpoint.value || '',
    hiresFix: pb.sdParams.hiresFix,
    hiresScale: pb.sdParams.hiresScale,
    hiresUpscaler: pb.sdParams.hiresUpscaler,
    hiresSteps: pb.sdParams.hiresSteps,
    denoisingStrength: pb.sdParams.hiresDenoise,
    faceDetailer: pb.sdParams.faceDetailer,
  }
}

function buildSingleDetailerScripts(): Record<string, unknown> {
  return {
    ADetailer: {
      args: [
        true,
        false,
        {
          ad_model: 'face_yolov8s.pt',
          ad_prompt: 'detailed eyes, clean face, character-accurate facial features',
          ad_negative_prompt: 'deformed face, asymmetrical eyes, cross-eyed',
          ad_confidence: 0.35,
          ad_denoising_strength: 0.18,
          ad_inpaint_only_masked: true,
          ad_inpaint_only_masked_padding: 32,
          ad_use_inpaint_width_height: true,
          ad_inpaint_width: 768,
          ad_inpaint_height: 768,
          is_api: true,
        },
        {
          ad_model: 'hand_yolov8n.pt',
          ad_prompt: 'detailed hands, five fingers, natural fingers',
          ad_negative_prompt: 'extra fingers, missing fingers, fused fingers, malformed hands',
          ad_confidence: 0.3,
          ad_denoising_strength: 0.16,
          ad_inpaint_only_masked: true,
          ad_inpaint_only_masked_padding: 32,
          ad_use_inpaint_width_height: true,
          ad_inpaint_width: 768,
          ad_inpaint_height: 768,
          is_api: true,
        },
      ],
    },
  }
}

/** 执行一个任务（队列与直接出图共用同一条路径） */
async function runJob(job: Omit<SDQueueJob, 'id'>, opts: { disableLora?: boolean } = {}) {
  const [w, h] = String(job.size).split('x').map(Number)
  let prompt = job.prompt
  if (opts.disableLora) prompt = prompt.replace(/<lora:[^>]+>\s*,?\s*/gi, '').trim().replace(/,\s*$/, '')
  const directHighResolution = !job.hiresFix && (w || 832) * (h || 1216) > 1_500_000
  const alwaysonScripts = job.faceDetailer && job.char !== 'triad' && directHighResolution
    ? buildSingleDetailerScripts()
    : undefined

  const url = await sd.generate({
    prompt,
    negative_prompt: job.negative,
    width: w || 832,
    height: h || 1216,
    cfg_scale: job.cfg,
    steps: job.steps,
    sampler_name: job.sampler,
    scheduler: job.scheduler || undefined,
    hr_fix: job.hiresFix,
    hr_scale: job.hiresScale,
    hr_upscaler: job.hiresUpscaler,
    hr_second_pass_steps: job.hiresSteps,
    denoising_strength: job.denoisingStrength,
    seed: job.seed,
    model: job.checkpoint || undefined,
    alwayson_scripts: alwaysonScripts,
  })

  if (sd.resultSeed.value) pb.sdParams.seed = sd.resultSeed.value
  if (url) {
    writeQuickCreate({
      checkpoint: job.checkpoint,
      sampler: job.sampler,
      scheduler: job.scheduler,
      cfg: job.cfg,
      steps: job.steps,
      size: job.size,
      hiresFix: job.hiresFix,
      hiresUpscaler: job.hiresUpscaler,
      hiresScale: job.hiresScale,
    })
  }
  return url
}

const sdQueue = useSDQueue({
  isBusy: () => sd.generating.value,
  onFlash: (m) => pb.flash(m),
  run: async (job) => {
    const url = await runJob(job)
    if (url) {
      sdErrorReport.value = null
      // 队列产出自动入册，避免跑完一批还要手点保存
      try {
        // url 是本地 blob URL，不会回 HTML 错误页，但可能已被 revoke 而拿到空 blob。
        // 空 blob 入册会在作品册里留下一条打不开的记录。
        const blob = await (await fetch(url)).blob()
        if (!blob.size) throw new Error('成片数据已失效')
        await pb.commitHistoryEntry({
          blob, seed: sd.resultSeed.value ?? undefined,
          size: job.size, negative: job.negative, prompt: job.prompt,
        })
      } catch (e) { console.warn('queue autosave failed', e) }
      return { status: 'success' as const }
    }
    const err = sd.errorMsg.value
    if (!err) return { status: 'cancelled' as const }
    sdErrorReport.value = classifySDError({ message: err })
    return { status: 'failure' as const, error: err }
  },
})

function enqueueCurrent() {
  const job = captureJob()
  if (!job) { pb.flash('请先选择场景或填写故事'); return }
  sdQueue.enqueue(job)
}

async function callGenerate(opts: { disableLora?: boolean } = {}) {
  if (!livePrompt.value) { pb.flash('请先选择场景或填写故事'); return }
  sdErrorReport.value = null
  const job = captureJob()
  if (!job) return
  const url = await runJob(job, opts)
  if (!url && sd.errorMsg.value) {
    sdErrorReport.value = classifySDError({ message: sd.errorMsg.value })
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
    if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  }
}

async function copyPrompt() {
  try { await navigator.clipboard.writeText(previewPrompt.value); pb.flash('Prompt 已复制') }
  catch { pb.flash('复制失败，请手动选取') }
}

async function saveHistory() {
  try {
    const url = sd.resultUrl.value
    if (!url) { pb.flash('暂无可保存的成片'); return }
    // 抓取成片 blob 写入 IndexedDB，并 commit 历史
    const response = await fetch(url)
    const blob = await response.blob()
    // 空 blob 会入册成一条打不开的记录，宁可报错
    if (!blob.size) { pb.flash('成片数据已失效，请重新生成'); return }
    const entry = await pb.commitHistoryEntry({
      blob,
      seed: sd.resultSeed.value ?? undefined,
      size: sdSize.value,
      negative: negativePrompt.value,
      prompt: livePrompt.value,
    })
    if (entry) pb.flash('快照已存入本地作品册')
    else pb.flash('保存失败')
  } catch (e) { pb.flash('保存失败'); console.warn(e) }
}

function saveResult() { saveHistory() }

function reuseLastSeed() {
  const seed = sd.resultSeed.value ?? pb.lastSeed
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

function applyHistory(entry: HistoryEntry, keepAsVariant = false) {
  if (entry.character) pb.setChar(entry.character)
  if (entry.story) pb.setStory(entry.story)
  if (entry.scene) {
    const sc = pb.scenes.find(s => s.id === entry.scene)
    if (sc) pb.loadScene(sc)
  } else {
    pb.clearScene({ keepStory: true })
  }
  pb.selections.emotion.splice(0, pb.selections.emotion.length, ...(entry.emotion || []))
  pb.setShot(entry.shot || null)
  pb.setLighting(entry.lighting || null)
  pb.setComposition(entry.composition || null)
  pb.setColorMood(entry.colorMood || null)
  pb.manualTags = new Set(entry.manual_tags || [])
  if (entry.seed >= 0) { pb.sdParams.seed = entry.seed; pb.sdParams.seedLock = true }
  pb.sdParams.cfg = Number(entry.cfg) || pb.sdParams.cfg
  pb.sdParams.steps = Number(entry.steps) || pb.sdParams.steps
  if (entry.sampler) pb.sdParams.sampler = entry.sampler
  if (entry.scheduler) pb.sdParams.scheduler = entry.scheduler
  if (entry.negative) { pb.sdParams.negative = true; pb.sdParams.negativeCustom = entry.negative }
  if (entry.size) sdSize.value = entry.size
  if (keepAsVariant) pb.flash('已复制为新变体草稿')
  else pb.flash('已恢复历史参数')
}

function resumeHistory(entry: HistoryEntry) { applyHistory(entry) }
function duplicateHistory(entry: HistoryEntry) { applyHistory(entry, true) }
async function deleteHistory(entry: HistoryEntry) {
  await pb.removeHistoryEntry(entry.id)
  pb.flash('历史记录已删除')
}

function addTag(e: Event) {
  const input = e.target as HTMLInputElement
  const tag = input.value.trim().replace(/\s+/g, '_').toLowerCase()
  if (tag) { pb.toggleManualTag(tag); input.value = '' }
}

function toggleOutfitBundle(tags: string[]) {
  const next = new Set(pb.manualTags)
  const selected = tags.every(tag => next.has(tag))
  tags.forEach(tag => {
    if (selected) next.delete(tag)
    else next.add(tag)
  })
  pb.manualTags = next
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  const savedMode = localStorage.getItem(DIRECTOR_MODE_KEY)
  if (savedMode === 'pro' || savedMode === 'basic') {
    pb.directorMode = savedMode
    sceneCollection.value = savedMode === 'pro' ? 'all' : 'core'
  }
  await pb.loadData()
  await sd.checkStatus()
  // 拿到 WebUI 真实 checkpoint 后，再按对应 model profile 填参数
  pb.applyModelProfile(pb.sdModelName || sd.checkpoint.value)
  // 历史载入（IndexedDB）
  await pb.loadHistory()

  // 深链参数恢复（?scene / ?char / ?mood / ?regen / ?resume / ?quick / ?variant）
  const q = route.query
  let handledDeepLink = false
  if (isCharKey(q.char)) {
    pb.setChar(q.char); handledDeepLink = true
  }
  if (typeof q.mood === 'string' && COLOR_MOODS.some(m => m.id === q.mood)) {
    pb.setColorMood(q.mood); handledDeepLink = true
  }
  if (typeof q.scene === 'string') {
    const sc = pb.scenes.find(s => s.id === q.scene)
    if (sc) { selectScene(sc); handledDeepLink = true }
  } else if (typeof q.regen === 'string' || typeof q.variant === 'string') {
    const targetId = q.regen ? Number(q.regen) : NaN
    const entry = targetId ? pb.history.find(h => h.id === targetId) : null
    if (entry) {
      if (entry.character) pb.setChar(entry.character)
      if (entry.story) pb.setStory(entry.story)
      if (entry.scene) {
        const sc = pb.scenes.find(s => s.id === entry.scene)
        if (sc) pb.loadScene(sc)
      }
      if (Array.isArray(entry.emotion)) entry.emotion.forEach((e:string) => { if (!pb.selections.emotion.includes(e)) pb.selections.emotion.push(e) })
      if (entry.shot) pb.setShot(entry.shot)
      if (entry.lighting) pb.setLighting(entry.lighting)
      if (entry.composition) pb.setComposition(entry.composition)
      if (entry.colorMood) pb.setColorMood(entry.colorMood)
      if (Array.isArray(entry.manual_tags)) { pb.manualTags = new Set(entry.manual_tags) }
      if (entry.seed && entry.seed >= 0) { pb.sdParams.seed = entry.seed; pb.sdParams.seedLock = true }
      handledDeepLink = true
    }
  } else if (q.resume === '1') {
    handledDeepLink = pb.restoreDraft()
  } else if (q.quick === '1' && !pb.story) {
    pb.setStory('用一张画面来讲今天想画的故事')
    handledDeepLink = true
  }
  if (!handledDeepLink) pb.restoreDraft()
  // 推荐尺寸同步到出图选择
  if (pb.lastRecommendedSize) sdSize.value = pb.lastRecommendedSize

  if (q.quick === '1') {
    const savedQuick = readQuickCreate()
    applyQuickCreateSettings(savedQuick)
    await nextTick()
    if (!sd.online.value) {
      pb.flash('快速出图未启动：SD WebUI 当前未连接，Prompt 已保留')
    } else if (livePrompt.value) {
      const reused = quickCreateSummary(savedQuick)
      pb.flash(reused ? `正在快速出图 · ${reused}` : '正在使用当前推荐参数快速出图')
      await callGenerate()
    }
  }
})

// Autosave draft
watch([() => pb.story, () => pb.char, () => pb.sceneId, () => pb.selections, () => pb.manualTags, () => pb.colorMood], () => {
  pb.saveDraft?.()
}, { deep: true })

watch(() => pb.directorMode, mode => {
  localStorage.setItem(DIRECTOR_MODE_KEY, mode)
})

watch([() => pb.char, () => pb.sceneSearch, () => pb.sceneTheme, sceneCollection], () => {
  sceneLimit.value = 20
})

// 切换 SD 模型时重新套用对应 profile 的推荐参数
watch(() => pb.sdModelName, (name) => {
  pb.applyModelProfile(name || sd.checkpoint.value)
})
</script>
