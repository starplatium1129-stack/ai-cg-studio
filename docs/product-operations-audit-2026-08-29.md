# AI-CG-Studio 产品与运营全维审计报告（2026-08-29）

> 审计方式：六个只读探查通道并行取证（产品完整度 / UX / 数据内容 / 运行时性能 / 运维可持续 / 成本与 AI 协作），主审对关键证据现场复核。全程零改动。
> 特别说明：审计期间（2026-08-29 00:06–00:54）有另一 AI 会话在本仓库并行执行工程审计（`engineering-audit-2026-08-28.html`）修复，期间发生 `.git` 对象库崩毁事故（见第 5 节事故快报）；本报告的性能数据部分已被该会话当场修复，文中逐处标注。
> 关联文档：`docs/engineering-audit-2026-08-28.html`（工程质量八维 7.8 分）、`docs/design-audit-2026-08-28.html`（美术设计 6.7 分）。本报告补齐产品与运营视角，三者互补、不重叠。

---

## 总评

**综合 7.1 / 10。** 这是一个「工程纪律强、产品闭环真、内容资产与容灾是短板」的项目。产品功能完整度、成本控制、AI 协作效能是强项；数据内容质量是最大短板——参考图库 19.9% 断链且检查器未接门禁、分级字段互相矛盾。运维侧在审计进行中用一场真实的 `.git` 崩毁实证了「单机单副本、门禁基线绑 git 历史」的预测。

| 维度 | 评分 | 一句话结论 |
|---|---|---|
| 产品与功能完整度 | **8.5** | 闭环真实、数据只多不少、零 TODO；但四条核心流程只有两条半有 e2e |
| 用户体验 | **7.5** | 长任务反馈超个人项目水准；反馈通道碎片化 + 全局搜索零可见入口 |
| 数据与内容质量 | **5.0** | 结构层优秀，资产层失守：232/1168 参考图断链、分级字段三套并存互斥 |
| 运行时性能 | **6.5** | 节能细节出色；首屏 CSS/字体无预算盲区 + 画廊 4096px 原图直塞 DOM |
| 运维与可持续 | **6.0** | 诊断面高配；但单机单副本无灾备——审计当晚即应验 |
| 成本与人力 | **8.5** | 付费面压缩到 2 个 key，防护网完整；聊天 key 明文存客户端是计费单点 |
| AI 协作效能 | **8.0** | 教训→门禁的当日闭环罕见；防偷懒门禁名实有差且依赖 git 历史 |

---

## 1. 产品与功能完整度 — 8.5

**真实闭环，不是 PPT 产品。** 声明数据全部实测核验：定稿场景（`data/prompt-pinned-scenes.json`）精确 100 条；热门角色实测 48（声明 43）、蓝图实测 508（声明 441）、参考库实测 50 角色 / 292 形态 / 1168 视角（声明 45/236/944）——全部只多不少。代码零 TODO/FIXME/WIP，未完成能力（Krea2 双人构图、Anima 批量队列）全部以显式用户提示降级而非烂尾。页面互通成熟：场景→导演台深链（`src/views/PopularSceneExplorerView.vue:293`）、三处故障→控制面板自愈入口（PromptBuilderView / ChatView / VideoStudioView）、404 兜底路由；唯一「孤岛」`/companion` 是桌面壳有意为之。

**扣分项：**
- **视频分镜链路（自称核心卖点）零 e2e**，训练台只有一条可访问性用例；四条核心流程只有出图（flows.spec 25 条 mock 网关用例，含 CUDA OOM 降级 / 502 真因回显 / 队列串行）和聊天有完整覆盖。
- README 数字系统性滞后一整代（48 vs 43、508 vs 441、1168 vs 944）；「649 样张」manifest 是运行时生成物，克隆后看不到。
- 引擎能力差异矩阵没有声明层呈现，用户只能在 UI 里撞到提示才知道 Krea2 不能做什么。

**建议：**
1. 给视频工作台补一条「剧本→分镜→单镜出片」mock e2e（复用 flows.spec 假网关架子，约一天）。
2. README 数字改为构建时从 data/ 自动生成，或直接标注「以 DATA_VERSION 为准」。
3. PromptBuilder 引擎切换处加能力矩阵 tooltip。

---

## 2. 用户体验 — 7.5

**强项超出个人工具基线。** 出图有队列（限 8、失败保留队首自动暂停防连环烧卡，`src/composables/useSDQueue.ts:88-95`）+ 双层取消（本地 abort + 服务端删任务）+ 卸载自动清理；训练有真实 Epoch/Loss 进度条（`TrainingView.vue:329-355`）；参数草稿防抖持久化且用 `sdParamsTouched` 防切底模静默覆盖（`promptBuilderStore.ts:412-418`）；三态模式全仓统一 ArchiveStatePanel，Gallery 有错误面板+重试按钮；访客导览（`GuestGuide.vue`）、aria-current/aria-live/progressbar 齐全；错误文案 30 条抽样全中文无英文泄漏。

**扣分项：**
- **反馈通道碎片化**：全局 useToast 仅 6 个视图采用；核心页 PromptBuilderView 另起 `.pb-toast` 一套（`PromptBuilderView.vue:317`）；另有 5 处原生 `alert()`（AnimaInpaintModal）与约 11 处原生 `confirm()`——Tauri 桌面端里原生弹窗突兀且阻塞。
- **HomeView 数据失败完全静默**（`HomeView.vue:405,449` 只 console.warn），与 Gallery 的错误面板标准不一致——而首页恰是 `sceneStore` 拉 4.48MB 全量数据的页面。
- **全局搜索（Ctrl+K / `/`）零可见入口**：AppNav 无触发按钮，纯键盘党才能发现。
- 应用路由出图是假进度（每 700ms +2 封顶 95%，`useSDGenerate.ts:189`），长图停在 95% 像卡死，ETA 仅 WebUI 模式可见。
- 移动端「CSS 顺带适配」非一等公民：核心页自身 0 条 @media，断点 7 档散乱（与美术审计的断点收敛建议合并处理）。

**建议：**
1. `.pb-toast` 收编进 useToast，alert/confirm 换统一组件（机械替换，可交 AI 批量，参照 ArchiveStatePanel 推行模式）。
2. HomeView 抄 Gallery 错误面板+重试（几行代码）。
3. AppNav 加搜索按钮；应用 job 路由进度改「排队第 N 位」真实状态。

---

## 3. 数据与内容质量 — 5.0（最大短板）

**结构层优秀，资产层失守。** 蓝图↔角色↔服装引用双向 0 断裂（508 条 blueprint 的 characterId/outfitId 全命中，237 套服装 0 孤儿）；508 条蓝图 prose 层前缀/全文零重复、min 长度 163 字符无敷衍；门禁密度罕见（test-popular-content 24 项 + 契约校验 + 分级 fail-closed 双保险 + 压缩产物字节比对 + DATA_VERSION 实测同步 729676949）。

**三个硬伤：**
1. **参考图库 232/1168（19.9%）url 断链**（`data/character-reference-view.json` 全量 existsSync 验证）：212 条为批量改名未回写的命名漂移（磁盘前缀式命名 vs json 裸名），20 条真缺失（alisa 夏日浴衣等 5 个「幽灵形态」×4 视角），外加 alisa 重复 outfitId=`nsfw_nude`。最刺眼：**检查器 `scripts/maintenance/check-ref-urls.js` 早已写好、schema 也在，但没接进任何门禁**——工具在手、门没装，所以长期无人报红。
2. **分级字段三套并存、互不校验**：蓝图侧 `adult`(true 205/false 98/缺失 205)、`sampleRating`(缺失 262)、`adultEligibility`(缺失 481) 各管各的——5 条 `adult=true` 却标 R15/All，31 条含敏感措辞却无任何分级（27 条连 rating 都没有）。直接踩自家红线 4「fail-closed」精神：内容侧没关死。
3. `docs/character-reference-audit-pending.md` 停在 2026-08-17 快照（自报 45/236/944 vs 实际 50/292/1168），75 项待修（21 角色）无人对照，占 1168 视角 6.4%。

另：tag 层模板化属生产特征而非敷衍（top1 前 3 token 签名 x60/508 = 11.8%，负面词 boilerplate 三件套 100% 共享）；唯一真卫生问题是 camera 同义变体未归一（`medium shot` x108 与 `medium_shot` x43 并存）。

**建议：**
1. **本周内**把 check-ref-urls.js + schema 接进 `validate-content-contracts`（半天），跑一次修复 232 条断链（212 条可脚本化前缀回写）。
2. test-popular-content 加 adult↔sampleRating 互锁断言；31 条未标记条目人工定级一遍。
3. audit-pending 清单改为脚本从数据派生，停止手工维护。

---

## 4. 运行时性能 — 6.5（首位问题已被并行会话当场修复）

> 审计进行中，并行会话提交「字体声明异步化，入口 CSS 453KB→75.1KB（-83%）+ 入口 CSS 预算门禁」并重建 dist（实测入口 `index-*.css` 76.9KB，字体拆为独立 `fonts-*.css` 376KB 异步加载）。本节评分反映修复前状态，修复后约 7+。

实测 dist（修复前）：首屏链 764KB raw / brotli 186KB / gzip 295KB，全部有预压伴生且服务端直发；最大路由 PromptBuilderView 201.5KB（JS 122.6 + CSS 78.9，预算 140/115 内合规）；wl-live2d 懒块 923.4KB 已到预算 92.3% 警告区（上限 1000KB，余 76.6KB）。

**仍在的问题：**
1. **画廊 4096px 原图 Blob 直塞 `<img>`**（`src/views/GalleryView.vue:526-543` 卡片首选 `imgGet(image_id)` 全尺寸 Blob → objectURL）——560px 缩略图管线明明存在（`src/utils/imageThumb.ts:25-37` 存 IndexedDB `thumb:*`，`App.vue:47-58` 空闲期预热）却未用于卡片网格。多卡同屏解码/显存峰值可观。
   > **澄清（2026-08-29 补注）：该建议是「分层加载」而非降清晰度**——卡片网格用 560px 缩略图（卡片显示宽约 280 CSS px，560px 恰好覆盖 2x 高分屏，视觉无损），**点击进大图查看器时仍加载 4096px 原图**。用户看到的细看画质不变，变的只是网格滚动时的解码成本。
2. **backdrop-filter 203 处 vs contain 2 处**：玻璃层铺在滚动容器（`companion.css:449-453` 气泡区）与场景卡网格（`scene-card.css:3`）上，滚动逐帧重采样，无低配降级。
3. 首页全量场景数据 4.48MB raw / 708KB br 一次性驻留内存（`HomeView.vue:385` → `sceneStore.ts:244-250`）。
4. 字体侧剩余盲区：dist 字体 16.7MB/606 文件，其中 woff 304 个 8.9MB 纯冗余（WebView2 只取 woff2），构建期可剔除。

**做得好的**：7 处轮询全部有停止条件（token 代数 / mounted 闸 / document.hidden），onUnmounted/onScopeDispose 覆盖到位，未发现真实泄漏；字体 101 切片 unicode-range 按需 + font-display:swap + 本地自托管；粒子共享单 rAF 调度器（`particleScheduler.ts`）+ 静止停帧 + 慢帧自愈（`SemanticParticleField.vue:490-494`）；Live2D 三路停 ticker（reduced-motion / document.hidden / 桌面窗隐藏）。

**建议：**
1. 画廊卡片改走缩略图管线（点开大图仍原图），保留 revokeObjectURL 现有管理。
2. 构建期剔除冗余 woff；给 fonts.css 补预算门禁（16.7MB 字体库现无任何红线）。
3. companion 气泡区 blur 换半透明底色或加 `contain`。

---

## 5. 运维与可持续 — 6.0

### 事故快报（审计期间实时发生，2026-08-29 00:06–00:54）

- 00:06–00:35 并行会话连续提交 9 个工程审计修复（P0-1~4、P1-5/6/8/13、director 两笔），reflog 可证。
- 00:38 前后 `.git` 在一次中断的 repack/gc 中几乎全毁：`refs/heads/` 消失、对象库仅剩 217 个对象、pack 目录留下 `tmp_pack_*` 与孤儿 `.idx`——典型 gc/repack 中途崩溃现场，恰发生在两会话高频提交 + fetch 并发窗口内。
- 00:54 通过 reset 到 `origin/main`（eab954b）恢复。**9 个修复提交的提交对象丢失**，内容以未提交改动形式留在工作区；若无 GitHub 远端副本则历史不可逆。
- 实证结论：**唯一版本库本体无异地副本 + 门禁基线绑 git 历史（rewrite-integrity 读 `git show`，事故期间静默降级为「当前库自比」，偷懒检测失效）** 两条短板同时命中。

### 其余发现

- **网关自身无进程守护**：start.ps1 前台单进程，看门狗只管 GPT-SoVITS 等子服务（`server.js:409-412` 注释自认靠外部拉起）。
- **Tauri 自动更新零落地**：tauri.conf.json 无 updater 配置；研究文档三条待办全未勾选。
- **单点资产清单**：113GB ComfyUI、GPT-SoVITS 权重、1023MB 参考图、180MB runtime、浏览器 IndexedDB——grep「灾备」在 docs 零命中。
- 诊断面高配：4 个健康/日志/诊断端点、14 天轮转日志、token 脱敏、上游探活收口；内容事务备份自动化（每次保存前快照 `routes/maintenance.js:122-131`）。
- 卫生小项：`.workbuddy/` 未 gitignore（有误提交风险）；Node 只锁下限无 .nvmrc（CI 跑 24.x 已漂移）；project-status（08-26）/INDEX.md（08-21）滞后现场 2-3 天；maintenance-backups 只增不减无保留期。

**建议：**
1. **git 防线**：交付流程第 5 步加「push」；`git bundle` 每日备份挂计划任务或 run-check-parallel（1 小时工作量）。本次 9 个提交若已推送则零损失。
2. 1GB 参考图 + LoRA 权重冷备到第二块盘/NAS，写 10 行灾备文档。
3. Tauri updater 按研究文档路线 A 落地；`.workbuddy/` 入 .gitignore；加 .nvmrc 锁版本。
4. **单写者原则入 AGENTS.md**：同一工作区禁止两会话并发 git 写操作，并行会话用 worktree 隔离——本次事故即立项理由。

---

## 6. 成本与人力 — 8.5

**花小钱办大事的典范。** 生产依赖零云 SDK，付费面压缩到 2 个 key（聊天 LLM + Gemini 视觉审核，后者失败自动回退本机 llama-server）；其余全本机且 `safeLocalUrl` 硬禁外联上游（`server/config.js:11-20`）。防护网完整：令牌桶限速（聊天 10/3s）、TTS in-flight 去重、SerialQueue、MAX_PENDING=4 熔断 429、NUM_PREDICT 上限 300、GPU 互斥状态机、fail-closed 409。一键角色接入 31 张图全自动（GPU 时仅 8-16 分钟）+ 5 重门禁收尾。

**扣分项：**
- **站主聊天 key 明文持久在客户端 storage**（`src/utils/chatStorageCore.ts:139-141`）并经网关中继——浏览器 profile 泄露即计费单点。
- onboard 流水线并发=1（`workflow-onboard-popular-character.js:59-106` 串行 submit→poll），比自家批量脚本（3-4 并发）慢 3 倍墙钟。
- 人眼终审仍是吞吐瓶颈：741 次裁定中 9.7% 是「AI 预审判过、人眼判不过」反向误差区（`docs/quality-audit-standards-charter.md:3-22`）。

**建议：**
1. 聊天 key 迁网关侧 storage 或环境变量，客户端只留「已配置」布尔位。
2. onboard 并发对齐 `render-all-outfits-references.js` 的 3 并发。
3. 9.7% 反向误差清单喂回 Gemini 审核提示词校准，缩小人眼复审面。

---

## 7. AI 协作效能 — 8.0

**「事发→红线→当日门禁」闭环在个人项目里罕见。** AGENTS.md 八条红线 5 条已门禁化（62.5%）；五天内 7 次红线级修订且每条尽量当日挂门禁；上下文经济学健康——AGENTS.md(12.7KB) + INDEX.md(15.4KB，对过期文档打 ⚠️ 标注) + workflow.md 任务索引 = 约 40KB 即可安全动手；「真值源以 `lint-animations.js:34` 为准」式门禁互指是防文档腐烂的正确姿势。

**扣分项：**
- **test-prompt-rewrite-integrity 名实有差**：AGENTS.md 宣称检测「模板签名/全局雷同」，脚本实际只做对基线的保留率/Jaccard 阈值（`scripts/tests/test-prompt-rewrite-integrity.js:153-156`），未实现跨条目签名检测；且基线读 `git show`（`:59-101`）——.git 事故期间静默降级为「当前库自比」（`:86-89` warn 后 return null），偷懒检测实际失效。
- 红线 1（防虚假完成）、3（手绘图标）、5（精准提交）纯靠自觉，无机器校验（实心填充图标如 DesktopTitleBar.vue:10 可机器化检出）。
- DESIGN.md:170 写死「154 令牌/50 覆盖/32.5%」散文数字，与代码漂移无人看守（与 ALLOWED_EXEMPT=3→4 事故同构）。
- 「两会话并行写同一仓库」直接引爆 git 事故——协作流程缺「单写者」约束。

**建议：**
1. rewrite-integrity 补跨条目签名检测（top1 前 3 token 签名占比 >20% 黄牌）；git 不可用时改 fail 而非静默自比。
2. 实心填充图标检出进 style-debt 套件。
3. 单写者原则入 AGENTS.md（同上）。

---

## 优先级行动清单

| 级别 | 事项 | 量级 |
|---|---|---|
| **P0** | 参考库 232 条断链修复 + check-ref-urls.js 接入门禁 | 半天 |
| **P0** | git 防线：交付流程加 push 步骤 + git bundle 每日备份 + 单写者原则入 AGENTS.md | 1 小时 |
| **P0** | 分级字段互锁断言 + 31 条敏感未标记条目定级 | 半天 |
| P1 | 视频/训练 e2e 各补 1 条 mock 用例 | 1 天 |
| P1 | 画廊卡片改走缩略图管线（**卡片用缩略图、点开大图仍 4096px 原图，细看清晰度不变**）；字体构建期剔除冗余 woff | 半天 |
| P1 | toast/alert/confirm 三通道统一收编 | 1 天 |
| P1 | 聊天 key 迁出客户端明文 storage | 2 小时 |
| P1 | Tauri updater 落地（研究文档已写好路线） | 1 天 |
| P2 | README 数字自动化、DESIGN.md 散文数字门禁、onboard 并发 1→3、`.workbuddy/` gitignore、camera 同义变体归一 | 各 <2 小时 |

---

## 附：审计方法与证据边界

- 六通道只读取证：产品完整度、UX、数据内容、运行时性能、运维可持续、成本+AI 协作各一独立探查代理，主审复核关键证据（git 事故时间线、dist 实测、DATA_VERSION 同步值均为现场复验）。
- git 命令在事故期间受限：数据质量与运维通道的 git 类证据以文件 mtime、reflog、packed-refs 为准。
- 性能数据基于 2026-08-29 00:27 前后两次 dist 实测，并行会话仍在修复中，引用时注意时效。
- 本文与 `engineering-audit-2026-08-28.html` / `design-audit-2026-08-28.html` 互补：工程审计管代码质量，设计审计管视觉，本篇管产品/运营/流程。
