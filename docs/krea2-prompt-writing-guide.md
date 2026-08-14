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

- 每角色 3 个原型场景蓝图的 `promptProse` 就是给 Krea 用的
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
