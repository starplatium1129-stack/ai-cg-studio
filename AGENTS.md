# AI-CG-Studio 协作指南

只保留执行约束。现状见 [项目状态](docs/project-status.md)，任务优先级见 [未来规划](docs/roadmap.md)，操作入口见 [工作流](docs/workflow.md)，全部文档见 [索引](docs/INDEX.md)。历史报告不能替代本次验收。

## 指令优先级与自主执行

1. 当前用户对本次任务的明确要求优先于仓库内的一般性指导；本文件规定仓库级执行边界，相关 `SKILL.md` 只在其适用任务中补充细则，历史文档与调研记录只作证据和背景，不得覆盖当前明确目标。
2. 用户提出“帮我 / 能不能 / 优化一下”等行动请求时，直接推进到可交付结果，不停在方案或能力说明。常规细节采用最小且可逆的合理假设；只有缺失信息会实质改变结果且无法安全推断，或下一步超出已有授权时才询问。已有授权持续有效；需要新授权时，先完成不依赖该授权的准备与验证，让用户审核具体结果。
3. 按需加载上下文。先读直接相关入口和文件，不默认全仓扫描，也不为简单任务机械读取全部指南、历史报告或 skills。发现规范冲突时优先核对当前实现、当前工作流与最近维护的执行规范。
4. 用户中途补充、纠正或询问进度时，保留原目标及已完成工作，合并新约束并继续；仅在明确取消或新目标不兼容时替换任务。长任务交接只保留目标、约束、改动文件、有效证据和下一步，不能因上下文压缩重做已完成工作。
5. 独立审查、互不重叠的模块修改或分批内容可在明显节省时间时使用子代理；小改动、强依赖步骤或同文件写入由主会话完成。交付子任务的目标、文件/ID 边界、约束及验收标准；主会话并行推进其他工作并复核产物，不把委派视为完成。共享工作区的 Git 写操作仍由单一会话负责。
6. skill 或文档导致暂停、请求确认或偏离用户目标时，指出实际读取的文件和具体条款，区分明确要求与自己的推断。普通建议不能自动升级为审批门槛；真实阻塞只暂停依赖它的步骤，并如实交付可独立完成的部分。

## Skills 适用与维护

- 提示词数据、双引擎编译及出图质量任务按 [studio-prompt-craft](.agents/skills/studio-prompt-craft/SKILL.md) 执行；纯 UI 或普通代码任务不加载它。`apple-design` 若在本机可用，仅辅助相关动效与视觉设计，不要求为小修重做整页、安装动画库或增加确认弹窗。
- skill 只保存影响任务决策的领域约束；通用协作规则留在本文件。描述写清触发范围，参考资料按需读取；示例、推荐值和历史经验不能变成全局硬门槛。
- 外部设计建议须服从本项目的双主题、可访问性、动画与品牌约束；例如玻璃材质示例不能授权动画化 blur，也不能用 opacity 降低文字可读性。
- 调整指令时检查实际生效链中的重复、冲突、过宽触发与隐含审批，并用典型请求核对适用范围及完成条件。模型专属建议须核对官方来源，不把编码代理建议套成 Anima / Krea 的图像生成参数。

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
- 当前支持深浅主题，新增/修改 UI 均需两种主题视觉审查、WCAG AA 对比度与扫光不压字。禁用文字用 `--text-disabled`，不得 opacity 压字。check-contrast 覆盖双主题全局令牌与角色强调色；组件动态样式、图片叠字和实际布局仍需浏览器视觉验收。
- 保持本机/远程分级边界：`adultEnabled = isLocalStudioHost()`；远程、隧道、未知或未授权状态 fail-closed，保留拒绝与模糊遮罩。分级字段约定见 [内容与接入契约](docs/engineering-contracts.md#角色接入)。
- `assets/character-references/` 不入 Git；运行时经 `/data/character-reference-view.json` 懒加载。pending 占位不能计为已交付资产。
- 单体有效行数上限 600；存量豁免只降不升，门禁为 `test-monolith-budget.js`，基线为 `scripts/tests/monolith-baseline.json`。

## 实施与交付

- 复杂状态机放入 composable，View 保持展示职责。模型参数、双引擎提示词、Live2D 生命周期与角色接入六层闭环，按 [工程契约](docs/engineering-contracts.md) 执行。
- 验证按改动面积分层：先做最贴近改动的状态/逻辑自测，再按 `docs/workflow.md` 选择 `gate:quick`、定向检查或 `gate:full`。纯文档/指令变更只做结构、链接、规则一致性等必要检查，不机械跑构建；代码、依赖、配置、工作流、未知影响面或提交前要求完整门禁时再执行 `npm run workflow -- gate:full`。
- 已有同一工作树、同一内容版本上的检查若已覆盖当前风险，不重复做昂贵等价验证；发生后续改动、检查结果过期、失败或出现新风险时必须重跑相应范围。必要检查通过且无新增风险后继续完成交付，不为“更保险”无限扩大扫描和测试。
- 测试验证用户可观察行为与回归风险，不为可逆小改新增只复述实现的测试。验收以本次目标和上述质量红线为准；无关存量问题单独报告，不自动扩成新任务。
- 按改动补热门角色、Anima 接口、动画、对比度、定稿保护与真实渲染检查。打包预算以 `check-bundle-budget.js` 实际路由和依赖闭包检查为准，不固化路由数量。
- 桌面同步唯一入口 `deploy-desktop.bat`；已 build 可用 `-SkipBuild`。依赖或 exe 变动需完整安装。管理员 UAC 由用户操作，细节见 [部署指南](docs/desktop-deployment.md)。
- 未执行、失败、需用户操作的步骤必须如实列出，不得沿用历史 PASS 宣称本次交付完成。
- 默认用简洁中文说明结果、关键改动、验证与剩余限制；进度更新讲新发现和下一步，不逐条转述工具调用。不强制每次套用长报告、表格或固定标题。

本轮协作规则参考 [OpenAI GPT-6 Astra 提示建议](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra#prompting-best-practices) 与 [Skills 编写指南](https://learn.chatgpt.com/docs/build-skills)（2026-09-12 核对）；项目质量红线属于本地约束。
