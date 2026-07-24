const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'tools', 'chat.html'), 'utf8');
const nav = fs.readFileSync(path.join(root, 'tools', 'nav.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error('[chat] ' + message);
}

assert(html.includes('data-nav="chat"'), 'chat page must expose the chat navigation state');
assert(html.includes('data-character="nene"') && html.includes('data-character="natsume"'), 'chat page must expose both characters');
assert(html.includes('../api/chat') && html.includes('../api/chat-status'), 'chat page must call the gateway chat endpoints');
assert(html.includes('../api/tts') && html.includes('../api/translate'), 'chat page must reuse translation and TTS');
assert(html.includes('localStorage') && html.includes('aics_chat_v1'), 'chat memory must stay local');
assert(html.includes('portrait-breathe') && html.includes('portrait-stage.speaking'), 'chat page must provide lightweight character motion');
assert(nav.includes("{ id:'chat'") && nav.includes('tools/chat.html'), 'chat page must be reachable from navigation');
assert(server.includes("app.get('/api/chat-status'") && server.includes("app.post('/api/chat'"), 'gateway must expose chat endpoints');
assert(server.includes('chatCharacterPrompt') && server.includes('OLLAMA_HOST'), 'gateway must keep provider and character prompt configuration');

// 语音流水线：句子级切分 + 串行合成 + 顺序播放
assert(html.includes('drainSentences') && html.includes('enqueueVoiceSentence'), 'chat page must split streamed text into sentences');
assert(html.includes('voiceChain') && html.includes('playQueue') && html.includes('pumpVoice'), 'chat page must serialize synthesis and playback queues');
assert(html.includes('voiceSession'), 'chat page must invalidate stale voice pipelines via session tokens');
assert(!html.includes('userTranslatePromise'), 'chat page must not voice the user input translation (fixed mis-voicing bug)');
assert(!html.includes('MIN_BUFFER_SIZE'), 'chat page must not fragment WAV playback into 16KB chunks');

// 音频质量：完整 WAV + 头修正 + WebAudio 振幅分析
assert(html.includes('fixWavHeader'), 'chat page must repair streamed WAV headers before playback');
assert(html.includes('createAnalyser') && html.includes('getByteTimeDomainData'), 'chat page must drive lip sync from real audio amplitude');
assert(html.includes('arrayBuffer()'), 'chat page must buffer the full sentence WAV before playback');

// Live2D：底部锚定 + 表情联动 + 嘴型参数
assert(html.includes('fitLive2d') && html.includes('layoutLive2d'), 'chat page must fit Live2D model with bottom anchoring');
assert(html.includes('LIVE2D_EXPRESSIONS') && html.includes('setExpression'), 'chat page must map emotions to Live2D expressions');
assert(html.includes('ParamMouthOpenY'), 'chat page must keep driving the Live2D mouth parameter');
assert(html.includes('setLive2dVisible'), 'chat page must keep Live2D limited to nene with static fallback');

// 交互：逐条重播 + 自动滚屏策略
assert(html.includes('msg-voice-btn') && html.includes('playMsgAudio'), 'chat page must expose per-message voice replay');
assert(html.includes('nearBottom'), 'chat page must only auto-scroll when the user is near the bottom');

console.log('Chat tests passed: streaming sentence pipeline, WAV integrity, analyser lip sync, Live2D fit & expressions');
