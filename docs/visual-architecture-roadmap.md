# 绫季绘境视觉与架构改进路线

> 记录日期：2026-08-02（状态补充：2026-08-15）
> 产品前提：个人本地使用为主，偶尔分享给可信访客；不按公开 SaaS 或多人社区设计。

## 完成状态（2026-08-15 核对）

- ✅ 第一轮 桌面端氛围分层
- ✅ 第二轮 标题与工作台主次
- ✅ 第三轮 绘图页基础模式与标题层级
- ✅ 第四轮 状态面板语义统一
- ✅ 第五轮 首页主视觉减法
- ✅ 第六轮 工作台标签去重
- ✅ 第七轮 控制台窄屏优先级
- ✅ 第八轮 模型页层级校准
- ✅ 第九轮 场景卡操作层级
- ✅ 第十轮 首页首屏信息减法
- ✅ 第十一轮 生成 API 层收口（`generationApi` + `promptBuilderStore` 死状态清理）
- ✅ 第十二轮 Anima 生成会话抽取（`useAnimaSession`）
- ✅ 第十三轮 网关进程树收口（`process-tree.js`）+ 视觉审计首轮
- ✅ 第十四轮 Anima 轮询按引擎门控 + 视觉审计第二轮（light 主题）
- ✅ 第十五轮 图片呈现核查（A）+ 微交互收口（B）
- ✅ 第十六轮 弹层入场动画统一（B 收尾）
- ✅ API Client（`src/api/`）、存储 Repository（`src/storage/`）、训练台拆分（`useTraining*`）
- ⏳ 剩余：网关公共设施收口（P3）残项——`services/*.ts` 内联 taskkill 迁移（已评估维持现状）、上游健康探测与代理配置进一步收敛；`artworkRepository` 之外的历史删除入口统一属已签收项，无需再启动。


## 结论

当前 Web 侧 `Vue 3 + Vite + Pinia + Express + IndexedDB` 架构适合本项目，不进行 Web 端的 React 或 Nuxt 重写；桌面端 Companion / Atelier 壳已在 `desktop-tauri/` 建立独立的 Tauri 2 原生轻量容器（见 `docs/tauri-desktop-migration-plan.md`）。

下一阶段的核心不是增加更多粉色、樱花、粒子和卡片，而是：

> 从“很多漂亮元素”收敛为“每个页面只有一个明确的视觉主角”。

## 必须保留

- Vue 3、Vite、Vue Router 懒加载。
- Pinia 只管理真正共享的状态。
- Express 继续作为本机 AI 服务、安全和分享网关。
- IndexedDB 保存作品 Blob，localStorage 保存小型偏好。
- R18 默认开启，缩略图和样张继续保留模糊遮罩。
- 绘图页继续保留场景模式与专家模式。
- 角色配音和 Live2D 按需加载不得删除。
- `/chat` 因 CSP 进出整页刷新维持现状，不为消除刷新重写渲染层。

## 视觉优先级

### P1：视觉减法

1. 按页面类型分配装饰，不让星光、假名水印、樱花、路由编号、扫描线和页面粒子同时竞争。
2. 首页保留角色主视觉；档案页保留语义粒子；工具页只保留轻网格和状态反馈。
3. 工作页面默认不显示持续樱花。

主要位置：

- `src/components/visual/RouteAtmosphere.vue`
- `src/components/visual/ArchivePageHero.vue`
- `src/components/AppInteractionLayer.vue`
- `src/assets/css/design-system.css`

### P1：标题和页面层级

固定三级标题：

1. 首页品牌标题最大。
2. 作品、角色、场景档案页使用中大型标题。
3. 绘图、训练、控制等工具页使用紧凑标题。

已有 `WorkspaceArchiveBar` 时，减少重复英文 Kicker、路由编号和坐标标签。

### P1：工作页降密度

- 训练台始终显示任务、数据集、开始训练、状态和进度；参数覆盖默认折叠。
- 控制面板保留一个总状态，正常服务降权，异常服务突出。
- 减少等强度边框卡片，避免后台仪表盘感。

### P1：绘图页窄屏顺序

生成前：

```text
故事 → 画布 → 核心决策
```

生成后：

```text
结果画面 → 保存/变体/下载 → 其他参数
```

生成、队列和配音必须保持容易触达。

### P2：统一状态表达

全站明确区分：

1. 正在读取
2. 确实为空
3. 筛选无结果
4. 读取失败

优先扩展 `ArchiveStatePanel.vue`，不新增重复状态组件。

### P2：动效收口

- 普通路由只保留一个短页面过渡。
- 顶部加载条仅在导航超过约 `120ms` 后出现。
- 全屏 route cut 只用于少数特殊入口。
- 手机端樱花降到 6 至 8 片，并去掉模糊和阴影。
- 触屏设备不触发桌面 hover 抬升和图片位移。
- ~~Hero 粒子上限固定为 60fps，背景粒子维持 30/45fps。~~ **2026-08-15 用户决策推翻**：机器性能充裕，粒子全部改走原生刷新率（`registerParticleFrame(..., 0)`，每个 rAF 渲染、跑满显示器刷新率）；物理模拟按 elapsed 时间步进，高刷不变速，slowFrames 自愈仍保护低端机。同日移除首页 Hero 粒子场（角色立绘完全遮挡，纯空耗 GPU），可见用途保留：SceneExplorer 交互粒子场、ArchivePageHero、RouteAtmosphere 页面氛围。

## 架构优先级

### P1：统一前端 API 层

计划结构：

```text
src/api/
  client.ts
  chatApi.ts
  voiceApi.ts
  trainingApi.ts
  controlApi.ts
  maintenanceApi.ts
```

统一 JSON 错误信封、流式响应、请求取消和类型契约，减少视图直接处理 `fetch`。

### P1：建立本地存储 Repository

计划结构：

```text
src/storage/
  artworkRepository.ts
  chatRepository.ts
  settingsRepository.ts
  backupRepository.ts
```

作品删除应由同一入口完成历史、原图、缩略图和孤儿记录清理。

### P2：拆分 Prompt Builder 状态所有权

- `directorStore`：故事、角色、场景和词条。
- `useGenerationSession`：生成、进度、取消和错误。
- `artworkRepository`：作品和项目持久化。
- `useVoice`：继续管理配音生命周期。

按状态与生命周期所有权拆分，不按行数机械搬运。

### P2：拆分训练页生命周期

候选组合函数：

```text
useTrainingParams()
useTrainingTelemetry()
useTrainingPolling()
useTrainingOnboarding()
```

`trainingStore` 继续拥有服务端任务状态。

### P3：收口网关公共设施

逐步抽取 Windows 进程树结束、上游健康探测、静态资源策略、代理配置和统一错误处理；继续使用 Express，不引入新的服务端框架。

## 不建议启动

- Web 端 React 或 Nuxt 迁移。
- 纯粹为了桌面外观盲目重写 Web 主界面（Tauri 仅作为 Companion/Atelier 原生桌面壳）。
- 云数据库、账号系统或多租户体系。
- 继续堆叠全局装饰和路由过场。
- 未取得作者资源前伪造 Live2D 动作、换装或情绪 Expression。

## 推荐执行顺序

1. 视觉减法和标题层级。
2. 路由动效与移动端持续动画收口。
3. 训练台、控制面板和绘图页窄屏层级。
4. 统一状态组件。
5. API client 和作品 Repository。
6. Prompt Builder、训练页和网关内部拆分。

## 已开始实施

### 第一轮：桌面端氛围分层

- 手机端使用率低，移动端专项优化降为低优先级；只守住无横向滚动和功能可用底线。
- 樱花前景仅保留在首页、角色、剧情、场景和画册类沉浸页面。
- 绘图、训练、模型和维护类工具页面不再持续显示樱花。
- 带独立粒子 Hero 的档案页面不再重复显示右下角路由编号。
- 全屏 route cut 只用于沉浸页面；工具页使用更短的加载反馈和页面过渡。
- 保留工具页的档案网格、进度线和状态语言，不改成通用后台模板。

### 第二轮：标题与工作台主次

- 首页品牌标题保持全站最高视觉权重；档案、场景和作品册标题收进统一的次级字阶。
- 绘图页缩窄两侧控制栏、扩大中央舞台，并加强角色色底光与舞台边界。
- 训练方案参数由重复小卡片改为四列规格条，主任务卡降低阴影，角色标记强化视觉小说式身份色。
- 控制面板连接状态由七张悬浮卡片收束为一条整合状态带，主要服务配置面板继续保留清晰边界。
- 这轮只改变信息层级和视觉重量，不隐藏生成、队列、配音、训练或维护功能。

### 第三轮：绘图页基础模式与标题层级

- 工具页（训练台 / 控制面板）标题从档案页大字号收到三级紧凑档（~1.5rem），与模型架、场景管理同属工作台语言；首页品牌标题仍是全站最高视觉权重。
- 绘图页基础模式改为真正的两栏（故事 + 画布），镜头 / 光照 / 构图 / 情绪 / 色彩决策栏在该模式下完全隐藏，由自动推断接管；顶部一句话从"凝定情绪、镜头与光效"改为突出"自动推断"，避免与折叠区域冲突。窄屏顺序补齐：生成前 故事 → 画布，生成后 结果画面 → 故事 / 参数。
- 全屏 route cut 收口为仅 `/` 与 `/chat` 两个沉浸入口；常规路由（场景 / 画册 / 工具页）设为短暂标准过渡，加载条仍保持 120ms 阈值。测试锚点：interaction-polish.spec.ts "route cut 只保留在首页与角色房间"。

### 第四轮：状态面板语义统一

- `ArchiveStatePanel` 继续作为全站读取、空档案、筛选无结果、异常和完成反馈的唯一视觉组件；调用点不再各自发明色彩和空态框架。
- 状态面板按语义换用档案蓝、角色粉、危险红、成功绿，并让加载状态写出 `aria-busy="true"`；紧凑状态也继承同一套层级，避免首页和档案页出现不一致的空白区。

### 第五轮：首页主视觉减法

- 首页只保留角色画框、低密度粒子与档案信息作为主视觉语言；移除会持续扫过角色画面的循环高光，降低粒子不透明度，让宁宁与夏目的立绘、标题和继续创作入口维持明确焦点。

### 第六轮：工作台标签去重

- 已有 `WorkspaceArchiveBar` 的模型、训练和控制页不再重复输出同义的英文 Kicker；状态栏承担档案编号与机读上下文，页面标题只陈述当前工作内容，减少后台仪表盘式噪声。

### 第七轮：控制台窄屏优先级

- 控制台在 900px 以下将“创作状态”置于服务状态带首位，异常服务紧随其后；用户先看到当前是否可创作，再决定是否进入逐项服务配置。

### 第八轮：模型页层级校准

- LoRA 档案卡补齐档案蓝签名线、轻玻璃阴影和评测子区块；浅色主题下模型资料、评测数据和背景纸面保持可分辨的层级，而不增加新的装饰语言或干扰训练入口。

### 第九轮：场景卡操作层级

- 场景网格的“开始绘制”默认改为角色色描边动作，仅在悬停或键盘聚焦时提升为实心主色；场景缩略图、标题和状态标记重新成为浏览时的视觉入口，绘制功能与链接地址保持不变。

### 第十轮：首页首屏信息减法

- 首页 Hero 移除非交互的五步流程链，首屏只保留工作室身份、品牌标题、简短文案和“继续创作 / 先看成片”两个入口；完整创作入口仍紧随首屏，不让说明性流程与主 CTA 争夺注意力。

### 第十一轮：生成 API 层收口与导演台状态所有权清理

- `src/api/generationApi.ts` 落地：`/api/generation/*`（status / jobs 创建·轮询·取消）统一走 `client.ts` 信封契约（超时、AbortSignal、envelope 校验），`useSDGenerate` 移除全部裸 fetch；二进制结果下载（`/jobs/:id/result`）保留原生 fetch——client 只处理 JSON 信封。附带收益：`classifySDError` 现在能读到真实 HTTP status（400/404/503 分类比旧的“状态码嵌在消息文本里”更准）。
- `promptBuilderStore` 删除 11 个零引用死状态（`sdOnline/sdGenerating/sdProgress/sdResultUrl/sdStatus/sdError/sdAvailableModels/voiceOnline/voiceMode/voiceCaption/voiceCustom`）：生成生命周期归 `useSDGenerate` 与 Anima 会话，配音状态归 `VoiceStudio.vue`/`useVoice`，store 只保留跨引擎的 `sdModelName` 与 `lastSeed`（导演台路由块 +113 字节，预算 132→133 KiB 并注明原因）。
- 测试修复（HEAD 已漂移两处）：`test-page-architecture.js` 工作台 kicker 断言改为 `WorkspaceArchiveBar` 契约（第六轮去重后控制台/模型架不再输出同义英文 Kicker）；`chat.css` 中 `.companion-page .live2d-interaction-hint` 迁至 `companion.css`——原先冷启动 `/companion` 时该提示样式依赖 chat 路由块残留，时有时无。
- `test-api-client.js` 新增 generationApi 用例（端点/方法/URL 编码/envelope 校验/超时基线）。
- 验证：typecheck:app、build、路由预算 132.0/133.0 KiB、相关单测全绿、studio + flows E2E 53/53。

### 剩余（未启动）

- 网关公共设施收口（P3）：Windows 进程树结束、上游健康探测、静态资源策略、统一错误处理抽取。

### 第十二轮：Anima 生成会话抽取（useGenerationSession 落地）

- 新增 `src/composables/useAnimaSession.ts`：Anima / Krea 2 引擎的完整生成会话——后端发现与 15s 状态轮询、任务提交、轮询、取消、结果持有与卸载清理（`requestSerial` 失效 + DELETE 在途任务 + blob URL 释放，自动挂 `onUnmounted(dispose)`）。注入式边界：`getCharacter/isPopular/getFamily/getRequest/onResult/flash/preferredSize`，`client` 可注入便于单测。
- `PromptBuilderView.vue` 删除约 300 行会话代码，改为消费会话组合函数（`state/patchState/modelId/refreshBackend/syncCharacter/applyModel/generate/cancel/clearResult/startStatusPolling` 别名保持视图与模板零改动）；视图保留 prompt 组装（`buildAnimaRequest`）与跨引擎互斥（`onAnimaResult → sd.clearResult()`）。
- 成功态归会话所有：`pollJob` 命中 succeeded 时由会话写 `result/job/phase/statusText` 并释放旧结果 URL，视图回调只做 SD 互斥——此前成功态写在视图回调里，所有权颠倒。
- 测试：新增 `scripts/tests/test-anima-session.js`（10 用例：尺寸收敛 / 载荷白名单 / 白名单与家族收敛 / 热门 no-LoRA / 离线守卫 / 完整提交-轮询-结果生命周期 / krea2 路由 / cancel DELETE / dispose 失效与取消 / syncCharacter），`URL.createObjectURL` 与结果下载用桩，已入 unit 清单；`test-popular-content.js` 的 `preview: false` 哨兵随元数据构建迁移到会话源码。
- 验证：typecheck / lint / build（PromptBuilderView 132.5/133.0 KiB）/ unit 全绿 / E2E——`anima-quick + flows + studio` 66/68，两个失败用例（`anima engine: main generate shows result`、`flow Anima · 应用 job 经过真网关和假 ComfyUI 出图`）经 `git stash` 在干净 HEAD 上复现同样失败，确认为**既有套件并行干扰**（两个 spec 共享 mock-stack 的假 ComfyUI，`__mock/reset` 互相清掉在途 job），与本轮改动无关；两文件串行 `--workers=1` 38/38 全绿。
- 协作提示：`anima-quick.spec.ts` 与 `flows.spec.ts` 并行跑会互相干扰（共享 mock ComfyUI 上游），定向回归请串行或分开跑。

### 第十三轮：网关进程树收口（P3 第一项）+ UI 视觉审计首轮

- **进程树终止统一实现**：新增 `server/process-tree.js`（`killProcessTree(child)` / `killPid(pid)`，taskkill /T /F + 回退）。`routes/control.js`、`routes/maintenance.js` 的逐字重复实现删除（maintenance 继续经 module.exports 转发给 control 共用），`server/tunnel.js` 的 killPids 改用 `killPid`。services/*.ts 侧保持内联（跨 TS/JS 类型桥收益不成比例），记为剩余项。
- **视觉审计流水线**：capture.spec.ts 补入 `/training` 页；新增 `scripts/tests/probe-ui-audit.js`（DOM 侧客观复核：故事框覆盖物/文本阴影、场景列表滚动容器、各工作台页水印碰撞面积，需要网关 + 系统 Edge）。
- **审计结论（gemini 视觉初筛 + DOM 测量终审）**：
  - 导演台故事框“文字重影”为**截帧伪影**——`?scene=sc001` 下 textShadow none、无绝对定位覆盖物（value 128 字正常）；实为 characterGlassSweep 扫光动画经过文本框的一帧。
  - 场景列表底部“硬截断”为设计内滚动（clientHeight 442 < scrollHeight 764，overflow-y auto），非缺陷。
  - **右下角 route-index 水印与密集面板实测碰撞**：/control（2804px²）、/scene-manager（5364px²）、/video-studio（4374px²）——已按第六轮“工作台标签去重”原则在这些页隐藏水印（WorkspaceArchiveBar 已承载档案编号）；导演台保留（particle-narrative 锚点 '01'），/training、/lora 实测无碰撞维持现状。
- 验证：typecheck / lint / build（132.5/133.0 KiB）/ unit 332/332 / 网关契约（gateway 10、control-failure 5、maintenance 4、tunnel+token 4）/ E2E particle-narrative + interaction-polish + a11y-device 71/71 / studio+flows 53/53。

### 剩余（未启动）

- 网关公共设施收口（P3）剩余：services/*.ts 内联 taskkill（translation/training）迁移到 process-tree（评估：跨 TS/JS 类型桥成本 > 10 行去重收益，维持现状）、上游健康探测与代理配置进一步收敛。

### 第十四轮：Anima 轮询按引擎门控（运行效率）+ 视觉审计第二轮（light 主题）

- **状态轮询门控**：导演台 Anima 后端 15s 轮询改为仅激活引擎时运行——SD 引擎下 `stopStatusPolling()`，切到 Anima/Krea 恢复（切换动作本身已触发一次 `refreshAnimaBackend`）。收益：默认 SD 模式下不再每 15s 让网关探测 ComfyUI（`/system_stats` 2.5s 超时 + 每次请求的磁盘资源检查）。引擎按钮不显示非激活引擎状态，UI 无感知。
- **视觉审计第二轮（light 主题工作台页）**：capture 新截图经 gemini 初筛 + probe-ui-audit DOM 终审，结论：
  - **全部对比度指控为误报**：修正 probe 的颜色解析（`rgb()` 十进制误读为 hex、`color(srgb …)` 未解析、半透明背景未合成）后，status-tile 5.99、panel-kicker 6.65、表头 6.48、日志占位 14 —— 全部满足 WCAG AA（4.5+）。视觉模型把玻璃半透明背景误读为"浅底浅字"。
  - 训练日志占位符"文字被横线穿过"为误报（DOM 无覆盖物）。
  - 场景管理"右侧竖排日文水纹裁切"为误报（DOM 中不存在该元素）。
  - 流水线结论：视觉初筛 + DOM 测量终审有效（第十三轮水印碰撞为真、本轮四项为假），probe-ui-audit 已并入 light 主题对比度测量，可复用。
- 验证：typecheck / lint / build（132.5/133.0 KiB）/ unit 332/332 / E2E flows+studio 53/53、anima-quick 15/15（串行）。

### 第十五轮：图片呈现核查（A）+ 微交互收口（B）

- **A 方向核查结论（已有，无需新增）**：blur-up 渐变入场与 R18 揭示过渡在全站主要图片点均已实现——SceneCard（`.sc-thumb` blur 6px→0）、Showcase（`.sample-image` blur 7px→0 + R18 hover 揭示）、Gallery（`galleryImageIn` 0.35s + 查看器 zoom-in）、Character（`portraitRise`）、Home（`archive-image-in`、hero 过渡）；PopularCharacterPicker 无位图头像。本轮不再重复建设。
- **B 方向落地三项**：
  - **训练进度条统一为 div 模式**：TrainingView 两处动态进度从原生 `<progress>`（伪元素 width transition 在 Chromium 不生效、进度跳变）改为 design-system 的 `.meter/.meter-fill`（`--fill` + width 过渡，与 ControlView 同模式），并加进度流光 `meter-shine`（reduced-motion 关闭）；保留 `role="progressbar"` + aria-valuenow。语音数据集 `split-track` 比例条为固定值，维持原生。
  - **LoraView 模型卡 hover 统一**：补 `transition` + hover 抬升（-3px）+ 档案蓝描边亮起 + `shadow-md`，与作品册 `.artwork` 同一交互语言；`@media (hover:hover)` 与 reduced-motion 收口。
  - **GuestGuide 入场动画**：遮罩淡入 + 卡片上浮（0.34s 延迟入场），reduced-motion 关闭——此前是硬开硬关。
- 验证：typecheck / lint / build（132.5/133.0 KiB）/ unit 332/332 / E2E a11y-device+interaction-polish 67/67（四设备）、定向 training workbench + guest guide 5/5 / 样式债与字面量预算通过。

### 第十六轮：弹层入场动画统一（B 收尾）

- **`.overlay` / `.modal-card` 统一入场动画**：design-system 弹层体系入口补 `overlay-in`（遮罩 0.22s 淡入）+ `modal-card-in`（卡片 0.28s 上浮缩放、0.05s 延迟叠在遮罩后），所有使用全局弹层类的调用点自动获得入场动画——SceneManagerView 编辑弹窗（此前硬开硬关）、未来新增弹层同理；`[hidden]`、reduced-motion 通配收口不受影响；PromptDataTools（pb-backup-overlay 自带过渡）、Gallery/Showcase 查看器、GlobalSearch（gs-in）、GuestGuide（第十五轮）各自已有动画，不重复。
- **B 方向收尾核查**：表单 focus ring 全站已统一（design-system 全局 `:focus-visible` + `.input/.select/.textarea` ring + TrainingView param-field / SceneManagerView search/import 各自 ring）；卡片 hover 全站已统一（Gallery/SceneCard/Showcase/Home/LoraView（第十五轮）/SceneManager tool&image 卡抬升 2px/3px，TrainingView job-card 为状态卡不可点，维持现状）；确认框为原生 `confirm()`（替换自定义组件需多调用点迁移 + focus trap，收益中风险中，**评估维持现状**）；ETA/百分比为轮询文本（数值滚动动画收益低，**评估维持现状**）。
- 验证：typecheck / lint / build（132.5/133.0 KiB）/ unit 332/332 / E2E studio+flows 53/53、SceneManager 弹窗定向 7/7 / DOM 测量确认 overlay-in + modal-card-in 生效、动画后 opacity 1 且卡片居中。

