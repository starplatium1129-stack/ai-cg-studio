# 桌面端 node.exe 控制台黑窗

> 日期：2026-08-15 · 状态：已解决 · 涉及：desktop-tauri gateway.rs、打包流程

## 现象

- 打开 AI-CG-Studio 桌面端（Tauri 壳）时，弹出 node.exe 黑色控制台窗口（内置网关 sidecar 进程）。
- 用户此前请人修过一次（提交 CREATE_NO_WINDOW 代码），但**重新打开应用黑窗依旧**。

## 根因

1. GUI 应用（`windows_subsystem=windows`）用 `std::process::Command` 派生控制台子进程时，不指定标志会为 node.exe **新建一个可见控制台窗口**；须加 `CREATE_NO_WINDOW`（`creation_flags(0x0800_0000)`）让网关后台无窗口运行（stdout/stderr 仍经 pipe 回传）。
2. 修复代码（commit `b289c8d`，`gateway.rs` GatewaySupervisor::start）**已提交但从未重新打包**：安装目录的 `ai-cg-studio-desktop.exe` 仍是旧构建（21:40），所以黑窗依旧。

## 修复

1. 确认 `gateway.rs` 的 `Command::new(&node)` 已设 `#[cfg(windows)] command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW`（唯一 spawn 路径）。
2. **完整重新打包安装**（quick deploy 只覆盖前端/数据，Rust 壳改动必须走全量）：
   `npm run build` → `npm run build:tauri` → `npm run package:tauri` → `setup.exe /S`（静默安装）→ 清理旧 sidecar 3123。
3. 安装包同时带上本轮全部前端修复与新数据（35 角色含舟游、立绘框修复）。

## 验证

- 安装后启动桌面端：枚举可见窗口，**无 node.exe 控制台窗口**（sidecar 进程存在但无窗口）；3123 网关正常服务。
- 用户确认：黑窗消失。

## 经验

- **改 Rust 壳 / 后端 `server.js`/`services` 必须完整打包安装**，quick deploy 只管 dist/data/assets（AGENTS.md 桌面部署章节）。
- 排查「改了代码没生效」先查安装目录 exe 时间戳与代码提交时间是否一致。
