# 2026-08-18 棘手场景交接标注（供他人优化，勿再盲目重试）

> 这 8 个场景的样张连续尝试 7 轮（attempt 1→7，含换 seed / 分身负面 / "她独自一人"约束句 / 正向空场改造）仍无法通过视觉审核（**同款主角分身**是唯一的"不通过"原因）。
> 判定标准（用户 2026-08-18 裁定）：双人一律不通过；镜子按合理性判断；背景路人可接受。
> 交接给更有经验的人优化。图（各 attempt）与 manifest 保留在：
> `E:\code\2\lora\AI\Reviews\ShowcaseRefresh\2026-08-18_v24-popular-fix-rella\`

## 已为全体 90 场景做的根因修复（勿回退，对 82 个已生效）

1. **"她独自一人"约束句**（首批场景 57% 有、今日曾 0%）——已补到全部场景 prose（如 `She is completely alone; the space around her is empty with no other people anywhere.`）。
2. **分身负面**（generate-popular-showcase-anima11.js `soloGuard`/`cloneNegative`）：`(no clone:1.4), no duplicated character, no doppelganger, no second identical girl, multiple instances...`。
3. **正向空场**（`fix-scene-forward-empty-20260818.js`）：下面难做的 7 个场景额外加了 `empty_bookstore / deserted / no customers` 类 tokens + "空无一人" prose（Anima 正向驱动，比负面有效，但仅解出 3 个）。

## 难点诊断：为什么 Anima 反复画"同款第二主角"

Anima 为标签模型，负面遵循弱；prompt 中只含主角一人份描述 → 模型在「有人暗示的社交/开放场景」（书店/花园/办公室/超市/网球场）决定补人时"复用唯一描述"→ 分身。纯负面与空场正向词已尽力，但 Anima 对这几类场景仍是能力边界。建议接手者考虑：**换引擎（WAI-Illustrious 或 ComfyUI 更强的 negative 遵循）/换构图（特写回避场景第二人）/场景改版（把"有人空间"改成"无人私密化"设计）**。

## 棘手清单（最终状态 = 最新 attempt 判定）

| # | 场景 key | 角色 | 场景 | 最新 | 已试轮数 | 失败原因 |
|---|---|---|---|---|---|---|
| 1 | `reze_chainsaw:reze_old_bookstore_reading` | 蕾塞 | 旧书店午后翻杂志 | fail | 7 | 背景同款蕾塞分身 |
| 2 | `saint_cecilia:cecilia_garden_watering_flowers` | 塞西莉亚 | 教堂庭院浇花 | fail | 7 | 左侧同款小人/双人 |
| 3 | `saint_cecilia:cecilia_riverbank_evening_walk` | 塞西莉亚 | 河畔黄昏散步 | review | 7 | 前后景双实体（或 API 空） |
| 4 | `sylphiette:sylphiette_grayrat_kitchen_morning` | 希露菲 | 新婚宅邸厨房晨间 | review | 7 | 背景同款分身（或 API 空） |
| 5 | `yor_forger:yor_city_hall_desk_work` | 约尔 | 市政厅办公 | fail | 7 | 办公室双约尔 |
| 6 | `yor_forger:yor_evening_sofa_knitting` | 约尔 | 夜晚沙发织毛衣 | fail | 7 | 沙发分身 |
| 7 | `yuigahama_yui:yui_tennis_court_afternoon` | 结衣 | 网球训练场挥拍 | fail | 7 | 球场同款小人 |
| 8 | `yuigahama_yui:yui_r18_service_club_desk_afterschool` | 结衣 | 放学后教室 R18 | review | 2 | gemini 反复空响应（尝试算力少，可能仅 API 问题，可优先重审） |

## 其余 82 场景状态（勿动）

- **66 个**最新 attempt 已通过（含约束句修复挽回的 3 个：fern_carriage / byakuya_classroom / byakuya_maid）
- **16 个**判定"旧样张更好"→ 保留线上旧图（skip）

## 接手者工具速查

- 生成：`node scripts/maintenance/generate-popular-showcase-anima11.js --keys <key> --attempt <N> --output <dir>`
- 自动修复闭环（重出+定向负面+自动复审）：`node scripts/maintenance/audit-fix-showcase-loop.js --output <dir> --legacy <旧manifest> --keys <key> --rounds 3`
- 审核：`node scripts/maintenance/audit-showcase-rella.js --manifest <manifest> --out <audit> --legacy <旧manifest> --concurrency 5 --resume`
- 发布/合并：`publish-popular-showcase.js` + `merge-showcase-legacy-popular.js`（**注意 publish 会覆盖 assets/characters/popular-*.png 立绘，发布后需恢复入库立绘**）
- 数据文件：`data/scene-blueprints.json` 中对应 blueprint 的 promptProse/promptTokens/negativeTokens（已含约束句/正向空场）
