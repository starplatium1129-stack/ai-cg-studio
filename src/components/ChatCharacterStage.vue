<template>
  <aside class="character-card" :data-character="activeId">
    <div class="character-tabs" role="tablist" aria-label="选择角色" @keydown="tabs.onKeydown">
      <button
        v-for="id in CHARACTER_IDS"
        :id="tabs.tabId(id)"
        :key="id"
        class="character-tab"
        type="button"
        :class="{ active: activeId === id }"
        :data-character="id"
        role="tab"
        :aria-controls="tabs.panelId(id)"
        :aria-selected="activeId === id ? 'true' : 'false'"
        :tabindex="tabs.tabIndex(id)"
        @click="emit('select', id)"
      >{{ id === 'nene' ? '◉ 宁宁' : '◎ 夏目' }}</button>
    </div>

    <div
      :id="tabs.panelId(activeId)"
      ref="stageRef"
      class="portrait-stage"
      :class="[{ speaking, 'live2d-ready': live2d.ready.value && live2d.loadedCharacter.value === activeId }, `emotion-${emotion}`]"
      :data-character="activeId"
      :data-emotion="emotion"
      :data-presence="presence || undefined"
      :data-mouth-level="mouthLevel.toFixed(3)"
      :data-audio-peak="audioPeak.toFixed(3)"
      role="tabpanel"
      :aria-labelledby="tabs.tabId(activeId)"
    >
      <div class="room-signal">
        <span>{{ character.roomCode }}</span>
        <small>{{ character.roomMood }}</small>
      </div>
      <img class="portrait-main" :src="character.image" :alt="character.name" />
      <div ref="live2dHostRef" class="live2d-host" aria-hidden="true"></div>
      <div class="voice-halo" aria-hidden="true"></div>
      <button
        class="avatar-status"
        type="button"
        :data-state="avatarState"
        :disabled="!avatarActionable"
        :title="avatarActionTitle"
        @click="handleAvatarAction"
      >{{ avatarText }}</button>
      <button
        v-if="avatarState === 'idle'"
        class="live2d-enable-cta"
        type="button"
        @click.stop="handleAvatarAction"
      >
        <span class="live2d-enable-cta-kicker">LIVE2D / ON DEMAND</span>
        <strong>加载{{ character.name }}动态立绘</strong>
        <small>点击后按需下载模型与动作</small>
      </button>
    </div>

    <div class="character-info">
      <div class="character-info-head">
        <strong class="character-name">{{ character.name }}</strong>
        <div class="character-status">
          <span class="status-dot" :class="statusKind"></span>
          <span>{{ chatStatusText }}</span>
        </div>
      </div>
      <p class="character-caption">{{ character.caption }}</p>
      <p class="character-description" :title="character.description">{{ character.description }}</p>
      <div v-if="live2d.interactionHint.value" class="live2d-interaction-hint">
        {{ live2d.interactionHint.value }}
      </div>
      <div
        v-if="live2d.ready.value"
        class="live2d-wardrobe"
        :class="{ open: wardrobeOpen }"
        @click.stop
      >
        <div
          v-if="activeId === 'natsume'"
          class="wardrobe-trigger wardrobe-static"
          role="status"
          aria-label="夏目当前只有咖啡店制服，互动动作会触发原生临时图层效果"
        >
          <span class="wardrobe-symbol" aria-hidden="true"><ArchiveIcon name="wardrobe" /></span>
          <span class="wardrobe-copy">
            <small>SINGLE COSTUME</small>
            <strong>{{ activeOutfitLabel }}</strong>
          </span>
          <span class="wardrobe-note">互动动作含原生图层效果</span>
        </div>
        <button
          v-else
          class="wardrobe-trigger"
          type="button"
          :aria-expanded="wardrobeOpen"
          :aria-controls="`${activeId}-wardrobe-menu`"
          @click="wardrobeOpen = !wardrobeOpen"
        >
          <span class="wardrobe-symbol" aria-hidden="true"><ArchiveIcon name="wardrobe" /></span>
          <span class="wardrobe-copy">
            <small>WARDROBE</small>
            <strong>{{ activeOutfitLabel }}</strong>
          </span>
          <span class="wardrobe-chevron" aria-hidden="true">⌄</span>
        </button>
        <div
          v-if="activeId !== 'natsume' && wardrobeOpen"
          :id="`${activeId}-wardrobe-menu`"
          class="wardrobe-menu"
          role="radiogroup"
          aria-label="宁宁服装"
        >
          <span class="wardrobe-menu-title">选择服装</span>
          <button
            v-for="option in outfitOptions"
            :key="option.id"
            class="wardrobe-option"
            type="button"
            role="radio"
            :aria-checked="outfit === option.id"
            :class="{ active: outfit === option.id }"
            :disabled="outfitBusy"
            @click="handleOutfitChange(option.id)"
          >
            <span>{{ option.label }}</span>
            <i aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  DEFAULT_LIVE2D_OUTFIT,
  DEFAULT_NATSUME_OUTFIT,
  findLive2DOutfit,
  findNatsumeOutfit,
  LIVE2D_OUTFITS,
  NATSUME_OUTFITS,
  type CharacterConfig,
} from '@/config/characters'
import { useLive2D } from '@/composables/useLive2D'
import { useRovingTabs } from '@/composables/useRovingTabs'
import { createEmotionRuntime, NATSUME_RUNTIME_CONFIG, NENE_RUNTIME_CONFIG } from '@/utils/emotionRuntime'
import type { Live2DBackendKind } from '@/live2d/types'

const CHARACTER_IDS = ['nene', 'natsume'] as const

const props = defineProps<{
  activeId: string
  character: CharacterConfig
  speaking: boolean
  chatStatusText: string
  statusKind: string
  autoLoad: boolean
  presence?: string
  outfit: string
  /**
   * 渲染后端：'auto' 时按 html dataset `data-live2d-backend` 或 URL
   * `?live2dBackend=` 解析（桌面 Rust 壳注入用），默认浏览器 wl-live2d。
   * 原生后端不可用（桥缺失）时自动回退浏览器并标记 backend-fallback。
   */
  backend?: Live2DBackendKind | 'auto'
}>()

const emit = defineEmits<{
  select: [id: string]
  live2dEnabled: [enabled: boolean]
  outfitChanged: [outfit: string]
}>()

const stageRef = ref<HTMLElement>()
const live2dHostRef = ref<HTMLElement>()
const emotion = ref('neutral')
const mouthLevel = ref(0)
const audioPeak = ref(0)
const avatarText = ref('检测 Live2D…')
const avatarState = ref('checking')
const avatarDetail = ref('')
const avatarRetryable = ref(false)
const outfitBusy = ref(false)
const wardrobeOpen = ref(false)
const live2dInitialized = ref(false)
// 换装选择按角色记忆（宁宁/夏目共用 storage 单字段，值空间分离）
const outfitByChar = ref<Record<string, string>>({
  nene: DEFAULT_LIVE2D_OUTFIT,
  natsume: DEFAULT_NATSUME_OUTFIT,
})
function currentOutfitId() {
  return outfitByChar.value[props.activeId] ?? props.outfit
}
const outfitOptions = computed(() =>
  props.activeId === 'natsume' ? NATSUME_OUTFITS : LIVE2D_OUTFITS,
)
const activeOutfitLabel = computed(() => {
  const list = outfitOptions.value
  const found = list.find(option => option.id === currentOutfitId())
  return found?.label ?? list[0].label
})

const live2d = useLive2D((status) => {
  avatarText.value = status.text
  avatarState.value = status.state
  avatarDetail.value = status.detail
  avatarRetryable.value = status.retryable
})

const neneRuntime = createEmotionRuntime(NENE_RUNTIME_CONFIG)
const natsumeRuntime = createEmotionRuntime(NATSUME_RUNTIME_CONFIG)
function activeRuntime() {
  return props.activeId === 'natsume' ? natsumeRuntime : neneRuntime
}

const activeIdRef = computed(() => props.activeId)
const tabs = useRovingTabs(
  () => CHARACTER_IDS as unknown as readonly string[],
  activeIdRef,
  (id) => emit('select', id),
  { prefix: 'chatchar' },
)

const avatarActionable = computed(() =>
  avatarState.value !== 'checking'
    && avatarState.value !== 'loading'
    && (!live2d.enabled.value || live2d.ready.value || avatarRetryable.value)
)

const avatarActionTitle = computed(() => {
  if (avatarState.value === 'loading') return '正在加载 Live2D 动态模型'
  if (!live2d.enabled.value) return '按需下载并启用 Live2D 动态模型'
  if (live2d.ready.value) return '切换回静态立绘并释放 Live2D 资源'
  return avatarDetail.value
})

async function handleAvatarAction() {
  if (!live2d.enabled.value) {
    await activeRuntime().activate()
    await live2d.enable()
    emit('live2dEnabled', true)
    return
  }
  if (live2d.ready.value) {
    emit('live2dEnabled', false)
    live2d.disable()
    return
  }
  if (avatarRetryable.value) await live2d.retry()
}

function setSpeaking(value: boolean) {
  live2d.setSpeaking(value)
  if (!value) {
    mouthLevel.value = 0
    audioPeak.value = 0
  }
}

function setMouth(value: number) {
  mouthLevel.value = Math.max(0, Math.min(1, value))
  live2d.setMouth(value)
}

function setAudioLevel(level: number, peak = level) {
  audioPeak.value = Math.max(0, Math.min(1, peak))
  live2d.setAudioLevel(level, peak)
}

function setEmotion(value: string) {
  emotion.value = value
  activeRuntime().pushEmotion(value)
  live2d.syncNativeEmotion()
}

function setUserMessage() {
  activeRuntime().onUserMessage()
  live2d.syncNativeEmotion()
}

function setDesktopVisible(visible: boolean) {
  live2d.setPaused(!visible)
  if (visible) void live2d.recover()
}

function setDesktopWindowBounds(bounds: { x: number; y: number; width: number; height: number }) {
  live2d.setDesktopWindowBounds(bounds)
}

function setGlobalPointer(
  screenX: number,
  screenY: number,
  windowBounds: { x: number; y: number; width: number; height: number },
) {
  live2d.setGlobalPointer(screenX, screenY, windowBounds)
}

function releasePointerFocus() {
  live2d.releasePointerFocus()
}

function setDesktopPerformanceMode(onBatteryPower: boolean) {
  // 原生后端：电池 30fps，接电恢复 165fps；browser 后端维持 60fps 上限。
  const native = live2d.backendKind.value === 'native'
  live2d.setMaxFps(onBatteryPower ? 30 : (native ? 165 : 60))
}

async function handleOutfitChange(next: string) {
  if (outfitBusy.value) return
  if (props.activeId === 'natsume' && findNatsumeOutfit(next).id !== next) return
  if (props.activeId === 'nene' && findLive2DOutfit(next).id !== next) return
  outfitBusy.value = true
  try {
    if (await live2d.setOutfit(next)) {
      outfitByChar.value = { ...outfitByChar.value, [props.activeId]: next }
      emit('outfitChanged', next)
      wardrobeOpen.value = false
    }
  } finally {
    outfitBusy.value = false
  }
}

watch(() => props.activeId, (id) => {
  wardrobeOpen.value = false
  live2d.attachEmotionRuntime(activeRuntime())
  const remembered = id === 'natsume'
    ? findNatsumeOutfit(props.outfit).id
    : findLive2DOutfit(props.outfit).id
  outfitByChar.value = { ...outfitByChar.value, [id]: remembered }
  void (async () => {
    if (live2d.enabled.value) await activeRuntime().activate()
    await live2d.setCharacter(id)
    if (props.activeId === id && remembered !== live2d.outfit.value) await live2d.setOutfit(remembered)
  })()
})

watch(() => props.outfit, (value) => {
  // 外部（storage 恢复/其他标签页）带来的值只认当前角色的值空间
  if (props.activeId === 'natsume') {
    const valid = findNatsumeOutfit(value).id
    if (value !== valid || valid !== currentOutfitId()) {
      outfitByChar.value = { ...outfitByChar.value, natsume: valid }
      if (valid !== live2d.outfit.value) void live2d.setOutfit(valid)
    }
  } else {
    const valid = findLive2DOutfit(value).id
    if (value !== valid || valid !== currentOutfitId()) {
      outfitByChar.value = { ...outfitByChar.value, nene: valid }
      if (valid !== live2d.outfit.value) void live2d.setOutfit(valid)
    }
  }
})

let pendingAutoLoad = false

watch(() => props.autoLoad, (enabled) => {
  if (!enabled || live2d.enabled.value) return
  // init 尚未完成时先记下请求，init 完成后统一按最新 autoLoad 决定，
  // 避免桌面 Companion 的 getState 异步完成落在 init 之前把事件丢掉。
  if (!live2dInitialized.value) {
    pendingAutoLoad = true
    return
  }
  void (async () => {
    await activeRuntime().activate()
    await live2d.enable()
  })()
})

function resolvedBackendKind(): Live2DBackendKind {
  if (props.backend && props.backend !== 'auto') return props.backend
  try {
    const url = new URLSearchParams(window.location.search).get('live2dBackend')
    if (url === 'native' || url === 'browser') return url
    const dataset = document.documentElement.dataset.live2dBackend
    if (dataset === 'native' || dataset === 'browser') return dataset
  } catch { /* 非浏览器环境 */ }
  return 'browser'
}

onMounted(() => {
  if (!live2dHostRef.value || !stageRef.value) return
  live2d.attachEmotionRuntime(activeRuntime())
  const initialOutfit = props.activeId === 'natsume'
    ? findNatsumeOutfit(props.outfit).id
    : findLive2DOutfit(props.outfit).id
  outfitByChar.value = { ...outfitByChar.value, [props.activeId]: initialOutfit }
  void (async () => {
    if (props.autoLoad) await activeRuntime().activate()
    await live2d.init(props.activeId, live2dHostRef.value!, stageRef.value!, {
      autoLoad: props.autoLoad,
      outfit: initialOutfit,
      backendKind: resolvedBackendKind(),
    })
    live2dInitialized.value = true
    if ((props.autoLoad || pendingAutoLoad) && !live2d.enabled.value) {
      pendingAutoLoad = false
      await activeRuntime().activate()
      await live2d.enable()
    }
  })()
})

onUnmounted(() => {
  live2d.attachEmotionRuntime(null)
  live2d.destroy()
})

defineExpose({
  setSpeaking,
  setMouth,
  setAudioLevel,
  setEmotion,
  setUserMessage,
  setDesktopVisible,
  setDesktopWindowBounds,
  setDesktopPerformanceMode,
  setGlobalPointer,
  releasePointerFocus,
})
</script>
