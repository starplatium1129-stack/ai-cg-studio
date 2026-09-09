# 提示词 Skill 调研与修订依据

核查日期：2026-09-09。范围为 studio-prompt-craft 的通用创作、双引擎适配和验证规则；本轮不修改角色、服装或场景生产数据。

## 官方证据

| 来源 | 核查结论 | 对 skill 的影响 |
| --- | --- | --- |
| [Anima 官方模型卡](https://huggingface.co/circlestone-labs/Anima#prompting) | 支持标签、自然语言及混合；普通标签建议空格，score 标签保留下划线；Base 与 Aesthetic 的质量词建议不同；权重示例超过 1.5 | 删除“只认下划线标签”“统一评分前缀”“1.5 模型极限”；实际使用仍按 checkpoint 和项目 profile |
| [Krea 官方提示指南](https://github.com/krea-ai/krea-2/blob/main/docs/prompting.md) | 推荐自然语言，详细描述有用，也展示短提示与短语示例；画面文字建议加引号 | 保留项目 prose 输出契约，删除最小字符数与“短语必定破坏画面”的因果断言 |
| [Krea 官方推理仓库](https://github.com/krea-ai/krea-2#usage) | RAW 示例为 52 步 / cfg 3.5；Turbo 示例为 8 步 / cfg 0，关闭 CFG | 空负向限定当前本地路径；官方数值仅作版本示例，不覆盖项目参数 |
| [Diffusers Krea2 文档](https://huggingface.co/docs/diffusers/api/pipelines/krea2) | 支持 negative_prompt；其 guidance 使用 cond + scale × (cond − uncond)，scale > 0 开启 | 区分实现中的 CFG 约定，不把所有界面的 0 / 1 当成同一含义 |

以上来源在本轮直接打开核查。官方 Anima 卡属于当前上游版本，不证明本地 MiaoMiao checkpoint 采用完全相同配方；不能拿上游建议直接批改存量数据。未采用搜索结果中的第三方经验作为硬规则。

## 本地实现证据

- `src/utils/promptPolicy.ts`：`formatAnimaToken` 保护 score、exact tokens / prefixes，然后转换普通下划线；负向按能力和 profile 组装。
- `src/utils/promptCompiler.ts`：Anima 标签后可追加 `buildAnimaVisualDirection`；Aesthetic profile 可去质量词；自然语言分支清洗 prose 并返回空 negative。
- `src/utils/popularContent.ts`：角色、衣装、蓝图及导演信息共同构建 PromptPlan；上层 Anima 单独组装负向。因此不能把底层返回值误当全链路行为。
- `src/composables/prompt/usePopularPromptAssembly.ts`：热门无 LoRA 路径与固定角色路径分离，接收当前服装、蓝图和参数。
- `scripts/lib/scene-render-contract.js`：独立场景复用真实镜头过滤与负向组装，检索 tags 不自动变成模型输入。

## 修订决策与证据边界

1. 用“模型能力 / 项目约束 / 待实测建议”区分规则来源，去掉写死角色数量和服装速查表，转向当前数据。
2. 用可见事实、属性归属、接触关系和最终请求核对替代抽象赞美与机械堆词。属于可检查的创作方法，不宣称已经测出画质增益。
3. 取消所有任务都必须输出双引擎、固定战斗/日常/成人配额、强制坐卧与横竖尺寸、固定主体百分比和“面部放大 2.5 倍”等无本轮实验证据的规则。尊重具体任务；共享蓝图仍需核对双引擎。
4. 保留分级、定稿、逐条改写与真实出图要求；删除自动扩写露骨内容的配方。参考图、图生图和局部编辑的能力按实际工作流核实。
5. 历史 `krea2-prompt-writing-guide.md` 与 8 月调研仍是背景材料；其中固定规模、无条件质量论断和节点参数不能覆盖本轮核对的源码与官方说明。本轮不扩改这些历史文档。

## 后续可复现实验

用授权的全年龄候选，不发布、不触碰定稿：选择一个手部道具互动场景、一个全身服装场景和一个环境叙事场景。每个场景先选单一因素，如“纯标签 vs 标签加空间描述”，固定模型/LoRA/尺寸/采样参数/加速设置，以同一组至少 3 个 seed 成对比较。

逐图检查身份、衣装、动作与接触、人数与肢体、镜头、背景和整体表达；保留所有输出及失败记录，避免只选最好的一张。只有通过真实图片复核，才能把该 checkpoint 的经验升级为默认建议。试验规模属于建议，不是统计显著性保证。

## 本轮验收范围

本轮修改的是 skill 指令与文档索引，没有改生产提示词、蓝图、模型参数或运行时代码；不生成测试图片，也不声称画质已提升。结构校验、链接检查与项目门禁结果以本次实际运行和交付说明为准；后续出图实验尚未执行。

本次实际结果：skill-creator 的 quick_validate 通过；skill 到调研记录的相对链接存在；git diff --check 与暂存后 repository text hygiene 通过；修复新增文档 LF 换行后，gate:full 重跑通过（21 步质量编排、Vitest、430 个 unit 用例、25 组 contract、build/预算，总耗时约 1 分 54 秒）。校验依赖 PyYAML 仅安装在被忽略的 scripts/archive/prompt-skill-validation-deps。原 .agents 目录被忽略，本轮仅将目标 SKILL.md 精确纳入版本管理。
