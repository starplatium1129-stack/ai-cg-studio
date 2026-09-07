# AI-CG-Studio 协作指南

只保留执行约束。现状见 [项目状态](docs/project-status.md)，任务优先级见 [未来规划](docs/roadmap.md)，操作入口见 [工作流](docs/workflow.md)，全部文档见 [索引](docs/INDEX.md)。历史报告不能替代本次验收。

## 开工与工作区保护

1. 先读工作流或运行 `npm run workflow -- --help`；无入口再查 `scripts/maintenance/` 或 `workflow audit:orphans --json`。优先复用现成流程。
2. 先核对 `git status`、`git diff`，保护其他会话的未提交文件。禁止 `git add .`、`git reset --hard`；只暂存并提交已验证的受控文件，每次提交后必须 push。
3. 同一工作区只允许一个会话执行 Git 写操作；并行时使用 worktree 或明确错峰，长期并行关闭自动 gc（`git config gc.auto 0`）。本地 bundle 是第二副本，不替代远端推送。
4. 新增维护脚本须同时登记 `scripts/workflow.js`、`docs/workflow.md`，新增文档登记 `docs/INDEX.md`。一次性脚本用完归入被忽略的 `scripts/archive/`。

## 质量红线

- 提示词、蓝图、服装绑定、换装变更必须核对编译 Token 与真实渲染画面；不能用界面文字、状态或静态测试代替出图。场景切换需同步 outfitId、镜头和参数。
- 批量内容逐条真实重写；必须通过 `node scripts/tests/test-prompt-rewrite-integrity.js --delivery <文件>`，不得用模板、追加词条或虚报覆盖率交付。
- `data/prompt-pinned-scenes.json` 的 prompt/negative/animaCaption/recommendedSize/rating/mature 为字节级保护基线，批量任务跳过。单条改动须先真实出图，再 `npm run scenes:pin-capture`，提交说明附证据。
- 高频动画只用 transform/opacity；例外必须写 `/* compositor-exempt: 理由 */` 并评审基线。新增或修改图标使用 `ArchiveIcon.vue` 的手绘线条 SVG，不使用 Emoji 或实心图标。
- 当前支持深浅主题，新增/修改 UI 均需两种主题视觉审查、WCAG AA 对比度与扫光不压字。禁用文字用 `--text-disabled`，不得 opacity 压字。现有 check-contrast 只核算深色，不能作为浅色验收证据。
- 保持本机/远程分级边界：`adultEnabled = isLocalStudioHost()`；远程、隧道、未知或未授权状态 fail-closed，保留拒绝与模糊遮罩。分级字段约定见 [内容与接入契约](docs/engineering-contracts.md#角色接入)。
- `assets/character-references/` 不入 Git；运行时经 `/data/character-reference-view.json` 懒加载。pending 占位不能计为已交付资产。
- 单体有效行数上限 600；存量豁免只降不升，门禁为 `test-monolith-budget.js`，基线为 `scripts/tests/monolith-baseline.json`。

## 实施与交付

- 复杂状态机放入 composable，View 保持展示职责。模型参数、双引擎提示词、Live2D 生命周期与角色接入六层闭环，按 [工程契约](docs/engineering-contracts.md) 执行。
- 顺序：状态/逻辑自测 → `npm run typecheck:app` → 前端与接口契约 → `npm run build` → 精准 commit + push。统一全量入口：`npm run workflow -- gate:full`。
- 按改动补热门角色、Anima 接口、动画、对比度、定稿保护与真实渲染检查。打包预算以 `check-bundle-budget.js` 实际路由和依赖闭包检查为准，不固化路由数量。
- 桌面同步唯一入口 `deploy-desktop.bat`；已 build 可用 `-SkipBuild`。依赖或 exe 变动需完整安装。管理员 UAC 由用户操作，细节见 [部署指南](docs/desktop-deployment.md)。
- 未执行、失败、需用户操作的步骤必须如实列出，不得沿用历史 PASS 宣称本次交付完成。
