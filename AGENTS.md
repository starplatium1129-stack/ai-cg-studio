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

### 已形成独立所有权的绘图组件

- `VoiceStudio.vue`：配音、翻译、音频生命周期。
- `PromptDataTools.vue`：备份、恢复和弹层焦点。
- `PromptHealthPanel.vue`：Prompt 结构与违规提示。
- `GenerationQueuePanel.vue`：出图队列。
- `SDRecoveryPanel.vue`：SD 错误分类和恢复动作。

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

### P2：大型视图继续按所有权拆分

- `PromptBuilderView.vue` 仍约 1193 行：`GenerationParamsPanel` 与 `GenerationOutputControls` 已拥有参数、分辨率和生成动作 UI；Prompt 组装管线仍留在页面，待形成稳定 composable 边界后再迁。

### P1：v15 核心样张审核

1. 使用 `generate-v15-core-showcase.js` 为 30 个核心场景生成可审计候选集，保持固定模型检查、确定性 seed 和独立输出目录。
2. 用 `build-scene-manual-audit-sheets.py --output-subdir` 分批生成审核表，并按“图片审核”约束逐张人工检查每个候选。
3. 每个场景只有在人物身份、服装、肢体、双人特征、构图、光照和叙事均通过后才能选定替换图；审核完成前继续保留 v14 展示集。
4. 最终替换时同步更新图片、缩略图、manifest、审核记录和缓存版本，并跑展示页定向 E2E。

## 明确暂缓

- Live2D 42.85MB 贴图压缩、KTX2/WebP 转换。
- 已入 Git 历史的 Live2D 资源迁移到 Git LFS 或外部下载。

这两项需要单独的资源兼容性与仓库历史方案；未得到用户新指示前不要启动，更不能重写 Git 历史。

## 工作区注意事项

- 工作区可能包含用户自己的未提交修改；不要覆盖、格式化或顺手提交无关文件。
- 当前用户自有改动包括维护脚本时，应原样保留并在交付时说明。
- 禁止使用 `git reset --hard`、`git checkout --` 等破坏性恢复命令。
