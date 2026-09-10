# 项目文档索引

日常只读下面八个入口；遇到具体问题再查专题。历史测试结果不能替代当前验收。

## 日常入口

| 文档 | 用途 |
| --- | --- |
| [项目说明](../README_zh.md) | 定位、安装与功能入口 |
| [设计规范](../DESIGN.md) | 品牌特色、主题与交互原则 |
| [项目状态](project-status.md) | 当前能力、数据规模与边界 |
| [未来规划](roadmap.md) | 待办、优先级与验收目标 |
| [统一工作流](workflow.md) | 现成命令与操作顺序 |
| [维护手册](maintenance.md) | 目录职责与常见维护 |
| [工程契约](engineering-contracts.md) | 模块、数据与生命周期约束 |
| [桌面部署](desktop-deployment.md) | 构建、同步、完整安装与 UAC |

协作执行规则单独见 [AGENTS.md](../AGENTS.md)。

## 按需查阅

- [项目评价与优化／修复清单](archive/audits/project-review-checklist-2026-09-10.md)：8.0/10 工程评价、14 项分级清单、3 类请求层问题的隔离复现及当前验收边界。
- [启动与排错](../STARTUP.md)：干净工作区启动、AI 服务端点、模型目录与本机凭据恢复。
- [项目评价复核与修复](archive/audits/project-evaluation-followup-2026-09-10.md)：19 项评价裁决、补充缺陷、当前修复与本次验证限制。
- [专题指南](guides/README.md)：角色与粒子、提示词、美术、视频、桌面、工程设计。
- [研究与候选方案](research/README.md)：调研依据与待评估提案。
- [历史记录](archive/README.md)：审计、批次、实验、故障与过期方案。
- [办公机工程债务治理](archive/audits/engineering-debt-2026-09-09.md)：页面拆分、任务恢复、测试门槛与本轮验收边界。
- [六维补充审计](archive/audits/remaining-dimensions-2026-09-09.md)：安全、数据、性能、可访问性、失败恢复与供应链检查。
- [网站体验审计](archive/audits/website-experience-2026-09-09.md)：九维体验评估、首页创作路径与上手指南优化、本轮验证和限制。
- [聊天与桌宠闭环修复](archive/audits/chat-functional-recovery-2026-09-09.md)：工具取消、看屏回传、断线保留、草稿恢复与本轮验证边界。
- [视频素材与作品导出审计](archive/audits/video-gallery-recovery-2026-09-10.md)：旧帧串用、重复生成、草稿就绪、下载格式与失败恢复。
- [剩余功能升级与全站回归](archive/audits/remaining-features-upgrade-2026-09-10.md)：备份保护、分镜 AI/重试/停止、保存快照与全站验收范围。
- [角色记忆、桌宠与打包专项](archive/audits/companion-knowledge-build-2026-09-10.md)：知识/记忆、提醒/好感度、参考卡、小窗布局与本机打包能力。
- [版本更新](releases/v1.6.1.md)：安装启动修复；[1.6.0](releases/v1.6.0.md) 与 [1.5.10](releases/v1.5.10.md) 保留为历史版本。
- [暂缓提案](../plans/README.md)：未启动的专项提案。
- [浏览器阅读入口](index.html)与[上手教程](getting-started.html)：面向使用者的静态手册。

## 文档放在哪里

| 目录 | 收录内容 | 维护规则 |
| --- | --- | --- |
| docs 根目录 | 上述日常入口与阅读门户 | 不追加单次报告 |
| guides/ | 可重复使用的专题指南 | 更新已有指南，注明历史段落 |
| research/ | 未采纳或待复核研究 | 执行优先级只写入 roadmap |
| archive/audits/ | 按日期记录的审计 | 保留失败项与原始验收边界 |
| archive/batches/ | 角色、场景接入批次 | 不把登记数量当成交付数量 |
| archive/completed/ | 已完成事项 | 只收录有完成依据的记录 |
| archive/troubleshooting/ | 故障与实验经验 | 保留可追溯的原因和证据 |
| evidence/ | 机器可读的审计证据 | 与报告链接对应，不重复抄入正文 |

新增文档登记到本页或对应分类索引。规模只在项目状态维护，待办只在规划维护。
移动文档需同步相对链接、脚本引用及 `redirects.json` 中的旧站内地址，并运行 `npm run wf -- docs:check`。
