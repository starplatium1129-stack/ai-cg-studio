<template>
  <Teleport to="body">
    <div v-if="open" class="batch-overlay" @click.self="emit('close')">
      <section class="batch-panel" role="dialog" aria-modal="true" aria-label="批量出图">
        <header class="batch-head">
          <div>
            <span class="batch-step">批量出图</span>
            <h2>多选场景，一次出齐</h2>
            <p>结果自动入册「历史」，在历史里挑合适的点「加入分镜」，攒齐后去分镜短片。</p>
          </div>
          <button class="btn btn-ghost" type="button" aria-label="关闭" @click="emit('close')">✕</button>
        </header>

        <template v-if="!running">
          <div class="batch-engine-row">
            <span class="field-label">引擎</span>
            <div class="video-segmented" role="group" aria-label="选择批量出图引擎">
              <button
                type="button"
                :class="{ active: engine === 'sd' }"
                :disabled="!sdAvailable"
                @click="emit('update:engine', 'sd')"
              >SD</button>
              <button
                type="button"
                :class="{ active: engine === 'anima' }"
                :disabled="!animaAvailable"
                @click="emit('update:engine', 'anima')"
              >Anima</button>
            </div>
            <span v-if="(engine === 'sd' && !sdAvailable) || (engine === 'anima' && !animaAvailable)" class="batch-hint">
              该引擎当前不可用
            </span>
          </div>

          <div class="batch-count-row">
            <span class="field-label">每场景张数</span>
            <div class="video-segmented" role="group" aria-label="每场景出几张">
              <button type="button" :class="{ active: count === 1 }" @click="count = 1">1 张</button>
              <button type="button" :class="{ active: count === 3 }" @click="count = 3">3 张候选</button>
            </div>
          </div>

          <div class="batch-scene-toolbar">
            <input v-model="filter" class="input" placeholder="过滤场景…" />
            <span class="batch-count-label">{{ selectedIds.size }} / {{ filtered.length }} 已选</span>
            <button class="btn btn-ghost btn-sm" type="button" @click="toggleAll">全选</button>
            <button class="btn btn-ghost btn-sm" type="button" @click="selectedIds.clear(); filter = ''">清空</button>
          </div>

          <div class="batch-scene-list">
            <label v-for="scene in filtered" :key="scene.id" class="batch-scene-item">
              <input v-model="selectedSet" type="checkbox" :value="scene.id" />
              <span class="batch-scene-copy">
                <strong>{{ scene.title }}</strong>
                <small>{{ sceneSummary(scene) }}</small>
              </span>
            </label>
            <p v-if="!filtered.length" class="batch-empty">没有可批量出图的场景（场景蓝图为空，或过滤无结果）。</p>
          </div>

          <footer class="batch-foot">
            <span class="batch-hint">共 {{ selectedIds.size * count }} 张 · 串行执行，可离开页面</span>
            <button class="btn btn-primary" type="button" :disabled="!selectedIds.size" @click="submit">
              开始批量出图
            </button>
          </footer>
        </template>

        <template v-else>
          <div class="batch-progress-head">
            <strong>正在逐张出图…</strong>
            <span class="batch-count-label">{{ progress.succeeded }} / {{ progress.total }} 张成功 · {{ progress.failed }} 失败</span>
          </div>
          <div class="video-progress"><i :style="{ width: progressPercent + '%' }"></i></div>
          <div class="batch-job-list">
            <div v-for="job in jobs" :key="job.id" class="batch-job" :data-state="job.status">
              <span class="batch-job-index">{{ jobStatusIcon(job.status) }}</span>
              <span class="batch-job-title">{{ job.sceneTitle }}<em v-if="job.variant > 0"> · 候选 {{ job.variant + 1 }}</em></span>
              <span class="batch-job-seed">{{ job.seed >= 0 ? 'seed ' + job.seed : '随机' }}</span>
              <span class="batch-job-status">{{ jobStatusLabel(job.status) }}</span>
            </div>
          </div>
          <footer class="batch-foot">
            <button class="btn btn-danger" type="button" @click="emit('cancel')">停止（当前张完成后停）</button>
          </footer>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { BatchDrawJob, BatchEngine } from '@/composables/useBatchDraw'
import type { SceneBlueprint } from '@/utils/popularContent'

const props = defineProps<{
  open: boolean
  scenes: SceneBlueprint[]
  engine: BatchEngine
  sdAvailable: boolean
  animaAvailable: boolean
  running: boolean
  jobs: ReadonlyArray<Readonly<BatchDrawJob>>
  progress: { total: number; done: number; succeeded: number; failed: number }
}>()

const emit = defineEmits<{
  close: []
  'update:engine': [engine: BatchEngine]
  start: [payload: { sceneIds: string[]; count: number }]
  cancel: []
}>()

const count = ref<1 | 3>(1)
const filter = ref('')
const selectedSet = reactive(new Set<string>())

const filtered = computed(() => {
  const keyword = filter.value.trim().toLowerCase()
  const list = keyword
    ? props.scenes.filter(scene => (scene.title || '').toLowerCase().includes(keyword))
    : props.scenes
  return list
})
const selectedIds = computed(() => selectedSet)

const progressPercent = computed(() => {
  if (!props.progress.total) return 0
  return Math.min(100, Math.round((props.progress.done / props.progress.total) * 100))
})

function sceneSummary(scene: SceneBlueprint): string {
  const prose = String(scene.promptProse || '')
  return prose.slice(0, 90) || [scene.description, scene.action, scene.lighting].filter(Boolean).join('，').slice(0, 90)
}

function toggleAll() {
  const all = filtered.value.map(scene => scene.id)
  const allSelected = all.every(id => selectedSet.has(id))
  all.forEach(id => { if (allSelected) selectedSet.delete(id); else selectedSet.add(id) })
}

function submit() {
  const sceneIds = filtered.value.map(scene => scene.id).filter(id => selectedSet.has(id))
  if (!sceneIds.length) return
  emit('start', { sceneIds, count: count.value })
}

function jobStatusIcon(status: BatchDrawJob['status']) {
  return ({ pending: '·', running: '⟳', succeeded: '✓', failed: '✕', cancelled: '–' })[status]
}
function jobStatusLabel(status: BatchDrawJob['status']) {
  return ({ pending: '等待', running: '生成中', succeeded: '已入册', failed: '失败', cancelled: '已停止' })[status]
}

watch(() => props.open, (open) => {
  if (open) { filter.value = ''; count.value = 1 }
})
</script>

<style scoped>
.batch-overlay {
  position: fixed; inset: 0; z-index: 60;
  display: grid; place-items: center;
  padding: clamp(12px, 3vw, 32px);
  background: color-mix(in srgb, var(--bg-deep) 55%, transparent);
  backdrop-filter: blur(4px);
}
.batch-panel {
  width: min(720px, 100%);
  max-height: min(86vh, 900px);
  display: grid; gap: var(--s-4);
  padding: clamp(16px, 2.4vw, 26px);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-xl);
  background: var(--bg-surface);
  box-shadow: var(--shadow-md);
  overflow: auto;
}
.batch-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-3); }
.batch-head h2 { margin: 2px 0 4px; font-size: var(--fs-title-sm); }
.batch-head p { margin: 0; color: var(--text-secondary); font-size: var(--fs-body-sm); line-height: 1.6; }
.batch-step { color: var(--accent); font: 700 var(--fs-mono-xs) var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }
.batch-engine-row, .batch-count-row { display: flex; align-items: center; gap: var(--s-3); }
.batch-hint { color: var(--text-muted); font-size: var(--fs-label-xs); }
.batch-scene-toolbar { display: flex; flex-wrap: wrap; gap: var(--s-2); align-items: center; }
.batch-scene-toolbar .input { flex: 1 1 180px; }
.batch-count-label { margin-left: auto; color: var(--text-secondary); font: 600 var(--fs-mono-xs) var(--font-mono); }
.batch-scene-list {
  display: grid; gap: var(--s-2);
  max-height: 38vh; overflow: auto;
  padding: var(--s-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: var(--bg-deep);
}
.batch-scene-item {
  display: flex; gap: var(--s-3); align-items: flex-start;
  padding: var(--s-2) var(--s-3);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background var(--motion-hover);
}
.batch-scene-item:hover { background: var(--bg-elevated); }
.batch-scene-item input { margin-top: 4px; accent-color: var(--accent); }
.batch-scene-copy { display: grid; gap: 2px; min-width: 0; }
.batch-scene-copy strong { font-size: var(--fs-body-sm); }
.batch-scene-copy small { color: var(--text-muted); font-size: var(--fs-label-xs); line-height: 1.45; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.batch-empty { margin: 0; padding: var(--s-3); color: var(--text-muted); font-size: var(--fs-body-sm); }
.batch-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s-3); }
.batch-progress-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--s-2); }
.batch-job-list { display: grid; gap: 2px; max-height: 40vh; overflow: auto; }
.batch-job {
  display: grid; grid-template-columns: 24px minmax(0, 1fr) auto auto; gap: var(--s-2);
  align-items: center;
  padding: 6px var(--s-2);
  border-radius: var(--r-sm);
  font-size: var(--fs-body-sm);
}
.batch-job[data-state="running"] { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.batch-job[data-state="succeeded"] { color: var(--text-secondary); }
.batch-job[data-state="failed"] { background: color-mix(in srgb, var(--danger) 8%, transparent); }
.batch-job-index { text-align: center; color: var(--accent); }
.batch-job[data-state="failed"] .batch-job-index { color: var(--danger-text); }
.batch-job-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.batch-job-title em { color: var(--text-muted); font-style: normal; }
.batch-job-seed { color: var(--text-muted); font: 600 var(--fs-mono-xs) var(--font-mono); }
.batch-job-status { font-size: var(--fs-label-xs); color: var(--text-muted); }
.batch-job[data-state="running"] .batch-job-status { color: var(--accent); }
.batch-job[data-state="failed"] .batch-job-status { color: var(--danger-text); }
</style>
