# 三引擎提示词调研与精细化配置基线（Krea 2 / Anima / SD-Illustrious）

> 状态：2026-08-14 · 为提示词精细化配置人员提供依据。
> 范围：Krea 2 Turbo（自然语言）、Anima Base/Aesthetic（标签流+Qwen LLM）、WAI Illustrious SDXL v17（Danbooru 标签流）。
> 本文 = 外部调研（官方文档/社区，标注置信度）+ 项目既有契约（presets.json / quality-prompt-contract.js / promptCompiler.ts）+ 本项目实机验证结论。

---

## 0. 三引擎定位总览（先看这张表）

| 维度 | Krea 2 Turbo | Anima Base / Aesthetic | WAI Illustrious SDXL v17 |
|---|---|---|---|
| 架构 | 12B DiT（从零训练）+ Qwen3-VL-4B 编码器 | 2B Flow-Matching + Qwen-3 0.6B 标签编码器 | SDXL 1.0 U-Net + CLIP（Danbooru 特调） |
| 提示词形态 | 100% 英文自然语言散文（3~5 句） | 空格分隔标签流 + 可选 1 句方向 caption | Danbooru 下划线标签流 |
| 质量词 | **禁用**（把输出拉向 generic AI gloss） | Base：`masterpiece, best quality, score_7`；Aesthetic：**全部去掉** | `masterpiece, best quality, amazing quality`（官方模板）；⚠️ **score_9 系是 Pony 体系，WAI 不认** |
| 权重语法 `(tag:1.2)` | 无效（被当字面文本） | 有效但需高值（`(chibi:2)`） | 有效（A1111 语法）；标签内含括号须转义 `\(...\)` |
| 负面词 | 恒空（ConditioningZeroOut） | 官方前缀 + 手/解剖/文字保护 + rating 安全 | 官方前缀 + 保护 + rating 安全 |
| CFG / Steps | 8 步 / CFG 1（固定） | 24 步 / CFG 3（生产）；官方对照 30/4.5 | 30 步 / CFG 6 + Auto hires 1.5× |
| 角色身份 | 角色名+系列+外貌散文（内置知识） | 触发词 token（LoRA）或 身份/服装散文（无 LoRA） | Danbooru 角色 tag + 特征标签 + LoRA |
| 画师风格 | 英文自然语言风格短语 | `@artist name`（官方协议） | 规范 Danbooru tag（kantoku 等） |
| 强项 | 创意探索、自然语言跟随、超快 | 影视级光影、大光圈质感、高清背景 | 经典二次元 2D CG、角色还原、生态成熟 |
| 弱点 | 肢体比例、背景爱画人、无角色特调 | 角色还原依赖 LoRA/描述准确 | 低速、标签组合需经验 |

---

## 1. Krea 2 Turbo（自然语言散文）

> 外部调研（官方 README / prompting.md / 技术报告 + PTT/CivArchive 社区实测，交叉验证）已归档于 `docs/krea2-prompt-writing-guide.md`；本节为配置人员速查。

### 1.1 官方参数（已核实）
- Turbo：`8 steps / CFG 0 / mu=1.15`；RAW：52 步 / CFG 3.5。项目固定 8 步 / CFG 1 / euler / simple（CFG 1 ≈ 官方 CFG 0 的社区容差，等价）。
- **mu=1.15 必须保留**（ComfyUI 对 raw 调度会设错，用 Krea-2-Two-Stage-Sampler 修正）。
- fp8_scaled 量化：240 图同参数基准保真度排第 5（轻度可测损失）；显存够换 BF16 或 INT8 ConvRot（同质量快 ~2×）。文本编码器用 BF16 Qwen3-VL 4B；VAE 用 Wan 2.1 FP32 更锐。

### 1.2 提示词文体（最重要）
- 官方：「长的、具体的、流畅的自然语言散文」；**标签堆词是负收益**。
- 结构（官方推荐顺序）：媒介/风格锚点 → 角色外观锁定（3-5 配色词复用）→ 姿态/构图 → 光照时机方向 → 背景物件清单 + 排除人（`no characters, no people, no figures`，官方明说模型见室内就爱画人）→ 情绪/氛围。
- **禁 AI 玄学词**：beautiful / stunning / masterpiece / 8k（把输出拉向 generic AI gloss）。
- 禁 meta 自指短语：`In this image...` / `The image shows...`。
- 成人内容（本项目实测）：裸体主词必须**前置**、服装写成「已脱下/丢弃」而非「穿着」、identity 散文剥离 `wearing/dressed in` 服装描述（`buildPopularPromptPlan` 已内置此修正，见 §5）。

### 1.3 本项目实测结论（2026-08-14）
- 18 角色 Krea 2 探针：身份 5.8 / 脸部 6.2 / 肢体 4.8 / 背景 5.2 / 光影 5.8（8 维）——「认得出但平庸」是定位错配（通用模型 vs 角色特调），非参数错误。
- 去审查链路：Heretic 编码器（abliterated）+ ConditioningKrea2Rebalance **standard** 预设（mult 1.1、normalize_taps **false**）+ 裸体词前置 = 成功出 NSFW（用户实机验证）。
  - ⚠️ 陷阱：normalize_taps=true 会导致 conditioning 崩溃（全图色散/栅格化）；aggressive 预设（mult 4.0）反而压制过狠导致拒绝出裸。
- 生产建议：Krea 2 适合作创意探索与快速样张；角色身份强一致与 R18 场景优先走 Anima（本机实测 Anima 一直能出 NSFW）。

---

## 2. Anima（标签流 + Qwen LLM）

> 外部调研进行中（子代理 b74f36cc）；以下先给项目既有契约与实机结论，外部证据回填后合入。

### 2.1 官方定位（已核实，HF 模型卡）
- circlestone-labs/Anima：2B 动漫特调 DiT，Flow-Matching + Qwen-3 0.6B 文本编码器（标签导向）。
- 标签格式：**空格分隔 tag**（`school uniform`、`white hair`），**只有 score 与选中 LoRA 的精确锚点 token/前缀保留下划线**（`score_7`、`ayachi_nene`、`nene_r18`、`nene_school_uniform`…）。
- 画师语法：官方协议 `@artist name`（如 `@kantoku`、`@mika pikazo`）。
- LoRA：Transformer LoRA（OneTrainer 训练），触发词 + 权重契约在 `loras.json` 的 `prompt_contract`。

### 2.2 项目 Profile 契约（presets.json，生产权威）
| Profile | 质量前缀 | 负面前缀 | rating 标签 | 参数 |
|---|---|---|---|---|
| anima_base_v10 | `masterpiece, best quality, score_7` | `worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration` | safe / sensitive / nsfw | 24 步 / CFG 3 / res_multistep / simple |
| anima_aesthetic_v11 | **无**（正层去掉全部质量词与 score 词） | 同上但**去掉 score 词** | safe / sensitive / nsfw | 同左 |

- rating 按场景分级自动注入且仅一次：R18 → `nsfw`，R15 → `sensitive`，其余 → `safe`（`profileRatingTag`）。
- 标签家族格式化：通用标签**空格**（tag_style: space），exact token/前缀（`ayachi_nene`、`nene_r18` 等）保留下划线（`formatPromptForEngine` 的 score 保护）。
- 负面装配：`assembleNegative` 统一入口，`formatPromptForEngine` 处理 Anima 家族格式；负面独立于 SD 负面开关（basic 模式同样生效）。

### 2.3 本项目实机结论（anima-training-record.md，Prompt A/B）
- **underscore 锚点 token 有效**：身份、魔女服、手持饮品、胸饰、光照和咖啡馆叙事通过（v19 A/B 实测）。
- **R18 质量先验统一**：v18/v20「R18 样张单独挂 `nene_r18` 隔离」是错误设计；统一训练后 `nene_r18` 同时承载内容评级与渲染质量先验，全场景注入可提升皮肤泛光/发丝逆光/暗部暖反弹（93 vs 89 分），日常场景内容安全。
- 内容评级交给显式内容词（`nude` 等）+ rating 词（safe/nsfw），不靠渲染 tag 隔离。
- LoRA 权重：0.65~1.0（min~max），推荐 0.85（portrait/fullbody）、0.82（complex_scene）。

### 2.4 负面装配顺序（统一入口 `assembleNegative`）
官方前缀 → 场景非样板排除词（replace/boilerplate 策略移除 generic）→ 紧凑手/解剖/文字保护（`bad anatomy, bad hands, extra fingers, missing fingers, extra arms, extra legs, deformed, text, watermark, logo, signature`）→ rating 安全（R18 加 `child/loli/underage`，其余加 `nsfw/nude/explicit`）。

### 2.5 外部调研结论（2026-08-14，官方模型卡 + HF 讨论 #96/#112 + lilting/PTT/Reddit/CivArchive 交叉验证）

> 置信度：🟢官方 / 🔵带图实验 / 🟡社区 / ⚪未确认。**项目现有契约与官方推荐完全吻合**（前缀、负面、空格、Aesthetic 去 score、LoRA 训练参数均一致）——以下补充官方细节与社区经验。

**官方规则（🟢 模型卡，作者 tdrussell）**
- 训练数据 = Danbooru tags + 自然语言 + 两者混合 → 三种写法都支持且可任意混合；纯自然语言**至少两句、越详细越好**，可先点名角色再描述长相。
- 标签一律**小写 + 空格**（tokenizer 不做下划线转换，下划线=普通字符）；**唯一例外 score 标签用下划线**（`score_7`）。Danbooru/Gelbooru 不一致时优先 Gelbooru。
- 推荐正面前缀 `masterpiece, best quality, score_7, safe`；推荐负面 `worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration`（**与项目 presets.json 完全一致**）。
- 标签顺序：`[quality/meta/year/safety] [1girl/1boy...] [character] [series] [artist] [general tags]`，节内乱序无妨。
- **权重语法有效但数值要高**：官方示例 `(chibi:2)`；SDXL 习惯的 1.1–1.3 在 Anima 上几乎无感（社区：体型类 tag 要 `:2`–`:3` 才相当于 SDXL `:1.3`）。
- 画师**必须 `@` 前缀**（`@big chungus`），否则效果极弱；可 `@anime coloring` 这类描述。
- 质量词组合全兼容（人工评分词 / score 美学词 / 都不用 / 都用均可）；Aesthetic 版官方建议**正负都不放 score**（"can push it too hard into slop territory"）。
- 采样：Base/Aesthetic 30–50 steps、CFG 4–5、512²–1536²；Turbo CFG 1、8–12 steps。采样器偏好 er_sde（默认）> euler_a（柔和）> dpmpp_2m_sde_gpu（多样）> euler（创造）。写实/油画质感用 beta57 scheduler。
- 标签 dropout：训练时随机 dropout → 不用写全每个相关 tag。

**负面词实证（🔵 lilting.ch）**：官方负面就是短，**不要照搬 Illustrious 的 bad-hands 超长列表**；结构性引导放正面而非负面。社区补充项：白屏跑偏加 `solid background`、负面加 `deviant art`（一例，未充分复现）、NSFW 加 `(shaved pussy)` 正面词而非负面。

**CFG / Shift（🔵🟡）**：CFG 过高会 burn（Anima 比 Illustrious 敏感）；社区 Comfy 常用 CFG 4。Forge Neo 的 **Shift 参数**（DiT 特有）：默认 ~3，标签越多/怕风格漂移调到 **10–24**。

**角色一致性（🟢🟡）**：单角色 Base 会漂、精调 checkpoint 更稳；锁死 = 角色 LoRA + 显式外观 tag。**括号歧义消解语义有效但用空格**：`(re zero)` 而非 `(re_zero)`（与空格规则一致）。双人/多人图**必须逐人点名 + 外观 + 布局**，否则特征串位。角色 tag 查 Anima 专用表（BetaDoggo/danbooru-tag-list 或 animadex.net）。**已落地（2026-08-21）**：项目热门角色 exactTokens/identityTokens 的括号消歧 tag 已全部改为空格形式（`rem (re zero)` 等 21 角色组，rem/surtr 同 seed A/B 实测还原度不降；LoRA 锚点 token 如 `ayachi_nene`、`raiden_shogun` 仍保留下划线）。

**画师混搭（🟢 #112 作者亲答 + 🟡 Reddit 94 分帖）**：与 SDXL 行为不同、更易漂移但属正常（"CLIP 偶然产物，不值得换回 CLIP"）；画师区独立成块 `Mixed style of following artists: (@artist1, @artist2:2.0)` 权重 `:2.0` 起步；少用 masterpiece/score（毁特定画师风格）；长 prompt 掩盖遗忘、越稳。**LLM adapter 是"mini trainable text encoder"，训 LoRA 必须冻结**（llm_adapter_lr=0），遗忘主因 = 训了 adapter 或 LR 过高；LLM 对首 token 权重极高，**超长 prompt 的末尾 tag=加噪声**，遵循官方 tag 顺序。

**LoRA 训练（🟢 #112 + 🟡 社区）**：Base 上训练（merge checkpoint 会写坏兼容性 missing keys）；LR 2e-5、rank 16–32、冻结 adapter（**与项目宁宁/夏目 v20 实测完全一致**）；打标 `newest, safe` 前缀 + 角色/作品/画师 + 外观 + 一句自然语言，tag 训练者 tag 生、NL 训练者 NL 生；推理强度 0.7–0.9 起步。**项目额外实测**：underscore exact token（`ayachi_nene`/`nene_r18`/`best_quality`）必须保留，普通场景词转空格（v19 A/B：胸饰退化为金属环即拒绝）。

**评分标签争议（⚪🟡）**：score 词只适用 Anima 家族，不适用 Pony/SDXL/Illustrious/NoobAI（Raininosi 在 WAI-ANIMA 澄清）；官方推荐 score_7，但 WAI-ANIMA 用户多人反馈"不加 score 更少 AI 味"。→ 按 checkpoint 取舍：Base 留 score_7（官方），Aesthetic 去 score（官方 + 项目已实现）。

### 2.6 Anima 提示词规范速查表（可直接照抄）

**① 正向模板（Base/Aesthetic）**
```
masterpiece, best quality, score_7, safe,
1girl,
<角色标签：空格小写，变体括号，如 nene (casual)>
<作品/项目名>
@<画师（必须@）>
<发型> hair, <瞳色> eyes, <服装>, <配饰>,
<动作/表情/构图 tag...>,
<环境/场景 tag...>.
<1–2 句自然语言补充分镜/氛围>
```
> Aesthetic 版：删掉 score_7（官方建议正负都不用 score）；Base 保留。

**② 负面（官方最短版，可作起点）**
```
worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration
```
按需追加（社区实证）：`solid background, deviant art`。**别照搬 Illustrious 的 bad-hands 超长列表**；结构引导放正面。

**③ 标签格式**：一律**空格+小写**（仅 score 用下划线）；画师**必须 @**；角色变体括号 `hatsune miku (racing)` / `(adult)` / `(append)`；Danbooru/Gelbooru 不一致时用 Gelbooru。

**④ 角色写法**：单角色 = 角色标签 + 外观（发/瞳/服/配饰）；**多角色逐人 [名字+外观] + 布局**；锁死 = 角色 LoRA + 显式外观 tag；歧义查 Anima 专用角色表 / animadex.net。✅ 项目 exactTokens 消歧括号已按官方空格形式落地（`rem (re zero)`，2026-08-21 A/B 验证通过后批量迁移）。

**⑤ 权重/参数**：权重语法有效且**数值要高**（`(chibi:2)`；角色/画师区 `:2.0` 起步）；Base/Aesthetic 30–50 steps、CFG 4–5；Turbo CFG 1、8–12 steps；采样器 er_sde（默认）→ euler_a（柔和）→ dpmpp_2m_sde_gpu（多样）→ euler（创造）；Forge Shift 默认 ~3、标签多调到 10–24；分辨率 512²–1536²。**项目生产当前 24 步/CFG 3 为实机收敛值**（比官方保守，A/B 验证过）。

**⑥ LoRA（宁宁/夏目）**：底模必须 anima-base-v1.0（Base，勿在 merge 上训）；训练 LR 2e-5、rank 16–32、**冻结 LLM adapter**；打标 `newest, safe` 前缀 + 角色/作品/画师 + 外观 + 一句 NL；推理强度 0.7–0.9（项目 0.85）；遗忘 = LR 过高或训了 adapter。

---

## 3. WAI Illustrious SDXL v17（Danbooru 标签流）

> 外部调研（子代理 72db3d95）：Illustrious 官方卡原文 + WAI 官方卡（CivitAI 827184 存档）+ NoobAI/AIDXL/SeaArt 官方指南 + WAI 讨论区 289 条，全部直接抓取核对；以下先给官方契约与本地映射。

### 3.1 官方契约（LyliaEngine/waiIllustriousSDXL_v170，已核实）
- 官方正层模板：`,masterpiece,best quality,amazing quality,`（**空格原样保留**、仅出现一次；`promptPolicy.ts` 对 SD 不再 norm 回下划线）。
- 官方负面模板：`bad quality,worst quality,worst detail,sketch,censor,`
- 四级 rating：`general` / `sensitive` / `nsfw` / `explicit`（按场景分级出现且仅一次）。
- 参数：30 步 / CFG 6 / Euler a + Auto hires 1.5× / 20 步 / denoise 0.4（WebUI Anime6B 优先）。

### 3.2 本地映射（promptCompiler.ts）
- 格式：单一逗号标签流，Danbooru 下划线。
- 画师：规范 Danbooru tag（kantoku、mika_pikazo…），专家模式最多混 2 位白名单画师。
- LoRA：`<lora:ayachi_nene_v18_wd14:0.8>`（场景作者权重 0.52~0.95）。
- 标准范例（宁宁教室）：
  ```
  masterpiece, best quality, amazing quality, general, 1girl, solo, ayachi_nene, nene_school_uniform, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, hair_ribbon, school_uniform, looking_back, smile, classroom_window, afternoon, clear_sky, medium_shot, window_light, <lora:ayachi_nene_v18_wd14:0.8>
  ```

### 3.3 外部调研结论（2026-08-14，官方卡原文抓取 + NoobAI/AIDXL/SeaArt 指南 + WAI 讨论区交叉验证）

> 置信度：🟢官方 / 🔵带图实验 / 🟡社区 / ⚪未确认。**项目 WAI v17 前缀与官方卡逐字一致**（正向 `masterpiece, best quality, amazing quality,` / 负向 `bad quality, worst quality, worst detail, sketch, censor,`）——可冻结为基准。

**官方参数（🟢 WAI 官方卡，CivitAI 827184）**：Steps 15–30、CFG 5–7、Euler a、原生分辨率 >1024²（示例 1024×1344）、Hires 1.5× R-ESRGAN 4x+ Anime6B denoise 0.35–0.5。官方显式告诫**别堆太多质量/美学标签、负面别过长（会糊）**。

**Illustrious 本体（🟢 OnomaAIResearch early-release-v0）**：训练于 Danbooru2023；质量标签分级 worst/bad/average/good/best/masterpiece；Euler a、Steps 20–28、CFG 5–7.5；**构图标签（close-up/cowboy shot 等）勿叠**。

**⚠️ score_9/score_8_up 是 Pony 体系，纯 Illustrious/WAI 不认**（WAI 讨论区确认）——不要用（区别于 Anima 的 score_7）。

**采样推荐（🟢🟡 跨来源合成）**：Steps 25–30、CFG 5–6.5（精细化 4.5–5）、Euler a（DPM++ 2M Karras 高步数备选）；负面短清单在 CFG 4.5–7 有效；v17 偏 2.5D，回二次元负面加 `realistic, 3d`。

**标签规范（🟢 NoobAI/AIDXL/SeaArt 官方）**：`,` 分隔标签流、下划线转空格、**标签内含括号必须转义 `\(...\)`**（WebUI 权重冲突）、**顺序=重要度**（主体→角色名(系列)→系列→画师→特征→服装→场景→风格→质量，质量可前置）；画师标签**裸写不加 `by`**（AIDXL 例外）。

**LoRA（🟢 AIDXL 官方 + 🟡 社区）**：权重 0.6–0.9、多 LoRA ~0.8、同时 ≤3–4 个、统一训练底模；**有角色 LoRA 后删掉重复特征加固标签，只补换装**（身份与服装解耦）。

**角色身份（🟢 SeaArt 官方）**：四档识别策略 + 「Danbooru >100 图可裸出，否则 LoRA」判据；锁角色 = 发色+发型+瞳色+标志服；角色名(系列名) 消歧（`ayachi nene` 已天然无歧义）。

**待实机验证后写死（⚪ 社区共识，无官方数值）**：LoRA 权重区间、CFG 下限 4.5–5、强化负面清单（realistic/3d）。

### 3.4 SD/WAI 提示词规范速查表（可直接照抄，基准 WAI v17.0）

> ☑=官方已验证 / ◐=社区共识。**注意：与 Anima 的差异点——SD 系权重语法有效、负面可比 Anima 稍长但仍宜短、score_9 禁用。**

**① 质量前缀（置首，官方）**
```
masterpiece, best quality, amazing quality,
```
上限 3–5 个质量词；**勿堆** ultra-detailed/4k/HDR（官方告诫会糊）。二次元锁定变体（NoobAI 流派）：`masterpiece, best quality, newest, absurdres, highres, safe,`。

**② 评分标签**：纯 Illustrious/WAI **禁用 score_9/score_8_up**（Pony 体系，浪费 token）。

**③ 负面词**
- 官方精简版：`bad quality, worst quality, worst detail, sketch, censor,`
- 强化版（仍控制 ≤10–15 个）：`bad quality, worst quality, worst detail, sketch, censor, lowres, bad anatomy, bad hands, extra digits, jpeg artifacts, watermark, text, blurry, realistic, 3d, nsfw`
- v17 偏 2.5D：回二次元加 `realistic, 3d`；白斑加 `lens flare, particles, dust`；红瞳乱入加 `heart pupil`。

**④ 标签格式**：`,` 分隔标签流；下划线→空格（`blue_hair`→`blue hair`）；**标签内含括号必须转义**（`rem (re zero)`，WebUI 写作 `rem \(re zero\)`）；顺序=重要度：`<1girl/1boy> → <角色名(系列)> → <系列> → <画师> → <特征> → <服装> → <场景/动作> → <风格> → <质量>`；>77 token 自动分包、遵循度骤降，用 `BREAK` 手动分块且不跨块重复概念。

**⑤ 角色写法**：`角色名 (系列名)` + 系列标签；Danbooru >100 图可裸出否则 LoRA（SeaArt 判据）；锁身份 = 发色+发型+瞳色+标志服，身份锚与场景词分开放；**有角色 LoRA 后删重复特征加固标签、只补换装**；画师标签裸写不加 `by`，放中段、最多 2 位（项目白名单）。

**⑥ 权重**：`(tag:1.2)` 有效；核心特征 `(role:1.1–1.2)`；风格标签 `(anime coloring, anime screencap:1.2–1.3)`；质量词可 `(amazing quality:1.3–1.5)`；角色 LoRA 0.6–0.9、多 LoRA 0.8、同时 ≤3–4 个、统一训练底模。

**⑦ 参数（WAI 官方区间）**：Steps 25–30（官方 15–30，复杂 50+）/ CFG 5–6.5（官方 5–7，精细化 4.5–5）/ Euler a / 原生分辨率 >1024²（1024×1344）/ Hires 1.5× steps 20 R-ESRGAN 4x+ Anime6B denoise 0.35–0.5；官方推荐 forge-neo。

---

## 4. 三引擎负面装配对比（速查）

| 引擎 | 负面策略 | 标准前缀 | 特殊 |
|---|---|---|---|
| Krea 2 | **恒空** | — | ConditioningZeroOut；不填负面 |
| Anima Base | 官方前缀 + 保护 + rating | `worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration` | 独立于 SD 负面开关（basic 模式同样生效） |
| Anima Aesthetic | 同 Base 去 score 词 | 同上去 score_1/2/3 | 同左 |
| WAI v17 | 官方前缀 + 保护 + rating | `bad quality, worst quality, worst detail, sketch, censor` | 受「启用负面」开关控制 |

---

## 5. 成人内容三引擎配置（2026-08-14 实机结论）

| 引擎 | 是否可出 R18 | 方式 | 关键陷阱 |
|---|---|---|---|
| Krea 2 | ✅（需去审查链路） | Heretic 编码器 + standard rebalance（mult 1.1 / normalize false）+ 裸体词前置散文 | normalize_taps=true 崩溃；aggressive 预设拒绝出裸；服装描述必须写成「已脱下」 |
| Anima | ✅ 原生 | rating 词（nsfw）+ 显式内容词（nude 等）+ 内容评级词（nene_r18 兼质量先验） | 无（本机多轮实测稳定） |
| WAI v17 | ✅ 原生 | rating explicit + 显式内容词 | 需 WebUI/Comfy 双人支持差异注意 |

- 热门角色 18 人全部 adult（用户「全部开放」决策）；fail-closed 契约保留：`adultEnabled=false` 与 unknown/underage 分类仍拒绝成人内容（`blueprintEligible`/`recipeEligible` 双重把关）。

---

## 6. 给精细化配置人员的行动清单

### 6.1 项目硬性契约（`quality-prompt-contract.js`，校验失败即红）
- 短提示词 **22-26 个 token**；场景实体词（地点/天气/道具）**2-4 个**；动作/情绪词合计 **≤2**（情绪、动作各 ≤1）；氛围/光照词 **≥2**。
- 质量词**必须恰好 3 个**：`masterpiece, best_quality, score_7`（Anima Base 路径）；缺一即错。
- 角色锚点必含（宁宁 9 项 / 夏目 8 项，见 `IDENTITY_ANCHORS`）；质量控制词必含（`nene_r18` / `natsume_r18`）。
- 评级词必含：R18 → `nsfw`，否则 `safe`；safe prompt **严禁泄漏显式成人词**（nude/naked/nipples/pussy/explicit 等 14 词黑名单）。
- 画师格式 `@artist name`（小写字母数字空格/下划线开头），家庭画师 `@muririn`/`@kobuichi` 必含（短提示词路径）。
- Krea 2 候选**不得**含画师 tag、score、`<lora:>` 语法。

### 6.2 行动项
1. **Krea 2 散文**：按 §1.2 结构重写/校验所有 `promptProse`（2026-08-15 扩容后每角色 6 原型（含 3 日常感）+ 3 成人共 9 场景 × 18 角色 + 3 通用成人）；检查无玄学词、裸体词前置、服装「已脱下」。
2. **Anima 标签**：校验各角色 `identityTokens`/`exactTokens`/`outfit.tokens` 的空格/下划线规范（通用标签空格、锚点 token 下划线）；`@artist` 画师格式。
   - ✅ **已完成（2026-08-21）**：exactTokens/identityTokens/aliases 的 Danbooru 消歧括号已从下划线（`rem_(re_zero)`）批量迁移为官方空格形式（`rem (re zero)`），覆盖 21 个角色组 × 3 个数据文件（popular-characters.json / characters.json / character-reference-standards.json）；rem/surtr 同 seed A/B 实测还原度不降后落地；`test-popular-content.js` 断言同步更新。LoRA 锚点 token（`ayachi_nene` 等）与 `research` 文献字段中的 Danbooru 标签名保留不变。工具：`scripts/maintenance/migrate-exact-tokens-space.js`、A/B 脚本 `ab-exact-tokens-space.js`。
3. **SD 标签**：校验 WAI 路径质量前缀原样（`masterpiece, best quality, amazing quality` 带空格）、rating 词（general/sensitive/nsfw）、场景 token 22-26 个、实体词 2-4、氛围词 ≥2。
4. **A/B 验证**：用 `generate-scene-showcase-candidates.js` 按引擎出候选，`image-inspect -t audit` 8 维审核，人工终审定稿。
5. **回填**：本文件 §2.5 / §3.3 待外部调研项，子代理返回后合入对应章节。

---

## 附录 A. 来源与置信度

| 来源 | 用途 | 置信度 |
|---|---|---|
| krea-ai/krea-2 README + docs/prompting.md + 技术报告 | Krea 2 官方 | 已验证 |
| DreamFast/Qwen3-VL-4b-Heretic-ComfyUI | 去审查编码器 | 已验证（本机实图） |
| TuZZiL/ComfyUI-ConditioningKrea2Rebalance README | rebalance 预设语义 | 已验证（本机实图） |
| circlestone-labs/Anima 模型卡 | Anima 定位/格式 | 已验证 |
| LyliaEngine/waiIllustriousSDXL_v170 模型页 | WAI 官方正/负面模板 | 已验证 |
| OnomaAIResearch/Illustrious-xl-early-release-v0 卡 | Illustrious 本体指南 | 已验证 |
| NoobAI-XL 1.1 卡（Laxhar）+ AIDXL README + SeaArt 官方指南 | 标签规范/顺序/转义/LoRA/角色判据 | 已验证 |
| civarchive.com WAI 卡存档 + WAI 讨论区高赞 | 参数/score 澄清/负面 | 已验证/社区 |
| anima-training-record.md（本项目） | Anima Prompt A/B 实机 | 已验证 |
| PTT AI_Art / CivArchive / HF discussions | 社区经验 | 社区经验 |
