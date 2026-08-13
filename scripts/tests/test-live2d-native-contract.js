'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const root = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('Native Companion owns the overlay and Atelier stays browser-only', () => {
  const companion = read('src/views/CompanionView.vue')
  const shim = read('desktop-tauri/src-tauri/src/shim.rs')
  const main = read('desktop-tauri/src-tauri/src/main.rs')

  assert.match(companion, /:backend="desktopBridge \? 'native' : 'browser'"/)
  assert.ok(shim.includes("location.pathname.replace(/\\/+$/, '')"))
  assert.match(shim, /if \(enableNativeLive2D\) window\.aicsLive2dNative/)
  assert.match(shim, /const waitForTauri = \(\) => new Promise/)
  assert.match(shim, /TAURI_API_UNAVAILABLE/)
  assert.match(shim, /entry\.cancelled/)
  assert.match(shim, /return id/)
  assert.match(shim, /onStopped: \(cb\) => on\('aics:live2d:stopped', cb\)/)
  assert.match(main, /arg == "--hidden"/)
  assert.match(main, /create_companion_window\(&handle, &url, shim, show_on_start\)/)
})

test('Native IPC payload and render ownership contracts stay aligned', () => {
  const overlay = read('desktop-tauri/src-tauri/src/live2d_overlay.rs')
  const renderer = read('desktop-tauri/native-live2d/src/renderer.rs')
  const model = read('desktop-tauri/native-live2d/src/model.rs')
  const mainShared = read('desktop-tauri/src-tauri/src/main_shared.rs')
  const bridge = read('desktop-tauri/src-tauri/src/bridge.rs')
  const main = read('desktop-tauri/src-tauri/src/main.rs')

  assert.match(overlay, /app\.emit\("aics:live2d:hit-test", areas\)/)
  assert.doesNotMatch(overlay, /index\.unwrap_or\(0\)/)
  assert.match(overlay, /if character == "natsume" \{\s*-0\.5 \* level/)
  assert.match(overlay, /ctx\.advance_motion\(dt, app\.as_ref\(\)\)/)
  // 渲染线程退出必须广播 stopped（带 reason），前端才知 overlay 不可用并可重试。
  assert.match(overlay, /"aics:live2d:stopped"/)
  assert.match(overlay, /fn emit_stopped\(app: Option<&AppHandle>, reason: &str\)/)
  assert.match(overlay, /stopped_reason = Some\(format!\("render frame failed: \{e\}"\)\)/)
  assert.match(overlay, /emit_stopped\(app\.as_ref\(\), &reason\)/)
  // overlay 位于透明 Companion WebView 下方，禁止用 SetWindowRgn 给控件挖洞：
  // Win32 region 同时裁剪 DComp 画面，会在角色身上留下矩形缺口。
  assert.doesNotMatch(overlay, /SetWindowRgn/)
  assert.match(overlay, /WS_EX_TRANSPARENT/)
  assert.match(overlay, /get_webview_window\("companion"\)/)
  assert.match(overlay, /last_z_order_sync\.elapsed\(\) >= Duration::from_millis\(250\)/)
  assert.match(overlay, /GetWindowRect\(companion, &mut companion_rect\)/)
  assert.match(overlay, /followed_overlay_rect/)
  assert.match(overlay, /SWP_NOACTIVATE \| SWP_NOSIZE/)
  assert.doesNotMatch(overlay, /OverlayCommand::HitTest \{ x, y, reply \}[\s\S]{0,300}?app\.emit\("aics:live2d:hit-test"/)
  assert.ok(overlay.indexOf('ShowWindow(hwnd, SW_SHOWNA);', overlay.indexOf('if visible {'))
    < overlay.indexOf('SetWindowPos(', overlay.indexOf('if visible {')),
  '首次显示必须发生在 z-order 定位前，避免 ShowWindow 把 overlay 提到 WebView 上方')
  // set_character 必须真异步：模型加载在渲染线程，主线程不得 block_on。
  assert.match(overlay, /pub async fn aics_live2d_set_character/)
  assert.match(overlay, /rx\s*\.await\s*\.map_err/)
  assert.doesNotMatch(overlay, /aics_live2d_set_character[\s\S]{0,400}?pollster::block_on/)
  // 同一互动播放中重复点击必须拒绝（返回"动作进行中"），不能 force 重启。
  assert.match(overlay, /motion already playing/)
  assert.match(overlay, /would_reject_interaction/)
  assert.match(overlay, /SetMaxFps\(u32\)/)
  assert.match(overlay, /target_fps\.load/)
  assert.match(overlay, /model_bounds/)
  const stateCommand = overlay.match(/pub fn aics_live2d_get_state[\s\S]*?\n}\n\n#\[tauri::command\]/)?.[0] || ''
  assert.match(stateCommand, /try_state::<Arc<Live2DOverlayState>>/)
  assert.doesNotMatch(stateCommand, /ensure_overlay/)
  for (const field of ['active', 'rect', 'visible', 'frameCount', 'targetFps', 'character', 'ready', 'windowReady', 'rendererAttached', 'modelBounds', 'mouthLevel', 'mouthMappedValue']) {
    assert.ok(stateCommand.includes(`"${field}"`), `Native diagnostic state must expose ${field}`)
  }
  assert.ok((overlay.match(/release_model_resources\(\)/g) || []).length >= 2,
    'model load and destroy must release renderer-owned caches')
  assert.match(overlay, /SurfaceError::Outdated \| wgpu::SurfaceError::Lost[\s\S]{0,160}?configure_surface/)
  assert.match(renderer, /prewarm_model_resources\(&drawables/)
  assert.match(renderer, /texture_upload\.buffer = None/)
  assert.match(model, /count <= 0 \|\| pointer\.is_null\(\)/)
  assert.match(mainShared, /aics:visibility/, 'window visibility must be emitted by the shell')
  assert.match(mainShared, /aics:window-bounds/)
  assert.match(main, /format!\("\{\}\/companion", url\.trim_end_matches\('\/'\)\)/)
  // 进程最早期 DPI awareness：必须在任何窗口创建前设置，覆盖 Companion WebView。
  assert.ok(main.indexOf('SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)')
    < main.indexOf('tauri::Builder::default()'),
    'DPI awareness 必须在 Builder 构建（窗口创建）之前设置')
  assert.match(bridge, /on_battery_power\(\)/)
  assert.doesNotMatch(main, /app\.manage\(state\.paths\.clone\(\)\)/)
})

test('Native frontend lifecycle forwards reset, bounds, FPS and emotion ticks', () => {
  const live2d = read('src/composables/useLive2D.ts')
  const backend = read('src/live2d/nativeBackend.ts')
  const nativeTypes = read('src/types/live2dNative.ts')

  assert.match(live2d, /session\?\.sendMouthLevel\?\.\(0\)/)
  assert.match(live2d, /requestAnimationFrame\(nativeEmotionTick\)/)
  assert.match(live2d, /session\.updateOverlay\(overlayRect, true\)/)
  assert.match(live2d, /windowBounds: \{ x: 0, y: 0, width: bounds\.width, height: bounds\.height \}/)
  assert.match(live2d, /model\?\.hitTest\(/)
  assert.match(live2d, /nativeSession && nativeOverlayReady && !sizeChanged/)
  assert.match(live2d, /function scheduleNativeLayout/)
  assert.match(live2d, /if \(document\.hidden\) return/)
  assert.match(live2d, /tick\(\)/)
  assert.match(live2d, /session\.setPaused\(false\)/)
  assert.match(live2d, /setDesktopWindowBounds/)
  assert.match(live2d, /destroyed\.value = true; enabled\.value = false; destroyRuntime\(\)\s+desktopWindowBounds = null/)
  const companionView = read('src/views/CompanionView.vue')
  const characterStage = read('src/components/ChatCharacterStage.vue')
  assert.match(companionView, /:desktop-window-bounds="desktopWindowBounds"/)
  assert.match(characterStage, /watch\(\(\) => props\.desktopWindowBounds/)
  // 原生接电目标 165fps，不允许默认 60 或 120 上限覆盖。
  assert.match(live2d, /isNative \? 165 : 120/)
  assert.match(backend, /Math\.min\(165,/)
  // 单一情绪时间推进器：sendEmotion 只能出现在 RAF tick，口型回调不推进。
  assert.equal((live2d.match(/sendEmotion/g) || []).length, 1, 'sendEmotion 只允许出现在 nativeEmotionTick')
  // 加载状态必须在 connect 之前显示。
  assert.ok(live2d.indexOf("setState('loading', 'Live2D 加载中…')") < live2d.indexOf('await backend!.connect('), 'loading 必须在 connect 之前设置')
  assert.match(live2d, /onMotionFailed/)
  assert.match(backend, /if \(!destroyed\) callback\(handle\)/)
  assert.match(backend, /bridge\.setMaxFps/)
  assert.match(live2d, /原生 Live2D 初始化失败，已回退到浏览器渲染/)
  assert.doesNotMatch(nativeTypes, /passthrough/)
  assert.match(nativeTypes, /setMaxFps\(fps: number\)/)
})
