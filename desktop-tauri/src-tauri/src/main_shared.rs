use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::paths::DesktopPaths;
use crate::state::AppState;
use crate::window_state::{clamp_window_bounds, load_window_bounds, save_window_bounds, WindowBounds};

/// 规范化 Atelier 目标路径（与 deepLink.ts normalizeAtelierPath 同规则，容忍尾斜杠）
pub fn normalize_atelier_path(value: Option<&str>) -> String {
    match value {
        Some(v) => {
            let v = v.trim_end_matches('/');
            if v.starts_with('/') && v.len() > 1 && v[1..].chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
                v.to_string()
            } else {
                "/".to_string()
            }
        }
        _ => "/".to_string(),
    }
}

pub fn companion_bounds(state: &AppState) -> WindowBounds {
    let saved = load_window_bounds(&state.paths.companion_window_file, None);
    let area = primary_work_area();
    clamp_window_bounds(&saved, area, None)
}

pub fn atelier_bounds(state: &AppState) -> WindowBounds {
    let fallback = WindowBounds { x: 120, y: 72, width: 1440, height: 960 };
    let saved = load_window_bounds(&state.paths.atelier_window_file, Some(&fallback));
    let area = primary_work_area();
    clamp_window_bounds(&saved, area, Some((1024, 720)))
}

pub fn primary_work_area() -> (i64, i64, i64, i64) {
    unsafe {
        let x = windows_sys::Win32::UI::WindowsAndMessaging::GetSystemMetrics(76) as i64;
        let y = windows_sys::Win32::UI::WindowsAndMessaging::GetSystemMetrics(77) as i64;
        let w = windows_sys::Win32::UI::WindowsAndMessaging::GetSystemMetrics(78) as i64;
        let h = windows_sys::Win32::UI::WindowsAndMessaging::GetSystemMetrics(79) as i64;
        (x, y, w, h)
    }
}

pub fn show_companion(app: &AppHandle, focus: bool) {
    let Some(w) = app.get_webview_window("companion") else { return };
    let was_visible = w.is_visible().unwrap_or(false);
    if focus {
        let _ = w.show();
        let _ = w.set_focus();
    } else {
        let _ = w.show();
    }
    if !was_visible {
        let _ = w.emit("aics:shown", ());
        let _ = w.emit("aics:visibility", true);
    }
}

pub fn hide_companion(app: &AppHandle) {
    let Some(w) = app.get_webview_window("companion") else { return };
    let was_visible = w.is_visible().unwrap_or(false);
    let _ = w.hide();
    if was_visible {
        let _ = w.emit("aics:visibility", false);
    }
}

pub fn toggle_companion_visibility(app: &AppHandle) {
    let Some(w) = app.get_webview_window("companion") else { return };
    if w.is_visible().unwrap_or(false) {
        hide_companion(app);
    } else {
        show_companion(app, true);
    }
}

pub fn open_atelier(app: &AppHandle, gateway_url: &str, target: Option<&str>) {
    let pathname = normalize_atelier_path(target);
    // gateway_url 尚未就绪时回退到默认端口（窗口创建路径在网关 ready 后才执行）
    let base = if gateway_url.is_empty() {
        "http://127.0.0.1:3000".to_string()
    } else {
        gateway_url.to_string()
    };
    if let Some(w) = app.get_webview_window("atelier") {
        let _ = w.show();
        let _ = w.set_focus();
        let url = format!("{base}{pathname}");
        if let Ok(parsed) = url.parse() {
            let _ = w.navigate(parsed);
        }
        return;
    }
    let state = app.state::<AppState>();
    let bounds = atelier_bounds(&state);
    let url = format!("{base}{pathname}");
    // 窗口创建不能发生在主线程的 IPC 回调内：WebView2 环境创建需要消息泵，
    // 同步等待会阻塞主线程消息循环，导致后续所有 invoke 超时。
    // 放到 tokio 线程执行（wry 在 Windows 允许非主线程创建窗口）。
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let parsed = match url.parse::<tauri::Url>() {
            Ok(u) => u,
            Err(e) => {
                state.error(&format!("open atelier: bad url {url}: {e}"));
                return;
            }
        };
        match WebviewWindowBuilder::new(&app, "atelier", WebviewUrl::External(parsed))
            .title("绫季绘境 Atelier")
            .inner_size(bounds.width as f64, bounds.height as f64)
            .position(bounds.x as f64, bounds.y as f64)
            .min_inner_size(1024.0, 720.0)
            .decorations(false)
            .visible(false)
            .initialization_script(crate::shim::COMPANION_SHIM_JS)
            .build()
        {
            Ok(win) => {
                state.info("open atelier: window built");
                let show_result = win.show();
                let focus_result = win.set_focus();
                state.info(&format!(
                    "open atelier: show={show_result:?} focus={focus_result:?} visible={}",
                    win.is_visible().unwrap_or(false)
                ));
            }
            Err(e) => state.error(&format!("open atelier: window build failed: {e}")),
        }
    });
}

pub fn create_companion_window(app: &AppHandle, gateway_url: &str, shim: &str, show_on_start: bool) -> tauri::Result<()> {
    let state = app.state::<AppState>();
    let bounds = companion_bounds(&state);
    let url = format!("{gateway_url}/companion");
    let parsed = url.parse::<tauri::Url>().expect("companion url must parse");
    let win = WebviewWindowBuilder::new(app, "companion", WebviewUrl::External(parsed))
        .title("绫季 Companion")
        .inner_size(bounds.width as f64, bounds.height as f64)
        .position(bounds.x as f64, bounds.y as f64)
        .min_inner_size(360.0, 480.0)
        .transparent(true)
        .decorations(false)
        .always_on_top(state.preferences.lock().unwrap().always_on_top)
        .skip_taskbar(true)
        .shadow(false)
        .visible(false)
        .initialization_script(shim)
        .build()?;
    if show_on_start {
        let _ = win.show();
        let _ = win.emit("aics:shown", ());
        let _ = win.emit("aics:visibility", true);
    }
    if let Some(bounds) = webview_bounds(&win) {
        let _ = win.emit("aics:window-bounds", bounds);
    }
    Ok(())
}

fn webview_bounds(w: &tauri::WebviewWindow) -> Option<WindowBounds> {
    let p = w.outer_position().ok()?;
    let s = w.outer_size().ok()?;
    Some(WindowBounds { x: p.x as i64, y: p.y as i64, width: s.width as i64, height: s.height as i64 })
}

pub fn companion_window_bounds(app: &AppHandle) -> Option<WindowBounds> {
    app.get_webview_window("companion").and_then(|w| webview_bounds(&w))
}

pub fn persist_window_bounds(app: &AppHandle) {
    let state = app.state::<AppState>();
    if let Some(w) = app.get_webview_window("companion") {
        if let Some(bounds) = webview_bounds(&w) {
            save_window_bounds(&state.paths.companion_window_file, &bounds);
            let _ = w.emit("aics:window-bounds", bounds);
        }
    }
    if let Some(w) = app.get_webview_window("atelier") {
        if let Ok(p) = w.outer_position() {
            if let Ok(s) = w.outer_size() {
                save_window_bounds(
                    &state.paths.atelier_window_file,
                    &WindowBounds { x: p.x as i64, y: p.y as i64, width: s.width as i64, height: s.height as i64 },
                );
            }
        }
    }
}

pub fn gateway_env(paths: &DesktopPaths, is_packaged: bool) -> Vec<(String, String)> {
    let mut env = vec![
        ("AICS_APP_ROOT".into(), paths.app_root.to_string_lossy().to_string()),
        ("AICS_ASSETS_ROOT".into(), paths.assets_root.to_string_lossy().to_string()),
        ("AICS_TOOLS_ROOT".into(), paths.tools_root.to_string_lossy().to_string()),
        ("AICS_RUNTIME_ROOT".into(), paths.runtime_root.to_string_lossy().to_string()),
    ];
    if is_packaged {
        env.push(("AICS_DESKTOP_PACKAGED".into(), "1".into()));
    }
    env
}
