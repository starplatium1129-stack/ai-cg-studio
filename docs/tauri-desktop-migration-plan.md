# 桌面端 Tauri 2 全量迁移方案（含优化）

> 记录日期：2026-08-07
> 前置：`poc/tauri2` 可行性 PoC 已完成——Live2D 在 WebView2 渲染、透明窗+穿透+全局鼠标、网关 spawn、shim 桥四项全部通过（详见 poc/tauri2/README.md 验证矩阵）。
> 定位：正式迁移计划，含"不单纯迁移"的优化清单。批准后按 P0 → P7 逐阶段启动，每阶段独立验收、不串阶段。
> **进度（2026-08-07 当天推进）：P0-P4 已落地至 `desktop-tauri/`（编译通过、Rust 单测 8/8、真机双窗口/托盘/深链/数据迁移/工具路由全部验证），P5-P7 未开始。**

## 0. 当前进度快照（2026-08-07/08）

| 阶段 | 状态 | 真机证据 |
|---|---|---|
| P0 骨架+双窗口+Supervisor Rust 化 | ✅ | Companion 透明窗 + Atelier 无边框窗；网关 attach/自愈监控；`cargo test` 8/8 |
| P1 系统集成 | ✅ | 托盘全菜单、快捷键、单实例、深链、开机启动、通知、进度环、对话框、opener |
| P2 状态+数据迁移 | ✅ | 4 个 JSON + gateway_token 从 Electron userData 无缝迁入，`.tauri-migrated` 幂等标记 |
| P3 桥全量+轮询器 | ✅ | shim 40+ 方法全量；全局鼠标/剪贴板/电源/显示器轮询器已实现 |
| P4 工具下沉网关 | ✅ | `/api/desktop-tools`（localOnly+json+工作区白名单），`..` 穿越拒绝实测，security/gateway-contract 全绿 |
| P5 打包 sidecar | ✅ | NSIS 安装包 **98.5MB**（vs Electron ~400MB）；安装→sidecar node 启动→页面 200→501 契约→窗口→卸载全流程实测通过 |
| P6 优化项 | 部分 | O1 壳 36MB ✅、O3 ✅、O6 ✅；O4 快捷键配置化/O5 崩溃恢复未做 |
| P7 测试收口 | 部分 | Rust 单测 8/8 ✅；tauri-driver E2E、Playwright 全量回归未做 |

**2026-08-08 新增（用户实测问题修复 + 四个深层根因）**：

1. **shim 注入时机**：`initialization_script` 先于 `withGlobalTauri` 的 `__TAURI__` 注入 → 轮询等待（100ms×60 次）修复
2. **`document.documentElement` 为 null**（WebView2 注入时机早于 html 元素）→ MutationObserver 改 observe(`document`)
3. **自定义命令全部被 ACL 拒绝**（`not allowed. Plugin not found`）：一旦定义 capability 文件且页面 origin 非 local（`http://127.0.0.1:3000` 网关），`is_local_url` 判定失败 → 全部自定义命令被拦。**修复：`tauri.conf.json` 的 `build.devUrl` 设为 `http://127.0.0.1:3000`**，使页面 origin 归入 local（自定义命令默认允许）
4. **IPC 内同步创建 WebView2 窗口阻塞主线程**：`run_on_main_thread` 在主线程调用时直接同步执行（tauri-runtime-wry lib.rs:236），`build()` 同步等待 WebView2 环境创建 → 主线程消息循环卡死 → 后续所有 invoke 超时；且 **tauri 默认"所有窗口关闭即退出"**（缺 Electron 的 keep-tray-alive）导致进程消失。**修复：窗口创建放 `spawn_blocking`（tokio 线程）+ `ExitRequested` 中 `prevent_exit()`（`AppState.quitting` 标志区分显式退出）**
5. **Atelier 窗口缺 shim 注入** → `companionDesktop` 不存在 → DesktopTitleBar `visible` 条件不满足 → 无法拖拽。**修复：shim 移到 `src/shim.rs` 共享模块，Atelier builder 也注入**
6. **拖拽**：WebView2 不支持 `-webkit-app-region: drag`（R1 风险落地）→ shim 内按 `.desktop-titlebar` class 注入 `data-tauri-drag-region` + `.titlebar-controls` 排除（`data-tauri-drag-region="false"`），实测拖动窗口移动 150px×80px ✓；capability 加 `core:window:allow-start-dragging`

**当前验证**：桌宠"Atelier"按钮开主窗口 ✓、主窗口标题栏拖拽 ✓、穿透切换 ✓、隐藏/显示 ✓、深链 ✓、`cargo test` 8/8 ✓。

**2026-08-08 P5 打包 sidecar（完成）**：node v24 便携版做 externalBin；网关资源 staging 脚本 `scripts/maintenance/desktop-stage-resources.js`（复制 server/routes/services/scripts-runtime/data/dist/assets/tools + 生成 gateway/package.json 并 `npm install --omit=dev` 生产依赖）；NSIS 安装包 98.5MB。**踩坑记录**：
- tauri 资源路径以 src-tauri 为基准，跨目录相对路径（`../assets`）在 build script cwd 下不可靠 → staging 到 `src-tauri/resources/`
- **Windows `resource_dir()` = exe 目录**；NSIS 布局资源**平铺安装根**（`gateway/`、`node.exe`，externalBin 重命名）——手动解包布局（`resources/` 子目录）仅测试用，paths.rs 双候选兼容
- **`\\?\` UNC 前缀**：tauri resource_dir 经 canonicalize 返回 UNC 路径，传给 node 会解析成 `C:` 报 EISDIR → paths.rs `simplify_path` 统一去前缀
- packaged 模式 `AICS_APP_ROOT` 必须指向**网关代码根**（`gateway/` 目录，等价 Electron asar 根），否则 dist/assets 路径错位 404
- **sidecar 进程名是 `node.exe`**（非 node），杀进程/诊断时注意
- `AICS_DESKTOP_PACKAGED=1` 注入 + `/api/maintenance/*` 501 `DESKTOP_MAINTENANCE_UNAVAILABLE` 契约实测通过

**2026-08-08 补充验证与清理**：剪贴板轮询真机复测通过（文本 4-400 字 + CF_DIB→PNG 图片双通道，CDP 订阅页面事件实测）；代码清理至 **0 warning**（预留字段显式 `#[allow(dead_code)]`），`cargo test` 8/8；电源（台式机无电池）/显示器（无法热插拔）轮询保持代码已实现、真机行为受限待后续。

**遗留（下次会话起点）**：O4 快捷键配置化（需碰前端，等 Live2D 重构落地后做）/O5 崩溃恢复；电源/显示器真机复测；正式安装包签名/自动更新（D2 暂缓项）。

## 1. 迁移原则

1. **能力等价是底线，不是目标**：每一块 Electron 逻辑进入 Tauri 时都要问"能不能更便宜/更稳/更省"，不允许机械平移。
2. **0 重写优先**：纯 Node 无 Electron 依赖的模块（toolRunner、deepLink、windowState 逻辑）优先下沉到网关或保持独立 Node 模块，不迁 Rust。
3. **前端零改动**：`window.companionDesktop` API 形状逐项保持（PoC 已证明 shim 可行），SPA/测试链不动。
4. **数据格式兼容**：沿用现有 JSON 文件名与结构，首次运行自动迁移 Electron 用户数据（含网关 token，AGENTS.md 约束必须复用）。
5. **双轨可回滚**：Electron 壳保留至 Tauri 版稳定发布后，数据无降级损失。

## 2. 目标架构

```
┌─ Tauri 2 Rust 壳（<1000 行，不含插件）──────────────────┐
│  Companion 窗口 / Atelier 窗口 / 托盘 / 快捷键          │
│  GatewaySupervisor(Rust)：spawn sidecar node + 健康检查 │
│    + 指数退避重启（PoC 已验证 spawn 系统 node 可行）     │
│  轮询器：剪贴板 / 全局鼠标 / 电源 / 显示器               │
│  windowState / 偏好 / 工作区 / 日志（JSON，兼容旧格式）   │
└─────────────────────────────────────────────────────────┘
        Node 网关（sidecar node.exe + server.js + 全路由）
        ├─ 工具运行器 toolRunner（下沉网关，零重写）
        └─ 管理 GPT-SoVITS / 翻译 / 训练 / SD 子进程
```

关键决策：**Rust 壳不碰业务**。业务进程编排、文件工具、服务自愈全部留在 Node 网关，壳只做系统集成与窗口生命周期。

## 3. 能力映射与迁移方式（逐项）

| # | Electron 现有能力 | 来源 | Tauri 2 方案 | 迁移方式 |
|---|---|---|---|---|
| 1 | 双窗口（透明/置顶/穿透/无边框） | main.ts | WebviewWindowBuilder + set_ignore_cursor_events | 迁移（PoC 已验证） |
| 2 | Atelier 无边框 + 自绘标题栏 | main.ts + DesktopTitleBar.vue | 同左；drag 区依赖 WebView2 对 `-webkit-app-region: drag` 支持 | 迁移（**风险项 R1**，备选 `start_dragging`） |
| 3 | GatewaySupervisor（fork/attach/自愈） | gatewaySupervisor.ts (258 行) | Rust 重写：端口发现→spawn→health 轮询→指数退避 | 重写（逻辑纯 TS 可移植，测试用 Rust 重写） |
| 4 | 工具运行器 toolRunner | toolRunner.ts (188 行，纯 Node) | **下沉网关**：新增 `/api/desktop-tools`（TOKEN+本机校验+工作区白名单不变） | **零重写**（最大省项） |
| 5 | 剪贴板轮询（图/文投喂） | main.ts 351 行起 | Rust 轮询：文本哈希 + CF_DIB→BMP→PNG（image crate），1.5s | 重写 |
| 6 | 全局鼠标凝视 | main.ts 390 行起 | GetCursorPos 轮询 33ms（PoC 已验证） | 迁移 |
| 7 | 电源事件（battery/AC/resume） | main.ts 649 行起 | GetSystemPowerStatus 轮询（5s，变化才发）；resume 检测见降级项 D1 | 重写（简化） |
| 8 | 屏幕事件（显示器增删→窗口回屏内） | main.ts 663 行 | EnumDisplayMonitors 轮询（3s，变化时 clamp） | 重写（简化） |
| 9 | 托盘（菜单全量） | main.ts 244 行 | tauri Tray（图标：favicon.svg→PNG 打包资源） | 迁移 |
| 10 | 全局快捷键（3 个） | main.ts 334 行 | tauri-plugin-global-shortcut（PoC 已验证；宽松匹配坑已记录） | 迁移 + 优化项 O4 |
| 11 | 开机启动（--hidden） | main.ts 274 行 | tauri-plugin-autostart（带 args） | 迁移 |
| 12 | 单实例 + 深链 aics:// | main.ts 886 行起 | tauri-plugin-single-instance + tauri-plugin-deep-link | 迁移 |
| 13 | 系统通知 | main.ts 324 行 | tauri-plugin-notification（PoC 依赖已验证） | 迁移 |
| 14 | 任务栏进度 | main.ts 859 行 | Window::set_progress_bar | 迁移 |
| 15 | 窗口/偏好/端口/工作区持久化 | windowState.ts (168 行) | 自写 JSON（**保留现有文件格式**，数据迁移 M1） | 迁移（纯函数可单测） |
| 16 | 文件对话框/拖拽/导出 | preload.ts pickFiles/saveImage/onFileDrop | tauri-plugin-dialog + Rust 拖拽事件（tauri 2 的 fileDrop 事件） | 迁移 |
| 17 | IPC 桥 40+ 方法 | preload.ts (227 行) | initialization_script shim + commands/events 一一对应 | 迁移（PoC 已验证模式） |
| 18 | 日志（轮转文件） | logger.ts | Rust 自写（相同格式与轮转策略，512KB×3） | 迁移 |
| 19 | 渲染进程崩溃恢复 | main.ts 563 行（仅 companion） | wry 崩溃回调（**待验证 R2**） | 迁移 + 优化项 O5 |
| 20 | 窗口截图（调试/验证用） | 无（PoC 新增） | PrintWindow PW_RENDERFULLCONTENT（PoC 已验证） | 新能力（保留） |

## 4. 分阶段计划

### P0：工程骨架 + 双窗口 + 网关 Supervisor（3-4 天）

- 以 `poc/tauri2` 为起点：移入 `desktop-tauri/` 正式目录，注册 npm scripts（`dev:tauri`、`build:tauri`）
- GatewaySupervisor Rust 化：端口持久化读取 → attach 检测（读 `/api/health` + `desktopProtocol:1` 校验）→ 不可用则找空闲端口 spawn sidecar → 20s 健康等待 → 崩溃指数退避重启（2^n 秒封顶 30s）+ 输出转发文件日志
- Atelier 窗口（无边框、min 1024×720、状态持久化、关闭隐藏）
- 验收：`cargo test`（supervisor 用 127.0.0.1 模拟端口/假 server 单测）+ 手工双窗口 + 杀网关进程后 30s 内自动拉起

### P1：系统集成（2-3 天）

托盘（全菜单）、全局快捷键、深链、单实例、开机启动、通知、任务栏进度、文件对话框
- 验收：托盘菜单 9 项功能逐一可用；`aics://gallery` 冷/热启动均打开 Atelier；双实例启动被拒；开机启动写入注册表；进度环随训练任务出现

### P2：状态持久化 + 数据迁移（2 天）

- windowState 逻辑 Rust 化（load/save/clamp，保持 JSON 格式与 Electron 完全一致）
- 首次运行迁移 M1：检测 Tauri 数据目录无配置而 Electron userData 有 → 复制 `companion-window.json` / `companion-preferences.json` / `desktop-gateway.json` / `ai-workspace.json` / `gateway/runtime/state/gateway_token*` → 写迁移标记；迁移前对源目录做只读快照校验（可回滚）
- 验收：`cargo test` 覆盖 load/clamp/save round-trip + 迁移单测（构造假源目录）；真机验证 Electron 数据无缝带入

### P3：IPC 桥全量 + 系统轮询器（3-4 天）

- shim 逐项对齐 preload 40+ 方法（getState/hide/quit/openAtelier/穿透/置顶/Live2D/工作区/notify/setProgress/runTool→网关路由/onFileDrop/onResume/onShown/visibility/power/interaction/clipboard×2/globalMouse/window 控制×3/onMaximized）
- Rust 轮询器：剪贴板（CF_DIB→PNG，哈希去重）、电源（GetSystemPowerStatus）、显示器（EnumDisplayMonitors + clamp）
- 验收：CompanionView 全部桌面 UI 行为与 Electron 一致（穿透/置顶/勿扰/剪贴板投喂/电池徽标）；双显示器热插拔窗口回屏内；sleep 唤醒后状态不崩

### P4：工具运行器下沉网关（1-2 天，大部分是测试）

- 网关新增 `/api/desktop-tools`：`runTool` 逻辑原样搬入（toolRunner.ts 已是纯 Node），复用 `server/security.js` 本机判断 + TOKEN
- 前端 `runTool` 从 IPC 改为 HTTP（shim 内改一个实现）；`get_workspace_info` 等 6 工具行为不变
- 验收：现有 `test-*.js` 工具用例迁移到网关测试，安全断言真实 HTTP 路由（AGENTS.md 安全测试纪律）；LLM 工具调用全流程回归

### P5：打包分发（3-4 天，含踩坑缓冲）

- sidecar：构建脚本下载 node 便携版（x64），置 `src-tauri/binaries/`；`tauri.conf.json` externalBin + `extraResources` 装 gateway 代码（server/routes/services/data/dist/assets/tools）
- 打包模式与 dev 模式路径解析（对齐 paths.ts 语义：AICS_* 环境变量注入；`AICS_DESKTOP_PACKAGED=1` 仅打包注入，维持 501 契约与测试锚点）
- NSIS：一键安装/可选目录/桌面快捷方式；WebView2 运行时检测（系统已有则跳过）
- 验收：干净虚拟机安装 → 首次运行 → 数据迁移 → 网关自启 → 双窗口可用；`AICS_DESKTOP_PACKAGED` 场景维护 501 契约回归

### P6：优化项落地（2-3 天）

见第 5 节 O1-O6，全部有独立验收。

### P7：测试收口 + 回归 + 文档（2-3 天）

- Rust 单测补全（deepLink 解析、剪贴板哈希、路径安全、windowState）
- 桌面 E2E：tauri-driver + WebView2（评估 R2 后确定范围；至少覆盖窗口状态持久化、穿透切换、托盘菜单、深链）
- 前端 Playwright 全量回归（SPA 无改动的证明）；`npm run validate` 全绿
- 迁移总结文档 + AGENTS.md 桌面章节更新（删 Electron 专属约束，写 Tauri 契约）

## 5. 优化清单（不单纯迁移的部分）

| # | 优化 | 现状问题 | Tauri 方案 | 验收 |
|---|---|---|---|---|
| O1 | 主进程内存 | Electron 主进程 100-200MB | Rust 壳实测 28MB（PoC 数据） | 主进程 <50MB 常驻 |
| O2 | 安装包体积 | ~400MB（electron.exe 195MB） | NSIS + WebView2 系统复用 + sidecar node ≈ 150-180MB | 安装包 <200MB |
| O3 | 隐藏降载 | companion 隐藏仅 backgroundThrottling | `set_background_throttling` + 隐藏时暂停 Live2D 渲染循环（事件驱动，渲染端配合） | 隐藏 10 分钟后 WebView2 组内存下降 ≥30% |
| O4 | 快捷键可配置 | 3 个硬编码全局键 | 偏好文件存键位 + global-shortcut 动态 register/unregister（冲突返回错误给 UI） | 配置变更即时生效；冲突有提示 |
| O5 | Atelier 崩溃恢复 | 仅 companion 有 reload，atelier 裸奔 | wry 崩溃/无响应回调 → 重载页面 + 日志（companion 已有同款逻辑照搬） | 杀掉 atelier 渲染进程后 1s 内自动恢复 |
| O6 | 启动更快 | Electron 冷启动 ~2-4s | Rust 壳 <1s 出托盘 + 窗口并行网关（PoC 已并行） | 托盘出现 <1s，页面可交互 <3s |
| O7 | 剪贴板图片格式 | 仅 PNG | CF_DIB→PNG 转换（image crate），兼容更多来源 | 复制 PS/浏览器图片均可投喂 |
| O8 | 电池降载 | 事件有但无行为 | AC→电池切换时渲染端降帧（前端已有 data-power-mode 契约） | 电池下 Live2D 帧率减半，GPU 占用下降 |

降级项（记录理由，不做）：
- D1 resume 事件：Windows 无低成本等效（PowerSettingRegisterNotification 复杂），网关为 HTTP 轮询为主，渲染端重连影响小 → 不实现，注释保留
- D2 自动更新：本地个人使用 + 需要 https 签名端点，收益不成比例 → 不做（NSIS 安装包手动替换即可）
- D3 Live2D 贴图压缩/KTX2：既有暂缓项，与壳无关 → 不触碰

## 6. 安全设计

- IPC：Tauri 能力系统（capabilities）逐命令白名单，比 Electron contextBridge 更严；`core:default` + 插件最小权限集，自定义命令默认全开但全部经 `isTrustedDesktopSender` 等价校验（事件源必须是本壳窗口 + 网关 origin）
- 工具运行器随网关走后：复用 `server/security.js` 本机判断 + TOKEN（与现有控制面一致），工作区路径白名单与大小写校验原样保留
- 侧车命令：Rust 侧仅允许白名单命令（node -- 网关脚本），路径全部来自自身打包资源，不接受渲染端传路径
- 安全测试：沿用 AGENTS.md 纪律——断言真实 HTTP 路由输出，不测复制出来的 helper

## 7. 风险清单

| 编号 | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | `-webkit-app-region: drag` 在 WebView2 的支持不确定 | 中 | P0 首个验证；失败用 `start_dragging`（mousedown 委托），改动限于标题栏组件 |
| R2 | tauri-driver/WebView2 桌面 E2E 链路可用性 | 中 | P7 前评估；不可用则壳行为测试退化为 Rust 集成测试 + 手工清单 |
| R3 | sidecar node.exe 被杀软误报/签名 | 低 | 官方便携版 + 构建时 SHA256 校验；文档说明 |
| R4 | CF_DIB→PNG 转换的边界（32bpp/调色板） | 低 | image crate + 像素格式 fallback（BMP→RGBA→PNG），单测覆盖 |
| R5 | 深链注册表在卸载残留 | 低 | tauri-plugin-deep-link 自清理；验收含卸载后点击 aics:// 无弹错 |
| R6 | 125/150% DPI 与多屏组合未实测 | 中 | P5 真机矩阵补测（缩放 125/150 + 双屏热插拔） |

## 8. 里程碑与工作量

| 里程碑 | 内容 | 工作量 |
|---|---|---|
| M0 | PoC 验证（已完成） | 1 天 |
| M1 | P0-P1：壳骨架 + 系统集成 | 5-7 人日 |
| M2 | P2-P3：状态/迁移/桥/轮询器 | 5-6 人日 |
| M3 | P4-P5：工具下沉 + 打包 | 4-6 人日 |
| M4 | P6-P7：优化 + 测试收口 | 4-6 人日 |
| **合计** | | **19-25 人日（约 3-4 周）** |

## 9. 决策门槛与回滚

- 每阶段验收不通过 → 停在当前阶段修，不带着缺陷进下一阶段
- R1 验证失败且 start_dragging 方案也不可用 → 暂停迁移评估（极低概率）
- 任一阶段出现"Tauri 无法等价实现的能力" → 回到 Electron，数据格式兼容保证零损失
- Electron 壳在 Tauri 稳定发布前保留：`package.json` 的 `main` 指向不变，`build:desktop`（Electron）与 `build:tauri` 并存

## 10. 明确不做

- 不做框架重写（Vue 前端与 Playwright 测试链不动，这是换壳的前提承诺）
- 不触碰 Live2D 资源压缩/迁移 Git LFS（既有暂缓项）
- 不引入自动更新（D2）
- 不迁移 WebView2 无法验证的能力到实验性插件（R2 未过不强行上）
