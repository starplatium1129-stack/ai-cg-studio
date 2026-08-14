# 顶级 AI 创作与生图平台交互调研 & AI-CG-Studio 对标建议

> 状态：已定稿（2026-08-15）。调研基线与项目实证见文末来源。

> 定位：面向本地个人向 AI-CG-Studio（绫季绘境）的参考文档。列出平台的设计精髓（四维），
> 并从项目现状（2026-08 基线）出发，提出 5 条「杀手级交互/功能精髓」的降维落地与具体产品场景。

---

## 0. 调研总览与核心结论

- Midjourney Web（V7 官方推荐主界面的核心）：**"Imagine bar" 即输即出 + 参数可视化（滑块/预设）**，
  把 Discord 时代藏在斜杠命令里的复杂度翻译成"看得见的选项"；**4 宫格生成 + 就地动作菜单**；
  但它**没做好完整谱系树**（Numonic："you can see the parent …, but you cannot see the forest"），
  导出元数据也不带 lineage——这是本地工具的差异机会。
- Krea.ai：实时画布/即时生成、**提示词增强（Enhance/Enhancer）**、**Generative Sliders**、风格/构图预设、
  **Realtime 局部重绘（画笔覆盖重算该层）**。⚠️ 关键澄清（官方 + 实测一致）：**图像画布没有"逐帧 blur→清晰"渐进的中间态**，
  Krea 2 是**无独立负面词**的纯自然语言模型——这与项目现状完全吻合。
- Civitai：**Generation Data 一键复制闭环**（保存时嵌入 PNG 元数据 + 卡片/详情一键复制整套参数复现）、
  风格/质量预设替代专业参数、瀑布流 + 占位骨架 + lazy-load、模型-图像双塔导航。
- NovelAI：**Tag 权重微交互**（选中 token → 数值控件/滑杆 + 颜色标注）、**层与阻断词库（UC/BC）**、
  **历史 Fork 版本树**、成图元数据一键复制 + 还原重入图。
- SeaArt：**一键点按出图 + 一次 4 张多图对比**、风格商店货架式即时切换、模型广场。
- Poe：bot 生态、prompt 模板变量、斜杠指令/消息按钮。

对 AI-CG-Studio 最该抄的、且项目现状已具备大量地基的 5 条：

1. **同题多车道渲染（三引擎同意图 → 出 Grid）**——项目 `renderPromptPlan(plan, family)` 已是纯函数、
   `createPromptPlan` 同时携带散文与标签字段，就差把 `drawEngine` 单值改成多路并发。
2. **生成过程真·渐进预览**（替代"结论才 bloom-in"的装饰性假渐进）——SD 现在 `skip_current_image=true`
   主动丢中间帧，WebUI/ComfyUI 其实能给。
3. **成片元数据一键复用 + 写入 PNG**（Civitai 闭环）——`HistoryEntry` 已存全部参数、`parent_id/version`
   字段已存在但仍为 null/1，且退出工具后无元数据落盘。
4. **Tag 权重胶囊微交互 + UC 阻止词库 + 层式分块（NovelAI）**——`PromptHealthPanel` 已做 token 化 + 分类着色、
   `formatPromptForEngine` 已支持 `(tag:1.2)` 与 BREAK，就差"选中即出权重滑杆"，并可叠加整块 UC 词库与层式分块。
5. **历史版本树 / Fork 溯源**（MJ 的缺位 + NovelAI 的成熟）——`parent_id`/`version` 字段现成，
   只需在 regen/variant 时写谱系并在 Gallery 呈现树。

其余高分项：**算力/GPU 预算显式化**（MJ Fast/Relax、Krea Compute Units）、**hover 显示 prompt / hover 拉高清 + 浮出工具条**（Krea）、
"重新生成/变体"就地动作（Gallery 已有 `/prompt-builder?regen|variant=` 深链，但没把谱系写回）、
**增强/放大的前后拉杆对比 drag-comparison-slider**（Krea，可叠到项目「高清放大 2x」）、
**风格用"传图 + strength slider + moodboard"而非预设**（Krea style-reference / NovelAI Vibe Transfer / MJ --sref 同族）。

---

## 1. 各平台精髓（四维）

### 1.1 Midjourney Web
> 已回填源码详见独立报告；要点列入下，来源：How-To Geek、Flowith、NoMonic、dev.to、writingmate、insaneapp、aistacknav、MJ-Docs、toolcolumn。

#### Prompting UX
- **去斜杠命令**：Create 页顶部/底部 "Imagine bar"，回车即出图。
- **参数"看得见"**：三横线按钮展开设置面板，按语义分组（Image Size 预设+滑杆、Aesthetics 组
  stylize/weird/variety 滑杆、Model 下拉）；**保留手写 `--ar 16:9` 入口形成双通道桥接**。
- 无占位符/模板 gallery——启发来自「Explore 看到好图 → 看其 prompt → 复用」与 /describe 反推。
- /describe、Mix/Blend（拖参考图进面板 + weight 滑杆，等价 --cw/--sw）。

#### 生成流程与即时反馈
- **出图为 2×2 四宫格**落位到 Create feed 顶部，最新置顶，点击单格放大。
- **就地动作菜单**：Subtle/Strong variation、Subtle/Creative upscale、Remix、Pan/Zoom、Vary Region（进入 inpainting 涂抹）、Run again/Reuse——不用退回输入框。
- **务实提醒：Web 端并没有被确认的 blur→清晰逐帧实时预览**；出图是"四张同时成形"。过度设计逐像素动画无据可依。

#### 资产管理
- 无限滚动网格 + 按 grid/upscale 过滤、Folders/Favorites/搜索；**hover 显示该图 prompt** 是社区启发式浏览引擎。
- **谱系树缺位**（Numonic）：只见父图不见整棵有向图，无法按谱系搜索/分支并排。导出元数据**不含 lineage**。
- 照片详情回显 prompt+参数，一键复用 = 动作菜单里 "Run the same prompt again"。

#### 动效与质感
- 默认深色、画廊式容器（"closer to Lightroom or Pinterest than chat"，图片为主、prompt 退居 hover）。
- Lightbox 全屏 + zoom + 并排比较。
- **"选项可见不是靠记"的心智减负**是比表面质感更核心的设计。

### 1.2 Krea.ai
> 来源：Krea 官方 docs（Realtime / Image generation / Enhancer / Krea 2 / Generative Sliders / Style References）、
> Chase Jarvis 评测、多篇中英文一手实测；部分动效/色值官方未公开已如实标注。

- **实时画布 / 即时生成**：Krea 最具辨识度的是「实时生成」——prompt 每改一下画面就近实时重算，形成"所见即所得"的创作手感
  （Chase Jarvis：《Krea AI for Creative Pros: The Real-Time Workflow Changer》）。Realtime 是**左侧画布 + 右侧实时输出**的双面板，
  绘画工具带快捷键（V/B/X/C/R/T/I/G）。
- **提示词增强（Enhance / Enhancer）**：一键把粗糙描述扩写成更具体、更自然的正提示词；增强器有 **1x/2x/4x/8x 档位且可串联**，
  并配**前后对比（drag-comparison-slider + view controller）**——放大/增强前后用拉杆直观对照（[Krea Enhancer 官方](https://www.krea.ai/docs/user-guide/features/enhancer)）。
- **风格控制 = 传图而非预设**：Krea 2 用**最多 4 张 style reference + 每张一个 strength slider + moodboard 情绪板**来组织风格/氛围，
  而不是"风格预设卡"；把"风格参考（--sref）"做到可混、可调权（[Style References FAQ](https://www.krea.ai/blog/style-references-krea-2)）。
- **Generative Sliders / Creativity 强度**：三根滑块 **Intensity / Complexity / Movement（-100~100）** 承载"创作意图/强度"；
  另有 **Creativity 四档（Raw / Low / Medium / High）** 作为创作强度的离散预设梯——两层都让用户表达"要多大胆/多收敛"，而非敲数值/写风格词
  （[Krea 2 Generative Sliders](https://www.krea.ai/docs/developers/krea-2/generative-sliders)）。
- **Realtime 局部重绘不是矩形框选**：是「在已生成图上用画笔覆盖/擦除 → 只重算该层 → 其余保持」；
  Realtime 内会把每次改动存成**历史版本时间线**（可回看/回退），且"无队列无等待无 render 按钮"——输入即反馈。
- **多图网格**：默认「每 prompt 出 2 或 4 张」并排网格；算力用显式的 **Compute Units**，免费档走**低优先级队列**（与 MJ Fast/Relax 同族）。
- **资产与复用**：**Sessions 分组 + Assets 统一资产库**；图片行级提供 **Retry / Reuse parameters / Share parameters（seed）** 一键复用；
  增强器可 **多任务并行**、strength/resemblance 等滑块、结果存缩略图。
- **模型选择器显示速度 + 质量 + 算力成本**：选模型时把"快/慢、质、烧多少 Compute Units"并排呈现，帮助决策而非盲选。
- **卡片 hover 即拉高清 + 浮出工具条**：缩略图 hover 时加载高清并浮现操作条，是"表层即用"的做法。
- **动效与质感语言（官方未公开色值/px/时长，已诚实标注不臆造）**：近黑带色偏的暗底 + **发散边缘辉光** + 紫粉渐变 accent；
  用**渐进成像代替 spinner**（画面出现代替转圈）；卡片 hover **聚焦点亮**。整体是"画廊感"而非工具抽屉。
- **「从模糊到清晰」的渐进中间态在图像画布不成立**（是整帧连续重算）；真·流式渐进只在 Realtime Video 模型存在。
  → 这与 AI-CG-Studio 现状（结果才 bloom-in）一致：不要 PPT 一个不存在的逐帧预览，但可做"阶段/步骤级"真进度 + 增强前后拉杆对比。
- **Krea 2 无独立 negative prompt**（纯自然语言模型，负面需正向化写进主提示）——与项目 `three-engine-prompt-research.md`
  里"Krea 负面恒空"的契约一致，佐证项目布局正确。

### 1.3 Civitai
> 已在子代理报告中给出完整四维。核心：

- **Generator 极简文本 + style 选择器**，质量/风格预设"隐式绑定参数"，高级参数默认折叠（渐进披露）。
- **Generation Data 一键复制闭环**（最高优先级）：图片详细页一整套元数据 + Copy 按钮；可粘贴 A1111/ComfyUI；
  PNG 嵌 `Civitai` 前缀元数据段；外部工具（civitai-companion / Image-Saver）据此回读。
- 瀑布流 + 双塔导航（模型↔图像）+ 内容分级切换（PG/Adult 等，而非二值开关）+ 懒加载 shimmer。
- 模型/资源**版本树**、Remix/衍生标注、buzz/Bounty 激励；图片记录"由哪版生成"。
- 卡片 hover 抬升、计数器数值微动画（200–300ms）、统一暗色卡片网格。

### 1.4 NovelAI
> 已在子代理报告中给出完整四维。核心：

- **层式 Prompt 组织（Layer/Paragraph 分块）**：Image Editor 把 prompt 拆成多个独立可折叠层（`<paragraph>` 块），
  每块可重排 / 隐藏 / 单独赋权重，再整体拼接——解决"一个超长文本框难以管理"。正面层承载主体，负面层独立管理。
- **正面/负面分离 + UC（Undesired Content）阻止词库（业界独树一帜）**：内建「Undesired Content」区（内部称 UC / Bacon's Theorem），
  预设模型负面词库，用户可追加自定义负面词，并**整体设为一个开关**（[官方 docs » Undesired Content](https://docs.novelai.net/en/image/undesiredcontent)）。
  → 极适合本地工具把关 R18 下已开放/须拒绝的词库策略（一键沿用预设负面 + 自增）。
- **权重微交互（最值得移植）**：把 `(tag:1.2)` 语法收进"数值控件 + 颜色标注"，选中 token 出滑条/数字微调、改完即时高亮；
  不同强度用三档颜色区分，一眼看到权重分布（[Advanced Settings](https://docs.novelai.net/en/text/editor/advancedsettings)）。
- **两段式 Generate / Imagine 按钮**：右下大按钮分主动作 Generate + 二级进阶（V4 可切 Imaginate/更高级生成），减少一次点击，把"普通生成"与"进阶玩法"分层。
- **Vibe Transfer（氛围/构图迁移）**：给一张参考图的"氛围/构图"当条件，strength 控制强度，不必写长 prompt 即迁移色调/质感（[官方博客](https://blog.novelai.net/vibe-transfer-is-now-available-on-novelai-diffusion-v4-56a97d69554c)）。
- **生成画布**：多 tab 并行画布、**back/fork 版本树历史**、Notebook 草稿与图片并排、seed 精确锁定/微调、批量队列一次多张。
- **元数据**：成图卡片完整回显 prompt/全部参数/seed + **一键复制生成数据** + PNG metadata 写入 + **「由生成数据精确还原重入图」**。
- Legend（标签图例/补全）、Ban Tokens、Inpaint/Outpaint/Touch Up 一组画布工具条。

### 1.5 Poe / SeaArt
> 已在子代理报告中给出完整四维。核心：

- **SeaArt（最契合本项目）**：**一次 4 张多图对比**、模型广场 + 风格商店**货架式即时切换**、一键点按出图、
  可视化 LoRA 训练工作台、扩图/放大/修复一条龙。
- Poe：bot 生态 + 一键建 bot、prompt 模板变量、连续对话记忆、斜杠指令与消息按钮。

---

## 2. AI-CG-Studio 现状盘点（对着四维找地基与缺口）

> 全部基于 2026-08 工作区真实源码核对，非猜测。

### 已具备（不要重复建设）
- **场景模式 vs 专家模式** 双模式并存、专家模式选项默认折叠（MJ/Civitai/NovelAI 的"渐进披露"思路已在）。
  入口 `PromptBuilderView.vue` 顶部 `director-mode-switch`。
- **出图队列**（`GenerationQueuePanel`）+ 自动入册 + SDRecoveryPanel 错误一级恢复（轻载/去 LoRA/安全采样器）。
- **引擎自动路由**（`ManagedDrawingRouteCard` + `recommendDrawingRoute`）：按 subject 自动选引擎/LoRA/Prompt 格式，
  已有"最近成功配方"复用。
- **共享意图词汇表** `config/promptConstants.ts`：EMOTION/SHOT/LIGHTING/COMPOSITION/COLOR_MOODS，
  每项都**同时有中文名、英文名、danbooru prompt tag**——这是"自然语言 ↔ 标签桥接"的现成种子。
- **单一渲染层** `createPromptPlan + renderPromptPlan(plan, family)`：同一个 `PromptPlan` 可渲染为
  Krea 散文 / Anima 标签+方向 / WAI 标签流；`createPromptPlan` 的 kwargs 同时携带 subjectProse/outfitProse 与 identity/exactControls。
- **画风胶囊**：`ArtistStylePicker`（灵感混搭预设 + 分类 + 搜索 + 验证徽标 + 引擎 token 预览，专家模式）、
  `KREA_STYLE_RECIPES`（每配方带 lead 散文 / sd 标签 / medium）。
- **作品册沉浸查看器**：`GalleryView` 全屏 Lightbox + 信息面板（facts：尺寸/LoRA/模型/seed/sampler）+ prompt 折叠 +
  「重新生成（`?regen=`）/生成变体（`?variant=`）/下载原图/复制 Prompt」。缩略图懒加载 + shimmer + R18 遮罩。
- **动效与质感体系**：`design-system.css` 有 `--motion-press/hover/control/surface/route`、spring-bounce/spring-soft、
  glass highlights、focus ring、hover-lift、stagger-in、reduced-motion 通配。`.result-image` 已有 `aicsBloomReveal`
  （blur 8px→0 的"柔光入场"）。
- **出图对比**：导演台 `pb-compare` 弹层，前/当前 两卡并排。

### 缺口（真正该做的增量）
- **单引擎单结果**：`drawEngine` 是单个 ref，一次出 1 张；无"同题多引擎/多 seed Grid"。
- **无真·渐进预览**：SD 轮询 `skip_current_image=true`（丢弃中间帧），Anima/Krea 进度冻结在 ~35%；
  现有 bloom-in 是"结论后"的装饰性假渐进。
- **退出/导出即丢参数**：blob 以原始 PNG 存 IndexedDB，**未写 tEXt/元数据段**；参数只在 `HistoryEntry` 内存记录。
- **`parent_id`/`version` 字段存在但恒 null/1**：regen/variant 不写谱系，Gallery 也不渲染版本树。
- **Tag 是纯开关**：`manualTags` 只是 Set，无可调权重胶囊；`formatPromptForEngine` 支持 `(tag:1.2)` 但 UI 没暴露；
  负面词虽有 `assembleNegative` 统一前缀，但未做"整块可开关的 UC 阻止词库"、未做"层式可折叠/可重排的 Prompt 区块"。
- **生成参数只复制 prompt，不复制整套**；Gallery facts 只列 5 项，缺 cfg/steps/scheduler/negative/完整包。
- **无无参考图"氛围迁移"（Vibe Transfer / --sref）入口**：跨引擎细修只能靠改词，不能"拿某张已出图当条件再生成"。
- **无算力/队列预算反馈**：ControlView 有显存紧张提示，但无"本次会话 GPU 时间/队列优先级"这种 MJ 式显式预算。

---

## 3. 杀手级交互/功能精髓 —— 5~6 条降维落地建议

> 每条给：平台出处 → 为什么是杀手级 → AI-CG-Studio 的落地产品场景（结合 Anima/Krea 2/WAI 底模、
> 热门角色免 LoRA 蓝图、场景推断、Live2D 角色舞台）→ 技术落点（对齐现有架构，尽量零新增依赖）。

### 精髓一：同题多车道渲染（三引擎同意图 → 出 Grid）【最高优先级】
- **出处**：Midjourney 4 宫格、SeaArt 一次 4 张对比、Civitai 多候选。
- **杀手级原因**：AI-CG-Studio 有三套各有所长的引擎（Krea 2 自然语言跟随、Anima 影视级光影、WAI 经典二次元 CG），
  现在却只能"手动切一个引擎跑一张"，用户要来回猜哪个引擎适合这场戏。
- **产品场景**：在结果舞台把"单张画布"升级为"一次出片 Grid"。用户定好 故事+角色+场景蓝图+镜头/光照/情绪+画幅 后，
  点「多车道出片」→ 同一份结构化意图同时派给 Krea 2（散文）/Anima（标签+LoRA）/WAI（Danbooru）→ 结果以 3 张并排网格呈现，
  每格角标引擎名；点击某格放大并把该引擎设为当前偏好。配合"多 seed 候选项"（项目 prompt-image-quality-roadmap §10 已规划的 4/8/12-20 seed）做"4 格不同 seed/不同画幅"。
- **技术落点**：`drawEngine` 从单个 `ref` 改为可并发提交的一组会话（每个引擎一个 `useAnimaSession`/`useSDGenerate` 实例）；
  `buildPopularPromptPlan`/`usePromptAssembly` 已按 engine 分支，只要把 `renderPromptPlan(plan, 'krea2'|'anima'|'sd')` 对同一 plan 各调一次即可拿到三份请求。
  结果区把 `pb-compare` 的两卡网格扩成 `n-card` 网格；每个网格项保留独立 seed/engine 元数据待入册。
- **进阶叠加（Krea 灵感）**：
  - **网格格内拖杆对比**：结果区支持在任意两格之间拉一根**前后/左右对比滑杆（drag-comparison-slider）**，像 Krea 增强器那样左右对照两名引擎的差异；
  - **参考图风格（传图而非预设）**：把 Krea's style-reference（最多 4 张 + 每张 strength slider + moodboard）本地化为「以某张已出图当风格/氛围参考再生成」，
    与 NovelAI Vibe Transfer、MJ --sref 同一族，作为跨引擎细修的“传图调味”，而非只能选预设。
- **对齐文档**：`prompt-image-quality-roadmap.md` §7.1 `VisualIntent`、§8 画幅导演、§10 多 seed 选片正是同一目标，本建议是其 UI 化出口。

### 精髓二：生成过程真·渐进预览（步骤级真进度 + 可用的中间帧）
- **出处**：Krea 当代实时生成手感与其官方澄清；Midjourney "四张成组落位"的确定性进度。
- **杀手级原因**：生图通常要 20–60 步、十几秒到分钟。现在用户只看到"百分比环 + 一句话状态"，等待焦虑高；
  SD 甚至把最有"正在成形"感的中间帧用 `skip_current_image=true` 主动丢掉了。
- **产品场景**：生成中，结果画布原地显示"当前去噪中间帧"（WebUI 路径：`/sdapi/v1/progress` 返回 `current_image` base64，
  把 `skip_current_image=false` 即可流式渲染；Anima/Krea 路径需网关把步骤与可选 webp 中间帧暴露成新端点）。
  对拿不到中间帧的路径，退化为**确定性步骤占位**（准备→采样 12/24→高清修复→完成）与真实步骤数字，而不是假进度。
  ⚠️ 参考 Krea 官方澄清：**图像扩散是整帧连续重算，不存在"可优雅平滑的逐帧模糊→清晰中间图"**——
  所以不要把中间帧做成平滑播放的"视频"，而应做成**低频采样（每几步取一帧）的"像是在长出来"的低码率渐进**，
  或用纯进度的确定性阶段轴。舞台可复用现有 `stage-placeholder.is-generating` 呼吸环，但把"进度"从纯百分比升级为
  "能看到图像在长出来 + 真实步骤序号"。
- **技术落点**：
  - WebUI 路径：改 `useSDGenerate.ts` 的 `/sdapi/v1/progress` 轮询——去掉 `skip_current_image=true`，拿 `current_image`
    base64 实时替换画布（本机 A1111 原生支持）。
  - Anima/Krea 路径：`useAnimaSession.pollJob` 现在只拿得到 `job.status`（running/succeeded），无步骤/中间帧；
    需在网关 `routes/anima.js`（ComfyUI 上游）把去噪步骤（step/total）与可选 webp 预览帧暴露成新端点，
    前端再按 ~1s 轮询。拿不到时退化为"确定性步骤占位 + 步骤数字"，不让假进度膨胀。
- **对齐 `visual-architecture-roadmap` 第十五轮**：项目已做 blur-up 入场，但那是"结论入场"；
  本文建议的是"过程真渐进"，二者互补。

### 精髓三：成片元数据一键复用 + 写入 PNG + 增强前后对比（Civitai 闭环 + Krea 拉杆）
- **出处**：Civitai "Copy generation data" 一键复制整套参数并可粘贴 A1111/ComfyUI；NovelAI 一键还原重入图；
  Krea 增强器配 drag-comparison-slider 前后对比。
- **杀手级原因**：本地工具最大的资产是"历史好图"，但现状是参数只在 `HistoryEntry` 内存里；一旦备份迁移/导出 / 想在别的前端复现，就丢了。
  Civitai 证明：只要"保存时写入 PNG 元数据段 + 一眼可复制的整套参数"，就能形成"看到好图 → 复制 → 复现"的最小闭环。
- **产品场景**：
  - 保存 / 下载原图时，把 `prompt/negative/seed/cfg/steps/sampler/scheduler/model/lora/engine/loraWeight` 以自定义 tEXt chunk
    （或 A1111 兼容的 `parameters` 段）写进 PNG；
  - `HistoryPanel`/`GalleryView` 每张卡新增「复制生成参数」按钮（一键把整套参数包成 A1111/Civitai 文案），不再只是「复制 Prompt」；
  - 历史查看器 facts 补全 cfg/steps/scheduler/negative，并支持「粘贴回填参数面板」（读到 PNG 元数据或剪贴板直接重建一次生成）。
- **技术落点**：`useImageStore.imgPut` 存盘前对 PNG blob 做一次 `canvas`/后端 re-encode 注入元数据段（或网关存 image 时保留一个 companion meta）；
  复用时 `applyHistory` 已能恢复完整意图，只需把 facts 面板数据补全即可。`HistoryEntry` 已存全部字段，落地基本是"读出来 + 写进文件"。
  **增强对比子项**：项目「高清放大 2x (4K)」已有，给放大结果加一根 Krea 式 drag-comparison-slider，左右拖拽对照放大前/后（低/高清），
  让"高清修复是否值得"一眼可判。
- **对齐现状**：blob 现在存的是原始 PNG（`useImageStore.ts` 里 `imgPut(file: Blob)` 直接存），所以元数据注入是纯增量、不动现有 DB 结构（可只对"本次之后的保存"生效 + 一次迁移补历史）。

### 精髓四：Tag 权重胶囊微交互 + 一键"语言桥接"（NovelAI 权重滑杆 × Krea Enhance）
- **出处**：NovelAI 把 `(tag:1.2)` 收进"选中 token → 数值控件/滑杆 + 颜色标注，改完即时高亮"；
  Krea 的 **Enhance/Enhancer**（一键把粗糙描述扩写成更具体自然语言）。
- **杀手级原因**：专家模式里手选标签是纯开关（有/无），无法表达"这个词要多强调"。但 Anima 明确要高权重（`(chibi:2)` 才有感）、
  WAI 用 `(tag:1.2)`、Krea 用自然语言且**无独立负面词**——项目三套引擎对"强调"的表达各异，是最容易让用户困惑又最有编辑价值的一环。
- **产品场景**：在「词条工作台 · Tags」把已激活的胶囊做成**可调权重**：点选某个已加标签 → 胶囊上浮出迷你滑杆/加减号/数值框，
  输入 0.8/1.1/1.2/2.0 → `PromptHealthPanel` 实时把该 tag 渲染成 `(tag:1.2)`（WAI）或提升其在标签流中的位置（Anima 用高权重）、
  Krea 路径则把该词扩展成更长的自然语言短语（如 `school uniform` → `her neatly pressed navy school uniform`），
  并加一颗 Krea 专属的 **Enhance 按钮**：把这段被强调的 tag 一键扩写成完整英文散文（复用项目 `promptCompiler` 的 ACTION/MOOD/OUTFIT
  REWRITES 映射，不必外接 LLM）。权重变化即时反映到合法性与 token 计数（低于阈值、撞禁区标红），
  避免用户手写 `(tag:1.2)` 语法错误或让 Krea 散文里混入 `(tag:1.2)`。
- **技术落点**：把 `pb.manualTags` 从 `Set<string>` 扩为 `Map<string, number>`（或新增 `weightedTags`），
  `formatPromptForEngine`/`buildPopularPromptPlan` 组装时按权重注入；`PromptHealthPanel` 已做 token 分类着色与健康报告回调，直接复用。
- **进阶叠加（同源 NovelAI，可二选一落地）**：
  - **UC 阻止词库整块开关**：把「负向排除流」升级为 NovelAI 式"整块可开关的 Undesired Content 词库"——预设模型负面 +
    用户追加，整体 toggle，而不是逐条手敲 `[tag]`。对本地 R18「fail-closed」契约（`adultEnabled=false` 拒成人词）尤其合适：
    成人词黑名单做成一键启用的 UC 块。
  - **层式 Prompt 分块**：把词条工作台按「角色/服装/场景/风格/动作表情」分成可折叠、可重排、可单独赋权的区块
    （`PromptHealthPanel` 已按 token 分类着色，分区展示成本低），替代单一超长输入框。
  - **两段式 Generate 按钮**：主导按钮把「生成（场景模式默认）」与「生成一组候选/多车道出片」做成分层动作，减少一次点击
    （对齐 `visual-architecture-roadmap` 场景模式"生成、队列不能被隐藏"）。
  - **Vibe Transfer 的本地落地**：结合「热门角色免 LoRA + 场景推断」，可把「参考某张已生成图的氛围/构图」做成"以图为条件再生成"
    （类似 MJ --sref / NovelAI vibe），复用 `applyHistory` 的完整意图恢复 + LoRA 契约，作为跨引擎细修入口。

### 精髓五：历史版本树 / Fork 溯源（MJ 的缺位即本地机会）
- **出处**：NovelAI 的 back/fork 版本树；Midjourney 明确没做好谱系树（Numonic：graph, not list）；
  项目 `HistoryEntry` 已有 `parent_id`/`version` 字段却闲置。
- **杀手级原因**：创作是一个"反复 derive"的有向图（seed 初稿 → 变体 → 放大 → remix）。现在 Gallery 只有扁平时序列表，
  "重新生成/生成变体"不写亲子关系，用户无法"从最终成片一路回溯到最初 intent"，也无法把两个分支并排对比。
  这正是 MJ 明确做不到、文档里反复被点名的痛点——本地工具可以低成本做到。
- **产品场景**：
  - 从历史走「生成变体」/「重新生成」时，`applyHistory` 之后提交的新条目自动写 `parent_id = 来源.id`、`version = 父版本+1`；
  - Gallery / 导演台历史侧栏新增「谱系」入口：从选中图向上展开父链、向下展开子分支，可并排选两格对比（复用 `pb-compare`）；
  - 每条图的 `source: 由 v1 #1024 「雨夜教室」变体而来` 这种可读溯源文案。
- **技术落点**：`commitHistoryEntry` 在提交时接受可选 `parentId`；`HistoryEntry.version/parent_id/project` 均已定义，
  只需在 regen/variant 深链路径传值 + `GalleryView` 加一个基于 `parent_id` 建父子索引的树渲染（纯前端，IndexedDB 读取现有 history）。

### 精髓六（加分）：算力/队列预算显式化 + hover 显示 prompt + 行级复用
- **出处**：MJ 的 Fast/Relax GPU 预算与"第三只钟"心智、Krea 的 Compute Units + 模型选择器显示速度/质量/算力 + 行级 Retry/Reuse/Share parameters、hover prompt。
- **杀手级原因**：本地生图有真实 GPU（RTX 4070 Ti SUPER 16GB）成本与排队（ComfyUI pending / SD 队列），
  现在用户只能靠"显存紧张时别同时开"的静态提示猜。把"本次会话预计耗时/剩余队列/显存余量"做成可见、可并发的等级反馈，
  以及缩略图 hover 即见 prompt，都是低成本高感知项。
- **产品场景**：
  - 舞台/结果区显示当前引擎的预计步时（已有多 seed 选片的 ETA 外推可复用 `useTrainingTelemetry` 思路）；
  - **模型选择器把「速度 + 质量 + 预计算力成本」并排呈现**（Krea 式），让选 Krea2/Anima/WAI 不再靠名字猜；
  - CombinedQueue 区分"即时/优先级/排队"（免费档走低优先级队列的本地版）；
  - Gallery 缩略图 hover 浮层直接显示该图 prompt 首行 + 行级「重跑/复用参数/分享 seed」快捷动作（Krea 式，`GalleryView` facts 已有数据）。

---

## 4. 源与依据

- 平台：见各子代理报告的链接（How-To Geek、Flowith、NoMonic、dev.to、writingmate、insaneapp、aistacknav、MJ-Docs、toolcolumn、
  Civitai Education/DeepWiki、Civitai 生态仓库、SeaArt 官方、NovelAI 官方/社区、
  Krea 官方 docs（Realtime / Image generation / Enhancer / Krea 2 / Generative Sliders / Style References）、Chase Jarvis 评测）。
- 项目代码（视觉与架构路线的现状）：`visual-architecture-roadmap.md`、`prompt-image-quality-roadmap.md`、
  `drawing-experience-optimization-plan.md`、`three-engine-prompt-research.md`、`krea2-prompt-writing-guide.md`；
  源码 `src/views/PromptBuilderView.vue`、`src/components/*`（GenerationQueuePanel/HistoryPanel/PromptHealthPanel/GalleryView/ArtistStylePicker/AnimaQuickPanel/ManagedDrawingRouteCard/SDRecoveryPanel）、
  `src/views/GalleryView.vue`、`src/composables/useSDGenerate.ts`、`src/composables/useAnimaSession.ts`、`src/composables/useImageStore.ts`、
  `src/stores/promptBuilderStore.ts`、`src/utils/promptCompiler.ts`、`src/utils/promptPolicy.ts`、`src/config/promptConstants.ts`、`src/config/kreaStyleRecipes.ts`、
  `src/assets/css/design-system.css`、`routes/generation.js`。
