# 桌宠语音与演出增强路线（吸收 ZcChat2 精华）

> 记录日期：2026-08-04
> 对标：https://github.com/Zao-chen/ZcChat2（Qt C++/Widgets 桌宠，源码已审计）
> 产品前提：个人本地使用为主；主动陪伴行为保持"不调 LLM、不自动出声"的确定性约束。
> 状态：全部阶段暂缓。经批准后按 P0 → P4 顺序逐阶段启动，每阶段独立验收、不串阶段。

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

### P0：语音输入最小闭环（长按说话）

目标：为语音输入打通第一公里，验证"采集 → VAD → ASR → 进聊天输入"链路。

- 渲染进程 `getUserMedia` 采集（仅按住按钮期间），`AudioWorklet`/ScriptProcessor 取 PCM。
- 纯 TS VAD 切段器 `src/utils/vadSegmenter.ts`：活动段切分 + 静音丢弃（对标 `VadSegmenter`/`Pcm16kConverter`，本地先行、静音不上传）。
- ASR 服务接口抽象 `voiceApi`：端点可配置（本地 whisper / OpenAI-compatible / 百度），无端点时按钮隐藏；模型名可配置或发现，不按供应商猜测。
- UI：聊天输入旁"按住说话"按钮 + 状态文案（聆听中/识别中），识别文本填入输入框由用户确认发送（默认不自动发送）。
- 验收：`test-vad-segmenter.js`（纯 TS，进 validate）；`typecheck:app` + `build`；定向 E2E（桌面窗口按住说话）。
- 不做的：唤醒词、全局热键、连续对话（下一阶段）。

### P1：会话状态机与连续对话

目标：对标 `SpeechInteractionController`（7 态）+ `SpeechSessionPolicy`，实现免手交互。

- 纯 TS `src/utils/speechSession.ts`：Disabled / WaitingForWake / Capturing / Recognizing / WaitingForReply / ContinuousReady / Ending；回复链路忙闲由调用方注入（复用 `isConversationOutputBusy` 思路）。
- 唤醒词：默认角色名，per-角色可配（沿用角色配置表）；结束词默认"结束对话"。
- 连续对话：回复播完自动恢复监听；勿扰/安静时段内不监听。
- 全局热键：直接使用 Electron `globalShortcut`（已有，替代它的 WH_KEYBOARD_LL/XGrabKey），长按说话。
- 验收：`test-speech-session.js`（12+ 用例，进 validate）；桌面定向 E2E（唤醒→连续→结束词）。
- 不做的：多语言唤醒词引擎、说话人识别。

### P2：LLM 结构化情绪协议（增强通道）

目标：让情绪由模型显式声明，替代"从文本猜情绪"的启发式。

- 流式输出协议扩展：回复文本流中携带情绪标签（如 `[mood=happy]` 行内标记或分段协议），解析进 `emotionRuntime` 驱动表情/动作。
- 优先级保持：TTS 通道开启时以 `onExpression` 为准；协议标签仅在无配音且文本情绪回调缺席时兜底（不抢占、不并行）。
- 协议必须降级安全：无标签、标签非法时行为与现状完全一致。
- 验收：`test-prompt-policy.js`/`test-emotion-runtime.js` 契约扩展；`test-chat.js` 更新；chat E2E 断言情绪驱动路径。
- 不做的：让协议控制换装、衣橱或未验证的原生动作。

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
