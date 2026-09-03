<template>
  <!-- stage-slot：col-center 的画布槽位锚点（layout.css 以它固定中栏排序首位） -->
  <div class="stage-slot">
    <!-- Stage placeholder：plans/002 交接收尾——v-if + stage-swap 过渡，
         占位层淡出让位（结果层入场由 result-image-wrap 的 directorViewIn
         与图片 aicsBloomReveal 承担，不做双重驱动） -->
    <Transition name="stage-swap">
      <section
        v-if="!displayResultUrl"
        class="stage-placeholder"
      :class="{
        'is-generating': generationBusy,
        'is-error': !!generationError,
        'is-paused': generationStopped,
      }"
      aria-label="成片监看区"
    >
      <div class="stage-chrome">
        <span>CANVAS</span>
        <span class="stage-ready">
          {{ generationBusy ? 'RENDERING' : (generationError ? 'ATTENTION' : (generationStopped ? 'PAUSED' : 'READY')) }}
        </span>
      </div>
      <CornerFrame />
      <i class="stage-magic-ring" aria-hidden="true"></i>
      <img class="stage-muse nene" :src="stageMuseUrl.nene" alt="" aria-hidden="true" decoding="async">
      <img class="stage-muse natsume" :src="stageMuseUrl.natsume" alt="" aria-hidden="true" decoding="async">
      <div class="stage-message">
        <div v-if="generationBusy" class="stage-generating-copy">
          <div class="stage-generating-title">心动画面正在显影…</div>
          <div class="stage-generating-sub">
            {{ generationStatusText || '光影编织中，少女的神韵马上就好啦…' }}
            <template v-if="generationProgress !== null"> {{ Math.round(generationProgress * 100) }}%</template>
            <template v-else-if="drawEngine !== 'sd'"> · 已渲染 {{ animaElapsed }} 秒</template>
            <template v-if="drawEngine !== 'sd' && animaCurrentNode"> · 节点 {{ animaCurrentNode }}</template>
          </div>
          <div class="stage-progress-ring" :class="{ 'is-indeterminate': generationProgress === null }">
            <i :style="{ '--progress': (generationProgress ?? 0) * 100 + '%' }"></i>
          </div>
        </div>
        <div v-else-if="generationError" class="stage-idle">
          <div class="stage-placeholder-title">唔……这次的灵感不小心迷路了</div>
          <div class="stage-placeholder-copy">{{ generationError }}</div>
          <div class="stage-quick-actions">
            <button class="btn btn-primary" type="button" @click="$emit('generate')">再召唤一次！</button>
          </div>
        </div>
        <div v-else-if="generationStopped" class="stage-idle">
          <div class="stage-placeholder-title">定格已暂时停下</div>
          <div class="stage-placeholder-copy">草稿已经好好保管了，微调一下细节，随时都能继续定格~</div>
          <div class="stage-quick-actions">
            <button class="btn btn-primary" type="button" @click="$emit('generate')">继续定格这一幕</button>
          </div>
        </div>
        <div v-else class="stage-idle">
          <div class="stage-placeholder-title">属于你们的心动瞬间，将在此处诞生</div>
          <div class="stage-quick-actions">
            <button
              v-if="drawEngine === 'anima'"
              class="btn btn-ghost"
              type="button"
              title="导入任意外部本地图片，进行智能语义识别与局部换装"
              @click="$emit('openInpaint')"
            >
              <ArchiveIcon name="inpaint" />
              <span>一键换装·魔法衣橱</span>
            </button>
            <button class="btn btn-ghost" type="button"
              :disabled="interrogateBusy"
              :title="(interrogateMode === 'caption' ? '本地反推为自然语言Prose（Krea2）' : '本地反推为Danbooru Tag（Anima/SD）') + '；聚焦此按钮后可直接粘贴图片'"
              @click="triggerInterrogatePick"
              @paste="onInterrogatePaste">
              <ArchiveIcon name="search" />
              <span>{{ interrogateBusy ? '解读画面中…' : '读取图片灵感' }}</span>
            </button>
            <button class="btn btn-ghost" type="button"
              @click="$emit('exploreScenes')">
              挑一个心动场景
            </button>
          </div>
          <div v-if="interrogateError" class="stage-interrogate-error" role="alert">{{ interrogateError }}</div>
          <input ref="interrogateInputRef" class="sr-only" type="file" accept="image/*" @change="onInterrogateFile" />
        </div>
      </div>
    </section>
    </Transition>

    <!-- Result image -->
    <div v-if="displayResultUrl" class="result-image-wrap archive-canvas">
      <CornerFrame variant="ghost" />
      <ImageSplitCompare
        v-if="inpaintCompareActive && inpaintOriginalUrl"
        :before-src="inpaintOriginalUrl"
        :after-src="displayResultUrl"
        before-label="换装前原图"
        after-label="换装后成片"
      />
      <img v-else class="result-image" :src="displayResultUrl" alt="生成的图片" />
      <div class="result-image-actions">
        <button
          class="btn btn-ghost"
          type="button"
          :disabled="interrogateBusy"
          :title="interrogateMode === 'caption' ? '对当前成片本地反推为Prose' : '对当前成片本地反推为Tag，可切人直出'"
          @click="interrogateCurrentImage">
          <ArchiveIcon name="search" />
          <span>{{ interrogateBusy ? '反推中…' : '反推当前图' }}</span>
        </button>
        <button
          class="btn btn-ghost"
          type="button"
          :disabled="interrogateBusy"
          title="上传任意图片本地反推"
          @click="triggerInterrogatePick">
          <ArchiveIcon name="search" />
          <span>上传反推</span>
        </button>
        <button
          v-if="inpaintOriginalUrl && displayResultUrl"
          class="btn btn-ghost btn-compare-inpaint"
          :class="{ active: inpaintCompareActive }"
          type="button"
          :title="inpaintCompareActive ? '退出前后对比模式' : '左右滑动对比换装前后效果'"
          @click="$emit('update:inpaintCompareActive', !inpaintCompareActive)"
        >
          <ArchiveIcon name="compare" />
          <span>{{ inpaintCompareActive ? '退出对比' : '换装前后对比' }}</span>
        </button>
        <button
          v-if="displayResultUrl && drawEngine === 'anima'"
          class="btn btn-ghost btn-inpaint-action"
          type="button"
          :disabled="generationBusy"
          :title="generationBusy ? BUSY_HINT : '锁定角色与背景，使用 AI 视觉语义识别一键更换服装'"
          @click="$emit('openInpaint')"
        >
          <ArchiveIcon name="wardrobe" />
          <span>局部换装</span>
        </button>
        <button
          v-if="displayResultUrl && (drawEngine === 'anima' || drawEngine === 'sd')"
          class="btn btn-ghost btn-hires-action"
          type="button"
          :disabled="generationBusy"
          :title="generationBusy ? BUSY_HINT : '使用 2x 高清超分放大'"
          @click="$emit('upscale')"
        >
          <ArchiveIcon name="spark" />
          <span>高清放大 2x</span>
        </button>
        <button
          v-if="displayResultUrl && (drawEngine === 'anima' || drawEngine === 'sd')"
          class="btn btn-ghost btn-video-action"
          type="button"
          :disabled="generationBusy"
          :title="generationBusy ? BUSY_HINT : '将当前成片作为首帧，到视频页生成短片（场景预设自动转视频提示词）'"
          @click="$emit('goVideo')"
        >
          <ArchiveIcon name="play" />
          <span>出视频</span>
        </button>
        <button
          v-if="displayResultUrl && (drawEngine === 'anima' || drawEngine === 'sd')"
          class="btn btn-ghost btn-video-action"
          type="button"
          :disabled="generationBusy"
          :title="generationBusy ? BUSY_HINT : '把当前成片作为分镜首帧，攒齐后到「分镜短片」整批生成'"
          @click="$emit('addToShots')"
        >
          <ArchiveIcon name="gallery" />
          <span>加入分镜</span>
        </button>
        <button
          v-if="shotsPending > 0"
          class="btn btn-primary btn-video-action"
          type="button"
          title="到视频页「分镜短片」，生成已加入的镜头"
          @click="$emit('goShots')"
        >
          <ArchiveIcon name="play" />
          <span>去分镜短片（{{ shotsPending }}）</span>
        </button>
        <button class="btn btn-ghost" type="button" @click="$emit('saveResult')">保存快照</button>
        <button class="btn btn-ghost" type="button" :disabled="!hasPrevResult" @click="$emit('openCompare')">
          与上一张对比
        </button>
        <button class="btn btn-ghost" type="button" @click="$emit('clearResult')">清除</button>
      </div>
      <div v-if="interrogateError && displayResultUrl" class="stage-interrogate-error" role="alert">{{ interrogateError }}</div>
    </div>
    <!-- 供两态共用的上传入口 -->
    <input ref="interrogateInputRef2" class="sr-only" type="file" accept="image/*" @change="onInterrogateFile" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import CornerFrame from '@/components/visual/CornerFrame.vue'
import ImageSplitCompare from '@/components/visual/ImageSplitCompare.vue'
import { useInterrogate } from '@/composables/useInterrogate'
import type { InterrogateResult } from '@/composables/useInterrogate'
import '@/assets/css/director/components/DirectorStagePanel.css'

const props = defineProps<{
  displayResultUrl: string
  generationBusy: boolean
  generationError: string | null
  generationStopped: boolean
  generationStatusText: string | null
  generationProgress: number | null
  generationProgressStyle: Record<string, string>
  animaElapsed: number
  animaCurrentNode: string
  drawEngine: string
  inpaintOriginalUrl: string | null
  inpaintCompareActive: boolean
  shotsPending: number
  hasPrevResult: boolean
}>()

/**
 * 生成中禁用控件的统一说明（2026-08-30 UX 审计 P2）。
 *
 * 这些按钮原本各有各的 title，但生成中一旦被禁用，悬停冒出来的仍是功能介绍，
 * 用户看到「点不动 + 一堆功能说明」，只会以为软件坏了。禁用时统一换成原因。
 * 同样的文案在 PromptBuilderView 里也有一份，改动时记得两边一起改。
 */
const BUSY_HINT = '生成中，等这一张出完就能用'

const emit = defineEmits<{
  generate: []
  openInpaint: []
  exploreScenes: []
  'update:inpaintCompareActive': [value: boolean]
  upscale: []
  goVideo: []
  addToShots: []
  goShots: []
  saveResult: []
  openCompare: []
  clearResult: []
  interrogateResult: [result: InterrogateResult]
  interrogateError: [message: string]
}>()

const stageMuseUrl = {
  nene: '/assets/characters/nene-official.webp',
  natsume: '/assets/characters/natsume-official.webp',
}

const interrogateInputRef = ref<HTMLInputElement | null>(null)
const interrogateInputRef2 = ref<HTMLInputElement | null>(null)
const { busy: interrogateBusy, error: interrogateErrorRaw, interrogate } = useInterrogate()
const interrogateError = computed(() => interrogateErrorRaw.value)
const interrogateMode = computed(() => props.drawEngine === 'krea2' ? 'caption' as const : 'tag' as const)

function triggerInterrogatePick() {
  // 有结果时优先用结果态外层的 input：空闲态 input 在 v-show=false 的舞台里，
  // 部分 WebView/浏览器对 display:none 祖先内的 file input 不弹选择器。
  var target = props.displayResultUrl ? interrogateInputRef2.value : interrogateInputRef.value
  if (!target) target = props.displayResultUrl ? interrogateInputRef.value : interrogateInputRef2.value
  if (target) target.click()
}

async function onInterrogateFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  // 清空以便同文件可二次触发
  input.value = ''
  if (file) await runInterrogateFile(file)
}

/**
 * 剪贴板里的图片直接反推（2026-08-30 UX 审计 P2）。
 *
 * 本地反推此前只能走文件选择器，而真要用的那一刻，图往往已经在剪贴板里了
 * （刚截的图、从参考站复制的），多一趟「打开对话框找文件」纯属多余。
 * 监听挂在按钮上是因为浏览器只把 paste 派发给焦点元素，按钮天然可聚焦。
 */
function onInterrogatePaste(e: ClipboardEvent) {
  const image = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'))
  if (!image) return
  e.preventDefault()
  void runInterrogateFile(image)
}

/** 反推一张图片：文件选择与剪贴板粘贴共用这一条路径 */
async function runInterrogateFile(file: File) {
  try {
    const result = await interrogate(file, interrogateMode.value, 0.35)
    if (result) emit('interrogateResult', result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    emit('interrogateError', msg)
    console.warn('[interrogate]', msg)
  }
}

async function interrogateCurrentImage() {
  if (!props.displayResultUrl) {
    triggerInterrogatePick()
    return
  }
  let file: File
  try {
    var res = await fetch(props.displayResultUrl)
    if (!res.ok) throw new Error('获取当前成片失败')
    var blob = await res.blob()
    file = new File([blob], 'current_result.png', { type: blob.type || 'image/png' })
  } catch (e) {
    // 取图失败回落到上传，让用户手动选图
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[interrogate] fetch current image failed:', msg)
    triggerInterrogatePick()
    return
  }
  try {
    var result = await interrogate(file, interrogateMode.value, 0.35)
    if (result) emit('interrogateResult', result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    emit('interrogateError', msg)
    console.warn('[interrogate]', msg)
  }
}
</script>
