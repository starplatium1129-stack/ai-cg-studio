# Anima 训练与晋级记录

> 当前汇总：2026-08-10
> 本文保留已完成实验的可审计结论，不把实验结果改写成稳定发布承诺。复现参数见 `anima-reproduction-protocol.md`。

## 宁宁 v19 checkpoint 审核

原 v19 训练使用 55 张图、25 个视觉组、rank/alpha 16/16、LR `1e-4`、batch 1、45 epochs；只记录了 training loss，没有真实 validation curve。最终 epoch 45 被确认过拟合，不能继续作为生产选择。

固定 6 场景 × 3 seed 的 checkpoint sweep 使用 epoch 10、20、45，模型 `anima-base-v1.0`、strength `0.85`、1216x832、24 steps、CFG 3、`res_multistep/simple`。结论：epoch 10 身份配件和复杂道具欠拟合，epoch 45 线条变硬且 seed 多样性下降，epoch 20 / step 1100 最平衡。

- 生产文件：`ayachi_nene_v19_anima.safetensors`
- ID：`L_NENE_V19_ANIMA`
- SHA-256：`eb0a29dfbe0a80ea9fd63d874fdb49ac92ff8f6d3aedb91637c9141c807e9bb9`
- 对 SD v18：18/18 通过，16 胜 / 2 平 / 0 负；安全 12/12 无成人泄漏，R18 6/6 按请求激活。
- epoch 45 rejected backup SHA-256：`76cb802d55d4a414cdf9305d616f9a6409f50d09b5fd417b47c9ec493636fb44`。
- 当前不从零重训；只有更大场景集触发身份、隔离或构图硬门槛时，才按复现协议重新预注册。

## 宁宁 v20 晋级

### 数据与协议结果

- 源/快照：`Ayachi_Nene/V18_WD14_Curated` -> `V20_Anima_Scientific`。
- 55 个文件、25 个独立 `review.dedupe_group`；42 个训练文件/20 组，13 个验证文件/5 个完整组。
- 验证组：`official_5003_night_support`、`official_5005_clothed_lap`、`official_5006_red_cardigan`、`r18_ev101_library_skirt`、`r18_ev121_bed_pov`。
- manifest SHA-256：`ad3f7b1c24f5d8614c1a6b7871d5f14e0d676f25227fd1ece969cd1e62fb06ef`。
- config SHA-256：`c4fc5663d5c4cbdf77268bead68c81212f0f6d548a1810fe5ce4ad5f7b34484d`。

Baseline A 使用 Anima Base v1.0、Transformer LoRA only、rank/alpha 32/32、constant LR `2e-5`、AdamW betas `0.9/0.99`、weight decay `0.01`、BF16、FP32 LoRA weights、1024 AR buckets、batch/accumulation 1/1；无 random flip、crop jitter、color augmentation、tag shuffle 或 tag dropout。共 36 epochs / 1,512 steps，约 68 分钟，RTX 4070 Ti SUPER 16 GB。

总 validation average 在 epoch 10 最低 `0.066712625`，非 R18 最低 epoch 10 `0.067172386`，R18 最低 epoch 12 `0.065580934`。epoch 8 是接近低谷的首个固定保存点；epoch 12 出现复杂手/扳机失败和卧室重复人物，最终 checkpoint 因后期验证回升和视觉僵硬拒绝。

### 晋级结论

- 晋级 checkpoint：epoch 8 / step 336。
- 生产 ID：`L_NENE_V20_ANIMA`。
- 文件：`ayachi_nene_v20_anima.safetensors`。
- SHA-256：`e5c850dafe8fe8c9466e5378aa1194d3e4290b1d45cc46bb64a16fbb177c15ed`。
- 默认 strength：`0.85`。
- 生产矩阵：18/18 通过，对 v19 为 15 胜 / 0 平 / 3 负；三次失败均为暗卧室柔和低光皮肤表现，未出现结构失败。
- 安全场景：12/12 无成人泄漏；R18：6/6 只在请求时激活；没有多人物泄漏、特征串位或 critical anatomy failure。
- 旧 v19 生产文件保留，SHA-256 `eb0a29dfbe0a80ea9fd63d874fdb49ac92ff8f6d3aedb91637c9141c807e9bb9`，作为回退资产但不再由应用 API 暴露。
- 生产 smoke：真实网关 + ComfyUI 4/4；`anima-base-v1.0`、v20、strength `0.85`、832x1216、24 steps、CFG 3、`res_multistep/simple` 元数据一致。

已知限制：`sc265` 暗卧室三 seed 中 v19 的低光皮肤更柔和。若优化该场景，只能一次改一个变量并增加专门 dark-bedroom holdout，不得恢复被拒绝的后期 checkpoint。

## Prompt A/B 关键结论

宁宁 v19 Anima 的真实 GPU 单变量测试固定 `anima-base-v1.0`、`L_NENE_V19_ANIMA`、seed `20260809`、832x1216、24 steps、CFG 3、`res_multistep/simple`。比较了 underscore control、production profile、只转换 `warm_lighting` 的 warm-space、只转换 `best_quality` 的 quality-space。

- underscore control：身份、魔女服、手持饮品、胸饰、光照和咖啡馆叙事通过。
- broad space conversion：胸饰退化；同时转换 `best_quality` 与 `warm_lighting` 时出现饮品悬空和手部接触崩坏，拒绝。
- warm-space：只把普通场景词 `warm_lighting` 转为空格，视觉通过。
- quality-space：把 `best_quality` 转为空格后胸饰退化为普通金属环，拒绝。
- 最终 profile 保留 `ayachi_nene`、`nene_r18`、`nene_witch_canonical`、`best_quality` 等 exact underscore controls；普通场景词使用空格。
- 修正后的 `profile.png` 与通过的 `warm-space.png` 字节完全一致，SHA-256：`7F33ACCA16EA29ABDFF6933BA69D33715A6217B866961B8A0B132DE4E5F3B8AF`。
- 证据目录：`E:/code/2/lora/AI/Reviews/AnimaPromptAB/2026-08-09_v19_exact_tokens/`。

## 夏目 v19 正式审核

### 训练与数据

- 源 manifest：45 张，SHA-256 `e98fcf5ff39e86f506369b493511127903576784ad37f7e0f21e673045993370`。
- 37 个 visual groups；训练 32 组/39 张，holdout 5 组/6 张。
- holdout：`official_5013`、`official_5014`、`official_5018`、`stand_v12_02`、`cg_v12_04`。
- 训练快照 manifest SHA-256：`18156f50e91fc0b18d927f425a8b792a1f2751a5baf06f6089d9ee1f15fd3a35`。
- 配置 SHA-256：`9e9b995b7839d263d9b5e746053bf36254d6ae61c0b610ef35f27665327e668e`。
- Anima Base v1.0、Transformer LoRA only、rank/alpha 32/32、LR `2e-5`、BF16/FP32；16 epochs、624 steps、约 38 分 32 秒。
- validation total 在 E16 为最低 `0.047131587`；没有连续两次上升，按协议跑满。

### 结果与 hard gate

六类场景 × 三 seed 共 126/126 真实生成：WAI v18 18 张、base-only 18 张、E06/E08/E10/E12/E14 各 18 张。人工审核结论：

- identity close-up：所有候选 3W/0T/0L。
- cafe uniform：所有候选 3W/0T/0L，成人泄漏 0。
- official qipao：E06/E10/E12/E14 各 2W/0T/1L；E08 为 1W/1T/1L。
- complex lowlight：E08 3W/0T/0L。
- R18 fullbody：E08/E10/E12 3W/0T/0L。
- ordinary fullbody：WAI v18 3/3；E08 0W/1T/2L，其他候选最多 1/3，硬门槛失败。
- E08 总计 13W/2T/3L，是总胜负门槛唯一合格候选，但不能覆盖 ordinary fullbody hard gate。

普通全身 prompt A/B 固定 E08 step 312、原三 seed、1216x832、24 steps、CFG 3、LoRA 0.85，只追加 `full body, head to toe, feet visible, standing, long shot, camera pulled back, centered composition`。修正后 fullbody+identity 仍为 2/3，W/T/L `1/0/2`；未进入应用 Prompt assembly。

**最终结论：夏目 v19 拒绝正式晋级，生产不复制、不覆盖 v18。** 生产 SD/WAI 继续使用 `L_NAT_V18_WD14 / shiki_natsume_v18_wd14`；promotion guard 的 `manual-audit.json.decision=rejected` 必须保持。

## 夏目 E08 实验预览

用户于 2026-08-10 授权把未晋级 E08 接入现有 Anima 单角色引擎的实验预览。该接入不改变正式拒绝结论，不改变 production gate，也不改变 triad/shared 或 SD/WAI。

- ID：`L_NAT_V19_ANIMA_PREVIEW`。
- name：`shiki_natsume_v19_anima_preview`。
- checkpoint：E08 / step 312。
- file：`shiki_natsume_v19_anima_preview.safetensors`。
- SHA-256：`389d3153ac05fbe0ea9bd74a9823e5cb8ee6fdc5ed0ecfd9e0b08ff9215036d2`。
- strength：默认 `0.85`，范围 `0.65-1`。
- compatible models：Anima Base v1.0、Anima Aesthetic v1.1。
- 适用：夏目单角色；宁宁固定 v20；triad/shared 继续禁用 Anima。
- 文件缺失时拒绝提交，不回退到宁宁或 SD；UI、状态、历史和 catalog 明确标注实验预览与普通全身限制。
- smoke 目录：`E:/code/2/lora/AI/Reviews/AnimaNatsumeV19PreviewSmoke/2026-08-10`，含夏目身份/咖啡服与普通全身固定 seed 证据。
