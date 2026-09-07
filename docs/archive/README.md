# 历史记录索引

历史文件保留当时结论和证据，不是现行规范；归档不代表遗留问题全部解决。当前入口：[项目状态](../project-status.md) · [未来规划](../roadmap.md) · [主索引](../INDEX.md)。

## 已完成与整理前快照

- [手绘图标逐枚升级](completed/icon-refinement-2026-09-08.md)

- [非主机代码修复与验证](completed/code-only-repairs-2026-09-08.md)

- [001 — 修复高频交互的合成层性能](completed/001-interaction-compositor-fixes.md)
- [002 — 补齐导演台状态交接与退出反馈](completed/002-director-workflow-continuity.md)
- [003 — 收敛动效令牌并保留 reduced-motion 反馈](completed/003-motion-accessibility-tokens.md)
- [协作指南整理前快照](completed/agents-baseline-2026-09-08.md)
- [useLive2D 组合式函数模块化拆分计划（研究报告）](completed/live2d-composable-refactor-plan.md)
- [AI-CG-Studio 2026-08-31 历史状态](completed/project-status-2026-08-31.md)

## 审计快照（可能含未闭环项）

- [莱万汀还原提示词调研 + 8 角色 42 场 SFW 竖版修复](audits/audit-laevatain-and-7char-sfw-2026-09-01.md)
- [莱万汀调研复核（真相订正版）+ 7 角色 48 场 SFW 评审 + 5 场 P0 中英混杂修复](audits/audit-laevatain-recheck-2026-09-01.md)
- [8 位新热门角色 SFW 场景提示词检查报告](audits/audit-new8-sfw-prompts-2026-09-01.md)
- [角色 4 视角参考图待精调待办归档清单 (Pending Audit & Fine-Tune Backlog)](audits/character-reference-audit-pending.md)
- [桌面 UX 审计与优化 · 2026-09-07](audits/desktop-ux-audit-2026-09-07.md)
- [亮色主题、角色工作区与后端审计](audits/light-workspaces-backend-audit-2026-09-07.md)
- [AI-CG-Studio 产品与运营全维审计报告（2026-08-29）](audits/product-operations-audit-2026-08-29.md)

## 历史研究与旧路线

- [顶级 AI 创作与生图平台交互调研 & AI-CG-Studio 对标建议](research/ai-image-ui-ux-research.md)
- [AI 角色互动产品深度调研：「设计师 / 交互工程师 + 情感计算」视角](research/ai-roleplay-products-research-deep-dive.md)
- [Companion 桌宠界面布局调研（2026-08-15）](research/companion-ui-research.md)
- [桌宠语音与演出增强路线（吸收 ZcChat2 精华）](research/companion-voice-roadmap.md)
- [桌面端更新机制调研（2026-08-14）](research/desktop-update-research.md)
- [AI-CG-Studio 绘图使用体验优化方案（均衡方案 C）](research/drawing-experience-optimization-plan.md)
- [AI-CG-Studio 高质量出片 Prompt 与横竖构图升级方案](research/prompt-image-quality-roadmap.md)
- [先进 AI 工作流／提示词工坊／模型调试工具深度调研，及对 AI-CG-Studio 的落地构想](research/research-advanced-workflow-tools-benchmark.md)
- [角色扮演提示词与记忆系统对比方案](research/roleplay-prompt-memory-comparison.md)

## 故障排查记录

- [全库深度审计 2026-08-16](troubleshooting/audit-2026-08-16.md)
- [角色档案立绘框与立绘之间的大片空白](troubleshooting/character-portrait-frame-gap.md)
- [疑难留档：hires 放大「奇怪」根因与 Remacri 接入（2026-08-20）](troubleshooting/comfy-superres-hires-fix-2026-08-20.md)
- [ComfyUI DynamicVRAM 卡死疑难留档（2026-08-17）](troubleshooting/comfyui-dynamic-vram-crash.md)
- [桌面端 node.exe 控制台黑窗](troubleshooting/desktop-node-console-window.md)
- [桌面端角色档案过时（缓存污染）排查留档](troubleshooting/desktop-stale-archive-cache.md)
- [开发环境修复与 E2E 基线记录（2026-08-16）](troubleshooting/dev-environment-fixes.md)
- [ModelScope 大文件并发分段下载疑难（2026-08-21 留档）](troubleshooting/download-mirror-lessons.md)
- [文档漂移审计报告（2026-08-14）](troubleshooting/drift-audit-2026-08-14.md)
- [疑难留档：popular→studio 深链提示词串位（2026-08-20）](troubleshooting/fix-log-popular-to-studio-deeplink-mode-leak.md)
- [词条组装审计修复记录（2026-08-15）](troubleshooting/prompt-assembly-audit-fixes.md)
- [场景提示词一致性审阅与修复留档（2026-08-20）](troubleshooting/scene-prompt-consistency-audit-2026-08-20.md)
- [场景「故事 vs 提示词」一致性审计报告（2026-08-26）](troubleshooting/scene-story-prompt-audit-2026-08-26.md)
- [场景/蓝图「故事 vs 提示词」全量修复交付报告（2026-08-27）](troubleshooting/scene-story-prompt-fix-report-2026-08-27.md)
- [样张流水线疑难解决记录（2026-08-15）](troubleshooting/showcase-pipeline-lessons.md)
- [2026-08-18 棘手场景交接标注（供他人优化，勿再盲目重试）](troubleshooting/showcase-stubborn-scenes-2026-08-18.md)
- [视频提示词链路（出图 → 视频）设计与疑难留档](troubleshooting/video-prompt-chain.md)

## 已被取代的方案

- [Model and ComfyUI Expansion Roadmap](expired/model-comfyui-expansion-roadmap.md)
- [角色点阵粒子管线（操作手册）](expired/particle-portrait-pipeline.md)
- [桌面端 Tauri 2 当前架构与发布边界](expired/tauri-desktop-migration-plan.md)
- [本地 AI 视频创作路线](expired/video-generation-roadmap.md)
- [绫季绘境视觉与架构改进路线](expired/visual-architecture-roadmap.md)
