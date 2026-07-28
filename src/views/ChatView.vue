<template>
  <article class="chat-page">
    <a @click.prevent="$router.push('/')" href="/" class="nav-back">← 回首页</a>
    <header class="chat-head">
      <div>
        <div class="page-kicker">Character room</div>
        <h1 class="chat-title">角色房间</h1>
        <p class="chat-subtitle">让宁宁或夏目陪你聊一会儿。回复、声音与记忆都留在这台电脑。</p>
      </div>
      <div class="chat-actions">
        <button class="btn btn-ghost" type="button" @click="clearCharacterConversation">新对话</button>
        <button class="btn btn-ghost" type="button" @click="clearAllMemory">清除全部记忆</button>
      </div>
    </header>

    <section class="chat-layout" aria-label="角色聊天">
      <aside class="character-card">
        <!-- tablist 模式补全：aria-controls 指向立绘面板 + roving tabindex + 方向键 -->
        <div class="character-tabs" role="tablist" aria-label="选择角色" @keydown="tabs.onKeydown">
          <button
            v-for="id in CHARACTER_IDS" :key="id"
            class="character-tab" type="button"
            :class="{ active: activeChar === id }"
            :data-character="id" role="tab"
            :id="tabs.tabId(id)"
            :aria-controls="tabs.panelId(id)"
            :aria-selected="activeChar === id ? 'true' : 'false'"
            :tabindex="tabs.tabIndex(id)"
            @click="switchCharacter(id)"
          >{{ id === 'nene' ? '🔮 宁宁' : '☕ 夏目' }}</button>
        </div>

        <div class="portrait-stage" ref="stageRef" :data-character="activeChar"
              role="tabpanel"
              :id="tabs.panelId(activeChar)"
              :aria-labelledby="tabs.tabId(activeChar)"
              :class="{
                speaking: isSpeaking,
                'live2d-ready': live2d.ready && live2d.loadedCharacter.value === activeChar,
              }">
          <div class="room-signal">
            <span>{{ currentCharacter.roomCode }}</span>
            <small>{{ currentCharacter.roomMood }}</small>
          </div>
          <img class="portrait-main" :src="currentCharacter.image" :alt="currentCharacter.name" />
          <div class="live2d-host" ref="live2dHostRef" aria-hidden="true"></div>
          <div class="voice-halo" aria-hidden="true"></div>
          <button class="avatar-status" type="button"
            :data-state="avatarState"
            :disabled="!avatarRetryable"
            :title="avatarDetail"
            @click="avatarRetryable && live2d.retry()">{{ avatarText }}</button>
          <div v-if="live2d.interactionHint.value" class="live2d-interaction-hint">
            {{ live2d.interactionHint.value }}
          </div>
          <div class="portrait-caption">
            <strong>{{ currentCharacter.name }}</strong>
            <span>{{ currentCharacter.caption }}</span>
          </div>
        </div>

        <div class="character-info">
          <p>{{ currentCharacter.description }}</p>
          <div class="character-status">
            <span class="status-dot" :class="statusKind"></span>
            <span>{{ chatStatusText }}</span>
          </div>
        </div>
      </aside>

      <section class="conversation-card">
        <div class="conversation-head">
          <strong>和{{ currentCharacter.name }}的房间</strong>
          <select class="model-select" v-model="currentModel" :disabled="busy || !ollamaOnline" aria-label="选择聊天模型">
            <option v-if="!ollamaOnline || !models.length" value="">{{ ollamaOnline ? '无可用模型' : '正在发现模型…' }}</option>
            <option v-for="m in models" :key="m.name" :value="m.name">
              {{ m.name }}{{ m.parameters ? ' · ' + m.parameters : '' }}
            </option>
          </select>
        </div>

        <div v-if="!ollamaOnline || voiceCapabilityState === 'offline' || preparingRoom" class="room-setup">
          <div>
            <strong>{{ preparingRoom ? '正在准备角色房间' : '本地服务还没有就绪' }}</strong>
            <span>{{ roomSetupText }}</span>
          </div>
          <button class="btn btn-primary" type="button" :disabled="preparingRoom" @click="prepareRoom">
            {{ preparingRoom ? '准备中…' : '准备聊天环境' }}
          </button>
        </div>

        <!-- 不在整个消息历史上挂 aria-live：流式输出时每个 token 都会让读屏
             把整段重播一遍。改为 role="log"（读屏只播报新增节点），
             并把"回复已完成"这件事交给下面的 .chat-announce 单独播报一次。 -->
        <div class="chat-list" ref="chatListRef" role="log" aria-label="对话记录">
          <!-- Empty state -->
          <div v-if="!currentMessages.length" class="chat-empty">
            <span class="chat-empty-kicker">{{ currentCharacter.roomCode }}</span>
            <div class="icon">{{ currentCharacter.icon }}</div>
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
              :class="[msg.role, msg.mid && msg.mid === streamingMid ? 'streaming' : '']"
              :data-mid="msg.mid">
              <div class="message-avatar">{{ msg.role === 'user' ? '你' : currentCharacter.icon }}</div>
              <div class="message-body">
                <div class="message-bubble">{{ msg.content }}</div>
                <div class="message-meta">
                  <span v-if="msg.stopped" class="message-note">已停止</span>
                  <button v-if="msg.role === 'assistant' && msg.mid && voice.hasAudio(msg.mid)"
                    class="msg-voice-btn" type="button"
                    :class="{ playing: playingMid === msg.mid }"
                    :data-mid="msg.mid" title="重播这条语音"
                    @click="voice.playMessage(msg.mid)">🔊 重播</button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="chat-composer">
          <div class="composer-row">
            <textarea class="chat-input" v-model="inputText" rows="2" maxlength="1200"
              placeholder="对她说点什么……" aria-label="聊天输入"
              @keydown.enter.exact.prevent="sendMessage"
              @input="onInputChange"></textarea>
            <button class="btn btn-ghost stop-btn" type="button"
              v-show="busy || voiceActive"
              :title="busy ? '停止生成回复' : '停止语音播放'"
              @click="stopEverything">停止</button>
            <button class="btn btn-primary send-btn" type="button"
              :disabled="busy || !ollamaOnline"
              :title="ollamaOnline ? '' : '请先启动 Ollama'"
              @click="sendMessage">发送</button>
          </div>

          <div class="composer-tools">
            <div class="voice-console" aria-label="角色声线控制">
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
                <span class="volume-icon">🔊</span>
                <input type="range" v-model.number="volume" min="0" max="100"
                  @input="voice.setVolume(volume / 100)" />
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
import { CHARACTERS, createMessageId } from '@/config/characters'
import { useChatStorage } from '@/composables/useChatStorage'
import { useLive2D } from '@/composables/useLive2D'
import { useVoice } from '@/composables/useVoice'
import { inferEmotion, parseNdjsonResponse, SentenceBuffer, isAbortError } from '@/utils/stream'
import { useRovingTabs } from '@/composables/useRovingTabs'

const route = useRoute()

// ── DOM refs ──────────────────────────────────────────────────────────────
const stageRef     = ref<HTMLElement>()
const live2dHostRef = ref<HTMLElement>()
const chatListRef  = ref<HTMLElement>()

// ── Core state ────────────────────────────────────────────────────────────
const activeChar    = ref('nene')
const busy          = ref(false)
const voiceActive   = ref(false)
const ollamaOnline  = ref(false)
const models        = ref<Array<{ name: string; parameters?: string }>>([])
const currentModel  = ref('')
const inputText     = ref('')
const chatError     = ref('')
const chatErrorKind = ref('')
const chatStatusText = ref('正在检查本地聊天模型…')
const statusKind    = ref('')
const voiceStatusText = ref('')
const voiceCapabilityState = ref('offline')
const voiceCapabilityText  = ref('检查语音…')
const showVoiceRecovery    = ref(false)
const streamingMid  = ref('')
const replyAnnouncement = ref('')
const playingMid    = ref('')
const isSpeaking    = ref(false)
const autoVoice     = ref(true)
const volume        = ref(80)
const avatarText    = ref('检测 Live2D…')
const avatarState   = ref('checking')
const avatarDetail  = ref('')
const avatarRetryable = ref(false)
const preparingRoom = ref(false)
const roomSetupText = ref('一键切到聊天优先：释放受管绘图显存，并启动角色语音服务。')

let statusTimer = 0, errorTimer = 0, draftTimer = 0, roomPollTimer = 0
let activeRequest: AbortController | null = null

// ── Storage ───────────────────────────────────────────────────────────────
const storage = useChatStorage((msg) => setError(msg, 'warning', 9000))
storage.load()

// Restore persisted settings
autoVoice.value = storage.state.settings.autoVoice
volume.value   = storage.state.settings.volume != null ? storage.state.settings.volume : 80
currentModel.value = storage.state.settings.model || ''
activeChar.value = storage.state.active
const requestedCharacter = typeof route.query.character === 'string' ? route.query.character : ''
if (requestedCharacter === 'nene' || requestedCharacter === 'natsume') {
  activeChar.value = requestedCharacter
  storage.setActive(requestedCharacter)
}

// ── Composables ───────────────────────────────────────────────────────────
const live2d = useLive2D((status) => {
  avatarText.value     = status.text
  avatarState.value    = status.state
  avatarDetail.value   = status.detail
  avatarRetryable.value = status.retryable
})

const voice = useVoice({
  enabled:      () => autoVoice.value,
  onStatus:     (t) => { voiceStatusText.value = t },
  onError:      (m) => setError(m, 'warning'),
  onSpeaking:   (v, mid) => {
    isSpeaking.value = v
    playingMid.value = v && mid ? mid : ''
    live2d.setSpeaking(v)
  },
  onExpression: (e) => live2d.setExpression(e),
  onMouth:      (v) => live2d.setMouth(v),
  onAudioReady: (mid) => {
    // trigger re-render so replay button appears
    const msgs = storage.messages(activeChar.value)
    const m = msgs.find(x => x.mid === mid)
    if (m) { void m }
  },
  onActivity:   (active) => { voiceActive.value = active },
})

// ── Derived ───────────────────────────────────────────────────────────────
const currentCharacter = computed(() => CHARACTERS[activeChar.value] || CHARACTERS.nene)

const CHARACTER_IDS = ['nene', 'natsume'] as const
const tabs = useRovingTabs(
  () => CHARACTER_IDS as unknown as readonly string[],
  activeChar,
  switchCharacter,
  { prefix: 'chatchar' },
)

const currentMessages = computed(() => storage.messages(activeChar.value))

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

function setChatStatus(text: string, kind = '') {
  chatStatusText.value = text
  statusKind.value     = kind
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

// ── API calls ─────────────────────────────────────────────────────────────
async function refreshChatStatus() {
  try {
    const r = await fetch('/api/chat-status', { cache: 'no-store' })
    if (!r.ok) throw new Error('聊天状态接口不可用')
    const data = await r.json()
    ollamaOnline.value = Boolean(data.online && data.models?.length)
    const ms = Array.isArray(data.models) ? data.models : []
    models.value = ms
    if (!busy.value) {
      setChatStatus(ollamaOnline.value ? '本地聊天模型已连接' : 'Ollama 未启动', ollamaOnline.value ? 'online' : '')
    }
    // Restore model selection
    const saved = storage.state.settings.model
    if (ms.some((m: any) => m.name === saved)) {
      currentModel.value = saved
    } else if (data.model || ms[0]) {
      currentModel.value = data.model || ms[0]?.name || ''
      storage.setModel(currentModel.value)
    }
    if (!ms.length) { currentModel.value = ''; setChatStatus('Ollama 未启动') }
  } catch {
    ollamaOnline.value = false
    models.value = []
    if (!busy.value) setChatStatus('Ollama 未启动')
  }
}

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

// ── Actions ───────────────────────────────────────────────────────────────
function abortCurrentRequest(silent = false) {
  if (!activeRequest) return
  activeRequest.abort(); activeRequest = null
  voice.stop({ preserveMessageAudio: true, silent: true })
  if (!silent) setError('已停止本次回复。', 'info', 2500)
}

function stopEverything() {
  const wasBusy     = Boolean(activeRequest)
  const wasSpeaking = voice.isActive()
  if (!wasBusy && !wasSpeaking) return
  abortCurrentRequest(true)
  voice.stop({ preserveMessageAudio: true, silent: true })
  voiceStatusText.value = ''
  setError(wasBusy ? '已停止本次回复。' : '已停止语音播放。', 'info', 2500)
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || busy.value || !ollamaOnline.value) return
  setError('')
  voice.ensureAudioContext()

  const char = activeChar.value
  const msgs = storage.messages(char)
  replyAnnouncement.value = ''
  msgs.push({ role: 'user', content: text, mid: '', stopped: false })
  storage.trim(char)
  const assistant = { role: 'assistant' as const, content: '', mid: createMessageId(), stopped: false }
  msgs.push(assistant)
  storage.save()
  inputText.value = ''
  storage.setDraft(char, '')
  streamingMid.value = assistant.mid
  scrollBottom()
  setBusy(true)

  const controller = new AbortController()
  activeRequest = controller
  const emotionBuffer = new SentenceBuffer({ immediateFirst: true })
  const applyReplyEmotion = (fragment: string, flush = false) => {
    emotionBuffer.push(fragment, flush).forEach(sentence => {
      live2d.setExpression(inferEmotion(sentence, char))
    })
  }
  live2d.setExpression('neutral')
  voice.startTurn({ mid: assistant.mid, voice: currentCharacter.value.voice, character: char })

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        character: char,
        model: currentModel.value,
        messages: msgs.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    })

    await parseNdjsonResponse(response, async (event: any) => {
      if (event.type === 'meta' && event.model) {
        currentModel.value = String(event.model); storage.setModel(currentModel.value)
      }
      if (event.type !== 'token') return
      assistant.content += event.content || ''
      applyReplyEmotion(event.content || '')
      voice.append(event.content || '')
      if (nearBottom()) scrollBottom()
    })

    assistant.content = assistant.content.trim() || '……'
    applyReplyEmotion('', true)
    // 收尾时播报一次完整回复，取代逐 token 刷 live region
    replyAnnouncement.value = `${currentCharacter.value.name}说：${assistant.content}`
    voice.finishTurn()
  } catch (error) {
    if (isAbortError(error)) {
      assistant.content = assistant.content.trim()
      assistant.stopped = Boolean(assistant.content)
      if (!assistant.content) msgs.splice(msgs.indexOf(assistant), 1)
    } else {
      msgs.splice(msgs.indexOf(assistant), 1)
      voice.stop({ preserveMessageAudio: true, silent: true })
      const e = error as any
      setError((e.detail ? e.message + '：' + e.detail : e.message) || '聊天暂不可用，请检查 Ollama。')
    }
  } finally {
    storage.trim(char); storage.save()
    streamingMid.value = ''
    if (activeRequest === controller) activeRequest = null
    setBusy(false)
    scrollBottom()
  }
}

function setBusy(value: boolean) {
  busy.value = value
  if (value) setChatStatus('正在生成回复…', 'busy')
  else setChatStatus(ollamaOnline.value ? '本地聊天模型已连接' : '聊天模型未连接', ollamaOnline.value ? 'online' : '')
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
  live2d.setCharacter(char)
  updateVoiceCapability()
  setError('')
}

function clearCharacterConversation() {
  if (busy.value) abortCurrentRequest(true)
  const mids = storage.messages(activeChar.value).map(m => m.mid).filter(Boolean)
  voice.stop({ preserveMessageAudio: true, silent: true })
  voice.clearMessages(mids)
  storage.clear(activeChar.value)
  setError('已开始新的本地对话。', 'info', 2500)
}

function clearAllMemory() {
  const hasMemory = Object.values(storage.state.histories).some((items) => (items as any[]).length)
  if (!hasMemory) return
  if (!confirm('清除宁宁和夏目的全部本地对话记忆？此操作无法撤销。')) return
  if (busy.value) abortCurrentRequest(true)
  voice.stop({ preserveMessageAudio: false, silent: true })
  storage.clear()
  setError('全部本地聊天记忆已清除。', 'info', 3000)
}

function useStarter(text: string) {
  inputText.value = text
  storage.setDraft(activeChar.value, text)
}

function onInputChange() {
  clearTimeout(draftTimer)
  const char = activeChar.value, val = inputText.value
  draftTimer = window.setTimeout(() => storage.setDraft(char, val), 240) as unknown as number
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

  // Init Live2D with template refs
  await nextTick()
  if (live2dHostRef.value && stageRef.value) {
    live2d.init(activeChar.value, live2dHostRef.value, stageRef.value)
  }

  await refreshChatStatus()
  await refreshVoiceStatus()
  voice.setVolume(volume.value / 100)

  statusTimer = window.setInterval(() => {
    if (!busy.value) refreshChatStatus()
    refreshVoiceStatus()
  }, 30000) as unknown as number
})

onUnmounted(() => {
  clearInterval(statusTimer); clearInterval(roomPollTimer); clearTimeout(errorTimer); clearTimeout(draftTimer)
  if (activeRequest) { activeRequest.abort(); activeRequest = null }
  voice.destroy()
  live2d.destroy()
})
</script>
