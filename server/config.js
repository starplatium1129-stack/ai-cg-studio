'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var runtimeTools = require('../scripts/lib/runtime-paths');
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

function resolveSceneShowcaseDir(rootDir, configured, workspaceRoot) {
  if (configured) {
    var configuredPath = path.resolve(configured);
    if (fs.existsSync(path.join(configuredPath, 'manifest.json'))) return configuredPath;
  }
  // 桌面版把 AI_WORKSPACE_ROOT 显式传给网关（appRoot 可能在安装目录，
  // 父目录没有 AI/）；样张目录优先从工作区解析，其次是 appRoot 兄弟目录。
  var bases = workspaceRoot
    ? [workspaceRoot, path.resolve(rootDir, '..', 'AI')]
    : [path.resolve(rootDir, '..', 'AI')];
  var root = '';
  for (var i = 0; i < bases.length; i++) {
    var candidate = path.join(bases[i], 'SceneShowcase');
    if (fs.existsSync(path.join(candidate, 'manifest.json'))) {
      root = candidate;
      break;
    }
    if (fs.existsSync(candidate)) {
      root = candidate;
      break;
    }
  }
  if (!root) return '';
  try {
    return fs.readdirSync(root, { withFileTypes:true })
      .filter(function (entry) {
        // 排除隐藏目录与构建中目录（.building-<pid>）：2026-08-15 实机
        // .2026-08-15_v21.building-518872 被当成最新版本，导致 home-hero
        // 读到空 manifest，首页回退旧立绘。
        return entry.isDirectory()
          && !entry.name.startsWith('.')
          && fs.existsSync(path.join(root, entry.name, 'manifest.json'));
      })
      .map(function (entry) { return path.join(root, entry.name); })
      .sort(function (a, b) {
        return path.basename(b).localeCompare(path.basename(a), 'zh-CN');
      })[0] || '';
  } catch (error) {
    return '';
  }
}

/**
 * 角色参考标准图（Cinematic Bible，~1GB）——2026-08-29 随样张模式迁出项目，
 * 落 AI 工作区 CharacterReferences（与 SceneShowcase 平级），桌面安装包不再
 * 携带媒体图。env AICS_CHARACTER_REF_ROOT 显式覆盖；找不到返回 ''（前端按
 * 无参考图优雅降级，server 侧不挂 /character-references 路由）。
 */
function resolveCharRefRoot(appRoot, env, workspaceRoot) {
  if (env.AICS_CHARACTER_REF_ROOT) {
    var explicit = path.resolve(env.AICS_CHARACTER_REF_ROOT);
    if (fs.existsSync(explicit)) return explicit;
  }
  var bases = workspaceRoot
    ? [workspaceRoot, path.resolve(appRoot, '..', 'AI')]
    : [path.resolve(appRoot, '..', 'AI')];
  for (var i = 0; i < bases.length; i++) {
    var candidate = path.join(bases[i], 'CharacterReferences');
    if (fs.existsSync(candidate)) return candidate;
  }
  return '';
}

function loadGatewayConfig(rootDir, env) {
  env = env || process.env;
  var appRoot = path.resolve(env.AICS_APP_ROOT || rootDir);
  var assetsRoot = path.resolve(env.AICS_ASSETS_ROOT || path.join(appRoot, 'assets'));
  var toolsRoot = path.resolve(env.AICS_TOOLS_ROOT || path.join(appRoot, 'tools'));
  var runtime = runtimeTools.createRuntimePaths(appRoot, env.AICS_RUNTIME_ROOT);
  // Fixture stacks use an isolated runtime and must not move legacy files from
  // the repository root. Production keeps the historical migration default.
  if (env.AICS_DISABLE_LEGACY_RUNTIME_MIGRATION !== '1') {
    runtimeTools.migrateLegacyRuntime(appRoot, runtime);
  }
  var saved = readJson(runtime.config);
  var translatePort = boundedInteger(env.TRANSLATE_PORT, 5310, 1024, 65535);
  var workspaceRoot = path.resolve(env.AI_WORKSPACE_ROOT || path.join(appRoot, '..', 'AI'));

  return {
    ROOT_DIR:appRoot,
    ASSETS_ROOT:assetsRoot,
    TOOLS_ROOT:toolsRoot,
    SCRIPTS_ROOT:path.resolve(env.AICS_SCRIPTS_ROOT || path.join(appRoot, 'scripts')),
    // The sibling AI workspace contains the local LoRA and voice assets.  It
    // is only used by the local training API; the browser never supplies this
    // path.
    AI_WORKSPACE_ROOT:workspaceRoot,
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
    COMFY_HOST:resolveUpstreamHost(env.COMFY_HOST, saved.comfyHost, 'http://127.0.0.1:8188'),
    TTS_HOST:resolveUpstreamHost(env.TTS_HOST, saved.ttsHost, 'http://127.0.0.1:9880'),
    VOICE_PROFILES:saved.voices && typeof saved.voices === 'object' ? saved.voices : {},
    OLLAMA_HOST:resolveUpstreamHost(env.OLLAMA_HOST, saved.ollamaHost, 'http://127.0.0.1:11434'),
    OLLAMA_MODEL:env.OLLAMA_MODEL || saved.ollamaModel || '',
    OLLAMA_KEEP_ALIVE:env.OLLAMA_KEEP_ALIVE || '10m',
    OLLAMA_NUM_PREDICT:boundedInteger(env.OLLAMA_NUM_PREDICT, 300, 32, 2048),
    OLLAMA_NUM_CTX:boundedInteger(env.OLLAMA_NUM_CTX, 4096, 1024, 32768),
    TRANSLATION_PYTHON:env.TRANSLATION_PYTHON || path.resolve(workspaceRoot, 'GPT-SoVITS-env', 'python.exe'),
    TRANSLATION_SCRIPT:path.join(toolsRoot, 'translate-zh-ja.py'),
    TRANSLATE_PORT:translatePort,
    TRANSLATE_URL:'http://127.0.0.1:' + translatePort,
    TRANSLATION_LOG:path.join(runtime.logs, 'translate.log'),
    // 控制面板服务自愈的探测间隔；此前 control.js 读这个字段但 config 从未定义，
    // 恒为默认 5000ms。这里补上 env 解析，让配置真正生效。
    SELF_HEALING_INTERVAL_MS:boundedInteger(env.SELF_HEALING_INTERVAL_MS, 5000, 1000, 60000),
    LIVE2D_ROOT:path.join(assetsRoot, 'live2d'),
    SCENE_SHOWCASE_DIR:resolveSceneShowcaseDir(appRoot, env.SCENE_SHOWCASE_DIR, workspaceRoot),
    CHARACTER_REF_ROOT:resolveCharRefRoot(appRoot, env, workspaceRoot),
    DISABLE_TUNNEL:env.DISABLE_TUNNEL === '1',
    // 桌面打包模式（Tauri 壳仅在打包模式注入，见 main_shared.rs gateway_env）：
    // 场景内容维护链路（scenes/run/build-web）返回 501，展示类不受限。
    DESKTOP_PACKAGED:env.AICS_DESKTOP_PACKAGED === '1',
    CLOUDFLARED_PATH:env.CLOUDFLARED_PATH || 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe'
  };
}

module.exports = {
  loadGatewayConfig:loadGatewayConfig,
  resolveSceneShowcaseDir:resolveSceneShowcaseDir,
  resolveCharRefRoot:resolveCharRefRoot,
  boundedInteger:boundedInteger,
  resolveGatewayToken:resolveGatewayToken
};
