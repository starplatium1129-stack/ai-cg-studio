# D-10 第一轮真实桌面发布验收报告

日期：2026-08-09
任务依据：`docs/next-phase-task-assignments.md` §13、§16.1、§16.2
状态：**BLOCKED，第一轮已按停止条件结束**

## 结论

冻结源码的构建门槛、Rust 单元测试、Native release selftest 和唯一 NSIS 打包均已通过。真实安装产品链未执行，不能标为 PASS。

预检命中两个明确环境阻断：

1. 当前进程没有管理员权限，而 NSIS 为 `perMachine`；按任务约束禁止改成 portable 或尝试非提权安装。
2. 本机 GPT-SoVITS `http://127.0.0.1:9880` 离线；禁止用假 WAV 替代真实 TTS。

因此 harness 在调用安装包 `/S` 前停止。没有安装、启动或卸载产品，没有写入真实 `APPDATA`、`LOCALAPPDATA` 或 AI workspace，也没有生成伪造的 DPI、双屏、TTS、soak 或 workflow PASS 证据。

## 唯一安装包

| 字段 | 值 |
|---|---|
| 路径 | `E:\code\2\lora\AI-CG-Studio\desktop-tauri\src-tauri\target\release\bundle\nsis\AI-CG-Studio_1.5.0_x64-setup.exe` |
| 版本 | `1.5.0` |
| 大小 | `106,520,736` bytes |
| SHA-256 | `ac98ba47dae49cb983fd2626ce3a19e123bb0dddac0469b83ce876bd48f081c0` |
| 构建 HEAD | `3402df6bf1ce6a08901d84124434b3ce9c468b1a` |
| 打包输入指纹 | `4c14ae0bccf44c4aafd91deab914fa53e79179cff0d8d1309139b272b9699068` |
| 指纹规模 | `3,506` files / `306,847,120` bytes |

冻结时完整 dirty、staged 和 untracked 清单位于证据目录的 `installer-build.json`。任何打包输入变化都会使 harness 的 `verifyBuildRecord()` 拒绝继续沿用本安装包证据。

## 环境预检

| 项目 | 实测 |
|---|---|
| Windows | Windows 11 专业版 `10.0.22631`，build `22631`，64 位 |
| 管理员权限 | `false`，阻断 per-machine 安装 |
| GPU | NVIDIA GeForce RTX 4070 Ti SUPER，驱动 `32.0.15.9697`；另检测到三个虚拟显示适配器 |
| Edge | `151.0.4129.72` |
| WebView2 | `151.0.4129.72` |
| EdgeDriver | `151.0.4129.72`，与 Edge 精确匹配 |
| tauri-driver | `2.0.6` |
| Node / npm | `v24.18.0` / `11.16.0` |
| rustc / cargo | `1.97.1` / `1.97.1` |
| 真实显示器 | 1 个，`1920x1080`，96 DPI，100% 缩放 |
| 已有 AI-CG-Studio 安装 | 无；harness 仍会在安装前拒绝覆盖任何已有安装 |
| GPT-SoVITS | 离线，阻断真实配音链路 |
| self-hosted workflow | 未运行；没有 URL、run id、commit SHA，不标 PASS |

`tauri-driver` 按 Tauri 官方文档用 `cargo install tauri-driver --locked` 安装到隔离临时工具目录。EdgeDriver 从 Microsoft 对应版本端点下载，版本输出为：

```text
Microsoft Edge WebDriver 151.0.4129.72 (b9a024e937cf39a16b1eef84c9efb3471baa27b8)
```

官方依据：

- <https://v2.tauri.app/develop/tests/webdriver/manual-setup/>
- <https://v2.tauri.app/distribute/microsoft-store/#silent-install>
- <https://learn.microsoft.com/en-us/windows/curl/>
- <https://learn.microsoft.com/en-us/windows/tar/>

## 自动命令

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `npm run typecheck:app` | 0 | PASS |
| `npm run build` | 0 | PASS；route bundle budget 通过，保留 Vite `>500 kB` 警告 |
| `cargo test --locked --manifest-path desktop-tauri/src-tauri/Cargo.toml` | 0 | PASS，13 passed |
| `npm run test:live2d-native:release` | 0 | PASS，release snapshots `3/3` |
| `npm run package:tauri` | 0 | PASS，生成上述唯一 NSIS |
| `npm run test:desktop:native` | 2 | BLOCKED；在安装前因无管理员权限及 GPT-SoVITS 离线停止 |

工具准备阶段曾有两次嵌套 PowerShell `-Command` 引号解析失败，均未开始下载、未修改应用源码。按“连续两次失败即先查证”规则停止该写法，核对 Microsoft 文档后改用显式 `curl.exe` 和 `tar.exe`；EdgeDriver 下载、解压及版本匹配随后通过。失败与恢复过程完整保留在 `commands.log` 和 `failures.json`，不冒充产品缺陷。

## 验收实现

新增真实产品 harness：

- `scripts/tests/run-desktop-native-acceptance.js`
- `scripts/tests/desktop-native/command.js`
- `scripts/tests/desktop-native/fixtures.js`
- `scripts/tests/desktop-native/mock-openai.js`
- `scripts/tests/desktop-native/report.js`
- `scripts/tests/desktop-native/webdriver.js`
- `scripts/tests/desktop-native/windows.js`
- `package.json` 的 `test:desktop:native`

实现覆盖以下链路，待环境满足后由同一 harness 执行：

- 安装包 SHA 和打包输入指纹校验。
- 独立临时 `APPDATA`、`LOCALAPPDATA`、AI workspace 和 WebView2 user-data-dir；包含故意指向真实路径的失败注入。
- 四个 Electron JSON 与固定 `gateway_token` 的逐字节迁移和二次启动幂等检查。
- 安装后的 exe、真实 `tauri-driver`/`msedgedriver`、sidecar、正常退出和静默卸载。
- 隐藏启动、non-creating Native 诊断、窗口/overlay HWND、真实 Win32 move/resize/hotkey/click。
- 100/125/150 真实缩放、单屏/同 DPI 双屏/混合 DPI/跨屏矩形误差与 200ms 对齐。
- 双角色 ready、HitArea、作者动作、同一多变体动作组不少于 8 次、情绪标签、30/165 FPS。
- 真实聊天配音的宁宁/夏目 neutral/happy、WAV 指标、DOM/Native 口型采样和 500ms 归零。
- 300 秒安装产品 soak；按产品进程树聚合 Working Set、private bytes 和 GPU dedicated/shared。

`desktop-tauri/src-tauri/src/live2d_overlay.rs` 仅增加向后兼容的只读验收诊断：

- `aics_live2d_get_state` 未初始化时返回 `active:false`，查询不创建 overlay、不加载模型、不启动渲染线程。
- 已初始化时返回 `rect`、`visible`、`frameCount`、`targetFps`、`character`、`ready`、`windowReady`、`rendererAttached`、`modelBounds` 和 `passthroughCount`。
- 额外记录最近一次规范化 `mouthLevel` 与角色映射后的 `mouthMappedValue`；切角和 destroy 时归零，只观察、不反向驱动 renderer。

没有修改 `main.rs`、`main_shared.rs`、`bridge.rs`、`shim.rs`、`paths.rs`、前端 Live2D 调用方、Native renderer/model/shader、API client、Q-20 CSS 或 Electron 生产文件。

## 本轮矩阵

| 范围 | 状态 | 原因 |
|---|---|---|
| 100% 单屏 | BLOCKED | 真实环境已测为 100%，但安装产品链被预检阻断 |
| 125% | NOT_COVERED | 当前真实 Windows 缩放不是 125% |
| 150% | NOT_COVERED | 当前真实 Windows 缩放不是 150% |
| 双屏/跨屏 | BLOCKED | 当前仅有一个真实活动显示器，不使用虚拟 CSS viewport 冒充 |
| 四条真实 TTS | BLOCKED | GPT-SoVITS 离线 |
| 安装、迁移、冷启动、隐藏启动 | BLOCKED | 无管理员权限，未调用安装包 `/S` |
| 点击、动作、情绪、FPS、口型 | BLOCKED | 产品未安装、未启动 |
| 300 秒产品 soak | BLOCKED | 产品未安装、未启动 |
| 正常退出、卸载 | BLOCKED | 产品未安装 |
| self-hosted `windows-native.yml` | BLOCKED | 无 workflow URL/run id/commit SHA |

## 证据

仓库外固定目录：

`E:\code\2\lora\AI\Reviews\DesktopAcceptance\2026-08-09_d10_round1\`

已生成：

- `report.json`
- `environment.json`
- `environment-100.json`
- `installer-build.json`
- `installer.sha256`
- `commands.log`
- `failures.json`
- `desktop.log`：明确说明产品未启动，真实 desktop log 不可用
- `screenshots/100/NOT_COVERED.txt`
- `screenshots/125/NOT_COVERED.txt`
- `screenshots/150/NOT_COVERED.txt`
- `screenshots/dual-screen/NOT_COVERED.txt`

安装包、驱动、截图目录和后续 WAV 均不提交仓库。

## 后续解锁条件

下一轮必须同时满足：

1. 从提升权限的终端运行同一安装包和同一 harness。
2. 启动真实 GPT-SoVITS，并确保宁宁、夏目 voice profile 可用。
3. 分别切换真实 Windows 100%、125%、150% 缩放；双屏证据需要真实第二屏，并分别覆盖同 DPI、混合 DPI和跨屏。
4. 若需标记 self-hosted workflow PASS，必须提供真实 workflow URL、run id、commit SHA 和全绿日志；未经用户要求不自行 commit/push。

本轮到此停止，不继续尝试绕过管理员、TTS、DPI 或第二屏阻断。

## SOL 第二轮复审与新冻结包

日期：2026-08-09

第一轮安装包在 SOL 修改打包输入后已作废。第二轮冻结源码重新生成的唯一安装包如下，后续 D-10 只能使用本节版本：

| 字段 | 值 |
|---|---|
| 路径 | `E:\code\2\lora\AI-CG-Studio\desktop-tauri\src-tauri\target\release\bundle\nsis\AI-CG-Studio_1.5.0_x64-setup.exe` |
| 版本 | `1.5.0` |
| 大小 | `106,531,194` bytes |
| SHA-256 | `ee9277f95143ae9499e657e290429fd0b361b8715c050969408a2a4b56cee178` |
| 构建 HEAD | `3402df6bf1ce6a08901d84124434b3ce9c468b1a` |
| 打包输入指纹 | `84237fd2a3c9cbd623cdcbccb7854ed05b1d52bd67e45a4b820fa0f2e12b77a1` |
| 指纹规模 | `3,506` files / `306,852,551` bytes |

SOL 复审修复：

- 新安装包哈希或打包指纹变化时，报告自动清空旧 PASS、失败、矩阵、截图、WAV、迁移和 soak 证据，避免跨安装包污染。
- 点击验收不再把 payload 为空的 HitArea 事件算作命中；Face/Head/Body/Skirt 坐标与舞台分区对齐。
- TTS 验收增加单次 `playing/ended`、无 media error、宁宁/夏目角色口型映射误差和归零断言。
- self-hosted workflow 只有在提供 github.com Actions URL、精确 run id、成功结论、40 位 commit SHA 且 SHA 与冻结 HEAD 一致时才可标 PASS。
- `test-desktop-native-evidence.js` 已进入 unit inventory；Native state 契约补充 non-creating 查询和完整字段哨兵。

第二轮验证：`npm run validate`、最新 `npm run build`、`npm run validate:desktop`、Cargo 13/13、相关 Playwright 8/8、NSIS package 均 PASS。随后运行 `npm run test:desktop:native`，新包指纹验证通过，但仍在 `/S` 安装前按停止条件返回 BLOCKED：

- 当前进程未提升权限，不能执行 per-machine 安装。
- GPT-SoVITS 仍离线，不能伪造四条真实 TTS。
- 仅有 100% 单屏，125%、150%、同 DPI 双屏、混合 DPI 和跨屏仍未覆盖。
- 无实际 self-hosted workflow URL、run id、commit SHA 和全绿日志。

结论：D-10 的 harness、只读诊断、证据防污染和最终安装包构建已通过第二轮代码复审；**真实发布验收仍为 BLOCKED，D-10 不签收**。没有执行安装、迁移、产品启动、300 秒产品 soak 或卸载，也没有生成对应 PASS 证据。
