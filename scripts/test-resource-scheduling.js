const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const control = fs.readFileSync(path.join(root, 'tools', 'control-server.js'), 'utf8');
const controlHtml = fs.readFileSync(path.join(root, 'tools', 'control.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const translatePy = fs.readFileSync(path.join(root, 'tools', 'translate-zh-ja.py'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error('[resource] ' + message);
}

// ─── 网关：Ollama 显存自动释放 + 常驻翻译服务 ───
assert(server.includes('keep_alive:OLLAMA_KEEP_ALIVE'), 'gateway must pass keep_alive so Ollama unloads idle models from VRAM');
assert(server.includes("OLLAMA_KEEP_ALIVE || '10m'"), 'gateway must default Ollama keep_alive to 10 minutes');
assert(server.includes('ensureTranslateServer') && server.includes('--serve'), 'gateway must manage a persistent translation server');
assert(server.includes('legacyTranslateChineseToJapanese'), 'gateway must keep the spawn-per-call translation as fallback');
assert(server.includes("TRANSLATE_PORT") && server.includes('/health'), 'gateway must health-check the translation server');

// ─── 翻译脚本：常驻服务模式 ───
assert(translatePy.includes('ThreadingHTTPServer') && translatePy.includes('/translate'), 'translate script must serve HTTP in --serve mode');
assert(translatePy.includes('load_model()'), 'translate script must load the model once');
assert(translatePy.includes('_MODEL_LOCK'), 'translate script must serialize concurrent translations');

// ─── 控制面板后端：服务调度 ───
assert(control.includes("app.post('/api/service/voice'"), 'control server must expose voice start/stop endpoint');
assert(control.includes("app.post('/api/service/webui'"), 'control server must expose webui start/stop endpoint');
assert(control.includes("app.post('/api/service/ollama'"), 'control server must expose ollama unload endpoint');
assert(control.includes("app.post('/api/mode'"), 'control server must expose one-click mode switching');
assert(control.includes('unloadOllamaModels') && control.includes('keep_alive:0'), 'control server must unload Ollama models via keep_alive=0');
assert(control.includes('/api/ps'), 'control server must read Ollama loaded models and VRAM usage');
assert(control.includes('AUTO_START_VOICE') && control.includes('autoStartVoice === true'), 'voice auto-start must be opt-in instead of default');
assert(control.includes('runScriptAsync'), 'control server must run long service scripts asynchronously');

// ─── 控制面板界面：调度面板 ───
assert(controlHtml.includes('显存资源调度'), 'control panel must show the VRAM scheduling panel');
assert(controlHtml.includes("switchMode('draw')") && controlHtml.includes("switchMode('chat')"), 'control panel must offer draw/chat mode buttons');
assert(controlHtml.includes("serviceAction('voice','start')") && controlHtml.includes("serviceAction('ollama','unload')"), 'control panel must expose per-service controls');
assert(controlHtml.includes('auto-start-voice') && controlHtml.includes('/api/preference'), 'control panel must make voice auto-start an explicit preference');
assert(controlHtml.includes('ollama-badge'), 'control panel must show Ollama online and VRAM status');

console.log('Resource scheduling tests passed: VRAM modes, service controls, persistent translation, Ollama keep_alive');
