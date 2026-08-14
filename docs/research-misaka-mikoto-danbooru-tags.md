# Misaka Mikoto (御坂美琴) — Danbooru 标签研究

> 研究交付物。来源优先级：Danbooru wiki 页面本身 > 各标签的 Danbooru wiki 页面 > 存档镜像。

## 重要方法学说明（务必先读）

1. **本会话没有 `web_fetch` 工具**；`pwsh` 直连 danbooru.donmai.us 及其所有镜像（safebooru/shima/hijiribe）与 JSON API 全部返回 **403（Cloudflare 风控）**；无头 Chromium 也卡在 Cloudflare "Just a moment" 挑战无法通过。因此**无法抓取线上原页**。
2. **改用 Wayback Machine 存档**成功取得 `safebooru.donmai.us`（= Danbooru 的 SFW 镜像，wiki 内容与主站一致）的 wiki 页面快照。快照年份为 2025，可能不反映最新版。
3. **关键事实：Misaka Mikoto 的 wiki 页面正文是「散文式传记」，没有结构化的「标签清单」区块**。它没有像部分 wiki 页那样列出 appearance 标签；标签以「正文内嵌 wiki 链接」的形式存在。下面是正文逐字转写。
4. outfit/hair 等外观标签的「规范标签名」是**通过抓取每个标签自己的 wiki 页面确认其存在**（标题 `XXX Wiki | Danbooru` 即证明该标签是 Danbooru 的正式标签页）。这属于「在 Danbooru 页面确实看到」，但不等于「在 misaka_mikoto 主页面列出」。凡未能在任一站内页面确认的，一律标注 **未确认/not confirmed**。

---

## A. misaka_mikoto wiki 页面正文（逐字转写，[] 为正文内嵌的规范标签链接）

URL: https://safebooru.donmai.us/wiki_pages/misaka_mikoto（存档快照，与 https://danbooru.donmai.us/wiki_pages/misaka_mikoto 同内容）
页面标题: **Misaka Mikoto Wiki | Danbooru**；`<body>` 元数据：`data-wiki-page-id="9800"`

> [御坂美琴] [超電磁砲]
>
> An [electricity]-wielding middle schooler from [Toaru Majutsu no Index], nicknamed "[Biri Biri]", among other things. Roomate to [Shirai Kuroko] at all-girls Tokiwadai Private Academy... she's hailed as the "Electric Princess"... feared as the merciless vigilante "Electromaster" by criminals. ... becomes flustered ... around her acquaintance-cum-rival, [Kamijou Touma]...
>
> First appearing in *Index* as a supporting protagonist... she meets [Index] properly...
>
> In the spinoff manga dedicated to her, [Toaru Kagaku no Railgun]... Joining her is, of course, Kuroko, as well as... [Uiharu Kazari]... and [Saten Ruiko], a level 0 girl...
>
> **Related Characters**: [Misaka Imouto]: ... while Mikoto has **shorts on under her skirt**, this one only has [striped panties]. [Last Order]: Much [younger] looking... the only one with an **ahoge**. [Misaka Worst]: ... wears a gray and white [bodysuit] or a [Vietnamese dress]. **See also** [Gekota]

**正文中出现「显式链接」的规范标签**（即该 wiki 页自己标注的标签）：
- `electricity`（正文直接链）
- `toaru_majutsu_no_index`（系列/版权）
- `biribiri`（昵称，通用）
- `shirai_kuroko`、`kamijou_touma`、`index_(toaru_majutsu_no_index)`、`uiharu_kazari`、`saten_ruiko`（角色）
- `toaru_kagaku_no_railgun`（系列/版权）
- 相关角色：`misaka_imouto`、`last_order`、`misaka_worst`、`gekota`

**正文中仅以散文出现、未作为标签链接**（不可当作 canonical）：shorts(下装)、striped panties、ahoge、bodysuit、Vietnamese dress、younger。

> ⚠️ **本页没有任何发型/发色/瞳色/校服的外观标签清单**。`short_hair`、`brown_hair`、`brown_eyes`、`tokiwadai_school_uniform` 等**不在本页列出**。

---

## B. 标签分组清单（结构化）

每个标签标注：① 是否在 misaka_mikoto 主页面看到；② 是否作为独立规范标签页在我抓到的 Danbooru 页面确认；③ URL。

### 1) 身份 / 角色 / 系列（Identity / Character / Franchise）
| 标签串 | 主页面 | 独立确认 | 说明 |
|---|---|---|---|
| `misaka_mikoto` | ✅ 页面标题=角色名 | ✅ 规范角色标签（h1 链到 `/posts?tags=misaka_mikoto`） | Danbooru 用 `misaka_mikoto`，**不是 `mikoto_misaka`** |
| `toaru_kagaku_no_railgun` | ✅ 正文链接 | ✅ | 系列/版权标签 |
| `toaru_majutsu_no_index` | ✅ 正文链接 | ✅ | 系列/版权标签 |
| `shirai_kuroko` | ✅ 正文链接 | ✅ | 角色 |
| `kamijou_touma` | ✅ 正文链接 | ✅ | 角色 |
| `uiharu_kazari` | ✅ 正文链接 | ✅ | 角色 |
| `saten_ruiko` | ✅ 正文链接 | ✅ | 角色 |
| `index_(toaru_majutsu_no_index)` | ✅ 正文链接(Index) | ✅ | 角色 |
| `misaka_imouto` | ✅ 正文(R相关角色) | ✅ | 相关角色 |
| `last_order` | ✅ 正文(相关角色) | ✅ | 相关角色 |
| `misaka_worst` | ✅ 正文(相关角色) | ✅ | 相关角色 |
| `gekota` | ✅ 正文("See also") | ✅ | 吉祥物青蛙角色 |
| `mikoto_misaka` | ❌ 未见 | ❌ 未确认 | 任务假设的别名；Danbooru canonical 是 `misaka_mikoto` |

### 2) 外观 / 身体
| 标签串 | 主页面 | 独立确认 |
|---|---|---|
| `brown_hair` | ❌ 未列出 | ✅ 独立 wiki 页存在 |
| `short_hair` | ❌ 未列出 | ✅ 独立 wiki 页存在 |
| `brown_eyes` | ❌ 未列出 | ✅ 独立 wiki 页存在 |
| `small_breasts` | ❌ 未列出 | 部分确认：多张其帖子 data-tags 含 `small_breasts`；未按其独立 wiki 页复核 |
| `hair_ornament` | ❌ 未列出 | ✅ 独立 wiki 页存在；deepghs/character_index 列为 her 核心标签之一 |

### 3) 发型（hair）
| 标签串 | 主页面 | 独立确认 |
|---|---|---|
| `short_hair` | ❌ | ✅ |
| `brown_hair` | ❌ | ✅ |
| `blunt_bangs` | ❌ | ✅ 独立 wiki 页存在 |
| `ahoge` | ✅ 散文出现(正文提到"the only one with an ahoge"指 Last Order) | ✅ 独立 wiki 页存在；正文未把 ahoge 链给 Mikoto |
| `bob_cut` | ❌ | ⚠️ 仅在帖子 data-tags 见（post #4986194），未按独立 wiki 页复核 |
| `bangs` | ❌ | ⚠️ 帖子 data-tags 常见，通用标签 |
| `eyebrows_visible_through_hair` | ❌ | ⚠️ 帖子 data-tags 见 |

### 4) 服装（outfit）—— 注意：misaka_mikoto 主页面没有列任何校服装标签
| 标签串 | 主页面 | 独立确认 |
|---|---|---|
| `tokiwadai_school_uniform` | ❌ | ✅ 独立 wiki 页存在；且该页明确「自动附加 `school_uniform`」 |
| `school_uniform` | ❌ | ✅ 独立 wiki 页存在；被 tokiwadai_school_uniform 隐式包含 |
| `blazer` | ❌ | ✅ 独立 wiki 页存在 |
| `white_shirt` | ❌ | ✅ 独立 wiki 页存在；Tokiwadai 制服白衬衫 |
| `pleated_skirt` | ❌ | ✅ 独立 wiki 页存在 |
| `sweater_vest` | ❌ | ✅ 独立 wiki 页存在；常搭配制服/便服 |
| `pantyhose` | ❌ | ✅ 独立 wiki 页存在 |
| `stockings` | ❌ | ✅ 独立 wiki 页存在（Wayback 有快照） |
| `black_stockings` | ❌ | ❌ **未确认**（CDX 无该页快照；Archive 与直连均未能抓到） |
| `striped_panties` | ⚠️ 正文散文提及其相关角色 Misaka Imouto | ✅ 独立 wiki 页存在（非 Mikoto 本人的制服特征） |
| `shorts_under_skirt` / 短裤 | ⚠️ 正文「Mikoto 裙下有 shorts」为散文描述 | ❌ 未以标签形式确认 canonical 名称 |

### 5) 道具 / 能力 / 氛围（props / abilities / atmosphere）
| 标签串 | 主页面 | 独立确认 |
|---|---|---|
| `electricity` | ✅ 正文链接 | ✅ 独立 wiki 页存在；正文父标签 |
| `electrokinesis` | ⚠️ 经 `biribiri` 重定向指向 | ✅ 独立 wiki 页存在（`biribiri` 页=「See [electrokinesis]」） |
| `biribiri` | ✅ 正文链接(昵称) | ✅ |
| `railgun_(misaka_mikoto)` | ❌ | ✅ 独立 wiki 页存在（技能标签；区别于「武器」`railgun`） |
| `coin` | ❌ | ✅ 独立 wiki 页存在；她招牌发射物 |
| `railgun` | ❌ | ✅ 独立 wiki 页存在（「The actual weapon」与 `railgun_(misaka_mikoto)` 区分） |
| `lightning` | ❌ | ✅ electricity 页「不含大气 lightning」，仅作相关说明；是否对她用需视图 |
| `electricity_arc` | ❌ | ❌ **未确认**（未能抓到任何页面/快照） |
| `blue_lightning` | ❌ | ❌ **未确认**（未能抓到任何页面/快照） |
| `electrodes` / `electrostimulation` / `static electricity` | ❌ | ⚠️ electricity wiki 页列的「Related tags」（用于带电场景，非她独有） |
| `glowing` | ❌ | 未确认 |

### 6) 姿态 / 表情（attitude / pose）—— 主页面未列表
| 标签串 | 主页面 | 独立确认 |
|---|---|---|
| `tsundere` | ❌ 未列 | ❌ 未确认（主页面散文也未用该词） |
| `pointing` | ❌ 未列 | ❌ 未确认 |
| `hand_on_hip`、`looking_at_viewer`、`smile` | ❌ | ⚠️ 帖子 data-tags 见（post #4986194 / #5001589）；非实体 wiki 复核 |

---

## C. 佐证材料（独立于 wiki 页面）

- **deepghs/character_index**（HF，第三方向导）为 misaka_mikoto 标注核心标签：`brown_hair, short_hair, brown_eyes, hair_ornament`（8513 posts）。来源：https://huggingface.co/datasets/deepghs/character_index/blob/main/pages/toaru_majutsu_no_index.md （仅作佐证，非 wiki 本身）
- misaka_mikoto 页面自带「Posts」区块，其帖子 data-tags 反复出现：`misaka_mikoto, toaru_kagaku_no_railgun, toaru_majutsu_no_index, brown_hair, short_hair, brown_eyes, school_uniform, tokiwadai_school_uniform, white_shirt, sweater_vest, electricity, biribiri, small_breasts, bangs` 等——证明这些是她在 Danbooru 上实际使用/活跃的标签，但**不是该 wiki 页列出的规范清单**。

## 关键结论
1. `misaka_mikoto` 是唯一 canonical 角色标签；`mikoto_misaka` 未确认存在。
2. `tokiwadai_school_uniform` 是她的校服规范标签（隐含 `school_uniform`），组成通常为 blazer + white_shirt + pleated_skirt +（黑丝/白袜视画而定）+ sweater_vest。
3. 能力/氛围核心规范标签：`electricity`、`electrokinesis`、`railgun_(misaka_mikoto)`、`coin`。
4. 主 wiki 页面本身 **不提供发型/外观标签清单**；`short_hair`/`brown_hair`/`brown_eyes` 由第三方标注 + 独立标签页证实，而非该页。
5. `black_stockings`、`electricity_arc`、`blue_lightning` 三项在本次抓取中**未能在任何 Danbooru 页面确认**，按任务规则标记为 **未确认/not confirmed**（不推荐直接用作 canonical）。
