# NSFW 场景全库审计与优化（2026-09-09）

> 历史记录：本文保留原始结论与验证边界，归档不表示遗留事项已经完成。当前优先级见 [未来规划](../../roadmap.md)。

本轮在独立工作树中审计成人蓝图，最终与 SFW 审计分支整合后共有 657 条，覆盖 158 个已明确具备 `adultEligibility: adult` 的角色。未修改 `data/prompt-pinned-scenes.json` 所保护的 100 条场景，也未改变任何角色的成年资格。

## 结果

- 以 30、30、30、30、11 个角色分为五批，修复短散文、未成年/校园语义、旧双人体位与多人 Token、Krea 标签串、成人负面词冲突及画幅轴向问题。
- 初始五批相对基线共有 425 条成人蓝图发生受控变化；合并后新增的 4 条问题蓝图亦完成逐条修复，非成人蓝图未被本轮 NSFW 修复触及。
- 325 条 Krea `promptProse` 完成逐条改写，当前 657 条成人散文最短 308 字符。
- 双引擎成人锚定与编译契约、提示词改写完整性、受保护场景字节基线及完整工程门禁均通过。
- 五批交付及合并补充共 372 条提示词/Token 变更。初始五批 368 张候选曾在合并前计划下完成 PNG、尺寸与 SHA-256 机械核验，合并后新增的 4 条成人蓝图也按最终计划出图并通过机械核验。最终 SFW 编译器改变了全库构图守卫；用户随后明确取消全量重生成，因此初始 368 张不再宣称与最终编译 Prompt 完全匹配。

## 证据与边界

- 分批交付清单：`docs/evidence/nsfw-optimization/batch-03-roster30-delivery.json` 至 `batch-07-roster11-delivery.json`。
- 本地渲染机械核验：`docs/evidence/nsfw-optimization/batch-03-07-local-render-verification.json`。
- SFW 合并后新增成人蓝图的交付与渲染核验：`docs/evidence/nsfw-optimization/final-merged-adult-delivery.json`、`final-merged-adult-render-verification.json`。
- 用户要求避免上传和看图，因此本轮没有上传图片、没有在会话中打开图片，也没有进行人工或视觉模型目视验收；该项明确记为未执行，机械核验不能替代视觉质量结论。
- 最终编译器下的五批全量重生成已按用户最新指示停止；停止前产生的局部刷新仅留在本地，不作为最终全量视觉验收证据。
