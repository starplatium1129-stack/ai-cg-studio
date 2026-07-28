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
      >{{ id === 'nene' ? '🔮 宁宁' : '☕ 夏目' }}</button>
    </div>

    <div
      :id="tabs.panelId(activeId)"
      ref="stageRef"
      class="portrait-stage"
      :class="{
        speaking,
        'live2d-ready': live2d.ready.value && live2d.loadedCharacter.value === activeId,
      }"
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
      <div v-if="live2d.interactionHint.value" class="live2d-interaction-hint">
        {{ live2d.interactionHint.value }}
      </div>
      <div class="portrait-caption">
        <strong>{{ character.name }}</strong>
        <span>{{ character.caption }}</span>
      </div>
    </div>

    <div class="character-info">
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
import type { CharacterConfig } from '@/config/characters'
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
}>()

const emit = defineEmits<{
  select: [id: string]
  live2dEnabled: [enabled: boolean]
}>()

const stageRef = ref<HTMLElement>()
const live2dHostRef = ref<HTMLElement>()
const avatarText = ref('检测 Live2D…')
const avatarState = ref('checking')
const avatarDetail = ref('')
const avatarRetryable = ref(false)

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

function setExpression(emotion: string) {
  live2d.setExpression(emotion)
}

function setMouth(value: number) {
  live2d.setMouth(value)
}

watch(() => props.activeId, (id) => {
  void live2d.setCharacter(id)
})

onMounted(() => {
  if (!live2dHostRef.value || !stageRef.value) return
  void live2d.init(props.activeId, live2dHostRef.value, stageRef.value, {
    autoLoad: props.autoLoad,
  })
})

onUnmounted(() => live2d.destroy())

defineExpose({ setSpeaking, setExpression, setMouth })
</script>
