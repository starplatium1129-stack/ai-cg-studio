#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use windows_sys::Win32::Foundation::POINT;
use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

const GATEWAY_HOST: &str = "127.0.0.1";
const GATEWAY_PORT: u16 = 3000;
const PROJECT_ROOT: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../..");

struct PocState {
    ignore_mouse_events: AtomicBool,
    gateway_url: &'static str,
}

impl PocState {
    fn new(gateway_url: &'static str) -> Self {
        Self {
            ignore_mouse_events: AtomicBool::new(false),
            gateway_url,
        }
    }
}

fn start_gateway() -> std::process::Child {
    let root = PROJECT_ROOT;
    let runtime = format!("{root}/runtime");
    let _ = std::fs::create_dir_all(format!("{runtime}/state"));
    std::process::Command::new("node")
        .args(["server.js"])
        .current_dir(root)
        .env("PORT", GATEWAY_PORT.to_string())
        .env("AICS_APP_ROOT", root)
        .env("AICS_ASSETS_ROOT", format!("{root}/assets"))
        .env("AICS_TOOLS_ROOT", format!("{root}/tools"))
        .env("AICS_RUNTIME_ROOT", runtime)
        .env(
            "AI_WORKSPACE_ROOT",
            std::env::var("AI_WORKSPACE_ROOT").unwrap_or_else(|_| format!("{root}/AI")),
        )
        .spawn()
        .expect("spawn node gateway failed")
}

fn wait_for_gateway(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if std::net::TcpStream::connect((GATEWAY_HOST, GATEWAY_PORT)).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(300));
    }
    false
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Bounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GlobalMouse {
    x: i32,
    y: i32,
    in_window: bool,
    bounds: Bounds,
}

fn companion_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("companion")
}

fn apply_ignore_mouse_events(app: &AppHandle, state: &PocState, ignore: bool) {
    state.ignore_mouse_events.store(ignore, Ordering::Relaxed);
    if let Some(w) = companion_window(app) {
        let _ = w.set_ignore_cursor_events(ignore);
        let _ = w.emit("poc:interaction-mode", ignore);
    }
}

fn toggle_companion_visibility(app: &AppHandle) {
    if let Some(w) = companion_window(app) {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.emit("poc:shown", ());
        }
    }
}

/// 全局鼠标轮询：约 30fps，坐标变化 >=2px 才发；GetCursorPos 是系统级 API，
/// 窗口穿透/隐藏时依然工作（对应 Electron 版 screen.getCursorScreenPoint）。
fn start_global_mouse_watch(app: AppHandle) {
    thread::spawn(move || {
        let mut last_x = i32::MAX;
        let mut last_y = i32::MAX;
        loop {
            thread::sleep(Duration::from_millis(33));
            let mut pt = POINT { x: 0, y: 0 };
            unsafe {
                if GetCursorPos(&mut pt) == 0 {
                    continue;
                }
            }
            if (pt.x - last_x).abs() < 2 && (pt.y - last_y).abs() < 2 {
                continue;
            }
            last_x = pt.x;
            last_y = pt.y;
            let state = companion_window(&app).and_then(|w| {
                match (w.outer_position().ok(), w.outer_size().ok()) {
                    (Some(p), Some(s)) => Some(GlobalMouse {
                        x: pt.x,
                        y: pt.y,
                        in_window: pt.x >= p.x
                            && pt.x <= p.x + s.width as i32
                            && pt.y >= p.y
                            && pt.y <= p.y + s.height as i32,
                        bounds: Bounds {
                            x: p.x,
                            y: p.y,
                            width: s.width,
                            height: s.height,
                        },
                    }),
                    _ => None,
                }
            });
            if let Some(state) = state {
                let _ = app.emit("poc:global-mouse", state.clone());
                let _ = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(format!("{PROJECT_ROOT}/poc/tauri2/mouse.log"))
                    .and_then(|mut f| {
                        use std::io::Write;
                        f.write_all(
                            format!(
                                "x={} y={} in={}\n",
                                state.x, state.y, state.in_window
                            )
                            .as_bytes(),
                        )
                    });
            }
        }
    });
}

#[tauri::command]
fn poc_get_state(app: AppHandle, state: State<PocState>) -> serde_json::Value {
    let win = companion_window(&app);
    serde_json::json!({
        "alwaysOnTop": win.as_ref().map(|w| w.is_always_on_top().unwrap_or(false)).unwrap_or(false),
        "ignoreMouseEvents": state.ignore_mouse_events.load(Ordering::Relaxed),
        "visible": win.as_ref().map(|w| w.is_visible().unwrap_or(false)).unwrap_or(false),
        "onBatteryPower": false,
        "live2dEnabled": null
    })
}

#[tauri::command]
fn poc_hide(app: AppHandle) {
    if let Some(w) = companion_window(&app) {
        let _ = w.hide();
    }
}

#[tauri::command]
fn poc_quit(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn poc_set_ignore_mouse_events(app: AppHandle, state: State<PocState>, ignore: bool) {
    apply_ignore_mouse_events(&app, &state, ignore);
}

#[tauri::command]
fn poc_toggle_ignore_mouse_events(app: AppHandle, state: State<PocState>) -> bool {
    let next = !state.ignore_mouse_events.load(Ordering::Relaxed);
    apply_ignore_mouse_events(&app, &state, next);
    next
}

#[tauri::command]
fn poc_open_atelier(app: AppHandle, state: State<PocState>, pathname: Option<String>) {
    let path = pathname.unwrap_or_else(|| "/".into());
    let path = if path.starts_with('/') { path } else { format!("/{path}") };
    let url = format!("{}{}", state.gateway_url, path);
    let label = format!(
        "atelier-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    if let Ok(url) = url.parse() {
        if let Err(e) = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url))
            .title("Atelier POC")
            .inner_size(1280.0, 800.0)
            .build()
        {
            eprintln!("atelier open failed: {e}");
        }
    }
}

#[tauri::command]
fn poc_get_workspace() -> serde_json::Value {
    let root = std::env::var("AI_WORKSPACE_ROOT").unwrap_or_else(|_| format!("{PROJECT_ROOT}/AI"));
    serde_json::json!({
        "root": root,
        "exists": std::path::Path::new(&root).exists()
    })
}

#[tauri::command]
fn poc_notify(app: AppHandle, title: String, body: String) {
    use tauri_plugin_notification::NotificationExt;
    let _ = app.notification().builder().title(&title).body(&body).show();
}

#[tauri::command]
fn poc_window_minimize(app: AppHandle) {
    if let Some(w) = companion_window(&app) {
        let _ = w.minimize();
    }
}

const COMPANION_SHIM_JS: &str = r#"
;(() => {
  if (window.companionDesktop || !window.__TAURI__) return
  const invoke = window.__TAURI__.core.invoke
  const listen = window.__TAURI__.event.listen
  let nextId = 0
  const subs = new Map()
  const on = (event, cb) => {
    const id = ++nextId
    listen(event, (e) => cb(e.payload)).then((un) => subs.set(id, un)).catch(() => subs.delete(id))
    return id
  }
  const off = (id) => { const un = subs.get(id); if (un) { try { un() } catch {} }; subs.delete(id) }
  window.companionDesktop = {
    isDesktop: true,
    hide: () => invoke('poc:hide'),
    quit: () => invoke('poc:quit'),
    openAtelier: (pathname = '/') => invoke('poc:open-atelier', { pathname }),
    setIgnoreMouseEvents: (ignore) => invoke('poc:set-ignore-mouse-events', { ignore }),
    setLive2dEnabled: () => Promise.resolve(),
    getState: () => invoke('poc:get-state'),
    toggleAlwaysOnTop: () => Promise.resolve(true),
    getSettings: () => Promise.resolve({ openAtLogin: false }),
    isPackaged: () => Promise.resolve(false),
    setAutostart: () => Promise.resolve(false),
    pickFiles: () => Promise.resolve([]),
    saveImage: () => Promise.resolve({ saved: false }),
    openWorkspace: () => Promise.resolve(true),
    openRuntime: () => Promise.resolve(true),
    openLog: () => Promise.resolve(true),
    getWorkspace: () => invoke('poc:get-workspace'),
    setWorkspace: (root) => invoke('poc:set-workspace', { root }),
    notify: (title, body) => invoke('poc:notify', { title, body }),
    setProgress: () => {},
    runTool: () => Promise.resolve({ ok: false, output: 'unavailable in tauri poc' }),
    onFileDrop: () => 0,
    offFileDrop: () => {},
    onResume: (cb) => on('poc:resume', cb), offResume: off,
    onShown: (cb) => on('poc:shown', cb), offShown: off,
    onVisibilityChanged: (cb) => on('poc:visibility', cb), offVisibilityChanged: off,
    onPowerModeChanged: (cb) => on('poc:power-mode', cb), offPowerModeChanged: off,
    onInteractionModeChanged: (cb) => on('poc:interaction-mode', cb), offInteractionModeChanged: off,
    onClipboardImage: (cb) => on('poc:clipboard-image', cb), offClipboardImage: off,
    onClipboardText: (cb) => on('poc:clipboard-text', cb), offClipboardText: off,
    onGlobalMouse: (cb) => on('poc:global-mouse', cb), offGlobalMouse: off,
    minimizeWindow: () => invoke('poc:window-minimize'),
    toggleMaximizeWindow: () => {},
    closeWindow: () => invoke('poc:hide'),
    getWindowState: () => Promise.resolve({ maximized: false, focused: true }),
    onMaximizedChanged: () => 0,
    offMaximizedChanged: () => {},
  }
})()
"#;

fn main() {
    let gateway_url: &'static str =
        Box::leak(format!("http://{GATEWAY_HOST}:{GATEWAY_PORT}").into_boxed_str());

    tauri::Builder::default()
        .manage(PocState::new(gateway_url))
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    use tauri_plugin_global_shortcut::ShortcutState;
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    // 实测 into_string() 输出：shift+control+KeyP（修饰顺序与键名都是
                    // global_hotkey 的 Code Display，不是输入时的字面量），用宽松匹配。
                    let key = shortcut.to_string();
                    if key.contains("KeyP") {
                        let st = app.state::<PocState>();
                        let next = !st.ignore_mouse_events.load(Ordering::Relaxed);
                        apply_ignore_mouse_events(app, &st, next);
                        eprintln!("[poc] passthrough -> {next}");
                    } else if key.contains("Space") {
                        toggle_companion_visibility(app);
                    }
                })
                .with_shortcuts(["ctrl+shift+p", "ctrl+shift+space"])
                .expect("failed to register shortcuts")
                .build(),
        )
        .setup(move |app| {
            let gateway = start_gateway();
            // PoC：不管理网关生命周期（验证进程能拉起即可）
            std::mem::forget(gateway);
            eprintln!("[poc] gateway spawned, waiting for health...");
            if !wait_for_gateway(Duration::from_secs(30)) {
                eprintln!("[poc] gateway did not come up in 30s");
            }
            eprintln!("[poc] gateway ready at {gateway_url}");

            let companion_url = format!("{gateway_url}/companion");
            WebviewWindowBuilder::new(
                app,
                "companion",
                WebviewUrl::External(
                    companion_url
                        .parse()
                        .expect("companion url must parse"),
                ),
            )
            .title("绫季 Companion (PoC)")
            .inner_size(400.0, 720.0)
            .min_inner_size(360.0, 480.0)
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(false)
            .visible(false)
            .initialization_script(COMPANION_SHIM_JS)
            .build()?;

            // PoC：不等待页面 ready（透明窗口闪烁影响小）；show 后页面自行渲染
            if let Some(win) = app.get_webview_window("companion") {
                let _ = win.show();
                let _ = win.set_focus();
            }

            let handle = app.handle().clone();
            start_global_mouse_watch(handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            poc_get_state,
            poc_hide,
            poc_quit,
            poc_set_ignore_mouse_events,
            poc_toggle_ignore_mouse_events,
            poc_open_atelier,
            poc_get_workspace,
            poc_notify,
            poc_window_minimize,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
