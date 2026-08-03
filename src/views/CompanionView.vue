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
        <input
          ref="importInputRef"
          class="sr-only"
          type="file"
          accept="image/*"
          multiple
          aria-label="导入本地图片到作品册"
          @change="onImportInputChange"
        />
        <button type="button" class="companion-import-btn" title="导入本地图片到作品册" @click="importInputRef?.click()">导图</button>
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
          <span
            v-if="desktopBridge"
            class="companion-workspace-state"
            :data-state="workspaceExists ? 'ok' : 'missing'"
            :title="workspaceTooltip"
            role="button"
            tabindex="0"
            @click="workspaceOpen = !workspaceOpen"
            @keydown.enter="workspaceOpen = !workspaceOpen"
          >{{ workspaceExists ? '工作区 ✓' : '工作区 ✗' }}</span>
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
import { useCharacterRoomSession } from '@/composables/useCharacterRoomSession'
import ChatCharacterStage from '@/components/ChatCharacterStage.vue'
import { imgCount } from '@/composables/useImageStore'
import { pickCompanionLine } from '@/config/characters'
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
const eventDetector = createCompanionEventDetector()
const importInputRef = ref<HTMLInputElement>()
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

async function pollCompanionEvents() {
  if (eventPolling || !viewAlive) return
  eventPolling = true
  try {
    const [statusResponse, trainingResponse, imageCount] = await Promise.all([
      fetch('/api/status', { cache: 'no-store' }).catch(() => null),
      fetch('/api/training/jobs', { cache: 'no-store' }).catch(() => null),
      imgCount().catch(() => -1),
    ])
    if (!viewAlive) return
    if (statusResponse && statusResponse.ok) {
      const status: unknown = await statusResponse.json().catch(() => null)
      const value = status && typeof status === 'object' ? status as Record<string, unknown> : null
      if (value) {
        const jobs: { id: string; status: 'idle' | 'running' | 'stopping' | 'completed' | 'failed' | 'stopped'; percent: number }[] = []
        if (trainingResponse && trainingResponse.ok) {
          const trainingData: unknown = await trainingResponse.json().catch(() => null)
          const jobsValue = trainingData && typeof trainingData === 'object'
            ? (trainingData as Record<string, unknown>).jobs : null
          if (Array.isArray(jobsValue)) {
            const allowedStatuses = ['idle', 'running', 'stopping', 'completed', 'failed', 'stopped']
            for (const item of jobsValue) {
              const job = item && typeof item === 'object' ? item as Record<string, unknown> : null
              if (job && typeof job.id === 'string' && typeof job.status === 'string'
                && allowedStatuses.includes(job.status)) {
                const progress = job.progress && typeof job.progress === 'object'
                  ? (job.progress as Record<string, unknown>).percent : undefined
                jobs.push({
                  id: job.id,
                  status: job.status as 'idle' | 'running' | 'stopping' | 'completed' | 'failed' | 'stopped',
                  percent: typeof progress === 'number' && Number.isFinite(progress) ? progress : 0,
                })
              }
            }
          }
        }
        // 任务栏进度环：训练中的任务显示 percent；空闲/完成/失败清除
        const activeJob = jobs.find(job => job.status === 'running' || job.status === 'stopping')
        desktopBridge?.setProgress(activeJob ? (activeJob.percent || 0) / 100 : null)
        const events = eventDetector.ingest({
          imageCount: imageCount >= 0 ? imageCount : 0,
          services: {
            sdOnline: value.sdOnline === true,
            ttsOnline: value.ttsOnline === true,
            ollamaOnline: value.ollamaOnline === true,
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
      }
    }
  } catch {
    // 轮询失败静默：下次再试
  } finally {
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
  eventPollTimer = window.setInterval(() => { void pollCompanionEvents() }, 30_000) as unknown as number
  window.addEventListener('pointerdown', noteActivity, { passive: true })
  window.addEventListener('keydown', noteActivity, { passive: true })
  window.addEventListener('wheel', noteActivity, { passive: true })
  window.addEventListener('dragover', onWindowDragOver, { passive: false })
  window.addEventListener('drop', onWindowDrop, { passive: false })
  syncReminders()
  void pollCompanionEvents()
  void refreshWorkspaceState()
  if (desktopBridge) {
    document.documentElement.classList.add('companion-desktop')
    clipboardImageSubscription = desktopBridge.onClipboardImage(onClipboardImage)
    clipboardTextSubscription = desktopBridge.onClipboardText(onClipboardText)
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
  clearInterval(eventPollTimer)
  clearTimeout(clipboardCardTimer)
  if (clipboardCard.value?.previewUrl) URL.revokeObjectURL(clipboardCard.value.previewUrl)
  window.removeEventListener('pointerdown', noteActivity)
  window.removeEventListener('keydown', noteActivity)
  window.removeEventListener('wheel', noteActivity)
  window.removeEventListener('dragover', onWindowDragOver)
  window.removeEventListener('drop', onWindowDrop)
  if (desktopBridge && clipboardImageSubscription != null) desktopBridge.offClipboardImage(clipboardImageSubscription)
  if (desktopBridge && clipboardTextSubscription != null) desktopBridge.offClipboardText(clipboardTextSubscription)
  if (desktopBridge && resumeSubscription != null) desktopBridge.offResume(resumeSubscription)
  if (desktopBridge && shownSubscription != null) desktopBridge.offShown(shownSubscription)
  if (desktopBridge && visibilitySubscription != null) desktopBridge.offVisibilityChanged(visibilitySubscription)
  if (desktopBridge && powerModeSubscription != null) desktopBridge.offPowerModeChanged(powerModeSubscription)
  if (desktopBridge && interactionModeSubscription != null) desktopBridge.offInteractionModeChanged(interactionModeSubscription)
  document.documentElement.classList.remove('companion-mode', 'companion-desktop')
})
</script>
