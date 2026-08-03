# 桌面 AI 女友（桌面陪伴模式）可行性与实施方案

> 记录日期：2026-08-03
> 产品前提：个人本地使用为主；R18 内容默认开启；不按公开 SaaS 设计。
> 与现有路线的关系：`visual-architecture-roadmap.md` 明确不进行 Electron/Tauri 重写。本方案不是重写，而是在现有 Web 应用与 Express 网关之外增加一个可选桌面壳。

## 结论

可行，综合可行性约为 **8.5/10**。现有角色、对话、配音和 Live2D 能力可以复用约 70% 至 80%，但真正需要验证的是桌宠展示层、透明窗口交互、网关生命周期、打包资源路径和数据边界，而不是重新实现 AI 能力。

当前项目最合适的技术路线仍是 **Electron 薄壳**：

- Electron 与当前 Vue 3、Vite、TypeScript、Express、Chromium WebGL 运行方式最接近。
- `wl-live2d` 依赖的 WebGL 与 `unsafe-eval` 已在 Chromium 路径验证。
- 透明无边框窗口、置顶、托盘、全局快捷键和鼠标穿透均有成熟 API。
- Tauri v2、WinUI 3/WPF + WebView2 可以实现，但不会降低第一版的综合开发风险。

产品上应明确拆成两个表面，而不是把网站工作台缩小成桌宠窗口：

```text
绫季绘境 Atelier       = 场景、Prompt、生成、作品、训练、控制
绫季 Companion         = 角色舞台、Live2D、粒子、动画、音频响应、桌面悬浮
共享稳定核心           = 网关协议、角色资产、聊天会话、TTS、Live2D 运行时契约
```

Companion 可以有极简的对话输入和会话记忆，但不得引入场景编辑、Prompt、SD 生成、作品管理、训练或控制面板。网站和 Companion 的页面布局、业务状态和动效系统必须保持独立。

推荐按三阶段推进：

1. **P0：产品闭环验证**。新增独立 `/companion` 路由，不套完整站点 chrome；复用角色、对话和配音状态，提供小舞台、临时气泡、紧凑输入和声音开关。
2. **P1：Electron 最小壳层**。实现透明窗口、粗粒度点击穿透、托盘、位置持久化、单实例和网关 attach-or-start。
3. **P1.5：可分发可靠性**。分离只读应用资源与可写用户数据，处理打包资源、多屏 DPI、睡眠唤醒和子进程退出。

## 参考实现

| 项目 | 栈 | 可借鉴点 |
|---|---|---|
| [soongtv/Live2DPet](https://github.com/soongtv/Live2DPet) | Electron + pixi-live2d-display + VOICEVOX + LLM | 透明置顶窗、气泡对话、主动行为；其 v2.0 放弃复杂截屏感知/VLM 记忆，也说明该管线成本高、收益不稳定 |
| [BITNP/bitnp-desktop-pet](https://github.com/BITNP/bitnp-desktop-pet) | Electron + Vue 3 + TypeScript + Vite | 与当前前端同栈；可参考窗口、托盘、自定义拖拽和鼠标穿透 |
| [gameswu/NyaDeskPet](https://github.com/gameswu/NyaDeskPet) | Electron + Live2D + AI Agent | Agent 与桌面渲染解耦方式可参考，但当前项目不需要先引入新的 WebSocket 层 |
| [LikeNeko/L2dPetForMac](https://github.com/LikeNeko/L2dPetForMac) | Electron | macOS 透明窗口和置顶策略参考 |

共性架构是：主进程负责窗口、托盘、快捷键和服务生命周期；渲染进程负责 Live2D、气泡和输入；现有 Express 网关继续负责 LLM、TTS、翻译与资源服务。

## 方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| **Electron 薄壳** | Chromium/WebGL 兼容风险最低；窗口 API 完整；可直接承载现有构建产物 | 包体较大；需要维护主进程、打包和安全边界 | 推荐 |
| Tauri v2 | 壳层较小；系统 WebView2 更新独立 | 透明 WebView2、Live2D、自动播放、穿透和插件组合仍需 POC；引入 Rust 工具链 | 仅在包体成为硬约束时评估 |
| WinUI 3/WPF + WebView2 | Windows 窗口控制最原生 | 引入 C#/原生层，跨平台与维护成本上升 | Windows 专用长期方案，不适合 P0/P1 |
| 浏览器 app 模式/PWA | 无新桌面依赖，验证速度快 | 无可靠透明、穿透、托盘和常驻能力 | 只用于 P0 |

## 复用边界

### 双产品表面

**Atelier 网站负责：**

- 场景编辑和故事编排。
- Prompt、模型、LoRA 和生成参数。
- 图片生成、队列、作品册和备份。
- 训练台、控制面板和本地服务维护。
- 复杂角色配置、记忆归档和诊断入口。

**Companion 负责：**

- 角色舞台、Live2D 原生动作和互动热区。
- 情绪运行时、眨眼、视线、音频口型和持续动画。
- 粒子、全屏过场、气泡、拖动、置顶、穿透和托盘体验。
- 极简对话输入、最近消息和配音控制。
- 安静时段、勿扰、主动行为冷却和窗口生命周期。

两者不是一个页面的两个 CSS 模式。它们是同一网关下的两个前端表面，应该拥有独立的根组件、样式入口和页面级生命周期。

### 直接复用

- `ChatCharacterStage.vue` + `useLive2D.ts`：Live2D 加载、原生动作、互动、换装、口型、情绪、眨眼、登场与告别。
- `useVoice.ts`：TTS、播放、真实音频振幅口型和逐句情绪。
- `useChatStorage.ts`、`useChatProvider.ts`、`useChatConversation.ts`：本地记忆、供应商状态和流式对话。
- `server.js` 与现有 routes/services：LLM、TTS、翻译、Live2D 资源和服务准备。

### 需要调整

1. 新增独立 `/companion` 顶层路由，不套 `AppLayout.vue`，避免用大量 `?desktop=1` 条件隐藏完整角色房间。
2. `/chat` 与 `/companion` 使用独立视图，各自拥有页面布局；只通过 `useCharacterRoomSession` 共享最小会话、配音和角色运行时编排。
3. 将 Live2D CSP 白名单和路由整页切换从单一 `/chat` 扩展为 Live2D 路由集合。
4. Electron 通过窄范围 preload IPC 暴露窗口操作；渲染器不得直接启用 Node integration。

### 共享核心的边界

共享组合函数只允许拥有这些能力：

- 当前角色、草稿、聊天历史和流式回复。
- LLM provider 状态、TTS 队列、音量和配音开关。
- 角色舞台回调：说话、口型、音频振幅、情绪和用户反应。
- 本地聊天服务准备和健康状态。

共享组合函数不得引用 `AppLayout`、网站导航、Prompt、场景 store、生成队列、训练 store 或控制面板组件。桌面窗口、托盘和 Electron IPC 也不进入共享核心。

## P0 界面契约

`/companion` 只保留陪伴闭环：

- 单个角色舞台，允许角色切换和现有原生互动。
- 最近少量消息形成临时气泡，不展示完整历史管理和供应商高级配置。
- 紧凑输入框、发送/停止、实时配音开关、音量和房间状态。
- 服务未就绪时保留“准备聊天环境”入口，不能形成无解释的不可用状态。
- 提供进入完整 `/chat` 角色房间的入口。
- 浏览器 P0 仍使用正常页面背景；Electron 透明窗口由桌面环境能力标记开启，不能让普通浏览器页面变成不可读的透明层。

## Electron 架构

建议目录：

```text
desktop/
  main.ts
  preload.ts
  gatewaySupervisor.ts
  windowState.ts
```

主进程职责：

- `app.requestSingleInstanceLock()` 防止重复桌宠和重复网关。
- 启动时先探测 `GET /api/health`；已有兼容网关则附着，没有才启动。
- 正式打包使用 Electron `utilityProcess.fork()`，不假设系统安装了 `node`。
- 只关闭当前实例拥有的网关，不能误杀用户已手动启动的服务。
- 健康检查完成后再显示窗口，避免启动白屏和请求风暴。
- `nodeIntegration: false`、`contextIsolation: true`，preload 只暴露最小窗口命令。
- 拒绝任意导航和新窗口；外部链接由主进程确认后交给系统浏览器。

## 透明窗口与点击穿透

窗口基础配置可以使用：

```text
transparent: true
frame: false
backgroundColor: '#00000000'
```

但第一版不追求逐像素轮廓穿透：

- wl-live2d 使用 WebGL canvas，不能像 2D canvas 一样直接调用 `getImageData()`。
- `gl.readPixels()` 可以采样，但会产生 GPU/CPU 同步；在鼠标移动中高频调用存在卡顿风险。
- Live2D 模型持续运动，静态 alpha mask 也无法长期准确匹配。

P1 采用更稳妥的分层策略：

1. 透明背景区域调用 `setIgnoreMouseEvents(true, { forward: true })`。
2. 角色舞台、气泡和控制条使用可测量矩形或少量多边形热区恢复交互。
3. 提供“锁定穿透”和“移动模式”，避免角色互动与拖动窗口冲突。
4. 只有粗粒度方案体验不足时，再用低频单像素 `readPixels` POC 验证，不直接进入主实现。

## 网关与打包资源

当前运行数据默认位于项目根目录的 `runtime/`。安装版应用资源目录通常不可写，因此打包前必须分离：

```text
APP_ROOT   只读：dist、server、routes、services、Live2D、工具脚本
DATA_ROOT  可写：app.getPath('userData') 下的配置、token、日志、状态和输出
```

Live2D 模型、翻译脚本等不能依赖开发目录相对位置，应使用 Electron `extraResources` 或显式资源根目录。外部 AI 工作区继续允许由环境变量或本机配置指定，不打包训练数据和模型权重。

## 数据边界

Electron 与 Chrome/Edge 使用不同浏览器 profile。即使都访问 `127.0.0.1:3000`，两者的 localStorage 和 IndexedDB 也不会自动共享。

P1 默认策略：

- 桌宠托盘中的“打开完整工作台”使用 Electron 第二窗口，与桌宠窗口共享 Electron session。
- 外部浏览器仍可访问网关，但其聊天记忆与 Electron profile 独立；界面和文档需要明确说明。
- 若未来必须跨浏览器同步，再将聊天记忆迁移到网关 Repository；P0/P1 不为此提前扩大改动。

## 自动播放与打扰控制

- Electron 可设置 `autoplay-policy=no-user-gesture-required`，解决重启后已启用实时配音仍被 Chromium 拦截的问题。
- 默认不自动出声、不自动置顶；只有用户显式开启实时配音后才恢复该偏好。
- 托盘提供隐藏、勿扰和退出；快捷键提供暂时隐藏。
- P2 主动行为先使用确定性的安静时段、冷却时间和小型状态机，不先实现不可预测的长期情绪累积。

## 风险与验证矩阵

- Windows DWM 透明合成与显卡驱动差异。
- WebGL context lost、睡眠唤醒和显示器热插拔。
- 100%、125%、150%、200% DPI 与多显示器坐标恢复。
- 全屏游戏/播放器与置顶窗口冲突。
- 网关端口占用、已有网关附着、异常退出和残留子进程。
- Electron profile 与外部浏览器的数据隔离。
- 打包后只读资源路径、可写用户目录和大体积 Live2D 资源加载。

## 实施路线

### P0：产品验证

- [x] 新增 `/companion` 顶层路由和紧凑展示层。
- [x] 将 `/chat` 与 `/companion` 改成独立视图，并通过最小共享会话核心复用能力。
- [x] 扩展 Live2D CSP 路由集合与整页切换逻辑。
- [x] 增加桌面、窄窗口和无横向滚动定向测试。
- [ ] 用浏览器 app 模式验证输入、流式回复、配音、互动、动作和情绪闭环。
- [x] 用真实 Electron 验证桌面默认 Live2D、端口回退、隐藏/恢复和 Atelier 窗口复用。

### P1：Electron 最小壳

- [x] 主进程、preload、单实例和安全导航策略。
- [x] 网关 attach-or-start 与 ownership-aware shutdown。
- [x] 透明无边框窗口、鼠标穿透开关、移动模式和位置持久化。
- [x] 托盘、隐藏、置顶和 Electron 内完整工作台窗口。
- [x] 用户显式开启后的自动播放策略。

P1 已完成真实 Windows Electron 回归；仍需在不同显卡驱动、多屏 DPI 和睡眠唤醒硬件组合上做发布前矩阵验证。

### P1.5：可分发可靠性

- [x] `APP_ROOT` / `DATA_ROOT` 分离。
- [x] `extraResources` 与打包路径验证。
- [x] 基础多屏/DPI/睡眠唤醒/WebGL 恢复逻辑与真实 Electron 回归。
- [x] 主进程文件日志（`desktop/logger.ts`，512KB 轮转 ×3，网关子进程输出转发，托盘/渲染器可打开日志文件）；安装/升级/卸载策略：数据全部落在 `userData`，安装器不写运行状态。

### P2：陪伴行为

- [x] 无操作提醒、安静时段（23:00-8:00 默认、可配置）与提醒冷却（确定性状态机 `src/utils/companionBehavior.ts`，不调用 LLM、不自动出声）。
- [x] 常驻气泡队列（容量上限 + FIFO + 手动关闭）与勿扰优先级（勿扰期间不产出、不出队，队列保留，关闭后恢复）。
- [ ] 经用户显式授权后再评估语音输入。

## 明确不做

- 不重写 Vue/Express/Live2D 渲染层。
- 不在 P0/P1 实现截屏感知、VLM 视觉记忆或持续屏幕监控。
- 不使用高频 WebGL 像素读取作为第一版点击穿透方案。
- 不假设用户系统安装 Node。
- 不把运行状态写入安装目录。
- 不为了桌宠模式复制第二套聊天、配音或 Live2D 生命周期。
