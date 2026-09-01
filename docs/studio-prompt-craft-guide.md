# AI-CG-Studio 专属提示词工程专家指南（studio-prompt-craft）

> **适用范围**：AI-CG-Studio 全模块（文生图、图生图、局部换装、场景蓝图、故事分镜、角色剧场）。  
> **核心使命**：为项目量身定制高质量提示词，彻底分流 **Anima（Danbooru 结构化 Tag 流）** 与 **Krea 2（纯英文自然语言散文 Prose 流）**，并严密支持 **SFW（全年龄/唯美/日常）** 与 **NSFW（R18/成人显式/高情欲）** 双分级体系。

---

## 目录
1. [双引擎核心差异与铁律](#一双引擎核心差异与铁律)
2. [SFW（全年龄）提示词编写规范与范例](#二sfw全年龄提示词编写规范)
3. [NSFW（R18 成人显式）提示词编写规范与范例](#三nsfw-r18-成人显式提示词编写规范)
4. [热门角色库与服装对齐速查表](#四热门角色库与服装对齐速查表)
5. [双引擎分流编译标准模板](#五双引擎分流编译标准模板)
6. [质量红线与质检 Checklist](#六质量红线与质检-checklist)

---

## 一、双引擎核心差异与铁律

| 维度 | Anima (ComfyUI / Pencil) | Krea 2 (Turbo 12B DiT) |
|---|---|---|
| **文本编码器** | Qwen-3 0.6B（标签与权重导向） | Qwen3-VL 4B（视觉语言大模型，深度语义理解） |
| **提示词形态** | **Danbooru 标签流**（小写、下划线连接、逗号分隔） | **纯英文自然语言散文**（连贯段落，严禁 Tag 堆砌） |
| **质量/前缀** | `score_9, score_8_up, masterpiece, best_quality, absurdres` | **严禁写质量词**（Qwen 会当普通词破坏画面或导致 AI 塑料感） |
| **权重语法** | 支持 `(tag:1.1)`, `(tag:1.2)`, `[tag]` 强调 | **严禁权重语法**（不认括号权重，强调靠自然语言复述或细节展开） |
| **角色锚定** | exact token（如 `ayachi_nene, purple_eyes`） | **角色名 + 原作系列 + 标志性外貌散文**（`Nene from Sanoba Witch, ...`） |
| **负面提示词** | **必须配置**（包含手部、肢体变形、低画质保护） | **本地 Turbo 路径负面恒空**（CFG≈0 负面失效；排除项在正向句末追加） |
| **分级控制** | `safe`, `sensitive`, `nsfw`, `explicit`, `rating:explicit` | 散文中自然叙述场景的亲密程度、裸露状态与动作细节 |

### ⚡ 核心铁律（不可违背）
1. **Krea 2 禁 Tag 令**：在 Krea 2 引擎中严禁输出 `1girl, solo, cute, white_hair, highres` 这种 Danbooru 逗号堆砌，必须转化为流畅生动的英文段落。
2. **Krea 2 负面恒空**：本地 Turbo 路径下 negative 必须为空；若需排除元素（如排除路人），在正向散文结尾追加 `..., no text, no characters, no extra people`。
3. **Anima 权重与语法保护**：Anima 权重严禁超过 `1.5`（推荐 `1.05~1.2`），括号必须严格成对闭合；必须携带标准负面词保护手部与解剖。
4. **角色名必带作品名**：无论是 Anima 还是 Krea，角色描述必须附带原作名（如 `Raiden Shogun from Genshin Impact`），避免同名角色歧义。

---

## 二、SFW（全年龄）提示词编写规范

SFW 场景聚焦于**角色神韵、唯美光影、材质细节、场景氛围与情感叙事**。

### 1. Anima SFW 结构化 Tag 体系
- **标准分级前缀**：`masterpiece, best_quality, newest, absurdres, score_9, score_8_up, rating:general, safe, 1girl, solo`
- **角色核心 Tag**：角色专有 Tag、发型发色、瞳色、标志性饰品
- **服装与材质**：具体服装名、衣物细节（`pleated_skirt, white_shirt, ribbon`）、布料质感
- **表情与姿态**：微表情（`gentle_smile, looking_at_viewer, blushing`）、肢体动作（`sitting_on_chair, holding_book`）
- **场景与环境**：背景要素（`classroom, sunset, window, flying_petals`）
- **镜头与光照**：`cinematic_lighting, golden_hour, depth_of_field, upper_body, dynamic_angle`
- **负面词（Negative）**：`worst_quality, low_quality, bad_anatomy, bad_hands, missing_fingers, extra_fingers, blurry, cropped, watermark, text, signature`

### 2. Krea 2 SFW 散文（Prose）9段分桶法
散文需组织为一个连贯且画面感极强的英文段落，涵盖以下 9 个要素：
1. **[Lead 风格短语]**：`An exquisite anime-style illustration of ...` 或 `A cinematic anime film still depicting ...`
2. **[主体身份]**：`Ayachi Nene from Sanoba Witch, a beautiful young girl with long silky white hair in low twin-tails and expressive purple eyes ...`
3. **[服装与质感]**：`She is wearing her signature navy school uniform with crisp white collar, neat pleats, and a delicate pink ribbon at her chest.`
4. **[动作姿态]**：`She sits quietly beside a large sunlit window in the quiet library, gently holding an open novel with both hands.`
5. **[情绪与表情]**：`She looks up towards the viewer with a soft, shy smile and a gentle blush on her porcelain cheeks.`
6. **[场景与环境]**：`The background features tall wooden bookshelves filled with vintage books, and dust motes dancing in the warm afternoon air.`
7. **[镜头景别]**：`Medium shot, focusing on her upper body and delicate facial expression.`
8. **[光影氛围]**：`Warm golden hour sunlight streams through the glass, casting long soft shadows and a radiant rim light across her hair.`
9. **[Medium 媒介收尾]**：`Clean line art, rich vibrant colors, high-end animation key visual style.`

---

## 三、NSFW (R18 成人显式) 提示词编写规范

> **项目原则**：AI-CG-Studio 本机环境默认支持全开 NSFW/R18。提示词应准确呈现角色的成熟魅力、情欲张力、身体细节与显式性爱动作，杜绝敷衍，直击画面核心。

### 1. 尺度梯度分类
- **Level 1（微工口 / 诱惑 / Lingerie）**：透视睡衣（`translucent_nightgown`）、情趣内衣（`lingerie, lace_bra, panties`）、湿身（`wet_clothes, translucent`）、拉扯胖次（`pulling_down_panties`）、掀裙（`skirt_lift`）、微露乳晕/乳沟。
- **Level 2（显式裸体 / 自慰 / 抚摸）**：全裸（`completely_nude`）、私处特写（`pussy, cameltoe, nipples, bare_breasts`）、自慰（`female_masturbation, fingering`）、乳交（`paizuri`）、口交（`fellatio, blowjob`）。
- **Level 3（深度交尾 / 体位 / 体液 / R18 巅峰）**：
  - **经典体位**：正常位（`missionary`）、后背位/后入（`doggystyle, from_behind`）、骑乘位（`cowgirl_position`）、交尾压（`mating_press`）、对坐位（`facing_each_other`）。
  - **显式生理与体液**：肉棒插入（`vaginal_penetration, penis_in_pussy`）、内射/中出（`internal_cumshot, creampie`）、潮吹/爱液（`pussy_juice, vaginal_fluid`）、精液喷溅（`cum_on_body, cum_on_breasts, cum_on_face`）。
  - **情欲表情**：阿嘿颜（`ahegao, roll_eyes, tongue_out`）、高潮红晕（`heavy_blush, deep_blush`）、情欲泪水（`crying_with_pleasure`）、急促喘息（`heavy_breathing, parted_lips, drooling`）。

### 2. Anima NSFW 结构化 Tag 体系
- **标准分级前缀**：`masterpiece, best_quality, newest, absurdres, score_9, score_8_up, rating:explicit, nsfw, explicit, uncensored, 1girl, 1boy, heterosexual, sex`
- **角色专属 R18 词**（如有）：`ayachi_nene, nene_r18` 或 `shiki_natsume, natsume_r18`
- **体位与行为 Tag**：`missionary, vaginal_penetration, penis, pussy, spreading_legs, grabbing_sheets`
- **身体与体液细节**：`bare_breasts, detailed_nipples, sweating, heavy_blush, vaginal_fluid, cum_in_pussy, creampie`
- **表情与眼神**：`ahegao, parted_lips, tongue_out, drooling, teary_eyes, love_eyes, half_closed_eyes`
- **环境与光影**：`bedroom, messy_bed, disheveled_sheets, soft_indoor_lighting, close_up, dynamic_angle`
- **负面词（Negative）**：必须包含防畸变与常规保护，同时**严禁将 nsfw, nude 加入负面**！

### 3. Krea 2 NSFW 自然语言显式散文（Explicit Prose）
Krea 2 凭借 Qwen3-VL 强大的语义空间理解能力，能够通过细腻生动的英文段落精准渲染两性亲密的肢体拓扑与生理反应。

---

## 四、热门角色库与服装对齐速查表

在编写提示词时，必须与项目角色库（`data/characters/`）设定与关键外貌严格对齐：

| 角色 ID | 角色名 / 出处 | Anima 核心 Tags | Krea 2 核心外貌 Prose | 常用服装 ID |
|---|---|---|---|---|
| `nene` | **Ayachi Nene**<br>(Sanoba Witch) | `ayachi_nene, white_hair, purple_eyes, low_twintails, hair_ribbon, ahoge` | `Ayachi Nene from Sanoba Witch, with silky white hair tied in low twin-tails, distinctive pink hair ribbons, an expressive ahoge, and luminous purple eyes` | `official_witch`, `official_school`, `swimsuit`, `lingerie`, `nude` |
| `natsume` | **Shiki Natsume**<br>(Cafe Stella) | `shiki_natsume, black_hair, very_long_hair, golden_yellow_eyes, mole_under_eye, two_red_hairclips` | `Shiki Natsume from Cafe Stella to Shinigami no Chou, with very long glossy black hair, two small red hairclips, striking golden-yellow eyes, and a charming beauty mark mole under her left eye` | `cafe_maid`, `official_qipao`, `casual_winter`, `sexy_nightgown`, `nude` |
| `raiden` | **Raiden Shogun**<br>(Genshin Impact) | `raiden_shogun, purple_hair, braided_hair, purple_eyes, hair_ornament, mole_under_eye` | `Raiden Shogun from Genshin Impact, a regal woman with long braided dark purple hair, an elaborate golden hair ornament, glowing violet eyes, and a subtle mole under her right eye` | `official_kimono`, `battle_armor`, `sensual_lingerie`, `nude` |
| `kaltsit` | **Kal'tsit**<br>(Arknights) | `kal'tsit, green_hair, short_hair, green_eyes, cat_ears, lynx_ears` | `Kal'tsit from Arknights, an intellectual lynx-race woman with shoulder-length pale green hair, pointed feline ears atop her head, and calm piercing emerald eyes` | `official_medic`, `maid_dress`, `tactical_swimsuit`, `nude` |
| `hoshino` | **Takanashi Hoshino**<br>(Blue Archive) | `takanashi_hoshino, pink_hair, long_hair, heterochromia, blue_eye, yellow_eye, halo` | `Takanashi Hoshino from Blue Archive, a sleepy and petite girl with messy long pastel pink hair, striking heterochromia (one blue eye, one yellow eye), and an ethereal glowing halo hovering above her head` | `official_school`, `swimsuit_sleeveless`, `oversized_hoodie`, `nude` |
| `kurumi` | **Tokisaki Kurumi**<br>(Date A Live) | `tokisaki_kurumi, black_hair, twintails, uneven_twintails, red_eye, golden_clock_eye, hair_ribbon` | `Tokisaki Kurumi from Date A Live, an alluring girl with uneven black twintails, an crimson right eye, and a distinct golden clockface inside her left eye` | `astral_dress`, `gothic_lolita`, `crimson_lingerie`, `nude` |
| `makima` | **Makima**<br>(Chainsaw Man) | `makima_\(chainsaw_man\), red_hair, braided_hair, golden_eyes, ringed_eyes` | `Makima from Chainsaw Man, a captivating woman with long light red-orange braided hair, bangs framing her face, and hypnotic golden eyes with concentric circular rings` | `formal_suit`, `nurse_outfit`, `tight_dress`, `nude` |

---

## 五、双引擎分流编译标准模板

当用户提出一个创意想法（如：“宁宁在温泉里害羞地泡澡，只有一条湿毛巾遮掩”）时，**必须同时提供 Anima 与 Krea 2 的对应编译结果，并明确标出 SFW 或 NSFW 属性**。

### 标准输出格式范例：

```markdown
### 🎨 【创意输入】：宁宁在私人温泉中害羞地泡澡，微透湿毛巾遮胸（SFW/微工口 R15）

---

#### 🌟 引擎 1：Anima (ComfyUI / Pencil) - 结构化 Danbooru Tag 流
**Positive Prompt:**
masterpiece, best_quality, newest, absurdres, score_9, score_8_up, rating:sensitive, safe, 1girl, solo, ayachi_nene, white_hair, low_twintails, purple_eyes, pink_hair_ribbons, ahoge, onsen, hot_springs, steam, sitting_in_water, wet_skin, wet_hair, soaking, small_towel_on_head, holding_towel, wet_towel_over_chest, cleavage, blushing, heavy_blush, shy_expression, looking_at_viewer, outdoors, bamboo_fence, rock_pool, evening, warm_lantern_light, soft_lighting, depth_of_field, upper_body

**Negative Prompt:**
worst_quality, low_quality, normal_quality, bad_anatomy, bad_hands, missing_fingers, extra_fingers, fused_fingers, poorly_drawn_face, mutated_hands, blurry, jpeg_artifacts, text, watermark, signature, logo, cropped, bad_proportions, deformed

---

#### 🚀 引擎 2：Krea 2 (Turbo) - 纯自然语言 Prose 散文流
**Positive Prompt (Prose):**
An enchanting and serene anime-style illustration of Ayachi Nene from Sanoba Witch enjoying a peaceful evening bath in a traditional outdoor Japanese hot spring. She has long, glistening wet white hair tied into low twin-tails, adorned with her soft pink ribbons, with an expressive wet ahoge atop her head and deep, luminous purple eyes. She is sitting partially submerged in the clear, steaming geothermal water, clutching a small soaked white towel across her chest that clings semi-translucently to her skin, revealing the subtle curves of her collarbone and shoulders. A profound, bashful blush spreads across her cheeks as she gazes shyly up at the viewer with parted lips. The tranquil onsen is surrounded by natural weathered stone, rustic bamboo privacy fences, and lush maple foliage enveloped in gentle rising mist. Warm amber lantern light glows softly through the steam, casting beautiful golden highlights across her wet skin and the rippling water surface. Medium upper-body shot, romantic and intimate atmosphere, crisp clean line art, rich pastel anime visual novel coloring, high-end key visual finish, no text, no extra characters.

**Negative Prompt:**
*(恒空，Turbo CFG=0 本地模式负面失效)*
```

---

## 六、质量红线与质检 Checklist

在交付或生成提示词时，必须对照以下 6 项标准进行核查：

- [ ] **1. 引擎分流彻底**：Anima 保持标准小写下划线 Tag；Krea 2 完全转换成地道优美的英文长散文，无任何残留 Tag 或下划线。
- [ ] **2. 负面词策略准确**：Anima 包含标准解剖防护；Krea 2 本地 Turbo 负面保持为空（排除词写在正向句末）。
- [ ] **3. 角色特征无遗漏**：是否正确附带原作 Franchise？发型、发色、瞳色、核心饰品（如 Natsume 的泪痣与红发夹、Nene 的粉发带与呆毛）是否准确锁定？
- [ ] **4. 分级尺度与情境契合**：SFW 突出唯美构图与意境；NSFW 姿势、体位、体液、私处细节与阿嘿颜/情欲表情描写是否到位且真实？
- [ ] **5. 拒绝模板化套话**：严禁无实质内容的通用套话堆砌，每一个动作、光影和背景都必须与用户指定的场景细节强关联。
- [ ] **6. 语法与权重安全**：Anima 权重不超过 1.5，无未闭合括号；Krea 2 不包含 `(word:1.2)` 语法或 `score_9/masterpiece` 废词。
