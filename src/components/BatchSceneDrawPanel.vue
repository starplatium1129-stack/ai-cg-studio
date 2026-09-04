<template>
  <Teleport to="body">
    <Transition name="layer-pop">
    <div v-if="open" class="batch-overlay" @click.self="emit('close')">
      <section class="batch-panel" role="dialog" aria-modal="true" aria-label="批量出图">
        <header class="batch-head">
          <div>
            <span class="batch-step">BATCH · {{ batchMode === 'scene' ? 'SCENES' : 'CHARACTERS' }}</span>
            <h2>批量出图 · {{ batchMode === 'scene' ? '多场景蓝图' : '多角色漫游' }}</h2>
            <p>{{ phase === 'config'
              ? (batchMode === 'scene'
                  ? '勾选场景一次出齐，成片直接在面板里预览挑选，全部自动入册历史。'
                  : '使用当前词条，一次性勾选多位角色批量出图，成片自动归入各角色画廊。')
              : '逐张串行生成，可离开页面；点缩略图看大图，失败项可单独重跑。' }}</p>
          </div>
          <button class="btn btn-ghost" type="button" aria-label="关闭" @click="emit('close')"><ArchiveIcon name="close" /></button>
        </header>

        <!-- ── 配置态 ── -->
        <template v-if="phase === 'config'">
          <div class="batch-config-row">
            <div class="batch-field">
              <span class="field-label">模式</span>
              <div class="batch-seg" role="group" aria-label="选择批量模式">
                <button type="button" :class="{ active: batchMode === 'scene' }" @click="batchMode = 'scene'">按场景蓝图</button>
                <button type="button" :class="{ active: batchMode === 'character' }" @click="batchMode = 'character'">按多角色漫游</button>
              </div>
            </div>
            <div class="batch-field">
              <span class="field-label">引擎</span>
              <div class="batch-seg" role="group" aria-label="选择批量出图引擎">
                <button type="button" :class="{ active: batchEngine === 'sd' }" :disabled="!sdAvailable"
                  :title="!sdAvailable ? 'SD WebUI 当前离线' : undefined"
                  @click="batchEngine = 'sd'">SD</button>
                <button type="button" :class="{ active: batchEngine === 'anima' }" :disabled="!animaAvailable"
                  :title="!animaAvailable ? 'ComfyUI 当前离线' : undefined"
                  @click="batchEngine = 'anima'">Anima</button>
              </div>
            </div>
            <div class="batch-field">
              <span class="field-label">每项张数</span>
              <div class="batch-seg" role="group" aria-label="每项出几张">
                <button type="button" :class="{ active: count === 1 }" @click="count = 1">1 张</button>
                <button type="button" :class="{ active: count === 3 }" @click="count = 3">3 张候选</button>
              </div>
            </div>
          </div>

          <!-- 场景蓝图选择视图 -->
          <template v-if="batchMode === 'scene'">
            <div class="batch-scene-toolbar">
              <input v-model="filter" class="input" type="search" placeholder="搜索场景标题 / 地点…" />
              <select v-model="categoryFilter" class="select" aria-label="按分类过滤">
                <option value="">全部分类</option>
                <option v-for="name in categories" :key="name" :value="name">{{ name }}</option>
              </select>
              <button class="btn btn-ghost btn-sm" type="button" @click="toggleAllScenes">{{ allFilteredScenesSelected ? '取消全选' : '全选' }}</button>
              <button class="btn btn-ghost btn-sm" type="button" @click="clearSceneSelection">清空</button>
            </div>

            <div class="batch-scene-grid">
              <button
                v-for="scene in filteredScenes"
                :key="scene.id"
                type="button"
                class="batch-scene-card"
                :class="{ selected: selectedSceneSet.has(scene.id) }"
                :aria-pressed="selectedSceneSet.has(scene.id)"
                @click="toggleScene(scene.id)"
              >
                <span class="batch-scene-check" aria-hidden="true"><ArchiveIcon name="success" /></span>
                <strong class="batch-scene-title">{{ scene.title }}</strong>
                <small class="batch-scene-meta">
                  {{ scene.category }}<template v-if="scene.location"> · {{ scene.location }}</template>
                  <ArchiveIcon v-if="scene.adult" name="lock" class="batch-scene-adult" title="成人场景" />
                </small>
              </button>
              <p v-if="!filteredScenes.length" class="batch-empty">
                没有匹配的场景{{ props.scenes.length ? '（换个关键词或分类试试）' : '（场景蓝图为空）' }}。
              </p>
            </div>
          </template>

          <!-- 多角色漫游选择视图 -->
          <template v-else>
            <!-- 实时提示词预览与说明 -->
            <div class="batch-prompt-preview-card">
              <div class="batch-prompt-preview-head">
                <span class="batch-prompt-preview-title">
                  <ArchiveIcon name="spark" /> 当前应用于各角色的提示词基底
                </span>
                <span class="batch-prompt-preview-badge">自动剔除原角色特征，动态注入选中角色 DNA</span>
              </div>
              <p class="batch-prompt-preview-text">
                {{ currentPromptPreview || '（当前提示词为空，请先在导演台输入故事、选择场景或添加标签）' }}
              </p>
            </div>

            <div class="batch-scene-toolbar">
              <input v-model="charFilter" class="input" type="search" placeholder="搜索角色名 / 原作…" />
              <select v-model="franchiseFilter" class="select" aria-label="按作品过滤">
                <option value="">全部作品</option>
                <option v-for="name in franchises" :key="name" :value="name">{{ name }}</option>
              </select>
              <button class="btn btn-ghost btn-sm" type="button" @click="toggleAllCharacters">{{ allFilteredCharsSelected ? '取消全选' : '全选' }}</button>
              <button class="btn btn-ghost btn-sm" type="button" @click="clearCharSelection">清空</button>
            </div>

            <div class="batch-char-grid">
              <button
                v-for="char in filteredCharacters"
                :key="char.id"
                type="button"
                class="batch-char-card"
                :class="{ selected: selectedCharSet.has(char.id) }"
                :aria-pressed="selectedCharSet.has(char.id)"
                @click="toggleChar(char.id)"
              >
                <div class="batch-char-avatar-wrap">
                  <img :src="char.avatarUrl" :alt="char.displayName" class="batch-char-avatar" loading="lazy" decoding="async" />
                  <span class="batch-char-check" aria-hidden="true"><ArchiveIcon name="success" /></span>
                </div>
                <div class="batch-char-info">
                  <strong class="batch-char-name">{{ char.displayName }}</strong>
                  <small class="batch-char-franchise">{{ char.franchise }}</small>
                </div>
              </button>
              <p v-if="!filteredCharacters.length" class="batch-empty">
                没有匹配的角色（换个关键词试试）。
              </p>
            </div>
          </template>

          <footer class="batch-foot">
            <span class="batch-hint">
              <template v-if="batchMode === 'scene'">
                已选 {{ selectedSceneCount }} 个场景 × {{ count }} 张 = {{ selectedSceneCount * count }} 张 · 串行执行
              </template>
              <template v-else>
                已选 {{ selectedCharCount }} 位角色 × {{ count }} 张 = {{ selectedCharCount * count }} 张 · 串行漫游
              </template>
            </span>
            <button
              class="btn btn-primary"
              type="button"
              :disabled="batchMode === 'scene' ? !selectedSceneCount : !selectedCharCount"
              @click="submit"
            >
              <ArchiveIcon name="spark" /> 开始批量出图
            </button>
          </footer>
        </template>

        <!-- ── 结果态（进行中与完成后统一，完成后不自动弹回配置）── -->
        <template v-else>
          <div class="batch-progress-head">
            <strong>{{ isRunning ? '正在逐张出图…' : '本批完成' }}</strong>
            <span class="batch-count-label">
              {{ progress.succeeded }} / {{ progress.total }} 张成功<template v-if="progress.failed"> · {{ progress.failed }} 失败</template>
            </span>
          </div>
          <div class="batch-progress"><i :style="{ '--progress': progressPercent + '%' }"></i></div>

          <div class="batch-result-grid">
            <figure v-for="job in jobs" :key="job.id" class="batch-card" :data-state="job.status">
              <button
                v-if="job.resultUrl"
                type="button"
                class="batch-thumb-btn"
                :aria-label="`查看大图：${job.sceneTitle}`"
                :title="`查看大图：${job.sceneTitle}`"
                @click="previewJob = job"
              >
                <img class="batch-thumb" :src="job.resultUrl" :alt="job.sceneTitle" loading="lazy" decoding="async" />
              </button>
              <div v-else class="batch-thumb batch-thumb-placeholder" :data-state="job.status">
                <ArchiveIcon :name="job.status === 'failed' ? 'warning' : 'spark'" />
                <span>{{ placeholderText(job) }}</span>
              </div>
              <figcaption class="batch-card-caption">
                <div class="batch-card-header-line">
                  <img v-if="job.avatarUrl" :src="job.avatarUrl" :alt="job.sceneTitle" class="batch-card-avatar" />
                  <span class="batch-card-title">{{ job.sceneTitle }}<em v-if="job.variant > 0"> · {{ job.variant + 1 }}</em></span>
                </div>
                <span class="batch-card-seed">{{ job.subtitle ? job.subtitle + ' · ' : '' }}{{ job.seed >= 0 ? 'seed ' + job.seed : '随机' }}</span>
              </figcaption>
            </figure>
          </div>

          <footer class="batch-foot">
            <template v-if="isRunning">
              <span class="batch-hint">可离开页面，任务在后台继续</span>
              <button class="btn btn-danger" type="button" @click="batchDraw.cancel">停止（当前张完成后停）</button>
            </template>
            <template v-else>
              <span class="batch-hint">全部成片已自动入册历史，可在历史里「加入分镜」攒片</span>
              <div class="batch-foot-actions">
                <button v-if="retryableCount" class="btn btn-ghost" type="button" @click="onRetryFailed">
                  <ArchiveIcon name="spark" /> 重跑失败 {{ retryableCount }} 张
                </button>
                <button class="btn btn-ghost" type="button" @click="resetToConfig">再来一批</button>
                <button class="btn btn-primary" type="button" @click="emit('close')">完成</button>
              </div>
            </template>
          </footer>
        </template>

        <!-- 大图预览 -->
        <Transition name="layer-fade">
        <div v-if="previewJob?.resultUrl" class="batch-lightbox" @click.self="previewJob = null">
          <img :src="previewJob.resultUrl" :alt="previewJob.sceneTitle" />
          <p class="batch-lightbox-caption">
            {{ previewJob.sceneTitle }}<em v-if="previewJob.variant > 0"> · 候选 {{ previewJob.variant + 1 }}</em>
            · {{ previewJob.seed >= 0 ? 'seed ' + previewJob.seed : '随机 seed' }}
          </p>
          <button class="btn btn-ghost btn-sm batch-lightbox-close" type="button" aria-label="关闭大图" @click="previewJob = null">
            <ArchiveIcon name="close" />
          </button>
        </div>
        </Transition>
      </section>
    </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { usePromptBatchRunners, type PromptBatchRunnersDeps } from '@/composables/prompt/usePromptBatchRunners'
import type { BatchDrawJob } from '@/composables/generation/useBatchDraw'
import type { SceneBlueprint } from '@/utils/popularContent'

/**
 * 批量出图面板（支持「多场景蓝图」与「多角色漫游」双模）。
 */
const props = defineProps<{
  open: boolean
  scenes: SceneBlueprint[]
  sdAvailable: boolean
  animaAvailable: boolean
  deps: PromptBatchRunnersDeps
}>()

const emit = defineEmits<{
  close: []
  'running-change': [running: boolean]
}>()

const batchMode = ref<'scene' | 'character'>('scene')
const count = ref<1 | 3>(1)
const phase = ref<'config' | 'results'>('config')
const previewJob = ref<BatchDrawJob | null>(null)

// ── 场景选择态 ──
const filter = ref('')
const categoryFilter = ref('')
const selectedSceneSet = reactive(new Set<string>())

// ── 角色选择态 ──
const charFilter = ref('')
const franchiseFilter = ref('')
const selectedCharSet = reactive(new Set<string>())

const { batchEngine, batchDraw, onBatchStart, onBatchStartCharacters, onRetryFailed } = usePromptBatchRunners(props.deps)

const currentPromptPreview = computed(() => {
  return props.deps.currentLivePrompt?.() || props.deps.currentBasePrompt?.() || props.deps.pb.story || props.deps.pb.visualDescription || ''
})

const isRunning = computed(() => batchDraw.running.value)
const jobs = computed(() => batchDraw.jobs.value)
const progress = computed(() => batchDraw.progress.value)
const retryableCount = computed(() =>
  jobs.value.filter(job => job.status === 'failed' || job.status === 'cancelled').length)
const progressPercent = computed(() => {
  if (!progress.value.total) return 0
  return Math.min(100, Math.round((progress.value.done / progress.value.total) * 100))
})

// ── 场景蓝图筛选 ──
const categories = computed(() =>
  [...new Set(props.scenes.map(scene => scene.category).filter(Boolean))].sort())
const filteredScenes = computed(() => {
  const keyword = filter.value.trim().toLowerCase()
  return props.scenes.filter(scene => {
    if (categoryFilter.value && scene.category !== categoryFilter.value) return false
    if (!keyword) return true
    return [scene.title, scene.location, scene.category]
      .some(text => String(text || '').toLowerCase().includes(keyword))
  })
})
const selectedSceneCount = computed(() => selectedSceneSet.size)
const allFilteredScenesSelected = computed(() =>
  filteredScenes.value.length > 0 && filteredScenes.value.every(scene => selectedSceneSet.has(scene.id)))

function toggleScene(id: string) {
  if (selectedSceneSet.has(id)) selectedSceneSet.delete(id)
  else selectedSceneSet.add(id)
}
function toggleAllScenes() {
  filteredScenes.value.forEach(scene => {
    if (allFilteredScenesSelected.value) selectedSceneSet.delete(scene.id)
    else selectedSceneSet.add(scene.id)
  })
}
function clearSceneSelection() {
  selectedSceneSet.clear()
  filter.value = ''
  categoryFilter.value = ''
}

// ── 多角色列表构建与筛选 ──
interface CharacterOption {
  id: string
  displayName: string
  franchise: string
  avatarUrl: string
}

const allCharacters = computed<CharacterOption[]>(() => {
  const populars = props.deps.popularCharacters?.() || props.deps.pb.popularCharacters || []
  const list: CharacterOption[] = [
    { id: 'nene', displayName: '绫地宁宁', franchise: '星光咖啡馆与死神之蝶', avatarUrl: '/assets/characters/thumbs/popular-nene.webp' },
    { id: 'natsume', displayName: '四季夏目', franchise: '星光咖啡馆与死神之蝶', avatarUrl: '/assets/characters/thumbs/popular-natsume.webp' },
  ]
  populars.forEach(pop => {
    if (pop.id !== 'nene' && pop.id !== 'natsume') {
      list.push({
        id: pop.id,
        displayName: pop.displayName,
        franchise: pop.franchise || '其他',
        avatarUrl: `/assets/characters/thumbs/popular-${pop.id}.webp`,
      })
    }
  })
  return list
})

const franchises = computed(() =>
  [...new Set(allCharacters.value.map(c => c.franchise).filter(Boolean))].sort())

const filteredCharacters = computed(() => {
  const keyword = charFilter.value.trim().toLowerCase()
  return allCharacters.value.filter(char => {
    if (franchiseFilter.value && char.franchise !== franchiseFilter.value) return false
    if (!keyword) return true
    return [char.displayName, char.franchise, char.id]
      .some(text => String(text || '').toLowerCase().includes(keyword))
  })
})
const selectedCharCount = computed(() => selectedCharSet.size)
const allFilteredCharsSelected = computed(() =>
  filteredCharacters.value.length > 0 && filteredCharacters.value.every(char => selectedCharSet.has(char.id)))

function toggleChar(id: string) {
  if (selectedCharSet.has(id)) selectedCharSet.delete(id)
  else selectedCharSet.add(id)
}
function toggleAllCharacters() {
  filteredCharacters.value.forEach(char => {
    if (allFilteredCharsSelected.value) selectedCharSet.delete(char.id)
    else selectedCharSet.add(char.id)
  })
}
function clearCharSelection() {
  selectedCharSet.clear()
  charFilter.value = ''
  franchiseFilter.value = ''
}

async function submit() {
  if (batchMode.value === 'scene') {
    const sceneIds = filteredScenes.value.map(s => s.id).filter(id => selectedSceneSet.has(id))
    if (!sceneIds.length) return
    await onBatchStart({ sceneIds, count: count.value })
  } else {
    const characterIds = filteredCharacters.value.map(c => c.id).filter(id => selectedCharSet.has(id))
    if (!characterIds.length) return
    await onBatchStartCharacters({ characterIds, count: count.value })
  }
  if (jobs.value.length) phase.value = 'results'
}

function resetToConfig() {
  batchDraw.reset()
  previewJob.value = null
  phase.value = 'config'
}

function placeholderText(job: BatchDrawJob): string {
  if (job.status === 'failed') return job.error || '生成失败'
  if (job.status === 'running') return '生成中…'
  if (job.status === 'pending') return '排队中'
  return '已入册'
}

watch(() => props.open, (open) => {
  if (open) {
    filter.value = ''
    categoryFilter.value = ''
    charFilter.value = ''
    franchiseFilter.value = ''
    count.value = 1
  }
})

watch(isRunning, running => emit('running-change', running), { immediate: true })
</script>

<style scoped>
.batch-overlay {
  position: fixed; inset: 0; z-index: var(--z-dock);
  display: grid; place-items: center;
  padding: clamp(12px, 3vw, 32px);
  background: color-mix(in srgb, var(--bg-deep) 55%, transparent);
  backdrop-filter: blur(4px);
}
.batch-panel {
  position: relative;
  width: min(920px, 100%);
  max-height: min(88vh, 940px);
  display: grid; gap: var(--s-4);
  padding: clamp(18px, 2.6vw, 28px);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-xl);
  background: var(--bg-surface);
  box-shadow: var(--shadow-md);
  overflow: auto;
}
.batch-panel::before {
  position: absolute; top: -1px; left: var(--s-5); width: 44px; height: 1px;
  background: linear-gradient(90deg, var(--archive-cyan), transparent); content: "";
}
.batch-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-3); }
.batch-head h2 { margin: 2px 0 4px; font-size: var(--fs-title-sm); }
.batch-head p { margin: 0; color: var(--text-secondary); font-size: var(--fs-body-sm); line-height: var(--lh-body); }
.batch-step { color: var(--accent); font: 700 var(--fs-mono-xs) var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }

/* ── 配置态 ── */
.batch-config-row { display: flex; flex-wrap: wrap; gap: var(--s-4) var(--s-6); }
.batch-field { display: grid; gap: var(--s-2); }
.batch-seg {
  display: inline-flex; padding: 3px;
  border: 1px solid var(--border-soft); border-radius: var(--r-md);
  background: var(--bg-deep);
}
.batch-seg button {
  min-height: 30px; padding: 0 var(--s-3);
  border: 0; border-radius: var(--r-sm);
  background: transparent; color: var(--text-muted);
  font-size: var(--fs-label-sm); cursor: pointer;
  transition: background var(--motion-hover), color var(--motion-hover);
}
.batch-seg button:disabled { color: var(--text-disabled); border-color: var(--border-soft); cursor: not-allowed; }
.batch-seg button.active { background: var(--accent); color: var(--text-inverse); }

.batch-scene-toolbar { display: flex; flex-wrap: wrap; gap: var(--s-2); align-items: center; }
.batch-scene-toolbar .input { flex: 1 1 200px; }
.batch-scene-toolbar .select { flex: 0 1 auto; max-width: 160px; }

.batch-scene-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2);
  max-height: 40vh; overflow: auto; padding: var(--s-2);
  border: 1px solid var(--border-soft); border-radius: var(--r-md);
  background: var(--bg-deep);
}
.batch-scene-card {
  display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto;
  column-gap: var(--s-2); align-items: center;
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--border-soft); border-radius: var(--r-md);
  background: var(--bg-surface); color: inherit; text-align: left; cursor: pointer;
  transition: border-color var(--motion-hover), background var(--motion-hover);
}
.batch-scene-card:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border-soft)); }
.batch-scene-card.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 9%, var(--bg-surface));
}
.batch-scene-check {
  grid-row: 1 / span 2;
  display: grid; place-items: center;
  width: 22px; height: 22px;
  border: 1px solid var(--border-strong); border-radius: 50%;
  color: transparent;
  transition: border-color var(--motion-hover), background var(--motion-hover), color var(--motion-hover);
}
.batch-scene-card.selected .batch-scene-check {
  border-color: var(--accent); background: var(--accent); color: var(--text-inverse);
}
.batch-scene-check .archive-icon { width: 12px; }
.batch-scene-title {
  min-width: 0; font-size: var(--fs-body-sm);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.batch-scene-meta {
  display: flex; align-items: center; gap: 4px;
  color: var(--text-muted); font-size: var(--fs-label-xs);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.batch-scene-adult { flex: 0 0 auto; width: 12px; color: var(--accent); opacity: .8; }

/* ── 角色卡网格 ── */
.batch-char-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: var(--s-2);
  max-height: 40vh; overflow: auto; padding: var(--s-2);
  border: 1px solid var(--border-soft); border-radius: var(--r-md);
  background: var(--bg-deep);
}
.batch-char-card {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--s-2);
  padding: var(--s-3) var(--s-2);
  border: 1px solid var(--border-soft); border-radius: var(--r-md);
  background: var(--bg-surface); color: inherit; cursor: pointer;
  transition: border-color var(--motion-hover), background var(--motion-hover), transform var(--motion-press);
}
.batch-char-card:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border-soft)); }
.batch-char-card.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-surface));
}
.batch-char-avatar-wrap {
  position: relative; width: 56px; height: 56px;
  border-radius: var(--r-pill); overflow: hidden;
  border: 1px solid var(--border-soft); background: var(--bg-deep);
}
.batch-char-avatar { width: 100%; height: 100%; object-fit: cover; }
.batch-char-check {
  position: absolute; right: 0; bottom: 0;
  display: grid; place-items: center;
  width: 20px; height: 20px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface); color: transparent;
  transition: background var(--motion-hover), color var(--motion-hover), border-color var(--motion-hover);
}
.batch-char-card.selected .batch-char-check {
  border-color: var(--accent); background: var(--accent); color: var(--text-inverse);
}
.batch-char-check .archive-icon { width: 11px; }
.batch-char-info { display: grid; gap: 2px; width: 100%; }
.batch-char-name {
  font-size: var(--fs-label-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.batch-char-franchise {
  font-size: var(--fs-label-xs); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.batch-empty { grid-column: 1 / -1; margin: 0; padding: var(--s-4); color: var(--text-muted); font-size: var(--fs-body-sm); }

/* ── 提示词基底卡片 ── */
.batch-prompt-preview-card {
  display: grid; gap: var(--s-1);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--border-soft); border-radius: var(--r-md);
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-deep));
}
.batch-prompt-preview-head {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s-2);
}
.batch-prompt-preview-title {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--fs-label-sm); font-weight: 600; color: var(--accent);
}
.batch-prompt-preview-title .archive-icon { width: 14px; }
.batch-prompt-preview-badge {
  font-size: var(--fs-label-xs); color: var(--text-muted);
}
.batch-prompt-preview-text {
  margin: 0; font-size: var(--fs-label-xs); line-height: 1.4; color: var(--text-secondary);
  max-height: 4.2em; overflow-y: auto; word-break: break-all;
}

/* ── 结果态 ── */
.batch-progress-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--s-2); }
.batch-count-label { color: var(--text-muted); font: 600 var(--fs-mono-xs) var(--font-mono); }
.batch-progress { height: 3px; overflow: hidden; border-radius: var(--r-pill); background: var(--bg-deep); }
.batch-progress i {
  display: block; height: 100%; width: 100%; transform-origin: left;
  background: linear-gradient(90deg, var(--archive-cyan), var(--accent));
  transform: scaleX(var(--progress, 0%));
  transition: transform var(--motion-surface) var(--ease-out);
}
.batch-result-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--s-3);
  max-height: 44vh; overflow: auto; padding: var(--s-1);
}
.batch-card { display: grid; gap: var(--s-1); margin: 0; }
.batch-thumb-btn {
  padding: 0; border: 1px solid var(--border-soft); border-radius: var(--r-md);
  background: var(--bg-deep); cursor: zoom-in; overflow: hidden;
  transition: border-color var(--motion-hover), transform var(--motion-press) var(--ease-out);
}
.batch-thumb-btn:hover { border-color: var(--accent); }
.batch-thumb-btn:active { transform: scale(.98); }
.batch-thumb { display: block; width: 100%; height: auto; object-fit: contain; }
.batch-thumb-placeholder {
  display: grid; place-content: center; justify-items: center; gap: var(--s-2);
  aspect-ratio: 3 / 4;
  border: 1px dashed var(--border-soft); border-radius: var(--r-md);
  background: var(--bg-deep); color: var(--text-muted);
  font-size: var(--fs-label-xs); text-align: center; padding: var(--s-2);
  overflow: hidden;
}
.batch-thumb-placeholder .archive-icon { width: 20px; opacity: .7; }
.batch-thumb-placeholder[data-state="running"] { border-style: solid; border-color: color-mix(in srgb, var(--accent) 40%, var(--border-soft)); color: var(--accent); }
.batch-thumb-placeholder[data-state="running"] .archive-icon { animation: batchPulse 1.4s ease-in-out infinite; }
.batch-thumb-placeholder[data-state="failed"] { border-color: color-mix(in srgb, var(--danger) 40%, var(--border-soft)); color: var(--danger-text); }
@keyframes batchPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.88); } }
@media (prefers-reduced-motion: reduce) { .batch-thumb-placeholder[data-state="running"] .archive-icon { animation:none; } }

.batch-card-caption { display: grid; gap: 1px; min-width: 0; }
.batch-card-header-line { display: flex; align-items: center; gap: 6px; min-width: 0; }
.batch-card-avatar { width: 16px; height: 16px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
.batch-card-title { font-size: var(--fs-label-sm); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.batch-card-title em { color: var(--text-muted); font-style: normal; }
.batch-card[data-state="failed"] .batch-card-title { color: var(--danger-text); }
.batch-card-seed { color: var(--text-muted); font: 600 var(--fs-mono-xs) var(--font-mono); font-size: var(--fs-label-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.batch-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s-3); }
.batch-foot-actions { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.batch-hint { color: var(--text-muted); font-size: var(--fs-label-xs); }

/* 大图预览 */
.batch-lightbox {
  position: sticky; bottom: 0;
  display: grid; justify-items: center; gap: var(--s-2);
  padding: var(--s-4);
  border: 1px solid var(--border-soft); border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--bg-deep) 85%, transparent);
  backdrop-filter: blur(6px);
}
.batch-lightbox img {
  max-width: 100%; max-height: 58vh;
  border-radius: var(--r-md); border: 1px solid var(--border-soft);
  object-fit: contain; background: var(--bg-deep);
}
.batch-lightbox-caption { margin: 0; color: var(--text-secondary); font-size: var(--fs-label-sm); }
.batch-lightbox-caption em { color: var(--text-muted); font-style: normal; }
.batch-lightbox-close { position: absolute; top: var(--s-3); right: var(--s-3); }

@media (max-width: 768px) {
  .batch-scene-grid { grid-template-columns: 1fr; }
  .batch-result-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
}
</style>
