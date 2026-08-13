# Live2D 原生运行时

> 更新：2026-08-10
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
- Win32 `SetWindowRgn` 的 region 坐标必须相对 overlay 左上角；模型区域减去 WebView 控件穿透孔后再提交。空交互区域必须提交真正的空 region，不能用 `NULL` 恢复完整窗口区域。
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
- `node scripts/tests/test-live2d-backend.js`：21/21；`node scripts/tests/test-live2d-native-contract.js`：3/3。
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


## 2026-08-13 Companion 陪伴表现与凝视平滑

- 前端新增纯 TS `companionPresence.ts`，把可见性、勿扰/安静时段、聆听、思考、说话、输入中与主动提醒归一为确定性 presence；只驱动舞台光和状态提示，不新增 LLM/TTS 调用，也不触发未验证 motion/expression。
- `CompanionView` 将 presence 下发到 `ChatCharacterStage`，输入聚焦显示“在听你说”，回复中/工具调用显示思考，TTS 播放显示说话，主动提醒显示 reaching-out；reduced-motion 只保留短淡变。
- `useLive2D` 的窗口内与全局鼠标不再逐事件直写 focus/bridge，而是只更新凝视 target，由单一 RAF 以指数响应平滑追随；窗口外凝视钳制为 `0.82`，DOM 离开且无全局接管或窗口隐藏时自然回中。
- `nativeBackend.ts` 对 `setGaze` 增加 latest-wins 背压：桥调用未完成时只保留最新目标，避免高刷新鼠标输入积压 Tauri command。Rust overlay 无需新增参数、动作或 IPC，只继续接收现有 `setGaze(x, y)` 意图。
- 验证：Companion/Live2D/Native contract 定向单测 42/42，`npm run typecheck:app`、`npm run build` 通过；浏览器实测 1280×720 与 768×900 均无横向滚动，状态提示与左侧角色切换、右侧 Live2D 状态不重叠。
