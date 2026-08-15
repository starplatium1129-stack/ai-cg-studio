# 桌宠语音与演出增强路线（吸收 ZcChat2 精华）

> 记录日期：2026-08-04
> 对标：https://github.com/Zao-chen/ZcChat2（Qt C++/Widgets 桌宠，源码已审计）
> 产品前提：个人本地使用为主；主动陪伴行为保持"不调 LLM、不自动出声"的确定性约束。
> 状态：✅ P0（长按说话最小闭环）、✅ P1（会话状态机/唤醒词，含 CompanionView 接入与竞态复审）、✅ P2（LLM 情绪标签协议）已完成并交付；P3（演出数据驱动）/P4（自定义角色资产包）暂缓，经批准后按 P3 → P4 顺序逐阶段启动，每阶段独立验收、不串阶段。

## 结论

ZcChat2 的精华集中在三处：**语音输入链路**（我们为零）、**LLM 结构化情绪协议**（我们靠启发式兜底）、**演出数据驱动**（我们靠代码内嵌）。吸收这些不改变现有架构：语音输入是用户主动发起，与"主动提醒不调 LLM"约束不冲突；情绪协议只作增强、不替换现有 TTS 情绪通道；演出配置化贴合视觉路线图的动效收口方向。

不吸收：Qt 重写、静态立绘替代 Live2D、`情绪名=文件名` 弱耦合、无超时/无重试的 TTS 队列（我们已更稳健）。

## 必须保留（阶段不得触碰）

- 陪伴行为：主动提醒不调用 LLM、不自动出声；台词只来自确定性轮转与环境问候表。
- 情绪通道优先级：TTS 逐句情绪（`useVoice.onExpression`）为准，流式文本情绪（`onStreamEmotion`）兜底，两者互斥；协议增强只能增加第三条可选通道，不得抢占。
- 配音播放层纪律：44 字缓冲、首句 ≥8 字放行、暂停+清 src 防叠播、加载期失败仅可重试一次、in-flight 合并。
- 纯 TS 状态机与 IPC 白名单模式；新增安全测试断言真实路由/进程输出。
- 麦克风采集只发生在用户主动操作时；无常驻录音、无唤醒词外的自动上传。

## 分阶段计划

### P0：语音输入最小闭环（长按说话）✅ 已完成（2026-08-04）

- 交付：`src/utils/vadSegmenter.ts`（纯 TS VAD 切段，22 用例）、`src/utils/voiceApi.ts`（WAV/重采样/OpenAI 兼容 ASR 抽象）、`src/utils/speechInputConfig.ts`（`aics_speech_input_v1` 已登记备份白名单）、`src/composables/useVoiceInput.ts`（manual/auto 双模式采集）、`SpeechInputSettings.vue` 配置弹层、ChatView 按住说话入口。
- 验收：`test-vad-segmenter.js` 进 validate；typecheck/build/ESLint/E2E 全绿。

### P1：会话状态机与连续对话 ✅ 已完成（2026-08-04）

- 交付：`src/utils/speechSession.ts`（7 态状态机：waitingForWake/capturing/recognizing/waitingForReply/continuousReady/ending，12 用例）、配置扩展（wakeEnabled/wakeWords/endWords）、ChatView 集成（唤醒词命中激活、结束词退出、busy 联动自动恢复监听、听候唤醒/连续对话徽标、权限拒绝后不自动重试）。
- 验收：`test-speech-session.js` 进 validate；E2E 覆盖唤醒词配置持久化。
- 待办：CompanionView 的自动监听与页面级长按热键集成，待用户未提交的 CompanionView 改动落地后再实施（避免冲突）；勿扰/安静时段抑制在桌宠侧接入时生效。

### P2：LLM 结构化情绪协议（增强通道）✅ 已完成（2026-08-04）

- 交付：`src/utils/moodTag.ts`（`[mood=happy]`/`[mood:happy]` 行内标签解析，12 用例；无标签/非法值/悬挂标签一律降级安全、多标签取最后合法值）；`useChatConversation` 流式接入（原始流与干净文本分离累积，标签不进展示/历史/配音，协议标签出现后文本启发式整回合让位，回合结束复位 neutral）。
- 优先级保持：TTS 通道开启时仍以 `onExpression` 为准；协议只增强无配音兜底通道。
- 验收：`test-mood-tag.js` 进 validate；E2E `flow 3e`（慢速流式窗口内断言 data-emotion=happy + 文本/历史无标签泄漏）。
- 顺带修复：`mock-upstreams.js` 慢流（per-token latency 的 `ctx.state` 引用错误导致流中断）与 companion E2E 漂移（desktopBridge mock 缺 `onGlobalMouse`、环境问候/穿透恢复的时间耦合，注入"固定起点但随时间前进"的 Date mock；ChatCharacterStage autoLoad 竞态补 pending 标记）。

### P3：演出数据驱动化

目标：把舞台/气泡/入场退场的动效参数化，减少代码内嵌动效。

- 动作绑定表：情绪/事件 → 动画序列（对标 `AnimePlugin` 的 move/opacity/scale 步骤，但只作用于舞台层元素，不伪造 Live2D 参数）。
- 舞台效果 JSON：入场、退场、气泡出现/消失、樱花浓度等参数进配置（贴合视觉路线图"动效收口"）。
- 立绘匹配防御：大小写兜底、无扩展名兼容（将来自定义角色静态立绘时启用）。
- 验收：动效参数进 validate 内容契约；相关视图 E2E 无视觉回归。
- 不做的：任何未经验证就驱动 Live2D 原生动作/表情参数（维持现有 allowlist 约束）。

### P4：自定义角色资产包（可选，依赖前置）

目标：对标 ZcChat2 角色包（Assets + config + 绑定表 + 尺寸/位置），支持静态立绘降级角色。

- 依赖：统一前端 API 层与存储 Repository（见视觉架构路线图 P1）先落地。
- 资产格式：`AI/Characters/<name>/` 目录约定（立绘、config.json、动作绑定、语音配置），导入/导出走已有 IPC 白名单与 `desktop:pick-files`。
- Live2D 模型仍不可分发；仅静态立绘角色可导入。
- 验收：导入/导出 round-trip 测试进 validate；角色切换 E2E。
- 不做的：未经作者授权打包/分发 Live2D 模型。

## 不建议启动

- Qt/原生重写（内存收益与 Live2D 生态损失不成比例）。
- 常驻麦克风监听（违背本地个人使用与隐私最小化）。
- 多模态/操作电脑类系统级 API（无明确本地需求）。
- 语音唤醒词用云端 LLM 判断（应在本地 VAD 先行，唤醒词仅匹配本地短词表）。

## 推荐执行顺序

1. P0 长按说话最小闭环（打通链路，验证 VAD 质量与 ASR 兼容面）。
2. P1 会话状态机 + 连续对话 + 全局热键（体验主力，纯 TS 可测）。
3. P2 情绪协议（提升演出自然度，纯增量、降级安全）。
4. P3 演出数据驱动（与视觉路线图动效收口合并推进）。
5. P4 自定义角色资产包（等待 API client / Repository 落地后再评估）。

每阶段完成时：`npm run validate` 全绿、`npm run build` 通过、桌面定向 E2E 通过；大改动按质量门槛分级跑测试，不做无脑全量。

### P1 CompanionView 补完 ✅（2026-08-09）

- CompanionView 复用 `useVoiceInput`、`createSpeechSession`、`loadSpeechInputConfig`，接入紧凑按住说话入口、语音设置弹层、连续会话/听候唤醒/识别状态。
- 页面级 Space 仅在非编辑目标、页面可见、聊天可用且非 busy 时启动 manual；keyup 停止，输入框、按钮空格、沉浸 Esc 与桌面快捷键不受影响。
- 自动监听受 chat ready、DND、安静时段、页面/桌面窗口可见性和回复 busy 门控；配置保存、角色切换、窗口可见性和组件卸载都会 reconcile/release，主动陪伴仍不调用 LLM 或自动 TTS。
- 本轮只修改 CompanionView 专属接线与测试，未增加桌面 IPC、系统热键或第二套 ASR/VAD。

### P1 CompanionView 竞态复审补完 ✅（2026-08-09）

- 修复 pending `getUserMedia()` 取消竞态：generation token 使过期启动在 resolve 后立即停止新拿到的 tracks，不再创建音频图或进入 capturing。
- acquiring 松键/取消改为 cancel，capturing 才 stop；手动入口不再因 acquiring/capturing 自身 disabled，DND/安静时段仍只抑制自动监听。
- 窗口隐藏、页面 visibilitychange、回复 busy 和卸载都会取消手动/自动采集；behavior tick 每次刷新安静时段并 reconcile，即使没有提醒也能及时停/恢自动监听。
- 语音控件收拢为单一 `companion-speech-cluster`，连续会话提供结束按钮；增加 deferred microphone 与源码生命周期契约测试。
- 整合构建后 Companion 语音浏览器回归已签收：`studio.spec.ts --grep "companion speech"` 2/2 通过，并通过 viewport/scrollWidth/控件不重叠断言。
