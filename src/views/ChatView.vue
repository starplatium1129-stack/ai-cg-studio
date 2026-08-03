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
        <div class="page-kicker">人物記録 / Character room</div>
        <h1 class="chat-title">角色房间 <span>静かな対話室</span></h1>
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

        <div class="chat-list" ref="chatListRef" role="log" aria-label="对话记录">
          <div v-if="!currentMessages.length" class="chat-empty">
            <span class="chat-empty-kicker">{{ currentCharacter.roomCode }}</span>
            <div class="icon"><ArchiveIcon :name="currentCharacter.id === 'natsume' ? 'natsume' : 'nene'" /></div>
            <div>{{ currentCharacter.greeting }}</div>
            <div class="chat-starters" aria-label="对话开场建议">
              <button v-for="s in currentCharacter.starters" :key="s" type="button"
                @click="useStarter(s)">{{ s }}</button>
            </div>
          </div>

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
          <p class="sr-only" role="status" aria-live="polite">{{ replyAnnouncement }}</p>
        </div>
      </section>
    </section>
  </article>
</template>

<script setup lang="ts">
import '@/assets/css/chat.css'
import { useCharacterRoomSession } from '@/composables/useCharacterRoomSession'
import ChatApiSettings from '@/components/ChatApiSettings.vue'
import ChatCharacterStage from '@/components/ChatCharacterStage.vue'
import ChatArchivePanel from '@/components/ChatArchivePanel.vue'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'

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
  voiceCapabilityText,
  showVoiceRecovery,
  playingMid,
  isSpeaking,
  autoVoice,
  volume,
  preparingRoom,
  archiveOpen,
  storage,
  ollamaOnline,
  models,
  currentModel,
  chatProvider,
  apiBaseUrl,
  apiModel,
  apiKey,
  apiVendor,
  apiSettingsOpen,
  apiConfigHint,
  chatStatusText,
  statusKind,
  hostApiConfigured,
  hostApiModel,
  hostApiBaseUrl,
  useHostConfig,
  apiConfigured,
  chatReady,
  isLocalHost,
  currentCharacter,
  currentMessages,
  webSearchEnabled,
  setupTitle,
  setupDescription,
  hasReplayable,
  inputText,
  streamingMid,
  replyAnnouncement,
  voice,
  setError,
  saveToHost,
  clearHostConfigAndRefresh,
  setChatProvider,
  saveApiSettings,
  onVolumeChange,
  handleSend,
  useStarter,
  onInputChange,
  prepareRoom,
  stopEverything,
  switchCharacter,
  clearCharacterConversation,
  clearAllMemory,
  onAutoVoiceChange,
  replayLast,
} = useCharacterRoomSession()
</script>
