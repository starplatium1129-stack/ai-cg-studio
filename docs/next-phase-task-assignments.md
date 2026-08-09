# AI-CG-Studio 下一阶段任务分派

> 制定日期：2026-08-08
> 决策人：SOL
> 执行方式：三位协作者分批并行
> 当前原则：停止扩功能，先完成安全收口、Native Live2D 产品链路、可复现桌面发布与确定性质量门禁。

## 1. 所有人必须遵守

1. 开工前阅读 `AGENTS.md`、`docs/project-handoff.md` 和本文件。
2. 不修改任务包之外的文件。发现必须跨边界修改时，先在回报中说明，不要直接侵入其他执行者的文件。
3. 不撤销、不覆盖用户或其他协作者的未提交修改，禁止 `git reset --hard`、`git checkout --`。
4. 连续两次实验无效时停止盲试，先搜索官方文档、issue 或真实项目源码，并验证来源存在。
5. 新增安全测试必须断言真实 HTTP 路由输出，不能只测复制出来的 helper。
6. 修改 `src/` 至少运行 `npm run typecheck:app` 和 `npm run build`。
7. 修改 `services/*.ts` 必须运行 `npm run build:runtime`，并按当前仓库规则处理生成的 `.js/.d.ts`。
8. Native/ComfyUI/TTS 等真机测试不得以“环境缺失所以跳过”作为通过；应明确标记未执行和阻断原因。
9. 不启动视频生成、Krea 2、语音 P3/P4、Live2D 贴图压缩、Git LFS 或新一轮全站视觉改造。
10. 每个任务完成后，只在 `docs/project-handoff.md` 文末追加结果，不改已有历史段落。

## 2. 当前发布判断

- 主网站可以继续作为稳定基线。
- Tauri 壳和 Native Live2D 不能称为可发布版本。
- Anima 当前只能视为实验功能。
- Electron 必须保留，直到本文件的 `D-10` 全部通过。
- `npm run test:live2d-native` 不进入默认 `npm run validate`，改为 Windows Native 发布门禁。
- Native Live2D 默认只由 Companion 窗口拥有；Atelier `/chat` 默认继续使用 browser 后端，避免两个窗口争用同一个 overlay。

## 3. 批次总览

```text
批次 0：B-00 可复现基线（必须先完成，单人执行）

批次 1：三人并行
  执行者 A：L-10 Native Live2D 产品链路闭环
  执行者 B：A-10 ComfyUI 安全边界收口
  执行者 C：L-20 Native 渲染缓存与长稳

批次 2：三人并行
  执行者 A：D-10 真实桌面发布验收
  执行者 B：A-20 Anima Prompt 与角色契约
  执行者 C：Q-10 质量门禁分层

批次 3：三人并行
  执行者 A：V-10 v19 视觉审核矩阵
  执行者 B：R-10 Storage Repository 第一阶段
  执行者 C：R-20 API Client 第一阶段

最终批次：DOC-10 文档归一化与总验收
```

依赖关系：

```text
B-00
├─ L-10 ─┐
├─ L-20 ─┼─ D-10
├─ A-10 ─┴─ A-20 ── V-10
└─ Q-10

A-20 ── R-10
Q-10 ── R-20

全部完成 ── DOC-10
```

## 4. 文件冲突规则

| 文件或目录 | 唯一拥有者 | 顺序 |
|---|---|---|
| `package.json` | B-00 后转交 Q-10 | 串行 |
| `.gitignore`、`.gitattributes`、`.editorconfig` | B-00 | 独占 |
| `desktop-tauri/src-tauri/src/live2d_overlay.rs` | L-10 | 独占 |
| `src/composables/useLive2D.ts`、`src/live2d/nativeBackend.ts` | L-10 | 独占 |
| `desktop-tauri/native-live2d/src/renderer.rs` | L-20 | 独占 |
| `server.js`、Anima 服务端路由 | A-10 | 独占 |
| `src/components/AnimaQuickPanel.vue` | A-10 | 独占 |
| `src/views/PromptBuilderView.vue`、Prompt profile 文件 | A-20 | 独占，A-10 完成后开工 |
| `src/utils/storageKeys.ts`、`src/composables/useBackup.ts` | R-10 | A-20 完成后开工 |
| `.github/workflows/**` | Q-10 | 独占 |
| `docs/project-handoff.md` | 各执行者只追加自己的结果 | 不改旧段落 |

## 5. 批次 0

### B-00：建立可复现基线

**执行者**：基线管理员，完成后再启动三人并行。

**涉及文件**：

- `.gitignore`
- 新增 `.gitattributes`
- 可选新增 `.editorconfig`
- `package.json`
- `desktop-tauri/native-live2d/**`
- `desktop-tauri/web/index.html` 或对应确定性生成脚本
- Tauri sidecar、staging、构建和打包脚本
- `scripts/tests/run-live2d-selftest.js`

**已知问题**：

- `desktop-tauri/src-tauri/Cargo.toml:34` 依赖未跟踪的 `../native-live2d`。
- `package.json` 当前带 UTF-8 BOM，`node scripts/tests/test-e2e-ci-split.js` 会解析失败。
- `desktop-tauri/native-live2d/target/` 未正确忽略。
- `desktop-tauri/web/`、`resources/`、`binaries/` 被忽略，但缺少完整、确定性的准备命令。
- Native selftest 当前只运行预先存在的 debug exe，可能测试旧二进制。

**目标**：

1. 所有必需源码和构建输入进入 Git 跟踪范围。
2. 构建产物、快照、target、staging 和 node_modules 保持忽略。
3. 固定文本为 UTF-8 无 BOM，并建立换行/控制字符门禁。
4. 提供统一的 Tauri 准备、构建、测试、打包命令。
5. Native selftest 在运行前构建当前源码，正式门禁优先使用 release 产物。
6. Node sidecar 固定版本并校验 SHA256，不依赖本机碰巧已有的文件。

**验收标准**：

```powershell
git diff --check
node scripts/tests/test-e2e-ci-split.js
npm run build
cargo test --manifest-path desktop-tauri/src-tauri/Cargo.toml
```

新增的标准命令必须能完成：

```powershell
npm run build:tauri
npm run test:live2d-native:release
npm run package:tauri
```

最终必须在临时干净 clone 中执行一次完整 Tauri 构建。构建前后 `git status --short` 只能出现明确忽略的产物。

**预估工作量**：1 至 2 天。

**停止条件**：干净 clone 仍依赖工作区未跟踪文件时，不得宣布完成，也不得启动后续 Native 任务。

## 6. 批次 1

### L-10：Native Live2D 产品链路闭环

**执行者**：A。

**涉及文件**：

- `desktop-tauri/src-tauri/src/main_shared.rs`
- `desktop-tauri/src-tauri/src/shim.rs`
- `desktop-tauri/src-tauri/src/bridge.rs`
- `desktop-tauri/src-tauri/src/live2d_overlay.rs`
- `desktop-tauri/src-tauri/src/state.rs`
- `src/components/ChatCharacterStage.vue`
- `src/composables/useLive2D.ts`
- `src/live2d/nativeBackend.ts`
- `src/types/live2dNative.ts`
- `scripts/tests/test-live2d-backend.js`
- 新增独立 Native 前端/IPC 契约测试

**不要修改**：`desktop-tauri/native-live2d/src/renderer.rs`，该文件属于 L-20。

**已知阻断问题**：

1. Companion 打开 `/companion`，前端默认选择 browser，Native 实际未启用。
2. Rust hit-test 事件发 `{ areas: [...] }`，前端按数组处理。
3. Rust 未自动播放 Start/Idle，前端却声明 `entranceNative=true`。
4. 未指定动作 index 时固定使用 `0`，没有随机变体。
5. 夏目 `ParamMouthForm3` 应使用 `0..-0.5`，Rust 当前写 `0..1`。
6. 无配音时，情绪与用户反应脉冲没有稳定的 Native 更新时钟。
7. 停止说话时必须显式向 Rust 发送 mouth level 0。
8. 窗口移动不会稳定触发 overlay 重新定位。
9. 壳声明 `aics:visibility`，但隐藏路径没有发出 false 事件。
10. Native `setMaxFps` 是空实现，页面显示 30/60 FPS，但 Rust 默认仍为 165。
11. overlay 对整个舞台返回 `HTCLIENT`，透明区域和舞台按钮可能被截获。
12. `DesktopPaths` 同时位于 `AppState.paths` 和独立 managed state，所有权重复。
13. Companion 与 Atelier 都注入 Native bridge，存在争用单一 overlay 的风险。

**目标**：

1. Tauri Companion 可见启动时默认请求 native；`--hidden`、用户关闭 Live2D 时不得加载模型。
2. Atelier 默认 browser。若保留诊断 native 模式，必须保证 Companion 不同时持有 overlay。
3. 统一 hit-test、ready、motion、entrance 事件 payload 契约。
4. ready 订阅可可靠注销，反复启用/关闭不累积 Tauri listener。
5. Start、Idle 随机轮换、点击随机变体和 Leave 行为达到浏览器路径基线。
6. 夏目口型、宁宁口型、情绪、凝视和 mouth reset 正确。
7. overlay 随窗口 move、resize、DPI、显示/隐藏同步更新。
8. 透明区域不吞掉必须到达 WebView 的交互；关闭 Live2D 的按钮必须始终可操作。
9. Native 帧率响应前端电源模式，隐藏后停止渲染。
10. 收敛 DesktopPaths 为单一可信来源。

**自动验收**：

```powershell
npm run typecheck:app
npm run build
node --test scripts/tests/test-live2d-backend.js
cargo test --manifest-path desktop-tauri/src-tauri/Cargo.toml
npm run test:live2d-native:release
```

必须新增并通过的断言：

- Tauri Companion URL 或 dataset 明确选择 native。
- Atelier 默认 browser。
- hit-test listener 收到 `string[]`。
- repeated connect/destroy 后订阅数不增长。
- hidden 后 overlay `visible=false`，frame count 停止增加。
- move/resize 后 overlay rect 更新。
- 夏目 mouth level 1 映射到约 `-0.5`。
- 无 TTS 时 push emotion 仍能送达 Rust。
- 未指定 motion index 时不会固定为 0。
- Start 和 Idle 在真实产品链路中启动，不只在 selftest 中启动。

**人工验收**：

- 可见 Companion 冷启动一次成功，不需要二次点击。
- 舞台按钮、Live2D 关闭入口和透明区域交互正常。
- 宁宁、夏目点击不同区域能触发对应作者动作。
- 隐藏 Companion 后原生角色窗口不残留在桌面。

**预估工作量**：4 至 6 天。

**回退原则**：若 Native 在窗口移动、透明点击或 DPI 上连续两轮无法稳定，生产默认回退 browser，Native 标记 experimental；先查官方 Win32/Tauri/wgpu 资料后再继续。

### A-10：收口 ComfyUI 安全边界

**执行者**：B。

**涉及文件**：

- `server.js`
- 新增 `routes/anima.js`
- 可选新增 `services/anima-service.ts` 及编译产物
- `src/components/AnimaQuickPanel.vue`
- `scripts/tests/mock-upstreams.js`
- `scripts/tests/mock-stack.js`
- 新增 `scripts/tests/test-anima-routes.js`
- 新增或扩展 Anima mock E2E

**不要修改**：`PromptBuilderView.vue`、`usePromptAssembly.ts`、`promptPolicy.ts`、`data/presets.json`，这些属于 A-20。

**已知阻断问题**：

- `/comfy/prompt` 接受浏览器提交的完整工作流图。
- token 持有者可访问 `/history`、`/queue`、`/interrupt` 和 `/view`。
- 原始 `/prompt` 没有应用级参数 schema、模型白名单、尺寸限制和 pending 上限。
- `/view` 依赖 ComfyUI 自身路径检查，没有应用级 job/file 所有权。
- 上游错误不符合统一错误信封。
- 当前真实 Anima E2E 依赖本机 GPU，不是确定性 CI 测试。

**目标 API**：

```text
POST   /api/anima/jobs
GET    /api/anima/jobs/:id
DELETE /api/anima/jobs/:id
GET    /api/anima/jobs/:id/result
GET    /api/anima/status
```

浏览器只允许提交：

```text
prompt
negative
modelId
loraId
loraStrength
width
height
steps
cfg
seed
character
```

**安全要求**：

1. 服务端持有固定工作流模板，浏览器不能传 `class_type` 或节点图。
2. 模型、LoRA 和角色组合必须来自服务端兼容表。
3. 未知 key、非数字、NaN、越界、未知 id 全部 400。
4. 限制 JSON body、尺寸、steps、CFG、batch、并发和 pending 数量。
5. 只允许取消调用者自己的应用 job；禁止根 queue/history/interrupt。
6. 结果只通过应用 job id 获取，服务端校验 type=output、真实路径 containment 和任务归属。
7. 最佳方案是把结果转存至应用 runtime media，再返回应用媒体 URL。
8. 不再暴露原始 `/comfy/prompt`、根 `/history`、根 `/queue`、根 `/interrupt` 和任意 `/view`。
9. 所有 JSON 失败使用 `{ ok:false, error, ... }`。

**验收命令**：

```powershell
npm run test:security
node scripts/tests/test-gateway-contract.js
node scripts/tests/test-anima-routes.js
npm run typecheck:app
npm run build
```

确定性浏览器测试必须使用真实 AI-CG-Studio 网关和假 ComfyUI：

```powershell
npx playwright test tests/e2e/flows.spec.ts --project=flows --workers=1 --grep "Anima|Comfy"
```

必须覆盖：

- 无 token 的远程请求 401。
- 任意工作流图拒绝。
- 未知节点、未知模型和未知 LoRA 拒绝。
- 过大 body 413。
- 绝对路径、编码穿越、`..`、input/temp、annotation、hash 和 junction/symlink 路径拒绝。
- 未知 API 返回 JSON 404，不返回 SPA HTML。
- transient 轮询失败不重复提交任务。
- cancel 只影响指定应用 job。
- 结果 MIME 必须为图片。

**预估工作量**：3 至 5 天。

**停止条件**：原始 `/comfy/prompt` 仍可被浏览器访问时，不得宣布完成。

### L-20：Native 渲染缓存与长稳

**执行者**：C。

**涉及文件**：

- `desktop-tauri/native-live2d/src/renderer.rs`
- 必要时 `desktop-tauri/native-live2d/src/model.rs`
- 新增独立性能/soak 测试脚本
- 只追加 `docs/live2d-native-runtime.md` 的性能结果

**不要修改**：`live2d_overlay.rs`、`useLive2D.ts`、`nativeBackend.ts`，这些属于 L-10。

**已知问题**：

- 目标帧率默认 165。
- 每帧创建 uniform buffer 和 bind group。
- 每个 mask channel 每帧创建 texture 和 bind group。
- 每个 drawable 每帧创建 texture bind group、vertex buffer 和 index buffer。
- 当前 selftest 只有数秒，无法证明长时间 GPU/Working Set 稳定。

**目标**：

1. 模型加载时缓存 index buffer、texture bind group、mask 资源和 uniform buffer。
2. 可复用 vertex buffer，动态顶点只做必要更新。
3. 每帧不创建静态 GPU 资源。
4. 保持当前渲染结果、mask、blend、透明度和 165fps 决策不变。
5. 建立 release 版 10 至 30 分钟 soak。

**验收标准**：

```powershell
cargo build --release --manifest-path desktop-tauri/src-tauri/Cargo.toml
npm run test:live2d-native:release
```

新增 soak 必须记录：

- p50/p95 frame time。
- Rust 进程 Working Set。
- GPU dedicated/shared memory。
- frame count。
- 宁宁切夏目、夏目切宁宁后的资源回收。
- 隐藏状态下帧数是否停止，由 L-10 最终联调确认。

通过标准：连续 30 分钟没有单调增长趋势、OOM、device lost 或明显卡顿；角色切换后内存回落至稳定区间。

**预估工作量**：2 至 4 天。

## 7. 批次 2

### D-10：真实桌面发布验收

**执行者**：A，必须等待 L-10、L-20 和 B-00 完成。

**涉及文件**：

- 新增桌面自动化和诊断脚本
- 可新增测试专用只读诊断命令
- `tests/e2e/` 中独立桌面 Native 测试
- 安装包验收记录
- 不主动重构业务源码；发现问题退回 L-10/L-20 所有者

**目标**：验证安装包中的真实 Companion 页面、WebView2、IPC、overlay、TTS 和资源路径，而不是单独调用 Rust 命令。

**自动化矩阵**：

| 场景 | 验收 |
|---|---|
| 冷启动 | Companion 一次加载成功，backend=native |
| 角色 | 宁宁、夏目加载和切换 |
| overlay | DOM 舞台矩形与 HWND 矩形误差不超过 2px |
| move/resize | 窗口移动、缩放后 200ms 内重新对齐 |
| hide/show | 隐藏后 overlay 不可见且停止出帧，恢复后重新对齐 |
| click | Face/Head/Body/Skirt 等命中并启动动作 |
| motion | 不固定 index 0，多次点击可覆盖多个作者变体 |
| emotion | 无配音和有配音两条通道都可变化并复位 neutral |
| mouth | 宁宁和夏目真实 TTS 都有口型，停止播放后归零 |
| power | 30/60/165 目标帧率按契约切换 |
| resources | 安装目录下 `gateway/assets/live2d/<character>` 可加载 |
| soak | 30 分钟无持续内存增长 |

**DPI 与屏幕矩阵**：

- 100%、125%、150%。
- 单屏。
- 双屏同 DPI。
- 双屏混合 DPI。
- 窗口跨屏、移到副屏、热插拔后回屏内。

**真实 TTS**：

- 宁宁至少一条日语 neutral/happy。
- 夏目至少一条日语 neutral/happy。
- 自动记录音频 RMS/peak、前端 mouth level、Rust mouth state 和两张嘴部快照。
- 夏目必须证明 `ParamMouthForm3` 实际向负方向变化。

**验收命令**：

```powershell
npm run package:tauri
npm run test:desktop:native
npm run test:live2d-native:release
```

安装包需完成安装、首次运行、隐藏启动、正常启动、网关 sidecar、模型加载、退出和卸载测试。

**预估工作量**：2 至 3 天。

**发布结论**：D-10 全部通过前，Electron 不得退役。

### A-20：Anima Prompt 与角色契约

**执行者**：B，必须等待 A-10 完成。

**涉及文件**：

- `data/presets.json`
- `src/utils/promptPolicy.ts`
- `src/composables/usePromptAssembly.ts`
- `src/views/PromptBuilderView.vue`
- `src/stores/promptBuilderStore.ts`
- Prompt、历史和引擎相关测试

**不要修改**：A-10 已建立的服务端安全 API，除非发现契约阻断并先报告。

**已知问题**：

- Anima 当前按 SD checkpoint 选择 WAI profile。
- Prompt 被统一转换成下划线格式。
- Comfy 工作流已经加载 v19 LoRA，Prompt 中仍包含 v18 `<lora:...>` 文本。
- 夏目和双人模式会强制加载宁宁 v19。
- 尺寸下拉只修改 width，height 没同步。
- 历史仍记录 SD checkpoint、v18 LoRA 和 SD 参数。
- `aics_draw_engine` 未登记。
- 用户填写的 `pb.story` 没有进入最终 Prompt。

**目标**：

1. profile 解析升级为“引擎 + 模型”双维度。
2. 增加 Anima Base 和 Anima Aesthetic 独立 profile。
3. Anima Prompt 中剥离全部 A1111 `<lora:...>` 语法。
4. rating、安全标签、正负前缀、空格/下划线和权重策略由 Anima profile 决定。
5. 只有宁宁 v19 已审核时，夏目和 triad 明确禁用 Anima或引导回 SD。
6. 尺寸改为真实 `{ width, height }`。
7. 历史记录增加 engine、profile、实际 model、LoRA、strength、CFG、steps、sampler、width、height。
8. 保存结果前检查 HTTP 状态和图片 MIME。
9. 明确故事输入的产品语义：推荐让场景模式把故事转换为可审计 Prompt；若不实现，必须修改 UI 文案，不能继续暗示故事会直接控制画面。
10. `aics_draw_engine` 的最终登记由 R-10 完成，本任务不得创建第二套存储方案。

**验收命令**：

```powershell
npm run typecheck:app
npm run build
npm run test:prompt-policy
npm run test:prompt-builder
```

必须新增断言：

- Anima Base/Aesthetic 正负 Prompt 与各自 profile 一致。
- Anima Prompt 不含 `<lora:`。
- 夏目和 triad 不会提交宁宁 LoRA job。
- 1024x1024 和 1216x832 的真实请求尺寸正确。
- 历史保存真实 engine/model/LoRA/尺寸。
- SD 现有 WAI v17 行为零回归。
- 用户故事对最终 Prompt 的影响有明确、可测试契约。

**预估工作量**：2 至 4 天。

### Q-10：质量门禁分层

**执行者**：C，必须等待 B-00 释放 `package.json`。

**涉及文件**：

- `package.json`
- `.github/workflows/quality.yml`
- `.github/workflows/nightly-e2e.yml`
- 可新增 Windows Native workflow
- repo hygiene 测试
- `tsconfig.runtime.json`
- services 生成物一致性测试

**目标结构**：

```text
npm run check
npm run test:unit
npm run test:contract
npm run validate          = check + unit + contract
npm run validate:desktop  = Windows 壳测试
npm run test:live         = 真实 TTS/Comfy/Native 汇总入口
```

**要求**：

1. 默认 validate 在 Ubuntu、无 GPU、无 Cubism SDK、无 ComfyUI 环境稳定运行。
2. repo hygiene 在最前面执行，快速拦截 BOM、非法控制字符、尾随空白和换行漂移。
3. 纯函数/状态机测试可并行；端口、HTTP、进程测试受控串行。
4. 真实 Anima GPU E2E 改为显式 live 命令，不进入默认 `test:e2e:all`。
5. Native selftest 在 Windows 发布门禁运行，不进入默认 validate。
6. `services/*.ts` 是唯一源码。CI 必须发现漏提交 `.js/.d.ts`。
7. 若无 `.d.ts` 消费者，评估停止生成声明；不要未经确认直接删除。
8. staging 只复制运行时需要的 `.js`，不把 TS 源码和无用声明带入安装包。

**验收标准**：

```powershell
npm run validate
npm run build
```

Ubuntu CI 必须通过确定性链路。Windows Native 环境必须通过：

```powershell
npm run validate:desktop
npm run test:live2d-native:release
```

人为制造以下错误时门禁必须失败：

- `package.json` 加 BOM。
- Markdown 加非法控制字符。
- 修改 `services/*.ts` 但不更新运行时产物。
- 把真实 GPU Anima spec 加入默认 critical E2E。

**预估工作量**：1 至 2 天。

## 8. 批次 3

### V-10：v19 视觉审核矩阵

**执行者**：A，必须等待 A-20 和 A-10 完成。

**范围**：宁宁 v19 Anima，不审核夏目，不启动 Krea 2。

**矩阵**：

- 6 个代表场景。
- 每场景 3 个固定 seed。
- 每个 seed 同时生成 SD v18 基线和 Anima v19 候选。
- 至少覆盖特写、半身、全身、复杂服装、复杂背景、强光照或夜景。
- R18 默认开启约束不变，审核产物不得擅自移除成熟内容。

**逐张审核项**：

- 宁宁身份和官方特征。
- 白发、低双马尾、紫瞳、呆毛、发饰。
- 服装颜色、剪裁和控制词还原。
- 脸、手、腿和肢体结构。
- 构图、光照和场景叙事。
- LoRA 过拟合、脸部僵硬、背景污染和身份漂移。
- Prompt 是否确实表现用户故事/场景。

**产物**：

- 独立审核目录。
- 固定参数 manifest。
- `manual-review.json`。
- 对每张图给出 pass/fail 和具体理由。
- 汇总 v19 相对 v18 的胜率和失败类型。

**通过门槛**：

- 身份特征通过率不低于 v18。
- 服装还原和场景表达至少一项稳定优于 v18。
- 不出现系统性肢体、脸部或双人串位问题。
- 未达到门槛时，Anima 保持 experimental，不继续队列、Krea 和跨页接入。

**预估工作量**：1 至 2 天 GPU 和人工审核时间。

### R-10：Storage Repository 第一阶段

**执行者**：B，必须等待 A-20 完成。

**涉及文件**：

- 新增 `src/storage/settingsRepository.ts`
- 新增 `src/storage/artworkRepository.ts`
- `src/utils/storageKeys.ts`
- `src/composables/useBackup.ts`
- `src/views/GalleryView.vue`
- 必要的 Prompt Builder 设置接线
- 存储与备份测试

**目标**：

1. 登记 `aics_draw_engine`，并使用版本化常量，不再散落字符串。
2. 所有新 localStorage 写入必须经过登记或 Repository。
3. 增加检查器，发现未登记的 `aics_*` 字面量写入时失败。
4. 作品删除由单一事务入口处理历史、原图、缩略图和孤儿记录。
5. 删除失败保持界面和持久化一致，可回滚。

**验收命令**：

```powershell
npm run typecheck:app
npm run build
npm run test:backup
npm run test:gallery
```

必须覆盖：

- `aics_draw_engine` 导出、覆盖清理、恢复 round-trip。
- 未登记 localStorage key 门禁。
- 作品删除同时清理 KV、原图、缩略图。
- 任一步失败时不会留下半删除记录。

**预估工作量**：2 至 3 天。

### R-20：API Client 第一阶段

**执行者**：C，建议等待 Q-10 完成。

**涉及文件**：

- 新增 `src/api/client.ts`
- 新增 `src/api/controlApi.ts`
- 新增 `src/api/trainingApi.ts`
- 新增 `src/api/maintenanceApi.ts`
- `useControlActions.ts`
- `useControlStatus.ts`
- `trainingStore.ts`
- 对应普通 JSON API 调用方

**不迁移**：

- 流式 chat。
- SD 图片生成和进度链路。
- ASR 外部兼容端点。
- TTS 音频流。

**目标**：

1. 统一 JSON 错误信封解析。
2. 统一超时、AbortSignal 和错误类型。
3. 视图不再重复实现 `fetch -> json -> ok -> error`。
4. 维护打包模式 501、训练白名单和控制面本机安全契约。

**验收命令**：

```powershell
npm run typecheck:app
npm run build
npm run test:control-failures
npm run test:training
npm run test:maintenance
```

**预估工作量**：2 至 4 天。

## 9. 最终批次

### DOC-10：文档归一化与总验收

**执行者**：主会话或指定汇总者。

**涉及文件**：

- `docs/project-handoff.md`
- `docs/tauri-desktop-migration-plan.md`
- `docs/live2d-native-runtime.md`
- `docs/visual-architecture-roadmap.md`
- `docs/companion-voice-roadmap.md`
- `docs/video-generation-roadmap.md`
- `AGENTS.md` 仅由用户或主会话按共享文件规则修改

**目标**：

1. 顶部建立唯一可更新的当前状态表。
2. 历史记录继续只追加，但过时结论明确标记 `Superseded`。
3. 每个完成项附 commit、测试命令、结果和未验证项。
4. 修正“P6/P7 已完成”和源码中 O4/O5、tauri-driver 缺失之间的矛盾。
5. 清理 BOM、控制字符、尾随空格和乱码注释。
6. 明确 Electron 的退役条件和当前结论。

**最终总验收**：

```powershell
npm run validate
npm run build
npx playwright test tests/e2e/studio.spec.ts tests/e2e/flows.spec.ts --workers=3
npm run validate:desktop
npm run test:live2d-native:release
npm run test:desktop:native
npm run package:tauri
```

跨页大改最终需要时再运行全量 Playwright，使用 `--workers=3`，不要使用默认 worker 数无脑全跑。

## 10. 每位执行者的回报模板

每个任务完成后，在 `docs/project-handoff.md` 文末追加：

```markdown
## YYYY-MM-DD · <任务 ID> <标题>

### 完成内容
- ...

### 修改文件
- `path/to/file`

### 验证证据
- `command` -> PASS，耗时/用例数/关键输出

### 真机证据
- 环境、DPI、GPU、安装包版本、截图或日志路径

### 仍未完成
- 无 / 具体阻断

### 踩坑与参考
- 问题、根因、验证过的来源 URL

### 下一位接入点
- 公开 API、数据格式、不得修改的边界
```

## 11. 发布门槛

必须同时满足以下条件，才允许把 Tauri + Native + Anima 称为正式版本：

1. 干净 clone 可构建和打包。
2. 默认 validate 在无 GPU Linux CI 全绿。
3. ComfyUI 原始工作流接口不再暴露给浏览器。
4. Native Companion 真实链路通过 DPI、移动、隐藏、点击、双角色和 TTS。
5. 30 分钟 Native soak 无持续资源增长。
6. v19 审核矩阵达到门槛。
7. 安装包资源路径、sidecar、模型和维护 501 契约通过。
8. Electron 版数据可迁移，且保留可回滚能力。

任一门槛未通过时：主网站和 Electron 继续作为稳定路径，Tauri/Native/Anima 保持实验状态。

## 12. 2026-08-09 并行续作安排

L-20 与 Q-10 由执行者 C 按 `docs/project-handoff.md` 的 SOL 复审清单返工期间，另外两位不得等待：

- 执行者 A 立即启动 V-10。
- 执行者 B 立即启动 R-10。
- 执行者 C 继续独占 L-20/Q-10 文件，不得提前启动 R-20。
- GPU 是互斥资源：V-10 的 ComfyUI/SD 出图不得与 L-20 soak、Native release selftest 同时运行。A 可先完成脚本、manifest 和审核表准备，再与 C 约定独占 GPU 时间窗。

### 执行者 A：V-10 立即开工方案

**目标**：只做宁宁 v19 的真实生产链路视觉审核，不修改 Native、Repository、Q-10 或 Krea 2。

**实施顺序**：

1. 在生成前固定 6 个场景 ID 和 3 个 seed，写入 manifest；场景必须分别代表特写、半身、全身、复杂服装、复杂背景、强光照或夜景，不得看完结果后替换难例。
2. 新增独立维护脚本，例如 `scripts/tests/generate-v19-visual-matrix.js`。Anima 必须经本地网关的生产 `/api/anima/*` 路由提交，不得从脚本复制另一份 workflow 或让浏览器直连 ComfyUI；SD 基线继续走现有网关 SD 契约。
3. 每个场景和 seed 生成一张 SD v18 基线与一张生产默认 Anima v19 候选，共 36 张；两侧除引擎/profile 固有差异外保持故事、构图意图、尺寸和 seed 可审计。
4. 生成独立审核目录、参数 manifest、联系表和 `manual-review.json`。图片放 AI 工作区审核目录，不提交仓库；仓库只提交脚本、manifest 模板和审核结论文档。
5. 必须逐张看图，不按文件名、CLIP 分数或自动标签代替人工审核。逐图记录身份、脸、发型/发饰、服装、手腿结构、构图、光照、背景叙事、LoRA 过拟合和 Prompt 表达。
6. 若发现系统性失败，先用固定 seed 做单变量 A/B 并记录证据；不得直接反复改生产 profile 猜参数。涉及 `data/presets.json` 或 Prompt policy 的调整先报告 SOL，不与 R-10 并发修改 Prompt Builder。

**文件边界**：

- 可新增 V-10 自有生成/审核脚本和 `docs/anima-v19-visual-audit-2026-08-09.md`。
- 只读使用 `routes/anima.js`、`data/presets.json`、Prompt 组装代码。
- 不修改 `desktop-tauri/**`、`src/storage/**`、`src/utils/storageKeys.ts`、`package.json`、质量门禁文件。

**验收**：

- 36 张图全部有人工 pass/fail 与具体理由，不能有 `pending`。
- 身份通过率不得低于对应 v18；服装还原或场景表达至少一项稳定优于 v18。
- 汇总胜率、失败类型、按场景/seed 的差异和是否允许 Anima 继续保持 experimental。
- 运行相关生成脚本 dry-run/manifest 校验、`npm run test:prompt-policy`、`npm run test:prompt-builder`；若修改 `src/`，追加 `npm run typecheck:app` 与 `npm run build`。

**停止条件**：生产路由不能稳定生成、身份出现系统性漂移、或需要修改 A-10 安全边界时立即停止并报告，不绕过应用 API 继续出图。

### 执行者 B：R-10 立即开工方案

**目标**：完成最小 Storage Repository 第一阶段，只收口绘图引擎设置与作品删除生命周期，不借机迁移聊天、训练或所有历史 localStorage 调用。

**实施顺序**：

1. 在 `storageKeys.ts` 登记版本化 draw engine key，并让备份白名单、死键清理和恢复路径自动覆盖它。
2. 新增 `settingsRepository.ts`，提供可注入 Storage 的 typed `get/set/remove`；先接管 `aics_draw_engine`，替换 `PromptBuilderView.vue` 中的裸字符串读写，不建立第二份状态。
3. 新增 `artworkRepository.ts`，把作品记录、原图、缩略图和相关孤儿引用的删除集中到一个公开入口。底层 KV 与 image store 不能原子跨库时，必须使用快照和补偿回滚，不得宣称不存在的数据库原子事务。
4. `GalleryView.vue` 只在 Repository 成功后更新界面；失败时保持或恢复原记录，并显示现有错误反馈。其他页面继续使用现有读取接口，不做大范围迁移。
5. 增加未登记 `aics_*` localStorage 写入检查，但不得修改 Q-10 独占的 `package.json`、`run-quality-suite.js` 或 workflow。优先扩展现有 backup/storage 测试；若新增独立测试，在交接中把接线请求留给 Q-10。
6. Repository 接受 KV/image/storage adapter 或等价依赖注入，测试必须能分别注入记录写入失败、原图删除失败、缩略图删除失败，并证明补偿后无半删除状态。

**文件边界**：

- 独占 `src/storage/settingsRepository.ts`、`src/storage/artworkRepository.ts`、`src/utils/storageKeys.ts`、`src/composables/useBackup.ts`。
- 可最小修改 `PromptBuilderView.vue` 的 draw engine 存取与 `GalleryView.vue` 的删除入口。
- 不修改 `package.json`、`.github/workflows/**`、Q-10 测试分层文件、Native renderer、Anima 服务端路由或 Prompt profile。
- 不迁移聊天、训练、Companion、主题和场景偏好；发现未登记旧键只列清单，不扩大本轮范围。

**验收**：

- `aics_draw_engine` 可备份、清理、恢复 round-trip，旧用户当前值不丢失。
- 未登记的新 `aics_*` 字面量写入测试会失败，训练动态前缀等现有合法例外仍通过。
- 删除作品同时清理记录、原图、缩略图和明确登记的孤儿引用。
- 任一步失败时记录与媒体恢复一致，重复删除幂等。
- 运行 `npm run typecheck:app`、`npm run build`、`npm run test:backup`、`npm run test:gallery`，以及新增的 Repository 定向测试。

**停止条件**：若必须重写 `useKVStore/useImageStore` 数据库结构、改变备份格式版本或修改 Q-10 文件才能继续，先停止并向 SOL 报告，不自行扩大迁移。

## 13. 第一轮交付与 SOL 接管规则

后续任务默认只给执行者一次完整实现机会。SOL 在派发前必须把方案写到可直接执行的粒度，不能只给目标或方向。

每份第一轮方案必须明确：

1. 前置依赖、允许开始的证据和禁止并行的资源。
2. 独占文件、只读文件、禁止触碰文件及与其他执行者的冲突边界。
3. 真实数据源、生产调用链、固定输入、输出目录和不可使用的替代路径。
4. 按顺序列出的实现步骤；每一步说明预期状态和失败时停止条件。
5. 正常路径、边界条件、并发、失败注入、资源释放和回滚测试。
6. 精确验收命令、人工检查项、通过阈值及必须保留的证据。
7. `docs/project-handoff.md` 需要追加的修改、命令、结果、踩坑和下一位接入点。

执行规则：

- 执行者第一轮未达到功能、数据一致性、安全、性能或测试门槛时，不再安排其继续猜测式返工；SOL 立即接管相关文件，直接修复并重新验证。
- 外部服务离线、硬件不可用或缺少上游资产等可验证的环境阻断不视为能力失败，但执行者必须停在停止条件，不得绕过生产契约交付假结果。
- SOL 接管后保留执行者原有正确部分，只做最小正确修改，不撤销其他并行工作。
- 未经 SOL 签收，任何任务不得标记完成，也不得解除文件独占或启动其下游任务。

## 14. V-10 第一轮接管结果

- 第一轮逐图审核漏掉了 epoch 45 的跨 seed 构图收敛，SOL 已按 §13 接管，不再安排原执行者继续返工。

## 15. L-20 / Q-10 接管结果

- C 的返工仍遗留 Native FFI/lifecycle/prewarm/Surface/soak 与 Q-10 runner/runtime/npm/baseline 安全问题，SOL 已按 §13 直接接管并完成修复。
- `L-20` 已通过 release selftest、三张 Native snapshot 人工审核、120 秒三次切换 soak，并有 300 秒稳定内存数据；用户要求不继续等待 30 分钟，本地长跑降为发布前可选强化项，Windows Native gate 固定跑 300 秒。
- `Q-10` 的 check/unit/contract/desktop 分层、Git base hygiene、Windows desktop/native workflow、runtime generated、staging lock/rollback 和测试清单完整性已签收。
- 解锁：`R-20` 可开始；`D-10` 可进入真实安装包验收，但必须补实际 self-hosted runner 与 125% DPI 证据。
- SOL 完成 epoch 10 / 20 / 45 checkpoint sweep，并选择 epoch 20 / step 1100 替代原最终轮次。
- 新的生产路由矩阵位于 `AI/Reviews/AnimaV19VisualMatrix/2026-08-09_6x3_e20/`，36 张文件和 manifest 哈希验证通过；Anima 18/18 通过，对 SD v18 为 16 胜 / 2 平 / 0 负。
- 不启动从零重训；若后续扩大场景后触发身份、隔离或构图硬门槛，再按 `docs/anima-v19-checkpoint-audit-2026-08-09.md` 的 train/validation split 与 checkpoint gate 重训。
- V-10 的模型选择已完成，但 Anima 仍为 experimental，不解除正式版本总门槛。

## 16. 2026-08-09 第二批第一轮并行方案

本轮继续执行 §13 的规则：执行者只有一次完整实现机会。第一轮结束后不安排原执行者继续猜测式返工，所有复审、补洞和最终签收由 SOL 直接完成。

### 16.1 当前基线与并行顺序

- 已满足依赖：`B-00`、`L-10`、`L-20`、`A-10`、`A-20`、`Q-10`、`V-10`、`R-10` 已签收。
- 执行者 A 负责 `D-10`，执行者 B 负责新增 `Q-20`，执行者 C 负责 `R-20`。
- B、C 可立即实现。A 可立即编写验收工具和只读诊断，但不得在 B、C 仍修改 `src/` 时构建最终验收安装包。
- 最终安装包存在单一冻结点：B、C 第一轮停止写入并报告后，A 才运行一次 `npm run package:tauri`，该安装包的 SHA-256 是本轮所有桌面证据的唯一版本标识。
- D-10 的 Native/TTS 真机阶段独占 GPU。不得同时运行 ComfyUI、SD 出图、Native release selftest、renderer soak 或其他 GPT-SoVITS 回归。
- 三位执行者不得提交、推送、调整 Git 配置、改写其他人的 staged 状态或格式化全仓。发现工作树已有修改时，保留现状并只修改分配给自己的文件与行。
- 并行期间不得同时追加 `docs/project-handoff.md`。各自写独立报告，SOL 第二轮复审后统一归档：
  - A：`docs/round1-d10-desktop-acceptance.md`
  - B：`docs/round1-q20-style-gate.md`
  - C：`docs/round1-r20-api-client.md`
- 第一轮报告必须列出实际修改文件、完整命令和退出码、失败注入、未验证项、证据路径及下一位接入点。禁止用“应该可用”“理论通过”代替证据。

### 16.2 执行者 A：D-10 真实桌面发布验收

**任务性质**：验收优先，不做桌面架构重构。目标是验证安装后的真实 Tauri Companion、WebView2、网关 sidecar、Native overlay、真实 TTS、迁移和卸载，而不是再次单独证明 Rust renderer 能运行。

**前置证据**：

- §15 已明确 `D-10` 解锁。
- 本地 `npm run test:live2d-native:release` 已有 3/3 snapshot 基线，120 秒 soak 已通过，并有 300 秒稳定数据。
- 本轮必须重新验证安装包产品链；不得把上述 renderer-only 结果复制成 D-10 结果。

**独占文件**：

- 新增 `scripts/tests/run-desktop-native-acceptance.js`。
- 可新增 `scripts/tests/desktop-native/**` 下的 Windows/WebDriver/报告辅助模块。
- 新增 `docs/round1-d10-desktop-acceptance.md`。
- `package.json` 仅允许新增 `test:desktop:native` 命令，不调整其他脚本或依赖版本。
- 若现有状态无法观测验收指标，可对 `desktop-tauri/src-tauri/src/live2d_overlay.rs` 做最小、只读、向后兼容的诊断补充；修改前必须保留当前未暂存实现，不得覆盖 SOL 已完成的 renderer/lifecycle 修复。

**只读文件**：

- `desktop-tauri/src-tauri/src/main.rs`
- `desktop-tauri/src-tauri/src/main_shared.rs`
- `desktop-tauri/src-tauri/src/bridge.rs`
- `desktop-tauri/src-tauri/src/shim.rs`
- `desktop-tauri/src-tauri/src/paths.rs`
- `src/views/CompanionView.vue`
- `src/components/ChatCharacterStage.vue`
- `src/composables/useLive2D.ts`
- `src/live2d/**`
- `src/utils/live2dOverlayLayout.ts`

**禁止触碰**：

- `desktop-tauri/native-live2d/src/model.rs`
- `desktop-tauri/native-live2d/src/renderer.rs`
- `desktop-tauri/native-live2d/src/shader.wgsl`
- `desktop-tauri/native-live2d/src/ffi.rs`
- `src/api/**`
- B 的三个样式文件
- Electron 生产文件

若真实链路暴露这些文件中的功能缺陷，只记录最小复现、日志、截图和预期/实际结果，第一轮不越界修复。

**诊断契约**：

现有 `aics_live2d_get_state` 只返回 ready/character，且查询会调用 `ensure_overlay`。若为验收补充诊断，必须满足：

1. 查询本身不得创建 overlay、加载模型或启动渲染线程；未初始化时返回 `active:false` 的只读状态。
2. 已初始化时至少返回 `rect`、`visible`、`frameCount`、`targetFps`、`character`、`ready`、`windowReady`、`rendererAttached`、`modelBounds` 和 passthrough 数量。
3. 为口型验收可记录最近一次规范化 mouth level 及角色映射后的值；记录字段必须在 destroy/切角后归零，不得反向驱动 renderer。
4. 不返回任意文件读取能力、环境变量、token 或可执行命令。
5. 诊断只观察现有原子状态，不能改变 FPS、窗口位置、动作选择或资源生命周期。

**证据目录**：

- 仓库外使用 `<AI_WORKSPACE>/Reviews/DesktopAcceptance/2026-08-09_d10_round1/`。
- 必须生成 `report.json`、`environment.json`、`installer.sha256`、`commands.log`、`desktop.log` 副本、每个 DPI 的截图目录和失败清单。
- 不把安装包、EdgeDriver、WAV、Live2D 资产或截图提交仓库；仓库报告只引用路径和 SHA-256。

**实施顺序**：

1. **环境预检**
   - 记录 Windows build、GPU/驱动、WebView2、Edge、Node、npm、rustc、cargo、显示器数量、每屏物理矩形和 DPI。
   - 检查管理员权限，因为当前 NSIS 配置为 `perMachine`。无提权能力时立即停在安装步骤，不改成便携版冒充安装验收。
   - 按 Tauri 官方 WebDriver 文档安装/定位 `tauri-driver` 和与当前 Edge 匹配的 `msedgedriver`。二者版本不匹配时停止，不反复盲试。
   - 官方依据：`https://v2.tauri.app/develop/tests/webdriver/manual-setup/`；NSIS 静默参数依据：`https://v2.tauri.app/distribute/microsoft-store/#silent-install`，仅使用大写 `/S`。

2. **保护真实用户数据**
   - 为被测进程创建独立临时 `APPDATA`、`LOCALAPPDATA` 和 AI workspace。
   - 在临时 Electron 候选目录写入四个 JSON fixture 和固定 `gateway_token`；源目录必须在整个测试中保持只读、字节不变。
   - 脚本启动前断言这些路径均位于本轮临时根。任一路径解析到真实用户目录时立即退出，禁止继续。

3. **编写真实 WebDriver 驱动**
   - 通过 `tauri-driver` 启动安装后的 exe，不使用浏览器版 Vite 页面代替。
   - 驱动必须支持执行 DOM 脚本、点击角色/舞台/窗口按钮、订阅 Tauri 事件、调用只读 state、截取 WebView 与桌面区域、读取进程和窗口信息。
   - 每次会话使用唯一 WebView2 user-data-dir；退出后清理 driver 和 Edge 子进程，避免已知的锁目录污染下一轮。

4. **等待代码冻结并构建唯一安装包**
   - B、C 报告停止写入后，记录 `git diff --name-only` 和当前 HEAD。
   - 运行 `npm run package:tauri`，定位 `desktop-tauri/src-tauri/target/release/bundle/nsis/*-setup.exe`，记录 SHA-256、文件大小和版本。
   - 之后不得在同一轮修改任何打包输入后继续沿用旧安装包证据；有修改就必须生成新 SHA 并作废旧报告。

5. **安装、迁移与冷启动**
   - 用 `/S` 安装，记录退出码、安装目录和资源 manifest。
   - 验证安装目录存在 `gateway/server.js`、sidecar node、`gateway/dist`、`gateway/assets/live2d/nene`、`gateway/assets/live2d/natsume`。
   - 首次启动验证临时 Electron JSON 与 token 被逐字节迁移、源文件未改、`.tauri-migrated` 生成；修改源 fixture 后二次启动不得覆盖目标，证明幂等。
   - Companion 必须一次冷启动进入 `/companion`，`.live2d-host[data-backend="native"]` 出现且角色 ready；不允许刷新或二次点击后才成功。

6. **隐藏启动与生命周期**
   - 使用已安装 exe 的 `--hidden` 启动，网关 sidecar 必须健康，但 Companion 和 `aics-live2d-overlay` HWND 均不可见。
   - 隐藏启动时不得加载角色；诊断查询不得因为“检查状态”而创建 overlay。
   - 正常启动后记录 frameCount，点击隐藏，500ms 后 `visible=false`；连续 2 秒两次采样 frameCount 不增加。恢复后 200ms 内重新显示并对齐。
   - 通过 Companion 的退出命令退出，10 秒内主进程、sidecar 和 owned gateway 端口全部结束；不得依赖强杀作为通过条件。

7. **角色、点击、动作、情绪和功耗**
   - 宁宁、夏目各至少完成一次切入、ready 和切回；state.character 与 DOM `data-character` 一致。
   - 订阅 `aics:live2d:motion-started`、`motion-failed`、`hit-test`。在可见舞台 Face/Head/Body/Skirt 对应区域点击，必须有命中或稳定 DOM 分区动作反馈。
   - 对至少一个有多作者变体的动作组执行不少于 8 次、每次等待上一动作结束；观察到至少 2 个 index。若组内实际只有一个变体，报告模型 manifest 证据，不伪造门槛。
   - 无配音通道使用本地确定性 mock OpenAI-compatible 流返回情绪标签，必须从真实聊天 UI 送入并复位 neutral；不得直接调用 Rust 命令冒充前端链路。
   - 通过前端桌面功耗事件或现有公开桥切换 efficiency/quality，state.targetFps 分别达到 30 与 165；browser 页面仍维持既有 60 上限，不在本任务修改。

8. **DPI、移动和多屏**
   - 必测 100%、125%、150% 三个真实 Windows 缩放档。脚本以 `--dpi-label` 接收人工当前档位，并同时读取 `devicePixelRatio`、窗口 DPI 和屏幕物理矩形，标签与实测不一致即失败。
   - 每个档位比较 `.live2d-host` 的 CSS rect 经 DPR/窗口原点换算后的物理 rect、诊断 state.rect 和 `GetWindowRect(aics-live2d-overlay)`；四边最大误差不超过 2px。
   - 使用 Win32 `SetWindowPos` 移动/缩放 Companion，不靠修改 DOM 假造窗口变化；每次操作后 200ms 内恢复到上述误差门槛。
   - 若有双屏，执行同 DPI、混合 DPI、跨屏和副屏测试；没有真实第二屏时明确标为环境未覆盖，不使用虚拟 CSS viewport 冒充。
   - 任何档位或跨屏出现两次相同错位后立即停止，根据最高优先级规则查官方 Win32/Tauri/wgpu 资料，不继续盲改。

9. **真实 TTS 与口型**
   - 预检本机 GPT-SoVITS；离线时报告环境阻断，不用合成假 WAV 替代。
   - 宁宁、夏目各通过真实聊天配音链路播放 neutral/happy 至少一条日语，共 4 条。
   - 保存 WAV 并记录 RMS/peak；播放期间采样 DOM `data-mouth-level`、诊断 mouth level 和截图，停止后 500ms 内全部归零。
   - 夏目诊断映射值在开口时必须小于 0，满强度接近 `-0.5`；同时保留张嘴和闭嘴两张桌面截图供 SOL 人工看图。
   - 已开播后断流不得整句重试，旧 Audio 元素不得后台继续；若发现重播，只记录并停止，不修改 `useVoice.ts`。

10. **安装产品 300 秒稳定性与卸载**
    - 依据用户在 §15 的决定，本轮强制 300 秒安装产品 soak，30 分钟仅作为发布前可选强化项，不再阻塞第一轮回报。
    - 300 秒内每 60 秒切角色，每 30 秒执行一次 hide/show 或 move/resize；120 秒预热后采样 Working Set、private bytes、GPU dedicated/shared、frameCount 和 targetFps。
    - 不得出现 OOM、device lost、overlay 残留或持续单调增长；趋势判断沿用 L-20 的“净增长且回归斜率同时超阈值”规则，不能只因角色资源锯齿误报。
    - 退出后用卸载器 `/S` 卸载，安装目录和注册卸载项必须消失；临时用户数据可保留到报告复制完成后再由脚本删除。不得删除真实用户数据。

**自动验收命令**：

```powershell
npm run typecheck:app
npm run build
cargo test --locked --manifest-path desktop-tauri/src-tauri/Cargo.toml
npm run test:live2d-native:release
npm run package:tauri
npm run test:desktop:native
```

**通过阈值**：

- 安装、迁移、首次启动、隐藏启动、正常退出和卸载全部有退出码与日志。
- 100%、125%、150% 均有实测数据和截图；最大 rect 误差 `<=2px`。
- hide 后 frameCount 停止；恢复及 move/resize 后 `<=200ms` 对齐。
- 双角色 ready、切换、点击和动作事件通过；多变体不固定 index 0。
- 4 条真实 TTS 全部有合格 WAV 指标、口型采样和闭嘴复位证据。
- 300 秒安装产品 soak 通过。
- 实际 self-hosted `windows-native.yml` 只有在有 workflow URL、run id、commit SHA 和全绿日志时才可标 PASS；本地等价命令不能替代。未经用户要求不得为触发 CI 自行 commit/push。

**停止条件**：

- 无管理员权限、无匹配 EdgeDriver、真实 DPI/第二屏不可用、TTS 离线属于环境阻断，保留已完成证据并停止，不降级成假验收。
- 若需要改 renderer、模型 FFI、前端 Live2D 生命周期或 TTS 业务代码才能继续，停止并把最小复现交给 SOL。
- 真实用户数据路径保护断言失败时立即退出，优先保证数据安全。

### 16.3 执行者 B：Q-20 样式 Token 门禁收口

**任务性质**：只消除当前阻断 `npm run validate` 的样式字面量债务，不做视觉重设计、不扩大全站 CSS 重构。

**当前基线**：

```text
TOTAL literal occurrences: 34 (budget 26)
```

**目标**：在不修改 `BUDGET=26`、不删除扫描规则、不用注释豁免的前提下，把总数降到 `<=24`，为后续改动保留至少 2 个余量，并保持计算后样式值不变。

**独占文件**：

- `src/assets/css/design-system.css`
- `src/assets/css/director.css`
- `src/assets/css/scene-card.css`
- 新增 `docs/round1-q20-style-gate.md`

**禁止触碰**：

- `scripts/maintenance/scan-style-literals.js`
- `scripts/maintenance/style-sources.js`
- `DESIGN.md`
- 所有 Vue/TypeScript 业务文件
- `src/api/**`
- `desktop-tauri/**`
- `package.json`

**精确收口范围**：

1. `design-system.css` 当前 3 处使用点：nav 品牌小字字号、品牌图形非对称圆角、主题图标字号。
2. `director.css` 当前 4 处使用点：舞台背景层 z-index、装饰汉字字号、iOS 输入框 16px、stageSweep 贝塞尔曲线。
3. `scene-card.css` 当前 3 处使用点：指尖光斑层与缩略图/骨架底层 z-index。

以上共 10 处，全部收口后总数应从 34 降至 24。Prompt Builder SFC 中现有 5 处未暂存字面量不属于 B，本轮不得修改。

**实施顺序**：

1. 先运行扫描器并把逐文件输出写入报告，确认基线仍为 34；若数字已因并行修改变化，重新计算本任务三个文件的计数，但仍不得改其他文件凑数。
2. 对已有全局语义 token 可准确表达的值直接复用，例如主题图标 `1rem` 使用现有字号阶梯。
3. 对确有独立语义且必须逐字节保留的值新增命名清晰的 custom property：品牌 caption、品牌 mark radius、导演台装饰字、iOS 控件字号、舞台底层、扫描曲线、场景媒体层和光斑层。禁止新增 `--x1`、`--magic-2px` 之类只为逃过扫描的名字。
4. z-index token 必须表达层级角色。场景卡保持媒体/骨架在 0、指尖光斑在 1、角标在 `--z-raised`；不得因复用现有全局 token 改变 stacking context。
5. 16px iOS 输入约束和 1.7rem 装饰字保持原计算值；本轮目标是语义归属，不是缩放视觉。
6. 修改后再次运行 scanner，要求总数 `<=24`。若仍大于 24，只能检查上述三个文件是否漏迁移，不得扩大到 C/A 文件。
7. 在 dark/light、1440x960 与 390x844 下检查 `/`、`/prompt-builder`、`/scene-explorer`；比较品牌标志、导演台输入框、舞台动效、R18 遮罩、场景卡光斑和缩略图层级。

**失败注入与回归点**：

- 场景卡图片加载前显示 skeleton，加载后 skeleton 不得压住图片。
- R18 卡片仍默认模糊，hover/focus 后揭示，提示层仍在缩略图之上。
- 指尖光斑不能盖住正文或点击目标。
- 390px iOS 尺寸下输入控件计算字号仍为 16px，避免自动缩放。
- `prefers-reduced-motion` 下导演台动效降级行为不变。
- light/dark 下品牌标志的四角几何与修改前一致。

**验收命令**：

```powershell
node scripts/maintenance/scan-style-literals.js
npm run test:style-debt
npm run typecheck:app
npm run build
npx playwright test tests/e2e/studio.spec.ts --grep "home renders|director separates|scene explorer" --workers=3
```

**通过阈值**：

- scanner 总数 `<=24`，且 budget 仍为 26。
- 三个文件之外没有源码修改。
- 上述命令全绿。
- 六个 viewport/theme 页面组合无横向滚动、层级错位、输入缩放或 R18 遮罩回归。

**停止条件**：

- 若必须改 scanner、抬 budget、修改 PromptBuilderView 或改变设计 token 数值才能通过，立即停止并报告。
- 若发现当前 34 来自其他执行者仍在编辑的文件，只报告新基线，不接管其文件。

### 16.4 执行者 C：R-20 API Client 第一阶段

**任务性质**：建立浏览器普通 JSON API 的单一传输层并迁移明确范围。不得借机迁移 streaming chat、SD、TTS、ASR、Anima job polling 或全部 fetch。

**前置证据**：`Q-10` 已签收，质量分层和测试 inventory 可接入新测试；`src/api/` 当前不存在，可作为本任务独占目录。

**独占文件**：

- 新增 `src/api/client.ts`
- 新增 `src/api/controlApi.ts`
- 新增 `src/api/trainingApi.ts`
- 新增 `src/api/maintenanceApi.ts`
- `src/composables/useControlActions.ts`
- `src/composables/useControlStatus.ts`
- `src/stores/trainingStore.ts`
- `src/views/SceneManagerView.vue` 中 maintenance HTTP 调用
- `src/composables/useSceneShowcaseUpload.ts` 中 maintenance HTTP 调用
- `src/views/HomeView.vue` 中 home-hero HTTP 调用
- `src/views/CompanionView.vue` 中 status/training event poll HTTP 调用
- `src/types/api.ts`，仅补本轮真实响应类型
- `scripts/tests/test-api-client.js`
- `scripts/tests/quality-test-inventory.js`，仅把新测试放入 unit 分层
- 新增 `docs/round1-r20-api-client.md`

**禁止触碰**：

- `routes/**`、`server/**`、`services/**`，本轮必须适配现有真实 HTTP 契约，不改后端迁就客户端。
- `src/composables/useChatConversation.ts`
- `src/composables/useSDGenerate.ts`
- `src/composables/useVoice.ts`
- `src/components/AnimaQuickPanel.vue`
- `src/views/PromptBuilderView.vue`
- `src/live2d/**`
- `src/storage/**`
- B 的三个 CSS 文件
- `desktop-tauri/**`
- `package.json` 和 workflow

**client.ts 必须形成的契约**：

1. 导出明确的 `ApiClientError`，至少包含 `status`、`code`、`detail`、`retryAfterSeconds` 和可判别的 `kind`：`http`、`timeout`、`aborted`、`network`、`invalid-response`。
2. HTTP 非 2xx 一律失败；若 body 是 `{ok:false,error,...}`，错误信息优先使用 `error`，再附 `detail`，并保留 code/retry 字段。
3. HTTP 2xx 但显式 `ok:false` 默认仍失败。唯一例外是 `/api/status` 的 `200 + ok:false + degraded:true`，由 `controlApi` 显式声明可接受，不能给所有调用打开通用逃生口。
4. 成功响应不强制必须含 `ok:true`，因为现有 `/api/logs` 等合法路由没有 success envelope；只拒绝显式失败。
5. 非 JSON、空 body、截断 JSON 和对象形状错误均抛 `invalid-response`，不得泄漏 `SyntaxError` 或退化为无信息文案。
6. 支持调用方 `AbortSignal` 与独立 timeout；调用方主动 abort 必须识别为 `aborted`，超时必须识别为 `timeout`。请求结束后注销 listener 和 timer，不积累资源。
7. 并发请求各自拥有 controller。中止一次 status poll 不得中止 logs 或 training 请求。
8. JSON body 统一序列化并设置 `Content-Type`，但保留调用方 headers；GET 不自动添加无意义 content type。
9. 支持注入 `fetch` 实现或等价测试入口，Node 单测不得启动浏览器才能覆盖错误语义。
10. 业务实现不得新增显式 `any`。

**API 模块边界**：

- `controlApi.ts`：status、share-link、logs、config、preference、service action、mode、start、stop、diagnostics。
- `trainingApi.ts`：overview、jobs、start、stop、config、增量 logs；保留 job id 的 `encodeURIComponent` 和现有白名单类型。
- `maintenanceApi.ts`：build-web、scenes 保存、maintenance run、showcase、home-hero get/reset/save。
- endpoint 字符串只能存在于上述 API 模块或明确排除的流式/二进制链路；迁移后的 composable/store/view 不再拼 endpoint。

**超时基线**：

- status/share/logs/training logs：10 秒以内。
- config/preference/control action/training start-stop：30 秒以内。
- showcase/home-hero 大 JSON 上传和 build-web：120 秒以内。
- maintenance run：至少 130 秒，因为服务端真实上限是 120 秒。
- 超时值必须在 API 模块按操作声明，不在各视图散落魔法数字。

**实施顺序**：

1. 先完成 `client.ts` 与纯 Node 测试，测试未覆盖前不迁移业务调用方。
2. 完成 `controlApi.ts`，迁移 `useControlStatus.ts`：
   - 保留 degraded status 的可用字段和错误 toast。
   - status/logs 分别维护 latest-request controller；新一轮可中止旧同类请求，`stopPolling()` 必须中止在途请求。
   - share-link 或 logs 的 403/421 继续安全清空/静默，不把旧 token 或旧日志留在 UI。
3. 迁移 `useControlActions.ts`：
   - 删除本地 `postControl` 和重复 `fetch -> json -> ok`。
   - config 保存失败时 `doStart()` 不得继续启动公网分享。用户直接点击保存时仍显示原有 toast。
   - preference 保存失败继续回滚 checkbox。
   - diagnostics Blob 下载和 build-web 反馈保持现有文案与生命周期。
4. 完成 `trainingApi.ts` 并迁移 `trainingStore.ts`：
   - 删除 store 内 `isRecord/apiError/request` 传输实现。
   - 保留 refreshPromise 去重、silent refresh、日志 cursor/version/reset、180000 字符上限和 actionJobId finally 清理。
   - JOB_BUSY、UNKNOWN_JOB、参数越界等 detail/code 不能被吞成通用 HTTP 错误。
5. 完成 `maintenanceApi.ts` 并迁移 SceneManager、showcase/home hero 与 Control build-web：
   - 打包桌面 501 `DESKTOP_MAINTENANCE_UNAVAILABLE` 必须保留 code/detail，UI 继续显示可理解原因。
   - scenes/showcase/home hero 的 rolledBack、dataIntegrity、recovery 字段不得在类型或错误转换中丢失。
   - HomeView 的 home-hero 是可选增强，失败继续使用 bundled fallback，不弹阻断错误。
6. 迁移 Companion event poll：
   - 使用 typed `ControlStatus` 与 `TrainingJob[]`，删除手写 Record 解析。
   - status 失败时不得用 training 单独结果生成错误服务事件；现有 `eventPolling` 防重入和 `viewAlive` 检查保持。
   - 组件卸载后在途 poll 应可中止，不更新任务栏或提醒状态。
7. 搜索本轮文件，确保不存在已迁移 endpoint 的裸 fetch；排除清单中的流式链路保持原样。
8. 把 `test-api-client.js` 加入 unit inventory，并运行 inventory 校验；不得改 package scripts。

**必须覆盖的单测**：

- 200 success，无 `ok` 字段也可返回。
- 400/409/501/504 标准错误信封映射 status/error/detail/code/retry。
- 200 `ok:false` 默认拒绝。
- 200 degraded status 仅通过 `controlApi.getStatus` 接受。
- 非 JSON、空 body、截断 JSON。
- network reject。
- timeout 与 caller abort 可区分。
- 两个并发请求中止其中一个，另一个正常完成。
- JSON headers 合并且 GET 不多写 content type。
- training JOB_BUSY 细节保留。
- maintenance 501 code 保留。
- config 保存失败后 start endpoint 不被调用。
- stopPolling/unmount 中止在途 status/logs/Companion poll。

**验收命令**：

```powershell
node --test scripts/tests/test-api-client.js
npm run test:check
npm run typecheck:app
npm run build
npm run test:control-failures
npm run test:training
npm run test:maintenance
node scripts/tests/test-gateway-contract.js
npx playwright test tests/e2e/studio.spec.ts tests/e2e/flows.spec.ts --grep "control|training|maintenance|companion" --workers=3
```

**通过阈值**：

- 新 client 单测覆盖所有上述错误与取消语义。
- 指定 composable/store/view 中本轮 endpoint 不再出现裸 fetch。
- 现有控制、训练、维护真实 HTTP 契约全绿。
- 打包模式 501、训练白名单、本机安全和 degraded status 无行为回归。
- typecheck/build 通过，无新增 explicit `any`。

**停止条件**：

- 若必须修改服务端错误信封、训练路由、维护安全判断或 streaming API 才能继续，停止并报告，不扩大范围。
- 若发现 endpoint 成功响应不是 JSON 或依赖音频/图片流，保留原调用并列入排除项，不强行套 JSON client。
- 若同一取消/超时问题连续两次实现仍失败，按最高优先级规则先查 Fetch/AbortSignal 官方行为或成熟实现，不继续猜。

### 16.5 第一轮交付后的 SOL 第二轮

三位执行者完成第一轮后全部停止写入。SOL 按以下顺序接管：

1. 检查 `git status`、每个任务的 scoped diff 和独立报告，确认没有越界覆盖其他并行修改。
2. 先复审 Q-20，因为它决定 `npm run validate` 能否继续；直接修复 token 命名、层级或视觉回归。
3. 再复审 R-20，逐项检查错误分类、degraded 特例、AbortSignal 清理、旧请求竞态、真实 501/409 信封和业务行为；发现遗漏由 SOL 直接补齐。
4. 最后复审 D-10 的 harness、只读诊断和证据真实性；任何 browser-only、renderer-only、模拟 DPI 或假 TTS 结果一律不签收。
5. SOL 使用冻结后的最终源码重跑必要命令。若第二轮修改打包输入，重新生成安装包 SHA，并只保留新包证据。
6. D-10 与 R-20 签收、validate 全绿后，SOL 执行 `DOC-10`，统一更新 `docs/project-handoff.md` 和各路线图。

## 17. 第二批 SOL 第二轮执行结果

日期：2026-08-09

- `Q-20`：PASS，scanner `24 / 26`，视觉证据复审通过。
- `R-20`：PASS，API client、degraded 特例、取消/超时、错误元数据、剩余 room endpoint 和业务回归已签收。
- `npm run validate`、最新 `npm run build`、`npm run validate:desktop`、Cargo 13/13 和相关 Playwright 8/8：PASS。
- D-10 最终 NSIS SHA-256：`ee9277f95143ae9499e657e290429fd0b361b8715c050969408a2a4b56cee178`；打包输入指纹：`84237fd2a3c9cbd623cdcbccb7854ed05b1d52bd67e45a4b820fa0f2e12b77a1`。
- `D-10`：仍为 BLOCKED。当前无管理员权限、GPT-SoVITS 离线、仅 100% 单屏，且没有实际 self-hosted workflow URL/run id/commit SHA。
- `DOC-10`：未解锁；不得把代码复审、renderer selftest 或安装包成功冒充真实安装产品验收。
