<template>
  <article class="companion-page" :data-character="activeChar">
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
        <div v-if="desktopBridge" class="companion-window-actions" aria-label="桌面窗口控制">
          <button type="button" :aria-pressed="alwaysOnTop" @click="togglePin">
            {{ alwaysOnTop ? '取消置顶' : '置顶' }}
          </button>
          <button type="button" @click="desktopBridge.openAtelier">Atelier</button>
          <button type="button" @click="desktopBridge.hide">隐藏</button>
        </div>
        <RouterLink class="companion-room-link" to="/chat">完整房间</RouterLink>
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
        :auto-load="storage.state.settings.live2dEnabled"
        :outfit="storage.live2dOutfit(activeChar)"
        @select="switchCharacter"
        @live2d-enabled="storage.setLive2dEnabled"
        @outfit-changed="storage.setLive2dOutfit(activeChar, $event)"
      />

      <section class="companion-conversation" aria-label="简洁对话">
        <div ref="chatListRef" class="companion-bubbles" role="log" aria-label="最近对话">
          <div v-if="!companionMessages.length" class="companion-empty">
            <span>{{ currentCharacter.name }}</span>
            <p>{{ currentCharacter.greeting }}</p>
          </div>
          <template v-else>
            <div
              v-for="msg in companionMessages"
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
          <span v-if="voiceStatusText">{{ voiceStatusText }}</span>
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
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useCharacterRoomSession } from '@/composables/useCharacterRoomSession'
import ChatCharacterStage from '@/components/ChatCharacterStage.vue'

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
} = useCharacterRoomSession()

const desktopBridge = window.companionDesktop
const alwaysOnTop = ref(false)
let resumeSubscription: number | undefined

watch(replyAnnouncement, announcement => {
  if (!desktopBridge || !announcement || document.hasFocus()) return
  desktopBridge.notify(currentCharacter.value.name, announcement)
})

async function togglePin() {
  if (desktopBridge) alwaysOnTop.value = await desktopBridge.toggleAlwaysOnTop()
}

onMounted(async () => {
  document.documentElement.classList.add('companion-mode')
  if (desktopBridge) {
    document.documentElement.classList.add('companion-desktop')
    alwaysOnTop.value = (await desktopBridge.getState()).alwaysOnTop
    resumeSubscription = desktopBridge.onResume(() => { window.location.reload() })
  }
})
onUnmounted(() => {
  if (desktopBridge && resumeSubscription != null) desktopBridge.offResume(resumeSubscription)
  document.documentElement.classList.remove('companion-mode', 'companion-desktop')
})
</script>
