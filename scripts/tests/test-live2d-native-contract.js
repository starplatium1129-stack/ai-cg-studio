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
  assert.match(shim, /entry\.cancelled/)
  assert.match(shim, /return id/)
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
  // 跨线程穿透必须走系统级 SetWindowRgn 剪裁；HTTRANSPARENT 只对同线程窗口
  // 生效（微软 WM_NCHITTEST 文档），overlay 与 WebView2 不同线程，禁止回退。
  assert.match(overlay, /SetWindowRgn/)
  assert.doesNotMatch(overlay, /return HTTRANSPARENT/)
  assert.match(overlay, /relative_to_window\(bounds, window_rect\)/)
  assert.doesNotMatch(overlay, /SetWindowRgn\(hwnd,\s*std::ptr::null_mut\(\)/)
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
  for (const field of ['active', 'rect', 'visible', 'frameCount', 'targetFps', 'character', 'ready', 'windowReady', 'rendererAttached', 'modelBounds', 'passthroughCount', 'mouthLevel', 'mouthMappedValue']) {
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
  assert.match(bridge, /on_battery_power\(\)/)
  assert.doesNotMatch(main, /app\.manage\(state\.paths\.clone\(\)\)/)
})

test('Native frontend lifecycle forwards reset, bounds, FPS and emotion ticks', () => {
  const live2d = read('src/composables/useLive2D.ts')
  const backend = read('src/live2d/nativeBackend.ts')
  const nativeTypes = read('src/types/live2dNative.ts')

  assert.match(live2d, /session\?\.sendMouthLevel\?\.\(0\)/)
  assert.match(live2d, /requestAnimationFrame\(nativeEmotionTick\)/)
  assert.match(live2d, /session\.updateOverlay\(overlayRect, true, passthrough\)/)
  assert.match(live2d, /setDesktopWindowBounds/)
  // 原生接电目标 165fps，不允许默认 60 或 120 上限覆盖。
  assert.match(live2d, /isNative \? 165 : 120/)
  assert.match(backend, /Math\.min\(165,/)
  // 单一情绪时间推进器：sendEmotion 只能出现在 RAF tick，口型回调不推进。
  assert.equal((live2d.match(/sendEmotion/g) || []).length, 1, 'sendEmotion 只允许出现在 nativeEmotionTick')
  // 加载状态必须在 connect 之前显示。
  assert.ok(live2d.indexOf("setState('loading', 'Live2D 加载中…')") < live2d.indexOf('await backend!.connect('), 'loading 必须在 connect 之前设置')
  assert.match(live2d, /onMotionFailed/)
  assert.match(backend, /subscriptions\.push\(subscriptionId\)/)
  assert.match(backend, /bridge\.setMaxFps/)
  assert.match(nativeTypes, /passthrough\?: Live2DOverlayRect\[\]/)
  assert.match(nativeTypes, /setMaxFps\(fps: number\)/)
})
