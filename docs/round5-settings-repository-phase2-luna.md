# Settings Repository 第二阶段

## 范围

本阶段只迁移低风险标量偏好，不改变键名、备份格式或复杂 JSON 存储。

## Definitions

- `THEME_SETTING`: `dark | light`，非法值解析为缺失，序列化保持原字符串。
- `INTERFACE_SOUND_SETTING`: `'1'` 为 `true`，其他值为 `false`；写入 `1/0`。
- `TUNNEL_ENABLED_SETTING`: 使用历史反向键 `aics_tunnel_off`；启用写空字符串，禁用写 `1`。
- `GUEST_GUIDE_DISMISSED_SETTING`: `'1'` 为 `true`，其他值为 `false`；写入 `1/0`。
- `CHAT_THINKING_SETTING`: `off/low/medium/high`；旧值 `'0'` 解析为 `off`，非法值为缺失。
- `DRAW_ENGINE_SETTING` 保持不变。

`settingsRepository` 的浏览器存储探测、读取、写入和删除均可在 SSR/隐私模式下安全失败；`set/remove` 现在与 `get` 一样静默吞异常。

## 调用方

- `useTheme` 使用合法值判断显式主题，非法值不阻断系统主题变化。
- `useInterfaceFeedback` 使用 interface sound definition。
- `useControlActions` 仅迁移 tunnel preference，HTTP 行为未动。
- `GuestGuide` 使用 dismiss definition。
- `useCharacterRoomSession` 仅迁移 reasoning preference，聊天/session 逻辑未动。

## 验证

已新增 typed definition 合法/非法解析、精确序列化、旧 reasoning `0`、tunnel 空串/`1`、存储异常静默和调用方源码门禁测试。备份测试继续覆盖活键收集、死键清理和恢复白名单，新增 reasoning 活键内容断言。

浏览器签收（2026-08-09）：

- `npx playwright test tests/e2e/studio.spec.ts --grep "guest first visit|control panel shows|character room mounts"`：3/3 通过；guest 现有断言确认 dismiss 精确写入 `1`。
- 独立临时 Playwright 脚本（未入库）：control tunnel 空串 → `1` → 空串通过；reasoning 旧 `0` 初始化为 `off`、切换 `medium` 写入 `medium` 通过；无显式主题时系统 dark → light 不写 `aics_theme`，用户 toggle 后写入 `dark` 通过。

残余风险：本次未扩大到复杂 ChatStorage、Companion JSON 或动态训练键；临时脚本使用本机已运行网关和 Edge，不属于生产测试资产。

执行命令：

- `node scripts/tests/test-storage-repositories.js`
- `node scripts/tests/test-data-backup.js`
- `node scripts/tests/test-quality-gates.js`
- `npm run typecheck:app`

未执行 build/full validate；未迁移 ChatStorage、Companion config 或动态训练键。
