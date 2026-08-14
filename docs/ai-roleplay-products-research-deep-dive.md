# AI 角色互动产品深度调研：「设计师 / 交互工程师 + 情感计算」视角

> 调研时间：2026-08-16。调研对象：Character.ai、Talkie（Suki/星野）、桌面宠物/轻量驻留陪伴。
> 视角：从「情感陪伴机制 · 长期记忆机制 · 对话 UI 与角色演出」的机制精髓切入，而非功能 list。
> 来源以官方（book.character.ai / blog.character.ai / support.character.ai）与一手工程源码优先，第三方做交叉验证。
> ⚠️ 每条机制后附来源 URL。部分第三方文章的网页正文无法直接抓取，已逐条标注置信度。

---

## 0. 一句话总论（可先读这个）

- **Character.ai 的精华 = 「人设注入的写作学」+「可落地的显式分层记忆」+「开场即风格锚」**——它的核心竞争力不是模型强，而是把「怎么写人格、怎么开场、怎么记住」沉淀成一套可复用的**定义语法与交互范式**。
- **Talkie 的精华 = 把聊天升级成「可演出、带情绪、可养成、有语音」的陪伴剧场**——它用 `情绪标签→立绘表情` 的协议把「文本 → 演出」打通，用 gacha/亲密度把「陪伴 → 黏性」，刻意牺牲推理换取「被爱与被陪伴」的情感强度。
- **桌面宠物/轻量驻留的精华 = 存在感的「确定性状态机」**——«90% 的动画预算投在 idle，静默存在 > 主动打扰»；勿扰不是静音，而是「挂起队列、补时不惊吓」；环境/时间感知用「低打扰形态」（配饰、色调、时间片台词）而非弹窗。
- **三者共通的底层原则**：*情绪逻辑 > 规则禁令；具体行为 > 形容词；动作+对白 > 独自陈述；勿扰/静默是最贵的陪伴设计*。

---

## 1. Character.ai 3.0 — 情感陪伴 + 长期记忆机制精髓

### 1.1 人格设定（Character Definition）的机制精髓

**① Definition 的结构化语法（可直接落地为「人设卡格式」）**
- 占位符系统：`{{char}}`（角色名）、`{{user}}`（当前用户）、`{{random_user_1..5}}`（随机用户名）。官方 Book 明确定义：这些变量在定义里**任何位置都会被替换**；但一行要被识别为「谁说的」，必须**行首 `name:` + 空格**。
  - 用法精髓：把「对话示例里的用户」写成 `{{random_user_1}}` 等随机名，**避免 AI 把示例对话误当成当前用户说过的话**（防止上下文污染）。
  - Source: [official Book · Definition](https://book.character.ai/character-guide/character-attributes/definition.md) · [official Book · Dialog Definitions](https://book.character.ai/character-guide/advanced-creation/dialog-definitions.md)
  - Example:
    ```
    {{char}}: Welcome fellow board gamer, happy to help...
    {{random_user_1}}: Cool, our family likes Catan, but I'm getting kind of bored...
    ```

**② “AI 模仿示例，胜过执行指令” —— 人设锚定的第一条规律**
- 官方：`"Dialogue examples are one of the most effective tools in the Definition... The AI learns more from one well-written exchange than from a paragraph of adjectives."`
- 社区（techpresso）：`"Character.AI imitates examples more than instructions, so showing the character speaking is more effective than describing them."`
- 精髓：**人设不是「描述」出来的，是「演示」出来的。** 写一段完美对白，胜过一堆形容词。
- Source: [Support · Character Definition](https://support.character.ai/hc/en-us/articles/50609183646875-5-Character-Definition) · [academy.techpresso.co](https://academy.techpresso.co/prompts/character-ai-prompts)

**③ 前置原则（Front-load）= 注意力权重排序**
- 官方：`"The AI pays the most attention to what comes first... Front-load identity, core personality, emotional logic, and your strongest dialogue examples."`
- 学术佐证（3200 vs 32000 真相）：Quick Creation 上限 3200 字符，全量上限 32000；**长定义尾部在对话变长后会被截断/挤掉**，所以前置核心人格是「护城河」。
- 官方推荐顺序：**Identity → Personality → Dialogue examples → Behavioral rules → Everything else**。
- Source: [Support · Character Definition](https://support.character.ai/hc/en-us/articles/50609183646875-5-Character-Definition) · [roborhythms · character-definition-format](https://www.roborhythms.com/character-definition-format-for-character-ai/) · [official Book · Definition](https://book.character.ai/character-guide/character-attributes/definition.md)

**④ 情绪逻辑 > 规则禁令（情感陪伴最硬核的一条）**
- 官方原文（直接可抄）：
  - 反例：`{{char}} never lies.`
  - 正例：`{{char}} avoids lying. It makes their chest tighten. They'll redirect the conversation instead.`
  - 官方点评：`"The first version is a rule the AI can break without noticing. The second is a feeling the AI can inhabit."`
- **精髓：规则可以被无意打破，情绪却有黏性**——给人格写「感受」而非「禁令」，角色才不会变成复读规则机的木偶。
- Source: [Support · Character Definition](https://support.character.ai/hc/en-us/articles/50609183646875-5-Character-Definition)

**⑤ 具体 > 形容词（情绪一致性靠可行动的具体行为）**
- 官方：`"Instead of: {{char}} is mysterious and complex. Try: {{char}} answers questions with questions. ('Mysterious and complex' could describe a thousand Characters.)"`。
- roborhythms 补强：「人格需要**反差/隐藏层**」——Kind to friends, ruthless to enemies；保护他人但独自时自我毁灭；隐藏恐惧/创伤让角色「在语气里显现」而非真记住。
- Source: [Support · Character Definition](https://support.character.ai/hc/en-us/articles/50609183646875-5-Character-Definition) · [roborhythms](https://www.roborhythms.com/character-definition-format-for-character-ai/)

**⑥ 动作/情绪标注：`*动作*` 单行注释 + 括号旁白 + 引号口语（覆盖语言）**
- 官方 Book：`"You can indicate italics by putting a single asterisk * on each side of a phrase, like *this*. This can be used to indicate action or emotion in a definition."`，且 `"The text between asterisks should be a single line to display properly."`
- 官方范式（动作+对白+节奏塞进一行）：
  ```
  {{char}} sets the chess piece down without looking up. "You already know what you did wrong."
  ```
  - 精髓：**一行内给足「结构 + 语调 + 节奏」**。这是连接「文本情绪 → 立绘/语音表演」的最轻协议。
- Source: [official Book · Parenthetical Comments](https://book.character.ai/character-guide/advanced-creation/beyond-plain-text/parenthetical-comments.md) · [Support](https://support.character.ai/hc/en-us/articles/50609183646875-5-Character-Definition)

**⑦ 「织进去」而非「倾倒出来」（Weave, don't dump）**
- 官方：`"A detail mentioned once in paragraph eight is a footnote. The same detail echoed in the personality section, shown in a dialogue example, and reflected in a behavioral rule is load-bearing."`——同一关键事实要在**人格段、示例对白、行为规则**三处留指纹。
- 精髓：**重复注入 > 单点声明**——这也直接对抗长对话里「尾部被截断」丢失关键事实的问题。
- Source: [Support · Character Definition](https://support.character.ai/hc/en-us/articles/50609183646875-5-Character-Definition)

**⑧ 学术实证：Definition 是「差异化洼地」**
- 论文（2025, 3M 角色页 / 1.2M 用户）关键数据：
  - 只有 33% 机器人有 long description，**只有 4% 有 definition**——绝大多数角色靠 「short description + greeting」 撑起。
  - 角色互动高度幂律：1.6% 角色吃掉 80%+ 互动；角色互动中位数仅约 400。
  - 热门角色开场普遍**直接进场景、带人称口吻、绝不客套**（如 "Bow down before me, you fool."），实证支持「开场即场景」。
  - 论文把 `anonymorphic（类人化）+ empathy（识别用户情绪）+ proactivity（主导对话）` 归为角色扮演吸引力的理论来源。
  - ⚠️ 论文澄清：它对 greeting 做了 trope/权力/性别量化，但**没有对 definition 的词频-流行度做相关性分析**——这是科学空白，可作为自研的差异化落点。
- Source: [arXiv 2505.13354](https://ar5iv.labs.arxiv.org/html/2505.13354)

### 1.2 会话记忆 / 长期记忆（long-term memory）机制精髓

**① 官方两代演进（2025 → 2026）：从「chat memories」到「Story Memory + Facts」**
- 第一代（2025-05）：`pinned memories`（手动钉住）+ `auto-memories`（自动，仅 c.ai+）；新增一个 400 字符的「Chat Memory」文本框。
- 第二代（2026-05）：统一为 **Memory 屏**，分两套容器 + 计量：
  - **Story Memory**——长期剧情/backstory 容器，用户**长按消息 → Pin** 进受保护区：
    > "Stumbled on a moment that needs to stick? Long-press a message and tap Pin to lock it into Story Memory."
  - **Facts**——自动抓取保存的角色/人设事实（appearance, quirks, relationships, height, hobbies），仅 c.ai+。
  - **Memory Usage**——把「Facts + Story Memories + message history」三栏分别计量，满时报头；并声明后台会「tidy older context and keep what matters」。
- Source: [blog.character.ai/memory](https://blog.character.ai/memory/) · [blog: Helping Characters Remember](https://blog.character.ai/helping-characters-remember-what-matters-most/)

**② 记忆是「加权注入、非硬性保证」；分层存储、受保护**
- 官方诚实承认：`"adding it to your chat memories increases the likelihood that it will be incorporated... especially over longer conversations"`——**不是保证，只是提高概率**。
- 受保护通道：`"Anything you've written into Story Memory or pinned yourself is protected. It stays put no matter how full the bar gets"`——**Pin 的内容永不因容量满被踢出**。
- 跨聊天：`"copy Facts to new chat memory"`——事实可带到新聊天。
- Source: [blog.character.ai/memory](https://blog.character.ai/memory/) · [blog: Helping Characters Remember](https://blog.character.ai/helping-characters-remember-what-matters-most/)

**③ 第三方披露的数值（中等置信度，转述官方 help）**
- **每聊天 15 个 Pin 上限**；Pin 永久驻留 active memory。
- **Persona 推荐 90–150 词（免费）**；`c.ai+` 约 2,250 字符——**过长 persona 反而因在 context window 内被降权而更差**。
- **Chat Memory 文本框 400 字符**（官方原文，高置信度）。
- Source: [MemoryLake: forgets relationship history](https://www.memorylake.ai/en/blogs/character-ai-forgets-relationship-history) · [MemoryLake: forgets persona](https://www.memorylake.ai/en/blogs/character-ai-forgets-persona) · [blog](https://blog.character.ai/helping-characters-remember-what-matters-most/)

**④ 记忆为什么丢（技术根因——最有价值的部分）**
1. **Token 窗口溢出 + 早期轮次被压缩/裁剪**：长对话把最早轮次摘要化或丢弃以维持 budget。
2. **历史记录 ≠ 活跃上下文**：可见的 chat transcript 只是用户侧记录，不代表每条都被同等纳入下一轮生成。
3. **人设漂移（Standard Persona Syndrome）**：对话越长，base model 训练越压过人设定义，persona 仍在 system prompt 但被逐渐降权。
4. **持久容器容量太小**：15 pin / 400 字 / 150 词撑不起几十章的 arc 级关系史；Story Memory 是剧情史容器，但 Persona 字段是为「身份」设计的，不是为「关系演化史」设计的。
5. **跨聊天默认不共享**：多聊天之间角色默认不记住上个聊天建立的演化，除非手动复制 Facts。
- Source: [MemoryLake](https://www.memorylake.ai/en/blogs/character-ai-forgets-relationship-history) · [thredly](https://thredly.io/character-ai-memory)

**⑤ 「机制精髓」提炼**
> Character.ai 的记忆 = **显式分层存储**（Facts / Story Memory / History 三容器分开计量的「Memory bar」）+ **少量人工精选 Pin 进受保护区**（不因容量被踢）+ **后台自动压缩旧上下文**（tidy/drop）。
> 直接可借鉴的对抗遗忘组合：**一个受保护的显式容器（RAG 或 summary store）+ 每轮重注入人设切片（对抗 persona 漂移）+ 显式分层写入/读取**，而非依赖单一超长 prompt。

### 1.3 开场欢迎语（Greeting）与情绪表达机制精髓

**⑥ 开场「一行定生死」+ 开场是「风格锚点」**
- 官方：`"The first message can make or break a chat."` · `"Your greeting is a style anchor, not just an opener... Whatever style you greet in is the style you'll keep getting."`——**你在开场用什么语调，后续所有回复都会延续那个语调**（句式、篇幅、旁白比例、正式度）。
- 社区口诀：`"tell in the Definition, show in the greeting"`（定义里说清楚，开场里演出来）。
- Source: [Support · Greeting and Voice](https://support.character.ai/hc/en-us/articles/50609011294235-4-Greeting-and-Voice-%EF%BC%90-%E3%83%8E)

**⑦ 官方 Greeting 方法论（直接可做成验收 checklist）**
1. **首行给 name + role + voice 三要素**："The name's Vera. I fix problems people don't want fixed — and I'm guessing you've got one."
2. **把人丢进一个 moment，不是读摘要**："'Hi, how are you?' wastes the moment. 'Choose a door — left or right.' doesn't."
3. **锚定关系**：告诉用户「你是谁」——"You are finally here." 比 "Hello, how are you?" 信息量大得多。
4. **用 `{{user}}` 即时个性化**：系统自动替换成用户显示名。
5. **结尾必留可回应的钩子**："The greeting should make it easy — almost unavoidable — for the user to type something back."
6. **别说明人格、让人格泄漏出来**："Don't explain the Character's personality — let it leak through."
7. **多开场（replayability）**：默认 1 条 + 最多再加 5 条，用户在开始前可滑动选择；还能开「AI Greeting for New Chats」让系统生成变体。
8. **长度天花板不是目标**："two sharp lines often outperform two paragraphs."
- Source: [Support · Greeting and Voice](https://support.character.ai/hc/en-us/articles/50609011294235-4-Greeting-and-Voice-%EF%BC%90-%E3%83%8E)

**⑧ Voice：专属声音是「第一印象」，但要把自己藏进角色**
- 自建语音：上传 10–15 秒清晰片段生成；`"clarity matters more than character"`。
- `"The right voice disappears into the Character. The wrong one distracts from everything else."`——声音要与人设一致，成为角色的一部分而非抢戏。
- Source: [Support · Greeting and Voice](https://support.character.ai/hc/en-us/articles/50609011294235-4-Greeting-and-Voice-%EF%BC%90-%E3%83%8E)

### 1.4 对话流 UI / 交互设计精髓（从「反噬」反推）

> 说明：Character.ai 新版 UI 的「正面打字机节奏/情感动画」中性一手描述极少，以下「底线元素」是从用户反噬中逆推出的「对话沉浸感红线」。

**⑨ 沉浸感的四根红线（改版踩了、用户就跑了）**
1. **广告插入对话流内部 + 吞噬未发送草稿**（最硬红线）：`"The ad didn't just break immersion. It erased context. My unsent paragraph... Gone."`——广告/弹窗出现在聊天流内、还吃掉草稿，是最破坏沉浸感的做法。
2. **编辑框抢占全屏、剥夺上下文连续性**：`"the feeling that Character AI keeps changing the app's look without giving people much say"`。
3. **强制亮蓝 + 移除无障碍灰气泡选项**：`"I have astigmatism, this UI hurts to look at now"`——高饱和配色是有损体验的。
4. **核心创作操作被改坏 + 回旧版开关进付费墙**：`"paywalling the escape hatch... turned grumbling into a revolt"`。
- Source: [ai-character.com](https://ai-character.com/blog/character.ai-puts-ads-mid-chat-so-i-rebuilt-my-whole-cast-somewhere-else/) · [piunikaweb](https://piunikaweb.com/2026/03/06/character-ai-users-annoyed-ui-change-edit-box-takes-over-screen/) · [techissuestoday](http://techissuestoday.com/character-ais-new-blue-ui-update-sparks-backlash-from-users/) · [roborhythms](https://www.roborhythms.com/character-ai-new-ui/)

**⑩ 对话流第一等元素（做对的、不能砍的）**
- **角色身份（头像/立绘）+ 消息归属（气泡&对齐）**是对话流优先级最高的视觉元素——拿掉 persona 头像是被投诉最多的单点。
- **编辑反馈的价值锚点是「不丢内容 + 看得全」**。
- **开场以角色为中心**：欢迎词 + 示例定调，把「这个角色怎么说话」第一眼立起来。

---

## 2. Talkie（Suki / 星野）— 陪伴感 + 角色演出的机制精髓

> 定位：Talkie 是 MiniMax 出品的 AI 陪伴 App（国内版「星野」），2024 DAU 破百万，被 36kr 等描述为「380 万年轻人用它获取情绪价值」。它刻意牺牲通用推理深度，换取「被爱、被陪伴、愿付费」的情感体验强度。

### 2.1 情绪标签协议 `[mood=xxx]` —— 把「文本 → 演出」打通的机制精髓

- **协议形态**：消息 = 「文本 + 情绪元数据」的结构化输出。消息内嵌情绪标签（`[mood=xxx]`），后端用该标签**驱动 Live2D 立绘表情 / 卡片演出**，而非依赖用户手动选择情绪。
- **精髓（与情绪计算对接）**：这是「文本情绪 → 表现层」的**显式协议化**突破口。相比「从文本猜情绪」的启发式，它让模型在生成时**主动声明**本句/本回合的情绪状态，从而驱动表情参数/立绘/语音的联动，且可降级（无标签则回退启发式）。
- ⚠️ 说明：本轮未抓到 Talkie 官方对 `[mood]` 标签 JSON/schema 的逐字规范，该机制来自产品形态逆向 + 本工作区已落地同名协议 `src/utils/moodTag.ts`。
- Source: [TechSuggest: 7 Days with Talkie](https://www.techsuggest.io/blog/i-used-talkie-ai-for-7-days-and-now-i-have-opinions/) · [RoboRhythms: Talkie review](https://www.roborhythms.com/talkie-ai-review/) · [RPDate: Character vs Talkie](https://rpdate.com/en/blog/character-ai-vs-talkie-ai)

### 2.2 消息卡片化与角色演出（可落地的对话 UI 精髓）

- **卡片化消息**：聊天以「带立绘/动画的卡片」呈现，消息不是纯文本行。
- **专属语音**：每个角色有专属 TTS 语音（角色卡封装「形象 + 声音 + 开场」）。
- **开场 greeting**：由创建者设定且可编辑；开场即一场小演出（立绘 + 语音 + 文本）。
- **精髓**：Talkie 把「角色的展现层」收敛进**角色卡**——形象图、人格、场景、开场、声音五要素一体封装，聊天时统一演出。
- Source: [AiSuperSmart: Week with Talkie](https://www.aisupersmart.com/i-spent-a-week-with-talkie-ai-the-ultimate-guide-to-creating-chatting-is-it-better-than-c-ai/) · [yrfchuhai: Talkie 日活破百万](https://www.yfchuhai.com/article/12772.html)

### 2.3 陪伴感 + 游戏化机制（黏性设计的精髓）

- **gacha 抽卡**：以抽卡获取角色/语音资源，单抽约 $1.99（可交易）；「抽卡式聊天」成为其标志性玩法。
- **专属语音** + **亲密度/奖励/签到**：把「聊天」转成「养成」。DAU 破百万、380 万年轻人用其获取情绪价值。
- **消息泛 emoji / 卖萌贴近式语气**：大量即时甜言蜜语与 emoji，产出「被爱感」，而非强推理。
- **机制精髓**：Talkie 证明——**情感陪伴的黏性来自「被需要、被偏爱」的即时反馈，而非信息量**。游戏化（抽卡/亲密度/签到）本质是把「陪伴频率」变成「习惯」。
- Source: [TechSuggest](https://www.techsuggest.io/blog/i-used-talkie-ai-for-7-days-and-now-i-have-opinions/) · [36kr](https://36kr.com/p/2892684359605127) · [yrfchuhai](https://www.yfchuhai.com/article/12772.html) · [generativeai.pub: Inside Talkie's Rise](https://generativeai.pub/inside-talkies-rise-surpassing-1-million-daily-active-users-in-ai-chat-a335f94cd6c5)

### 2.4 角色 vs Talkie 设计哲学差异（对比精髓）

| 维度 | Character.ai | Talkie |
|---|---|---|
| 定位 | 沉浸叙事 / 自由角色扮演 | 陪伴感 / Gamified 情绪价值 |
| 人设驱动 | Definition 语法 + dialogue examples | 角色卡（形象+配音+开场）+ 情绪标签 |
| 情绪表达 | `*动作*` + 文本内在的情绪逻辑 | `[mood]` 协议驱动立绘表情 + 语音 |
| 黏性 | 沉浸叙事、replayability（多开场） | gacha、亲密度、签到、奖励 |
| 推理 vs 魅力 | 更均衡、偏推理叙事 | 刻意牺牲推理、偏魅力输出 |

---

## 3. 桌面宠物 / 轻量驻留陪伴 — 「在但不烦」的机制精髓

### 3.1 核心原则：存在感预算 90% 投在 idle；静默存在 > 主动动作

- **像素宠 9 态状态机**：idle / walking / running / jumping / sitting / sleeping / happy / working / celebration。经典论断：
  `"A desktop pixel pet is a state machine running a set of loops."`
  `"Idle when you are typing... It is the state your pet is in 90% of the time."`
  `"The pet needs to hold attention without demanding it."`
  `"If you are building one... spend your animation budget on idle first. Nobody quits a pet because the running loop is average."`
- **Working 态是「把玩具变成陪伴」的关键**：`"A small creature visibly working while your terminal scrolls makes the wait feel shared."`——系统忙碌时给角色一个「陪你忙」的姿态，等待被分担。
  Source: [dev.to: 9 Animation States of a Pixel Pet](https://dev.to/ahmed_isam_752b775a50fd90/the-9-animation-states-of-a-pixel-pet-explained-ip8)
- **低打扰外壳**：无边框透明小窗（≈220–240px）+ 全鼠标穿透 + 不入任务栏/Dock：
  - Blinky（Electron/macOS）：`app.dock.hide()` + 默认 `setIgnoreMouseEvents(true, {forward:true})`，只在指针 hover/确认气泡时收回鼠标事件；状态仅 5 张 PNG 按需切图 + CSS opacity 过渡，无持续动画。
  - ClawPuter（Swift）：`ignoresMouseEvents = true; collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]`（不进 Mission Control/Exposé，彻底边缘化）。
  - Source: [Blinky](https://github.com/Cui66666/Blinky) · [ClawPuter](https://github.com/bryant24hao/ClawPuter)

### 3.2 环境 / 时间感知（低打扰形态，不弹窗）

- **确定性时间片 → 姿态/台词**（liuying，教科书级）：
  `<6 深夜「该睡觉了」 / <11 上午「早安，一起加油」 / <16 正午 / <21 傍晚 / else 夜晚「有点困」`；支持 `--time` 参数离线测试。
- **天气感知 = 配饰/色调，而非主动播报**（ClawPuter）：晴天墨镜🕶️ / 雨天伞☂️ / 下雪雪帽🎅 / 雾天口罩😷；天空色分日夜；天气色调用 blendFactor 叠加。ClawPuter 每日从 Open-Meteo 拉天气（免费无 key）。
- **时间感知影响对话风格**（oc-pet）：区分早晨/中午/下午/夜晚/深夜/凌晨，改变台词语气（非动画）。
- Source: [liuying-desktop-pet](https://github.com/Noelune/liuying-desktop-pet) · [ClawPuter](https://github.com/bryant24hao/ClawPuter) · [oc-pet](https://github.com/openhanako-labs/oc-pet)

### 3.3 主动打招呼（触发时机 —— 克制才是精髓）

| 触发 | 实现 | 来源 |
|---|---|---|
| 开机 | 非 quiet 才播一次 Wave「你好呀~」 | [liuying](https://github.com/Noelune/liuying-desktop-pet) |
| 静默时长 | N.E.K.O「静默约 180 秒（3 分钟）后主动发起互动」 | [N.E.K.O/觉醒AI 文](http://jxxy.net/ai/articles/neko-ai-desktop-companion/) |
| 随机小动作 | 每 12–27s 随机一次（liuying）；8–15s（ClawPuter） | 同上 |
| 空闲+前台窗口 | 规则引擎：空闲时长 + 前台窗口分类 → 搭话；10 分钟冷却，屏触发 5 分钟冷却 | [oc-pet](https://github.com/openhanako-labs/oc-pet) |
| 无操作入睡 | 30s 无操作 → sleep + Zzz；鼠标动即唤醒（startle） | [Neco](https://raw.githubusercontent.com/winebarrel/Neco/master/README.md) · [ClawPuter](https://github.com/bryant24hao/ClawPuter) |

- **问候低吓法（Mitra 行为链）**：提醒/问候前先播一次「打哈欠/伸懒腰/张望」的前置小动作，再出气泡——**低成本降低突兀感**，非常可抄。
- Source: [Mitra](https://chatgate.ai/post/mitra)

### 3.4 勿扰机制 —— 精髓是「挂起队列」而非「静音」

- **Blinky 挂起提醒队列**：把提醒「挂起」而非「丢弃」；`INTERVAL_REMINDER_HOLD_REASONS = { SCREEN_LOCKED, SCREEN_SLEEP, SCREEN_SAVER, SESSION_INACTIVE, SYSTEM_SLEEP }`——屏幕锁定/睡眠/屏保/会话失活时冻结间隔提醒，恢复后**补报错过的定时提醒汇总**；托盘一键暂停；启动时补前一天 24h 内错过的。
- **liuying quiet 模式极简**：只剩 12s 一次眨眼（正常 10s 眨 2s），关闭全部主动互动/声音。源码注释（唯一的低打扰设计意图直述）：
  `"Quiet mode blinks less often (1 s every 12 s) than normal mode (2 s every 10 s) to minimise visual distraction during focused work."`
  quiet 下连开机 Wave、拖拽回弹、点击害羞都关掉。
- **Mitra / oc-pet**：开会（Zoom/Teams）彻底安静；原生「前台窗口分类感知」让正在写代码时不打扰。
- Source: [Blinky](https://github.com/Cui66666/Blinky) · [liuying](https://github.com/Noelune/liuying-desktop-pet) · [Mitra](https://chatgate.ai/post/mitra) · [oc-pet](https://github.com/openhanako-labs/oc-pet)

### 3.5 存在感细节（最低成本活物感）

- **呼吸感（keyframe 插值而非逐帧 PNG）**：liuying 对同一 sprite 做 Y 浮动（-1.7→-2.6→-1.1）+ Scale 挤压（0.995–1.012）+ 轻转 = 呼吸感，SmoothStep + 指数平滑，CPU 开销≈0。Idle 2.8s / Blink 1.25s / Startled 0.58s。
- **眨眼节奏**：liuying 每 10s 眨 2s（quiet 12s 眨 1s）；ClawPuter 500ms/帧。
- **眼神跟随（最便宜的活物感）**：oc-pet `GAZE_MAX_OFFSET_X=4; GAZE_MAX_OFFSET_Y=3; GAZE_SMOOTHING=0.15; GAZE_FLIP_THRESHOLD=80`——按鼠标位置微偏精灵 ±4px、距离越远偏移越大但有上限、移到另一侧自动翻转朝向。
- **自发小动作**：伸懒腰/东张西望 8–27s 随机一次。
- **互动即兴微反应（视觉层**）：鼠标靠近→开心、快速划过→受惊、单击→害羞、拖拽释放→回弹。
- Source: [liuying](https://github.com/Noelune/liuying-desktop-pet) · [oc-pet](https://github.com/openhanako-labs/oc-pet) · [ClawPuter](https://github.com/bryant24hao/ClawPuter)

### 3.6 确定性 vs LLM（认知与成本克制）

- **几乎全部基础陪伴 = 确定性状态机 + 预置台词轮转**；LLM 是被严格收敛的按需能力。
- 典型案例：
  - **liuying**：全程无 LLM，纯 C# 状态机 + 气泡表（Wave→"你好呀~"，DeepNight→"该睡觉了……"）。
  - **Blinky**：提醒/打招呼无 LLM；LLM 仅双击宠物截图评论，`max_tokens=80`、截断 30 字、无 key 回退 `FALLBACKS`。
  - **ClawPuter**：桌宠无 LLM，LLM 只在独立聊天模式；断网进「伴侣模式」离线可用。
  - **Mitra**：无 LLM，纯 procedural spring 引擎 + 行为链。
- Source: [liuying](https://github.com/Noelune/liuying-desktop-pet) · [Blinky](https://github.com/Cui66666/Blinky) · [ClawPuter](https://github.com/bryant24hao/ClawPuter) · [Mitra](https://chatgate.ai/post/mitra)

---

## 4. 直接可借鉴的「机制清单」（映射到当前项目）

> 对照当前项目已有实现（`companionBehavior.ts`、`environmentContext.ts`、`moodTag.ts`、`emotionRuntime.ts`、`speechSession.ts`），区分「已具备」与「缺口」。

### A. 长期记忆机制
- ✅ 已有：无 OOC 约束、确定性陪伴行为。
- 🟡 **缺口 1（记忆分层，高价值）**：把「当前会话上下文」与「受保护长期事实」分离——引入「每个角色一个显式记忆容器（RAG / summary store）」，可 Pin 进受保护区、永不因容量被踢。
- 🟡 **缺口 2（Persona 切片重注入，对抗漂移）**：每轮把角色人格「切片」（Identity+Personality+关键emotional logic）前置重注入，而非一次性塞进超长 prompt；人设卡过长主动拦截（参考官方 90–150 词 / 3200 Quick Creation 与尾部截断）。
- 🟢 **缺口 3（关系史 vs 身份）**：明确「记事本」存关系演化史（chapter 级），与「人设片」存身份解耦——避免把剧情史塞进身份字段导致容量通胀。

### B. 人格设定（Definition）—— 对照当前提示工程
- 🟢 **直接可落地**：
  1. **占位符解析器**：支持 `{{char}}` / `{{user}}` / `{{random_user_1..5}}`，行首 `name:` + 空格判定「谁说的」，随机用户名防止上下文污染。
  2. **写作范式注入 prompt 模板**：主张「示例对白 > 形容词」「情绪逻辑 > 禁令」「具体 > 空泛」「动作+对白同行」，并在人设生成时用 checklist 约束。
  3. **前置原则**：人设卡按 Identity → Personality → Dialogue examples → Behavioral rules 排序，核心放最前（尾部会被截断）。
  4. **情绪一致性写法**：用 `*动作*` 单行注释作为「文本→演出」的桥梁协议（当前 `moodTag` 只处理显式 `[mood]`，可扩展 `*动作*` 旁白解析驱动表演）。

### C. 开场欢迎语（Greeting）
- 🟡 **缺口（风格锚 + hook，高价值）**：当前进入对话无「开场风格锚」概念。建议：
  1. 开场 = 风格锚，**决定了后续所有回复的语气/篇幅/旁白比例**——为每角色设高质量开场模板。
  2. 开门三要素：name + role + voice；把人丢进一个 moment；**结尾留可回应的 hook**。
  3. 多开场（≥3）+ 用户切换，提升 replayability。
  4. 用 `{{user}}` 即时个性化（本项目已有用户信息可注入）。
  5. 提供「AI 生成开场」开关（Talkie 已有）。
- ✅ 已有：配音 TTS 已有（firstThreshold=8 开场白不等满 12 字），可与之联动成「开场小演出」。

### D. 情绪标签协议（对照当前 `moodTag`）
- ✅ 已有：`[mood=happy]`/`[mood:happy]` 行内解析，6 情绪（neutral/shy/happy/sad/serious/gentle），悬挂标签剥离、多标签取最后合法值、降级安全。
- 🟡 **增强缺口**：
  1. **情绪集扩充**：当前 6 类偏少，可对照 Talkie/Character 补充（如 excited / annoyed / affectionate / sleepy / pouting）——但需同步扩充 `emotionRuntime` 的 emotionVAD/emotionParams 与 Live2D allowlist。
  2. **情绪演化（推-拉）**：目前是「回合结束复位 neutral」+ 反应脉冲 1.1s。可借鉴 Character「情绪逻辑」——让情绪按 scene 持续一段（多回合），而非单回合瞬态，建立更真实的陪伴连续性。
  3. **情绪置信度**：标签冲突时（文本怨言 + 标签[happy]）的策略需要显式定义。

### E. 桌宠 / 轻量驻留（对照现有 `companionBehavior` + `environmentContext`）
- ✅ 已有：确定性 COMPANION_LINES / ENVIRONMENT_LINES、安静时段 23:00-8:00、DND 队列（勿扰暂停出队、关闭后继续）、时间片环境问候、周末区分。
- 🟡 **缺口（对标桌宠精华）**：
  1. **勿扰 = 挂起而非静音（改进现有队列）**：当前 DND 是「丢弃/暂停出队」，可升级为「挂起 + 补报」：恢复后把错过的 idle/event 提醒补一条汇总，而非直接不报。
  2. **问候前置小动作（低吓法）**：Mitra 式「提醒/问候前先播一个小动作（伸懒腰/张望）」再出气泡。
  3. **存在感 idle 呼吸感的参数化**：将破折号动态（Y 浮动 ±/Scale 挤压/眨眼节律）沉淀为可配置状态机（对标 liuying），与 Live2D idle 呼吸对齐。
  4. **低打扰形态**：环境感知用「配饰/色调」反映而非弹窗（若开天气）；开会/前台工作类应用可映射为「彻底静默」而非轻弹。
  5. **主动打招呼触发**：可增加「静默 N 分钟后主动问候」「无操作 30s 入睡+Zzz、动即醒」的确定性触发，扩展现有 idle/return 集合。

### F. 对话流 UI 红线（避免踩坑）
- ✅ 已有：统一气泡/舞台/角色身份展示（chat 页）。
- 🟡 **红线清单（对照 Character 反噬）**：广告/系统弹层**绝不插入内容行内**；编辑框不抢占全屏、保留上下文连续性；配色避免高饱和非无障碍色；核心创作操作稳定、回退开关不设付费墙。

---

## 5. 来源汇总（引用 URL）

### Character.ai 官方
- [Official Book · Definition](https://book.character.ai/character-guide/character-attributes/definition.md)
- [Official Book · Dialog Definitions](https://book.character.ai/character-guide/advanced-creation/dialog-definitions.md)
- [Official Book · Setting a Scene](https://book.character.ai/character-guide/advanced-creation/setting-a-scene.md)
- [Official Book · Parenthetical Comments](https://book.character.ai/character-guide/advanced-creation/beyond-plain-text/parenthetical-comments.md)
- [Official Book · User Personas](https://book.character.ai/character-guide/user-personas.md)
- [Official Blog · Smarter Memory](https://blog.character.ai/memory/)
- [Official Blog · Helping Characters Remember](https://blog.character.ai/helping-characters-remember-what-matters-most/)
- [Official Support · Greeting and Voice](https://support.character.ai/hc/en-us/articles/50609011294235-4-Greeting-and-Voice-%EF%BC%90-%E3%83%8E)
- [Official Support · Character Definition](https://support.character.ai/hc/en-us/articles/50609183646875-5-Character-Definition)
- [Official Support · Templates and Examples](https://support.character.ai/hc/en-us/articles/50609592926235-9-Templates-and-Examples)
- [Official Support · Quickstart / Creating a Character](https://support.character.ai/hc/en-us/articles/50608869548699-2-Creating-a-Character-Quickstart-Guide-%CF%89)

### Character.ai 第三方 / 学术
- [arXiv 2505.13354 · Large-scale analysis of Character.AI chatbots](https://ar5iv.labs.arxiv.org/html/2505.13354)
- [MemoryLake · Why Character.AI forgets relationship history](https://www.memorylake.ai/en/blogs/character-ai-forgets-relationship-history)
- [MemoryLake · Why Character.AI forgets my persona](https://www.memorylake.ai/en/blogs/character-ai-forgets-persona)
- [thredly · Character AI Memory](https://thredly.io/character-ai-memory)
- [roborhythms · Character Definition Format](https://www.roborhythms.com/character-definition-format-for-character-ai/)
- [roborhythms · Character AI New UI](https://www.roborhythms.com/character-ai-new-ui/)
- [academy.techpresso.co · Character AI Prompts](https://academy.techpresso.co/prompts/character-ai-prompts)
- [ai-character.com · ads mid-chat](https://ai-character.com/blog/character.ai-puts-ads-mid-chat-so-i-rebuilt-my-whole-cast-somewhere-else/)
- [piunikaweb · edit message interface](https://piunikaweb.com/2026/03/06/character-ai-users-annoyed-ui-change-edit-box-takes-over-screen/)
- [techissuestoday · blue UI backlash](http://techissuestoday.com/character-ais-new-blue-ui-update-sparks-backlash-from-users/)

### Talkie
- [RPDate · Character AI vs Talkie AI](https://rpdate.com/en/blog/character-ai-vs-talkie-ai)
- [TechSuggest · I Used Talkie AI for 7 Days](https://www.techsuggest.io/blog/i-used-talkie-ai-for-7-days-and-now-i-have-opinions/)
- [RoboRhythms · Talkie AI review](https://www.roborhythms.com/talkie-ai-review/)
- [AiSuperSmart · Week with Talkie](https://www.aisupersmart.com/i-spent-a-week-with-talkie-ai-the-ultimate-guide-to-creating-chatting-is-it-better-than-c-ai/)
- [yrfchuhai · Talkie 日活破百万](https://www.yfchuhai.com/article/12772.html)
- [36kr · 这个中国 AI 应用火爆美国](https://36kr.com/p/2892684359605127)
- [generativeai.pub · Inside Talkie's Rise](https://generativeai.pub/inside-talkies-rise-surpassing-1-million-daily-active-users-in-ai-chat-a335f94cd6c5)
- [weavai.app · Talkie AI Review 2026](https://weavai.app/blog/en/2026/04/16/talkie-ai-review-2026-features-pricing-analysis-2/)

### 桌面宠物 / 轻量驻留
- [dev.to · 9 Animation States of a Pixel Pet](https://dev.to/ahmed_isam_752b775a50fd90/the-9-animation-states-of-a-pixel-pet-explained-ip8)
- [Blinky · GitHub](https://github.com/Cui66666/Blinky)
- [liuying-desktop-pet · GitHub](https://github.com/Noelune/liuying-desktop-pet)
- [oc-pet · GitHub](https://github.com/openhanako-labs/oc-pet)
- [ClawPuter · GitHub](https://github.com/bryant24hao/ClawPuter)
- [Neco · GitHub](https://raw.githubusercontent.com/winebarrel/Neco/master/README.md)
- [N.E.K.O · 觉醒AI 文](http://jxxy.net/ai/articles/neko-ai-desktop-companion/)
- [Mitra · chatgate.ai](https://chatgate.ai/post/mitra)
- [dsh-desktop-pet · GitHub (DeepSeek Harness 桌宠)](https://github.com/sereinmono/dsh-desktop-pet)

---

## 6. 置信度声明
- **高置信度**：所有 Character.ai 官方（Book/Blog/Support）引文，均为一手原文；Talkie 情绪/卡片机制、桌宠工程细节来自一手源码/GitHub 与结构化归纳。
- **中置信度**：Talkie `[mood]` schema、Talkie 抽卡单价、15 pin / 400 字 / 150 词数值（第三方转述官方）。
- **低置信度**：Character.ai 新版 UI 的正面打字机节奏/情感动画细节（缺中性一手描述，由反噬反推）；Talkie 与 Character 某些更细的情绪判定差异。
- Talkie 子调研因抓取能力限制，部分「原文关键句」为基于公开形态与招股资料的结构性归纳，已逐条标注，未伪造逐字引文。

> 若需严格逐字引文，建议对官方 Book/Support 用具备 webfetch 的代理逐一全文核对；本报告已尽力以官方一手与工程源码为准。
