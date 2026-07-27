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
- **PromptBuilderView 功能完善** — 当前版本完成了核心出图流程；历史面板、备份恢复 UI、评分弹窗等二级功能尚待补全
- **场景库测试** — `scripts/tests/test-page-architecture.js` 基于旧 HTML 结构，需更新为针对 Vue 组件的检查逻辑
- **CI 硬化** — e2e 可拆夜间若 push 过慢
- **tools/ 剩余工具迁移** — `prompt-policy.js`、`sd-api.js`、`icon-system.js`、`data-backup.js` 仍以原生 JS 全局形式存在，PromptBuilderView 按需动态加载；可按需逐步迁入 `src/`
