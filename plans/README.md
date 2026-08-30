# 动效改造计划

| 编号 | 计划 | 严重级别 | 状态 |
| --- | --- | --- | --- |
| 001 | 修复高频交互的合成层性能 | HIGH | DONE |
| 002 | 补齐导演台状态交接与退出反馈 | MEDIUM | PARTIAL |
| 003 | 收敛动效令牌并保留 reduced-motion 反馈 | HIGH | DONE |

## 推荐执行顺序

1. `001-interaction-compositor-fixes.md`
2. `002-director-workflow-continuity.md`
3. `003-motion-accessibility-tokens.md`

## 依赖关系

- 计划 001 独立，可先执行。
- 计划 002 依赖 001 不存在代码依赖，但建议在高频性能修复后执行，便于观察导演台真实交互。
- 计划 003 应在 001 和 002 完成后执行，因为它会调整全局过渡策略，需要以前两批组件的运动属性已经明确。

## 验证门禁

每个计划完成后依次执行：

```text
npm run typecheck:app
npm run test:frontend
npm run build
```

涉及提示词、蓝图、服装联动或真实出图时，还必须核对底层编译 Token 与真实画面，不得只根据界面状态判断完成。
