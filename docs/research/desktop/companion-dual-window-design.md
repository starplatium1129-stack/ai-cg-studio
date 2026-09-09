# Companion 角色/聊天双窗口分离设计（真双窗口 · 方案 B2）

> 记录日期：2026-08-18
> 起因：用户反馈桌宠 Live2D 与聊天窗口挤在同一个透明窗里，聊天面板长期占用窗口下半、角色被压缩；主流桌宠（Sakura / daidai-live2d-pet / Live2DViewerEX 等）都是"角色常驻 + 聊天独立呼出"，角色永不遮挡、更沉浸。当前只有"放着不动"（`companion-ui-hidden` 空闲隐藏）或手动沉浸模式才进入纯角色形态。
> 方向确认（用户选择）：**B 真双窗口** + **悬停小胶囊 + 快捷键**呼出聊天。
> 架构结论：采用 **B2**——会话运行时/配音/Live2D 口型演化由角色窗独占，聊天窗是"历史视图 + 输入中继"，两者通过同源 localStorage 与桥事件协同，不复制任何流式/配音引擎。

## 一、现状要点（2026-08-18 实码核对）

- 桌宠 = 单窗口 `companion`：540×760、透明、无边框、置顶、任务栏隐藏，加载 `/companion` → `CompanionView.vue`（1199 行）+ `companion.css`（2066 行）。
- 桌面布局是 flex 三段：顶栏 / 立绘（`flex:1` 自适应）/ 对话面板（气泡+输入+语音+状态，静态块排在立绘下方）。立绘事实上不"被遮挡"，但对话面板与角色共享窗口空间 → 角色被压缩、不够沉浸。
- Live2D 渲染 = 独立 Rust overlay 窗（`aics_live2d_overlay`），按舞台 DOM 矩形定位（窗口本地坐标 + dpr，`fit_content` 保比例）。**窗口缩多小它就跟多小，不会挤变** —— 角色窗缩小零障碍。
- 桥 `window.companionDesktop`（Tauri shim 注入所有 webview）已具备 hide/show/置顶/鼠标穿透/openAtelier/通知/任务栏进度等；多窗口设施已存在（`atelier` 普通窗 1440×960，懒创建于 IPC）。
- **跨窗口历史同步已内置**：`useChatStorage`（`state` 是 `reactive`）在 `storage` 事件时按 mid 去重合并 `state.histories`（远端为基、本地独有追尾，零丢失），聊天窗只 `useChatStorage()` 即可实时显示会话历史。**该机制不复制 `active`/settings**（仍 last-writer-wins），角色切换需另设同步。
- CSP 按路由收紧（`server/security.js` 仅对 `/chat`、`/companion` 放行 `unsafe-eval`；路由守卫 `LIVE2D_PATHS`={/chat, /companion}）——**新增无 Live2D 的 `/companion-chat` 自动走严格 CSP、不触发整页刷新，服务端零改动**。

## 二、目标架构（B2）

```
┌─────────────────────────────────────────────┐
│ companion（角色窗） transparent, always-top  │
│   顶栏（简化：身份/好感/角色切换/设置齿轮）      │
│   + Live2D 舞台（ChatCharacterStage）        │
│   + 悬停「聊天」小胶囊 / 瞬态问候气泡          │
│   会话运行时独占：发送/流式/TTS 出声→口型/情绪/  │
│     视线/行为引擎(问候·勿扰·安静时段)/剪贴板    │
└─────────────────────────────────────────────┘
        ▲ send 中继（chat_relay 命令→事件）      │
        │ 历史由 storage 事件自动下行             │
        └──────────────────────────────┐
┌─────────────────────────────────────┐
│ companion-chat（聊天窗）独立普通小窗   │
│   气泡 150-160% 高度 + 输入 + 语音输入  │
│   角色切换 / 状态(回复中·配音中)        │
│   无 Live2D / 无 TTS 输出 / 严格 CSP   │
└─────────────────────────────────────┘
```

### 职责边界（硬约束）

| 能力 | 归属 | 理由 |
|---|---|---|
| 发送/流式/停止（useChatConversation） | 角色窗 | 单一运行时，杜绝双请求 |
| TTS 出声（useVoice） | 角色窗 | 出声→Live2D 口型/情绪零延迟同步 |
| Live2D 原生桥（`aicsLive2dNative`） | 角色窗 | shim 只给 `/companion` 注入 |
| Live2D 互动的 hit-test/动作组 | 角色窗 | 保持现有行为 |
| 语音输入（useVoiceInput）+ 语音会话状态机 | **聊天窗** | 聊天才说话；角色窗不再持有输入框 |
| 行为引擎（问候/勿扰/安静时段/剪贴板嗅探） | 角色窗 | 现有语义零改动 |
| 历史渲染 | 两窗共用 storage | 由 `useChatStorage` 自动同步 |
| 角色切换（active） | 角色窗权威，经 live 通道下发 | 单写者避免竞态 |

### 跨窗口通道（同源 http://127.0.0.1:PORT）

1. **历史下行（已有）**：`useChatStorage` storage 事件按 mid 合并 → 聊天窗 `useChatStorage()` 实时更新。
2. **实时状态下行（新增）**：角色窗把低频繁状态写 `localStorage['aics_chat_live']`（JSON：`{busy, thinking, speaking, activeChar, preview}`；仅在**状态迁移**或流式每 ~250ms 节流写入）。聊天窗 storage 监听读取 → 显示「回复中/配音中/刚收到」与流式尾巴。角色窗写入不触发本窗（storage 事件只跨窗触发，天然单向）。
3. **上行指令（新增）**：聊天窗 `invoke('chat_relay', { command: 'send'|'switch-character'|'open-atelier', ... })` → Rust 对窗口 `"companion"` `emit('aics:chat-command', payload)` → `CompanionView` 订阅后调用既有 `handleSend(text)` / `switchCharacter(id)`。
4. **active 同步（新增）**：聊天窗 watch `aics_chat_live.activeChar` 变化 → 调自己 `storage.setActive(id)` 切换渲染（角色窗是 `active` 权威写者，聊天窗单向下行，避免互相写）。

> 为什么不用"两个窗都拉全量 session"：每个 webview 会独立对网关发起同一 LLM 流式请求（无去重）+ 双份 TTS（配音播放层纪律会被打破）。必须单写者。

## 三、各窗口规格

### companion（角色窗）
- 尺寸：默认改为 320×520（沿用 `companion-window.json` 用户记忆值；只改 fresh defaults）。`min_inner_size` 放宽到 280×400。
- 内容：顶栏（简化：`companion-identity` 窄屏隐藏文本、保留好感胶囊、角色切换、设置齿轮）+ Live2D 舞台 + 悬停聊天胶囊。
- **桌面模式移除**整个 `companion-conversation`（气泡/输入/语音簇/状态）→ 改为：
  - 悬停胶囊 `.companion-chat-chip`（角色窗右下浮起：「聊天」），点击 `desktopBridge.openChat()`；`Space` 键在角色窗按下也改呼出聊天（原 hold-to-talk 上移到聊天窗）。
  - 主动问候（reminders）→ 角色旁的**瞬态短气泡**（自动淡出，事件类问候仍走原生 notify）。
  - 回复中/思考中 → 角色旁极小状态点（来自本窗运行时，非新通道）。
- 保留：行为引擎、剪贴板嗅探、全局目光跟随、鼠标穿透、置顶、`--hidden` 语义。
- 浏览器模式（无 `desktopBridge`，即 dev / E2E 裸跑 `/companion`）：**维持现有全量布局不变**，降低回归面。

### companion-chat（聊天窗，新增）
- 尺寸：默认 560×720，可调；`min 380×460`。`decorations(false)` 自定义迷你标题栏（复用 shim 的 `data-tauri-drag-region` 拖拽委托 + 关闭/置顶按钮）。
- 位置：首次在 companion 窗右侧展开（`companion_bounds.x + w + 12, companion_bounds.y`，超屏左移），随后记忆到 `companion-chat-window.json` 并纳入 `clamp_window_bounds` 与 `persist_window_bounds`。
- URL：`{gateway}/companion-chat`。懒创建（首开时 `spawn_blocking`，同 atelier 模式）。
- 内容：`CompanionChatView.vue` —— 只用 `useChatStorage()` + `aics_chat_live` + `chat_relay`；无 useVoice TTS、无 useCharacterRoomSession、无 Live2D。
- `CloseRequested`：同 companion 语义？不——聊天窗关闭 = 隐藏（保留常驻进程与状态），托盘可再开；允许直接关闭隐藏，等价 hide。快捷键再开。

## 四、触发方式

- **悬停胶囊**：角色窗 hover 显示「聊天」胶囊 → `open_chat`。
- **快捷键**：新增全局 `Ctrl+Shift+C` 开/关聊天窗（保留既有 Ctrl+Shift+Space 显示/隐藏角色窗、Ctrl+Shift+P 穿透、Ctrl+Shift+A 工作台）。
- **托盘**：「打开聊天」菜单项。
- **角色点击**：仍是互动动作（Tap 组）——**不**与呼出冲突（胶囊/快捷键/托盘是聊天入口）。

## 五、改动清单

### Rust（`desktop-tauri/src-tauri`）
- `window_state.rs`：新增 `companion-chat-window.json` 默认 bounds 常量（560×720 右置）+ 可选 `chat_window_file` 路径。
- `paths.rs`：新增 `companion_chat_window_file`（与 companion/atelier 文件同目录）。
- `main_shared.rs`：新增 `open_companion_chat(app, gateway_url)`（懒创建，仿 `open_atelier`）；`persist_window_bounds` 纳入 `"companion-chat"`。
- `bridge.rs`：新增 `open_companion_chat`、`chat_relay`（对 `"companion"` 窗 emit `aics:chat-command`）两个命令。
- `main.rs`：注册两命令；`start_gateway_monitor` 重启刷新列表加 `companion-chat`；快捷键 `ctrl+shift+c` → `open_companion_chat`。
- `tray.rs`：加「打开聊天」菜单项（emit `aics:open-chat`，main.rs 监听）。
- `watchers.rs`：`persist_window_bounds` 的窗口标签列表加 `companion-chat`（如涉及）。
- `shim.rs`：`companionDesktop` 暴露 `openChat()` 与 `onChatCommand(cb)`；`aicsLive2dNative` 注入条件（`/companion`）不变。

### 前端
- 路由：`src/router/index.ts` 加 `{ path: '/companion-chat', name: 'companion-chat', component: ...CompanionChatView }`（独立路由，不进 LIVE2D_PATHS）。
- 新增 `src/views/CompanionChatView.vue`：迷你标题栏 + 气泡 + 输入 + 语音输入 + 角色切换；`useChatStorage()` + live 通道 + `chat_relay`。
- 新增少量 CSS：`companion-chat 表面`（毛玻璃）、迷你标题栏拖拽区。复用 `companion.css` 既有气泡/输入样式变量。
- `CompanionView.vue`：桌面模式（`desktopBridge`）隐藏 `.companion-conversation`，新增悬停胶囊 + 瞬态问候气泡 + 状态点；订阅 `onChatCommand` 执行 send/switch；live 状态写 `aics_chat_live`。
- 类型：`src/types/desktop.d.ts` 扩展 `openChat`、`onChatCommand`、live 通道常量（`src/utils/storageKeys.ts` 加 `COMPANION_CHAT_LIVE_KEY`）。

### 服务端/CSP
- **零改动**：`/companion-chat` 不在 `live2dPage` 判定（strict CSP 生效）；路由守卫不触发整页刷新。

### 约束遵守（不得回退）
- 行为引擎（确定性台词、安静时段、勿扰、队列保留）、TTS 播放纪律、情绪通道优先级、Live2D 互动分区/眨眼/情绪运行时全部保持；角色窗仍是唯一 Live2D 宿主。
- `deploy-desktop-quick.ps1` 只搬运 `dist/`、`data/`、`assets/` —— Rust 改动需完整打包安装流程（`npm run build` → `build:tauri` → `package:tauri` → `setup /S`）。

## 六、E2E 与验证矩阵

- 更新 `tests/e2e/studio.spec.ts`「desktop companion」断言：桌面模式改为断言*无内嵌输入栏 + 有聊天胶囊*；新增 `/companion-chat` 用例（mock companionDesktop：openChat stub、chat_relay stub；断言历史来自 storage 注入、输入→relay 参数）。
- `interaction-polish.spec.ts` / `a11y-device.spec.ts` 若引用 companion 桌面 UI 顺带核对。
- 回归：`typecheck:app` + `build` + `validate` + 定向 E2E（studio.spec companion + chat windows）。
- 真机：完整打包安装后，双窗口分离、口型/情绪仍由角色窗驱动、聊天窗输入→角色回复→历史回显、悬停胶囊/快捷键/托盘三入口。

## 七、分阶段实施

1. Rust：聊天窗命令/窗口/托盘/持久化（引擎单测 `test-deep-link.js` 类比不涉及；`cargo test`）。
2. 前端：`/companion-chat` 路由 + 聊天窗视图（只读历史 + 输入中继）→ 可见"分离后"形态。
3. CompanionView 桌面改造：隐藏会话面板 + 悬停胶囊 + 瞬态问候 + live 状态下行。
4. 收尾：类型/常量、E2E 更新、deploy/打包验证。

## 八、2026-08-20 落地与真机验证（已完成）

实现与验证记录：

- **Rust**（`cargo check` 通过）：`paths.rs` 新增 `companion_chat_window_file`；`main_shared.rs` 新增 `companion_chat_bounds`（角色窗右侧 560×720 兜底 + `companion-chat-window.json` 持久化）、`open_companion_chat`（懒创建）、`toggle_companion_chat`，并纳入 `persist_window_bounds`/`watchers.clamp_windows`；`bridge.rs` 新增 `open_companion_chat`/`toggle_companion_chat`/`chat_relay`（聊天窗→companion 窗 emit `aics:chat-command`）；`main.rs` 注册命令 + 全局快捷键 `Ctrl+Shift+X` + 网关重启刷新列表 + `CloseRequested` 隐藏语义；`tray.rs` 加「打开聊天」；`shim.rs` 暴露 `openChat/toggleChat/chatRelay/onChatCommand`。
- **前端**：路由 `/companion-chat`；`CompanionChatView.vue`（迷你标题栏/气泡/输入/语音输入，`useChatStorage` + `aics_companion_chat_live_v1` 实时状态 + `chat_relay` 发送，不复制 TTS/流式引擎）；`CompanionView.vue` 桌面模式移除内嵌会话面板 → 浮层（聊天胶囊 + 陪伴中/回复中/配音中状态点 + 问候转瞬态气泡），`Space` 呼出聊天；`storageKeys` 登记 live 键；`desktop.d.ts` 补桥类型；顺带修 `DesktopTitleBar` 用 `location.pathname` 硬守卫。
- **验证**：`typecheck:app`/`build`(预算)/ESLint 0 错；归属 E2E 3/3 绿（桌面角色窗、聊天窗中继发送、Space 释放取消）；`test-storage-repositories`/`test-data-backup`/a11y 稳定通过。
- **已知既有失败（基线对照已证非本次引入）**：`/chat` 语音设置 `.check()` 不可见、`/companion` 语音布局几何断言、`test-storage-repositories`（指向 `useCharacterRoomSession.ts`，本会话未改、HEAD 同内容）——建议留待专门修复。
- **打包部署**：Rust 改动需完整打包——`npm run build:tauri`（release 59s）→ `package:tauri`（NSIS 安装包 `AI-CG-Studio_1.5.0_x64-setup.exe`）→ `setup.exe /S` 静默安装（UAC 自提升）。
- **真机验证**（应用已重启运行）：sidecar 网关 :3123 在听；`绫季 Companion`（角色窗）+ `绫季聊天` 双窗并存；`Ctrl+Shift+X` 可开关聊天窗（枚举窗口前后清单佐证）；窗口级截图 + `image-inspect` 复核——角色窗底部仅「聊天」胶囊/状态点/问候气泡（无输入框/无发送/无语音按钮），聊天窗为标准标题栏+气泡+输入+发送，两窗功能独立。
- 截图存档：`.review-shots/companion-dual/{companion-window,chat-window}.png`（工作区忽略目录）。

## 九、2026-08-20 上线后修复（用户反馈两问题）

> 记录格式：现象 → 根因 → 修复 → 验证（AGENTS.md 疑难留档约定）。

### 问题一：聊天窗点击 × 后显示空白白板

- **现象**：聊天窗点右上角 × 后，窗口变成整片纯白空白（无文字/输入框/按钮），而非隐藏；再次打开也空白。
- **根因**：聊天窗 × 直接 `window.close()`。该调用走 close 链路（CloseRequested → prevent + hide），但 WebView2 内容可能因此被卸载/白屏；且 `open_companion_chat` 复用已有窗口时只 `show()` 不重导航（atelier 是每次 open 都 `navigate`，所以从不空白）。
- **修复**：
  1. 新增 Rust 命令 `hide_companion_chat`（`main_shared.rs`/`bridge.rs`/`main.rs`）+ shim `hideChatWindow`：× 改为**直接 hide 窗口**，完全不触发 close/卸载链路；
  2. `open_companion_chat`/`toggle_companion_chat` 显示时**每次都 `navigate(url)` 重导航**（对齐 atelier）；
  3. `CompanionChatView.closeWindow` 改 `bridge.hideChatWindow()`（无桥时回退 `window.close()`）。
- **验证**：
  - E2E「companion chat window」新增断言：点 `.companion-chat-mini[aria-label="关闭聊天窗"]` → mock 记录 `hideChatWindow` 被调用（通过）；
  - 真机（已装包）走「热键开→关(hide)→再开」链路，开/再开两张 PrintWindow 截图均经 vision 复核为**深色聊天界面**（非空白）。

### 问题二：角色窗底部多个 UI 重叠（聊天胶囊/陪伴中/一条宽底框）

- **现象**：角色窗底部出现「💬 聊天」胶囊压住「陪伴中」再压住一条深色宽底框的三层重叠。
- **根因**：桌面模式互动提示条 `.live2d-interaction-hint` 原 `bottom:6px` 贴在窗口最底，与新加的浮层 dock（`bottom:12px`，含陪伴中＋聊天胶囊）在同一纵向带，视觉上挤成三层；角色窗移除内嵌面板后本就不再有对话面板垫底，提示条直接顶到浮层。
- **修复**：桌面模式提示条上移到浮层上方 `bottom:120px`（浮层 dock 顶 ≈86px，含一条问候气泡也不撞）。
- **验证**：安装包与运行中网关（:3123）下发的 CSS 已确认为 `html.companion-desktop .companion-page .live2d-interaction-hint{bottom:120px}`；浮层自身为 flex column + gap 8px，胶囊/状态点本就不重叠。

### 附：排查工具笔记（可复用）

- 捕获桌宠窗口：`scripts/maintenance/capture-window.ps1`（PrintWindow）；给子进程 PowerShell 传中文 `-Title` 会被按 ANSI 破坏，改用**进程过滤 + ASCII 匹配**自定义枚举（`GetWindowThreadProcessId` 限定 aics pid，聊天窗 = 中文标题且不含 Companion/Atelier）。
- 真机操作热键：脚本内 `keybd_event` 合成 Ctrl+Shift+X 可驱动 Tauri 全局快捷键。
- WebView2 二级窗口：`connectOverCDP` 只能枚举**第一个** webview（companion），其余窗口（chat/atelier）不暴露为 CDP page——不要走 CDP 驱动聊天窗，用 OS 层枚举验证。
- 排查聊天窗空白用「关闭→重开→PrintWindow 截图 + vision 复核」链路；透明角色窗 PrintWindow 常返回纯黑（webview 透明底），验证 UI 改走「已装包/运行网关 CSS 内容」+「用户截图视觉复核」。

## 十、2026-08-20 二轮修复：桥命令被 Tauri ACL 拒绝（真机回访，重要教训)

> 现象 → 根因 → 修复 → 验证（AGENTS.md 疑难留档约定）。

- **现象**：桌宠上点「聊天」胶囊，聊天窗不出现；但从系统底部图标/托盘/热键能打开，打开后点 × 又关不掉。
- **根因**：新桥命令（`open_companion_chat`/`toggle_companion_chat`/`hide_companion_chat`/`chat_relay`）**只注册了 `invoke_handler` 与 shim，却没进 Tauri v2 的能力白名单（ACL）**：
  - `src-tauri/build.rs` 的 `AppManifest::commands([...])` 没列入 → `tauri_build` 不会生成 `permissions/autogenerated/<cmd>.toml`；
  - `capabilities/default.json` 的 `windows` 也没加聊天窗 `companion-chat`（整窗无任何 capability 覆盖），`permissions` 也没加 `allow-open-companion-chat` 等。
  - 结果：前端 `invoke('open_companion_chat')` 等被拒，Conslo报 `Command open_companion_chat not allowed by ACL`。
  - 为什么之前没发现：**E2E 用 mock 桥（不真实走 IPC）测不到 ACL**；**热键/托盘走 Rust 直调**（`main_shared::toggle_companion_chat`/listener）不受 ACL 限制，所以"能开"；只会点胶囊（走 IPC）开不了、点 ×（走 IPC hideChatWindow）关不掉。
- **修复**：
  1. `build.rs` 命令清单补 4 个新命令；
  2. `capabilities/default.json`：`windows` 加 `"companion-chat"`，`permissions` 加 `allow-open-companion-chat`/`allow-toggle-companion-chat`/`allow-hide-companion-chat`/`allow-chat-relay`；
  3. 新增回归测试 `scripts/tests/test-bridge-acl.js`（进 `check` 套件）：断言 shim 所有 `invoke('...')` 命令 ⊆ build.rs 清单 ⊆ 至少一个 capability `allow-<kebab>` 放行，且 default windows 覆盖 companion/companion-chat/atelier。
- **验证**：`node scripts/tests/test-bridge-acl.js` 通过（38 命令全放行）；真机 CDP 点击「聊天」胶囊 → 聊天窗成功打开、Console 无 ACL 错；真机鼠标点聊天窗 × → 窗口隐藏；干净重启（无调试参数）交付。
