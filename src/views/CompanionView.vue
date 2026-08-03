<template>
  <article
    class="companion-page"
    :data-character="activeChar"
    :data-power-mode="desktopBridge ? (onBatteryPower ? 'efficiency' : 'quality') : undefined"
  >
    <div class="companion-ambience" aria-hidden="true">
      <i></i><i></i><i></i>
    </div>
    <header class="companion-toolbar">
      <div class="companion-identity">
        <span>{{ currentCharacter.roomCode }}</span>
        <h1>与{{ currentCharacter.name }}相伴</h1>
      </div>
      <div class="companion-toolbar-actions">
        <label class="companion-voice-toggle" title="实时配音">
          <input type="checkbox" v-model="autoVoice" @change="onAutoVoiceChange" />
          <span aria-hidden="true"></span>
          <strong>{{ autoVoice ? '声音开启' : '声音关闭' }}</strong>
        </label>
        <button
          v-if="behaviorEnabled"
          class="companion-dnd-toggle"
          type="button"
          :aria-pressed="dnd"
          :title="dnd ? '关闭勿扰：恢复角色主动问候' : '开启勿扰：暂停角色主动问候（安静时段自动生效）'"
          @click="toggleDnd"
        >{{ dnd ? '勿扰中' : '勿扰' }}</button>
        <div v-if="desktopBridge" class="companion-window-actions" aria-label="桌面窗口控制">
          <button type="button" title="切换窗口置顶" :aria-pressed="alwaysOnTop" @click="togglePin">
            {{ alwaysOnTop ? '取消置顶' : '置顶' }}
          </button>
          <button
            type="button"
            :title="ignoreMouseEvents ? '恢复窗口交互（Ctrl+Shift+P）' : '开启鼠标穿透（Ctrl+Shift+P）'"
            :aria-pressed="ignoreMouseEvents"
            @click="toggleMouseEvents"
          >{{ ignoreMouseEvents ? '恢复交互' : '穿透' }}</button>
          <button type="button" title="打开完整工作台（Ctrl+Shift+A）" @click="desktopBridge.openAtelier()">Atelier</button>
          <button type="button" title="隐藏 Companion（Ctrl+Shift+Space）" @click="desktopBridge.hide">隐藏</button>
        </div>
        <button
          v-if="desktopBridge"
          class="companion-room-link"
          type="button"
          @click="desktopBridge.openAtelier('/chat')"
        >完整房间</button>
        <RouterLink v-else class="companion-room-link" to="/chat">完整房间</RouterLink>
      </div>
    </header>

    <main class="companion-stage" aria-label="桌面陪伴模式">
      <ChatCharacterStage
        ref="characterStageRef"
        :active-id="activeChar"
        :character="currentCharacter"
        :speaking="isSpeaking"
        :chat-status-text="chatStatusText"
        :status-kind="statusKind"
        :auto-load="companionAutoLoad"
        :outfit="storage.live2dOutfit(activeChar)"
        @select="switchCharacter"
        @live2d-enabled="handleLive2dPreference"
        @outfit-changed="storage.setLive2dOutfit(activeChar, $event)"
      />

      <section class="companion-conversation" aria-label="简洁对话">
        <div v-if="behaviorEnabled && pendingReminders.length" class="companion-reminders" role="log" aria-label="角色主动问候">
          <div
            v-for="reminder in pendingReminders"
            :key="reminder.id"
            class="companion-reminder-bubble"
            :data-kind="reminder.kind"
          >
            <span class="companion-reminder-name">{{ currentCharacter.name }}</span>
            <p>{{ reminder.line }}</p>
            <button type="button" aria-label="关闭这条问候" @click="dismissReminder(reminder.id)">×</button>
          </div>
        </div>
        <div ref="chatListRef" class="companion-bubbles" role="log" aria-label="最近对话">
          <div v-if="!companionMessages.length" class="companion-empty">
            <span>{{ currentCharacter.name }}</span>
            <p>{{ currentCharacter.greeting }}</p>
          </div>
          <template v-else>
            <div
              v-for="msg in immersiveMessages"
              :key="msg.mid"
              class="companion-bubble"
              :class="msg.role"
            >
              <span>{{ msg.role === 'user' ? '你' : currentCharacter.name }}</span>
              <p>{{ msg.content }}</p>
            </div>
          </template>
        </div>

        <div
          v-if="!chatReady || voiceCapabilityState === 'offline' || preparingRoom"
          class="companion-setup"
          :data-state="preparingRoom ? 'active' : 'warning'"
        >
          <div>
            <strong>{{ setupTitle }}</strong>
            <span>{{ setupDescription }}</span>
          </div>
          <button
            v-if="chatProvider === 'local' || (chatReady && voiceCapabilityState === 'offline')"
            class="btn btn-primary"
            type="button"
            :disabled="preparingRoom"
            @click="prepareRoom"
          >{{ preparingRoom ? '准备中…' : '准备环境' }}</button>
          <RouterLink v-else class="btn btn-primary" to="/chat">前往配置</RouterLink>
        </div>

        <div class="companion-composer">
          <textarea
            class="companion-input"
            v-model="inputText"
            rows="2"
            maxlength="1200"
            placeholder="对她说点什么……"
            aria-label="桌宠聊天输入"
            @keydown.enter.exact.prevent="handleSend"
            @input="onInputChange"
          ></textarea>
          <button
            v-if="busy || voiceActive"
            class="companion-stop"
            type="button"
            @click="stopEverything"
          >停止</button>
          <button
            class="companion-send"
            type="button"
            :disabled="busy || !chatReady"
            @click="handleSend"
          >{{ busy ? '回复中' : '发送' }}</button>
        </div>

        <footer class="companion-status" :data-state="statusKind">
          <span>{{ chatStatusText }}</span>
          <span v-if="voiceStatusText" class="companion-voice-status">{{ voiceStatusText }}</span>
          <span v-if="inQuietHours" class="companion-quiet-hours-hint" :title="quietHoursText">🌙 安静时段</span>
          <span
            v-if="desktopBridge"
            class="companion-runtime-mode"
            :title="onBatteryPower ? '检测到电池供电，Live2D 自动降至 30 FPS' : '接电运行，Live2D 保持 60 FPS'"
          >{{ onBatteryPower ? '30 FPS' : '60 FPS' }}</span>
          <label title="音量">
            <span>音量</span>
            <input
              type="range"
              v-model.number="volume"
              min="0"
              max="100"
              aria-label="桌宠音量"
              @input="onVolumeChange"
            />
          </label>
        </footer>
        <div class="companion-error" role="status" aria-live="polite" :data-kind="chatErrorKind">
          {{ chatError }}
        </div>
        <p class="sr-only" role="status" aria-live="polite">{{ replyAnnouncement }}</p>
      </section>
    </main>
  </article>
</template>

<script setup lang="ts">
import '@/assets/css/companion.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useCharacterRoomSession } from '@/composables/useCharacterRoomSession'
import ChatCharacterStage from '@/components/ChatCharacterStage.vue'
import { pickCompanionLine } from '@/config/characters'
import { createCompanionBehavior, normalizeCompanionConfig, type CompanionReminder } from '@/utils/companionBehavior'
import { COMPANION_BEHAVIOR_KEY, COMPANION_LIVE2D_KEY } from '@/utils/storageKeys'

const {
  chatListRef,
  characterStageRef,
  activeChar,
  busy,
  voiceActive,
  chatError,
  chatErrorKind,
  voiceStatusText,
  voiceCapabilityState,
  isSpeaking,
  autoVoice,
  volume,
  preparingRoom,
  storage,
  chatProvider,
  chatStatusText,
  statusKind,
  chatReady,
  currentCharacter,
  companionMessages,
  setupTitle,
  setupDescription,
  inputText,
  replyAnnouncement,
  onVolumeChange,
  handleSend,
  onInputChange,
  prepareRoom,
  stopEverything,
  switchCharacter,
  onAutoVoiceChange,
  refreshRoomState,
} = useCharacterRoomSession()

const desktopBridge = window.companionDesktop
const alwaysOnTop = ref(false)
const ignoreMouseEvents = ref(false)
const onBatteryPower = ref(false)
const desktopWindowVisible = ref(!desktopBridge)
const desktopLive2dOverride = ref(readDesktopLive2dOverride())
const companionAutoLoad = computed(() => desktopBridge
  ? desktopWindowVisible.value && desktopLive2dOverride.value !== false
  : storage.state.settings.live2dEnabled)
const immersiveMessages = computed(() => companionMessages.value.slice(-2))
const behavior = createCompanionBehavior(readBehaviorConfig())
const behaviorEnabled = computed(() => behavior.config().enabled)
const dnd = ref(behavior.config().dnd)
const pendingReminders = ref<CompanionReminder[]>([])
const inQuietHours = ref(behavior.inQuietHours())
const quietHoursText = computed(() => {
  const { quietStartHour, quietEndHour } = behavior.config()
  return `安静时段 ${quietStartHour}:00 – ${quietEndHour}:00 不主动问候`
})
let behaviorTimer = 0
let reminderLineOffset = 0
let lastActivityAt = Date.now()
let resumeSubscription: number | undefined
let shownSubscription: number | undefined
let visibilitySubscription: number | undefined
let powerModeSubscription: number | undefined
let interactionModeSubscription: number | undefined
let viewAlive = true

function readBehaviorConfig() {
  try {
    return normalizeCompanionConfig(JSON.parse(localStorage.getItem(COMPANION_BEHAVIOR_KEY) || 'null'))
  } catch {
    return normalizeCompanionConfig(null)
  }
}

function persistBehaviorConfig() {
  try { localStorage.setItem(COMPANION_BEHAVIOR_KEY, JSON.stringify(behavior.config())) } catch { /* 隐私模式忽略 */ }
}

function syncReminders() {
  pendingReminders.value = behavior.pending().slice()
  inQuietHours.value = behavior.inQuietHours()
}

function noteActivity() {
  behavior.noteActivity()
  lastActivityAt = Date.now()
}

function toggleDnd() {
  const next = !behavior.config().dnd
  behavior.setConfig({ dnd: next })
  dnd.value = next
  persistBehaviorConfig()
}

function dismissReminder(id: string) {
  behavior.dismiss(id)
  syncReminders()
}

function runBehaviorTick() {
  const reminder = behavior.tick()
  if (reminder) {
    reminderLineOffset += 1
    reminder.line = pickCompanionLine(activeChar.value, 'idle', reminderLineOffset)
    syncReminders()
  }
}

function readDesktopLive2dOverride(): boolean | null {
  if (!desktopBridge) return null
  try {
    const value = localStorage.getItem(COMPANION_LIVE2D_KEY)
    return value == null ? null : value === 'true'
  } catch {
    return null
  }
}

function handleLive2dPreference(enabled: boolean) {
  if (desktopBridge) {
    desktopLive2dOverride.value = enabled
    desktopBridge.setLive2dEnabled(enabled)
    try { localStorage.setItem(COMPANION_LIVE2D_KEY, String(enabled)) } catch { /* 隐私模式忽略 */ }
  }
  storage.setLive2dEnabled(enabled)
}

watch(replyAnnouncement, announcement => {
  if (!desktopBridge || !announcement || document.hasFocus()) return
  desktopBridge.notify(currentCharacter.value.name, announcement)
})

async function togglePin() {
  if (desktopBridge) alwaysOnTop.value = await desktopBridge.toggleAlwaysOnTop()
}

function toggleMouseEvents() {
  if (desktopBridge) desktopBridge.setIgnoreMouseEvents(!ignoreMouseEvents.value)
}

function setDesktopVisibility(visible: boolean) {
  if (desktopWindowVisible.value === visible) return
  desktopWindowVisible.value = visible
  if (visible) {
    // 重新可见且离开超过提醒阈值：入队一条"回来"问候
    const awayMs = Date.now() - lastActivityAt
    const idleMinutes = behavior.config().idleMinutes
    if (idleMinutes > 0 && awayMs > idleMinutes * 60_000) {
      reminderLineOffset += 1
      const reminder = behavior.noteReturn(pickCompanionLine(activeChar.value, 'return', reminderLineOffset))
      if (reminder) syncReminders()
    }
    noteActivity()
  }
  characterStageRef.value?.setDesktopVisible?.(visible)
}

function setDesktopPowerMode(onBattery: boolean) {
  onBatteryPower.value = onBattery
  characterStageRef.value?.setDesktopPerformanceMode?.(onBattery)
}

onMounted(async () => {
  document.documentElement.classList.add('companion-mode')
  dnd.value = behavior.config().dnd
  behaviorTimer = window.setInterval(runBehaviorTick, 30_000) as unknown as number
  window.addEventListener('pointerdown', noteActivity, { passive: true })
  window.addEventListener('keydown', noteActivity, { passive: true })
  window.addEventListener('wheel', noteActivity, { passive: true })
  syncReminders()
  if (desktopBridge) {
    document.documentElement.classList.add('companion-desktop')
    shownSubscription = desktopBridge.onShown(() => setDesktopVisibility(true))
    visibilitySubscription = desktopBridge.onVisibilityChanged(setDesktopVisibility)
    powerModeSubscription = desktopBridge.onPowerModeChanged(setDesktopPowerMode)
    interactionModeSubscription = desktopBridge.onInteractionModeChanged(value => { ignoreMouseEvents.value = value })
    resumeSubscription = desktopBridge.onResume(() => {
      if (!desktopWindowVisible.value) return
      characterStageRef.value?.setDesktopVisible?.(desktopWindowVisible.value)
      void refreshRoomState()
    })
    const desktopState = await desktopBridge.getState()
    if (!viewAlive) return
    alwaysOnTop.value = desktopState.alwaysOnTop
    ignoreMouseEvents.value = desktopState.ignoreMouseEvents
    const legacyLive2dOverride = desktopLive2dOverride.value
    desktopLive2dOverride.value = desktopState.live2dEnabled ?? legacyLive2dOverride
    if (desktopState.live2dEnabled == null && legacyLive2dOverride != null) {
      desktopBridge.setLive2dEnabled(legacyLive2dOverride)
    }
    setDesktopVisibility(desktopState.visible)
    setDesktopPowerMode(desktopState.onBatteryPower)
  }
})
onUnmounted(() => {
  viewAlive = false
  clearInterval(behaviorTimer)
  window.removeEventListener('pointerdown', noteActivity)
  window.removeEventListener('keydown', noteActivity)
  window.removeEventListener('wheel', noteActivity)
  if (desktopBridge && resumeSubscription != null) desktopBridge.offResume(resumeSubscription)
  if (desktopBridge && shownSubscription != null) desktopBridge.offShown(shownSubscription)
  if (desktopBridge && visibilitySubscription != null) desktopBridge.offVisibilityChanged(visibilitySubscription)
  if (desktopBridge && powerModeSubscription != null) desktopBridge.offPowerModeChanged(powerModeSubscription)
  if (desktopBridge && interactionModeSubscription != null) desktopBridge.offInteractionModeChanged(interactionModeSubscription)
  document.documentElement.classList.remove('companion-mode', 'companion-desktop')
})
</script>
