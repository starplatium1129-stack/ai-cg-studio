# Live2D 原生运行时

> 更新：2026-08-14
> 范围：Tauri 2 Native overlay、Cubism Native renderer、前端双后端接入和当前发布限制。

## 当前结论

Native 路径已完成产品链路和 renderer 收口，但仍是桌面发布门禁的一部分，不替代浏览器路径，也不能在 D-10 完成前称为正式发布版本。浏览器默认使用 `wl-live2d`；Companion 可见启动时才按桌面契约请求 Native，`--hidden`、隐藏窗口和用户显式关闭时不得下载或加载大模型。

宁宁与夏目 Native release snapshot 的角色完整性、动作、口型、情绪、hit-test、mask、透明度和颜色均通过人工检查。与 wl-live2d 对照时，同一动画帧的姿势、构图和部件完整性一致；剩余明度/饱和度差异属于校准级差异，不是结构缺陷。

## 架构与链路

```text
ChatCharacterStage / useLive2D
  -> src/live2d/browserBackend.ts | nativeBackend.ts
  -> window.aicsLive2dNative
  -> Tauri shim / bridge
  -> desktop-tauri/src-tauri/src/live2d_overlay.rs
  -> desktop-tauri/native-live2d
  -> Cubism Core + official Framework + wgpu
```

- `types.ts` 定义 stage/session/model/capability 契约；`createBackend.ts` 在 Native bridge 缺失时回退 browser，并标记 `data-backend="browser-fallback"`。
- Browser 路径保留 wl-live2d 的参数级眨眼、口型和情绪运行时；Native 路径只发送意图，不复制浏览器参数 hack。
- Native renderer 由官方 Cubism SDK for Native 5-r.5、C++ glue、Rust FFI、`model.rs`、`renderer.rs` 和 WGSL shader 组成，负责动作、物理、pose、眨眼、hit-test、mask、混合和透明目标。
- overlay 为独立线程的透明 Win32 窗口；壳负责窗口生命周期、命令队列、事件和布局，renderer 负责模型和 GPU 资源。

## IPC 与坐标契约

- 公开意图包括 character、frame/bounds、motion、expression、mouth level、emotion、gaze、hit-test、visibility、max FPS、snapshot 和 destroy；事件包括 ready、motion started/failed、hit-test、entrance finished 和 visibility。
- `src/types/live2dNative.ts` 与 `docs/live2d-native-overlay-plan.md` 是 IPC 公共契约；新增命令沿用 typed command/reply，不暴露任意路径、参数或执行能力。
- overlay 矩形一律使用屏幕物理像素。CSS rect、窗口原点和 DPR/视口实测比例的换算集中在 `src/utils/live2dOverlayLayout.ts`。
- Native overlay 固定在透明 Companion WebView 下方并使用 `WS_EX_TRANSPARENT`；`setFrame` 只传 Companion-local 物理矩形，Rust 每帧用实时 HWND 位置跟随，避免首次旧 bounds 和拖动事件延迟。WebView 舞台将归一化点击坐标经 IPC 送到 Cubism HitArea。禁止恢复 `SetWindowRgn` 控件挖洞方案：Win32 region 会同时裁剪 DirectComposition 可见画面，在角色头发、手部和脚部留下矩形缺口。
- Native 状态查询是只读的；未初始化查询不得创建窗口、加载模型或启动渲染线程。重复 connect/destroy 必须清理 listener 和 motion 订阅。
- 动作组不固定使用变体索引 0；同一动作正在播放时返回 busy，前端显示“动作进行中”而不强制重启。

## 模型特殊契约

- 宁宁：Native 口型 level `0..1` 映射 `ParamMouthOpenY`；author motions、表达式、物理和衣装由模型工程控制。`expression1` 至 `expression5` 是校服、常服、睡衣、COS 服和魔女服，只能由显式衣装控件切换，不当作情绪。
- 夏目：单一作者导出态，只有咖啡店制服，没有可公开选择的 Expressions 或独立衣装模型。不得按连续参数编号猜衣服、手动驱动 `Param36-75`、强制 Drawable opacity 或把 motion 内部叠层当作衣橱。
- 夏目没有 `ParamMouthOpenY`；口型 level `0..1` 映射 `ParamMouthForm3` 的 `0..-0.5`，真实音频桌面回归仍需 GPT-SoVITS 可用环境。
- 夏目源 LPK 的 `fileId`/`metaData` 与仓库 moc3、物理和 41 个原生 motion 已完成一致性复核；41 个 motion 共含约 750 条 `PartOpacity` 曲线，曲线值恒为 `1`，因此曲线存在性不能推断衣装开关。
- 夏目 `Param36-61`、`Param62-64`、`Param65-75` 是 moc 内部图层/动画通道；不得按连续 Part 分组或手写 opacity。临时制服/叠层效果必须由完整 authored motion 驱动，否则会产生重复制服、白色遮罩或鞋腿串层。
- 互动组必须交给 Cubism 选择已导入的原生 motion 变体，不得固定 index `0`；衣装/叠层效果也随完整 motion 保持其参数曲线。
- 参数写入时序必须在 `model.update(dt)`、motion/physics/pose 和 Core drawable 更新之后，避免动作曲线覆盖口型、情绪和凝视意图。

## Renderer 不可回退的约束

- HWND surface 强制使用 DX12；窗口先 `ShowWindow(SW_SHOWNA)` 才能稳定枚举 DXGI formats，renderer pipeline format 必须与 surface format 一致。`SetCharacter` 前先建立 surface。
- 每个 drawable 使用独立 uniform slot 和 dynamic offset；layout 必须声明 dynamic offset，stride/offset 按 wgpu 对齐要求计算，不能让所有 draw 共享最后一次写入的 uniform。
- Live2D 导出纹理的 V 坐标必须统一 `uv.y = 1 - uv.y`，主 pass 和 mask pass 相同；纹理上传使用 premultiplied alpha，blend 采用 premultiplied over，颜色目标使用 sRGB 语义。
- mask source 即使不作为独立可见部件仍按 Cubism 语义渲染；主循环不能错误过滤同时充当 mask source 的普通 drawable。mask 采样使用 clip 空间坐标，不能误用 drawable texture UV。
- 模型级 geometry、UV/index buffer、texture/mask bind group、uniform、动态 upload buffer 和 CPU snapshot 必须缓存；首帧预热全部 drawable/mask，运行帧不创建静态 GPU 资源。
- 换角色和 destroy 必须释放 geometry、mask、uniform、upload、纹理和 CPU scratch。零长度/null FFI 数据必须 checked，不能构造未定义的 slice。
- Surface `Lost`/`Outdated` 立即 reconfigure 且不计为成功帧；Timeout 跳帧，OutOfMemory 终止渲染循环。Soak 固定 DX12、剥离 `L2D_*` 调试环境并验证角色切换、最小工作量和最终释放。

## 验证证据

- `cargo test --locked --manifest-path desktop-tauri/src-tauri/Cargo.toml`：13/13。
- `npm run test:live2d-native:release`：3/3 snapshot，exit 0；真实加载宁宁/夏目并覆盖动作、口型、情绪、hit-test 和 PNG。
- `node scripts/tests/test-live2d-backend.js`：24/24；`node scripts/tests/test-live2d-native-contract.js`：5/5。
- renderer release soak 命令使用 800x800、165 FPS、300 秒、每 60 秒切角；约 47,960 帧、4 次切换、`render_fps=164.3`。预热后无静态资源随帧创建，Working Set/private/GPU 首末差在阈值内，最终资源释放通过。
- 可见 Companion 人工回归覆盖 cold start、窗口 move/resize、透明区域穿透、Live2D 关闭/恢复、宁宁/夏目 hit-test、重复动作 busy 和隐藏；当前环境中窗口保持 ready。

## 外部参考与工作纪律

- `AyagamiDev/ayagami`：已通过 `api.github.com` 验证存在，用于 wgpu mask、premultiplied alpha 和混合语义对照；不是本项目的运行时依赖。
- `pixi-live2d-display` 与本地 `wl-live2d` Cubism renderer：用于官方 mask channel、layout matrix、shader 和 blend 语义对照。
- `Veykril/cubism-rs` 仅作旧版 4-r.5.1 绑定参考；`sena-nana/live2d-rs` 曾被验证为 404，不得再引用不存在的仓库。
- 遇到同一问题连续两次实验无效时，先用 `api.github.com` 验证来源真实性，再查官方文档、issue 或已验证实现；禁止继续盲猜 renderer 行为或自造 IPC 语义。

## 当前限制与接入点

1. D-10 真实安装产品验收仍 BLOCKED：当前会话缺少管理员权限，GPT-SoVITS 离线，只有 100% 单屏，125/150% DPI、多屏、真实安装/迁移/卸载和 self-hosted Windows workflow 尚无完整证据。
2. renderer selftest 和 renderer soak 不能替代安装包产品链路；D-10 还必须验证资源路径、窗口对齐、真实 TTS 口型、隐藏/恢复和 300 秒安装产品稳定性。
3. 夏目 `ParamMouthForm3` 的真实 TTS 桌面回归仍待环境恢复；离线映射 contract 已通过，不得据此宣称真实音频已验收。
4. 30 分钟 soak 是发布前可选强化；当前固定 Windows Native gate 是 300 秒，不应加入无 GPU 的默认 `validate`。
5. 后续接入只使用 `src/types/live2dNative.ts`、`live2d-native-overlay-plan.md` 和公开 backend API；不得把参数级 hack、源项目 WAV 或未验证 motion/expression 当作新能力。

## 2026-08-14 契约收尾：destroy 长期复用正式化 + IPC 命令清单锚点

- **destroy 契约统一**：`clear_model_state` 提取为 SetCharacter 前置与 Destroy 共用的"清模型状态"函数；Destroy 只清模型级状态（model_ready/character/model_bounds/口型诊断），**保留** window_ready/renderer_attached/cmd_tx——渲染线程与窗口长期复用，前端 destroy 后重新 `setCharacter` 直接复用 wgpu 上下文，不重建线程；线程退出路径（窗口销毁/通道断开/致命错误）才广播 `aics:live2d:stopped`，destroy 不触发。Rust 单测 `destroy_clears_model_state_but_keeps_thread_for_reuse` 锁定该契约。
- **Tauri command origin 校验**：契约测试新增「Native IPC command inventory」——11 个 `aics_live2d_*` 命令在 build.rs app_manifest / main.rs invoke_handler / capabilities 权限三处必须一一对应（防漂移），且 capabilities 只允许 Companion 窗口 + `http://127.0.0.1:*` 本机回环来源。
- 验证：`cargo test --locked` 16/16（新增 destroy 契约单测）、`test-live2d-native-contract.js` + `test-live2d-backend.js` 29/29、unit 全量 319/319、test-chat.js 通过、release selftest 3/3 快照。
- 多屏/高分屏验证项（monitor work area、多屏混合 DPI）：本项目为个人单屏本地使用，当前无多屏环境；代码层已做进程级 per-monitor v2 DPI awareness 与物理像素坐标跟随，理论正确。此两项不阻塞个人使用，仅在将来于多屏机器上运行时按"验证证据"清单复核即可（见文末）。

## 2026-08-13 壳侧：渲染线程 stopped 事件与进程级 DPI awareness

- `live2d_overlay.rs` 新增 `emit_stopped`：渲染线程任何异常退出路径（窗口创建失败、render context 初始化失败、render frame 错误、命令通道断开）都会广播 `aics:live2d:stopped`（payload `{reason}`）并清理 ready/attached/starting 状态，前端据此显示"渲染已停止"并可重试重新拉起线程；正常 `destroy` 命令不退出线程，不触发本事件。
- `main.rs` 在 `tauri::Builder::default()` 之前（进程最早期、任何窗口创建前）设置 per-monitor v2 DPI awareness，失败回退 system-aware——覆盖 Companion WebView 窗口创建时机，不再只依赖 overlay 线程内的设置。
- `shim.rs` 新增 `onStopped` 订阅；`src/types/live2dNative.ts` 契约新增 `onStopped(listener)`。
- `nativeBackend.ts` 新增 `NATIVE_RENDER_STOPPED` 错误名与 `errorListeners`：`onStopped` 事件转发为 `onModelError`（`error.name = NATIVE_RENDER_STOPPED`），`useLive2D` 识别该错误名后显示"Live2D 渲染已停止"（degraded + retryable），与"动作/换装失败但模型仍显示"的退化路径区分；destroy 时清理。
- 验证：`cargo test --locked --manifest-path desktop-tauri/src-tauri/Cargo.toml` 15/15（含本批 stopped 补丁的编译证据，08-13 竞态补丁此前缺编译验证，本次已补齐）；`test-live2d-backend.js` + `test-live2d-native-contract.js` 27/27；`test-chat.js` 通过。
- 环境备注：本机 Rust 工具链实际位于 `C:\Users\Administrator\.cargo\bin`（PATH 未含）；`cargo test` 需要 `src-tauri/binaries/node-x86_64-pc-windows-msvc.exe`（externalBin sidecar，gitignore）与 `src-tauri/resources/`（`node scripts/maintenance/desktop-stage-resources.js` 生成，gitignore）就位；`npm_execpath` 指向 pnpm 时会破坏暂存脚本的 npm ci，需 `Remove-Item Env:npm_execpath` 后用内置 npm-cli.js。
- 仍未处理的发布风险（需真机/多屏环境）：真实 monitor work area、多屏混合 DPI、Tauri command origin 校验（capabilities 已限 Companion 窗口 + 127.0.0.1）、`destroy` 长期复用 vs 完整退出线程的契约统一（当前实现为长期复用：释放模型、保留线程，前端 destroy 后可重新 setCharacter）。

## 2026-08-13 接手收尾：工作区遗留改动盘点与修复

- **窗口 bounds 注入收尾**：`desktopWindowBounds` 提升为模块级窗口状态（Companion 单窗口），`windowBoundsFromScreen` 优先返回注入 bounds、未注入时回退 `screenX × dpr`；删除 useLive2D 函数内的重复声明，`layout()` 在 bounds 注入前暂停原生 overlay（不猜首帧）。`test-live2d-native-contract.js` 的 `setDesktopWindowBounds`/`desktopWindowBounds = null` 断言保持成立。
- **setOutfit 夏目分支还原**：恢复"夏目只有咖啡店制服、无 Expressions、不得调用 expression"的既有契约（工作区残留版本错误调用 `model.expression(target.expression)`，类型不通过且违反角色契约）。
- **AICS_DESKTOP_PACKAGED 注入口径**：`AICS_DESKTOP_PACKAGED` 仅由 Tauri 壳打包模式注入（`main_shared.rs` gateway_env；dev 模式不注入），维护路由 501 契约与 test-gateway-contract 锚点不变。
- **训练脚本修正**：`prepare_nene_anima_v20.py` 保留 08-13"统一训练、不分区隔离 r18"决策（train/validation 两分区），但恢复 `safety_tag` 按真实内容分级（safe/sensitive/nsfw/explicit，遵守 `anima-training-record.md` 的长期协议节，原 `anima-reproduction-protocol.md` 于 2026-08-14 并入）与 R18 样张的 `nene_r18` 评级词。
- **视觉基线还原**：`design-system.css` 圆角/阴影 token 与 `companion.css` 身份卡样式还原到 DESIGN.md §Shapes（8–24px 阶梯）基线——工作区残留版本把圆角收到 4–16px、阴影减半，与 08-01 已提交的"博客式二次元圆润感"决策和 DESIGN.md 冲突且注释未同步。
- **实验残留清理**：删除 `test-grok-46.js`（含明文 API key），移除仅为该脚本添加的 `@ai-sdk/openai`、`ai`、`jsonc-parser` 依赖（package.json / package-lock.json 还原）。
- **E2E 漂移修复（6be3a95「受控路线」遗留）**：已提交的绘图页"系统自动选择引擎路线"（basic 模式默认 Anima + V20B，engine-switch/baseModel/SD 参数 pro-only）使 studio/flows/anima-quick 十余个用例红：
  - `mock-stack.js` 补 V20B LoRA fixture（`ayachi_nene_v20_anima_scientific_b_e16.safetensors`），否则 Anima 引擎在测试环境 offline、badge 恒 offline；
  - flows.spec.ts：`openGenerationSettings`/新增 `switchToSdEngine` helper 先切专家模式 + SD 引擎；flow-1/1b/1c/4/6d 前置切引擎；flow Anima 先切专家模式；flow-6/6f 断言适配受控路线（Anima exact-token、comfy latent 832×1216 + V20B LoRA、SD quick key 不被 Anima 污染）；
  - studio.spec.ts：basic 断言 `#baseModel` 隐藏 + `.managed-route-card` 可见，专家模式切 SD 后再断言 `<lora:`/`[NEG]`；
  - anima-quick.spec.ts：全部用例在点 engine-switch 前切专家模式；请求角色断言 `nene` → `nene_b`（V20B 变体，6be3a95 预期行为）。
- **多根组件修复（route-view class 丢失）**：GalleryView/SceneExplorerView 的根级 `<Teleport>` 使组件多根，Vue 不向多根组件继承 fallthrough attrs，`AppLayout` 注入的 `route-view` class 丢失 → `#main .route-view` 不可见、repeated-navigation 用例失败。把 Teleport 移入根 `<article>` 内（仍渲染到 body，行为不变），恢复单根；ShowcaseView 原本就是单根，不受影响。验证：interaction-polish.spec.ts 7/7。
- **导航动效测试逻辑修复**：interaction-polish「archive icon」用例在 `goto('/scene-explorer')` 后 dispatch click 到同路径链接——vue-router 判定 duplicated 导航不执行 beforeEach，`data-route-motion` 永不更新。改为从首页直接 SPA 导航（探测证实：首页导航 seen=["","standard",""]，同页重复导航 seen=[""]）。验证：interaction-polish.spec.ts 7/7。
- 验证：`typecheck:app`、`typecheck`、`npm run build`（bundle 预算绿）全通过；live2d/chat/prompt-compiler/showcase-candidate/control-failure 等 72 单测全绿；E2E studio + flows 16/16、anima-quick 15/15、interaction-polish 7/7、**全量 226/226 通过**。

## 2026-08-13 启动竞态修复

- `live2d_overlay.rs` 新增 `starting` 原子门控；并发 `ensure_overlay()` 只允许一个 Win32 overlay/render thread 进入启动流程。
- `window_ready` 延迟到 `RenderContext` 成功建立后设置；窗口创建、renderer 初始化、命令通道断开、致命 render error 与消息循环退出统一销毁 HWND 并清理 ready/attached/starting/channel/model 状态，后续调用可重新启动。
- JS/源码契约验证：`test-live2d-native-contract.js` 3/3、`test-live2d-backend.js` 21/21。当前机器没有 `cargo`/`rustfmt`，因此本次 Rust 增量尚未重新执行 `cargo fmt` 与 `cargo test --locked`；上方历史 13/13 不能冒充本次补丁的 Rust 编译证据。
- 仍未处理的发布风险：真实 monitor work area、多屏混合 DPI、进程最早期 DPI awareness、renderer stopped/error 前端事件、Tauri command origin 校验，以及 `destroy` 是长期复用还是完整退出线程的契约统一。

## 2026-08-13 Companion 陪伴表现与凝视平滑

- 前端新增纯 TS `companionPresence.ts`，把可见性、勿扰/安静时段、聆听、思考、说话、输入中与主动提醒归一为确定性 presence；只驱动舞台光和状态提示，不新增 LLM/TTS 调用，也不触发未验证 motion/expression。
- `CompanionView` 将 presence 下发到 `ChatCharacterStage`，输入聚焦显示“在听你说”，回复中/工具调用显示思考，TTS 播放显示说话，主动提醒显示 reaching-out；reduced-motion 只保留短淡变。
- `useLive2D` 的窗口内与全局鼠标不再逐事件直写 focus/bridge，而是只更新凝视 target，由单一 RAF 以指数响应平滑追随；窗口外凝视钳制为 `0.82`，DOM 离开且无全局接管或窗口隐藏时自然回中。
- `nativeBackend.ts` 对 `setGaze` 增加 latest-wins 背压：桥调用未完成时只保留最新目标，避免高刷新鼠标输入积压 Tauri command。Rust overlay 无需新增参数、动作或 IPC，只继续接收现有 `setGaze(x, y)` 意图。
- 验证：Companion/Live2D/Native contract 定向单测 42/42，`npm run typecheck:app`、`npm run build` 通过；浏览器实测 1280×720 与 768×900 均无横向滚动，状态提示与左侧角色切换、右侧 Live2D 状态不重叠。
