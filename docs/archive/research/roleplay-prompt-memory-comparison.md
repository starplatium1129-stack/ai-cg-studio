# 角色扮演提示词与记忆系统对比方案

> 对标项目：[momori777/Artemis](https://github.com/momori777/Artemis)（"AI 女友" 全本地项目，253 stars，Python）
> 编写日期：2026-08-11
> 状态：方案评审中（未实施）

## 1. 背景

本项目（AI-CG-Studio）角色空间已具备成熟的聊天能力（本地 Ollama + OpenAI-compatible API、流式回复、TTS 情绪、工具循环、视觉轮）。本方案调研同赛道项目 Artemis 的角色扮演提示词与记忆设计，评估哪些差距值得补，形成可落地的改造建议。

## 2. 对标项目来源

| 项目 | 地址 | 定位 | 授权说明 |
|---|---|---|---|
| Artemis | https://github.com/momori777/Artemis | 100% 本地 AI 女友：OpenClaw + llama.cpp + GPT-SoVITS + ComfyUI + Live2D + 桌宠，QQ/Telegram 双通道 | 开源仓库，公开可读（具体 License 以仓库 LICENSE 文件为准） |

### 2.1 本方案依据的 Artemis 文件（2026-08-11 读取 master 分支）

| 文件 | 内容 | 对我们的参考价值 |
|---|---|---|
| `README_CN.md` | 项目总览、功能特性、架构、VRAM 分档、记忆系统说明 | 系统定位与功能矩阵 |
| `skills/harem/natsume/IDENTITY.md` | 身份卡：Name/Creator/Vibe/Emoji/Status + 一句话人设 | 身份信息与灵魂分离 |
| `skills/harem/natsume/SOUL.md` | 灵魂：性格 bullet / 说话规则 / 记忆要求 / 互动重点 / NSFW 分区 | **提示词写法参考** |
| `AGENTS_roleplay_CN.md` | 角色扮演主提示词：行为规则、技能调用、记忆注入、VRAM 分档、角色切换 | 行为规则与动态注入机制 |
| `web-chat/CHARACTERS_JSON.js` | 前端精简角色卡：persona/tags/ttsMood/fallbackReplies | 前端角色数据模型 |
| `docs/qqbot-setup.md` | QQ Bot 接入（官方平台 + OpenClaw channel） | 与本方案无关，仅记录 |
| `skills/behavior-engine/`（README + engine.py 等） | 好感度系统：moodDelta → 5 维评分 → 9 段关系 + 4 级冲突 + 生理周期 | 确定性行为状态机 |
| `artemis_headroom_proxy.py` | 记忆注入代理：mem0 检索 → SmartCrusher 压缩 → 路由 | 记忆管线设计参考 |
| `skills/shared/context_trimming.py` | SmartCrusher 上下文压缩 | 对比本项目的裁剪策略 |

### 2.2 本方案依据的本项目现状文件

| 文件 | 内容 |
|---|---|
| `src/config/characters.ts` | 角色静态配置（caption/description/greeting/starters/陪伴台词），**无提示词结构** |
| `routes/chat.js` → `chatCharacterPrompt()` | 服务端 system prompt 组装（两角色 if/else 硬编码） |
| `src/composables/useChatConversation.ts` | 前端聊天流、工具循环、视觉轮、情绪通道 |
| `src/utils/chatArchive.ts` | 聊天归档（JSON 导出/导入/并入） |
| `src/utils/companionBehavior.ts` | 陪伴行为状态机（确定性台词，不调 LLM） |

## 3. 现状对比

### 3.1 角色提示词结构

| 维度 | 本项目（chatCharacterPrompt） | Artemis（SOUL/IDENTITY/AGENTS） |
|---|---|---|
| 载体 | 单文件函数内硬编码，一个超长 system prompt | 多文件分层（IDENTITY 身份 + SOUL 灵魂 + AGENTS 行为） |
| 结构 | 【官方档案】【说话习惯与例句】【对话判断与表达控制】三段式 | 性格 bullet + 说话规则 + 互动重点 + NSFW 独立分区 |
| 约束手段 | 硬约束："只输出台词，不写旁白、动作括号、角色名、Markdown"，1—3 句 ≤120 字 | 软约束：禁止项零散（"禁用长篇煽情""不说亲爱的"） |
| 动态注入 | 无记忆召回，仅 24 条/12000 字平滑裁剪 | mem0 向量检索 + 按相似度分级注入（>0.7 强制召回 / >0.5 自然引入 / >0.3 可选参考 / <0.3 丢弃） |
| 状态机 | 无好感度/关系阶段 | 行为引擎（5 维评分 + 9 段关系 + 4 级冲突 + 生理周期） |
| 角色切换 | 代码 if/else 两角色 | 目录热替换 + 记忆按角色隔离 |
| 用户档案 | 无（"工坊主人"写死在 prompt） | USER.md 独立注入 |
| 输出规范 | 严格（台词-only） | 宽松 |

### 3.2 本项目已有的优势（不退化）

1. **输出纪律**：台词-only 硬约束 + 短句上限，RP 质量可控；Artemis 无此约束。
2. **情绪链路**：TTS 逐句情绪 + 流式文本情绪 + `[mood=xxx]` 协议标签双通道互斥；Artemis 只有"按对话猜情绪"。
3. **工具循环**：companionTools + 视觉轮（Gemini 看图）；Artemis 靠 spawn 子会话。
4. **安全校验**：多模态白名单、body 裁剪、长度校验；Artemis 无。
5. **测试体系**：92+ Playwright 用例、validate 链、契约测试；Artemis 无。

## 4. 建议采纳的改造（按性价比排序）

### 4.1 P1 · 用户档案注入（成本：低，收益：中高）

**现状**：system prompt 中"工坊主人"写死，所有用户相同。

**方案**：
- `src/config/characters.ts` 或新增 `src/config/userProfile.ts` 增加用户档案数据：称呼偏好、与角色的关系定位（朋友/恋人/工坊主人）、性格备注（可选）。
- 持久化：localStorage（`aics_user_profile_v1`，登记进 `storageKeys.ts`）。
- 注入点：`routes/chat.js` 的 `chatCharacterPrompt()` 改为接收用户档案对象，在 system prompt 开头插入 `<用户档案>` 段；或由前端随 `/api/chat` 请求体传入（保持服务端无状态）。
- 参考写法（来自 Artemis IDENTITY.md 的简洁风格）：
  ```
  【用户档案】
  • 称呼：<用户设定的称呼>
  • 关系定位：<朋友/恋人/工坊主人…>
  • 补充：<自由备注，可空>
  ```

**验收**：设置后对话中角色使用设定称呼；未设置时行为与现状一致（回归零风险）。

### 4.2 P2 · 轻量记忆召回（成本：中，收益：高）

**现状**：只裁剪不召回，长对话角色"失忆"；归档（`chatArchive`）仅人工可查，不参与对话。

**方案（不引入向量库，符合本地轻量约束）**：
1. **摘要记忆**：每轮对话结束（或每 N 轮），用当前聊天模型把该轮内容压缩成 1—3 条事实（"用户说过：XXX"），存 IndexedDB（`aics_chat_memories_<角色>`）。
2. **召回**：发起新请求时，把最近 K 条记忆摘要 + 与最近用户消息的关键词重合度 Top-N 注入 system prompt 的 `<记忆>` 段。
3. 升级路径：若后续需要语义检索，可替换召回层为本地 embedding（如 Artemis 的 all-MiniLM/BGE 方案），注入格式不变——**先定注入协议，后换检索后端**。

**约束对齐**：记忆写入可异步（不阻塞发送）；记忆不参与 TTS/情绪链路；`storageKeys.ts` 登记新键；备份白名单同步。

**验收**：连续对话 >20 条后，角色能自然引用更早的约定/事实（回归脚本 + 手工验收）。

### 4.3 P3 · 好感度状态机（成本：中，收益：中，可缓）

**现状**：无长期关系状态；陪伴模式是确定性台词轮转（`companionBehavior.ts`）。

**方案**：吸收 Artemis `behavior-engine` 的确定性规则（**不调用 LLM**，与现有陪伴约束一致）：
- 每轮对话产生 moodDelta（兴趣/信任/吸引/烦躁/尴尬 5 维），规则引擎（纯 TS，`src/utils/`）更新 `relationship.json` 式状态。
- 状态影响：system prompt 注入关系阶段（"初次认识/热恋初期…"），控制回复亲密度档位；陪伴台词可按好感度选择不同文案组。
- 仅做 5 维评分 + 阶段映射，**不做**生理周期模拟（价值存疑，避免过度设计）。

**验收**：连续对话后状态文件可见变化；重启不丢；重置对话清零。

### 4.4 P4 · 提示词分层重组（成本：低，收益：工程性）

**现状**：`chatCharacterPrompt()` 两角色 if/else 硬编码长字符串，新增角色会膨胀。

**方案**：参照 Artemis 的 IDENTITY/SOUL 分离，把提示词拆为数据 + 组装：
- `src/config/characterProfiles.ts`：每角色 `{ identity: {...}, soul: {...}, behavior: {...} }` 三段数据（内容从现有 prompt 平移，不改变最终输出）。
- `routes/chat.js` 只做组装函数，输出与现状逐字节一致的 prompt（有契约测试兜底）。

**验收**：现有聊天 E2E 全绿（提示词输出不变，纯重构）。

### 4.5 不采纳项及理由

| Artemis 能力 | 不采纳理由 |
|---|---|
| QQ/Telegram 双通道 | 产品定位是本地个人使用 + 公网分享（已有 Web）；QQ 官方 Bot 需应用审核且有频率限制 |
| SillyTavern 角色卡导入 | 角色生态不对口（本站角色固定为宁宁/夏目）；导入后仍需人工校准立绘/Live2D，收益低 |
| mem0 + Qdrant 向量库 | 依赖重（Python 服务 + 向量库进程），与前端/Node 架构不符；P2 轻量方案先满足需求 |
| VRAM 分档调度（停/启 llama） | 本项目聊天默认走 Ollama/API，无 8GB 显存硬约束场景 |
| NSFW 分区玩法（强模式提示词文件） | 本站 R18 默认开启且已有内容策略，无需"模式切换"玩法 |
| 上下文压缩（SmartCrusher） | 现有平滑裁剪已达标（24 条/12000 字），压缩需 LLM 成本，暂不引入 |

## 5. 风险与约束对齐

- **不调 LLM 约束**：P3 状态机必须为确定性规则引擎（同 `companionBehavior.ts` 模式），不含 LLM 调用。
- **架构约束**：P1/P2 不改变 `/api/chat` 协议；新存储键全部登记 `src/utils/storageKeys.ts` 并进备份白名单。
- **隐私**：用户档案、记忆摘要均为本机数据；服务端不落盘（或仅运行时内存）。
- **回归**：每项改造独立验收；P4 有"提示词输出不变"的契约测试兜底，可随时撤销。

## 6. 参考链接

- Artemis 仓库：https://github.com/momori777/Artemis
- Artemis README（中文）：https://github.com/momori777/Artemis/blob/master/README_CN.md
- 角色卡目录（多角色 SOUL/IDENTITY 样本）：https://github.com/momori777/Artemis/tree/master/skills/harem
- 行为引擎设计：https://github.com/momori777/Artemis/blob/master/skills/behavior-engine/README.md
- headroom（记忆注入代理，Artemis 引用）：https://github.com/chopratejas/headroom
- mem0（向量记忆，Artemis 引用）：https://github.com/mem0ai/mem0
- 本项目现状：`routes/chat.js`、`src/config/characters.ts`、`src/utils/companionBehavior.ts`、`src/utils/chatArchive.ts`

## 7. 2026-08-12 源码复核与实施结论

本节以 Artemis `9a946f2bce5f944126497817782e0a7a6e292016`、Headroom `702dbc5902ff184a7c20178958a811beb9c78fa3`、Mem0 `35a125585e5e9ec31ee60094a08ae92337cff75a` 的真实源码为准，修正文档前文基于 README 的推断。

### 7.1 Artemis 真实情况

- Web Chat 实际 system prompt 顺序是 World Book → `SOUL.md` → `IDENTITY.md` → `USER.md`；`_build_system_prompt()` 明确排除了 `AGENTS.md`。`AGENTS_roleplay_CN.md` 不是默认活动 Prompt。
- 长期记忆主路径是自建的 Qdrant bridge，不是 Mem0 的 `Memory.add/search`；自动写入调用在该提交中还存在方法归属错误，不能视为已稳定工作的能力。
- 所谓 Headroom 是项目内的轻量仿制文件，不是上游 Headroom。其中文相关性会丢弃单字 CJK token，压缩摘要只记录压缩元数据，也没有可用的模型侧恢复链路。
- behavior engine 文件存在，但未发现接入正常 Web Chat/代理主路径；状态迁移代码还有只记录、不真正赋值保存的问题，并依赖 LLM 产生 `moodDelta`，不是前文所称的纯确定性状态机。
- Artemis 的 TTS 情绪、队列和播放生命周期明显弱于本项目，不应反向替换现有 `useVoice.ts` 链路。

### 7.2 本项目事实修正

- 浏览器会话实际保留 20 条消息；服务端 24 条/12000 字只是第二道上限。
- `chatArchive` 是可导入导出的转录归档，不是自动语义记忆，也不应直接按当前并入顺序注入 Prompt。
- `[mood=...]` 已有可靠解析和消费端，但默认角色 Prompt 尚未要求模型一定输出该标签，因此它是可选协议，不是完整协商协议。
- `storageKeys.ts` 只登记 localStorage；若未来使用 IndexedDB 记忆，备份接线应改 `useBackup.ts`/`backupCore.ts`，不能只增加 storage key。

### 7.3 已采纳

1. 新增 `server/chat-character-prompts.js`，把静态角色身份/灵魂与动态上下文分层组装；无动态上下文时宁宁/夏目 Prompt 的 SHA-256 与原实现逐字节一致。
2. 新增本机用户档案 `aics_user_profile_v1`：称呼、关系定位和 200 字补充背景；前后端双重白名单校验，动态资料明确标注为不可信事实并放在最终行为规则之前。
3. 用户档案编辑由 `ChatUserProfilePanel.vue` 独立拥有；网站角色房间和 Companion 共用 `useCharacterRoomSession`，不复制请求逻辑。
4. 新增 `aics_chat_memories_v1` 手动长期记忆：只允许用户主动固定自己的消息，可编辑/删除、按角色隔离；召回使用 CJK bigram + ASCII 词，最多 4 条、总计不超过 1000 字，前后端双重限额。

### 7.4 后续记忆策略

- 不照搬 Artemis 的 Qdrant/mem0/Headroom 管线。
- 第一版手动固定事实已落地；不自动保存角色编造的内容，也不让 LLM 摘要阻塞主回复。
- 后续只有在手动记忆验证有收益后，才评估独立、可选且带 source id/去重的事实提取接口。
- 好感度/关系阶段暂缓，不借用未接入且依赖 LLM moodDelta 的 Artemis behavior engine。

Artemis、Headroom、Mem0 为 Apache-2.0，本项目为 MIT；这里只复用架构思想并在本仓库独立实现，不复制其源码。
