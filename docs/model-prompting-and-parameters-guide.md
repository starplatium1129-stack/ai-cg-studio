# AI-CG-Studio 旗舰底模提示词与出图参数全景指南

> **状态基线**：2026-08-11
> **适用底模**：WAI Illustrious SDXL v17 | Anima Base v1.0 | Anima Aesthetic v1.1 | Krea 2 Turbo
> **权威依据**：WAI 官方模型卡 (`LyliaEngine/waiIllustriousSDXL_v170`)、Anima 官方模型仓库 (`circlestone-labs/Anima`)、Krea 2 官方 Prompting 文档 (`krea-ai/krea-2/docs/prompting.md`) 及 AI-CG-Studio 训练契约。

---

## 一、 四大底模特性与适用场景对比

| 特性维度 | WAI Illustrious SDXL v17 | Anima Base v1.0 / Aesthetic v1.1 | Krea 2 Turbo |
|---|---|---|---|
| **底模架构** | SDXL 1.0 (Diffusion U-Net) | Flow-Matching + Qwen LLM Text Encoder | DiT Fast Diffusion |
| **优势领域** | 经典二次元 2D Anime CG、角色极度还原 | 影视级光影、大光圈质感、高清背景 | 超快速渲染、自然语言散文极佳 |
| **角色 LoRA 支持** | 支持 (`v18` 系列，场景作者权重 0.52~0.95) | 支持 (`v20` 专属 Transformer LoRA，`L_NENE_V20B_ANIMA` / `L_NAT_V20_ANIMA`) | 无 LoRA (依靠纯 Prompt 描述) |
| **提示词范式** | Danbooru 下划线标签 | 空格分隔 Tag + 唯一标签流 | 100% 英文自然语言散文 |

---

## 二、 底模出图推荐参数表（排坑核心）

⚠️ **非常关键**：不同底模的文本编码器与扩散机制不同，**CFG 绝不能通用**！

| 参数项 | WAI Illustrious v17 | Anima Base/Aesthetic | Krea 2 Turbo |
|---|---|---|---|
| **CFG Scale** | **6.0** | **3.0**（当前应用生产 preset；4.5 为历史官方参数对照） | **1.0**（固定） |
| **采样器 (Sampler)** | `Euler a` | `er_sde` | `euler` |
| **调度器 (Scheduler)** | `normal` | `sgm_uniform` | `simple` |
| **采样步数 (Steps)** | **30 步** | **30 步** | **8 步**（固定） |
| **推荐分辨率** | `1024×1344` / `832×1216` | `832×1216` / `1024×1024` | `1024×1024` / `1024×1536` |
| **Negative Prompt** | 官方前缀 + 手/解剖/文字保护 + 场景排除 + rating 安全 | 官方前缀 + 手/解剖/文字保护 + 场景排除 + rating 安全（独立于 SD 负面开关） | **完全不填写 (留空)** |
| **Hires** | 自动策略：WebUI Anime6B → Comfy nearest-exact Latent → 审计直出；1.5× / 20 steps / denoise 0.40 | 不开启/依赖底层原生像素 | 不开启 |

---

## 三、 四条模型原生 Prompt 渲染路径（确定性契约）

### 1. WAI Illustrious SDXL v17（SD 引擎）
- **格式**：单一逗号标签流，Danbooru 下划线。
- **官方质量前缀**：`masterpiece, best quality, amazing quality` —— 必须**原样保留空格**、且全 Prompt 只出现一次（`src/utils/promptPolicy.ts` 的 `qualityPrefix` 对 SD 不再 norm 回下划线）。
- **Rating**：`general` / `sensitive` / `nsfw`（按场景分级）出现且只出现一次。
- **基础模式无手动画师层**：基础模式只选择场景与底模；风格、镜头、光照、构图和参数由场景与模型 profile 自动确定。专家模式可从 12 位白名单画师中最多混合 2 位。
- **标准范例**：
  ```text
  masterpiece, best quality, amazing quality, general, 1girl, solo, ayachi_nene, nene_school_uniform, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, hair_ribbon, school_uniform, looking_back, smile, classroom_window, afternoon, clear_sky, medium_shot, window_light, <lora:ayachi_nene_v18_wd14:0.8>
  ```

### 2. Anima Base v1.0（Anima 引擎 · 有 LoRA）
- **格式**：模型原生**单一标签流**负责 LoRA 精确控制；工作室场景可在换行后追加 **1 句短英文方向 caption**，只补空间、动作或道具关系；没有风格前置句。
- **质量与评分前缀**：`masterpiece, best quality, score_7` + 分级词 `safe` / `sensitive` / `nsfw`。
- **通用标签小写 + 空格**（`school uniform`, `white hair`）。
- **只有 score 与选中 LoRA 的精确契约 token/前缀保留下划线**（`score_7`, `ayachi_nene`, `shiki_natsume`, `nene_r18`, `nene_school_uniform`, `natsume_official_qipao`…）。
- **LoRA 契约来源**：`src/composables/usePromptAssembly.ts` 从 PromptBuilderView 传入的服务端 LoRA id（`L_NENE_V20B_ANIMA` / `L_NAT_V20_ANIMA`）解析 `loras.json` 的 `prompt_contract`，不再硬编码旧文件名。
- 工作室 caption 优先读取场景 `animaCaption`；无专用值时只从可见动作、环境、镜头、光照与用户「画面描述」生成单句，不重复身份、服装、情绪或通用质量口号，也不读取故事、台词、标题、搜索或审核元数据。
- 热门角色无 LoRA 路径仍织入角色身份、所选服装和蓝图场景散文，因为没有角色 LoRA 可提供身份约束。
- **标准范例**：
  ```text
  masterpiece, best quality, score_7, safe, 1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, nene_school_uniform, hair_ribbon, school uniform, looking back, smile, classroom window, afternoon, clear sky, medium shot, window light, blush, shy, classroom
  Ayachi Nene uses one hand to adjust her pink hair ribbon while her other arm holds lecture papers beside a classroom window.
  ```

### 3. Anima Aesthetic v1.1（Anima 引擎 · 无 LoRA / 热门角色）
- **格式**：热门角色无 LoRA 时使用标签流 + 身份/服装/蓝图散文；工作室 Aesthetic 场景仍使用单句短 caption。
- **正层去掉全部质量词与 score 词**（`masterpiece`/`best quality`/`amazing quality`/`score_7` 等一律不出现），只保留分级词与身份/服装/场景 token。
- **负面去掉 score 词**（`score_1/2/3` 等不出现）。

### 4. Krea 2 Turbo（Krea 引擎）
- **格式**：100% 英文自然语言散文，**3~5 句确定性视觉描述**，由既有场景字段/标签、主体、服装、动作、表情、环境、镜头和光照分层组装（`buildStructuredKreaDescription`），不要求改 298 个场景 JSON。
- **禁用**：下划线、`<lora:>` 语法、score/质量/分级词、`(tag:1.2)` 权重、负向 Prompt、机械标签堆砌。
- **标准范例**：
  ```text
  A cinematic anime wallpaper composed like a polished visual novel event CG. Ayachi Nene is the only prominent character, a young adult woman with white hair, purple eyes, an ahoge, and pink hair ribbons, wearing her navy school uniform with a blazer, yellow bow tie, pleated plaid skirt, and black thigh-highs. She is looking back over her shoulder and holding a stack of papers, while her expression is gently smiling, softly flushed, and shy. The scene takes place in the afternoon beside a classroom window. The composition uses upper-body framing and a medium shot, while the scene is lit by soft window light.
  ```

---

## 四、 Negative 装配（profile 原生，统一入口 `assembleNegative`）

- **顺序**：官方前缀 → 场景非样板排除词（generic boilerplate 由 `replace/boilerplate` 策略移除）→ **紧凑手/解剖/文字保护**（`bad anatomy, bad hands, extra fingers, missing fingers, extra arms, extra legs, deformed, text, watermark, logo, signature`）→ rating 安全（R18 加 `child/loli/underage`，其余加 `nsfw/nude/explicit`）。
- **Krea 恒空**；Anima 负面**独立于 SD 负面开关**（basic 模式同样生效）；只有 SD 受「启用负面」开关控制。
- 历史成片负面是「当时场景+当时 profile」的快照，**不会写回自定义负面**（`negativeCustom`），恢复历史后由当前场景+profile 重新生成，避免跨 profile 泄漏。
- **WAI 负面前缀**：`bad quality, worst quality, worst detail, sketch, censor`。
- **Anima 负面前缀**：`worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration`（Aesthetic 再剥掉 score）。

---

## 五、 单人引擎净化（Anima/Krea 工作室角色）

- 只删除**明确可见的额外主体/人数词**（`1boy` / `1man` / `2girls` / `boy` / `man` / `male`…）。
- **保留**：POV、望向镜头、牵手、浪漫氛围、中心互动/动作（`pov`, `looking_at_viewer`, `holding_hands`, `straddling_viewer`, `kiss`, `back_hug`, `cohabitation`…）。
- SD 引擎保留原样（WebUI 有完整双人支持）。

---

## 六、 场景智能推断（`src/utils/sceneInference.ts`）

- 镜头/光照/情调全部使用**精确规范化标签映射**，不做子串推断；情调不扫描中文宽泛子串。
- 构图只有显式字段才返回，否则 `null`；推荐尺寸优先读场景显式 `recommendedSize` 字段，其次精确标签（`landscape`/`portrait`/`square`），最后默认竖幅。

## 七、 一键生成 UI 契约

- 场景模式常驻：引擎选择、唯一底模选择、自动参数摘要、统一「生成图片」按钮、取消、队列和配音。
- Prompt 健康、词条、镜头、光照、构图、情调、seed、采样参数等只在专家模式出现。
- Anima/Krea 详细面板只展示专家参数，不再拥有第二个生成按钮；三引擎统一由 `GenerationOutputControls.vue` 提交和取消。
- 自由输入画师、手选 Krea 风格配方和 Style LoRA 不进入主流程。专家模式的白名单画师选择会写入草稿和历史；切回基础模式后保留选择但不编译进 Prompt。

### 画师风格语法

- WAI / Illustrious：使用规范 Danbooru tag，例如 `kantoku`、`mika_pikazo`。
- Anima Base / Aesthetic：按官方协议使用 `@artist name`，例如 `@kantoku`、`@mika pikazo`。
- Krea 2：转为英文自然语言风格短语，不注入 `@` 或下划线 tag。
- 当前白名单：Kantoku、Shirabi、BUNBUN/abec、Morikura En、Anmi、Rella、Mika Pikazo、Nardack、Fuzichoco、HxxG、SWAV、so-bin。
- 最多两位且默认关闭；强画师风格可能改变角色脸型、上色和服装细节，因此只放在专家模式。

---

## 八、 参考资料与权威出处

1. **WAI Illustrious SDXL v170 官方契约**
   * HuggingFace 模型仓库：[LyliaEngine/waiIllustriousSDXL_v170](https://huggingface.co/LyliaEngine/waiIllustriousSDXL_v170)
   * 官方正/负面模板：`,masterpiece,best quality,amazing quality,` / `bad quality,worst quality,worst detail,sketch,censor,`
   * 四级 rating：`general` / `sensitive` / `nsfw` / `explicit`

2. **Anima 官方模型与提示词指南**
   * HuggingFace 镜像仓库：[circlestone-labs/Anima](https://huggingface.co/circlestone-labs/Anima)
   * 当前应用生产参数：24 steps / CFG 3 / `res_multistep` / `simple`；30 steps / CFG 4.5 / `er_sde` / `sgm_uniform` 仅作为历史官方参数对照，不是当前默认值

3. **Krea 2 官方 Prompting 规范**
   * GitHub：[krea-ai/krea-2/docs/prompting.md](https://github.com/krea-ai/krea-2/blob/main/docs/prompting.md)

---

## 九、 项目现存配置速查

- `data/presets.json`：WAI 30 steps / CFG 6 / Euler a，并自动启用 `Auto` hires 1.5× / 20 steps / denoise 0.4；服务端优先使用 WebUI 的 `R-ESRGAN 4x+ Anime6B`，仅 Comfy 可用时退到 `nearest-exact` Latent，两者都不可用时保留审计过的基础尺寸直出。Anima Base/Aesthetic **24 steps / CFG 3 / res_multistep / simple**；Krea 2 Turbo 8 steps / CFG 1 / euler / simple。
- `routes/anima.js`：`MODELS` 中 Anima Base/Aesthetic 默认 steps 24、CFG 3（后端与前端一致）。
- 语料/金标测试：`scripts/tests/test-prompt-corpus.js`（298 场景全量 + sc001/sc050/sc153/sc280/landscape/triad）。
