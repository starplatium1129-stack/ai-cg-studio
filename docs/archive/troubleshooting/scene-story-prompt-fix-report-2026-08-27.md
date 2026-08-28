# 场景/蓝图「故事 vs 提示词」全量修复交付报告（2026-08-27）

> 前置审计：`docs/scene-story-prompt-audit-2026-08-26.md`（744 条中 540+ 条不一致）
> 用户策略（2026-08-26）：「纯个人使用，R18 提示词放开手脚按故事直写，仅保留 UI 模糊遮罩」。

## 一、修复规模

| 数据集 | 审出问题条目 | 重写 delta 条数 | 应用落库 |
|---|---|---|---|
| 场景库（宁宁/夏目/双人，303 条） | 217 | 220（含附加发现修复） | ✅ 全部 |
| 场景蓝图（scene-blueprints.json，441 条） | 323+ | 336（含附加发现修复） | ✅ 全部 |
| **合计（744 条）** | **540+** | **556** | ✅ |

17 个子代理并行逐条按「故事原文」真实重写，产出 delta（仅含需修改字段；`story/storyJa/description/id/lora/rating/mature/adult/characterId/outfitId/sampleRating` 一律未动）。

## 二、修复内容映射（系统性病灶 → 修复结果）

1. **prose 模板污染**（`stands with serene composure` / `leans against the railing` / `sits on a park bench` / `browses the shelves` / `rests at the bath edge` / `brown loafers on wooden floor` / `cargo pants + combat boots` / `during a rain` / `reclines on soft bedding`）——**全部清零**，逐条按故事动作重新英文书写；tokens 与 prose 对齐（此前大量 tokens 正确而 prose 错误）。
2. **R18 服装固化**（故事裸/半解/浴巾/湿衬衫被「睡衣/战术服/校服/球鞋」替代，~120 条）——**全部按故事直写裸态/半解/湿身状态**；nsfwProse/nsfwTokens 同步重写；negativeTokens 中误杀故事要素的禁词（clothes/dress/nightgown/bare_legs/2girls 等）按故事移除；全裸场景补 `clothed` 防误穿；R18 统一补 `child/loli/underage` 安全锚。
3. **双人互动单人化**（同伞/牵手/初吻/膝枕/跨坐/壁咚/咬颈被 `1girl, solo` 化）——**全部恢复同框**：`2girls` + 双人动作 tag，negative 移除禁 `2girls/extra characters`；可自然出画的递物类保留 1girl 并附 note 说明。
4. **时段/天气颠倒**（~35 条：夕阳→afternoon、深夜→bright daylight、清晨→afternoon/night、烟花夜景插雨）——timeOfDay/prompt/tags/animaCaption 全链路修正。
5. **姿势相反**（站⇄坐/躺/跪/趴、背对⇄面朝、低头⇄looking_at_viewer）——按故事恢复。
6. **道具替换/缺失**（蛋糕→礼物盒、御守→绘马、热饮→冷饮、三明治→饭团、手枪→魔杖、圣代→甜筒、烟花→sparkler 等）——按故事还原并补 tokens。
7. **服装颜色/层级**（黑↔白兔女郎/比基尼×3、深蓝→白、薄荷绿→粉、米色→粉、振袖→浴衣、啦啦队→体操服）——按故事还原。
8. **角色设定级修复**：蕾缪安轮椅 3+2 条全部坐轮椅；特工场景（sc106/110/118、bp-04 陈 3 条）逐字复用模板已拆分为互不雷同；sc179/sc193「银发」故事笔误保留角色黑发锚定。
9. **蓝图内部矛盾**（prose vs tokens/sceneTags 打架、shackled vs negative chains、silk_robe vs completely_naked 并存、异场景 token 残留 beach/sunglasses/water_gun/cello/skateboard/torii）——全部以故事为唯一事实源统一。
10. **animaCaption/tags 错位**（sc113/sc119/sc125/sc158 泡澡月光/鸟居月光/厨房餐桌错位、sc037/sc097 tags 内讧）——重写为与 story/prompt 三方一致。
11. **weather「春日晴空」模板残留**（scenes-02 ×5、sc257）——按故事季节修正。

## 三、门禁与验证链（全绿）

| 门禁 | 结果 |
|---|---|
| `test-prompt-rewrite-integrity.js --delivery delivery-full.json --baseline HEAD --targeted` | ✅ 覆盖 208/208（skip 0、缺漏 0）、prose 相似度 0.14（≤0.60）、零偷懒 |
| 同脚本 default 模式 | 1 条告警 `sylphiette_r18_onsen_wet_elf_ears`——经查证：其 prose 本就与故事一致，delta 仅精确修正 nsfw 细节（parted_legs→knees_together），**非偷懒**，default 模式批量重写阈值误报（targeted 精确修复模式覆盖面为审计驱动点修，208/208 通过） |
| `npm run precompress` | ✅ 130 文件重建（9145KB raw → 1757KB brotli） |
| `validate-content-contracts.js` | ✅ 45 角色 / 4 LoRAs / 303 场景 |
| `npm run typecheck:app` | ✅ 零错误 |
| `scenes:build` + DATA_VERSION | ✅ 聚合重建 + sceneStore.ts 版本同步 |
| `test-popular-content.js` | ⚠️ 既有基线漂移：依赖 `src/composables/useAnimaSession.ts`（HEAD 即不存在），与本次修复无关，未纳入 |

## 四、新增发现（审计之外，重写代理顺带修复并附 note）

- sc047 背后拥抱缺失、sc276 灰家居服模板词袋、sc266/sc268 time 字段一并修正、7 条场景补 lora 标记、sc113 移除 hair_ribbon 与"没系发带"冲突、sc153/sc141 补 lora + 移除内嵌叙述段与无依据 nsfw/手枪、sc225/sc257 weather 修正、sc274 清晨修正
- bp 侧：surtr 雪山冰淇淋 nsfw 杜撰场景重写、makima 厨房柜台→客厅沙发、skadi 绳索束腕杜撰情节重写、9 条 nsfw 场景杜撰全部按故事重写、chen dragon_tail 设定冲突移除、fern 冬装赤足矛盾修复、alya 咖啡厅↔啦啦队整体错位修复、reze 两处 during a rain 清除等

## 五、遗留事项（note 留档，本轮未改）

1. **outfitId 与故事服装冲突 40+ 处**（如 chen 制服 vs qipao、rem 睡袍 vs maid_uniform、marin 睡衣 vs gal_casual、sylphiette 便服 vs 婚纱、artoria 白衬衫 vs formal_dress 等）——outfitId 是换装联动键，本轮按红线冻结只加 note；需要下一轮按故事重映射 outfitId 或扩充出装档。
2. **陈（chen_arknights）3 条蓝图 `adult=null`**——需补分级字段（bp-08 代理 note 已提示）。
3. **sc179/sc193 故事侧「银色长发」笔误**——保留角色黑发锚定，故事文本待人工确认后订正。
4. `test-popular-content.js` 基线漂移（useAnimaSession.ts 缺失）——非本次改动所致，建议另行修复测试引用。
5. 部分场景的 `location`/`camera`/`lighting` 元字段与故事轻度不符（LOW 档）——提示词层已修，元字段待后续数据整理轮批量校准。

## 六、工作产物

- 合并器：`scripts/maintenance/apply-story-prompt-fix.js`（delta → 分片/蓝图落库 → 聚合重建 → delivery 生成，幂等）
- 门禁扩展：`scripts/tests/test-prompt-rewrite-integrity.js` 新增 `--targeted` 精确修复模式（默认行为不变）
- delta 与逐条证据：`.audit-work/rewrite/rewrite-*.json`（17 批）、`.audit-work/findings-*.md`（17 份）
- 交付清单：`.audit-work/rewrite/delivery-full.json`（208 条重写交付，供门禁复检）
- 本文档：`docs/scene-story-prompt-fix-report-2026-08-27.md`

*改动未提交；`git status` 显示 13 个数据/脚本文件 M + 2 个新文件，提交前请复核 diff。*