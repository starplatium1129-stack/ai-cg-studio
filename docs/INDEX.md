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

- [专题指南](guides/README.md)：角色与粒子、提示词、美术、视频、桌面、工程设计。
- [研究与候选方案](research/README.md)：调研依据与待评估提案。
- [历史记录](archive/README.md)：审计、批次、实验、故障与过期方案。
- [办公机工程债务治理](archive/audits/engineering-debt-2026-09-09.md)：页面拆分、任务恢复、测试门槛与本轮验收边界。
- [版本更新](releases/v1.5.10.md)：按发布版本保留的说明。
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
