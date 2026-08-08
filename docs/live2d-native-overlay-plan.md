# Live2D 原生 overlay 渲染方案（路径 B）—— 前端契约与并行交付

> 记录日期：2026-08-08
> 背景：桌面端 Tauri 迁移与 Live2D 重构并行推进。浏览器端继续 wl-live2d 不动；
> 桌面端新增"原生角色图层窗口"后端：Rust 用 wgpu 直接向 WS_EX_LAYERED overlay
> HWND 呈现 Live2D，Cubism Native 官方运行时执行 motion/physics/pose/
> expression/hit-test。本文是前端侧并行交付的契约文档（Rust 侧实现以本文为准）。

## 1. 已交付（前端侧，2026-08-08）

| 交付物 | 位置 | 说明 |
|---|---|---|
| 后端抽象层 | `src/live2d/types.ts` | `Live2DStageBackend` / `Live2DStageSession` / `Live2DModelHandle` / `Live2DCapability` 双后端契约 |
| 浏览器后端 | `src/live2d/browserBackend.ts` | wl-live2d 从 useLive2D 平移封装，行为零改动（动态 import、app 创建、句柄包装、ticker、wrapper 缩放） |
| 原生后端 | `src/live2d/nativeBackend.ts` | 桥驱动实现；桥缺失时 connect reject `NATIVE_BACKEND_UNAVAILABLE` |
| 工厂与回退 | `src/live2d/createBackend.ts` | `selectLive2DBackend`：native 无桥自动回退 browser，`fallbackReason` 写 host dataset |
| 布局换算 | `src/utils/live2dOverlayLayout.ts` | CSS 矩形 → 屏幕物理像素（×DPR + 窗口原点）、多屏钳制、归一化坐标，纯函数可测 |
| IPC 契约 | `src/types/live2dNative.ts` | `window.aicsLive2dNative` 桥的命令/事件类型（Rust 侧按此实现） |
| 组件接线 | `ChatCharacterStage.vue` | `backend` prop（'auto' 默认：html `data-live2d-backend` / `?live2dBackend=` 解析） |
| 单测 | `scripts/tests/test-live2d-backend.js` | 20 用例：布局纯函数 / 工厂回退 / 原生会话契约 / 桥形状校验，已入 validate 链 |
| 内存测量 | `scripts/tests/measure-live2d-memory.js` | Playwright + CDP 量 WebView2 进程内存，验收"渲染移出 WebView2"的收益 |

`useLive2D` 按 `capability` 分派：浏览器路径保持原逻辑（blinkScheduler / MOUTH_PARAMS /
emotionRuntime 参数 hack 照旧），原生路径只发意图（口型电平、情绪名/强度、凝视、
动作组请求），参数级写入全部退役。

## 2. 双后端能力矩阵

| 能力 | 浏览器后端（wl-live2d，默认） | 原生后端（Rust overlay，路径 B） |
|---|---|---|
| 渲染 | Pixi + Cubism Web，WebView2 内 canvas | wgpu 直绘 WS_EX_LAYERED overlay HWND |
| 模型加载 | `GET /assets/live2d-current/...` 下载进 WebView2 | Rust 从本地资产读取（不经 WebView2 网络） |
| 眨眼 | `blinkScheduler` 逐帧覆写双眼参数（修作者眼曲线不同步） | 作者工程原生 EyeBlink，前端 hack 退役 |
| 口型 | MOUTH_PARAMS 参数映射（宁宁 OpenY / 夏目 MouthForm3） | `setMouthLevel(0..1)` 意图 → Rust lip-sync 执行 |
| 情绪 | emotionRuntime 参数表 + SoulLink 性能参数写入 | `setEmotion(name, intensity)` 意图 → Rust 执行 |
| 凝视 | DOM mousemove / 全局鼠标轮询 → focus / 参数回退 | `setGaze(-1..1)` 意图 → Rust 作者眼/头参数 |
| 点击命中 | DOM 分区（先）+ wl hitTest（兜底） | Cubism 原生 HitArea（作者在 moc3 画的命中区），事件回传 areas |
| 入场/告别 | `playEntrance` 探测 Start 组 / disable 播 Leave | Rust 接管（entranceNative），前端不干预 |
| 换装 | `model.expression(expression1-5)`（宁宁衣装） | `setExpression(name)` → Rust（夏目无 Expressions 由 Rust 拒绝） |
| 帧率/暂停 | Pixi ticker stop / maxFPS | `setFrame(visible)` / 渲染循环由壳控制（O8 电池降帧契约预留） |
| 舞台位置 | DOM wrapper transform + canvas fit | `updateOverlay(rect, visible)` 屏幕物理像素 → SetWindowPos |
| context lost | webglcontextlost/restored 绑定 canvas | 不适用（无 WebGL） |

## 3. 桌面端退役清单（原生后端生效后）

以下模块/路径在原生后端下不再执行，但**浏览器端必须保留**（浏览器仍是默认与兜底）：

- `blinkScheduler` 在 `applyParameters` 的写入分支 —— 原生分支直接跳过
- `MOUTH_PARAMS` / `BLINK_PARAMS` 参数映射 —— 原生分支只发 `sendMouthLevel`
- `emotionRuntime` 的参数表写入 —— 原生分支只发 `sendEmotion(lastEmotion, intensity)`；
  emotionRuntime 本身仍运行（计算强度），不删文件
- DOM `click` 互动绑定 —— 原生分支改绑 `onNativeHitTest`（overlay 会截走鼠标）
- `playEntrance` 探测 Start 组 —— 原生分支由 Rust 接管
- `bindMouthOverride`（beforeModelUpdate 钩子）—— 原生分支不绑定

**不退役**：`live2dNativeAdapter`（SoulLink 原生动作 allowlist）在浏览器路径继续使用；
`NATSUME_HIT_AREA_MAP` 映射表在原生 hit-test 回传时同样使用（中文 HitArea → 互动键）。

## 4. IPC 契约（Rust 侧实现依据）

通道：Tauri command 前缀 `aics_live2d_*`；Rust → 前端事件 `aics:live2d:*`。
注入：initialization script 创建 `window.aicsLive2dNative`（与 companionDesktop 同机制）。

**命令**（前端 → Rust）：

| 命令 | 参数 | 语义 |
|---|---|---|
| `setCharacter` | `modelPath`（仅白名单资产）、`character` | 创建/切换模型；失败返回 `{ok:false,error}` |
| `setFrame` | `{ rect:{x,y,width,height}, visible, opacity }` | overlay 定位与可见性（屏幕物理像素） |
| `playMotion` | `group, index?, priority:'idle'\|'normal'\|'force'` | 播放动作；FORCE 打断 idle |
| `setExpression` | `name` | 宁宁衣装 Expression；夏目拒绝 |
| `setMouthLevel` | `0..1` | 口型意图（Rust 映射作者 lip-sync 参数） |
| `setEmotion` | `name, intensity 0..1` | 情绪意图 |
| `setGaze` | `x,y ∈ -1..1` | 凝视意图 |
| `hitTest` | `x,y ∈ 0..1`（overlay 相对） | 原生 HitArea 查询（当前由点击事件路径驱动，保留为显式查询能力） |
| `destroy` | — | 释放模型与 overlay |

**事件**（Rust → 前端）：`onReady`、`onMotionStarted{group,index?}`、
`onMotionFailed{group,index?,reason}`、`onHitTest(areas)`、`onEntranceFinished`、`off(id)`。

**坐标系约定**：overlay 矩形一律屏幕物理像素；前端换算
（`live2dOverlayLayout.computeOverlayRect`）：
`screen = windowBounds + stageRect × dpr`。窗口 bounds 优先用 Rust 注入的
物理坐标；暂用 `window.screenX/Y × dpr` 兜底（DPR=1 时精确，DPR>1 时是
近似值，Rust 桥就绪后替换）。

**渲染生命周期建议**（给 Rust 侧）：`setFrame visible=false` 时暂停渲染循环并
隐藏 HWND；模型仅由 `setCharacter` 创建，同一角色重复调用应复用实例；
`destroy` 幂等。

## 5. crate 调研结论（运行时选型支持）

| 维度 | cubism-rs（Veykril） | live2d-rs（sena-nana） | live2d-cubism-core-sys（裸 FFI） |
|---|---|---|---|
| 绑定 SDK | Cubism SDK Native 4-r.5.1（偏老，2023 前后） | Cubism SDK Native v5（`LIVE2D_CUBISM_SDK_DIR` 指向本地 SDK） | Cubism SDK Native v5（手写绑定，非 bindgen） |
| 封装深度 | framework 级：motion/physics/expression/pose/hit-test 齐 | facade 提供 model API：motion/expression/focus/mouth；runtime 层手动步进 physics/pose/expression | 仅 Core ABI（moc/model/参数/部件/drawable），framework 逻辑自研 |
| wgpu 渲染 | 无自带渲染器（需自研或接现有渲染层） | `live2d-wgpu` 现成渲染器 + WGSL | 无 |
| hit-test | CubismNativeModel 有 isHit 封装 | 依赖 Core drawable 顶点查询（有 ArtMesh inspect/diagnostics，可自封装 isHit；"作者 HitArea"需要读 model3.json 的 HitAreas 表，与文档契约对齐） | 需自研 |
| expression | 支持（含 fade） | 支持（`exp3` feature，按 model3.json 名字 + FadeInTime/FadeOutTime） | 需自研 |
| 风险 | SDK 版本老：宁宁/夏目 moc3 若为 Cubism 4.2+ 导出可能不兼容 | 需确认已测 SDK 5-r.x 版本与 mo3/moc3 兼容性；hit-test/expression 完整性仍待验证（文档自述"待验证"） | 工作量最大，但 ABI 面最可控 |
| 许可证 | SDK 自带许可（非 MIT），需用户自备 Core | 同左（不自带 SDK，需 `LIVE2D_CUBISM_SDK_DIR`） | 同左 |

**结论建议**：
1. **首选 live2d-rs**（v5 + wgpu 现成），P0 先验证两件事：① 宁宁/夏目
   `moc3` 的 Cubism 版本兼容（在 SDK 5-r.x 下 `csmReviveMoc` 成功）；②
   `model3.json` HitAreas 表解析 + isHit 等价实现（有 ArtMesh 顶点即可，
   Live2D 官方文档给出 `CubismUserModel::IsHit` 矩形扫描算法）。
2. cubism-rs 作为 SDK 4 回退；裸 FFI 只在上述两者都失败时启用。
3. 两模型均为 Live2DViewerEX 导出包（无源工程），moc3 版本可能在 4.x-5.x
   之间；P0 用 `csmGetVersion` 实测决定。
4. hit-test 若原生不可用，回退路径已保留：前端 DOM 分区 + 事件回传设计
   （`onHitTest` 的回传 areas 可空数组，前端此时回退 DOM 分区需 Rust 转发
   原始点击坐标——契约预留 `onHitTest(areas)` 之外不强制）。

## 6. 待 Rust 侧接入后的前端动作

- `window.aicsLive2dNative` 注入后，`?live2dBackend=native` 或
  `data-live2d-backend="native"` 即启用原生路径（无需改代码）
- 窗口 bounds 由桥注入后替换 `windowBoundsFromScreen` 兜底实现
- `measure-live2d-memory.js` 对桌面双后端跑前后对比验收内存收益

## 7. 不做

- 不改浏览器端 wl-live2d 行为（默认后端，E2E 断言全绿为证）
- 不伪造 Live2D 动作/换装/情绪（维持现有 allowlist 约束）
- 不把情绪参数表搬进 Rust（只传意图，参数执行权归作者工程）

## 8. 遗留与待办（2026-08-08 交接）

- **提交**：本批前端侧交付（`src/live2d/`、`src/types/live2dNative.ts`、
  `src/utils/live2dOverlayLayout.ts`、`docs/live2d-native-overlay-plan.md`、
  `scripts/tests/test-live2d-backend.js`、`scripts/tests/measure-live2d-memory.js`、
  及 `useLive2D.ts`/`ChatCharacterStage.vue`/`tsconfig.app.json`/`package.json`/
  `test-chat.js`/`studio.spec.ts` 的修改）**尚未提交**；工作区内还有他人未提交的
  desktop-tauri 迁移与 server.js 改动，提交前需确认归属与范围。
- **全量兜底**：已完成定向验证（typecheck / build / Live2D E2E 7/7 / 相关单测
  65 用例全绿）；尚未跑 `npm run validate` 全量（按质量门槛小改可不跑，
  但提交前建议跑一次）。
- **Rust 侧接入**：桥按 `src/types/live2dNative.ts` 实现并注入
  `window.aicsLive2dNative` 后，`?live2dBackend=native` 或
  `data-live2d-backend="native"` 即启用原生路径，前端无需再改。
- **窗口 bounds 替换**：`windowBoundsFromScreen` 目前用
  `window.screenX/Y × dpr` 兜底（DPR>1 是近似值），Rust 桥就绪后应改由桥注入
  物理像素窗口 bounds。
- **内存收益验收**：Rust overlay 完成后跑 `measure-live2d-memory.js` 与
  本批基线（JS heap ~30MB）对比。
