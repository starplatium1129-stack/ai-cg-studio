# Round 7 · ComfyUI Control Lifecycle

## Scope

本轮只扩展控制面板和本地受管生命周期，不改变绘图请求、generation provider、`/api/anima` 工作流或 VRAM 模式的现有选择。

## Architecture

- `managed-comfyui.ps1` 接受 Node 注入的 `AIWorkspaceRoot`、`RuntimeRoot`、`ComfyHost`，只从 `AIWorkspaceRoot\ComfyUI\venv\Scripts\python.exe` 启动 `main.py`。
- `managed-webui.ps1` 同样改为 Node 注入的安装目录、runtime、host、Images 和 ControlNet 路径；端口从经过服务端 loopback 校验的 host 派生，不再固定猜测 7860 或从脚本仓库位置推断工作区。
- 两个脚本都用 PID 文件加完整 command-line ownership 校验；只有 ownership 匹配时才执行 `taskkill /T /F`，外部进程只报告 `external-running`，Stop 不触碰它。
- Start 在脚本侧有界等待健康接口：WebUI `/sdapi/v1/sd-models`，ComfyUI `/system_stats`。操作层 timeout 同步扩大到 120 秒，避免冷启动在 2.5 秒后误报。
- `routes/control.js` 复用既有 `localOnly`、错误信封、PowerShell runner、operation manager 和 watchdog，增加 `comfyOnline`、`comfyManaged`、`comfyHost`、`scripts.comfy` 与 `/api/service/comfy`。
- `managedServices.webui/comfy` 是持久 desired-managed latch。用户显式 Stop 清除 latch；外部启动不会设置 latch；watchdog 只恢复 latch 服务。网关重启后已有 latch 可恢复，但从未启动的服务仍不自动拉起。
- Electron 打包通过 `AICS_SCRIPTS_ROOT` 指向 `app.asar.unpacked/scripts`，同时传入物理 runtime 和 AI workspace。Tauri 网关环境注入物理 `scripts`、可写 runtime 和已保存 workspace，避免 PowerShell 读取 asar 虚拟路径。

## Tests

- `npm run typecheck:app`
- `npm run build:runtime`
- `npm run build`
- `node --test scripts/tests/test-control-failure-contract.js scripts/tests/test-gateway-contract.js scripts/tests/test-service-watchdog.js`
  - 10 tests passed。
  - 覆盖 Comfy start/stop/status HTTP operation contract、显式参数注入、外部进程保护、真实 PowerShell + mock `/system_stats`、operation completion、loopback host 保存/拒绝 SSRF、WebUI/Comfy watchdog semantics。
- `git diff --check`

## Packaging Notes

Electron 的 `desktop/main.ts` 使用既有 `paths.unpackedRoot`、`paths.runtimeRoot`、`paths.aiWorkspaceRoot`；开发模式仍使用源码物理路径。Tauri 通过 `gateway_env` 注入 `AICS_SCRIPTS_ROOT`、`AICS_RUNTIME_ROOT` 和 `AI_WORKSPACE_ROOT`，不新增安装器逻辑。

## Residual Risks

- 当前机器没有 `cargo`，因此未能执行 Tauri native crate 的 `cargo check`；Rust 改动仅为已有 gateway env 调用的路径注入。
- 未启动真实 GPU ComfyUI 或 WebUI；健康等待、PID ownership 和外部保护使用脚本级检查及本地 HTTP/process mock 验证。
- 本阶段仍不自动在 WebUI 与 ComfyUI 之间调度 provider，也不改变 draw/chat 默认渲染器。
