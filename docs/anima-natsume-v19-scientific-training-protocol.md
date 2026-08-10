# 四季夏目 Anima v1.0 v19 科学训练协议

日期：2026-08-09

## 目的

在不改动现生产 `L_NAT_V18_WD14 / shiki_natsume_v18_wd14` 的前提下，以 Anima Base v1.0 训练唯一一组低 epoch Transformer LoRA Baseline A。只有通过完整视觉审核和产品硬门槛后，才允许集成 `L_NAT_V19_ANIMA`。

## 固定合同

- 源集：45 张 `V17_WD14_Curated` manifest 条目；源图逐字节复制并 SHA-256 校验。
- 分组：按官方 CG/source stem、逐字节 SHA-256 和感知 hash 派生 visual group；不随机切图。
- Holdout：`official_5013`、`official_5014`、`official_5018`、`stand_v12_02`、`cg_v12_04` 五组。
- Caption：普通 tag 小写空格、逗号后单空格；保留 `shiki_natsume`、`natsume_r18`、`natsume_*`；不可见发夹/泪痣不编造；内衣、裸露和暗示不标 safe。
- Augmentation：random flip、crop jitter、色彩增强、tag shuffle、tag dropout 全部关闭。
- 训练：Anima Base v1.0；Transformer LoRA only；text encoder 与 Anima conditioner frozen；rank/alpha 32/32；constant LR `2e-5`；AdamW `0.9/0.99`、weight decay `0.01`；BF16 train、FP32 LoRA weights；1024 AR buckets；batch/accumulation 1/1。
- 轮次：最多 16 epochs；每 1 epoch validation；每 2 epoch save/sample；每 4 epoch backup。只允许这一组超参；验证连续两次上升且固定样张退化时可提前停。

## 证据路径

- 准备脚本：`scripts/training/prepare_natsume_anima_v19.py`
- 数据快照：`E:/code/2/lora/AI/Datasets/Characters/Shiki_Natsume/V19_Anima_Scientific`
- 分组/数据接触表：`E:/code/2/lora/AI/Reviews/AnimaNatsumeV19Dataset/2026-08-09`
- OneTrainer 配置：`E:/code/2/lora/AI/OneTrainer/training_configs/shiki_natsume_v19_anima_scientific_a.json`
- 训练 workspace：`E:/code/2/lora/AI/OneTrainer/workspace/shiki_natsume_v19_anima_scientific_a`
- 产品矩阵脚本：`scripts/tests/evaluate-anima-natsume-v19-checkpoints.js`
- 产品矩阵接触表：`E:/code/2/lora/AI/Reviews/AnimaNatsumeV19ProductMatrix/2026-08-09/contact_sheets`
- 指标脚本：`scripts/maintenance/measure-anima-natsume-v19-matrix.py`
- 晋级脚本：`scripts/maintenance/promote-anima-natsume-v19-checkpoint.js`

## 晋级门槛

0 critical identity/anatomy/extra-person failure；safe leakage 0；R18 仅请求时激活；普通全身 3/3；旗袍至少 2/3；R18 全身优于 v18 至少 1/3；18 行至少 12 胜且最多 3 负。视觉证据不完整时状态必须为 BLOCKED，不能晋级。
