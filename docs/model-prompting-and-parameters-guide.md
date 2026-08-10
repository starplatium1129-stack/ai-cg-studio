# AI-CG-Studio 旗舰底模提示词与出图参数全景指南

> **状态基线**：2026-08-10
> **适用底模**：WAI Illustrious SDXL v17 | Anima Base v1.0 | Krea 2 Turbo
> **权威依据**：HuggingFace 官方仓库 (`LyliaEngine/anima_baseV10`)、Civitai 社区权威指南 (`How Your Prompt Breaks ANIMA`)、Krea AI 官方 Prompt 规范及 AI-CG-Studio 训练契约。

---

## 一、 三大底模特性与适用场景对比

| 特性维度 | WAI Illustrious SDXL v17 | Anima Base v1.0 | Krea 2 Turbo |
|---|---|---|---|
| **底模架构** | SDXL 1.0 (Diffusion U-Net) | Flow-Matching + Qwen LLM Text Encoder | DiT Fast Diffusion |
| **优势领域** | 经典二次元 2D Anime CG、角色极度还原 | 影视级声场与光影、大光圈质感、高清背景 | 超快速渲染、自然语言散文极佳 |
| **角色 LoRA 支持** | 支持 (`v18` 系列，权重 0.65~0.85) | 支持 (`v20` 专属 Transformer LoRA) | 无 LoRA (依靠纯 Prompt 描述) |
| **提示词范式** | Danbooru 下划线标签 (`tag_name`) | 空格分隔 Tag + 英文句子混合 | 100% 英文自然语言散文 (Prose) |

---

## 二、 底模出图推荐参数表（排坑核心）

⚠️ **非常关键**：不同底模的文本编码器与扩散机制不同，**CFG 绝不能通用**！

| 参数项 | WAI Illustrious v17 | Anima Base v1.0 | Krea 2 Turbo |
|---|---|---|---|
| **CFG Scale** | **5.5 ～ 6.5** | **1.5 ～ 2.0 (极致命！高 CFG 会硬糊)** | **1.0** (固定) |
| **采样器 (Sampler)** | `Euler a` / `DPM++ 2M SDE Karras` | `euler_ancestral_cfg_pp` / `er_sde` | `euler` |
| **调度器 (Scheduler)**| `karras` / `normal` | `sgm_uniform` / `karras` | `simple` |
| **采样步数 (Steps)** | 28 ～ 35 步 | 25 ～ 30 步 | 8 ～ 12 步 |
| **推荐分辨率** | `1024×1344` / `832×1216` | `832×1216` / `1024×1024` | `1024×1024` / `1024×1536` |
| **Negative Prompt** | 基础防走样词 (20 词以内) | 极简负面 (10 词以内，禁止括号加重) | **完全不填写 (留空)** |
| **Hires Denoise** | `0.45 ～ 0.50` (R-ESRGAN 4x+ Anime6B) | 不开启/依赖底层原生像素 | 不开启 |

---

## 三、 提示词 (Prompt) 语法规范与格式要求

### 1. WAI Illustrious SDXL v17 语法规范
* **格式**：全 Danbooru 标准标签，多个词语间使用**下划线 `_`** 连接，用逗号分隔。
* **质量前缀**：前置 3 个以内核心质量词即可。过多质量词会导致画面偏硬。
* **标准范例**：
  ```text
  masterpiece, best quality, amazing quality, 1girl, ayachi_nene, school_uniform, blazer, pleated_skirt, white_hair, low_twintails, purple_eyes, ahoge, sitting_by_window, golden_hour, detailed_background, volumetric_lighting
  ```

### 2. Anima Base v1.0 语法规范
* **格式**：
  * 普通标签用**小写 + 空格**替换下划线（如 `school uniform`, `white hair`）。
  * 评分标签与专属触发词保留下划线（如 `score_7`, `ayachi_nene`, `shiki_natsume`, `nene_r18`）。
* **质量与评分前缀**：
  ```text
  masterpiece, best quality, score_7, safe, 1girl, ayachi_nene, school uniform, purple eyes, long white hair, sitting by window, sunset lighting
  ```
* **混合自然描述句**：Anima 强大的 Qwen 编码器支持在 Tag 之后追加自然英文描述句：
  ```text
  ... safe, 1girl, ayachi_nene. An anime girl with long white hair is sitting quietly by a rain-streaked window during golden hour, bathing in warm sunlight.
  ```

### 3. Krea 2 Turbo 语法规范
* **格式**：100% 英文自然语言散文（Prose），**不使用 Danbooru 标签**，**不使用权重括号 `(tag:1.2)`**，**不上划线**。
* **结构顺序**：【风格/媒介】→【主体外貌与身份】→【服饰材质】→【镜头构图】→【场景背景】→【光影与氛围】。
* **标准范例**（由于 Krea 2 没有 LoRA，需写明外貌）：
  ```text
  Digital anime artwork of an anime girl with long white hair, purple eyes, and a small hair ribbon. She is wearing a navy blue Japanese high school uniform with a pleated skirt. The scene is framed in a medium shot, set in a cozy sunlit classroom. Warm golden hour sunlight streams through the window, casting soft long shadows.
  ```

---

## 四、 项目现存配置及代码修补排查点

### 1. `data/presets.json` 参数纠偏
* **问题**：`anima_base_v10` 的 `cfg` 曾误设为 `4.5`。
* **修复**：将 `cfg` 纠正为 `1.8` ～ `2.0`。

### 2. `src/utils/promptCompiler.ts` 误删规则修复
* **问题**：`proseToken` 函数在处理 Krea 2 的散文时，将 `nene_school_uniform` / `natsume_cafe_uniform` 误正则擦除，导致服装细节丢失。
* **修复**：恢复服饰描述词向普通自然英文词组（如 `navy school uniform` / `cafe maid uniform`）的正常映射与织入。

### 3. `src/utils/promptPolicy.ts` 触发词下划线保护
* **问题**：`formatAnimaToken` 将所有下划线强制解开，导致 Anima LoRA 触发词失联。
* **修复**：对 `exact_tokens` 与 `exact_prefixes` 进行严格保护，保留 `ayachi_nene` 与 `shiki_natsume` 的完整触发下划线。

---

## 五、 参考资料与权威出处

1. **Anima Base v1.0 官方模型发布与提示词指南**
   * HuggingFace 官方模型仓库：[LyliaEngine/anima_baseV10](https://huggingface.co/LyliaEngine/anima_baseV10)
   * HuggingFace 镜像仓库：[circlestone-labs/Anima](https://huggingface.co/circlestone-labs/Anima)
   * Civitai 官方模型页：[Civitai Anima-base-v1.0](https://civitai.com/models/2458426/anima)

2. **Anima 社区权威调优与 Prompt 规则深度分析**
   * Civitai 深度解析指南：[*How Your Prompt Breaks ANIMA — And How To Fix It*](https://civitai.com/articles/31399/how-your-prompt-breaks-anima-and-how-to-fix-it) (详细剖析 Qwen 编码器低 CFG 1.5~2.0 策略与空格 Tag 格式)
   * Civitai 实测教程：[*1 Month Thoughts on Anima-base v1.0: Achieving the TV Anime Look*](https://civitai.com/articles/31411/1-month-thoughts-on-anima-base-v10-achieving-the-tv-anime-look)

3. **Krea AI 官方 Prompting 散文规范**
   * Krea AI 官方文档：[Krea Turbo Prompting Guide](https://docs.krea.ai) (官方自然语言散文与媒介前词规范)

4. **WAI Illustrious SDXL 官方契约**
   * WAI0731 官方模型发布页及项目内部契约 `docs/anima-reproduction-protocol.md`
