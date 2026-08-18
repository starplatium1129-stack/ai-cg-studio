# 2026-08-18 热门角色审视优化留档

> 任务：审视优化 2026-08-18 新入库的 10 位热门角色（角色数据 / 角色档案 / 场景 / 参考标准），达到首批 18 位热门角色的质量基线。
> 状态：数据层完成；样张/参考图重生成留待 GPU 流水线（见「后续待办」）。

## 一、审视结论：新增 10 位 vs 首批 18 位的差距清单

| 层面 | 首批 18 位（基准） | 今日新增 10 位（修复前） |
|---|---|---|
| popular-characters.json `canon` | 全部有（world/era/formNotes/research） | 仅 Alya 有，其余 9 位缺失 |
| `animeStudio` | 全部有（制作公司+官方截图+画风短语） | 仅 Alya 有，其余 9 位缺失 |
| `aliases` | 中英混合完整别名 | 9 位只有中文单别名 |
| `exactTokens` | Danbooru 标准消歧 tag | yor_forger(0帖)/saint_cecilia/fern_(frieren)/sylphiette 等非标准或未消歧 |
| `identityProse` | 166-306 字符、不含服装描述 | mimori 403/cecilia 356 且把服装描述塞进 identity |
| characters.json 档案 | visual_dna 中文全字段 / personality 5 项真实 / likes / classic_cg / identity / tags / palette / weather 全套 | 9 位为模板占位（personality=「原作正统还原/多形态支持/4 视角锁死」，缺 identity/classic_cg/tags/palette/weather） |
| 场景数量 | 10-11 个/角色（6 SFW + 4-5 R18） | 9 位仅 6 个（3 SFW + 3 R18） |
| 场景 `negativeTokens` | 完整数组（质量/畸形/未成年/场景偏差/光影/多人，~180 字符） | 极简字符串 5-8 词（36-81 字符） |
| 场景 `promptTokens` | 纯场景词 | 54 个场景开头塞入整段身份 token（双倍加权） |
| R18 `promptProse`/`nsfwProse` | promptProse 含蓄场景化 + nsfwProse 显式前置 | **nsfwProse 模板污染**（全裸场景写 nightwear、黑贞德王座写 holy veil、温泉写 wet fabric） |
| R18 `kreaStyleHint`/`sampleRating` | 100% 携带（r18_ 配方 + R18 评级） | 9 位全部缺失 |
| `location`/`action` | 具体场景描述 | 「经典场景」「私密室内」模板占位，action 重复标题 |
| 参考标准 identity | 官方设定 | **白夜=深蓝发姬发式（旧）、塞西莉亚=银白双钻卷蓝眼（旧）、菲伦=黑大衣白裙重构+旧 tag**（均与官方冲突） |

## 二、修复内容（全部完成并验证）

### 1. 权威调研产出
新建 `E:\code\2\lora\AI\Research\character-anime\` 10 份调研 JSON（官方设定 + Danbooru tag 结论 + 数据修正建议）：
- 希露菲（萌娘百科确认：1/4 长耳族混血、尖耳个人标志、绿发→白发、红瞳、贫乳）
- 白夜（白发蓝瞳双螺旋角发包、BONES 制作）
- 塞西莉亚（浅绿发绿瞳巨乳低盘发、doga kobo 制作）
- 黑贞德/樱/结衣/约尔/蕾塞/菲伦/Alya（Danbooru API 逐角色确认标准 tag）

### 2. popular-characters.json（9 位）
- 补 canon（world/era/formNotes/research 2026-08-18 调研）
- 补 animeStudio（Studio Bind / feel. / type-moon / WIT×CloverWorks / MAPPA / MADHOUSE / BONES / doga kobo）
- 补英文 aliases（罗马音+作品名）
- exactTokens 按 Danbooru 标准消歧：`yor_forger`→`yor_briar`(11341帖)、`saint_cecilia`→`cecilia_(shiro_seijo_to_kuro_bokushi)`(364帖)、`fern_(frieren)`→`fern_(sousou_no_frieren)`、`sylphiette`→`sylphiette_(mushoku_tensei)`(1705帖)、`jeanne_alter`→`jeanne_d'arc_alter_(fate)`(13703帖)
- identityTokens 补作品 tag（oregairu/fate/stay_night/spy_x_family/mushoku_tensei）
- mimori/cecilia identityProse 精简去服装描述（403→265、356→243 字符）
- 约尔 thorn_princess prose 修「stiletto stilettos」重复词

### 3. characters.json（9 位档案全量重写）
按首批格式：visual_dna 中文全字段（hair/hair_color/eyes/hairstyle/uniform/expression/style/signature）、personality 5 项真实特质、likes、classic_cg（title+description）、identity（role/age/occupation/faction）、tags、palette、weather、alias 罗马音、bg_story 中文；traits 与 popular identityTokens 同步。

### 4. scene-blueprints.json（54 个修复 + 36 个新增 = 437 个）
- **54 个现有场景修复**：promptTokens 剥离身份 token、negativeTokens 按首批模板补齐（质量/畸形/未成年/场景偏差/光影/多人）、location/action/time/lighting/camera/mood 具体化、SFW 移除多余 adultArtistHint
- **27 个 R18 场景**：promptProse 含蓄场景化 + nsfwProse 重写为场景匹配的显式叙述（清除 nightwear/holy veil/wet fabric 模板污染）、补 kreaStyleHint/animaStyleHint（r18_sensual_cg/r18_elegant_boudoir）+ sampleRating('R18')
- **36 个新场景**（9 位 × 3 SFW + 1 R18）：每位达到 10 场景（6 SFW + 4 R18），分类多样化（奇幻/现代校园/现代日常/温馨日常/私密写真），R18 全部室内化
- Alya 祭典场景服装不一致修复（yukata → summer sundress）

### 5. 菲伦双数据漂移统一（重点疑难，见下）
popular 菲伦 outfits 统一为 6 形态（journey_robe/winter_coat/town_casual/noble_ball_dress/inn_morning_nightgown/nsfw_nude），identity 官方化（半扎低侧马尾+齐刘海+长鬓角），场景 outfitId 同步 5 处，参考标准/TS 同步。

### 6. character-reference-standards.json + characterReferenceData.ts
- 10 位 identityTokens 全部对齐 popular（Danbooru 标准 tag）
- 白夜/塞西莉亚 identityProse 清除旧设定残留（深蓝发姬发式→银白发双螺旋角；银白双钻卷蓝眼→薄荷绿发低盘发绿瞳）
- 菲伦参考标准 6 形态
- **修复 12 个参考图 URL 404**（菲伦 journey_robe/winter_coat/town_casual 磁盘文件带前缀，TS URL 无前缀）

### 7. 测试
- test-popular-content.js：场景分布断言更新（401→437、9x6+27x10+7x11 → 36x10+7x11、adult 3:9→4:36）
- test-showcase-candidate-contract.js：画师目录断言 30→37（**顺手修复 e8d708f 遗留的既有漂移**，与本次改动无关但让测试恢复绿色）
- 验证：test-popular-content 19/19 ✓、相关契约测试 26/26 ✓、typecheck ✓、build ✓（budget 通过）

## 三、重点疑难留档（现象→根因→修复→验证）

### 疑难 1：R18 nsfwProse 模板污染
- **现象**：多个 R18 场景的 nsfwProse 与场景矛盾——全裸场景写 "sheer translucent nightwear"、黑贞德王座场景写 "sheer holy veil"（圣女模板）、温泉场景写 "wet fabric"。
- **根因**：批量生成时 nsfwProse 从模板复制错位，未按场景校准。
- **修复**：27 个 R18 场景 nsfwProse 全部重写为场景匹配的显式叙述；promptProse 同步含蓄化（对齐首批「裸体叙述前置在 nsfwProse」的职责分工）。
- **验证**：全库扫描无 nightwear/fabric 残留；`buildPopularPromptPlan` 测试通过。

### 疑难 2：菲伦双数据漂移（今日最贵一课）
- **现象**：参考标准/磁盘资产是重构后的 journey_robe/winter_coat/town_casual（黑大衣+白裙），popular 数据还是旧 mage_white_robe 等（白袍+黑裙），且 **12 个参考图 URL 404**。
- **根因**：1addf85 重构了菲伦参考标准（含参考图重渲染，磁盘文件带前缀），但**未同步 popular-characters.json 与 characterReferenceData.ts**。我最初甚至反向修改（把标准改回 popular 旧 id），靠「查磁盘资产目录」+「image-inspect 看图核实」才发现正确方向。
- **关键教训**：参考图磁盘文件名（带前缀 vs 无前缀）是权威事实；改 outfit id 前必须先查 `assets/character-references/<id>/` 磁盘目录。另外**用 image-inspect 看图核实服装颜色**推翻了「白袍黑裙」的旧设定——菲伦动画实际是「黑大衣+白裙」（重构是对的，popular 旧的才是错的）。
- **修复**：popular 菲伦 6 形态统一 + 场景 outfitId 5 处同步 + 标准/TS 同步 + TS URL 用磁盘实际文件名。
- **验证**：check-ref-urls 940 个 URL 0 缺失；测试全绿。

### 疑难 3：参考标准旧设定残留（白夜/塞西莉亚）
- **现象**：白夜标准 identity 是「深蓝发姬发式」、塞西莉亚是「银白双钻卷蓝眼」——与官方（银白发双螺旋角/薄荷绿发低盘发）完全不符。
- **根因**：1addf85 只重构了 outfits，identityProse/identityTokens 未同步（旧版设定残留），会直接污染 Ref2VA 参考图身份锁定。
- **修复**：identityProse 官方化重写 + identityTokens 对齐 popular。
- **验证**：standards 复核断言通过；TS 同步。

## 四、后续待办（数据层完成后）

1. **样张/参考图重生成（GPU 流水线）**：
   - 白夜/塞西莉亚参考图是按旧设定（深蓝发/银白发双钻卷）渲染的——**必须按官方设定重渲染**（render-all-outfits-references.js + pure-vision-audit.js 闭环）
   - 菲伦 mage_white_robe/winter_travel_coat 旧参考图已闲置（7 目录剩 6 在用），可清理或保留
   - 新增 36 个场景无样张（首批场景有 showcase 样张），需跑样张生成流水线
2. **角色档案检查推广**：本次只审了今日 10 位；方舟 15 位 + 终末地 2 位的 characters.json 档案若也是模板生成，需同样审视（抽样看 surtr 的档案是完整的——见 Research 目录，可能只有今日 9 位是模板，待确认）
3. **希露菲样张核查**：identityTokens 的 elf_ears/pointed_ears 与 AGENTS.md 洛琪希「圆耳」决策的关系——米格路德族实为长耳族（萌娘百科），希露菲 1/4 混血尖耳正确；**洛琪希的「圆耳」记录与官方设定冲突，建议后续单独复核洛琪希数据**（今日不动）。
4. 测试断言里 `sylphiette_(mushoku_tensei)` 等新 exactTokens 未进 test-popular-content 的精确断言（只断言 rem/emilia/kisara），如需防回归可追加。

## 五、验证证据

- `node --test scripts/tests/test-popular-content.js` → 19/19 pass
- `node --test scripts/tests/test-showcase-candidate-contract.js scripts/tests/test-voice-baseline.js scripts/tests/test-gateway-contract.js` → 26/26 pass
- `npm run typecheck:app` → 通过
- `npm run build` → 通过（route bundle budget 通过）
- `node scripts/maintenance/check-ref-urls.js` → 940 URL / 0 缺失
- 调研权威源：萌娘百科（希露菲/白夜/塞西莉亚/菲伦）+ Danbooru API（逐角色 tag）+ image-inspect 参考图实图核实（菲伦服装）

## 六、重生成流水线（2026-08-18 追加）

> 数据层定稿后执行 GPU 流水线：参考图重渲染 + 场景样张生成/审核/发布。状态：已发布 `SceneShowcase/2026-08-18_v24`。

### 1. 参考图重渲染（白夜 / 塞西莉亚，官方设定版）
- 背景：两角色旧参考图按错误设定渲染（白夜深蓝发姬发式 / 塞西莉亚银白双钻卷蓝眼）。
- 脚本：`render-byakuya-cecilia-references-20260818.js`（3 并发，45 张 = 40 首渲 + 15 强化构图约束重渲，0 失败）。
- 产物：`assets/character-references/{mimori_byakuya,saint_cecilia}/` 带前缀文件名，TS URL 同步匹配（check-ref-urls 0 缺失）。
- 审核：pure-vision-audit 25/40 通过，15 个 fail 多为**景别标准过严/误判**（抽查确认身份正确、单人无崩坏），已归档待 fine-tuned-repair 精调，未盲目重渲染。

### 2. 出图提示词增强（分身压制）
- 用户裁定：双人一律不通过、镜子判断合理性、**出图时就要压制分身**（不只靠审核）。
- `generate-popular-showcase-anima11.js`：
  - soloGuard 增加 `(no clone/duplicate/twin:1.4), no duplicated character, no second copy, no doppelganger, no double body, single subject only`
  - negative 追加 `duplicate, clone, copy, doppelganger, twin, two of her, second instance, duplicated subject, multiple girls...`
- 效果：顽固分身场景 attempt-3 中 1 个转 pass（fern_royal_ball）。

### 3. 审核规则增强（audit-showcase-rella.js）
- 并行化（--concurrency 4-6，worker 池，符合 AGENTS.md 批量审核规则）。
- 单/对比提示词区分：**分身/复制体/同款第二主角 → fail；背景路人（异角色/小/远）→ 通过；镜面只认同一主角自然镜像**。
- 新增新旧对比模式（--legacy）：左=新样张，右=线上旧样张；「旧图更好 → skip（保留旧样张，不发布）」。
- 修复：resume 只重审 fail/review + 未审过的（无记录），保留 pass/skip。
- 教训：审核输出 `audit-results.json` 被一次未加 --resume 的全量重审覆盖 + 两个审核进程并发写同一文件互踩——**audit 文件严禁并发写，重审必带 --resume**。

### 4. 场景样张生成与发布
- 生成：90 张（9 位 × 10）+ 23 张 attempt-2 + 12 张 attempt-3 = **125 张，全数生成 0 失败** → `AI/Reviews/ShowcaseRefresh/2026-08-18_v24-popular-fix-rella/`。
- 审核定案（每场景取最新 attempt）：**pass 61 / skip 16（旧样张胜出保留）/ fail 12 + review 1（止损）**。
- 发布：`publish-popular-showcase.js`（61 条新 popular）+ `merge-showcase-legacy-popular.js`（合并旧 363 条目 + 726 资产）→ **新版本 747 条目（popular 424 / scene 302 / artist 13 / lora 8），0 缺失资产，去重通过**。
- 9 位新角色样张覆盖：黑贞德/樱 10/10 全，希露菲/结衣/菲伦/蕾塞/白夜 8-9/10，约尔/塞西莉亚 7/10。
- 约尔立绘回滚：publish 选立绘时其 SFW 全 skip/fail 导致 fallback 成 R18 图，已从 git HEAD 恢复今天入库的正确立绘。

### 5. 顽固分身场景止损清单（12 个，audit 保持 fail，showcase 无样张）
> 连续 3 次重出（attempt 1/2/3）+ 出图提示词分身压制仍出同款第二主角。按 AGENTS.md 止损纪律不再烧 GPU，留待**换构图/换引擎（Anima→Krea）**再战。场景绘图功能不受影响，仅 showcase 无预览样张。

| 场景 | 角色 | 现象 |
|---|---|---|
| sylphiette_grayrat_kitchen_morning | 希露菲 | 厨房背景同款分身 |
| yui_tennis_court_afternoon | 结衣 | 网球场背景同款小人 |
| yor_city_hall_desk_work | 约尔 | 办公室双约尔 |
| yor_evening_sofa_knitting | 约尔 | 沙发分身 |
| yor_supermarket_shopping | 约尔 | 超市双约尔 |
| reze_old_bookstore_reading | 蕾塞 | 书架旁同款第二人 |
| fern_carriage_stop_snow | 菲伦 | 黑白双菲伦 |
| byakuya_maid_cafe_shift | 白夜 | 女仆咖啡 Q 版分身 |
| byakuya_classroom_nap_afternoon | 白夜 | 趴桌午睡画成端坐（动作不符） |
| cecilia_bakery_scone_lesson | 塞西莉亚 | Q 版分身 |
| cecilia_garden_watering_flowers | 塞西莉亚 | 浇花双人 |
| cecilia_riverbank_evening_walk | 塞西莉亚 | 前后景双实体 |
| yui_r18_service_club_desk_afterschool | 结衣 | vision 反复空响应 + 分身 |

### 6. 遗留与建议
- CLIProxyAPI gemini OAuth 曾故障（oauth2.googleapis.com token EOF，代理端口更换后恢复）——期间审核阻塞约 40 分钟；此类依赖故障建议固定代理配置。
- 8 个顽固分身场景已**交接他人优化**（详见 `docs/showcase-stubborn-scenes-2026-08-18.md`，含 7 轮已试措施与数据现状，勿再盲目重试）。
- 新增时序注意：本次曾踩「两个审核进程并发写 audit-results.json」——任何审核任务必须串行或隔离文件。
- **publish-popular-showcase.js 会覆盖 `assets/characters/popular-*.png` 角色立绘**（--portraits-out 副作用）——本次发布把 9 位新角色入库立绘覆盖为样张图，已从 git HEAD 全部恢复；未来发布后必须恢复立绘或改发布参数。

### 7. 最终发布状态（2026-08-18 收尾）
- `SceneShowcase/2026-08-18_v24`：**752 条**（popular **429** / scene 302 / artist 13 / lora 8），去重通过、0 缺失资产。
- 90 场景定案：**pass 66 + skip 16（保留旧样张）+ 2 个旧场景旧样张在案**；**8 个难做场景标注交接他人**（`docs/showcase-stubborn-scenes-2026-08-18.md`，含 7 轮已试措施与数据现状）。
- 9 位新角色样张覆盖：黑贞德/间桐樱/菲伦/深森白夜 10/10 全；希露菲/结衣/蕾塞 9/10；约尔/塞西莉亚 8/10（缺=难做场景止损）。
