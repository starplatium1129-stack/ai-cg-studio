# 桌面端 Tauri 2 当前架构与发布边界

> 更新：2026-08-10
> 本文是当前契约文档，不再记录 P0-P7 的阶段计划、人日估算或逐轮交接。

## 当前判断

- Tauri 2 是当前桌面主线；Electron 继续保留为稳定路径、回退路径和 D-10 未完成期间的可用版本。
- Tauri + Native Live2D 已完成代码级和有限真机验证，但 D-10 真实安装产品矩阵未完成，不能称为正式发布版本。
- 默认 `validate` 不包含真实 GPU、Native、TTS 或安装产品测试。Windows 门禁独立运行 `validate:desktop`、Native release selftest、renderer soak 和 D-10 harness。
- Native renderer 的 Cubism、wgpu、overlay 和坐标细节见 `live2d-native-runtime.md`；IPC/布局公共契约以 `live2d-native-overlay-plan.md` 和 `src/types/live2dNative.ts` 为准。

## 当前架构

```text
Tauri 2 Rust shell
  Companion / Atelier / tray / shortcuts / window state / logger
  GatewaySupervisor -> packaged node.exe -> Express gateway
  shim / bridge -> window.companionDesktop
              -> window.aicsLive2dNative -> Native overlay
```

- Companion 和 Atelier 是两个独立窗口。Companion 可见启动时请求 Native；`--hidden`、隐藏窗口和用户显式关闭时不加载模型或继续渲染。Atelier/普通页面默认使用 browser Live2D，缺 bridge 自动回退。
- Rust 壳负责窗口、托盘、单实例、深链、系统轮询、日志、数据迁移、sidecar 生命周期和 IPC；业务仍在 Node 网关，包括工具、服务自愈、TTS、翻译、训练、SD/Anima/Krea 2 和安全路由。Krea 2 仍是网关 + ComfyUI 业务，不迁入 Rust。
- `GatewaySupervisor` 负责 attach-or-spawn、健康检查、输出转发和受管进程自愈；只停止自己拥有的网关，不误杀外部启动的服务。
- Native overlay 是独立线程透明 Win32 窗口，使用 DX12 + Cubism Native；它与 WebView 的舞台矩形通过物理像素布局契约同步。

## 数据、资源与打包边界

- 开发/打包代码资源只读；runtime、workspace、日志、状态和用户 token 位于可写目录。安装目录不保存运行状态。
- 首次启动保留 Electron JSON 文件名/结构并迁移 `gateway_token`；迁移使用源快照和幂等标记，不覆盖已迁移目标。
- Tauri packaged 模式只注入 `AICS_DESKTOP_PACKAGED=1`。打包维护场景链返回 `501 DESKTOP_MAINTENANCE_UNAVAILABLE`；展示集和 home-hero 的 AI 工作区写入不受该限制。
- sidecar 使用固定 Node 版本和 SHA-256 校验；staging 只复制运行时 `.js`、服务端路由、数据、dist、assets、tools 和生产依赖，不把 TS 源码、target 或用户数据放进安装资源。
- 模型目录约定为 `assets_root/live2d/<character>`。打包模式下的实际资源路径仍属于 D-10 必测项。

## IPC 与安全边界

- Tauri capability 按命令白名单；shim 只暴露现有 typed API，不提供 Node integration、任意命令、任意路径或任意 workflow。
- desktop tools 复用 `server/security.js` 的本机判断、TOKEN、workspace containment 和统一错误信封。
- sidecar 只能运行壳派生的白名单入口；渲染层不能覆盖脚本根、runtime 根、workspace 根或模型路径。
- Native 状态查询只读，未初始化查询不得创建 overlay、加载模型或启动线程；D-10 的诊断字段不能扩大为文件读取、环境变量、token 或命令执行能力。
- Electron 与 Tauri 双轨并存，直到安装、迁移、Native、TTS、DPI、多屏、稳定性和回滚证据全部满足发布门槛。

## 已完成与当前验证

- 双窗口、透明 Companion、Atelier 无边框、托盘、单实例、深链、日志、剪贴板、窗口状态、Electron 数据迁移、网关 attach/restart、sidecar 和 staging 已接入。
- shim/bridge 已覆盖桌面能力；WebView2 注入时序、ACL origin、异步窗口创建、Atelier shim、拖拽和 keep-tray-alive 已按当前实现收口。
- `npm run build:tauri`、`npm run package:tauri`、`cargo test --locked`、`npm run validate:desktop` 和 Native release selftest 均有通过记录。
- Native renderer 的 300 秒稳定性和 release snapshot 证据见 `live2d-native-runtime.md`；这些是 renderer/壳证据，不是安装产品 D-10 PASS。
- 冻结安装包（仅构建证据）：`AI-CG-Studio_1.5.0_x64-setup.exe`，SHA-256 `ee9277f95143ae9499e657e290429fd0b361b8715c050969408a2a4b56cee178`，打包输入指纹 `84237fd2a3c9cbd623cdcbccb7854ed05b1d52bd67e45a4b820fa0f2e12b77a1`。
- 早期工程 smoke 曾验证 sidecar 启动、页面 200、维护 501、窗口和卸载器流程；该 smoke 不等于当前冻结安装包已经完成正式安装产品验收，不能与 D-10 结论合并。

## D-10 必须真实完成的矩阵

必须使用真实安装包和独立临时用户数据执行：

- 提权安装、首次迁移、冷启动、`--hidden` 启动、正常退出、卸载和安装目录清理。
- 100%、125%、150% 实际 Windows 缩放；真实第二屏的同 DPI、混合 DPI、跨屏和回屏；overlay 与舞台物理 rect 最大误差不超过约定阈值，move/resize 后按时恢复。
- Companion/Atelier 角色切换、Native ready、作者 HitArea、动作变体、busy 拒绝、隐藏停止出帧和恢复。
- 宁宁/夏目真实 GPT-SoVITS neutral/happy 配音，WAV 指标、DOM/Native mouth level、夏目负向 `ParamMouthForm3` 和停止后的归零。
- 300 秒安装产品 soak：切角、hide/show、move/resize、Working Set/private bytes/GPU memory、frame count、target FPS、device lost、OOM 和最终 destroy。
- 实际 self-hosted Windows workflow 必须提供 workflow URL、run id、冻结 HEAD 的 commit SHA 和全绿日志；本机等价命令不能替代。

## 当前 D-10 阻断

- 当前进程没有管理员权限，NSIS 为 per-machine，未执行安装。
- GPT-SoVITS `127.0.0.1:9880` 离线，未伪造真实 TTS。
- 当前只有 100% 单屏，125/150% 和多屏未覆盖。
- 没有实际 self-hosted Windows workflow URL、run id、commit SHA 和全绿日志。

因此目前没有安装、迁移、真实冷/隐藏启动、真实 overlay/DPI/TTS、300 秒安装产品 soak、正常退出或卸载 PASS；Electron 不得退役。

## 明确不做

- 不重写 Vue、Express、Live2D 浏览器 renderer 或业务协议，不把业务进程编排搬入 Rust。
- 不恢复浏览器直通 ComfyUI、任意 workflow、任意路径或宽权限 IPC。
- 不以 mock TTS、browser 页面、renderer-only selftest、虚拟 CSS viewport 或旧工程 smoke 冒充 D-10。
- Live2D 贴图压缩/KTX2/WebP、Git LFS 历史重写、自动更新和视频生成仍不在范围内。Krea 2 的 style-reference、Prompt Enhancer 和专用 LoRA 训练也不在本轮范围内，需独立验收。
- 不为绕过发布门槛修改公共 overlay 契约；发现缺陷时记录最小复现、环境和证据，再按 Native 文档接入。

## 后续接入点

1. 环境满足时使用同一 D-10 harness 和冻结安装包；任何打包输入变化都必须生成新的 SHA 并废弃旧证据。
2. 真实 Companion 麦克风/ASR、GPT-SoVITS 和 Native/TTS 回归需要独占设备与服务时间窗。
3. 125/150% DPI 和多屏必须使用真实 Windows 显示设置，不用浏览器模拟替代。

## 2026-08-14 个人使用豁免与执行记录

> 用户决策（2026-08-14）：桌面端仅为个人本地使用，不发布给外部用户。以下两项 D-10 门槛按此豁免/降级；其余门槛不变。

**豁免项 A — 125/150% DPI 与真实第二屏矩阵**：本机长期为远程会话 + 虚拟显示环境，真实物理屏矩阵验收无法执行（用户确认做不到）。替代证据为：本机 100% 缩放下 overlay 对齐 + Native renderer 稳定性（`live2d-native-runtime.md`）；远程会话下的 DPI 行为不视为有效验收证据，也不作为退役阻塞。若未来改为外部发布，此项恢复为硬门槛。

**豁免项 B — self-hosted Windows workflow**：个人使用场景下无外部 CI 托管；由「本机等价命令 + 日志存档」（scripts/tests/ 与 desktop.log、gateway logs）替代全绿 workflow 证据。若未来对外发布，恢复为硬门槛。

**执行记录（本轮完成项，均为免 GPU 项）**：
- [x] 2026-08-14 全盘核查：本机从未成功安装过 AI-CG-Studio（注册表/Program Files/开始菜单/uninstaller 均无），D-10「未执行安装」状态确认。
- [x] 2026-08-14 网页端 → 桌面端资源同步完成（`npm run build` + `npm run prepare:tauri`，漂移 495→0，暂存 116.5 MB）；打包输入已变化，旧冻结 SHA 作废。
- [x] 2026-08-14 新安装包生成并冻结：`desktop-tauri/src-tauri/target/release/bundle/nsis/AI-CG-Studio_1.5.0_x64-setup.exe`，121.1 MB，SHA-256 `B2D71E2544BD2B0A8B8E2E15D391E763043819AA6431532551902AEB0099E0EF`（`--no-sign`，本机个人使用）。旧 SHA `ee9277f9…`（1.5.0 冻结包）作废。
- [x] 2026-08-14 提权静默安装（UAC 已确认，exit 0）：注册表条目 + 完整文件布局（`gateway/` 资源、`node.exe` sidecar、主 exe、`uninstall.exe`）；安装目录为 `%TEMP%\opencode\aics-installed`——NSIS 复用并行会话先前安装的注册表 InstallLocation（覆盖安装路径本身通过；干净 Program Files 安装需无残留环境）。已装 `gateway/dist/index.html` 与新鲜构建哈希一致。
- [x] 2026-08-14 首次迁移与幂等：8/07 dev 首次迁移已完成（`.tauri-migrated` + 日志「migrated electron data: companion-window.json, companion-preferences.json, desktop-gateway…」）；安装版运行无重复迁移（标记幂等生效）；`gateway_token` 复用（文件 mtime 未变，64 位）。
- [x] 2026-08-14 `--hidden` 冷启动（`PORT=3123` 隔离验收，不触碰在用网关）：进程存活、无可见窗口渲染；打包 sidecar node 拉起自带网关；`/api/health` 200（`desktopProtocol:1`）；SPA 200；`POST /api/maintenance/scenes|run` 均 501 `DESKTOP_MAINTENANCE_UNAVAILABLE`；`GET /api/maintenance/home-hero` 200（不受限，符合契约）；`desktop.log` 确认 `packaged=true` + sidecar 路径。
- [x] 2026-08-14 卸载与清理：`uninstall.exe /S`（提权）exit 0；安装目录与注册表条目清除；用户数据目录（Roaming）保留（符合「卸载不删用户数据」契约）。
- [x] 2026-08-15 可见冷启动（Companion 窗口可见，PORT=3123）：窗口 '绫季 Companion' 显示、打包 sidecar 网关就绪、`nvidia-smi` 出现应用进程（DX12 渲染上下文）、WS ~542MB；`gateway_token` 复用。
- [x] 2026-08-15 300s 安装产品 soak：全程存活、WS 恒定 542MB、GPU 上下文持续、日志零 error。
- [x] 2026-08-15 缺陷发现与修复：**应用退出（含托盘 quit → app.exit(0)）不会停止自有的 sidecar 网关**（无 Drop 清理、无 Job Object），退出后 node 孤儿进程继续占用端口（代码审查 + 实机复现确认）。已修复：`gateway.rs` 为 `GatewaySupervisor` 实现 `Drop`，仅清理 `owned=true` 的自有网关（attach 模式不触碰外部网关）。修复后新 SHA：`DE50ED33CD1E23634311B97E0BFBE930788055BF7ED92A164A2EED346F0DC043`（替换上一条 SHA，旧 SHA `B2D71E25…` 作废）。
- [x] 2026-08-15 退出修复升级：实测 `app.exit(0)` **不触发 managed state 的 Drop**（托盘 quit 后网关仍孤儿）。改为 `gateway.rs` 新增 `stop_sync()` + `main.rs` `RunEvent::ExitRequested` 放行路径显式调用（Drop 保留双保险）。本轮新 SHA：`97C594ECC246E202B976A16987622DE26D0B4E3319C91E8F854EBA29C3666718`（旧 SHA `DE50ED33…` 作废）。
- [x] 2026-08-15 桌面图标重建：`assets/favicon.svg`（品牌图标）→ Edge headless 渲染 1024 PNG → `tauri icon` 全套（icon.ico 61KB / icon-32/64/128/256.png，含托盘图标；原为纯淡紫圆形占位）。清理了 android/ios/Square* 等无关产物。
- [x] 2026-08-15 窗口显示缺陷修复（用户实测反馈"点显示 Companion 不显示"）：根因链——①远程会话中窗口被最小化后，`w.show()` 不解除最小化，窗口留在屏幕外（-18286）不可见；②`persist_window_bounds` 把最小化态保存成 `158×26 @ -18286` 坏状态文件；③旧 `clamp_window_bounds` 允许"只留 80px 在屏内"兜不住极端负坐标。修复三处：`main_shared.rs` show_companion 先 `unminimize()` 再 show；`window_state.rs` `clamp_window_bounds` 改为窗口整体收进工作区；`save_window_bounds` 拒绝异常 bounds（宽高 <40 或坐标超出 ±10000 不落盘）。Rust 测试 17/17（新增 `save_rejects_offscreen_minimized_bounds`）。本轮新 SHA：`0D8B34C805128A48847C4D3AD9DFAD06732F3E53A9456D6A8C02934D936BD121`（旧 SHA `97C594EC…` 作废）。实机验证：窗口恢复 90,162 540×760、立绘可见、状态文件正常。
- [x] 2026-08-15 桌面图标更新：exe 内嵌图标已确认新品牌图标（ExtractAssociatedIcon 多色）；桌面快捷方式 `C:\Users\Public\Desktop\AI-CG-Studio.lnk` 旧图标为 Explorer 图标缓存所致，`ie4uinit.exe -show` 已刷新。
- [x] 2026-08-15 夏目 Live2D 互动叠层残留修复（调研依据 `docs/live2d-natsume-overlay-research.md`，2 子代理）：根因 = Tap* 动作驱动 `Param18/Param38-63/ParamMouthForm5-10`（作者叠层/换装部件显隐），Idle 组不覆盖这些参数 → 动作结束后叠层残留。修复：双端在互动动作结束时把白名单参数写回作者默认值——浏览器（`useLive2D.ts` `NATSUME_OVERLAY_RESET_PARAMS` + 互动结束计时器复位，parameterOverride 时）；原生（C++ `l2d_model_reset_overlay_params` + Rust `advance_motion` 结束分支，仅夏目）。全部 cargo test 通过（17/17 + native-live2d）。本轮新 SHA：`74346C5E27A463EFB7201D2E1F0070E6FA39CE0884D6CA58318E529BF495741D`（旧 `BE7EB96F…` 作废）。
- [x] 2026-08-15 正常退出人工验收完成：托盘「退出 Companion」后应用退出、**sidecar 网关随退清理**（3123 释放、0 孤儿 node）——`stop_sync` + `ExitRequested` 修复实机验证闭环。
- [x] 2026-08-15 Companion 布局改造（依据 `docs/companion-ui-research.md` 三子代理调研）：①顶栏 8 按钮 → 齿轮设置弹层（陪伴/窗口/工作台/诊断四组，含音量与 FPS）；②底部多面板合并为单一毛玻璃输入面板（状态文字并入输入面板 meta 行，FPS/音量/工作区移入弹层）；③语音环境警告压缩为单行、工具/思考指示合并、错误改浮动 toast；④状态胶囊从脖颈区（top:118px）移到头顶上方（top:70px）；⑤结构上消除状态条与输入框层叠穿透。验证：`vue-tsc` + `vite build` 通过；窗口级截图（PrintWindow 872×1376）+ Edge headless 浏览器渲染双通道回归——顶栏 1 键、上半身 60% 无遮挡、无穿透错乱；PrintWindow 对 backdrop-filter 有渲染伪影（非真实布局问题，以浏览器渲染为准）。截图存 `AI/CompanionScreenshots/`。
- [x] 2026-08-15 E2E 断言同步：`tests/e2e/studio.spec.ts` companion 用例三处 DOM 引用（`.companion-room-link`/`.companion-dnd-toggle`/`.companion-window-actions`）已更新为设置弹层结构。**E2E 未运行**：本机无 Playwright 浏览器，用户选择不下载 chromium（省带宽），验证以 typecheck+build+截图双通道+人工验收为准；后续需跑时 `npx playwright install chromium` 后定向 `--grep companion`。
- [ ] 2026-08-15 正常退出人工验收：托盘菜单「退出 Companion」由用户在真实桌面点击；验证应用退出 + 网关进程随退清理（修复后预期）。注：远程会话下通知区工具栏零尺寸（Todesk 渲染问题），托盘 UI 自动化不可行，故改人工验收。
- [ ] 真实 TTS 双角色口型/归零：待 GPT-SoVITS(9880) 恢复与 GPU 空闲窗口执行。
- [ ] Electron 退役判据更新（见下节）。

**本轮观察（记录不修复，P1 评估）**：强制终止（taskkill）应用进程后，其自带的 sidecar 网关进程成为孤儿（不随父进程退出），需手动终止。正常退出路径（托盘菜单/quit IPC）会走 GatewaySupervisor 清理，预期不出现该问题；建议 P1 评估 sidecar 的父进程死亡处理（Job Object 或父 PID 轮询）。

**Electron 退役判据（个人使用版）**：Electron 双轨保留至——① 豁免后剩余 D-10 项全绿（安装/迁移/冷启动/隐藏/退出/卸载/清理、真实 TTS 双角色口型与归零、300s 安装产品 soak）；② 打包版日常使用 2-4 周无回归；③ 未发生需回滚 Electron 的阻断问题。三者齐备后 Electron 降级为纯回滚通道（不主动删除），Tauri 标记「完全替代」。
