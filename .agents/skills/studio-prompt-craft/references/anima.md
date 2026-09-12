# Anima：数据标签与模型输入分开

项目源数据可以保留下划线标签；最终普通标签由 `formatPromptForEngine` 转成空格。`score_N`、注册 exact tokens / prefixes 和 LoRA 控制词按编译器保护，不能全局替换下划线。

官方支持标签、自然语言及混合输入。项目 Anima 编译也会在标签之后追加画面描述；复杂动作和空间关系可由该描述补全，不要声称 Anima 只认标签。

人物与环境叙事优先按 [构图参考](narrative-composition.md) 建立可见关系，再核对关系是否保留在最终标签和描述中，不靠通用“完成度”尾句替代具体构图。

- 质量词以实际 profile 为准；`strip_quality_tokens` 启用时不补回。不要通用追加 `score_9, score_8_up`，Base 建议不等于 Aesthetic 或 MiaoMiao 建议。
- 权重是节点/解析器与 checkpoint 的联合行为，不把 `1.5` 写成模型极限。默认保持已有已验证值；要调整就单变量实测，检查括号与精确词保护。
- 负向从调用链的最终结果核对：底层 `renderPromptPlan` 的 Anima 返回空负向，上层仍可能用 `assembleNegative` 组装。不能据此断言整个引擎没有负向，也不要手工重复注入长模板。
- 针对实际失败补负向，先排查正向矛盾。要求全身时避免裁切，要求头像时不要机械加入 `cropped`；负向不保证修好手部。
