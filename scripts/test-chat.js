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
console.log('Chat prototype tests passed: page, navigation, local memory, Ollama and voice endpoints');
