<template>
  <section class="shot-editor">
    <div v-if="!h3Ready" class="video-panel shot-blocked">
      <p>分镜短片模式需要 MiniMax H3 权重就绪（支持首尾帧衔接与原生对白）。安装完成后点击「重新检测」即可使用。</p>
    </div>

    <template v-else>
      <section class="video-panel">
        <div class="video-panel-heading">
          <div>
            <span class="video-step">01 · 整批方向</span>
            <h2>画幅统一，镜头自由</h2>
          </div>
        </div>

        <div class="video-choice-group">
          <span class="field-label">画幅（整批统一，拼接成片需要）</span>
          <div class="video-segmented" role="group" aria-label="选择分镜画幅">
            <button
              v-for="item in aspectOptions"
              :key="item.id"
              type="button"
              :class="{ active: aspectRatio === item.id }"
              :aria-pressed="aspectRatio === item.id"
              @click="aspectRatio = item.id"
            >{{ item.label }}</button>
          </div>
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
        </div>

        <label class="shot-toggle">
          <input v-model="linkLastFrame" type="checkbox" />
          <span>
            <strong>自动衔接上一镜尾帧</strong>
            <small>本镜有首帧时作为尾帧（FL2VA 桥接），无首帧时续接为开头（I2VA 续接），跨镜动作与空间更连续。</small>
          </span>
        </label>

        <label class="field shot-identity-field">
          <span class="field-label">角色锚点（逐镜注入提示词开头，跨镜一致性关键）</span>
          <div class="shot-identity-row">
            <textarea
              v-model="identityCard"
              class="textarea"
              rows="2"
              maxlength="600"
              placeholder="英文身份锚点：a girl with long silver hair and red eyes, wearing a dark coat …"
            ></textarea>
            <select v-model="characterId" class="select" aria-label="从热门角色填充角色锚点">
              <option value="">热门角色 → 自动填入</option>
              <option v-for="character in popularCharacters" :key="character.id" :value="character.id">
                {{ character.displayName }}
              </option>
            </select>
          </div>
        </label>
      </section>

      <section class="video-panel">
        <div class="video-panel-heading">
          <div>
            <span class="video-step">02 · 分镜清单</span>
            <h2>{{ shots.length }} 个镜头 · 建议 1–2 分钟片拆 8–15 镜</h2>
          </div>
        </div>
        <div class="shot-toolbar">
          <select v-model="sceneFillId" class="select" aria-label="从场景蓝图快速填充镜头描述">
            <option value="">场景蓝图 → 填入空镜头</option>
            <option v-for="blueprint in sceneBlueprints" :key="blueprint.id" :value="blueprint.id">
              {{ blueprint.title }}
            </option>
          </select>
          <button class="btn btn-ghost" type="button" @click="addShot">＋ 添加镜头</button>
          <button class="btn btn-ghost" type="button" :disabled="!shots.length" @click="clearShots">清空</button>
        </div>

        <article v-for="(shot, index) in shots" :key="index" class="shot-row">
          <header class="shot-row-head">
            <span class="shot-index">镜头 {{ index + 1 }}</span>
            <span v-if="serverShot(index)" class="shot-row-status" :data-state="serverShot(index)?.status">
              {{ shotStatusLabel(serverShot(index)?.status) }}
            </span>
            <div class="shot-row-actions">
              <button type="button" :disabled="index === 0 || batchActive" title="上移" @click="moveShot(index, -1)">↑</button>
              <button type="button" :disabled="index === shots.length - 1 || batchActive" title="下移" @click="moveShot(index, 1)">↓</button>
              <button type="button" :disabled="batchActive" title="删除镜头" @click="removeShot(index)">✕</button>
            </div>
          </header>

          <div class="shot-fields">
            <label class="field shot-field-prompt">
              <span class="shot-field-head">
                <span class="field-label">画面描述</span>
                <span class="shot-count" :data-warning="shot.prompt.length > 900 || undefined">{{ shot.prompt.length }} / 4000</span>
              </span>
              <textarea
                v-model="shot.prompt"
                class="textarea"
                rows="3"
                maxlength="4000"
                :disabled="batchActive"
                placeholder="写清：主体动作、环境、光线、镜头意图；身份细节交给角色锚点。"
              ></textarea>
            </label>

            <label class="field shot-field-dialogue">
              <span class="field-label">对白（H3 原生语音 · 口型同步）</span>
              <input
                v-model="shot.dialogue"
                class="input"
                maxlength="300"
                :disabled="batchActive"
                placeholder="可选。单句 ≤20 字更稳，例如：我在这站下车。"
              />
            </label>

            <div class="shot-selects">
              <label class="field">
                <span class="field-label">景别</span>
                <select v-model="shot.shotSize" class="select" :disabled="batchActive">
                  <option value="">默认</option>
                  <option value="wide">全景</option>
                  <option value="medium">中景</option>
                  <option value="closeup">特写</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">镜头运动</span>
                <select v-model="shot.camera" class="select" :disabled="batchActive">
                  <option v-for="item in cameraOptions" :key="item.id" :value="item.id">{{ item.label }}</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">主体运动</span>
                <select v-model="shot.motion" class="select" :disabled="batchActive">
                  <option v-for="item in motionOptions" :key="item.id" :value="item.id">{{ item.label }}</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">时长</span>
                <select v-model="shot.duration" class="select" :disabled="batchActive">
                  <option :value="3">3 秒</option>
                  <option :value="5">5 秒（推荐）</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">Seed</span>
                <input v-model="shot.seedText" class="input input-mono" inputmode="numeric" :disabled="batchActive" placeholder="留空随机" />
              </label>
            </div>

            <div class="shot-frame-row">
              <img v-if="shot.imageUrl" class="shot-frame" :src="shot.imageUrl" alt="本镜首帧" />
              <button v-else class="btn btn-ghost" type="button" :disabled="batchActive" @click="pickFrame(index)">
                上传首帧（可选 · 锁定本镜构图）
              </button>
              <button v-if="shot.imageUrl" class="btn btn-ghost" type="button" :disabled="batchActive" @click="clearFrame(index)">
                移除首帧
              </button>
              <span v-if="index > 0 && linkLastFrame" class="shot-chain-note">自动衔接镜头 {{ index }} 尾帧</span>
              <input ref="frameInputs" type="file" accept="image/png,image/jpeg,image/webp" class="shot-frame-input" @change="onFramePicked(index, $event)" />
            </div>
          </div>

          <p v-if="serverShot(index)?.error" class="shot-error">{{ serverShot(index)?.error }}</p>
          <video
            v-if="serverShot(index)?.resultUrl"
            class="shot-result"
            :src="serverShot(index)?.resultUrl ?? undefined"
            controls
            playsinline
            preload="metadata"
          ></video>
          <div v-if="serverShot(index)?.status === 'failed'" class="shot-retry">
            <button class="btn btn-primary" type="button" @click="retryShotAt(index)">重抽本镜（同 Seed）</button>
          </div>
        </article>

        <p v-if="shots.length === 0" class="shot-empty">
          还没有镜头。添加镜头后用「场景蓝图」快速填充，或直接逐镜写描述。
        </p>
      </section>

      <section class="video-panel shot-submit-panel" :data-ready="canSubmit || undefined">
        <div>
          <strong>{{ submitTitle }}</strong>
          <p>{{ submitDescription }}</p>
        </div>
        <div class="shot-submit-actions">
          <button v-if="batchActive" class="btn btn-danger" type="button" :disabled="cancelling" @click="cancelBatch">
            {{ cancelling ? '正在取消…' : '取消整批' }}
          </button>
          <template v-else>
            <button
              v-if="batch && batch.shots.some((shot) => shot.status === 'failed')"
              class="btn btn-primary"
              type="button"
              @click="retryAllFailed"
            >重抽失败镜头</button>
            <button
              v-if="batch && canConcat"
              class="btn btn-primary"
              type="button"
              :disabled="concating"
              @click="concatBatch"
            >{{ concating ? '正在拼接…' : '拼接成片' }}</button>
            <button class="btn btn-primary btn-lg" type="button" :disabled="!canSubmit" @click="submitBatch">
              {{ submitting ? '正在提交…' : '生成全部镜头' }}
            </button>
          </template>
        </div>
      </section>

      <section v-if="batch" class="video-panel shot-progress-panel" aria-live="polite">
        <div class="video-panel-heading">
          <div>
            <span class="video-step">03 · 批量进度</span>
            <h2>{{ batchStatusLabel }}</h2>
          </div>
          <span class="shot-progress-stats">{{ batch.progress.succeeded }} / {{ batch.progress.total }} 镜成功 · {{ batch.progress.failed }} 失败</span>
        </div>
        <div class="video-progress"><i :style="{ width: progressPercent + '%' }"></i></div>
        <p class="video-install-note">
          {{ batch.linkLastFrame ? '镜头间已自动衔接上一镜尾帧；' : '已关闭尾帧衔接；' }}
          单镜约 2.5–6 分钟（standard 档），可离开页面，任务在后台继续。
        </p>
        <template v-if="batch.concatUrl">
          <div class="shot-concat-heading">
            <strong>整片预览</strong>
            <a class="btn btn-ghost" :href="batch.concatUrl" download>下载整片 MP4</a>
          </div>
          <video class="shot-concat-player" :src="batch.concatUrl" controls playsinline preload="metadata"></video>
        </template>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  cancelVideoBatch,
  concatVideoBatch,
  createVideoBatch,
  fetchVideoBatch,
  retryVideoShot,
  uploadVideoImage,
  type VideoBatch,
  type VideoBatchStatus,
  type VideoDefaults,
  type VideoQuality,
  type VideoShotSize,
  type VideoStatusResponse,
} from '@/api/videoApi'
import { useSceneStore } from '@/stores/sceneStore'

const props = defineProps<{
  status: VideoStatusResponse | null
}>()

const sceneStore = useSceneStore()
const sceneBlueprints = computed(() => sceneStore.sceneBlueprints)
const popularCharacters = computed(() => sceneStore.popularCharacters)

const h3Ready = computed(() =>
  props.status?.models.some((model) => model.id === 'minimax-h3' && model.available) === true)

const aspectOptions: Array<{ id: VideoBatch['aspectRatio']; label: string }> = [
  { id: 'landscape', label: '横屏 16:9' },
  { id: 'portrait', label: '竖屏 9:16' },
  { id: 'square', label: '方形 1:1' },
]
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

interface ShotDraft {
  prompt: string
  dialogue: string
  shotSize: VideoShotSize | ''
  camera: VideoDefaults['camera']
  motion: VideoDefaults['motion']
  duration: 3 | 5
  seedText: string
  imageName: string
  imageUrl: string
}

const aspectRatio = ref<VideoBatch['aspectRatio']>('landscape')
const quality = ref<VideoQuality>('standard')
const linkLastFrame = ref(true)
const identityCard = ref('')
const characterId = ref('')
const sceneFillId = ref('')
const shots = ref<ShotDraft[]>([])
const frameInputs = ref<HTMLInputElement[]>([])

const batch = ref<VideoBatch | null>(null)
const submitting = ref(false)
const cancelling = ref(false)
const concating = ref(false)
const batchError = ref('')
let pollTimer = 0
let disposed = false

const batchActive = computed(() => batch.value?.status === 'running')
const canSubmit = computed(() =>
  shots.value.length > 0
  && shots.value.every((shot) => shot.prompt.trim().length >= 8 && shot.prompt.trim().length <= 4000)
  && !submitting.value
  && !batchActive.value
  && props.status?.online === true)
const canConcat = computed(() =>
  batch.value !== null
  && (batch.value.progress.succeeded >= 2)
  && !batch.value.concatAvailable
  && batch.value.status === 'done')
const progressPercent = computed(() => {
  const total = batch.value?.progress.total ?? 0
  if (!total) return 0
  const done = batch.value?.progress.succeeded ?? 0
  const failed = batch.value?.progress.failed ?? 0
  return Math.min(100, Math.round(((done + failed) / total) * 100))
})
const submitTitle = computed(() => {
  if (batchActive.value) return '整批正在生成中'
  if (!props.status?.online) return '先启动 ComfyUI'
  if (!h3Ready.value) return '先安装 MiniMax H3 权重'
  if (shots.value.length === 0) return '先添加镜头'
  if (!canSubmit.value) return `${shots.value.filter((shot) => shot.prompt.trim().length < 8).length} 个镜头描述不完整`
  return `${shots.value.length} 镜 · ${aspectRatio.value === 'landscape' ? '横屏' : aspectRatio.value === 'portrait' ? '竖屏' : '方形'} · ${qualityLabel.value}`
})
const submitDescription = computed(() => {
  if (batchActive.value) return '逐镜串行排队，可离开页面；失败镜头可单独重抽。'
  if (!props.status?.online) return '控制面板启动 ComfyUI 后，回到这里重新检测即可。'
  return '服务端按官方三段式组装提示词；开启衔接时自动抽取上一镜尾帧。'
})
const batchStatusLabel = computed(() => ({
  running: '正在逐镜生成…',
  paused: '有镜头失败，可单独重抽',
  done: '全部完成',
  cancelled: '已取消',
})[batch.value?.status ?? 'running'])
const qualityLabel = computed(() =>
  props.status?.qualities.find((item) => item.id === quality.value)?.label ?? quality.value)

function serverShot(index: number) {
  return batch.value?.shots[index] ?? null
}
function shotStatusLabel(status: string | undefined) {
  return ({
    pending: '等待中',
    queued: '排队中',
    running: '生成中',
    succeeded: '已完成',
    failed: '失败',
    cancelled: '已取消',
  })[status ?? 'pending'] ?? '等待中'
}

function addShot() {
  shots.value.push({
    prompt: '',
    dialogue: '',
    shotSize: '',
    camera: 'still',
    motion: 'subtle',
    duration: 5,
    seedText: '',
    imageName: '',
    imageUrl: '',
  })
}
function removeShot(index: number) {
  const shot = shots.value[index]
  if (shot?.imageUrl) URL.revokeObjectURL(shot.imageUrl)
  shots.value.splice(index, 1)
}
function clearShots() {
  shots.value.forEach((shot) => {
    if (shot.imageUrl) URL.revokeObjectURL(shot.imageUrl)
  })
  shots.value = []
}
function moveShot(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= shots.value.length) return
  const [item] = shots.value.splice(index, 1)
  shots.value.splice(target, 0, item)
}

// 角色锚点：热门角色 → identityProse 一键注入（跨镜统一身份描述）。
watch(characterId, (id) => {
  if (!id) return
  const character = popularCharacters.value.find((item) => item.id === id)
  if (character?.identityProse) {
    identityCard.value = character.identityProse
    characterId.value = ''
  }
})

// 场景蓝图 → 填入所有空镜头（用户已写的不覆盖）。
watch(sceneFillId, (id) => {
  if (!id) return
  const blueprint = sceneBlueprints.value.find((item) => item.id === id)
  if (!blueprint) return
  const prose = (blueprint.promptProse || '').trim()
    || [blueprint.description, blueprint.action, blueprint.lighting].filter(Boolean).join('，')
  if (prose) {
    shots.value.forEach((shot) => {
      if (!shot.prompt.trim()) shot.prompt = prose
    })
  }
  sceneFillId.value = ''
})

function pickFrame(index: number) {
  frameInputs.value[index]?.click()
}

async function onFramePicked(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || index >= shots.value.length) return
  if (file.size > 20 * 1024 * 1024) {
    batchError.value = '首帧图片需 ≤20MB'
    return
  }
  try {
    const dataUrl = await readFileAsDataURL(file)
    const comma = dataUrl.indexOf(',')
    if (comma < 0) throw new Error('图片编码失败')
    const upload = await uploadVideoImage(dataUrl.slice(comma + 1))
    const shot = shots.value[index]
    if (shot.imageUrl) URL.revokeObjectURL(shot.imageUrl)
    shot.imageName = upload.name
    shot.imageUrl = URL.createObjectURL(file)
    batchError.value = ''
  } catch (error) {
    batchError.value = error instanceof Error ? error.message : '首帧上传失败'
  }
}

function clearFrame(index: number) {
  const shot = shots.value[index]
  if (shot?.imageUrl) URL.revokeObjectURL(shot.imageUrl)
  if (shot) {
    shot.imageUrl = ''
    shot.imageName = ''
  }
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

function parsedSeed(shot: ShotDraft): number | undefined {
  if (!shot.seedText.trim()) return undefined
  const value = Number(shot.seedText)
  return Number.isSafeInteger(value) && value >= 0 && value <= 0x7fffffff ? value : undefined
}

async function submitBatch() {
  if (!canSubmit.value || !h3Ready.value) return
  submitting.value = true
  batchError.value = ''
  try {
    const response = await createVideoBatch({
      modelId: 'minimax-h3',
      aspectRatio: aspectRatio.value,
      quality: quality.value,
      linkLastFrame: linkLastFrame.value,
      shots: shots.value.map((shot) => {
        const prompt = [identityCard.value.trim(), shot.prompt.trim()].filter(Boolean).join('\n')
        return {
          prompt,
          dialogue: shot.dialogue.trim() || undefined,
          shotSize: shot.shotSize || undefined,
          camera: shot.camera,
          motion: shot.motion,
          duration: shot.duration,
          seed: parsedSeed(shot),
          image: shot.imageName || undefined,
        }
      }),
    })
    batch.value = response.batch
    schedulePoll()
  } catch (error) {
    batchError.value = error instanceof Error ? error.message : '批量提交失败'
  } finally {
    submitting.value = false
  }
}

async function pollBatch() {
  if (!batch.value || disposed) return
  try {
    const response = await fetchVideoBatch(batch.value.id)
    batch.value = response.batch
  } catch (error) {
    batchError.value = error instanceof Error ? error.message : '批量状态读取失败'
  } finally {
    schedulePoll()
  }
}

function schedulePoll() {
  window.clearTimeout(pollTimer)
  if (!batch.value || disposed) return
  if (batch.value.status !== 'running' && batch.value.status !== 'paused') return
  pollTimer = window.setTimeout(() => { void pollBatch() }, 3000)
}

async function cancelBatch() {
  if (!batch.value || cancelling.value) return
  cancelling.value = true
  try {
    const response = await cancelVideoBatch(batch.value.id)
    batch.value = response.batch
  } catch (error) {
    batchError.value = error instanceof Error ? error.message : '整批取消失败'
  } finally {
    cancelling.value = false
  }
}

async function retryShotAt(index: number) {
  if (!batch.value) return
  try {
    const response = await retryVideoShot(batch.value.id, index + 1)
    batch.value = response.batch
    schedulePoll()
  } catch (error) {
    batchError.value = error instanceof Error ? error.message : '重抽失败'
  }
}

async function retryAllFailed() {
  if (!batch.value) return
  for (let index = 0; index < batch.value.shots.length; index += 1) {
    const shot = batch.value.shots[index]
    if (shot.status === 'failed' || shot.status === 'cancelled') {
      try {
        const response = await retryVideoShot(batch.value.id, index + 1)
        batch.value = response.batch
      } catch (error) {
        batchError.value = error instanceof Error ? error.message : '重抽失败'
        return
      }
    }
  }
  schedulePoll()
}

async function concatBatch() {
  if (!batch.value || concating.value) return
  concating.value = true
  try {
    const response = await concatVideoBatch(batch.value.id)
    batch.value = response.batch
  } catch (error) {
    batchError.value = error instanceof Error ? error.message : '拼接失败'
  } finally {
    concating.value = false
  }
}

onBeforeUnmount(() => {
  disposed = true
  window.clearTimeout(pollTimer)
  shots.value.forEach((shot) => {
    if (shot.imageUrl) URL.revokeObjectURL(shot.imageUrl)
  })
})
</script>

<style scoped>
.shot-editor { display: grid; gap: var(--s-4); }
.shot-blocked { color: var(--text-secondary); line-height: 1.7; }

/* ── 面板视觉（组件自包含：video-* 类名在 VideoStudioView 是 scoped 的，
   全局 CSS 没有定义，不能跨组件复用——2026-08-16 截图审查发现面板无边框）── */
.video-panel {
  position: relative;
  padding: clamp(18px, 2.4vw, 28px);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-xl);
  background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
  box-shadow: var(--shadow-glass-sm);
}
.video-panel::before {
  position: absolute; top: -1px; left: var(--s-5); width: 44px; height: 1px;
  background: linear-gradient(90deg, var(--archive-cyan), transparent); content: "";
}
.video-panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-4); margin-bottom: var(--s-4); }
.video-panel-heading h2 { margin: 4px 0 0; font-size: var(--fs-title-sm); }
.video-step { color: var(--accent); font: 700 var(--fs-mono-xs) var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }
.video-choice-group { display: grid; gap: var(--s-2); }
.video-quality-row { display: grid; gap: var(--s-2); margin-top: var(--s-4); }
.video-quality-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s-2); }
.video-quality-grid button {
  display: grid; gap: 4px; min-height: 66px; padding: var(--s-2) var(--s-3);
  border: 1px solid var(--border-soft); border-radius: var(--r-md);
  background: var(--bg-deep); color: var(--text-secondary); text-align: left; cursor: pointer;
  transition: border-color var(--motion-hover), background var(--motion-hover), transform var(--motion-press) var(--ease-out);
}
.video-quality-grid button:active { transform: scale(.98); }
.video-quality-grid button.active { border-color: var(--accent); background: var(--accent-soft); color: var(--text-primary); }
.video-quality-grid strong { font-size: var(--fs-body-sm); }
.video-quality-grid small { color: var(--text-muted); font-size: var(--fs-label-xs); line-height: 1.4; }
.video-quality-grid em { color: var(--accent); font: 600 var(--fs-mono-xs) var(--font-mono); font-style: normal; }
.video-segmented { display: inline-flex; flex-wrap: wrap; padding: 3px; border: 1px solid var(--border-soft); border-radius: var(--r-md); background: var(--bg-deep); }
.video-segmented button { min-height: 32px; padding: 0 var(--s-3); border: 0; border-radius: var(--r-sm); background: transparent; color: var(--text-muted); cursor: pointer; }
.video-segmented button.active { background: var(--accent); color: var(--text-inverse); }
.video-install-note { margin: 0 0 var(--s-3); color: var(--text-muted); font-size: var(--fs-label-xs); line-height: 1.55; }
.video-progress { height: 3px; margin: var(--s-3) 0; overflow: hidden; border-radius: var(--r-pill); background: var(--bg-deep); }
.video-progress i { display: block; height: 100%; background: linear-gradient(90deg, var(--archive-cyan), var(--accent)); transition: width .4s ease; }

.shot-toolbar { display: flex; flex-wrap: wrap; gap: var(--s-2); align-items: center; margin-bottom: var(--s-3); }
.shot-toolbar .select { width: auto; max-width: 300px; flex: 0 1 auto; }
.shot-toggle { display: flex; align-items: flex-start; gap: var(--s-3); margin-top: var(--s-4); padding: var(--s-3); border: 1px solid var(--border-soft); border-radius: var(--r-md); background: var(--bg-deep); cursor: pointer; }
.shot-toggle input { margin-top: 4px; accent-color: var(--accent); }
.shot-toggle strong, .shot-toggle small { display: block; }
.shot-toggle small { margin-top: 3px; color: var(--text-muted); font-size: var(--fs-label-xs); line-height: 1.5; }
.shot-identity-field { display: grid; gap: var(--s-2); margin-top: var(--s-4); }
.shot-identity-row { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: var(--s-2); align-items: start; }
.shot-identity-row .select { align-self: start; }
.shot-row { display: grid; gap: var(--s-3); padding: var(--s-4) 0; border-top: 1px solid var(--border-soft); }
.shot-row:first-of-type { border-top: 0; padding-top: 0; }
.shot-row-head { display: flex; align-items: center; gap: var(--s-3); }
.shot-index { font: 800 var(--fs-title-xs) var(--font-mono); color: var(--accent); }
.shot-row-status { padding: 2px var(--s-2); border-radius: var(--r-pill); font: 700 var(--fs-mono-xs) var(--font-mono); }
.shot-row-status[data-state="running"], .shot-row-status[data-state="queued"] { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
.shot-row-status[data-state="succeeded"] { background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--success-text); }
.shot-row-status[data-state="failed"], .shot-row-status[data-state="cancelled"] { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger-text); }
.shot-row-status[data-state="pending"] { background: var(--bg-elevated); color: var(--text-muted); }
.shot-row-actions { display: flex; gap: var(--s-1); margin-left: auto; }
.shot-row-actions button { min-width: 30px; height: 30px; border: 1px solid var(--border-soft); border-radius: var(--r-sm); background: var(--bg-deep); color: var(--text-secondary); cursor: pointer; }
.shot-row-actions button:disabled { opacity: .4; cursor: not-allowed; }
.shot-fields { display: grid; gap: var(--s-3); }
.shot-field-prompt { display: grid; gap: var(--s-2); }
.shot-field-head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--s-2); }
.shot-count { color: var(--text-muted); font: 600 var(--fs-mono-xs) var(--font-mono); }
.shot-count[data-warning="true"] { color: var(--warning-text); }
.shot-selects { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--s-2); }
.shot-frame-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-2); }
.shot-frame { width: 120px; max-height: 90px; object-fit: contain; border: 1px solid var(--border-soft); border-radius: var(--r-md); background: var(--bg-deep); }
.shot-frame-input { display: none; }
.shot-chain-note { color: var(--text-muted); font-size: var(--fs-label-xs); }
.shot-error { margin: 0; color: var(--danger-text); font-size: var(--fs-body-sm); line-height: 1.55; }
.shot-result { display: block; width: min(100%, 520px); border-radius: var(--r-md); background: var(--bg-deep); }
.shot-retry { display: flex; }
.shot-empty { color: var(--text-muted); font-size: var(--fs-body-sm); line-height: 1.7; }
.shot-submit-panel { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--s-4); background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 7%, transparent), var(--bg-surface)); }
.shot-submit-panel[data-ready="true"] { border-color: color-mix(in srgb, var(--accent) 50%, var(--border-soft)); box-shadow: var(--shadow-md); }
.shot-submit-panel strong { font-size: var(--fs-title-xs); }
.shot-submit-panel p { margin: 4px 0 0; font-size: var(--fs-body-sm); line-height: 1.55; }
.shot-submit-actions { display: flex; flex-wrap: wrap; gap: var(--s-2); justify-content: flex-end; }
.shot-progress-panel { display: grid; gap: var(--s-3); }
.shot-progress-stats { color: var(--text-muted); font: 600 var(--fs-mono-xs) var(--font-mono); }
.shot-concat-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); }
.shot-concat-player { display: block; width: 100%; max-height: min(68vh, 700px); border-radius: var(--r-lg); background: var(--bg-deep); }
@media (max-width: 1050px) {
  .shot-identity-row { grid-template-columns: 1fr; }
  .shot-selects { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .shot-submit-panel { grid-template-columns: 1fr; }
  .shot-submit-actions { justify-content: flex-start; }
}
@media (max-width: 760px) {
  .shot-selects { grid-template-columns: 1fr; }
}
</style>
