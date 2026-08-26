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
        <div
          class="companion-affection-pill"
          :title="`当前好感度 ${affectionScore}/100\n${affectionInfo.title}（Lv.${affectionInfo.level}）: ${affectionInfo.description}`"
        >
          <ArchiveIcon name="love" class="companion-affection-icon" />
          <span class="companion-affection-label">Lv.{{ affectionInfo.level }} {{ affectionInfo.title }}</span>
          <span class="companion-affection-value">{{ affectionScore }}</span>
        </div>
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
            >
              <ArchiveIcon :name="workspaceExists ? 'success' : 'error'" />
              <span>{{ workspaceExists ? 'AI 工作区已就绪' : 'AI 工作区缺失' }}</span>
            </button>
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
        <TransitionGroup
          v-if="behaviorEnabled && pendingReminders.length"
          name="reminder-pop"
          tag="div"
          class="companion-reminders"
          role="log"
          aria-label="角色主动问候"
        >
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
        </TransitionGroup>
        <Transition name="layer-fade">
        <div v-if="clipboardCard" class="companion-clipboard-card" role="status" aria-live="polite">
          <img v-if="clipboardCard.kind === 'image'" :src="clipboardCard.previewUrl" alt="" />
          <div>
            <strong>{{ clipboardCard.kind === 'image' ? '检测到复制的图片' : '检测到复制的文本' }}</strong>
            <p v-if="clipboardCard.kind === 'text'" class="companion-clipboard-preview">{{ clipboardCard.text }}</p>
          </div>
          <div class="companion-clipboard-actions">
            <button
              v-if="clipboardCard.kind === 'image'"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="inspectClipboardImage"
            >让{{ currentCharacter.name }}看看</button>
            <button type="button" class="btn btn-primary btn-sm" @click="acceptClipboardCard">{{ clipboardCard.kind === 'image' ? '存入作品册' : '发给角色' }}</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="dismissClipboardCard">忽略</button>
          </div>
        </div>
        </Transition>
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
            class="companion-vision-btn"
            type="button"
            :disabled="busy || !chatReady || capturingScreen"
            :title="`让${currentCharacter.name}看你当前的屏幕画面`"
            aria-label="看屏幕"
            @click="onCaptureAndInspectScreen"
          >
            <ArchiveIcon name="eye" />
            <span>{{ capturingScreen ? '看屏中…' : '看屏幕' }}</span>
          </button>
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
        <p class="sr-only" role="status" aria-live="polite">{{ replyAnnouncement }}</p>
      </section>

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

      <!-- 真双窗口（桌面）浮层：角色为主，聊天独立窗口。 -->
      <div v-if="desktopBridge" class="companion-desktop-float" aria-label="桌宠快捷操作">
        <TransitionGroup name="reminder-pop" tag="div" class="companion-float-reminders" role="log" aria-label="角色主动问候">
          <div
            v-for="reminder in pendingReminders"
            :key="reminder.id"
            class="companion-float-reminder"
            :data-kind="reminder.kind"
            :data-event-kind="reminder.eventKind || undefined"
            :title="reminder.kind === 'event' && reminder.eventKind ? '点击打开对应页面' : ''"
            :class="{ 'companion-reminder-link': reminder.kind === 'event' && reminder.eventKind }"
            @click="openReminderRoute(reminder)"
          >
            <span>{{ currentCharacter.name }}</span>
            <p>{{ reminder.line }}</p>
            <button type="button" aria-label="关闭这条问候" @click.stop="dismissReminder(reminder.id)">×</button>
          </div>
        </TransitionGroup>
        <button
          class="companion-chat-chip"
          type="button"
          title="打开聊天窗（Ctrl+Shift+X）"
          aria-label="打开聊天"
          @click="openChatWindow"
        ><ArchiveIcon name="chat" /><span>聊天</span></button>
        <span class="companion-live-dot" :data-state="liveDotState" role="status" aria-live="polite">
          <i aria-hidden="true"></i>{{ liveDotText }}
        </span>
      </div>
    </main>
  </article>
</template>

<script setup lang="ts">
import '@/assets/css/companion.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { scrollBehavior } from '@/utils/motionPreference'
import { useCharacterRoomSession } from '@/composables/chat/useCharacterRoomSession'
import ChatCharacterStage from '@/components/ChatCharacterStage.vue'
import SpeechInputSettings from '@/components/SpeechInputSettings.vue'
import { pickCompanionLine } from '@/config/characters'
import { resolveCompanionPresence } from '@/utils/companionPresence'
import { useCompanionBehaviorRuntime } from '@/composables/useCompanionBehaviorRuntime'
import { useCompanionClipboardImport } from '@/composables/useCompanionClipboardImport'
import { COMPANION_CHAT_LIVE_KEY, COMPANION_LIVE2D_KEY } from '@/utils/storageKeys'
import { useCompanionSpeechInput } from '@/composables/useCompanionSpeechInput'
import { useCompanionAffection } from '@/composables/useCompanionAffection'

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
const { getScore, getLevelInfo } = useCompanionAffection()
const affectionScore = computed(() => getScore(activeChar.value))
const affectionInfo = computed(() => getLevelInfo(activeChar.value))
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
// ── 角色行为运行时（提醒/问候/事件轮询/勿扰）已下沉 useCompanionBehaviorRuntime ──
// 两只 30s 心跳与轮询 AbortController 生命周期由 composable 自持；
// 导入/剪贴板入册走 noteReturn 族 + resetEventDetector 重置检测基线。
const {
  behaviorEnabled,
  dnd,
  pendingReminders,
  inQuietHours,
  quietHoursText,
  noteActivity,
  getLastActivityAt,
  getIdleMinutes,
  noteReturn,
  noteReturnPlain,
  toggleDnd,
  dismissReminder,
  maybeGreetByTime,
  openReminderRoute,
  resetEventDetector,
} = useCompanionBehaviorRuntime({
  activeChar,
  desktopBridge,
  desktopWindowVisible: () => desktopWindowVisible.value,
  // 语音簇在本簇之后接线（它依赖 dnd/inQuietHours），这里延迟引用避免 TDZ。
  reconcileAutoListen: () => reconcileAutoListen(),
})
// ── 语音输入（按住说话/Space 保持/唤醒会话/auto-listen gating）已下沉
//    useCompanionSpeechInput；visibilitychange 监听与卸载释放自持。──
const {
  speechReady,
  speechState,
  speechError,
  speechAutoListening,
  speechSessionActive,
  speechButtonDisabled,
  speechButtonText,
  speechStateText,
  speechSettingsOpen,
  pageVisible,
  onSpeechPress,
  onSpeechRelease,
  onSpeechCancel,
  onSpeechLeave,
  onSpeechSessionEnd,
  onSpeechSettingsSaved,
  handleSpaceKeyDown,
  handleSpaceKeyUp,
  cancelSpeechActivity,
  reconcileAutoListen,
} = useCompanionSpeechInput({
  busy,
  chatReady,
  inputText,
  currentCharacter,
  currentCharacterName: () => currentCharacter.value.name,
  desktopBridge,
  desktopWindowVisible,
  dnd,
  inQuietHours,
  handleSend,
  isEditableTarget,
})
// ── 剪贴板浮卡 / 本地导入 / 看屏检视（已下沉 useCompanionClipboardImport）──
// 剪贴板订阅、拖拽监听与浮卡 20s 计时器生命周期由 composable 自持。
const {
  importInputRef,
  clipboardCard,
  capturingScreen,
  onImportInputChange,
  dismissClipboardCard,
  acceptClipboardCard,
  onCaptureAndInspectScreen,
  inspectClipboardImage,
} = useCompanionClipboardImport({
  activeChar,
  desktopBridge,
  currentCharacterName: () => currentCharacter.value.name,
  noteReturn,
  noteReturnPlain,
  resetEventDetector,
  inputText,
  persistDraft: text => storage.setDraft(activeChar.value, text),
  scrollChatToBottom: () => chatListRef.value?.scrollTo({ top: chatListRef.value.scrollHeight, behavior: scrollBehavior() }),
  handleSend,
  busy,
  chatReady,
})
const settingsOpen = ref(false)
const workspaceOpen = ref(false)
const workspaceInput = ref('')
const workspaceExists = ref(false)
const workspaceSaving = ref(false)
const workspaceTooltip = computed(() => workspaceExists.value
  ? `AI 工作区：${workspaceInput.value || '已配置'}`
  : '未配置 AI 工作区：样张预览与训练不可用，点击设置')
let uiIdleTimer = 0
let uiHidden = false
let lastPointerMove = Date.now()
let mouseToggleBlockedUntil = 0
const immersive = ref(false)
const composerFocused = ref(false)
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

/* ============================================================
 * 真双窗口（桌面）：实时状态下行 + 聊天窗指令接入
 * 角色窗是会话运行时唯一写者；聊天窗经 COMPANION_CHAT_LIVE_KEY
 * 下行 busy/thinking/speaking/activeChar/chatReady，经
 * bridge.onChatCommand 接收 send/switch/stop 中继。
 * ============================================================ */
const liveDotState = computed(() => {
  if (isSpeaking.value) return 'speaking'
  if (busy.value || thinkingActivity.value || Boolean(toolActivity.value)) return 'busy'
  return 'idle'
})
const liveDotText = computed(() => {
  if (!chatReady.value) return '聊天未就绪'
  if (isSpeaking.value) return '配音中'
  if (busy.value) return '回复中'
  if (thinkingActivity.value || Boolean(toolActivity.value)) return '思考中'
  return '陪伴中'
})

function publishLiveState() {
  if (!desktopBridge) return
  try {
    localStorage.setItem(COMPANION_CHAT_LIVE_KEY, JSON.stringify({
      busy: busy.value,
      thinking: Boolean(thinkingActivity.value || toolActivity.value),
      speaking: isSpeaking.value,
      activeChar: activeChar.value,
      chatReady: chatReady.value,
      ts: Date.now(),
    }))
  } catch { /* 隐私模式忽略 */ }
}
watch([busy, thinkingActivity, toolActivity, isSpeaking, activeChar, chatReady], publishLiveState, { flush: 'sync' })

function openChatWindow() {
  desktopBridge?.openChat?.()
}

function onChatCommand(payload: { command?: string; text?: string; imageUrl?: string; character?: string }) {
  if (!viewAlive) return
  if (payload.command === 'send' && typeof payload.text === 'string' && payload.text.trim()) {
    handleSend(payload.text, payload.imageUrl)
  } else if (payload.command === 'switch-character' && payload.character) {
    switchCharacter(payload.character)
  } else if (payload.command === 'stop') {
    stopEverything()
  }
}
let chatCommandSubscription: number | undefined
let resumeSubscription: number | undefined
let shownSubscription: number | undefined
let visibilitySubscription: number | undefined
let windowBoundsSubscription: number | undefined
let powerModeSubscription: number | undefined
let interactionModeSubscription: number | undefined
let globalMouseSubscription: number | undefined
let viewAlive = true

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
  // 真双窗口：角色窗不再内嵌输入；Space 呼出聊天窗（如已开则落到聊天窗自身处理）
  if (desktopBridge) {
    if (event.key === ' ' && !event.repeat && !isEditableTarget(event.target)) {
      event.preventDefault()
      void openChatWindow()
    }
    return
  }
  handleSpaceKeyDown(event)
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLElement) {
    return target.isContentEditable || Boolean(target.closest('button, a, [role="button"]'))
  }
  return false
}

function onWindowKeyup(event: KeyboardEvent) {
  handleSpaceKeyUp(event)
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
    cancelSpeechActivity()
    characterStageRef.value?.releasePointerFocus?.()
  }
  if (desktopWindowVisible.value === visible) return
  desktopWindowVisible.value = visible
  if (visible) {
    // 重新可见且离开超过提醒阈值：入队一条"回来"问候
    const awayMs = Date.now() - getLastActivityAt()
    const idleMinutes = getIdleMinutes()
    if (idleMinutes > 0 && awayMs > idleMinutes * 60_000) {
      noteReturn(offset => pickCompanionLine(activeChar.value, 'return', offset))
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

onMounted(async () => {
  document.documentElement.classList.add('companion-mode')
  window.addEventListener('pointerdown', noteActivity, { passive: true })
  window.addEventListener('pointerdown', onDocPointerDown, { passive: true })
  window.addEventListener('keydown', onWindowKeydown, { passive: false })
  window.addEventListener('keyup', onWindowKeyup, { passive: false })
  window.addEventListener('wheel', noteActivity, { passive: true })
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  reconcileAutoListen()
  void refreshWorkspaceState()
  if (desktopBridge) {
    document.documentElement.classList.add('companion-desktop')
    // 真双窗口：先下行一次实时状态，聊天窗打开即有正确内容
    publishLiveState()
    chatCommandSubscription = desktopBridge.onChatCommand(onChatCommand)
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
  window.removeEventListener('pointerdown', noteActivity)
  window.removeEventListener('pointerdown', onDocPointerDown)
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('keyup', onWindowKeyup)
  window.removeEventListener('wheel', noteActivity)
  window.removeEventListener('pointermove', onPointerMove)
  if (desktopBridge && resumeSubscription != null) desktopBridge.offResume(resumeSubscription)
  if (desktopBridge && shownSubscription != null) desktopBridge.offShown(shownSubscription)
  if (desktopBridge && visibilitySubscription != null) desktopBridge.offVisibilityChanged(visibilitySubscription)
  if (desktopBridge && desktopBridge.offWindowBoundsChanged && windowBoundsSubscription != null) {
    desktopBridge.offWindowBoundsChanged(windowBoundsSubscription)
  }
  if (desktopBridge && powerModeSubscription != null) desktopBridge.offPowerModeChanged(powerModeSubscription)
  if (desktopBridge && interactionModeSubscription != null) desktopBridge.offInteractionModeChanged(interactionModeSubscription)
  if (desktopBridge && globalMouseSubscription != null) desktopBridge.offGlobalMouse(globalMouseSubscription)
  if (desktopBridge && chatCommandSubscription != null) desktopBridge.offChatCommand(chatCommandSubscription)
  document.documentElement.classList.remove(
    'companion-mode', 'companion-desktop', 'companion-immersive', 'companion-ui-hidden',
  )
  uiHidden = false
  immersive.value = false
})
</script>
