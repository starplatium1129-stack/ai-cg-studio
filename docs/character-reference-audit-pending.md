# 角色 4 视角参考图待精调待办归档清单 (Pending Audit & Fine-Tune Backlog)

> **归档日期**：2026-08-17（快照）
> **大盘现状（当时）**：全量 736 张标准参考图卡槽中已有 **661 张（约 90%）** 获得 Gemini 3.7 Flash 绿灯 PASS 认证；本清单归档剩余 **75 张** 边缘视角偏差点，供后续有空时定向微调。
> **当前基线（2026-08-31 复核）**：参考库现为 **59 角色 × 267 服装形态**（`data/character-reference-standards.json`，characters 数组）；4 视角标准参考与 3 视角设计图视图在 `data/character-reference-view.json`。2026-08-31 已批量落地 51 角色默认服装 × front/side/back 三视角 design 设计图 153 张（`ref_design_*` 独立通道），同步新接入 8 角色（eris_greyrat / hoshino_ai / kurokawa_akane / yvonne_arknights / morgan_le_fay_fate / mash_kyrielight / mikasa_ackerman / krista_lenz，壳形态 outfits:0 占位等渲染专项）。**75 项清单复核仍有效**：涉及角色的 identityTokens 未受 08-31 修复（8 角色，均不在本清单）影响，`ref_design_*` 通道也不覆盖本清单的 `ref_01~04` 偏差点。本清单为历史快照，仅保留 75 项待精调明细的复现配方，供有空时定向微调。

## 一、 待精调角色分布概览

| 角色名称 | 待精调数 | 主要涉及服装形态 |
| :--- | :---: | :--- |
| **艾雅法拉** | 9 张 | 夏卉（泳装）、【汐斯塔之憩】地热温泉和风浴衣、私密全裸 / 纯粹形态 |
| **史尔特尔** | 8 张 | 缤纷奇境（泳装）、超然序曲（音律礼服）、香草融意甜品店日常便服、熔温夜曲丝绸慵懒睡袍、深红曜影高定露背晚礼服、私密全裸 / 纯粹形态 |
| **蕾缪安** | 7 张 | 拉特兰制服、温室休养录罗德岛医疗康复针织便服、午后私语真丝蕾丝晨袍与私密居家长裙、私密全裸 / 纯粹形态 |
| **莱万汀** | 6 张 | 极简落肩·休息舱私服、绯红甜意·街头机能便服、黑曜夜华·萨卡兹晚礼服、私密全裸 / 纯粹形态 |
| **夕** | 5 张 | 染尘烟（新春旗袍）、画斋幽梦、墨染云纱、街头墨客、私密全裸 / 纯粹形态 |
| **泥岩** | 5 张 | 静谧午夜（泳装）、陶艺工坊泥塑工装、罗德岛大号连帽卫衣、私密全裸 / 纯粹形态 |
| **凯尔希** | 4 张 | 罗德岛日常慵懒高领毛衣便服、深夜研读·墨绿真丝睡袍与吊带裙、维多利亚博物学者古典旅行大衣、私密全裸 / 纯粹形态 |
| **陈** | 4 张 | 假日威龙（海滩装）、龙门夜市街头休闲装、清晨道场练功服、私密全裸 / 纯粹形态 |
| **斯卡蒂** | 4 张 | 鲸梦独语·连帽卫衣居家服、静谧午后·咖啡店围裙便服、海潮绝响·音律交响晚礼服、私密全裸 / 纯粹形态 |
| **羽毛笔** | 4 张 | 夏卉（泳装）、多索雷斯假日热带海滨街头漫步便服、私密全裸 / 纯粹形态 |
| **能天使** | 4 张 | 城市骑手（KFC联动）、罗德岛宿舍慵懒开黑居家服、龙门街头机能滑板潮服、私密全裸 / 纯粹形态 |
| **铃兰** | 3 张 | 【夏日微风】东国夏日祭轻风浴衣、私密全裸 / 纯粹形态 |
| **木更** | 2 张 | 私密全裸 / 纯粹形态 |
| **森蚺** | 2 张 | 熔锻铸匠（工装）、私密全裸 / 纯粹形态 |
| **佩丽卡** | 2 张 | 都市机能风尚、私密全裸 / 纯粹形态 |
| **芙莉莲** | 1 张 | 私密全裸 / 纯粹形态 |
| **阿尔托莉雅** | 1 张 | 私密全裸 / 纯粹形态 |
| **初音未来** | 1 张 | 私密全裸 / 纯粹形态 |
| **楪祈** | 1 张 | 私密全裸 / 纯粹形态 |
| **御坂美琴** | 1 张 | 私密全裸 / 纯粹形态 |
| **伊莉雅丝菲尔** | 1 张 | 私密全裸 / 纯粹形态 |

## 二、 核心偏差点与定向精调配方指南

1. **【面部特写 `ref_01_face_closeup`】（主要为晚礼服、机能服）**：
   - **现象**：二次元大模型在画礼服/大衣时，容易联想全身，特写偶发拉成俯视半身；
   - **精调配方**：动态剥离 Prompt 中的 `skirt, dress, boots`，正向注入 `tight headshot portrait, chin to forehead framing, 85mm macro lens`，负向加重 `(torso:1.4), (body:1.4), (waist:1.4), (high angle:1.4)`。
2. **【3/4 侧身半身 `ref_02_half_medium`】**：
   - **现象**：模型容易画成正面立姿，身体侧转 45 度角度不够明显；
   - **精调配方**：正向注入 `medium cowboy shot, torso turned 45 degrees, angled posture`，负向注入 `straight front view, facing camera squarely`。
3. **【45° 侧后背影 `ref_04_back_rear`】**：
   - **现象**：正面回眸角度偏正，后背展示不足；
   - **精调配方**：正向注入 `view from behind, back view focus, back of shoulders, hair flow`，负向注入 `front of chest, frontal face`。

## 三、 详细待精调清单明细（共 75 项）

| 序号 | 角色 | 服装形态 | 视角 | 审查理由摘要 | 资产相对路径 |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | 芙莉莲 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **构图范围不符合标准**：本图采 | `assets/character-references/frieren/nsfw_nude/ref_01_face_closeup.png` |
| 2 | 阿尔托莉雅 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **构图与景别 | `assets/character-references/artoria_pendragon/nsfw_nude/ref_01_face_closeup.png` |
| 3 | 初音未来 | 🔞 私密全裸 / 纯粹形态 | 3/4半身定妆 | ：不通过  ： 1. **视角不符合要求**：画 | `assets/character-references/hatsune_miku/nsfw_nude/ref_02_half_medium.png` |
| 4 | 楪祈 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别构图不符** | `assets/character-references/yuzuriha_inori/nsfw_nude/ref_01_face_closeup.png` |
| 5 | 御坂美琴 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别不符**：画面 | `assets/character-references/misaka_mikoto/nsfw_nude/ref_01_face_closeup.png` |
| 6 | 伊莉雅丝菲尔 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. * | `assets/character-references/illyasviel_von_einzbern/nsfw_nude/ref_01_face_closeup.png` |
| 7 | 木更 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别构图 | `assets/character-references/kisara_engage_kiss/nsfw_nude/ref_01_face_closeup.png` |
| 8 | 木更 | 🔞 私密全裸 / 纯粹形态 | 3/4半身定妆 | ：不通过  ： 1. **景别不符* | `assets/character-references/kisara_engage_kiss/nsfw_nude/ref_02_half_medium.png` |
| 9 | 史尔特尔 | 🔞 缤纷奇境（泳装） | 3/4半身定妆 | ：不通过  ： 1. | `assets/character-references/surtr_arknights/colorful_wonderland/ref_02_half_medium.png` |
| 10 | 史尔特尔 | 🔞 缤纷奇境（泳装） | 正面全身立姿 | ：不通过  ： 1. | `assets/character-references/surtr_arknights/colorful_wonderland/ref_03_full_dynamic.png` |
| 11 | 史尔特尔 | 超然序曲（音律礼服） | 面部特写 | ：不通过  【详细理由 | `assets/character-references/surtr_arknights/prelude_to_transcendence/ref_01_face_closeup.png` |
| 12 | 史尔特尔 | 香草融意甜品店日常便服 | 面部特写 | ：不通过  ： | `assets/character-references/surtr_arknights/ice_cream_cafe_casual/ref_01_face_closeup.png` |
| 13 | 史尔特尔 | 香草融意甜品店日常便服 | 3/4半身定妆 | ：不通过  ： 1 | `assets/character-references/surtr_arknights/ice_cream_cafe_casual/ref_02_half_medium.png` |
| 14 | 史尔特尔 | 熔温夜曲丝绸慵懒睡袍 | 面部特写 | ：不通过  ：该图 | `assets/character-references/surtr_arknights/lava_silk_loungewear/ref_01_face_closeup.png` |
| 15 | 史尔特尔 | 深红曜影高定露背晚礼服 | 面部特写 | ：不通过  【详 | `assets/character-references/surtr_arknights/crimson_velvet_evening_gown/ref_01_face_closeup.png` |
| 16 | 史尔特尔 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **构图景别不符* | `assets/character-references/surtr_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 17 | 凯尔希 | 罗德岛日常慵懒高领毛衣便服 | 面部特写 | ：不通过  【详 | `assets/character-references/kaltsit_arknights/rhodes_island_lounge_knit/ref_01_face_closeup.png` |
| 18 | 凯尔希 | 深夜研读·墨绿真丝睡袍与吊带裙 | 3/4半身定妆 | ：不通过  【详 | `assets/character-references/kaltsit_arknights/midnight_emerald_silk_robe/ref_02_half_medium.png` |
| 19 | 凯尔希 | 维多利亚博物学者古典旅行大衣 | 3/4半身定妆 | ：不通过  【详细理由 | `assets/character-references/kaltsit_arknights/victorian_traveler_coat/ref_02_half_medium.png` |
| 20 | 凯尔希 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别不符* | `assets/character-references/kaltsit_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 21 | 陈 | 假日威龙（海滩装） | 面部特写 | ：不通过  ： 1. **景别不符**：当 | `assets/character-references/chen_arknights/holungday/ref_01_face_closeup.png` |
| 22 | 陈 | 龙门夜市街头休闲装 | 3/4半身定妆 | ：不通过  ： 1. | `assets/character-references/chen_arknights/street_gourmet_casual/ref_02_half_medium.png` |
| 23 | 陈 | 清晨道场练功服 | 面部特写 | ：不通过 ：当前图片的景 | `assets/character-references/chen_arknights/morning_kendo_robe/ref_01_face_closeup.png` |
| 24 | 陈 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别构图不符** | `assets/character-references/chen_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 25 | 艾雅法拉 | 🔞 夏卉（泳装） | 3/4半身定妆 | ：不通过  ： 1. * | `assets/character-references/eyjafjalla_arknights/summer_flower/ref_02_half_medium.png` |
| 26 | 艾雅法拉 | 🔞 夏卉（泳装） | 正面全身立姿 | ：不通过  ： 1. | `assets/character-references/eyjafjalla_arknights/summer_flower/ref_03_full_dynamic.png` |
| 27 | 艾雅法拉 | 🔞 夏卉（泳装） | 45°侧后背影 | ：不通过  ： 1. **未 | `assets/character-references/eyjafjalla_arknights/summer_flower/ref_04_back_rear.png` |
| 28 | 艾雅法拉 | 🔞 【汐斯塔之憩】地热温泉和风浴衣 | 面部特写 | ：不通过 【详 | `assets/character-references/eyjafjalla_arknights/siesta_hotspring_yukata/ref_01_face_closeup.png` |
| 29 | 艾雅法拉 | 🔞 【汐斯塔之憩】地热温泉和风浴衣 | 3/4半身定妆 | ：不通过 【详细 | `assets/character-references/eyjafjalla_arknights/siesta_hotspring_yukata/ref_02_half_medium.png` |
| 30 | 艾雅法拉 | 🔞 【汐斯塔之憩】地热温泉和风浴衣 | 正面全身立姿 | ：不通过  【 | `assets/character-references/eyjafjalla_arknights/siesta_hotspring_yukata/ref_03_full_dynamic.png` |
| 31 | 艾雅法拉 | 🔞 【汐斯塔之憩】地热温泉和风浴衣 | 45°侧后背影 | ：不通过  【详细理 | `assets/character-references/eyjafjalla_arknights/siesta_hotspring_yukata/ref_04_back_rear.png` |
| 32 | 艾雅法拉 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别 | `assets/character-references/eyjafjalla_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 33 | 艾雅法拉 | 🔞 私密全裸 / 纯粹形态 | 3/4半身定妆 | ：不通过  ： 1. **景别与 | `assets/character-references/eyjafjalla_arknights/nsfw_nude/ref_02_half_medium.png` |
| 34 | 蕾缪安 | 拉特兰制服 | 3/4半身定妆 | ：不通过  ： 1. **视角不符**：画 | `assets/character-references/lemuen_arknights/standard/ref_02_half_medium.png` |
| 35 | 蕾缪安 | 温室休养录罗德岛医疗康复针织便服 | 3/4半身定妆 | ：不通过  ： 1. | `assets/character-references/lemuen_arknights/rehab_cozy_knitwear/ref_02_half_medium.png` |
| 36 | 蕾缪安 | 🔞 午后私语真丝蕾丝晨袍与私密居家长裙 | 面部特写 | ：不通过 | `assets/character-references/lemuen_arknights/silk_lace_morning_robe/ref_01_face_closeup.png` |
| 37 | 蕾缪安 | 🔞 午后私语真丝蕾丝晨袍与私密居家长裙 | 3/4半身定妆 | ：不通过  ： | `assets/character-references/lemuen_arknights/silk_lace_morning_robe/ref_02_half_medium.png` |
| 38 | 蕾缪安 | 🔞 午后私语真丝蕾丝晨袍与私密居家长裙 | 正面全身立姿 | ：不通过 | `assets/character-references/lemuen_arknights/silk_lace_morning_robe/ref_03_full_dynamic.png` |
| 39 | 蕾缪安 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别不符** | `assets/character-references/lemuen_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 40 | 蕾缪安 | 🔞 私密全裸 / 纯粹形态 | 3/4半身定妆 | ：不通过  ： 1. **角度与构图不符 | `assets/character-references/lemuen_arknights/nsfw_nude/ref_02_half_medium.png` |
| 41 | 夕 | 染尘烟（新春旗袍） | 面部特写 | ：不通过  ： 1. **景别不符**： | `assets/character-references/dusk_arknights/dying_dust/ref_01_face_closeup.png` |
| 42 | 夕 | 画斋幽梦 | 面部特写 | ：不通过  【详细理 | `assets/character-references/dusk_arknights/atelier_slouchy_loungewear/ref_01_face_closeup.png` |
| 43 | 夕 | 墨染云纱 | 面部特写 | ：不通过  ： 1. | `assets/character-references/dusk_arknights/ink_silk_nightdress/ref_01_face_closeup.png` |
| 44 | 夕 | 街头墨客 | 面部特写 | ：不通过  ： | `assets/character-references/dusk_arknights/neo_cyber_ink_techwear/ref_01_face_closeup.png` |
| 45 | 夕 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别不符**：画 | `assets/character-references/dusk_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 46 | 泥岩 | 🔞 静谧午夜（泳装） | 3/4半身定妆 | ：不通过  ： 1. **未满足 | `assets/character-references/mudrock_arknights/silent_night/ref_02_half_medium.png` |
| 47 | 泥岩 | 🔞 静谧午夜（泳装） | 正面全身立姿 | ：不通过  ： 1. **未满 | `assets/character-references/mudrock_arknights/silent_night/ref_03_full_dynamic.png` |
| 48 | 泥岩 | 陶艺工坊泥塑工装 | 面部特写 | ：不通过  ： 1 | `assets/character-references/mudrock_arknights/clay_artisan_apron/ref_01_face_closeup.png` |
| 49 | 泥岩 | 罗德岛大号连帽卫衣 | 面部特写 | ：不通过 【详细理由 | `assets/character-references/mudrock_arknights/rhodes_oversized_hoodie/ref_01_face_closeup.png` |
| 50 | 泥岩 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别不符* | `assets/character-references/mudrock_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 51 | 森蚺 | 熔锻铸匠（工装） | 面部特写 | ：不通过  ： 1. **构图 | `assets/character-references/eunectes_arknights/forgemaster/ref_01_face_closeup.png` |
| 52 | 森蚺 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别不符 | `assets/character-references/eunectes_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 53 | 斯卡蒂 | 鲸梦独语·连帽卫衣居家服 | 面部特写 | ：不通过  ： 1 | `assets/character-references/skadi_arknights/cozy_orca_loungewear/ref_01_face_closeup.png` |
| 54 | 斯卡蒂 | 静谧午后·咖啡店围裙便服 | 面部特写 | ：不通过  ： | `assets/character-references/skadi_arknights/quiet_barista_uniform/ref_01_face_closeup.png` |
| 55 | 斯卡蒂 | 海潮绝响·音律交响晚礼服 | 面部特写 | ：不通过  ： | `assets/character-references/skadi_arknights/oceanic_symphony_gown/ref_01_face_closeup.png` |
| 56 | 斯卡蒂 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别不符**： | `assets/character-references/skadi_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 57 | 羽毛笔 | 🔞 夏卉（泳装） | 面部特写 | ：不通过  ： | `assets/character-references/quillpen_arknights/summer_flower_fa210/ref_01_face_closeup.png` |
| 58 | 羽毛笔 | 🔞 夏卉（泳装） | 3/4半身定妆 | ：不通过  ： | `assets/character-references/quillpen_arknights/summer_flower_fa210/ref_02_half_medium.png` |
| 59 | 羽毛笔 | 多索雷斯假日热带海滨街头漫步便服 | 面部特写 | ：不通过 【详细 | `assets/character-references/quillpen_arknights/dossoles_tropical_casual/ref_01_face_closeup.png` |
| 60 | 羽毛笔 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别不符 | `assets/character-references/quillpen_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 61 | 能天使 | 城市骑手（KFC联动） | 面部特写 | ：不通过  ： 1. **景别不符 | `assets/character-references/exusiai_arknights/city_rider/ref_01_face_closeup.png` |
| 62 | 能天使 | 罗德岛宿舍慵懒开黑居家服 | 面部特写 | ：不通 | `assets/character-references/exusiai_arknights/lazy_dorm_oversized_loungewear/ref_01_face_closeup.png` |
| 63 | 能天使 | 龙门街头机能滑板潮服 | 面部特写 | ：不通过  【详 | `assets/character-references/exusiai_arknights/lungmen_streetwear_skater/ref_01_face_closeup.png` |
| 64 | 能天使 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **构图景别不 | `assets/character-references/exusiai_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 65 | 铃兰 | 🔞 【夏日微风】东国夏日祭轻风浴衣 | 面部特写 | ：不通过 | `assets/character-references/suzuran_arknights/higashi_summer_yukata/ref_01_face_closeup.png` |
| 66 | 铃兰 | 🔞 【夏日微风】东国夏日祭轻风浴衣 | 3/4半身定妆 | ：不通过  ： | `assets/character-references/suzuran_arknights/higashi_summer_yukata/ref_02_half_medium.png` |
| 67 | 铃兰 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **构图不符合 | `assets/character-references/suzuran_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 68 | 佩丽卡 | 都市机能风尚 | 面部特写 | ：不通过  【详细 | `assets/character-references/perlica_arknights/endfield_techwear_street/ref_01_face_closeup.png` |
| 69 | 佩丽卡 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别构图不 | `assets/character-references/perlica_arknights/nsfw_nude/ref_01_face_closeup.png` |
| 70 | 莱万汀 | 极简落肩·休息舱私服 | 面部特写 | ：不通过 | `assets/character-references/laevatain_arknights/cozy_dorm_loungewear/ref_01_face_closeup.png` |
| 71 | 莱万汀 | 绯红甜意·街头机能便服 | 面部特写 | ：不通过  ：该 | `assets/character-references/laevatain_arknights/street_cafe_sweet/ref_01_face_closeup.png` |
| 72 | 莱万汀 | 黑曜夜华·萨卡兹晚礼服 | 面部特写 | ：不通过  【详细理由 | `assets/character-references/laevatain_arknights/obsidian_formal_gown/ref_01_face_closeup.png` |
| 73 | 莱万汀 | 黑曜夜华·萨卡兹晚礼服 | 3/4半身定妆 | ：不通过 | `assets/character-references/laevatain_arknights/obsidian_formal_gown/ref_02_half_medium.png` |
| 74 | 莱万汀 | 黑曜夜华·萨卡兹晚礼服 | 正面全身立姿 | ：不通过  【详细理由 | `assets/character-references/laevatain_arknights/obsidian_formal_gown/ref_03_full_dynamic.png` |
| 75 | 莱万汀 | 🔞 私密全裸 / 纯粹形态 | 面部特写 | ：不通过  ： 1. **景别不 | `assets/character-references/laevatain_arknights/nsfw_nude/ref_01_face_closeup.png` |
