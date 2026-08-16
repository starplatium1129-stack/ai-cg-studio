<template>
  <article
    class="companion-page"
    :data-character="activeChar"
    :data-power-mode="desktopBridge ? (onBatteryPower ? 'efficiency' : 'quality') : undefined"
    :data-ui-hidden="uiHidden || undefined"
    :data-presence="presence.kind"
  >
    <div class="companion-ambience" aria-hidden="true">
      <i></i><i></i><i></i>
    </div>
    <header class="companion-toolbar" :data-hidden="immersive ? 'true' : undefined">
      <div class="companion-identity">
        <span>{{ currentCharacter.roomCode }}</span>
        <h1>与{{ currentCharacter.name }}相伴</h1>
      </div>
      <div class="companion-toolbar-actions">
        <div v-if="desktopBridge" class="companion-char-switch" aria-label="切换角色">
          <button
            v-for="id in CHARACTER_IDS"
            :key="id"
            type="button"
            :aria-pressed="activeChar === id ? 'true' : 'false'"
            :class="{ active: activeChar === id }"
            :title="`切换到${id === 'nene' ? '绫地宁宁' : '四季夏目'}`"
            @click="switchCharacter(id)"
          >{{ id === 'nene' ? '宁宁' : '夏目' }}</button>
        </div>
        <button
          type="button"
          class="companion-settings-btn"
          aria-label="设置"
          :aria-expanded="settingsOpen"
          @click="settingsOpen = !settingsOpen"
        ><ArchiveIcon name="gear" /><span>设置</span></button>
        <div v-if="settingsOpen" class="companion-settings-popover" role="dialog" aria-label="桌宠设置" @pointerdown.stop>
          <div class="companion-pop-group">
            <strong>陪伴</strong>
            <label class="companion-pop-item" title="实时配音">
              <input type="checkbox" v-model="autoVoice" @change="onAutoVoiceChange" />
              <span>实时配音：{{ autoVoice ? '开' : '关' }}</span>
            </label>
            <button v-if="behaviorEnabled" type="button" class="companion-pop-item" :aria-pressed="dnd" @click="toggleDnd">
              {{ dnd ? '关闭勿扰（恢复主动问候）' : '开启勿扰（暂停主动问候）' }}
            </button>
            <button type="button" class="companion-pop-item" @click="importInputRef?.click()">导入图片到作品册</button>
          </div>
          <input
            ref="importInputRef"
            class="sr-only"
            type="file"
            accept="image/*"
            multiple
            aria-label="导入本地图片到作品册"
            @change="onImportInputChange"
          />
          <div v-if="desktopBridge" class="companion-pop-group">
            <strong>窗口</strong>
            <button type="button" class="companion-pop-item" :aria-pressed="alwaysOnTop" @click="togglePin">
              {{ alwaysOnTop ? '取消置顶' : '置顶窗口' }}
            </button>
            <button
              type="button"
              class="companion-pop-item"
              :title="ignoreMouseEvents ? '恢复窗口交互（Ctrl+Shift+P）' : '开启鼠标穿透（Ctrl+Shift+P）'"
              :aria-pressed="ignoreMouseEvents"
              @click="toggleMouseEvents"
            >{{ ignoreMouseEvents ? '恢复窗口交互' : '鼠标穿透' }}</button>
            <button type="button" class="companion-pop-item" title="隐藏 Companion（Ctrl+Shift+Space）" @click="desktopBridge.hide">隐藏 Companion</button>
            <button type="button" class="companion-pop-item" title="沉浸模式：只保留角色与对话（Esc 退出）" @click="enterImmersive">沉浸模式</button>
          </div>
          <div class="companion-pop-group">
            <strong>工作台</strong>
            <button type="button" class="companion-pop-item" title="打开完整工作台（Ctrl+Shift+A）" @click="desktopBridge ? desktopBridge.openAtelier() : undefined">打开完整工作台</button>
            <button type="button" class="companion-pop-item" @click="desktopBridge ? desktopBridge.openAtelier('/chat') : undefined">完整房间（聊天）</button>
            <RouterLink v-if="!desktopBridge" class="companion-pop-item" to="/chat">完整房间（聊天）</RouterLink>
          </div>
          <div v-if="desktopBridge" class="companion-pop-group">
            <strong>诊断</strong>
            <span
              class="companion-pop-item"
              :title="onBatteryPower ? '检测到电池供电，Live2D 自动降至 30 FPS' : '接电运行，Native Live2D 目标 165 FPS'"
            >{{ onBatteryPower ? 'Live2D 30 FPS（电池）' : 'Live2D 165 FPS（接电）' }}</span>
            <button
              type="button"
              class="companion-pop-item"
              :data-state="workspaceExists ? 'ok' : 'missing'"
              :title="workspaceTooltip"
              @click="workspaceOpen = !workspaceOpen"
            >{{ workspaceExists ? 'AI 工作区 ✓' : 'AI 工作区 ✗' }}</button>
            <label class="companion-pop-item" title="音量">
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
          </div>
        </div>
      </div>
    </header>

    <main class="companion-stage" aria-label="桌面陪伴模式" :data-immersive="immersive ? 'true' : undefined">
      <button
        v-if="desktopBridge && immersive"
        class="companion-exit-immersive"
        type="button"
        title="退出沉浸模式（Esc）"
        @click="exitImmersive"
      >退出沉浸</button>
      <ChatCharacterStage
        ref="characterStageRef"
        :active-id="activeChar"
        :character="currentCharacter"
        :speaking="isSpeaking"
        :chat-status-text="chatStatusText"
        :status-kind="statusKind"
        :auto-load="companionAutoLoad"
        :presence="presence.kind"
        :backend="desktopBridge ? 'native' : 'browser'"
        :desktop-window-bounds="desktopWindowBounds"
        :outfit="storage.live2dOutfit(activeChar)"
        @select="switchCharacter"
        @live2d-enabled="handleLive2dPreference"
        @outfit-changed="storage.setLive2dOutfit(activeChar, $event)"
      />
      <div
        class="companion-presence-cue"
        :data-state="presence.kind"
        role="status"
        aria-live="polite"
      >
        <i aria-hidden="true"></i>
        <span>{{ presence.label }}</span>
      </div>

      <section class="companion-conversation" aria-label="简洁对话">
        <div v-if="behaviorEnabled && pendingReminders.length" class="companion-reminders" role="log" aria-label="角色主动问候">
          <div
            v-for="reminder in pendingReminders"
            :key="reminder.id"
            class="companion-reminder-bubble"
            :data-kind="reminder.kind"
            :data-event-kind="reminder.eventKind || undefined"
            :title="reminder.kind === 'event' && reminder.eventKind ? (desktopBridge ? '点击打开对应页面' : '') : ''"
            :class="{ 'companion-reminder-link': reminder.kind === 'event' && reminder.eventKind }"
            @click="openReminderRoute(reminder)"
          >
            <span class="companion-reminder-name">{{ currentCharacter.name }}</span>
            <p>{{ reminder.line }}</p>
            <button type="button" aria-label="关闭这条问候" @click.stop="dismissReminder(reminder.id)">×</button>
          </div>
        </div>
        <div v-if="clipboardCard" class="companion-clipboard-card" role="status" aria-live="polite">
          <img v-if="clipboardCard.kind === 'image'" :src="clipboardCard.previewUrl" alt="" />
          <div>
            <strong>{{ clipboardCard.kind === 'image' ? '检测到复制的图片' : '检测到复制的文本' }}</strong>
            <p v-if="clipboardCard.kind === 'text'" class="companion-clipboard-preview">{{ clipboardCard.text }}</p>
          </div>
          <div class="companion-clipboard-actions">
            <button type="button" class="btn btn-primary btn-sm" @click="acceptClipboardCard">{{ clipboardCard.kind === 'image' ? '存入作品册' : '发给角色' }}</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="dismissClipboardCard">忽略</button>
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

        <div v-if="toolActivity || thinkingActivity" class="companion-tool-indicator" role="status">
          <ArchiveIcon :name="toolActivity ? 'gear' : 'spark'" /> {{ toolActivity || '思考中…' }}
        </div>

        <div class="companion-composer">
          <div
            v-if="!chatReady || voiceCapabilityState === 'offline' || preparingRoom"
            class="companion-setup-inline"
            :data-state="preparingRoom ? 'active' : 'warning'"
          >
            <ArchiveIcon name="gear" />
            <span>{{ setupTitle }}</span>
            <button
              v-if="chatProvider === 'local' || (chatReady && voiceCapabilityState === 'offline')"
              class="companion-setup-action"
              type="button"
              :disabled="preparingRoom"
              @click="prepareRoom"
            >{{ preparingRoom ? '准备中…' : '准备环境' }}</button>
            <RouterLink v-else class="companion-setup-action" to="/chat">前往配置</RouterLink>
          </div>
          <textarea
            class="companion-input"
            v-model="inputText"
            rows="2"
            maxlength="1200"
            placeholder="对她说点什么……"
            aria-label="桌宠聊天输入"
            @focus="composerFocused = true"
            @blur="composerFocused = false"
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
           <div v-if="speechReady" class="companion-speech-cluster">
            <button
              class="companion-speech-btn"
              type="button"
              :data-state="speechState"
              :disabled="speechButtonDisabled"
              :title="speechError || '按住说话，松开识别；也可按住 Space'"
              @pointerdown.prevent="onSpeechPress"
              @pointerup="onSpeechRelease"
              @pointercancel="onSpeechCancel"
              @pointerleave="onSpeechLeave"
            >{{ speechButtonText }}</button>
            <span class="companion-speech-state" role="status" aria-live="polite">
              {{ speechStateText || (speechAutoListening ? '听候唤醒' : '') }}
            </span>
             <span v-if="speechSessionActive" class="companion-speech-session" role="status">
               连续对话中
               <button
                 class="companion-speech-session-end"
                 type="button"
                 title="结束连续对话"
                 aria-label="结束连续对话"
                 @click="onSpeechSessionEnd"
               >×</button>
             </span>
            <button
              class="companion-speech-settings"
              type="button"
              title="语音输入设置"
              aria-label="语音输入设置"
              @click="speechSettingsOpen = !speechSettingsOpen"
            >设置</button>
           </div>
           <div v-else class="companion-speech-cluster">
             <button
               class="companion-speech-settings"
               type="button"
               title="配置语音输入"
               aria-label="配置语音输入"
               @click="speechSettingsOpen = true"
             >语音设置</button>
           </div>
           <div class="companion-composer-meta" aria-live="polite">
             <span class="companion-chat-status">{{ chatStatusText }}</span>
             <span v-if="voiceStatusText" class="companion-voice-status">{{ voiceStatusText }}</span>
             <span v-if="inQuietHours" class="companion-quiet-hours-hint" :title="quietHoursText"><ArchiveIcon name="moon" /> 安静时段</span>
           </div>
         </div>

        <SpeechInputSettings
          v-if="speechSettingsOpen"
          @save="onSpeechSettingsSaved"
          @close="speechSettingsOpen = false"
        />

        <div class="companion-error" role="status" aria-live="polite" :data-kind="chatErrorKind">
          {{ chatError }}
        </div>
        <div v-if="workspaceOpen" class="companion-workspace-settings" role="dialog" aria-label="AI 工作区设置">
          <div>
            <strong>AI 工作区</strong>
            <span>存放样张、训练数据与配音资源的目录（例如 E:\AI）。设置后网关重启生效。</span>
          </div>
          <input
            v-model="workspaceInput"
            type="text"
            placeholder="目录路径"
            aria-label="AI 工作区目录路径"
            @keydown.enter="saveWorkspace"
          />
          <div class="companion-workspace-actions">
            <button type="button" class="btn btn-primary" :disabled="workspaceSaving" @click="saveWorkspace">
              {{ workspaceSaving ? '保存中…' : '保存并重启网关' }}
            </button>
            <button type="button" class="btn btn-ghost" @click="workspaceOpen = false">关闭</button>
          </div>
        </div>
        <p class="sr-only" role="status" aria-live="polite">{{ replyAnnouncement }}</p>
      </section>
    </main>
  </article>
</template>

<script setup lang="ts">
import '@/assets/css/companion.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { controlApi } from '../api/controlApi.ts'
import { trainingApi } from '../api/trainingApi.ts'
import { useCharacterRoomSession } from '@/composables/useCharacterRoomSession'
import ChatCharacterStage from '@/components/ChatCharacterStage.vue'
import SpeechInputSettings from '@/components/SpeechInputSettings.vue'
import { imgCount } from '@/composables/useImageStore'
import { pickCompanionLine } from '@/config/characters'
import { pickEnvironmentGreeting } from '@/utils/environmentContext'
import { resolveCompanionPresence } from '@/utils/companionPresence'
import { importLocalImages } from '@/utils/desktopImport'
import type { ImportSourceFile } from '@/utils/desktopImportCore'
import { createCompanionBehavior, normalizeCompanionConfig, type CompanionReminder } from '@/utils/companionBehavior'
import {
  createCompanionEventDetector,
  EVENT_NOTIFY_TITLE,
  EVENT_ROUTE,
  type CompanionDetectedEvent,
} from '@/utils/companionEvents'
import { COMPANION_BEHAVIOR_KEY, COMPANION_LIVE2D_KEY } from '@/utils/storageKeys'
import { useVoiceInput, type VoiceTextSource } from '@/composables/useVoiceInput'
import { isSpeechInputReady, loadSpeechInputConfig } from '@/utils/speechInputConfig'
import { createSpeechSession } from '@/utils/speechSession'

const CHARACTER_IDS = ['nene', 'natsume'] as const

const {
  chatListRef,
  characterStageRef,
  activeChar,
  busy,
  voiceActive,
  chatError,
  chatErrorKind,
  toolActivity,
  thinkingActivity,
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
const desktopWindowBounds = ref<{ x: number; y: number; width: number; height: number } | null>(null)
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
const eventDetector = createCompanionEventDetector()
const importInputRef = ref<HTMLInputElement>()
const settingsOpen = ref(false)
const workspaceOpen = ref(false)
const workspaceInput = ref('')
const workspaceExists = ref(false)
const workspaceSaving = ref(false)
const workspaceTooltip = computed(() => workspaceExists.value
  ? `AI 工作区：${workspaceInput.value || '已配置'}`
  : '未配置 AI 工作区：样张预览与训练不可用，点击设置')
interface ClipboardCard {
  kind: 'image' | 'text'
  png?: Uint8Array
  previewUrl?: string
  text?: string
}
const clipboardCard = ref<ClipboardCard | null>(null)
let clipboardCardTimer = 0
let clipboardImageSubscription: number | undefined
let clipboardTextSubscription: number | undefined
let behaviorTimer = 0
let eventPollTimer = 0
let importBusy = false
let reminderLineOffset = 0
let eventLineOffset = 0
let eventPolling = false
let eventPollController: AbortController | null = null
let lastActivityAt = Date.now()
let greetedSlotKey = ''
let uiIdleTimer = 0
let uiHidden = false
let lastPointerMove = Date.now()
let mouseToggleBlockedUntil = 0
const immersive = ref(false)
const speechConfig = ref(loadSpeechInputConfig())
const speechSettingsOpen = ref(false)
const speechSession = createSpeechSession()
const speechNotice = ref('')
const documentHidden = ref(typeof document !== 'undefined' && document.hidden)
const composerFocused = ref(false)
const {
  state: speechState,
  errorMessage: speechError,
  supported: speechSupported,
  autoListening: speechAutoListening,
  start: speechStart,
  stop: speechStop,
  cancel: speechCancel,
  release: speechRelease,
} = useVoiceInput({
  config: () => speechConfig.value,
  onText: onSpeechText,
})
const speechReady = computed(() => isSpeechInputReady(speechConfig.value) && speechSupported)
const speechBusy = computed(() => ['acquiring', 'capturing', 'recognizing'].includes(speechState.value))
const speechSessionActive = computed(() => speechSession.isSessionActive())
const pageVisible = computed(() => !documentHidden.value && desktopWindowVisible.value)
const presence = computed(() => resolveCompanionPresence({
  visible: pageVisible.value,
  dnd: dnd.value,
  quietHours: inQuietHours.value,
  speaking: isSpeaking.value,
  listening: speechState.value === 'capturing',
  thinking: busy.value || Boolean(thinkingActivity.value) || Boolean(toolActivity.value),
  composing: composerFocused.value || Boolean(inputText.value.trim()),
  hasReminder: pendingReminders.value.length > 0,
}))
const speechButtonDisabled = computed(() => busy.value || !chatReady.value || !pageVisible.value
  || speechState.value === 'recognizing')
const speechButtonText = computed(() => {
  if (speechState.value === 'acquiring') return '启动中…'
  if (speechState.value === 'capturing') return '松开结束'
  if (speechState.value === 'recognizing') return '识别中…'
  if (speechState.value === 'error') return '重试'
  return '按住说话'
})
const speechStateText = computed(() => {
  if (speechState.value === 'capturing') return '聆听中…'
  if (speechState.value === 'recognizing') return '正在识别…'
  if (speechState.value === 'error') return speechError.value
  return speechNotice.value
})
let speechHeldByKeyboard = false
let speechHeldByPointer = false
let resumeSubscription: number | undefined
let shownSubscription: number | undefined
let visibilitySubscription: number | undefined
let windowBoundsSubscription: number | undefined
let powerModeSubscription: number | undefined
let interactionModeSubscription: number | undefined
let globalMouseSubscription: number | undefined
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

/** 沉浸模式：鼠标在舞台活动时 UI 浮现，静止数秒后自动隐去（桌面窗口）。 */
function setUiHidden(hidden: boolean) {
  if (uiHidden === hidden) return
  uiHidden = hidden
  document.documentElement.classList.toggle('companion-ui-hidden', hidden)
}

function enterImmersive() {
  if (!desktopBridge) return
  immersive.value = true
  document.documentElement.classList.add('companion-immersive')
  // 进入沉浸前取消自动隐现计时，避免冲突
  clearTimeout(uiIdleTimer)
  uiHidden = false
  document.documentElement.classList.remove('companion-ui-hidden')
}

function exitImmersive() {
  if (!immersive.value) return
  immersive.value = false
  document.documentElement.classList.remove('companion-immersive')
}

function onWindowKeydown(event: KeyboardEvent) {
  noteActivity()
  if (event.key === 'Escape' && immersive.value) {
    exitImmersive()
    return
  }
  if (event.key === 'Escape' && settingsOpen.value) {
    settingsOpen.value = false
    return
  }
  if (event.key !== ' ' || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
    || (target instanceof HTMLElement && Boolean(target.closest('button, a, [role="button"]')))) return
  if (speechButtonDisabled.value || speechBusy.value || speechHeldByKeyboard) return
  speechHeldByKeyboard = true
  event.preventDefault()
  void speechStart('manual')
}

function onWindowKeyup(event: KeyboardEvent) {
  if (event.key !== ' ' || !speechHeldByKeyboard) return
  speechHeldByKeyboard = false
  event.preventDefault()
  if (speechState.value === 'acquiring') speechCancel()
  else speechStop()
}

function applySpeechSession() {
  speechSession.applyConfig(speechConfig.value, currentCharacter.value.name)
}

function commitSpeechText(text: string) {
  inputText.value = text
  if (speechConfig.value.autoSend && chatReady.value && !busy.value) void handleSend()
}

function onSpeechText(text: string, source: VoiceTextSource) {
  if (source === 'auto' && !speechSession.isSessionActive()) {
    if (speechSession.onWakeText(text)) speechNotice.value = `已唤醒${currentCharacter.value.name}，可以直接对话了`
    return
  }
  const action = speechSession.onSessionText(text)
  if (action === 'end') {
    speechNotice.value = '已退出连续对话'
    return
  }
  if (action === 'submit') {
    speechNotice.value = ''
    commitSpeechText(text)
  }
}

function reconcileAutoListen() {
  const shouldListen = speechReady.value
    && speechConfig.value.wakeEnabled
    && chatReady.value
    && !busy.value
    && !dnd.value
    && !inQuietHours.value
    && pageVisible.value
    && speechState.value !== 'error'
    && speechSession.shouldAutoListen()
  if (shouldListen && !speechAutoListening.value && !speechBusy.value) {
    void speechStart('auto')
  } else if (!shouldListen && speechAutoListening.value) {
    speechStop()
  }
}

function onSpeechPress() {
  if (speechButtonDisabled.value || speechBusy.value) return
  speechHeldByPointer = true
  void speechStart('manual')
}

function onSpeechRelease() {
  if (!speechHeldByPointer) return
  speechHeldByPointer = false
  if (speechState.value === 'acquiring') speechCancel()
  else speechStop()
}

function onSpeechCancel() {
  speechHeldByPointer = false
  speechCancel()
}

function onSpeechLeave(event: PointerEvent) {
  if (speechHeldByPointer && event.buttons > 0) onSpeechCancel()
}

function onSpeechSettingsSaved() {
  speechConfig.value = loadSpeechInputConfig()
  applySpeechSession()
  reconcileAutoListen()
  speechSettingsOpen.value = false
}

function onSpeechSessionEnd() {
  speechSession.endSession()
  speechNotice.value = '已结束连续对话'
  reconcileAutoListen()
}

function onDocumentVisibilityChange() {
  documentHidden.value = document.hidden
  if (!pageVisible.value) speechCancel()
  reconcileAutoListen()
}

/** 点击齿轮弹层外部时关闭设置弹层（弹层内已 @pointerdown.stop）。 */
function onDocPointerDown(event: PointerEvent) {
  if (!settingsOpen.value) return
  const target = event.target
  if (target instanceof Element && target.closest('.companion-settings-popover, .companion-settings-btn')) return
  settingsOpen.value = false
}

function onPointerMove(event: PointerEvent) {
  lastPointerMove = Date.now()
  if (uiHidden) setUiHidden(false)
  clearTimeout(uiIdleTimer)
  if (!desktopBridge) return
  // 穿透模式只转发 mousemove、不转发 click——鼠标悬停在可交互元素上时
  // 自动恢复交互，否则"恢复交互"按钮永远点不到（看起来像卡死）。
  // 排除穿透切换按钮本身：悬停它不应恢复（会刚穿透又立刻恢复）。
  if (ignoreMouseEvents.value && Date.now() >= mouseToggleBlockedUntil) {
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const interactive = element instanceof HTMLElement
      && Boolean(element.closest('button, a, input, textarea, select, [role="button"], [tabindex]'))
    // 排除穿透切换按钮本身：悬停它不应恢复（会刚穿透又立刻恢复）
    const self = element instanceof HTMLElement ? element.closest('button') : null
    const onToggleButton = Boolean(self && /穿透|恢复交互/.test(self.textContent || ''))
    if (interactive && !onToggleButton) {
      ignoreMouseEvents.value = false
      desktopBridge.setIgnoreMouseEvents(false)
    }
  }
  uiIdleTimer = window.setTimeout(() => {
    if (!viewAlive || !desktopWindowVisible.value) return
    // 输入框聚焦时保持 UI（正在打字不能突然消失）
    if (document.activeElement instanceof HTMLTextAreaElement
      || document.activeElement instanceof HTMLInputElement) return
    if (Date.now() - lastPointerMove > 3000) setUiHidden(true)
  }, 3200) as unknown as number
}

function toggleDnd() {
  const next = !behavior.config().dnd
  behavior.setConfig({ dnd: next })
  dnd.value = next
  persistBehaviorConfig()
  reconcileAutoListen()
}

function dismissReminder(id: string) {
  behavior.dismiss(id)
  syncReminders()
}

/** 时间片问候：同一时间片只入队一次；周日/周末视为不同片 */
function currentGreetedSlotKey(): string {
  const now = new Date()
  const greeting = pickEnvironmentGreeting(activeChar.value, now)
  return `${activeChar.value}:${greeting.slot}:${greeting.weekend ? 'w' : 'd'}`
}

function maybeGreetByTime(force = false) {
  if (!behaviorEnabled.value) return
  const key = currentGreetedSlotKey()
  if (!force && key === greetedSlotKey) return
  greetedSlotKey = key
  const greeting = pickEnvironmentGreeting(activeChar.value, new Date(), reminderLineOffset)
  reminderLineOffset += 1
  const reminder = behavior.noteReturn(greeting.line)
  if (reminder) syncReminders()
}

function runBehaviorTick() {
  syncReminders()
  const reminder = behavior.tick()
  if (reminder) {
    reminderLineOffset += 1
    reminder.line = pickCompanionLine(activeChar.value, 'idle', reminderLineOffset)
    syncReminders()
  }
  // 跨时间片（午→下午、工作日→周末）时给一条环境问候
  if (viewAlive && desktopWindowVisible.value) maybeGreetByTime()
  reconcileAutoListen()
}

async function pollCompanionEvents() {
  if (eventPolling || !viewAlive) return
  eventPolling = true
  const controller = new AbortController()
  eventPollController = controller
  try {
    const [status, trainingJobs, imageCount] = await Promise.all([
      controlApi.getStatus({ signal: controller.signal }).catch(() => null),
      trainingApi.getJobs({ signal: controller.signal }).then(result => result.jobs).catch(() => null),
      imgCount().catch(() => -1),
    ])
    if (!viewAlive || controller.signal.aborted || !status || status.ok === false) return
    const jobs = (trainingJobs || []).map(job => ({
      id: job.id,
      status: job.status,
      percent: Number.isFinite(job.progress.percent) ? job.progress.percent : 0,
    }))
    // 任务栏进度环：训练中的任务显示 percent；空闲/完成/失败清除
    const activeJob = jobs.find(job => job.status === 'running' || job.status === 'stopping')
    desktopBridge?.setProgress(activeJob ? (activeJob.percent || 0) / 100 : null)
    const events = eventDetector.ingest({
      imageCount: imageCount >= 0 ? imageCount : 0,
      services: {
        sdOnline: status.sdOnline,
        ttsOnline: status.ttsOnline,
        ollamaOnline: status.ollamaOnline,
      },
      jobs,
    })
    for (const event of events) {
      eventLineOffset += 1
      const line = pickCompanionLine(activeChar.value, 'event', eventLineOffset, event)
      const reminder = behavior.noteEvent(event, line)
      if (reminder) {
        syncReminders()
        if (desktopBridge) desktopBridge.notify(EVENT_NOTIFY_TITLE[event], line)
      }
    }
  } catch {
    // 轮询失败静默：下次再试
  } finally {
    if (eventPollController === controller) eventPollController = null
    eventPolling = false
  }
}

function openReminderRoute(reminder: CompanionReminder) {
  if (reminder.kind !== 'event' || !reminder.eventKind) return
  const route = EVENT_ROUTE[reminder.eventKind as CompanionDetectedEvent]
  if (!route) return
  if (desktopBridge) {
    dismissReminder(reminder.id)
    desktopBridge.openAtelier(route)
  }
}

async function handleImportedFiles(files: readonly ImportSourceFile[]) {
  if (importBusy || !files.length) return
  importBusy = true
  try {
    const { imported, skipped } = await importLocalImages(files)
    if (imported > 0) {
      reminderLineOffset += 1
      const line = `收到 ${imported} 张图片，已经放进作品册啦${skipped > 0 ? `（${skipped} 张格式不支持）` : ''}。`
      const reminder = behavior.noteReturn(line)
      if (reminder) syncReminders()
      if (desktopBridge) desktopBridge.notify(currentCharacter.value.name, line)
      // 导入也会让图片计数增加；重置检测器基线避免误报 sd-done
      eventDetector.reset()
    } else if (skipped > 0) {
      const line = '这几张图片好像打不开……再试试别的？'
      const reminder = behavior.noteReturn(line)
      if (reminder) syncReminders()
    }
  } finally {
    importBusy = false
  }
}

function onImportInputChange() {
  const input = importInputRef.value
  const files = input?.files ? Array.from(input.files) : []
  if (input) input.value = ''
  void handleImportedFiles(files.map(file => ({ name: file.name, size: file.size, type: file.type, blob: file })))
}

function onWindowDrop(event: DragEvent) {
  const files = event.dataTransfer?.files
  if (!files || !files.length) return
  event.preventDefault()
  void handleImportedFiles(Array.from(files).map(file => ({ name: file.name, size: file.size, type: file.type, blob: file })))
}

function onWindowDragOver(event: DragEvent) {
  event.preventDefault()
}

async function refreshWorkspaceState() {
  if (!desktopBridge) return
  try {
    const workspace = await desktopBridge.getWorkspace()
    if (!viewAlive) return
    workspaceInput.value = workspace.root
    workspaceExists.value = workspace.exists
  } catch {
    // 桌面桥未就绪时忽略
  }
}

async function saveWorkspace() {
  if (!desktopBridge || workspaceSaving.value) return
  const value = workspaceInput.value.trim()
  if (!value) return
  workspaceSaving.value = true
  try {
    const result = await desktopBridge.setWorkspace(value)
    workspaceInput.value = result.root
    workspaceExists.value = true
    workspaceOpen.value = false
    chatError.value = 'AI 工作区已更新，网关已重启。'
    chatErrorKind.value = 'info'
    void refreshRoomState()
  } catch (error) {
    chatError.value = (error as Error).message || '工作区设置失败'
    chatErrorKind.value = 'error'
  } finally {
    workspaceSaving.value = false
  }
}

function showClipboardCard(card: ClipboardCard) {
  clipboardCard.value = card
  clearTimeout(clipboardCardTimer)
  clipboardCardTimer = window.setTimeout(dismissClipboardCard, 20_000) as unknown as number
}

function clipboardPngBlob(png: Uint8Array): Blob | null {
  try {
    const copy = new Uint8Array(png.byteLength)
    copy.set(png)
    return new Blob([copy.buffer as ArrayBuffer], { type: 'image/png' })
  } catch {
    return null
  }
}

function onClipboardImage(png: Uint8Array) {
  if (!viewAlive) return
  const blob = clipboardPngBlob(png)
  if (!blob) return
  try {
    const previewUrl = URL.createObjectURL(blob)
    showClipboardCard({ kind: 'image', png, previewUrl })
  } catch { /* 大图/内存异常时忽略 */ }
}

function onClipboardText(text: string) {
  if (!viewAlive) return
  showClipboardCard({ kind: 'text', text: text.slice(0, 400) })
}

function dismissClipboardCard() {
  clearTimeout(clipboardCardTimer)
  if (clipboardCard.value?.previewUrl) URL.revokeObjectURL(clipboardCard.value.previewUrl)
  clipboardCard.value = null
}

async function acceptClipboardCard() {
  const card = clipboardCard.value
  if (!card) return
  if (card.kind === 'image' && card.png) {
    const blob = clipboardPngBlob(card.png)
    dismissClipboardCard()
    if (!blob) return
    const { imported } = await importLocalImages([{ name: `剪贴板-${Date.now()}.png`, size: blob.size, type: 'image/png', blob }])
    if (imported > 0) {
      const reminder = behavior.noteReturn('收到剪贴板里的图片，已经放进作品册啦。')
      if (reminder) syncReminders()
      if (desktopBridge) desktopBridge.notify(currentCharacter.value.name, '图片已存入作品册')
      eventDetector.reset()
    }
  } else if (card.kind === 'text' && card.text) {
    const text = card.text
    dismissClipboardCard()
    inputText.value = text
    storage.setDraft(activeChar.value, text)
    chatListRef.value?.scrollTo({ top: chatListRef.value.scrollHeight, behavior: 'smooth' })
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
  if (!desktopBridge) return
  try {
    alwaysOnTop.value = await desktopBridge.toggleAlwaysOnTop()
  } catch (e) {
    console.warn('companion pin toggle failed', e)
  }
}

function toggleMouseEvents() {
  if (!desktopBridge) return
  // 本地立即翻转（主进程回发 desktop:interaction-mode 作兜底同步），
  // 避免回发丢失时按钮状态与真实穿透不一致
  const next = !ignoreMouseEvents.value
  ignoreMouseEvents.value = next
  desktopBridge.setIgnoreMouseEvents(next)
  // 刚切换穿透的瞬间抑制自动恢复：防止点击"穿透"按钮时
  // 悬停触发的恢复把状态又翻回去
  mouseToggleBlockedUntil = Date.now() + 400
}

function setDesktopVisibility(visible: boolean) {
  if (!visible) {
    speechHeldByKeyboard = false
    speechHeldByPointer = false
    speechCancel()
    characterStageRef.value?.releasePointerFocus?.()
  }
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
    // 窗口重新可见：若时间片/周末状态变了，给一条环境问候
    maybeGreetByTime()
    noteActivity()
  }
  characterStageRef.value?.setDesktopVisible?.(visible)
  reconcileAutoListen()
}

function setDesktopPowerMode(onBattery: boolean) {
  onBatteryPower.value = onBattery
  characterStageRef.value?.setDesktopPerformanceMode?.(onBattery)
}

applySpeechSession()

watch(busy, value => {
  if (value) {
    speechHeldByKeyboard = false
    speechHeldByPointer = false
    speechSession.markReplyBusy()
    speechCancel()
  } else {
    speechSession.markReplyIdle()
  }
  reconcileAutoListen()
}, { immediate: true })

watch([speechState, speechConfig, dnd, inQuietHours, desktopWindowVisible, documentHidden, chatReady], reconcileAutoListen)
watch(currentCharacter, () => {
  applySpeechSession()
  reconcileAutoListen()
})

onMounted(async () => {
  document.documentElement.classList.add('companion-mode')
  dnd.value = behavior.config().dnd
  behaviorTimer = window.setInterval(runBehaviorTick, 30_000) as unknown as number
  eventPollTimer = window.setInterval(() => { void pollCompanionEvents() }, 30_000) as unknown as number
  window.addEventListener('pointerdown', noteActivity, { passive: true })
  window.addEventListener('pointerdown', onDocPointerDown, { passive: true })
  window.addEventListener('keydown', onWindowKeydown, { passive: false })
  window.addEventListener('keyup', onWindowKeyup, { passive: false })
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)
  window.addEventListener('wheel', noteActivity, { passive: true })
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('dragover', onWindowDragOver, { passive: false })
  window.addEventListener('drop', onWindowDrop, { passive: false })
  syncReminders()
  maybeGreetByTime()
  reconcileAutoListen()
  void pollCompanionEvents()
  void refreshWorkspaceState()
  if (desktopBridge) {
    document.documentElement.classList.add('companion-desktop')
    clipboardImageSubscription = desktopBridge.onClipboardImage(onClipboardImage)
    clipboardTextSubscription = desktopBridge.onClipboardText(onClipboardText)
    shownSubscription = desktopBridge.onShown(() => setDesktopVisibility(true))
    visibilitySubscription = desktopBridge.onVisibilityChanged(setDesktopVisibility)
    if (desktopBridge.onWindowBoundsChanged) {
      windowBoundsSubscription = desktopBridge.onWindowBoundsChanged(bounds => {
        desktopWindowBounds.value = bounds
        characterStageRef.value?.setDesktopWindowBounds?.(bounds)
      })
    }
    powerModeSubscription = desktopBridge.onPowerModeChanged(setDesktopPowerMode)
    interactionModeSubscription = desktopBridge.onInteractionModeChanged(value => { ignoreMouseEvents.value = value })
    // 全局目光跟随：鼠标在悬浮窗之外时，角色目光仍随屏幕鼠标转动。
    // 窗口内由舞台 DOM 事件驱动（更平滑），这里跳过 inWindow 更新。
    globalMouseSubscription = desktopBridge.onGlobalMouse(state => {
      if (state.inWindow) return
      characterStageRef.value?.setGlobalPointer?.(state.x, state.y, state.bounds)
    })
    resumeSubscription = desktopBridge.onResume(() => {
      if (!desktopWindowVisible.value) return
      characterStageRef.value?.setDesktopVisible?.(desktopWindowVisible.value)
      void refreshRoomState()
    })
    let desktopState: Awaited<ReturnType<typeof desktopBridge.getState>> | null = null
    try {
      desktopState = await desktopBridge.getState()
    } catch (e) {
      console.warn('companion desktop state unavailable', e)
    }
    if (!viewAlive) return
    if (desktopState) {
      alwaysOnTop.value = desktopState.alwaysOnTop
      ignoreMouseEvents.value = desktopState.ignoreMouseEvents
      const legacyLive2dOverride = desktopLive2dOverride.value
      desktopLive2dOverride.value = desktopState.live2dEnabled ?? legacyLive2dOverride
      if (desktopState.live2dEnabled == null && legacyLive2dOverride != null) {
        desktopBridge.setLive2dEnabled(legacyLive2dOverride)
      }
      setDesktopVisibility(desktopState.visible)
      setDesktopPowerMode(desktopState.onBatteryPower)
      if (desktopState.bounds) desktopWindowBounds.value = desktopState.bounds
    } else {
      // IPC 失败时按页面可见性兜底，保证可见窗口里的 Live2D 仍能按需加载
      setDesktopVisibility(!document.hidden)
    }
  }
})
onUnmounted(() => {
  viewAlive = false
  eventPollController?.abort()
  eventPollController = null
  clearInterval(behaviorTimer)
  clearInterval(eventPollTimer)
  clearTimeout(clipboardCardTimer)
  if (clipboardCard.value?.previewUrl) URL.revokeObjectURL(clipboardCard.value.previewUrl)
  window.removeEventListener('pointerdown', noteActivity)
  window.removeEventListener('pointerdown', onDocPointerDown)
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('keyup', onWindowKeyup)
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  window.removeEventListener('wheel', noteActivity)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('dragover', onWindowDragOver)
  window.removeEventListener('drop', onWindowDrop)
  if (desktopBridge && clipboardImageSubscription != null) desktopBridge.offClipboardImage(clipboardImageSubscription)
  if (desktopBridge && clipboardTextSubscription != null) desktopBridge.offClipboardText(clipboardTextSubscription)
  if (desktopBridge && resumeSubscription != null) desktopBridge.offResume(resumeSubscription)
  if (desktopBridge && shownSubscription != null) desktopBridge.offShown(shownSubscription)
  if (desktopBridge && visibilitySubscription != null) desktopBridge.offVisibilityChanged(visibilitySubscription)
  if (desktopBridge && desktopBridge.offWindowBoundsChanged && windowBoundsSubscription != null) {
    desktopBridge.offWindowBoundsChanged(windowBoundsSubscription)
  }
  if (desktopBridge && powerModeSubscription != null) desktopBridge.offPowerModeChanged(powerModeSubscription)
  if (desktopBridge && interactionModeSubscription != null) desktopBridge.offInteractionModeChanged(interactionModeSubscription)
  if (desktopBridge && globalMouseSubscription != null) desktopBridge.offGlobalMouse(globalMouseSubscription)
  speechHeldByKeyboard = false
  speechHeldByPointer = false
  speechCancel()
  speechRelease()
  speechSession.endSession()
  document.documentElement.classList.remove(
    'companion-mode', 'companion-desktop', 'companion-immersive', 'companion-ui-hidden',
  )
  uiHidden = false
  immersive.value = false
})
</script>
