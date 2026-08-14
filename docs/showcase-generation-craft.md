# Showcase 出图实战经验（2026-08-12 ~ 2026-08-13）

> **状态基线**：2026-08-13。本文记录这两天从"批量生成 298 场景 + 774 热门 + 26 画师"到"逐场景手工修复"过程中踩出来的全部经验。
> 这是**实测结论**，部分推翻了 `model-prompting-and-parameters-guide.md` 的基线建议（见 §4），以本文为准。
> 配套工具：`scripts/maintenance/scene-fix.js`（单场景手工链路）、`short-prompt-builder.js`、`sc300-repro-verify.js`。

---

## 1. 总纲：出图率优先，不靠 seed 抽奖

- **sc300 是手工产物**：手工写的 24 词 prompt + 手工试出来的 seed（20260809）。批量"模板 prompt + 自动 seed 一次出图"永远达不到它的水准——这不是参数问题，是**没有做手工调优**。
- **好 prompt 的出图率**：sc001 极简版（22 词）3 个 seed 3 张全达标（87/91/96）；V20B 配方 sc006 3 seed 全 ≥90（90/94.5/96）。**合格标准 = 出 3 张至少 3 张都好**，而不是 20 个 seed 里挑 1 张。
- **20 seed 挑优是错误路线**：1/20 的通过率本质是抽奖。seed 只解决"同一好 prompt 的微小方差"，解决不了 prompt 本身的信息问题。
- **审核锚定**：先看 sc300 参考图（`AI/ComfyUI/output/anima_app_00048_.png`，93+ 分标杆）建立标准，再逐张 5 维打分（光影通透 / 背景实体 / 角色服装发型细节 / 氛围 / 完成度，每维 0-20）。vision 审核会虚高或过严漂移，**用户亲审是最终标准**。

## 2. Prompt 结构：sc300 同构极简（22~26 词）

sc300 原 prompt：
```
ayachi_nene, 1girl, solo, nene_witch_canonical, witch_hat, black_cape,
criss-cross_halter, crop_top, white_hair, very_long_hair, low_twintails,
purple_eyes, pink_hair_ribbons, ahoge, nene_r18, cafe, warm_lighting,
masterpiece, best_quality, score_7
```

**结构 = 角色锚点(9) + 服装(1~4) + 场景词(2~3) + 动作/情绪(1~2) + r18 token + 质量词(3)**。

- **角色锚点必须完整**：全部 LoRA exact_tokens（`ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons`）。漏一个就漂（sc005 缺 `no_hair_ribbon` + 伪词 `natsume_yukata` → 发色瞳色全崩；canonical 服装词只存在 LoRA contract 里的才用）。
- **信息过载 = 背景糊**：sc001 手写版塞 4 实体词 + 3 光词 + 4 动作词（28 词）→ 背景糊、3/5 seed 硬伤；22 词极简版 → 3/3 清晰。模型不知道该渲染什么时就会糊。
- **服装细节词 = 画面"贵感"**：attempt-5（96 分）比极简版强在服装细节密度（`blazer, yellow bowtie, plaid skirt, black thighhighs, zettai ryouiki`）。服装细节是信息密度，场景实体词是背景糊的来源——**服装细节多给，场景实体词克制（2~4 个）**。
- **类别配额**：场景词按类别限量（情绪 ≤1、动作 ≤1、地点 ≤2、天气 ≤1、道具 ≤1），否则表情词（blush/shy/smile）会挤掉地点词（sc021 教训：纯白底立绘，卧室词全丢）。
- **画师/画风词必须用 Anima @ 格式**：`@muririn, @kobuichi`（前导 @ + 空格分隔）。裸词 `yuzusoft` 无效。柚子社画师 tag 实测有效（画面出现赛璐璐+明亮质感）。见 `src/config/artistStyles.ts` 的 `artistTagsForEngine`。
- **prose 段（换行后自然语言）**：复杂场景加 1 句英文 direction（空间/动作/道具/光照），attempt-5 模式（发型细节、姿态、构图）在教室等复杂场景有效；简单场景可省。**画风不要写进 prose**（标签管画风，prose 重复干扰）。

## 3. 光照：通透感与壁纸适合度

- **氛围词组**（每种光线决策给一组，不是 1 个词）：`backlight, rim_light, volumetric_lighting, deep_depth_of_field`（黄金/逆光时加 `golden_hour, warm_lighting`；月光加 `moonlight, night, cool_lighting`）。实现在 `src/utils/popularContent.ts` 的 `AMBIENCE_TOKENS`。
- **壁纸适合度**：明亮通透（中高调）、主体突出、背景有实体层次、不压抑。**夜景死黑 + 强对比 = 不合格壁纸**（sc016 篝火第一版 65-72 分）；月光漫射 + 环境柔光修复后合格（"silver moonlight washing over the trees, the whole scene glowing softly with ambient light"）。
- **光照推断坑**：`sceneTags` 里的 `night` 会抢掉 `candlelight` 的匹配（烛光卧室被推断成月光）→ `LIGHTING_TO_ID` 加 `candle/candlelight/lamp → lantern`，长 key 优先匹配。

## 4. 参数与 LoRA：V20B + 30 步/CFG 4.5

- **V20B（scientific_b）比 V20 原版强**：所有用户认可的高分既有图（sc001 attempt-5 96、sc002 attempt-7 95、sc003 attempt-1 93、sc007 attempt-7 92）全是 `L_NENE_V20B_ANIMA @0.82-0.85`。同参数同 prompt 下 V20B 明显好于 V20（sc006：V20 83 分 vs V20B 92-96 分）。之前的"V20B 3/3 全败"盲测结论被实图推翻。
- **30 步 / CFG 4.5 组合 > 24 步 / CFG 3.0**：sc006 同 prompt 同 LoRA：24/3.0 = 92 分，30/4.5 = 96 分。
- **服务端默认参数 ≠ 手工出图参数**：`routes/anima.js` 的 MODELS 默认是服务端契约（24/3.0/res_multistep，有测试锁定）；scene-fix 手工链路显式传 `--steps 30 --cfg 4.5`。`/api/anima/jobs` 不接受 sampler/scheduler 覆盖（白名单外），只传 steps/cfg。
- **V20B 通道**：网关 `CHARACTERS` 强制 character↔LoRA 绑定，V20B 需要独立绑定 `nene_b`（`--character nene_b`）。
- **er_sde/sgm_uniform vs res_multistep/simple**：未做严格对照；30 步 + res_multistep（服务端默认）已验证出 96 分，不纠结 sampler。

## 5. NSFW / R18 实战

- **Krea2 有 NSFW 审查**：无论 prompt/lead 怎么强化（explicit lead、裸体 prose、衣服落地引导），9/9 全部输出穿好衣服的 SFW。**R18 只能走 Anima**。
- **Anima 裸体词强化**：重复 + 具体词：`nude, nude, completely_naked, fully_nude, no_clothes, naked_body, bare_chest, exposed_breasts, nipples, pussy, spread_legs`。单 `nude` 不够（出穿着和服）。
- **校服角色顽固**：`kisara` 的校服先验极强——负面压制服词（`school uniform, sailor collar, grey jacket`）后短词直接解决（23.2 分）。
- **多格分屏是系统性的**：`raiden_shogun:candlelight_evening:anima` 4 个不同 seed 全部多格 → 换 prompt 或弃用该 key 的 anima 版（krea2 版定稿）。负向加 `split image, multiple panels, comic strip, multiple girls, second person`（`src/utils/popularContent.ts` 已加）。
- **r18 token 提升渲染质感**：`nene_r18 / natsume_r18` 显著提升皮肤泛光、发丝逆光通透、暗部暖反弹光（93 vs 89），且内容安全（日常场景出穿衣图）。**全场景注入**（不只 R18 场景）。
- **蓝图级 NSFW**：成人蓝图的 `nsfwTokens`（标签流）+ `nsfwProse`（Krea/Anima caption）fail-closed 注入，非 adult 角色绝不进 prompt。

## 6. 修复流程（逐场景手工链路）

1. 从现有 attempt 系列图里挑最优（每场景 2-4 个版本），vision 审核 ≥90 直接定稿（用户认可的 attempt-5/7 优先）。
2. <90 的场景用 `scene-fix.js` 修复：手写 prompt（§2 结构）+ 3 seed + 挑优 + 迭代（每次改 prompt 后清空旧图重出）。
3. 用户挑图/提意见 → 针对修改（构图/相机位置/背景/画风）→ 重出 → 直到满意。
4. 定稿记录：`AI/Reviews/SceneFix/<sceneId>/prompt.txt` 保存最终 prompt。

## 7. 已定稿案例（含 prompt 参考）

| 场景 | 定稿 | 配方 | 关键 prompt 词 |
|---|---|---|---|
| sc001 | attempt-5 | V20B@0.82 + 30/4.5 | 长流 + prose（校服细节 + 蓝天白云 + 回眸） |
| sc002 | attempt-7 | V20B + 30/4.5 | 樱花树框形构图 |
| sc003 | attempt-1 | V20B + 30/4.5 | 长流 |
| sc006 | 修复版 96 分 | V20B + 30/4.5 | 圣诞雪夜 + 礼物 + 牛角扣大衣细节 |
| sc007 | attempt-7 | V20B + 30/4.5 | 长流 |
| sc013 | 修复版 | V20B + 30/4.5 | attempt-10 prompt + V20B |
| sc014 | 修复版第 3 seed | V20B + 30/4.5 | 同上 |
| sc016 | 迭代中 | V20B + 30/4.5 | 篝火 + 满月月光漫射 + `@muririn, @kobuichi` + 相机挂脖不挡脸 |

## 8. 踩坑速查

- `natsume_yukata` 等不在 LoRA contract 的 canonical 词 = 伪词，会崩角色 → 只用 `loras.json` 的 exact_tokens。
- 画师词不带 `@` = 无效。
- 表情词会挤掉地点词 → 类别配额。
- 烛光场景被 `night` 推断成月光 → LIGHTING_TO_ID 修复。
- 相机挡脸 → `camera_on_neck, camera_strap` + prose 明确位置。
- 夜景做壁纸 → 必加月光/环境漫射，避免死黑。
- `/api/anima/jobs` 不接受 sampler/scheduler → 只传 steps/cfg。
- V20B 需要 `nene_b` 绑定，直接传 V20B + character=nene 报 INCOMPATIBLE_CHARACTER。
- 工作区图片生成物及时清理（两天生成了 2000+ 张，最终保留的不足 200 张）。

---

## 9. 2026-08-14 全场景替换（anima-aesthetic-v1.1 + 原有提示词 + @rella）实测结论

> 本轮把 `data/scenes.json` 全部 298 个场景用「原有 `prompt` 字段（去 `<lora:>` 后 Anima 格式化）+ 统一 `anima-aesthetic-v1.1` 底模（单人挂 v21 LoRA，triad 走 no-LoRA 模式）+ 句尾追加 `@rella`」重出，审核后发布为 `AI/SceneShowcase/2026-08-14_v16`（v15 保留为备份）。
> 配套工具：`scripts/maintenance/generate-scene-showcase-anima11.js`（批量出图）、`audit-scene-showcase-run.js`（批量审核编排）、`build-scene-manual-review.js`（审核决策→manual-review）、`publish-scene-showcase-anima11.js`（原子替换发布）。

### 9.1 提示词结论（用户决策口径）

- **原有提示词直出可行**：长标签流 + `@rella` 句尾（画师 tag 必须在 Anima `@` 格式，见 §2），身份还原稳定。
- **单人场景出双人是最大系统性缺陷**：互动叙事（拥抱/对视/亲密）的 solo 场景，Anima 低 CFG 下会自动补画男主或第二女性。修复=提示词注入 `(single girl only:1.4), (one person only:1.4), no second person, no other person, no bystanders`（1.4 不够时 1.6~2.0 + 负面加 `male, man, boy, couple, two people`），13 张全部修复（最顽固 3 张在权重 2.0 轮通过）。
- **sc052 例外**：其原有提示词本身就写了「Nene and one partial dark-haired male…」双人构图，属于原有提示词内容，不是缺陷。
- **手部硬伤与乱码文字**是剩余顽固项：约 115/298 首轮因手部崩坏判失败，30 步/CFG 4.5 后降为 44，5 轮后剩 5 张（sc102/sc114/sc240/sc265/sc266）由用户终审接受最佳尝试。
- **不要为个别场景单设参数**（用户明确意见）：修复一律走提示词优化 + 统一 30/4.5，hires 不作为常规手段（本轮仅 1 张冒烟验证，未入批）。

### 9.2 评判标准（本轮口径，用户提出下次重新设计）

- 视觉初审：`image-inspect.js -t audit`（gemini-3.7-flash-high 八维）逐张独立；
- 硬伤分类只判四类：① 肢体/手部严重级崩坏（明显崩坏/畸变/缺指/多指/塌陷/穿模/断裂/融化）；② 乱码文字；③ 单人场景出第二人；④ 脸部畸变；轻微/稍显/交代不清一律通过；
- 人工终审逐条复核摘要，机器误判双向纠正（本轮约 20+ 张）；
- 教训：关键词分类器第一版过严（154 张失败），用户目检校准后同批图片实际合格率约 85%+ → **下次先让用户抽样目检定调，再批量执行**。

### 9.3 流程踩坑

- **生成脚本并发写同一 manifest 会互相覆盖**：两个 `generate-scene-showcase-anima11.js` 同时跑时，后结束者用自己启动时的快照整体写回，把另一进程新写入的记录抹掉（本轮 sc287@attempt-3 记录丢失即此因）。**生成任务必须串行**。
- 429 `ANIMA_QUEUE_FULL`：`/api/anima/jobs` 服务端 MAX_PENDING=4，两个生成脚本并发（3+2）必撞队列；串行 + 单脚本 concurrency≤3 安全。
- 同 recordId 失败记录重跑会自动重试（`previous.status !== 'succeeded'`），断点续跑安全。
- 发布原子切换：`publish-scene-showcase-anima11.js` 复制源目录→替换全部场景 images/thumbs→清理不在 data 的旧 sc 文件→刷新 home 主视觉与 `home-hero.json`→verifyTarget→rename 切换（旧目录先改名备份，成功后删）。
- 网关在启动时解析 `SCENE_SHOWCASE_DIR`，**发布后必须重启网关**才生效；重启用 `runtime/state/gateway_token` 作 TOKEN 环境变量（AGENTS.md 契约），端口 3000 进程先杀。
- 本轮产物：`AI/Reviews/SceneShowcaseRefresh/2026-08-14_v16-anima11-rella/`（generation-manifest.json 526 条记录、audit-results.json、decisions.json、manual-review.json、run-*.log）。

### 9.4 全局默认参数变更（2026-08-14 用户决策：第二轮参数转正）

- **Anima 全局默认出图参数由 24 步 / CFG 3.0 改为 30 步 / CFG 4.5**（第二轮样张验证更稳：同 prompt 下 24/3.0=92 分 vs 30/4.5=96 分，硬伤失败率一轮从 154 张降到 44 张）。
- 改动落点：`server/anima-generation-contract.js` 的 `ANIMA_DEFAULTS`（`routes/anima.js` 两个 anima 模型默认值引用它）、`data/presets.json` 的 `anima_base_v10`/`anima_aesthetic_v11` profile、`src/composables/useAnimaSession.ts` 会话默认、`scripts/maintenance/inpaint-scene-candidates.js` 修复配置；同步更新 `test-anima-routes.js`/`test-anima-session.js`/`test-popular-content.js`/`test-quality-prompt-contract.js`/`test-prompt-compiler.js`/`test-inpaint-scene-candidates.js` 断言。
- 双人场景允许单独设置参数/其他手段（本轮双人修复用的 CFG 5.5/6.0 + 单人强化词即属此类）；API 的 steps/cfg 覆盖与提示词强化机制保持不变。
- 样张 `2026-08-14_v16` 大部分已是 30/4.5 产物；少量 best 尝试用了 5.5/6.0（双人场景属合法单独参数；sc107/sc083/sc125/sc140/sc225/sc028/sc032/sc084 为非默认参数，是否重出由用户决定）。
- 已知遗留：`regress-anima-prompt-tags.js` 仍提交已迁移的 `L_NENE_V20_ANIMA`，会报 UNKNOWN_LORA（与参数变更无关，未顺手改动）。

### 9.5 审核标准最终裁定（2026-08-14 用户定稿，下次执行以此为准）

- **总体标准：整体观感达到「壁纸级」即可通过**，不逐张死磕局部瑕疵。
- **AI 绘图有小瑕疵是正常的**（手部细节、背景简化、轻微伪影等），除非是明显影响整体观感的硬伤，否则接受。
- **必须修的只有一类：单人场景出现双人**（提示词层面修复，见 §9.1）。
- 修复手段只允许两类：**提示词优化** 或 **参数调整**；不做无上限的多轮重试（本轮教训：首轮 154 张"失败"中，按用户目检口径实际绝大多数可用，只有双人问题需要修；5 轮重生成属于过度投入）。
- 机器审核（image-inspect 八维）只作**初筛参考**，最终以用户目检抽样 + 壁纸级整体观感为准；初次批量前先让用户抽样定调。
