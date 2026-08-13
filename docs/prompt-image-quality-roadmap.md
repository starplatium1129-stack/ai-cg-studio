# AI-CG-Studio 高质量出片 Prompt 与横竖构图升级方案

> 调研基线：2026-08-13
> 范围：WAI Illustrious SDXL v17、Anima Base/Aesthetic、Krea 2 Turbo，以及现有场景库、Prompt 编译、生成和人工审核链路。
> 本文是实施方案，不直接修改当前 Prompt 默认行为。

## 1. 结论先行

项目下一阶段不应把“出片”简化为增加质量词，也不应把所有引擎统一改成短 Prompt。

建议建立三层体系：

1. **模型原生语法层**：WAI、Anima Base、Anima Aesthetic、Krea 分别使用各自有效的提示词范式。
2. **画幅导演层**：同一场景针对竖图、横图和方图生成不同的构图、主体占比、空间关系与景深指令，而不是只替换宽高。
3. **候选选片层**：高质量成片来自“受控 Prompt + 多 seed 候选 + 人工视觉审核”，不是单次生成碰运气。

优先级最高的工作不是继续堆标签，而是：

- 给场景补齐可结构化的构图意图；
- 将主体、动作、空间关系、光照和画幅分别建模；
- 为横图和竖图建立不同的导演配方；
- 用相同 seed、相同参数做长短 Prompt 和构图策略 A/B；
- 以人工盲审的可用成片率决定默认策略。

## 2. 项目实际情况

### 2.1 已经具备的基础

项目并非从零开始，现有能力已经覆盖：

- `src/utils/promptCompiler.ts`
  - 统一的 `PromptPlan`；
  - WAI、Anima、Krea 分家渲染；
  - Krea 自然语言结构化描述；
  - Anima 标签流与单句方向说明。
- `src/utils/promptPolicy.ts`
  - 模型 Profile；
  - 质量与 rating 前缀；
  - Negative 装配；
  - 镜头冲突消解；
  - 角色 LoRA 权重；
  - Prompt 健康检查。
- `src/utils/sceneInference.ts`
  - camera、lighting、mood、推荐尺寸推断。
- `src/composables/usePromptAssembly.ts`
  - 场景、角色身份、服装、LoRA、镜头、光照和手选词条的生产装配。
- 候选生成和人工审核工具
  - `generate-scene-showcase-candidates.js`；
  - `build-scene-manual-audit-sheets.py`；
  - `publish-showcase-refresh.js`；
  - 现有 SceneAudits 人工审核链。

因此，正确方向是扩展现有结构化编译链，而不是另写第二套 Prompt 系统。

### 2.2 场景语料现状

对当前 `data/scenes.json` 的只读统计：

- 场景总数：298。
- WAI 场景 Prompt 平均约 23 个逗号标签。
- 中位数约 23 个，P90 约 29 个。
- 最长场景约 45 个标签。
- 298 个场景都有 `camera`。
- 298 个场景都有 `lighting`。
- 0 个场景有显式 `composition` 字段。
- 35 个场景有 `recommendedSize`：
  - 34 个横图；
  - 1 个竖图。
- 26 个场景带 `landscape` 标签。
- 只有 15 个场景有人工编写的 `animaCaption`。
- 没有显式画幅时，运行时默认回落到 `832x1216` 竖图。

这说明当前 Prompt 并不普遍超长，主要短板是：

- 大多数场景没有明确说明为什么应该横或竖；
- 横竖图主要改变像素尺寸，没有系统改变构图语言；
- `camera` 有值，但 `composition` 数据层为空；
- 少数复杂动作有人工 Anima caption，大多数仍依赖自动摘要；
- 场景标签同时承担检索元数据、角色约束和视觉控制，优先级不够明确。

### 2.3 正在进行但尚未形成结论的实验

工作区已有未提交的短 Prompt 试验链：

- `scripts/maintenance/short-prompt-builder.js`
- `scripts/maintenance/manual-short-prompt-pilot.js`
- `scripts/maintenance/short-prompt-batch.js`
- `AI/Reviews/ShortPromptPilot`
  - 6 个试点，每个 5 seed，共 30 张。
- `AI/Reviews/ShortPromptBatch`
  - 当前至少 5 个场景，每个 20 seed，共 100 张。
- `AI/Reviews/Sc300Repro`
  - 针对极简、少量词、控制词差异的多 seed 复现实验。

目前这些目录没有形成完整的 `picks.json` 或统一人工评审结论，因此：

- “短 Prompt 更出片”只能视为待验证假设；
- 不能直接把短 Prompt 升级为全站默认；
- 文件大小、生成成功和自动分数不能替代逐图视觉审核。

另外，现有试验脚本存在需要在正式采用前修正的风险：

- `short-prompt-batch.js` 的 rating 处理按场景门控（`short-prompt-builder.js` 仅对 R18/mature 场景注入 nsfw token），但未按安全场景正式审核，不能作为通用安全场景的正式策略；
- 试验统一使用 `832x1216`，无法回答横图质量问题；
- Prompt 变体与 seed 选择同时变化时，无法隔离真正的增益来源；
- 缺少身份、服装、手部、构图、叙事等分维度审核记录。

### 2.4 2026-08-13 修复方案落地与执行记录（原 `quality-outage-fix-plan.md` 并入）

代码侧 P0 已完成，不把需要 GPU、训练数据和人工逐张审核的工作伪报为完成。

**已落地**：

1. Anima 参数契约抽到 `server/anima-generation-contract.js`：
   - 服务端默认固定 `24 / 3.0 / res_multistep / simple`；
   - 手工修复预设固定 `30 / 4.5 / res_multistep / simple`；
   - API 输入白名单、steps/CFG/seed 范围与角色-LoRA绑定由路由和维护脚本共享；
   - `L_NENE_V20B_ANIMA` 强制绑定 `character=nene_b`。
2. 新增 `scripts/maintenance/quality-prompt-contract.js`：
   - 检查角色完整锚点、质量词、评级词、LoRA 质量控制词；
   - 检查场景实体 2-4 个、动作/情绪最多 2 个；
   - 检查 Anima `@artist` 格式和 `@muririn, @kobuichi`；
   - safe prompt 出现显式成人词时直接失败；
   - 提供五维人工审核模板及"三张全部 >=90 才合格"的选片规则。
3. `scene-fix.js`：
   - 固定 3 seed，不再支持 20-seed 抽奖；
   - 宁宁默认 V20B + `nene_b`；
   - 必须显式传 `--steps 30 --cfg 4.5`；
   - prompt 不满足结构门槛时拒绝生成；
   - 生成 `review.json`，只有三张五维评分全部 >=90 才写 `selection.json`。
4. 短 prompt 工具链：
   - `short-prompt-builder.js` 输出结构健康报告；
   - `short-prompt-batch.js` 固定 3 seed，并在整批生成前完成全量预检；任一场景失败则整批停止，不产生部分结果；
   - `sc300-repro-verify.js`、`manual-short-prompt-pilot.js` 从 20/5 seed 收口到 3 seed。
5. 热门角色/画师候选：
   - `generate-showcase-candidates.js` 为每条候选记录附加 `promptHealth`；
   - 保留既有 attempt prompt 和生成历史，不用新规则篡改历史记录。
6. 补充落地（2026-08-13）：292 个单角色场景已切换到 `short-prompt-builder.js` 的 sc300 同构短 Prompt，静态全量预检 `292/292` 通过且全部落在 `22-26 token`；宁宁单角色候选改用 `L_NENE_V20B_ANIMA`（`characterId=nene` 表示展示角色，提交 Anima API 时单独用 `generationCharacter=nene_b`）；夏目保持 `L_NAT_V20_ANIMA`，6 个双人场景保持既有 WAI 双 LoRA 路径；复杂场景仅在数据已有 `animaCaption` 时追加一行导演描述。定向验证 43/43 通过（质量 Prompt 契约、showcase 候选契约、Prompt corpus、Anima 真实 HTTP 路由），未运行 E2E 与真实 GPU 生成。

**安全决策**：`nene_r18 / natsume_r18` 当前同时承载旧 LoRA 的渲染质量先验，因此短期仍可作为质量控制词进入日常图；内容评级仍由 `safe / nsfw` 与显式内容词决定。safe 场景禁止显式成人词，避免把"全场景注入 R18 token"错误实现为"全场景注入成人内容"。（注：08-13 已定论「R18 tag 隔离是错误设计」，下次重训统一训练后此 hack 应移除。）

**尚未执行**（需要新模型产物、GPU 时间和用户逐张亲审，必须独立执行并记录真实证据）：

- 训练侧统一重训（含 safe prompt 泄漏测试硬门槛）；
- 去掉生成侧 `nene_r18 / natsume_r18` 质量 hack；
- 真实 GPU 批量生成和五维人工审核；
- ">=90 分比例 >70%"最终验收。

**验证方式**：每次修改后运行 `npm run validate`；批量生成场景必须用五维打分（光影/背景/角色/氛围/完成度）+ 用户亲审；训练侧重训后必须通过 safe prompt 泄漏测试。

## 3. 证据分级：官方、社区和本项目实测

官方资料只能说明模型作者设计的语法、推荐起点和安全边界，不等于当前项目工作流的最优解。

后续任何 Prompt 或参数结论都按四级证据记录：

| 等级 | 证据 | 可以支持什么 |
|---|---|---|
| A | 本项目同模型、同 LoRA、同 seed、同画幅的盲审 A/B | 可升级为项目默认 |
| B | 带完整 Prompt、参数、模型和工作流元数据的社区高质量成图 | 可进入项目候选实验 |
| C | 高下载工作流作者的说明、多人讨论中的重复共识 | 可扩展实验区间，不能直接落默认 |
| D | 单张高赞图、无元数据图片、个人短评、搜索摘要 | 只提供线索 |

采用社区经验前还要检查可迁移性：

- 是否使用相同底模版本；
- 是否使用角色、风格、质量或解除限制 LoRA；
- 是否使用替代 VAE、ControlNet、detailer、二阶段采样或后处理；
- 是否经过大量 seed 选片；
- 是否是同一种目标风格和画幅；
- 是否公开完整负面和生成参数；
- 是否能在当前 RTX 4070 Ti SUPER 16GB 与已安装节点上复现。

社区方案只拆成单独变量测试，不整包照抄。

## 4. 官方资料给出的边界

### 4.1 WAI Illustrious SDXL v17

官方模型卡明确给出：

- 推荐 15–30 steps；
- CFG 5–7；
- Euler a；
- 原始尺寸使用大于 `1024x1024`；
- 示例为 `1024x1344`；
- Hires 1.5 倍、20 steps、Anime6B、denoise 0.35–0.5；
- 正向前缀为 `masterpiece, best quality, amazing quality`；
- 负向前缀为 `bad quality, worst quality, worst detail, sketch, censor`；
- 不要加入过多质量/审美词，也不要使用过长 Negative，否则会降低质量并使画面变糊。

这与项目当前 WAI Profile 的 30 steps、CFG 6、Euler a、1.5 倍 Hires、20 steps、denoise 0.4 基本一致。

对 WAI 的优化重点应该是视觉信息取舍与构图，不是继续堆质量词。

### 4.2 Anima

官方模型卡明确说明：

- 同时训练了 Danbooru 风格标签、自然语言 caption 和两者混合；
- 标签用小写和空格，只有 score 标签使用下划线；
- 推荐 Base 正向前缀：
  `masterpiece, best quality, score_7, safe`；
- 推荐负向包含低质量、低 score、模糊和压缩伪影；
- 推荐标签顺序：
  `质量/元数据/年份/安全 → 人数 → 角色 → 作品 → 画师 → 通用标签`；
- 模型训练使用随机 tag dropout，不必列出画面里的每一个标签；
- 纯自然语言应至少两句，过短可能产生意外结果；
- 多角色时应在角色名后描述外貌，避免身份混淆；
- Aesthetic 版本不需要质量标签，并明确建议正负面都不要使用 `score_*`；
- Base 官方通用参数为 30–50 steps、CFG 4–5，`er_sde` 是中性、平涂、线条清晰的合理默认。

项目当前 Anima 的 24 steps、CFG 3、`res_multistep/simple` 是本地生产预设，不应假装成官方推荐；它可以保留，但必须通过项目自己的 A/B 证明。

### 4.3 Krea 2

Krea 官方指南明确说明：

- 推荐自然语言 Prompt；
- 长而详细的 Prompt 通常效果最好；
- 模型也能在较少工程化的 Prompt 下生成高质量结果；
- 官方例子持续强调：
  - 主体；
  - 外观和材质；
  - 姿态与动作；
  - 镜头距离和角度；
  - 前景、中景、背景；
  - 光线方向；
  - 色彩关系；
  - 景深和焦点。

官方 `expansion.txt` 还给出更重要的 Prompt 扩写原则：

- 忠实保留主体、动作、颜色和空间关系；
- 不要擅自增加人物、道具和动物；
- 将每个主体与其属性、动作绑定；
- 使用落地、可解析的姿态、互动和空间布局描述；
- 不要过度指定输入没有支持的服装、颜色、材质和细节；
- 输入已经很详细时只做轻量整理，不要强行扩写。

因此，Krea 的目标不是机械限制为固定 3–5 句，而是确保描述完整、忠实、结构清晰。句数可以作为健康提示，但不应成为绝对质量规则。

## 5. 社区实践与可迁移结论

### 5.1 社区数据的局限

本轮检查了 Civitai 模型页、高下载工作流、公开高互动图片元数据、社区 Prompt 指南和讨论检索结果。

社区热门图片不能直接代表“最优参数”：

- WAI v17 Civitai 模型累计约 147 万下载、8.4 万点赞，成图生态巨大；
- Anima 模型累计约 17.8 万下载、8700 点赞；
- 高赞成图常叠加多个风格 LoRA、质量 LoRA、后处理和人工选片；
- Civitai 图片列表 API 通常隐藏 Prompt 元数据，需要逐张页面核对；
- 热门度会受到角色、题材、作者粉丝和发布时间影响。

前 100 张高互动样本还存在强烈画幅偏差：

| 模型 | 竖图 | 横图 | 方图 |
|---|---:|---:|---:|
| WAI v17 | 99 | 0 | 1 |
| Anima Base | 99 | 0 | 1 |
| Anima Aesthetic | 96 | 3 | 1 |

所以社区数据很适合研究人物竖图，却几乎不能回答项目的视觉小说横图应该怎么做。横图仍必须由项目自己的金标场景验证。

### 5.2 WAI / Illustrious 社区实践

社区中可以观察到的有效信号：

- 不少使用者把 CFG 放在 4–5，而不是作者推荐区间的中高段；
- 一张使用 WAI v17、两个风格 LoRA 的公开高互动图片使用：
  - 30 steps；
  - CFG 4；
  - Euler a；
  - `832x1216`；
  - 质量词比官方三词更多。
- 另一张高互动图片使用：
  - 40 steps；
  - CFG 7；
  - Euler a；
  - `960x1664`；
  - 大量风格、质量和身体控制 LoRA；
  - 很长的 Negative。
- Civitai 社区 Prompt 指南建议：
  - 重要身份和内容词靠前；
  - 长 Prompt 后段会被稀释；
  - 对 OC 或角色身份，质量词可以后移；
  - 从 CFG 3 开始逐步测试到 6，避免盲目套用 Pony/普通 SDXL 参数；
  - 标签是否有效应回查 Danbooru 语料，而不是凭自然语言猜测；
  - Negative 可从 `worst quality, low quality` 起步，再按具体失败补词。
- Reddit 讨论检索中反复出现 CFG 4–4.5 的个人偏好，但这类摘要只算 D 级线索。

对本项目的结论：

- 不能认定 CFG 6 一定最优，应增加 CFG 4–5 的项目对照；
- 高赞图证明 WAI 能容忍更多质量词和长 Negative，不证明它们有正收益；
- 大量 LoRA 叠加结果不可迁移到宁宁/夏目角色 LoRA；
- “重要词靠前”值得进入编译器预算实验；
- 官方三质量词与社区两质量词/扩展质量词应同 seed 比较；
- 不因为社区个别长 Prompt 成功就取消现有冗余和冲突检查。

### 5.3 Anima 社区实践

社区信号相对一致：

- 高下载的 `Anima Workflows` 约有 2.1 万下载、近 700 点赞；
- 该工作流推荐：
  - 30–50 steps；
  - CFG 4–5；
  - 约 1MP 初始分辨率；
  - `er_sde`、`euler_a` 或 `dpmpp_2m_sde_gpu`；
  - 后续搭配 upscale、detailer、ControlNet 和 inpaint。
- 一张公开高互动的 Anima Base 成图使用：
  - 30 steps；
  - CFG 4；
  - `dpmpp_2m_sde_gpu`；
  - `beta57` scheduler；
  - 标签和自然语言混合；
  - 风格 LoRA；
  - 带 upscale/detailer 的社区工作流。
- 另一张公开高互动成图使用：
  - 30 steps；
  - CFG 4；
  - `er_sde_simple`；
  - `832x1216`；
  - 简短自然语言与少量质量词；
  - 多个风格 LoRA。
- Reddit 检索中，Anima 1.0 的大型经验讨论反复提到轻量 latent upscale 和 Prompt 细节问题，但正文受站点验证限制，本轮只把它当线索，不作为确定结论。

对本项目的结论：

- 当前 24 steps / CFG 3 / `res_multistep` 是速度优先的本地生产配方，不应只和官方纸面参数比较；
- 首要社区对照应是 30 steps / CFG 4 / `er_sde`；
- `dpmpp_2m_sde_gpu + beta57` 是风格/材质对照，不应立即作为角色 CG 默认；
- detailer 和 upscale 可能比继续扩写 Prompt 更能提高最终可发布率；
- 当前机器未安装 Impact Pack、检测模型和外部 upscaler，因此 detailer 路线需作为独立依赖阶段，不能在现有工作流中假装已经可用；
- 角色 LoRA 路径必须先验证身份稳定，再测风格 LoRA 或复杂后处理。

### 5.4 Krea 2 社区实践

社区对 Krea 的意见分成两条路线。

**简单 Turbo 路线：**

- Turbo 8 steps；
- CFG 0 或 1；
- 尽量使用原生高分辨率；
- Prompt 使用普通句子；
- 描述一个核心动作、明确光源和少量重要材质；
- 两个竞争动作或没有光照描述时，画面更容易变糊或失焦；
- 旧式 `(word:1.2)` 权重通常不如调整语序、具体词汇和自然重复有效；
- 重点对象放句首；
- Style LoRA 需要正确触发短语，内容 Prompt 不要与 LoRA 风格互相打架。

**社区“高质量/高控制”路线：**

- 高下载的 Krea Pro Grade 工作流约有 1 万下载、250 点赞；
- 另一套 Krea 高质量简单工作流约有 7700 下载、160 点赞；
- 部分作者推荐 RAW checkpoint + Turbo LoRA 约 0.6，以牺牲少量速度换取多样性；
- 写实路线会使用二阶段采样、替代 VAE、detailer、后期锐化或颜色处理；
- 非写实/Anime 路线常简化为单采样，并使用 Euler/SGM 一类组合；
- 高级工作流还会加入 Prompt enhancer、风格参考、区域 Prompt、ControlNet 和多参考图。

对本项目的结论：

- 当前项目只有 Krea 2 Turbo FP8 和基础 Krea rebalance，社区 RAW 路线不能直接复制；
- 先在现有 Turbo 工作流内测试：
  - CFG 0 对 CFG 1；
  - 1024 档对更高原生分辨率；
  - 当前 3–5 句编译对“一个动作 + 明确光源 + 关键材质”的紧凑散文；
  - 重要主体句首和构图句顺序；
- RAW + Turbo LoRA、替代 VAE和二阶段采样应另立依赖评估，需要额外模型下载和显存/耗时验证；
- Krea 社区的写实经验不能直接推广到项目的二次元角色 CG；
- 社区关于解除限制或替换文本编码器的做法不进入默认产品方案。

### 5.5 社区共识中最值得迁移的部分

跨模型最稳定、最适合当前项目的社区经验是：

1. 重要主体、身份和动作靠前；
2. 一个画面只保留一个核心动作；
3. 明确主光源比增加泛化质量词更有效；
4. 画幅要用原生构图和原生尺寸生成；
5. 多 seed 选片是工作流的一部分；
6. 手、脸和局部问题优先用 detailer/inpaint，不无限污染全局 Prompt；
7. Prompt、采样、LoRA、VAE和后处理必须作为整条链评估；
8. 社区参数是实验候选，不是默认答案。

## 6. “出片”的可操作定义

高质量不能只定义为“细节多”或“分辨率高”。建议统一为六个维度：

1. **身份准确**
   - 官方脸部特征；
   - 发型、发饰、瞳色；
   - 角色间不串特征；
   - LoRA 触发稳定。
2. **主体可读**
   - 一眼看出主角与核心动作；
   - 主体轮廓不被背景吞没；
   - 面部、手部或关键道具在正确焦点层。
3. **构图成立**
   - 横图有横向叙事和空间层次；
   - 竖图有纵向动势、人物比例和上下留白；
   - 裁切符合镜头意图；
   - 不出现无意义大面积空白或主体贴边。
4. **光色统一**
   - 主光方向明确；
   - 人物与环境处于同一光照世界；
   - 冷暖关系服务情绪；
   - 不靠“volumetric lighting”堆词制造脏雾。
5. **肢体与交互可信**
   - 手指、手腕、四肢正常；
   - 人物与道具真实接触；
   - 双人或 POV 的空间关系明确；
   - 不出现多余人物和漂浮肢体。
6. **叙事瞬间**
   - 画面展示一个具体瞬间，而不是静态标签合集；
   - 动作、视线、道具和环境共同表达场景故事。

建议最终的主指标使用：

`可发布成片率 = 通过全部硬门槛且人工总分达到阈值的图片数 / 生成图片数`

而不是平均美学分。

## 7. 新的结构化 Prompt 模型

### 7.1 从标签列表升级为“视觉意图”

建议扩展 `PromptPlan`，增加不依赖具体模型语法的导演数据：

```ts
interface VisualIntent {
  subjectCount: 'solo' | 'dual'
  focalSubject: string
  focalFeature?: 'face' | 'eyes' | 'hands' | 'prop' | 'fullBody'
  action: string[]
  interaction?: string
  environment: string[]
  foreground?: string[]
  background?: string[]
  shot: ShotId
  angle?: string
  composition: CompositionId
  orientation: 'portrait' | 'landscape' | 'square'
  subjectPlacement?: 'center' | 'leftThird' | 'rightThird'
  subjectScale?: 'close' | 'medium' | 'full' | 'smallInEnvironment'
  gaze?: string
  lightSource?: string
  lightDirection?: string
  colorContrast?: string
  depthPlan?: 'shallow' | 'layered' | 'deep'
  mustShow: string[]
  mustNotAdd: string[]
}
```

这些字段先由场景显式数据提供，缺省时再由 `sceneInference` 确定性推断。

模型渲染器只负责把同一份 `VisualIntent` 翻译成：

- WAI Danbooru 标签流；
- Anima 标签流 + 一句必要的空间关系 caption；
- Krea 自然语言段落。

### 7.2 信息优先级

Prompt 中的视觉信息按以下顺序控制预算：

1. 角色与人数；
2. 官方身份锚点；
3. 唯一服装；
4. 核心动作或互动；
5. 必须出现的关键道具；
6. 镜头、主体占比与构图；
7. 场所、时间、天气；
8. 主光和色彩关系；
9. 情绪和视线；
10. 次要装饰与风格。

达到预算上限时从第 10 层向前裁剪，不能牺牲前 6 层。

### 7.3 不把检索元数据直接当视觉词

以下内容默认不进入生成 Prompt：

- `official_cg`
- `visual_audited`
- `landscape`、`portrait` 等纯元数据标记；
- 搜索分类；
- 审核状态；
- 场景标题和故事全文；
- 不可见的心理活动；
- 与画面没有直接视觉对应的剧情说明。

它们应转化为结构化意图或保留为管理元数据。

## 8. 横图和竖图必须使用不同导演配方

### 8.1 竖图配方

竖图适合：

- 单人角色主视觉；
- 全身服装展示；
- 中近景人物情绪；
- 上下方向明显的动作；
- 手机壁纸。

竖图 Prompt 应显式控制：

- 主体占画面约 55%–80%；
- 头顶、发饰和脚部是否必须完整；
- 身体形成 S 形、对角线或纵向动势；
- 前景从下方进入，背景向上延伸；
- 关键道具靠近胸口、脸部或手部焦点；
- 全身镜头使用深景深，近景使用浅景深；
- 避免横向摊开的多人动作和过宽环境。

推荐的构图语义示例：

```text
full body, head to toe, feet visible, vertical composition,
slight low angle, centered subject, layered foreground,
background rising behind her, deep focus
```

并不是每次都全部加入，而是根据 `subjectScale` 和 `depthPlan` 选择最少必要词。

### 8.2 横图配方

横图适合：

- 视觉小说事件 CG；
- 双人互动；
- 环境叙事；
- 人物与场景关系；
- 左右方向运动；
- 桌面壁纸。

横图 Prompt 应显式控制：

- 人物位于左或右三分之一，而不是机械居中；
- 视线或动作朝向画面内部；
- 另一侧留给环境、光源、道具或叙事目标；
- 建立前景、中景、背景；
- 指定横向引导线；
- 双人时指定左右位置、距离和各自动作；
- 避免把竖图的 `full body, centered` 原样塞入横图。

推荐的构图语义示例：

```text
cinematic widescreen composition, subject on the left third,
looking into the frame, foreground framing,
environment extending across the right side,
layered background depth
```

横图的核心不是 `cinematic_16:9_composition` 这个单词，而是把左右空间分别分配给明确内容。

### 8.3 同场景双配方

对可横可竖的场景，不建议只保存一个 Prompt。

应由同一 `VisualIntent` 产生两个导演变体：

```text
portraitVariant:
  主体更大、动作更集中、背景收束、纵向动势

landscapeVariant:
  主体偏置、环境展开、叙事留白、横向引导
```

场景可以声明：

```ts
orientationPolicy: 'portrait-only' | 'landscape-only' | 'adaptive'
```

`adaptive` 场景根据用户选择重新编译 Prompt，不能只换输出尺寸。

## 9. 各模型的具体 Prompt 策略

### 9.1 WAI

建议模板：

```text
[官方质量前缀]
[rating]
[人数与角色]
[LoRA 精确身份/服装]
[核心动作与交互]
[关键道具]
[镜头与画幅构图]
[环境、时间、天气]
[主光、焦点、景深]
[LoRA]
```

规则：

- 质量前缀固定三项，只出现一次；
- 不主动增加 `absurdres`、`ultra detailed` 等同义质量词；
- 正向目标约 18–35 个有效视觉 token；
- 复杂双人或精确服装可以超过 35，但需健康提示；
- 同义词只保留一个；
- 动作冲突、服装冲突、时间冲突必须在编译期消解；
- 权重只用于真正不稳定的 1–3 个关系，不做全 Prompt 加权；
- Negative 只包含：
  - 官方前缀；
  - 通用解剖与文字保护；
  - 与当前场景有关的排除；
  - 当前 rating 安全词。

不建议：

- 对每张图都追加 `cinematic`, `detailed background`, `volumetric lighting`；
- 同时使用 `close_up`、`medium_shot`、`full_body`；
- 用十几个 Negative 词阻止模型生成任何可能变化。

### 9.2 Anima Base

建议采用“短而完整的标签流 + 必要时一条关系 caption”：

```text
[质量/安全] → [人数] → [角色] → [精确 LoRA token]
→ [服装] → [动作] → [道具] → [镜头构图] → [环境光照]

[仅当标签难以表达空间关系时的一句英文 caption]
```

规则：

- 角色 LoRA exact token 必须完整；
- 通用标签用空格；
- score 和 LoRA exact token 保留契约形式；
- 利用官方 tag dropout 结论，不列出所有可见细节；
- caption 只解决以下难题：
  - 哪只手拿什么；
  - 人物在画面左还是右；
  - 道具位于前景还是胸前；
  - POV 手从哪里进入；
  - 双物体或复杂姿势的空间关系。
- caption 不重复身份、服装、质量词和已经清楚的普通标签。

参数方面，应将当前生产预设与官方对照分开测试：

- 当前：24 steps / CFG 3 / `res_multistep` / `simple`；
- 官方对照：30 或 40 steps / CFG 4 或 4.5 / `er_sde`。

不能只看单图，应比较多 seed 下的可用成片率、烧图率和身份稳定度。

### 9.3 Anima Aesthetic

规则：

- 不使用 `score_*`；
- 正向默认不使用质量词；
- Negative 不使用 score；
- 热门角色无 LoRA 时，身份描述必须比 LoRA 路径更完整；
- 可以用两句以上自然语言，但仍需忠实且结构化；
- 不要把 Base 的精确 LoRA 标签策略机械搬到 Aesthetic 无 LoRA 场景。

### 9.4 Krea 2

建议顺序：

1. 媒介与整体视觉语言；
2. 主体身份、外貌、服装；
3. 动作、姿态、视线和关键道具；
4. 画幅、镜头、主体位置和空间层次；
5. 环境、光源方向、色彩关系和景深。

规则：

- 使用自然语言；
- 保持一段连贯描述；
- 不使用 LoRA、权重、score 和 Negative；
- 不要求机械固定句数；
- 详细场景轻量整理，简单场景才扩写；
- 不添加输入没有支持的服装、道具、人物和颜色；
- 主体与属性绑定，避免一段里混杂多个没有归属的形容词；
- 横图必须写清左右空间；
- 竖图必须写清人物尺度和上下裁切。

## 10. 多 seed 选片策略

### 10.1 为什么必须选片

固定 Prompt 下，seed 对以下内容影响很大：

- 构图是否舒展；
- 手部是否正常；
- 表情是否自然；
- 背景是否抢主体；
- 光影是否出现偶然的高级感；
- 角色 LoRA 是否在该构图中稳定。

因此“出片”应被设计成生成流程，而不是单 Prompt 技巧。

### 10.2 产品建议

保留当前单张生成默认，新增可选“精选候选”：

- 快速：4 seed；
- 精选：8 seed；
- 审核/展示集：12–20 seed。

场景模式只展示：

- “生成 1 张”
- “生成一组候选”

专家模式再开放 seed 数量和固定 seed。

### 10.3 候选阶段不要反复改 Prompt

推荐顺序：

1. 固定 Prompt、模型、参数和画幅；
2. 只改变 seed；
3. 选出构图成立的候选；
4. 若全部失败，再修改 Prompt；
5. 需要修手或局部时走已有 inpaint 链，不重抽整张。

这样才能判断问题来自 Prompt 还是随机采样。

## 11. 可复现 A/B 实验

### 11.1 实验矩阵

选 24 个代表场景：

- 角色：宁宁、夏目各 10 个，双人 4 个；
- rating：全年龄、R15、R18 均覆盖；
- 镜头：特写、中景、全身、POV；
- 环境：室内、户外、日间、夜景；
- 画幅：竖图 12、横图 12；
- 难题：手持道具、回眸、坐姿、复杂互动、强前景各至少 2 个。

每个场景采用相同 8 个 seed，比较：

| 组别 | Prompt | 构图 |
|---|---|---|
| A | 当前生产编译 | 当前尺寸策略 |
| B | 精简标签 | 当前尺寸策略 |
| C | 当前信息量 | 新画幅导演层 |
| D | 精简标签 | 新画幅导演层 |

这样可以分别测出：

- 精简 Prompt 的贡献；
- 横竖导演层的贡献；
- 两者是否叠加；
- 是否只对某个模型或镜头有效。

### 11.2 WAI 参数与质量词子实验

抽 8 个角色场景，保持 Prompt 内容、seed、尺寸和 LoRA 一致：

| 参数组 | Steps | CFG | Sampler | 质量词 |
|---|---:|---:|---|---|
| W1 当前 | 30 | 6.0 | Euler a | 官方三词 |
| W2 社区低 CFG | 30 | 4.0 | Euler a | 官方三词 |
| W3 中间档 | 30 | 5.0 | Euler a | 官方三词 |
| W4 社区精简 | 30 | 4.0 | Euler a | `masterpiece, best quality` |

只在 W1–W4 得出清晰结论后，再决定是否测试 40 steps / CFG 7。社区高赞图中的该组合被大量 LoRA 严重混杂，不应列为第一轮。

### 11.3 Anima 参数子实验

在上述场景中抽 8 个，追加：

| 参数组 | Steps | CFG | Sampler |
|---|---:|---:|---|
| P1 当前 | 24 | 3.0 | res_multistep |
| P2 官方近似 | 30 | 4.0 | er_sde |
| P3 官方高端 | 40 | 4.5 | er_sde |
| P4 社区风格 | 30 | 4.0 | dpmpp_2m_sde_gpu + beta57 |

保持 Prompt、seed、尺寸、LoRA 完全相同。

P4 只有在安装并锁定对应 scheduler 依赖后执行；不能用近似节点冒充。

### 11.4 Krea Turbo 子实验

在 8 个不依赖角色 LoRA 的场景上比较：

| 参数组 | CFG | 尺寸 | Prompt |
|---|---:|---|---|
| K1 当前 | 1 | 当前推荐尺寸 | 当前结构化散文 |
| K2 社区 Turbo | 0 | 当前推荐尺寸 | 当前结构化散文 |
| K3 紧凑导演 | 0 | 当前推荐尺寸 | 一个动作 + 明确光源 + 关键材质 |
| K4 原生高分辨率 | 0 | 可承受的更高原生尺寸 | 紧凑导演 |

RAW + Turbo LoRA 不放入本轮，因为本机尚未安装 RAW checkpoint；它应在 K1–K4 无法达到目标时再单独评估。

### 11.5 工作流贡献拆分

对通过 Prompt/参数初筛的候选，第二轮再比较：

| 组别 | 全局生成 | 局部修复 |
|---|---|---|
| F1 | 原始输出 | 无 |
| F2 | 原始输出 | 现有 inpaint |
| F3 | 原始输出 | 未来 face/hand detailer |
| F4 | 原始输出 | upscale + 必要局部修复 |

这能回答“继续改 Prompt”与“局部修复/后处理”哪个更提高发布率。

### 11.6 审核表

每张图采用 0–2 分：

- 身份；
- 服装；
- 面部；
- 手和肢体；
- 核心动作；
- 关键道具；
- 构图；
- 光色；
- 背景叙事；
- 整体出片感。

硬失败项：

- 角色错；
- 服装族系错；
- 明显多肢；
- 双人特征串位；
- 关键道具缺失；
- 横竖裁切违背意图；
- 出现未要求的额外人物；
- R18 年龄表达不合规。

审核时隐藏：

- Prompt 组别；
- seed；
- 参数组；
- 文件名中的实验信息。

### 11.7 升级门槛

某策略成为默认需同时满足：

- 可发布成片率相对当前提升至少 15%；
- 身份准确率不下降；
- 核心动作命中率不下降；
- 横图构图分提升至少 0.3/2；
- 竖图裁切失败率下降；
- R18 与全年龄安全契约无回退；
- 至少两名审核者或两轮独立复核结论一致。

若精简 Prompt 只提升局部场景，则做成场景级策略，不全局替换。

## 12. 分阶段实施

### P0：完成现有实验的证据闭环

目标：先回答短 Prompt 是否有效。

- 为 `ShortPromptPilot`、`ShortPromptBatch` 和 `Sc300Repro` 生成统一审核表；
- 补 `manual-review.json`，不要只写自由文本；
- 修正全场景注入 R18 token 的试验偏差；
- 使用相同 seed 比较当前 Prompt 与短 Prompt；
- 竖图和横图分别统计；
- 输出每个模型、镜头和场景类型的结论。

交付：

- `docs/prompt-ab-baseline-2026-08.md`
- 审核 JSON；
- 每组胜率、失败类型和示例索引。

### P1：画幅导演层

目标：解决“只换宽高，不换构图”。

- 新增 `VisualIntent` 或等价结构；
- 新增 `orientationPolicy`；
- 新增主体位置、主体尺度、焦点、景深、前中后景；
- `sceneInference` 根据画幅返回构图策略；
- WAI、Anima、Krea 分别渲染；
- 先覆盖 24 个金标场景，不批量改 298 个 JSON。

建议文件：

- 新增 `src/utils/visualIntent.ts`；
- 扩展 `src/utils/promptCompiler.ts`；
- 扩展 `src/utils/sceneInference.ts`；
- 新增 `scripts/tests/test-visual-intent.js`；
- 扩展 `test-prompt-corpus.js`。

### P2：Prompt 预算与语义裁剪

目标：精简冗余，但保住身份、服装和核心关系。

- 为各模型建立预算：
  - WAI：有效视觉 token 目标 18–35；
  - Anima Base：角色契约 + 8–18 个场景控制；
  - Krea：按语义完整度，不按逗号或固定句数。
- 标签按语义族去重；
- 编译报告展示“被裁剪的次要词”；
- 增加核心词 `mustShow`；
- 增加禁止模型擅自补充的 `mustNotAdd`；
- 不改原始场景数据，先在编译层工作。

### P3：候选组与选片

目标：把 seed 运气转化为产品能力。

- 扩展现有队列支持一组候选；
- 记录共同 Prompt 和参数，只为每张记录 seed；
- Gallery 提供候选组比较；
- 支持标记“入选”和失败原因；
- 展示集继续要求人工视觉审核后发布。

### P4：数据回填

目标：让高价值场景拥有明确导演意图。

优先回填：

1. 展示集核心场景；
2. 26 个现有横图官方 CG；
3. 双人场景；
4. 手持关键道具和复杂互动；
5. 用户高频场景；
6. 其余场景。

不要一次性机械改 298 个场景。每批回填都必须有生成和人工审核结果。

## 13. 测试和质量门槛

### 单元/契约测试

- 每个模型只输出允许的语法；
- 横图和竖图 Prompt 必须有可观察差异；
- `mustShow` 不得被预算裁剪；
- 同一 Prompt 不得同时出现冲突镜头；
- 双角色左右位置必须稳定；
- Krea 不得出现 LoRA、权重、score、Negative；
- Anima Aesthetic 不得出现 score；
- WAI 质量前缀只出现一次；
- R18 与全年龄 rating 契约不回退。

### 语料测试

扩展 `test-prompt-corpus.js`：

- 298 场景均能编译；
- `adaptive` 场景能同时编译横竖两个变体；
- 横图具有主体位置或空间展开语义；
- 竖图具有主体尺度或裁切语义；
- 自动 caption 不复制故事和标题；
- 构图元数据不作为裸标签泄漏。

### 视觉测试

代码测试不能代替图片审核。每轮视觉审核至少检查：

- 角色身份与官方特征；
- 脸、发饰、服装；
- 肢体与手；
- 双人串位；
- 横竖构图；
- 光照统一；
- 场景叙事；
- 关键道具与动作。

## 14. 不建议做的事

- 不把全部 Prompt 强制压到同一长度；
- 不把 WAI、Anima、Krea 统一成同一种语法；
- 不继续增加通用“高清神词”；
- 不用超长 Negative 修正正向构图问题；
- 不用自动美学分代替人工审核；
- 不把随机好 seed 误判成 Prompt 改进；
- 不把高赞但叠加几十个 LoRA 的社区图当作底模参数证据；
- 不把写实 Krea 工作流直接套到 Anime 角色 CG；
- 不在缺少对应节点或模型时用近似实现冒充社区配方；
- 不只生成竖图后裁成横图；
- 不直接批量重写 298 个场景；
- 不让生成式 LLM 在运行时自由发明角色服装和场景道具；
- 不破坏现有 R18 默认开启与审核遮罩约束。

## 15. 推荐的第一批实际工作

按收益和风险排序：

1. 给现有短 Prompt 实验补盲审结论；
2. 选 12 个竖图、12 个横图建立金标集；
3. 实现只读的 `VisualIntent` 编译预览，不接生产生成；
4. 对同 seed 输出当前版和新导演版 Prompt；
5. 生成 24 × 4 组 × 8 seed 的受控候选；
6. 人工审核；
7. 只有数据证明提升后，才接入场景模式默认；
8. 最后再考虑候选组 UI 和全量场景回填。

预计第一阶段最可能产生明显收益的是“画幅导演层 + 多 seed 选片”，而不是简单缩短 Prompt。

## 16. 资料来源

### 官方

- [WAI Illustrious SDXL v17 官方模型卡](https://huggingface.co/LyliaEngine/waiIllustriousSDXL_v170)
- [Anima 官方模型卡与 Prompting 指南](https://huggingface.co/circlestone-labs/Anima)
- [Krea 2 官方 Prompting Guidelines](https://github.com/krea-ai/krea-2/blob/main/docs/prompting.md)
- [Krea 2 官方 Prompt Expansion 协议](https://github.com/krea-ai/krea-2/blob/main/docs/expansion.txt)

### 社区与公开成图

- [WAI v17 Civitai 模型页](https://civitai.com/models/827184/wai-illustrious-sdxl?modelVersionId=2883731)
- [Arctenox 的 Illustrious ComfyUI Prompt 指南](https://civitai.com/articles/23210/arctenoxs-simple-prompt-guide-for-illustrious-for-comfyuisite)
- [WAI v17 社区成图：30 steps / CFG 4 / 两个风格 LoRA](https://civitai.com/images/139360504)
- [WAI v17 社区成图：40 steps / CFG 7 / 大量 LoRA](https://civitai.com/images/138910130)
- [Anima Civitai 模型页](https://civitai.com/models/2458426/anima)
- [Anima 高下载社区工作流](https://civitai.com/models/2426853/anima-workflows)
- [Anima Base 社区成图：30 steps / CFG 4 / DPM++ 2M SDE / beta57](https://civitai.com/images/134134612)
- [Anima Base 社区成图：30 steps / CFG 4 / er_sde](https://civitai.com/images/134244062)
- [Krea 2 Pro Grade 社区工作流](https://civitai.com/models/2726952/krea-2-pro-grade-w-image-edit-style-transfer-moodboard-controlnet-multi-reference-sam3-detailers-and-low-vram-options)
- [Krea 2 社区高质量简单工作流与经验](https://civitai.com/models/2749367/krea-2-simple-gen-workflow-for-high-quality-realism-lots-of-info-and-tips)
- [InstaSD Krea 2 Prompt 与 Style 指南](https://www.instasd.com/post/krea-2-prompt-and-style-guide-comfyui)

## 17. 调研限制

- `opencli` 在当前机器不可用，因此联网研究改用官方网页直接核对。
- Reddit 正文触发了人机验证，本文只把搜索结果中可见的社区摘要作为 D 级线索，没有伪装成已完整阅读的原帖。
- Civitai 的热门图片列表不公开生成元数据；本文只把能够在具体图片页看到完整 Prompt/参数的样例列为 B 级证据。
- 社区高互动样本严重偏向竖图，不能代表横图最佳实践。
- 已确认现有候选图文件和批次结构，但本轮环境的本地图片查看能力不可用，未对这些新试验图给出视觉通过结论。
- 在完成符合项目“图片审核”约束的逐图人工复核前，本文不会把短 Prompt 实验描述为已经成功。
