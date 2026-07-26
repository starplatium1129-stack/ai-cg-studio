# 项目协作要求

## 图片审核

- 直接使用当前模型的视觉能力或本地图片查看工具检查图片。
- 不调用 `vision.js`、千问 VL 或旧的 `Codex-vision-skill`。
- 场景样张、模型对比图和训练素材必须由当前模型逐张观察后再给出结论，不能只根据文件名、标签或自动评分判断质量。
- 图片审核至少检查：人物身份与官方特征、脸和装饰、服装、肢体结构、双人特征串位、构图、光照，以及画面是否符合场景故事。

## 质量门槛

- 改完跑相关测试；触及公共契约时跑 `npm run validate`（含 design lint、runtime build、typecheck、场景校验与脚本测试）。
- 浏览器冒烟：`npm run test:e2e`（本机 Chrome/Edge 可作 Playwright 可执行文件）。
- 运行时 TS 模块：改 `.ts` 后执行 `npm run build:runtime`，提交 emit 的 `.js` / `.d.ts`。

## 待办 / Future Work

### 已有基础（勿当空白重做）

- **校验入口** — `npm run validate` 串联 design lint、`build:runtime`、`typecheck`、场景/内容契约与大量 `scripts/tests/*`
- **契约类型** — `types/*` + 渐进运行时：`control-operation` / `serial-queue` / `http-client` / `tts-service` / `ollama-service` / `translation-service`
- **E2E** — Playwright：`tests/e2e/`，`npm run test:e2e`
- **页面架构门禁** — `scripts/tests/test-page-architecture.js`（外置控制器、禁 inline handler、CSP 就绪）
- **CI** — `.github/workflows/quality.yml`：push/PR 跑 `npm run validate` + Playwright e2e

### 仍待推进

- **TypeScript 渐进迁移** — 优先高风险服务与核心流水线（live2d 等；tts/ollama/translation 已迁）；`tools/` 仍以 JS/MJS 为主，勿整库重写
- **测试加深** — 在现有脚本测试上补 scene CRUD / voice pipeline / gallery 关键路径；保持本地 `validate` + 关键 e2e 绿
- **CI 硬化** — 缓存 Playwright 浏览器、失败产物上传；e2e 可拆夜间若 push 过慢
- **UI 一致性** — 次级页对齐 `nav-back` / `page-kicker` / `empty-state` 与 design-system atelier chrome
