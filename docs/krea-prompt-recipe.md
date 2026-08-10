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

### Krea 散文段（`naturalDescription`）

官方段 → 本地实现：

| 官方段 | 本地来源 |
|---|---|
| 风格配方（最前） | `plan.style`（配方 lead；来自 `src/config/kreaStyleRecipes.ts`） |
| 主体身份+姿态 | `character.identityProse`（原样织入，禁止逗号切碎） |
| 服装/材质 | `outfit.prose`（原样织入） |
| 构图/镜头 | `plan.camera` + `plan.composition`（织成自然取景句） |
| 环境背景 | `blueprint.promptProse`（原样织入） |
| 光照/色彩/情绪 | `plan.lighting` + `plan.emotion`（织成自然氛围句） |
| 后置媒介词 | `plan.medium`（配方 medium，收尾） |

约束：无 meta 短语；无下划线 token（不落原始 Danbooru 标签）；identityProse/outfitProse/promptProse
整段保留；`<lora:>` 一律剥离；不进入故事/台词/心理活动。

### Krea 风格配方（`src/config/kreaStyleRecipes.ts`）

- 每配方 = 前置风格短语 `lead` + 可选后置媒介词 `medium`。
- ≥8 个通用配方 + 独立显式的 R18 配方（id 以 `r18_` 开头，`adult: true`）。
- 解析顺序：**手选 > 蓝图 hint > 引擎缺省**（`resolveStyleRecipe`）。
- **R18 fail-closed**：`recipeEligible` 要求 `adultEligibility === 'adult'` 且成熟内容开关开启；
  unknown/underage 永远不可达。`buildPopularPromptPlan` 对 `style.adult` 再兜底拒绝一次。
- 蓝图可选字段：`kreaStyleHint` / `animaStyleHint`（`data/scene-blueprints.json`）——可以是配方 id 或自由风格短语；
  成人配方 hint 只允许挂在成人蓝图上（`validate-content-contracts.js` 校验）。
- Anima 流行模式同样受益：只取 `lead` 作风格短语前缀，保持 exact-token + prose 混合结构，不碰 Anima 负面。

### 持久化与 UI

- `kreaStyleId`（null = 自动）写入草稿（`aics_pb_last_draft`）与历史条目，旧数据缺省自动，向后兼容。
- 专家模式右栏 `#stepRecipe` 可选配方；场景模式用默认。配方随角色/成熟开关切换自动清除非资格项。
- 蓝图 hint 参与 `DATA_VERSION`（`data/*.json` 内容哈希派生）。

## 验证

- `scripts/tests/test-popular-content.js`：散文段落流（风格前置/无 meta/无标签堆砌/原样织入）、R18 门控 fail-closed、
  配方解析顺序、hint 解析、persistence round-trip。
- `scripts/tests/test-prompt-compiler.js`：渲染层散文段 + 风格 lead 在前 / medium 收尾。
- `scripts/maintenance/validate-content-contracts.js`：配方契约 + 蓝图 hint 成人约束，随 `DATA_VERSION`。
- E2E `tests/e2e/anima-quick.spec.ts`：专家模式选配方 → 请求体含配方短语；R18 配方对 underage 不可见。
