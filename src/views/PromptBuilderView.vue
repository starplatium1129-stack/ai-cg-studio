<template>
  <article class="pb" :data-character="pb.char" :data-director-mode="pb.directorMode" :class="{ 'focus-mode': pb.focusMode }">
    <a @click.prevent="$router.push('/')" href="/" class="nav-back">← 回首页</a>

    <div class="pb-topline">
      <div class="pb-header">
        <div class="pb-kicker">Nene &amp; Natsume Private Atelier</div>
        <h1 class="pb-title">开始绘制</h1>
        <p class="pb-sub">选一个场景，定下情绪、镜头与光照；参数会自动备好，你只管出图。</p>
      </div>
      <div class="pb-top-actions">
        <button class="focus-mode-btn" type="button" aria-label="进入专注成片模式"
          :aria-pressed="pb.focusMode"
          @click="pb.focusMode = !pb.focusMode">
          <span class="focus-mode-label">{{ pb.focusMode ? '退出专注' : '专注成片' }}</span>
        </button>
        <div class="api-status">
          <span class="badge" :class="sd.online.value ? 'badge-online' : 'badge-offline'">
            {{ sd.online.value ? '✓ SD 已连接' : '正在连接 SD…' }}
          </span>
        </div>
      </div>
    </div>

    <div class="setup-strip">
      <div class="guide-bar">{{ guideText }}</div>
      <div class="project-bar">
        <label>项目</label>
        <select v-model="pb.projectId">
          <option value="">（无项目）</option>
          <option v-for="p in pb.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
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
              @click="pb.setChar(c.id as any)">{{ c.label }}</button>
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
          <div class="panel-title">Scene · <span class="scene-count-badge">{{ pb.filteredScenes.length }}</span></div>
          <div class="scene-search-wrap">
            <input type="search" class="scene-search" v-model="pb.sceneSearch"
              placeholder="试试：安静的夏目雨夜">
            <button class="scene-search-clear" type="button" aria-label="清空"
              @click="pb.sceneSearch = ''">×</button>
          </div>
          <div class="scene-filter-summary">
            <span class="scene-result-count" role="status" aria-live="polite">
              {{ pb.filteredScenes.length }} 个场景
            </span>
            <button class="scene-filter-reset" type="button" @click="pb.sceneSearch = ''; pb.sceneTheme = 'all'">重置筛选</button>
          </div>
          <div class="scene-filter-label">主题</div>
          <div class="scene-cats">
            <button v-for="t in SCENE_THEMES" :key="t.id"
              class="scene-cat-btn" type="button"
              :class="{ active: pb.sceneTheme === t.id }"
              @click="pb.sceneTheme = t.id">{{ t.icon }} {{ t.label }}</button>
          </div>
          <div class="scene-list">
            <div v-if="!pb.dataReady" class="scene-loading">正在加载场景库…</div>
            <div v-else-if="!pb.filteredScenes.length" class="scene-empty">未找到匹配场景</div>
            <button v-for="scene in visibleScenes" :key="scene.id"
              class="scene-card"
              :class="{ active: pb.sceneId === scene.id }"
              type="button"
              @click="selectScene(scene)">
              <div class="scene-card-title">{{ scene.title }}</div>
              <div v-if="scene.story" class="scene-card-story">{{ scene.story }}</div>
              <div class="scene-card-meta">
                <span v-if="scene.category" class="scene-cat-tag">{{ scene.category }}</span>
                <span v-if="scene.rating && scene.rating !== 'All'" class="scene-rating-tag">{{ scene.rating }}</span>
              </div>
            </button>
            <button v-if="pb.filteredScenes.length > sceneLimit" class="btn btn-ghost scene-more"
              type="button" @click="sceneLimit += 20">
              显示更多 ({{ pb.filteredScenes.length - sceneLimit }} 个)
            </button>
          </div>
        </div>
      </div>

      <!-- ─── 中栏：监视器 ────────────────────────────────── -->
      <div class="director-col col-center">

        <!-- Stage placeholder -->
        <section v-show="!sd.resultUrl.value" class="stage-placeholder" aria-label="成片监看区">
          <div class="stage-chrome"><span>CANVAS</span><span class="stage-ready">READY</span></div>
          <img class="stage-muse nene" src="/assets/characters/nene-official.webp" alt="" aria-hidden="true" decoding="async">
          <img class="stage-muse natsume" src="/assets/characters/natsume-official.webp" alt="" aria-hidden="true" decoding="async">
          <div class="stage-message">
            <div class="stage-idle">
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

        <!-- Prompt monitor -->
        <div class="monitor" id="promptMonitor">
          <div class="panel-title">Prompt 实时预览</div>
          <div class="preview-output">{{ livePrompt || '选择左侧场景或调整右侧画面选项，提示词会在这里实时生成。' }}</div>
          <div class="preview-actions">
            <button class="btn btn-primary" type="button" @click="copyPrompt">复制</button>
            <button class="btn btn-ghost" type="button" @click="saveHistory">保存</button>
          </div>
        </div>

        <!-- SD params -->
        <details class="panel generation-settings">
          <summary class="panel-title settings-summary">出图参数</summary>
          <div class="controls-grid">
            <div class="ctrl"><label>CFG</label>
              <select v-model.number="pb.sdParams.cfg">
                <option v-for="v in [3,4,5,5.5,6,7,8]" :key="v" :value="v">{{ v }}</option>
              </select>
            </div>
            <div class="ctrl"><label>Steps</label>
              <select v-model.number="pb.sdParams.steps">
                <option v-for="v in [20,28,30,35,40,50]" :key="v" :value="v">{{ v }}</option>
              </select>
            </div>
            <div class="ctrl ctrl-full"><label>SD 模型</label>
              <select v-model="pb.sdModelName">
                <option value="">使用 WebUI 当前模型</option>
                <option v-for="m in sd.models.value" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div class="ctrl"><label>Sampler</label>
              <select v-model="pb.sdParams.sampler">
                <option v-for="s in (sd.samplers.value.length ? sd.samplers.value : ['DPM++ 2M','DPM++ 2M SDE','Euler a','Euler'])" :key="s">{{ s }}</option>
              </select>
            </div>
            <div class="ctrl"><label>Scheduler</label>
              <select v-model="pb.sdParams.scheduler">
                <option value="">自动</option>
                <option v-for="s in (sd.schedulers.value.length ? sd.schedulers.value : ['Karras','Exponential'])" :key="s">{{ s }}</option>
              </select>
            </div>
            <div class="ctrl toggle-row">
              <label class="switch"><input type="checkbox" v-model="pb.sdParams.quality"><span class="slider"></span></label>
              <label>质量前缀</label>
            </div>
            <div class="ctrl toggle-row">
              <label class="switch"><input type="checkbox" v-model="pb.sdParams.negative"><span class="slider"></span></label>
              <label>负面</label>
            </div>
          </div>
        </details>

        <!-- Result panel -->
        <div class="result-frame step-panel" id="stepResult">
          <div class="panel-title">输出 Result</div>

          <div class="sd-inline-options">
            <label>尺寸<select v-model="sdSize">
              <optgroup label="竖图 Portrait">
                <option value="768x1344">768×1344</option>
                <option value="832x1216">832×1216</option>
              </optgroup>
              <optgroup label="方图 Square">
                <option value="896x896">896×896</option>
                <option value="1024x1024">1024×1024</option>
              </optgroup>
              <optgroup label="横图 Landscape">
                <option value="1216x832">1216×832</option>
                <option value="1344x896">1344×896</option>
              </optgroup>
              <optgroup label="16:9 官方 CG">
                <option value="1280x720">1280×720</option>
                <option value="1344x768">1344×768</option>
              </optgroup>
            </select></label>
            <label class="hires-label">
              <span class="switch"><input type="checkbox" v-model="pb.sdParams.hiresFix"><span class="slider"></span></span>
              hires.fix
            </label>
            <details v-if="pb.sdParams.hiresFix" class="sd-advanced-options">
              <summary>高级设置</summary>
              <div class="sd-advanced-grid">
                <label>放大<select v-model.number="pb.sdParams.hiresScale"><option :value="1.5">1.5×</option><option :value="2">2×</option></select></label>
                <label>放大器<select v-model="pb.sdParams.hiresUpscaler">
                  <option>Latent</option><option>R-ESRGAN 4x+ Anime6B</option>
                </select></label>
              </div>
            </details>
          </div>

          <div class="preview-actions">
            <button class="btn btn-primary" type="button"
              :disabled="sd.generating.value || !sd.online.value"
              @click="callGenerate">
              {{ sd.generating.value ? '生成中…' : '生成图片' }}
            </button>
            <button v-if="sd.generating.value" class="btn btn-ghost" type="button"
              @click="sd.cancel()">停止生成</button>
            <button class="btn btn-ghost" type="button" @click="pb.clearScene()">再来一次</button>
          </div>

          <!-- Progress -->
          <div v-if="sd.generating.value" class="sd-result-area" style="display:block">
            <div class="sd-status">{{ sd.statusText.value }}</div>
            <div class="sd-progress"><span class="sd-progress-bar" :style="{ width: sd.progress.value + '%' }"></span></div>
          </div>

          <!-- Error -->
          <div v-if="sd.errorMsg.value" class="sd-result-area" style="display:block">
            <div class="sd-status error">{{ sd.errorMsg.value }}</div>
          </div>
        </div>
      </div>

      <!-- ─── 右栏：风格 ───────────────────────────────────── -->
      <div class="director-col col-right">

        <!-- Emotion -->
        <div class="panel step-panel" id="stepEmotion">
          <div class="panel-title">情绪 · Emotion</div>
          <div class="emotion-list">
            <button v-for="e in EMOTION" :key="e.id"
              class="option" type="button"
              :class="{ selected: pb.selections.emotion.includes(e.id) }"
              @click="pb.toggleEmotion(e.id)">
              <span class="opt-icon">{{ e.icon }}</span>
              <span class="opt-name">{{ e.name }}</span>
            </button>
          </div>
        </div>

        <!-- Camera / Shot -->
        <div class="panel step-panel" id="stepCamera">
          <div class="panel-title">镜头 · Camera</div>
          <div class="camera-list">
            <button v-for="s in SHOT" :key="s.id"
              class="option" type="button"
              :class="{ selected: pb.selections.shot === s.id }"
              @click="pb.setShot(pb.selections.shot === s.id ? null : s.id)">
              <span class="opt-icon">{{ s.icon }}</span>
              <span class="opt-name">{{ s.name }}</span>
            </button>
          </div>
        </div>

        <!-- Lighting -->
        <div class="panel step-panel" id="stepLighting">
          <div class="panel-title">光照 · Lighting</div>
          <div class="lighting-list">
            <button v-for="l in LIGHTING" :key="l.id"
              class="option" type="button"
              :class="{ selected: pb.selections.lighting === l.id }"
              @click="pb.setLighting(pb.selections.lighting === l.id ? null : l.id)">
              <span class="opt-icon">{{ l.icon }}</span>
              <span class="opt-name">{{ l.name }}</span>
            </button>
          </div>
        </div>

        <!-- Composition -->
        <div class="panel step-panel" id="stepComposition">
          <div class="panel-title">构图 · Composition</div>
          <div class="comp-list">
            <button v-for="c in COMPOSITION" :key="c.id"
              class="option" type="button"
              :class="{ selected: pb.selections.composition === c.id }"
              @click="pb.setComposition(pb.selections.composition === c.id ? null : c.id)">
              <span class="opt-icon">{{ c.icon }}</span>
              <span class="opt-name">{{ c.name }}</span>
            </button>
          </div>
        </div>

        <!-- Color Mood -->
        <div class="panel step-panel" id="stepMood">
          <div class="panel-title">色彩情调 · Mood</div>
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
        </div>

        <!-- Manual tags -->
        <div class="panel step-panel" id="stepTags">
          <div class="panel-title">手动标签 · Tags</div>
          <div class="manual-tags">
            <span v-for="tag in pb.manualTags" :key="tag" class="manual-tag">
              {{ tag }}
              <button type="button" class="tag-remove" @click="pb.toggleManualTag(tag)">×</button>
            </span>
          </div>
          <input class="tag-input" type="text" placeholder="输入 Danbooru 标签后回车"
            @keydown.enter.prevent="addTag($event)" />
        </div>

      </div>
    </div>

    <!-- Toast -->
    <div v-if="pb.toastMsg" class="pb-toast" role="status" aria-live="polite">{{ pb.toastMsg }}</div>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePromptBuilderStore } from '@/stores/promptBuilderStore'
import { useSDGenerate } from '@/composables/useSDGenerate'
import { EMOTION, SHOT, LIGHTING, COMPOSITION, COLOR_MOODS, SCENE_THEMES } from '@/config/promptConstants'
import type { Scene } from '@/stores/promptBuilderStore'

const router = useRouter()
const pb = usePromptBuilderStore()
const sd = useSDGenerate()

// ── UI state ──────────────────────────────────────────────────────────────
const sceneLimit = ref(20)
const sdSize = ref('832x1216')

// ── Static data ───────────────────────────────────────────────────────────
const storyChips = [
  '放学后在樱花树下等人的宁宁',
  '第一次在海边看日出的夏目',
  '夏夜祭典穿浴衣看烟花',
  '雪天围围巾的温柔一瞬',
]

const charOptions = [
  { id: 'nene',    label: '🌸 宁宁' },
  { id: 'natsume', label: '🍂 夏目' },
  { id: 'triad',   label: '🌸🍂 双人' },
]

// ── Derived ───────────────────────────────────────────────────────────────
const currentTraits = computed(() => {
  const charDef = pb.characters.find(c =>
    c.id.includes(pb.char) || (c.lora?.name ?? '').toLowerCase().includes(pb.char)
  )
  return charDef?.traits ?? []
})

const visibleScenes = computed(() => pb.filteredScenes.slice(0, sceneLimit.value))

const guideText = computed(() => {
  if (!pb.story && !pb.sceneId) return '写一个故事，或选一张场景卡'
  if (pb.sceneId) return `场景已选：${pb.activeScene?.title ?? ''}`
  return '故事已填写，现在选择导演决策'
})

// ── Prompt builder ─────────────────────────────────────────────────────────
const livePrompt = computed(() => {
  const parts: string[] = []

  // Character LoRA + base prompt
  if (pb.charPrompt) parts.push(pb.charPrompt)
  if (pb.loraLine) parts.push(pb.loraLine)

  // Scene prompt
  if (pb.activeScene?.prompt) parts.push(pb.activeScene.prompt)
  else if (pb.activeScene?.tags?.length) parts.push(pb.activeScene.tags.join(', '))

  // Manual tags
  if (pb.manualTags.size) parts.push([...pb.manualTags].join(', '))

  // Director choices
  if (pb.emotionPrompt) parts.push(pb.emotionPrompt)
  if (pb.selections.shot) {
    const s = SHOT.find(x => x.id === pb.selections.shot)
    if (s?.prompt) parts.push(s.prompt)
  }
  if (pb.selections.lighting) {
    const l = LIGHTING.find(x => x.id === pb.selections.lighting)
    if (l?.prompt) parts.push(l.prompt)
  }
  if (pb.selections.composition) {
    const c = COMPOSITION.find(x => x.id === pb.selections.composition)
    if (c?.prompt) parts.push(c.prompt)
  }
  if (pb.colorMood) {
    const m = COLOR_MOODS.find(x => x.id === pb.colorMood)
    if (m?.prompt) parts.push(m.prompt)
  }

  // Quality
  if (pb.sdParams.quality) parts.unshift('masterpiece, best quality, highres')

  return parts.filter(Boolean).join(', ')
})

// ── Actions ───────────────────────────────────────────────────────────────
function selectScene(scene: Scene) {
  pb.loadScene(scene)
  sceneLimit.value = 20
}

function onStoryInput() {
  // Clear scene context if user edits story away from scene's default
  if (pb.sceneId && pb.story !== pb.sceneBaseStory) {
    pb.clearScene({ keepStory: true })
  }
}

async function callGenerate() {
  if (!livePrompt.value) { pb.flash('请先选择场景或填写故事'); return }

  const [w, h] = sdSize.value.split('x').map(Number)
  await sd.generate({
    prompt: livePrompt.value,
    negative_prompt: pb.sdParams.negative
      ? 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands'
      : undefined,
    width: w || 832,
    height: h || 1216,
    cfg_scale: pb.sdParams.cfg,
    steps: pb.sdParams.steps,
    sampler_name: pb.sdParams.sampler,
    scheduler: pb.sdParams.scheduler || undefined,
    hr_fix: pb.sdParams.hiresFix,
    hr_scale: pb.sdParams.hiresScale,
    hr_upscaler: pb.sdParams.hiresUpscaler,
    seed: pb.sdParams.seedLock && pb.sdParams.seed >= 0 ? pb.sdParams.seed : -1,
    model: pb.sdModelName || undefined,
  })

  if (sd.resultSeed.value) pb.sdParams.seed = sd.resultSeed.value
}

async function copyPrompt() {
  try { await navigator.clipboard.writeText(livePrompt.value); pb.flash('Prompt 已复制') }
  catch { pb.flash('复制失败，请手动选取') }
}

function saveHistory() {
  // Simplified save: store basic entry in localStorage
  try {
    const key = 'aics_pb_history'
    const history = JSON.parse(localStorage.getItem(key) || '[]')
    history.unshift({
      id: Date.now(),
      timestamp: Date.now(),
      character: pb.char,
      scene: pb.sceneId,
      sceneTitle: pb.activeScene?.title ?? null,
      story: pb.story,
      prompt: livePrompt.value,
      image_url: sd.resultUrl.value || '',
      seed: sd.resultSeed.value,
    })
    localStorage.setItem(key, JSON.stringify(history.slice(0, 200)))
    pb.flash('快照已保存')
  } catch { pb.flash('保存失败') }
}

function saveResult() { saveHistory() }

function addTag(e: Event) {
  const input = e.target as HTMLInputElement
  const tag = input.value.trim().replace(/\s+/g, '_').toLowerCase()
  if (tag) { pb.toggleManualTag(tag); input.value = '' }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await pb.loadData()
  await sd.checkStatus()
  // Restore draft
  pb.restoreDraft?.()
})

// Autosave draft
watch([() => pb.story, () => pb.char, () => pb.sceneId, () => pb.selections], () => {
  pb.saveDraft?.()
}, { deep: true })
</script>
