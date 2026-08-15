<template>
  <article class="video-studio page">
    <WorkspaceArchiveBar
      chapter="14"
      title="MOTION STUDIO"
      :subtitle="activeModel?.label || 'LOCAL VIDEO PIPELINE'"
      :status="archiveStatus"
      :state="archiveState"
      shape="frame"
    />

    <header class="video-header">
      <div>
        <div class="page-kicker">Local AI Video</div>
        <h1 class="page-title">AI 视频创作</h1>
        <p class="page-subtitle">
          描述一段动态镜头的叙事意图，工坊将自动调度稳定的本地视频工作流。复杂参数与推理链路尽归后台，留给您最纯粹的导演视界。
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
        :disabled="!mode.ready"
        @click="selectedMode = mode.id"
      >
        <span class="video-mode-icon"><ArchiveIcon :name="mode.icon" /></span>
        <span>
          <strong>{{ mode.label }}</strong>
          <small>{{ mode.description }}</small>
        </span>
        <em>{{ mode.ready ? '可用' : '后续接入' }}</em>
      </button>
    </section>

    <div class="video-workspace">
      <div class="video-creation-column">
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
            生成时后端会自动附加官方 I2VA 首帧指令（&lt;Picture 1&gt;）；画幅默认「跟随原图」，按首帧比例自动匹配画布，避免拉伸变形。
          </p>
        </section>

        <section class="video-panel video-brief-panel">
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

        <section class="video-panel">
          <div class="video-panel-heading">
            <div>
              <span class="video-step">02 · 成片方向</span>
              <h2>控制节奏，不控制节点</h2>
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
            <ul v-if="activeModel.missing.length" class="video-missing-list">
              <li v-for="file in activeModel.missing" :key="file"><code>{{ file }}</code></li>
            </ul>
            <p v-if="activeModel.missing.length && activeModel.executable" class="video-install-note">
              ComfyUI 节点已支持；安装以上权重后即可启用生成按钮。
            </p>
            <p v-else-if="activeModel.missing.length" class="video-install-note">
              以上是该路线的最小模型组合；应用配方与真实 GPU 验证完成前保持不可生成。
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

        <section class="video-panel video-queue-panel" aria-live="polite">
          <div class="video-panel-heading video-panel-heading--compact">
            <div>
              <span class="video-step">任务队列</span>
              <h2>当前成片</h2>
            </div>
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
              <i></i>
            </div>
            <p v-if="job.error" class="video-inline-message error">{{ job.error }}</p>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ArchiveIcon, { type ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import {
  cancelVideoJob,
  createVideoJob,
  fetchVideoJob,
  fetchVideoStatus,
  uploadVideoImage,
  type VideoDefaults,
  type VideoJob,
  type VideoMode,
  type VideoStatusResponse,
} from '@/api/videoApi'
import { imgGet } from '@/composables/useImageStore'
import { VIDEO_CTX_KEY, type VideoCtxPayload } from '@/composables/useVideoBridge'
import { useSceneStore } from '@/stores/sceneStore'

const modes: Array<{ id: VideoMode; label: string; description: string; ready: boolean; icon: ArchiveIconName }> = [
  { id: 'text', label: '文字成片', description: '一句镜头描述直接生成短片', ready: true, icon: 'play' },
  { id: 'image', label: '图片动起来', description: '绘图页「出视频」自动带入首帧，锁定角色与场景', ready: true, icon: 'image' },
  { id: 'first-last-frame', label: '首尾帧过渡', description: '锁定开始与结束画面', ready: false, icon: 'gallery' },
]

const aspectOptions = computed(() => {
  const base: Array<{ id: VideoDefaults['aspectRatio']; label: string }> = [
    { id: 'landscape', label: '横屏' },
    { id: 'portrait', label: '竖屏' },
    { id: 'square', label: '方形' },
  ]
  if (selectedMode.value === 'image') {
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
const durationOptions: Array<VideoDefaults['duration']> = [3, 5]

const selectedMode = ref<VideoMode>('text')
const prompt = ref('')
const negative = ref('')
const selectedModelId = ref('wan2.2-ti2v-5b')
const aspectRatio = ref<VideoDefaults['aspectRatio']>('landscape')
const quality = ref<VideoDefaults['quality']>('standard')
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

// ── 图片动起来（I2VA）状态：首帧来自绘图页「出视频」的跨页上下文 ────────────
const sceneStore = useSceneStore()
const videoImageId = ref('')
const videoImageUrl = ref('')
const uploadingImage = ref(false)

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
const canGenerate = computed(() => (selectedMode.value === 'text' || (selectedMode.value === 'image' && videoImageId.value))
  && prompt.value.trim().length >= 8
  && prompt.value.length <= 4000
  && parsedSeed.value !== null
  && status.value?.online === true
  && activeModel.value?.available === true
  && !submitting.value
  && !jobActive.value)
const submitTitle = computed(() => {
  if (jobActive.value) return '已有视频正在生成'
  if (!status.value?.online) return '先启动 ComfyUI'
  if (!activeModel.value?.available) return '先安装本地视频权重'
  if (selectedMode.value === 'image' && !videoImageId.value) return '先带入一张首帧图'
  if (prompt.value.trim().length < 8) return '写下一个完整的镜头'
  if (parsedSeed.value === null) return 'Seed 格式不正确'
  return `${duration.value} 秒 · ${activeModel.value.label} · 本地生成`
})
const submitDescription = computed(() => {
  if (jobActive.value) return '视频任务耗时较长，为避免显存争抢，当前只允许一个页面任务。'
  if (!status.value?.online) return '控制面板启动 ComfyUI 后，回到这里重新检测即可。'
  if (!activeModel.value?.available) return '页面与原生节点已经就绪，缺失文件会在右侧明确列出。'
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
  } catch (error) {
    statusError.value = error instanceof Error ? error.message : '视频环境检测失败'
  } finally {
    statusLoading.value = false
  }
}

// ── 绘图页「出视频」跨页上下文（一次性消费）───────────────────────────────
function consumeVideoCtx() {
  let raw: string | null = null
  try { raw = sessionStorage.getItem(VIDEO_CTX_KEY) } catch { return }
  if (!raw) return
  try { sessionStorage.removeItem(VIDEO_CTX_KEY) } catch { /* 忽略 */ }
  let ctx: VideoCtxPayload
  try { ctx = JSON.parse(raw) as VideoCtxPayload } catch { return }
  if (!ctx || typeof ctx.imageId !== 'string' || !ctx.imageId) return
  void applyVideoCtx(ctx)
}

async function applyVideoCtx(ctx: VideoCtxPayload) {
  try {
    const blob = await imgGet(ctx.imageId)
    if (blob) {
      if (videoImageUrl.value) URL.revokeObjectURL(videoImageUrl.value)
      videoImageUrl.value = URL.createObjectURL(blob)
      videoImageId.value = ctx.imageId
    }
  } catch { /* 图失效则不挂预览，上下文其余部分照常 */ }
  selectedMode.value = 'image'
  // 首帧比例跟随原图，避免固定画幅拉伸（如 832x1216 出图 → 480x832 画布会变形）。
  aspectRatio.value = 'original'
  const composed = composeVideoPrompt(ctx)
  if (composed && composed.trim().length >= 4) prompt.value = composed
}

/**
 * 跨页上下文 → 视频提示词（确定性组装，不做 tag 翻译）：
 * 1. 实际出图提示词（ctx.prompt，跟随用户对词条/角色/场景的最新修改）直接作为视频主描述；
 * 2. prompt 为空时回退用户写的 story；
 * 3. story 为空时，用场景预设的结构化字段：description（场景）+ action（动作）+ lighting（光线）；
 * 4. I2VA 首帧图已在后端按官方规范锁定角色/服装/场景（<Picture 1> 指令），
 *    身份描述如与画面冲突可在文本框手动删减，这里只做搬运不做裁剪。
 */
function composeVideoPrompt(ctx: VideoCtxPayload): string {
  const prompt = (ctx.prompt || '').trim()
  if (prompt) return prompt
  const story = (ctx.story || '').trim()
  if (story) return story
  if (ctx.blueprintId) {
    const bp = sceneStore.sceneBlueprints.find(item => item.id === ctx.blueprintId)
    if (bp) {
      return [bp.description, bp.action, bp.lighting].filter(Boolean).join('，')
    }
  }
  return ''
}

function clearFirstFrame() {
  if (videoImageUrl.value) URL.revokeObjectURL(videoImageUrl.value)
  videoImageUrl.value = ''
  videoImageId.value = ''
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('图片编码失败'))
    reader.readAsDataURL(blob)
  })
}

async function submitVideo() {
  if (!canGenerate.value) return
  submitting.value = true
  try {
    let image: string | undefined
    if (selectedMode.value === 'image') {
      const blob = videoImageId.value ? await imgGet(videoImageId.value) : null
      if (!blob) throw new Error('首帧图片读取失败，请重新带入')
      uploadingImage.value = true
      const upload = await uploadVideoImage(await blobToBase64(blob))
      image = upload.name
    }
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
      image,
    })
    job.value = response.job
    schedulePoll()
  } catch (error) {
    statusError.value = error instanceof Error ? error.message : '视频任务提交失败'
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

onMounted(() => {
  void loadStatus()
  consumeVideoCtx()
})
onBeforeUnmount(() => {
  disposed = true
  window.clearTimeout(pollTimer)
  if (videoImageUrl.value) URL.revokeObjectURL(videoImageUrl.value)
})
</script>

<style scoped>
.video-studio {
  --page-max: 1480px;
  width: min(var(--page-max), calc(100% - clamp(28px, 5vw, 72px)));
  margin: 0 auto;
  padding: clamp(20px, 3vw, 36px) 0 var(--s-8);
}
.video-header {
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  align-items:end;
  gap:var(--s-5);
  margin:var(--s-5) 0;
}
.video-header .page-subtitle { max-width:760px; }
.video-header .archive-icon { width:1rem; }
.video-mode-strip { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s-3); margin-bottom:var(--s-5); }
.video-mode-card {
  display:grid;
  grid-template-columns:auto minmax(0,1fr) auto;
  align-items:center;
  gap:var(--s-3);
  min-height:82px;
  padding:var(--s-3);
  border:1px solid var(--border-soft);
  border-radius:var(--r-lg);
  background:color-mix(in srgb,var(--bg-surface) 86%,transparent);
  color:var(--text-secondary);
  text-align:left;
  cursor:pointer;
  transition:border-color var(--motion-hover),background var(--motion-hover),transform var(--motion-press) var(--ease-out);
}
.video-mode-card:active:not(:disabled) { transform:scale(.98); }
.video-mode-card.active { border-color:var(--accent); background:linear-gradient(135deg,var(--accent-soft),var(--bg-surface)); color:var(--text-primary); }
.video-mode-card:disabled { opacity:.58; cursor:not-allowed; }
.video-mode-card strong,.video-mode-card small { display:block; }
.video-mode-card small { margin-top:4px; color:var(--text-muted); font-size:var(--fs-label-xs); line-height:1.45; }
.video-mode-card em { color:var(--text-muted); font:650 var(--fs-mono-xs) var(--font-mono); font-style:normal; }
.video-mode-card.active em { color:var(--accent); }
.video-mode-icon { display:grid; place-items:center; width:42px; height:42px; border-radius:var(--r-md); background:var(--bg-elevated); color:var(--accent); }
.video-mode-icon .archive-icon { width:22px; }
.video-workspace { display:grid; grid-template-columns:minmax(0,1.7fr) minmax(320px,.78fr); align-items:start; gap:var(--s-5); }
.video-creation-column,.video-side-column { display:grid; gap:var(--s-4); min-width:0; }
.video-side-column { position:sticky; top:76px; }
.video-panel,.video-submit-panel,.video-result-panel {
  position:relative;
  padding:clamp(18px,2.4vw,28px);
  border:1px solid var(--border-soft);
  border-radius:var(--r-xl);
  background:color-mix(in srgb,var(--bg-surface) 90%,transparent);
  box-shadow:var(--shadow-glass-sm);
}
.video-panel::before,.video-result-panel::before {
  position:absolute; top:-1px; left:var(--s-5); width:44px; height:1px;
  background:linear-gradient(90deg,var(--archive-cyan),transparent); content:"";
}
.video-panel-heading,.video-result-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--s-4); margin-bottom:var(--s-4); }
.video-panel-heading h2,.video-result-heading h2 { margin:4px 0 0; font-size:var(--fs-title-sm); }
.video-panel-heading--compact { margin-bottom:var(--s-3); }
.video-step { color:var(--accent); font:700 var(--fs-mono-xs) var(--font-mono); letter-spacing:.12em; text-transform:uppercase; }
.video-count { color:var(--text-muted); font:600 var(--fs-mono-xs) var(--font-mono); }
.video-count[data-warning="true"] { color:var(--warning-text); }
.video-prompt { min-height:190px; font-size:var(--fs-title-xs); line-height:1.8; }
.video-prompt-guidance { display:flex; flex-wrap:wrap; gap:var(--s-2); margin-top:var(--s-3); }
.video-prompt-guidance span { padding:3px var(--s-2); border:1px solid var(--border-soft); border-radius:var(--r-pill); color:var(--text-muted); font-size:var(--fs-label-xs); }
.video-first-frame-panel .video-panel-heading { align-items:center; }
.video-first-frame {
  display:block;
  width:100%;
  max-height:min(46vh,420px);
  object-fit:contain;
  border:1px solid var(--border-soft);
  border-radius:var(--r-lg);
  background:var(--bg-deep);
}
.video-choice-group { display:grid; gap:var(--s-2); }
.video-choice-grid { display:grid; gap:var(--s-2); }
.video-choice-grid--three { grid-template-columns:repeat(3,minmax(0,1fr)); }
.video-choice-grid button {
  display:grid; grid-template-columns:auto 1fr; align-items:center; gap:var(--s-3);
  min-height:70px; padding:var(--s-3);
  border:1px solid var(--border-soft); border-radius:var(--r-md);
  background:var(--bg-deep); color:var(--text-secondary); text-align:left; cursor:pointer;
  transition:border-color var(--motion-hover),background var(--motion-hover),transform var(--motion-press) var(--ease-out);
}
.video-choice-grid button:active { transform:scale(.98); }
.video-choice-grid button.active { border-color:var(--accent); background:var(--accent-soft); color:var(--text-primary); }
.video-choice-grid strong,.video-choice-grid small { display:block; }
.video-choice-grid small { color:var(--text-muted); font:500 var(--fs-mono-xs) var(--font-mono); }
.aspect-glyph { display:block; border:1.5px solid currentColor; border-radius:var(--r-sm); color:var(--archive-cyan); }
.aspect-glyph[data-aspect="landscape"] { width:30px; height:17px; }
.aspect-glyph[data-aspect="portrait"] { width:17px; height:30px; }
.aspect-glyph[data-aspect="square"] { width:25px; height:25px; }
.video-choice-pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--s-3); margin-top:var(--s-4); }
.video-duration-row { display:grid; grid-template-columns:auto auto minmax(0,1fr); align-items:center; gap:var(--s-3); margin-top:var(--s-4); }
.video-quality-row { display:grid; gap:var(--s-2); margin-top:var(--s-4); }
.video-quality-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s-2); }
.video-quality-grid button {
  display:grid; gap:4px; min-height:66px; padding:var(--s-2) var(--s-3);
  border:1px solid var(--border-soft); border-radius:var(--r-md);
  background:var(--bg-deep); color:var(--text-secondary); text-align:left; cursor:pointer;
  transition:border-color var(--motion-hover),background var(--motion-hover),transform var(--motion-press) var(--ease-out);
}
.video-quality-grid button:active { transform:scale(.98); }
.video-quality-grid button.active { border-color:var(--accent); background:var(--accent-soft); color:var(--text-primary); }
.video-quality-grid strong { font-size:var(--fs-body-sm); }
.video-quality-grid small { color:var(--text-muted); font-size:var(--fs-label-xs); line-height:1.4; }
.video-quality-grid em { color:var(--accent); font:600 var(--fs-mono-xs) var(--font-mono); font-style:normal; }
.video-segmented { display:inline-flex; padding:3px; border:1px solid var(--border-soft); border-radius:var(--r-md); background:var(--bg-deep); }
.video-segmented button { min-height:32px; padding:0 var(--s-3); border:0; border-radius:var(--r-sm); background:transparent; color:var(--text-muted); cursor:pointer; }
.video-segmented button.active { background:var(--accent); color:var(--text-inverse); }
.video-duration-note { color:var(--text-muted); font-size:var(--fs-label-xs); }
.video-advanced { margin-top:var(--s-4); padding-top:var(--s-4); border-top:1px solid var(--border-soft); }
.video-advanced summary { color:var(--text-secondary); font-weight:700; cursor:pointer; }
.video-advanced-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(220px,.65fr); gap:var(--s-3); margin-top:var(--s-3); }
.video-submit-panel { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:var(--s-4); background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 7%,transparent),var(--bg-surface)); }
.video-submit-panel[data-ready="true"] { border-color:color-mix(in srgb,var(--accent) 50%,var(--border-soft)); box-shadow:var(--shadow-md); }
.video-submit-panel strong { font-size:var(--fs-title-xs); }
.video-submit-panel p { margin:4px 0 0; font-size:var(--fs-body-sm); line-height:1.55; }
.video-submit-panel .archive-icon { width:1.1rem; }
.video-status-pill { padding:3px var(--s-2); border-radius:var(--r-pill); font:700 var(--fs-mono-xs) var(--font-mono); }
.video-status-pill[data-state="ready"] { background:color-mix(in srgb,var(--success) 14%,transparent); color:var(--success-text); }
.video-status-pill[data-state="missing"],.video-status-pill[data-state="checking"],.video-status-pill[data-state="planned"] { background:color-mix(in srgb,var(--warning) 14%,transparent); color:var(--warning-text); }
.video-status-pill[data-state="offline"] { background:color-mix(in srgb,var(--danger) 12%,transparent); color:var(--danger-text); }
.video-model-summary { display:grid; gap:4px; }
.video-model-summary span { color:var(--accent); font:700 var(--fs-mono-xs) var(--font-mono); }
.video-model-summary p { margin:4px 0 0; font-size:var(--fs-body-sm); line-height:1.55; }
.video-missing-list { display:grid; gap:var(--s-1); margin:var(--s-3) 0; padding:0; list-style:none; }
.video-missing-list code { display:block; overflow-wrap:anywhere; color:var(--warning-text); }
.video-install-note { margin:0 0 var(--s-3); color:var(--text-muted); font-size:var(--fs-label-xs); line-height:1.55; }
.video-route-note { display:grid; gap:4px; margin-top:var(--s-3); padding:var(--s-3); border:1px solid color-mix(in srgb,var(--editorial-gold) 36%,var(--border-soft)); border-radius:var(--r-md); background:color-mix(in srgb,var(--editorial-gold) 7%,transparent); }
.video-route-note strong { color:var(--warning-text); font-size:var(--fs-label-xs); }
.video-route-note span { color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.55; }
.video-model-catalog { display:grid; gap:var(--s-2); }
.video-model-row {
  display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:var(--s-3);
  width:100%; padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-md);
  background:var(--bg-deep); color:var(--text-secondary); text-align:left; cursor:pointer;
}
.video-model-row.active { border-color:var(--accent); background:var(--accent-soft); }
.video-model-row strong,.video-model-row small { display:block; }
.video-model-row small { margin-top:3px; color:var(--text-muted); font-size:var(--fs-label-xs); line-height:1.45; }
.video-model-row em { font:700 var(--fs-mono-xs) var(--font-mono); font-style:normal; }
.video-model-row em[data-state="ready"] { color:var(--success-text); }
.video-model-row em[data-state="missing"] { color:var(--warning-text); }
.video-model-row em[data-state="planned"] { color:var(--text-muted); }
.video-queue-empty { display:flex; align-items:center; gap:var(--s-3); color:var(--text-muted); font-size:var(--fs-body-sm); line-height:1.55; }
.video-queue-empty .archive-icon { flex:0 0 auto; width:26px; color:var(--accent); }
.video-job-head { display:flex; justify-content:space-between; gap:var(--s-3); }
.video-job-head time { color:var(--text-muted); font:500 var(--fs-mono-xs) var(--font-mono); }
.video-job-state { font-weight:800; }
.video-job-state[data-state="running"],.video-job-state[data-state="queued"],.video-job-state[data-state="cancelling"] { color:var(--accent); }
.video-job-state[data-state="succeeded"] { color:var(--success-text); }
.video-job-state[data-state="failed"],.video-job-state[data-state="cancelled"] { color:var(--danger-text); }
.video-job-meta { display:flex; flex-wrap:wrap; gap:var(--s-2); margin:var(--s-3) 0; }
.video-job-meta span { padding:3px var(--s-2); border:1px solid var(--border-soft); border-radius:var(--r-pill); color:var(--text-muted); font:600 var(--fs-mono-xs) var(--font-mono); }
.video-progress { height:3px; margin:var(--s-3) 0; overflow:hidden; border-radius:var(--r-pill); background:var(--bg-deep); }
.video-progress i { display:block; width:38%; height:100%; background:linear-gradient(90deg,transparent,var(--archive-cyan),var(--accent),transparent); animation:video-progress 1.1s linear infinite; }
.video-inline-message { padding:var(--s-2) var(--s-3); border-radius:var(--r-md); font-size:var(--fs-body-sm); line-height:1.55; }
.video-inline-message.error { background:color-mix(in srgb,var(--danger) 10%,transparent); color:var(--danger-text); }
.video-result-panel { margin-top:var(--s-5); }
.video-player { display:block; width:100%; max-height:min(72vh,760px); border-radius:var(--r-lg); background:var(--bg-deep); }
.video-review-checklist { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:var(--s-2); margin-top:var(--s-3); }
.video-review-checklist span { padding:var(--s-2); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-muted); font-size:var(--fs-label-xs); text-align:center; }
@keyframes video-progress { from{transform:translateX(-110%)} to{transform:translateX(300%)} }
@media (prefers-reduced-motion:reduce) { .video-progress i { animation:none; width:100%; } }
@media (max-width:1050px) {
  .video-workspace { grid-template-columns:1fr; }
  .video-side-column { position:static; grid-template-columns:repeat(2,minmax(0,1fr)); }
  .video-queue-panel { grid-column:1 / -1; }
}
@media (max-width:760px) {
  .video-studio { width:min(100% - 24px,var(--page-max)); }
  .video-header,.video-submit-panel { grid-template-columns:1fr; align-items:start; }
  .video-mode-strip,.video-choice-grid--three,.video-side-column,.video-advanced-grid,.video-quality-grid { grid-template-columns:1fr; }
  .video-mode-card { min-height:70px; }
  .video-choice-pair { grid-template-columns:1fr; }
  .video-duration-row { grid-template-columns:1fr; align-items:start; }
  .video-submit-panel .btn { width:100%; }
  .video-review-checklist { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
</style>
