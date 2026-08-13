use std::fs;
use std::path::Path;

/// 与 Electron 版 windowState.ts 完全一致的 JSON 文件格式与语义，
/// 保证升级迁移后数据无缝可用。

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WindowBounds {
    pub x: i64,
    pub y: i64,
    pub width: i64,
    pub height: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct CompanionPreferences {
    #[serde(default)]
    pub always_on_top: bool,
    #[serde(default)]
    pub ignore_mouse_events: bool,
    #[serde(default)]
    pub live2d_enabled: Option<bool>,
}

const DEFAULT_BOUNDS: WindowBounds = WindowBounds { x: 24, y: 80, width: 540, height: 760 };

fn is_finite_number(v: &serde_json::Value) -> Option<i64> {
    v.as_f64().filter(|f| f.is_finite()).map(|f| f.round() as i64)
}

pub fn load_window_bounds(file_path: &Path, fallback: Option<&WindowBounds>) -> WindowBounds {
    let fallback = fallback.unwrap_or(&DEFAULT_BOUNDS);
    let Ok(raw) = fs::read_to_string(file_path) else {
        return fallback.clone();
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return fallback.clone();
    };
    let Some(obj) = value.as_object() else { return fallback.clone() };
    let (Some(x), Some(y), Some(width), Some(height)) = (
        obj.get("x").and_then(is_finite_number),
        obj.get("y").and_then(is_finite_number),
        obj.get("width").and_then(is_finite_number),
        obj.get("height").and_then(is_finite_number),
    ) else {
        return fallback.clone();
    };
    WindowBounds { x, y, width, height }
}

pub fn clamp_window_bounds(
    bounds: &WindowBounds,
    work_area: (i64, i64, i64, i64), // (x, y, width, height)
    min_size: Option<(i64, i64)>,    // (minWidth, minHeight)
) -> WindowBounds {
    let (area_x, area_y, area_w, area_h) = work_area;
    let (min_width, min_height) = min_size.unwrap_or((360, 480));
    let width = (bounds.width.min(area_w)).max(min_width.min(area_w));
    let height = (bounds.height.min(area_h)).max(min_height.min(area_h));
    let x = (bounds.x.max(area_x - width + 80)).min(area_x + area_w - 80);
    let y = (bounds.y.max(area_y)).min(area_y + area_h - 80);
    WindowBounds { x, y, width, height }
}

/// 原子写：临时文件 + rename（与 Electron 版一致，防半写损坏）
pub fn save_json_atomic(file_path: &Path, value: &serde_json::Value) {
    let Some(parent) = file_path.parent() else { return };
    let _ = fs::create_dir_all(parent);
    let temporary = file_path.with_extension(format!("{}.{}.tmp", "json", std::process::id()));
    if fs::write(&temporary, serde_json::to_string(value).unwrap_or_default()).is_ok() {
        let _ = fs::rename(&temporary, file_path);
    } else {
        let _ = fs::remove_file(&temporary);
    }
}

pub fn save_window_bounds(file_path: &Path, bounds: &WindowBounds) {
    save_json_atomic(
        file_path,
        &serde_json::json!({ "x": bounds.x, "y": bounds.y, "width": bounds.width, "height": bounds.height }),
    );
}

/// Convert Tauri's physical client-area measurements to Electron-compatible DIP values.
pub fn physical_to_logical_bounds(bounds: &WindowBounds, scale_factor: f64) -> WindowBounds {
    let scale_factor = if scale_factor.is_finite() && scale_factor > 0.0 { scale_factor } else { 1.0 };
    WindowBounds {
        x: (bounds.x as f64 / scale_factor).round() as i64,
        y: (bounds.y as f64 / scale_factor).round() as i64,
        width: (bounds.width as f64 / scale_factor).round() as i64,
        height: (bounds.height as f64 / scale_factor).round() as i64,
    }
}

pub fn load_companion_preferences(file_path: &Path) -> CompanionPreferences {
    let Ok(raw) = fs::read_to_string(file_path) else {
        return CompanionPreferences::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn save_companion_preferences(file_path: &Path, preferences: &CompanionPreferences) {
    save_json_atomic(
        file_path,
        &serde_json::json!({
            "alwaysOnTop": preferences.always_on_top,
            "ignoreMouseEvents": preferences.ignore_mouse_events,
            "live2dEnabled": preferences.live2d_enabled,
        }),
    );
}

pub fn load_desktop_gateway_port(file_path: &Path, fallback: u16) -> u16 {
    let Ok(raw) = fs::read_to_string(file_path) else {
        return fallback;
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return fallback;
    };
    value
        .as_object()
        .and_then(|o| o.get("port").and_then(|v| v.as_u64()))
        .filter(|p| (1024..=65_535).contains(p))
        .map(|p| p as u16)
        .unwrap_or(fallback)
}

pub fn save_desktop_gateway_port(file_path: &Path, port: u16) {
    if !(1024..=65_535).contains(&port) {
        return;
    }
    save_json_atomic(file_path, &serde_json::json!({ "port": port }));
}

pub fn load_ai_workspace(file_path: &Path) -> String {
    let Ok(raw) = fs::read_to_string(file_path) else {
        return String::new();
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return String::new();
    };
    let root = value
        .as_object()
        .and_then(|o| o.get("root"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if root.trim().is_empty() {
        return String::new();
    }
    let resolved = std::path::absolute(root.trim())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| root.trim().to_string());
    if Path::new(&resolved).is_dir() {
        resolved
    } else {
        String::new()
    }
}

pub fn save_ai_workspace(file_path: &Path, root: &str) -> bool {
    let Ok(resolved) = std::path::absolute(root) else {
        return false;
    };
    if !resolved.is_dir() {
        return false;
    }
    save_json_atomic(file_path, &serde_json::json!({ "root": resolved }));
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_window_bounds() {
        let tmp = std::env::temp_dir().join(format!("aics-ws-test-{}", std::process::id()));
        let file = tmp.join("window.json");
        let bounds = WindowBounds { x: 120, y: 80, width: 540, height: 760 };
        save_window_bounds(&file, &bounds);
        let loaded = load_window_bounds(&file, None);
        assert_eq!(loaded.x, 120);
        assert_eq!(loaded.height, 760);
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn clamp_keeps_window_on_screen() {
        // 窗口比工作区大时收缩到工作区宽度（Electron 语义）
        let clamped = clamp_window_bounds(
            &WindowBounds { x: -500, y: -500, width: 4000, height: 3000 },
            (0, 0, 1920, 1080),
            None,
        );
        assert_eq!(clamped.width, 1920);
        assert_eq!(clamped.height, 1080);
        // 允许部分出屏但至少留 80px 可抓取（与 Electron clampWindowBounds 一致）
        assert!(clamped.x + clamped.width > 80);
        assert!(clamped.y + clamped.height > 80);
        // 正常工作区内的窗口位置保留
        let clamped2 = clamp_window_bounds(
            &WindowBounds { x: 100, y: 100, width: 540, height: 760 },
            (0, 0, 1920, 1080),
            None,
        );
        assert_eq!(clamped2.x, 100);
        assert_eq!(clamped2.y, 100);
    }

    #[test]
    fn corrupt_json_falls_back() {
        let tmp = std::env::temp_dir().join(format!("aics-ws-test2-{}", std::process::id()));
        let file = tmp.join("window.json");
        fs::create_dir_all(&tmp).unwrap();
        fs::write(&file, "{corrupt").unwrap();
        let loaded = load_window_bounds(&file, None);
        assert_eq!(loaded.x, DEFAULT_BOUNDS.x);
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn workspace_round_trip() {
        let tmp = std::env::temp_dir().join(format!("aics-ws-test3-{}", std::process::id()));
        let file = tmp.join("ai-workspace.json");
        fs::create_dir_all(&tmp).unwrap();
        assert!(save_ai_workspace(&file, tmp.to_str().unwrap()));
        assert_eq!(load_ai_workspace(&file), std::path::absolute(&tmp).unwrap().to_string_lossy());
        // 不存在目录拒绝
        assert!(!save_ai_workspace(&file, "Z:/definitely/not/a/dir"));
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn physical_bounds_convert_to_logical_dips() {
        let physical = WindowBounds { x: -1500, y: 75, width: 1200, height: 900 };
        let logical = physical_to_logical_bounds(&physical, 1.5);
        assert_eq!(logical.x, -1000);
        assert_eq!(logical.y, 50);
        assert_eq!(logical.width, 800);
        assert_eq!(logical.height, 600);
    }

    #[test]
    fn invalid_scale_factor_is_treated_as_one() {
        let bounds = WindowBounds { x: 10, y: 20, width: 30, height: 40 };
        assert_eq!(physical_to_logical_bounds(&bounds, 0.0).width, 30);
        assert_eq!(physical_to_logical_bounds(&bounds, f64::NAN).height, 40);
    }
}
