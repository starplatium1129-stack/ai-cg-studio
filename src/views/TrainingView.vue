<template>
  <article class="page training-page">
    <WorkspaceArchiveBar
      chapter="11"
      title="TRAINING WORKBENCH"
      :subtitle="activeKind === 'voice' ? 'VOICE MODEL PIPELINE' : 'CHARACTER LORA PIPELINE'"
      :status="activeJob ? statusLabel(activeJob.status).toUpperCase() : (workspaceReady ? 'WORKSPACE READY' : 'WORKSPACE OFFLINE')"
      :state="activeJob && isActive(activeJob) ? 'active' : (workspaceReady ? 'success' : 'warning')"
      :shape="activeKind === 'voice' ? 'cup' : 'frame'"
    />
    <header class="training-hero">
      <div>
        <div class="page-kicker">Character training workbench</div>
        <h1 class="title">角色训练台</h1>
        <p class="subtitle">
          把宁宁与夏目的 LoRA、角色语音、数据集检查和训练日志放在同一处。
          所有任务只在这台电脑上运行，一次只启动一个训练进程。
        </p>
      </div>
      <div class="hero-status" :data-ready="workspaceReady ? 'true' : 'false'">
        <span class="hero-status-dot" aria-hidden="true"></span>
        <div>
          <strong>{{ workspaceReady ? '本地训练区已连接' : '等待本地训练区' }}</strong>
          <small>{{ readyCount }}/4 个任务可启动</small>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          :disabled="loading"
          @click="refreshOverview"
        >
          刷新状态
        </button>
      </div>
    </header>

    <div v-if="error" class="training-alert" role="alert">
      <div>
        <strong>训练台没有完成刚才的操作</strong>
        <p>{{ error }}</p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" @click="clearError">知道了</button>
    </div>

    <div v-if="loading && !overview" class="loading-card" aria-live="polite">
      <span class="loading-orbit" aria-hidden="true"></span>
      <div>
        <strong>正在读取训练资产</strong>
        <p>检查 v16 数据集、OneTrainer、GPT-SoVITS 与训练清单…</p>
      </div>
    </div>

    <div v-else class="workbench">
      <aside class="workbench-rail" aria-label="训练类型">
        <div class="rail-heading">
          <span>训练流程</span>
          <strong>{{ activeJob ? '运行中' : '待命' }}</strong>
        </div>
        <div
          class="kind-tabs"
          role="tablist"
          aria-label="选择训练类型"
          @keydown="kindTabs.onKeydown"
        >
          <button
            v-for="kind in kinds"
            :id="kindTabs.tabId(kind.id)"
            :key="kind.id"
            type="button"
            role="tab"
            class="kind-tab"
            :class="{ active: activeKind === kind.id }"
            :aria-selected="activeKind === kind.id"
            :aria-controls="kindTabs.panelId(kind.id)"
            :tabindex="kindTabs.tabIndex(kind.id)"
            @click="setKind(kind.id)"
          >
            <span class="kind-index">{{ kind.index }}</span>
            <span>
              <strong>{{ kind.label }}</strong>
              <small>{{ kind.note }}</small>
            </span>
          </button>
        </div>

        <div class="rail-summary">
          <div>
            <span>数据集</span>
            <strong>{{ datasets.length }}</strong>
          </div>
          <div>
            <span>已就绪</span>
            <strong>{{ readyCount }}</strong>
          </div>
          <div>
            <span>活动任务</span>
            <strong>{{ activeJob ? '1' : '0' }}</strong>
          </div>
        </div>

        <div class="local-note">
          <span aria-hidden="true">⌁</span>
          <p><strong>仅限本机</strong>训练接口拒绝局域网和公网请求，也不接受浏览器传入文件路径或启动参数。</p>
        </div>
      </aside>

      <div class="workbench-main">
        <section
          v-if="activeKind === 'lora'"
          :id="kindTabs.panelId('lora')"
          role="tabpanel"
          :aria-labelledby="kindTabs.tabId('lora')"
          class="training-panel"
        >
          <section class="plan-card" aria-labelledby="v16-plan-title">
            <div class="plan-copy">
              <div class="panel-kicker">V16 primary plan</div>
              <h2 id="v16-plan-title">服装与脸型优先的 LoRA 方案</h2>
              <p>
                以身份锚点、经典服装和互动样本分层训练；文本编码器冻结，成人样本保持纳入，
                但降低互动与成人组权重，避免把姿势或另一角色写进身份。
              </p>
            </div>
            <div class="plan-specs" aria-label="v16 主要训练参数">
              <div v-for="spec in loraSpecs" :key="spec.label">
                <span>{{ spec.label }}</span>
                <strong>{{ spec.value }}</strong>
              </div>
            </div>
            <div class="plan-gates">
              <span>固定种子验证</span>
              <span>身份 / 服装分榜</span>
              <span>保留集不参与训练</span>
              <span>不盲选最后一轮</span>
            </div>
          </section>

          <div class="job-grid">
            <section
              v-for="job in visibleJobs"
              :key="job.id"
              class="job-card"
              :class="[`job-${job.character}`, `status-${job.status}`]"
              :aria-labelledby="`${job.id}-title`"
            >
              <header class="job-head">
                <div class="character-mark" aria-hidden="true">
                  {{ job.character === 'nene' ? '宁' : '夏' }}
                </div>
                <div class="job-title">
                  <div class="job-eyebrow">{{ characterName(job.character) }} · LoRA v16</div>
                  <h3 :id="`${job.id}-title`">{{ job.label }}</h3>
                </div>
                <span class="badge" :class="statusBadge(job.status)">
                  {{ statusLabel(job.status) }}
                </span>
              </header>

              <div class="identity-block">
                <span class="field-name">身份锚点</span>
                <div class="token-list">
                  <span v-for="item in planFor(job.character).identity" :key="item">{{ item }}</span>
                </div>
              </div>

              <div class="outfit-focus">
                <div>
                  <span>经典服装重点</span>
                  <strong>{{ planFor(job.character).outfit.label }}</strong>
                </div>
                <code>{{ planFor(job.character).outfit.token }}</code>
              </div>

              <figure
                v-if="datasetFor(job)?.preview.available"
                class="dataset-preview"
              >
                <a
                  :href="datasetPreviewUrl(datasetFor(job))"
                  target="_blank"
                  rel="noopener"
                  :aria-label="`打开${datasetFor(job)?.preview.label}`"
                >
                  <img
                    :src="datasetPreviewUrl(datasetFor(job))"
                    :alt="datasetFor(job)?.preview.label"
                    :class="{ blurred: datasetFor(job)?.preview.blurred }"
                    loading="lazy"
                    decoding="async"
                  >
                  <span>打开审核表</span>
                </a>
                <figcaption>
                  <strong>经典服装可视审核</strong>
                  <small>{{ datasetFor(job)?.preview.label }} · 训练样本接触表，不是生成结果</small>
                </figcaption>
              </figure>

              <div v-if="datasetFor(job)" class="dataset-stats">
                <div>
                  <strong>{{ datasetFor(job)?.images ?? 0 }}</strong>
                  <span>图片</span>
                </div>
                <div>
                  <strong>{{ datasetFor(job)?.captions ?? 0 }}</strong>
                  <span>标注</span>
                </div>
                <div>
                  <strong>{{ formatBytes(datasetFor(job)?.bytes ?? 0) }}</strong>
                  <span>体积</span>
                </div>
                <div>
                  <strong>{{ datasetFor(job)?.categories.validation ?? 0 }}</strong>
                  <span>保留验证</span>
                </div>
              </div>

              <div v-if="datasetFor(job)" class="category-section">
                <span class="field-name">样本分层</span>
                <div class="category-list">
                  <span
                    v-for="category in categoryEntries(datasetFor(job)?.categories ?? {})"
                    :key="category[0]"
                    :class="{ adult: isAdultCategory(category[0]) }"
                  >
                    {{ categoryLabel(category[0]) }}
                    <b>{{ category[1] }}</b>
                  </span>
                </div>
              </div>

              <div class="adult-strip">
                <div class="adult-preview" aria-hidden="true">
                  <img
                    v-if="datasetFor(job)?.adultPreview.available"
                    :src="adultPreviewUrl(datasetFor(job))"
                    alt=""
                    :class="{ blurred: datasetFor(job)?.adultPreview.blurred }"
                    loading="lazy"
                    decoding="async"
                  >
                  <template v-else>
                    <i></i><i></i><i></i>
                  </template>
                </div>
                <div>
                  <span>R18 样本 · 默认纳入</span>
                  <strong>{{ adultCount(datasetFor(job)?.categories ?? {}) }} 张分层素材</strong>
                  <small>成人样本已纳入训练；缩略图始终使用预先模糊的审核表。</small>
                </div>
              </div>

              <div v-if="!job.ready" class="missing-note" role="status">
                <strong>启动前还缺少</strong>
                <span>{{ job.missing.join('；') || '训练依赖未就绪' }}</span>
              </div>

              <div class="progress-block">
                <div class="progress-copy">
                  <span>{{ job.progress.stage || '待开始' }}</span>
                  <strong>{{ formatPercent(job.progress.percent) }}</strong>
                </div>
                <progress
                  class="meter meter-lg"
                  role="progressbar"
                  :aria-label="`${job.label}训练进度`"
                  :value="job.progress.percent"
                  max="100"
                >
                  {{ formatPercent(job.progress.percent) }}
                </progress>
                <div class="progress-meta">
                  <span v-if="job.progress.epochs">
                    Epoch {{ job.progress.epoch ?? 0 }}/{{ job.progress.epochs }}
                  </span>
                  <span v-if="job.progress.steps">
                    Step {{ job.progress.step ?? 0 }}/{{ job.progress.steps }}
                  </span>
                  <span v-if="job.progress.loss !== undefined">
                    Loss {{ formatLoss(job.progress.loss) }}
                  </span>
                  <span v-if="!job.progress.epochs && !job.progress.steps">
                    {{ job.configName || '等待训练配置' }}
                  </span>
                </div>
                <p
                  v-if="job.error && (job.status === 'failed' || job.status === 'stopped')"
                  class="job-error"
                  role="alert"
                >
                  {{ job.error }}
                </p>
              </div>

              <footer class="job-actions">
                <button
                  type="button"
                  class="btn btn-ghost"
                  :class="{ selected: selectedJobId === job.id }"
                  @click="openLogs(job.id)"
                >
                  查看日志
                </button>
                <button
                  v-if="isActive(job)"
                  type="button"
                  class="btn btn-danger"
                  :disabled="actionJobId !== null || job.status === 'stopping'"
                  :data-loading="actionJobId === job.id || undefined"
                  @click="stop(job.id)"
                >
                  {{ job.status === 'stopping' ? '正在停止' : '停止训练' }}
                </button>
                <button
                  v-else
                  type="button"
                  class="btn btn-primary"
                  :disabled="!canStart(job)"
                  :data-loading="actionJobId === job.id || undefined"
                  @click="start(job.id)"
                >
                  {{ job.status === 'completed' ? '再次训练' : '开始训练' }}
                </button>
              </footer>
            </section>
          </div>
        </section>

        <section
          v-else
          :id="kindTabs.panelId('voice')"
          role="tabpanel"
          :aria-labelledby="kindTabs.tabId('voice')"
          class="training-panel"
        >
          <section class="voice-pipeline" aria-labelledby="voice-plan-title">
            <div>
              <div class="panel-kicker">GPT-SoVITS pipeline</div>
              <h2 id="voice-plan-title">角色语音训练</h2>
              <p>训练清单与评测集分开；完成后结合字错率、音色相似度和人工试听选模型，不默认采用最后一轮。</p>
            </div>
            <ol>
              <li><span>01</span><strong>音频清洗</strong><small>切分、响度与文本对齐</small></li>
              <li><span>02</span><strong>SoVITS</strong><small>音色与说话人特征</small></li>
              <li><span>03</span><strong>GPT</strong><small>语义与韵律建模</small></li>
              <li><span>04</span><strong>保留集评测</strong><small>客观指标 + 人工试听</small></li>
            </ol>
          </section>

          <div class="job-grid voice-jobs">
            <section
              v-for="job in visibleJobs"
              :key="job.id"
              class="job-card voice-job"
              :class="[`job-${job.character}`, `status-${job.status}`]"
              :aria-labelledby="`${job.id}-title`"
            >
              <header class="job-head">
                <div class="character-mark voice-mark" aria-hidden="true">
                  {{ job.character === 'nene' ? '宁' : '夏' }}
                </div>
                <div class="job-title">
                  <div class="job-eyebrow">{{ characterName(job.character) }} · Voice</div>
                  <h3 :id="`${job.id}-title`">{{ job.label }}</h3>
                </div>
                <span class="badge" :class="statusBadge(job.status)">
                  {{ statusLabel(job.status) }}
                </span>
              </header>

              <div v-if="datasetFor(job)" class="voice-stats">
                <div>
                  <span>WAV 片段</span>
                  <strong>{{ datasetFor(job)?.wavs ?? 0 }}</strong>
                </div>
                <div>
                  <span>训练清单</span>
                  <strong>{{ datasetFor(job)?.trainSamples ?? 0 }}</strong>
                </div>
                <div>
                  <span>独立评测</span>
                  <strong>{{ datasetFor(job)?.evalSamples ?? 0 }}</strong>
                </div>
                <div>
                  <span>封闭测试</span>
                  <strong>{{ datasetFor(job)?.testSamples ?? 0 }}</strong>
                </div>
              </div>

              <div class="voice-split">
                <progress
                  class="split-track"
                  :value="trainSplitPercent(datasetFor(job))"
                  max="100"
                  :aria-label="`${trainSplitPercent(datasetFor(job))}% 音频用于训练`"
                >
                  {{ trainSplitPercent(datasetFor(job)) }}%
                </progress>
                <div>
                  <span>训练集</span>
                  <span>留出 + 封闭测试</span>
                </div>
                <small>留出与封闭测试音频都不会参与权重更新；封闭测试用于上线前 A/B</small>
              </div>

              <div v-if="!job.ready" class="missing-note" role="status">
                <strong>启动前还缺少</strong>
                <span>{{ job.missing.join('；') || '训练依赖未就绪' }}</span>
              </div>

              <div class="progress-block">
                <div class="progress-copy">
                  <span>{{ job.progress.stage || '待开始' }}</span>
                  <strong>{{ formatPercent(job.progress.percent) }}</strong>
                </div>
                <progress
                  class="meter meter-lg"
                  role="progressbar"
                  :aria-label="`${job.label}训练进度`"
                  :value="job.progress.percent"
                  max="100"
                >
                  {{ formatPercent(job.progress.percent) }}
                </progress>
                <p class="voice-progress-message">
                  {{ job.progress.message || `${datasetFor(job)?.version ?? '语音数据'} 已等待训练` }}
                </p>
                <p
                  v-if="job.error && (job.status === 'failed' || job.status === 'stopped')"
                  class="job-error"
                  role="alert"
                >
                  {{ job.error }}
                </p>
              </div>

              <footer class="job-actions">
                <button
                  type="button"
                  class="btn btn-ghost"
                  :class="{ selected: selectedJobId === job.id }"
                  @click="openLogs(job.id)"
                >
                  查看日志
                </button>
                <button
                  v-if="isActive(job)"
                  type="button"
                  class="btn btn-danger"
                  :disabled="actionJobId !== null || job.status === 'stopping'"
                  :data-loading="actionJobId === job.id || undefined"
                  @click="stop(job.id)"
                >
                  {{ job.status === 'stopping' ? '正在停止' : '停止训练' }}
                </button>
                <button
                  v-else
                  type="button"
                  class="btn btn-primary"
                  :disabled="!canStart(job)"
                  :data-loading="actionJobId === job.id || undefined"
                  @click="start(job.id)"
                >
                  {{ job.status === 'completed' ? '再次训练' : '开始训练' }}
                </button>
              </footer>
            </section>
          </div>
        </section>

        <section class="log-console" aria-labelledby="training-log-title">
          <header>
            <div>
              <div class="panel-kicker">Live process output</div>
              <h2 id="training-log-title">训练日志</h2>
            </div>
            <div class="console-tools">
              <label for="training-log-job">任务</label>
              <select
                id="training-log-job"
                class="select"
                :value="selectedJobId"
                @change="selectFromEvent"
              >
                <option v-for="job in jobs" :key="job.id" :value="job.id">
                  {{ job.label }}
                </option>
              </select>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="selectedLogs.loading"
                @click="loadLogs(selectedJobId)"
              >
                刷新
              </button>
            </div>
          </header>

          <div class="console-status">
            <span class="badge" :class="statusBadge(selectedJob?.status ?? 'idle')">
              {{ statusLabel(selectedJob?.status ?? 'idle') }}
            </span>
            <span v-if="selectedJob?.pid">PID {{ selectedJob.pid }}</span>
            <span v-if="selectedJob?.startedAt">开始于 {{ formatDate(selectedJob.startedAt) }}</span>
            <span v-if="selectedJob?.runCount">第 {{ selectedJob.runCount }} 次运行</span>
          </div>

          <pre
            ref="logElement"
            class="console-output"
            tabindex="0"
            aria-live="off"
            @scroll="trackLogScroll"
          ><code>{{ selectedLogs.text || logPlaceholder }}</code></pre>
          <p v-if="selectedLogs.error" class="console-error" role="status">{{ selectedLogs.error }}</p>
          <p class="console-note">
            日志使用增量读取并在本机保留；页面只展示最近一段，训练进程不会因关闭页面而停止。
          </p>
        </section>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useRovingTabs } from '@/composables/useRovingTabs'
import { useTrainingStore } from '@/stores/trainingStore'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import type {
  TrainingCharacter,
  TrainingDataset,
  TrainingJob,
  TrainingJobId,
  TrainingJobStatus,
  TrainingKind,
  TrainingPlan,
} from '@/types/training'

const route = useRoute()
const router = useRouter()
const store = useTrainingStore()
const { clearError, loadLogs, refresh, start, stop } = store
const {
  overview,
  loading,
  error,
  actionJobId,
  selectedJobId,
  selectedJob,
  selectedLogs,
  jobs,
  datasets,
  activeJob,
  readyCount,
} = storeToRefs(store)

const kinds: Array<{ id: TrainingKind; index: string; label: string; note: string }> = [
  { id: 'lora', index: '01', label: '角色 LoRA', note: '脸型、特征与经典服装' },
  { id: 'voice', index: '02', label: '角色语音', note: 'GPT-SoVITS 训练与评测' },
]

const plans: Record<TrainingCharacter, TrainingPlan> = {
  nene: {
    character: 'nene',
    identity: ['银白超长发', '低双马尾', '紫瞳与呆毛', '粉色发带'],
    outfit: { label: '宁宁经典魔女服', token: 'official_witch_outfit' },
    epochs: 80,
  },
  natsume: {
    character: 'natsume',
    identity: ['黑色长发', '金黄色眼睛', '眼下痣', '侧边发夹'],
    outfit: { label: '夏目经典旗袍服', token: 'natsume_official_qipao' },
    epochs: 70,
  },
}

const loraSpecs = [
  { label: '底模', value: 'WAI Illustrious SDXL v170' },
  { label: '分辨率', value: '1024 + Buckets' },
  { label: 'LoRA', value: 'Rank 32 / Alpha 32' },
  { label: 'UNet 学习率', value: '4e-5' },
  { label: '有效批量', value: '1 × 累积 4' },
  { label: '精度', value: 'BF16' },
  { label: 'Warmup', value: '5%' },
  { label: '损失权重', value: 'Min-SNR 5' },
]

const categoryNames: Record<string, string> = {
  identity: '身份锚点',
  identity_anchors: '身份锚点',
  official: '官方素材',
  official_cg: '官方 CG',
  reference: '参考立绘',
  curated: '精选 CG',
  outfit_witch: '魔女服',
  outfit_qipao: '旗袍服',
  outfit_school: '校服',
  interaction: '互动样本',
  adult_solo: '成人单人',
  adult_interaction: '成人互动',
  validation: '验证保留',
}

const statusNames: Record<TrainingJobStatus, string> = {
  idle: '待开始',
  running: '训练中',
  stopping: '停止中',
  completed: '已完成',
  failed: '失败',
  stopped: '已停止',
}

const activeKind = ref<TrainingKind>(route.query.kind === 'voice' ? 'voice' : 'lora')
const logElement = ref<HTMLElement | null>(null)
const mounted = ref(false)
const stickToBottom = ref(true)
let pollTimer: number | null = null
let kindChangeToken = 0

const kindTabs = useRovingTabs(
  () => kinds.map((kind) => kind.id),
  activeKind,
  (id) => { void setKind(id as TrainingKind) },
  { prefix: 'training-kind' },
)

const visibleJobs = computed(() => jobs.value.filter((job) => job.kind === activeKind.value))
const workspaceReady = computed(() => overview.value?.workspace.available === true)
const logPlaceholder = computed(() => {
  if (selectedLogs.value.loading) return '正在读取训练日志…'
  if (!selectedJob.value) return '请选择一个训练任务。'
  if (!selectedJob.value.ready) return `任务尚未就绪：${selectedJob.value.missing.join('；')}`
  return '还没有运行日志。点击“开始训练”后，进度与输出会在这里更新。'
})

function characterName(character: TrainingCharacter): string {
  return character === 'nene' ? '绫地宁宁' : '四季夏目'
}

function planFor(character: TrainingCharacter): TrainingPlan {
  return plans[character]
}

function datasetFor(job: TrainingJob): TrainingDataset | null {
  return store.datasetFor(job)
}

function categoryEntries(categories: Record<string, number>): Array<[string, number]> {
  const order = Object.keys(categoryNames)
  return Object.entries(categories).sort(([a], [b]) => {
    const aIndex = order.indexOf(a)
    const bIndex = order.indexOf(b)
    return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex)
  })
}

function categoryLabel(category: string): string {
  return categoryNames[category] ?? category.replaceAll('_', ' ')
}

function isAdultCategory(category: string): boolean {
  return category.includes('adult')
}

function adultCount(categories: Record<string, number>): number {
  return Object.entries(categories)
    .filter(([category]) => isAdultCategory(category))
    .reduce((total, [, count]) => total + count, 0)
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`
}

function datasetPreviewUrl(dataset: TrainingDataset | null): string {
  return dataset ? `/api/training/datasets/${encodeURIComponent(dataset.id)}/preview` : ''
}

function adultPreviewUrl(dataset: TrainingDataset | null): string {
  return dataset ? `/api/training/datasets/${encodeURIComponent(dataset.id)}/adult-preview` : ''
}

function formatPercent(percent: number): string {
  const safe = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
  return `${safe.toFixed(safe % 1 === 0 ? 0 : 1)}%`
}

function formatLoss(loss: number): string {
  return Number.isFinite(loss) ? loss.toFixed(4) : '—'
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

function trainSplitPercent(dataset: TrainingDataset | null): number {
  const train = dataset?.trainSamples ?? 0
  const evaluation = dataset?.evalSamples ?? 0
  const test = dataset?.testSamples ?? 0
  const total = train + evaluation + test
  return total ? Math.round((train / total) * 100) : 0
}

function statusLabel(status: TrainingJobStatus): string {
  return statusNames[status]
}

function statusBadge(status: TrainingJobStatus): string {
  if (status === 'running') return 'badge-warning'
  if (status === 'completed') return 'badge-success'
  if (status === 'failed') return 'badge-danger'
  if (status === 'stopping' || status === 'stopped') return 'badge-info'
  return ''
}

function isActive(job: TrainingJob): boolean {
  return job.status === 'running' || job.status === 'stopping'
}

function canStart(job: TrainingJob): boolean {
  return job.ready
    && actionJobId.value === null
    && activeJob.value === null
    && !isActive(job)
}

async function setKind(kind: TrainingKind, syncRoute = true): Promise<void> {
  const requestToken = ++kindChangeToken
  activeKind.value = kind
  if (syncRoute && route.query.kind !== kind) {
    try {
      await router.replace({ query: { ...route.query, kind } })
    } catch {
      // A newer tab selection or browser navigation may supersede this update.
    }
    if (requestToken !== kindChangeToken) return
  }
  const firstJob = jobs.value.find((job) => job.kind === kind)
  if (firstJob) {
    store.selectJob(firstJob.id)
    await store.loadLogs(firstJob.id)
  }
}

async function openLogs(id: TrainingJobId): Promise<void> {
  store.selectJob(id)
  stickToBottom.value = true
  await store.loadLogs(id)
  await nextTick()
  logElement.value?.focus({ preventScroll: true })
  logElement.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function selectFromEvent(event: Event): void {
  const id = (event.target as HTMLSelectElement).value as TrainingJobId
  store.selectJob(id)
  void store.loadLogs(id)
}

async function poll(): Promise<void> {
  if (!mounted.value) return
  if (!activeJob.value || !isActive(activeJob.value)) return
  await store.refresh(true)
  if (!mounted.value) return
  if (!activeJob.value || !isActive(activeJob.value)) return
  await store.loadLogs(selectedJobId.value)
}

function stopPolling(): void {
  if (pollTimer !== null) window.clearInterval(pollTimer)
  pollTimer = null
}

function syncPolling(): void {
  if (!mounted.value || !activeJob.value || !isActive(activeJob.value)) {
    stopPolling()
    return
  }
  if (pollTimer === null) {
    pollTimer = window.setInterval(() => { void poll() }, 3000)
  }
}

async function refreshOverview(): Promise<void> {
  await refresh()
  if (!mounted.value) return
  await loadLogs(selectedJobId.value)
  syncPolling()
}

function trackLogScroll(): void {
  const element = logElement.value
  if (!element) return
  stickToBottom.value =
    element.scrollHeight - element.scrollTop - element.clientHeight < 32
}

watch(
  () => selectedLogs.value.text,
  async () => {
    if (!stickToBottom.value) return
    await nextTick()
    if (logElement.value) logElement.value.scrollTop = logElement.value.scrollHeight
  },
)

watch(
  () => route.query.kind,
  (value) => {
    const nextKind: TrainingKind = value === 'voice' ? 'voice' : 'lora'
    if (nextKind === activeKind.value) return
    void setKind(nextKind, false)
  },
)

watch(
  () => activeJob.value?.status,
  () => syncPolling(),
  { immediate: true },
)

async function initialize(): Promise<void> {
  await store.refresh()
  if (!mounted.value) return
  const initial = jobs.value.find((job) => job.kind === activeKind.value)
  if (activeJob.value) {
    activeKind.value = activeJob.value.kind
    if (route.query.kind !== activeJob.value.kind) {
      try {
        await router.replace({ query: { ...route.query, kind: activeJob.value.kind } })
      } catch {
        // Keep the loaded workbench usable if navigation is superseded.
      }
      if (!mounted.value) return
    }
    store.selectJob(activeJob.value.id)
  } else if (initial) {
    store.selectJob(initial.id)
  }
  await store.loadLogs(selectedJobId.value)
  if (!mounted.value) return
  syncPolling()
}

onMounted(() => {
  mounted.value = true
  void initialize()
})

onUnmounted(() => {
  mounted.value = false
  stopPolling()
})
</script>

<style scoped>
.training-page {
  --page-max: 1240px;
  overflow: clip;
}

.training-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--s-5);
  margin-bottom: var(--s-5);
}

.training-hero .subtitle { margin-bottom: 0; }

.hero-status {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-width: 210px;
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-xl);
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
}

.hero-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--warning) 13%, transparent);
}

.hero-status[data-ready="true"] .hero-status-dot {
  background: var(--success);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--success) 13%, transparent);
}

.hero-status strong,
.hero-status small { display: block; }
.hero-status strong { color: var(--text-primary); font-size: var(--fs-label); }
.hero-status small { margin-top: 3px; color: var(--text-muted); font-size: var(--fs-mono-sm); }
.hero-status > .btn { margin-left: auto; flex: 0 0 auto; white-space: nowrap; }

.training-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  margin-bottom: var(--s-4);
  padding: var(--s-3) var(--s-4);
  border: 1px solid color-mix(in srgb, var(--danger) 38%, var(--border-soft));
  border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--danger) 9%, var(--bg-surface));
}
.training-alert strong { color: var(--danger-text); }
.training-alert p { margin: 4px 0 0; color: var(--text-secondary); font-size: var(--fs-label-sm); }

.loading-card {
  display: flex;
  align-items: center;
  gap: var(--s-4);
  min-height: 220px;
  padding: var(--s-6);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-2xl);
  background: var(--bg-surface);
}
.loading-card strong { display: block; color: var(--text-primary); font-size: var(--fs-title-xs); }
.loading-card p { margin: var(--s-1) 0 0; color: var(--text-muted); }
.loading-orbit {
  width: 34px; height: 34px; flex: none;
  border: 2px solid var(--border-strong); border-top-color: var(--accent);
  border-radius: 50%; animation: spin .7s linear infinite;
}

.workbench {
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  align-items: start;
  gap: var(--s-5);
}

.workbench-rail {
  position: sticky;
  top: calc(var(--nav-h, 60px) + var(--s-4));
  min-width: 0;
  padding: var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-2xl);
  background: color-mix(in srgb, var(--bg-surface) 91%, transparent);
  box-shadow: var(--shadow-sm);
}

.rail-heading {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--s-2); padding: var(--s-2) var(--s-2) var(--s-3);
}
.rail-heading span { color: var(--text-muted); font: 650 var(--fs-mono-xs) var(--font-mono); letter-spacing: .1em; text-transform: uppercase; }
.rail-heading strong { color: var(--success-text); font-size: var(--fs-label-xs); }

.kind-tabs { display: grid; gap: var(--s-2); }
.kind-tab {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: start;
  gap: var(--s-2);
  width: 100%;
  padding: var(--s-3);
  border: 1px solid transparent;
  border-radius: var(--r-xl);
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
}
.kind-tab:hover { background: var(--bg-hover); color: var(--text-primary); }
.kind-tab.active {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border-soft));
  background: var(--accent-soft);
  color: var(--text-primary);
}
.kind-index {
  color: var(--accent); font: 700 var(--fs-mono-sm) var(--font-mono);
}
.kind-tab strong,
.kind-tab small { display: block; }
.kind-tab strong { font-size: var(--fs-label); }
.kind-tab small { margin-top: 4px; color: var(--text-muted); font-size: var(--fs-mono-xs); line-height: 1.45; }

.rail-summary {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px; margin: var(--s-4) 0;
  overflow: hidden; border: 1px solid var(--border-soft); border-radius: var(--r-lg);
  background: var(--border-soft);
}
.rail-summary div { min-width: 0; padding: var(--s-2) 4px; background: var(--bg-deep); text-align: center; }
.rail-summary span,
.rail-summary strong { display: block; }
.rail-summary span { color: var(--text-muted); font-size: var(--fs-mono-xs); }
.rail-summary strong { margin-top: 3px; color: var(--text-primary); font-size: var(--fs-body-sm); }

.local-note {
  display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--s-2);
  padding: var(--s-3); border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--info) 7%, var(--bg-deep));
}
.local-note > span { color: var(--info-text); font-size: var(--fs-title-xs); }
.local-note p { margin: 0; color: var(--text-muted); font-size: var(--fs-mono-xs); line-height: 1.55; }
.local-note strong { display: block; margin-bottom: 2px; color: var(--text-secondary); }

.workbench-main { min-width: 0; }
.training-panel { min-width: 0; }

.plan-card,
.voice-pipeline,
.log-console {
  padding: clamp(18px, 2.4vw, 26px);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-2xl);
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
  box-shadow: var(--shadow-sm);
}

.plan-card {
  display: grid;
  grid-template-columns: minmax(230px, .8fr) minmax(420px, 1.2fr);
  gap: var(--s-4) var(--s-5);
  margin-bottom: var(--s-4);
}
.panel-kicker {
  margin-bottom: var(--s-1); color: var(--accent);
  font: 700 var(--fs-mono-xs) var(--font-mono); letter-spacing: .12em; text-transform: uppercase;
}
.plan-card h2,
.voice-pipeline h2,
.log-console h2 {
  margin: 0; color: var(--text-primary); font-size: var(--fs-title-sm);
}
.plan-copy p,
.voice-pipeline p {
  margin: var(--s-2) 0 0; color: var(--text-secondary); font-size: var(--fs-label-sm); line-height: 1.7;
}
.plan-specs {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2);
}
.plan-specs div {
  min-width: 0; padding: var(--s-2) var(--s-3);
  border: 1px solid var(--border-soft); border-radius: var(--r-lg); background: var(--bg-deep);
}
.plan-specs span,
.plan-specs strong { display: block; }
.plan-specs span { color: var(--text-muted); font-size: var(--fs-mono-xs); }
.plan-specs strong { margin-top: 3px; color: var(--text-primary); font-size: var(--fs-label-sm); overflow-wrap: anywhere; }
.plan-gates {
  grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--s-2);
  padding-top: var(--s-3); border-top: 1px solid var(--border-soft);
}
.plan-gates span {
  padding: 4px var(--s-2); border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  color: var(--success-text); font-size: var(--fs-mono-xs);
}

.job-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start; gap: var(--s-4);
}
.job-card {
  min-width: 0; overflow: hidden; padding: var(--s-4);
  border: 1px solid var(--border-soft); border-radius: var(--r-2xl);
  background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
  box-shadow: var(--shadow-sm);
}
.job-card.status-running { border-color: color-mix(in srgb, var(--warning) 48%, var(--border-soft)); }
.job-card.status-completed { border-color: color-mix(in srgb, var(--success) 42%, var(--border-soft)); }
.job-card.status-failed { border-color: color-mix(in srgb, var(--danger) 48%, var(--border-soft)); }

.job-head {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center; gap: var(--s-3); margin-bottom: var(--s-4);
}
.character-mark {
  display: grid; place-items: center; width: 42px; height: 42px;
  border: 1px solid color-mix(in srgb, var(--nene-violet) 42%, var(--border-soft));
  border-radius: var(--r-lg); color: var(--nene-violet);
  background: color-mix(in srgb, var(--nene-violet) 12%, var(--bg-deep));
  font: 750 var(--fs-title-xs) var(--font-display);
}
.job-natsume .character-mark {
  border-color: color-mix(in srgb, var(--natsume-amber) 42%, var(--border-soft));
  color: var(--natsume-amber);
  background: color-mix(in srgb, var(--natsume-amber) 11%, var(--bg-deep));
}
.job-title { min-width: 0; }
.job-eyebrow { color: var(--text-muted); font-size: var(--fs-mono-xs); }
.job-title h3 {
  margin: 3px 0 0; color: var(--text-primary); font-size: var(--fs-title-xs); overflow-wrap: anywhere;
}

.field-name {
  display: block; margin-bottom: var(--s-2); color: var(--text-muted);
  font: 650 var(--fs-mono-xs) var(--font-mono); letter-spacing: .07em;
}
.identity-block { margin-bottom: var(--s-3); }
.token-list,
.category-list { display: flex; flex-wrap: wrap; gap: 6px; }
.token-list span,
.category-list span {
  padding: 4px 8px; border: 1px solid var(--border-soft);
  border-radius: var(--r-pill); background: var(--bg-deep);
  color: var(--text-secondary); font-size: var(--fs-mono-xs);
}
.category-list b { margin-left: 4px; color: var(--text-primary); }
.category-list .adult {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-soft));
  color: var(--accent);
}

.outfit-focus {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-3);
  margin-bottom: var(--s-3); padding: var(--s-3);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border-soft));
  border-radius: var(--r-lg); background: var(--accent-soft);
}
.outfit-focus span,
.outfit-focus strong { display: block; }
.outfit-focus span { color: var(--text-muted); font-size: var(--fs-mono-xs); }
.outfit-focus strong { margin-top: 3px; color: var(--text-primary); font-size: var(--fs-label); }
.outfit-focus code {
  max-width: 48%; color: var(--accent); font-size: var(--fs-mono-xs);
  overflow-wrap: anywhere; text-align: right;
}

.dataset-preview {
  margin: 0 0 var(--s-3);
  overflow: hidden;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  background: var(--bg-deep);
}
.dataset-preview a {
  position: relative;
  display: block;
  aspect-ratio: 16 / 7;
  overflow: hidden;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-elevated);
}
.dataset-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--t-base) var(--ease-out);
}
.dataset-preview a:hover img { transform: scale(1.025); }
.dataset-preview img.blurred { filter: blur(16px); transform: scale(1.08); }
.dataset-preview a > span {
  position: absolute;
  right: var(--s-2);
  bottom: var(--s-2);
  padding: 4px 8px;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--bg-deep) 84%, transparent);
  color: var(--text-primary);
  font-size: var(--fs-mono-xs);
}
.dataset-preview figcaption {
  display: grid;
  gap: 3px;
  padding: var(--s-2) var(--s-3);
}
.dataset-preview figcaption strong { color: var(--text-primary); font-size: var(--fs-label-sm); }
.dataset-preview figcaption small { color: var(--text-muted); font-size: var(--fs-mono-xs); line-height: 1.45; }

.dataset-stats {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: var(--s-3); overflow: hidden;
  border: 1px solid var(--border-soft); border-radius: var(--r-lg);
}
.dataset-stats div { min-width: 0; padding: var(--s-2); background: var(--bg-deep); text-align: center; }
.dataset-stats div + div { border-left: 1px solid var(--border-soft); }
.dataset-stats strong,
.dataset-stats span { display: block; }
.dataset-stats strong { color: var(--text-primary); font-size: var(--fs-label); overflow-wrap: anywhere; }
.dataset-stats span { margin-top: 2px; color: var(--text-muted); font-size: var(--fs-mono-xs); }
.category-section { margin-bottom: var(--s-3); }

.adult-strip {
  display: grid; grid-template-columns: 104px minmax(0, 1fr);
  gap: var(--s-3); align-items: center; margin-bottom: var(--s-3); padding: var(--s-2);
  border: 1px solid var(--border-soft); border-radius: var(--r-lg); background: var(--bg-deep);
}
.adult-preview {
  position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px;
  height: 62px; overflow: hidden; border-radius: var(--r-md);
}
.adult-preview img { width: 100%; height: 100%; object-fit: cover; filter: blur(5px); transform: scale(1.04); }
.adult-preview::after {
  content: ''; position: absolute; inset: 0;
  background: color-mix(in srgb, var(--bg-deep) 25%, transparent);
}
.adult-preview i:nth-child(1) { background: linear-gradient(145deg, var(--nene-violet), var(--bg-elevated)); }
.adult-preview i:nth-child(2) { background: linear-gradient(35deg, var(--accent), var(--bg-hover)); }
.adult-preview i:nth-child(3) { background: linear-gradient(145deg, var(--natsume-amber), var(--bg-elevated)); }
.adult-strip span,
.adult-strip strong,
.adult-strip small { display: block; }
.adult-strip span { color: var(--accent); font-size: var(--fs-mono-xs); }
.adult-strip strong { margin-top: 3px; color: var(--text-primary); font-size: var(--fs-label-sm); }
.adult-strip small { margin-top: 3px; color: var(--text-muted); font-size: var(--fs-mono-xs); line-height: 1.4; }

.missing-note {
  display: grid; gap: 3px; margin-bottom: var(--s-3); padding: var(--s-3);
  border-radius: var(--r-lg); background: color-mix(in srgb, var(--warning) 9%, var(--bg-deep));
}
.missing-note strong { color: var(--warning-text); font-size: var(--fs-label-sm); }
.missing-note span { color: var(--text-secondary); font-size: var(--fs-mono-xs); line-height: 1.5; }

.progress-block {
  margin-top: auto; padding-top: var(--s-3); border-top: 1px solid var(--border-soft);
}
.progress-copy { display: flex; justify-content: space-between; gap: var(--s-3); margin-bottom: var(--s-2); }
.progress-copy span { color: var(--text-secondary); font-size: var(--fs-label-sm); }
.progress-copy strong { color: var(--text-primary); font: 700 var(--fs-mono-sm) var(--font-mono); }
.progress-meta {
  display: flex; flex-wrap: wrap; gap: var(--s-2); min-height: 22px; padding-top: var(--s-2);
  color: var(--text-muted); font-size: var(--fs-mono-xs);
}
.progress-meta span + span::before { content: '·'; margin-right: var(--s-2); }
.job-error {
  margin: var(--s-2) 0 0;
  color: var(--danger-text);
  font-size: var(--fs-mono-xs);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.meter {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  appearance: none;
  -webkit-appearance: none;
}
.meter::-webkit-progress-bar {
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--text-muted) 18%, transparent);
}
.meter::-webkit-progress-value {
  border-radius: var(--r-pill);
  background: linear-gradient(90deg, var(--accent), var(--accent-violet));
  transition: width var(--t-base) var(--ease-out);
}
.meter::-moz-progress-bar {
  border-radius: var(--r-pill);
  background: linear-gradient(90deg, var(--accent), var(--accent-violet));
  transition: width var(--t-base) var(--ease-out);
}

.job-actions {
  display: flex; justify-content: flex-end; gap: var(--s-2);
  margin-top: var(--s-3);
}
.job-actions .btn:first-child { margin-right: auto; }
.job-actions .btn.selected { border-color: var(--accent); color: var(--accent); }

.voice-pipeline {
  display: grid; grid-template-columns: minmax(220px, .72fr) minmax(480px, 1.28fr);
  gap: var(--s-5); margin-bottom: var(--s-4);
}
.voice-pipeline ol {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--s-2); margin: 0; padding: 0; list-style: none;
}
.voice-pipeline li {
  min-width: 0; padding: var(--s-3); border: 1px solid var(--border-soft);
  border-radius: var(--r-lg); background: var(--bg-deep);
}
.voice-pipeline li span,
.voice-pipeline li strong,
.voice-pipeline li small { display: block; }
.voice-pipeline li span { color: var(--accent); font: 700 var(--fs-mono-xs) var(--font-mono); }
.voice-pipeline li strong { margin-top: var(--s-2); color: var(--text-primary); font-size: var(--fs-label-sm); }
.voice-pipeline li small { margin-top: 3px; color: var(--text-muted); font-size: var(--fs-mono-xs); line-height: 1.4; }

.voice-job { display: flex; flex-direction: column; }
.voice-mark { border-radius: 50%; }
.voice-stats {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--s-2); margin-bottom: var(--s-4);
}
.voice-stats div {
  min-width: 0; padding: var(--s-3); border: 1px solid var(--border-soft);
  border-radius: var(--r-lg); background: var(--bg-deep);
}
.voice-stats span,
.voice-stats strong { display: block; }
.voice-stats span { color: var(--text-muted); font-size: var(--fs-mono-xs); }
.voice-stats strong { margin-top: 5px; color: var(--text-primary); font-size: var(--fs-title-xs); }
.voice-split { margin-bottom: var(--s-4); }
.split-track {
  display: block;
  width: 100%;
  height: 10px;
  padding: 0;
  border: 0;
  appearance: none;
  -webkit-appearance: none;
}
.split-track::-webkit-progress-bar {
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--info) 38%, var(--bg-deep));
}
.split-track::-webkit-progress-value {
  border-radius: var(--r-pill);
  background: linear-gradient(90deg, var(--accent), var(--accent-violet));
}
.split-track::-moz-progress-bar {
  border-radius: var(--r-pill);
  background: linear-gradient(90deg, var(--accent), var(--accent-violet));
}
.voice-split > div:nth-child(2) {
  display: flex; justify-content: space-between; margin-top: 6px;
  color: var(--text-secondary); font-size: var(--fs-mono-xs);
}
.voice-split small { display: block; margin-top: var(--s-2); color: var(--text-muted); font-size: var(--fs-mono-xs); }
.voice-progress-message {
  min-height: 38px; margin: var(--s-2) 0 0; color: var(--text-muted);
  font-size: var(--fs-mono-xs); line-height: 1.5; overflow-wrap: anywhere;
}

.log-console { margin-top: var(--s-4); }
.log-console > header {
  display: flex; align-items: flex-end; justify-content: space-between; gap: var(--s-4);
  margin-bottom: var(--s-3);
}
.console-tools { display: flex; align-items: center; gap: var(--s-2); }
.console-tools label { color: var(--text-muted); font-size: var(--fs-mono-xs); }
.console-tools .select { width: min(230px, 42vw); min-height: 34px; font-size: var(--fs-label-sm); }
.console-status {
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-3);
  margin-bottom: var(--s-2); color: var(--text-muted); font-size: var(--fs-mono-xs);
}
.console-output {
  min-height: 180px; max-height: 360px; margin: 0; overflow: auto;
  padding: var(--s-4); border: 1px solid var(--border-soft); border-radius: var(--r-lg);
  background: var(--bg-deep); color: var(--text-secondary);
  font: 400 var(--fs-mono-sm) / 1.65 var(--font-mono);
  white-space: pre-wrap; overflow-wrap: anywhere;
}
.console-output:focus { outline: none; border-color: var(--accent); box-shadow: var(--ring); }
.console-error { margin: var(--s-2) 0 0; color: var(--danger-text); font-size: var(--fs-label-sm); }
.console-note { margin: var(--s-2) 0 0; color: var(--text-muted); font-size: var(--fs-mono-xs); line-height: 1.5; }

@media (max-width: 1040px) {
  .workbench { grid-template-columns: 190px minmax(0, 1fr); gap: var(--s-3); }
  .plan-card, .voice-pipeline { grid-template-columns: 1fr; }
  .voice-pipeline ol { grid-template-columns: repeat(4, minmax(110px, 1fr)); overflow-x: auto; padding-bottom: 3px; }
  .job-grid { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .training-page { padding-inline: var(--s-3); }
  .training-hero { grid-template-columns: 1fr; }
  .hero-status { min-width: 0; }
  .workbench { display: block; }
  .workbench-rail {
    position: static; margin-bottom: var(--s-3); padding: var(--s-2);
  }
  .rail-heading, .rail-summary, .local-note { display: none; }
  .kind-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kind-tab { grid-template-columns: auto minmax(0, 1fr); padding: var(--s-2) var(--s-3); }
  .plan-specs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .voice-pipeline ol {
    grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible;
  }
  .log-console > header { align-items: flex-start; flex-direction: column; }
  .console-tools { width: 100%; }
  .console-tools .select { width: auto; min-width: 0; flex: 1; }
}

@media (max-width: 520px) {
  .training-alert { align-items: flex-start; flex-direction: column; }
  .plan-card, .voice-pipeline, .log-console, .job-card { padding: var(--s-3); }
  .plan-specs { grid-template-columns: 1fr; }
  .job-head { grid-template-columns: auto minmax(0, 1fr); }
  .job-head .badge { grid-column: 1 / -1; justify-self: start; }
  .outfit-focus { align-items: flex-start; flex-direction: column; }
  .outfit-focus code { max-width: 100%; text-align: left; }
  .dataset-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dataset-stats div:nth-child(3) { border-left: 0; border-top: 1px solid var(--border-soft); }
  .dataset-stats div:nth-child(4) { border-top: 1px solid var(--border-soft); }
  .adult-strip { grid-template-columns: 76px minmax(0, 1fr); }
  .job-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .job-actions .btn { width: 100%; margin: 0; }
  .voice-stats { grid-template-columns: 1fr; }
  .voice-pipeline ol { grid-template-columns: 1fr; }
  .console-tools label { display: none; }
}
</style>
