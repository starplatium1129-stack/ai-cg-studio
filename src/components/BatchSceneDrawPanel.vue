<template>
  <Teleport to="body">
    <Transition name="layer-pop">
    <div v-if="open" class="batch-overlay" @click.self="emit('close')">
      <section class="batch-panel" role="dialog" aria-modal="true" aria-label="批量出图">
        <header class="batch-head">
          <div>
            <span class="batch-step">BATCH · SCENES</span>
            <h2>批量出图 · 多场景</h2>
            <p>{{ phase === 'config'
              ? '勾选场景一次出齐，成片直接在面板里预览挑选，全部自动入册历史。'
              : '逐张串行生成，可离开页面；点缩略图看大图，失败项可单独重跑。' }}</p>
          </div>
          <button class="btn btn-ghost" type="button" aria-label="关闭" @click="emit('close')"><ArchiveIcon name="close" /></button>
        </header>

        <!-- ── 配置态 ── -->
        <template v-if="phase === 'config'">
          <div class="batch-config-row">
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
              <span class="field-label">每场景张数</span>
              <div class="batch-seg" role="group" aria-label="每场景出几张">
                <button type="button" :class="{ active: count === 1 }" @click="count = 1">1 张</button>
                <button type="button" :class="{ active: count === 3 }" @click="count = 3">3 张候选</button>
              </div>
            </div>
          </div>

          <div class="batch-scene-toolbar">
            <input v-model="filter" class="input" type="search" placeholder="搜索标题 / 地点…" />
            <select v-model="categoryFilter" class="select" aria-label="按分类过滤">
              <option value="">全部分类</option>
              <option v-for="name in categories" :key="name" :value="name">{{ name }}</option>
            </select>
            <button class="btn btn-ghost btn-sm" type="button" @click="toggleAll">{{ allFilteredSelected ? '取消全选' : '全选' }}</button>
            <button class="btn btn-ghost btn-sm" type="button" @click="clearSelection">清空</button>
          </div>

          <div class="batch-scene-grid">
            <button
              v-for="scene in filtered"
              :key="scene.id"
              type="button"
              class="batch-scene-card"
              :class="{ selected: selectedSet.has(scene.id) }"
              :aria-pressed="selectedSet.has(scene.id)"
              @click="toggleScene(scene.id)"
            >
              <span class="batch-scene-check" aria-hidden="true"><ArchiveIcon name="success" /></span>
              <strong class="batch-scene-title">{{ scene.title }}</strong>
              <small class="batch-scene-meta">
                {{ scene.category }}<template v-if="scene.location"> · {{ scene.location }}</template>
                <ArchiveIcon v-if="scene.adult" name="lock" class="batch-scene-adult" title="成人场景" />
              </small>
            </button>
            <p v-if="!filtered.length" class="batch-empty">
              没有匹配的场景{{ props.scenes.length ? '（换个关键词或分类试试）' : '（场景蓝图为空）' }}。
            </p>
          </div>

          <footer class="batch-foot">
            <span class="batch-hint">已选 {{ selectedCount }} 个场景 × {{ count }} 张 = {{ selectedCount * count }} 张 · 串行执行</span>
            <button class="btn btn-primary" type="button" :disabled="!selectedCount" @click="submit">
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
                <span class="batch-card-title">{{ job.sceneTitle }}<em v-if="job.variant > 0"> · 候选 {{ job.variant + 1 }}</em></span>
                <span class="batch-card-seed">{{ job.seed >= 0 ? 'seed ' + job.seed : '随机' }}</span>
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
 * 多场景批量出图面板（2026-08-22 重设计）。
 *
 * 本面板持有批量执行编排（usePromptBatchRunners → useBatchDraw），宿主只注入
 * 依赖快照与开关状态：跑批期间关闭弹窗任务照常后台执行（组件实例常驻）。
 * 两态流转：配置态（场景卡选择器：搜索/分类/全选）→ 结果态（缩略图网格 +
 * 大图预览 + 失败单独重跑），完成后停留在结果态，不自动弹回配置。
 */
const props = defineProps<{
  open: boolean
  scenes: SceneBlueprint[]
  sdAvailable: boolean
  animaAvailable: boolean
  /** 宿主的执行依赖快照（PromptBuilderView 组装，ref/函数引用稳定）。 */
  deps: PromptBatchRunnersDeps
}>()

const emit = defineEmits<{
  close: []
  'running-change': [running: boolean]
}>()

const count = ref<1 | 3>(1)
const filter = ref('')
const categoryFilter = ref('')
const selectedSet = reactive(new Set<string>())
const phase = ref<'config' | 'results'>('config')
const previewJob = ref<BatchDrawJob | null>(null)

const { batchEngine, batchDraw, onBatchStart, onRetryFailed } = usePromptBatchRunners(props.deps)

const isRunning = computed(() => batchDraw.running.value)
const jobs = computed(() => batchDraw.jobs.value)
const progress = computed(() => batchDraw.progress.value)
const retryableCount = computed(() =>
  jobs.value.filter(job => job.status === 'failed' || job.status === 'cancelled').length)
const progressPercent = computed(() => {
  if (!progress.value.total) return 0
  return Math.min(100, Math.round((progress.value.done / progress.value.total) * 100))
})

const categories = computed(() =>
  [...new Set(props.scenes.map(scene => scene.category).filter(Boolean))].sort())
const filtered = computed(() => {
  const keyword = filter.value.trim().toLowerCase()
  return props.scenes.filter(scene => {
    if (categoryFilter.value && scene.category !== categoryFilter.value) return false
    if (!keyword) return true
    return [scene.title, scene.location, scene.category]
      .some(text => String(text || '').toLowerCase().includes(keyword))
  })
})
const selectedCount = computed(() => selectedSet.size)
const allFilteredSelected = computed(() =>
  filtered.value.length > 0 && filtered.value.every(scene => selectedSet.has(scene.id)))

function toggleScene(id: string) {
  if (selectedSet.has(id)) selectedSet.delete(id)
  else selectedSet.add(id)
}

function toggleAll() {
  filtered.value.forEach(scene => {
    if (allFilteredSelected.value) selectedSet.delete(scene.id)
    else selectedSet.add(scene.id)
  })
}

function clearSelection() {
  selectedSet.clear()
  filter.value = ''
  categoryFilter.value = ''
}

async function submit() {
  const sceneIds = filtered.value.map(scene => scene.id).filter(id => selectedSet.has(id))
  if (!sceneIds.length) return
  await onBatchStart({ sceneIds, count: count.value })
  // 场景描述全空的极端情况不会开跑（runner 内 flash 提示），此时留在配置态。
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
  if (open) { filter.value = ''; categoryFilter.value = ''; count.value = 1 }
})

// 入口按钮的禁用态与角标跟随（关闭弹窗后台跑批时宿主仍能感知）。
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
  width: min(880px, 100%);
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
/* 旧版直接借用未定义的 video-segmented，引擎/张数切换一直是裸按钮堆（2026-08-22 修复） */
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
/* 审计修复: 不用 opacity 压字 */
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
.batch-empty { grid-column: 1 / -1; margin: 0; padding: var(--s-4); color: var(--text-muted); font-size: var(--fs-body-sm); }

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
/* 缩略图跟随成片原生比例（整批同尺寸自然对齐；横版批次不被 3/4 裁切） */
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
.batch-card-title { font-size: var(--fs-label-sm); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.batch-card-title em { color: var(--text-muted); font-style: normal; }
.batch-card[data-state="failed"] .batch-card-title { color: var(--danger-text); }
.batch-card-seed { color: var(--text-muted); font: 600 var(--fs-mono-xs) var(--font-mono); }

.batch-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s-3); }
.batch-foot-actions { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.batch-hint { color: var(--text-muted); font-size: var(--fs-label-xs); }

/* 大图预览（面板内嵌，不脱离弹窗上下文） */
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
