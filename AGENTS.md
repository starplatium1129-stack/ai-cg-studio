# 项目协作要求

## 图片审核

- 直接使用当前模型的视觉能力或本地图片查看工具检查图片。
- 不调用 `vision.js`、千问 VL 或旧的 `Codex-vision-skill`。
- 场景样张、模型对比图和训练素材必须由当前模型逐张观察后再给出结论，不能只根据文件名、标签或自动评分判断质量。
- 图片审核至少检查：人物身份与官方特征、脸和装饰、服装、肢体结构、双人特征串位、构图、光照，以及画面是否符合场景故事。

## 质量门槛

- 改完跑相关测试；触及公共契约时跑 `npm run validate`（含 design lint、runtime build、typecheck、场景校验与脚本测试）。
- 浏览器冒烟：`npm run test:e2e`（本机 Chrome/Edge 可作 Playwright 可执行文件）。
- 运行时 TS 模块：改 `services/*.ts` 后执行 `npm run build:runtime`，提交 emit 的 `.js` / `.d.ts`。
- Vue SPA：改 `src/` 下文件后执行 `npm run typecheck:app` 确认无类型错误，再执行 `npm run build` 确认构建通过。

## 架构现状（已完成的迁移）

前端已从 Express + 原生 HTML 完整迁移为 **Vue 3 + Vite + TypeScript + Pinia**。

### src/ 目录结构

```
src/
├── config/
│   ├── characters.ts        角色常量（宁宁/夏目）：名字、图片、声线
│   └── promptConstants.ts   导演台静态定义：情绪/镜头/光照/构图/色彩情调
├── utils/
│   ├── stream.ts            流式工具：NDJSON 解析、句子缓冲、WAV 修复
│   └── sceneUX.ts           场景纯函数：搜索评分、偏好推断、最近记录
├── stores/
│   ├── sceneStore.ts        Pinia：scenes.json + curation.json 单例缓存
│   └── promptBuilderStore.ts  Pinia：导演台全局状态
├── composables/
│   ├── useChatStorage.ts    聊天历史持久化（localStorage）
│   ├── useLive2D.ts         Live2D 控制器
│   ├── useVoice.ts          TTS 语音合成 + 口型同步
│   ├── useSDGenerate.ts     SD WebUI 生成 API 封装
│   ├── useKVStore.ts        IndexedDB KV 存储
│   └── useImageStore.ts     IndexedDB 图片 Blob 存储
├── components/              AppLayout / AppNav / SceneCard / AppThemeToggle
├── views/                   每路由一个 .vue，全部懒加载
└── assets/css/              设计系统 Token、组件样式
```

### 已删除的旧文件

以下文件已在重构过程中删除，不要重新创建：

- `tools/chat/` — 已迁移为 `src/composables/useLive2D.ts` + `useVoice.ts` + `useChatStorage.ts`
- `tools/prompt-builder/` — 已迁移为 `src/stores/promptBuilderStore.ts` + 相关 composables
- `tools/image-store.js` — 已迁移为 `src/composables/useKVStore.ts` + `useImageStore.ts`
- `tools/scene-ux.js` — 已迁移为 `src/utils/sceneUX.ts`
- `tools/scene-card.js` — 已迁移为 `src/components/SceneCard.vue`
- `tools/*.html`（所有旧 HTML 页面）— 已被 `src/views/*.vue` 替代
- `tools/*.js`（旧页面控制器）— 已被 Vue 视图和 composables 替代

### index.html

当前 `index.html` 是 Vite SPA 入口，不含任何全局 `<script>` 注入。不要向其中添加 `<script src="/tools/...">` 或其他全局脚本标签。

### 全局变量说明

以下全局变量已不再从 `index.html` 注入，对应功能已迁移：

| 原全局变量 | 现在的位置 |
|---|---|
| `window.AICKVStore` | `src/composables/useKVStore.ts` |
| `window.AICGImageStore` | `src/composables/useImageStore.ts` |
| `window.AICSceneUX` | `src/utils/sceneUX.ts` |
| `window.createSceneCard` | `src/components/SceneCard.vue` |

## 待办 / Future Work

### 已有基础（勿当空白重做）

- **Vue 3 SPA** — `src/` 完整实现；所有页面均已迁移，TypeScript 检查 + Vite build 通过
- **Pinia 状态管理** — `sceneStore`（scenes + curation 单例）、`promptBuilderStore`（导演台）
- **composables** — useVoice / useLive2D / useChatStorage / useSDGenerate / useKVStore / useImageStore
- **sceneUX 纯函数** — tier / matchesSearch / searchScore / buildPreferenceProfile / readRecent 等，已从全局迁入 `src/utils/sceneUX.ts`
- **校验入口** — `npm run validate` 串联 design lint、`build:runtime`、typecheck、场景/内容契约与大量 `scripts/tests/*`
- **契约类型** — `types/*` + 渐进运行时：`control-operation` / `serial-queue` / `http-client` / `tts-service` / `ollama-service` / `translation-service` / `live2d-service`
- **E2E** — Playwright：`tests/e2e/`，`npm run test:e2e`
- **CI** — `.github/workflows/quality.yml`：push/PR 跑 `npm run validate` + Playwright e2e

### 仍待推进

- **测试加深** — E2E 测试用例需更新以覆盖新 Vue SPA 路由与交互（旧版 DOM id 已变化）
- **场景库测试** — `scripts/tests/test-page-architecture.js` 基于旧 HTML 结构，需更新为针对 Vue 组件的检查逻辑
- **CI 硬化** — e2e 可拆夜间若 push 过慢
- **tools/ 剩余工具迁移** — `prompt-policy.js`、`sd-api.js`、`icon-system.js`、`data-backup.js` 仍以原生 JS 全局形式存在，PromptBuilderView 按需动态加载；可按需逐步迁入 `src/`

### Vue 重构后仍缺失的功能（按优先级）

> 来源：对比重构前 `81d21ff^:tools/` 与当前 `src/`。已完成项见下方"已恢复"。

#### P0 — 阻断主流程

- **导演台：出图队列 + 错误恢复** — 当前 `useSDGenerate.generate()` 串行阻塞，无队列；catch 仅显示一句错误。需新建 `src/composables/useSDQueue.ts`（≤8 任务、暂停/恢复、按 seed 复用、失败保留、自动 `commitHistoryEntry`），并把 `useSDGenerate.ts` catch 改为分类恢复按钮（retry_light/retry_without_lora/retry_safe_sampler/recheck_connection/降尺寸）。参考 `81d21ff^:tools/prompt-builder/queue.js`（154 行）与 `sd.js:644-690`。

#### P1 — 数据资产 / 收尾回路

- **导演台：备份/恢复 UI** — 序列化 history/projects/settings/images 为 JSON、下载、读取、replace/merge。需新建 `src/composables/useBackup.ts` + `src/components/BackupOverlay.vue`，接入侧边工具菜单。后端 `/api/backup` 已在。参考 `81d21ff^:tools/prompt-builder/backup.js`（241 行）。
- ~~导演台：评分弹窗~~ — 用户确认鸡肋，不做。

#### P2 — 高频交互细节

- **导演台：Prompt policy 深化** — `src/utils/promptPolicy.ts` 已有基础 `sanitize/merge/adapt`；可继续迁 `inferStory`、`analyzeParts`（token 健康条）、`dedupeParts`、`applyFraming`、`sceneSupportsCharacter`、`enrichDualPrompt`、`recommendAspect`，并加违规高亮。
- **导演台：First-creation coach** — welcome→ready→complete 三阶段 + 首次成功横幅 + 入场签名场景按钮。参考 `81d21ff^:tools/prompt-builder/app.js:337-388`。

#### P3 — 场景管理二级功能

- **场景管理：标签库 CRUD** — 当前 Vue 版只能看不能改。需新增/编辑/删除标签、改名级联、权重、分页。参考 `81d21ff^:tools/scene-manager.js:363-428`。
- **场景管理：样张管理 tab** — 样张预览/上传/替换（JPEG 归一化、15MB/60MP 上限），POST `/api/maintenance/showcase`。参考 `81d21ff^:tools/scene-manager.js:124-184`。
- **场景管理：重复检测 tab** — 按关键词分组检测疑似重复场景。参考 `81d21ff^:tools/scene-manager.js:332-356`。
- **场景管理：维护工具结果细化** — 当前已接 `/api/maintenance/run`，但输出展示较粗，可补 lint/validate/classify/optimize 各自的结构化报告。

#### 已恢复（2026-07-27 本轮）

- 场景管理：持久化保存（POST /api/maintenance/scenes）、完整编辑表单（22 字段+策展层级+推荐理由+LoRA 自动绑定）、增删复制、脏态、beforeunload、导出、导入、维护工具
- 导演台：草稿持久化 saveDraft/restoreDraft、深链恢复（?scene/?regen/?variant/?mood/?char/?resume/?quick）、场景智能推断（自动预填光照/镜头/构图/情调/推荐尺寸）、作品历史 IndexedDB 落盘（commitHistoryEntry + saveHistory 改为抓 blob 入库）
- 美化：聊天样式恢复（chat.css 重新接入）、导演台 body→.pb 选择器对齐、Vue 类名兼容、布局语义修正（重复 main→article、skip-link、nav-logo）、首页场景卡改用 SceneCard、全局背景光斑收敛
- Bug：样张查看器改为 fixed 居中
- **控制面板：恢复旧 control-server 的服务启停能力**（接进 Vue SPA，不是独立 3001 进程）
  - 后端 `routes/control.js`：`/api/service/webui|voice|ollama`、`/api/mode`（绘图优先/聊天优先）、operation 进度、Ollama 显存卸载、脚本探测
  - 前端 `ControlView.vue`：SD/语音 启停按钮、Ollama 卸载、模式切换卡、操作进度条、公网通道与网关职责分离
  - 依赖脚本（仍在）：`scripts/runtime/managed-webui.ps1`、`../AI/Voice/Start-Voice.ps1`、`Stop-Voice.ps1`
- **连接修复：补 `/api/sd-status`** — 导演台原先请求不存在接口导致永远“未连接”；现已实现，并回退探测 `/sdapi`
- **导演台：配音工作室** — 中栏 voice-studio（字幕/翻译/系统试听/AI 生成/WAV 下载），接 `/api/tts-status|translate|tts|voice/prepare`
- **导演台：历史面板 UI** — `HistoryPanel.vue`（缩略图/seed/继续/复制/删除）
- **导演台：Seed lock + 负面词编辑** — 出图参数区可锁 seed、复用上次 seed、自定义负面文本；`promptPolicy` 基础接入
- **出图参数对齐旧 sd-api** — 默认 CFG 5.5、负面默认开启、hires denoise 0.35 / Latent、scheduler 可选、`hr_second_pass_steps`
- **控制面板 UI 对齐作品册气质** — 宽壳大标题、状态墙卡片、克制分区、sticky 工具条、旧版 status-grid / service-row / access-card 信息架构
- **画风页** — 多色条 mood 卡、完整 COLOR_MOODS、进入绘制 CTA 与使用提示
