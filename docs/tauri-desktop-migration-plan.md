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
