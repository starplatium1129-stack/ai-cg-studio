---
name: studio-prompt-craft
description: 为 AI-CG-Studio 编写、转译、扩写和审查 Anima / Krea 2 图像提示词；处理角色身份、服装、场景蓝图、镜头与最终编译结果的一致性。适用于提示词数据与生成质量任务，不用于视频提示词或普通 UI 修改。
---

# Studio Prompt Craft

先保持用户要表达的画面，再按实际模型与项目编译契约组织语言。不要用固定题材配额、字数或装饰词替代内容判断。

## 开始前

1. 确认任务是创意草稿、单条修正、批量重写、换装还是参考图描述；仅输出用户需要的引擎。维护共享蓝图时核对双引擎。
2. 读取项目 `docs/workflow.md`，核对 Git 改动与受保护定稿。数据写回分片源，不能直接改聚合文件。
3. 确认模型 ID、checkpoint 版本、LoRA、profile、画幅、参考图用途。Anima Base / Aesthetic / Turbo / MiaoMiao 以及 Krea RAW / Turbo / 托管版本不能互相套用参数。
4. 从当前角色、服装和蓝图数据读取身份与 ID，不复制历史速查表。热门无 LoRA 路径与宁宁/夏目 LoRA 路径分开，精确触发词不能改写。

证据与版本差异见 [调研记录](../../../docs/prompt-skill-research-2026-09-09.md)。需要查模型能力或处理旧规范冲突时再读；项目字段约束另见 `docs/engineering-contracts.md`。

## 把创意转换为可见事实

先列最少必要信息：主体及数量、身份锚点、当前服装、主动作及接触对象、视线/表情、场景关键物、镜头/画幅、光源和媒介。缺项可做轻量合理补充，不能擅自改变人数、关系、服装、分级或用户指定构图。

- 把抽象心情转成表情、姿势或互动；对白不自动变成画面文字。需要文字时保留原文并明确位置。
- 一帧选择一个主动作，写清谁的哪只手接触什么、物体放在哪里。多人时逐一绑定外貌、位置和动作，不给多人请求追加 `solo` 或排除另一角色的负面词。
- 身份只承载稳定特征；服装、环境、动作进入各自字段。已换装时清掉旧服装冲突，保留生物特征和精确触发词。
- 镜头按任务选：头像优先表情，全身服装图保留衣装边界，环境叙事允许人物较小。站姿、坐姿和横竖画幅都按场景选择，没有通用的主体占比或防畸变比例。
- 保留用户要求和角色专属细节，删除重复、互相矛盾及不可见的赞美。复杂场景可以更长，简单场景可以简短；字符数不是编码器 Token 数。

## Anima：数据标签与模型输入分开

项目源数据可以保留下划线标签；最终普通标签由 `formatPromptForEngine` 转成空格。`score_N`、注册 exact tokens / prefixes 和 LoRA 控制词按编译器保护，不能全局替换下划线。

官方支持标签、自然语言及混合输入。项目 Anima 编译也会在标签之后追加画面描述；复杂动作和空间关系可由该描述补全，不要声称 Anima 只认标签。

- 质量词以实际 profile 为准；`strip_quality_tokens` 启用时不补回。不要通用追加 `score_9, score_8_up`，Base 建议不等于 Aesthetic 或 MiaoMiao 建议。
- 权重是节点/解析器与 checkpoint 的联合行为，不把 `1.5` 写成模型极限。默认保持已有已验证值；要调整就单变量实测，检查括号与精确词保护。
- 负向从调用链的最终结果核对：底层 `renderPromptPlan` 的 Anima 返回空负向，上层仍可能用 `assembleNegative` 组装。不能据此断言整个引擎没有负向，也不要手工重复注入长模板。
- 针对实际失败补负向，先排查正向矛盾。要求全身时避免裁切，要求头像时不要机械加入 `cropped`；负向不保证修好手部。

## Krea 2：具体自然语言

项目输出使用英文自然语言，清除 Danbooru 堆词、括号权重与质量评分词。这是当前编译契约；官方推荐自然语言不等于模型完全不能处理短语。

按画面需要组织：媒介与主体 → 身份/服装 → 动作与空间关系 → 环境与光影 → 镜头。无需每次重复全部维度，也不强制 300–500 字符或最低 200 字符。

- `identityProse`、服装 `prose`、蓝图 `promptProse` 和导演设置共同组装最终输入；`promptProse` 不是唯一正向来源。
- 本地当前分支 `negative = ''`。RAW / 托管版本的能力需单独确认，不能仅为写负面词而改 CFG 或安装自定义节点。
- 排除项优先表达为清晰的目标状态，例如 `a single person in an empty room`。只添加与请求一致的排除项；单人图不能追加 `no characters`，需要招牌文字时不能追加 `no text`。
- 官方参考代码的 CFG 数值与 ComfyUI 节点可能采用不同约定。核对实际工作流，不照抄数值。
- 原生编辑、图生图、参考图与重绘遮罩不是同一能力。先确认接入方式；描述希望改变的对象及需保留部分，遮罩和合成保真由工作流实现。

## 字段与编译核对

| 层 | 要核对的内容 |
| --- | --- |
| 角色 | `identityTokens` / `identityProse`、原作、稳定外貌、exact tokens |
| 服装 | 当前 `outfitId` 与 `outfits[].tokens/prose` 一致，避免身份字段泄漏旧衣装 |
| 蓝图 | `description` / `action` 的可见核心分别进入 `promptTokens` / `promptProse`，按实际 schema 写字段 |
| 导演 | 镜头、光照、构图、`recommendedSize` 和模型参数不互相覆盖冲突 |
| 最终请求 | 完整 positive / negative、模型/LoRA、seed、尺寸、采样参数及参考输入 |

代码入口：`src/utils/popularContent.ts`、`src/composables/prompt/usePopularPromptAssembly.ts`、`src/utils/promptCompiler.ts`、`src/utils/promptPolicy.ts`；独立场景检查复用 `scripts/lib/scene-render-contract.js`。

分级沿用项目字段及 `adultEnabled = isLocalStudioHost()` 边界；远程、未知或未授权状态 fail-closed。不要为完成场景数量自动增添成人内容，不把分级标记当作人物成年依据。该 skill 提供全年龄创作与中性的分级/一致性审查，不提供露骨性描写的扩写配方。

## 验证与交付

- **草稿**：标明目标引擎、必要假设、提示词及负向策略；没有真实运行就写“未编译/未出图”，不能称最终请求。
- **实际数据变更**：检查最终编译内容并真实出图，核对身份、衣装、动作/接触、人数/肢体、构图和环境。静态通过、生成成功或 UI 文案都不是视觉通过。
- **批量重写**：逐条真实改写并用 `node scripts/tests/test-prompt-rewrite-integrity.js --delivery <文件>` 验收。单点纠错如使用 `--targeted`，明确范围，不冒充全量重写。
- **定稿**：批量跳过 `data/prompt-pinned-scenes.json` 的保护字段。单条修改按项目要求先真实出图再 `npm run scenes:pin-capture`。
- **规则实验**：保持 checkpoint、LoRA、尺寸、采样器、步数及加速设置一致，用同一组固定 seeds 对比；一轮只改一个因素。建议先用 3 个 seed 小样筛查，不能据此推断全库效果。
- **记录**：保留候选清单、最终请求、参数和输出路径，逐图标记问题；区分生成失败、视觉未通过和未审核。只有实际查看过的图才能计为视觉审核。

交付说明列出改动条目、依据、当次执行的检查、出图证据与未完成项。只修改 skill 文档时做结构、链接和规则一致性检查，不把文档验收宣称为生成质量提升。
