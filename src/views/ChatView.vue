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
        <div class="character-tabs" role="tablist" aria-label="选择角色">
          <button class="character-tab active" type="button" data-character="nene" role="tab" aria-selected="true">🔮 宁宁</button>
          <button class="character-tab" type="button" data-character="natsume" role="tab" aria-selected="false">☕ 夏目</button>
        </div>
        <div class="portrait-stage" id="portraitStage" data-character="nene">
          <div class="room-signal">
            <span id="roomCode">ROOM 01 · MOONLIT LIBRARY</span>
            <small id="roomMood">月光、书页，还有只说给彼此听的秘密。</small>
          </div>
          <img class="portrait-main" id="portraitMain" src="/assets/characters/nene-official.webp" alt="绫地宁宁" />
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
          <select class="model-select" id="modelSelect" aria-label="选择聊天模型">
            <option value="">正在发现模型…</option>
          </select>
        </div>
        <div class="chat-list" id="chatList" aria-live="polite">
          <div class="chat-empty">
            <div class="icon">✦</div>
            <div>输入一句话，开始和角色聊天。<br />第一次回复前，Ollama 可能需要一点加载时间。</div>
          </div>
        </div>
        <div class="chat-composer">
          <div class="composer-row">
            <textarea class="chat-input" id="chatInput" rows="2" maxlength="1200" placeholder="对她说点什么……" aria-label="聊天输入"></textarea>
            <button class="btn btn-ghost stop-btn" id="stopBtn" type="button" hidden>停止</button>
            <button class="btn btn-primary send-btn" id="sendBtn" type="button">发送</button>
          </div>
          <div class="composer-tools">
            <div class="voice-console" aria-label="角色声线控制">
              <label class="voice-toggle">
                <input type="checkbox" id="autoVoice" checked />
                <span class="voice-switch" aria-hidden="true"><span></span></span>
                <span class="voice-toggle-copy"><strong>实时配音</strong><small>随回复逐句播放</small></span>
              </label>
              <span class="voice-divider" aria-hidden="true"></span>
              <span class="voice-capability" id="voiceCapability" data-state="offline">
                <span class="voice-capability-dot"></span>检查语音…
              </span>
              <span class="voice-status" id="voiceStatus" aria-live="polite"></span>
              <a class="voice-recovery" id="voiceRecovery" href="http://127.0.0.1:3001/" target="_blank" rel="noreferrer" hidden>启动语音 →</a>
              <label class="volume-slider" title="音量">
                <span class="volume-icon">🔊</span>
                <input type="range" id="volumeRange" min="0" max="100" value="80" />
              </label>
              <button class="replay-btn" id="replayBtn" type="button" title="重新播放上一条语音" disabled>
                <span aria-hidden="true">↩</span> 重播上一条
              </button>
            </div>
            <span class="keyboard-hint">Enter 发送 · Shift+Enter 换行</span>
          </div>
          <div class="chat-error" id="chatError" role="status" aria-live="polite"></div>
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

// Live2D 相关脚本（非module）必须在 app.mjs 之前加载
const PRELOAD_SCRIPTS = [
  '/tools/chat/live2d-bootstrap.js',
  '/assets/vendor/wl-live2d/live2dcubism2core.min.js',
  '/assets/vendor/wl-live2d/cubism4.js',
]
// app.mjs 为 ES module，内部通过相对路径 import 其他 mjs
const APP_MODULE = '/tools/chat/app.mjs?v=7'

let injected: HTMLScriptElement[] = []

function loadScript(src: string, isModule = false): Promise<void> {
  return new Promise((resolve) => {
    // 跳过已加载的非module脚本
    if (!isModule && document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const el = document.createElement('script')
    el.src = src
    if (isModule) el.type = 'module'
    else el.async = false
    el.onload = () => resolve()
    el.onerror = () => { console.warn('chat script failed:', src); resolve() }
    document.body.appendChild(el)
    injected.push(el)
  })
}

onMounted(async () => {
  // 顺序加载：先 Live2D 依赖，再 app module
  for (const src of PRELOAD_SCRIPTS) {
    await loadScript(src, false)
  }
  await loadScript(APP_MODULE, true)
})

onUnmounted(() => {
  injected.forEach(el => el.remove())
  injected = []
  // 通知 app 清理定时器/事件
  try { (window as any).__chatDestroy?.() } catch {}
})
</script>
