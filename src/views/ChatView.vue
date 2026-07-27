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
        <button class="btn btn-ghost" type="button" id="newChatBtn">新对话</button>
        <button class="btn btn-ghost" type="button" id="clearChatBtn">清除全部记忆</button>
      </div>
    </header>
    <section class="chat-layout" aria-label="角色聊天">
      <aside class="character-card">
        <div class="character-tabs" role="tablist">
          <button class="character-tab active" type="button" data-character="nene" role="tab" aria-selected="true">🔮 宁宁</button>
          <button class="character-tab" type="button" data-character="natsume" role="tab" aria-selected="false">🍂 夏目</button>
        </div>
        <div class="portrait-stage" id="portraitStage" data-character="nene">
          <div class="room-signal"><span id="roomCode">ROOM 01 · MOONLIT LIBRARY</span><small id="roomMood">月光、书页，还有只说给彼此听的秘密。</small></div>
          <img class="portrait-main" id="portraitMain" src="/assets/characters/nene-official.webp" alt="绫地宁宁">
          <div class="live2d-host" id="live2dHost" aria-hidden="true"></div>
          <div class="voice-halo" aria-hidden="true"></div>
          <button class="avatar-status" id="avatarStatus" type="button" data-state="checking" disabled>检测 Live2D…</button>
          <div class="portrait-caption">
            <strong id="portraitName">绫地宁宁</strong>
            <span id="portraitCaption">温柔、认真，却很容易因为你的一句话慌乱起来。</span>
          </div>
        </div>
        <div class="character-info">
          <p id="characterDescription">今天想聊什么都可以。只是、如果突然说些让人害羞的话，请给我一点准备的时间……</p>
          <div class="character-status">
            <span class="status-dot" id="statusDot"></span>
            <span id="chatStatus">正在检查本地聊天模型…</span>
          </div>
        </div>
      </aside>
      <section class="conversation-card">
        <div class="conversation-head">
          <strong id="conversationTitle">和绫地宁宁的房间</strong>
          <select class="model-select" id="modelSelect" aria-label="选择聊天模型"><option value="">正在发现模型…</option></select>
        </div>
        <div class="chat-list" id="chatList" aria-live="polite">
          <div class="chat-empty"><div class="icon">✦</div><div>输入一句话，开始和角色聊天。<br>第一次回复前，Ollama 可能需要一点加载时间。</div></div>
        </div>
        <div class="chat-composer">
          <div class="composer-row">
            <textarea class="chat-input" id="chatInput" rows="2" maxlength="1200" placeholder="对她说点什么……" aria-label="聊天输入"></textarea>
            <button class="btn btn-ghost stop-btn" id="stopBtn" type="button" hidden>停止</button>
            <button class="btn btn-primary send-btn" id="sendBtn" type="button">发送</button>
          </div>
          <div class="composer-tools">
            <button class="btn btn-ghost tool-btn" id="voicePlayBtn" type="button" hidden>▶ 播放语音</button>
            <button class="btn btn-ghost tool-btn" id="voiceStopBtn" type="button" hidden>■ 停止语音</button>
            <span class="voice-state" id="voiceState"></span>
          </div>
        </div>
      </section>
    </section>
    <div id="chatToast" class="toast-container"></div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
const CHAT_SCRIPTS = [
  '/tools/chat/config.mjs',
  '/tools/chat/utils.mjs',
  '/tools/chat/storage.mjs',
  '/tools/chat/voice.mjs',
  '/tools/chat/live2d.mjs',
  '/tools/chat/app.mjs',
]
let injected: HTMLScriptElement[] = []
function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    const el = document.createElement('script')
    el.type = 'module'; el.src = src
    el.onload = () => res(); el.onerror = () => rej()
    document.body.appendChild(el); injected.push(el)
  })
}
onMounted(async () => {
  for (const src of CHAT_SCRIPTS) { try { await loadScript(src) } catch {} }
})
onUnmounted(() => { injected.forEach(el => el.remove()); injected = [] })
</script>
