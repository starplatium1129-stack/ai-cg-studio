# 场景故事↔提示词对齐 · 58 条逐条分类（2026-09-06）

> 基于 `test-scene-story-alignment.js` 输出的 58 条潜在不一致，逐条人工比对故事命中上下文与 prompt 全文后的分类。
>
> **处置结果（2026-09-06 第二轮，用户裁定：以 prompt 为准改故事，样张零影响）：**
> 经用户确认 sc154 为真损坏已修（见 git 97dcdeea）；「改服装」类为用户要求的服装多样化，故事按新服装改写。
> 55 条非定稿项全部收口，门禁通过：
>
> | 处置 | 条目 | 方式 |
> |---|---|---|
> | prompt 修复 | sc154 | 按本条 tags/animaCaption 重建（已另行提交，见 97dcdeea） |
> | 检查器词表扩展 | sc055/084/087/177/202/253/258/296/298/108/171（11 条） | leaning_against、turning_around、boyfriend_shirt、oversized、babydoll、bodysuit、hakama、on_couch/on_sofa、candlelight、neon 均为 prompt 实际存在的同义表达 |
> | 故事按 prompt 改写 | 42 条 | 逐条手写：服装类按用户新服装改写叙事；跨坐→跪伏/坐（prompt 实际姿态）；删除室内场景不渲染的深夜/暴雨氛围 claim；台词微调（sc006/075）；破碎 tag 场景（sc131/139/149/172/250/288/290 等）按实际画面收敛描述 |
> | 豁免清单 | sc095（浴巾） | 故事前提即「浴巾滑落」瞬间，prompt 渲染其后浴袍状态，改故事会破坏叙事前提 |
> | 保留定稿警告 | sc141/sc163 | 受 pin 字节保护，需出图自测 + pin-capture 流程 |
>
> 注：故事为纯展示文本，改写不影响任何已交付样张；`storyJa`（日语译文）未同步更新，需后续统一重译。
> 以下为改写前的原始分类底稿，供追溯。

## 分类汇总（原始底稿）

| 类 | 含义 | 处理通道 | 条数 |
|---|---|---|---:|
| A | 词表误报：prompt 已用同义表达，检查器 promptRe 不认识 | 扩检查器词表（纯测试代码，数据零改动） | 9 |
| B | 台词/POV 修辞：故事关键词是台词或指观者，画面无需 | 进豁免清单 fixtures/scene-story-exemptions.json | 2 |
| C | 室内深夜/雨声氛围：室内场景中"深夜/暴雨"不必然上画面 | 逐条豁免（或轻补氛围词） | 8 |
| D | 真缺：prompt 缺故事承诺的核心元素 | 逐条核对样张 → 有样张走豁免 / 无样张补词+出图验证 | 37 |
| E | 定稿保护：受 pin 字节保护，改需出图自测 + pin-capture | pin 流程 | 2 |

## A · 词表误报（9 条）—— 建议扩检查器 promptRe

| id | 缺失 | prompt 现有同义表达 | 词表应补 |
|---|---|---|---|
| sc055 | 站立 | leaning_against_train_door | `leaning_against` |
| sc084 | 站立 | turning_around（转身即站姿） | `turning_around` |
| sc087 | 睡裙睡衣 | oversized_shirt + boyfriend_shirt | `boyfriend_shirt`/`oversized_shirt` |
| sc177 | 制服 | bodysuit + skin-tight_latex（战斗服） | `bodysuit` |
| sc202 | 制服 | bodysuit + pencil_skirt | `bodysuit` |
| sc253 | 睡裙睡衣 | sheer_babydoll（娃娃睡裙即睡衣族） | `babydoll` |
| sc258 | 浴衣和服 | hakama（袴）+ 箭羽纹 | `hakama` |
| sc296 | 坐姿 | leaning_forehead_..._on_couch | `on_couch`/`on_sofa` |
| sc298 | 睡裙睡衣 | oversized white loose shirt（T恤当睡衣） | `oversized`/`boyfriend_shirt` |

## B · 台词/POV 修辞（2 条）—— 建议进豁免清单

| id | 缺失 | 依据 |
|---|---|---|
| sc006 | 站立 | 台词「你也能平安**站**在我面前」是祝愿语；画面是递礼物 |
| sc075 | 站立 | 台词「你**站**在这里也不算碍事」指观者；画面 sitting_by_pool_edge |

## C · 室内深夜/雨声氛围（8 条）—— 建议逐条豁免

室内场景中"深夜/暴雨"是叙事时间，画面可由灯光氛围承担，不必强制 night/rain tag：

sc061（浴室门口·冬夜）、sc108（深夜客厅）、sc112（阅览室·窗外暴雨）、sc147（暴雨深夜·prompt 已有 rain）、
sc171（暴雨夜·车内）、sc185（温泉·窗外星空，可轻补 night 可豁免）、sc189（深夜审讯室）、sc214（断电冷藏库深夜）

## D · 真缺（37 条）—— 逐条核对样张后再动

### D1 · 重缺：prompt 与故事承诺的画面明显不符（16 条）

| id | 缺失 | 情况 |
|---|---|---|
| sc059 | 晨光 | 整条偏离：故事是"秋日清晨白衬衫临时睡衣"，prompt 是 bunny_suit/latex 酒吧兔女郎 |
| sc115 | 坐姿/跨坐 | 服装+姿势双矛盾：故事"真空白衬衫跨坐"，prompt 是 black_lace_lingerie + crotchless 且无跨坐 |
| sc154 | 坐姿/跨坐 | 对象错位：故事"跨坐在**你**身上"（POV 单人），prompt 是 2girls 双人；且 tag 大面积破碎、lora tag 被撕裂 |
| sc059/138 | 站立/浴巾 | sc138 镜前审视 vs prompt 的 onsen+hug 场景错位 |
| sc045 | 浴巾 | 故事"用浴巾裹住自己"，prompt 无 towel 反而 bare 系 |
| sc066 | 泳装 | 泳装背影 vs prompt 无 bikini/swimsuit |
| sc078 | 和服/晨光/雪 | 鸟居雪景和服：三者全缺 |
| sc131 | 真空/睡裙/夜/雨 | 真丝睡裙雷雨夜：prompt 是破碎 tag 串（wearing, extremely, thin…） |
| sc139 | 真空 | 连衣长裙真空：prompt 破碎（wearing, extremely, thin…）且无 dress |
| sc149 | 浴巾/夜晚 | 浴巾是画面核心却无 towel；wet, long, hair 破碎 |
| sc182 | 樱花(花瓣) | 婚纱初夜花瓣：prompt 破碎（wearing, pure, white…）婚纱崩坏 |
| sc183 | 跨坐 | 故事"跨坐沙发你腿上"，prompt sitting_on_barstool 吧台凳 |
| sc220 | 跨坐 | 故事"跨坐到你腿上"，prompt sitting_at_piano 琴凳、POV 互动丢失 |
| sc047 | 睡裙/夜晚 | sunlight/backlight 与"夜景铺满落地窗"反向矛盾 |
| sc058 | 睡裙 | 睡袍遮肩：prompt 无睡衣族词 |
| sc070 | 睡裙 | 轻薄睡裙浇水：prompt 无睡衣族词 |

### D2 · 轻缺：补一个词即可（姿势弱表达/单元素缺失，13 条）

| id | 缺失 | 建议 |
|---|---|---|
| sc035 | 站立 | 补 standing |
| sc127 | 跨坐 | sitting_on_edge+POV → 补 straddling |
| sc117/162/176/186/194/211 | 跨坐 | kneeling_on_bed+POV 是常见弱表达 → 补 straddling 一词即可 |
| sc213/255/217 | 跨坐 | sitting_on_sofa / sitting 弱表达 → 补 straddling |
| sc133 同步 | （裸体） | apron 补 apron_only 一词即同时满足裸体检查 |
| sc160 | 夜晚 | 深夜厨房 → 补 night（或豁免） |
| sc155/172 | 夜晚 | 补 night；tag 破碎一并修 |

### D3 · 轻缺 + 破碎 tag（8 条，补词时必须连 tag 一起修）

sc131（已列 D1）、sc149、sc250（睡衣 + curled, sofa, corner 破碎）、sc288（真空 + very, long, hair 破碎）、
sc290（silk, robe 被逗号撕裂）、sc139、sc154、sc182

> **破碎 tag 共性问题**：约 10 条 prompt 把本该下划线连写的 tag 写成逐词逗号（"wearing, extremely, thin, one, shoulder, strap"），
> 出图时基本无效。疑似某次批量生成的坏数据，值得单独批量修复（但同样需出图验证）。

### D4 · 需你定夺（1 条）

| id | 缺失 | 分歧 |
|---|---|---|
| sc095 | 浴巾 | 故事"滑落前被接住的浴巾"，prompt 是 bathrobe（浴袍）——语义近族不同物。接受浴袍版则豁免，坚持浴巾则改词重出 |

## E · 定稿保护（2 条）—— pin 流程

| id | 缺失 | 情况 |
|---|---|---|
| sc141 | 站立 | 故事"站在天台边缘"，prompt crouching_on_...（蹲伏潜行）——蹲可能是定稿效果，需出图自测判断 |
| sc163 | 浴巾 | 故事前段裹浴巾、prompt 已是滑落后全裸温泉——时间点差，需出图自测判断 |

## 建议执行顺序（等你确认）

1. **零数据改动**（可立即做）：A 类扩词表 + B/C 类进豁免清单 → 门禁剩余 37 条全是真实待决策项。
2. **D 类**：逐条确认"是否有已交付样张"→ 有样张且画面 OK 的进豁免；无样张/画面错的补词 + 真实出图验证。
3. **破碎 tag 批修**：独立小批量，修完出图对比。
4. **E 类**：出图自测 + `npm run scenes:pin-capture`。
