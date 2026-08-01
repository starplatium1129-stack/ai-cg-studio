<template>
  <aside class="character-card">
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
      <div
        v-if="live2d.ready.value && activeId === 'nene'"
        class="live2d-wardrobe"
        :class="{ open: wardrobeOpen }"
        @click.stop
      >
        <button
          class="wardrobe-trigger"
          type="button"
          :aria-expanded="wardrobeOpen"
          aria-controls="nene-wardrobe-menu"
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
          v-if="wardrobeOpen"
          id="nene-wardrobe-menu"
          class="wardrobe-menu"
          role="radiogroup"
          aria-label="宁宁服装"
        >
          <span class="wardrobe-menu-title">选择服装</span>
          <button
            v-for="option in LIVE2D_OUTFITS"
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
      <div v-if="live2d.interactionHint.value" class="live2d-interaction-hint">
        {{ live2d.interactionHint.value }}
      </div>
    </div>

    <div class="character-info">
      <strong class="character-name">{{ character.name }}</strong>
      <p class="character-caption">{{ character.caption }}</p>
      <p>{{ character.description }}</p>
      <div class="character-status">
        <span class="status-dot" :class="statusKind"></span>
        <span>{{ chatStatusText }}</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { LIVE2D_OUTFITS, type CharacterConfig } from '@/config/characters'
import { useLive2D } from '@/composables/useLive2D'
import { useRovingTabs } from '@/composables/useRovingTabs'

const CHARACTER_IDS = ['nene', 'natsume'] as const

const props = defineProps<{
  activeId: string
  character: CharacterConfig
  speaking: boolean
  chatStatusText: string
  statusKind: string
  autoLoad: boolean
  outfit: string
}>()

const emit = defineEmits<{
  select: [id: string]
  live2dEnabled: [enabled: boolean]
  outfitChanged: [outfit: string]
}>()

const stageRef = ref<HTMLElement>()
const live2dHostRef = ref<HTMLElement>()
const emotion = ref('neutral')
const avatarText = ref('检测 Live2D…')
const avatarState = ref('checking')
const avatarDetail = ref('')
const avatarRetryable = ref(false)
const outfitBusy = ref(false)
const wardrobeOpen = ref(false)
const activeOutfitLabel = computed(() =>
  LIVE2D_OUTFITS.find(option => option.id === props.outfit)?.label ?? LIVE2D_OUTFITS[0].label
)

const live2d = useLive2D((status) => {
  avatarText.value = status.text
  avatarState.value = status.state
  avatarDetail.value = status.detail
  avatarRetryable.value = status.retryable
})

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
    emit('live2dEnabled', true)
    await live2d.enable()
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
}

function setMouth(value: number) {
  live2d.setMouth(value)
}

function setEmotion(value: string) {
  emotion.value = value
}

async function handleOutfitChange(next: string) {
  if (outfitBusy.value || next === live2d.outfit.value) return
  outfitBusy.value = true
  try {
    if (await live2d.setOutfit(next)) {
      emit('outfitChanged', live2d.outfit.value)
      wardrobeOpen.value = false
    }
  } finally {
    outfitBusy.value = false
  }
}

watch(() => props.activeId, (id) => {
  wardrobeOpen.value = false
  void live2d.setCharacter(id)
})

watch(() => props.outfit, (value) => {
  if (value !== live2d.outfit.value) void live2d.setOutfit(value)
})

onMounted(() => {
  if (!live2dHostRef.value || !stageRef.value) return
  void live2d.init(props.activeId, live2dHostRef.value, stageRef.value, {
    autoLoad: props.autoLoad,
    outfit: props.outfit,
  })
})

onUnmounted(() => live2d.destroy())

defineExpose({ setSpeaking, setMouth, setEmotion })
</script>
