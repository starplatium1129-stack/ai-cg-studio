const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const control = fs.readFileSync(path.join(root, 'tools', 'control-server.js'), 'utf8');
const controlHtml = fs.readFileSync(path.join(root, 'tools', 'control.html'), 'utf8');
const controlUi = fs.readFileSync(path.join(root, 'tools', 'control.js'), 'utf8');
const gatewayConfig = fs.readFileSync(path.join(root, 'server', 'config.js'), 'utf8');
const ollamaService = fs.readFileSync(path.join(root, 'services', 'ollama-service.js'), 'utf8');
const translationService = fs.readFileSync(path.join(root, 'services', 'translation-service.js'), 'utf8');
const translatePy = fs.readFileSync(path.join(root, 'tools', 'translate-zh-ja.py'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error('[resource] ' + message);
}

// ─── 网关：Ollama 显存自动释放 + 常驻翻译服务 ───
assert(ollamaService.includes('keep_alive:keepAlive'), 'gateway must pass keep_alive so Ollama unloads idle models from VRAM');
assert(gatewayConfig.includes("OLLAMA_KEEP_ALIVE:env.OLLAMA_KEEP_ALIVE || '10m'"), 'gateway must default Ollama keep_alive to 10 minutes');
assert(ollamaService.includes('num_ctx:numContext'), 'gateway must cap Ollama context window to limit VRAM usage');
assert(ollamaService.includes('async function unload') && ollamaService.includes('activeModel'), 'gateway must unload old model before loading a different one to avoid double VRAM consumption');
assert(translationService.includes('ensureServer') && translationService.includes("'--serve'"), 'gateway must manage a persistent translation server');
assert(translationService.includes('runLegacy'), 'gateway must keep the spawn-per-call translation as fallback');
assert(translationService.includes('prepare:prepare'), 'voice clients must be able to prewarm the translation model');
assert(gatewayConfig.includes('TRANSLATE_PORT') && translationService.includes("'/health'"), 'gateway must health-check the translation server');

// ─── 翻译脚本：常驻服务模式 ───
assert(translatePy.includes('ThreadingHTTPServer') && translatePy.includes('/translate'), 'translate script must serve HTTP in --serve mode');
assert(translatePy.includes('load_model()'), 'translate script must load the model once');
assert(translatePy.includes('_MODEL_LOCK'), 'translate script must serialize concurrent translations');
assert(translatePy.includes('batch_decode') && translatePy.includes('TRANSLATION_BEAMS'), 'translation must batch sentences and default to low-latency decoding');

// ─── 控制面板后端：服务调度 ───
assert(control.includes("app.post('/api/service/voice'"), 'control server must expose voice start/stop endpoint');
assert(control.includes("app.post('/api/service/webui'"), 'control server must expose webui start/stop endpoint');
assert(control.includes("app.post('/api/service/ollama'"), 'control server must expose ollama unload endpoint');
assert(control.includes("app.post('/api/mode'"), 'control server must expose one-click mode switching');
assert(control.includes('unloadOllamaModels') && control.includes('keep_alive:0'), 'control server must unload Ollama models via keep_alive=0');
assert(control.includes('/api/ps'), 'control server must read Ollama loaded models and VRAM usage');
assert(control.includes('AUTO_START_VOICE') && control.includes('autoStartVoice === true'), 'voice auto-start must be opt-in instead of default');
assert(control.includes('runScriptAsync'), 'control server must run long service scripts asynchronously');
assert(control.includes('beginOperation') && control.includes('finishOperation') && control.includes('operationConflict'), 'control server must serialize GPU operations and expose structured progress');
assert(control.includes('Promise.all([checkSD(force), checkTTS(force), checkOllama(force)])'), 'fresh status requests must wait for completed health checks instead of returning stale state');
assert(control.includes('stopManagedServices === true'), 'stopping the website must preserve generation services unless explicitly requested');

// ─── 控制面板界面：调度面板 ───
assert(controlHtml.includes('显存资源调度'), 'control panel must show the VRAM scheduling panel');
assert(controlHtml.includes('data-action="switch-mode"') && controlHtml.includes('data-mode="draw"') && controlHtml.includes('data-mode="chat"'), 'control panel must offer draw/chat mode buttons');
assert(controlHtml.includes('data-action="service"') && controlHtml.includes('data-service="voice"') && controlHtml.includes('data-service="ollama"'), 'control panel must expose per-service controls');
assert(controlHtml.includes('auto-start-voice') && controlUi.includes('/api/preference'), 'control panel must make voice auto-start an explicit preference');
assert(controlHtml.includes('ollama-badge'), 'control panel must show Ollama online and VRAM status');
assert(controlHtml.includes('operation-panel') && controlUi.includes('renderOperation'), 'control panel must render operation progress and final failures');
assert((controlHtml + controlUi).includes('停止网站网关'), 'the primary stop action must describe its limited scope');
assert(controlHtml.match(/<script src="control\.js\?v=\d+"><\/script>/), 'control panel controller must stay external');
assert(controlUi.includes('startPolling();'), 'control panel must begin health polling as soon as it opens');
assert(!/on(click|change|input)=/.test(controlHtml), 'control panel must not use inline HTML event attributes');
assert(controlUi.includes("getAttribute('data-action')"), 'control panel must bind actions via data-action delegation');

console.log('Resource scheduling tests passed: VRAM modes, service controls, persistent translation, Ollama keep_alive');
