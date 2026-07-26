import { CHARACTERS, createMessageId } from './config.mjs';
import { Live2DController } from './live2d.mjs';
import { ChatStorage } from './storage.mjs';
import { VoiceController } from './voice.mjs?v=4';
import { escapeHtml, isAbortError, parseNdjsonResponse } from './utils.mjs?v=2';

const byId = (id) => document.getElementById(id);
const elements = {
  portraitStage: byId('portraitStage'),
  portraitMain: byId('portraitMain'),
  portraitName: byId('portraitName'),
  portraitCaption: byId('portraitCaption'),
  roomCode: byId('roomCode'),
  roomMood: byId('roomMood'),
  characterDescription: byId('characterDescription'),
  conversationTitle: byId('conversationTitle'),
  chatList: byId('chatList'),
  chatInput: byId('chatInput'),
  chatError: byId('chatError'),
  chatStatus: byId('chatStatus'),
  statusDot: byId('statusDot'),
  modelSelect: byId('modelSelect'),
  sendButton: byId('sendBtn'),
  stopButton: byId('stopBtn'),
  autoVoice: byId('autoVoice'),
  volumeRange: byId('volumeRange'),
  voiceStatus: byId('voiceStatus'),
  voiceCapability: byId('voiceCapability'),
  voiceRecovery: byId('voiceRecovery'),
  replayButton: byId('replayBtn'),
  avatarStatus: byId('avatarStatus'),
  live2dHost: byId('live2dHost')
};

let errorTimer = 0;
let statusTimer = 0;
let activeRequest = null;
let busy = false;
let ollamaOnline = false;
let voiceActive = false;
let currentModel = '';
let streamingMessageId = '';
let draftTimer = 0;

function setError(message, kind = 'error', timeout = 7000) {
  clearTimeout(errorTimer);
  elements.chatError.textContent = message || '';
  elements.chatError.dataset.kind = message ? kind : '';
  if (message && timeout) {
    errorTimer = window.setTimeout(() => setError(''), timeout);
  }
}

const storage = new ChatStorage((message) => setError(message, 'warning', 9000));
const state = storage.load();

function currentMessages() {
  return storage.messages(state.active);
}

function setChatStatus(text, kind = '') {
  elements.chatStatus.textContent = text;
  elements.statusDot.className = 'status-dot' + (kind ? ' ' + kind : '');
}

function setVoiceStatus(text) {
  elements.voiceStatus.textContent = text || '';
}

function setSpeaking(value, mid) {
  elements.portraitStage.classList.toggle('speaking', Boolean(value));
  document.querySelectorAll('.msg-voice-btn.playing').forEach((button) => {
    if (!value || !mid || button.dataset.mid !== mid) button.classList.remove('playing');
  });
  if (value && mid) {
    const button = [...document.querySelectorAll('.msg-voice-btn')]
      .find((item) => item.dataset.mid === mid);
    if (button) button.classList.add('playing');
  }
}

const live2d = new Live2DController({
  host: elements.live2dHost,
  stage: elements.portraitStage,
  onStatus(status) {
    elements.avatarStatus.textContent = status.text;
    elements.avatarStatus.dataset.state = status.state;
    elements.avatarStatus.dataset.retryable = status.retryable ? 'true' : 'false';
    elements.avatarStatus.title = status.detail || status.text;
    elements.avatarStatus.disabled = !status.retryable;
  }
});

const voice = new VoiceController({
  enabled: () => elements.autoVoice.checked,
  onStatus: setVoiceStatus,
  onError: (message) => setError(message, 'warning'),
  onSpeaking: setSpeaking,
  onExpression: (emotion) => live2d.setExpression(emotion),
  onMouth: (value) => live2d.setMouth(value),
  onAudioReady: (mid) => {
    updateReplayButton(mid);
    updateGlobalReplayButton();
  },
  onActivity: (active) => {
    if (voiceActive === active) return;
    voiceActive = active;
    updateControls();
  }
});

function updateVoiceCapability() {
  const voiceId = CHARACTERS[state.active].voice;
  if (voice.readyFor(voiceId)) {
    elements.voiceCapability.textContent = 'AI 声线就绪';
    elements.voiceCapability.dataset.state = 'ready';
    elements.voiceRecovery.hidden = true;
  } else if (voice.availability.online) {
    elements.voiceCapability.textContent = '声线未配置';
    elements.voiceCapability.dataset.state = 'warning';
    elements.voiceRecovery.hidden = false;
  } else {
    elements.voiceCapability.textContent = '语音未启动';
    elements.voiceCapability.dataset.state = 'offline';
    elements.voiceRecovery.hidden = false;
  }
}

async function refreshVoiceStatus() {
  await voice.refreshAvailability();
  updateVoiceCapability();
  const voiceId = CHARACTERS[state.active].voice;
  if (voice.readyFor(voiceId)) voice.prepare(voiceId, true);
}

function renderCharacter() {
  const character = CHARACTERS[state.active];
  document.documentElement.style.setProperty('--character-accent', character.accent);
  elements.portraitStage.dataset.character = state.active;
  elements.portraitMain.src = character.image;
  elements.portraitMain.alt = character.name;
  elements.portraitName.textContent = character.name;
  elements.portraitCaption.textContent = character.caption;
  elements.roomCode.textContent = character.roomCode;
  elements.roomMood.textContent = character.roomMood;
  elements.characterDescription.textContent = character.description;
  elements.conversationTitle.textContent = '和' + character.name + '的房间';
  document.querySelectorAll('.character-tab').forEach((button) => {
    const selected = button.dataset.character === state.active;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
  elements.chatInput.value = storage.draft(state.active);
  live2d.setCharacter(state.active);
  updateVoiceCapability();
  if (voice.readyFor(character.voice)) voice.prepare(character.voice, true);
}

function nearBottom() {
  const list = elements.chatList;
  return list.scrollHeight - list.scrollTop - list.clientHeight < 100;
}

function scrollBottom() {
  elements.chatList.scrollTop = elements.chatList.scrollHeight;
}

function messageTemplate(item) {
  const user = item.role === 'user';
  const mid = item.mid || '';
  const replay = !user && mid
    ? `<button class="msg-voice-btn" type="button" data-mid="${escapeHtml(mid)}" title="重播这条语音"${voice.hasAudio(mid) ? '' : ' hidden'}>🔊 重播</button>`
    : '';
  const stopped = item.stopped ? '<span class="message-note">已停止</span>' : '';
  return `<div class="message ${user ? 'user' : 'assistant'}${mid && mid === streamingMessageId ? ' streaming' : ''}" data-mid="${escapeHtml(mid)}">
    <div class="message-avatar">${user ? '你' : CHARACTERS[state.active].icon}</div>
    <div class="message-body">
      <div class="message-bubble">${escapeHtml(item.content)}</div>
      <div class="message-meta">${stopped}${replay}</div>
    </div>
  </div>`;
}

function renderMessages(forceBottom = false) {
  const stick = forceBottom || nearBottom();
  const messages = currentMessages();
  if (!messages.length) {
    const character = CHARACTERS[state.active];
    elements.chatList.innerHTML = `<div class="chat-empty">
      <span class="chat-empty-kicker">${escapeHtml(character.roomCode)}</span>
      <div class="icon">${character.icon}</div>
      <div>${escapeHtml(character.greeting)}</div>
      <div class="chat-starters" aria-label="对话开场建议">${character.starters.map((starter) =>
        `<button type="button" data-starter="${escapeHtml(starter)}">${escapeHtml(starter)}</button>`
      ).join('')}</div>
    </div>`;
    updateGlobalReplayButton();
    return;
  }
  elements.chatList.innerHTML = messages.map(messageTemplate).join('');
  updateGlobalReplayButton();
  if (stick) scrollBottom();
}

function updateReplayButton(mid) {
  const button = [...document.querySelectorAll('.msg-voice-btn')]
    .find((item) => item.dataset.mid === mid);
  if (button) button.hidden = !voice.hasAudio(mid);
}

function updateGlobalReplayButton() {
  const available = currentMessages().some((item) => item.role === 'assistant' && item.mid && voice.hasAudio(item.mid));
  elements.replayButton.disabled = !available;
}

function setModel(name, persist = true) {
  currentModel = String(name || '');
  elements.modelSelect.value = currentModel;
  if (persist) storage.setModel(currentModel);
}

function populateModels(data) {
  elements.modelSelect.replaceChildren();
  const models = Array.isArray(data.models) ? data.models : [];
  if (!data.online || !models.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Ollama 未连接';
    elements.modelSelect.appendChild(option);
    setModel('', false);
    return;
  }
  models.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = item.name + (item.parameters ? ' · ' + item.parameters : '');
    elements.modelSelect.appendChild(option);
  });
  const saved = state.settings.model;
  const preferred = models.some((item) => item.name === saved)
    ? saved
    : data.model || models[0].name;
  setModel(preferred);
}

async function refreshChatStatus() {
  try {
    const response = await fetch('/api/chat-status', { cache:'no-store' });
    if (!response.ok) throw new Error('聊天状态接口不可用');
    const data = await response.json();
    ollamaOnline = Boolean(data.online && data.models && data.models.length);
    populateModels(data);
    if (!busy) setChatStatus(ollamaOnline ? '本地聊天模型已连接' : 'Ollama 未启动', ollamaOnline ? 'online' : '');
  } catch (error) {
    ollamaOnline = false;
    populateModels({ online:false, models:[] });
    if (!busy) setChatStatus('Ollama 未启动');
  }
  updateControls();
}

function updateControls() {
  elements.sendButton.disabled = busy || !ollamaOnline;
  // 语音通常晚于文字流结束，只按 busy 隐藏停止按钮会让播放期间无法打断。
  elements.stopButton.hidden = !busy && !voiceActive;
  elements.stopButton.title = busy ? '停止生成回复' : '停止语音播放';
  elements.modelSelect.disabled = busy || !ollamaOnline;
  elements.sendButton.title = ollamaOnline ? '' : '请先启动 Ollama';
}

function setBusy(value) {
  busy = value;
  if (value) setChatStatus('正在生成回复…', 'busy');
  else setChatStatus(ollamaOnline ? '本地聊天模型已连接' : '聊天模型未连接', ollamaOnline ? 'online' : '');
  updateControls();
}

function abortCurrentRequest(silent = false) {
  if (!activeRequest) return;
  activeRequest.abort();
  activeRequest = null;
  voice.stop({ preserveMessageAudio:true, silent:true });
  if (!silent) setError('已停止本次回复。', 'info', 2500);
}

function stopEverything() {
  const wasBusy = Boolean(activeRequest);
  const wasSpeaking = voice.isActive();
  if (!wasBusy && !wasSpeaking) return;
  abortCurrentRequest(true);
  voice.stop({ preserveMessageAudio:true, silent:true });
  setVoiceStatus('');
  setError(wasBusy ? '已停止本次回复。' : '已停止语音播放。', 'info', 2500);
}

async function sendMessage() {
  const text = elements.chatInput.value.trim();
  if (!text || busy || !ollamaOnline) return;
  setError('');
  voice.ensureAudioContext();

  const requestCharacter = state.active;
  const messages = currentMessages();
  messages.push({ role:'user', content:text, mid:'', stopped:false });
  storage.trim(requestCharacter);
  const assistant = {
    role:'assistant',
    content:'',
    mid:createMessageId(),
    stopped:false
  };
  messages.push(assistant);
  storage.save();
  elements.chatInput.value = '';
  storage.setDraft(requestCharacter, '');
  streamingMessageId = assistant.mid;
  renderMessages(true);
  setBusy(true);

  const controller = new AbortController();
  activeRequest = controller;
  const character = CHARACTERS[requestCharacter];
  voice.startTurn({ mid:assistant.mid, voice:character.voice, character:requestCharacter });

  try {
    const response = await fetch('/api/chat', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({
        character:requestCharacter,
        model:currentModel,
        messages:messages.slice(0, -1).map((item) => ({
          role:item.role,
          content:item.content
        }))
      }),
      signal:controller.signal
    });

    await parseNdjsonResponse(response, async (event) => {
      if (event.type === 'meta' && event.model) setModel(event.model);
      if (event.type !== 'token') return;
      assistant.content += event.content || '';
      const row = [...elements.chatList.querySelectorAll('.message')]
        .find((item) => item.dataset.mid === assistant.mid);
      if (row) {
        row.querySelector('.message-bubble').textContent = assistant.content;
        if (nearBottom()) scrollBottom();
      }
      voice.append(event.content || '');
    });

    assistant.content = assistant.content.trim() || '……';
    voice.finishTurn();
  } catch (error) {
    if (isAbortError(error)) {
      assistant.content = assistant.content.trim();
      assistant.stopped = Boolean(assistant.content);
      if (!assistant.content) messages.splice(messages.indexOf(assistant), 1);
    } else {
      messages.splice(messages.indexOf(assistant), 1);
      voice.stop({ preserveMessageAudio:true, silent:true });
      setError((error.detail ? error.message + '：' + error.detail : error.message) || '聊天暂不可用，请检查 Ollama。');
    }
  } finally {
    storage.trim(requestCharacter);
    storage.save();
    streamingMessageId = '';
    if (activeRequest === controller) activeRequest = null;
    setBusy(false);
    renderMessages();
  }
}

function switchCharacter(character) {
  if (!CHARACTERS[character] || character === state.active) return;
  if (busy) abortCurrentRequest(true);
  storage.setDraft(state.active, elements.chatInput.value);
  voice.stop({ preserveMessageAudio:true, silent:true });
  storage.setActive(character);
  setError('');
  renderCharacter();
  renderMessages(true);
}

function clearCharacterConversation() {
  if (busy) abortCurrentRequest(true);
  const mids = currentMessages().map((item) => item.mid).filter(Boolean);
  voice.stop({ preserveMessageAudio:true, silent:true });
  voice.clearMessages(mids);
  storage.clear(state.active);
  renderMessages(true);
  setError('已开始新的本地对话。', 'info', 2500);
}

function clearAllMemory() {
  const hasMemory = Object.values(state.histories).some((items) => items.length);
  if (!hasMemory) return;
  if (!confirm('清除宁宁和夏目的全部本地对话记忆？此操作无法撤销。')) return;
  if (busy) abortCurrentRequest(true);
  voice.stop({ preserveMessageAudio:false, silent:true });
  storage.clear();
  renderMessages(true);
  setError('全部本地聊天记忆已清除。', 'info', 3000);
}

elements.sendButton.addEventListener('click', sendMessage);
elements.stopButton.addEventListener('click', stopEverything);
elements.chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
elements.chatInput.addEventListener('input', () => {
  window.clearTimeout(draftTimer);
  const character = state.active;
  const value = elements.chatInput.value;
  draftTimer = window.setTimeout(() => storage.setDraft(character, value), 240);
});
elements.modelSelect.addEventListener('change', (event) => setModel(event.target.value));
elements.autoVoice.addEventListener('change', () => {
  storage.setAutoVoice(elements.autoVoice.checked);
  if (!elements.autoVoice.checked) {
    voice.stop({ preserveMessageAudio:true });
  } else {
    voice.ensureAudioContext();
    updateVoiceCapability();
  }
});
elements.volumeRange.addEventListener('input', () => {
  const v = parseInt(elements.volumeRange.value, 10) / 100;
  voice.setVolume(v);
  storage.setVolume(elements.volumeRange.value);
});
elements.replayButton.addEventListener('click', async () => {
  const latest = [...currentMessages()].reverse()
    .find((item) => item.role === 'assistant' && item.mid && voice.hasAudio(item.mid));
  if (!latest) {
    setError('本次打开页面后还没有可重播的语音。', 'info', 3500);
    return;
  }
  await voice.playMessage(latest.mid);
});
elements.chatList.addEventListener('click', (event) => {
  const starter = event.target.closest && event.target.closest('[data-starter]');
  if (starter) {
    elements.chatInput.value = starter.dataset.starter || starter.textContent || '';
    storage.setDraft(state.active, elements.chatInput.value);
    elements.chatInput.focus();
    elements.chatInput.setSelectionRange(elements.chatInput.value.length, elements.chatInput.value.length);
    return;
  }
  const button = event.target.closest && event.target.closest('.msg-voice-btn');
  if (button && button.dataset.mid) voice.playMessage(button.dataset.mid);
});
elements.avatarStatus.addEventListener('click', () => {
  if (elements.avatarStatus.dataset.retryable === 'true') live2d.retry();
});
document.querySelectorAll('.character-tab').forEach((button) => {
  button.addEventListener('click', () => switchCharacter(button.dataset.character));
});
byId('newChatBtn').addEventListener('click', clearCharacterConversation);
byId('clearChatBtn').addEventListener('click', clearAllMemory);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    refreshChatStatus();
    refreshVoiceStatus();
  }
});
window.addEventListener('beforeunload', () => {
  abortCurrentRequest(true);
  voice.destroy();
});

elements.autoVoice.checked = state.settings.autoVoice;
elements.volumeRange.value = state.settings.volume != null ? state.settings.volume : 80;
voice.setVolume(parseInt(elements.volumeRange.value, 10) / 100);
renderCharacter();
renderMessages(true);
live2d.init(state.active);
refreshChatStatus();
refreshVoiceStatus();
statusTimer = window.setInterval(() => {
  if (!busy) refreshChatStatus();
  refreshVoiceStatus();
}, 30000);
updateControls();
