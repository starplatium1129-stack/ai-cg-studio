//! 桌面端自动更新（2026-08-29 产品运营审计 P1：Tauri updater 落地）。
//!
//! 端点与公钥在 tauri.conf.json `plugins.updater`（sidecar 网关固定伺服
//! `/desktop-updates/latest.json`，产物由 scripts/maintenance/release-desktop-update.js
//! 签名发布）。启动时后台检查一次：发现新版本 → 系统通知 + 全局事件
//! `desktop-update-found`；控制面板横幅点击后经 `desktop_update_install`
//! 下载安装并由安装器重启（passive 模式，不弹交互向导）。

use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

/// 启动后台检查一次（静默失败：更新不可达不影响正常使用）。
pub fn spawn_startup_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = notify_if_update_available(&app).await {
            eprintln!("[aics-updater] startup check failed: {error}");
        }
    });
}

async fn notify_if_update_available(app: &AppHandle) -> Result<(), String> {
    let Some(update) = check(app).await? else {
        return Ok(());
    };
    let version = update.version.clone();
    let _ = app.emit("desktop-update-found", version.clone());
    app.notification()
        .builder()
        .title("AI-CG-Studio 有新版本")
        .body(format!("发现 {version}，到控制面板可一键升级。"))
        .show()
        .map_err(|error| error.to_string())?;
    Ok(())
}

async fn check(app: &AppHandle) -> Result<Option<tauri_plugin_updater::Update>, String> {
    app.updater()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())
}

/// 供前端查询当前可用更新（无更新返回 null）。
#[tauri::command]
pub async fn desktop_update_check(app: AppHandle) -> Result<Option<String>, String> {
    let update = check(&app).await?;
    Ok(update.map(|update| update.version))
}

/// 下载并安装更新，安装器结束后自动重启应用（passive 模式）。
#[tauri::command]
pub async fn desktop_update_install(app: AppHandle) -> Result<(), String> {
    let Some(update) = check(&app).await? else {
        return Err("当前已是最新版本".into());
    };
    let version = update.version.clone();
    let _ = app.emit("desktop-update-progress", format!("正在下载 {version}"));
    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|error| error.to_string())?;
    let _ = app.emit("desktop-update-progress", format!("安装完成，正在重启 {version}"));
    app.restart()
}
