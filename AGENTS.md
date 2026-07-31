# AI-CG-Studio 项目协作指南

> 当前状态基线：2026-07-28。本文只记录仍然有效的约束、架构和待办；已完成的迁移与历史审计不再保留。

## 产品约束

- 网站以本地个人使用为主。
- 控制面板桌面端保留常驻侧栏与收束的内容宽度；窄屏退化为顶部导航和单列，不能产生横向滚动。
- R18 内容默认开启，缩略图/样张继续使用模糊遮罩；不要擅自改成默认关闭或删除成人内容。
- 绘图页保留两种工作模式：
  - 场景模式：紧凑、低认知负担，自动推断镜头/光照/构图；出图参数默认折叠，但生成、队列、配音不能被隐藏。
  - 专家模式：开放完整场景、词条和 Prompt 结构；大型选项区默认折叠，避免页面拥挤。
- 绘图页内容宽度与作品册接近，不铺满 4K 屏幕。
- 角色空间同时支持本地 Ollama 与 OpenAI-compatible API（含 DeepSeek、OpenCode 类端点）；模型名必须可配置或发现，不能由供应商名称猜测。
- 角色配音是现有功能，重构布局时不得删除。
- Live2D 默认按需加载，用户显式启用前不得下载大贴图。

## 图片审核

- 使用当前模型的视觉能力或本地图片查看工具逐张检查图片。
- 不调用 `vision.js`、千问 VL 或旧的 `Codex-vision-skill`。
- 场景样张、模型对比图和训练素材不能只按文件名、标签或自动评分判断。
- 至少检查：人物身份与官方特征、脸和装饰、服装、肢体结构、双人特征串位、构图、光照、场景叙事是否一致。

## 当前架构

- 前端：Vue 3 + Vite + TypeScript + Pinia，入口为 `index.html`。
- 路由页面：`src/views/*.vue`，全部懒加载。
- 共享组件：`src/components/`。
- 状态：`src/stores/sceneStore.ts` 与 `src/stores/promptBuilderStore.ts`。
- 业务组合函数：`src/composables/`。
- Prompt、场景推断、SD 请求构建与错误策略：`src/utils/`。
- 网关：Express，路由位于 `routes/`，安全与公共服务位于 `server/`、`services/`。
- 分享 token：未设置 `TOKEN` 环境变量时，首次启动生成并持久化至 `runtime/state/gateway_token`；重启必须复用该 token。`TOKEN` 环境变量仅作显式覆盖，不得改写持久化 token。
- 数据：场景运行时数据通过 `sceneStore` 单例加载；不要重新添加散落的 `/data/*.json` fetch。
- 图片与历史：IndexedDB，封装在 `useKVStore`、`useImageStore`、`useBackup`。
- `docs/*.html` 仍使用 `tools/nav.js`、`theme.js`、`local-status.js`；这些是文档站运行时，不属于已删除的应用控制器。

### 训练台参数契约（白名单覆盖）

- 浏览器可覆盖的训练参数仅限 `TrainingParamOverrides` 白名单字段（epochs/batch_size/gradient_accumulation_steps/lora_rank/lora_alpha/unet_learning_rate/text_encoder_learning_rate/text_encoder_stop_epoch）；未知 key、非数字、越界一律 400。
- 覆盖值由服务端写入 `training_configs/.ui_plans/` 下带时间戳的一次性配置副本（原配置只读），浏览器仍无法直接传路径或命令；无覆盖时保持原配置启动。
- `GET /api/training/jobs/:id/config` 返回白名单字段与推荐值（来源为磁盘 v18 配置），voice 任务返回 `available: false`。
- 前端参数草稿按 job 持久化在 `aics_training_params_<jobId>`（localStorage），"开始训练"只提交与推荐值不同的字段；ETA 由前端滑动平均步速外推，不依赖服务端时钟。
- LoRA 数据集可切换：服务端枚举 `AI/Datasets/Characters/<角色>/` 下非隐藏子目录为候选（`job.datasetOptions` 含每个候选的图片/标注/体积/分层统计），浏览器只传枚举 id（未知 id 一律 400，仍不传路径）；`job.selectedDataset` 是默认目录（宁宁 `V18_WD14_Curated`、夏目 `V17_WD14_Curated`，无则取枚举首个）。前端选择持久化在 `aics_training_dataset_<jobId>`。

### 已形成独立所有权的绘图组件

- `VoiceStudio.vue`：配音、翻译、音频生命周期。
- `PromptDataTools.vue`：备份、恢复和弹层焦点。
- `PromptHealthPanel.vue`：Prompt 结构与违规提示。
- `GenerationQueuePanel.vue`：出图队列。
- `SDRecoveryPanel.vue`：SD 错误分类和恢复动作。
- `usePromptAssembly.ts`：模型 Profile、有效场景、角色特征、LoRA 权重与正负 Prompt 组装、健康报告和预览。它只拥有派生的 Prompt 策略；场景/UI、SD 队列、历史和生命周期继续留在 `PromptBuilderView.vue`。

继续拆分时按状态与生命周期所有权拆，不要仅为了减少行数搬函数。

### 已形成独立所有权的角色空间组件

- `ChatApiSettings.vue`：本地/API 供应商切换、连接测试与模型发现。
- `ChatCharacterStage.vue`：角色切换、立绘与按需 Live2D 生命周期。用户显式启用前不得下载大贴图；启用后可预加载小型原生动作，保证首次点击也有反馈。宁宁打包源模型的呆毛、头部、脸、身体、两侧与裙摆及对应原生动作；`wl-live2d` 在缩放后可能把 DOM 点击全部报为 Body，因此由可见舞台分区稳定分派到源码动作，Cubism hit test 只作未测量时的回退。动作调用的第三个参数是 `MotionPriority`，点击必须传 `FORCE`（数值 `3`）；传 `null` 会静默拒绝。互动提示与高亮只能在渲染器返回动作已启动后显示；同一动作播放期间再次点击应提示“动作进行中”，只有无活动动作时的拒绝才报失败。宁宁的 `expression1` 至 `expression5` 是模型自带的校服、常服、睡衣、COS 服与魔女服，不是情绪表情；只能由显式换装控件切换并持久化，聊天或 TTS 情绪不得调用。不得打包或播放源项目 WAV（角色配音仍由现有 TTS 负责），不得用参数生成伪动作或伪换装。
- `useChatStorage.ts`：会话、草稿、供应商配置和 Live2D 偏好持久化。

`useVoice.ts` 会保留聊天气泡中的舞台提示，但必须在翻译和 TTS 前剥离；提示文本用于情绪推断。短促片段需要并句，单句合成必须有有限超时和重试，并显示上游失败明细；超时或队列繁忙时不得重复提交同一句。

聊天流、配音和角色舞台之间只传递必要状态；不要把 Live2D 或供应商设置重新塞回 `ChatView.vue`。

## 不得回退的架构约束

- 不要恢复已删除的 `tools/chat/`、`tools/prompt-builder/`、旧 `tools/*.html` 页面。
- 不要向 `index.html` 添加 `/tools/...` 或其他全局脚本注入。
- 不要恢复以下旧全局变量：
  - `window.AICKVStore`
  - `window.AICGImageStore`
  - `window.AICSceneUX`
  - `window.createSceneCard`
- 应用样式源只有 `src/assets/css/**` 和 SFC 样式；`docs` 使用同一份设计系统。
- 新增安全测试应断言真实 HTTP 路由输出，不要只测试复制出来的 helper。
- 控制面、维护路由必须复用 `server/security.js` 的本机判断与 URL 校验。
- API 失败使用统一错误信封；未知 `/api/*` 不得回退到 SPA HTML。

## 质量门槛

- 小改先跑相关测试，不需要每次都跑完整套。
- 修改 `src/`：
  1. `npm run typecheck:app`
  2. `npm run build`
- 修改 `services/*.ts`：
  1. `npm run build:runtime`
  2. 提交生成的 `.js` 与 `.d.ts`
- 修改公共契约、安全、数据格式或跨页面基础设施：`npm run validate`
- 最终浏览器回归：`npm run test:e2e`
- 不要用裸 `tsc -p tsconfig.app.json` 代替 `vue-tsc`；它不会真实检查 `.vue` SFC。
- `npm run test:e2e` 会先构建；已有新构建时可用定向 `npx playwright test ...`，避免重复构建。

当前门槛覆盖真实应用 CSS、Vue SFC、运行时构建、场景契约、安全路由、存储、Prompt、SD、聊天、配音和 Playwright 流程。

`src/` 业务实现中的显式 `any` 已清零，新增代码不得回退；`vite-env.d.ts` 的 Vue 通配模块声明不计入业务类型债。

## 当前待办

### 已完成：P1 · v18 核心样张审核（2026-07-31）

1. 用 `generate-v18-core-showcase.js` 为 30 个核心场景生成可审计候选集（固定 `waiIllustriousSDXL_v170` 检查、确定性 seed、独立目录 `AI/Reviews/SceneAudits/2026-07-30_v18_core`）。
2. 用 `build-scene-manual-audit-sheets.py` 生成 6 份分批审核表。
3. 30 个场景全部按“图片审核”约束通过复核并记录到 `manual-review.json`。
4. 用 `update-v18-core-showcase.py` 将定稿样张同步进线上展示集（大图/缩略图/manifest/分页 sheets），`DATA_VERSION` 升到 15，展示页定向 E2E（`flows.spec.ts`）与 `npm run validate` 全绿。

若后续 v18 全量 297 场景样张需要整体重出，可复用同一套生成→审核→落盘链路。

### 待办：项目健康度优化（2026-07-31）

基线：`npm run validate`、`npm run build`、92 个关键 Playwright 用例全部通过。以下按优先级推进，完成一项勾掉一项。

P1 · 近期

1. Live2D 运行时块瘦身：~~确认 `assets/vendor/live2d` 静态副本能否替代 npm 包~~（2026-07-31 调查结论：wl-live2d bundle 完全自包含 pixi.js + pixi-live2d-display + cubism4 core，静态副本同尺寸无收益；实质瘦身需重写渲染层，暂缓），已纳入 bundle 预算监控（`check-bundle-budget.js` lazy chunk 上限 1000KB）。
2. ~~消除 /chat 进出整页刷新~~（2026-07-31 评估后暂缓，权衡见下）：CSP 因 Live2D 需要 `unsafe-eval` 而按路由换页（`src/router/index.ts` 与 `server/security.js`）。
   - 现状已是"最小刷新"：仅进出 `/chat` 各整页一次；`/chat` 内部导航不刷；服务端未收紧 CSP（dev server）时不刷。
   - 状态丢失面小：草稿（`aics_pb_last_draft`）与会话（`useChatStorage`）均 localStorage 持久化，丢失的只是瞬时内存态。
   - iframe/独立入口方案需把 ChatCharacterStage + useLive2D（730 行）搬进子文档并过 postMessage 桥（点击分区→动作分派、换装→expression、状态回传），并新增服务端宽松 CSP 路由；收益（免两次刷新）与风险（Live2D 交互回归）不成比例，暂缓；若未来 Live2D 交互简化或 cubism core 出 wasm 免 eval 版本，再重新评估。
3. 拆分大视图：`TrainingView.vue`（1313 行）、`PromptBuilderView.vue`（1136 行）、`SceneManagerView.vue`（1048 行）、`ControlView.vue`（1019 行）按状态与生命周期所有权拆 composables/子组件，不按行数搬。~~ControlView（1019 → ~400）与 SceneManagerView（1048 → ~860）已拆~~（2026-07-31：`useControlStatus`/`useControlActions`/`useSceneShowcaseUpload`/`useSceneTagManager`）；~~TrainingView 脚本已拆~~（2026-07-31：格式化/分类/状态文案收敛到 `useTrainingFormat`，脚本 345 → ~200 行）；~~PromptBuilderView 已拆~~（2026-07-31：静态目录与派生状态收敛到 `useDirectorCatalog`/`useDirectorDerived`，1204 → ~990 行）。
4. ~~修正文档漂移~~（2026-07-31 完成：STARTUP.md token 持久化描述、README 场景数 297、tools 结构描述已修正）。
5. 测试体系渐进迁移：36 个 `scripts/tests/*.js` 断言脚本迁到 `node:test`（保持命令兼容），补覆盖率统计与失败定位。~~已全部迁移~~（2026-07-31：`test-sd-error`、`test-maintenance` 手工示范 + 22 个纯断言文件自动包裹 + `test-http-client`、`test-gateway-token`、`test-chat`、`test-training-routes`、`test-training-service`、`test-sd-runtime`、`test-storage-reliability`、`test-control-failure-contract`、`test-live2d-service` 手工；迁移模式：断言包进 `test()`，命令兼容，失败给用例名与位置）。

P2 · 工程卫生与基础设施

6. ~~仓库卫生~~（2026-07-31 完成：pptx 移入 docs/、清理 data 旧文件、删除 agents/test-branch 及其 worktree）。
7. ~~JS lint~~（2026-07-31 完成：ESLint flat config 接入 `npm run validate`，0 error 门禁覆盖未使用变量/显式 any 回退/console 残留/v-html；清理 4 个死变量与 1 个死函数）。
8. ~~字体自托管~~（2026-07-31 完成：Google Fonts 换 @fontsource 本地 woff2，CSP 移除 fonts.googleapis.com/gstatic.com，离线可用）。
9. ~~如计划公开分享仓库，补 LICENSE 文件~~（2026-07-31 完成：MIT LICENSE + README/README_zh 许可说明与徽章）。

P3 · 长期观察

10. 场景扩容时评估 `data/scenes.json`（899KB / brotli 155KB）按角色分片或索引化加载。
11. `services/training-service.ts`（1069 行）在训练功能稳定后按数据集/任务/日志拆分。
12. Express 5 升级评估（不急），需覆盖中间件与代理兼容性测试。

## 明确暂缓

- Live2D 42.85MB 贴图压缩、KTX2/WebP 转换。
- 已入 Git 历史的 Live2D 资源迁移到 Git LFS 或外部下载。

这两项需要单独的资源兼容性与仓库历史方案；未得到用户新指示前不要启动，更不能重写 Git 历史。

## 工作区注意事项

- 工作区可能包含用户自己的未提交修改；不要覆盖、格式化或顺手提交无关文件。
- 当前用户自有改动包括维护脚本时，应原样保留并在交付时说明。
- 禁止使用 `git reset --hard`、`git checkout --` 等破坏性恢复命令。
