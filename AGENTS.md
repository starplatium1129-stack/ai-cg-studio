# AI-CG-Studio 项目协作指南

> 当前状态基线：2026-08-14。本文只记录仍然有效的约束、架构和待办；已完成的迁移与历史审计不再保留（历史记录见 git log 与 `docs/`）。

## ⚠️ 最高优先级：遇难先搜，禁止盲目试错（所有协作者必须遵守）

**遇到反复无法解决的疑难（同一问题连续 2 次猜测/实验无效），必须立即停下来上网搜寻相关信息**（websearch/webfetch：现成实现、官方文档、issue、相似项目源码），照抄经过验证的行为，再谈定制。禁止继续盲猜、自造轮子、反复试错浪费时间。

- 搜索前先验证来源真实性（用 `api.github.com` 等 API 确认仓库存在，警惕 websearch 幻觉结果）。
- 这条适用于**每一位协作者**（包括并行开发的其他会话），不要让对方替你踩你已经踩过的坑。
- 违反表现：连续多次改动后仍失败、日志靠猜、问题定位靠"再试一次"。合规表现：先给出搜索到的参考依据，再动手改。
- **疑难解决后必须留档（2026-08-15 用户决策）**：任何反复排查后最终解决的疑难，必须把「现象 → 根因 → 修复 → 验证」写入 `docs/` 对应文档（或 AGENTS.md 相关章节），标注日期；会话记忆会丢失，文档不会——**留档后才算真正解决**，后续会话/协作者先查档再动手。样例：`docs/showcase-pipeline-lessons.md`（2026-08-15 样张流水线 11 个疑难：negativeTokens 格式静默丢词、parseVerdict「不通过」误判、分身漏判、顽固场景重设计等，含可复用工具清单）。

## 产品约束

- 网站以本地个人使用为主。
- 控制面板桌面端保留常驻侧栏与收束的内容宽度；窄屏退化为顶部导航和单列，不能产生横向滚动。
- R18 内容默认开启，缩略图/样张继续使用模糊遮罩；不要擅自改成默认关闭或删除成人内容。
- **热门角色成人资格已「全部开放」（2026-08-14 用户决策）**：`data/popular-characters.json` 18 个角色全部 `adultEligibility: 'adult'`；fail-closed 契约保留——`adultEnabled=false` 开关与 unknown/underage 分类仍拒绝成人内容（`blueprintEligible`/`recipeEligible` 双重把关），不得把任何角色改回 underage。
- 绘图页保留两种工作模式：
  - 场景模式：紧凑、低认知负担，自动推断镜头/光照/构图；出图参数默认折叠，但生成、队列、配音不能被隐藏。
  - 专家模式：开放完整场景、词条和 Prompt 结构；大型选项区默认折叠，避免页面拥挤。
- 绘图页内容宽度与作品册接近，不铺满 4K 屏幕。
- 角色空间同时支持本地 Ollama 与 OpenAI-compatible API（含 DeepSeek、OpenCode 类端点）；模型名必须可配置或发现，不能由供应商名称猜测。
- 角色配音是现有功能，重构布局时不得删除。
- 网站 `/chat` 的 Live2D 默认按需加载，用户显式启用前不得下载大贴图；Electron Companion 是明确例外：窗口可见启动时默认加载，`--hidden` 与用户显式关闭时不得下载。
- 陪伴行为（`companionBehavior.ts`）：主动提醒不调用 LLM、不自动出声，台词只来自 `COMPANION_LINES` 确定性轮转与环境问候表 `ENVIRONMENT_LINES`（`environmentContext.ts`，同为确定性台词、按时间片/环境选择，不调 LLM）；安静时段（默认 23:00-8:00）与勿扰期内不产出、不出队，队列保留到关闭勿扰；配置只存 `aics_companion_behavior_v1`。
- 桌面打包模式限制：`desktop/main.ts` 仅在 `app.isPackaged` 时注入 `AICS_DESKTOP_PACKAGED=1`（dev 模式 `electron .` 不注入）。该模式下 data 位于只读 asar、维护脚本未打包、系统 npm/node 读不了 asar，故场景内容维护链路（`/api/maintenance/scenes`、`/api/maintenance/run`、`/api/maintenance/build-web`）返回 501 `DESKTOP_MAINTENANCE_UNAVAILABLE`；`/api/maintenance/showcase` 与 `home-hero` 写 AI 工作区不受限。前端 SceneManagerView/ControlView 通过 `companionDesktop.isPackaged()` 禁用入口。测试锚点：test-gateway-contract.js「desktop mode 501」。

## 图片审核

- 使用当前模型的视觉能力或本地图片查看工具逐张检查图片。
- 主模型无法直接查看图片时，使用 `image-inspect` 技能（`scripts/maintenance/image-inspect.js`，本地 CLIProxyAPI + gemini-3.7-flash-high）逐张识别，作为兜底视觉通道；脚本结论仍需按本清单复核。
- 不调用 `vision.js`、千问 VL 或旧的 `Codex-vision-skill`。
- 场景样张、模型对比图和训练素材不能只按文件名、标签或自动评分判断。
- 审核维度（与 `image-inspect -t audit` 八维一致）：身份特征还原、脸部与神态、服装、肢体结构与姿势、构图、背景与细节、光影与氛围、完成度与叙事；双人图必查特征串位。
- 审核从严：硬伤（手/脸/肢体崩坏、穿模、串位、伪影异物）必须判「不通过」，问题须给出位置与修复方向，不得含糊；脚本结论只是初筛，以人工终审为准。
- **批量审核与批量出图必须并行执行（2026-08-15 用户决策）**：多图审核（image-inspect 批量）用 4-6 并发；批量出图脚本用 `--concurrency 3`（如 generate-popular-showcase-anima11.js）。禁止串行逐张跑——串行 335 张约 2 小时，并行约 15 分钟。并行脚本必须支持断点续跑与进度落盘（参考 `runtime/person-count-audit.js` 的并发池模式：每张完成即写结果、每 N 张落盘 JSON），中断不丢已审/已生成结果。
- **审核判定必须防漏判（2026-08-15 教训）**：`audit-showcase-rella.js` 的 `parseVerdict` 有两个已修 bug——① `concl.includes('通过')` 会误匹配「**不**通过」，必须先判 `/不通过/` 再判 `/通过/`；② vision 有时结论写「通过」但详情描述分身/双人/分镜，必须用正则扫详情（分身/双人/复制/分镜/拼贴等词，且上下文无「无/非/仅」否定）强制 fail。**修改任何审核判定逻辑后，必须用已知的漏判案例回归**（如「结论不通过但被判 pass」的历史记录）。
- **单人场景人物数量专项核查**：单人场景样张发布前，除常规审核外须做一次「画面人物数」核查（参考 `runtime/person-count-audit.js`：逐张问「几个完整可见人物」）；背景路人/镜像倒影/雕像剪影可接受，**分身/复制体/多格分镜拼贴一律不合格**。

## 热门角色数据维护规范（2026-08-15 起）

- **改数据先对照权威源**：`data/popular-characters.json` / `data/scene-blueprints.json` 的任何服装、身份、场景描述修改，必须先读 `E:\code\2\lora\AI\Research\character-arknights\*.json`（调研权威产出）核对官方设定；禁止凭记忆改（本轮 12 个角色 standard 配错、史尔特尔被误改成「红披风」都是没对照权威源的教训）。
- **prompt 语言约束**：Anima/Krea 是英文模型——outfit/identity/场景 prose 必须纯英文自然语言，禁止中文设计说明混入；tokens 必须干净（无括号、逗号残渣，如 `sweater), green` 这类损坏 token 会污染提示词）。批量转录后必须脚本复查（CJK 正则 + 残渣正则）。
- **场景-服装一致性**：blueprint 的 `promptProse`/`nsfwProse` 不得与 `outfitId` 服装类型矛盾（如夜市场景写 "her uniform" 但配休闲装 → 模型画成战术装）。改场景时 `promptProse`、`nsfwProse`、`sceneTags`、`promptTokens` 四处必须同步。
- **R18 场景室内化偏好（2026-08-15 用户决策）**：成人场景放在室内——城市公共空间（天台/屋顶/后巷/露台/街道）一律室内化；私密天然场所（温泉/海浴/庭院浴池/河湾）可保留室外。室内化时 nsfwProse 必须同步改（成人场景裸体叙述前置，漏改会继续画出室外）。
- **发布前检查角色覆盖**：`publish-popular-showcase.js` 会**删除源目录全部旧 pc_* 重建**——多批次合并发布时必须合并所有角色的 manifest（参考 `runtime/merge-publish-data.js`：v18 旧角色 + 新角色合并且按 key 取最新 attempt），dry-run 核对 typeCounts 与角色数，否则旧角色样张被静默删除。发布用 `--from <generation-manifest-merged.json>` + `--source <旧版本> --target <新版本> --apply --force`。
- **数据格式一致性**：`scene-blueprints.json` 的 `negativeTokens` 历史为逗号分隔字符串——解析器必须用 `negativeStringList`（兼容字符串/数组，`stringList` 对字符串返回 `[]` 会静默丢词，2026-08-15 实锤 336 场景负面定制从未生效）。新增字段注意解析器与数据格式匹配，改后跑 `test-popular-content.js`。
- **顽固场景止损（2026-08-15 教训）**：同一场景连续重出（≥5 次，含换 seed/强化负面/场景简化）仍出分身/双人时，**标记暂缓发布**（audit 保持 fail，从 showcase 剔除），不要无限重试烧 GPU；记录场景 id 与已试措施，留给后续换引擎/换构图再战（例：`kaltsit_arknights_r18_cabin_robe` 6 连败）。
- **场景预设提示词是图生视频的上游输入（2026-08-15 用户指示）**：图生视频的提示词与场景预设（`scene-blueprints.json` 的 `promptProse`/`promptTokens`/`description`/`action`）息息相关——视频生成会复用/派生场景预设描述。因此场景预设必须写得**具体、可视觉化、构图与动作明确**（人物姿势、镜头、光线、氛围、叙事都在描述里），禁止模糊或留白；任何场景描述的修改都要假设会被下游图生视频直接引用，改完自查「这段描述能否直接驱动一段 5-10 秒的视频」。视频链路改动（`routes/video.js`、`VideoStudioView.vue`、`docs/video-generation-roadmap.md`）由负责图生视频的协作者维护，本会话不碰。

## 当前架构

- 前端：Vue 3 + Vite + TypeScript + Pinia，入口为 `index.html`。
- 路由页面：`src/views/*.vue`，全部懒加载。
- 共享组件：`src/components/`。
- 状态：`src/stores/sceneStore.ts` 与 `src/stores/promptBuilderStore.ts`。
- 业务组合函数：`src/composables/`。
- Prompt、场景推断、SD 请求构建与错误策略：`src/utils/`。
- Live2D 双后端：`src/live2d/`（`types.ts` 契约 / `browserBackend.ts` wl-live2d / `nativeBackend.ts` Rust overlay 桥 / `createBackend.ts` 工厂回退）。浏览器默认走 wl-live2d（行为零改动）；`ChatCharacterStage` 的 `backend` prop 或 html `data-live2d-backend` / `?live2dBackend=` 可请求原生后端，桥（`window.aicsLive2dNative`）缺失自动回退浏览器并标记 `data-backend="browser-fallback"`。原生后端只传意图（口型/情绪/凝视/动作组），参数级写入由 Cubism Native 作者工程执行；`blinkScheduler`/`MOUTH_PARAMS`/`emotionRuntime` 参数 hack 只在浏览器路径运行。IPC 契约见 `src/types/live2dNative.ts` 与 `docs/live2d-native-overlay-plan.md`（Rust 侧实现依据）。overlay 矩形一律屏幕物理像素，换算在 `src/utils/live2dOverlayLayout.ts`（纯函数）。
- 网关：Express，路由位于 `routes/`，安全与公共服务位于 `server/`、`services/`。
- 分享 token：未设置 `TOKEN` 环境变量时，首次启动生成并持久化至 `runtime/state/gateway_token`；重启必须复用该 token。`TOKEN` 环境变量仅作显式覆盖，不得改写持久化 token。
- 数据：场景运行时数据通过 `sceneStore` 单例加载；不要重新添加散落的 `/data/*.json` fetch。
- 图片与历史：IndexedDB，封装在 `useKVStore`、`useImageStore`、`useBackup`。
- `docs/*.html` 仍使用 `tools/nav.js`、`theme.js`、`local-status.js`；这些是文档站运行时，不属于已删除的应用控制器。

### Krea 2 生成链路约束（2026-08-14 实机验证，改前必读）

- 文本编码器用 **Heretic 未审查版**（`qwen3-vl-4b-heretic_fp8_e4m3fn.safetensors`，替换官方 `qwen3vl_4b_fp8_scaled.safetensors`）；官方版带 RLHF 审查对齐，会拒绝出裸。
- `ConditioningKrea2Rebalance`（`routes/anima.js` Krea 分支）**必须保持 `preset:'standard'`、`multiplier:1.1`、`normalize_taps:false`**：
  - `normalize_taps:true` 会导致 conditioning 崩溃（全图色散/栅格化/五官崩坏，8 组实测全崩）；
  - aggressive 预设（mult 4.0 压审查层过狠）实测导致拒绝出裸；standard 是用户实机验证的可用组合。
- Krea 2 成人提示词组装（`buildPopularPromptPlan`）三条铁律：**裸体词（nsfwProse）前置**、**outfitProse 置空**（Krea 模板会拼 "subject, wearing {outfit}"，穿衣服描述压过显式词）、**identityProse 剥离句尾 `wearing/dressed in` 服装描述**（`identityWithoutOutfit` 已内置，勿回退）。
- Krea 2 是自然语言模型：禁 `(tag:1.2)` 权重语法、禁下划线 token、禁 score/质量词、负面恒空；写法规范见 `docs/krea2-prompt-writing-guide.md` 与 `docs/three-engine-prompt-research.md`。
- NSFW 生产优先 Anima 引擎（本机多轮实测稳定）；Krea 2 定位创意探索与快速样张。

### 训练台参数契约（白名单覆盖）

- 浏览器可覆盖的训练参数仅限 `TrainingParamOverrides` 白名单字段（epochs/batch_size/gradient_accumulation_steps/lora_rank/lora_alpha/unet_learning_rate/text_encoder_learning_rate/text_encoder_stop_epoch）；未知 key、非数字、越界一律 400。
- 覆盖值由服务端写入 `training_configs/.ui_plans/` 下带时间戳的一次性配置副本（原配置只读），浏览器仍无法直接传路径或命令；无覆盖时保持原配置启动。
- `GET /api/training/jobs/:id/config` 返回白名单字段与推荐值（来源为磁盘 v18 配置），voice 任务返回 `available: false`。
- 前端参数草稿按 job 持久化在 `aics_training_params_<jobId>`（localStorage），"开始训练"只提交与推荐值不同的字段；ETA 由前端滑动平均步速外推，不依赖服务端时钟。
- LoRA 数据集可切换：服务端枚举 `AI/Datasets/Characters/<角色>/` 下非隐藏子目录为候选（`job.datasetOptions` 含每个候选的图片/标注/体积/分层统计），浏览器只传枚举 id（未知 id 一律 400，仍不传路径）；`job.selectedDataset` 是默认目录（宁宁 `V18_WD14_Curated`、夏目 `V17_WD14_Curated`，无则取枚举首个）。前端选择持久化在 `aics_training_dataset_<jobId>`。

### 已形成独立所有权的绘图组件

- `VoiceStudio.vue`：配音、翻译、音频生命周期。
- `PromptDataTools.vue`：备份、恢复和弹层焦点。
- `PromptHealthPanel.vue`：Prompt 结构与违规提示。
- `GenerationQueuePanel.vue`：出图队列。
- `SDRecoveryPanel.vue`：SD 错误分类和恢复动作。
- `usePromptAssembly.ts`：模型 Profile、有效场景、角色特征、LoRA 权重与正负 Prompt 组装、健康报告和预览。它只拥有派生的 Prompt 策略；场景/UI、SD 队列、历史和生命周期继续留在 `PromptBuilderView.vue`。

继续拆分时按状态与生命周期所有权拆，不要仅为了减少行数搬函数。

### 已形成独立所有权的角色空间组件

- `ChatApiSettings.vue`：本地/API 供应商切换、连接测试与模型发现。
- `ChatCharacterStage.vue`：角色切换、立绘与按需 Live2D 生命周期。用户显式启用前不得下载大贴图；启用后可预加载小型原生动作，保证首次点击也有反馈。宁宁打包源模型的呆毛、头部、脸、身体、两侧与裙摆及对应原生动作；`wl-live2d` 在缩放后可能把 DOM 点击全部报为 Body，因此由可见舞台分区稳定分派到源码动作，Cubism hit test 只作未测量时的回退。动作调用的第三个参数是 `MotionPriority`，点击必须传 `FORCE`（数值 `3`）；传 `null` 会静默拒绝；有多个原生变体的互动分组不得固定使用第 `0` 个，交给 Cubism 选择已导入的 authored motion。互动提示与高亮只能在渲染器返回动作已启动后显示；同一动作播放期间再次点击应提示"动作进行中"，只有无活动动作时的拒绝才报失败。宁宁的 `expression1` 至 `expression5` 是模型自带的校服、常服、睡衣、COS 服与魔女服，不是情绪表情；只能由显式换装控件切换并持久化。夏目只有一套咖啡店制服；其互动 motion 内部会临时显隐作者绑定的叠层/服装效果，不能从衣橱选择，也不得手动驱动这些参数。不得打包或播放源项目 WAV（角色配音仍由现有 TTS 负责），不得用参数生成伪动作或伪换装。
- 情绪表演运行时 `src/utils/emotionRuntime.ts`（纯 TS，无 DOM）：由 ChatCharacterStage 创建并 attach 到 useLive2D，`beforeModelUpdate` 里批量写入表情参数。只驱动 cdi3 中"按键切换"表情零件（脸红/害羞/泪珠/期待眼珠/高光等）与标准参数（眉毛/微笑眼/嘴型），不得驱动 `ParamCheek21-24/40-43` 动作切换、`Param37/62-64` 动画参数与换装参数。`pushEmotion('neutral')` 立即开始淡出（回合结束回中性），不保持强度。归零的参数自动交还给 idle 动作，避免常驻覆写压死待机动画。反应脉冲（用户发消息→期待眼珠+眉微抬 1.1s）独立于情绪强度。测试 `test-emotion-runtime.js` 已在 validate 链。
- 情绪输入有两条通道：TTS 逐句情绪（useVoice `onExpression`，配音开启时为准）与流式回复文本情绪（useChatConversation `onStreamEmotion`，无配音时兜底，文本 ≥4 字、情绪变化才回调，回合结束复位 neutral）。两者互斥：`onStreamEmotion` 在 ChatView 侧检查 `autoVoice` 后让位 TTS 通道。
- 夏目 Live2D（`assets/live2d/natsume/`，源目录 `E:/code/live2d/星光咖啡馆与死神之蝶—四季夏目/`）：源目录只有单个导出态 `Moc.moc3`/`model.json`，没有可编辑 `.cmo3`、服装 Expressions 或分服装模型。14 个纹理槽都被 moc3 使用；主制服网格和默认隐藏叠层共同存在，部分互动 motion 会通过完整参数曲线临时显隐这些叠层，因此不能把动作效果误登记成多套衣装。moc3 无 `ParamMouthOpenY`，口型由 `ParamMouthForm3`（-0.5..0）驱动，`MOUTH_PARAMS` 按角色映射；无 Expressions，衣橱只能公开咖啡店制服。严禁再按 `Part2-28` 连续编号猜服装、驱动 `Param36-75` 拼装衣服、强制 Drawable opacity，或固定只播放动作分组第 `0` 个；这些参数由作者 motion 所有，必须让完整原生动作自然驱动，否则会造成缺衣、串层并破坏原生动作。若要增加夏目衣装，只接受原作者可编辑 Cubism 工程、已绑定的独立 `.moc3`/`.model3.json`，或重新在 Cubism 中完成网格绑定；仅使用现有静态立绘时必须明确降级为静态图片切换。情绪参数表 `NATSUME_RUNTIME_CONFIG` 只驱动 `ParamCheek`/`ParamBrow*`（不碰 `ParamEyeLOpen/Open2` 眨眼组、嘴型、`Param36-75` 与数字物理参数），reaction 脉冲为脸红+眉微抬；互动分区与 `NATSUME_INTERACTIONS`/`NATSUME_HIT_AREA_MAP` 按角色切换。源目录动作 WAV 一律不打包（宁宁、夏目同约束）。
- 眨眼由 `src/utils/blinkScheduler.ts`（纯 TS）调度，`useLive2D.applyParameters` 在 `beforeModelUpdate` 里以全权重把同一值写入 EyeBlink 组双眼参数（宁宁 `ParamEyeLOpen/ParamEyeROpen`，夏目 `ParamEyeLOpen/ParamEyeLOpen2`），间隔 2.5-5s 随机、单次约 0.31s，保证双眼永远同步。不要改回依赖 wl-live2d 自动眨眼（其 CubismEyeBlink 只在无运动更新的帧触发，循环 Idle 下永不触发）或夏目作者 Idle 眼曲线（左右眼不同步，会出现持续数秒的单眼 Wink）。测试 `test-blink-scheduler.js` 已在 validate 链，E2E 断言见 studio.spec.ts「eyes blink symmetrically」。
- 动作分发由 wl-live2d 完成，实测行为：Idle 组每 ~5 秒（各动作时长）随机轮换一个；点击互动（Tap* 组）每次随机抽一个变体，28 个全部可达；Start 登场组在模型加载完成后随机播一次（宁宁无 Start 组自动跳过；登场期间暂停 blinkScheduler 覆盖，让作者眼曲线原样呈现，Start_4 含开场闭眼）；Leave 告别组在关闭 Live2D 时先播 5s（`LEAVE_PLAY_MS`）再销毁。E2E 断言见 studio.spec.ts「entrance motion」「Leave farewell」。
- `useChatStorage.ts`：会话、草稿、供应商配置和 Live2D 偏好持久化。

`useVoice.ts` 会保留聊天气泡中的舞台提示，但必须在翻译和 TTS 前剥离；提示文本用于情绪推断。短促片段需要并句，单句合成必须有有限超时和重试，并显示上游失败明细；超时或队列繁忙时不得重复提交同一句。配音播放层必须遵守：句子缓冲上限 44 字（更长文本 GPT-SoVITS 易复读/单句 GPU 时间线性上涨），首句 ≥8 字即放行（`firstThreshold: 8`，开场白不等满 12 字）；任何结束路径（含超时/失败重试）必须先 `pause()`+清除 `src` 再开新元素，严禁旧元素后台存活与重试元素叠播；只有"加载阶段失败"（还没出声）允许重试一次，已开播后断流或超时一律不重试，避免整句从头重复；超时时若请求仍活着（`networkState===2`）延展等待而非判死。`GET /api/tts` 服务端对同句生成做 in-flight 合并（`inFlightTts`），重试/多访客同句不重复占 GPU 队列；上游合成超时 180s（卡死更快释放 GPU 队列）。长对话不 400：`POST /api/chat` 对超 24 条或 12000 字的消息从旧到新平滑裁剪（body 上限 256kb，前端最多 20 条×1200 字，裁剪必须在 body 解析之后真正接管）。

聊天流、配音和角色舞台之间只传递必要状态；不要把 Live2D 或供应商设置重新塞回 `ChatView.vue`。

## 不得回退的架构约束

- 不要恢复已删除的 `tools/chat/`、`tools/prompt-builder/`、旧 `tools/*.html` 页面。
- 不要向 `index.html` 添加 `/tools/...` 或其他全局脚本注入。
- 不要恢复以下旧全局变量：
  - `window.AICKVStore`
  - `window.AICGImageStore`
  - `window.AICSceneUX`
  - `window.createSceneCard`
- 应用样式源只有 `src/assets/css/**` 和 SFC 样式；`docs` 使用同一份设计系统。
- 新增安全测试应断言真实 HTTP 路由输出，不要只测试复制出来的 helper。
- 控制面、维护路由必须复用 `server/security.js` 的本机判断与 URL 校验。
- API 失败使用统一错误信封；未知 `/api/*` 不得回退到 SPA HTML。

## 质量门槛

- 小改先跑相关测试，不需要每次都跑完整套。**默认禁止无脑全量用例**（多 worker 全量会把本机跑卡），按下面的规模分级走。
- 修改 `src/`：
  1. `npm run typecheck:app`
  2. `npm run build`
- 修改 `services/*.ts`：
  1. `npm run build:runtime`
  2. 提交生成的 `.js` 与 `.d.ts`
- 修改公共契约、安全、数据格式或跨页面基础设施：`npm run validate`
- 最终浏览器回归：`npm run test:e2e`
- 不要用裸 `tsc -p tsconfig.app.json` 代替 `vue-tsc`；它不会真实检查 `.vue` SFC。
- `npm run test:e2e` 会先构建；已有新构建时可用定向 `npx playwright test ...`，避免重复构建。

### E2E 分级策略（2026-08-01 起执行，避免全量把机器跑卡）

按改动范围选最轻的验证路径：

| 改动规模 | 验证 | E2E 是否跑 |
|---|---|---|
| 单视图文案/样式 | `typecheck:app` + `build` + 该页浏览器截图自查 | 不跑 |
| 单视图/组件逻辑 | 上面 + `node scripts/tests/test-*.js`（对应模块） | 不跑或 `--grep` 相关用例 |
| 路由/布局/全局 CSS/跨页组件 | 上面 + `npx playwright test tests/e2e/studio.spec.ts tests/e2e/flows.spec.ts` | 跑两个文件 |
| 交互/a11y/视觉语言相关 | 加 `tests/e2e/a11y-device.spec.ts`、`archive-visual-language.spec.ts`、`interaction-polish.spec.ts` | 定向跑 |
| 提交前兜底（跨页大改） | 全量 | `npx playwright test --workers=3`（或 4） |

- 定向跑保持默认多 worker（快且只开少量浏览器，不卡）；全量时**用 `--workers=3` 或 `4` 折中**，别用默认 workers 数全量跑。
- `--grep` 按用例名模糊匹配：`npx playwright test --grep "深链|quick|预算"`。
- 全量仅在「路由/全局布局/全局 CSS」这类改动时做一次；做完记住结果，后续小改不要再全量。

当前门槛覆盖真实应用 CSS、Vue SFC、运行时构建、场景契约、安全路由、存储、Prompt、SD、聊天、配音和 Playwright 流程。

`src/` 业务实现中的显式 `any` 已清零，新增代码不得回退；`vite-env.d.ts` 的 Vue 通配模块声明不计入业务类型债。

## 桌面部署（2026-08-15 起）

- **前端/数据改动优先走快速部署（用户决策 2026-08-15）**：一条命令完成 build + 复制 + 重启，不要再每次跑完整打包安装：
  ```
  powershell -ExecutionPolicy Bypass -File scripts/maintenance/deploy-desktop-quick.ps1
  ```
  它会把 `dist/`、`data/`、`assets/` 复制进已安装目录（`C:\Program Files\AI-CG-Studio\gateway\`）并重启应用（非管理员自动 UAC 自提升；`-SkipBuild` 跳过构建、`-NoRestart` 只复制）。
- **只有 Rust 壳（desktop-tauri）或后端 `server.js`/`services` 改动**才需要完整打包：`npm run build` → `npm run build:tauri` → `npm run package:tauri` → 静默安装（`setup.exe /S`）→ 清理旧 sidecar（3123）。
- **脚本编码约束**：`*.ps1` 必须保持纯 ASCII（PowerShell 5.1 对 UTF-8 无 BOM 的中文按 ANSI 解析会语法崩溃；本次曾踩坑）；如需中文说明要么用 ASCII 要么写回 UTF-8 BOM，且每次 edit 工具改写后都要复查。
- 部署前检查 3123 无残留占用；`dev` 网关（:3000）的 showcase 目录配置与 sidecar（:3123）是两套，改 showcase 后要确认 sidecar 侧 `SCENE_SHOWCASE_DIR` 指向 `E:\code\2\lora\AI\SceneShowcase`。

## 当前待办

- 视觉与架构路线（`docs/visual-architecture-roadmap.md`）：第一至十六轮及 API Client（`src/api/`）、存储 Repository（`src/storage/`）、训练台拆分（`useTraining*`）已全部完成；剩余仅网关公共设施收口（P3）残项——`services/*.ts` 内联 taskkill 迁移（已评估维持现状）、上游健康探测与代理配置进一步收敛。2026-08-15 已按路线图状态逐项打勾核对。
- 桌宠语音与演出增强（吸收 ZcChat2 精华）分阶段计划已记录在 `docs/companion-voice-roadmap.md`。P0/P1/P2（长按说话、会话状态机/唤醒词、`[mood=xxx]` 情绪标签协议）及 CompanionView 自动监听/热键接入、竞态复审已完成（2026-08-09）；剩余：P3 演出数据驱动、P4 自定义角色资产包——仍暂缓，每阶段独立验收，不串阶段。
- 提示词三引擎（Krea 2 / Anima / WAI-Illustrious）调研基线见 `docs/three-engine-prompt-research.md`，供精细化配置人员使用；**待办：热门角色 exactTokens 的括号消歧按 Anima 官方空格规则改 `rem (re zero)` 形式（当前为 `rem_(re_zero)`），先 A/B 验证还原度不降再批量改**（影响 `test-popular-content.js` 断言）。
- Live2D 方面仍只有在取得模型作者提供的、明确标注为情绪用途的原生 motion/expression 后，才增加非空 SoulLink native allowlist。

暂缓（已评估有结论，条件具备再动）：

1. Live2D 运行时块瘦身：wl-live2d bundle 完全自包含（pixi.js + cubism4 core），静态副本同尺寸无收益；实质瘦身需重写渲染层。已纳入 bundle 预算监控（lazy chunk 上限 1000KB）。
2. 消除 /chat 进出整页刷新：CSP 因 Live2D 需要 `unsafe-eval` 而按路由换页，现状已是"最小刷新"（仅进出各一次）；iframe/独立入口方案收益与 Live2D 交互回归风险不成比例。

长期观察：

1. RouteAtmosphere 粒子场按路由重建：可评估 keep-alive/复用，收益小、风险中。
2. `services/training-service.ts`（1069 行）训练功能稳定后按数据集/任务/日志拆分。
3. Express 5 升级评估（不急），需覆盖中间件与代理兼容性测试。

## 明确暂缓

- Live2D 42.85MB 贴图压缩、KTX2/WebP 转换。
- 已入 Git 历史的 Live2D 资源迁移到 Git LFS 或外部下载。

这两项需要单独的资源兼容性与仓库历史方案；未得到用户新指示前不要启动，更不能重写 Git 历史。

## 工作区注意事项

- 工作区可能包含用户自己的未提交修改；不要覆盖、格式化或顺手提交无关文件。
- 当前用户自有改动包括维护脚本时，应原样保留并在交付时说明。
- 禁止使用 `git reset --hard`、`git checkout --` 等破坏性恢复命令。

## 并行协作模式（2026-08-08 起）

多人并行开发时（如 Live2D 路径 B：另一位负责渲染器，本会话负责 Tauri 壳侧）：

1. **独立文件优先**：新代码放独立模块/文件（如 `desktop-tauri/src-tauri/src/live2d_overlay.rs`），不碰对方正在改的文件；确需改动对方文件时先备份原文件，交付时说明。
2. **只调公开 API**：跨 crate 协作用对方的公开接口（如 path 依赖 + `pub fn`），不做内部侵入。
3. **进展写进共享文档**：每次交付把「做了什么 + 证据 + 踩坑 + 对方的接入点」追加到 `docs/` 对应文档（如 `live2d-native-runtime.md`），让对方无需口头同步即可接手；包括对方瓶颈的新结论（即使推翻其假设也要写，附证据）。
4. **真机验证为证**：每项交付必须真机/命令实测通过并记录结果，不写未经验证的结论。
5. **冲突规避**：明确"我这边不会再碰的目录/文件"边界，避免双方改同一文件；打包资源/构建产物不入库。
6. **遇难先搜、禁止盲试**：遇到反复无法解决的疑难（连续多次猜测/实验无效），必须停下来上网搜寻相关信息（websearch/webfetch 现成实现、文档、issue、相似项目源码），而不是继续盲猜或自造轮子；搜索前先验证来源真实性（`api.github.com` 确认仓库存在，警惕幻觉结果）。这条对协作双方都适用——不要让对方替你踩自己已经踩过的坑。
7. **共享文件防并发写坏**：`AGENTS.md` 属用户/主会话维护，其他协作者如确需修改必须先备份原文件并保证 UTF-8 + 换行完整（2026-08-08 曾因错误编码写回导致全文件损坏）；`docs/` 共享文档追加内容时只增不改已有段落，避免双方同时改同一文件。
