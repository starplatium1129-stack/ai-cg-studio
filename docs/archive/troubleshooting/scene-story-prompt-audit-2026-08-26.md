# 场景「故事 vs 提示词」一致性审计报告（2026-08-26）

> 审计范围：`data/scenes/` 分片 303 条场景（宁宁 152 + 夏目 145 + 双人 6）+ `data/scene-blueprints.json` 441 条场景蓝图。
> 方法：17 个子代理分 17 批并行审阅，逐条比对「故事文本（story/description）」与「提示词（prompt / animaCaption / promptProse / promptTokens / tags / timeOfDay / negative）」。
> 判定口径：仅报「故事有明确描写而提示词与之矛盾，或故事关键要素在提示词中缺失且被无关/相反内容替代」。
> 明细证据：`.audit-work/findings-scenes-01~09.md`、`.audit-work/findings-bp-01~08.md`（每条含故事/提示词原文引用）。

---

## 一、总览

| 数据集 | 总数 | 发现问题条目 | 占比 | HIGH 行 | MEDIUM 行 | LOW 行 |
|---|---|---|---|---|---|---|
| 场景库（scenes-01~09） | 303 | 217 | 71.6% | 102 | 98 | 42 |
| 场景蓝图（bp-01~08） | 441 | 323~327 | 73~74% | 159 | 157 | 56 |
| **合计** | **744** | **540+** | **≈73%** | **≈261** | **≈255** | **≈98** |

### 分批明细（条目最高严重度口径）

| 批次 | 内容 | 发现问题 | HIGH | MEDIUM | LOW | 无问题 |
|---|---|---|---|---|---|---|
| scenes-01 | 宁宁本篇① | 22/38 | 3 | 17 | 6 | 16 |
| scenes-02 | 宁宁本篇② | 27/38 | 13 | 18 | 9 | 11 |
| scenes-03 | 宁宁 After Story① | 32/38 | 11 | 19 | 2 | 6 |
| scenes-04 | 宁宁 After Story② | 31/38 | 12 | 12 | 7 | 7 |
| scenes-05 | 夏目本篇① | 12/36 | 6 | 7 | 2 | 24 |
| scenes-06 | 夏目 After Story① | 30/36 | 18 | 8 | 6 | 6 |
| scenes-07 | 夏目 After Story② | 29/36 | 15 | 7 | 7 | 7 |
| scenes-08 | 夏目 After Story③ | 28/37 | 18 | 8 | 2 | 9 |
| scenes-09 | 双人（宁宁×夏目） | 6/6 | 6 | 2 | 1 | 0 |
| bp-01 | 雷电将军/麻衣/狂三/芙莉莲/呆毛/初音 | 40/55 | 20 | 14 | 6 | 15 |
| bp-02 | 初音/夜鸦/雪之下/艾拉/御坂/玛奇玛 | 47/55 | 28 | 14 | 9 | 8 |
| bp-03 | 玛奇玛/凛/蕾姆/艾米莉娅/洛琪希/伊莉雅 | 39/55 | 20 | 33 | 3 | 16 |
| bp-04 | 伊莉雅/海梦/木更/史尔特尔/凯尔希/陈/艾雅法拉 | 39/55 | 15 | 27 | 8 | 16 |
| bp-05 | 艾雅法拉/蕾缪安/夕/泥岩/森蚺/澄闪 | 38/55 | 26 | 10 | 2 | 17 |
| bp-06 | 澄闪/斯卡蒂/羽毛笔/能天使/铃兰/佩丽卡/莱万汀 | 47/55 | 24 | 23 | 13 | 8 |
| bp-07 | 莱万汀/艾拉(燐)/由比滨/樱/约尔/蕾塞等 | 38/55 | 15 | 17 | 6 | 17 |
| bp-08 | 芙莉莲/白夜/塞西莉亚/由比滨/樱/约尔/蕾塞/陈 | 35~39/56 | 11 | 19 | 9 | 21 |

健康度差异明显：**宁宁/夏目「本篇」批次（scenes-01/05）质量相对较好，After Story 批次与全部蓝图批次呈系统性劣化**；双人 6 条全部中招。

---

## 二、系统性根因（按影响面排序）

### 1. PromptProse 模板污染 —— 最大单一病灶（蓝图 8 批全部命中）
Krea 英文散文提示词被**套话模板库**批量装配，吞掉故事关键要素：
- `stands with serene composure, presence calm and centered` —— 覆盖坐/蹲/跪/趴/躺/跑/飞/倚，全被拍平成站立（bp-02/04/05/06/07/08 共 40+ 条）
- `leans against the railing, wind lifting her hair` —— 串入厨房/衣柜/驾驶舱/浴室/教室等错误场景
- `sits on a park bench` / `browses the shelves, fingers trailing over spines` / `reclines on soft bedding, gaze calm and intimate` / `rests at the bath edge, steam curling around her` —— 批量替换真实动作
- `knit sweater and skirt + loafers on wooden floor`、`cargo pants + combat boots`、`bare legs + delicate toes` 等装束/地物套话跨角色串场（雷姆/陈/铃兰/菲伦/斯菲等）
- `during a rain` 插入烟花夜景/黄昏阳台（reze_ferris_wheel_fireworks、reze_apartment_balcony_sunset），且 negative 排除 rain，自相矛盾
- tokens 层被残留 `beach/sunglasses/ice_cream/water_gun` 等异场景词污染（北境雪地温泉混入海滩词等）

### 2. R18 服装固化 —— 故事裸/半解，提示词穿回完整服装（蓝图 ~60 条 + After Story 场景大量）
- 典型：修女袍褪尽全裸仰卧祭坛 → 「穿着修女袍跪着」；赤身冰浴 → 战术外套+靴；全裸泡汤 → 泳装+罩衫；光着身子 → 全套演出服/球鞋便装；晨光寝宫光身 → 礼服+高跟鞋
- **自相矛盾证据**：① 多条 negative 含 `clothes/dress/panties` 等「去衣」词却与 prose 衣着冲突；② tokens/sceneTags 已带 `discarded_*` 意图标签而 prose 未兑现（bp-02 明确指出「prose 编译层未跟随」）
- **2026-08-26 用户策略确认：项目为纯个人使用，R18 提示词放开手脚按故事原文书写，仅保留 UI 层 R18 模糊遮罩（adultEligibility/adultEnabled 双重把关）供确认标签**——故本条不存在「预期安全化豁免」空间，故事裸/半解而提示词着装全部按真实 bug 处理，依故事原文重写；negative 去衣词与 prose 自相矛盾、`discarded_*` 意图标签未兑现属编译缺陷一并修复

### 3. 双人互动被单人化（场景库 + 蓝图）
- 故事明确同框互动（同伞牵手、初吻、裹毯依偎、膝枕、跨坐入怀）→ prompt 统一 `1girl, solo`，部分 negative 直接禁 `2girls/extra characters`
- 最严重的双人 6 条全中招：sc151/sc154（两场双人同床戏被单人化 + 时段/姿势/服装三重冲突）、sc144（吧台魔法场景被旧卡座模板整体错位）
- 蓝图侧多为「你/前辈/博士」陪衬型互动，未强求同框，仅剧情核心处计 LOW（口径已在 bp-04 备注）

### 4. 时段/天气颠倒（~30 条）
- 夕阳/黄昏 → `afternoon`/`morning`/`daylight`：sc001（开篇第一张）、sc003、sc264、tohsaka_rin_rooftop、surtr 宿舍窗边等
- 深夜 → `bright daylight`/`sunset`：sc127 露天泳池深夜月光→bright daylight、sc237、sc250 冬夜→午后窗光
- 清晨 → afternoon/night：sc274 枕边醒来、sc158 午后→night、sakura_emiya_kitchen 清晨写 evening
- 同一记录 tags 内部自相矛盾（sc037 morning/afternoon 并存、sc015/sc068 prompt 混入 sunset+afternoon）

### 5. 姿势颠倒（站⇄坐/躺/跪/趴，背对⇄面朝，低头⇄对视）
- sc097 沙滩站直被画成坐瞭望塔；sc079 木梯站着翻找→坐着；sc042 背对你躺→面朝观众；sc011 低头看笔记→looking_at_viewer；sc182 趴床中央→standing；sc301 仰躺分腿→侧卧
- 帧级关键动作反转（壁咚→坐姿扶桌、跨坐→抱枕安坐、扑倒咬锁骨→静坐持杯）大量存在于 After Story 批

### 6. 道具替换/缺失（~30 条）
- 故事道具被换成无关物：蛋糕→礼物盒、御守→绘马、热饮→冷饮、三明治→饭团、手枪→魔杖、膝枕→撸猫、甜筒取代圣代/芭菲（×2）
- 标题级要素完全缺失：流星（sc023）、烟花（sc084）、天使翅膀+光环（sc224）、初吻（sc049）、伞（sc072/sc038/sc240）、法杖（frieren 旷野）、麦芽糖/比心/发箍（海梦游乐园）

### 7. 服装颜色/层级颠倒（~15 条）
- 颜色：黑↔白兔女郎（sc186）、黑↔白比基尼（sc196/sc127）、深蓝→白（sc255）、薄荷绿→粉（sc211）、米色格裙→粉裙（sc252）、暗红旗袍→black（sc136/sc204）
- 层级降级：振袖→浴衣、啦啦队→体操服、天使装→白裙、加绒毛衣→普通毛衣（scenes-02 明确「服装层级系统性降级」）

### 8. 蓝图内部 prose 与 tokens 自相矛盾（I 维度，~20 条）
同一蓝图内两套提示词打架：prose 写站立而 tokens 写 crouching/straddling；prose 无伞而 tokens 有 umbrella；prose 甜筒而 tokens sundae；prose 着装完整而 tokens 含 discarded_*。**tokens 往往是对的，prose 是错的** → 缺陷集中在 prose 编译层。

### 9. animaCaption / tags 错位文案（scenes-03 等）
- animaCaption 与 story/prompt 三方矛盾：sc113（发带场景写「泡澡月光」）、sc119（酒吧写「床上月光」）、sc125（巫女服写「鸟居月光」）、sc158（错位到厨房餐桌）、sc128（会所包厢写「卧室+月光」）

### 10. 角色设定级无视
- 蕾缪安轮椅 3 条（街角/悬崖/花园）全部渲染成站姿；特工连体衣（sc106/sc110/sc118）被逐字复用同一战术服模板；sc179/sc193 故事写「银色长发」与角色黑发冲突（疑似故事侧笔误）
- 数据分级：陈 3 条蓝图 `adult=null`（bp-08 备注），建议确认分级字段完整性

---

## 三、重点整改清单（建议优先级）

### P0 —— 双人场景（6/6 全中，剧情定位直接矛盾）
sc144、sc151、sc154、sc157、sc031、sc028：恢复双人同框（2girls）、对齐时段/姿势/服装，重写 prompt。

### P1 —— 蓝图生成管线（根因，一次性修复惠及 ~300 条）
1. 清洗 promptProse 模板库：删除/替换 `stands with serene composure`、`leans against the railing`、`sits on a park bench`、`browses the shelves`、`rests at the bath edge`、`knit sweater and skirt + loafers on wooden floor`、`cargo pants + combat boots` 等跨场景套话；
2. prose 编译器必须**以 story 动作为源、以 tokens/sceneTags 意图为校验**：`discarded_*`/`straddling`/`night`/`snow` 等意图标签在 prose 中必须兑现，否则拒绝出包；
3. 单记录自校验门禁（字段联动）：timeOfDay vs prose 时段词、weather vs 季节词、tags vs prompt 互查，prompt 与 animaCaption 必须一致；
4. 陈 `adult=null` 补全。

### P2 —— R18 提示词放开书写（2026-08-26 用户策略确认）
用户确认本项目为**纯个人使用**：R18 内容提示词放开手脚按故事原文书写，不做任何着装/内容降级；仅保留 UI 层 R18 模糊遮罩（`adultEligibility`/`adultEnabled` 双重把关 + 模糊遮罩）用于确认标签，遮罩与提示词内容解耦。因此 R18 服装固化类发现（蓝图 ~60 条 + After Story 场景大量）**全部纳入修复**：故事写裸/半解/浴巾/湿衬衫，提示词就写对应的裸/半解/浴巾/湿衬衫状态；negative 去衣词与 prose 衣着自相矛盾、`discarded_*` 意图标签未兑现一并修复。

### P3 —— 逐条修复（以 findings 文件为工作台账）
- `.audit-work/findings-scenes-01~09.md`（场景 217 条）、`.audit-work/findings-bp-01~08.md`（蓝图 320+ 条）
- 修复后按 AGENTS.md 红线 #7 跑 `node scripts/tests/test-prompt-rewrite-integrity.js --delivery <重写文件>` 复检（覆盖率=声明数、无模板签名、prose 相似度≤60%、角色归属一致）。

---

## 四、结论

744 条场景/蓝图中 **约 73%（540+ 条）存在故事与提示词不一致**，其中 HIGH（直接矛盾，画出来即错误）约 261 处。绝大部分不是单条笔误，而是 **4 个系统性病灶**：prose 模板污染、R18 服装固化、双人单人化、时段/姿势/道具字段未联动。修复应优先落在生成管线（P1），而非逐条手改；After Story 与全部蓝图批次视为高危区，宁宁/夏目本篇相对健康。

*审计工作文件位于 `.audit-work/`（切片 + 17 份 findings 明细），核对后可整体删除。*