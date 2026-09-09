<template>
  <article class="video-studio page">
    <WorkspaceArchiveBar
      chapter="14"
      title="故事短片"
      subtitle="让这一幕，继续发生"
      :status="archiveStatus"
      :state="archiveState"
      shape="frame"
    />

    <header class="video-header">
      <div>
        <div class="page-kicker">画室 / 故事短片</div>
        <h1 class="page-title">故事短片</h1>
        <p class="page-subtitle">
          从一张画面或一段描述开始，让角色的故事继续。选择创作方式，再准备镜头与首帧。
        </p>
      </div>
      <button class="btn btn-ghost" type="button" :disabled="statusLoading" @click="loadStatus">
        <ArchiveIcon name="refresh" />
        {{ statusLoading ? '检测中' : '重新检测' }}
      </button>
    </header>

    <section class="video-mode-strip" aria-label="视频创作方式">
      <button
        v-for="mode in modes"
        :key="mode.id"
        class="video-mode-card"
        type="button"
        :class="{ active: selectedMode === mode.id }"
        :aria-pressed="selectedMode === mode.id"
        :disabled="!modeReady(mode.id)"
        @click="selectedMode = mode.id"
      >
        <span class="video-mode-icon"><ArchiveIcon :name="mode.icon" /></span>
        <span>
          <strong>{{ mode.label }}</strong>
          <small>{{ mode.description }}</small>
        </span>
        <em>{{ modeBadge(mode.id) }}</em>
      </button>
    </section>

    <div v-if="t8State" class="video-t8-bar" :data-state="t8State.available ? 'fast' : 'slow'" role="status">
      <span class="video-t8-dot"></span>
      {{ t8State.reason }}
      <span v-if="!t8State.available" class="video-t8-hint">任务会自动重新探测，无需重启</span>
    </div>

    <nav v-if="selectedMode !== 'shots'" class="video-jump-nav" aria-label="视频工作区导航"><a href="#video-brief">镜头描述</a><a href="#video-settings">画幅与时长</a><a href="#video-queue">任务状态</a></nav>
    <div class="video-workspace">
      <div class="video-creation-column">
        <ShotListEditor v-if="selectedMode === 'shots'" :status="status" />
        <template v-else>
        <section v-if="selectedMode === 'image'" class="video-panel video-first-frame-panel">
          <div class="video-panel-heading video-panel-heading--compact">
            <div>
              <span class="video-step">00 · 首帧</span>
              <h2>视频从这里开始</h2>
            </div>
            <button v-if="videoImageUrl" class="btn btn-ghost" type="button" @click="clearFirstFrame">移除</button>
          </div>
          <img v-if="videoImageUrl" class="video-first-frame" :src="videoImageUrl" alt="视频首帧" />
          <p v-else class="video-queue-empty">
            <ArchiveIcon name="image" />
            <span>在绘图页生成图片后点击「出视频」即可带到这里；图片将作为首帧，自动锁定角色与场景。</span>
          </p>
          <p v-if="videoImageUrl" class="video-install-note">
            这张图将作为故事的起点。画幅默认跟随原图，你只需描述接下来发生的动作。
          </p>
        </section>

        <section v-else-if="selectedMode === 'first-last-frame'" class="video-panel video-first-frame-panel">
          <div class="video-panel-heading video-panel-heading--compact">
            <div>
              <span class="video-step">00 · 首尾帧</span>
              <h2>锁定开始与结束画面</h2>
            </div>
            <span class="video-count">首尾画面衔接</span>
          </div>
          <div class="video-dual-frame-grid">
            <div class="video-frame-slot">
              <span class="field-label">首帧</span>
              <img v-if="videoImageUrl" class="video-first-frame" :src="videoImageUrl" alt="视频首帧" />
              <label v-else class="video-upload-drop" :data-busy="uploadingImage || undefined">
                <input type="file" accept="image/*" :disabled="uploadingImage" @change="handleFrameFile($event, 'first')" />
                <ArchiveIcon name="image" />
                <span>上传首帧，或从绘图页「出视频」带入</span>
              </label>
              <button v-if="videoImageUrl" class="btn btn-ghost btn-block" type="button" @click="clearFirstFrame">移除首帧</button>
            </div>
            <div class="video-frame-slot">
              <span class="field-label">尾帧</span>
              <img v-if="lastFrameUrl" class="video-first-frame" :src="lastFrameUrl" alt="视频尾帧" />
              <label v-else class="video-upload-drop" :data-busy="uploadingImage || undefined">
                <input type="file" accept="image/*" :disabled="uploadingImage" @change="handleFrameFile($event, 'last')" />
                <ArchiveIcon name="image" />
                <span>上传尾帧</span>
              </label>
              <button v-if="lastFrameUrl" class="btn btn-ghost btn-block" type="button" @click="clearLastFrame">移除尾帧</button>
            </div>
          </div>
          <p class="video-install-note">
            首帧决定开始，尾帧决定结束。在镜头描述中写下两幅画面之间的动作，画幅默认跟随首帧。
          </p>
        </section>

        <section id="video-brief" class="video-panel video-brief-panel">
          <div class="video-panel-heading">
            <div>
              <span class="video-step">01 · 镜头意图</span>
              <h2>你想看到什么发生？</h2>
            </div>
            <span class="video-count" :data-warning="prompt.length > 900 || undefined">
              {{ prompt.length }} / 4000
            </span>
          </div>
          <textarea
            v-model="prompt"
            class="textarea video-prompt"
            maxlength="4000"
            rows="7"
            placeholder="例如：黄昏的电车站，少女回头看向镜头，风吹起发丝和裙摆，镜头缓慢推进，暖色逆光，动作自然连续。"
          ></textarea>
          <div class="video-prompt-guidance">
            <span>建议写清：主体</span>
            <span>动作</span>
            <span>环境</span>
            <span>光线</span>
            <span>镜头</span>
          </div>
        </section>

        <section id="video-settings" class="video-panel">
          <div class="video-panel-heading">
            <div>
              <span class="video-step">02 · 成片方向</span>
              <h2>画幅与节奏</h2>
            </div>
          </div>

          <div class="video-choice-group">
            <span class="field-label">画幅</span>
            <div class="video-choice-grid video-choice-grid--three" role="group" aria-label="选择视频画幅">
              <button
                v-for="item in aspectOptions"
                :key="item.id"
                type="button"
                :class="{ active: aspectRatio === item.id }"
                :aria-pressed="aspectRatio === item.id"
                @click="aspectRatio = item.id"
              >
                <span class="aspect-glyph" :data-aspect="item.id"></span>
                <strong>{{ item.label }}</strong>
                <small>{{ aspectSize(item.id) }}</small>
              </button>
            </div>
          </div>

          <div class="video-choice-pair">
            <label class="field">
              <span class="field-label">镜头运动</span>
              <select v-model="camera" class="select">
                <option v-for="item in cameraOptions" :key="item.id" :value="item.id">{{ item.label }}</option>
              </select>
            </label>
            <label class="field">
              <span class="field-label">主体运动</span>
              <select v-model="motion" class="select">
                <option v-for="item in motionOptions" :key="item.id" :value="item.id">{{ item.label }}</option>
              </select>
            </label>
          </div>

          <div class="video-quality-row">
            <span class="field-label">画质档位</span>
            <div class="video-quality-grid" role="group" aria-label="选择视频画质档位">
              <button
                v-for="item in status?.qualities || []"
                :key="item.id"
                type="button"
                :class="{ active: quality === item.id }"
                :aria-pressed="quality === item.id"
                @click="quality = item.id"
              >
                <strong>{{ item.label }}</strong>
                <small>{{ item.summary }}</small>
                <em>{{ item.sizes[aspectRatio] }}</em>
              </button>
            </div>
            <p class="video-duration-note">
              快速档适合试镜找方向；标准档是 16GB 官方常规画布；精细档是上限档，时间明显变长。
            </p>
          </div>

          <div class="video-duration-row">
            <span class="field-label">时长</span>
            <div class="video-segmented" role="group" aria-label="选择视频时长">
              <button
                v-for="seconds in durationOptions"
                :key="seconds"
                type="button"
                :class="{ active: duration === seconds }"
                :aria-pressed="duration === seconds"
                @click="duration = seconds"
              >{{ seconds }} 秒</button>
            </div>
            <span class="video-duration-note">首次测试建议 3 秒，确认方向后再生成 5 秒。</span>
          </div>

          <details class="video-advanced">
            <summary>高级设置</summary>
            <div class="video-advanced-grid">
              <label v-if="activeModel?.id === 'minimax-h3'" class="video-steps-toggle">
                <input v-model="steps" type="checkbox" :true-value="4" :false-value="8" />
                <span>
                  <strong>极速 4 步</strong>
                  <small>Turbo 蒸馏 4 步采样，约快一倍（实测 fast 5s 130s → 80s），质量略降，适合试镜与长片。</small>
                </span>
              </label>
              <label class="field">
                <span class="field-label">负向描述</span>
                <textarea
                  v-model="negative"
                  class="textarea"
                  rows="3"
                  maxlength="1000"
                  placeholder="可选。基础质量与稳定性负向词已由工作室自动补全。"
                ></textarea>
              </label>
              <label class="field">
                <span class="field-label">固定 Seed</span>
                <input v-model="seedText" class="input input-mono" inputmode="numeric" placeholder="留空则随机" />
                <span class="field-hint">复现同一构思时再填写，不建议为找偶然好片反复抽 seed。</span>
              </label>
            </div>
          </details>
        </section>

        <section class="video-submit-panel" :data-ready="canGenerate || undefined">
          <div>
            <strong>{{ submitTitle }}</strong>
            <p>{{ submitDescription }}</p>
          </div>
          <button class="btn btn-primary btn-lg" type="button" :disabled="!canGenerate" @click="submitVideo">
            <ArchiveIcon name="play" />
            {{ submitting ? '正在提交…' : '生成视频' }}
          </button>
        </section>
        </template>
      </div>

      <aside class="video-side-column">
        <section class="video-panel video-environment-panel">
          <div class="video-panel-heading video-panel-heading--compact">
            <div>
              <span class="video-step">本机环境</span>
              <h2>执行路线</h2>
            </div>
            <span class="video-status-pill" :data-state="environmentState">{{ environmentLabel }}</span>
          </div>

          <div v-if="statusError" class="video-inline-message error">{{ statusError }}</div>
          <template v-else-if="activeModel">
            <div class="video-model-summary">
              <span>{{ activeModel.tier }}</span>
              <strong>{{ activeModel.label }}</strong>
              <p>{{ activeModel.summary }}</p>
            </div>
            <details v-if="activeModel.missing.length" class="video-advanced">
              <summary>需要安装 {{ activeModel.missing.length }} 项资源 · 查看详情</summary>
              <ul class="video-missing-list"><li v-for="file in activeModel.missing" :key="file"><code>{{ file }}</code></li></ul>
            </details>
            <p v-if="activeModel.missing.length && activeModel.executable" class="video-install-note">
              ComfyUI 节点已支持；安装所列资源后即可启用生成按钮。
            </p>
            <p v-else-if="activeModel.missing.length" class="video-install-note">
              所列资源是该路线的最小模型组合；应用配方与真实 GPU 验证完成前保持不可生成。
            </p>
            <div v-if="activeModel.id === 'minimax-h3'" class="video-route-note">
              <strong>推荐用法</strong>
              <span>Wan 5B 快速验证镜头，H3 再做带原生音效与音乐的最终成片。</span>
            </div>
          </template>
          <RouterLink v-if="!status?.online" class="btn btn-ghost btn-block" to="/control">
            打开控制面板
          </RouterLink>
        </section>

        <section class="video-panel video-model-catalog">
          <div class="video-panel-heading video-panel-heading--compact">
            <div>
              <span class="video-step">模型目录</span>
              <h2>按能力逐步扩展</h2>
            </div>
          </div>
          <button
            v-for="model in status?.models || []"
            :key="model.id"
            class="video-model-row"
            type="button"
            :class="{ active: selectedModelId === model.id }"
            @click="selectedModelId = model.id"
          >
            <span>
              <strong>{{ model.label }}</strong>
              <small>{{ model.summary }}</small>
            </span>
            <em :data-state="model.available ? 'ready' : (model.executable ? 'missing' : 'planned')">
              {{ model.available ? '已就绪' : (model.executable ? '待安装' : '待适配') }}
            </em>
          </button>
        </section>

        <section id="video-queue" class="video-panel video-queue-panel" aria-live="polite">
          <div class="video-panel-heading video-panel-heading--compact">
            <div>
              <span class="video-step">任务队列</span>
              <h2>当前成片</h2>
            </div>
            <span v-if="t8State" class="video-t8-badge" :data-state="t8State.available ? 'fast' : 'slow'">
              <ArchiveIcon :name="t8State.available ? 'lightning' : 'warning'" />
              <span>{{ t8State.available ? 'T8 双时钟加速' : '原生采样（慢）' }}</span>
            </span>
          </div>
          <div v-if="!job" class="video-queue-empty">
            <ArchiveIcon name="play" />
            <span>提交后可离开描述区继续调整；页面会持续轮询任务状态。</span>
          </div>
          <template v-else>
            <div class="video-job-head">
              <span class="video-job-state" :data-state="job.status">{{ jobStatusLabel }}</span>
              <time>{{ formatTime(job.createdAt) }}</time>
            </div>
            <div class="video-job-meta">
              <span>{{ job.width }} × {{ job.height }}</span>
              <span>{{ job.duration }} 秒</span>
              <span>Seed {{ job.seed }}</span>
            </div>
            <div v-if="job.status === 'queued' || job.status === 'running' || job.status === 'cancelling'" class="video-progress">
              <i :style="{ '--progress': progressPercent + '%' }"></i>
            </div>
            <p v-if="job.status === 'running' && job.estimatedSeconds" class="video-job-eta">
              {{ progressPercent }}% · 已 {{ formatSeconds(job.elapsedSeconds) }} / 预估 {{ formatSeconds(job.estimatedSeconds) }}
            </p>
            <p v-if="progressWarning" class="video-inline-message" :class="progressWarning.level === 'danger' ? 'error' : 'warning'">
              {{ progressWarning.text }}
            </p>
            <!--
              任务失败：后端给的是 ComfyUI 的英文技术串（节点名 / 张量形状 /
              traceback）。走一遍分类器换成中文结论，原始串折进「技术细节」，
              与出图路径的失败呈现对齐（2026-08-30 UX 审计）。
            -->
            <div v-if="jobErrorReport" class="video-inline-message error">
              <p>{{ jobErrorReport.title }}：{{ jobErrorReport.message }}</p>
              <details v-if="jobErrorReport.details" class="video-error-detail">
                <summary>技术细节</summary>
                <code>{{ jobErrorReport.details }}</code>
              </details>
            </div>
            <button
              v-if="job.status === 'queued' || job.status === 'running'"
              class="btn btn-danger btn-block"
              type="button"
              :disabled="cancelling"
              @click="cancelJob"
            >{{ cancelling ? '正在取消…' : '取消任务' }}</button>
          </template>
        </section>
      </aside>
    </div>

    <section v-if="job?.status === 'succeeded' && job.resultUrl" class="video-result-panel">
      <div class="video-result-heading">
        <div>
          <span class="video-step">03 · 成片预览</span>
          <h2>检查连贯性，再决定是否加长</h2>
        </div>
        <a class="btn btn-ghost" :href="job.resultUrl" download>下载 MP4</a>
      </div>
      <video :key="job.resultUrl" class="video-player" :src="job.resultUrl" controls playsinline preload="metadata"></video>
      <div class="video-review-checklist">
        <span>身份是否稳定</span>
        <span>脸与手是否连续</span>
        <span>动作是否自然</span>
        <span>镜头是否符合意图</span>
        <span>背景是否闪烁</span>
      </div>
    </section>
  </article>
</template>

<script setup lang="ts">
import { onActivated } from 'vue'
import { useTrackedTask } from '@/composables/useTaskCenter'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArchiveIcon, { type ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import ShotListEditor from '@/components/video/ShotListEditor.vue'
import {
  cancelVideoJob,
  createVideoJob,
  fetchVideoJob,
  fetchVideoStatus,
  type VideoDefaults,
  type VideoJob,
  type VideoMode,
  type VideoStatusResponse,
} from '@/api/videoApi'
import { isLocalStudioHost } from '@/utils/runtimeEnvironment'
import { classifySDError } from '@/utils/sdError'
import { useVideoStore } from '@/stores/videoStore'
import { useVideoFrames } from '@/components/video/useVideoFrames'
import { useVideoStudioDraft } from '@/components/video/useVideoStudioDraft'

type StudioMode = VideoMode | 'shots'

const modes: Array<{ id: StudioMode; label: string; description: string; ready: boolean; icon: ArchiveIconName }> = [
  { id: 'text', label: '文字成片', description: '一句镜头描述直接生成短片', ready: true, icon: 'play' },
  { id: 'image', label: '图片动起来', description: '绘图页「出视频」自动带入首帧，锁定角色与场景', ready: true, icon: 'image' },
  { id: 'first-last-frame', label: '首尾帧过渡', description: '锁定开始与结束画面', ready: false, icon: 'gallery' },
  { id: 'shots', label: '分镜短片', description: '多镜头批量生成 · 自动尾帧衔接 · 整片拼接', ready: false, icon: 'gallery' },
]

// 分镜模式门槛：MiniMax H3 权重就绪（支持 FL2VA 衔接与原生对白）。
const shotsModeReady = computed(() =>
  status.value?.models.some((model) => model.id === 'minimax-h3' && model.available) === true)

// 首尾帧模式门槛：同源 H3（FL2VA 尾帧衔接是 H3 原生节点能力，Wan 5B 无此链路）。
const firstLastFrameReady = computed(() =>
  status.value?.models.some((model) =>
    model.id === 'minimax-h3' && model.available && model.modes.includes('first-last-frame')) === true)

function modeReady(mode: StudioMode): boolean {
  if (mode === 'shots') return shotsModeReady.value
  if (mode === 'first-last-frame') return firstLastFrameReady.value
  return true
}

function modeBadge(mode: StudioMode): string {
  if (mode === 'shots' || mode === 'first-last-frame') return modeReady(mode) ? '可用' : '待装权重'
  return '可用'
}

const aspectOptions = computed(() => {
  const base: Array<{ id: VideoDefaults['aspectRatio']; label: string }> = [
    { id: 'landscape', label: '横屏' },
    { id: 'portrait', label: '竖屏' },
    { id: 'square', label: '方形' },
  ]
  if (selectedMode.value === 'image' || selectedMode.value === 'first-last-frame') {
    base.push({ id: 'original', label: '跟随原图' })
  }
  return base
})
const activeQuality = computed(() =>
  status.value?.qualities.find(item => item.id === quality.value) ?? null)
const aspectSize = computed(() => (id: string) => {
  if (id === 'original') return '自动匹配'
  return activeQuality.value?.sizes[id] ?? ''
})
const cameraOptions: Array<{ id: VideoDefaults['camera']; label: string }> = [
  { id: 'still', label: '固定镜头 · 最稳' },
  { id: 'push', label: '缓慢推进' },
  { id: 'pull', label: '缓慢拉远' },
  { id: 'pan', label: '平稳横移' },
  { id: 'orbit', label: '轻微环绕' },
]
const motionOptions: Array<{ id: VideoDefaults['motion']; label: string }> = [
  { id: 'subtle', label: '细微运动 · 最稳' },
  { id: 'natural', label: '自然动作' },
  { id: 'expressive', label: '表现动作' },
]
const durationOptions = computed<Array<VideoDefaults['duration']>>(() =>
  activeModel.value?.id === 'minimax-h3' ? [3, 5, 10, 15] : [3, 5])

const selectedMode = ref<StudioMode>('text')
const route = useRoute()
const router = useRouter()
const prompt = ref('')
const negative = ref('')
// 默认选中 H3：主力模型（T8 双时钟加速 / 对白 / 长镜都靠它），Wan 仅作备选。
// 此前默认 wan2.2 导致用户忘记切换就出片（2026-08-17 用户反馈）。
const selectedModelId = ref('minimax-h3')
const aspectRatio = ref<VideoDefaults['aspectRatio']>('landscape')
const quality = ref<VideoDefaults['quality']>('standard')
const steps = ref<4 | 8>(8)
const duration = ref<VideoDefaults['duration']>(3)
const camera = ref<VideoDefaults['camera']>('still')
const motion = ref<VideoDefaults['motion']>('subtle')
const seedText = ref('')
const status = ref<VideoStatusResponse | null>(null)
const statusLoading = ref(false)
const statusError = ref('')
const submitting = ref(false)
const cancelling = ref(false)
const job = ref<VideoJob | null>(null)
let pollTimer = 0
let disposed = false

/**
 * 视频任务失败的分类报告（2026-08-30 UX 审计）。
 *
 * 视频后端同样走 ComfyUI，失败时 job.error 是英文技术串。这里复用出图那套
 * 分类器（backend='comfy'）给出中文结论与下一步，原始串留给「技术细节」。
 */
const jobErrorReport = computed(() => {
  const raw = job.value?.error
  if (!raw) return null
  return classifySDError({ message: raw }, 'comfy')
})

// ── 图片动起来（I2VA）状态：首帧来自绘图页「出视频」的跨页上下文 ────────────
const videoImageId = ref('')
const videoImageUrl = ref('')
const uploadingImage = ref(false)

// ── 首尾帧过渡（FL2VA）状态：首帧可来自绘图页或本地上传，尾帧仅本地上传 ────
const firstFrameName = ref('')
const lastFrameName = ref('')
const lastFrameImageId = ref('')
const lastFrameUrl = ref('')

const activeModel = computed(() => status.value?.models.find(model => model.id === selectedModelId.value) || null)
const environmentState = computed(() => {
  if (statusLoading.value) return 'checking'
  if (!status.value?.online) return 'offline'
  if (activeModel.value && !activeModel.value.executable) return 'planned'
  if (activeModel.value?.available) return 'ready'
  return 'missing'
})
const environmentLabel = computed(() => ({
  checking: '检测中',
  offline: 'ComfyUI 离线',
  ready: '可以生成',
  missing: '权重待安装',
  planned: '配方待适配',
})[environmentState.value])
const archiveStatus = computed(() => {
  if (job.value?.status === 'running') return 'RENDERING'
  if (job.value?.status === 'succeeded') return 'CLIP READY'
  return environmentLabel.value.toUpperCase()
})
const archiveState = computed<'idle' | 'active' | 'success' | 'warning'>(() => {
  if (job.value?.status === 'running' || statusLoading.value) return 'active'
  if (job.value?.status === 'succeeded' || environmentState.value === 'ready') return 'success'
  return environmentState.value === 'offline' || environmentState.value === 'missing' ? 'warning' : 'idle'
})
const parsedSeed = computed(() => {
  if (!seedText.value.trim()) return undefined
  const value = Number(seedText.value)
  return Number.isSafeInteger(value) && value >= 0 && value <= 0x7fffffff ? value : null
})
const jobActive = computed(() => job.value?.status === 'queued'
  || job.value?.status === 'running'
  || job.value?.status === 'cancelling')

// ── 可观测性（2026-08-17）：真实进度外推 + 疑似卡死预警 + T8 状态徽章 ──
function formatSeconds(total: number) {
  const safe = Math.max(0, Math.round(total))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return minutes ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`
}
const progressPercent = computed(() => {
  const current = job.value
  if (!current) return 0
  return Math.min(100, Math.round((current.progress || 0) * 100))
})
/** 运行时间异常预警：超过预估 1.5× 提示、2.5× 判疑似卡死。 */
const progressWarning = computed<{ level: 'warn' | 'danger'; text: string } | null>(() => {
  const current = job.value
  if (!current || current.status !== 'running' || !current.estimatedSeconds) return null
  const ratio = current.elapsedSeconds / current.estimatedSeconds
  if (ratio >= 2.5) {
    return {
      level: 'danger',
      text: `疑似卡死：已运行 ${formatSeconds(current.elapsedSeconds)}，超过预估 ${formatSeconds(current.estimatedSeconds)} 的 2.5 倍。请检查 ComfyUI（可能卡在模型加载/采样），必要时取消重试。`,
    }
  }
  if (ratio >= 1.5) {
    return {
      level: 'warn',
      text: `运行时间异常：已 ${formatSeconds(current.elapsedSeconds)}，预估 ${formatSeconds(current.estimatedSeconds)}。建议留意 ComfyUI 状态。`,
    }
  }
  return null
})
/** T8 双时钟是 H3 专属路径：仅选中 minimax-h3 时展示徽章（Wan 走原生工作流，与 T8 无关）。 */
const t8State = computed(() => {
  if (selectedModelId.value !== 'minimax-h3') return null
  return status.value?.t8 ?? null
})
const canGenerate = computed(() => {
  const mode = selectedMode.value
  // 分镜模式走 ShotListEditor 自己的提交链路，不进单任务生成。
  if (mode === 'shots') return false
  if (mode === 'image' && !videoImageId.value) return false
  if (mode === 'first-last-frame' && !firstFrameReady.value) return false
  return prompt.value.trim().length >= 8
    && prompt.value.length <= 4000
    && parsedSeed.value !== null
    && status.value?.online === true
    && activeModel.value?.available === true
    && activeModel.value?.modes?.includes(mode) === true
    && !submitting.value
    && !jobActive.value
})
// 首尾帧模式素材就绪：首帧（绘图页带入 或 本地上传）与尾帧（本地上传）齐备。
const firstFrameReady = computed(() =>
  Boolean(videoImageId.value || firstFrameName.value) && Boolean(lastFrameName.value))

const submitTitle = computed(() => {
  if (jobActive.value) return '已有视频正在生成'
  if (!status.value?.online) return '先启动 ComfyUI'
  if (!activeModel.value?.available) return '先安装本地视频权重'
  if (selectedMode.value === 'first-last-frame' && !firstFrameReady.value) {
    return videoImageId.value || firstFrameName.value ? '先上传一张尾帧图' : '先准备首帧与尾帧图'
  }
  if (selectedMode.value === 'image' && !videoImageId.value) return '先带入一张首帧图'
  if (activeModel.value && selectedMode.value !== 'shots'
    && !activeModel.value.modes?.includes(selectedMode.value as VideoMode)) {
    return selectedMode.value === 'image' ? '当前模型不支持首帧，请在模型目录选择 MiniMax H3' : '当前模型不支持该创作方式'
  }
  if (prompt.value.trim().length < 8) return '写下一个完整的镜头'
  if (parsedSeed.value === null) return 'Seed 格式不正确'
  return `${duration.value} 秒 · ${activeModel.value.label} · 本地生成`
})
const submitDescription = computed(() => {
  if (jobActive.value) return '视频任务耗时较长，为避免显存争抢，当前只允许一个页面任务。'
  if (!status.value?.online) return '控制面板启动 ComfyUI 后，回到这里重新检测即可。'
  if (!activeModel.value?.available) return '页面与原生节点已经就绪，缺失文件会在右侧明确列出。'
  if (selectedMode.value === 'first-last-frame') return '工作室会锁定首尾两帧画面，中间过渡由模型按描述自由发挥。'
  return '工作室会自动补全稳定性约束、帧数、采样器与 MP4 输出设置。'
})
const jobStatusLabel = computed(() => ({
  queued: '排队中',
  running: '生成中',
  cancelling: '取消中',
  succeeded: '已完成',
  failed: '生成失败',
  cancelled: '已取消',
})[job.value?.status || 'queued'])

function schedulePoll() {
  window.clearTimeout(pollTimer)
  if (!job.value || disposed || !jobActive.value) return
  pollTimer = window.setTimeout(() => { void pollJob() }, 1500)
}

async function loadStatus() {
  statusLoading.value = true
  statusError.value = ''
  try {
    const next = await fetchVideoStatus()
    status.value = next
    if (!next.models.some(model => model.id === selectedModelId.value)) {
      selectedModelId.value = next.defaults.modelId
    }
    // 图生视频模式下自动落到支持 image 且已就绪的模型（默认 Wan 5B 只能文字成片）。
    if (selectedMode.value === 'image') {
      const current = next.models.find(model => model.id === selectedModelId.value)
      if (!current || !current.modes.includes('image')) {
        const imageReady = next.models.find(model => model.modes.includes('image') && model.available)
        if (imageReady) selectedModelId.value = imageReady.id
      }
    }
  } catch (error) {
    statusError.value = error instanceof Error ? error.message : '视频环境检测失败'
  } finally {
    statusLoading.value = false
  }
}

// ── 绘图页「出视频」跨页上下文与首帧/尾帧素材（已下沉 useVideoFrames）──────
// 草稿持久化与任务重连（F1）归 useVideoStudioDraft。
const {
  consumeVideoCtx,
  clearFirstFrame,
  clearLastFrame,
  handleFrameFile,
  resolveSubmitFrames,
} = useVideoFrames({
  selectedMode, aspectRatio, selectedModelId, prompt,
  videoImageId, videoImageUrl, firstFrameName,
  lastFrameImageId, lastFrameUrl, lastFrameName,
  uploadingImage, status, statusError,
})

const videoDraftTools = useVideoStudioDraft({
  selectedMode, prompt, negative, selectedModelId, aspectRatio, quality,
  steps, duration, camera, motion, seedText,
  videoImageId, lastFrameImageId, videoImageUrl, lastFrameUrl,
  onPersistError: (message) => { statusError.value = message },
})
const stopDraftWatch = videoDraftTools.startDraftWatch()

async function submitVideo() {
  if (!canGenerate.value) return
  submitting.value = true
  try {
    // 帧图解析（受控名优先、IndexedDB 凭据重上传兜底）已下沉 useVideoFrames。
    const { image, lastFrame } = await resolveSubmitFrames(selectedMode.value)
    const response = await createVideoJob({
      prompt: prompt.value.trim(),
      negative: negative.value.trim() || undefined,
      modelId: selectedModelId.value,
      aspectRatio: aspectRatio.value,
      duration: duration.value,
      camera: camera.value,
      motion: motion.value,
      seed: typeof parsedSeed.value === 'number' ? parsedSeed.value : undefined,
      quality: quality.value,
      steps: steps.value,
      image,
      lastFrame,
      // 成人内容传输层授权：本机直连默认 true，远程/隧道由服务端 fail-closed。
      adultEnabled: isLocalStudioHost(),
    })
    job.value = response.job
    // 任务记录（F1）：离页后按 jobId 重连真实状态。
    useVideoStore().recordVideoTask({ jobId: response.job.id, mode: selectedMode.value, submittedAt: Date.now() })
    schedulePoll()
  } catch (error) {
    // 提交失败多半是 Comfy 侧（显存 / 模型 / 参数），走分类器给中文结论；
    // 分类不出具体原因时仍退回原始消息，不丢信息。
    const report = classifySDError(error, 'comfy')
    statusError.value = report.kind === 'unknown'
      ? (error instanceof Error ? error.message : '视频任务提交失败')
      : `${report.title}：${report.message}`
    await loadStatus()
  } finally {
    uploadingImage.value = false
    submitting.value = false
  }
}

async function pollJob() {
  if (!job.value || !jobActive.value) return
  try {
    const response = await fetchVideoJob(job.value.id)
    job.value = response.job
  } catch (error) {
    statusError.value = error instanceof Error ? error.message : '视频任务状态读取失败'
  } finally {
    schedulePoll()
  }
}

async function cancelJob() {
  if (!job.value || cancelling.value) return
  cancelling.value = true
  try {
    const response = await cancelVideoJob(job.value.id)
    job.value = response.job
  } catch (error) {
    statusError.value = error instanceof Error ? error.message : '视频任务取消失败'
  } finally {
    cancelling.value = false
  }
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(timestamp)
}

// 离开图生视频/首尾帧模式时把「跟随原图」复位，避免文字成片带着 original 画幅被后端 400。
watch(selectedMode, (mode) => {
  if (mode !== 'image' && mode !== 'first-last-frame' && aspectRatio.value === 'original') aspectRatio.value = 'landscape'
})

let activatedOnce = false
onActivated(() => { if (!activatedOnce) { activatedOnce = true; return }; consumeVideoCtx(); if (route.query.mode === 'shots') selectedMode.value = 'shots' })
onMounted(() => {
  // 绘图页「去分镜短片」深链：进入分镜模式并清掉 query（一次性消费）。
  if (route.query.mode === 'shots') {
    selectedMode.value = 'shots'
    void router.replace({ query: {} })
  }
  void loadStatus()
  void (async () => {
    // 草稿先回、跨页上下文后覆盖（F1：ctx 是更新的明确意图，优先级更高）。
    // 分镜模式下草稿由 ShotListEditor 自己的分镜草稿承担，这里跳过。
    if (selectedMode.value !== 'shots') {
      const { firstFrameLost, lastFrameLost } = await videoDraftTools.restoreDraft()
      if (firstFrameLost || lastFrameLost) {
        statusError.value = '草稿已恢复，但部分帧图原文件已失效，请重新选择对应图片'
      }
    }
    consumeVideoCtx()
    // 任务重连（F1）：离页不丢任务——按 jobId 拉回真实状态并恢复轮询。
    const reconnect = await videoDraftTools.reconnectTask()
    if (reconnect.kind === 'job') {
      job.value = reconnect.job
      schedulePoll()
    } else if (reconnect.kind === 'lost') {
      statusError.value = '上次任务已随网关重启中断，结果无法找回；草稿已保留，可重新提交'
    }
  })()
})
useTrackedTask(() => ({ kind: 'video', title: '视频创作', route: '/video-studio', resultRoute: job.value?.status === 'succeeded' ? '/video-studio' : undefined, status: submitting.value || jobActive.value ? 'running' : job.value?.status === 'succeeded' ? 'succeeded' : job.value?.status === 'failed' ? 'failed' : job.value?.status === 'cancelled' ? 'cancelled' : 'idle', progress: progressPercent.value, message: job.value?.error || statusError.value || '' }), { cancel: cancelJob })
onBeforeUnmount(() => {
  disposed = true
  stopDraftWatch()
  window.clearTimeout(pollTimer)
  if (videoImageUrl.value) URL.revokeObjectURL(videoImageUrl.value)
  if (lastFrameUrl.value) URL.revokeObjectURL(lastFrameUrl.value)
})
</script>

<style scoped src="@/assets/css/video-studio-view.css"></style>
