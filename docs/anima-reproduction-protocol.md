# Anima 可复现训练协议

> 适用：宁宁 v20 与夏目 v19 scientific baseline。本文是训练/审核的长期协议，不是任务分派稿。

## 共同合同

- 使用 Anima Base v1.0；不训练 LLM adapter。OneTrainer 的 Anima setup 冻结 Qwen text encoder 与 Anima conditioner，只训练 Transformer LoRA 层。
- 普通 tag 使用小写、空格和逗号后单空格；安全标签按 Anima 约定。`ayachi_nene`、`nene_r18`、`nene_*`、`shiki_natsume`、`natsume_r18` 等角色/服装控制词按已审核的 underscore exact-token 合同保留，不把所有控制词盲目转换为空格。
- safe、sensitive、nsfw、explicit 必须按真实内容标注；不得把内衣、裸露、暗示内容标为 safe。R18 只在请求条件下激活。
- 数据源逐字节复制并以 SHA-256 固定；划分单位是 visual/dedupe group，不是单张图片。近重复成员不得跨 train/validation。
- 固定 seed 的生产矩阵必须同时检查身份、脸/呆毛/发饰、服装控制、手腿和人体结构、双人串位、构图、光照、场景叙事、安全泄漏与 seed 多样性。机器 loss、CLIP、hash 或自动标签不能替代逐图人工审核。
- 只允许预注册的一组初始超参。若需要新实验，必须只改变一个变量，保留旧生产文件并重新执行同等矩阵。

## 宁宁 v20 Baseline A

- 源：`AI/Datasets/Characters/Ayachi_Nene/V18_WD14_Curated`；快照：`V20_Anima_Scientific`。
- 55 文件 / 25 visual groups；42 文件 / 20 groups train，13 文件 / 5 groups holdout。
- holdout：`official_5003_night_support`、`official_5005_clothed_lap`、`official_5006_red_cardigan`、`r18_ev101_library_skirt`、`r18_ev121_bed_pov`。
- manifest SHA-256：`ad3f7b1c24f5d8614c1a6b7871d5f14e0d676f25227fd1ece969cd1e62fb06ef`。
- Base：Anima Base v1.0；target：Transformer LoRA only；rank/alpha `32/32`。
- LR：constant `2e-5`；AdamW betas `0.9/0.99`；weight decay `0.01`。
- Precision：BF16 train、FP32 LoRA weights；resolution 1024 AR buckets；batch/accumulation `1/1`。
- augmentations：random flip、crop jitter、color augmentation、tag shuffle、tag dropout 全部关闭。
- 36 epochs；validation 每 2 epochs；save/sample 每 4 epochs；Baseline A 输出名 `ayachi_nene_v20_anima_scientific_a.safetensors`。
- 选择规则：validation 不持续发散；至少三 seed；生产 route 矩阵必须胜过 v19；safe 无成人泄漏，R18 只在请求时出现；不能以 final epoch 或最低 training loss 自动晋级。

## 夏目 v19 Baseline A

- 源：`AI/Datasets/Characters/Shiki_Natsume/V17_WD14_Curated`；snapshot：`V19_Anima_Scientific`。
- 原始 45 张，按 source stem、SHA-256 和 perceptual hash 派生 visual group；holdout 五组：`official_5013`、`official_5014`、`official_5018`、`stand_v12_02`、`cg_v12_04`。
- 训练 32 groups / 39 张，holdout 5 groups / 6 张；caption 保留 `shiki_natsume`、`natsume_r18`、`natsume_*`，不可见发夹/泪痣不编造。
- Base、Transformer-only、rank/alpha、LR、optimizer、precision 与宁宁 Baseline A 相同。
- random flip、crop jitter、color augmentation、tag shuffle、tag dropout 全部关闭。
- 最多 16 epochs；每 epoch validation；每 2 epoch save/sample；每 4 epoch backup；若连续两次 validation 上升且固定样张退化可提前停止。
- hard gate：critical identity/anatomy/extra-person failure 为 0；safe leakage 为 0；R18 仅请求激活；普通全身 3/3；旗袍至少 2/3；R18 全身优于 v18 至少 1/3；18 行至少 12 胜且最多 3 负。证据不完整时状态为 BLOCKED。

## 生产矩阵与证据

- 宁宁 v20：六场景 × 三 seed；固定 production `/api/anima/*` route；完整 manifest、manual review 和 checkpoint evidence 保存在 AI 工作区 `AI/Reviews/AnimaV20CheckpointAudit/` 与 `AI/Reviews/AnimaV20ProductionSmoke/`。
- 宁宁旧 v19 checkpoint audit：`AI/Reviews/AnimaV19CheckpointAudit/2026-08-09_e10_e20/`；生产重验证矩阵：`AI/Reviews/AnimaV19VisualMatrix/2026-08-09_6x3_e20/`。
- 夏目：`AI/Reviews/AnimaNatsumeV19ProductMatrix/2026-08-09/`，普通全身 A/B：`AI/Reviews/AnimaNatsumeV19OrdinaryFullbodyAB/2026-08-10/`。
- 夏目 preview smoke：`AI/Reviews/AnimaNatsumeV19PreviewSmoke/2026-08-10/`。
- 证据目录位于 AI 工作区，不把模型权重、WAV、截图或 contact sheet 提交仓库；仓库只保留协议、结果、路径、SHA、判定和复现入口。

## 可复现入口

- 宁宁/通用 promotion：`scripts/maintenance/promote-anima-v20-checkpoint.js`、`scripts/maintenance/promote-anima-checkpoint.js`。
- 夏目数据准备：`scripts/training/prepare_natsume_anima_v19.py`。
- 夏目矩阵：`scripts/tests/evaluate-anima-natsume-v19-checkpoints.js`、`scripts/maintenance/measure-anima-natsume-v19-matrix.py`、`scripts/maintenance/promote-anima-natsume-v19-checkpoint.js`。
- 夏目 preview staging：`scripts/maintenance/stage-anima-natsume-v19-preview.js`，源/目标 SHA 固定且重复运行幂等。
