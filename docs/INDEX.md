# AI-CG-Studio 项目文档全景索引 (Documentation Master Index)

> **最新基线**：2026-08-21
> **维护契约**：本文档为 `docs/` 目录下全部架构规范、路线图、提示词工程、角色参考库、视频管线、桌面端与排障留档的总览索引。所有新文档与重大更新须在此登记。

---

## 快速导航 (Category Map)

- [一、 核心规范与总状态 (Core Specs & Status)](#一-核心规范与总状态-core-specifications--status)
- [二、 角色 4 视角参考库与设定调研 (Character Bible & Research)](#二-角色-4-视角参考库与设定调研-character-reference-bible--research)
- [三、 提示词、画风与多模型生成体系 (Prompting & Engines)](#三-提示词画风与多模型生成体系-prompting-artists--engines)
- [四、 视频工作台与智能分镜叙事 (Video Studio & Narrative)](#四-视频工作台与智能分镜叙事-video-studio--narrative-pipeline)
- [五、 桌面端与 Live2D Native 运行时 (Desktop & Live2D)](#五-桌面端与-live2d-native-运行时-desktop--live2d-native-runtime)
- [六、 疑难排查与历史故障演练 (Troubleshooting Archive)](#六-疑难排查与历史故障演练-troubleshooting-archive)
- [七、 历史调研与竞品分析归档 (Research Archive)](#七-历史调研与竞品分析归档-research-archive)
- [八、 静态 HTML 文档站页面 (Static Docs Portal)](#八-静态-html-文档站页面-static-docs-portal)

---

## 一、 核心规范与总状态 (Core Specifications & Status)

| 文档名称 | 路径 | 核心内容与维护状态 |
| :--- | :--- | :--- |
| **统一工作流** | [`workflow.md`](workflow.md) | **新同学首读**。`scripts/workflow.js` 统一入口，一览全部生图/审核/参考库/构建链路与参数。 |
| **协作指南** | `AGENTS.md` (根目录) | **最高优先级**。开发约束、质量门槛、出图/审核规范、桌面部署规范与并行协作协议。 |
| **设计系统契约** | `DESIGN.md` (根目录) | 界面视觉规范、色彩 Tokens、Typography、组件规范与布局标准。 |
| **项目当前状态** | [`project-status.md`](project-status.md) | 项目级总状态基线（43 热门角色/45 角色库/944 视角参考库、38 位画师、Tauri 桌面端、H3 Ref2VA 等）。 |
| **维护操作指南** | [`maintenance.md`](maintenance.md) | 场景维护、数据验证、多模型同步、备份恢复等日常维护脚本与契约。 |
| **视觉与架构路线** | [`visual-architecture-roadmap.md`](visual-architecture-roadmap.md) | UI/UX 演进路线、API Client、存储 Repository 与组件拆分基线。 |
| **桌宠语音演出路线** | [`companion-voice-roadmap.md`](companion-voice-roadmap.md) | Desktop Companion 语音交互、情绪标签驱动与状态机演进规划。 |
| **视频生成路线** | [`video-generation-roadmap.md`](video-generation-roadmap.md) | 本地 AI 视频生成（Wan 2.2 / MiniMax H3 / I2VA / Ref2VA）路线图。 |
| **画质与提示词路线** | [`prompt-image-quality-roadmap.md`](prompt-image-quality-roadmap.md) | 提示词结构进化、负向词抑制与画质提升长期路线。 |
| **模型与 ComfyUI 扩展路线** | [`model-comfyui-expansion-roadmap.md`](model-comfyui-expansion-roadmap.md) | 模型库与 ComfyUI 工作流扩展规划（超分/hires/加速等）。 |

---

## 二、 角色 4 视角参考库与设定调研 (Character Reference Bible & Research)

| 文档名称 | 路径 | 核心内容与维护状态 |
| :--- | :--- | :--- |
| **角色一站式接入流水线** | [`character-onboarding-workflow.md`](character-onboarding-workflow.md) | 新增热门角色档案、SFW/NSFW 场景、4 视角参考库、点阵场与样张全量自动化接入规范。 |
| **参考图待精调清单** | [`character-reference-audit-pending.md`](character-reference-audit-pending.md) | 45 角色 236 服装形态（944 视角）自动化审核大盘与 75 项边缘变体修复配方。 |
| **点阵粒子立绘管线** | [`particle-portrait-pipeline.md`](particle-portrait-pipeline.md) | 热门角色 Hero 粒子场整图点阵离线提取与复刻生成管线。 |
| **热门角色场景适配** | [`popular-scene-fit-audit.md`](popular-scene-fit-audit.md) | 热门角色与通用场景蓝图契约适配度审计报告。 |
| **角色调研：雷电/芙莉莲/伊蕾娜** | [`research/characters/character-research-raiden-frieren-elaina.md`](research/characters/character-research-raiden-frieren-elaina.md) | 雷电将军、芙莉莲、伊蕾娜官方设定、服装形制与视觉特征调研。 |
| **角色调研：玛奇玛/木更/楪祈** | [`research/characters/character-canons-makima-kisara-inori.md`](research/characters/character-canons-makima-kisara-inori.md) | 玛奇玛、木更、楪祈角色设定、正向特征锚与负向拦截。 |
| **角色调研：狂三/美琴** | [`research/characters/character-research-kurumi-mikoto.md`](research/characters/character-research-kurumi-mikoto.md) | 时崎狂三、御坂美琴原作设定与多形态提示词调研。 |
| **美琴 Danbooru 标签调研** | [`research/characters/research-misaka-mikoto-danbooru-tags.md`](research/characters/research-misaka-mikoto-danbooru-tags.md) | 御坂美琴 Danbooru / 社区标签消歧与精准提示词映射。 |
| **热门角色审视优化留档** | [`research/characters/popular-characters-audit-2026-08-18.md`](research/characters/popular-characters-audit-2026-08-18.md) | 2026-08-18 热门角色数据审视与优化记录。 |

---

## 三、 提示词、画风与多模型生成体系 (Prompting, Artists & Engines)

| 文档名称 | 路径 | 核心内容与维护状态 |
| :--- | :--- | :--- |
| **三引擎提示词体系** | [`three-engine-prompt-research.md`](three-engine-prompt-research.md) | SD/WAI、Anima 1.1、Krea 2 Turbo 三生成引擎语法、约束与提示词编译机制。 |
| **Krea 2 编写指南** | [`krea2-prompt-writing-guide.md`](krea2-prompt-writing-guide.md) | Krea 2 自然语言 3~5 句散文构筑法则、无负面与去审查规约。 |
| **模型与参数配置指南** | [`model-prompting-and-parameters-guide.md`](model-prompting-and-parameters-guide.md) | 模型采样器、CFG、步数、hires 放大参数全景配置表。 |
| **Anima 训练与复现记录** | [`anima-training-record.md`](anima-training-record.md) | 宁宁/夏目 Anima LoRA 训练超参、矩阵评审、晋级基线与复现协议。 |
| **场景样张出图工艺** | [`showcase-generation-craft.md`](showcase-generation-craft.md) | 官方 Showcase 样张批次生成、种子固化与质检工艺。 |

---

## 四、 视频工作台与智能分镜叙事 (Video Studio & Narrative Pipeline)

| 文档名称 | 路径 | 核心内容与维护状态 |
| :--- | :--- | :--- |
| **智能分镜生成规范** | [`video-ai-storyboard.md`](video-ai-storyboard.md) | LLM 自动分镜剧本拆解、镜头运动推断与 Ref2VA 参考图绑定规范。 |
| **叙事短片工作流** | [`narrative-short-film-workflow.md`](narrative-short-film-workflow.md) | 多镜头连贯短片生成流水线、画风锚注入与多语言对白（`dialogueLang`）驱动。 |
| **视频提示词链路** | [`video-prompt-chain.md`](video-prompt-chain.md) | 视频镜头提示词链、音画同步与多模态结构契约。 |

---

## 五、 桌面端与 Live2D Native 运行时 (Desktop & Live2D Native Runtime)

| 文档名称 | 路径 | 核心内容与维护状态 |
| :--- | :--- | :--- |
| **Live2D Native 运行时** | [`live2d-native-runtime.md`](live2d-native-runtime.md) | Rust 原生透明窗口渲染器、GPU 纹理缓存、300s 压力测试与性能基线。 |
| **Native Overlay 规范** | [`live2d-native-overlay-plan.md`](live2d-native-overlay-plan.md) | 前端与 Rust 壳 IPC 意图通信协议、屏幕物理像素坐标映射与分层。 |
| **Tauri 桌面端迁移** | [`tauri-desktop-migration-plan.md`](tauri-desktop-migration-plan.md) | 从 Electron 到 Tauri 2 的架构迁移、双窗口、打包与 D-10 验收条件。 |
| **夏目 Live2D 动作调研** | [`live2d-natsume-overlay-research.md`](live2d-natsume-overlay-research.md) | 四季夏目 Moc.moc3 动作曲线、叠层显隐与情绪参数映射。 |
| **useLive2D 拆分计划** | [`live2d-composable-refactor-plan.md`](live2d-composable-refactor-plan.md) | 1270 行组合式工厂的模块化研究：风险清单、Live2DCtx 显式契约设计与七步绞杀迁移路线（2026-08-22）。 |
| **桌宠 DSH 架构对齐** | [`companion-dsh-agent-architecture.md`](companion-dsh-agent-architecture.md) | 基于 DeepSeek Harness 架构的桌宠智能伴侣配置与工具全景。 |
| **桌宠双窗口设计** | [`companion-dual-window-design.md`](companion-dual-window-design.md) | Companion 角色/聊天真双窗口分离（方案 B2）设计与落地记录。 |

---

## 六、 疑难排查与历史故障演练 (Troubleshooting Archive)

> 位于 `docs/archive/troubleshooting/` 目录下，记录历史特定故障的「现象-根因-修复」与避坑要点。

| 文档名称 | 路径 | 核心内容与维护状态 |
| :--- | :--- | :--- |
| **样张流水线 11 大疑难** | [`archive/troubleshooting/showcase-pipeline-lessons.md`](archive/troubleshooting/showcase-pipeline-lessons.md) | 负面丢词、误判拦截、多角色漏判、顽固场景重构等根因与方案。 |
| **大文件下载镜像疑难** | [`archive/troubleshooting/download-mirror-lessons.md`](archive/troubleshooting/download-mirror-lessons.md) | ModelScope/HF 镜像测速、分段并发下载与校验流程（2026-08-21）。 |
| **hires 放大疑难留档** | [`archive/troubleshooting/comfy-superres-hires-fix-2026-08-20.md`](archive/troubleshooting/comfy-superres-hires-fix-2026-08-20.md) | hires 放大根因分析与 Remacri ESRGAN 真超分接入（2026-08-20）。 |
| **深链模式串位修复** | [`archive/troubleshooting/fix-log-popular-to-studio-deeplink-mode-leak.md`](archive/troubleshooting/fix-log-popular-to-studio-deeplink-mode-leak.md) | popular→studio 深链提示词串位疑难（2026-08-20）。 |
| **场景提示词一致性审计** | [`archive/troubleshooting/scene-prompt-consistency-audit-2026-08-20.md`](archive/troubleshooting/scene-prompt-consistency-audit-2026-08-20.md) | 场景预设与服装描述一致性审阅留档（2026-08-20）。 |
| **提示词组装审计修复** | [`archive/troubleshooting/prompt-assembly-audit-fixes.md`](archive/troubleshooting/prompt-assembly-audit-fixes.md) | `usePromptAssembly` 纯函数重构与多引擎分支修复记录。 |
| **棘手场景交接标注** | [`archive/troubleshooting/showcase-stubborn-scenes-2026-08-18.md`](archive/troubleshooting/showcase-stubborn-scenes-2026-08-18.md) | 8 个顽固场景 7 轮试错记录与交接方向（勿盲目重试）。 |
| **2026-08-16 架构体检** | [`archive/troubleshooting/audit-2026-08-16.md`](archive/troubleshooting/audit-2026-08-16.md) | 架构健康度全面体检、安全边界收敛与优化建议。 |
| **2026-08-14 漂移审计** | [`archive/troubleshooting/drift-audit-2026-08-14.md`](archive/troubleshooting/drift-audit-2026-08-14.md) | 契约与实现一致性审计报告。 |
| **ComfyUI 显存崩溃排障** | [`archive/troubleshooting/comfyui-dynamic-vram-crash.md`](archive/troubleshooting/comfyui-dynamic-vram-crash.md) | 动态显存分配崩溃排查与服务保活。 |
| **开发环境与 npm 修复** | [`archive/troubleshooting/dev-environment-fixes.md`](archive/troubleshooting/dev-environment-fixes.md) | Node/npm/pnpm 开发环境与 PATH 配置排错记录。 |
| **WebView2 缓存排查** | [`archive/troubleshooting/desktop-stale-archive-cache.md`](archive/troubleshooting/desktop-stale-archive-cache.md) | 桌面端 WebView2 数据层缓存穿透排查与 data-first 部署顺序保障。 |
| **Node 控制台隐藏修复** | [`archive/troubleshooting/desktop-node-console-window.md`](archive/troubleshooting/desktop-node-console-window.md) | 桌面 sidecar 后台静默启动与黑框控制台隐藏解决方案。 |
| **立绘边框留白修复** | [`archive/troubleshooting/character-portrait-frame-gap.md`](archive/troubleshooting/character-portrait-frame-gap.md) | 角色详情页立绘贴边与视口自适应修复。 |

---

## 七、 历史调研与竞品分析归档 (Research Archive)

> 位于 `docs/archive/research/` 目录下，记录前期的竞品体验、技术选型与调研横评。

| 文档名称 | 路径 | 核心内容 |
| :--- | :--- | :--- |
| **绘图体验优化方案** | [`archive/research/drawing-experience-optimization-plan.md`](archive/research/drawing-experience-optimization-plan.md) | 紧凑场景模式与专家模式双层交互设计方案。 |
| **对话 Prompt 与长期记忆** | [`archive/research/roleplay-prompt-memory-comparison.md`](archive/research/roleplay-prompt-memory-comparison.md) | 角色空间分层 Prompt、动态召回与记忆机制评估。 |
| **AI Roleplay 竞品深入调研** | [`archive/research/ai-roleplay-products-research-deep-dive.md`](archive/research/ai-roleplay-products-research-deep-dive.md) | 业界主流 AI 角色扮演产品架构与交互深度横评。 |
| **AI 生图 UI/UX 竞品调研** | [`archive/research/ai-image-ui-ux-research.md`](archive/research/ai-image-ui-ux-research.md) | Midjourney、NovelAI、Civitai 等生图工作台交互对比。 |
| **高阶工作流工具横评** | [`archive/research/research-advanced-workflow-tools-benchmark.md`](archive/research/research-advanced-workflow-tools-benchmark.md) | Dify、ComfyUI、Coze 等编排引擎基准测试。 |
| **桌宠 UI 交互调研** | [`archive/research/companion-ui-research.md`](archive/research/companion-ui-research.md) | 桌面伴侣界面形态与轻量交互调研。 |
| **桌面更新机制研究** | [`archive/research/desktop-update-research.md`](archive/research/desktop-update-research.md) | 增量快速部署与完整 NSIS 打包技术方案。 |

---

## 八、 静态 HTML 文档站页面 (Static Docs Portal)

`docs/` 目录下保留了一套供浏览器本地直接访问的轻量文档站（使用设计系统设计样式，通过 `tools/nav.js` 与 `theme.js` 驱动）：

- `index.html`：文档站首页
- `getting-started.html`：快速上手
- `philosophy.html`：设计哲学
- `art-direction.html`：美术风格与视效指导
- `quality-standard.html`：质量验收标准
- `roadmap.html`：长期路线图展示
- `scene-spec.html`：场景规范定义
- `tag-standard.html`：标签分类规范
- `worldview.html`：世界观与设定
- `page-template.html`：文档页面脚手架模板
