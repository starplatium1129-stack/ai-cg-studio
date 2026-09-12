# Studio Prompt Craft 指南（已收口）

> 本页保留旧链接兼容，不再作为 AI 执行规范。
>
> 当前唯一的项目级执行规则见：[`../../../.agents/skills/studio-prompt-craft/SKILL.md`](../../../.agents/skills/studio-prompt-craft/SKILL.md)。
> 模型能力、参数差异与本轮修订依据见：[`../../research/prompts/prompt-skill-research-2026-09-09.md`](../../research/prompts/prompt-skill-research-2026-09-09.md)。

## 为什么收口

旧版本文曾同时承担创作经验、模型参数、场景配比、角色速查和执行规则，随着 Anima / Krea 2 接入与项目编译器演进，其中一部分固定规则已经过时或与当前实现冲突。继续把它作为“铁律”会造成重复上下文和双规范问题。

当前规则采用以下原则：

- 用户当前明确目标优先于历史经验模板；
- 先核对实际模型、checkpoint、profile、LoRA 与项目编译结果，不跨版本套参数；
- 不使用固定题材配比、固定字符数、固定主体比例或统一质量词替代内容判断；
- Anima 的标签、自然语言、权重与 negative 以当前 profile 和实际调用链为准；
- Krea 2 的 prose、negative 与 CFG 以当前本地/托管路径为准；
- 涉及生产数据时按仓库工作流验证，纯草稿和解释不机械启动完整工程门禁；
- 真实出图、定稿保护和安全边界仍按 `AGENTS.md` 与当前 skill 执行。

## 历史内容如何使用

如果需要追溯旧版创作方法、场景设计理念或曾经采用的参数，请从 Git 历史查看本文件旧版本。历史内容只能作为研究材料，不能覆盖当前 `SKILL.md`、当前实现、当前工作流或用户本次明确要求。

如发现 `SKILL.md`、当前实现与上游模型文档之间存在冲突，先记录具体冲突和证据，再更新调研记录与 skill；不要在本页重新建立第二套执行规则。
