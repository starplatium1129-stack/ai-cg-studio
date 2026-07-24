import {
  CHARACTERS,
  MAX_LOCAL_MESSAGES,
  STORAGE_KEY,
  STORAGE_VERSION,
  createMessageId
} from './config.mjs';

function normalizeMessages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({
      role: item.role,
      content: String(item.content || '').slice(0, 1200),
      mid: item.role === 'assistant' ? String(item.mid || createMessageId()) : '',
      stopped: item.stopped === true
    }))
    .filter((item) => item.content)
    .slice(-MAX_LOCAL_MESSAGES);
}

export class ChatStorage {
  constructor(onError) {
    this.onError = onError || (() => {});
    this.state = {
      version: STORAGE_VERSION,
      active: 'nene',
      histories: { nene:[], natsume:[] },
      settings: { model:'', autoVoice:true, volume:80, drafts:{ nene:'', natsume:'' } }
    };
  }

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      this.state.active = raw.active === 'natsume' ? 'natsume' : 'nene';
      Object.keys(CHARACTERS).forEach((character) => {
        this.state.histories[character] = normalizeMessages(raw.histories && raw.histories[character]);
      });
      const savedModel = raw.settings && raw.settings.model || localStorage.getItem('aics_chat_model') || '';
      this.state.settings.model = String(savedModel);
      this.state.settings.autoVoice = raw.settings ? raw.settings.autoVoice !== false : true;
      this.state.settings.volume = raw.settings && typeof raw.settings.volume === 'number' ? raw.settings.volume : 80;
      Object.keys(CHARACTERS).forEach((character) => {
        const draft = raw.settings && raw.settings.drafts && raw.settings.drafts[character];
        this.state.settings.drafts[character] = String(draft || '').slice(0, 1200);
      });
    } catch (error) {
      this.onError('本地聊天记录损坏，已使用空白会话。');
    }
    return this.state;
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      localStorage.setItem('aics_chat_model', this.state.settings.model || '');
      return true;
    } catch (error) {
      this.onError('浏览器存储空间不足，本轮聊天可能无法长期保存。');
      return false;
    }
  }

  messages(character = this.state.active) {
    return this.state.histories[character] || [];
  }

  setActive(character) {
    this.state.active = character === 'natsume' ? 'natsume' : 'nene';
    this.save();
  }

  setModel(model) {
    this.state.settings.model = String(model || '');
    this.save();
  }

  setAutoVoice(value) {
    this.state.settings.autoVoice = Boolean(value);
    this.save();
  }

  setVolume(value) {
    this.state.settings.volume = Math.max(0, Math.min(100, Math.round(Number(value) || 80)));
    this.save();
  }

  draft(character = this.state.active) {
    return this.state.settings.drafts[character] || '';
  }

  setDraft(character, value) {
    if (!CHARACTERS[character]) return;
    this.state.settings.drafts[character] = String(value || '').slice(0, 1200);
    this.save();
  }

  trim(character = this.state.active) {
    const messages = this.messages(character);
    if (messages.length > MAX_LOCAL_MESSAGES) {
      messages.splice(0, messages.length - MAX_LOCAL_MESSAGES);
    }
  }

  clear(character) {
    if (character) {
      this.state.histories[character] = [];
    } else {
      Object.keys(CHARACTERS).forEach((id) => { this.state.histories[id] = []; });
    }
    this.save();
  }
}
