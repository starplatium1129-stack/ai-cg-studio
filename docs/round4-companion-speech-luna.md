# Round 4 Companion Speech

## Luna C

日期：2026-08-09

### 交付

- 在 `CompanionView.vue` 接入现有 `useVoiceInput` 和 `createSpeechSession`。
- 增加 ASR ready 时的紧凑按住说话入口和设置弹层，未配置时只保留小型设置入口。
- 增加页面级 Space 长按 manual，精确排除编辑目标、按钮激活、修饰键、repeat，并用 keyup 对称停止。
- 自动监听按聊天可用、回复 busy、DND、安静时段、页面/桌面窗口可见性 reconcile。
- 角色切换重新应用角色名 fallback wake word；配置保存重新加载；卸载时 cancel/release/session cleanup。

### 边界

- 未修改 `ChatView.vue` 行为。
- 未增加 desktop IPC、系统级快捷键、ASR fetch、VAD 或第二套状态机。
- 未触碰 Live2D、提醒、剪贴板、拖拽导入、沉浸和窗口 bridge 生命周期。

### SOL 复查点

- 复核真实窗口隐藏/显示事件下自动监听不会重新占用麦克风。
- 复核真实 ASR 返回语音段时，手动 keyup 后识别结果仍按 `autoSend` 正确填入或发送。
- 复核桌面穿透状态下页面级 Space 不绕过现有窗口交互策略。

### 第二轮修复

- `useVoiceInput` 增加启动 generation token，pending `getUserMedia` 被取消后会停止迟到的 tracks 并保持 idle。
- acquiring 阶段的 pointerup/keyup 使用 cancel，capturing 阶段才 stop；手动采集不受 DND/安静时段限制。
- 窗口隐藏和页面 visibilitychange 取消所有采集；behavior tick 始终刷新 quiet 状态并 reconcile 自动监听。
- 语音入口改为单一 `.companion-speech-cluster`，连续会话支持显式结束。

### 第二轮验证

- `test-chat.js`、`test-speech-session.js`、`test-vad-segmenter.js` 和 `typecheck:app` 应作为本轮门槛。
- E2E 新增 DND auto=0、手动 micCalls=1、deferred acquiring cancel/迟到 tracks stop；待整合构建后运行。

### 第二轮阻断修复

- busy=true 现在清除 keyboard/pointer held 状态并统一调用 `speechCancel()`，覆盖 acquiring、capturing、recognizing 和 auto；busy=false 仍执行 `markReplyIdle` 与自动监听 reconcile。
- `test-chat.js` 增加 busy 分支精确源码正则，防止回退为只调用 `speechStop()`。

### 整合浏览器签收

- `npx playwright test tests/e2e/studio.spec.ts --grep "companion speech"`：2/2 通过。
- 覆盖 DND 阻止自动监听但允许手动 Space、deferred `getUserMedia` 松键后迟到 tracks 停止，以及语音 cluster 可见、无横向滚动且不覆盖 textarea/send。
