'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var runtimeTools = require('../scripts/runtime/runtime-paths');
var safeLocalUrl = require('./security').safeLocalUrl;

// 上游 host 在读取时也要过一遍校验：落盘的 runtime/config.json 可能被改坏，
// 只在写入端校验会让重启成为绕过手段。
function resolveUpstreamHost(envValue, savedValue, fallback) {
  var candidates = [envValue, savedValue, fallback];
  for (var i = 0; i < candidates.length; i++) {
    if (!candidates[i]) continue;
    var safe = safeLocalUrl(candidates[i]);
    if (safe) return safe;
    console.warn('  ⚠ 忽略非本机上游地址:', candidates[i]);
  }
  return fallback;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return {};
  }
}

function readGatewayToken(file) {
  try {
    var token = fs.readFileSync(file, 'utf8').trim();
    return /^[a-f0-9]{64}$/i.test(token) ? token : '';
  } catch (error) {
    return '';
  }
}

function writeGatewayToken(file, token) {
  var temporary = file + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(temporary, token + '\n', { encoding:'utf8', mode:0o600 });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (cleanupError) {}
    console.warn('  Unable to persist gateway token:', error.message);
  }
}

function resolveGatewayToken(envToken, tokenFile) {
  if (envToken) return envToken;
  var savedToken = readGatewayToken(tokenFile);
  if (savedToken) return savedToken;
  var token = crypto.randomBytes(32).toString('hex');
  writeGatewayToken(tokenFile, token);
  return token;
}

function boundedInteger(value, fallback, min, max) {
  var number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function resolveSceneShowcaseDir(rootDir, configured) {
  if (configured) {
    var configuredPath = path.resolve(configured);
    if (fs.existsSync(path.join(configuredPath, 'manifest.json'))) return configuredPath;
  }
  var root = path.resolve(rootDir, '..', 'AI', 'SceneShowcase');
  if (fs.existsSync(path.join(root, 'manifest.json'))) return root;
  if (!fs.existsSync(root)) return '';
  try {
    return fs.readdirSync(root, { withFileTypes:true })
      .filter(function (entry) {
        return entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'manifest.json'));
      })
      .map(function (entry) { return path.join(root, entry.name); })
      .sort(function (a, b) {
        return path.basename(b).localeCompare(path.basename(a), 'zh-CN');
      })[0] || '';
  } catch (error) {
    return '';
  }
}

function loadGatewayConfig(rootDir, env) {
  env = env || process.env;
  var runtime = runtimeTools.createRuntimePaths(rootDir);
  runtimeTools.migrateLegacyRuntime(rootDir, runtime);
  var saved = readJson(runtime.config);
  var translatePort = boundedInteger(env.TRANSLATE_PORT, 5310, 1024, 65535);

  return {
    ROOT_DIR:rootDir,
    // The sibling AI workspace contains the local LoRA and voice assets.  It
    // is only used by the local training API; the browser never supplies this
    // path.
    AI_WORKSPACE_ROOT:path.resolve(env.AI_WORKSPACE_ROOT || path.join(rootDir, '..', 'AI')),
    RUNTIME:runtime,
    RUNTIME_ROOT:runtime.root,
    PORT:boundedInteger(env.PORT, 3000, 1, 65535),
    HOST:env.HOST || '127.0.0.1',
    // Explicit TOKEN remains an operator override. Otherwise keep one random
    // token per runtime so a shared URL survives gateway restarts.
    TOKEN:resolveGatewayToken(env.TOKEN, runtime.gatewayToken),
    TOKEN_SOURCE:env.TOKEN ? 'environment' : 'runtime/state',
    SD_HOST:resolveUpstreamHost(env.SD_HOST, saved.sdHost, 'http://127.0.0.1:7860'),
    SD_API_AUTH:env.SD_API_AUTH || '',
    TTS_HOST:resolveUpstreamHost(env.TTS_HOST, saved.ttsHost, 'http://127.0.0.1:9880'),
    VOICE_PROFILES:saved.voices && typeof saved.voices === 'object' ? saved.voices : {},
    OLLAMA_HOST:resolveUpstreamHost(env.OLLAMA_HOST, saved.ollamaHost, 'http://127.0.0.1:11434'),
    OLLAMA_MODEL:env.OLLAMA_MODEL || saved.ollamaModel || '',
    OLLAMA_KEEP_ALIVE:env.OLLAMA_KEEP_ALIVE || '10m',
    OLLAMA_NUM_PREDICT:boundedInteger(env.OLLAMA_NUM_PREDICT, 300, 32, 2048),
    OLLAMA_NUM_CTX:boundedInteger(env.OLLAMA_NUM_CTX, 4096, 1024, 32768),
    TRANSLATION_PYTHON:env.TRANSLATION_PYTHON || path.resolve(rootDir, '..', 'AI', 'GPT-SoVITS-env', 'python.exe'),
    TRANSLATION_SCRIPT:path.join(rootDir, 'tools', 'translate-zh-ja.py'),
    TRANSLATE_PORT:translatePort,
    TRANSLATE_URL:'http://127.0.0.1:' + translatePort,
    TRANSLATION_LOG:path.join(runtime.logs, 'translate.log'),
    LIVE2D_ROOT:path.join(rootDir, 'assets', 'live2d'),
    SCENE_SHOWCASE_DIR:resolveSceneShowcaseDir(rootDir, env.SCENE_SHOWCASE_DIR),
    DISABLE_TUNNEL:env.DISABLE_TUNNEL === '1',
    CLOUDFLARED_PATH:env.CLOUDFLARED_PATH || 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe'
  };
}

module.exports = {
  loadGatewayConfig:loadGatewayConfig,
  resolveSceneShowcaseDir:resolveSceneShowcaseDir,
  boundedInteger:boundedInteger,
  resolveGatewayToken:resolveGatewayToken
};
