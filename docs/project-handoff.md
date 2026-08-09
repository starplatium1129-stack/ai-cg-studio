# AI-CG-Studio 项目交接文档（全站现状）

> 生成日期：2026-08-08（本会话汇总）
> 用途：交给 SOL（GPT-5/6）基于此文档制定下一步方案，再分配各协作者执行。
> 范围：**整个网站 + 桌面应用**，不只是 Live2D。
> 阅读建议：先看 §1 总览 → §2 代码地图 → §3 各工程线状态 → §4 已踩坑 → §5 剩余项/决策点。

---

## 1. 项目总览

**定位**：本地个人使用的 Galgame 风格 AI CG 创作台。角色（宁宁/夏目）聊天 + Live2D 演出 + 配音（TTS）、场景/词条驱动的 SD 出图（绘图页）、LoRA 训练台、场景库与展示集、桌面伴生应用。

**技术栈**：
- 前端：Vue 3 + Vite + TypeScript + Pinia（入口 `index.html`，全部路由懒加载）
- 网关：Express（`server.js` + `routes/`），`services/*.ts` 编译为 `.js` 供运行时使用
- 数据：`data/*.json`（场景库分片、角色、词条、LoRA），`DATA_VERSION` 内容哈希版本化
- 浏览器存储：IndexedDB（`useKVStore`/`useImageStore`/`useBackup`）+ localStorage（`storageKeys.ts` 唯一登记处）
- 桌面壳（双线并行开发中）：
  - **Electron 版**（既有）：`desktop/` + `desktop-dist/`，仍可用
  - **Tauri 2 版**（迁移中）：`desktop-tauri/`，P0-P5 完成
- 本地服务：SD WebUI（SD_HOST）、ComfyUI（COMFY_HOST，anima 引擎）、GPT-SoVITS TTS、Ollama/OpenAI-compatible 聊天供应商

**测试体系**：
- `npm run validate`：约 60 个 node 单测（scripts/tests/）+ 样式/内容/契约检查链
- `npm run test:e2e`：Playwright 约 190 用例（`tests/e2e/*.spec.ts`），全量须 `--workers=3`（AGENTS.md 分级策略）

---

## 2. 代码地图

### 2.1 前端（`src/`）
- 路由（`src/router/index.ts`）：AppLayout 内 13 页 + `/companion`、`/control` 独立布局；`/chat`、`/companion` 是 Live2D 页面（CSP unsafe-eval 按路由切换，整页刷新最小化）
- 视图 `src/views/*.vue`（16 个）：
  - HomeView（首页+最近创作）、SceneExplorerView（场景库）、PromptBuilderView（绘图页：SD/Anima 双引擎）、ChatView（角色聊天）、ShowcaseView（展示集）、GalleryView（历史）、CharacterView（角色空间）、StyleView、LoraView（LoRA 目录）、TrainingView（训练台）、SceneManagerView（场景管理）、ColorScriptView、ScenarioView、ControlView（控制面板）、CompanionView（桌面陪伴）、NotFoundView
- 共享组件 `src/components/`（30 个）：VoiceStudio、ChatCharacterStage、ChatApiSettings、GenerationQueuePanel、SDRecoveryPanel、PromptHealthPanel、PromptDataTools、AnimaQuickPanel（anima 引擎面板，并行线）、DesktopTitleBar（Tauri atelier）等
- 状态 `src/stores/`：sceneStore（场景单例）、promptBuilderStore、trainingStore
- 组合函数 `src/composables/`（28 个）：useChatConversation/useChatStorage/useChatProvider、useVoice（TTS+情绪）、useLive2D、useSDGenerate/useSDQueue、usePromptAssembly、useVoiceInput（VAD/按键说话）、useBackup、useImageStore、useKVStore 等
- 工具 `src/utils/`（41 个）：promptPolicy、sdRequest/sdError、sceneInference、blinkScheduler、emotionRuntime、moodTag、companionBehavior、vadSegmenter、speechSession、live2dOverlayLayout、storageKeys 等
- Live2D 双后端 `src/live2d/`：types.ts（契约）/ browserBackend（wl-live2d）/ nativeBackend（Rust overlay 桥）/ createBackend（工厂回退）

### 2.2 网关与服务端
- `server.js`：createGateway 工厂；静态服务 + SD 代理白名单 + **ComfyUI 直通白名单**（`/prompt /queue /history /object_info /interrupt /view`，anima 线新增）+ `/api/*` 统一错误信封
- `routes/`：chat.js、control.js（控制面板+服务配置，含 COMFY_HOST）、desktop-tools.js（桌面工具）、live2d.js、maintenance.js（打包模式 501）、training.js、voice.js
- `server/`：security.js（本机判断+URL 校验）、config.js、diagnostics.js、http-envelope.js、precompressed.js、tunnel.js、companion-tools.js
- `services/*.ts`（编译产物 .js/.d.ts 提交）：tts-service（in-flight 合并、180s 超时）、translation-service、training-service、ollama-service、live2d-service、serial-queue、service-watchdog、control-operation、http-clien
- 桌面壳内嵌网关：`desktop-tauri/src-tauri/src/gateway.rs`（GatewaySupervisor：spawn sidecar node）

### 2.3 数据（`data/`）
- scenes 分片：index/shared/core/nene/natsume（`build-scenes.js` 维护，`validate-content-contracts.js` 校验并接入 DATA_VERSION）
- characters.json、loras.json（anima 线新增 v19 LoRA）、presets.json、curation.json、tags.json、retired-scenes.json
- 场景运行时数据只经 sceneStore 加载，禁止散落 fetch

### 2.4 桌面壳（`desktop-tauri/`）
- `src-tauri/src/`：main.rs、main_shared.rs（companion/atelier 窗口）、bridge.rs（IPC ~40 命令）、shim.rs（前端注入 window.companionDesktop + window.aicsLive2dNative）、live2d_overlay.rs（DX12 overlay 渲染，本会话交付）、gateway.rs、paths.rs、state.rs、tray.rs、watchers.rs、window_state.rs、logger.rs
- `native-live2d/`：Cubism Native 封装 crate（ffi.rs/model.rs/renderer.rs/csrc/live2d_model.cpp），SDK 路径 `E:/code/CubismSdkForNative-5-r.5` 或 `LIVE2D_CUBISM_SDK_DIR`
- `web/`：Tauri 前端资源（staging）；`resources/`：打包资源（gateway/node.exe 等）

### 2.5 文档（`docs/`）
- `tauri-desktop-migration-plan.md`：Tauri 迁移主线状态（P0-P5 ✅ / P6-P7 ❌）
- `live2d-native-runtime.md`：路径 B 运行记录（§7.4/§7.5 含全部踩坑）
- `video-generation-roadmap.md`：视频生成长期规划（暂缓）
- `visual-architecture-roadmap.md`、`companion-voice-roadmap.md`：前端视觉/陪伴语音路线
- `*.html`：文档站（tools/nav.js、theme.js、local-status.js 为运行时）

---

## 3. 各工程线状态（2026-08-08）

### 3.1 Tauri 迁移主线（对方会话，已完成）
- P0-P5 ✅ 已合入：壳+双窗口（companion 透明/atelier 无边框）、GatewaySupervisor、状态迁移、shim（40+ 命令）、desktop-tools、sidecar 打包（NSIS 98.5MB）
- **P6/P7 ✅ 已完成**（2026-08-08 晚，用户确认）：优化项 + 验收收尾（tauri-driver E2E / Playwright 回归），O4/O5 具体交付见 tauri-desktop-migration-plan.md 对方更新

### 3.2 Live2D 路径 B（本会话，全部完成）
- 前端抽象层（8/8 交付）：types/browserBackend/nativeBackend/createBackend + layout 换算 + adapter
- Rust 壳侧（全部交付）：overlay 窗口 + DX12 surface + 渲染循环（165fps 目标）+ 9 个 IPC + `LIVE2D_SELFTEST` 全链路自测 + DPI 感知（per-monitor v2）
- 简化改进轮（7.6）：动态 HitAreas（夏目互动修复）、情绪参数双角色对齐 emotionRuntime、hit-test 强断言、165fps 帧率
- 收尾轮（7.7）：DPI 处理、`npm run test:live2d-native` 自测自动化（未进 validate 主链）
- 验证证据（最终）：`npm run test:live2d-native` → `OK frames=166 hit="Face"`；宁宁/夏目双角色动作/口型/情绪/hit-test/快照全过；壳 12s 冒烟无 panic
- **注意**：`LIVE2D_SELFTEST=1` + `LIVE2D_SNAPSHOT_DIR=<dir>` 跑 `desktop-tauri/src-tauri/target/debug/ai-cg-studio-desktop.exe`，退出码 0 = 全链路通过

> **2026-08-08 晚更新**：Anima 出图线已从"未提交"推进到"已提交 + e2e 全过"，详见文末 §8。

### 3.3 Anima 出图引擎线（另一并行会话，未提交）
- **不是视频流**：换底模出图（ComfyUI anima-base v1.0 + ayachi_nene_v19_anima LoRA）
- 改动（未提交）：server.js（ComfyUI 直通白名单 COMFY_PROXY_ALLOWLIST）、routes/control.js（COMFY_HOST 配置）、vite.config.ts（忽略 desktop-tauri watch EBUSY）、data/loras.json（anima LoRA）、PromptBuilderView.vue（SD↔Anima 引擎切换，共用主结果框）、AnimaQuickPanel.vue（新组件）、tests/e2e/anima-quick.spec.ts
- 文档：video-generation-roadmap.md 是视频长期规划，与 anima 面板无关

### 3.4 主网站既有功能（稳定基线）
聊天（双供应商+配音+情绪+归档）、绘图（SD v18 LoRA 场景/词条）、训练台（v18 契约）、场景库分片、展示集 v18 样张、访客引导、陪伴行为等——见 AGENTS.md 历史记录，均已完成且 validate 全绿。

---

## 4. 已踩坑汇总（新接手者必读，勿重踩）

### 4.1 Live2D 路径 B（详见 docs/live2d-native-runtime.md §7.4/§7.5）
1. **Vulkan surface 对 HWND 返回空 formats** → 必须 `Backends::DX12`（PRIMARY 默认选 Vulkan 会失败）
2. **窗口必须先 ShowWindow 才能枚举 DXGI 格式**（创建时 1×1 + SW_SHOWNA）
3. **Renderer pipeline 格式必须与 surface 格式对齐**：`Renderer::new(device, queue, format)` 参数化（原硬编码 Rgba8UnormSrgb）
4. **SetCharacter 必须先 ensure_surface**（load_model 要求 renderer 已建）
5. **`DesktopPaths` 从未 manage**：9 个 IPC 入口 `app.state::<DesktopPaths>()` 会 panic → main.rs setup 补 manage + derive(Clone)
6. **HitArea Name→ArtMesh 映射**：C++ hit_test 直接用 Name 查 drawable 永远 miss → 遍历 GetHitAreaCount/Name/Id 按名匹配
7. **参数写入时序**：口型/情绪/凝视必须在 `model.update(dt)`（含 UpdateMotion）**之后**写，否则被动作曲线覆写
8. **DX12 readback 256 字节行对齐**：copy_texture_to_buffer bytes_per_row 必须对齐（Vulkan 不强制），unmap 后按行去 padding
9. wgpu 24 API 差异：`Instance::new(&desc)`、`create_surface_unsafe(SurfaceTargetUnsafe::RawHandle)`、InstanceDescriptor 字段
10. **强杀测试残留 WebView2 进程会挤占显存**导致 DX12 设备创建失败（"Not enough memory left"）——测试后清理
11. 夏目 14×4096 纹理 debug 解码约 6s/张（共 ~84s），selftest 超时需 ≥120s；release 会快很多

### 4.2 Tauri 迁移（详见 docs/tauri-desktop-migration-plan.md）
- shim 注入时序（withGlobalTauri 未就绪轮询）、WebView2 注册时 documentElement 为 null（MutationObserver）
- 自定义 capability ACL 拒绝：devUrl 必须为 `http://127.0.0.1:3000` 使 origin 判定为 local
- IPC 命令不可跨线程同步等待（spawn_blocking + ExitRequested prevent_exit + quitting 标志）
- atelier 窗口缺 shim → 拖拽失效（已修：shim 抽 src/shim.rs 双窗口注入）
- 拖拽：WebView2 不支持 -webkit-app-region，用 data-tauri-drag-region + capability allow-start-dragging
- sidecar：node.exe 打包、resource_dir = exe 目录（资源平铺安装）、`\\?\` UNC 前缀、AICS_APP_ROOT 打包优先、maintenance 501 契约

### 4.3 网站基线（AGENTS.md 全文为权威）
- CSP unsafe-eval 按路由切换（/chat /companion），Live2D 页面整页刷新最小化
- 训练参数白名单覆盖、数据集枚举 id 只读路径、`aics_training_*` 草稿
- localStorage 键唯一登记（storageKeys.ts），备份白名单收集活键清理死键
- 数据文件 `?v=DATA_VERSION` immutable 缓存、precompressed 白名单
- 未知 `/api/*` 不得回退 SPA HTML（统一错误信封）

---

## 5. 剩余项与决策点（交给 SOL 出方案）

### 5.1 需 SOL 决策/出方案的
1. **真实桌面端到端验证方案**：companion 页面 `?live2dBackend=native` 时 overlay 与页面 Live2D 框对齐、口型随 TTS 联动、点击互动响应——如何半自动/自动化验证（selftest 已覆盖同链路，缺真实场景确认）
2. **selftest 进 validate 主链决策**：包装脚本 `npm run test:live2d-native` 已交付（7.7，90s+ 时长 + 依赖 DX12 真机环境），是否/如何接入 `npm run validate` 由 SOL 定
3. **打包模式 `assets_root/live2d/` 资源路径**：packaged 下模型资源解析未验证
4. **夏目口型极性**：`ParamMouthForm3`（-0.5..0）方向未在真实音频下回归（宁宁 ParamMouthOpenY 已实测）
5. **anima 线剩余**（详见 §8.4 决策点 7-11）：词条 Anima profile（P0）、v19 完整审核矩阵（P0）、Anima 队列/场景生成链路（P1）、Krea 2 适配（P2）、`/view` 端点安全复核

### 5.2 明确暂缓（勿动）
- Live2D 贴图压缩/KTX2/WebP、Git LFS 迁移（需单独资源方案）
- 视频生成（video-generation-roadmap.md P0-P3，暂缓）
- 前端视觉路线、陪伴语音路线（按各自 roadmap 分阶段）

### 5.3 自查薄弱点（已确认，供 SOL 审查补充，不必全修）
> 这些是本会话在开发/摸底中确认的"没做到位"或可疑处，SOL 可在此基础上查缺补漏。

**Live2D 路径 B（Rust 壳侧）**
1. ~~夏目 hit-test 空实现~~ **已完成（7.6）**：动态读 model3.json HitAreas，删硬编码映射
2. ~~DPI 缩放未处理~~ **已完成（7.7）**：进程级 per-monitor v2 + SetProcessDpiAwareness 回退（Cargo.toml 补 Win32_UI_HiDpi）
3. ~~apply_emotion 忽略角色~~ **已完成（7.6）**：双角色参数表对齐 emotionRuntime（NENE/NATSUME）
4. ~~selftest 弱断言~~ **已完成（7.6）**：hit-test 非空强断言；帧率已改 165fps 目标（L2D_TARGET_FPS 可覆盖）
5. **纹理解码无缓存**：角色来回切换重复解码（夏目 debug 84s/次），release 缓解但无跨会话缓存
6. ~~固定 16ms 帧循环~~ **用户决策：不降帧，改 165fps 目标**（7.6 已实施，L2D_TARGET_FPS 可覆盖）
7. **`DesktopPaths` 与 AppState.paths 双份**：manage 了两份 paths（一处补丁式修复，可收敛）

**仓库卫生**
8. `wl-shot.tmp.js`（Playwright 临时脚本）散落根目录未跟踪；`LIVE2D-NATSUME-HANDOVER.md` 在根目录而非 docs/
9. `desktop-tauri/target/`、`native-live2d/target/` 构建产物体积大（是否入库由 .gitignore 治理，desktop-tauri 整体未跟踪）
10. `poc/`、`release/`、`desktop-dist/`（Electron 产物）与 desktop-tauri 并存——历史包袱清理决策

**流程/质量**
11. ~~Rust 侧零自动化~~ **部分完成（7.7）**：`npm run test:live2d-native` 已交付（240s 超时/退出码断言/临时快照清理）；是否进 validate 主链由 SOL 决策（90s+ 时长）
12. validate 链串行全跑一次耗时可观；E2E 190 用例全量需 --workers=3——可考虑分级/并行化（AGENTS.md 已有分级策略，但 validate 本身无分级）
13. `services/*.ts` 编译产物（.js/.d.ts）提交仓库形成双维护，契约变更易漏提交

**Anima 线（已提交 + e2e 全过，见 §8；审查重点仍适用）**
14. ComfyUI 直通白名单含 `/view`（filename 参数读图端点）——需确认无路径穿越；白名单之外路径是否 JSON 404 而非 SPA 回退（沿 SD 代理同款约束）
15. AnimaQuickPanel 在线检测/失败重试/队列并发行为未过 review；E2E 是否 mock ComfyUI（参照 mock-upstreams.js 模式）

---

## 6. 协作边界（文件所有权，防并发冲突）

| 线 | 拥有方 | 文件范围 |
|---|---|---|
| Live2D 路径 B 壳侧 | 本会话（全部交付完成） | `desktop-tauri/src-tauri/src/live2d_overlay.rs`、`native-live2d/`、`scripts/tests/run-live2d-selftest.js`、`docs/live2d-native-runtime.md` |
| Tauri 迁移 | 对方会话（P0-P7 完成） | `desktop-tauri/src-tauri/src/`（除 live2d_overlay.rs）、`docs/tauri-desktop-migration-plan.md` |
| Anima 出图 | anima 线会话（已提交，e2e 全过） | `AnimaQuickPanel.vue`、ComfyUI 白名单相关、`tests/e2e/anima-quick.spec.ts` |
| 共享文件 | 用户/主会话 | `AGENTS.md`（改动前必须备份原文件，保证 UTF-8 + 换行完整）；docs/ 追加只增不改已有段落 |

规则：独立文件优先、只调公开 API、交付写进共享文档（做了什么+证据+踩坑+接入点）、真机验证为证、遇难先搜（连续 2 次实验无效必须搜索，先验证来源真实性）、禁止 git reset --hard / checkout --。

---

## 7. 给 SOL 的执行建议

1. 先读：本文档 + AGENTS.md + docs/live2d-native-runtime.md（§7.4-7.7 全部坑）+ docs/tauri-desktop-migration-plan.md 当前状态
2. 方案优先级建议：5.1 第 1 项（端到端验证，两条线已就绪，只差真实场景确认）> 第 2 项（validate 接入决策，成本低收益稳）> 第 3/4 项（打包与口型回归，打包阶段一起做）> 第 5 项（anima 线 P0 项）
3. 方案需包含：目标、验证方法（真机命令）、涉及文件、协作边界（§6）、风险与回退
4. **审查任务**（用户指定）：除出方案外，请基于 §5.3 自查薄弱点 + 自行通读代码，指出所有"没做到位/能做得更好"的地方，形成审查清单（含位置、问题、建议、优先级），分配各协作者执行
5. **方案必须支持多人并行分工**（用户指定）：输出为可并行分发的任务包，格式约定：
   - 每个任务包：**任务 ID + 标题 + 涉及文件 + 目标 + 验收标准（含真机验证命令）+ 预估工作量**，独立可开工，不依赖其他任务包完成
   - **依赖图**：明确哪些任务必须先做、哪些可同时开工、哪些可最后合并（如端到端验证依赖自测自动化完成）
   - **文件冲突规避**：按 §6 所有权边界切分文件范围，同一文件只分给一个任务包；确需共享的文件标注"串行执行顺序"
   - **分配建议**：按可用协作者数量给出批次方案（如 3 个会话同时开工的 A/B/C 组 + 汇总验收轮）
   - 每个任务包完成后由执行者把结果写回 `docs/project-handoff.md`（只增不改已有段落），由 SOL 汇总验收

> **2026-08-08 深夜最终状态**：三条线（Tauri 迁移 P0-P7 / Live2D 路径 B / Anima 出图）全部完成交付。本文档已可作为 SOL 的完整交接基线：§2 代码地图 + §3 线状态 + §4 全部踩坑 + §5 剩余项/决策点 + §5.3 自查薄弱点 + §8 anima 线详情。SOL 任务：出方案（5.1）+ 审查清单（5.3 扩展），按 §7-5 输出可并行任务包。

---

## 8. Anima 出图引擎线 · 2026-08-08 晚更新（本会话交付）

> 对应 §3.3 / §5.1-6 / §5.3-14/15 的最新状态。Anima 线已从"未提交"推进到**已提交 + 真机 e2e 全过**。

### 8.1 本晚新增交付（已提交，typecheck/build/lint/单测/e2e 全绿）

1. **ComfyUI 直通网关**（`server.js` COMFY_PROXY_ALLOWLIST + `pathRewrite` 剥 `/comfy` 前缀 + `proxyReq` 剥离 Origin 头 + 限流/404）
   - `server/config.js` 新增 `COMFY_HOST`（默认 127.0.0.1:8188，控制面板可保存）
   - `server/security.js` 未认证 `/comfy` 返回 401（与 /sdapi 同约束）
   - `routes/control.js` 配置保存/状态返回补 comfyHos
2. **绘图页双引擎切换**（`PromptBuilderView.vue`）：输出区引擎切换条（SD/Anima），`aics_draw_engine` localStorage 持久化；Anima 模式下主生成按钮可用性取决于 **ComfyUI 在线状态而非 SD**（`engineOnline`）；Anima 生成结果经 `@result` 上抛到**主结果框**（`displayResultUrl/displayResultSeed` 统一 SD/Anima 结果源），保存作品册/复用 seed/结果快照全适配；Anima 模式队列提示暂不支持
3. **AnimaQuickPanel.vue**（新组件）：底模/LoRA/强度/prompt/seed/steps/cfg/尺寸 + `generateWith(positive, negative, seed?)` 外部调用接口 + `defineExpose({ generateWith, generate, online })`
4. **data/loras.json**：登记 `L_NENE_V19_ANIMA`（base_model: anima-base-v1.0，compatible_models 含 anima 三件套）；`test-lora-catalog.js` 断言 2→3 同步
5. **tests/e2e/anima-quick.spec.ts**：引擎切换 + SD 离线时 Anima 出图 + 结果进主框（39s 真机通过）
6. **桌面资源**：`desktop-stage-resources.js` 已同步（100.1MB）

### 8.2 本晚新踩坑（勿重踩）

1. **huggingface_hub 的 Xet 下载会假死**（本网络走代理）：产生多份 `.incomplete` 残留、续传失效、速度掉到 KB/s → 改用 **requests + Range 手写续传**（`dl_anima_rest.py` 模式），并保留已完成字节
2. **ComfyUI CSRF**：浏览器带 `Origin` 头的 `POST /prompt` 被 ComfyUI 403（aiohttp origin_only_middleware）→ 网关 `proxyReq.removeHeader('origin')`
3. **PowerShell 传 JSON 给 curl.exe 引号被破坏** → ComfyUI 收到坏 JSON 报 `JSONDecodeError`（500），不是代码 bug；用脚本文件传 body
4. **前端 TDZ**：`computed` 引用了后声明的 ref 会页面白屏（`Cannot access 'ce' before initialization`）——引擎相关状态全部提到 `drawEngine` 声明之后
5. **ComfyUI 模型文件路径**：`hf_hub_download(local_dir=...)` 会保留仓库内 `split_files/` 子路径，需移动到 `models/diffusion_models/` 等根目录；小 config.json 易漏（加载报 "no file named config.json"）
6. **Playwright**：独立 `playwright` 包浏览器二进制缺失（headless shell），必须用 `@playwright/test` 跑 e2e；`textContent()` 对不存在元素会等待到超时，先 `.count()` 或 `.catch()`
7. **mihomo 运行时改规则**：Clash Verge 的 profiles 增强文件（`reJMCoazWUCe.yaml`）改动后不会自动重载；把 `clash-verge-check.yaml` 复制 + 插入规则 + `PUT /configs?force=true`（仅允许 Clash 数据目录路径）可热加载

### 8.3 环境现状（本机，勿重复下载）

- **ComfyUI**：`E:\code\2\lora\AI\ComfyUI`（官方原版 + Manager，venv 独立），端口 8188
- **模型库**（`ComfyUI/models/`）：diffusion_models: anima-base-v1.0 / anima-aesthetic-v1.1 / AnimaYume_v10 / krea2_turbo_fp8；text_encoders: qwen_3_06b_base（Anima）/ qwen3vl_4b_fp8（Krea2）；vae: qwen_image_vae；loras: ayachi_nene_v19_anima + v18 硬链接
- **OneTrainer 训练模型**：`OneTrainer/models/anima-base-v1.0-diffusers/`（官方 diffusers 格式，meta.json 已写）
- **v19 LoRA 产物**：`OneTrainer/output/ayachi_nene_v19_anima.safetensors`（87.6MB，KOHYA 格式，rank16/45epochs）
- **Clash 分流**：HF→🇭🇰1香港-专线、Google→🇺🇸12美国旧金山（规则已写入 profiles 增强文件，重启 Verge 仍生效）
- **AnimaPulse 未下载**：HF 无镜像，Civitai 匿名拿不到主模型（3.89GB Diffusion Model 需 token 指定 `?type=Model`），匿名限速 ~100KB/s

### 8.4 留给 SOL 的新决策点（追加到 §5.1）

7. **词条体系 Anima profile（P0）**：WAI 质量词/负面词/权重语法（`(word:2)` 级）需按 Anima 校准（base 版吃质量词、aesthetic 版不吃；负面用 worst quality/low quality/score_1~3 类）——前端 profile 驱动，预计只加 profile 不改词条库
8. **v19 完整审核矩阵（P0）**：仅 1 场景对比（衣服还原优于 v18 为初评）；6 场景×3 seed 对照 + 脸部量化未跑
9. **Anima 队列/场景生成链路（P1）**：Anima 模式无队列、场景生成器（ScenarioView/quick-create）未接 Comfy
10. **Krea 2 正式适配（P2）**：模型已下载、面板可选底模，但未做参数/词条适配
11. **ComfyUI `/view` 端点安全复核**：白名单含 `/view?filename=`，确认无路径穿越（§5.3-14 未提交状态下的疑虑，现已提交，可复核最终代码）

---

## 2026-08-09 · B-00 建立可复现基线

### 完成内容
- 修复根 `package.json` 的 UTF-8 BOM，固定 `@tauri-apps/cli` 为 `2.11.4`，补齐 `prepare:tauri`、`build:tauri`、`package:tauri` 和 release Native selftest 命令。
- 将 `desktop-tauri/native-live2d/` 的 Cargo/C++/Rust/shader 源码纳入跟踪范围；`target/`、debug PNG、Tauri staging、sidecar 和 `node_modules` 保持忽略。
- 新增 UTF-8/LF 约束文件与确定性资源脚本：根锁文件非 dev 依赖闭包、`npm ci --omit=dev`、Node `v24.18.0` sidecar SHA256 校验、release selftest 当前源码构建与 PNG 快照断言。

### 修改文件
- `.gitignore`
- `.gitattributes`
- `.editorconfig`
- `package.json`
- `package-lock.json`
- `desktop-tauri/native-live2d/**`
- `scripts/maintenance/desktop-stage-resources.js`
- `scripts/maintenance/prepare-tauri.js`
- `scripts/maintenance/run-tauri.js`
- `scripts/tests/run-live2d-selftest.js`

### 验证证据
- `git diff --cached --check` -> PASS。
- `node scripts/tests/test-e2e-ci-split.js` -> PASS，1/1。
- `npm ci --no-audit --no-fund`（`ELECTRON_SKIP_BINARY_DOWNLOAD=1`）-> PASS，780 packages。
- `npm run build:tauri` -> PASS，Vite build、staging 97.5 MB、Tauri release binary 构建完成。
- `cargo test --manifest-path desktop-tauri/src-tauri/Cargo.toml`（Rust toolchain bin 注入 PATH）-> PASS，8/8。
- `npm run test:live2d-native:release` -> PASS，`snapshots=3/3 exit=0`。
- `npm run package:tauri` -> PASS，生成 `AI-CG-Studio_1.5.0_x64-setup.exe`。
- clean clone 构建和打包后 `git status --short --untracked-files=all` 为空，`git diff --check` 通过。

### 真机证据
- Windows x64 + DX12 本机，Cubism SDK 使用 `E:\code\CubismSdkForNative-5-r.5\CubismSdkForNative-5-r.5`；release Native selftest 加载当前源码并验证 3 张 PNG 快照。
- 安装包：`C:\Users\Administrator\AppData\Local\Temp\opencode\aics-b00-clean-20260809\desktop-tauri\src-tauri\target\release\bundle\nsis\AI-CG-Studio_1.5.0_x64-setup.exe`。
- 安装包大小 `106,434,658` bytes；SHA-256 `303A9CB7FC0BA79280E218BFAB02ABCB64900FC59D23E63B0961E858A2D3431A`。
- 本轮未单独记录 GPU 型号与 DPI 数值；Native selftest 使用当前 DX12 真机环境通过。

### 仍未完成
- B-00 的 Tauri clean clone 构建、release selftest 和 NSIS 打包已完成。
- 普通 `npm ci` 首次在 `electron@37.10.3` postinstall 下载 Electron 二进制时超过 600 秒；本次 Tauri 验证使用 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`，未验证 Electron 二进制下载本身。
- L-10 尚未开始；`desktop-tauri/native-live2d/src/renderer.rs` 仍由 L-20 独占，不得修改。

### 踩坑与参考
- PowerShell 原生管道会破坏 `git diff --cached --binary` patch；clean clone 应使用 Git 的 `--output` 写入 patch 文件后再 `git apply`。
- 直接运行 `cargo` 可能找不到 Rust；使用 `C:\Users\Administrator\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin` 注入 PATH。`scripts/maintenance/run-tauri.js` 已内置同样处理。
- Node sidecar 下载地址：`https://nodejs.org/dist/v24.18.0/win-x64/node.exe`。
- Cubism SDK 下载参考：`https://www.live2d.com/en/sdk/download/native/`；构建也接受 `LIVE2D_CUBISM_SDK_DIR`。

### 下一位接入点
- B-00 已释放 `package.json`、`.gitignore`、`.gitattributes`、`.editorconfig` 和 `desktop-tauri/native-live2d/**`；可启动 L-10。
- L-10 负责 `desktop-tauri/src-tauri/src/live2d_overlay.rs`、`main_shared.rs`、`shim.rs`、`bridge.rs`、`state.rs`、`src/components/ChatCharacterStage.vue`、`src/composables/useLive2D.ts`、`src/live2d/nativeBackend.ts` 及对应契约测试。
- Native selftest 入口为 `npm run test:live2d-native:release`；不得把生成的 `desktop-tauri/src-tauri/target/`、`resources/`、`binaries/` 或 `desktop-tauri/native-live2d/target/` 纳入 Git。

## 2026-08-09 · L-10 Native Live2D 产品链路闭环

### 完成内容
- Companion 在桌面壳可见启动时显式请求 `native`；`--hidden` 与用户关闭 Live2D 时不自动加载模型。Atelier/普通页面不注入 Native bridge，默认保持 browser。
- Rust hit-test 事件统一发送 `string[]`；ready listener 支持 pending 取消、真实订阅 id 和重复 connect/destroy 清理。
- Native 渲染线程加载后自动启动 Start/Idle；Idle 按作者 motion `Meta.Duration` 推进并随机选择变体，点击未指定 index 不再固定为 0；动作结束后回到 Idle，并发送 entrance-finished。
- Rust 口型意图按角色映射：宁宁 `0..1`，夏目 `ParamMouthForm3` 为 `0..-0.5`；停止说话显式发送 mouth level `0`。
- Native 情绪增加独立 `requestAnimationFrame` 时钟；窗口 bounds move/resize 事件、overlay 控件穿透矩形、模型内容 bounds 与 `HTTRANSPARENT` 路径已接通。
- `aics:visibility` 隐藏/显示事件、Native `setMaxFps`、真实电池状态和单一 `AppState.paths` 来源已接通。
- 新增 `scripts/tests/test-live2d-native-contract.js`；同步修正过时的 `test-chat.js` / `test-desktop.js` 契约断言。

### 修改文件
- `desktop-tauri/src-tauri/src/main.rs`
- `desktop-tauri/src-tauri/src/main_shared.rs`
- `desktop-tauri/src-tauri/src/shim.rs`
- `desktop-tauri/src-tauri/src/bridge.rs`
- `desktop-tauri/src-tauri/src/watchers.rs`
- `desktop-tauri/src-tauri/src/live2d_overlay.rs`
- `src/components/ChatCharacterStage.vue`
- `src/views/CompanionView.vue`
- `src/composables/useLive2D.ts`
- `src/composables/useCharacterRoomSession.ts`
- `src/live2d/nativeBackend.ts`
- `src/live2d/types.ts`
- `src/types/live2dNative.ts`
- `src/types/desktop.d.ts`
- `scripts/tests/test-live2d-backend.js`
- `scripts/tests/test-live2d-native-contract.js`
- `scripts/tests/test-chat.js`
- `scripts/tests/test-desktop.js`

### 验证证据
- `npm run typecheck:app` -> PASS。
- `npm run build` -> PASS，bundle budget 与预压缩通过。
- `node scripts/tests/test-live2d-backend.js` -> PASS，20/20。
- `node scripts/tests/test-live2d-native-contract.js` -> PASS，3/3。
- `node scripts/tests/test-chat.js` -> PASS；`npm run test:desktop` -> PASS。
- `cargo test --manifest-path desktop-tauri/src-tauri/Cargo.toml`（Rust toolchain bin 注入 PATH）-> PASS，9/9。
- `npm run test:live2d-native:release` -> PASS，`snapshots=3/3 exit=0`。
- `npm run build:tauri` -> PASS，release Tauri executable 构建完成，staging 约 97.3 MB。
- `npx playwright test tests/e2e/studio.spec.ts --grep "desktop companion|Live2D uses|falls back|Natsume Live2D|eyes blink|Leave farewell|latest character switch" --workers=2` -> PASS，7/7。
- release executable `--hidden` smoke 启动 8 秒保持存活后正常被测试进程终止，未观察到启动 panic。

### 真机证据
- Windows x64 + DX12，本机 Cubism SDK：`E:\code\CubismSdkForNative-5-r.5\CubismSdkForNative-5-r.5`。
- Native release selftest 实际加载宁宁/夏目当前模型，完成动作、口型、情绪、hit-test、渲染和 3 张 PNG 快照。

### 仍未完成
- 尚未完成可见 Tauri Companion 的人工 UI 验收：真实窗口 move/resize/DPI、多次点击作者 HitArea、透明区域穿透和关闭按钮点击；本轮已完成代码路径、release selftest 与 `--hidden` smoke。
- 普通 `npm ci` 的 Electron 二进制下载仍未单独验证；B-00 clean clone 使用了 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`。
- `desktop-tauri/native-live2d/src/renderer.rs` 当前存在协作者的 `AM` 改动，本轮未编辑、未格式化、未回退。

### 下一位接入点
- L-10 的前端/壳侧链路已可交给后续人工验收；L-20 继续独占 `desktop-tauri/native-live2d/src/renderer.rs`。
- Native 入口：`npm run test:live2d-native:release`；独立契约测试：`node scripts/tests/test-live2d-native-contract.js`。

## 2026-08-09 · A-10 收口 ComfyUI 安全边界

### 完成内容
- 移除浏览器可达的 ComfyUI 直通代理；`/comfy/*` 以及根 `/prompt`、`/queue`、`/history`、`/interrupt`、`/view`、`/object_info` 统一返回 JSON 404。
- 新增应用级 Anima API：`POST /api/anima/jobs`、`GET /api/anima/jobs/:id`、`DELETE /api/anima/jobs/:id`、`GET /api/anima/jobs/:id/result`、`GET /api/anima/status`。
- 服务端固定 Comfy 工作流、模型/LoRA/角色兼容表、参数白名单、尺寸/steps/CFG/LoRA 强度、body、pending 和结果图片限制；浏览器不再提交节点图。
- 生成结果只通过不可猜测的应用 job id 获取，并复制到 runtime media；结果引用强制 `output` 图片、路径 containment、真实文件和 MIME 校验，拒绝绝对路径、编码穿越、`..`、input/temp/annotation/hash/junction 风格路径。
- 取消只标记调用者自己的应用 job，不调用全局 Comfy `/interrupt`；轮询失败只重试 history，不重复提交 workflow。
- AnimaQuickPanel 改为应用 API，状态只展示服务端固定选项，尺寸同时更新 width/height。

### 修改文件
- `server.js`
- `routes/anima.js`
- `src/components/AnimaQuickPanel.vue`
- `scripts/tests/mock-upstreams.js`
- `scripts/tests/mock-stack.js`
- `scripts/tests/test-anima-routes.js`
- `scripts/tests/test-gateway-contract.js`
- `tests/e2e/flows.spec.ts`
- `tests/e2e/anima-quick.spec.ts`

### 验证证据
- `npm run test:security` -> PASS，9 个安全单测 + gateway contract 通过。
- `node scripts/tests/test-anima-routes.js` -> PASS，真实 HTTP 覆盖鉴权、工作流/参数拒绝、轮询、取消、结果路径和 MIME。
- `npm run typecheck:app` -> PASS。
- `npm run build` -> PASS，bundle budget 与预压缩通过。
- `npx playwright test tests/e2e/flows.spec.ts --project=flows --workers=1 --grep "Anima|Comfy"` -> PASS，1/1，真网关 + 假 ComfyUI。
- `npx playwright test tests/e2e/anima-quick.spec.ts --project=desktop --workers=1` -> PASS，1/1。

### 真机证据
- Windows 本机 Node 22 网关，Comfy mock 使用真实 HTTP 上游；浏览器只访问 `api/anima`，假上游收到 1 次 `/prompt`、history transient 轮询和 1 次 `/view`。
- 本任务未以真实 GPU 出图作为安全通过条件；真实 Anima 画质仍属于后续 v19 审核矩阵，不影响 A-10 安全验收。

### 仍未完成
- 无 A-10 安全阻断。真实 ComfyUI GPU 画质与模型覆盖仍由 V-10 负责。

### 踩坑与参考
- `networkidle` 不适用于绘图页：页面有持续状态轮询，mock E2E 改用 `domcontentloaded`。
- 连续两次轮询实验失败后停止盲试；核对官方仓库存在于 `https://api.github.com/repos/Comfy-Org/ComfyUI`，并参考官方路由说明 `https://docs.comfy.org/development/comfyui-server/comms_routes`：`/prompt` 返回 `prompt_id`，`/history/{prompt_id}` 返回历史，图片通过 `/view` 读取。

### 下一位接入点
- A-20 只调用 `POST /api/anima/jobs` 的白名单字段：`prompt`、`negative`、`modelId`、`loraId`、`loraStrength`、`width`、`height`、`steps`、`cfg`、`seed`、`character`。
- 当前服务端兼容组合为 `character=nene` + `loraId=L_NENE_V19_ANIMA`，模型 id 为 `anima-base-v1.0`、`anima-aesthetic-v1.1`、`anima-yume-v1.0`；A-20 不得恢复任何 `/comfy/*` 调用或向 API 传 workflow/class_type。
- A-20 可使用 job 的 `resultUrl` 或 `/api/anima/jobs/:id/result`；结果 MIME 已由服务端保证为受支持图片。

## 2026-08-09 · A-20 Anima Prompt 与角色契约

### 完成内容
- Prompt profile 改为“引擎 + 模型”双维度解析；SD profile 保持原有 checkpoint 回退与下划线标签行为，新增 Anima Base v1.0 / Aesthetic v1.1 profile。
- Anima Prompt 统一使用空格标签，保留 `score_*` 协议标签和 `BREAK` 角色作用域，剥离全部 A1111 `<lora:...>`；SD 路径继续保留 `<lora:...>`。
- Anima profile 驱动质量/负面前缀、rating、模型和 v19 LoRA 元数据；LoRA 由固定服务端工作流加载，不进入 Anima Prompt。
- Anima 仅允许已审核的宁宁 v19；夏目与 triad 禁用 Anima 并回退 SD。用户故事作为独立、可审计 Prompt 块参与最终组装。
- 历史记录保存 `engine`、`profile`、实际 `model`、LoRA id/strength、CFG、steps、sampler、scheduler 和真实尺寸；恢复历史时同步 Anima 控件状态。
- 保存作品及队列自动入册前检查 HTTP 状态、图片 MIME 和非空 blob。

### 修改文件
- `data/presets.json`
- `src/utils/promptPolicy.ts`
- `src/utils/promptBuilderPersistence.ts`
- `src/composables/usePromptAssembly.ts`
- `src/views/PromptBuilderView.vue`
- `src/stores/promptBuilderStore.ts`
- `scripts/tests/test-prompt-policy.js`
- `scripts/tests/test-prompt-builder-modules.js`
- `src/stores/sceneStore.ts`（因 `data/presets.json` 内容哈希契约必须同步 `DATA_VERSION`，属于必要跨边界修改）

### 验证证据
- `npm run typecheck:app` -> PASS。
- `npm run build` -> PASS，bundle budget 与预压缩通过。
- `npm run test:prompt-policy` -> PASS，覆盖 Anima 空格/score/BREAK/LoRA、SD 零回归、profile 与负面词。
- `npm run test:prompt-builder` -> PASS，覆盖 profile 持久化、历史引擎元数据、Anima LoRA/模型字段接线。
- `node scripts/tests/test-sd-runtime.js` -> PASS，SD profile/负面策略/LoRA/队列回归通过。
- `node scripts/maintenance/validate-content-contracts.js` -> PASS，2 个角色、3 个 LoRA、297 个场景。

### 参考与边界
- Anima 标签规则参考官方模型页：`https://huggingface.co/circlestone-labs/Anima`。
- 未修改 A-10 服务端安全 API；未新增 `aics_draw_engine` 存储登记，按任务分派留给 R-10。
- 未执行真实 GPU 画质审核；v19 视觉矩阵由 V-10 负责，Anima 仍为 experimental。

### 下一位接入点
- V-10 可直接使用当前 engine/profile/history 契约开展 6 场景 × 3 seed 的 v18/v19 视觉审核。
- R-10 负责登记并迁移 `aics_draw_engine` 到统一 storage/repository；不得在 PromptBuilderView 创建第二套持久化方案。

## 2026-08-09 · A-10/A-20 rework 收口

### 完成内容
- A-10 服务端模型白名单收紧为 `anima-base-v1.0` 与 `anima-aesthetic-v1.1`；`anima-yume-v1.0` 不再可提交、发现或通过未知模型回退进入生成。
- 服务端工作流固定为公开的双分支流程：正向文本编码、反向文本编码、固定采样器和固定 SaveImage 节点 `10`，浏览器只能提交白名单参数。
- Anima 结果只接受固定节点 `10` 且文件名前缀为 `anima_app`；结果生命周期覆盖启动、消费、TTL、取消和网关关闭清理。
- DELETE 使用对应应用 job 的 Comfy `prompt_id` 定向调用 `/queue` 删除和 `/interrupt`，取消中的 job 继续占用 pending 配额，避免并发穿透。
- A-20 将生成入口收敛到 `PromptBuilderView.vue`；`AnimaQuickPanel.vue` 只负责 typed state 控件，不直接请求 API、不通过父组件 `querySelector` 触发生成。
- Anima 普通标签统一使用空格；v19 精确控制词保留在 `exact_tokens` 白名单中，包括 `ayachi_nene`、`nene_r18`、`nene_witch_canonical` 和经审核的服装控制词。
- 结果事件携带不可变 job metadata；主结果框、保存快照和历史恢复使用同一份 metadata，恢复时先加载场景再恢复自定义 story。

### 修改文件
- `routes/anima.js`
- `src/types/anima.ts`
- `src/utils/promptPolicy.ts`
- `src/utils/promptBuilderPersistence.ts`
- `src/composables/usePromptAssembly.ts`
- `src/views/PromptBuilderView.vue`
- `src/components/AnimaQuickPanel.vue`
- `data/presets.json`
- `data/loras.json`
- `src/stores/sceneStore.ts`
- `scripts/tests/test-anima-routes.js`
- `scripts/tests/test-prompt-policy.js`
- `scripts/tests/test-prompt-builder-modules.js`
- `tests/e2e/anima-quick.spec.ts`
- `scripts/tests/regress-anima-prompt-tags.js`
- `docs/anima-prompt-ab-2026-08-09.md`

### 验证证据
- `npm run typecheck:app` -> PASS。
- `npm run build` -> PASS。
- `npm run test:prompt-policy` -> PASS。
- `npm run test:prompt-builder` -> PASS。
- `node scripts/tests/test-anima-routes.js` -> PASS。
- `node scripts/maintenance/validate-content-contracts.js` -> PASS。
- `npx playwright test tests/e2e/anima-quick.spec.ts --project=desktop --workers=1` -> PASS。
- `node scripts/tests/regress-anima-prompt-tags.js --model anima-base-v1.0 --lora L_NENE_V19_ANIMA --seed 20260809 --width 832 --height 1216 --steps 24 --cfg 3` -> PASS；生成同 seed 下划线控制版本与空格普通标签版本。

### 真机 GPU 证据
- 运行环境为本机真实 ComfyUI + GPU，不是 mock；两版均完成出图并通过逐图视觉检查。
- 宁宁身份、脸部与呆毛、魔女服装轮廓、手部结构、咖啡馆叙事、光照和构图均保持一致；空格标签版本未见材料性语义退化。
- 证据目录：`E:\code\2\lora\AI\Reviews\AnimaPromptAB\2026-08-09_v19_exact_tokens\`；manifest 与结论见 `docs/anima-prompt-ab-2026-08-09.md`。

### 当前接入点
- Anima 当前仍只支持 `character=nene`、`L_NENE_V19_ANIMA` 与两个已审核模型 profile；不得恢复 Yume 白名单或浏览器直通 ComfyUI。
- 后续若扩展模型，必须先增加 profile、固定 workflow 分支、参数契约和真实 GPU 视觉证据，再开放前端选择。

## 2026-08-09 · SOL 第二轮验收与直接收口

### 验收结论
- 第二轮返工的安全边界、单一生成入口、历史 story 顺序和结果清理方向正确，但初始版本仍未通过最终验收；SOL 按约定直接接管并修复，没有再次退回执行者。
- 最终 A-10/A-20 通过，可以进入后续 V-10，但 Anima 仍保持 experimental。

### SOL 修复
- 浏览器请求重新收紧到原白名单，不再提交 `profileId`；服务端只按 `modelId` 派生可信 profile metadata。
- 定向取消优先使用 ComfyUI `POST /api/jobs/:prompt_id/cancel`；旧版仅允许按 id 删除 pending，不回退可能全局生效的运行中 `/interrupt`。
- 取消增加 30 秒确认上限，无法确认时转 `ANIMA_CANCEL_FAILED` 并释放 pending，避免队列永久占满。
- 结果文件只在 HTTP response `finish` 后消费，客户端断流时保留重试机会；关闭服务时清理 job timer/map。
- 离开导演台会停止 Anima 轮询，并对已取得 id 的活动 job 发送定向 DELETE。
- 无 `engine` 字段的旧历史明确按 SD 恢复，避免从 Anima 状态恢复旧作品时误用 v19。
- v19 profile 补齐宁宁身份锚点，并依据真实 GPU 单变量测试保留 `best_quality`；普通场景标签如 `warm_lighting` 继续使用空格。

### 真实 GPU 与图片审核
- 固定 `anima-base-v1.0`、`L_NENE_V19_ANIMA`、seed `20260809`、832x1216、24 steps、CFG 3，生成 underscore/profile/warm-space/quality-space 四个变体。
- `quality-space.png` 胸饰退化；旧 broad-space profile 同时出现杯子悬空和手部接触崩坏；`warm-space.png` 通过。
- 修正后生产 `profile.png` 与通过的 `warm-space.png` SHA256 完全相同：`7F33ACCA16EA29ABDFF6933BA69D33715A6217B866961B8A0B132DE4E5F3B8AF`。
- 证据与结论：`docs/anima-prompt-ab-2026-08-09.md`、`E:\code\2\lora\AI\Reviews\AnimaPromptAB\2026-08-09_v19_exact_tokens\manifest.json`。

### 验证
- `node scripts/tests/test-anima-routes.js`：3/3 PASS。
- `npm run test:prompt-policy`、`npm run test:prompt-builder`、`node scripts/tests/test-sd-runtime.js`：PASS。
- `npm run test:security`、`npm run typecheck:app`、`npm run build`、内容契约：PASS。
- `npm run test:unit`：141/141 PASS；`npm run test:contract` 全部 PASS。
- Anima flows E2E：1/1 PASS；Anima desktop E2E：2/2 PASS。
- `npm run validate` 在最前面的新 `test:repo-hygiene` 停止；其报告为全仓既有 BOM/换行/Live2D 资源卫生债，属于并行 Q-10/B-00 范围，不是 Anima 测试失败，本轮未批量改动无关文件。

## 2026-08-09 · L-10 返工：五处必修复 + 真实可见 Companion 人工验证

### 返工修复内容
1. **异步 setCharacter**：aics_live2d_set_character 改为 pub async fn，经 send_command_async（tokio sleep 轮询）发送命令并以 rx.await 等待渲染线程完成模型/纹理加载；不再在主线程 pollster::block_on。前端 useLive2D.load() 把 setState('loading', ...) 提前到 backend.connect() 之前，加载期间 UI 线程空闲、loading 立即可见。
2. **跨线程点击穿透重设计**：依据微软 WM_NCHITTEST 文档（HTTRANSPARENT 只对同线程窗口转发，overlay 与 WebView2 分属不同线程），移除 HTTRANSPARENT 返回分支，改用系统级 SetWindowRgn 区域剪裁：交互区域 = 模型内容矩形 − WebView 控件矩形（subtract_rects 纯函数 + CombineRgn），区域外的点不落在 overlay 上，鼠标自然命中下层 WebView2（与线程无关）。WM_NCHITTEST 对区域内的点统一返回 HTCLIENT。前端 passthrough 从"stage 内控件"改为"全文档交互控件且与 stage 重叠"，并改用实测比例 bounds.width / window.innerWidth 代替 devicePixelRatio（per-monitor 下后者与 WebView2 视口实际换算可能不一致，导致 overlay 与控件矩形整体错位）。
3. **Native 接电 165fps**：useLive2D.setMaxFps 对 native 会话上限放宽到 165（browser 保持 120）；ChatCharacterStage.setDesktopPerformanceMode 电池 30 / 接电 native 165、browser 60；nativeBackend.setMaxFps clamp 上限 165。
4. **单一情绪时间推进器**：applyParameters 的 native 分支只发送口型意图（sendMouthLevel），不再 emotionRuntime.update/sendEmotion；情绪推进唯一由 nativeEmotionTick（requestAnimationFrame）驱动。
5. **active motion 记录 group/index + busy 拒绝**：ActiveMotion 增加 group/index；PlayMotion 收到同组 Interaction 请求且动作未结束时返回 motion already playing: group[index]，不 force 重启；前端新增 session.onMotionFailed 订阅，reason 含 already playing 时显示"这个动作正在进行中"。另修复 overlay 窗口标题悬垂指针（临时 Vec 生命周期）与 model_bounds 钳制到 overlay 矩形内。

### 修改文件
- desktop-tauri/src-tauri/src/live2d_overlay.rs（async set_character、SetWindowRgn 区域、busy 拒绝、model_bounds 钳制、窗口标题生命周期、单测）
- src/composables/useLive2D.ts（loading 前置、165fps、单一情绪时钟、onMotionFailed、实测比例、全文档 passthrough）
- src/live2d/nativeBackend.ts（165 上限、onMotionFailed 暴露）
- src/live2d/types.ts（onMotionFailed 可选会话接口）
- src/components/ChatCharacterStage.vue（native 165/30 电源模式）
- scripts/tests/test-live2d-backend.js（165 clamp、onMotionFailed 转发）
- scripts/tests/test-live2d-native-contract.js（SetWindowRgn、async command、单一时钟、busy 断言）

### 自动验证证据
- `npm run typecheck:app` -> PASS；
- `npm run build` -> PASS。
- `node scripts/tests/test-live2d-backend.js` -> PASS，21/21。
- `node scripts/tests/test-live2d-native-contract.js` -> PASS，3/3。
- cargo test -> PASS，12/12（新增 subtract_rects 面积/不相交、busy 同组拒绝、口型映射）。
- `npm run test:live2d-native:release` -> PASS，snapshots=3/3。

### 真实可见 Companion 人工验证（release exe + WebView2 远程调试 CDP + Win32 工具）
启动 release ai-cg-studio-desktop.exe（不带 --hidden），窗口 920×818，Live2D native 后端自动加载：

| 验证项 | 结果 | 证据 |
|---|---|---|
| 可见冷启动 | PASS | 窗口可见即 data-backend=native、data-state=ready、按钮"Live2D 已连接"，无需二次点击 |
| 窗口 move/resize | PASS | SetWindowPos 多轮后 overlay 恒为窗口 +8,+8 偏移、−16,−16 尺寸（如 窗口 920,818 → overlay 904,802） |
| 透明区域点击 | PASS | GetWindowRgn=COMPLEXREGION；PtInRegion 逐点验证：模型中心命中、左侧/工具栏/输入框区域均不在 region（系统级穿透到 WebView2）；输入框点击后 document.activeElement=TEXTAREA(.companion-input) |
| Live2D 关闭按钮 | PASS | 点击 avatar-status → Leave 播放 → overlay IsWindowVisible=False；再点"启用 Live2D" → overlay 恢复 |
| 双角色 HitArea | PASS | 宁宁（裙摆→"触发了裙摆互动"、头部→"轻碰了脸颊"）、夏目（→"夏目抬眼看了你一下"），Cubism 原生 HitArea 区分 |
| 同一互动重复点击 | PASS | 连点两次显示"这个动作正在进行中"（Rust busy 拒绝 + onMotionFailed） |
| 隐藏后 overlay 消失 | PASS | 点击工具栏"隐藏" → companion 与 overlay 均 IsWindowVisible=False |
| DPI | 环境受限 | 本会话 LogPixels=108（112.5% 缩放），GetDpiForWindow 不可用；per-monitor v2 已声明；125% 切换需注销，未能本会话实测 |

### 环境限制（如实记录）
- 本会话系统鼠标注入（SetCursorPos + mouse_event / SendInput）无法到达 WebView2 页面（mousemove 均不达，判定为远程/合成器环境限制，非应用缺陷）；页面交互与按钮链路改用 PostMessage 到 WebView2 主窗口验证（输入框聚焦、关闭/启用、角色切换、隐藏均生效）。
- 同一会话观察到 WebView2 视口换算抖动（innerWidth 在窗口物理宽 1:1 与 1:1.75 之间跳变）；前端已改用实测比例 bounds.width / window.innerWidth 自适应（devicePixelRatio 在此类环境会整体错位），为当前最鲁棒方案；正常桌面环境视口稳定。
- 另发现既有行为：网关重启（start_gateway_monitor）会把 companion 窗口 navigate 到网关根路径（丢失 /companion），导致页面变回 SPA；本次未修复（属既有监控路径），建议后续排期。

### 下一位接入点
- L-10 返工五项均已修复并经真实可见 Companion 验证；desktop-tauri/native-live2d/src/renderer.rs 仍由 L-20 独占，本轮未触碰。
- 建议后续处理：网关重启后 companion 窗口导航路径丢失（navigate 应带 /companion）；125% DPI 的完整人工验收需在可切换 DPI 的桌面会话执行。

## 2026-08-09 · L-20 Native 渲染缓存与长稳

### 完成内容
- `renderer.rs` 缓存模型级 geometry、UV/index buffer、texture bind group、mask texture/bind group 和动态 uniform buffer；每帧只更新动态 position/uniform 数据，mask pass 与 main pass 共用一个 command encoder。
- 动态上传改为持久 `COPY_SRC|COPY_DST` upload buffer，每帧一次 staging 写入再 copy 到目标 buffer；纹理加载改为持久 mapped staging buffer，避免 8K/4K 纹理切换时重复创建 native staging allocation。
- `model.rs` 增加稳定模型 cache key、可复用 `drawables_into` snapshot 和无分配 `content_bounds` 遍历，消除 overlay 每帧重复复制 drawable 几何 Vec。
- 新增 `renderer_soak` Native benchmark 与 `run-live2d-renderer-soak.js`，记录缓存创建计数、p50/p95 frame time、Working Set、进程级 GPU dedicated/shared memory 和角色切换稳定性。

### 修改文件
- `desktop-tauri/native-live2d/src/renderer.rs`
- `desktop-tauri/native-live2d/src/model.rs`
- `desktop-tauri/native-live2d/examples/renderer_soak.rs`
- `scripts/tests/run-live2d-renderer-soak.js`
- `docs/live2d-native-runtime.md`

### 验证证据
- `cargo build --release --locked --manifest-path desktop-tauri/native-live2d/Cargo.toml` -> PASS。
- `cargo test --locked --manifest-path desktop-tauri/native-live2d/Cargo.toml` -> PASS，unit/doc tests 0/0。
- `npm run test:live2d-native:release` -> PASS，当前源码 release 构建，`snapshots=3/3 exit=0`。
- `node scripts/tests/run-live2d-renderer-soak.js --seconds 300 --switch-every 60 --sample-ms 2000 --warmup 120 --size 800 --fps 165` -> PASS，48038 帧、4 次切换、`render_fps=164.8`、p50/p95=`1.131/1.899ms`、预热/切换稳定帧 `frame_creations=0`。
- 5 分钟报告显示 Working Set 首/末季度约 `511.3/509.2MiB`，GPU dedicated `480.3/448.4MiB`，GPU shared `426.6/428.6MiB`，无持续增长。
- `node --check scripts/tests/run-live2d-renderer-soak.js`、`git diff --check` -> PASS。

### 真机证据
- Windows x64 + NVIDIA GeForce RTX 4070 Ti SUPER + DX12；Cubism SDK：`E:\code\CubismSdkForNative-5-r.5\CubismSdkForNative-5-r.5`。
- release renderer benchmark 使用 800×800 常驻目标、165fps 目标、宁宁/夏目交替加载；进程级 GPU counters 全程一致。
- 离屏宁宁纹理 staging 回归图：`C:\Users\ADMINI~1\AppData\Local\Temp\opencode\l2d-cache-nene-upload.png`；视觉检查未发现缓存/纹理上传新增的 mask、blend、透明度或部件缺失问题。

### 仍未完成
- 用户将长稳门槛从 30 分钟调整为 5 分钟；5 分钟已通过，未再执行 30 分钟。
- 无 L-20 自有阻断；Native 完整 release selftest 已在 L-10 返工完成后重跑通过。

### 踩坑与参考
- `Queue::write_buffer` 在 native 每次使用临时 staging allocation；大量 drawable position 写入会导致 Working Set/GPU 内存增长。官方资料：`https://docs.rs/wgpu/24.0.0/wgpu/struct.Queue.html`、`https://docs.rs/wgpu/24.0.0/wgpu/util/struct.StagingBelt.html`。
- 进程级 GPU counter 使用 `GPU Process Memory(pid_<PID>_*)`；不能把 `GPU Adapter Memory` 回退数据与进程样本混合，否则会误报其他进程的显存增长。官方仓库已通过 `https://api.github.com/repos/gfx-rs/wgpu` 验证。

### 下一位接入点
- renderer 只要求调用方继续按现有契约：`draw_frame()` 返回 encoder，由 overlay 负责一次 `queue.submit`；不得修改 `live2d_overlay.rs`、`useLive2D.ts` 或 `nativeBackend.ts` 以接入缓存。
- `Model::cache_key()` 用于模型替换失效；`drawables_into()` 与 `content_bounds()` 已是 Native 内部低分配路径。
- 独立性能门禁入口：`node scripts/tests/run-live2d-renderer-soak.js`；默认 1800 秒，短验收可显式传 `--seconds 300`，不应加入无 GPU 的默认 validate。

## 2026-08-09 · Q-10 质量门禁分层

### 完成内容
- `package.json` 将默认质量链拆为 `check`、`test:unit`、`test:contract`，`validate` 只组合三层；纯测试由 `node --test --test-concurrency=4` 并行，端口/HTTP/进程契约测试保持顺序执行。
- 新增 `validate:desktop`（桌面壳编译、Electron 壳契约、深链）与显式 `test:live`（真实 TTS、ComfyUI Anima、Native Live2D），真实 GPU/服务不进入默认 validate。
- 新增 `scripts/tests/test-repo-hygiene.js`：相对 Git 基线拦截新增 BOM、非法控制字符、尾随空白、换行漂移和缺少末尾换行；CI 使用 PR base/`HEAD^`，本地使用 index，历史交接段落不重写。
- `tsconfig.runtime.json` 改为自动包含 `services/**/*.ts` 并排除生成物；`test-runtime-generated.js` 在临时目录重新 emit，逐字节比对提交的 `.js/.d.ts`，发现漏提交或过期产物即失败。
- `desktop-stage-resources.js` staging `services/` 时只复制运行时 `.js`；新增 `test-desktop-staging.js` 覆盖 `.ts/.d.ts` 不进入安装资源。
- `.github/workflows/quality.yml` 使用完整 Git history，并显式运行 check/unit/contract 三层；nightly visual lane 继续独立运行。

### 修改文件
- `package.json`
- `tsconfig.runtime.json`
- `.github/workflows/quality.yml`
- `scripts/maintenance/desktop-stage-resources.js`
- `scripts/tests/run-quality-suite.js`
- `scripts/tests/test-repo-hygiene.js`
- `scripts/tests/test-runtime-generated.js`
- `scripts/tests/test-desktop-staging.js`
- `scripts/tests/test-quality-gates.js`
- `docs/project-handoff.md`

### 验证证据
- `npm run typecheck` -> PASS。
- `npm run typecheck:app` -> PASS。
- `npm run build:runtime` -> PASS；`npm run test:services-generated` -> PASS。
- `npm run build` -> PASS；bundle budget/precompress -> PASS。
- `npm run validate:desktop` -> PASS（desktop build、Electron contract、deep link 4/4）。
- `npm run test:unit` -> PASS，141 tests。
- `npm run test:contract` -> PASS，含 Anima route real HTTP 3/3、gateway/training/security/chat contracts。
- `npm run test:repo-hygiene`、`test:desktop-staging`、`test:quality-gates`、`test-e2e-ci-split` -> PASS。

### 当前阻断
- `npm run check` / `npm run validate` 尚未全绿：`npm run lint:js` 在既有并行改动 `scripts/tests/mock-upstreams.js:278` 报 `promptId` `no-redeclare`。该文件不属于 Q-10，不在本任务中修改；修复后需重跑 `npm run validate`。

### 下一位接入点
- 默认 PR 门禁入口：`npm run validate`；Windows 桌面门禁：`npm run validate:desktop` + `npm run test:live2d-native:release`；真实服务/GPU 汇总：`npm run test:live`。
- `test-repo-hygiene.js` 的基线选择依赖 CI `fetch-depth: 0`；不要把 `test:live` 或 Native selftest 串回默认 validate。

## 2026-08-09 · SOL L-10 返工复审

### 结论
- L-10 暂不签收；异步加载、165fps、单一情绪时钟和 motion busy 拒绝均已收口，但新的 `SetWindowRgn` 穿透实现仍有一个坐标系阻断。
- `SetWindowRgn` 的 region 坐标必须相对窗口左上角；当前 `model_bounds` 与 `passthrough` 都是屏幕绝对物理坐标，未经减去 overlay 的 `rect.x/rect.y` 就传入 GDI。窗口位于非零屏幕坐标或移动后，region 会重复叠加窗口偏移，造成模型裁切、点击命中和透明区域穿透错位。
- 现有 `subtract_rects` 单测只使用 `outer.x=0/y=0`，没有覆盖非零窗口原点。修复时应在构建 HRGN 前统一转换为 overlay-local 坐标，并增加窗口原点非零、移动后 region 保持相同局部形状的测试。
- 次要边界：`rects.is_empty()` 当前调用 `SetWindowRgn(hwnd, NULL, ...)`，其语义是恢复完整窗口区域，不是空区域；穿透孔完全覆盖模型区域时会反向吞掉整个 overlay 点击，也应一并修正或明确隐藏窗口区域。

### 复测证据
- `cargo test --locked`（`desktop-tauri/src-tauri`）：12/12 PASS。
- `node scripts/tests/test-live2d-backend.js`：21/21 PASS。
- `node scripts/tests/test-live2d-native-contract.js`：3/3 PASS。
- `npm run test:live2d-native:release`：PASS，`snapshots=3/3 exit=0`。
- `npm run typecheck:app`：PASS。
- Win32 依据：Microsoft `SetWindowRgn` 文档明确 region 坐标相对窗口左上角，而不是屏幕坐标。

## 2026-08-09 · SOL 直接收口 L-10，并复审 L-20 / Q-10 首轮

### L-10 直接修复与结论
- `SetWindowRgn` 前把模型边界与 WebView 穿透孔从屏幕物理坐标转换为 overlay-local 坐标；窗口移动时缓存键使用局部形状，不再重复叠加屏幕偏移。
- 穿透孔完全覆盖模型时改为提交真正的空 HRGN；不再用 `SetWindowRgn(..., NULL, ...)` 错误恢复完整窗口。
- 网关自愈重启后 Companion 固定导航回 `{gateway}/companion`，避免退回根路由并失去 Native bridge。
- Companion 接电状态文案与实际行为统一为 Native 165 FPS；同时修复 `mock-upstreams.js` 的 `promptId` lint 重声明。
- 新增非零窗口原点与移动后 region 局部坐标不变的 Rust 回归测试，并增加 Native contract 静态哨兵。
- 结论：L-10 源码阻断已由 SOL 直接收口；125% DPI 仍需在可切换 DPI 的真实桌面会话补一轮人工证据，但不再有已知代码级阻断。

### L-10 验证
- `cargo test --locked`（`desktop-tauri/src-tauri`）：13/13 PASS。
- `node scripts/tests/test-live2d-native-contract.js`：3/3 PASS。
- `npm run typecheck:app`、`npm run build`：PASS。
- `npm run lint:js`：0 error（7 个既有 warning）。
- `npm run test:live2d-native:release`：串行复跑 PASS，`snapshots=3/3 exit=0`。此前与 Vite build 并行时 rustc/Vite 同时 OOM，属于本机资源竞争，不是代码失败。
- SOL 另将 `AnimaQuickPanel.vue` 的新增字号、圆角、白色透明层和主按钮颜色全部收敛到现有设计 token；样式扫描中该组件已从 22 项降为 0。当前 `npm run check` 继续停在其他并行改动造成的全仓样式预算 `34 > 26`，不再由 Anima 或 L-10 阻断。

### L-20 首轮复审：退回执行者
- 不签收，问题数量与范围已超过顺手修复：
  1. `Renderer` 的 model cache 与约 256 MiB 级纹理 upload buffer 在 Live2D `destroy` 后不释放，只会在下一模型渲染时失效；违反释放模型契约。
  2. `model.rs` 对零长度顶点/索引/mask 仍可能用空指针调用 `from_raw_parts`，存在 Rust UB。
  3. soak 门禁不强制角色切换、destroy 后回落、最小帧/绘制量或完整资源创建计数，且继承 `L2D_*` 调试变量，可在低工作量下误通过。
  4. 当前只预建可见 drawable/活跃 mask；动作或衣装首次显示隐藏层时仍会在运行帧创建 geometry、mask texture 与 bind group，不满足预热后零静态资源创建。
  5. surface `Lost/Outdated` 被计作成功帧但不 reconfigure；另有 165 FPS 热路径临时集合、CString 与 `Queue::write_buffer` staging 分配尚未纳入分配率门禁。
- 必须由 L-20 执行者按资源生命周期、FFI 安全和 benchmark 可信度整体返工；SOL 本轮不修改其独占 `renderer.rs/model.rs`。

### Q-10 首轮复审：退回执行者
- 不签收，门禁设计存在系统性漏报与副作用：
  1. 默认 `validate -> test:contract` 的 gateway/chat 测试仍使用项目 runtime、固定端口并尝试访问真实 `127.0.0.1:7860`；必须统一临时 runtime、动态端口和 mock 上游。
  2. repo hygiene 本地优先使用 index 作为基线，staged-only 会与自身比较；普通 untracked 文件未枚举，同文件已有历史问题会遮蔽后续违规，已出现 `git diff --check` 报错但门禁通过的假阴性。
  3. `validate:desktop` 未进入 GitHub Actions，PR 可在桌面编译、壳契约或深链损坏时保持全绿；需增加 Windows desktop job。
  4. runtime generated 检查不识别孤儿 `.js/.d.ts`，也不验证生成物已被 Git 跟踪；孤儿 JS 仍可能进入桌面 staging。
  5. desktop staging 测试只测手工 filter，不验证生产入口接线；固定 staging 目录无锁删除/`npm ci`，并发构建会互相破坏。
  6. 分层没有测试清单完整性断言，`test-mood-tag.js`、`test-tunnel-restart.js` 等确定性测试落在所有默认 lane 之外。
- `mock-upstreams.js` 的单个 lint 重声明已由 SOL 顺手修复；其余必须由 Q-10 执行者按基线、隔离、CI 和清单完整性整体返工。

## 2026-08-09 · SOL 并行续作安排

- 执行者 A 在 L-20/Q-10 返工期间立即启动 V-10，完成 6 场景 × 3 seed × SD v18/Anima v19 的真实生产路由视觉矩阵和逐图人工审核。
- 执行者 B 立即启动 R-10，只收口 `aics_draw_engine` 设置 Repository、备份登记和作品删除补偿事务，不扩大到聊天/训练等存储迁移。
- 详细实施顺序、文件边界、验收与停止条件已追加到 `docs/next-phase-task-assignments.md` §12。
- GPU 使用互斥：V-10 的 ComfyUI/SD 生成不得与 L-20 soak 或 Native release selftest 同时运行；脚本准备、Repository 开发与人工审核可并行。

## 2026-08-09 · V-10 v19 视觉审核矩阵

### 完成内容
- 固定 6 个宁宁场景：`sc260` 特写、`sc261` 半身、`sc262` 全身/舞台强光、`sc263` 复杂魔女服装/复杂魔法背景、`sc264` R18 图书室夕照、`sc265` R18 深夜卧室。
- 固定 3 个 seed：`20260809`、`20260810`、`20260811`；两引擎统一使用 `1216x832`，因为生产 Anima API 不允许场景原推荐的 `1344x768`。
- 共生成 36 张：18 张 SD v18 基线 + 18 张生产 Anima v19 候选。SD 使用 WAI v17、30 steps、CFG 6、Euler a；Anima 使用 `anima-base-v1.0`、`L_NENE_V19_ANIMA`、strength `0.85`、24 steps、CFG 3、`res_multistep/simple`。
- Anima 全部通过生产 `POST /api/anima/jobs`、状态轮询和应用结果 URL；脚本没有复制 workflow，浏览器/脚本没有直连 ComfyUI。
- GPU 独占按阶段执行：SD 阶段停止 ComfyUI；Anima 阶段停止 SD 并启动 ComfyUI；未与 L-20 soak 或 Native selftest 并行，生成结束后已停止 ComfyUI。
- 每张原图均由当前视觉模型逐张人工检查，审核字段覆盖身份、脸/发饰、服装、手腿结构、构图、光照、背景叙事、LoRA 过拟合和 Prompt 表达；没有用文件名、CLIP 或自动评分替代人工结论。

### 修改文件
- `scripts/tests/generate-v19-visual-matrix.js`
- `scripts/maintenance/build-v19-visual-audit-sheets.py`
- `docs/project-handoff.md`（仅追加本节）

### 图片与审核产物
- 图片目录：`E:\code\2\lora\AI\Reviews\AnimaV19VisualMatrix\2026-08-09_6x3\images\`
- 固定参数 manifest：`E:\code\2\lora\AI\Reviews\AnimaV19VisualMatrix\2026-08-09_6x3\manifest.json`
- 逐图人工结论：`E:\code\2\lora\AI\Reviews\AnimaV19VisualMatrix\2026-08-09_6x3\manual-review.json`
- 联系表：`E:\code\2\lora\AI\Reviews\AnimaV19VisualMatrix\2026-08-09_6x3\contact_sheets\manifest.json`（5 张，18 个 SD/Anima 配对）

### 逐图结论
- `sc260 / 20260809`：SD **FAIL**，特写裁掉交握双手；Anima **PASS**，下巴下交握手和教室窗景完整。
- `sc260 / 20260810`：SD **PASS**，交握手略有指间粘连；Anima **PASS**，手部和祈求表情更稳定。
- `sc260 / 20260811`：SD **PASS**，夕照构图通过；Anima **PASS**，正面教室和交握手通过。
- `sc261 / 20260809`：SD **FAIL**，背景漂移为海滩/海景；Anima **PASS**，粉色卧室、蓝色睡衣和晨光完整。
- `sc261 / 20260810`：SD **FAIL**，睡衣漂移为薄荷绿、姿势和卧室背景错误；Anima **PASS**。
- `sc261 / 20260811`：SD **FAIL**，蓝色瓷砖/窗景替代粉色卧室；Anima **PASS**。
- `sc262 / 20260809`：SD **FAIL**，缺失花束礼盒和舞台环境；Anima **PASS**，双臂抱礼盒、舞台金光和星饰完整。
- `sc262 / 20260810`：SD **FAIL**，改成单手小礼盒和户外蓝天；Anima **PASS**。
- `sc262 / 20260811`：SD **FAIL**，礼盒和舞台均缺失；Anima **PASS**。
- `sc263 / 20260809`：SD **PASS**，魔女服和枪械动作通过，枪械圆筒略松；Anima **PASS**，枪械和手部更清晰。
- `sc263 / 20260810`：SD **PASS**，服装/魔法背景通过但透视较弱；Anima **PASS**。
- `sc263 / 20260811`：SD **PASS**，动作叙事通过，扳机处轻微指粘连；Anima **PASS**。
- `sc264 / 20260809`：SD **FAIL**，嘴里出现未要求的三明治，破坏成人羞恼叙事；Anima **PASS**。
- `sc264 / 20260810`：SD **FAIL**，缺呆毛且视线下移；Anima **PASS**。
- `sc264 / 20260811`：SD **FAIL**，缺发饰/呆毛并漂移为深蓝灰领服装；Anima **PASS**。
- `sc265 / 20260809`：SD **PASS**，成人侧卧叙事通过但夜色偏亮、手指轻微粘连；Anima **PASS**。
- `sc265 / 20260810`：SD **FAIL**，右上出现蓝天/水面伪影，缺失深蓝月光卧室；Anima **PASS**。
- `sc265 / 20260811`：SD **FAIL**，黄色错误领结、靠墙姿势和低角度替代床上右侧卧；Anima **PASS**。

### 汇总结论
- 全图通过率：SD v18 `6/18`，Anima v19 `18/18`。
- 身份/官方特征通过率：SD v18 `16/18`，Anima v19 `18/18`，Anima 不低于基线。
- 配对结果：Anima 在 `12/18` 个 seed 配对中胜出，`6/18` 平局；没有 SD 胜出的配对。
- Anima 在 `sc261`、`sc262`、`sc264`、`sc265` 稳定优于 SD 的服装/场景表达；`sc260` 手势更稳定；`sc263` 两者均通过，SD 镜头变化更多，Anima 枪械/手部更干净。
- 未发现 Anima 系统性身份漂移、脸部崩坏、肢体串位或 LoRA 过拟合；Anima v19 达到本轮 V-10 矩阵门槛。

### 验证证据
- `node --check scripts/tests/generate-v19-visual-matrix.js` -> PASS。
- `node scripts/tests/generate-v19-visual-matrix.js --engine sd --dry-run` -> PASS，固定场景/seed/路由/尺寸输出正确。
- `node scripts/tests/generate-v19-visual-matrix.js --engine sd --validate` -> PASS，`records=36`，文件大小与 SHA256 全部匹配。
- `python scripts/maintenance/build-v19-visual-audit-sheets.py --audit E:\code\2\lora\AI\Reviews\AnimaV19VisualMatrix\2026-08-09_6x3` -> PASS，`5 sheets / 18 pairs`。
- `npm run test:prompt-policy` -> PASS。
- `npm run test:prompt-builder` -> PASS。
- `node scripts/tests/test-sd-runtime.js` -> PASS。
- SD 真实生成命令 `node scripts/tests/generate-v19-visual-matrix.js --engine sd` -> PASS，18/18。
- Anima 真实生成命令 `node scripts/tests/generate-v19-visual-matrix.js --engine anima` -> PASS，18/18，生产 `/api/anima/*` 路由。
- `manual-review.json` JSON/计数校验 -> PASS，36 条，全部为 `pass` 或 `fail`，无 `pending`。

### 真机证据
- Windows x64 + NVIDIA GeForce RTX 4070 Ti SUPER；真实 SD WebUI reForge 与真实 ComfyUI，非 mock。
- SD 阶段 GPU 独占：停止 ComfyUI 后运行；Anima 阶段 GPU 独占：停止 SD 后运行；Native/L-20 未启动。
- 生成过程未修改 `desktop-tauri/**`、`src/storage/**`、`package.json`、Q-10 文件或 Krea 2 文件。

### 仍未完成
- 本矩阵只覆盖 6 场景 × 3 seed，不构成全量发布质量证明；Anima 继续保持 experimental。
- 未执行完整 `npm run validate` 或全量 Playwright；本任务仅运行 V-10 要求的生成脚本校验、Prompt/SD 定向测试。
- 未将审核图片或 AI 工作区 manifest 提交仓库；下一步可由 SOL 决定是否基于本矩阵开启更大审核集，但不得直接跳过人工审核。

### 下一位接入点
- 读取 `manual-review.json` 的 36 条逐图结论和 `manifest.json` 的真实 job/参数记录；不要用联系表替代原图复核。
- 若要扩大模型或场景范围，先重新固定矩阵并取得 GPU 独占窗口；不得修改 A-10 安全边界、绕过 `/api/anima/*`、启动 Krea 2 或与 L-20/Native 并行。

## 2026-08-09 · R-10 Storage Repository 第一阶段

### 完成内容
- 在 `src/utils/storageKeys.ts` 登记 `DRAW_ENGINE_KEY = 'aics_draw_engine'`，保留原键名以兼容已有 Anima 偏好；备份收集、死键清理和恢复白名单自动覆盖该键。
- 新增 `src/storage/settingsRepository.ts`，提供可注入 Storage 的 typed `get/set/remove`；`PromptBuilderView.vue` 的 draw engine 读取、切换写入已改用 `DRAW_ENGINE_SETTING`，不再直接读写裸 localStorage 字符串。
- 新增 `src/storage/artworkRepository.ts`，公开 `artworkRepository.deleteArtwork(id)`；统一处理 `aics_pb_history` 记录、`aics_pb_projects.history_ids` 引用、IndexedDB 原图和 `thumb:<image_id>` 缩略图。
- 跨 KV 与 image store 不宣称原子事务：删除前快照历史、项目、原图元数据和缩略图；记录写入、原图删除或缩略图删除任一步失败时执行补偿回滚，并通过 `ArtworkDeletionError.rollbackErrors` 暴露回滚失败。
- Gallery 删除入口与 PromptBuilder 历史删除入口均接入同一 Repository；界面只在 Repository 成功后更新，失败保持原状态并显示既有错误反馈。
- 新增独立 `scripts/tests/test-storage-repositories.js`：登记检查、设置 round-trip、成功删除、幂等删除和三类失败注入回滚。

### 修改文件
- `src/storage/settingsRepository.ts`
- `src/storage/artworkRepository.ts`
- `src/utils/storageKeys.ts`
- `src/views/PromptBuilderView.vue`
- `src/stores/promptBuilderStore.ts`
- `src/views/GalleryView.vue`
- `scripts/tests/test-storage-repositories.js`
- `scripts/tests/test-data-backup.js`
- `scripts/tests/test-gallery.js`

### 验证证据
- `npm run typecheck:app` -> PASS。
- `npm run build` -> PASS；bundle budget 与预压缩通过。
- `npm run test:backup` -> PASS，2/2；覆盖 `aics_draw_engine` 登记、收集、导出/恢复 round-trip 与恢复白名单。
- `npm run test:gallery` -> PASS，1/1；覆盖 Gallery 单一删除入口与 Repository 补偿契约。
- `node scripts/tests/test-storage-repositories.js` -> PASS，6/6；记录写入失败、原图删除失败、缩略图删除失败均证明持久化状态无半删除。
- `npm run test:prompt-builder` -> PASS，1/1。
- `npm run test:storage-health` -> PASS，1/1。
- `node scripts/tests/test-storage-reliability.js` -> PASS，KV/image 底层事务回归通过。

### 真机证据
- 本阶段不涉及 GPU、桌面壳或真机视觉链路；验证使用注入式 Storage/KV/image adapter 和现有浏览器存储契约测试。

### 仍未完成
- 无 R-10 代码阻断。
- `test-storage-repositories.js` 尚未接入 `package.json`、`run-quality-suite.js` 或 workflow；这些属于 Q-10 独占边界，留给 Q-10 接入测试分层。

### 踩坑与参考
- 独立 Node 原生 TypeScript 测试不会按 Vite alias 或无扩展相对 import 解析新模块；Repository 自有相对依赖使用显式 `.ts` 扩展，`vue-tsc` 与 Vite 构建均通过。
- `useKVStore` 与 `useImageStore` 是两个独立 IndexedDB 数据库，当前 Repository 使用快照和补偿回滚，不能把跨库流程描述成单事务。
- 全局 `git diff --check` 仍会报告并行既有文件 `docs/live2d-native-runtime.md` 的 trailing whitespace；R-10 未修改该文件。

### 下一位接入点
- 设置接入点：`DRAW_ENGINE_SETTING`、`settingsRepository`、`createSettingsRepository(storage)`。
- 作品删除接入点：`artworkRepository.deleteArtwork(id)` 或 `createArtworkRepository({ kv, images })`；测试可分别注入记录写入、原图删除和缩略图删除失败。
- Q-10 可将 `scripts/tests/test-storage-repositories.js` 接入质量分层，但不得把聊天、训练、Companion、主题或场景偏好迁移混入本阶段。

## 2026-08-09 · SOL 复审与签收 R-10

### 复审发现与收口
- 首轮额外反例复现了并发删除的数据损坏：同一 Repository 同时删除两条历史时，两次操作会读取同一旧快照，最终可能保留一条指向已删除原图的历史记录。
- `artworkRepository` 已增加实例级 mutation tail；应用中的 Gallery 与 Prompt Builder 共用单例，连续删除现在按提交顺序串行执行，每次快照都能看到上一操作结果。
- 原实现为回滚单张图片调用 `imgList()`，会把整个作品库的 Blob 全部拉入内存。新增 `imgGetRecord(id)`，删除前只读取实际将删除的目标原图记录。
- `test-storage-repositories.js` 增加并发删除回归和“只读取目标图片”断言；原有成功、幂等及三类失败补偿测试保留。

### SOL 验证
- `node scripts/tests/test-storage-repositories.js` -> PASS，7/7。
- `npm run test:backup` -> PASS，2/2。
- `npm run test:gallery`、`npm run test:prompt-builder`、`npm run test:storage-health` -> PASS。
- `node scripts/tests/test-storage-reliability.js` -> PASS。
- `npm run typecheck:app`、`npm run build` -> PASS；route bundle budget 与预压缩通过。

### 结论
- R-10 第一阶段签收，可解除执行者 B 的本任务文件独占。
- `test-storage-repositories.js` 接入默认质量分层仍归 Q-10；不得由 R-10 越界修改门禁文件。
- 多标签页下所有作品写入的统一仲裁仍需后续 Repository 迁移覆盖新增/更新入口；这是既有跨标签页写竞争，不阻断本阶段的单例删除事务签收。

## 2026-08-09 · 第一轮交付规则更新

- 用户确认后续委派任务只给执行者一次完整实现机会；SOL 必须在派发前提供到文件、步骤、数据、命令、失败注入、验收阈值和停止条件的详细方案。
- 第一轮存在功能、数据一致性、安全、性能或测试问题时，不再让原执行者连续试错，由 SOL 直接接管并完成最小正确修复。
- 可验证的外部环境阻断不按能力失败处理，但不得绕过生产链路制造替代证据。
- 完整规则已追加到 `docs/next-phase-task-assignments.md` §13。

## 2026-08-09 · SOL 接管 Anima v19 checkpoint 审核

- 第一轮 V-10 把 epoch 45 的 18 张 Anima 图逐张判为通过，但未检查同场景跨 seed 的姿势/构图收敛；按第一轮接管规则，SOL 直接接管而未继续让原执行者返工。
- 训练审计确认原运行使用 55 张 / 25 个视觉组、rank 16、alpha 16、`1e-4`、batch 1、45 epochs；TensorBoard 只有训练损失，没有真实验证曲线。官方 OneTrainer Anima preset 为 `3e-5`，clean default alpha 为 1。
- SOL 用保存的 epoch 10 / 20 与原 epoch 45 做 6 场景 × 3 seed checkpoint sweep；epoch 10 欠拟合，epoch 45 出现后期线条过烘焙和 seed 弹性下降，epoch 20 最平衡。
- `scripts/maintenance/promote-anima-checkpoint.js` 已将生产文件原子切换到 epoch 20 / step 1100；epoch 45 保留为 `ayachi_nene_v19_anima_e45_rejected.safetensors`，未删除原产物。
- epoch 20 经生产 `/api/anima/*` 路由重跑完整矩阵：18/18 通过，相对 SD v18 为 16 胜 / 2 平 / 0 负；安全 12/12 无成人泄漏，R18 6/6 按条件生效。
- 当前结论是不从零重训；Anima 继续保持 experimental。完整依据见 `docs/anima-v19-checkpoint-audit-2026-08-09.md`。

## 2026-08-09 · Q-10 返工：隔离门禁、Windows CI、staging 与清单完整性

### 完成内容
- gateway/chat/training/control contract 测试统一经过 `scripts/tests/gateway-test-stack.js`：每个测试使用临时 runtime、动态端口和本地 mock upstream，不再读取项目 runtime，也不触碰真实 `7860/9880/11434/5310` 服务。
- `scripts/tests/repo-hygiene-core.js` 改为分别扫描 Git index、tracked worktree 和未被 `.gitignore` 排除的 untracked 文件；index 读取实际 blob，worktree 读取实际字节，untracked 不再被历史基线遮蔽。
- repo hygiene 退回项以 `scripts/fixtures/repo-text-hygiene-debt.json` 的路径 + 精确 full-blob SHA-256 隔离。任何同路径内容变化都会失去 allowance；untracked 永不接受 allowance。`test-repo-hygiene-contract.js` 覆盖 staged、unstaged、untracked、未知扩展名、冲突 index、Git 错误和 hash 变化。
- `scripts/maintenance/runtime-generated-files.js` 现在同时检查 expected/missing/orphan/untracked/tracked-orphan，并由 `test-runtime-generated.js` 验证生成物逐字节一致。
- desktop staging 改为临时目录构建、生产入口复用、原子替换和 workspace lock；`test-desktop-staging.js` 覆盖旧 staging 保留、npm ci 失败回滚、并发互斥和 `runTauri` 接线。
- `scripts/tests/quality-test-inventory.js` 成为分层测试清单唯一来源，补入 `test-mood-tag.js`、`test-service-watchdog.js`、`test-storage-repositories.js`、`test-tunnel-restart.js` 等测试，并由 `test-quality-gates.js` 断言脚本与清单一致。
- `.github/workflows/quality.yml` 增加 Windows desktop contracts job；`.github/workflows/windows-native.yml` 增加 self-hosted Windows/Cubism release gate，Native selftest 保持在真实环境 lane，不进入默认 `validate`。

### 验证证据
- `node scripts/tests/test-repo-hygiene-contract.js` -> PASS，临时 Git 仓库契约全过。
- `npm run test:unit` -> PASS，164/164。
- `npm run test:contract` -> PASS，gateway/chat/training/control/security/tunnel/anima HTTP 契约全过。
- `npm run validate:desktop` -> PASS，desktop build、Electron contract、deep link 全过。
- `node scripts/tests/test-runtime-generated.js` -> PASS。
- `node scripts/tests/test-desktop-staging.js` -> PASS，4/4。
- `node scripts/tests/test-quality-gates.js`、`node scripts/tests/test-e2e-ci-split.js` -> PASS。
- `npm run lint:js`、`npm run typecheck`、`npm run typecheck:app`、`npm run build:runtime`、`npm run build` -> PASS。

### 当前边界
- Q-10 返工不修改 L-20 独占的 Native renderer/model，也不替真实 GPU、Cubism 或 TTS 环境制造本地替代证据。
- hygiene debt fixture 只容纳已记录的历史 blob；新建或修改文件必须直接满足 UTF-8、换行、末尾换行和 trailing whitespace 规则。
- Windows Native workflow 尚未在实际 self-hosted `live2d-cubism` runner 上执行；该结果需由 CI runner 提供，不能用当前机器的环境替代。
- 本次 `npm run validate` 已通过 Q-10 check、lint 和 typecheck，但在既有全仓样式预算 `34 > 26` 处停止；该预算来自并行视觉改动，不由 Q-10 返工引入，本轮未修改无关样式文件。

### 下一位接入点
- 继续保持 contract 测试通过 `gateway-test-stack.js`，新增 gateway route contract 不得恢复固定端口或真实上游访问。
- 修改 services 生成源后运行 `npm run test:services-generated`，不要手工编辑或删除提交的 `.js/.d.ts`。
- 修改桌面 staging 或 Tauri build 编排时，必须保留 `withDesktopBuildLock` 的整个临界区覆盖 build、prepare、验证和 CLI。

## 2026-08-09 · SOL 接管并签收 L-20 / Q-10

### 接管原因与修复
- C 的第二次交付仍未闭合首轮退回项，SOL 不再继续返工循环，直接接管 Native 与质量门禁文件。
- L-20：修复零长度 FFI UB、模型 destroy 后 GPU cache/upload 滞留、隐藏层延迟建资源、Surface 恢复/成功帧误计、RGBA/BGRA 颜色格式耦合、uniform slot 误限和 soak 低工作量假通过。
- Q-10：修复 self-hosted runner 可手动执行非 main ref、Windows Node 24 直接 spawn `npm.cmd`、测试 fake PID 可能误杀宿主进程、caller-owned runtime 被递归删除、活进程锁超过 6 小时被抢占，以及 hygiene fixture 可在同次提交为新债背书。
- CI repo hygiene 在 PR/push 使用 Git base SHA 的 exact full-blob baseline；本地脏工作树才叠加历史 fixture。新增/修改坏 blob、staged-only、untracked、缺末尾换行均会失败。
- quality inventory validator 已移出自身 inventory 并先行执行；各 lane 增加子进程 timeout。Windows Native 只允许 main，checkout 不保留凭据，官方 actions 固定到 GitHub API 已确认的 commit SHA，并执行 300 秒 renderer soak。

### 验证证据
- `npm run test:check`：PASS，包括 repo hygiene、13 项 baseline 契约、desktop staging 6/6、runtime generated 与清单完整性。
- `npm run test:unit`：164/164 PASS；`npm run test:contract`：PASS；`npm run validate:desktop`：PASS。
- `npm run typecheck`、`npm run typecheck:app`、`npm run build:runtime`、`npm run lint:js`：PASS（仅 7 个既有 warning）。
- `npm run build:tauri`：PASS；production staging `97.2 MB`，Tauri release exe 构建成功。
- `npm run test:live2d-native:release`：PASS，3/3 snapshot；宁宁 motion/口型与夏目 snapshot 人工视觉审核全部通过。
- 120 秒 renderer soak：PASS，`18432` 帧、3 次切换、`render_fps=164.2`、p50/p95=`2.214/5.666ms`、最终资源全释放。
- 300 秒完整原始运行：`47960` 帧、4 次切换，预热后 Working Set/private/GPU 总量首末差分别 `+0.17/+0.53/+0.004MiB`。用户要求缩短等待，因此未继续 30 分钟本机运行；5 分钟 gate 已固定进 self-hosted Windows workflow。

### 签收与解锁
- `L-20` 代码与当前短/中时长稳定证据签收；30 分钟人工 soak 降为发布前强化项，不阻断后续开发。
- `Q-10` 签收，解除 `R-20` 阻断。
- `D-10` 可开始真实安装包验收；仍需补 125% DPI 和实际 self-hosted `live2d-cubism` workflow 运行证据。
- `npm run validate` 仍会在并行视觉改动的样式字面量预算处停止，当前计数 `34 > 26`；与本次 L-20/Q-10 修改无关。

## 2026-08-09 · 第二批第一轮任务已派发

### 分工
- 执行者 A：`D-10` 真实桌面发布验收。先完成 WebDriver/Windows 验收工具与只读 Native 诊断，等待 B、C 文件冻结后再构建唯一安装包并执行安装、DPI、TTS、300 秒产品 soak 和卸载矩阵。
- 执行者 B：`Q-20` 样式 Token 门禁收口。仅修改 `design-system.css`、`director.css`、`scene-card.css`，目标把 scanner 从 34 降到不高于 24，禁止提高 budget 或修改扫描器。
- 执行者 C：`R-20` API Client 第一阶段。建立 `src/api/` JSON 传输层，迁移控制、训练和维护明确调用方，保留 degraded status、打包 501、训练白名单与 AbortSignal 契约。

### 并行边界
- 详细实施顺序、文件所有权、失败注入、验收阈值和停止条件见 `docs/next-phase-task-assignments.md` §16。
- B、C 第一轮完成前，A 不得构建最终验收安装包；冻结后安装包 SHA-256 是 D-10 证据的唯一版本标识。
- 三位执行者使用各自独立的 round1 报告，不并发修改本文档。第一轮交付后全部停止，由 SOL 直接进行第二轮代码复审、修复和签收。

## 2026-08-09 · 第二批 SOL 第二轮结果

### 签收
- `Q-20`：PASS。样式 scanner 保持 `24 / 26`，代表性截图复审通过，完整 validate 不再受样式门禁阻断。
- `R-20`：PASS。统一 JSON API client、degraded status 唯一特例、取消/超时、501/409 元数据和指定调用方迁移均通过；`useCharacterRoomSession` 的剩余普通 JSON endpoint 已补迁移。
- `D-10` 代码与打包工具：PASS。Native 只读诊断、真实 WebDriver harness、安装包证据防污染和新 NSIS 构建均通过复审。

### 最终门禁
- `npm run validate`：PASS，184 项 unit 与全部 contract 全绿。
- `npm run build`、`npm run validate:desktop`：PASS。
- `cargo test --locked --manifest-path desktop-tauri/src-tauri/Cargo.toml`：13/13 PASS。
- R-20 相关 Playwright：任务原 grep 2/2 PASS；补充明确相关标题后 8/8 PASS。
- 样式字面量：`24 / 26`；硬编码颜色门禁：0。

### D-10 冻结版本
- NSIS：`desktop-tauri/src-tauri/target/release/bundle/nsis/AI-CG-Studio_1.5.0_x64-setup.exe`
- SHA-256：`ee9277f95143ae9499e657e290429fd0b361b8715c050969408a2a4b56cee178`
- 打包输入指纹：`84237fd2a3c9cbd623cdcbccb7854ed05b1d52bd67e45a4b820fa0f2e12b77a1`
- 证据：`E:\code\2\lora\AI\Reviews\DesktopAcceptance\2026-08-09_d10_round1\`

### 未解锁
- `D-10` 真实发布矩阵仍 BLOCKED：无管理员权限、GPT-SoVITS 离线、只有 100% 单屏、无实际 self-hosted workflow 证据。
- 因此尚无安装、迁移、冷/隐藏启动、真实 overlay/DPI/TTS、300 秒安装产品 soak、正常退出和卸载 PASS。
- Electron 继续保留；`DOC-10` 不标完成，等待 D-10 在满足环境条件的会话中补齐。

## 2026-08-09 · 第三轮工作台层级签收

- 第一轮按用户要求由 Luna 子智能体完成，SOL 只做第二轮源码、截图和质量门禁复核。
- Training 参数覆盖改为默认折叠；数据集、训练按钮、状态、进度、ETA、日志和 R18 样张功能保持。
- Control 正常服务降噪，离线、不完整和自愈状态获得优先强调；总体状态与桌面侧栏保持。
- Prompt Builder 窄屏顺序固定为故事、画布、核心决策；生成、队列和配音未隐藏。
- 6 张桌面/390px 截图全部 PASS，无横向滚动、裁切、标题断层或对比度问题。证据见 `.review-shots/round3-workbench/` 和 `docs/round3-workbench-hierarchy-luna.md`。

## 2026-08-09 · Anima v20 科学训练与生产晋级

- 新实验严格按 `docs/anima-v20-scientific-training-protocol.md` 预注册：Anima Base v1.0、transformer LoRA only、rank/alpha 32/32、LR `2e-5`、AdamW、真实 grouped held-out validation。
- 数据快照为 55 张 / 25 视觉组；42 张训练、13 张验证，按 `review.dedupe_group` 整组隔离。普通/R18 验证曲线使用独立 seed。
- Baseline A 完成 36 epochs / 1,512 steps。总验证损失 epoch 10 最低，R18 epoch 12 最低；固定保存点 shortlist 为 epoch 8/12，后期 checkpoint 因验证回升和视觉锁定淘汰。
- 真实生产 ComfyUI 固定矩阵比较 E08/E12/V19：E08 18/18 PASS、对 v19 为 15 胜 0 平 3 负；E12 有手部重叠和单人裂变双人两处失败。
- 已晋级 epoch 8 / step 336 为 `L_NENE_V20_ANIMA`，生产文件 `ayachi_nene_v20_anima.safetensors`，SHA-256 `e5c850dafe8fe8c9466e5378aa1192d3e4290b1d45cc46bb64a16fbb177c15ed`。
- 原 v19 文件未删除，SHA-256 `eb0a29dfbe0a80ea9fd63d874fdb49ac92ff8f6d3aedb91637c9141c807e9bb9`，用于明确回退而不再暴露给应用 API。
- 新 v20 通过真实网关 + ComfyUI 生产烟测 4/4；应用 catalog、profile、服务端白名单、绘图页和测试已同步。
- 用户选中的 `quality-space.png` 已固化为 `sc300`「暖金咖啡馆的魔女休息日」，源分片为 `data/scenes/nene-after-story.json`，并重建 298 场景数据与缓存版本。
- 完整训练、验证、盲审、diversity 与已知暗光卧室限制见 `docs/anima-v20-scientific-training-result-2026-08-09.md`。
