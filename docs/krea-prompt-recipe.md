# Krea 2 Prompt 官方配方与本地映射

> 长期文档。本地依据：docs.krea.ai Turbo 页面、github.com/krea-ai/krea-2/docs/prompting.md、
> HuggingFace krea/Krea-2-Turbo System Prompt discussion、fal.ai Krea-2 prompting guide。
> 本文记录官方推荐与本站渲染层的对应关系，改动渲染层前先读这里。

## 官方配方（已核实）

1. **模型**：Krea-2 是单流 MMDiT + Qwen3-VL-4B-Instruct 文本编码器。
2. **提示词形态**：推荐「长的、具体的、流畅的自然语言散文段落」，**明令禁止机械标签列表 / 逗号堆砌**
   （"Avoid mechanical keyword lists or comma-stuffed style; weave everything into coherent, readable prose"）。
3. **段落组织流**：主体+姿态动作 → 外貌/服装/材质 → 道具材质 → 构图/取景/视角 → 环境背景 → 光照/色彩/情绪 → 整体美学与媒介。
4. **风格语言放最前**（"Add style language early"）。
5. **禁 meta 短语**：不要 "In this image..."、"The image shows..." 之类的图片自指。
6. **本地工作流参数固定**：8 steps、cfg 1、euler/simple、零负面 ConditioningZeroOut、qwen3vl CLIP；支持最高 2048px。
   不随 Prompt 改造变动。

## 本地映射

渲染唯一入口：`createPromptPlan` + `renderPromptPlan`（`src/utils/promptCompiler.ts`），
热门角色无 LoRA 路径经 `buildPopularPromptPlan`（`src/utils/popularContent.ts`）喂入。

### Krea 散文段（`buildStructuredKreaDescription`）

官方段 → 本地实现：

| 官方段 | 本地来源 |
|---|---|
| 风格配方（最前） | `plan.style`（配方 lead；来自 `src/config/kreaStyleRecipes.ts`） |
| 主体身份 | 工作室角色确定性英文身份句，或 `character.identityProse` |
| 服装/材质 | 工作室 LoRA 官方服装词包映射，或热门角色 `outfit.prose` |
| 构图/镜头 | `plan.camera` + `plan.composition`（织成自然取景句） |
| 环境背景 | `blueprint.promptProse`（原样织入） |
| 光照/色彩/情绪 | `plan.lighting` + `plan.emotion`（织成自然氛围句） |
| 整体媒介 | 已并入最前方风格句，避免重复媒介尾句挤占 3~5 句预算 |

约束：无 meta 短语；无下划线 token（不落原始 Danbooru 标签）；identityProse/outfitProse/promptProse
整段保留；`<lora:>` 一律剥离；不进入故事/台词/心理活动。

### Krea 风格配方（`src/config/kreaStyleRecipes.ts`）

- 每配方保留前置风格短语 `lead`、模型原生短标签 `sd` 与可选媒介元数据 `medium`；Krea 主流程只需自动解析后的前置风格句。
- ≥8 个通用配方 + 独立显式的 R18 配方（id 以 `r18_` 开头，`adult: true`）。
- 主流程解析顺序：**蓝图 hint > 引擎缺省**（`resolveStyleRecipe` 的手选参数固定传 `null`）。
- **R18 fail-closed**：`recipeEligible` 要求 `adultEligibility === 'adult'` 且成熟内容开关开启；
  unknown/underage 永远不可达。`buildPopularPromptPlan` 对 `style.adult` 再兜底拒绝一次。
- 蓝图可选字段：`kreaStyleHint` / `animaStyleHint`（`data/scene-blueprints.json`）——可以是配方 id 或自由风格短语；
  成人配方 hint 只允许挂在成人蓝图上（`validate-content-contracts.js` 校验）。
- Anima 热门角色模式取配方 `sd` 的模型原生短标签，不把 Krea 自然语言 `lead` 混进标签流。

### UI

- 场景模式不提供手选风格、画师或 Style LoRA；蓝图/场景自动决定风格。专家模式可额外选择最多两位白名单画师，Krea 将其转换为英文自然语言风格短语。
- 草稿与历史不再写入或恢复旧 `kreaStyleId`/`artistInfluences`；新 `artistStyleIds` 白名单选择可恢复。
- 蓝图 hint 参与 `DATA_VERSION`（`data/*.json` 内容哈希派生）。

## 验证

- `scripts/tests/test-popular-content.js`：3~5 句散文流（风格前置/无 meta/无标签堆砌）、服装只出现一次、R18 门控 fail-closed、自动 hint 与草稿忽略旧手选字段。
- `scripts/tests/test-prompt-compiler.js`：渲染层散文段、风格 lead 在前，以及 WAI/Anima/Krea 三套画师语法。
- `scripts/maintenance/validate-content-contracts.js`：配方契约 + 蓝图 hint 成人约束，随 `DATA_VERSION`。
- `scripts/tests/test-prompt-corpus.js`：298 场景 Krea 全部为 3~5 句纯英文，无下划线、质量词、LoRA、权重或负面。
