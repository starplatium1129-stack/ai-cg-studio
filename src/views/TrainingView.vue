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
        <p>检查 LoRA v18、语音 v16、OneTrainer、GPT-SoVITS 与训练清单…</p>
      </div>
    </div>

    <div v-else class="workbench">
      <div v-if="!onboardingDismissed" class="training-onboarding" role="region" aria-label="首次使用指引">
        <div class="onboarding-steps">
          <span><b>1</b>选择左侧训练类型：角色 LoRA 或角色语音</span>
          <span><b>2</b>检查数据集已就绪（卡片上的图片 / 音频统计）</span>
          <span><b>3</b>参数已按验证方案填好，直接点“开始训练”；想改随时可调</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" @click="dismissOnboarding">知道了，开始使用</button>
      </div>

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
          <section class="plan-card" aria-labelledby="v18-plan-title">
            <div class="plan-copy">
              <div class="panel-kicker">V18 verified plan</div>
              <h2 id="v18-plan-title">脸型优先、服装可控的 LoRA 方案</h2>
              <p>
                以身份锚点、经典服装和成人样本分层训练；文本编码器在 epoch 30 停训，
                成人内容继续留在统一角色 LoRA 中，并用独立控制词避免普通场景泄漏。
              </p>
            </div>
            <div class="plan-specs" aria-label="v18 主要训练参数">
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
                  <div class="job-eyebrow">{{ characterName(job.character) }} · LoRA v18</div>
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

              <div v-if="job.datasetOptions?.length" class="dataset-picker">
                <label :for="`${job.id}-dataset`">训练数据集</label>
                <select
                  :id="`${job.id}-dataset`"
                  class="select"
                  :value="selectedDatasetId(job)"
                  :disabled="isActive(job)"
                  @change="setDataset(job, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="option in job.datasetOptions" :key="option.id" :value="option.id">
                    {{ option.name }}{{ option.ready ? '' : '（无图片）' }}
                  </option>
                </select>
                <span class="picker-hint">
                  {{ datasetOptionFor(job)?.images ?? 0 }} 张图片 · 切换后统计即时更新
                </span>
              </div>

              <section class="param-panel" aria-labelledby="`${job.id}-params`">
                <header class="param-head">
                  <div>
                    <span class="field-name">训练参数 · 推荐值已就绪</span>
                    <h4 :id="`${job.id}-params`">不修改也能直接开始，改动只作用于本次训练</h4>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    :disabled="!draftFor(job.id).values"
                    @click="resetParams(job.id)"
                  >恢复推荐值</button>
                </header>
                <div class="param-grid">
                  <label
                    v-for="field in loraParamFields"
                    :key="field.key"
                    class="param-field"
                  >
                    <span>{{ field.label }}</span>
                    <input
                      type="number"
                      :step="field.step"
                      :min="field.min"
                      :max="field.max"
                      :value="paramValue(job.id, field.key)"
                      :disabled="isActive(job) || draftFor(job.id).loading"
                      @change="setParam(job.id, field.key, ($event.target as HTMLInputElement).value)"
                    >
                    <small v-if="field.unit">{{ field.unit }}</small>
                  </label>
                </div>
                <p v-if="draftFor(job.id).error" class="param-note param-error" role="status">
                  {{ draftFor(job.id).error }}
                </p>
              </section>

              <details class="dataset-details">
                <summary>数据集详情</summary>
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

                <div v-if="datasetFor(job) || datasetOptionFor(job)" class="dataset-stats">
                  <div>
                    <strong>{{ datasetOptionFor(job)?.images ?? datasetFor(job)?.images ?? 0 }}</strong>
                    <span>图片</span>
                  </div>
                  <div>
                    <strong>{{ datasetOptionFor(job)?.captions ?? datasetFor(job)?.captions ?? 0 }}</strong>
                    <span>标注</span>
                  </div>
                  <div>
                    <strong>{{ formatBytes(datasetOptionFor(job)?.bytes ?? datasetFor(job)?.bytes ?? 0) }}</strong>
                    <span>体积</span>
                  </div>
                  <div>
                    <strong>{{ datasetOptionFor(job)?.categories.validation ?? 0 }}</strong>
                    <span>保留验证</span>
                  </div>
                </div>

                <div v-if="datasetOptionFor(job)?.categories" class="category-section">
                  <span class="field-name">样本分层</span>
                  <div class="category-list">
                    <span
                      v-for="category in categoryEntries(datasetOptionFor(job)?.categories ?? {})"
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
                    <strong>{{ adultCount(datasetOptionFor(job)?.categories ?? {}) }} 张分层素材</strong>
                    <small>成人样本已纳入训练；缩略图始终使用预先模糊的审核表。</small>
                  </div>
                </div>
              </details>

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
                  <span v-if="etaText(job)" class="eta-text">{{ etaText(job) }}</span>
                  <span v-if="!job.progress.epochs && !job.progress.steps">
                    {{ job.configName || '等待训练配置' }}
                  </span>
                </div>
                <svg
                  v-if="lossPolyline(job.id).length > 0"
                  class="loss-chart"
                  viewBox="0 0 160 30"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <polyline :points="lossPolyline(job.id)"></polyline>
                </svg>
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
                  @click="beginTraining(job)"
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
import { useToast } from '@/composables/useToast'
import { useTrainingStore } from '@/stores/trainingStore'
import {
  adultCount, adultPreviewUrl, categoryEntries, categoryLabel,
  characterName, datasetPreviewUrl, formatBytes, formatDate, formatLoss,
  formatPercent, isAdultCategory, statusBadge, statusLabel, trainSplitPercent,
  planFor as planForFromPlans,
} from '@/composables/useTrainingFormat'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import type {
  TrainingCharacter,
  TrainingDataset,
  TrainingJob,
  TrainingJobConfig,
  TrainingJobId,
  TrainingJobStatus,
  TrainingKind,
  TrainingParamOverrides,
  TrainingPlan,
} from '@/types/training'

const route = useRoute()
const router = useRouter()
const store = useTrainingStore()
const { clearError, loadJobConfig, loadLogs, refresh, start, stop } = store
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

// 模板用单参版本：planFor(character) 从本视图的 plans 常量取值
function planFor(character: TrainingCharacter): TrainingPlan {
  return planForFromPlans(plans, character)
}

const plans: Record<TrainingCharacter, TrainingPlan> = {
  nene: {
    character: 'nene',
    identity: ['银白超长发', '低双马尾', '紫瞳与呆毛', '粉色发带'],
    outfit: { label: '宁宁经典魔女服', token: 'nene_witch_canonical' },
    epochs: 143,
  },
  natsume: {
    character: 'natsume',
    identity: ['黑色长发', '金黄色眼睛', '眼下痣', '侧边发夹'],
    outfit: { label: '夏目经典旗袍服', token: 'natsume_official_qipao' },
    epochs: 223,
  },
}

const loraSpecs = [
  { label: '底模', value: 'WAI Illustrious SDXL v170' },
  { label: '分辨率', value: '1024 + Buckets' },
  { label: 'LoRA', value: 'Rank 32 / Alpha 32' },
  { label: 'UNet 学习率', value: '1e-4' },
  { label: '有效批量', value: '4 × 累积 1' },
  { label: '精度', value: 'BF16' },
  { label: '调度器', value: 'Constant' },
  { label: '损失权重', value: 'Min-SNR 5' },
]

/* ── 可编辑训练参数（白名单字段，服务端校验后写入一次性配置副本）── */
const loraParamFields = [
  { key: 'epochs', label: '训练轮数', unit: 'epoch', step: 1, min: 1, max: 500 },
  { key: 'batch_size', label: '批量大小', unit: '', step: 1, min: 1, max: 16 },
  { key: 'gradient_accumulation_steps', label: '梯度累积', unit: '步', step: 1, min: 1, max: 8 },
  { key: 'lora_rank', label: 'LoRA 秩', unit: '', step: 1, min: 4, max: 128 },
  { key: 'lora_alpha', label: 'LoRA Alpha', unit: '', step: 1, min: 4, max: 128 },
  { key: 'unet_learning_rate', label: 'UNet 学习率', unit: '', step: 1e-5, min: 1e-7, max: 1e-3 },
  { key: 'text_encoder_learning_rate', label: '文本编码器学习率', unit: '', step: 1e-6, min: 1e-7, max: 1e-3 },
  { key: 'text_encoder_stop_epoch', label: '文本编码器停训', unit: '轮', step: 1, min: 0, max: 500 },
] as const

interface ParamDraft {
  loading: boolean
  error: string
  values: Record<string, number> | null
  recommended: Record<string, number> | null
}

const paramDrafts = ref<Partial<Record<TrainingJobId, ParamDraft>>>({})
const lossHistory = ref<Partial<Record<TrainingJobId, number[]>>>({})
const stepSamples = ref<Partial<Record<TrainingJobId, Array<{ t: number; step: number }>>>>({})
const selectedDataset = ref<Partial<Record<TrainingJobId, string>>>({})
const onboardingDismissed = ref(
  window.localStorage.getItem('aics_training_onboarded') === '1',
)

function datasetKey(id: TrainingJobId): string {
  return `aics_training_dataset_${id}`
}

function selectedDatasetId(job: TrainingJob): string {
  const local = selectedDataset.value[job.id] ?? window.localStorage.getItem(datasetKey(job.id)) ?? ''
  if (local && job.datasetOptions?.some((option) => option.id === local)) return local
  return job.selectedDataset ?? ''
}

function setDataset(job: TrainingJob, id: string): void {
  selectedDataset.value[job.id] = id
  window.localStorage.setItem(datasetKey(job.id), id)
}

function datasetOptionFor(job: TrainingJob): NonNullable<TrainingJob['datasetOptions']>[number] | null {
  const options = job.datasetOptions ?? []
  const id = selectedDatasetId(job)
  return options.find((option) => option.id === id) ?? options[0] ?? null
}

function paramsKey(id: TrainingJobId): string {
  return `aics_training_params_${id}`
}

function draftFor(id: TrainingJobId): ParamDraft {
  let draft = paramDrafts.value[id]
  if (!draft) {
    draft = { loading: false, error: '', values: null, recommended: null }
    paramDrafts.value[id] = draft
  }
  return draft
}

async function ensureParams(id: TrainingJobId): Promise<void> {
  const draft = draftFor(id)
  if (draft.loading || draft.values) return
  draft.loading = true
  draft.error = ''
  const config = await loadJobConfig(id)
  if (!config?.available || !config.fields) {
    draft.error = '无法读取训练配置，参数面板不可用。'
    draft.loading = false
    return
  }
  draft.recommended = { ...config.recommended }
  try {
    const saved = JSON.parse(window.localStorage.getItem(paramsKey(id)) ?? '') as unknown
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      draft.values = { ...config.recommended, ...saved as Record<string, number> }
    } else {
      draft.values = { ...config.recommended }
    }
  } catch {
    draft.values = { ...config.recommended }
  }
  draft.loading = false
}

function paramValue(id: TrainingJobId, key: string): number | '' {
  const draft = draftFor(id)
  const value = draft.values?.[key] ?? draft.recommended?.[key]
  return typeof value === 'number' ? value : ''
}

function setParam(id: TrainingJobId, key: string, raw: string): void {
  const draft = draftFor(id)
  if (!draft.values || !draft.recommended) return
  if (raw === '') {
    delete draft.values[key]
    window.localStorage.setItem(paramsKey(id), JSON.stringify(draft.values))
    return
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return
  const field = loraParamFields.find((item) => item.key === key)
  if (field) {
    // 越界不要静默拒收：输入框会弹回原值而用户不知道为什么。
    // 直接钳制到边界并提示，下次进页面仍记得这个值。
    if (parsed < field.min) {
      draft.values[key] = field.min
      window.localStorage.setItem(paramsKey(id), JSON.stringify(draft.values))
      showToast(`${field.label} 不能低于 ${field.min}，已设为 ${field.min}`)
      return
    }
    if (parsed > field.max) {
      draft.values[key] = field.max
      window.localStorage.setItem(paramsKey(id), JSON.stringify(draft.values))
      showToast(`${field.label} 不能高于 ${field.max}，已设为 ${field.max}`)
      return
    }
  }
  draft.values[key] = parsed
  window.localStorage.setItem(paramsKey(id), JSON.stringify(draft.values))
}

function resetParams(id: TrainingJobId): void {
  const draft = draftFor(id)
  if (!draft.recommended) return
  draft.values = { ...draft.recommended }
  window.localStorage.removeItem(paramsKey(id))
}

function overridesFor(id: TrainingJobId): TrainingParamOverrides {
  const draft = draftFor(id)
  const overrides: TrainingParamOverrides = {}
  if (!draft.values || !draft.recommended) return overrides
  for (const field of loraParamFields) {
    const current = draft.values[field.key]
    const recommended = draft.recommended[field.key]
    if (typeof current === 'number' && current !== recommended) {
      ;(overrides as Record<string, number>)[field.key] = current
    }
  }
  return overrides
}

function formatLr(value: number | ''): string {
  if (value === '') return '—'
  if (value >= 1e-3) return String(value)
  if (value >= 1e-5) return String(value).replace(/0+$/, '')
  return value.toExponential(1).replace(/\.0/, '')
}

/* ── ETA：滑动平均步速外推剩余时间 ── */
function sampleStep(job: TrainingJob): void {
  if (typeof job.progress.step !== 'number' || typeof job.progress.steps !== 'number') return
  if (job.progress.steps <= 0) return
  let samples = stepSamples.value[job.id]
  if (!samples) {
    samples = []
    stepSamples.value[job.id] = samples
  }
  const last = samples[samples.length - 1]
  if (last && job.progress.step === last.step) return
  samples.push({ t: Date.now(), step: job.progress.step })
  if (samples.length > 8) samples.shift()
}

function etaText(job: TrainingJob): string {
  if (typeof job.progress.step !== 'number' || typeof job.progress.steps !== 'number') return ''
  if (job.progress.steps <= 0 || job.progress.step <= 0) return ''
  const samples = stepSamples.value[job.id]
  if (!samples || samples.length < 2) return ''
  const first = samples[0]
  const last = samples[samples.length - 1]
  const seconds = Math.max(1, (last.t - first.t) / 1000)
  const rate = Math.max(0, (last.step - first.step) / seconds)
  if (rate <= 0) return ''
  const remaining = Math.round((job.progress.steps - job.progress.step) / rate)
  if (remaining < 60) return '预计不足 1 分钟'
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.round((remaining % 3600) / 60)
  return hours > 0 ? `预计约 ${hours} 小时 ${minutes} 分` : `预计约 ${minutes} 分钟`
}

/* ── Loss 迷你趋势线 ── */
function sampleLoss(job: TrainingJob): void {
  if (typeof job.progress.loss !== 'number') return
  let points = lossHistory.value[job.id]
  if (!points) {
    points = []
    lossHistory.value[job.id] = points
  }
  if (points.length === 0 || points[points.length - 1] !== job.progress.loss) {
    points.push(job.progress.loss)
    if (points.length > 40) points.shift()
  }
}

function lossPolyline(id: TrainingJobId): string {
  const points = lossHistory.value[id] ?? []
  if (points.length < 2) return ''
  const width = 160
  const height = 30
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = Math.max(1e-9, max - min)
  const stepX = width / (points.length - 1)
  return points
    .map((value, index) => {
      const x = (index * stepX).toFixed(1)
      const y = (height - 3 - ((value - min) / span) * (height - 6)).toFixed(1)
      return `${x},${y}`
    })
    .join(' ')
}

function resetJobTelemetry(id: TrainingJobId): void {
  lossHistory.value[id] = []
  stepSamples.value[id] = []
}

function dismissOnboarding(): void {
  onboardingDismissed.value = true
  window.localStorage.setItem('aics_training_onboarded', '1')
}

const activeKind = ref<TrainingKind>(route.query.kind === 'voice' ? 'voice' : 'lora')
const { show: showToast } = useToast()
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

function datasetFor(job: TrainingJob): TrainingDataset | null {
  return store.datasetFor(job)
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

async function beginTraining(job: TrainingJob): Promise<void> {
  resetJobTelemetry(job.id)
  await ensureParams(job.id)
  const dataset = selectedDatasetId(job) || undefined
  await start(job.id, overridesFor(job.id), dataset)
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
  sampleStep(activeJob.value)
  sampleLoss(activeJob.value)
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
  for (const job of visibleJobs.value) {
    if (job.kind === 'lora') await ensureParams(job.id)
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
  position: relative; display: flex;
  align-items: center;
  gap: var(--s-3);
  min-width: 210px;
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-terminal);
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
}
.hero-status::before { position: absolute; top: -1px; left: var(--s-3); width: 26px; height: var(--line-hairline); background: var(--archive-cyan); content: ''; }

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

.training-onboarding {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  margin-bottom: var(--s-4);
  padding: var(--s-3) var(--s-4);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border-soft));
  border-radius: var(--r-lg);
  background: var(--accent-soft);
}
.onboarding-steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3) var(--s-4);
  color: var(--text-secondary);
  font-size: var(--fs-label-sm);
}
.onboarding-steps span { display: inline-flex; align-items: center; gap: 7px; }
.onboarding-steps b {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--text-inverse);
  font: 700 var(--fs-mono-xs) var(--font-mono);
}
.training-onboarding .btn { flex: 0 0 auto; white-space: nowrap; }

.workbench-rail {
  position: sticky;
  top: calc(var(--nav-h, 60px) + var(--s-4));
  min-width: 0;
  padding: var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-dossier);
  background: color-mix(in srgb, var(--bg-surface) 91%, transparent);
  box-shadow: var(--shadow-sm);
}
.workbench-rail::before { position: absolute; top: -1px; left: var(--s-4); width: 34px; height: var(--line-hairline); background: var(--archive-cyan); content: ''; }

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
  border-radius: var(--r-terminal);
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
  position: relative; padding: clamp(18px, 2.4vw, 26px);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-dossier);
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
  box-shadow: var(--shadow-sm);
}
.plan-card::before,
.voice-pipeline::before,
.log-console::before { position: absolute; top: -1px; left: var(--s-4); width: 34px; height: var(--line-hairline); background: var(--archive-cyan); content: ''; }

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
  border: 1px solid var(--border-soft); border-radius: var(--r-terminal); background: var(--bg-deep);
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
  padding: 4px var(--s-2); border-radius: var(--r-terminal);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  color: var(--success-text); font-size: var(--fs-mono-xs);
}

.job-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start; gap: var(--s-4);
}
.job-card {
  min-width: 0; overflow: hidden; padding: var(--s-4);
  border: 1px solid var(--border-soft); border-radius: var(--r-dossier);
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
  border-radius: var(--r-terminal); background: var(--bg-deep);
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

.param-panel {
  margin-bottom: var(--s-3);
  padding: var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  background: var(--bg-deep);
}
.param-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s-3);
  margin-bottom: var(--s-3);
}
.param-head h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--fs-label-sm);
  font-weight: 600;
}
.param-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s-2);
}
.param-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: var(--bg-surface);
}
.param-field > span {
  color: var(--text-secondary);
  font-size: var(--fs-mono-xs);
  overflow-wrap: anywhere;
}
.param-field input {
  width: 100%;
  min-width: 0;
  padding: 5px 7px;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font: 600 var(--fs-mono-xs) / 1.3 var(--font-mono);
  text-align: right;
  cursor: text;
}
.param-field input:hover:not(:disabled) { border-color: var(--accent); }
.param-field input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--ring);
}
.param-field input:disabled { opacity: .55; cursor: not-allowed; }
.param-field small { color: var(--text-muted); font-size: var(--fs-mono-xs); }
.param-note {
  margin: var(--s-2) 0 0;
  color: var(--text-muted);
  font-size: var(--fs-mono-xs);
  line-height: 1.5;
}
.param-error { color: var(--warning-text); }

.dataset-picker {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--s-2);
  margin-bottom: var(--s-3);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  background: var(--bg-deep);
}
.dataset-picker label {
  color: var(--text-muted);
  font: 650 var(--fs-mono-xs) var(--font-mono);
  letter-spacing: .07em;
}
.dataset-picker .select { min-height: 32px; font-size: var(--fs-label-sm); }
.dataset-picker .select:disabled { opacity: .55; cursor: not-allowed; }
.picker-hint { color: var(--text-muted); font-size: var(--fs-mono-xs); white-space: nowrap; }

.dataset-details {
  margin-bottom: var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  background: var(--bg-deep);
}
.dataset-details > summary {
  padding: 8px 12px;
  color: var(--text-secondary);
  font-size: var(--fs-label-sm);
  font-weight: 600;
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.dataset-details > summary::-webkit-details-marker { display: none; }
.dataset-details > summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 8px;
  color: var(--accent);
  transition: transform var(--t-fast) var(--ease-out);
}
.dataset-details[open] > summary::before { transform: rotate(90deg); }
.dataset-details > summary:hover { color: var(--text-primary); }
.dataset-details > summary:focus-visible {
  outline: none;
  border-radius: var(--r-lg);
  box-shadow: var(--ring);
}
.dataset-details > .dataset-preview,
.dataset-details > .dataset-stats,
.dataset-details > .category-section,
.dataset-details > .adult-strip {
  margin: 0 10px 10px;
}
.dataset-details > .dataset-preview { margin-top: 2px; }

.eta-text { color: var(--accent); font-weight: 650; }

.loss-chart {
  display: block;
  width: 100%;
  height: 34px;
  margin-top: var(--s-2);
  overflow: visible;
}
.loss-chart polyline {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.6;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: .85;
}

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
  .training-onboarding { align-items: stretch; flex-direction: column; }
  .onboarding-steps { flex-direction: column; align-items: flex-start; }
  .training-onboarding .btn { align-self: flex-start; }
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
