# 先进 AI 工作流／提示词工坊／模型调试工具深度调研，及对 AI-CG-Studio 的落地构想

> 调研基线：2026-08-15
> 范围：ComfyUI Web 现代生态、OpenArt、PromptHero、InvokeAI、Krita AI Diffusion、SD-Forge
> 对标对象：AI-CG-Studio（已有场景模式自动推断、专家模式三引擎编译、18 位热门角色蓝图、作品备份）
> 本文件 = 外部调研（官方文档／仓库／社区，标注置信度）+ 对本项目源码/文档的现状核对 + 可落地构想。
> 调研分四路并行完成：①ComfyUI 现代生态 ②InvokeAI/Krita AI Diffusion/SD-Forge ③统一多引擎抽象 ④OpenArt/PromptHero（提示词工坊）。

---

## 0. 结论先行

AI-CG-Studio 已经在「统一多引擎抽象」上做得比大多数同类工具更彻底——`PromptPlan` + `ModelProfile` + 三引擎「同一意图→各自渲染」的分层，已经是行业里 mold 这类重型抽象才有的形态。它真正欠缺的，是把已经存在**服务端与脚本层**的「受控 A/B、多 seed 选片、逐图审核」方法论，升级成**用户眼前、点击即得的创作生产力武器**。

本调研把外部先进工具的本质浓缩成 4 个维度，提炼出对 AI-CG-Studio 最值得迁移的 **6 条落地构想**（按收益/可行性排序）：

| # | 精髓 | 一句话 | 落地难度 | 画质上限贡献 |
|---|---|---|---|---|
| 1 | **候选集 + 单轴矩阵**（吸收 SD-Forge XY Plot、InvokeAI 参数扫描、ComfyUI Grids） | 把已存在的「同 prompt 多 seed + 挑优」升级成 Grid UI + 仅变单轴 | 低（复用 useSDQueue） | ★★★★★ |
| 2 | **Prompt 工坊 / 模板变量化**（PromptHero Dynamic Prompting、InvokeAI Workflow） | `{选项A\|选项B}` 模板展开成多组候选排队 | 中 | ★★★★ |
| 3 | **反推分词 + 一键补全**（ComfyUI Tagger / Florence2，InvokeAI interrogate） | 从一张图反推成结构化视觉分词，回填到 Prompt 面板 | 中 | ★★★★ |
| 4 | **局部重绘/掩码修复编辑器**（InvokeAI Canvas、SD-Forge inpaint 蒙版、Krita 图层） | Canvas 手绘蒙版「只修所选区+保留外部」，解决手/脸崩坏 | 高 | ★★★★★ |
| 5 | **Face/Hand 自动检修通道**（ComfyUI Impact Pack Detailer、ADetailer） | 出图后一键自动贴补脸手，不等人工挑图 | 中（依赖模型） | ★★★★★ |
| 6 | **能力探测打通 UI**（mold capabilities、Civitai metadata） | 把「该引擎能否负面/权重/LoRA」从代码硬编码升级为可查询 Profile | 低 | ★★ |

---

## 1. 四维度的外部精髓总览

### 1.1 提示词矩阵与多轴对比（Prompt Matrix & X/Y/Z Plot）

**ComfyUI 现代生态**
- ComfyUI 本身**没有内置 XY Plot**，矩阵主要靠 custom nodes。核心机巧是：**把任意参数声明成数组（循环）→ 固定 pipeline → 同一 Seed → latent batch 叉乘 → 自动拼和 + 每格标注参数**。
- 代表工具（生态正从停维护的 Efficiency Nodes 迁移到新项目）：
  - [Comfy-Easy-Grids](https://github.com/shockz0rz/comfy-easy-grids)
  - [ComfyUI-KSampler-Matrix-Lab](https://github.com/btitkin/ComfyUI-KSampler-Matrix-Lab)
  - [ComfyUI-Flux-XY-Plot](https://github.com/markuryy/comfyui-flux-xy-plot)
- 精髓：**同一 Seed 下只变单轴做 A/B**——你的 `prompt-image-quality-roadmap.md` §11 已经精准描述了这一点，缺的是把它做成产品。

**InvokeAI**
- **Board + Beam/Batch**：Gallery 用 Board 组织图集，同一批次多张并排置于 Beam，天然适合并排查看。
- **Dynamic Prompting（动态提示）**：官方概念页，一种参数式模板（`{option1|option2|...}` 花括号选择）自动展开成多组合。参见 [Dynamic Prompting 概念](https://invoke.ai/concepts/dynamic-prompting/)。
- **固定 seed 参数扫描**：支持在固定 seed 下扫描参数组合（variation/iteration），输出多张对比图，参见 [参数扫描 PR #2831](https://github.com/invoke-ai/InvokeAI/commit/832316986401837dc9784ee414d51649d855161f)。

**SD-Forge**
- 内置完整 **XY/Z Plot** 脚本（继承 A1111）：支持 prompt S/R（替换）、checkpoint、sampler、CFG、steps、seed 等轴，网格化出对比图。参见 [XY/Z Plot | DeepWiki](https://deepwiki.com/AUTOMATIC1111/stable-diffusion-webui/9.1-xyz-plot)。
- 社区扩展补强：Forge-Grid-Sampler-Scheduler 做 sampler×scheduler 网格/批量对比。

**OpenArt / PromptHero**（提示词工坊端）
- **OpenArt**：以 **Model Explorer** 让同一 prompt 在 100+ 模型间一键产出对比（模型级网格），统一面板对接 Midjourney/DALL-E/SDXL/Flux 等供应商。参考 [OpenArt Create](https://openart.dev/create)。
- **PromptHero「参数即元数据」**：每条 prompt 详情页固化 `Steps / Seed / Sampler / CFG / size / model hash / denoising` 等完整参数，使 A/B 结果**可复现、可按 CFG 筛选**。**variable prompts / wildcards**：用 `{}` 占位符 + 词库做批量套用与随机生成（AUTOMATIC1111 的 `prompts/wildcards/*.txt` 同机制）——这是「提示词工坊」把 prompt 升级为`可复现、可参数化、可批量、可收藏`的一等资产的核心。

> **对标结论**：本项目已有「与上一张对比」覆盖层和「seed 锁定/复用」，但没有 XYZ Plot 式的多候选网格。`useSDQueue` 串行队列天然适合作为「候选集」执行器——**把候选集 + 单轴矩阵放在队列之上**是最顺的落地路径。两条额外启发：**(a) 每条历史记录要固化「完整可复现参数」（供一键换参重跑 / 网格轴取值）；(b) 「同一 prompt 切多引擎」本身就是引擎调试的默认网格视图**。

### 1.2 场景与视觉分词（Visual Tagging & Scene Parser）

**ComfyUI 生态**
- **Tagger 反推**：WD14 Tagger（Danbooru 标签分类器）反推出角色/风格/属性标签；Florence2、JoyCaption、Qwen2-VL 等 VLM 反推出更丰富的自然语言描述。
- **TagClassifier 式解析**：对反推结果做「类别→去重→赋权→模块化」，拆成风格/景别/光照/服装独立子字段，每类可开关替换接入工作流。

**InvokeAI**
- **Workflow / Node Editor 双模式**：Linear UI（文本区线性编辑）与 Node Graph（节点图）；Workflow 是结构化 graph 的容器/复用模板。参见 [Workflows](http://invoke.ai/development/front-end/workflows/)。
- **interrogate（反推）**：由后端模型从图片抽提示词，可作为创造性参考。

**Krita AI Diffusion**
- img2img + 换景；反推由后端 ComfyUI/A1111 提供，与画布自然集成。

**OpenArt / PromptHero（反推 + 结构化分词）**
- 图→prompt 反向检索生态：`wd14-tagger`（[stable-diffusion-webui-wd14-tagger](https://github.com/67372a/stable-diffusion-webui-wd14-tagger)）对成图做 Danbooru 风格打标，可换 Florence/BLIP；UnPrompt、Tutu AI 等反推工具支持上传图→反推并编辑 prompt。
- **OpenArt Director / Chat Image Editor**：把自然语言故事转成镜头/光照/构图结构（[OpenArt Director 教程](https://aiindigo.com/tutorials/getting-started-with-openart-director-mastering-ai-image-generation-workflows)）——这与本项目 `sceneInference` 的「故事→镜头/光照/构图」推断同构。

> **对标结论**：本项目**完全没有反推/视觉分词能力**。服务端无 interrogate/tagger 端点；唯一视觉通道是维护脚本 `image-inspect.js`（本地 CLIProxyAPI + gemini-3.7-flash-high）。现有 `PromptPlan` 已是现成的「风格/景别/光照/服装/情绪」结构化壳——**反推结果如果能结构化成 PromptPlan 字段回填，就能和现有渲染器零摩擦对接**。这是本项目最具特色的机会：别的工具反推的是「一段字符串」，本项目能反推成「可直接进编译器的结构化意图」。OpenArt Director 证明「一句话→导演结构」的产品形态是成立且受欢迎的，本项目已有该推断内核，缺的是「从图反推」这一侧。

### 1.3 局部重绘与修复（Inpainting & Masking UI）

**InvokeAI（杀手锏）**
- **统一画布（Color Map Canvas / UNIFIED_CANVAS）**：在画布上以 Base/Overlay 图层绘制蒙版，配合 inpaint 用**颜色填充语义**（str 大色块框定区域），支持**渐变蒙版**（gradient mask）、蒙版笔刷与套索选区。参见 [INPAINTING.md](https://github.com/invoke-ai/InvokeAI/blob/development/docs/features/INPAINTING.md) 与 [Gradient Mask PR](https://github.com/invoke-ai/InvokeAI/pull/5769)。
- **fit-to-image**：画布自动适配/锁定生成尺寸。

**SD-Forge（能力最强）**
- **独特 inpaint 特性**：蒙版**只对蒙版区域采样**、**保留蒙版外细节**、latent reinject（复用原图 latent）、**VAE 重用**；inpaint 画布即时本地编辑（显示蒙版、右键快速填充 Sam/Eraser）。参见 [Forge Classic README](https://github.com/lllyasviel/stable-diffusion-webui-forge)（reForge master 亦记录）。
- **Face/Hand Detailer**：After Detailer（ADetailer）自动蒙版+二次 inpaint 重建脸部/手部，参见 [sd-forge-adetailer](https://github.com/hinablue/sd-forge-adetailer)。
- **refiner 管线**：base+refiner 多步高质量路径。

**Krita AI Diffusion**：直接在 Krita 图层上绘制蒙版，与画笔自然集成，所见即所得局部重绘。

**OpenArt / Civitai 生态（蒙版 + 自然语言）**
- Civitai 生态以公开 ComfyUI 工作流落地蒙版重绘（如 [Flux.2 Klein Inpaint/Outpaint](https://civitai.com/models/449322)、[SDXL Outpainting](https://civitai.com/models/837151)）。
- **OpenArt Chat Image Editor**：拖拽选区后用自然语言「改这里」补句，而非纯手调权重——「**笔刷画选取区 + 自然语言指令**」是现代局部编辑的心智模型。
- Face/Hand 修复独立 tab：内部走「局部 inpaint + detailer」，而非全图重绘。

> **对标结论**：本项目目前**只有 WebUI 后端的 ADetailer 脸补丁脚本**（`sdRequest.ts` makeADetailerArgs），且 `faceDetailer` 只在直出高分辨率时启用；**没有任何 img2img / inpaint / 掩码绘制 UI**。`prompt-image-quality-roadmap.md` §11.5 的 F1–F4 已经论证「手/脸要局部修，不污染全局 Prompt」，这是画质上限提升最直接、最被低估的一环——**「修复」不是加功能，是把已经超标的「角色 CG」从 70 分拉过 90 分的钥匙**。OpenArt 的「画选取区 + 补一句指令」提示我们：蒙版 UI 不必做成复杂的颜色填充语义，**画笔 + 一句自然语言补句**对本地个人使用更轻、更直觉。

### 1.4 统一多引擎抽象（Multi-Model Family Abstraction）

**业界主流三层抽象**：
1. **模型 Family 判定层**——ComfyUI 用内部结构 + SSD 探测；InvokeAI 无法识别时归入 "Unknown model"，由 Family 决定 loader。
2. **Per-Family Loader Registry**——InvokeAI 的 `model_loader_registry` + 各 `model_loaders/{stable_diffusion,flux,...}.py`；Anima 作为新 Family 经 [PR #8961](https://github.com/invoke-ai/InvokeAI/pull/8961) 加入。ComfyUI 拆成 `SubcheckpointLoader/CLIPLoader/VAELoader`，把 checkpoint 与 CLIP/VAE 独立替换解耦（异构编码器可互换）。
3. **能力/Profile 层**——最贴合现实模板是 `utensils/mold`：`capabilities_for_family("flux")` 按 Family 声明是否支持 negative/LoRA/scheduler，切换模型时带回能力集并统一 generation profile 契约。参见 [mold PR #985](https://github.com/utensils/mold/pull/985)；Civitai 提供 `BaseModel/BaseFamily` 枚举作为外部元数据契约。

**关键设计建议（来自 multi-engine 调研）**：
> **不要做「统一模型类型」，做「Family + capability」两个正交维度**——Family 决定 load 路径与编码器（CLIP vs Qwen），capability 决定 UI 暴露哪些交互（negative/权重/LoRA/hires）。

**参数字典归一化**（`GenerationOptions` 参考 mold）：
```
GenerationOptions {
  prompt, negativePrompt, width, height, steps,
  cfg,        // 统一"引导强度"：SD=CFG；Flux/Anima 无 CFG 时映射到 guidance
  samplerId,  // 规范化采样器名 → 各后端翻译表
  schedulerId,// 规范化调度器 → scheduler/shift/sigma 默认
  seed, seedMode,
  assets: { lora[], textEncoder, vae, refiner, ... }
}
```
**能力探测清单**：
- `supportsNegative`（Krea2 恒空、Flux 一般无）
- `supportsWeightSyntax`（`(tag:1.2)`，Krea2 禁用）
- `supportsLora` + `loraTrigger`（触发词，作为模型元数据）
- `supportsRefiner/hires`（SD1.5/SDXL 有，Flux 一般无）
- `textEncoderFamily`（CLIP / T5 / Qwen3-VL / Qwen tag encoder）
- `tokenSeparator`（下划线 vs 空格）、`preferredResolutions`、`guidanceRange`

**CFG/guidance/shift/rebalance 应作为独立「参数包」**，由 Family 决定默认值并落到 sampler 或 conditioning 层——Krea2 的 `ConditioningKrea2Rebalance`（preset/multiplier）与 HF diffusers Krea2 管线正是这样切分的。

**OpenArt 的供应商抽象**：一个统一参数面板（尺寸/seed/采样/负向）被映射到各供应商私有参数（100+ 模型），常走中间抽象层 `tti-middleware` 这类跨供应商 TTI 网关。核心理念与 mold 一致：**统一 schema + 每个引擎一个 provider 做字段映射，切换只换 provider**。

> **对标结论**：AI-CG-Studio 在这条上已经**领先大部分工具**——`PromptPlan`+`ModelProfile`+`renderPromptPlan(family)`、`capability`（`noLora`）门控、`routes/anima.js` 的模型白名单（含 Krea2 rebalance 参数）都是成型抽象。缺口是：**能力探测目前是零散硬编码**（`anima=false` 双人禁用、`krea2` 无负面是写死在 UI/编译器的），没有集中成可由 Profile 驱动的 capability 表，导致「哪些交互该暴露」仍靠代码分支判断，而不是数据驱动。

---

## 2. 对标 AI-CG-Studio 的词条与画质上限诊断

### 2.1 已经很强、不需要动的部分

- **场景模式自动推断**（`sceneInference.ts`）——镜头/光照/构图/情绪/色彩/画幅的确定性推断 + 互斥组消解，已经是顶级的低认知负担入口。
- **三引擎编译**（`promptCompiler.ts` + `promptPolicy.ts`）——`PromptPlan` 把「同一视觉意图渲染成 WAI 标签流 / Anima 标签+caption / Krea 自然语言」做成了数据层，跨引擎抽象超过同行。
- **18 位热门角色蓝图**（`popularContent.ts` + `scene-blueprints.json`）——含身份词/服装/成人 fail-closed 门控，是「无 LoRA 出角色」的高度工程化实现。
- **作品备份**（`useBackup.ts`）——已有。

### 2.2 瓶颈（对「创作生产力」与「画质上限」的差距）

1. **缺乏「候选集 / 单轴矩阵」产品面**：研究文档 §11 明明确确说要「多 seed 选片」「同 seed 短长 Prompt A/B」，但 UI 仍是「一次一张 + 与上一张对比」，没有 Grid。**出图率靠运气，用户没有选择的武器。**
2. **完全没有「反推/视觉分词」回填**：没有从参考图反向生成结构化 Prompt 的路径，创作无法「以图养图」。
3. **局部修复极弱**：只能靠 WebUI 的 ADetailer 脸补丁，无法手绘蒙版修手/背景/局部；而社区共识（`prompt-image-quality-roadmap.md` §5.5）恰恰是「手/脸/局部走 detailer/inpaint，不污染全局」。
4. **能力探测未数据化**：多引擎抽象很高级，但「该引擎能否 X」仍是散落硬编码，不利于未来继续接引擎。

---

## 3. 对 AI-CG-Studio 的 6 条落地构想

> 落地原则：**本地个人使用的轻量优雅**；**不破坏现有契约**（R18 默认、三引擎、菜单、队列、备份、配音）；**遇难先搜、先照抄经证实的机制再定制**。
> 每一条都指出**复用的现有模块**，避免重复造轮子。

### 构想 1：候选集 + 单轴矩阵（最高性价比，优先做）

**精髓来源**：SD-Forge XY Plot、InvokeAI 参数扫描、ComfyUI Grids、`prompt-image-quality-roadmap.md` §11 既定方案。

**现成复用**：`useSDQueue`（串行队列，上限 8）、`generationApi.createJob`（单 job，可并发入队）、`promptBuilderStore.HistoryEntry.parent_id`（**当前恒为 null 的字段——正好用它把候选批次挂成一组**）。

**具体落地**：
- 新增「生成一组候选」按钮（场景模式也已计划）：固定当前 Prompt/模型/参数/画幅，**只变 seed**，N=3（对齐项目「3 seed 挑优」的实证结论，不退回 20 seed 抽奖）——N 个 job 依次入 `useSDQueue` 串行跑。
- 队列完成一个，把结果 blob + 对应 seed + `parent_id=<batchId>` + `preview: true` 记录到历史（不入册为正式作品，避免污染作品册）。
- 新增「候选网格」覆盖层（组件 `GenerationCandidateGrid`，替换/扩展现有 compare 覆盖层）：N 张图网格展示，每格标注 Seed 与「选为本组标杆」按钮；选中的一张升格为 result（取消 preview 标记）。
- 进阶：**单轴矩阵**——在候选集基础上，允许「固定同一个 seed、只变一个轴」：
  - 轴 A：**画师**（`artistStyleIds` 的 2~3 个候选，绕开`normalizeArtistStyleIds` 的 `limit=2`，改为矩阵模式允许 3）
  - 轴 B：**LoRA 权重**（0.7/0.85/1.0，`resolveLoraSpecs`/`loraSpecs` 已支持传入权重）
  - 轴 C：**采样器/CFG/steps**（`ModelProfile` 已带 sampler/steps/cfg，网格即可枚举）
  - 轴 D：**Prompt 短长**（现有 `concise` 开关就是天然的 A/B 轴）
- **网格 cell 标注**：每格角标显示「该格变化了什么」（参考 XY Plot 的 cell 注释），让用户一眼看出哪个变量导致差异——这正是「盲审 A/B」进阶到「可见归因 A/B」的关键。
- **参数即元数据（来自 PromptHero）**：候选集的每个成员都持久化「完整可复现参数」（seed/CFG/steps/sampler/model hash/size），让任何候选**一键换参重跑**、并作为网格轴取值来源。可复现，才能谈「网格归因」。
- **「同一 prompt 切多引擎」作为默认引擎调试网格**：在引擎切换区（`engine-switch`）旁加一个「三引擎对比」按钮，同一结构化意图用 WAI/Anima/Krea 各出一张并列——这本身就是最直观的引擎能力调试视图（OpenArt Model Explorer 同构），也天然落到构想 3 的「同一意图多引擎分发」。

> 为什么这么强：这是把项目里**已经验证**的「3 seed + 挑优 + 同 seed 单变量」方法论，从维护脚本/文档升级成用户眼里的产品，且几乎不新增后端能力（复用队列与 job）。**画质上限贡献在「出片率」而非单图——但出片率就是个人创作最真实的画质上限。**

### 构想 2：Prompt 工坊 / 模板变量化

**精髓来源**：PromptHero variable prompts、InvokeAI Dynamic Prompting（`{a|b}` 展开）、AUTOMATIC1111 wildcards（`prompts/wildcards/*.txt`）。

**具体落地**：
- 在专家模式手动词条输入处，支持 `{短语A|短语B}` 花括号变量的识别：提交时**自动展开成独立候选**（如 `{smile|blush}` → 两个版本），复用构想 1 的候选集执行器各跑一遍。加 `__词库名__` 从内置/用户词库随机铺排（wildcards 机制），批量出变体。
- 不引入新的模板 DSL，就在现有 `sanitizePrompt`/`dedupeText` 之外加一个极薄的「花括号展开」函数，产出 N 条候选 Prompt 全部走同一 `renderPromptPlan(family)`。
- 与构想 1 天然合流：变量展开 = 一条「单轴矩阵（prompt 轴）」。
- **prompt 资产化**（来自 OpenArt/PromptHero「提示词工坊」概念）：把 prompt 视为一等资产——记录 hash、模型版本、来源、改动历史；支持**收藏**与「从此条 fork 新版本」。当前 `HistoryEntry` 已含 `parent_id`/`project`/`favorite` 字段，正是资产化链路的现成骨架。
- 进阶：把当前场景的完整决策（角色+服装+镜头+光照+构图+手动词条）保存为**可复用「食谱（recipe）」模板**（对齐 InvokeAI Workflow/recipe 概念），在 PromptBuilder 里一键套用于其它场景。

> 为什么强：个人创作最贵的成本是「反复构建同一类画面」。模板变量化让它变成一次构建、多处套用。**生产力贡献显著，且完全本地、零后端。**

### 构想 3：反推分词 + 一键回填（「以图养图」）

**精髓来源**：ComfyUI WD14/Florence2 Tagger + TagClassifier 模块化、InvokeAI interrogate、OpenArt「一句话→导演结构」Director、Tutu/UnPrompt 反推。

**具体落地**：
- 复用项目现成的视觉通道思维：维护脚本 `scripts/maintenance/image-inspect.js`（本地 CLIProxyAPI + gemini-3.7-flash-high）已能对图片做结构化识别。新增**轻量只读反推端点**（`/api/generation/reverse` 或维护路由），接受一张图，返回结构化的 `{ style, shot, lighting, clothing, mood, tags[] }`——**注意：这只做参考解析，不重新出图**，避免新增 GPU 依赖。
- 反推可分层：WD14 风格 tagger（Danbooru 打标，服装/景别/光照/肢体）做粗粒度回填，VL（现有 gemini 通道）补镜头/构图/光影的自然语言解读——两者都折成 `PromptPlan` 的可变字段。
- 前端：作品册/Gallery 每张作品新增「反推为 Prompt」操作——把反推结果直接**结构化成 `PromptPlan` 字段回填到 PromptBuilder**（这正是本项目相对其它工具最大的差异化：反推出来的是能进编译器的结构化意图，而非一句话）。
- 对角色 CG：反推结果再叠加 `characterControlTokens`/`identityAnchors` 打底，保证角色锚点不丢。只把**非身份类**视觉分词（镜头/光照/服装/环境）作为可变部分回填。

> 为什么强：创作闭环从「写→画」变成「见图→补全→改画」，极大降低从零构思成本。**这是把 AI-CG-Studio 的「结构化 PromptPlan」资产变成反推引擎的依据，别人抄不走。** OpenArt Director 已证明「故事→导演结构」产品形态成立，本项目只需为其补上「图→结构化分词」这一镜像能力。

### 构想 4：局部重绘/掩码修复编辑器（画质上限跃迁的关键）

**精髓来源**：InvokeAI UNIFIED CANVAS（颜色填充语义蒙版 + gradient mask + 保留区域语义）、SD-Forge inpaint「只修所选区+保留外部」、Krita 图层画笔、OpenArt「笔刷画选取区 + 自然语言补句」。

**具体落地**（本地优雅、渐进式）：
- **服务端**：为 WAI WebUI/Comfy 增加**受限 img2img fix** job 契约（`/api/generation` 扩展 `modes.img2imgFix`），接受 `image + mask(黑白 PNG) + prompt + params`，服务端按固定工作流执行「**蒙版外保留 + 蒙版内重绘**」（借用 Forge 的 `inpaint_only_masked` + `latent reinject` 思路，或 Comfy 的 `Mask` 前端打包 + 二次 KSampler on masked）。**禁止浏览器直传任意 img2img image；只允许把「刚刚生成的、且仍在应用内 result blob」作为 fix 源**，保持路径 containment 安全模型。
- **前端**：画布组件（复用 `measureBlob`/`imgPut` 能力），在成图上让用户**用画笔/橡皮涂抹蒙版**（前景擦、画蒙版），蒙版以红/绿叠加可视化；可一键「扩蒙版/模糊边缘」。采用 **OpenArt 的「画选取区 + 一句自然语言补句」** 作为初版交互（比颜色填充语义蒙版更轻）：用户涂抹红框 + 输入「重画这只手/加一顶帽子/把背景换成夜晚」的自然语言指令，其余交给固定 fix 管线。
- **集成点**：在 result 面板新增「局部修复」入口——把 ADetailer（已有脚本）从「只能自动脸补」升级为「用户指定蒙版区域 + Fix」。接入 `sdRequest` 的 inpaint 分支与 `denoising_strength`（已在 `prompt-image-quality-roadmap` 论证的修复参数）。
- **R18 约束**：蒙版修复同样受 `rating` fail-closed 门控（adultEnabled=false 不得允许对成人作品做显式内容修复——服务端校验 source result 的 rating）。

> 为什么强：社区共识与项目文档都指出**手/脸/局部是单图从 70→90 分的分水岭，且不应靠继续堆全局 Prompt**。这个编辑器是本项目画质上限提升最直接的工具，但工程量大，建议放构想 1/2 之后。

### 构想 5：Face/Hand 自动检修通道

**精髓来源**：ComfyUI Impact Pack `FaceDetailer`（检测→detail 模型贴补→回贴）、ADetailer、OpenArt/Civitai 生态的「脸部/手部一键修复独立 tab（局部 inpaint + detailer，而非全图重绘）」。

**具体落地**：
- 把当前只能依赖 WebUI 的 ADetailer 脸补丁，升级成**出图后对失败的（尤其手/脸）一键重跑**：服务端新增「detailer 通道」job（对齐 Impact Pack 的「检测蒙版 → detail 二次采样 → 回贴」原子管线），或至少把现有 `faceDetailer` 从「仅直出高分辨率时启用」扩展为「用户可在候选网格中标出『手崩了』后单独对那张图跑 detail 修复」。
- 前端提供独立的「**脸部修复 / 手部修复**」小工具标签（对齐 OpenArt/Civitai 的独立 detail tab，不塞进全局生成开关）：在候选网格 + 大图查看器各提供一个按钮，把「挑中-发现崩坏-修复-重新入选」压到最少点击。
- 依赖前置：需要对应检测模型与 detail 模型（`model-comfyui-expansion-roadmap.md` 已把 detailer 列为**暂缓**，受机器依赖限制）。因此这条**落地优先级取决于本机是否补装 Impact Pack 检测模型**；未装前以「保留现有 WebUI ADetailer + 构想 4 的手动蒙版」为替代。

> 为什么强：把「挑图中发现手崩了→整张重来」改成「单点修复」，是创作生产力的硬提升。但要尊重项目「detailer 需新模型依赖」的既有结论，避免用近似冒充已实现。

### 构想 6：能力探测数据化（多引擎抽象收口）

**精髓来源**：mold `capabilities_for_family`、Civitai `BaseModel/BaseFamily` 枚举、OpenArt/tti-middleware「统一 schema + provider 字段映射」。

**具体落地**：
- 在 `ModelProfile` 上扩展一个显式 `capabilities` 字段，替代散落的 `if engine==='krea2'` 硬编码。推荐初始字段集（对齐 mold `capabilities_for_family` 与 Civitai 枚举思路）：
  - `supportsNegative`（Krea2 恒空、Flux 通常无）、`supportsWeightSyntax`（`(tag:1.2)`，Krea2 禁用）、`supportsLora` + `loraTrigger`、`supportsRefiner/hires`
  - `cfgRange / guidanceRange`、`needsSigmaShift`、`tokenSeparator`（下划线 vs 空格）、`preferredResolutions`
  - `textEncoderFamily`（CLIP / T5 / Qwen3-VL / Qwen tag encoder）——其中 Anima 的 Qwen 标签编码器与 Krea2 的 Qwen3-VL 都属 `llmAdapter` 型，外部调用方式统一但底层 Loader 不同。
- 建立 **engine-agnostic 参数桥**（统一 schema：`seed/cfg/sampler/steps/negative/LoRA`），每引擎一个 provider 做字段映射（对齐 `renderPromptPlan(family)` 与 tti-middleware 思路）——切换引擎只换 provider，不改意图描述。
- 统一 `sceneInference`/`promptPolicy`/UI 组件里的能力判断，全部走 `capabilitiesForProfile(profile)`。
- 新增 `capabilitiesForProfile` 纯函数 + 单测，把「双人 Anima 禁用」「Krea2 无负面」「Aesthetic 无 score」等既有规则收敛为数据驱动。
- 为未来接新引擎（video、ControlNet、更多 DiT）提供统一扩展点——这呼应 `visual-architecture-roadmap.md` 的「按所有权拆分」与「API client Repository」方向。

> 为什么强：本项目多引擎抽象已经很强，这条只是把「最后的硬编码分支」数据化，让接新引擎（VideoStudio 的 Wan、未来大模型）不散落 if。难度低、纯重构收益。

---

## 4. 分阶段实施建议

**P0（最快见效，低风险）**
- 构想 1：候选集（3 seed + 网格 + 选取）——复用 useSDQueue 与 `parent_id` 空字段，0 新后端。
- 构想 2：花括号变量展开 + 候选集合流。
- 构想 6：`capabilitiesForProfile` 收口能力判断（纯重构）。

**P1（中等工程量）**
- 构想 3：反推分词端点（复用 image-inspect 通道）+ PromptPlan 结构化回填。
- 构想 5：Face/Hand 检修通道（**依赖模型前后评估，尊重 `model-comfyui-expansion-roadmap` 暂缓结论**；未装模型前用「构想 4 的手动蒙版」替代）。

**P2（大工程，需专门验收）**
- 构想 4：局部重绘/掩码修复编辑器（画布 + 蒙版 + fix job 契约 + R18 门控）——画质上限贡献最大但成本最高。

> 推荐顺序理由：先做「零后端、纯前端、复用现有队列」构想 1——它的「出片率」提升就有实际画质意义，且立即能给用户手感；局部重绘这类大工程放最后，避免在未验证的 GPU 依赖上铺开。

---

## 5. 不建议做的事（对照项目约束）

- 不引入自定义 Inpaint/Matrix 庞大的第三方 UI 库堆叠（本地个人使用，保持轻量优雅）。
- 不做云端多租户/账号/在线训练（与 `visual-architecture-roadmap.md` 一致）。
- 不在未装 Impact Pack/检测/detail 模型前，把「detailer 通道」宣称成已实现（`model-comfyui-expansion-roadmap.md` 明确「不得用近似冒充」）。
- 不把反推当作「黑盒一键精修」——反推只作参考，最终仍需 `renderPromptPlan(family)` 归一化 + 逐图人工审核（`prompt-image-quality-roadmap` 的选片门槛）。
- 不改 R18 默认开启、缩略图模糊遮罩、三引擎契约、菜单、队列、配音与备份任何既有行为。

## 6. 证据分级与来源

- 官方/仓库（A 级）：InvokeAI docs、sd-webui-forge README/DeepWiki、krea-ai/krea-2、circlestone-labs/Anima 卡、LyliaEngine/waiIllustriousSDXL_v170 卡、Civitai Developer API。
- 社区/实测（B/C 级）：ComfyUI custom node 生态、mold、PTT/CivArchive 社区经验（见 `docs/three-engine-prompt-research.md` 四级证据表）。
- 本项目实测（A 级）：`anima-training-record.md`、`showcase-generation-craft.md`、各场景人工审核链。

（外部来源 URL 见本文第 1 节各维度内联链接，以及 `docs/three-engine-prompt-research.md`「附录 A」与 `docs/prompt-image-quality-roadmap.md`「资料来源」。）
