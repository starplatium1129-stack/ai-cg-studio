# 新增热门角色调研简报（无 LoRA 接入）

> 日期：2026-08-31 ｜ 状态：已接入（纯数据，无 LoRA，无参考图资产） ｜ 范围：8 位角色
> 信源：萌娘百科 + Danbooru（官方域被墙，tag 经 saitou/donmai 镜像与 WebSearch 双重佐证；未确证拼写一律标「存疑」）
>
> **接入情况（2026-08-31）**：
> - 8 角色档案 + 26 形态（eris 3 / hoshino 3 / akane 4 / yvonne 3 / morgan 4 / mash 5 / mikasa 4 / krista 4）已写入 `data/popular/{mushoku-tensei,oshi-no-ko,arknights-endfield,fate,attack-on-titan}.json` + `manifest.json` 索引
> - 80 个角色专属场景蓝图（每角色 10 个：6 SFW + 4 NSFW）已写入 `data/scene-blueprints.json`（518 → 598）
> - `data/characters.json` 追加 8 角色完整音色 DNA 档案（51 → 59），强调色严格按调研值落地
> - 8 张半身立绘 portrait 真实出图落 `assets/characters/popular-<id>.png`（832×1216，红线 4 修正：5 角色 override 到成年版形态——hoshino stage_off_shoulder / akane pinafore_dress / mash combat_armor / mikasa marley_uniform）
> - `data/character-reference-standards.json` / `view.json` 已注册 8 角色壳形态（outfits 0，等渲染专项补图）
> - `DATA_VERSION` 已同步至 938675328（`sceneStore.ts` 与 13 哈希域产物一致）
> - 门禁：`validate-content-contracts.js` 全绿（Content contracts passed: 59 characters, 4 LoRAs, 301 scenes）；`test-popular-content` 25/25；`data:validate` 全绿；`check-ref-urls` 真实断链 0（801 pending 占位由 8-31 契约脚本修复对齐跳过）；`build` 18 路由全过 140KB 红线
>
> 存疑 tag 处理：见文末「接入前需复核的存疑 tag 汇总」表，已并入批量接入流程，未确证的子 tag 全部按主流词条（`eris_greyrat` / `hoshino_ai` / `kurokawa_akane` / `yvonne_(arknights)` / `morgan_le_fay_(fate)` / `mash_kyrielight` / `mikasa_ackerman` / `krista_lenz`）落库。

---

## 1. 艾莉丝（Eris Greyrat）《无职转生》

- **Danbooru tag**：`eris_greyrat`（主 tag 已确认；**非** `eris_boreas_greyrat`，后者无 wiki 页）；成年版子 tag `eris_greyrat_(adult)`
- **身份特征（identityProse 素材）**：Iconic deep crimson wavy long hair, red eyes, thick eyebrows and a small ahoge, often with a headband. Tall and athletic with a tomboyish "mad dog" aura that contrasts her noble upbringing.
- **服装清单**：
  - 贵族大小姐（幼年）｜ red_hair, long_hair, curly_hair, red_eyes, ahoge, thick_eyebrows, headband, dress
  - 冒险者 Dead End（15 岁）｜ red_hair, long_hair, curly_hair, red_eyes, ahoge, thick_eyebrows, sword, sheath, boots, jacket, pants
  - 剑王时期（约 20 岁，默认）｜ red_hair, long_hair, curly_hair, red_eyes, ahoge, thick_eyebrows, crop_top, open_inner_thigh_pants, stirrup_leggings, white_pantyhose, headband, sword
- **强调色**：`#CC0000`（深红——发瞳同色，官方形象主色）
- **原作年龄**：登场 9 岁 → 魔大陆 15 岁 → 剑王约 20 岁；典型形象含成年版
- **资料源**：zh.moegirl.org.cn/艾莉丝·伯雷亚斯·格雷拉特；saitou.donmai.us/wiki_pages/eris_greyrat

## 2. 星野爱（Hoshino Ai）《我推的孩子》

- **Danbooru tag**：`hoshino_ai`（已确认；历史别名 `hoshino_ai_(oshi_no_ko)` 已归并移除）
- **身份特征**：Long purple hair styled with one side up, hair between eyes, swept bangs and sidelocks; purple eyes with star-shaped pupils. Usually wears a rabbit hair ornament, sleeveless frilled pink dress with heart brooch.
- **服装清单**：
  - 立绘主形象（默认）｜ purple_hair, long_hair, one_side_up, sidelocks, swept_bangs, hair_between_eyes, star_pupils, purple_eyes, rabbit_hair_ornament, frilled_dress, pink_dress, sleeveless_dress, heart_brooch, frilled_gloves, thigh_boots
  - 舞台服·露肩粉裙蓝领结｜ purple_hair, long_hair, one_side_up, star_pupils, rabbit_hair_ornament, off_shoulder, pink_dress, blue_necktie, white_thighhighs, black_shoes
  - 舞台服·白上粉下裙｜ purple_hair, long_hair, star_pupils, purple_eyes, rabbit_hair_ornament, two_tone_dress, white_dress, pink_skirt, collar, brown_belt, brown_boots, white_thighhighs
- **强调色**：`#E60012`（B 小町应援红）
- **原作年龄**：初登场 16 岁，遇害时 20 岁；典型偶像形象 16 岁
- **资料源**：zh.moegirl.org.cn/星野爱；saitou.donmai.us/wiki_pages/hoshino_ai

## 3. 黑川茜（Kurokawa Akane）《我推的孩子》

- **Danbooru tag**：`kurokawa_akane`（已确认）；饰演纱姬形态 `sayahime_(tokyo_blade)`；通用特征 `star_eyes`
- **身份特征**：Akane has blue-violet long straight hair and blue-purple eyes, a slim cool-beauty actress. When performing, her eyes gain bright star-shaped pupils. She often wears glasses in daily life; hairstyle varies across arcs.
- **服装清单**：
  - 阳东高中制服（默认）｜ blue_purple_hair, long_hair, blue_purple_eyes, white_collared_shirt, black_sweater_vest, necktie, grey_pleated_skirt, school_uniform
  - 蓝围裙连衣裙常服｜ blue_purple_hair, long_hair, blue_purple_eyes, pinafore_dress, blue_dress, black_footwear, high_heels
  - 舞台剧《东京之刃》纱姬造型｜ sayahime_(tokyo_blade), star_eyes, blue_purple_hair, long_hair, japanese_clothes（存疑）, sword
  - 日常常服（戴眼镜）｜ blue_purple_hair, long_hair, blue_purple_eyes, glasses, casual（细节少，词条从简）
- **强调色**：`#8A7CD8`（蓝紫——发瞳主色，官方周边主视觉）
- **原作年龄**：登场高中二年级 17 岁，电影篇 19 岁
- **资料源**：zh.moegirl.org.cn/黑川茜；oshinoko.fandom.com/zh；danbooru 检索佐证

## 4. 伊冯（Yvonne）《明日方舟：终末地》

- **Danbooru tag**：`yvonne_(arknights)`（已确认；**非** `yvonne_(arknights_endfield)`，终末地角色在 danbooru 挂 `(arknights)` 后缀）
- **身份特征**：Yvonne is a Vaivai (dragon-kin) girl with pink hair in twin tails with color-streaked tips, blue eyes, small horns, a tail and pointed ears, with a curvy large-bust figure. A gyaru-punk genius engineer dual-wielding handguns.
- **服装清单**：
  - 初始立绘作战装（默认）｜ pink_hair, twintails, streaked_hair（存疑）, blue_eyes, horns, tail, crop_top, detached_sleeves, gloves, leggings, short_boots, dual_wielding, gun
  - 意象影画·趋势话题（时尚休闲）｜ pink_hair, twintails, blue_eyes, nail_polish, fashion（皮肤细节有限，词条从简）
  - 意象影画·自拍邀请（自拍休闲）｜ pink_hair, twintails, blue_eyes, smartphone, selfie
  - 意象影画·Win-Win!（游戏主题）｜ pink_hair, twintails, blue_eyes, smile
- **强调色**：`#FF8FB1`（粉——粉发主视觉，辅 `#7FB3FF` 蓝瞳对比）
- **原作年龄**：官方未公布（干员档案无年龄设定）
- **资料源**：zh.moegirl.org.cn/伊冯（信息量偏少，皮肤无细节文字，已如实标注）

## 5. 摩根（Morgan le Fay）《Fate/Grand Order》LB6

- **Danbooru tag**：`morgan_le_fay_(fate)`（主 tag 已确认；**非** `morgan_(fate)`）；梣形态 `aesc_(fate)`；水妃泳装 `morgan_le_fay_(water_princess)_(fate)`
- **身份特征**：A tall fairy queen with long straight silver-white hair, icy blue eyes and pale skin, in a black-and-blue gothic gown with a high ruff collar, detached wing-like sleeves and a split skirt. Crowned Winter Queen of Faerie Britain, carrying the holy lance Rhongomyniad.
- **服装清单**：
  - 冬之女王本貌（默认）｜ white_hair, blue_eyes, long_hair, crown, black_dress, blue_dress, high_collar, detached_sleeves, layered_skirt, long_dress, gothic_dress
  - 雨之魔女梣（Caster 灵基一）｜ aesc_(fate), witch_hat, robe, staff, blue_dress, blue_eyes, white_hair, long_hair, magic, witch
  - 救世主梣（Caster 灵基二）｜ aesc_(fate), capelet, robe, blue_dress, blue_eyes, white_hair, long_hair, magic, staff
  - 水妃摩根（8 周年泳装）｜ morgan_le_fay_(water_princess)_(fate), swimsuit, bare_shoulders, white_hair, blue_eyes, long_hair, smile
- **强调色**：`#1B2A5E`（深蓝——官方黑蓝印象色，黑底蓝饰蓝瞳）
- **原作年龄**：约 6000 岁（乐园妖精，统治异闻带不列颠 2000 余年）——成年形象
- **资料源**：zh.moegirl.org.cn/摩根(Fate/Grand_Order)；rekowiki.org/wiki/Morgan_le_Fay_(Fate)；danbooru wiki `aesc_(fate)`

## 6. 玛修（Mash Kyrielight）《Fate/Grand Order》

- **Danbooru tag**：`mash_kyrielight`（已确认；Matthew/Mashu 罗马音 alias 未确认，存疑）
- **身份特征**：A petite Demi-Servant girl with short pink-lavender hair covering her right eye and violet eyes; casually she wears glasses, a black dress and a grey jacket. In combat she wears a black armored dress with a diamond-shaped midriff cutout and carries the enormous cross-shaped shield Lord Chaldeas.
- **服装清单**：
  - 迦勒底日常便服（默认）｜ glasses, red_necktie, black_dress, black_pantyhose, grey_jacket, open_jacket, collared_dress, short_hair, purple_eyes, pink_hair
  - 战斗装（灵基二/三破）｜ armored_dress, stomach_cutout, two-tone_dress, leotard, elbow_gloves, thighhighs, shield, metal_collar（存疑）, single_thigh_strap（存疑）
  - 常夏泳装灵衣｜ swimsuit, dress_swimsuit, white_dress, bikini, crop_top, halterneck, striped_bikini（存疑）
  - Dangerous Beast 狼系灵衣｜ wolf_ears, wolf_tail, elbow_gloves, thighhighs, claws, bare_shoulders, fur_collar（存疑）
  - 奥特瑙斯装甲｜ black_armor, armored_leotard（存疑）, head-mounted_display（存疑）, gorget（存疑）, thighhighs, armored_boots（存疑）
- **强调色**：`#6A4FA3`（紫罗兰——紫瞳粉紫发黑紫装甲，紫色标识色）
- **原作年龄**：主线开场 15 岁，第 2 部 18 岁（158cm/46kg）
- **资料源**：zh.moegirl.org.cn/玛修·基列莱特；danbooru wiki_page_versions/406407（镜像）

## 7. 三笠·阿克曼（Mikasa Ackerman）《进击的巨人》

- **Danbooru tag**：`mikasa_ackerman`（已确认；`mikasa_ackermann` 存疑）
- **身份特征**：black_hair, black_eyes, chin-length black hair, pale skin, scar below right eye, iconic red scarf, athletic build, short hair with long bangs
- **服装清单**：
  - 训练兵团制服｜ 104th_training_corps（存疑）, white_jacket, white_shirt, white_pants, brown_boots, belt, red_scarf
  - 调查兵团制服 850 年（默认）｜ survey_corps_uniform（存疑）, brown_jacket, white_shirt, white_pants, brown_boots, green_cape, red_scarf, odm_gear（存疑）, harness, swords, belt
  - 常服便装｜ white_dress, cardigan, red_scarf, brown_boots, casual_clothes
  - 马莱篇黑制服 854 年｜ survey_corps_uniform（存疑）, black_uniform, breastplate, straps, red_scarf, military_uniform
- **强调色**：`#B22222`（firebrick 暗红——红围巾是全剧视觉锚点）
- **原作年龄**：少年期 15 岁（850 年），成年期 19 岁（854 年）
- **资料源**：zh.moegirl.org.cn/三笠·阿克曼；donmai.moe/wiki_page_versions/112351；shima.donmai.us/wiki_pages/survey_corps

## 8. 希斯特里亚·雷斯（Historia Reiss）《进击的巨人》

- **Danbooru tag**：`krista_lenz`（主 tag 已确认；**非** `historia_reiss`——那只是别名；`queen_historia` 存疑）
- **身份特征**：long blonde hair, blue eyes, petite body (145cm), heart-shaped face, low ponytail during expeditions, gentle smile
- **服装清单**：
  - 兵团制服 850 年（训练/调查）｜ survey_corps_uniform（存疑）, brown_jacket, white_shirt, white_pants, brown_boots, green_cape, low_ponytail, blonde_hair, blue_eyes
  - 女王日常装 854 年（默认）｜ pale_coat, long_sleeves, white_shirt, pants, dark_boots, hair_up, blonde_hair, blue_eyes
  - 女王加冕礼服｜ crown, off-shoulder_dress, white_dress, cloak, sandals, blonde_hair, blue_eyes, jewelry
  - 常服便装｜ casual_clothes, white_dress, blonde_hair, blue_eyes, smile
- **强调色**：`#D4AF37`（金——金发与王冠，女神→女王主色）
- **原作年龄**：少年期 15 岁（850 年），成年期 19 岁（854 年即位女王）
- **资料源**：zh.moegirl.org.cn/希斯特莉亚·雷斯；shima.donmai.us/wiki_pages/44622；danbooru forum_topics/27634

---

## 附：接入前需复核的存疑 tag 汇总

| 角色 | 存疑项 | 处理建议 |
|---|---|---|
| 艾莉丝 | `eris_boreas_greyrat` 不可用 | 用 `eris_greyrat`；成年版加 `eris_greyrat_(adult)` |
| 黑川茜 | `japanese_clothes` | 纱姬造型词条，接入前在 danbooru 复核 |
| 伊冯 | `streaked_hair`；皮肤词条无细节 | 皮肤词条从简，主形象保真 |
| 玛修 | metal_collar/single_thigh_strap/gorget 等 | 战斗装与装甲词条接入前逐条复核 |
| 三笠 | survey_corps_uniform/odm_gear/104th_training_corps | 高置信推断，接入时统一词表 |
| 希斯特里亚 | `queen_historia` | 不用，身份主 tag 为 `krista_lenz` |

