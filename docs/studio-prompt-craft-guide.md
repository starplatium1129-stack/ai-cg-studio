# AI-CG-Studio 专属提示词工程专家指南（studio-prompt-craft）

> **适用范围**：AI-CG-Studio 全模块（文生图、图生图、局部换装、场景蓝图、故事分镜、角色剧场）。  
> **核心使命**：为项目量身定制高质量提示词，彻底分流 **Anima（Danbooru 结构化 Tag 流）** 与 **Krea 2（纯英文自然语言散文 Prose 流）**，并严密支持 **SFW（全年龄/唯美/日常）** 与 **NSFW（R18/成人显式/高情欲）** 双分级体系。

---

## 目录
1. [双引擎核心差异与铁律](#一双引擎核心差异与铁律)
2. [角色蓝图场景配比黄金法则：反差萌与救赎感（1 战斗高光 + 9 心动日常与反差）](#二角色蓝图场景配比黄金法则反差萌与救赎感1-战斗高光--9-心动日常与反差)
3. [环境人像与姿态空间压缩黄金法则（SFW/NSFW 通用）](#三环境人像与姿态空间压缩黄金法则sfwnsfw-通用)
4. [SFW（全年龄）提示词编写规范与心动日常题材光谱](#四sfw全年龄提示词编写规范与心动日常题材光谱)
5. [NSFW（R18）唯美艺术重构与去模板化铁律（美感、情境与灵魂先行）](#五nsfw-r18-唯美艺术重构与去模板化铁律美感情境与灵魂先行)
6. [热门角色库与服装对齐速查表](#六热门角色库与服装对齐速查表)
7. [双引擎分流编译标准模板](#七双引擎分流编译标准模板)
8. [蓝图数据表（Blueprint JSON）字段映射与故事还原硬性契约](#八蓝图数据表blueprint-json字段映射与故事还原硬性契约)
9. [防过度精简（Anti-Truncation）与防粗暴同质化红线](#九防过度精简anti-truncation与防粗暴同质化红线)
10. [质量红线与质检 Checklist](#十质量红线与质检-checklist)

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

## 二、角色场景配比黄金法则：反差萌与救赎感（1 战斗高光 + 9 心动日常与反差）

> **二次元最高审美哲学**：战斗与特殊身份角色（如 2B、星见雅、艾莲·乔、露西、伊卡洛斯、风见一姬等）在原作中已经承受了过量的残酷、厮杀与紧绷。**用户来到画室，绝不是为了看她们在硝烟与废墟里继续打滚 10 个场景！**  
> 玩家真正渴望的，是角色**卸下武器、褪去沉重战甲后，作为普通少女流露出的柔软、反差（Gap Moe）与幸福救赎**。

### 1. 「1 战斗立魂，其余皆是心动日常与反差」黄金配比
无论角色的原作背景多么偏向战斗或暗黑，在配置全套 10~11 套场景蓝图时，**必须严格遵守以下配比**：

* **1 套标志性战斗/身份高光（SFW，上限 1 套）**：
  - **原则**：**一击必杀，极精极燃**。这一套场景只需确立“她是这个角色”的本命威严（如 2B 的废墟残月独立拔刀、星见雅的空洞瞬斩落樱、伊卡洛斯的阿波罗之弓全武装展开、露西的霓虹列车疾驰）。
  - **铁律**：严禁塞入 3~4 个同质化的训练场、打杂兵或灰头土脸的战场巡逻场景！
* **5~6 套心动日常与反差萌（SFW 唯美日常）**：
  - 必须把场景与服装的大多数空间留给用户梦寐以求的心动时刻：
    1. **浪漫花嫁 / 纯白誓约（Bridal / Wedding Dress）**：大教堂彩窗逆光、圣洁头纱、捧花与罕见的娇羞浅笑（如人造人 2B、高岭之花星见雅戴上头纱的核弹级杀伤力）；
    2. **夏日海滨 / 度假泳装（Bikini / Beach Vacation）**：碧蓝海岸、海风拂发、水珠顺着白皙肌肤滑落、冰镇冷饮与遮阳伞下的放松惬意；
    3. **居家女友 / 晨光私密（Casual Home / Morning Light）**：大号松垮白衬衫（Boyfriend Shirt）、厨房系围裙料理、蜷缩在沙发看书、扎马尾咬皮筋的侧脸；
    4. **传统和风 / 节日约会（Yukata / Street Date）**：夏日祭典捞金鱼、苹果糖、烟火下回眸的浴衣领口；冬日毛茸茸围巾与热咖啡；
    5. **专属羁绊与可爱反差（Signature Lore Cute Moments）**：如伊卡洛斯呆萌抱西瓜、古手川唯悄悄喂流浪猫、小暗吃鲷鱼烧被烫到舌头。
* **4 套 NSFW 场景**：
  - 严禁粗暴扒光！必须与上述日常/反差服装深度融合，做**半遮半掩的唯美沉沦**（详见第五章）。

---

## 三、环境人像与姿态空间压缩黄金法则（SFW/NSFW 通用）

> **二次元插画第一痛点破局**：在生图时经常陷入两难——“为了拍全身把镜头拉远，导致人物面部像素过低而模糊崩坏；为了看清五官面部又切头切脚，丢失身材与服装细节”。  
> **核心破局法则**：**姿态空间压缩（Pose Compression） + 环境人像黄金比例（65%~75% 主体 + 30% 背景纵深）**。严禁让角色直挺挺木桩站立！

```
     【错误：直立大远景】                      【正确：姿态空间压缩（环境人像）】
┌─────────────────────────┐              ┌─────────────────────────┐
│         [空旷天空]       │              │  [留白5-10%]  (光环/发梢) │
│                         │              │      ╭───╮  [面部高清放大] │
│           (·.·) [面部<5%模糊]│              │      │^o^│ (五官/眼神灵动) │
│            /|\          │              │    ╭─┴───┴─╮ (胸口/锁骨)  │
│            / \          │              │    │ 躯干  │ ╭────────╮  │
│                         │              │ ╭──┴───────┴─┤ 前景道具│  │
│     [大面积单调地面]     │              │ │ 坐/靠/倚/折叠│ (桌/床/椅)│  │
│                         │              │ ╰─┬────────┬──┴────────╯  │
└─────────────────────────┘              └─────────────────────────┘
```

### 1. 姿态空间压缩的核心技法（让人物在空间中灵动折叠）
- **坐姿与托腮（Sitting & Leaning）**：`sitting on chair / sitting on throne / sitting on bed / leaning forward on table, one hand on cheek` —— 纵向高度自然压缩，头顶、衣服、腰臀与交叠双腿完整入画，面部像素占比扩大 2.5 倍！
- **斜倚与靠卧（Reclining & Lounging）**：`lounging on daybed / reclining on sofa / lying on beach chair, diagonal composition` —— 利用对角线延展身段，兼顾全身与高解析度五官。
- **俯身与透视（Bending & Dutch Angle）**：`bending forward, looking back, dynamic perspective` —— 广角透视放大身材曲线与微表情。
- **单膝跪姿与战斗架势（Kneeling & Combat Stance）**：`kneeling on one knee, drawing weapon, dynamic crouch` —— 兼顾战斗张力与武器道具。

### 2. SFW 场景应用（唯美与灵动）
- **废黜词条**：严禁出现 `head to toe in a full body shot`, `distant silhouette`, `stands far away`, `no close-up` 等将人物拉成远景小人的约束。
- **正向词条**：`environmental portrait, medium full shot, cowboy shot, seated pose, leaning against window/railing, interacting with prop`。
- **黄金比例**：头顶保留 5%~10% 呼吸留白（Headroom），主体占画面 65%~75%，前景中景道具（咖啡杯、数据板、书架、喷泉）将角色牢牢“锚定”在环境中。

### 3. NSFW (R18) 场景应用（极致肉感与神态）
- **为什么 NSFW 更需要姿态压缩**：成人场景若拉远站立，会导致**阿嘿颜/高潮神态、胸型、乳晕、私处流萤（爱液）**全部因为像素不足而丢失；若纯特写又丢失身材曲线与体位互动。
- **NSFW 黄金压缩体位**：
  - **床榻斜倚自慰/微俯身**：`reclining back on pillows, arched back, one hand between thighs` —— 既能看清高潮潮红面庞，又能一览饱满胸型与私处指交细节；
  - **屈膝抬腿/抱膝**：`knees drawn up to chest, spreading legs, leaning back on hands` —— 完美展现下身私密处与修长美腿，同时面部表情处于近景核心；
  - **对坐位/骑乘俯身**：`facing partner, straddling lap, leaning forward for kiss` —— 亲密接触与双方神情融为一体。

---

## 四、SFW（全年龄）提示词编写规范与心动日常题材光谱

SFW 场景聚焦于**角色神韵、唯美光影、材质细节、场景氛围与情感叙事**。配合第二章的配比法则，SFW 应当大量涵盖日常反差题材。

### 1. SFW 心动日常题材光谱速查
- **纯白花嫁（Wedding/Bridal）**：`wedding_dress, bridal_veil, bouquet, church, stained_glass, light_rays, romantic, gentle_smile, blush`
- **海滨泳装度假（Beach/Swimsuit）**：`swimsuit, bikini, beach, ocean, blue_sky, summer, wet_skin, drinking_cold_beverage, dynamic_angle`
- **居家女友（Casual Home）**：`oversized_shirt, loose_clothes, bedroom, soft_morning_light, messy_hair, looking_at_viewer, relaxing`
- **传统浴衣（Yukata Festival）**：`yukata, festival, fireworks, goldfish_pouch, evening, lanterns, food_stall, beautiful_neckline`

### 2. Anima SFW 结构化 Tag 体系
- **标准分级前缀**：`masterpiece, best_quality, newest, absurdres, score_9, score_8_up, rating:general, safe, 1girl, solo`
- **角色核心 Tag**：角色专有 Tag、发型发色、瞳色、标志性饰品
- **服装与材质**：具体服装名、衣物细节（`pleated_skirt, white_shirt, ribbon`）、布料质感
- **表情与姿态**：微表情（`gentle_smile, looking_at_viewer, blushing`）、肢体动作（`sitting_on_chair, holding_book`）
- **场景与环境**：背景要素（`classroom, sunset, window, flying_petals`）
- **镜头与光照**：`cinematic_lighting, golden_hour, depth_of_field, upper_body, dynamic_angle`
- **负面词（Negative）**：`worst_quality, low_quality, bad_anatomy, bad_hands, missing_fingers, extra_fingers, blurry, cropped, watermark, text, signature`

### 3. Krea 2 SFW 散文（Prose）9段分桶法
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

## 五、NSFW（R18）唯美艺术重构与去模板化铁律（美感、情境与灵魂先行）

> **核心觉醒**：**色气的最高境界是“唯美与心动”，绝不是粗暴直奔器官的肉块撞击！**  
> 过去很多新角色沦落为“按桌俯身后入 + 折腿交尾压 + 骑乘 + 自慰”这一套枯燥无味的公式化流水线，甚至在描述中充斥着“暴洪般中出灌满子宫、深桩到底”等地摊同人脏词——这不仅彻底扼杀了角色的灵魂，而且在 AI 生图中极易引发断腰、多肢骨折和画面崩坏。

### 1. 唯美去模板化四大核心支柱

```
                  ┌──► 支柱1：中近景特写与神态为王（Medium Shot，聚焦面部红晕、泪光与喘息）
                  ├──► 支柱2：“半解半露”（Half-dressed）的极致禁忌美感（拒绝粗暴全脱与粗暴撩裙）
【唯美高质感 NSFW】
                  ├──► 支柱3：反差服装深度融合（花嫁更衣室/海滩湿身/大号男友衬衫/温泉浴衣）
                  └──► 支柱4：稳定与温存体位（推崇唯美跨坐、侧卧相拥、专属弱点名场面；弃用生硬后入与交尾压）
```

1. **支柱 1：中近景特写与神态为绝对灵魂（Medium / Cowboy Shot 优先）**：
   - 拒绝把镜头死死怼在下半身生殖器官上。
   - 画面重心必须集中在**角色的眼神与面部微表情**：眼眶绯红微湿（`teary_eyes, heavy_blush`）、微张喘息咬住下唇（`parted_lips, biting_lip`）、被香汗沾湿贴在锁骨上的凌乱发丝、因急促呼吸而起伏的胸脯；下半身结合处只作为背景中自然的受力承载，营造电影级的沉浸感。
2. **支柱 2：【情趣战袍框架 + 显式核心部位真实外露（Erotic Lingerie with Anatomically Visible Core）】**：
   - 顶级色气的美感在于**情趣着装的视觉框架与关键内部器官的完全显露相结合**，既有情趣内衣/吊带袜的勒肉张力，又有毫无遮拦的真实肉体冲击。
   - **下身核心真实露出与物理动作**：
     - `crotchless_panties`（开档内裤：身着蕾丝内裤但核心底部完全镂空开档，小穴毫无保留直接外露）；
     - `panties_aside` / `pulling_panties_aside`（手拨开内裤边缘：手指将细带拉向一侧，露出粉嫩花瓣）；
     - `panties_pulled_down` / `panties_around_one_leg`（内裤褪至大腿或挂在单膝）；
     - `exposed_pussy` / `pussy` / `spread_pussy`（小穴显式声明与双腿大开展示）；
     - `pussy_juice` / `liquid_drip`（私处晶莹爱液拉丝滴落，水光感拉满）；
     - `cameltoe`（薄透布料紧绷勒出的饱满缝隙线条）。
   - **胸部核心真实露出与物理动作**：
     - `exposed_breasts` / `bare_breasts`（双乳完全裸露在外）；
     - `nipples` / `areola`（明确绘制粉嫩乳头与乳晕）；
     - `bra_lift` / `shirt_lift`（双手将文胸或睡衣掀至锁骨，饱满胸部完整悬露）；
     - `pulling_bra_down`（单手将文胸罩杯向下扒拉，弹出一侧乳房与挺立乳头）；
     - `nipples_visible_through_clothes` / `transparent_bra`（穿极薄黑色/白色蕾丝，透过薄纱清晰直视乳头）；
     - `areola_slip`（微型布料边缘溢出的乳晕滑漏）。
   - **高色气情趣战袍积木**：
     - `sheer_babydoll` / `open-front_negligee`（前开襟透明薄纱睡袍：前胸小腹全敞开，随呼吸向两侧滑落）；
     - `garter_straps` / `black_thighhighs` / `tight_straps`（吊带黑丝勒在丰满大腿根部的肉感勒痕）；
     - `micro_bikini` / `string_panties` / `slingshot_swimsuit`（微型绳带束缚，遮蔽面积趋近于零）；
     - `naked_apron` / `reverse_bunny_suit`（裸体围裙与反向兔女郎，侧乳与臀部全空）。
3. **支柱 3：与日常反差服装深度联动**：
   - **【誓约花嫁夜的更衣室缠绵】**：圣洁头纱未摘，纯白婚纱露肩抹胸滑落，在静谧烛光与花瓣中，面对面十指紧扣的初夜温存；
   - **【海滨夕阳更衣室的湿身亲昵】**：落日晚霞斜照，未干透的比基尼贴在泛着水光的光滑肌肤上，双手环颈跨坐深吻；
   - **【清晨微光下的大号衬衫被窝温存】**：晨曦透过白纱，只穿一件宽大的男士白衬衫，下摆半遮，在被窝里的慵懒与娇羞；
   - **【温泉旅馆的浴衣半敞】**：白雾氤氲，榻榻米上浴衣斜滑微露半边酥胸与白皙香肩，微醺迷离的侧卧迎合。
4. **支柱 4：体位谱系重构（去崩坏、提美感）**：
   - 🌟 **首选高质感体位**：
     - **面对面跨坐骑乘（Cowgirl / Lap-sitting）**：正面微仰视机位，女性完全占据画面主体，五官神态一览无遗，发丝动感饱满，AI 出图稳定性极高；
     - **面对面相拥 / 侧卧温存（Spooning / Intimate Embrace / Lotus）**：**全面替代折腿交尾压！** 两人耳鬓厮磨、鼻息相闻、慢节奏的温柔沦陷，具有极高的恋爱感与被珍视感；
     - **私密独处 / 情愫自抚（Sensual Solo）**：镜前羞怯自赏、浴池温水滑过、被窝深处的私密探索，构图纯净，绝无畸形多余肢体；
     - **角色专属弱点名场面（Signature Lore Eroticism）**：挖掘角色独一无二的设定（如菈菈敏感心形尾巴抚弄失神、小暗发丝触手过载失控缠绕、古手川唯风纪臂章下的更衣室破防、伊卡洛斯动力炉过热与羽翼共振）。
   - ⚠️ **淘汰/严加限制的劣质体位**：
     - **淘汰生硬俯身后入（Doggystyle）**：镜头重心在臀部导致面部严重形变或消失，且极易引发断腰与悬浮异物；
     - **严禁暴力折腿交尾压（Mating Press）**：肢体过度扭曲、极易骨折多腿，压制感暴力粗糙，彻底摧毁美感。

### 2. Anima NSFW 唯美结构化 Tag 体系
- **标准分级前缀**：`masterpiece, best_quality, newest, absurdres, score_9, score_8_up, rating:explicit, nsfw, explicit, 1girl, solo`（**必须携带 `1girl, solo`，严禁 `1boy, heterosexual, sex` 等双人词**）
- **角色核心与情趣框架**：
  - 外貌 DNA：发型、发色、特征（如 `golden_darkness, blonde_hair, red_eyes`）；
  - 情趣战袍：`sheer_babydoll, open-front_negligee, black_lace, garter_straps, black_thighhighs, tight_straps, micro_bikini`；
- **核心部位真实露出（绝不遮蔽）**：
  - 胸部真露：`exposed_breasts, bare_breasts, nipples, areola, bra_lift, pulling_bra_down, nipples_visible_through_clothes`；
  - 下身真露：`crotchless_panties, panties_aside, pulling_panties_aside, exposed_pussy, pussy, spread_pussy, spread_legs, pussy_juice, cameltoe`；
- **唯美单人动作与体位**：`sensual_solo, masturbation, touching_own_body, hand_between_legs, hand_on_breast, arched_back, dynamic_crouch, leaning_back`
- **神态与微表情核心**：`heavy_blush, blushing_ears, teary_eyes, parted_lips, biting_lip, saliva_trail, messy_hair, sweating, shy, emotional`
- **柔和光影与环境**：`warm_lighting, silk_bedsheets, ambient_steam, water_droplets, cinematic_lighting, soft_focus, depth_of_field, cowboy_shot`
- **负面词（Negative）**：必须严防畸变与多人员（`bad_anatomy, bad_hands, missing_fingers, extra_fingers, bad_legs, 2girls, 1boy, multiple_girls, extra_limbs`），**严禁加入 nsfw/nude**。

#### 🌟 Anima NSFW 典范 Prompt（【情趣黑丝薄纱 + 开档直视】）：
```text
masterpiece, best_quality, absurdres, score_9, score_8_up, rating:explicit, nsfw, explicit, 1girl, solo,
yuria_harudera, honey_blonde_hair, wavy_hair, blue_eyes, mole_under_eye, glasses_removed,
sheer_babydoll, open-front_negligee, black_lace, translucent_cloth, see-through,
garter_straps, black_thighhighs, tight_straps,
bra_lift, exposed_breasts, bare_breasts, nipples, areola,
crotchless_panties, panties_aside, exposed_pussy, pussy, pussy_juice,
spread_legs, arched_back, hand_between_legs, touching_own_body,
heavy_blush, blushing_ears, teary_eyes, parted_lips, biting_lip, saliva_trail, sweating, skin_moisture, messy_hair,
bedroom, silk_bedsheets, pillows, warm_dim_lighting, dramatic_shadows,
cowboy_shot, dynamic_angle, depth_of_field
```

### 3. Krea 2 NSFW 唯美自然语言散文（Sensual & Intimate Prose）

**优秀散文示范（花嫁夜面对面温存）**：
```text
An exquisite, romantically sensual adult anime illustration of Golden Darkness (Yami) from To LOVE-Ru sharing a deeply intimate, tender moment on a grand canopy bed. She is partially undressed, wearing a delicate translucent bridal veil that drapes over her cascading golden blonde tresses, while her off-shoulder white satin bridal gown is unlaced and gathered around her slender waist. She sits in a gentle lap-straddling embrace facing her partner, her small hands resting gently against his shoulders as her porcelain body glows in warm candlelight. Tears of overwhelming emotional tenderness and pleasure glisten at the corners of her wide ruby-red eyes, and her soft pink lips are parted in a breathy sigh. Her fair skin is flushed with a delicate crimson blush from collarbone to cheek. Medium shot focusing on her captivating face, the emotional bond, and the soft curves of her heaving chest, rich cinematic lighting, elegant anime key visual art style, no text, no extra people.
```

---

## 六、热门角色库与服装对齐速查表

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

## 七、双引擎分流编译标准模板

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

---

## 八、蓝图数据表（Blueprint JSON）字段映射与故事还原硬性契约

在维护与编写 `data/scene-blueprints.json` 时，协作者必须理解并严格遵守各字段的生产消费关系：

```
                                  ┌──► promptTokens (Anima Danbooru Tag流: 角色/服装/体位/表情)
【中文故事设定: description + action】
                                  └──► promptProse  (Krea 2 纯英文散文流: 故事100%还原/光影/受力)
```

| 字段名称 | 消费引擎 / 核心用途 | 故事还原硬性契约与编写规范 | 严禁的反模式 |
|---|---|---|---|
| `description` | 前端界面卡片展示、世界观叙事、台词与剧情核心 | 中文详细描绘角色的情境、心境台词、动作互动与肢体细节。 | 严禁空泛无物，必须提供明确动作与环境。 |
| `action` | 快速检索与动画导演机位判定 | 一句话凝练主动作、体位受力与关键微表情。 | 严禁与 `description` 动作冲突。 |
| `promptProse` | **Krea 2 主引擎生图唯一正向输入** | **必须 100% 逐字具象还原 `description` 中的所有动作、服装破坏/半褪状态、受力形变、环境道具与神态！** 长度通常 300~500 字符。 | **严禁写成一两句抽象概括！** 严禁使用元评论（"Masterpiece H-CG renders..."）代替具体动作！ |
| `promptTokens` | **Anima 主引擎生图正向 Danbooru Tags** | 标准小写下划线 Tag 数组。必须包含精准的角色名、服装状态、体位（`cowgirl_position`, `straddling`, `embracing`, `lap_sitting`）、受力、体液与表情。 | 严禁缺少体位词，严禁出现中文或大写。 |
| `recommendedSize` | 渲染分辨率（画幅比例） | **严格遵守体态轴向黄金法则**：<br>· 侧卧/俯身/横向拉伸 $\rightarrow$ **`1536x1152`**（防断腰）<br>· 仰卧/骑乘/垂直 POV $\rightarrow$ **`1152x1536`**（垂直纵深） | 严禁体位与画幅反向错配。 |

---

## 九、防过度精简（Anti-Truncation）与防粗暴同质化红线

> ⚡ **痛点警示**：精简提示词的目的是去除**无用废词与语法污染**，绝不是把**具体的动作、受力和故事删减成干瘪的一句话**！更不能堕落为千篇一律的粗俗肉块模板！

### 1. 辨证区分「精简」与「丰满」的边界
- ✅ **必须坚决精简剔除的（负债）**：
  - 质量词：`masterpiece, best_quality, score_9, ultra_detailed`（Krea 2 中会破坏画面）。
  - 权重语法：`(tag:1.2)`（Krea 2 中失效且破坏语义）。
  - 元描述套话：`"Masterpiece anime visual novel CG aesthetic highlights..."`（模型无法根据评论出图）。
  - 相互冲突的体位 Tag（如同一蓝图同时包含 `missionary` 和 `doggystyle`）。
  - 粗俗同人地摊文废词：如“如暴洪般全面灌满子宫、深桩到底”等，模型不仅不理解，反而严重污染语义并导致出图恶俗崩坏。
- ❌ **严禁精简弱化的核心资产（必须丰满生动）**：
  - **具体物理动作与体位**：反客为主唯美骑乘、面对面相拥温存、自慰情愫探索、角色专属弱点抚弄。
  - **身体接触与受力形变**：双手环颈、轻抚面颊、双腿盘腰、发丝散落胸前。
  - **服装半褪与层次美感**：花嫁头纱未除抹胸滑落、大号白衬衫下摆微遮、比基尼湿身透肉、浴衣单侧露肩。
  - **环境光影与氛围道具**：大理石神殿烛光、海滨落日余晖、清晨白纱丁达尔光束、温泉白雾氤氲。
  - **微表情与心动神态**：眼眶湿润含泪、咬唇强忍、轻微泛红喘息、迷离目光。

### 2. 协作者四大高频「坏味道（Bad Smells）」速查
1. **坏味道 1：宏观评论代替微观动作（Meta-Commentary Drift）**
   - ❌ 错误：`An explicit sexual clash takes place upon the cold floor. Masterpiece visual novel H-CG renders the pale skin with breathtaking impact.` *(模型根本不知道谁在上面、做了什么动作！)*
   - ✔️ 正确：`Pinned down across the cold steel training floor with her mercenary duster stripped open, Lappland takes violent missionary thrusts, sinking her sharp wolf fangs into her partner's shoulder...`
2. **坏味道 2：成人场景尺度降级（De-escalation Bug）**
   - ❌ 错误：`description` 写着激烈交欢与深层中出，Prose 却写成 `Sitting on bed with dress loosened, gazing with an adoring blush.` *(性爱变成了普通露胸写真！)*
   - ✔️ 正确：忠实还原两性结合、抽送、中出与高潮反应。
3. **坏味道 3：动作与画幅轴向冲突（Aspect Ratio Conflict）**
   - ❌ 错误：俯身趴姿却配置 `1152x1536` 竖画幅（导致模型挤压断腰或长出多余手脚）。
   - ✔️ 正确：横向延伸姿态强制 `1536x1152` 横画幅；仰卧/骑乘强制 `1152x1536` 竖画幅。
4. **坏味道 4：机械公式化与同质化肉块描写（Cookie-Cutter Smut & Vulgarity）**
   - ❌ 错误：所有新角色不分性格与背景，一律机械套用“课桌俯身后入 + 大床折腿交尾压”，文案千篇一律“暴洪般白浊射入子宫深处发出极乐悲鸣”。*(审美疲劳、剥离角色灵魂、AI 高概率画出多腿断腰骨折)*
   - ✔️ 正确：结合角色身份与反差服装（花嫁/泳装/居家大号衬衫/浴衣），采用高稳定性、重神态面部特写的面对面相拥、跨坐骑乘或专属弱点名场面，用电影级唯美光影叙事。

---

## 十、质量红线与质检 Checklist

在交付或生成提示词时，必须对照以下 12 项标准进行全量核查：

- [ ] **1. 引擎分流彻底**：Anima 保持标准小写下划线 Tag；Krea 2 完全转换成地道优美的英文长散文，无任何残留 Tag 或下划线。
- [ ] **2. 故事 1:1 完整还原**：`description` 中的所有核心情节、动作、道具与服装状态，在 `promptProse` 和 `promptTokens` 中均有清晰对应的具象描写。
- [ ] **3. 拒绝尺度降级**：R18 性爱蓝图必须包含明确的两性结合（`penetration`, `missionary`/`riding`/`lap_sitting`）或显式中出，严禁退化为单人露胸写真。
- [ ] **4. 散文信息密度达标**：Krea 2 完整场景 Prose 保持 300~500 字符（涵盖 环境 + 服装半褪 + 姿势受力 + 动作结合 + 表情体液），严禁低于 200 字符的敷衍短句。
- [ ] **5. 剔除无效元评论与粗俗脏词**：严禁出现 `Masterpiece visual novel H-CG artistry renders...` 等套话；严禁使用地摊同人文式低俗用词。
- [ ] **6. 姿态空间压缩合规**：**拒绝直挺挺木桩站立大远景！** 采用坐/靠/倚/折叠/道具互动姿态，确保“主体占比 65%~75% + 头顶留白 5%~10% + 高清面部五官 + 全身身段基本入画 + 丰富背景”。
- [ ] **7. 画幅轴向严格绑定**：水平延伸（俯身/趴姿）强制 `1536x1152` 横构图；垂直纵深（仰卧/骑乘/POV）强制 `1152x1536` 竖构图。
- [ ] **8. 负面词策略准确**：Anima 包含标准解剖防护；Krea 2 本地 Turbo 负面保持为空（排除词写在正向句末）。
- [ ] **9. 角色特征无遗漏**：正确附带原作 Franchise；发型、发色、瞳色、兽耳、角、尾巴等标志性生物特征严格锁定。
- [ ] **10. 语法与权重安全**：Anima 权重不超过 1.5，括号成对闭合；Krea 2 不包含权重语法或 `score_9/masterpiece` 废词。
- [ ] **11. 场景配比合规（反差萌与救赎感原则）**：战斗/特殊背景角色**至多保留 1 套战斗服高光场景**；其余场景必须大量配齐**海滨度假泳装、圣洁浪漫花嫁、清晨居家女友、传统和风/街头约会**等心动反差日常。
- [ ] **12. NSFW 唯美去模板化**：严禁全员套用“后入+交尾压”机械模板；优先采用面对面跨坐骑乘、侧卧/坐拥温存、私密情愫自抚或角色专属弱点名场面；镜头聚焦面部中近景神态与半遮半掩（Half-dressed）衣衫不整美感。
