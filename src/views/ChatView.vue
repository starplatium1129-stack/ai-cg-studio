<template>
  <main class="chat-page">
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
        <div class="character-tabs" role="tablist" aria-label="选择角色">
          <button
            v-for="id in ['nene','natsume']" :key="id"
            class="character-tab" type="button"
            :class="{ active: activeChar === id }"
            :data-character="id" role="tab"
            :aria-selected="activeChar === id ? 'true' : 'false'"
            @click="switchCharacter(id)"
          >{{ id === 'nene' ? '🔮 宁宁' : '☕ 夏目' }}</button>
        </div>

        <div class="portrait-stage" ref="stageRef" :data-character="activeChar"
             :class="{ speaking: isSpeaking }">
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

        <div class="chat-list" ref="chatListRef" aria-live="polite">
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
              <a v-show="showVoiceRecovery" class="voice-recovery"
                href="http://127.0.0.1:3001/" target="_blank" rel="noreferrer">启动语音 →</a>
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
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { CHARACTERS, createMessageId } from '@/config/characters'
import { useChatStorage } from '@/composables/useChatStorage'
import { useLive2D } from '@/composables/useLive2D'
import { useVoice } from '@/composables/useVoice'
import { parseNdjsonResponse, isAbortError } from '@/utils/stream'

const router = useRouter()

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
const playingMid    = ref('')
const isSpeaking    = ref(false)
const autoVoice     = ref(true)
const volume        = ref(80)
const avatarText    = ref('检测 Live2D…')
const avatarState   = ref('checking')
const avatarDetail  = ref('')
const avatarRetryable = ref(false)

let statusTimer = 0, errorTimer = 0, draftTimer = 0
let activeRequest: AbortController | null = null

// ── Storage ───────────────────────────────────────────────────────────────
const storage = useChatStorage((msg) => setError(msg, 'warning', 9000))
storage.load()

// Restore persisted settings
autoVoice.value = storage.state.settings.autoVoice
volume.value   = storage.state.settings.volume != null ? storage.state.settings.volume : 80
currentModel.value = storage.state.settings.model || ''
activeChar.value = storage.state.active

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
      voice.append(event.content || '')
      if (nearBottom()) scrollBottom()
    })

    assistant.content = assistant.content.trim() || '……'
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
  clearInterval(statusTimer); clearTimeout(errorTimer); clearTimeout(draftTimer)
  if (activeRequest) { activeRequest.abort(); activeRequest = null }
  voice.destroy()
  live2d.destroy()
})
</script>
