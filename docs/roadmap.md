# 项目未来规划

> 更新于 2026-09-12。只列待办、待复验与待决策事项；已完成记录见 [归档](archive/README.md)。优先级表示建议次序，不代表已启动或承诺交付日期。

办公机本轮已完成原生工具取消的代码链路、低频面板按需加载、首次入册反馈、主动脱敏诊断、受控桌宠演出及 V1 浏览器复验；O3／O5／O6 与 V1 从待办表移除，证据见[办公机收尾记录](archive/audits/office-code-2026-09-11.md)。真实模型、参考素材及已安装桌面程序的验收继续保留。

9-12 独立审计问题的代码修复与验证状态见[修复记录](archive/audits/office-audit-fixes-2026-09-12.md)。主力机仍需默认素材模式完整检查、真实出图及已安装 WebView 的麦克风、Web Locks、取消释放复验；升级后刷新旧窗口。通用命令默认为关闭，确需使用时由操作员明确选择受信任执行档，不能把它作为工作区沙箱验收。

| 优先级 | 事项与当前证据 | 下一步 | 验收条件 |
| --- | --- | --- | --- |
| P0 | 数据与发布可靠性：办公机工程治理与验证见[9-09 记录](archive/audits/engineering-debt-2026-09-09.md)；参考素材按用户安排留给主力机 | 主力机在默认文件核验模式下重跑完整质量门，核对参考 URL、pending 与发布 manifest | 默认模式完整门禁通过；资产发布后网关与桌面读取同一 manifest |
| P2 | 按用户安排，角色数据先接入，立绘、参考库与样张后补；规模见项目状态 | 按角色 ID/outfit ID 对账，复用 reference:render/reference:design 补齐第五至九批等待补形态，定向视觉审核 | 每个声明完成的形态具备 7 视角、可访问 URL 与审核证据，不把占位算完成 |
| P2 | `adm-zip` 已按 ONNX 现有兼容范围从 0.6.0 升至 0.6.1，本轮完整／生产依赖审计均无告警，普通解压和目标目录链接拒绝已测试；见[办公机收尾记录](archive/audits/office-code-2026-09-11.md) | 主力机复验完整安装与实际推理；办公机升级未执行安装生命周期脚本 | 安装及推理无回归，不把依赖审计零告警当作真机验收 |
| P1 | 故事与提示词对齐仍有待决策项 | 以 story-alignment-audit-2026-09-06.md 为线索重新核对当前数据与已发布样张，区分误报、真实问题和定稿保护 | 逐条编译 Token 与真实画面对齐；批量改写完整性与 pinned 门禁通过 |
| P1 | 桌宠工具取消已贯通生产桥接脚本、HTTP 断开和网关进程树，办公机真实父子进程回归通过；看屏图片回传与断线恢复沿用[已有修复](archive/audits/chat-functional-recovery-2026-09-09.md)，补充证据见[办公机收尾记录](archive/audits/office-code-2026-09-11.md) | 在已安装桌面程序及当前兼容 API 上复验看屏、麦克风、语音、取消和异常释放 | 真实设备端到端完成，资源释放与网关授权无回归 |
| P2 | 视频素材/草稿已修复，见[素材审计](archive/audits/video-gallery-recovery-2026-09-10.md)；分镜 AI、批量重试和首帧停止已补齐并通过模拟验证，见[全站升级](archive/audits/remaining-features-upgrade-2026-09-10.md)；真实成片与剧本丰富度仍待深化 | 真机复验首尾帧、重复生成和停止，再小批补剧本；超分、Wan 增强独立测显存与耗时 | 首帧、镜头、对白、成片可追踪，失败可恢复；新模型有固定 seed 实测 |
| P2 | 桌宠问候、空闲及服务／入册事件已数据化绑定现有表情和语音生命周期，并覆盖勿扰、输入优先和音频所有权；见[办公机收尾记录](archive/audits/office-code-2026-09-11.md) | 已安装程序验证事件、语音、动作同步及闲置功耗；更丰富的剧情内容另行编写和验收 | 勿扰／安静时段生效，不打断用户聊天与重播，动作许可和音画同步无回归 |
| P2 | 角色设定加载、长背景召回、旧格式身份与记忆持久化已优化；全量字段核对有 6 份喜好为空，见[专项记录](archive/audits/companion-knowledge-build-2026-09-10.md) | 按来源补齐缺失内容，并验证真实 LLM 的角色一致性、召回效果和延迟 | 来源可追踪、角色不串设定、可撤销记忆，延迟与资源占用有实测 |
| 待决策 | Qwen-Image-Edit / SAM3；仓库未发现对应生成接线，旧报告的本机权重与显存结论未复验 | 先检查实际设备、磁盘、模型来源和兼容性，再决定下载与接线 | 社区来源 → 固定样张复现 → 受控网关 → 契约 → 真机转正 |
| 待决策 | Krea2 高级增强、PromptWeight 与 StyleReference | 区分本地节点和可能上传图像的云 API，先核对依赖与数据流 | 成本、数据去向与收益明确，固定样张对比优于现行基线 |
| 暂缓 | 反推满意图入场景（plans/004）此前因显存竞争暂缓 | 保留原决策，明确新需求或资源条件后重估 | 复用保存到项目流程，有完整故事字段与可追踪数据版本 |

## 2026-09-10 项目复核新增待办

依据：[项目评价与优化／修复清单](archive/audits/project-review-checklist-2026-09-10.md)；[机器复现证据](evidence/project-review-2026-09-10.json)；办公机修复与门禁复核见[请求层修复记录](archive/audits/request-layer-repair-2026-09-10.md)。初始代码基线为 `1106904`，数据源合并 `576e0e1`。R1／R2／R3／O1／O2／O4 已在办公机修复并回归（`DATA_VERSION` 同步），定稿保护漂移 35/100 已按用户决定回滚至字节基线（`pinned gate OK: 100`，证据见同一条记录）；下表只保留仍未完成项，未完成项不因本轮文档交付而记为通过。

| ID／优先级 | 当前状态与事项 | 下一步 | 验收条件 |
| --- | --- | --- | --- |
| P1 | 内容门禁已按[本轮记录](archive/audits/content-gate-repair-2026-09-10.md)修复并通过结构模式完整回归；11 条新增服装覆盖场景与两处环境词迁移尚未真实出图 | 主力机按证据 ID 生成候选，人工看图继续后置；原 467 条语义审计保持用户要求的暂停状态 | 编译与真实模型参数匹配，人工决定和发布分别留痕，默认素材模式验收通过 |
| P2 | 办公机本地工具限制：① 已修复——`pin-scene-prompts.js` 新增 `--source=auto\|baseline\|history`，浅克隆下 `--report` 降级为基线并打印提示、`--apply` 拒写盘、`--capture` 沿用既有基线的成员与来源（7 条单测；本机 `--report`／`--check`／`--capture` 可运行，`--apply` 给出明确拒绝）② 本轮 `test-control-failure-contract.js` 在本机已通过，主力机仍未复验 | ① 需要逐条来源比对或按基线回滚时用 `--source=baseline`，恢复完整历史后再走 `history`；② 在主力机复验 | ① 满足：三种模式在本机可运行或有明确降级提示；② 该契约文件在主力机与办公机均通过 |

报告中 C1 对应上表原有故事／提示词任务：pinned 场景已按基线回滚，后续逐条编译对账继续按 ID 记录差异，人工看图仍后置，未看图不记为视觉通过。C2 对应角色／素材及批次对账：`576e0e1` 已合并的 16 蓝图／4 服装批次不再记为草稿，但数量与审核状态须重建后逐 ID 核对，不能仅凭合并说明认定全部验收。聚合数据是被忽略的生成物，不要求提交它们；`DATA_VERSION` 已按当前产物同步，后续改数据仍须重建并复核。

V2 沿用原 P0 的发布前默认素材验收，V3 沿用原 P1 的原生取消／语音与桌面验收，不另开重复任务。R1 与同模块回归已在办公机收口，定稿保护的处置也已写入记录；内容门禁与补丁保护的工程回归已收口，原场景审计保持暂停，候选出图与素材／真机验收在既定环境进行。本轮没有启动 GPU 或安装程序。

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
