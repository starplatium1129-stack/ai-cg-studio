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
| 质量词 | **禁用**（把输出拉向 generic AI gloss） | Base：`masterpiece, best quality, score_7`；Aesthetic：**全部去掉** | `masterpiece, best quality, amazing quality`（官方模板） |
| 权重语法 `(tag:1.2)` | 无效（被当字面文本） | 不适用（标签流） | 有效（A1111 语法） |
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

**角色一致性（🟢🟡）**：单角色 Base 会漂、精调 checkpoint 更稳；锁死 = 角色 LoRA + 显式外观 tag。**括号歧义消解语义有效但用空格**：`(re zero)` 而非 `(re_zero)`（与空格规则一致）。双人/多人图**必须逐人点名 + 外观 + 布局**，否则特征串位。角色 tag 查 Anima 专用表（BetaDoggo/danbooru-tag-list 或 animadex.net）。项目热门角色 exactTokens 目前是 `rem_(re_zero)` 下划线形式——**按 Anima 空格规则应改 `rem (re zero)`**（待 A/B 验证后落地）。

**画师混搭（🟢 #112 作者亲答 + 🟡 Reddit 94 分帖）**：与 SDXL 行为不同、更易漂移但属正常（"CLIP 偶然产物，不值得换回 CLIP"）；画师区独立成块 `Mixed style of following artists: (@artist1, @artist2:2.0)` 权重 `:2.0` 起步；少用 masterpiece/score（毁特定画师风格）；长 prompt 掩盖遗忘、越稳。**LLM adapter 是"mini trainable text encoder"，训 LoRA 必须冻结**（llm_adapter_lr=0），遗忘主因 = 训了 adapter 或 LR 过高；LLM 对首 token 权重极高，**超长 prompt 的末尾 tag=加噪声**，遵循官方 tag 顺序。

**LoRA 训练（🟢 #112 + 🟡 社区）**：Base 上训练（merge checkpoint 会写坏兼容性 missing keys）；LR 2e-5、rank 16–32、冻结 adapter（**与项目宁宁/夏目 v20 实测完全一致**）；打标 `newest, safe` 前缀 + 角色/作品/画师 + 外观 + 一句自然语言，tag 训练者 tag 生、NL 训练者 NL 生；推理强度 0.7–0.9 起步。**项目额外实测**：underscore exact token（`ayachi_nene`/`nene_r18`/`best_quality`）必须保留，普通场景词转空格（v19 A/B：胸饰退化为金属环即拒绝）。

**评分标签争议（⚪🟡）**：score 词只适用 Anima 家族，不适用 Pony/SDXL/Illustrious/NoobAI（Raininosi 在 WAI-ANIMA 澄清）；官方推荐 score_7，但 WAI-ANIMA 用户多人反馈"不加 score 更少 AI 味"。→ 按 checkpoint 取舍：Base 留 score_7（官方），Aesthetic 去 score（官方 + 项目已实现）。

---

## 3. WAI Illustrious SDXL v17（Danbooru 标签流）

> 外部调研进行中（子代理 72db3d95）；以下先给官方契约（项目已核实）与本地映射。

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

### 3.3 待外部调研回填
- [ ] Illustrious-XL 官方提示词指南细节（onoma 模型卡）
- [ ] score_9/score_8_up 评分标签的社区共识与在 WAI 上的有效性
- [ ] 权重语法 `(tag:1.2)` 在 Illustrious 上的社区经验
- [ ] 角色 LoRA 权重区间与多 LoRA 叠加的社区共识
- [ ] CFG 6 vs 7 的标签遵循度社区对比

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
1. **Krea 2 散文**：按 §1.2 结构重写/校验所有 `promptProse`（每角色 3 原型 + 1 成人共 4 场景 × 18 角色 + 3 通用成人）；检查无玄学词、裸体词前置、服装「已脱下」。
2. **Anima 标签**：校验各角色 `identityTokens`/`exactTokens`/`outfit.tokens` 的空格/下划线规范（通用标签空格、锚点 token 下划线）；`@artist` 画师格式。
   - ⚠️ **待 A/B**：exactTokens 的 Danbooru 消歧括号当前是下划线（`rem_(re_zero)`），Anima 官方规则是空格（`rem (re zero)`）。先出 A/B 图确认空格形式在 Anima 上还原度不降，再决定是否批量改 18 角色（影响 `test-popular-content.js` 的 exactTokens 断言）。
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
| anima-training-record.md（本项目） | Anima Prompt A/B 实机 | 已验证 |
| PTT AI_Art / CivArchive / HF discussions | 社区经验 | 社区经验 |
| OnomaAIResearch/Illustrious-XL 文档 | Illustrious 指南 | 待子代理回填 |
