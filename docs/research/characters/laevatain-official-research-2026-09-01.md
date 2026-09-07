# 莱万汀（Laevatain / Arknights: Endfield）官方样貌与服装调研文档

**日期**：2026-09-01 21:58
**性质**：正式调研归档（用户要求"调研的文档呢"——补齐证据链，杜绝瞎猜）
**证据等级**：官网高清立绘（用户提供，最高）> 社区 LoRA 训练资料 > Danbooru 高分图 tag 统计 > 百科

---

## 一、证据源清单

| # | 来源 | 内容 | 可信度 |
|---|---|---|---|
| 1 | 用户提供的官网立绘高清正面图（E:\photo\ScreenShot_2026-09-01_213812_598.png）+ 侧身扛剑图（19:16 那张） | 视觉真值 | ★★★★★ |
| 2 | Civitai Laevatain v1.0 Illustrious LoRA（civitai.red/models/2356852）训练者注释 | 一手训练 prompt | ★★★★☆ |
| 3 | Danbooru laevatain_(arknights) 高分图 tag 统计（多次搜索汇总） | 社区画法共识 | ★★★★ |
| 4 | 萌娘百科（中/英版）萌点栏 | 概括性描述 | ★★★ |
| 5 | Danbooru Surtr wiki（Laevatain 是 Surtr 同位体，ask 画师设计） | 设计背景 | ★★★ |

---

## 二、逐层拆解（官网立绘为准）

### 2.1 头部
| 特征 | 官网观察 | 结论 |
|---|---|---|
| 发色 | 红色 | red_hair / crimson_hair |
| 发长 | 正面图蓬松到肩下、侧身图垂背——**长发**（正面蓬松显短是错觉，社区压倒性 long_hair 佐证） | long_hair |
| 发型 | 蓬松外翘 + 两缕垂脸侧 | hair_intakes + sidelocks |
| 角 | **中短**、从头顶两侧向上略外撇——**不是巨龙长角**（v5 堆 4 个角 tag+权重导致长角翻车；v7 prose 写 "large upward-curving" 又顶大了） | demon_horns + black_horns，**prose 禁写 large** |
| 瞳色 | 紫色（Danbooru 压倒性 purple_eyes，萌娘百科紫瞳；Anima 参考图红瞳是模型偏差） | purple_eyes |
| 唇 | LoRA 资料标 lipstick | 可选 |

### 2.2 颈/肩
| 特征 | 官网观察 | 结论 |
|---|---|---|
| choker | 黑色颈环+金属坠（LoRA: metal pendant） | choker |
| 白翼状分离领 | **肩后两片大型白色翼状领饰**——最显眼特征，Anima 1.1 至今画不出白色形态（画成黑色尖刺） | detached_collar（白翼领为残余难点） |
| 肩部 | 露肩（LoRA: shoulder cut）+ 黑色肩饰片（萌点"外套半脱"） | bare_shoulders + detached_sleeves |

### 2.3 上身
| 特征 | 官网观察 | 结论 |
|---|---|---|
| 结构 | **黑色胸衣+交叉绑带**（非完整上衣），胸口开线（cleavage） | chest_strap + cleavage + black_bra |
| 手臂 | **双手**黑色肘长手套（v5 误写单臂） | elbow_gloves + black_gloves |

### 2.4 腰部
| 特征 | 官网观察 | 结论 |
|---|---|---|
| 腰封 | 黑色皮质束腰+多扣 | waist_cincher（prose 描述） |
| 挂件 | 白色小包 + 红色挂件（LoRA: pink purse） | belt_pouch |

### 2.5 裙子（v8 修正重点）
| 特征 | 官网观察 | 结论 |
|---|---|---|
| 结构 | **双层裙**：外层黑（下摆焦烧撕裂/锯齿碎裂）+ 内层品红 | black_dress + 双层 prose |
| **裙撑** | **外层黑裙有裙撑结构（petticoat），从腰部蓬开**——不是贴身垂坠飘带！用户亲自指出，Danbooru 3 张高分图带 petticoat tag 佐证 | **petticoat（v8 新增）** |
| 长度 | 长飘裙（LoRA: long floating dress）——非迷你贴身 | 模型角色记忆主导，不硬写裙长 |

### 2.6 腿/鞋
| 特征 | 官网观察 | 结论 |
|---|---|---|
| 腿 | 裙撑下裸腿露出 | bare_legs |
| 绑带 | 大腿黑色袜带/吊带 | thigh_strap |
| 靴 | 黑色高跟短靴（萌点"短靴"） | 黑高跟，模型记忆 |

### 2.7 背部/武器
| 特征 | 官网观察 | 结论 |
|---|---|---|
| 碎片翼 | 大型黑曜石碎片从背后展开（红色边缘光） | 模型角色记忆自发（不堆 token） |
| 尾 | 黑色恶魔尾 | devil_tail |
| 武器 | 重型黑红熔岩巨剑（扛肩） | greatsword |

---

## 三、社区 LoRA 训练 prompt 原文（证据源 #2 全文）

> Appearance: laevatain, purple eyes, red hair, demon horns, slit pupils, lipstick.
> Costume: laevatain costume, metal pendant, chest straps, shoulder cut, cleavage, black dreess, black gloves, detached collar, thigh strap, long floating dress, pink dress interior, pink purse, dress decorations, double-layered dress, the outer layer of the dress is black, the inner is pink, the lower edges of the outer black layer of the dress are burnt and torn, thigh straps, elbow gloves, detached sleeves, chest strap.

注：作者声明"未使用 Surtr 图训练（服装不同）"——即这是莱万汀专属服装设定，非史尔特尔混同。

## 四、Danbooru 高分图 tag 频次统计（证据源 #3 汇总）

高频（>50% 图）：long_hair, red_hair, purple_eyes, horns/black_horns/demon_horns, sleeveless_dress, sideless_dress, bare_shoulders, large_breasts, solo
中频（20-50%）：black_dress, detached_sleeves, detached_collar(含 high_collar), thigh_strap, elbow_gloves, petticoat, hair_intakes, sidelocks, sword/weapon, choker, cleavage
低频（<20%）：pink_skirt/colored_petticoat, two-tone_dress, multicolored_sleeves, red_gloves, chest_strap, belt_pouch, highleg

萌娘百科萌点：高飞车、刀剑、双角、短靴、巨乳、外套半脱、露肩装、连衣裙、火能力

## 五、v8 提示词定稿（本次修正项加粗）

**identityTokens（26 个，极简）**：
laevatain_(arknights), 1girl, solo, red_hair, long_hair, sidelocks, hair_intakes, purple_eyes, demon_horns, black_horns, devil_tail, black_dress, **petticoat**, detached_collar, detached_sleeves, elbow_gloves, black_gloves, chest_strap, cleavage, thigh_strap, belt_pouch, choker, bare_shoulders, greatsword, arknights, arknights_endfield

**identityProse**（去 large、写裙撑）：
"a Sarkaz demon girl with crimson red hair, sidelocks, short black demon horns, purple eyes, and a devil tail, in a black double-layered dress with a puffy petticoat, torn burnt-edged outer hem and pink interior, a white detached collar, a black choker with metal pendant, black bra with chest straps, both arms in long black elbow gloves, a black waist cincher with a pink pouch, bare legs with a black thigh strap, black heeled boots, and dark obsidian shard-wings"

**修正对照**：
| 项 | v7 错 | v8 修 |
|---|---|---|
| 裙撑 | 无（裙贴身垂坠） | **petticoat + puffy** |
| 角 | prose 写 "large upward-curving"（顶大） | **"short black demon horns"（禁 large）** |
| 双层裙 | 有 | 保留 + **torn burnt-edged** |
| 腰包 | belt_pouch | 保留（LoRA: pink purse → prose 写 pink pouch） |

---

## 六、Anima 1.1 已知盲区（多轮实测）

1. 白色翼状分离领的"白色"形态——5 次尝试均画成黑色尖刺（v7 attempt-5 也是）。攻坚需 Krea 2。
2. 底模认识 laevatain_(arknights)（伊冯可识别佐证），**角色 tag 是最强先验**——堆长尾 token 会污染角色记忆（v5 教训）。

---

# 附：提示词网站莱万汀词条全调研（22:15 用户指示"老老实实去提示词网站调研"）

## 5 个来源的原文词条

### 来源 1：SeaArt「明日方舟终末地 莱万汀」Anima 基座 LoCon（2026-06-19，与我们同底模）
- 人物tag：`laevatain (arknights), red hair`
- 衣服tag：`bare shoulders, dress, black dress, gloves, black gloves, strap, detached collar, jacket, sleeveless dress, black jacket, high heels, black socks`
- 武器：`sword, circle floating behind` ← **背后漂浮圆环**
- 特效：`lava, fire`
- 推荐分辨率 1024x1536（竖版）

### 来源 2：TensorArt「Laevatain v2.0」Illustrious
- `laevatain_(arknights), purple eyes, red hair, hair intakes, demon horns, black dress, elbow gloves, detached collar, detached sleeves, sleeveless dress, chest strap, belt pouch, thigh strap, high heel boots`
- Other item: `floating device` ← 漂浮装置

### 来源 3：TensorArt「Laevatain (Pre-release) v1」Illustrious（**最详细，含发型与白色外套结构**）
- `1girl, laevatain, solo, red hair, black horns, bangs, sideburns,` **`short hair`**`, multi-colored eyes, purple eyes, slit pupils, lipstick,` **`white collar`**`, metal pendant, chest straps, shoulder cut, cleavage, black dress,` **`white cut, single free shoulder, loose jacket`**`, black long gloves,` **`long floating dress, pink dress interior, pink purse`**`, dress decorations, thigh straps`

### 来源 4：Civitai「Laevatain v1.0」Illustrious
- Appearance: `laevatain, purple eyes, red hair, demon horns, slit pupils, lipstick`
- Costume: `metal pendant, chest straps, shoulder cut, cleavage, black dress, black gloves, detached collar, thigh strap, long floating dress, pink dress interior, pink purse, dress decorations, double-layered dress, outer layer black inner pink, lower edges burnt and torn, elbow gloves, detached sleeves, chest strap`

### 来源 5：liblib「【明日方舟:终末地】莱万汀」Illustrious
- 触发词：`Laevatain (Arknights: Endfield), devil girl, Laevatain's horns, clothes: Laevatain def black dress, 1girl, gloves, purple eyes, red hair`

## 跨源共识定稿（v14 采用）

**本体**：laevatain_(arknights) + 1girl solo + red_hair + **short_hair + bangs + sideburns** + hair_intakes + purple_eyes + slit_pupils + black_horns + devil_girl + devil_tail + lipstick

**服装**：black_dress + sleeveless_dress + **white_collar + metal_pendant** + chest_straps + shoulder_cut + **single_free_shoulder + loose_jacket**（白领+单肩露+宽松外套半脱=用户立绘的"白色大物"真相）+ black_long_gloves/elbow_gloves + **long_floating_dress + pink_dress_interior + pink_purse** + double_layered + **lower_edges_burnt_and_torn** + thigh_straps + high_heel_boots + black_socks

**武器/特效**：flaming_sword + **circle_floating_behind（背后圆环）** + lava + fire + embers
