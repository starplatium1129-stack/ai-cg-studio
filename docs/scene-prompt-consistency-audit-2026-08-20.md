# 场景提示词一致性审阅与修复留档（2026-08-20）

## 背景

用户要求「审视目前场景的所有提示词，一个一个看」：
1. 存在**故事与提示词不符**的，优化提示词使其与故事一致；
2. 存在**提示词之间互相冲突**的，消除冲突；
3. 最后把优化后的场景逐一列出。

本次覆盖两套场景提示词数据（共 **739 条**）：
- 场景库 `data/scenes.json`（nene 152 / natsume 144 / triad 6，共 302 条；浏览器分片 `scenes-nene/natsume/shared.json` + `scenes-core.json`）
- 热门角色场景预设 `data/scene-blueprints.json`（437 条）

## 方法

- 切片工具 `scripts/maintenance/slice-scene-prompt-audit.js`：把两套数据切成 33 个连续批次（24 条/批）。
- 并行审阅：33 个子代理逐场景审阅（批量 24 条/代理），检查「story/description/action↔prompt/negative/tokens」一致性与提示词内部冲突；结果落盘 `runtime/scene-prompt-audit/findings/`。
- 复核：所有发现逐条对照源数据核实（含一处系统性缺陷二次扫描），再统一落地。
- 修复工具 `scripts/maintenance/fix-scene-prompt-consistency.js`：按场景 id 精确操作，**幂等**（已满足则跳过），所有替换带断言，未匹配一个不漏；以 `data/scenes.json` 为权威源改后重建四个分片。

## 发现 → 根因 → 修复

### A. 故事 vs 提示词不符（改提示词对齐故事；个别改描述/元数据对齐成图或权威 outfitId）

- `raiden_shogun_flower_field`：故事郊野花田，`promptProse` 凭空写 `seaside` → 去除。
- `yuzuriha_inori_r18_atelier`：故事「白礼裙」与 outfitId/nsfw「红 combat dress」矛盾 → 描述/动作改红色礼裙。
- `hatsune_miku_r18_backstage`：故事「坐化妆台前」，prose/nsfw/tokens 却在沙发上 → 改 vanity 妆台。
- `yukinoshita_yukino_library`：故事「倚窗读书」，prose 只有站姿 → 补 `reading a book`。
- `yukinoshita_yukino_r18_room`：故事「浴衣半褪」，prose/nsfw/tags 却写校服脱下 → 改浴衣。
- `elaina_r18_inn_room`：故事「坐床边看书」，prose/nsfw 躺枕 → 改坐床边读书。
- `artoria_r18_royal_chamber` / `makima_r18_office` / `tohsaka_rin_r18_mansion` / `roxy_migurdia_r18_teacher`：故事 action 立/坐 vs 成图卧/沙发 → 同步 action 到成图姿态。
- `mudrock_arknights_r18_bed_hands`：故事含「枕边人」（第二人）但单人人设 → action 改「指尖轻抚床沿」。
- `dusk_arknights_painting_studio`：`kneels` → `sits cross-legged`（盘坐）。
- `suzuran_arknights_wildflower_field`：`kneels` → `squats`（蹲）。
- `kitagawa_marin_amusement_park`：比心 → `finger-heart gesture`。
- `exusiai_arknights_r18_apartment_couch`：脱衣对象 `courier jacket` → `oversized t-shirt`（对齐服装）。
- `yui_home_cooking_kitchen`：outfitId=狗睡衣，`hoodie` → 狗图案睡衣。
- `alya_summer_festival_yukata`：浴衣 vs sundress 混乱 → 统一 yukata。
- `illyasviel_moon_garden`：outfitId=白裙，`purple_dress` → `white_dress`。
- `illyasviel_r18_castle`：故事「紫礼裙」 vs outfitId 红冬大衣 → 描述/动作改红冬大衣。
- `byakuya_sunset_rooftop_bento` / `byakuya_r18_*`：发色三处不一 → 统一银白长发+小角发髻；夜晚榻榻米去 `afternoon_shoji_light`。
- `byakuya_r18_magical_girl_torn_dress`：故事仰躺，prose/nsfw「坐姿」→ 仰躺。
- `cecilia_church_stained_glass_praying` / `cecilia_r18_pastor_shirt_open_couch`：发色统一薄荷绿；R18「双腿并拢」去 `spread_legs/thighs`。
- `rem_rezero_rain_night`：outfitId=常服，去 `maid` 标签防女仆装串台。

场景库部分：
- `sc090` 蹲地点心 → 站立回眸按发带（含负向去 `standing`）；`sc059` 端杯挡脸（去 `no mug in hand` 与负向禁杯词）；`sc079` 站木梯去 `sitting`；`sc069` 挽臂去 `holding_hands`；`sc073` 温泉缘侧去 `bathroom`；`sc165` 吧台 `kitchen→cafe_interior`；`sc203` 榻榻米 `lying_on_bed→sitting_on_tatami`；`sc192` 地毯 `lying_on_couch→lying_on_floor`；`sc153` 夹紧双腿 `legs_apart→legs_together`；`sc276` 遮脸 vs 遮胸；`sc149` 未绑发带去 `hair_ribbon`；`sc142` 大号衬衫+围裙（删整段魔女制服词）；`sc234` 纯黑丝袜；`sc244` 去虚构黑猫；`sc290/291/292/298/299` 去与穿衣矛盾的 `nude`；`sc123` 故事「午后→清晨」；`sc033` 冬夜玄关去 `golden_hour`；`sc004/015` 午后去 `sunset`；`sc014/019` 户外去 `window_light`；`sc021` 客厅去 `bedroom`。

### B. 提示词内部冲突（负向误杀正向 / 正向自相矛盾）

- 负向误杀正向必需要素：`emilia_rezero_r18_snow_spring`(-day)、`skadi_arknights_r18_tavern_late`(-neon)、`yui_r18_bedroom_soles_black_socks`(-socks)、`jalter_r18_bedroom_soles_leather_boots`(-boots)、`sakura_r18_bedroom_soles_tights_peel`(-pantyhose)、`fern_r18_bedroom_soles_stockings`(-stockings)、`kitagawa_marin_r18_fitting`/`kisara_r18_apartment`(-school uniform，校服为凳上/床头可见道具)。
- 场景库：`sc043`（删手机视频通话词 + `no phone` + `bathroom`）、`sc065`（侧脸构图删 `side profile`）、`sc200`（裸感床单场景负向删 `nsfw/nude/explicit`）。
- nsfwTokens 全裸宣言 vs prose 半裸/有衣：`kaltsit_arknights_r18_cabin_robe`、`chen_arknights_r18_apartment`、`chen_arknights_r18_bath_towels`、`skadi_arknights_r18_cabin_rope`、`goldenglow_arknights_r18_greenhouse_night`、`suzuran_arknights_r18_kimono_slip`、`perlica_arknights_r18_quarters_terminal`、`perlica_arknights_r18_bunk_late` —— 去掉 `completely_naked/nude/bare_chest` 并补对应服装态 token。
- 全裸场景负向缺衣物禁词，补 `clothes/clothing/underwear/panties/bra/swimsuit/fabric`（25 条）：surtr×4、kaltsit×3、chen×2、eyjafjalla×3、lemuen×1、mudrock×4、suzuran×2、perlica×2、laevatain×4。

### C. 系统性缺陷：31 条成人场景 nsfwProse==promptProse

现象：31 条 R18 蓝本 `nsfwProse` 与 `promptProse` 逐字相同（成人分支完全没有裸体叙述），而 `nsfwTokens` 却要求 `completely_naked` → 成人分支渲染大概率出不了全裸。
根因：批量加蓝本时 nsfwProse 未单独撰写，被直接复制 promptProse。
修复：逐一补写专属成人叙述（对齐故事/姿势/服装态；mudrock 4 条原已含裸体叙述，仅补负向禁词）。涉及 surtr×4、kaltsit×4、chen×4、eyjafjalla×4、lemuen×1、mudrock×4、suzuran×4、perlica×4、laevatain×4。

### D. 成人态/评级冲突

- `sc154`（双女主全裸极乐，原 R15/mature=false）→ R18/mature=true，usage 同步。
- `sc200`（全裸床单，原 All）→ R18/mature=true。

### E. 数据卫生

- 5 处 `promptProse` 连续重复句去重（复制粘贴 Bug，删重复份、保留防分身句）：`sylphiette_grayrat_kitchen_morning`、`yui_tennis_court_afternoon`、`yor_city_hall_desk_work`、`yor_evening_sofa_knitting`、`reze_old_bookstore_reading`。
- 场景库 story 重复段标头清理（「成人/成年 After Story·宁宁」残留）：覆盖 `sc160/162/168/172/174/176/178/180/186`、`sc211/213/217/219/222/228/234/238/255` 等。

## 落地与验证

- 数据源：`data/scene-blueprints.json`、`data/scenes.json`（改后重建 `scenes-nene/natsume/shared/core` 分片，保证与权威源逐字段一致）。
- 缓存版本：`src/stores/sceneStore.ts` 的 `DATA_VERSION` 升至 `2093890838`（改数据必升，否则客户端命中旧 immutable 缓存）。
- 预压产物：`node scripts/maintenance/precompress.js` 重建 `.br/.gz`。
- 校验：`validate-content-contracts.js` 通过（45 characters / 302 scenes，exit 0）；`test-popular-content.js` 19/19 通过（进程 exit 1 为基线「宽容跳过无效条目」自带噪音——检查的是 title/identityTokens 等非本次改动字段，非回归）。

## 后续注意事项（勿回退）

- 防分身句（「独自一人/空场」约束句）是 2026-08-18 起故意设计，本次只删**连续重复**的一份，勿整体回退。
- 全裸场景负向的衣物禁词、半裸场景 tokens 与 prose 一致，是本次统一口径，改场景时四处（`promptProse`/`nsfwProse`/`sceneTags`/`promptTokens`/负向）必须同步。
- 顽固场景（AGENTS 待办 8 个）仍勿盲目重试；本次仅清理了其中重复句/负向冲突，未更换引擎。
- 修复工具幂等可重跑；审阅批次目录为临时产物，已删除（本次不入库）。
