# Anima 训练与晋级记录

> 当前汇总：2026-08-14
> 本文保留已完成实验的可审计结论，不把实验结果改写成稳定发布承诺。复现参数见本文末尾「长期协议」节（原 `anima-reproduction-protocol.md` 于 2026-08-14 并入）。

## 宁宁 v20-b 晋级（2026-08-10）

### 动机与数据

v20-a 用户反馈"背景光影感强但人物还原弱"，调研结论（kohya anima_train_network 指南、HF Anima discussion #60/#106/#119、Civitai 31972、lilting 系列实测）：LR 2e-5 过低 + caption 身份特征与背景/光照标签固定共现，导致身份欠拟合、画风被触发词吸收。修复后重训：

- 数据集：`V20_Anima_Scientific_v2` 快照（55 张，20 训练组 / 5 验证组，与 v20-a 同源同划分）。
- caption 策略（prepare_nene_anima_v20.py）：身份特征标签全部移除，`ayachi_nene` 独占身份（Anima trigger-only 实测结论）；光照/氛围标签显式前置（soft lighting/moonlight/night 等 32 个）；OneTrainer 开 tag shuffle + keep_tags_count=4 + RANDOM dropout 0.1。
- 超参：rank/alpha 32/32、LR **1e-4**（warmup 100）、24 epochs / 1008 steps、batch 1、LOGIT_NORMAL、text encoder 冻结。config `ayachi_nene_v20_anima_scientific_b.json`。
- 训练 46 分钟，每 4 epoch 保存。

### 评审（两级矩阵）

1. **初赛**（6 场景 sc260-265 × 3 seed × 6 候选 = 108 张，24s/CFG3 生产参数）：总评 v20a 75 分、b_e16 70、b_e20 63、b_e08 62、b_e12 59、b_e24 49（过拟合排除，sc263 枪械加特林崩坏/色漂）。
2. **决赛**（7 扩展场景 sc261/sc268/sc269/sc002/sc105/sc014/sc006 × 新 3 seed × e16/e20 × 双参数组 = 84 张）：
   - 默认参数组（24s/CFG3）：e20 13:8；
   - **官方参数组（30s/CFG4.5/er_sde/sgm_uniform）：e16 13:8 胜出**，且 e20 在标准参数下多次结构伪影（sc268 布料堆叠、sc014 多指、sc002 发带结块），e16 零结构崩坏。
   - 解读：e16/e20 处于同一条过拟合梯度；官方推荐参数（Anima 模型卡：30-50 steps、CFG 4-5、er_sde 为默认）更接近真实使用，e16 为健康收敛点。

### 晋级结论

- 晋级 checkpoint：**epoch 16 / step 672**（b_e16）。
- 生产 ID：`L_NENE_V20B_ANIMA`；文件 `ayachi_nene_v20_anima_scientific_b_e16.safetensors`（SHA-256 `0a1dd84fb0e57a8ccd1627d2d52afd1809c2d03d6f24f87c3e442e872dd683a5`）。
- 默认 strength：0.85。生产一键路由经 `src/utils/drawingRoute.ts` 把 nene 映射到 `L_NENE_V20B_ANIMA`/`generationCharacter='nene_b'`；`routes/anima.js` 的 `CHARACTERS.nene` 默认仍是 v20-a，V20B 绑定在独立 `nene_b` 条目（保留 A/B 对比通道）。`L_NENE_V20_ANIMA`（v20-a）保留为回退条目。
- 已知限制：e16 在低参数（24s/CFG3）下身份绑定弱于 e20，生产建议走官方推荐参数 30s/CFG4.5/er_sde；sc105 某 cell 腿部观感争议（复核为条纹袜视觉割裂，解剖正常）。
- 证据目录：`E:/code/2/lora/AI/Reviews/AnimaV20bCheckpointAudit/2026-08-10_lr1e4_tagfix/`、`E:/code/2/lora/AI/Reviews/AnimaV20bFinal/2026-08-10_e16_vs_e20/`、`..._30s_cfg45_ersde/`。
  - ⚠️ 2026-08-14 漂移审计：以上证据目录与 `AnimaPromptAB`、`AnimaNatsumeV19PreviewSmoke` 等当前未在 AI 工作区 `E:/code/2/lora/AI/Reviews` 找到（现存 Anima 相关目录仅 `AnimaUnifiedSweep`），若已归档/迁移请更新路径。

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
- 证据目录：`E:/code/2/lora/AI/Reviews/AnimaPromptAB/2026-08-09_v19_exact_tokens/`（漂移审计 2026-08-14：目录当前未在 AI 工作区找到，若已归档请更新）。

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
- smoke 目录：`E:/code/2/lora/AI/Reviews/AnimaNatsumeV19PreviewSmoke/2026-08-10`，含夏目身份/咖啡服与普通全身固定 seed 证据（漂移审计 2026-08-14：目录当前未在 AI 工作区找到，若已归档请更新）。

## 训练设计决策：R18 tag 隔离是错误设计（2026-08-13）

> 来源：2026-08-12~08-13 全量出图实战（见 `docs/showcase-generation-craft.md`）。用户确认此结论，作为下次重训的设计输入。

### 结论

**v18/v20 训练中"给 R18 样张单独挂 `nene_r18` tag 以隔离、避免污染日常图"的设计是错误选择。** 下次重训统一训练，不隔离质量先验。

### 机制与证据

- `nene_r18` 同时承载两件事：**内容评级**（R18 激活词）与**渲染质量先验**（R18 样张均为商业级 CG，渲染密度远超日常图）。隔离设计把两者绑死，日常样张训练时接触不到高质量渲染先验 → 模型学到的"角色 = 中等画质"，R18 图才高画质。
- 生成侧实测：全场景注入 `nene_r18`（把质量钥匙借给日常图）→ 皮肤泛光/发丝逆光通透/暗部暖反弹光显著提升（93 vs 89 分），内容安全（日常场景出穿衣图）。证明质量先验可泛化，隔离白白损失了它。
- 数据集目录 `identity_r18/identity_safe`、`train_r18/train_safe` 是同一训练集的分组，最终合成一个 LoRA——从未单独训练过独立 R18 LoRA；问题在 tag 隔离而非文件分离。

### 下次重训的设计决策

1. **质量先验不隔离**：R18 样张不单独挂渲染隔离 tag；所有样张共享统一高质量学习信号（统一训练）。
2. **内容评级交给显式内容词**：裸体/成人行为由 `nude` 等内容词 + `safe/nsfw` rating 词控制，不靠渲染 tag 隔离。
3. **身份与画质天然绑定**：生成时日常图不再需要注入 `nene_r18` hack；若 token 保留，其定位改为纯评级词。

### 重训验证硬门槛

- **safe prompt 泄漏测试**：safe prompt 出图必须 0 成人泄漏（当前 v20 的 12/12 无泄漏是在隔离前提下测得，去掉隔离后必须重新验证）。
- 若泄漏测试失败，说明模型未学会 rating 解耦，优先调整 caption 策略（rating 词强化）而不是回到隔离。
- 其余门槛（身份/服装 canonical/结构崩坏）沿用既有晋级协议。

### LoRA 跨底模加载记录（2026-08-13）

**现象**：v20 LoRA（`ayachi_nene_v20_anima_scientific_b_e16`）在 Anima Aesthetic v1.1 底模上加载后，渲染质量显著优于 Base v1.0。

**解释**：
- `anima-aesthetic-v1.1` 是从 `anima-base-v1.0` 精调而来，共享**同一个 Qwen text encoder、同一个 VAE、同一 latent 空间**。
- LoRA 学的是"增量残差"（身份+服装契约），与底模的整体画质/光影正交。
- 结果：Aesthetic 提供更好的底座质量 + LoRA 提供精确的角色/服装控制 = 双赢。

**建议**：下次重训时保留 v20B LoRA，建议生产路径统一走 Aesthetic v1.1 底模。

## 夏目 v20 unified 训练配置（2026-08-14）

> 与宁宁 v20 unified（`ayachi_nene_v20_anima_scientific_unified`，另一半正在审核）同协议的夏目重训配置，落地 08-13"统一训练、不隔离质量先验"决策。

### 交付

- `scripts/training/prepare_natsume_anima_v20.py`：源 manifest 派生（官方事件/源文件名 stem + 字节 SHA-256 + 感知哈希并组）→ 统一 train/validation 两分区 → caption 归一化 → OneTrainer 配置 → `--check` 自校验。
- 保持夏目 v19 的视觉组派生与 holdout 契约：`official_5013 / official_5014 / official_5018 / stand_v12_02 / cg_v12_04` 五组冻结验证。
- 与宁宁 unified 对齐的协议：`shiki_natsume` 触发词独占身份（静态身份标签从 caption 移除）、光照/氛围标签前置、`natsume_r18` 保留为评级词（不再按 r18 分区隔离）、tag shuffle + RANDOM dropout 0.1（keep_tags_count 4）、1e-4 / rank 32 / alpha 32 / 24 epochs / 1024 / LOGIT_NORMAL / attn-mlp。
- run 命名：`shiki_natsume_v20_anima_scientific_unified`；production_guard 明确不覆盖 `L_NAT_V20_ANIMA`（`shiki_natsume_v20_anima_scientific_e12`）。
- 已知决策沿用：泪痣（mole under eye）随触发词-only 策略难以稳定复现（v19/v20 同限制），不在 caption 中强制注入；生成侧仍走 Aesthetic v1.1 底模加载（跨底模加载记录 2026-08-13）。

### 验证

- 端到端 fixture（60 张合成图、39 视觉组、5 holdout 组）全流程通过：`built: true`、`check ok`、`errors: []`；训练 50 / 验证 10。
- caption 契约抽样：R18 → `nsfw, natsume_r18, shiki_natsume, soft lighting, 1girl, solo, natsume_cafe_uniform, cafe, breasts`（评级词保留、身份标签移除、光照前置、控制词下划线）；SAFE → `safe, shiki_natsume, night, 1girl, solo, natsume_official_qipao, lantern light`（无 r18 泄漏）。
- 真实数据待命：拿到 AI 工作区真实 45 张源 manifest 后运行 `python scripts/training/prepare_natsume_anima_v20.py --source-manifest <真实 manifest> --output-dataset <目标> --base-config <OneTrainer 模板> --output-config <目标> --evidence-root <审核目录>`。

## 长期协议（原 `anima-reproduction-protocol.md`，2026-08-14 并入）

> 适用：宁宁 v20 与夏目 v19/20 scientific 系列。本文是训练/审核的长期协议，不是任务分派稿。各实验的具体数据划分、caption、超参和 SHA 以上文对应章节为准（宁宁 v20 见「宁宁 v20 晋级」与「宁宁 v20-b 晋级」，夏目见「夏目 v19 正式审核」与「夏目 v20 unified 训练配置」）。

### 共同合同

- 使用 Anima Base v1.0；不训练 LLM adapter。OneTrainer 的 Anima setup 冻结 Qwen text encoder 与 Anima conditioner，只训练 Transformer LoRA 层。
- 普通 tag 使用小写、空格和逗号后单空格；安全标签按 Anima 约定。`ayachi_nene`、`nene_r18`、`nene_*`、`shiki_natsume`、`natsume_r18` 等角色/服装控制词按已审核的 underscore exact-token 合同保留，不把所有控制词盲目转换为空格。
- safe、sensitive、nsfw、explicit 必须按真实内容标注；不得把内衣、裸露、暗示内容标为 safe。R18 只在请求条件下激活。
- 数据源逐字节复制并以 SHA-256 固定；划分单位是 visual/dedupe group，不是单张图片。近重复成员不得跨 train/validation。
- 固定 seed 的生产矩阵必须同时检查身份、脸/呆毛/发饰、服装控制、手腿和人体结构、双人串位、构图、光照、场景叙事、安全泄漏与 seed 多样性。机器 loss、CLIP、hash 或自动标签不能替代逐图人工审核。
- 只允许预注册的一组初始超参。若需要新实验，必须只改变一个变量，保留旧生产文件并重新执行同等矩阵。

### 生产矩阵与证据

- 证据目录位于 AI 工作区，不把模型权重、WAV、截图或 contact sheet 提交仓库；仓库只保留协议、结果、路径、SHA、判定和复现入口。
- ⚠️ 漂移审计 2026-08-14：旧协议中列出的 `AnimaV20CheckpointAudit`、`AnimaV20ProductionSmoke`、`AnimaV19CheckpointAudit`、`AnimaV19VisualMatrix`、`AnimaNatsumeV19ProductMatrix`、`AnimaNatsumeV19OrdinaryFullbodyAB`、`AnimaNatsumeV19PreviewSmoke` 等证据目录当前均未在 AI 工作区 `E:/code/2/lora/AI/Reviews` 找到（现存 Anima 相关目录仅 `AnimaUnifiedSweep`）；若证据已归档/迁移请更新上文对应章节的路径，否则后续按协议复查将无法定位证据。

### 可复现入口

- 宁宁/通用 promotion：`scripts/maintenance/promote-anima-v20-checkpoint.js`、`scripts/maintenance/promote-anima-checkpoint.js`。
- 宁宁数据准备：`scripts/training/prepare_nene_anima_v20.py`。
- 夏目数据准备：`scripts/training/prepare_natsume_anima_v19.py`、`scripts/training/prepare_natsume_anima_v20.py`。
- 夏目矩阵：`scripts/tests/evaluate-anima-natsume-v19-checkpoints.js`、`scripts/maintenance/measure-anima-natsume-v19-matrix.py`、`scripts/maintenance/promote-anima-natsume-v19-checkpoint.js`。
- 夏目 preview staging：`scripts/maintenance/stage-anima-natsume-v19-preview.js`，源/目标 SHA 固定且重复运行幂等。


## 宁宁 v20 unified 训练审核与晋级（2026-08-14）

> 覆盖 `ayachi_nene_v20_anima_scientific_unified`（2026-08-13 训练，24 epochs / 1008 steps，LR 1e-4 / rank 32 / alpha 32，数据集 `V20_Anima_Scientific_v2`，落实 08-13「统一训练、不隔离质量先验」决策）。本结论基于两级真实 ComfyUI 矩阵 + 八维严格视觉审核（`image-inspect -t audit` 机制）。

### 初赛（Base v1.0 + 24s/CFG3，6 候选 × 7 场景 × 3 seed = 126 张）

| 候选 | 通过 | 需复核 | 不通过 | 平均分(/80) |
|---|---|---|---|---|
| e4 | 10 | 3 | 8 | 47.0 |
| e8 | 11 | 1 | 9 | 47.3 |
| **e12** | 7 | 4 | 10 | **58.8** |
| e16 | 4 | 6 | 11 | 58.0 |
| e20 | 7 | 4 | 10 | 57.2 |
| e24 | 6 | 6 | 9 | 56.3 |

- e4/e8 为欠拟合期（通过多但平均分垫底）；e16 两极分化（平均分高、通过最少、不通过最多）；复杂/魔女道具场景（sc268/sc105）后期系统性崩坏，与训练样本「魔女装 e20 漂移」互相印证。

### 决赛（Aesthetic v1.1 + 官方参数 30s/CFG4.5/er_sde/sgm_uniform，e12/e16/e20 × 7 场景 × 3 seed = 63 张）

| 候选 | 通过 | 需复核 | 不通过 | 平均分(/80) |
|---|---|---|---|---|
| **u_e12** | 8 | 5 | **8** | 51.0 |
| u_e16 | 4 | 5 | 12 | 70.5 |
| u_e20 | 7 | 1 | 13 | 48.0 |

- **晋级：u_e12（epoch 12 / step 504）**，两个组合下均为最优；Aesthetic v1.1 底模 + 官方参数下不通过 10→8，进一步改善。
- 生产组合建议：**Aesthetic v1.1 底模 + 30s/CFG4.5/er_sde/sgm_uniform + LoRA strength 0.85**（与 08-13「跨底模加载记录」结论一致；注意决赛同时更换底模与参数，底模单独贡献未做严格 A/B，但组合效果显著优于 Base+默认参数）。
- 文件：`ayachi_nene_v20_anima_unified_e12.safetensors`（SHA-256 `5b21edf37d6f6e23177674d4fd447984009f8e0fff52da5fd5c29b948bfa72ab`，即 `AI/ComfyUI/models/loras/ayachi_nene_v20_anima_unified_e12.safetensors`）。
- 生产 ID：待用户确认（候选 `L_NENE_V21_ANIMA`），确认后走 `promote-anima-v20-checkpoint.js` 晋级并切换 `routes/anima.js`。
- 已知限制：审核期间视觉代理认证抖动（503 auth_unavailable / 400 地区限制），最终 63/63 全覆盖（1 张由 claude-sonnet-4-6 补审）；手部仍是主要硬伤源；e12 不通过 8 张集中在复杂道具/极端角度场景，简单场景全过。
- 证据目录：`E:/code/2/lora/AI/Reviews/AnimaUnifiedSweep/2026-08-13_24s_cfg3/`（初赛，126 张 + manifest + audit-report）、`.../2026-08-13_30s_cfg45_ersde_aesthetic/`（决赛，63 张 + manifest + audit-report）。
- 可复现入口：`scripts/tests/evaluate-anima-unified.js`（生成，支持 `--params`/`--model`/`--only`/`--concurrency`）、`scripts/tests/audit-unified-sweep.js`（审核，quick 批量快筛 + full 八维精审 + `--resume`/`--stage`/`--concurrency`）、`scripts/tests/repair-audit-parses.js`（parse-fail 离线重解析）。

### 决赛逐维度结论（为什么是 e12）

- **e12**：脸部神态 8.5 / 光影 8.1 / 身份 8.0（10 分制，精审均分）；背景伪影 ×2、构图 ×1（三候选最少）；不通过 8 张原因高度集中于手/腿/姿势结构（各 ×8），问题单一可修；不通过集中在 sc105/sc269 复杂场景，日常场景全过。
- **e16**：肢体结构均分 5.9 全场最低；手部 11/12 不通过；新增发带不对称等标志元素错误（头发发饰 ×8）；不通过散在 6 场景，问题面广。
- **e20**：画质上限全场第一（身份 8.6 / 光影 8.6 / 构图 8.4 / 总均分 8.0），但硬伤最多（不通过 13：姿势 ×12 / 发饰 ×12 / 手 ×11 / 腿 ×11）——"画得最美但最不稳"，过拟合后期形态。
- 三候选手部不通过 8/11/11：**手部是 unified LoRA 普遍短板**，e12 胜在其他维度不跟着崩，生产可预期"重绘手部"类修复。

### 加赛与改判（2026-08-14，用户亲审）

- 用户对「e12 晋级」提出异议（脸与魔女服），加赛 28 张（Aesthetic + 官方参数，e12 vs e16）：魔女服 sc105/sc300 × 4 seed + 脸部特写 face01 × 6 seed，目录 `Reviews/AnimaUnifiedSweep/2026-08-14_rematch_e12_vs_e16/`。
- 加赛数据（Claude 视觉审核，尺度与 Gemini 不同但轮内可比）：脸部神态 e16 7.8 > e12 7.6；魔女服 sc105 两轮尺度（Gemini 决赛 / Claude 加赛）e16 均优于 e12。
- **最终晋级：u_e16（epoch 16 / step 672）**，生产 ID `L_NENE_V21_ANIMA`，文件 `ayachi_nene_v20_anima_unified_e16.safetensors`（SHA-256 `3a5fe2e772f027f6248db865e67f38aee50e1bfcd633200ebb3f0818b774b6b4`）；`routes/anima.js`、`server/anima-generation-contract.js`、`data/loras.json`、`generate-scene-showcase-candidates.js` 已切换 nene 默认绑定，`L_NENE_V20_ANIMA`/`L_NENE_V20B_ANIMA` 保留为回退条目（nene_b 通道不变）。
- **e12 保留为回退候选**（整体稳定性更优：决赛不通过 8/21 vs e16 12/21；手部/肢体为 unified 通病，e12 其他维度不跟着崩）。若后续生产暴露 e16 复杂场景崩坏率问题，可切回 e12 或按 e12 权重策略出图。
- 已知限制：e16 肢体结构均分 5.9（三候选最低）、发饰错位 ×8、复杂/极端角度场景崩坏率高于 e12；手部是 unified 普遍短板（8/11/11）。生产建议 Aesthetic v1.1 + 官方参数 30s/CFG4.5/er_sde + strength 0.85。
- 数据文件变更：`data/loras.json` 新增 `L_NENE_V21_ANIMA` 条目（含两级矩阵/加赛/用户亲审完整 validation 记录），`DATA_VERSION` 同步升至内容锁定值。
