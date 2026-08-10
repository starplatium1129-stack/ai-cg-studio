# 四季夏目 Anima v19 科学训练结果

日期：2026-08-09

## 结论

**最终拒绝晋级，阻断生产集成。** 六类人工审核和外部代理 A/B 结论已写入真实 `manual-audit.json`。E08 虽为首选，但 ordinary fullbody 修正后 fullbody+identity 仅 2/3，且 W/T/L 为 1W/0T/2L，硬门槛失败。没有复制生产 LoRA，现生产 v18 保持不变。

## 数据与 SHA

- 源 manifest：45 张；源 manifest SHA-256 `e98fcf5ff39e86f506369b493511127903576784ad37f7e0f21e673045993370`。
- 派生 visual groups：37；训练 32 组/39 张，holdout 5 组/6 张。
- Holdout：`official_5013`、`official_5014`、`official_5018`、`stand_v12_02`、`cg_v12_04`。
- 训练快照 manifest SHA-256 `18156f50e91fc0b18d927f425a8b792a1f2751a5baf06f6089d9ee1f15fd3a35`。
- 安全分类：safe 14、sensitive 14、nsfw 11、explicit 6；训练 safe 24/R18 15，验证 safe 4/R18 2。
- 配置 SHA-256 `9e9b995b7839d263d9b5e746053bf36254d6ae61c0b610ef35f27665327e668e`。

## 训练

- OneTrainer Anima Base v1.0，Transformer LoRA only，rank/alpha 32/32，constant LR `2e-5`，BF16 train，FP32 LoRA weights。
- 16/16 epochs，39 optimizer steps/epoch，624 steps，总时长约 38 分 32 秒。
- 保存点：E02/E04/E06/E08/E10/E12/E14；最终输出另存为 `shiki_natsume_v19_anima_scientific_a.safetensors`。
- TensorBoard validation：

| Epoch | Step | Safe | R18 | Total |
|---:|---:|---:|---:|---:|
| 0 | 0 | 0.046833355 | 0.056238856 | 0.049968522 |
| 6 | 234 | 0.044883296 | 0.053784981 | 0.047850527 |
| 8 | 312 | 0.044688586 | 0.053720057 | 0.047699075 |
| 10 | 390 | 0.044339631 | 0.053299624 | 0.047326297 |
| 12 | 468 | 0.044261999 | 0.053327795 | 0.047283929 |
| 14 | 546 | 0.044301372 | 0.053261802 | 0.047288183 |
| 16 | 585 | 0.044112444 | 0.053169873 | **0.047131587** |

低谷在 E16；没有连续两次验证上升，因此按合同跑满 16。重点产品候选为 E06/E08/E10/E12，低谷邻近保存点为 E14；E16 仅为最终输出，不因 final 自动选中。

## 产品矩阵

- 证据根：`E:/code/2/lora/AI/Reviews/AnimaNatsumeV19ProductMatrix/2026-08-09`。
- 六类场景×三 seeds：身份近景、普通全身、咖啡制服、官方旗袍、复杂低光、R18 全身。
- 真实生成：WAI v18 18 张；Anima base-only 18 张；E06/E08/E10/E12/E14 各 18 张；总计 126/126，manifest 记录 prompt、seed、模型/LoRA、字节数和 SHA-256。
- 候选 checkpoint：E06 step 234、E08 step 312、E10 step 390、E12 step 468、E14 step 546。
- 机器指标：`metrics.json` 已记录 TensorBoard 曲线和三 seed 的 pixel/edge/average-hash diversity；机器指标不能替代人工身份与安全审核。

## 人工审核结果

用户提供的六类逐场景审核已记录到：`E:/code/2/lora/AI/Reviews/AnimaNatsumeV19ProductMatrix/2026-08-09/manual-audit.json`。

- `identity_closeup`：候选均 3W/0T/0L，E06 最自然。
- `ordinary_fullbody`：E06 1W/0T/2L；E08 0W/1T/2L；E10/E12/E14 各 1W/0T/2L。候选和 base-only 仅 1/3 真全身，WAI v18 为 3/3，硬门槛失败。
- `cafe_uniform`：所有候选 3W/0T/0L，E14 最佳，0 泄漏。
- `official_qipao`：E06/E10/E12/E14 各 2W/0T/1L；E08 1W/1T/1L；共同失败 seed 为 20260810。
- `complex_lowlight`：E06 0W/3T/0L；E08 3W/0T/0L；E10 0W/3T/0L；E12 1W/0T/2L；E14 0W/0T/3L。
- `r18_fullbody`：E06 2W/1T/0L；E08/E10/E12 3W/0T/0L；E14 1W/1T/1L。E08/E10/E12 为 3/3 fullbody。
- 总计：E06 11W/4T/3L；E08 13W/2T/3L；E10 12W/3T/3L；E12 13W/0T/5L；E14 10W/1T/7L。
- 五类安全场景成人泄漏 0、额外人物 0、Nene 特征泄漏 0；R18 仅请求时激活。

E08 是唯一满足总胜负门槛的候选，但 ordinary fullbody 门槛失败，不能晋级。

## 一次普通全身 A/B

- A/B manifest：`E:/code/2/lora/AI/Reviews/AnimaNatsumeV19OrdinaryFullbodyAB/2026-08-10/manifest.json`
- 接触表：`E:/code/2/lora/AI/Reviews/AnimaNatsumeV19OrdinaryFullbodyAB/2026-08-10/contact-sheet.jpg`
- 固定：E08 step 312、三个原 seed、1216×832、24 steps、CFG 3、`res_multistep/simple`、LoRA 0.85、原负面完全不变。
- 唯一变化：正向追加 `full body, head to toe, feet visible, standing, long shot, camera pulled back, centered composition`。
- A/B 共 9 张：WAI 3、E08 baseline 3、E08 corrected 3；未再训练。
- 该构图修正仅保留在审计脚本和证据中，未进入应用 Prompt assembly；失败策略已撤回。
- corrected seed 20260809：全身/肢体/安全通过，但泪痣缺失，较 WAI 为 LOSS，seed FAIL。
- corrected seed 20260810：全身和身份通过，但面部背光过曝，较 WAI 为 LOSS，seed PASS。
- corrected seed 20260811：全身和身份通过，较 WAI 为 WIN，seed PASS。
- A/B 最终：fullbody+identity 2/3，W/T/L `1W/0T/2L`，普通全身硬门槛失败。

## 生产状态

- 未生成 `AI/ComfyUI/models/loras/shiki_natsume_v19_anima.safetensors`。
- 未生成生产 SHA；`L_NAT_V18_WD14 / shiki_natsume_v18_wd14` 未被覆盖，继续作为现生产和回滚依据。
- 晋级脚本会拒绝缺少明确 `manual-audit.json` 或不满足所有门槛的候选。

## 风险与后续阻塞

- `promote-anima-natsume-v19-checkpoint.js` 因 `manual-audit.json.decision=rejected` 拒绝执行。
- 不允许集成、不允许新增双 LoRA、不允许改变 nene 或 triad/shared 链路。
