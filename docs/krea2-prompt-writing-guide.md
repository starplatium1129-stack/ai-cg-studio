# Krea 2 底模词条写法指南

> 2026-08-14 · 与角色原型场景蓝图配套。Krea 2（Turbo，Qwen3VL-4B 编码器）是自然语言+标签混合模型，写法与 Anima（纯 Danbooru 标签流）不同。本文档说明项目里 Krea 2 路径的提示词正确写法。

## Krea 2 与 Anima 的本质差异

| 维度 | Anima（base/aesthetic） | Krea 2（Turbo） |
|---|---|---|
| 文本编码器 | Qwen-3 0.6B（标签导向） | Qwen3VL-4B（视觉语言，自然语言强） |
| 提示词形态 | Danbooru 标签流（小写、下划线 token） | 自然语言散文 + 简短标签混合 |
| 角色识别 | 角色名+系列标签（exact token） | 角色名+系列+外貌散文描述 |
| score 标签 | 支持（score_7 等） | 不建议（Krea 训练无 score 先验） |
| 负面词 | 长负面列表 | 简短负面即可（模型鲁棒） |

## 正确写法（项目已内置到数据）

### 1. 角色身份：散文为主，标签为辅

```text
（正确）Hatsune Miku, the VOCALOID virtual singer, a cheerful girl with long teal twin-tails and bright teal eyes
（错误）hatsune_miku, twin_tails, teal_hair, teal_eyes（纯标签流，Krea 下角色锚定弱）
```

- 首句 = 角色名 + 系列（`Raiden Shogun from Genshin Impact`）
- 第二句 = 关键外貌散文（发色/发型/瞳色/标志物）
- 项目数据：`identityProse` 字段即为此格式，Krea 路径自动使用

### 2. 服装：`outfit.prose` 散文（而非 tokens）

```text
（正确）her signature black bunny suit with black stockings and white rabbit ears
（错误）bunny_suit, black_stockings（标签 OK 但信息量低）
```

### 3. 场景：`promptProse` 场景散文（角色原型蓝图已内置）

```text
（正确）On a rooftop above the night city, Tokisaki Kurumi holds her twin flintlock muskets...
（错误）rooftop, night, city, musket（Krea 会出，但氛围与构图弱）
```

- 每角色 6 个原型场景蓝图的 `promptProse` 就是给 Krea 用的（2026-08-15 扩容：新增 3 个「日常感」场景，不再局限于原作世界观；另有 4-5 个人设化成人场景，含性癖向扩容；`/popular-scenes` 角色场景库可浏览全部）
- 场景散文建议 2-3 句：地点 + 光照/氛围 + 角色动作

### 4. 标签混用规则

- 角色识别名（`raiden shogun`、`makima`）保留标签形式放句首
- 具体视觉元素（服装/道具/场景物件）用散文
- 不要使用 Danbooru score 标签（score_1~9）、不要下划线 token（Krea 对下划线 token 不敏感）

### 5. 负面词

```text
worst quality, low quality, blurry, jpeg artifacts, extra fingers, bad anatomy, watermark, text
```
短负面即可，不需要 Anima 式的长负面与分镜压制（Krea 2 分镜/双人问题弱于 Anima 低 CFG）。

### 6. 风格与氛围

- 项目 Krea 路径支持 `style` lead（自然语言风格短语，如 `cinematic film still`）
- 场景蓝图的 `kreaStyleHint`/`animaStyleHint` 字段：Krea 用风格短语，Anima 用配方名

## 项目数据落地位置

| 数据 | 字段 | 引擎 |
|---|---|---|
| 角色身份散文 | `popular-characters.json` → `identityProse` | Krea 2 |
| 角色身份标签 | `popular-characters.json` → `identityTokens` | Anima |
| 服装散文/标签 | `popular-characters.json` → `outfits[].prose/tokens` | Krea 2 / Anima |
| 场景散文/标签 | `scene-blueprints.json` → `blueprints[].promptProse/promptTokens` | Krea 2 / Anima |
| 原型要点 | `popular-characters.json` → `canon` | 双引擎参考 |

## 注意事项

- 角色名必须跟系列（`Emilia from Re:Zero`），Krea 2 与 Anima 一致：孤立角色名容易混淆
- 18 个热门角色全部无 LoRA：靠模型内置知识，**散文描述越准确，还原度越高**（调研修正后的 identityProse/canon 即为准确性保障）
- 多角色图：每个角色各用一段"角色名+外貌"散文，用句号分隔

## 调研验证与实测修正（2026-08-14，Krea 2 官方文档 + 社区实测交叉验证）

2026-08-14 热门角色 Krea 2 探针审核结论（18 张全 8 维审计：身份 5.8 / 脸部 6.2 / 肢体 4.8 / 背景 5.2 / 光影 5.8）与官方资料吻合：
**Krea 2 是通用自然语言创意模型（12B DiT + Qwen3-VL 编码器），不是标签驱动的动漫角色特调模型**——"认得出角色但肢体/背景/光影平庸"是定位错配的典型症状，可通过提示词文体与参数修正显著改善。

### 参数（项目 Turbo 路径现状基本正确）

- 官方 Turbo 推荐：`8 步 / CFG 0 / mu=1.15`（**mu=1.15 必须保留**，ComfyUI 对 raw 调度会设错，用 `Krea-2-Two-Stage-Sampler` 修正）；RAW 用 52 步 / CFG 3.5
- 项目现状 euler/simple/8 步/CFG 1 ≈ 官方方向，**步骤/CFG/分辨率不是平庸主因**
- fp8_scaled 量化：240 图同参数基准中保真度排第 5（轻度可测损失）；显存够可换 BF16 或 INT8 ConvRot（后者同质量快 ~2×）
- 文本编码器用 BF16 的 Qwen3-VL 4B；VAE 用 Wan 2.1 FP32 更锐

### 提示词文体（最重要修正）

官方明确"自然语言长描述最优"，**Danbooru 逗号标签堆词是负收益**。推荐结构（已与场景蓝图 prose 对齐）：

1. 媒介/风格锚点开头：`anime film background painting in the aesthetic of …` / `anime-style illustration`
2. 角色外观锁定：3-5 个固定配色词复用（角色 LoRA 亦按此锁定）
3. 姿态/构图明写：`full body` / `dynamic pose` / `proper anatomy`（Krea 肢体比例是已知弱势，需明写约束）
4. 光照时机方向：`golden hour` / `backlit` / `hard shadows`（光影平多因未写光照）
5. 背景具体物件清单 + **排除人**：`no characters, no people, no figures`（官方明说模型见室内就爱画人——"背景空"元凶）
6. **禁用 AI 玄学词**：`beautiful, stunning, masterpiece, 8k` 会把输出拉向 generic AI gloss（"光影平/背景空"第二大元凶）

### 身份一致性结论

- 不依赖 Danbooru 标签做身份：Krea 2 认概念不认标签身份（PTT 实测"角色要素会混在一起"，与身份 5.8 吻合）
- 要强身份一致 → 训练角色 LoRA（**RAW 上训、Turbo 上应用**，官方与社区一致推荐）；纯动漫风可配动漫风格 LoRA
- 写实/高质感场景可用 `RAW + rank64 Turbo-LoRA @0.6` 替代 Turbo 主模型
- 社区备选 sampler：RES4LYF ClownsharKSampler（exponential/ddim + beta57，8 步 CFG1.0）或 euler_ancestral/simple/10 步 CFG1.1

### 来源

- 官方 README / Prompting 指南 / 技术报告 / Anime backgrounds 博客 / Studio anime 博客 / Character design 博客（krea.ai）
- [Merserk Krea-2 Turbo Format Fidelity Benchmark](https://huggingface.co/datasets/Merserk/Krea-2-Turbo-Checkpoint-Format-Benchmark)（与项目同参数评测）
- [PTT 初步測試與工作流程](https://www.pttweb.cc/bbs/AI_Art/M.1782277091.A.133)、[CivArchive Krea 2 workflow tips](https://civarchive.com/models/2749367?modelVersionId=3092832)、[Dust & Dreams workflow](https://civarchive.com/models/2795523?modelVersionId=3150899)
