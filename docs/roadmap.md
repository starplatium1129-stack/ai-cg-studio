# 项目未来规划

> 2026-09-08。只列待办、待复验与待决策事项；已完成记录见 [归档](archive/README.md)。优先级表示建议次序，不代表已启动或承诺交付日期。

| 优先级 | 事项与当前证据 | 下一步 | 验收条件 |
| --- | --- | --- | --- |
| P0 | 数据与发布可靠性：办公机工程治理与验证见[9-09 记录](archive/audits/engineering-debt-2026-09-09.md)；参考素材按用户安排留给主力机 | 主力机在默认文件核验模式下重跑完整质量门，核对参考 URL、pending 与发布 manifest | 默认模式完整门禁通过；资产发布后网关与桌面读取同一 manifest |
| P2 | 按用户安排，角色数据先接入，立绘、参考库与样张后补；规模见项目状态 | 按角色 ID/outfit ID 对账，复用 reference:render/reference:design 补齐第五至九批等待补形态，定向视觉审核 | 每个声明完成的形态具备 7 视角、可访问 URL 与审核证据，不把占位算完成 |
| P2 | ONNX 安装依赖 `adm-zip` 存在一项未有修复版的上游漏洞，npm 报两条中危依赖告警；见[六维审计](archive/audits/remaining-dimensions-2026-09-09.md) | 上游提供兼容修复版后复验安装与推理，再升级 | 依赖告警消除，主力机安装和推理无回归 |
| P1 | 故事与提示词对齐仍有待决策项 | 以 story-alignment-audit-2026-09-06.md 为线索重新核对当前数据与已发布样张，区分误报、真实问题和定稿保护 | 逐条编译 Token 与真实画面对齐；批量改写完整性与 pinned 门禁通过 |
| P1 | 桌宠工具取消、看屏图片回传与断线恢复已修复并通过模拟回归，见[本轮记录](archive/audits/chat-functional-recovery-2026-09-09.md)；真机与已启动原生命令终止仍待验收 | 在当前兼容 API 与桌面环境验证看屏、语音和取消；补齐原生操作终止能力 | 真实设备端到端完成；关闭、取消和异常释放资源；沿用网关授权 |
| P2 | 视频基础创作链路已实现，剧本丰富度与成片一致性仍可深化 | 先核对现有剧本/蓝图分幕能力，再小批补剧本；超分、Wan 增强独立测显存与耗时 | 首帧、镜头、对白、成片可追踪，失败可恢复；新模型有固定 seed 实测 |
| P2 | 桌宠情绪/好感度已有基础，日程小剧场与演出数据化待深化 | 复用 affection、speech、Live2D 生命周期，增加受控事件绑定 | 勿扰/安静时段生效，空闲低功耗，动作许可与音画同步无回归 |
| P2 | 角色背景故事已有数据，检索增强覆盖未有全量验收 | 先做 bg_story 与来源缺口清单，再试点角色知识召回 | 来源可追踪、角色不串设定、可撤销记忆，延迟与资源占用有实测 |
| 待决策 | Qwen-Image-Edit / SAM3；仓库未发现对应生成接线，旧报告的本机权重与显存结论未复验 | 先检查实际设备、磁盘、模型来源和兼容性，再决定下载与接线 | 社区来源 → 固定样张复现 → 受控网关 → 契约 → 真机转正 |
| 待决策 | Krea2 高级增强、PromptWeight 与 StyleReference | 区分本地节点和可能上传图像的云 API，先核对依赖与数据流 | 成本、数据去向与收益明确，固定样张对比优于现行基线 |
| 暂缓 | 反推满意图入场景（plans/004）此前因显存竞争暂缓 | 保留原决策，明确新需求或资源条件后重估 | 复用保存到项目流程，有完整故事字段与可追踪数据版本 |

## 执行顺序与收口

先处理 P0 的验收可靠性，再做 P1 的内容与用户闭环，最后评估 P2 与新模型。每项完成后把证据放到 archive/completed 或 archive/audits，从此表移除；混合报告归档不代表其中所有问题已解决。

详细底稿：[工程优化审计](archive/audits/optimization-report-2026-09-05.md)、[故事对齐清单](archive/audits/story-alignment-audit-2026-09-06.md)、[角色候选](research/characters/future-popular-characters-candidate-plan.md)、[场景与 DNA 规划](research/characters/character-scenes-and-dna-overhaul-plan.md)、[语音历史规划](archive/research/companion-voice-roadmap.md)、[画质历史规划](archive/research/prompt-image-quality-roadmap.md)、[暂缓提案](../plans/004-scene-save-from-interrogate.md)。

## 历史记录中的待复验事项

以下是进入原始证据的入口，不新增并行任务，也不把旧失败直接判为当前缺陷。先复现，再更新上表。

- 场景审计的暂停检查点、正史/画面审核与新批次对账：[全场景台账](archive/audits/all-scene-audit-2026-09-08.md)。
- 新角色样张、参考图与服装 pending：[批次记录索引](archive/README.md#batches)。
- 存量内容校验、备份/素材和本机验收：[项目审计](archive/audits/project-audit-2026-09-08.md)、[功能审计](archive/audits/feature-experience-audit-2026-09-08.md)。
- 原生桌面安装、窗口/托盘和真实音频回归：[桌面个性化记录](archive/audits/desktop-personalization-audit-2026-09-08.md)、[Live2D 运行时](guides/desktop/live2d-native-runtime.md)。
- 粒子肖像继续保留；调参或接入新角色时沿用[粒子管线指南](guides/characters/particle-portrait-pipeline.md)，不要因旧文档曾归档而撤下该功能。
