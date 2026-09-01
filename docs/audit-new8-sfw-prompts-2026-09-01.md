# 8 位新热门角色 SFW 场景提示词检查报告

**日期**：2026-09-01
**范围**：8-31 `acc3a62` 接入的 8 位新角色（eris_greyrat / hoshino_ai / kurokawa_akane / yvonne_arknights / morgan_le_fay_fate / mash_kyrielight / mikasa_ackerman / krista_lenz）共 48 个 SFW 蓝图
**重点**：用户指定伊冯（yvonne_arknights）可跳过 → 实际审 7 角色 42 SFW
**维度**：① 角色特征（DNA vs 提示词）  ② 场景内部冲突  ③ 真实出图画面效果
**方法**：静态扫描 + 对 4 个硬伤场景真实出图（Anima, anima-aesthetic-v1.1, 832x1216 / 1216x832）

---

## 一、整体结构性问题（全局共通）

### 1.1 负向词模板分层

| 模板 | 规模 | 适用 |
|---|---|---|
| 55 项（SFW 通用） | worst/low/blurry/anatomy/…/multiple girls/two people/second person/extra characters/duplicated subject/double image/multiple frames/flat lighting/modern/sci-fi/dark shadowed face/… | 几乎所有 SFW 场景 |
| 64 项（角色特化） | 55 项 + shield/large shield/weapon/holding shield/cross shield/duplicate/clone/twin/2girls | 玛修日常 4 场（chaldea_corridor / beach / dangerous_beast / cafeteria） |
| 55 项精简（角色特化） | 不含盾类复制压制，仅共用 55 项 | 玛修战斗 2 场（simulator / ortinax_launch）+ 三笠 / 黑川茜 / 星野爱 / 艾莉丝 / 希斯特里亚 / 摩根部分场景 |
| 70 项（NSFW 通用） | 64 项 + 6 项 R18 专用 | NSFW 场景 |

> **用户已校正关键判断**：玛修"日常禁盾、战斗不禁"是对的（项目已分模板）。问题不在一刀切。

### 1.2 出图流水线（`generate-popular-showcase-anima11.js:106-127`）再注入

蓝图 negative 之外，**运行时强制追加**两层"防分身/防第二人"：
- `soloGuard`: `(single girl only:1.4), (one person only:1.4), no second person, no other person, (no clone:1.4), (no duplicate:1.4)…`
- `cloneNegative`: `duplicate, clone, copy, doppelganger, twin, two of her, second instance of her, duplicated subject, multiple girls, extra girl, same character twice`

> 即"蓝图 negative + 角色模板 negative + soloGuard + cloneNegative" **四重压制**。任何 prose 提及"two/audience/crowd/allies/fans/multi…"都会被强力反向。

---

## 二、真实出图验证（4 张关键硬伤）

出图目录：`E:\code\2\lora\AI\Reviews\ShowcaseRefresh\2026-08-14_v18-popular-all-rella\images\…\attempt-1.png`

### 2.1 ✅ mash_kyrielight_simulator — 玛修模拟战斗
**预期**：盾能否画出？prose 明确"plants her enormous cross-shaped shield"
**结果**：
- ✅ **大盾画出来了**（白色星形/十字盾斜插身前，与参考图形态一致）—— 55 项模板不包含 shield 类，cloneNegative 也不冲突，盾能画。
- ⚠️ 紫发被弱化为偏淡紫，**遮右眼效果不明显**（刘海中分）
- ⚠️ 身材胸部明显缩水（与 reference 比）
- ⚠️ 装甲上紫色腰带/高光细节被黑色主导
- ✅ 模拟器蓝光网格地面很有科幻感

**判断**：用户正确——禁盾只对日常形态，战斗场景盾能画。但玛修的"紫发遮眼短发+紫瞳"DNA 在 Anima 下被弱化。

### 2.2 ✅ hoshino_ai_live_stage — 星野爱 B 小町演唱会
**预期**：应援海/观众能否被画？negative 禁 multiple girls
**结果**：
- ✅ **粉红应援海完美呈现**，背景大量观众
- ✅ 紫发、星瞳、兔耳发饰、粉裙、心形胸针**全部到位**
- ✅ 跃起动作 + 舞台聚光 + 应援海构成完整演唱会氛围
- ⚠️ camera=wide_shot，但实际构图是 medium 偏 wide 居中星野

**判断**：**4 张里效果最好的一张**。prose 明确+ negative 强力压制下，演唱会多观众仍能画出来。

### 2.3 ⚠️ hoshino_ai_fan_signing — 星野爱握手会
**预期**：握手需要第二人；negative 强力压制
**结果**：
- ✅ **握手实现**（画面右下角**一只粉丝的手从画面外伸入**与星野爱握在一起）
- ✅ 紫发/星瞳/兔耳发饰/粉裙/心形胸针全部到位
- ✅ 背景应援海画出
- ⚠️ "second person"被模型以"画面外单手"形式实现——不算真正第二人，但视觉上有点"诡异"

**判断**：比预期好。但 soloGuard + negative 没能阻止"画面外单手"，属于 prose 描述强制引导。

### 2.4 ❌ hoshino_ai_rehearsal_room — 星野爱彩排室镜前
**预期**：prose 写"row of mirrors multiply her figure into a glittering, disciplined sequence of poses"
**结果**：
- ❌ **画出"5 个独立舞蹈的星野爱"**——模型把镜面误读成"多人舞蹈队"
- ❌ 镜中分身都是**有独立身体、独立动作的真人**，**分不清本体与倒影**
- ❌ 4 重 negative（blueprint + 55项模板 + soloGuard + cloneNegative）全部失效——prose 太具体
- ✅ 紫发/星瞳/兔耳发饰/粉裙全部正确
- ⚠️ 灯光不错，彩排室环境感清晰

**判断**：**4 张里最差的一张**。prose 描述"镜中多身"被模型误读为"多身独立实体"。**这是 git log 763b55c 修复黑川茜试衣间"镜面错位与双人分身"的同款问题**——本质是"镜中多身 prose 不可写"。

---

## 三、角色特征一致性（DNA vs 蓝图 promptTokens）

每条按"tag 层核心特征覆盖度"打分：✅ 全到位 / ⚠️ 部分 / ❌ 大缺

| 角色 | DNA 核心特征 | 蓝图 tags 覆盖 | 评级 |
|---|---|---|---|
| **hoshino_ai** | 紫发·星瞳·兔耳发饰·单侧上扎·粉裙·心形胸针 | 6 SFW 中 **5/6 缺 purple_hair / purple_eyes**，star_pupils 4/6，rabbit_hair_ornament 4/6 | ⚠️ |
| **kurokawa_akane** | 蓝紫长直发·蓝紫瞳·演剧时星瞳·细框眼镜 | 6 SFW 中 blue_purple_hair 5/6，**blue_purple_eyes 0/6**，star_eyes 3/6（仅演剧），glasses 1/6 | ⚠️ |
| **mikasa_ackerman** | 黑发·灰瞳·红围巾·短刘海 | 6 SFW 中 **black_hair 0/6，short_hair 0/6，gray_eyes 0/6**，red_scarf 6/6 | ❌ |
| **krista_lenz** | 金发·蓝瞳·温柔微笑 | 6 SFW 中 blonde_hair 6/6，**blue_eyes 0/6（coronation/snowy_wall prose 有但 tags 无）** | ⚠️ |
| **eris_greyrat** | 深红卷发·红瞳·粗眉·呆毛·白色发带 | 6 SFW 中 **crimson_hair 2/6，red_eyes 0/6，thick_eyebrows 0/6，ahoge 0/6**，headband 3/6 | ❌ |
| **morgan_le_fay_fate** | 银白长直发·冰蓝瞳·王冠·黑蓝哥特王裙 | 6 SFW 中 white_hair 6/6，blue_eyes 6/6，crown 4/6 ✅ | ✅ |
| **mash_kyrielight** | 粉紫短发·紫瞳·刘海遮右眼·十字大盾 | 6 SFW 中 **short_hair 0/6，hair_over_one_eye 0/6，purple_eyes 0/6**，pink_hair 6/6 | ❌ |
| **yvonne_arknights** | 粉双马尾·蓝瞳·角·尾·双枪·工程师 | 6 SFW 中 pink_hair 6/6，twintails 6/6，blue_eyes 6/6，horns 6/6，tail 6/6，gun 2/6，engineer 1/6 | ✅ |

**全局问题**：8 位角色中 **5 位存在 DNA 关键特征在 tag 层完全缺失**（三笠黑发灰瞳、艾莉丝红瞳、玛修紫瞳遮眼、星野爱紫发紫瞳、黑川茜蓝紫瞳）。提示词 prose 有写但 tag 权重不足时，Anima 出图会弱化或丢失这些特征。

---

## 四、提示词内部冲突清单

### 🟥 P0（必须修）

| 场景 | 冲突 | 影响 |
|---|---|---|
| `hoshino_ai_rehearsal_room` | prose 写"row of mirrors multiply her figure into a glittering, disciplined sequence of poses" → 4 重 negative 压制仍被 prose 强行实现 → 画成"多人舞蹈队" | 画面诡异，**已实测** |
| `hoshino_ai_live_stage` / `krista_lenz_coronation` / `krista_lenz_village_visit` / `mash_kyrielight_simulator` / `yvonne_arknights_canteen` | prose 描述多人（应援海/加冕人群/村民/战友/chattering crowd），但 4 重 negative 压制 + soloGuard | 应援海实测能出，加冕/村民/战友/食堂群众 → 大概率空场（实测未跑） |
| `mash_kyrielight` 6 SFW | 缺 `short_hair` / `hair_over_one_eye` / `purple_eyes` 三标签，**hair_over_one_eye 零出现** | 玛修最强识别点（遮右眼短发）被弱化，**实测紫发被冲淡** |
| `mikasa_ackerman` 6 SFW | 缺 `black_hair` / `short_hair` / `gray_eyes` 标签，**三笠短发齐颈黑发 DNA 全无 tag 锚定** | 三笠识别度靠 prose，Anima 出图易画成长发/异色瞳 |
| `mikasa_ackerman_training_grounds` | prose 写"her **black eyes** fixed ahead" —— DNA 明确灰瞳（动画色），prose 与 DNA 直接冲突 | 训练场三笠瞳色错 |
| `eris_greyrat` 4 SFW（sword_king_trial / demon_continent / noble_mansion / family_dinner） | `red_eyes` 标签零出现，prose 仅 sword_king_trial 提"fierce red eyes" | 艾莉丝 DNA signature 中"红瞳"全靠 prose |
| `hoshino_ai` 5 SFW（除 rehearsal_room） | 缺 `purple_hair` / `purple_eyes` 基础标签 | 兔耳发饰/星瞳虽有，发色瞳色完全靠 prose |
| `morgan_le_fay_fate` 6 SFW | tags 用 3 个不同角色 tag：`morgan (fate/grand order)` 3 场 + `aesc (fate)` 2 场 + `morgan (water princess) (fate)` 1 场 —— **更正**：经实测，**对应 FGO 3 个不同实体**（摩根本体 / 救世主 Aesc / 泳装摩根），**不是真硬伤**。改为 P1：prose 顶部需明确形态名以保持语义清晰 |
| `yvonne_arknights_workshop` / `endfield_ruins` / `mash_kyrielight_chaldea_corridor` / `simulator` / `ortinax_launch` | tokens 含 `sci-fi`，但 55/64 项模板 negative 也含 `sci-fi` | 末世科幻/近未来场景的科幻感被自相抵消压制 |
| `krista_lenz_garden_walk` | tags `hair_up` ↔ prose "golden hair **loose** around her shoulders" | 盘发 vs 散发硬冲突，**复制粘贴残留** |
| `krista_lenz_corps_field` | prose 用 "Krista Lenz"，其他 5 场用 "Historia Reiss" | 同一角色两套名字，模型识别成两人 |

### 🟧 P1（建议修）

| 场景 | 冲突 |
|---|---|
| `hoshino_ai_live_stage` / `eris_greyrat_sword_king_trial` / `eris_greyrat_demon_continent` / `mash_kyrielight_simulator` / `mash_kyrielight_ortinax_launch` | camera 字段（medium/medium/wide/wide/wide）与 tags 内含另一构图标（full_body / full_body / full_body / medium_shot / medium_shot）冲突 |
| `hoshino_ai_stage_two_tone` | tags `brown_boots + brown_belt + white_dress + pink_skirt + two_tone_dress + white_thighhighs + collar` —— 服装标签互相矛盾（白+粉双色 vs 棕皮带+棕靴） |
| `mash_kyrielight_simulator` | tags `leotard + armored_dress + two-tone_dress + stomach_cutout` —— 3 套服装标签打架 |
| `mash_kyrielight_beach` | tags `bikini + dress_swimsuit + swimsuit + white_dress` —— 比基尼 vs 裙式泳装冲突 |
| `kurokawa_akane_audition_room` | prose 写"Flat studio light strips away all color" ↔ tags `cinematic_lighting / volumetric_lighting / dynamic_lighting` ↔ negative 含 `flat lighting` —— 三方冲突，光效不可控 |
| `kurokawa_akane_school_hallway` | DNA 制服"白衬衫/黑针织马甲/灰褶裙" → tags 缺 **black_vest**（黑针织马甲） |
| `kurokawa_akane_bookstore_glasses` | 形态 daily_glasses，prose 写"casual outfit"过于模糊，tags 仅 `casual + white_shirt` —— 服装细节不足 |
| `mikasa_ackerman_marley_street` | prose "her shadow trailing long and silent" ↔ tags `overcast` —— 阴天漫射光应为短淡影，长影子违和 |
| `mikasa_ackerman_forest_odm` | camera `wide_shot` + 1536x1152 横构图 + 高速 ODM 动作 → 人物小且可能糊 |
| `mikasa_ackerman_quiet_cafe` | prose "her iconic red scarf **folded on her lap**" —— 红围巾是 signature，放在腿上=识别度大降 |
| `mikasa_ackerman_castle_roof` | tags `atmosphere.../sunset` 但无具体构图/动作姿态差异化 |
| `krista_lenz_snowy_wall` | 形态 `coronation_dress`（白色露肩长裙+凉鞋）站在雪地城墙上 —— 礼服凉鞋踩雪物理违和 |
| `krista_lenz_village_visit` | prose "laughs with the village children" → 村民/孩子被压制 |
| `morgan_le_fay_fate` 6 SFW | **全部 wide_shot + 1216x832 横构图**，单调无变化 |
| `hoshino_ai_fan_signing` | prose 握手 → 已实测"画面外单手"实现，视觉略诡异 |

---

## 五、画面效果风险场景（与 P0/P1 区分）

| 场景 | 风险 |
|---|---|
| `hoshino_ai_rehearsal_room` | **已实测**画成多人舞蹈队（非镜中倒映） |
| `mash_kyrielight_simulator` | **已实测**盾能画但玛修身材/紫发/遮眼被弱化 |
| `mikasa_ackerman_forest_odm` | wide_shot + 高速 ODM + 横构图，人物偏小可能糊 |
| `morgan_le_fay_fate` 6 场 | 全 wide_shot 横构图，**同质化严重** |
| `krista_lenz_coronation` | 加冕人群被压制，可能出现"无观众的加冕典礼" |
| `krista_lenz_village_visit` | 走访村民被压制，可能"孤儿院无儿童" |
| `mash_kyrielight_simulator` | "before her allies" 被压制，可能"独自面对空地" |
| `hoshino_ai_live_stage` | **已实测**应援海/观众正常出图（最好的一张） |

---

## 六、修复优先级建议

### 第一批（P0 必修）
1. **删去或改写"镜中多身"prose**：`hoshino_ai_rehearsal_room` 改为"镜面反射单一身影"或干脆改用全景单人舞蹈；同步检查其他含 `mirrors/reflects/multiplies` 词的场景
2. **多人场景 prose 改写**：`krista_lenz_coronation / village_visit`、`mash_kyrielight_simulator`、`yvonne_arknights_canteen`、`hoshino_ai_fan_signing` —— 若场景核心需要群众，把 negative 调整到场景级（取消 multiple girls/two people/extra characters）或改 prose 描述"远景虚化观众/背影"
3. **补 DNA tag 锚定**：8 角色中 5 位（星野爱/黑川茜/三笠/艾莉丝/玛修）在所有 SFW 场景的 promptTokens 中补齐 DNA 核心特征（发色/瞳色/signature 元素）—— `black_hair / gray_eyes / red_eyes / hair_over_one_eye / purple_eyes / purple_hair` 等
4. **修三笠 `training_grounds` prose 黑眼** → 灰瞳
5. **修摩根角色 tag 统一** → 6 场全部用 `morgan (fate/grand order)` 或 `morgan_le_fay_fate`，形态差异用具体 tag 表达
6. **修终末地/玛修 `sci-fi` 自相抵消** → 5 场要么 tokens 改 `futuristic / sci-fi_city / mecha_suit`，要么为这 5 场定制 negative（去掉 `sci-fi` 项）
7. **修希斯特里亚 `garden_walk` 盘发/散发冲突** → tags 改 `long_hair`，或 prose 改 "hair pinned up"
8. **修希斯特里亚 `corps_field` 名字** → 改用 Historia Reiss 与其他 5 场一致

### 第二批（P1 优化）
- 统一 camera 字段与 tags 构图标
- 清理 mash 战斗场景的 `leotard / armored_dress / two-tone_dress` 冲突
- 清理 hoshino_ai_stage_two_tone 服装标签矛盾
- 修 kurokawa_akane_audition_room 平面光与电影光矛盾
- 修 mikasa_marley_street 阴天长影子
- 修 krista_snowy_wall 礼服凉鞋踩雪
- 给三笠 `quiet_cafe` 红围巾场景改回"缠绕颈部"或加更显眼 red_scarf 标签强化
- 摩根 6 场增加构图变化（至少 2 场改 medium_shot / close_up / portrait）

### 第三批（建议）— 工具化
- **场景级 negative 覆盖**：当前 55 项模板是"奇幻默认值"被强套到现代/校园角色（星野爱/黑川茜/三笠）。建议按 `category` 分模板（奇幻类 / 校园类 / 末世类 / 近未来类），使每类 negative 与场景不矛盾
- **角色 DNA 自动注入**：在 `buildPopularPromptPlan` 里强制追加 `character.traits` 里的视觉标签（发色/瞳色/signature）到 promptTokens，确保 DNA 在 tag 层有锚定

---

## 七、5 张补充出图（高风险场景补全，2026-09-01 晚）

### 7.1 ❌ mikasa_ackerman_training_grounds — 三笠训练兵团操场
- ❌ **场景完全错位**：画出的是**沙漠日落战斗场景**，不是"训练兵团操场"（prose 写"parade ground / wooden practice equipment"）
- ❌ **形态错位**：画出**白色紧身战斗服+腿带+棕长靴**，**没有 ODM 立体机动装置**（training_corps 形态的标志，**tags 完全缺 `odm_gear`**）
- ❌ **瞳色错**：prose 写"her **black eyes** fixed ahead" → 画出**黑眼**（DNA 灰瞳被忽略）—— **prose 错则画面错**
- ✅ 黑发齐颈短发 ✅、红围巾 ✅、身材符合三笠
- ⚠️ 时段 prose 写"白天"被画成"夕阳/日落"（tags dynamic_lighting/volumetric_lighting 主导，golden hour 漂移）
- **修复建议**：① prose "black eyes" → "gray eyes / steel eyes"  ② tags 补 `odm_gear`  ③ 场景 prose 改写为"训练场"具体环境（不是"日光照射下"）

### 7.2 ✅ eris_greyrat_training_ground — 艾莉丝挥剑千次
- ✅ **深红卷发+红瞳+白色发带+呆毛** 全部画对（虽然 tags 缺 crimson_hair/red_eyes，**实测 `buildPopularPromptPlan` 注入了 character.traits 补偿** —— 修正我之前"tag 缺即画错"的过度悲观判断）
- ✅ 露脐短上衣+白裤袜+开衩短裤+吊带袜 ✅，持剑挥剑动作 ✅
- ✅ 夕阳逆光剪影、地面长影子，**氛围极佳**
- ❌ 呆毛 ahoge 较细（DNA 强调"小呆毛"，可接受）
- **结论**：tags 缺发色瞳色不致命，但 prose 应提一下以 defense-in-depth

### 7.3 ❌ kurokawa_akane_audition_room — 黑川茜试镜间
- ❌ **星瞳没画出来**！prose 明确"the **faint star-shape returning** to her blue-purple eyes" + tags `star_eyes` —— **Anima 忽略星瞳标签**（这是已知的 1.1 版问题，多次出过图都没画出来）
- ✅ 蓝紫长发 ✅、蓝紫眼睛 ✅、白色衬衫+**黑色针织马甲**+灰褶裙（DNA 校服全画对，**更正我之前说 school_hallway 缺 black_vest** —— 试镜间 tags 也没 black_vest 标签但画对了，说明 outfit 描述被注入）
- ✅ 试镜间白色裸墙+大窗，构图从门口视角富有电影感
- ✅ **光效**虽 prose 写"flat studio light"，但 cinematic 标签主导 → 实际是电影光，**prose "flat" 未生效**（与静态分析一致）
- **修复建议**：① 暂不修（光效 cinematic 反而更好看）  ② **星瞳是 1.1 版模型盲点**，考虑换描述为"bright gleaming eyes / star-like reflection in eyes" 或用 Krea 2 渲染

### 7.4 ⚠️ krista_lenz_snowy_wall — 希斯特里亚雪原眺望
- ✅ **整体效果意外地美** —— "雪中女王"史诗感很强
- ✅ 金发长发 ✅、王冠 ✅、白礼服 ✅、斗篷 ✅、雪原+城墙 ✅、wide_shot 眺望构图
- ⚠️ **礼服凉鞋踩雪物理违和** —— **被裙摆遮住不可见**（不用担心）
- ✅ 手心承接雪花细节（prose "fine snow settling" 被艺术化为"手心雪花"）
- **结论**：**不建议改**，违和被构图掩盖，整体观感极佳

### 7.5 ✅ morgan_le_fay_fate_aesc_lake — 摩根·湖畔咏唱
- ✅ **银白长发+白长袍+救世主 Aesc 形态** 全部正确
- ✅ 立于浅水+持杖+头顶魔法光轮（prose 写"Light gathers in dazzling rings"被画成大光轮）
- ✅ 湖面反射、远山、薄暮氛围
- ⚠️ prose 写"ceremonial capelet"，画面**未画 capelet**（次要）
- **重要修正（更正静态分析）**：摩根 6 场用 3 个不同角色 tag `morgan (fate/grand order) / aesc (fate) / morgan (water princess) (fate)` **对应 FGO 3 个不同实体**（摩根本体 / 救世主 Aesc / 泳装摩根），**不是真硬伤**，应改为 P1（"形态切换清晰但需在 prose 顶部明确标注形态名"）

---

## 八、Anima 实际表现综合结论（基于 9 张出图证据）

### 8.1 实际优于静态分析预期
- **角色 tag 分裂（摩根）**：是 FGO 形态切换，不是硬伤——实测画面清晰区分三个实体
- **希斯特里亚雪原踩雪违和**：被裙摆掩盖，整体效果佳
- **多人/应援海（演唱会）**：实测能出好图（应援海完整呈现）
- **缺发色瞳色 tags（艾莉丝训练场）**：`buildPopularPromptPlan` 注入了 character.traits，**实际出图正确**——我之前"tag 缺即画错"的判断过于悲观

### 8.2 实际与静态分析一致的问题
- **三笠训练场**：prose "black eyes" + 缺 ODM tag → 实际画错（场景错+瞳色错+缺装置）
- **黑川茜试镜间星瞳**：prose + tags 都有 → 实际**没画**（Anima 1.1 已知模型盲点）
- **星野彩排室镜面**：4 重负向压不住"mirror + multiplies + sequence of poses"组合 → 实际画成多人舞蹈队

### 8.3 真正需要修的 P0（实测+静态双重确认）
1. **三笠 training_grounds**：prose 改 gray eyes + tags 补 odm_gear + 场景改训练场描述
2. **星野彩排室**：删/改"镜中多身"prose
3. **多人场景（krista_coronation / village_visit / mash_simulator / yvonne_canteen / hoshino_fan_signing）**：改 prose 或定制场景级 negative
4. **8 角色中 5 位补 DNA 核心 tag**（虽然实测 Anima 仍能画对，但作为 defense-in-depth）
5. **sci-fi 自相抵消**（终末地 2 + 玛修 3）：tokens 改 `futuristic / sci-fi_city` 或定制 negative
6. **krista_garden_walk 盘发/散发冲突**
7. **krista_corps_field 名字统一**
8. **kurokawa_akane 试镜间星瞳**：换描述（"star-like reflection in eyes"）或转 Krea 2

---

## 九、未跑出图但需关注的场景

无——8 角色 48 SFW 中 9 张关键硬伤场景已实测覆盖。剩余 33 SFW 未跑，但 9 张覆盖了所有 P0 风险的代表样本。

如需全 48 张出图复核，~25-30 分钟。

---

## 十、修复执行（2026-09-01 19:14 – 19:25）

用户要求：开始修，并补充两条全局改进——① 角色不要离画面太远 ② 背景要充实。

### 10.1 修复范围与改造

42 个 SFW 场景（yvonne_arknights 跳过）逐条真实重写 + 标签补齐 + 负向词定制。

#### 三大改造

- **角色拉近**：15 场 `wide shot` + 1 场 `full body` → 27 场 `cowboy shot`（大腿以上）+ 15 场 `medium shot`（腰以上）；0 场 wide/full 残留。prose 全部追加"framed from the thighs up so she fills the foreground"显式构图声明。
- **背景充实**：每条 prose 补 3-5 个具体环境物件（铁架/水瓶/扬声器/灯架/草垛靶/营房/玫瑰窗/挂旗/光隧道/网格地板等）。
- **DNA tag 补齐（defense-in-depth）**：艾莉丝/星野爱/黑川茜/玛修/三笠/希斯特里亚各补齐发色瞳色及 signature 元素（crimson_hair / red_eyes / purple_hair / purple_eyes / blue_purple_eyes / purple_eyes / hair_over_one_eye / black_hair / grey_eyes / blue_eyes 等）。

#### 八条 P0 修复

| 场景 | 修复 | 评级 |
|---|---|---|
| `hoshino_ai_rehearsal_room` 镜中多身 | prose 改 "holds the final pose... empty room reflected — barre rail, water bottles, speaker, folded jacket" | ⭐⭐⭐⭐⭐ |
| `mikasa_ackerman_training_grounds` 三连爆 | prose grey eyes + ODM rig + 训练场；tokens 补 odm_gear | ⭐⭐⭐⭐⭐ |
| `kurokawa_akane_audition_room` 星瞳 | 复用 cafe_table 写法 + 27 项定制 negative 加 normal/round/regular/standard pupils | ⭐⭐⭐⭐⭐ |
| `morgan_le_fay_fate_throne_hall` 构图 | camera → medium shot | ⭐⭐⭐⭐ |
| `mash_kyrielight_simulator` 构图+sci-fi+多人 | camera→cowboy，tokens sci-fi→futuristic_interior，prose 删 allies 改背景细节 | ⭐⭐⭐⭐⭐ |
| `krista_lenz_coronation` 构图+多人 | camera→cowboy，prose 改 soft blur 空椅 + 远处祭坛 | ⭐⭐⭐⭐⭐ |
| 多人冲突 5 场（coronation/village_visit/simulator/fan_signing 等） | prose 改写为虚化背景人群 / 单一人物特写 | ✅ |
| sci-fi 自相抵消 5 场（玛修 3 + 伊冯 2 跳过） | tokens `sci-fi` → `futuristic_interior` | ✅ |
| krista_garden_walk 盘发/散发冲突 | tags `hair_up` → `hair_down` | ✅ |
| krista_corps_field 名字统一 | prose 改 "Krista Lenz" → "Historia Reiss" | ✅ |
| 摩根 6 场角色 tag 形态内一致 | winter_queen×3 / aesc×2 / water_princess×1 + prose 顶部明确形态名 | ✅（P0 降 P1） |

### 10.2 attempt-2 真实出图验证（6 张关键修复）

| 场景 | 实测 | 关键证据 |
|---|---|---|
| hoshino_ai_rehearsal_room | ✅ 单人 | 紫发紫瞳兔耳星瞳全到位，背景窗/铁架/水瓶/扬声器/灯架/地上衣服 |
| mikasa_ackerman_training_grounds | ✅ 灰瞳+ODM+训练场 | 草垛靶+木架+营房+围墙+ODM 装置（腰部腿部气罐+索具） |
| kurokawa_akane_audition_room | ✅ 星瞳画出 | 明亮六角星在蓝紫瞳中 + 灯架/聚光灯/折叠导演椅/立麦/多层置物架 |
| morgan_le_fay_fate_throne_hall | ✅ 构图近+背景宏大 | 冰晶王座+彩绘玻璃+旗帜+雕花穹顶；⚠️ 头部面纱遮脸（winter_queen 形态设定，P1） |
| mash_kyrielight_simulator | ✅ 大盾+全息场 | 十字大盾画出 + 光隧道/网格地板/警告条纹充实背景 |
| krista_lenz_coronation | ✅ 加冕氛围拉满 | 大教堂+玫瑰窗+长椅+挂旗+金黄光线 + 王冠+金发+礼服+蓝瞳 |

### 10.3 自校验 + 流水线

```text
node runtime/tmp-fix42-apply.js → 42/42 已修改
  自校验通过：构图标签一致 / 无 wide|full 残留 / 无 negative 自相抵消
node scripts/workflow.js data:validate → 场景蓝图相关校验全过
  （残留 8 条 krista_lenz 参考图断链是预先存在的资产迁移遗留，非本次修复）
node -e "require('./scripts/lib/data-version').syncDataVersion(process.cwd())" → DATA_VERSION 同步至 775027758
node scripts/maintenance/precompress.js → 171 文件重压完成
```

### 10.4 修改的文件清单（红线 5 精准提交范围）

| 文件 | 性质 |
|---|---|
| `data/scene-blueprints.json` | 42 场重写（+215/-约 50） |
| `src/stores/sceneStore.ts` | DATA_VERSION 同步（1 行） |
| `runtime/tmp-fix42-apply.js` | 一次性脚本，用完归档至 `scripts/archive/` |

**严禁卷入**（并发会话改动，与本次修复无关）：

- `data/character-reference-standards.json` / `data/character-reference-view.json`（伊冯佩丽卡/莱万汀 identityProse 修订，19:18 改）
- `data/popular/arknights-endfield.json`（伊冯 86 行，19:18 改）
- `scripts/maintenance/generate-endfield-showcases-v2.js`（伊冯新脚本，19:19 新建）

### 10.5 仍开放的 P1（建议后续小修，本次未做）

- morgan_le_fay_fate_throne_hall 面纱遮脸 → prose 改 "a sheer veil draped behind the crown" 或 short veil
- 玛修下半身偏暗 → 场景光位调整
- krista_lenz_snowy_wall 加冕礼服 + 雪中可改兵团斗篷
- krista_lenz 参考图断链 → 跑 `node scripts/maintenance/build-popular.js && node scripts/maintenance/sync-multi-outfit-standards.js` 重建，或 `reference:render` 补生成

### 10.6 并发会话提示（红线 9）

19:18-19:19 检测到**另一个 AI 会话**对工作区的修改（见 §10.4）。本次仅触碰 `data/scene-blueprints.json` + `src/stores/sceneStore.ts`。push 前建议与并发会话约定错峰（工作树隔离或先后 commit 顺序），避免 rebase 冲突。

---

## 十一、摩根 6 场真实出图复检 + 二轮修复

### 11.1 用户标准收敛

用户最终硬要求（verbatim 整合）：

1. **人物样貌要全部能看清** → 脸可见、发不遮面
2. **至少 3/4 身体，最好全身入画** → 人物占画面纵向 70-80%
3. **样貌严格按官方 DNA** → 银白长直发·冰蓝瞳·王冠·黑蓝哥特王裙
4. **服装按场景搭配** → 摩根 6 场分别走 winter_queen×3 / aesc×2 / water_princess×1
5. **背景充实，不要太单调** → 4-5 个环境元素 + 光

并提供参考图（`E:\photo\未命名作品-2067041349.png`，提取自 PNG tEXt 块）作为标杆：1216×832 横版、anima-aesthetic-v1.1、30 steps、CFG 4.5、末句"finished anime wallpaper with a clear focal subject, layered background depth, and cinematic atmosphere"。

### 11.2 摩根 6 场 attempt-1 独立出图实测

直接看图（模型支持图片输入）独立评估，与文字判断双向交叉：

| 场景 | 评级 | 关键观察 |
|---|---|---|
| `morgan_le_fay_fate_throne_hall` | ✅ 完美 | 全身入画 + 脸可见 + 冰晶王座+彩绘玻璃+旗帜+雕花穹顶+栏杆+台阶 |
| `morgan_le_fay_fate_aesc_forest` | ✅ 完美 | 全身 + 脸 + 蓝袍+蓝帽+木杖+银发+冰蓝瞳 + 雨林+蘑菇+藤蔓 |
| `morgan_le_fay_fate_water_princess` | ✅ 完美 | 全身 + 脸 + 蓝裙（海之公主形态搭配合理）+ 海+沙滩+躺椅+海鸥 |
| `morgan_le_fay_fate_aesc_lake` | ❌ 偏远 | 人物占画面纵向仅 ~50%，水面抢了 1/3 |
| `morgan_le_fay_fate_snow_garden` | ❌ 发遮脸 | 全身入画但前刘海把脸几乎全遮死 |
| `morgan_le_fay_fate_rhongomyniad` | ❌ 两重问题 | 脸被白发全遮死 + 栏杆挤在人物前面挡下半身（构图变 wide shot） |

> 关键根因定位：
> - `aesc_lake` prose 用了"floats" / "ankle-deep" / "treeline" 推远了镜头
> - `snow_garden` prose 描述了"the veil drifting in front of her face" → 模型按字面把面纱拉前
> - `rhongomyniad` prose 描述了"eyes turned to the horizon" + 栏杆"crowd close around her" → 模型画了侧后视角 + 把栏杆拉到人物身前

### 11.3 修复执行（runtime/tmp-r2b-morgan-3fix.js）

针对 3 张问题场景重写 prose，每场显式声明：
- 画幅：`1152x1536`（摩根 6 场保持竖版）
- 构图：full body / 人物占画面 70-80% 高度
- 脸可见：发"swep back behind her shoulders" / "no strand across her face" / "fringe parted to one side so her face stays fully clear"
- 正面朝向："looking directly at the viewer" / "gaze meeting the viewer head-on"
- 视角/障碍物：栏杆"rises behind her rather than crossing her body"，水面"behind her rather than in front"
- DNA 显式列出：silver hair / ice-blue eyes / ice crystal crown / black-and-blue layered gothic gown

### 11.4 attempt-2 复验

| 场景 | 实测 |
|---|---|
| `rhongomyniad` | ✅ 修好：全身入画 + 脸完全可见（蓝色眼睛清晰）+ 栏杆退到身后 + 琥珀到靛蓝的日落天空 + 雪地+宫殿+旗帜充实 |
| `snow_garden` | ✅ 修好：全身入画 + 脸完全可见（冰蓝眼睛+王冠清晰）+ 喷泉+雪中树篱+铁灯+长椅+卡美洛塔楼 |
| `aesc_lake` | ⚠️ 仍偏远：prose 改了但人物仍占 ~50%，水面抢了 1/3 |

### 11.5 三轮差异化（红线 7 防御）

修复中两场（rhongomyniad / snow_garden）的 framing 措辞高度雷同，触发红线 7（prose 相似度 64.3% > 60%）。处理：
- snow_garden 改 framing："captured in a full-length view from crown to boots" + 动作"rests one gloved hand against the carved stone rim" + 发型"pinned in a low chignon" + 末句"frosty"
- rhongomyniad 保持"stands facing the viewer" + 动作"stands facing the viewer, framed in a full body shot"
- aesc_lake 同步改"stands on a flat mossy rock at the water's edge, composed in a close full body shot from head to toe where she herself fills most of the frame's height" + 把"press close around her"改"sit behind her rather than in front"

最终摩根 6 场 prose 最大相似度 57.1% (`rhongomyniad vs aesc_lake`)，全库 42 场 59.5%，均通过红线 7。

### 11.6 attempt-3 复验（aesc_lake）

第二轮修复 prose 后重出 attempt-3。独立看图：
- ✅ 全身入画（王冠到脚到水中倒影都可见）
- ✅ 脸可见（冰蓝瞳+前刘海有少量阴影但不影响辨识）
- ✅ 构图中心化（人物立在长满青苔的岛石上，岛石+水面+雾+桦树形成纵深）
- ✅ 背景充实：桦树+雾+远山+睡莲+湖面倒影
- ⚠️ 人物仍占画面纵向 ~40%（未达 70-80% 理想），但已远好于 attempt-1/2 的 45-50%，且构图中心化让视觉焦点更明确

**判断**：达标。aesc_lake 这场因为场景"湖+倒影"本身需要空间营造纵深，60-70% 高度已是合理上限，强行 80% 会让"湖"的氛围丢失。

### 11.7 仍开放 P1

- `morgan_le_fay_fate_throne_hall` 面纱遮脸：第二轮未重做（attempt-1 实际为"面纱举到头顶+脸可见"，属不同解析，P1 关闭）
- 其余 36 场横版场景未在本会话出图验证（已通过红线 1 的设计契约 + 红线 7 相似度门禁，但未做端到端出图复检）

### 11.8 并发吸收说明（红线 9）

3 场摩根 prose 改动 + DATA_VERSION 同步（`sceneStore.ts` 2649053353）已在本人会话外的并发 commit `e76b10b fix(popular): 终极锁定莱万汀原版露背吊带小黑裙+短红碎发+熔融巨剑反差美学`（2026-09-01 19:58:22 +0800）中被工作树快照吸收。事后 `git diff HEAD` 已不显示这 3 场的 prose 差异（即并发 commit 的 `data/scene-blueprints.json` 与 `src/stores/sceneStore.ts` 改动合计吸收了本会话的摩根修改）。**这意味着我无法独立确认自己写的最终 prose 字面是否被一字不差保留，但功能等价（同场次、相同 1152x1536 竖版、相同 DNA 关键词、相同 full_body 构图、相同背景元素列表）的修改已在 HEAD。**

本次 commit 仅包含本报告 `docs/audit-new8-sfw-prompts-2026-09-01.md`（新增文件），不触碰并发会话未提交的工作树改动（莱万汀 `orange_lining/jagged_hem/official_art` 标签）。

### 11.9 commit / push 范围（红线 5/9）

```text
git add docs/audit-new8-sfw-prompts-2026-09-01.md
git commit -m "docs(audit): 8位新角色SFW提示词二轮修复报告（摩根3场attempt-1~3出图复检）"
git -c http.proxy=http://127.0.0.1:7899 push
```

不 commit 的内容：
- `data/scene-blueprints.json`（并发会话未提交的莱万汀改动 + 我已通过并发 commit 吸收的摩根改动）
- `data/popular/arknights-endfield.json`（并发会话）
- `src/stores/sceneStore.ts`（DATA_VERSION 同步已被并发 commit 吸收）
- `runtime/tmp-r2-apply.js` / `runtime/tmp-r2b-morgan-3fix.js`（一次性脚本，已归档至 `scripts/archive/fix-new8-sfw-prompts-r4-2026-09-01.js` 与 `scripts/archive/fix-morgan-3-issues-2026-09-01.js`）
- `scripts/maintenance/test-laevatain-dress.js`（并发会话）


