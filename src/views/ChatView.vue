<template>
  <article class="chat-page">
    <a @click.prevent="$router.push('/')" href="/" class="nav-back">← 回首页</a>
    <WorkspaceArchiveBar
      chapter="09"
      title="CHARACTER ROOM"
      :subtitle="`${currentCharacter.name} · PRIVATE MEMORY`"
      :status="busy ? 'COMPOSING' : (voiceActive ? 'VOICE PLAYBACK' : (chatReady ? 'ROOM READY' : 'ROOM OFFLINE'))"
      :state="busy || voiceActive ? 'active' : (chatReady ? 'success' : 'warning')"
      :shape="activeChar === 'natsume' ? 'lantern' : 'heart'"
    />
    <header class="chat-head">
      <div>
        <div class="page-kicker">Character room</div>
        <h1 class="chat-title">角色房间</h1>
        <p class="chat-subtitle">让宁宁或夏目陪你聊一会儿。对谈、声线与温暖记忆，都安静珍藏于本机。</p>
      </div>
      <div class="chat-actions">
        <button class="btn btn-ghost" type="button" @click="clearCharacterConversation">新对话</button>
        <button class="btn btn-ghost" type="button" @click="clearAllMemory">清除全部记忆</button>
        <button
          class="btn btn-ghost"
          type="button"
          :aria-expanded="archiveOpen ? 'true' : 'false'"
          @click="archiveOpen = !archiveOpen"
        >记忆归档</button>
      </div>
    </header>

    <ChatArchivePanel
      v-if="archiveOpen"
      :storage="storage"
      :active-char="activeChar"
      @close="archiveOpen = false"
      @notice="(message, kind) => setError(message, kind || 'info', 4500)"
    />

    <section class="chat-layout" aria-label="角色聊天">
      <ChatCharacterStage
        ref="characterStageRef"
        :active-id="activeChar"
        :character="currentCharacter"
        :speaking="isSpeaking"
        :chat-status-text="chatStatusText"
        :status-kind="statusKind"
        :auto-load="storage.state.settings.live2dEnabled"
        :outfit="storage.live2dOutfit(activeChar)"
        @select="switchCharacter"
        @live2d-enabled="storage.setLive2dEnabled"
        @outfit-changed="storage.setLive2dOutfit(activeChar, $event)"
      />

      <section class="conversation-card">
        <div class="conversation-head">
          <strong>和{{ currentCharacter.name }}的房间</strong>
          <div class="model-controls">
            <div class="provider-switch" role="group" aria-label="对话模型来源">
              <button type="button" :class="{ active: chatProvider === 'local' }"
                :aria-pressed="chatProvider === 'local'"
                :disabled="busy" @click="setChatProvider('local')">本地模型</button>
              <button type="button" :class="{ active: chatProvider === 'api' }"
                :aria-pressed="chatProvider === 'api'"
                :disabled="busy" @click="setChatProvider('api')">自定义 API</button>
            </div>
            <select v-if="chatProvider === 'local'" class="model-select" v-model="currentModel"
              :disabled="busy || !ollamaOnline" aria-label="选择本地聊天模型">
              <option v-if="!ollamaOnline || !models.length" value="">{{ ollamaOnline ? '无可用模型' : '正在发现模型…' }}</option>
              <option v-for="m in models" :key="m.name" :value="m.name">
                {{ m.name }}{{ m.parameters ? ' · ' + m.parameters : '' }}
              </option>
            </select>
            <button v-else class="api-settings-toggle" type="button"
              :aria-expanded="apiSettingsOpen"
              @click="apiSettingsOpen = !apiSettingsOpen">
              {{ useHostConfig ? (hostApiModel || '站主 API') : (apiConfigured ? apiModel : '配置 API') }} <ArchiveIcon name="gear" />
            </button>
          </div>
        </div>

        <ChatApiSettings
          v-if="chatProvider === 'api' && apiSettingsOpen"
          :vendor="apiVendor"
          :base-url="useHostConfig ? (hostApiBaseUrl || apiBaseUrl) : apiBaseUrl"
          :model="useHostConfig ? (hostApiModel || apiModel) : apiModel"
          :api-key="useHostConfig ? '' : apiKey"
          :hint="apiConfigHint"
          :is-local-host="isLocalHost"
          :host-configured="hostApiConfigured"
          :host-model="hostApiModel"
          @update:vendor="apiVendor = $event"
          @update:base-url="apiBaseUrl = $event"
          @update:model="apiModel = $event"
          @update:api-key="apiKey = $event"
          @save="saveApiSettings"
          @save-host="saveToHost"
          @clear-host="clearHostConfigAndRefresh"
        />

        <div v-if="(!chatReady || voiceCapabilityState === 'offline' || preparingRoom)
          && !(chatProvider === 'api' && !chatReady && apiSettingsOpen)" class="room-setup">
          <div>
            <strong>{{ setupTitle }}</strong>
            <span>{{ setupDescription }}</span>
          </div>
          <button v-if="chatProvider === 'local' || (chatReady && voiceCapabilityState === 'offline')"
            class="btn btn-primary" type="button" :disabled="preparingRoom" @click="prepareRoom">
            {{ preparingRoom ? '准备中…' : '准备聊天环境' }}
          </button>
          <button v-else class="btn btn-primary" type="button" @click="apiSettingsOpen = true">
            配置 API
          </button>
        </div>

        <!-- 不在整个消息历史上挂 aria-live：流式输出时每个 token 都会让读屏
             把整段重播一遍。改为 role="log"（读屏只播报新增节点），
             并把"回复已完成"这件事交给下面的 .chat-announce 单独播报一次。 -->
        <div class="chat-list" ref="chatListRef" role="log" aria-label="对话记录">
          <!-- Empty state -->
          <div v-if="!currentMessages.length" class="chat-empty">
            <span class="chat-empty-kicker">{{ currentCharacter.roomCode }}</span>
            <div class="icon"><ArchiveIcon :name="currentCharacter.id === 'natsume' ? 'natsume' : 'nene'" /></div>
            <div>{{ currentCharacter.greeting }}</div>
            <div class="chat-starters" aria-label="对话开场建议">
              <button v-for="s in currentCharacter.starters" :key="s" type="button"
                @click="useStarter(s)">{{ s }}</button>
            </div>
          </div>

          <!-- Messages -->
          <template v-else>
            <div v-for="msg in currentMessages" :key="msg.mid"
              class="message"
              :class="[msg.role, msg.mid && msg.mid === streamingMid ? 'streaming' : '', msg.mid === playingMid ? 'speaking' : '']"
              :data-mid="msg.mid">
              <div class="message-avatar"><span v-if="msg.role === 'user'">你</span><ArchiveIcon v-else :name="currentCharacter.id === 'natsume' ? 'natsume' : 'nene'" /></div>
              <div class="message-body">
                <div class="message-bubble">{{ msg.content }}</div>
                <div class="message-meta">
                  <span v-if="msg.stopped" class="message-note">已停止</span>
                    <button v-if="msg.role === 'assistant' && msg.mid && voice.hasAudio(msg.mid)"
                      class="msg-voice-btn" type="button"
                      :class="{ playing: playingMid === msg.mid }"
                      :data-mid="msg.mid" title="重播这条语音"
                      @click="voice.playMessage(msg.mid)"><ArchiveIcon name="sound" /> 重播</button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="chat-composer">
          <div class="composer-row">
            <textarea class="chat-input" v-model="inputText" rows="2" maxlength="1200"
              placeholder="轻声对她说点什么吧……" aria-label="聊天输入"
              @keydown.enter.exact.prevent="handleSend"
              @input="onInputChange"></textarea>
            <button class="btn btn-ghost stop-btn" type="button"
              v-show="busy || voiceActive"
              :title="busy ? '停止生成回复' : '停止语音播放'"
              @click="stopEverything">停止</button>
            <button class="btn btn-primary send-btn" type="button"
              :disabled="busy || !chatReady"
              :title="chatReady ? '' : (chatProvider === 'api' ? '请先配置 API' : '请先启动 Ollama')"
              @click="handleSend">发送</button>
          </div>

          <div class="composer-tools">
            <div class="voice-console" aria-label="角色声线控制">
              <label v-if="chatProvider === 'api'" class="voice-toggle">
                <input type="checkbox" v-model="webSearchEnabled" />
                <span class="voice-switch" aria-hidden="true"><span></span></span>
                <span class="voice-toggle-copy"><strong>联网检索</strong><small>补充最新信息</small></span>
              </label>
              <span v-if="chatProvider === 'api'" class="voice-divider" aria-hidden="true"></span>
              <label class="voice-toggle">
                <input type="checkbox" v-model="autoVoice" @change="onAutoVoiceChange" />
                <span class="voice-switch" aria-hidden="true"><span></span></span>
                <span class="voice-toggle-copy"><strong>实时配音</strong><small>随回复逐句播放</small></span>
              </label>
              <span class="voice-divider" aria-hidden="true"></span>
              <span class="voice-capability" :data-state="voiceCapabilityState">
                <span class="voice-capability-dot"></span>{{ voiceCapabilityText }}
              </span>
              <span class="voice-status" aria-live="polite">{{ voiceStatusText }}</span>
              <!-- 语音启停已经迁进 SPA 的 /control；旧 3001 control-server 已删除。
                   硬编码旧端口会把用户带到一个拒绝连接的死链接。 -->
              <RouterLink v-show="showVoiceRecovery" class="voice-recovery" to="/control">启动语音 →</RouterLink>
              <label class="volume-slider" title="音量">
                <span class="volume-icon" aria-hidden="true"><ArchiveIcon name="sound" /></span>
                <input type="range" v-model.number="volume" min="0" max="100" aria-label="音量"
                  @input="onVolumeChange" />
              </label>
              <button class="replay-btn" type="button" title="重新播放上一条语音"
                :disabled="!hasReplayable"
                @click="replayLast">
                <span aria-hidden="true">↩</span> 重播上一条
              </button>
            </div>
            <span class="keyboard-hint">Enter 发送 · Shift+Enter 换行</span>
          </div>

          <div class="chat-error" role="status" aria-live="polite"
            :data-kind="chatErrorKind">{{ chatError }}</div>
          <!-- 流式回复只在收尾时播报一次，避免逐 token 刷读屏 -->
          <p class="sr-only" role="status" aria-live="polite">{{ replyAnnouncement }}</p>
        </div>
      </section>
    </section>
  </article>
</template>

<script setup lang="ts">
// 聊天页专属样式（18.6KB）随本路由块加载，不再进全局包
import '@/assets/css/chat.css'
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { CHARACTERS } from '@/config/characters'
import { useChatConversation } from '@/composables/useChatConversation'
import { useChatStorage } from '@/composables/useChatStorage'
import { useChatProvider } from '@/composables/useChatProvider'
import { useVoice } from '@/composables/useVoice'
import ChatApiSettings from '@/components/ChatApiSettings.vue'
import ChatCharacterStage from '@/components/ChatCharacterStage.vue'
import ChatArchivePanel from '@/components/ChatArchivePanel.vue'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'

const route = useRoute()

// ── DOM refs ──────────────────────────────────────────────────────────────
const chatListRef  = ref<HTMLElement>()
const characterStageRef = ref<{
  setSpeaking: (value: boolean) => void
  setMouth: (value: number) => void
  setAudioLevel: (level: number, peak?: number) => void
  setEmotion: (emotion: string) => void
  setUserMessage: () => void
}>()

// ── Core state ────────────────────────────────────────────────────────────
const activeChar    = ref('nene')
const busy          = ref(false)
const voiceActive   = ref(false)
const chatError     = ref('')
const chatErrorKind = ref('')
const voiceStatusText = ref('')
const voiceCapabilityState = ref('offline')
const voiceCapabilityText  = ref('检查语音…')
const showVoiceRecovery    = ref(false)
const playingMid    = ref('')
const isSpeaking    = ref(false)
const autoVoice     = ref(true)
const volume        = ref(80)
const preparingRoom = ref(false)
const roomSetupText = ref('一键切到聊天优先：释放受管绘图显存，并启动角色语音服务。')
const archiveOpen = ref(false)

let statusTimer = 0, errorTimer = 0, roomPollTimer = 0

// ── Storage ───────────────────────────────────────────────────────────────
const storage = useChatStorage((msg) => setError(msg, 'warning', 9000))
storage.load()

const {
  ollamaOnline, models, currentModel, chatProvider, apiBaseUrl, apiModel, apiKey,
  apiVendor, apiSettingsOpen, apiConfigHint, chatStatusText, statusKind,
  hostApiConfigured, hostApiModel, hostApiBaseUrl, useHostConfig,
  apiConfigured, chatReady, refreshChatStatus, refreshHostConfig,
  saveHostConfig, clearHostConfig,
  setChatProvider, saveApiSettings,
  setChatStatus, setBusy,
} = useChatProvider({ storage, isBusy: busy })
void refreshHostConfig()

const isLocalHost = computed(() =>
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname),
)

async function saveToHost() {
  const message = await saveHostConfig()
  setError(message, 'info', 4000)
}

async function clearHostConfigAndRefresh() {
  await clearHostConfig()
  setError('站主配置已清除', 'info', 3000)
}

// Restore persisted settings
autoVoice.value = storage.state.settings.autoVoice
volume.value   = storage.state.settings.volume != null ? storage.state.settings.volume : 80
activeChar.value = storage.state.active
const requestedCharacter = typeof route.query.character === 'string' ? route.query.character : ''
if (requestedCharacter === 'nene' || requestedCharacter === 'natsume') {
  activeChar.value = requestedCharacter
  storage.setActive(requestedCharacter)
}

// ── Composables ───────────────────────────────────────────────────────────
const voice = useVoice({
  enabled:      () => autoVoice.value,
  onStatus:     (t) => { voiceStatusText.value = t },
  onError:      (m) => setError(m, 'warning'),
  onSpeaking:   (v, mid) => {
    isSpeaking.value = v
    playingMid.value = v && mid ? mid : ''
    characterStageRef.value?.setSpeaking(v)
  },
  onMouth:      (v) => characterStageRef.value?.setMouth(v),
  onAudioLevel: (level, peak) => characterStageRef.value?.setAudioLevel(level, peak),
  onExpression: (emotion) => characterStageRef.value?.setEmotion(emotion),
  onAudioReady: (mid) => {
    // trigger re-render so replay button appears
    const msgs = storage.messages(activeChar.value)
    const m = msgs.find(x => x.mid === mid)
    if (m) { void m }
  },
  onActivity:   (active) => { voiceActive.value = active },
})

function onVolumeChange() {
  voice.setVolume(volume.value / 100)
  storage.setVolume(volume.value)
}

// ── Derived ───────────────────────────────────────────────────────────────
const currentCharacter = computed(() => CHARACTERS[activeChar.value] || CHARACTERS.nene)

const currentMessages = computed(() => storage.messages(activeChar.value))
const webSearchEnabled = computed({
  get: () => storage.state.settings.webSearchEnabled,
  set: value => storage.setWebSearchEnabled(value),
})
const setupTitle = computed(() => {
  if (preparingRoom.value) return '正在准备角色房间'
  if (chatProvider.value === 'api' && !apiConfigured.value) return '还没有配置自定义 API'
  if (chatProvider.value === 'local' && !ollamaOnline.value) return '本地聊天模型还没有就绪'
  return '角色语音还没有就绪'
})
const setupDescription = computed(() => {
  if (preparingRoom.value) return roomSetupText.value
  if (chatProvider.value === 'api' && !apiConfigured.value) {
    return '填写兼容 OpenAI 格式的地址、模型名和密钥后即可对话。'
  }
  if (chatProvider.value === 'api') return 'API 对话已经可用；准备本地语音后可以继续使用逐句配音。'
  return roomSetupText.value
})

const hasReplayable = computed(() =>
  currentMessages.value.some(m => m.role === 'assistant' && m.mid && voice.hasAudio(m.mid))
)
// ── Helpers ───────────────────────────────────────────────────────────────
function setError(message: string, kind = 'error', timeout = 7000) {
  clearTimeout(errorTimer)
  chatError.value     = message || ''
  chatErrorKind.value = message ? kind : ''
  if (message && timeout) {
    errorTimer = window.setTimeout(() => setError(''), timeout) as unknown as number
  }
}

function updateVoiceCapability() {
  const voiceId = currentCharacter.value.voice
  if (voice.readyFor(voiceId)) {
    voiceCapabilityText.value  = 'AI 声线就绪'
    voiceCapabilityState.value = 'ready'
    showVoiceRecovery.value    = false
  } else if (voice.availability.value.online) {
    voiceCapabilityText.value  = '声线未配置'
    voiceCapabilityState.value = 'warning'
    showVoiceRecovery.value    = true
  } else {
    voiceCapabilityText.value  = '语音未启动'
    voiceCapabilityState.value = 'offline'
    showVoiceRecovery.value    = true
  }
}

function nearBottom() {
  const el = chatListRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 100
}

function scrollBottom() {
  nextTick(() => {
    const el = chatListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

const {
  inputText,
  streamingMid,
  replyAnnouncement,
  abortCurrentRequest,
  sendMessage,
  useStarter,
  onInputChange,
  destroy: destroyConversation,
  stopEverything: stopConversation,
} = useChatConversation({
  storage,
  voice,
  activeChar,
  currentCharacter,
  busy,
  chatReady,
  chatProvider,
  currentModel,
  apiBaseUrl,
  apiModel,
  apiKey,
  webSearchEnabled,
  useHostConfig,
  setBusy,
  onError: setError,
  // 无配音时由流式回复文本驱动情绪；配音开启时每句 TTS 情绪更准，让位
  onStreamEmotion: (emotion) => {
    if (autoVoice.value) return
    characterStageRef.value?.setEmotion(emotion)
  },
  nearBottom,
  scrollBottom,
})

function handleSend() {
  characterStageRef.value?.setUserMessage()
  void sendMessage()
}

// ── 服务准备 ─────────────────────────────────────────────────────────────
async function refreshVoiceStatus() {
  await voice.refreshAvailability()
  updateVoiceCapability()
  const voiceId = currentCharacter.value.voice
  if (voice.readyFor(voiceId)) voice.prepare(voiceId, true)
}

async function pollRoomOperation(operationId: string) {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' })
    const data = await response.json()
    const operation = data.operation
    if (!operation || operation.id !== operationId) return
    roomSetupText.value = operation.message || '正在准备本地服务…'
    if (operation.status === 'running') return
    clearInterval(roomPollTimer)
    roomPollTimer = 0
    preparingRoom.value = false
    if (operation.status === 'failed') {
      setError(operation.error || '聊天环境准备失败，请到控制面板查看。')
      roomSetupText.value = '准备失败；可以到控制面板查看服务状态。'
      return
    }
    await Promise.all([refreshChatStatus(), refreshVoiceStatus()])
    roomSetupText.value = '聊天环境已就绪。'
  } catch {
    roomSetupText.value = '仍在后台准备；状态暂时无法读取。'
  }
}

async function prepareRoom() {
  if (preparingRoom.value) return
  preparingRoom.value = true
  setError('')
  roomSetupText.value = '正在提交聊天优先切换…'
  try {
    const response = await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'chat' }),
    })
    const data = await response.json()
    if (!response.ok || !data.ok) throw new Error(data.error || '无法切换聊天环境')
    const operationId = String(data.operation?.id || '')
    roomSetupText.value = data.message || '正在准备聊天环境…'
    if (!operationId) {
      preparingRoom.value = false
      await Promise.all([refreshChatStatus(), refreshVoiceStatus()])
      return
    }
    clearInterval(roomPollTimer)
    roomPollTimer = window.setInterval(() => { void pollRoomOperation(operationId) }, 1800) as unknown as number
    void pollRoomOperation(operationId)
  } catch (error) {
    preparingRoom.value = false
    roomSetupText.value = '准备失败；可以到控制面板手动处理。'
    setError((error as Error).message || '聊天环境准备失败')
  }
}

// ── 对话动作 ─────────────────────────────────────────────────────────────
function stopEverything() {
  if (stopConversation()) voiceStatusText.value = ''
}

function switchCharacter(char: string) {
  if (!CHARACTERS[char] || char === activeChar.value) return
  if (busy.value) abortCurrentRequest(true)
  storage.setDraft(activeChar.value, inputText.value)
  voice.stop({ preserveMessageAudio: true, silent: true })
  storage.setActive(char)
  activeChar.value = char
  document.documentElement.style.setProperty('--character-accent', CHARACTERS[char].accent)
  inputText.value = storage.draft(char)
  updateVoiceCapability()
  setError('')
}

function clearCharacterConversation() {
  const messages = storage.messages(activeChar.value)
  if (!messages.length) return
  if (!confirm('清空当前角色的这段本地对话？此操作无法撤销。')) return
  if (busy.value) abortCurrentRequest(true)
  const mids = messages.map(m => m.mid).filter(Boolean)
  voice.stop({ preserveMessageAudio: true, silent: true })
  voice.clearMessages(mids)
  storage.clear(activeChar.value)
  setError('已开始新的本地对话。', 'info', 2500)
}

function clearAllMemory() {
  const hasMemory = Object.values(storage.state.histories).some(items => items.length > 0)
  if (!hasMemory) return
  if (!confirm('清除宁宁和夏目的全部本地对话记忆？此操作无法撤销。')) return
  if (busy.value) abortCurrentRequest(true)
  voice.stop({ preserveMessageAudio: false, silent: true })
  storage.clear()
  setError('全部本地聊天记忆已清除。', 'info', 3000)
}

function onAutoVoiceChange() {
  storage.setAutoVoice(autoVoice.value)
  if (!autoVoice.value) { voice.stop({ preserveMessageAudio: true }) }
  else { voice.ensureAudioContext(); updateVoiceCapability() }
}

async function replayLast() {
  const latest = [...currentMessages.value].reverse()
    .find(m => m.role === 'assistant' && m.mid && voice.hasAudio(m.mid))
  if (!latest) { setError('本次打开页面后还没有可重播的语音。', 'info', 3500); return }
  await voice.playMessage(latest.mid)
}

// ── Watch model selection ─────────────────────────────────────────────────
watch(currentModel, (val) => { if (val) storage.setModel(val) })

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  // Apply character accent CSS variable
  document.documentElement.style.setProperty('--character-accent', currentCharacter.value.accent)
  inputText.value = storage.draft(activeChar.value)

  await refreshChatStatus()
  await refreshVoiceStatus()
  if (chatProvider.value === 'api') {
    if (useHostConfig.value) {
      setChatStatus(`站主配置 · ${hostApiModel.value || 'API'}`, 'online')
    } else {
      setChatStatus(apiConfigured.value ? `自定义 API · ${apiModel.value}` : '等待配置自定义 API', apiConfigured.value ? 'online' : '')
    }
  }
  voice.setVolume(volume.value / 100)

  statusTimer = window.setInterval(() => {
    if (!busy.value) refreshChatStatus()
    refreshVoiceStatus()
  }, 30000) as unknown as number
})

onUnmounted(() => {
  clearInterval(statusTimer); clearInterval(roomPollTimer); clearTimeout(errorTimer)
  destroyConversation()
  voice.destroy()
})
</script>
