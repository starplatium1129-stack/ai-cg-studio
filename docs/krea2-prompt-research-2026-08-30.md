# Krea 2 提示词工程全面调研报告（社区 × 官方）

> 调研日期：2026-08-30 · 目的：为项目 Krea 2 提示词全面优化提供权威依据（动漫向 + 真人向全覆盖）。
> 信源分级：**[官方]** = krea.ai 官方文档/博客/GitHub/模型卡；**[合作方]** = 官方 API 合作伙伴（fal/Replicate 等）发布的官方口径；**[社区共识]** = 多来源交叉一致的实践结论；**[个别]** = 单一来源观点；**[未证实]** = 无可靠出处。
> 与 `docs/krea2-prompt-writing-guide.md`（2026-08-14）的关系：本报告为权威基座，两者冲突处以本报告为准；旧指南中过时表述的修正清单见 §11。

---

## TL;DR（一页速览）

1. **Krea 2 不是 SD3.5 系，是 Krea 从零训练的 12B DiT**（Qwen3-VL 文本编码器 + Qwen Image VAE）。项目记忆/AGENTS.md 里「Krea 2 (SD3.5)」的标注是误传，必须修正。
2. **官方总纲只有一条：用自然语言写长详细提示词**。「Long detailed prompts yield best results」。Tag 堆砌、`(word:1.2)` 权重、`score_9`/`masterpiece` 质量词全部无效，甚至有害。
3. **短提示 ≠ 劣质提示**：官方内置 prompt expander 自动扩写（creativity 参数控制扩写幅度，`raw` = 零扩写）。项目走 ComfyUI 本地路径时，扩展器行为由工作流模板决定，写满精确长提示时应关掉 expander。
4. **负面提示词要分清场景**：托管网页版负向框有效；本地 Turbo（CFG≈0）负向几乎失效——项目「负面恒空」的做法与官方推荐一致，是对的。真需要排除元素时用正向句末追加 `, no text` 或正向内负权。
5. **动漫向**：官方钦定 Krea 2 Medium 变体「尤其擅长插画/动漫」；动漫最容易翻车的是「偏厚涂/偏写实/糊」，对策是明写 `cel shading / flat colors / crisp line art` 词族（项目 2026-08-30 已按此思路改过 `inferredKreaStyle`，方向正确，建议推广到全部动漫配方）。
6. **真人向**：写光线与材质语言（`85mm f/1.4`、`Rembrandt lighting`、`softbox`、`film grain at ISO 800`），别堆 `ultra detailed`；去 AI 味的核心是写「真实世界的不完美细节」（freckles、flyaway hairs、visible pores）。
7. **角色一致性官方主线 = 角色 LoRA**（RAW 上训、Turbo 上应用，官方 FAQ 原话）；无 LoRA 时靠「角色名+系列+外貌散文」锚定——与项目现状（18 热门角色无 LoRA、靠 identityProse）一致。
8. **通用模板**：主体 → 服装 → 动作 → 场景 → 镜头 → 光线 → 风格/媒介词收尾。风格词位置：LoRA 触发词放**最前**，工作室名/媒介词放**末尾**（官方明确「命名工作室收尾」）。

---

## 一、模型事实核对（纠正「SD3.5」误传）

| 维度 | 事实 | 出处 |
|---|---|---|
| 定位 | Krea 从零训练的「审美优先」基础图像模型，非 SD3.5/FLUX/SD 系微调 | [官方] 技术报告 |
| 主干 | 单流 MMDiT（Diffusion Transformer），官方口径 12B dense DiT（GQA + gated sigmoid attention + SwiGLU + RMSNorm/QKNorm + 3D Axial RoPE） | [官方] krea-2-open-source / 技术报告 |
| 文本编码器 | **Qwen3-VL（视觉语言大模型）** + 多层特征聚合（MFA），替代 T5-XXL 基线 | [官方] 技术报告 |
| VAE | 早期用 Qwen Image VAE，更大模型用 FLUX 2 VAE | [官方] 技术报告 |
| 精确参数 | 12.9B、28 blocks/width 6144、编码器为 Qwen3-VL-4B-Instruct 取 12 层特征 | [未证实] 第三方报道（alphasignal / comfyui-wiki） |
| 发布 | 托管版（Medium/Large）2026-05 上线；技术报告 + 开源权重 2026-06-22/23（Raw + Turbo） | [官方] |

**四个变体**（提示词写法含义不同）：

| 变体 | 用途 | 官方定位 | 提示词含义 |
|---|---|---|---|
| **Raw** | 开源基础检查点（未蒸馏） | 「not recommended for inference」，LoRA/微调基座，52 步 / CFG 3.5 / 最高 2048px | 写什么是什么，细节敏感 |
| **Turbo** | 开源蒸馏版 | 8 步 / CFG 0.0 / 原生 2K，约 2 秒/张 | 项目当前路径；负面失效，靠正句 |
| **Medium**（托管 API） | 更小更快更稳 | **「尤其擅长插画、动漫、绘画等表现性/艺术风格」** | 动漫向首选；后训练重 → 输出更「听话」 |
| **Large**（托管 API） | 两倍参数、后训练轻 | 「擅长照片写实与 raw 质感（动态模糊、胶片颗粒、低动态范围）」 | 真人写实向首选；输出更 raw 有纹理 |

> 对写法的直接推论：Krea 2 用 **Qwen3-VL 语言编码器解析语法与语义**，它「读得懂整句话和镜头参数」，但**不认 Danbooru tag 体系与权重语法**——这是全文所有写法的根基。

---

## 二、官方提示词总纲（GitHub docs/prompting.md + 技术报告）

官方原文规则（[官方] https://github.com/krea-ai/krea-2/blob/main/docs/prompting.md）：

1. **"We recommend users to use natural language prompts"** —— 自然语言是第一推荐。
2. **"Long detailed prompts yield best results"**，但模型对极简提示也能出好图（有扩写器兜底）。
3. **渲染文字必须加引号**："For text rendering, we recommend putting quotes around the words to be rendered"。
4. 官方提供 `expansion.txt`，可作为任意 LLM 的 system prompt 把短提示扩写成模型友好长描述。
5. 官方示例均以 2K 分辨率、Turbo 生成。

**Prompt Expander 扩写器**（[官方] 技术报告 + API 博客）——Krea 2 区别于其它模型的核心机制：

- 用户写短/模糊提示 → 扩写器自动补风格、构图、机位、配色；`creativity` 参数控制扩写幅度。
- **`creativity` = raw / low / medium / high（默认 medium）**：`raw` = 零扩写，只渲染你显式写的内容；`low` = 贴近字面补明显缺项；`high` = 大幅自由发挥（适合短/开放式探索）。
- 训练方式：SFT 用「欠指定短提示 → 密集长描述」配对（含思考轨迹）+ GDPO 直接优化最终图像质量 + DINOv3 多样性奖励防风格坍缩。
- **对项目的启示**：想精确控制 → 写长提示 + 低 creativity；想探索 → 短提示 + 高 creativity。项目在 ComfyUI 本地路径（Turbo）没有 creativity 参数，等价物是「提示词写多长」——因此场景/服装散文写得越满，控制越强。

**expansion.txt 扩写指令核心**（9 条规则节选，[官方] raw.githubusercontent.com/krea-ai/krea-2/main/docs/expansion.txt）：
1. Faithfulness First：保留所有原始主体/动作/颜色，不得新增对象；
3. Style Planning Stays Internal：不输出规划性 tag；
4. Text Rendering：需渲染文字用引号包裹；
5. Avoid Over-Specification：不过度规格化；
6. Structure：写成**一个连贯段落**，禁 bullet/JSON/markdown；
7. Respect Existing Detail：用户提示已详细时轻润色即可；
9. Preserve User Medium：用户显式指定媒介（如 "anime"）时必须尊重。

> 第 6/9 条直接佐证项目「Krea 走散文段落、不用 tag 列表」的现有架构方向。

---

## 三、社区提示词十律（多来源交叉共识）

以下结论均有 Reddit/博客/教程等社区出处，冲突处标注。

1. **长详细提示词是甜点，但不要无脑堆词**：30–80 词是「控制/自由度」甜点；80–150 词用于精确控制。个别用户报告超长提示有「遵从度断层」（[个别] r/StableDiffusion u/ZootAllures9111）。
2. **自然语言散文 > 逗号短语 > 裸 tag**：逗号短语可用但每段须是描述性短句；Danbooru tag（`1boy, nude`）与 `(word:1.2)` 权重基本无效，强调靠「复述概念」而非权重。
3. **质量词纯属浪费**：`8k, ultra detailed, masterpiece, best quality, absurdres, score_9` 被 Qwen 当普通词处理（[社区共识]）；官方背景文更直言 `beautiful/stunning/masterpiece/8k` 会把输出拉向 generic AI gloss（[官方]）。
4. **负面提示词分场景**（详见 §八）：网页版负向框有效；ComfyUI/Turbo 在 CFG≈0 时负向几乎失效。
5. **风格词位置有讲究**：主体放开头（Qwen 前置加载），风格/媒介/工作室名放**末尾**；LoRA 触发词必须放**最前**。
6. **一条 prompt 只放一个工作室名**：混两个工作室名会两边都不像（[官方] FAQ）。
7. **明确写光照**：golden hour / backlit / soft window light / Rembrandt——「光影平」几乎都是因为没写光照（官方分镜文 + 社区共识）。
8. **明确写镜头景别**：close-up / medium two-shot / wide establishing shot / low angle——模型会尊重取景词（[官方]）。
9. **空场景要排除人**：模型见室内场景就爱画人，「背景空」元凶是没写 `no characters, no people, no figures`（[官方] 背景文）。
10. **短提示交给扩写器是设计行为**：同提示多次生成差异大是故意的，要收敛一致性就加细节 + 锁参数（[官方] 探索式博客）。

---

## 四、通用提示词分桶模板（映射项目编译器）

社区多来源同构公式（Subject+Scene+Composition+Lighting+Mood+Style）与项目 `buildStructuredKreaDescription` 的分桶天然对齐：

```
[1 风格锚点 lead] [2 主体 subject] [3 服装 outfit] [4 动作 action] [5 情绪 mood]
[6 场景 environment] [7 镜头 camera] [8 光线 lighting] [9 媒介词收尾 medium]
```

项目现状（`promptCompiler.ts` buildStructuredKreaDescription 顺序）与社区共识**一致**，无需推翻：
- 风格 lead 放最前 ✓（官方建议风格/媒介词前置或后置皆可；LoRA 触发词前置）
- 摄影/镜头/光线词由 tag 自动译成短语（`close_up` → close-up shot、`golden_hour` → golden hour light）✓
- 媒介词（medium）放散文末尾 ✓（官方「命名工作室收尾」）
- 负面恒空 ✓（见 §八）

**社区推荐改进点**（供优化阶段验证）：
- 场景散文（sceneProse）建议 2–3 句：地点 + 光照/氛围 + 角色动作，且**光照时机与镜头景别必须显式**；
- 「空场景」蓝图必须在散文末尾追加 `no characters, no people, no figures`；
- 动漫配方 lead 统一补 `cel shading / flat colors / crisp line art` 词族（见 §六）。

---

## 五、动漫/插画向专章

### 5.1 模型选型
**[官方]** Krea 2 Medium 专长插画/动漫/绘画等表现性风格（API 博客 + fal 官方指南）。项目本地 Turbo 路径下，动漫效果主要靠提示词拉回（见 5.3）。

### 5.2 官方分镜工作流（草稿→成稿）
官方博客 "From sketch to anime panel with Krea 2"（[官方]）给出四条铁律，项目做「剧本→分镜→成稿」时可直接复用：
1. 草稿够糙即可，模型能读构图和手势——别浪费时间清理草图；
2. **必须命名光线**（"golden hour warm light" / "fluorescent night" / "stormy overcast" / "harsh midday"）——光线承载的情绪超过任何其它元素；
3. **必须写景别**（"close-up" / "wide establishing shot" / "medium two-shot" / "low angle"）；
4. **命名工作室收尾**（"polished Kyoto Animation style" / "polished Shinkai style" / "1990s OVA style"）——让模型承诺特定完成度。

### 5.3 动漫最容易翻车的地方与对策
- **症状**：Krea 2 默认偏厚涂/半写实质感；`polished` 词又引导光泽，二次元出图「油、糊、厚」。
- **对策（社区共识 + 项目 2026-08-30 已实测）**：动漫提示词必须带平涂词族——
  `flat cel-shaded` / `flat bold color blocking` / `clean linework` / `clean lines` / `simplified color blocking` / `smooth flat shading` / `crisp line art` / `saturated colors` / `limited palette`，并追加 `no photorealism, no 3D render`。
- 官方对复古风同样承认漂移：「Modern anime models otherwise drift toward modern digital-clean line work」，要写 `classic OVA cel-shading` / `hand-painted` 锚定年代（[官方] studio 文）。
- 个别作者认为「Krea2 already produces accurate cel-animation style」、LoRA 只是加复古味（[个别]），但该作者观察到 LoRA 会连带改变姿势/服装/构图——纯词族仍是第一优先。

### 5.4 工作室风格词实测（官方 studio 博客）
| 风格 | 写法要点 | 出处 |
|---|---|---|
| Ghibli | 介质词锚点「anime film background painting in the aesthetic of Studio Ghibli」，避免饱和词 | [官方] |
| Shinkai / CoMix Wave | 配显式色词「hyper-saturated orange and magenta sky」，加真帧 style reference 更牢 | [官方] |
| Kyoto Animation | 写实细节物件：吊灯、木台、一本书，配「painterly Kyoto Animation cel-shaded color」 | [官方] |
| Madhouse | 「cold blue and green」+「sodium-yellow accents」+ sharp cel-shading | [官方] |
| 1990s Sunrise | 「1990s Sunrise mecha」「classic OVA cel-shading」「hand-painted」 | [官方] |
| ufotable | 官方未收录 → 用风格参考图或自训 LoRA | [官方] FAQ |

官方 LoRA `krea2_retroanime` 触发词为 **"purple retro anime style"**（[官方] comfy 教程）。

### 5.5 角色一致性与换装
- **官方主线（FAQ 原话）**：「For best results, train a LoRA on your locked character designs first, then reference the LoRA in every panel prompt. Without a LoRA, characters will drift in face and proportion.」——**RAW 上训、Turbo 上应用**（官方开源页）。
- **换装注意（官方 Style Guide）**：角色 LoRA 训练数据要「同装扮多图」；「If you plan to generate images where your character has different attire, upload a variety of looks.」——**要换装，训练数据里必须预置多套服装**。
- 无 LoRA 时：角色名+系列+外貌散文锚定（项目 identityProse 现状），但官方明确会漂移。
- 社区 ComfyUI 做法：参考图走双路径（Qwen3-VL 文本编码路径 + VAE→ReferenceLatent 路径，后者扛脸）；**「KEEP character identity from reference」指令放提示词最前**（[社区] earngenix）。
- 社区 ReID LoRA（krea2-reid）用单张参考图保身份、prompt 自由改服装/姿势；**脸部特写参考比全身参考给服装更多自由**（[社区] HF）。
- 社区共识：Krea 2 本地（convrot 变体）角色一致性口碑好，「Krea 2 is really good at knowing characters and their clothing」（[社区] PulseAugur 聚类）。

### 5.6 动漫示例提示词库（英文原文，注明出处）

**官方**
1. `Finished anime manga panel, swordsman mid-leap with sword raised, dynamic motion lines radiating from the figure, dramatic cel-shaded color, cool blue palette with white sword flash, polished comic panel finish.` [官方-blog 分镜]
2. `Finished anime manga close-up, young girl with long brown hair crying, hand wiping a tear, golden hour warm lighting on her face, soft pink and gold palette, glistening tear, polished anime art.` [官方-blog 分镜]
3. `Finished anime manga establishing panel, two small figures walking along a hillside path overlooking a distant town at sunset, painterly Shinkai-style sunset sky, vibrant orange and pink, polished anime panel finish.` [官方-blog 分镜]
4. `Finished anime manga panel, two characters facing each other across a small cafe table, warm afternoon light through window, painterly Kyoto Animation cel-shaded color, careful background detail, polished anime art.` [官方-blog 分镜]
5. `close-up anime portrait of a young woman, large amber-brown eyes with intricate sparkling reflections, index finger delicately touching a subtle smile, messy dark blue hair with loose strands crossing her face, white and navy school uniform, bright high-key lighting, luminous shadows with cool blue undertones, detailed digital painting, dynamic tilted framing, shallow depth of field on hand` [官方-prompting.md]
6. `1990s vintage anime style cel animation, densely packed crowd of teenagers in summer uniforms, central boy with short black hair raising a clenched right fist, squinting one eye with a determined expression, wearing a white short-sleeve shirt and solid green necktie, surrounding students looking in various directions, girls in white sailor blouses with green striped collars and neckerchiefs, light blue skirts and trousers, tightly framed medium shot, flat shading, soft muted retro.` [官方-prompting.md]
7. `young woman looking over her right shoulder, anime-style illustration, messy black hair blowing dynamically in the wind, striking green eyes, subtle neutral expression, oversized white button-down collared shirt with soft blue shadows, vibrant deep blue sky background, bright fluffy white cumulus clouds, silhouetted utility poles with power lines, low angle portrait, cinematic sunlight, crisp cel-shaded aesthetic` [官方-prompting.md]
8. `Close-up portrait of a woman, retro 90s anime style, large vivid blue eyes, flushed cheeks, glossy red lips, silver glitter around her eyes, single brown curl on the nose, wearing a glossy black metallic helmet with rivets, bold blue reflections, dark background, heavy film grain, saturated colors, sharp specular highlights` [官方-release notes]

**社区**
9. `Flat cel-shaded anime style, graphic poster-like composition, bold simplified shapes, clean linework, slightly exaggerated perspective, painterly digital texture, quiet but intense survival mood, vivid cyan-blue water, pale rocks, faded vehicle colors, strong atmospheric lighting, no photorealism, no 3D render.` [社区-ComfyUI 工作流]
10. `Anime style. Flat illustration of a young anime girl in a school uniform riding a vintage bicycle down a sunny riverside path. Wind blowing her hair, clean lines, simplified color blocking, smooth flat shading, vibrant sky with stylized white clouds, minimalist anime vector art aesthetic.` [社区-proxima.art]
11. `Anime style. A charming character illustration in the distinct Jima art style, depicting a stylish anime character relaxing in a cozy, illuminated cafe with a warm beverage at twilight. Deep amber, golden, and rich twilight-blue color palette with smooth gradients, clean and delicate line art, stylized character proportions with expressive features, dramatic neon and street lamp rim lighting, relaxed and aesthetic atmosphere, detailed dark wood coffee shop interior background with soft bokeh, clean digital art texture, cozy night-owl mood.` [社区-proxima.art]
12. `An anime rooftop scene at dusk, two friends watching city lights, cel shading, warm rim light, nostalgic mood, detailed background illustration.` [社区-krea2.net]

**自拟（按项目分桶模板）**
13. `KEEP character identity from reference: young anime woman, long silver hair, violet eyes, gentle smile. Wearing a white summer dress with lace trim. Standing in a sunlit school courtyard, cherry blossoms falling. Golden hour warm light, soft cel-shaded flat colors, clean lineart, saturated limited palette. Medium shot, visual novel event CG style, bokeh background.` [自拟]
14. `Anime screencap of a mecha hangar scene, flat saturated color blocks, bold black outlines, hard cel shading, film grain, 1990s OVA cel animation style, dramatic rim light, hand-painted background.` [自拟]

---

## 六、真人/写实向专章

### 6.1 方法论（官方 krea2.co 博客）
1. **先定主题类别**（portrait / product / environment / lifestyle），混写「hero product + 电影人群 + 杂志封面」会得到平庸结果；
2. **光线与材质语言 > 形容词堆叠**：`softbox`、`matte`、`specular` 这类可测量光学/材质线索，比 `8k, ultra detailed` 有用得多；
3. **审查清单**：light logic（光源方向与衰减一致）、material（粗糙度与反射匹配）、edge（放大不糊）、depth（前景背景光学分离）、crop（目标比例内成立）——须 100% 缩放 + 缩略图双重审查；
4. **单变量迭代法**：选定候选做参考，每次只改一项（光线/机位/材质/色温/背景动静），其余锁定。

### 6.2 摄影术语有效性表

| 类别 | 有效（社区共识） | 无效/低效 |
|---|---|---|
| 焦段光圈 | `85mm f/1.4`（人像压缩浅景深）、`35mm`（环境人像）、`50mm`、`100mm macro f/4`（产品） | — |
| 光线 | `golden hour backlight`（逆光+暖调+光晕）、`Rembrandt`（脸颊三角阴影）、`soft window light`、`overcast` | 矛盾光源堆叠 → 发糊 |
| ISO/颗粒 | `film grain at ISO 800/2400/3200` 直接映射颗粒强度 | — |
| 材质 | `linen / leather / wool`、`matte / gloss`、`brushed titanium` | — |
| 胶片品牌 | 模型自带胶片审美，「不写 Kodak Portra 400 也能出片」[合作方-个别] | 胶片品牌词有冗余 |
| 质量词 | — | `masterpiece / best quality / score_9`、`(detail:1.3)` 数字加权全无效 |
| 负面词 | 只压 `oversaturated / lens flare / plastic skin` 即可[个别] | 过长的 negative 会改变构图 |

### 6.3 去 AI 味技术（社区共识）
- **写真实世界的不完美细节**：`faint freckles`、`flyaway hairs`、`peach fuzz`、`slightly chapped lip`、`pores visible and not airbrushed`（fal 社区教程）；
- 负面词清单：`plastic skin, waxy doll-like complexion, airbrushed, over-sharpening, halo`；
- 实测技巧：加一句 `blurry photo, like one taken by an amateur with a smartphone` 显著降 AI 感（GIGAZINE 实测）；
- 已知边界：Krea 2 美妆特写下微距毛孔仍偏平滑（[个别] Kittl 评测）。

### 6.4 真人示例提示词库（英文原文，注明出处）

**人像**
1. `Close-up portrait of a woman by a window, soft directional daylight, 85mm lens look, shallow depth of field, natural skin texture, calm expression, 3:4` [官方]
2. `A photoreal beauty close-up of a woman's face turned three-quarters to a window, real skin texture held sharp, faint freckles across the nose, a few flyaway hairs lit from behind, fine peach fuzz along the jaw, one slightly chapped lower lip. Soft directional daylight rakes across the cheekbone, the far side falling into gentle shadow. Natural minimal makeup, a single catchlight in each eye, pores visible and not airbrushed. Shot around 85mm at f2, calm and intimate mood` [社区-fal]
3. `Close-up portrait of a woman in her 40s, silver hair, weathered skin with character, shot on 85mm f/1.8 lens, Rembrandt lighting from camera left, deep shadows, film grain at ISO 800, neutral grey background, ultra-sharp eyes, soft shoulder falloff` [社区-promptspace]
4. `A candid street portrait of a 27-year-old woman standing outside a small Paris café during golden hour, wearing a beige trench coat and holding a takeaway coffee, 85mm f/1.4, natural skin texture, anatomically correct hands, shallow bokeh, ultra-photorealistic, RAW quality` [社区-实测]
5. `A woman laughing with her eyes closed against a pale blue sky, loose dark hair blowing across her face, wearing a sleeveless white lace top. Photographed from a slightly low angle in soft natural daylight with a minimal background, medium-format color photograph, shallow depth of field and natural skin texture` [社区-CyberRealistic]

**环境/生活**
6. `Misty mountain pass at dawn, volumetric light through layered haze, wet rock texture in foreground, wide establishing camera, painterly realism, 16:9` [官方]
7. `Lone traveler walking through an empty airport at night, overhead fluorescent lights, muted green coat, reflective floor, quiet cinematic film still` [合作方-Replicate]
8. `Maid. Portrait. Looking at the camera. Japanese. Red wolf cut hair. Pink heart-shaped drawing on her cheek. Blurry photo, like one taken by an amateur with a smartphone` [社区-实测降 AI 味]

**产品**
9. `Studio product shot of a matte ceramic mug on dark stone, single softbox key, controlled reflection on rim only, crisp focus, minimal background, 1:1` [官方]
10. `Luxury perfume bottle on dark marble surface, single overhead strip softbox, specular highlights along glass edges, shallow depth of field 100mm macro lens f/4, background fades to pure black, editorial cosmetics photography` [社区-promptspace]
11. `A professional macro photograph of an antique mechanical wristwatch with its back removed — hundreds of machined gears, ruby bearings, springs, engraved serial numbers, polished screws, brushed steel, oil sheen, dramatic studio lighting. 3:1 magnification, hyper-realistic product photography` [社区-实测]

**自拟综合模板**
12. `Environmental portrait of a 30-year-old Japanese woman with a short black bob, wearing a cream linen shirt, standing on a rainy Tokyo side street, soft blue-hour ambient light with a neon sign glow on her face, shot on 35mm f/2.0, shallow depth of field, Kodak Portra film grain, natural skin texture with visible pores, candid pose looking slightly off camera, 3:4` [自拟]

---

## 七、负面提示词真相（分场景）

| 场景 | 负面提示词是否有效 | 依据 |
|---|---|---|
| 托管网页版（krea.ai/image） | **有效**，「跳过负向是最大错误」[社区-个别] | seomate |
| ComfyUI / 本地 Turbo（CFG≈0） | **几乎失效**（guidance=0 时负向不参与），官方模板直接置零负向 | [社区共识] |
| 项目现状 | 负面恒空 `negative: ''` | 与官方推荐一致 ✓ |

替代手段（本地路径）：
- **正向句末追加排除词**：`..., no text`（最常见的 no-text 做法）；官方对空场景写法是 `no characters, no people, no figures`；
- **正向内负权**：NegPiP 节点写 `(blurry:-1.0)` 于正向内（[社区] comfy.icu），对应项目 AGENTS.md 提到的 `Krea2PromptWeight` 节点可承载此模式。

---

## 八、红黑榜（常见错误清单）

**黑榜（严禁/无效）**
- ✗ `8k, ultra detailed, masterpiece, best quality, absurdres, score_9` 等质量词（项目 sanitizeKreaProse 已自动清除 ✓）
- ✗ `(word:1.5)` 权重语法、`<lora:xxx>` 注入（项目已自动剥离 ✓）
- ✗ 下划线 token（`golden_hour` 单独裸用；项目已转空格 ✓）
- ✗ Danbooru 裸 tag 堆砌（`1girl, solo, long_hair`）
- ✗ 一条 prompt 混两个工作室名
- ✗ 空场景不写 `no characters, no people, no figures`（背景必被填人）
- ✗ 堆矛盾光源（双主光、双日落）
- ✗ 2–4 个以上关键主体互相抢注意力

**红榜（推荐强化）**
- ✓ 自然语言散文，2–3 句场景描述（地点 + 光照/氛围 + 动作）
- ✓ 显式写光照时机（golden hour / backlit / soft window light / Rembrandt / fluorescent night）
- ✓ 显式写镜头景别（close-up / medium two-shot / wide establishing / low angle）
- ✓ 工作室/媒介词收尾（polished Kyoto Animation style / visual novel event CG / 35mm film still）
- ✓ 动漫平涂词族（cel shading / flat colors / crisp line art / clean linework）
- ✓ 真人写实写「不完美细节」+ 光线材质语言
- ✓ 渲染文字加引号

---

## 九、参数与工作流共识

| 参数 | 推荐值 | 出处 |
|---|---|---|
| Turbo steps / CFG | **8 步 / CFG 0**（官方）；ComfyUI 常 CFG 1.0；Euler+Simple；mu=1.15（项目指南强调必须保留） | [官方][社区] |
| Raw steps / CFG | 52 步 / CFG 3.5（官方 HF 卡） | [官方] |
| creativity | 托管版：默认 medium；写实精确用 raw/low；探索用 high | [官方] |
| seed | 0–2³¹-1；批量 1–4 张 seed+i 找构图 | [社区] |
| 迭代方法 | 单变量迭代（一次只改一个维度），官方唯一明确推荐工作流 | [官方] |
| 审查 | 100% 缩放 + 缩略图双查：光/材质/边缘/景深/裁切 | [官方] |

---

## 十、项目落地建议（对接现有代码）

### 10.1 需修正的过时认知（权威性校正）
1. **「Krea 2 (SD3.5)」标注错误**（工作区记忆 + AGENTS.md）：Krea 2 是自研 12B DiT + Qwen3-VL 编码器，与 SD3.5 无关——见 §一。
2. **旧指南 `krea2-prompt-writing-guide.md`（8-14）两处过时**：
   - 「自然语言+标签混合模型」→ 官方现口径是纯自然语言推荐，标签可作辅助但非必需；
   - 「简短负面即可」→ 本地 Turbo CFG≈0 负面基本失效，排除元素走正句追加 / NegPiP 负权（§七）。

### 10.2 与现有编译器对齐点（`promptCompiler.ts` / `kreaStyleRecipes.ts`）
1. **分桶顺序已正确**（style→subject→outfit→action→mood→environment→camera→lighting→medium），无需重构，建议优化各桶内容质量。
2. **动漫配方 lead 推广**：2026-08-30 已在 `inferredKreaStyle` 加入 `cel shading, flat colors, crisp line art`（实测优于原句），建议把该词族推广到 `KREA_STYLE_RECIPES` 全部动漫向配方（anime_key_visual / vn_event_cg / light_novel_cover / cel_1990s / anime_promo_art 等）。
3. **空场景**：场景散文为「无人背景」时追加 `no characters, no people, no figures`（官方推荐写法，天然是英文，过 plainEnglish 门控无障碍）。
4. **负面恒空保持不变**（本地 Turbo 路径正确）；若未来接托管 API（Medium/Large），需按场景恢复负向框。
5. **渲染文字加引号**：服装/道具上的文字（如 logo、招牌）应双引号包裹，可在 outfitProse/sceneProse 约定里补一条。
6. **Krea2PromptWeight 节点**：可用于正向内负权（`(blurry:-1.0)` 风格），作为本地 Turbo 下「负面」的替代通道，评估是否接入。
7. **Krea2StyleReferenceNode**：官方 style reference 强度语义（默认 50%，低至 20% 只剩 palette 渗透、会产生颜色溢出到主体副作用；API -2~2、0.6 起手）——热门角色风格化接入时按此调参。

### 10.3 角色一致性路径
- 维持现状（无 LoRA、靠 identityProse 散文锚定）合理，但**官方明确会漂移**；若做分镜一致性批量，应走「RAW 训角色 LoRA → Turbo 应用」（官方唯一主线），训练集需含多套服装（换装需求预置）。

### 10.4 优化阶段建议动作（供后续排期）
- 按 §四模板逐条审计热门角色 identityProse / 场景 promptProse 的光照、镜头、媒介词完整性；
- 建立动漫/真人两套「配方 lead 词族」标准（§5.3 词族 / §6.2 术语表）；
- 用 §八红黑榜做批量提示词清洗门禁的补充词表；
- 新功能（如 Krea2StyleReferenceNode 风格化）按官方 strength 语义做参数默认值。

---

## 十一、参考来源清单

**官方（krea.ai / GitHub / HF）**
- github.com/krea-ai/krea-2/blob/main/docs/prompting.md（提示词总纲 + 示例）
- raw.githubusercontent.com/krea-ai/krea-2/main/docs/expansion.txt（扩写器指令）
- krea.ai/blog/krea-2-technical-report（技术报告：架构/扩写器/数据策展）
- krea.ai/blog/krea-2-api-launch（Medium vs Large + 官方示例）
- krea.ai/blog/explorative-prompting-krea-2（探索式提示词）
- krea.ai/blog/from-sketch-to-anime-panel-with-krea-2（动漫分镜工作流）
- krea.ai/blog/studio-anime-aesthetics-with-krea-2（工作室风格词）
- krea.ai/blog/anime-backgrounds-with-krea-2（背景文 + 禁词 + no characters）
- krea.ai/blog/style-references-krea-2 / krea.ai/blog/krea-2-deep-dive-walkthrough（风格参考强度）
- krea.ai/blog/krea-2-lora-training（角色 LoRA 主线）
- krea.ai/blog/krea-2-vs-nijijourney（与 Niji 对比）
- krea.ai/krea-2-open-source（开源页：架构/变体/Raw-Turbo）
- docs.krea.ai/developers/krea-2/overview · style-transfer · moodboards（API 参数）
- krea.mintlify.dev/docs/user-guide/features/krea-2 · krea-2-turbo（产品指南 + generative sliders）
- huggingface.co/krea/Krea-2-Raw · Krea-2-Turbo（模型卡）

**官方合作方**
- fal.ai/learn/tools/krea-2-prompting-guide · help.scenario.com/articles/1463593157-krea-2-the-essentials · krea2.co/blog/photorealistic-images-with-krea-2 · krea2.net/how-to-use-krea-2 · docs.comfy.org/zh/tutorials/image/krea/krea-2

**社区**
- r/StableDiffusion（u/ZootAllures9111 长提示遵从度断层）、tungsten.run、earngenix.com（六要素 + KEEP 指令）、instasd.com、seomate.ai、flyne.ai、promptspace.in、gigazine.net（降 AI 味实测）、comfyui.nomadoor.net、proxima.art、tensorart.me、civarchive.com、pulseaugur.com（角色一致性聚类）、huggingface.co/ilkerzgi/krea-2-flat-cel-anime-lora、huggingface.co/yijunwang2/krea2-reid、comfy.icu（NegPiP）

**未证实标注**
- 12.9B / 28 blocks / Qwen3-VL-4B-Instruct 12 层特征（第三方报道，官方仅称 12B）；
- Turbo 负向在 CFG=1.0 的具体失效边界（社区实测，非官方文档）；
- 「Krea 2 理解相机参数优于 FLUX」为博客演示，无严格评测佐证。

---

*报告完 · 信源分级 [官方]/[合作方]/[社区共识]/[个别]/[未证实] 贯穿全文，避免把个别观点当共识。*
