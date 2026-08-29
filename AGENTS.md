# AI-CG-Studio 项目协作指南

> 当前版本阶段：v1.5.0 全模块稳态阶段。本文档为最高执行宪章，严禁违反核心红线与质量把关标准；历史调研与排障细节归档于 `docs/`。

---

## 一、 最高原则与不可逾越的红线

1. **真实端到端闭环把关（防虚假完成）**：
   - 凡涉及提示词、蓝图绑定、服装联动或换装的改动，**严禁仅凭界面文字或表层状态断定成功**；必须亲自核对底层编译 Token 与真实渲染画面的一致性。
   - 状态机联动必须形成闭环（如场景蓝图切换必须同步联动 `outfitId`、镜头与参数）。
2. **动效与视觉性能铁律**：
   - 所有高频动画与过渡**必须使用 GPU 合成属性（`transform` / `opacity`）**，严禁使用 `left/top/width/height` 做补间引起主线程逐帧重排（Reflow）。该铁律已门禁化（2026-08-27）：`npm run lint:animations` 扫描真实样式树，未带 `/* compositor-exempt: <理由> */` 注释的违规一律失败；存量豁免以 `ALLOWED_EXEMPT=4` 基线管理（2026-08-28 审计修正：文档原写 3 与 `lint-animations.js:34` 及全库实测 4 处不符——design-system.css ×2 + CharacterView + SceneExplorerView），新增豁免须评审上调（已入 test:style-debt 与 run-check-parallel 流水线）；
   - 所有新增与修改的 UI 组件，必须通过**深色模式**下的视觉审查，确保文字对比度（WCAG AA）与扫光不压字。门禁：`node scripts/maintenance/check-contrast.js --check`。
     > **2026-08-28 变更：浅色主题已下线**（美术审计 · 方案 A）。原「双主题并行审查」要求撤销 —— 154 个令牌本就为深色设计，浅色是后补的 50 个覆盖（覆盖率 32.5%），20 套角色主题里 17 套无浅色版，继续维护属纯负债。**此后新增颜色只需写一遍**。禁用态一律用 `--text-disabled` 令牌，不得用 `opacity` 压字（alpha 合成后低于 AA）。若日后恢复双主题，须先补齐角色主题浅色版再放开开关。
3. **手绘线条图标规范（2026-08-20 指示）**：项目中新增或修改的图标，**一律采用纯手绘线条 SVG（`ArchiveIcon.vue` 的 Hand-drawn Linear 机制）**，严禁使用 Emoji 字符或实心填充图标。
4. **内容分级 Fail-Closed 契约**：成人（R18）内容默认开启并带模糊遮罩；`adultEligibility` 与 `adultEnabled` 双重把关，未知或未授权状态必须严格拒绝，不得回退安全断言。
5. **精准提交与工作区保护**：
   - **严禁盲目执行 `git add .`**：必须通过 `git status` 与 `git diff` 严格核对改动，只提交经过自测验证的受控文件，严禁卷入他人正在进行的脚本或分支；
   - 严禁 `git reset --hard` 等破坏性命令；临时测试脚本随用随清；
   - **提交后必须 `git push`（2026-08-29 教训固化）**：远端是唯一异地副本——2026-08-29 00:38 本地 `.git` 因中断的 repack/gc 几乎全毁（refs/heads 消失、对象库仅剩 217 个对象），未推送的 9 个提交对象全部丢失，内容靠工作区未提交改动幸存。未 push 的提交视为未完成交付。每次启动 `start.ps1` 会自动做 `git bundle` 快照（`runtime/git-backups/`，默认保留 14 份）作第二副本。
6. **媒体资产入库边界**：`assets/character-references/` 已 `.gitignore`，严禁提交入 Git；运行时统一经 `/data/character-reference-view.json` 懒加载。
7. **严禁偷懒式批量交付（2026-08-24 教训固化）**：批量重写/优化类任务（提示词、场景、蓝图）必须逐条全量真实改写，禁止以通用模板兜底、仅追加词条或虚报覆盖率冒充交付；任何此类交付必须跑 `node scripts/tests/test-prompt-rewrite-integrity.js --delivery <交付文件>` 复检通过（覆盖率=声明数、无模板签名/全局雷同、新旧词条保留率≤50%、prose 相似度≤60%、角色归属一致），未过门禁一律退回重写，不得声明完成。
8. **定稿场景提示词保护（2026-08-27 教训固化）**：`data/prompt-pinned-scenes.json`（100 条：历史定点手工修/官方CG对齐/用户实拍定稿）中的渲染字段为字节级基线，任何批量优化任务**严禁触碰**这些场景的 `prompt/negative/animaCaption/recommendedSize/rating/mature`；门禁 `node scripts/tests/test-pinned-scene-prompts.js`（已入 test:contract 套件）。确需修改某条定稿时：先真实出图自测确认效果，再 `npm run scenes:pin-capture` 更新基线并在提交信息中附自测证据。批量脚本遇到受保护 ID 必须跳过。
9. **单写者原则（2026-08-29 教训固化）**：同一工作区同一时刻**只允许一个 AI 会话执行 git 写操作**（commit/push/merge/rebase/gc/prune）；需要并行的会话必须 `git worktree` 隔离各自目录或约定错峰交接；长期并行期间禁用自动 gc（`git config gc.auto 0`）。2026-08-29 的 `.git` 崩毁正发生在两会话高频提交 + fetch 的并发窗口内（pack 目录遗留 `tmp_pack_*` 与孤儿 `.idx`）。

---

## 二、 核心架构与模块分层

- **前端架构**：Vue 3 + Vite + TypeScript + Pinia（`src/stores/` + `src/views/` 路由全懒加载）。
- **组件与逻辑分层**：
  - 复杂业务逻辑与状态机下沉至专属 composable（如 `usePromptSdQueue`、`useAnimaInpaint`、`usePopularPromptAssembly`），保持 View 纯粹。
- **网关服务**：桌面 gateway 包由主工作区同一 `package-lock.json` 派生运行时依赖（2026-08-22 实测两端均为 Express 5.2.1）；`server.js` 的 SPA fallback 使用正则 `/^(?!\/api).*/`，保持对 Express 4/5 路由风格的部署侧兼容。
- **生图双引擎**：
  - **Anima (ComfyUI / Pencil)**：高质量动漫与局部换装（Inpaint），支持 TeaCache 加速、手绘/CLIPSeg 遮罩与 `ImageCompositeMasked` 像素级原图回贴。
  - **Krea 2 (SD3.5)**：自然语言探索，遵循纯英文 Prose 组装，严禁 Tag 堆砌与负面词。
- **Live2D 双后端**：浏览器走 `wl-live2d`（按需加载贴图，`blinkScheduler` 双眼同步，静止动态降帧节能）；桌面端走原生 Overlay 桥。组合式拆分方案见 `docs/live2d-composable-refactor-plan.md`。
- **配音与陪伴**：GPT-SoVITS + 本机翻译管道，自动剥离台词舞台提示，长句分段与 in-flight 缓存去重。

---

## 三、 质量门禁与交付验证流程

在声明任何任务完成或提交 Git 前，必须按序完成以下把关：

```
[1. 状态与逻辑自测] ──► [2. 静态类型检查] ──► [3. 前端与接口契约测试] ──► [4. 生产打包预算] ──► [5. 精准 Git 提交 + push]
 真实出图/状态闭环      npm run typecheck:app     node scripts/tests/...        npm run build        git add <files> && git commit && git push
```

1. **类型检查**：`npm run typecheck:app`（零 Error 退出）。
2. **契约与单测**：
   - 热门角色与提示词契约：`node scripts/tests/test-popular-content.js`
   - Anima 接口与生成边界：`node scripts/tests/test-anima-routes.js`
   - 前端状态机单元测试：`npm run test:frontend`
3. **打包预算**：`npm run build`（全站 19 个路由必须严格遵守 140KB 预算红线）。
4. **桌面部署（按需，唯一入口 `deploy-desktop.bat`）**：
   ```powershell
   deploy-desktop.bat                    # 增量部署：清理残留 + 复制最新代码 + 清缓存 + 验证 + 重启
   deploy-desktop.bat -SkipBuild         # 已手动 build 过，跳过前端构建
   deploy-desktop.bat -UseInstaller      # 跑 runtime\desktop-updates 下最新完整安装包（依赖/壳变动时用）
   deploy-desktop.bat -NoRestart         # 部署后不自动启动
   ```
   - 实现脚本只有 `scripts/maintenance/deploy-desktop-quick.ps1` 一个（2026-08-29 收口：此前散落 11 个临时脚本，已全部删除）。
   - **写 `C:\Program Files` 需管理员**：agent 侧 `Start-Process -Verb RunAs` 与 Bash 调 powershell 均被安全策略拦截，提权这一步只能由用户点 UAC。
   - 新增「源端删除型」清理目标时，改脚本里的 `$STALE_ASSETS`（`Copy-Item` 只合并不删除，否则残留会永久堆积）。
   - **何时增量、何时必须完整安装，见 `docs/desktop-deployment.md`**（口诀：只动会被复制进去的文件 → 增量；动 `node_modules` 或 exe → 完整安装）。
5. **推送远端（交付闭环）**：`git push` 成功后才算交付完成（红线 5，2026-08-29 教训固化）。`npm run backup:git` 可随时手动做 bundle 快照。

> **统一工作流入口（2026-08-26 新增）：** 日常 `data:build/validate`、参考库 `reference:render/audit/repair`、样张 `showcase:batch`、质检 `check:full` 等 140 个脚本已收敛至 `scripts/workflow.js --help`（`npm run workflow -- --help`），一站式索引见 `docs/workflow.md:1`；旧 `node scripts/maintenance/*.js` 仍兼容。

---

## 四、 后续稳定演进方向（聚焦体验与质感）

1. **剧情短片全链路深化**（2026-08-23 已落地：蓝图一键剧本 + 一键首帧 + 剧本模式直通分镜，剧情短片纯点击流）：
   - ✅ 首尾帧过渡模式前端已解锁（2026-08-28）：`VideoStudioView` 按 H3 权重动态门槛（`firstLastFrameReady`），首帧可来自绘图页或本地上传、尾帧本地上传，`videoApi.uploadVideoImage` 同一端点覆盖尾帧通道（FL2VA/L2VA 后端全通）；
   - 剧本库扩充（现 3 本预置）+ 剧本模式接场景蓝图自动分幕（分幕→分镜管道已通）；
   - 成片后处理回流候选：`HunyuanVideo15SuperResolution`（节点已装）；Wan 2.2 图生视频模式（节点已装，显存允许时评估）。
2. **指令式稳定换装（模型采购级，评估已完成待下载决策）**：Qwen-Image-Edit-2509 GGUF Q4_K_M（磁盘约 20GB / 显存 10–12GB，本机规格实测带得动）；`TextEncodeQwenImageEditPlus` 为 ComfyUI 核心自带编码节点（无需单独安装），但配套 Qwen-Image-Edit 权重与本项目接线均不存在，落地须先下载 GGUF 权重并走五步样板；与现有 inpaint 并存，换装场景优先走编辑路线。SAM3 分割权重（换装遮罩 CLIPSeg→SAM3）同类决策。
3. **Krea2 高级节点回流（模型已在盘）**：`Krea2T-Enhancer-Advanced`、`Krea2StyleReferenceNode`（风格参考，热门角色风格化价值大）、`Krea2PromptWeight`——照 detailBoost 五步样板（社区来源→本机复现样张→网关受控注册→契约锁定→实测转正）。注：`Krea2StyleReferenceNode` 是 API 节点（ComfyAPI 云端上传），与本机 Krea 2 权重非一条路，需单独评估。
4. ✅ **视频侧成人门控传输层已接线（2026-08-28）**：单任务与分镜批量前端如实携带 `adultEnabled: isLocalStudioHost()`（本机放行、远程/隧道 fail-closed），batch 白名单与单镜校验已透传；storyboard 对成人蓝图仍 fail-closed 拒绝，`adultEligibility` 蓝图自动剧本的完整放行待后续。
5. **桌宠情感与剧场深度联动**：基于好感度、时间段与日程触发 Live2D 专属小剧场，保持低功耗静止节能。
6. **角色设定记忆与知识库（RAG）**：免额度角色检索工具深度打通，为 40+ 热门角色构建世界观设定记忆库。

---

## 五、 技术重构待办（2026-08-22 体检立项）

### useLive2D 组合式拆分 —— 项目内最高风险重构，方案已定稿待实施

- **研究报告（唯一执行依据）**：`docs/live2d-composable-refactor-plan.md`
- 核心事实：1270 行单工厂 / 52 个嵌套子函数 / ~35 个共享闭包变量；唯一消费方 `ChatCharacterStage.vue`；组合式内部单测覆盖为零；公开 API 必须逐字冻结。
- 待办清单（按序执行，每步独立提交并通过门禁，严禁跳步）：
  - [x] Step 0：测试地基——分区带命中/夏目外框排序/readLive2DCatalog 解析/MOUTH·BLINK 参数选择 vitest 规格（2026-08-23 完成，`197e67a`）
  - [x] Step 1：抽离 `live2d/constants.ts` + `live2d/catalog.ts`（纯数据/纯函数）（2026-08-23 完成，`6987242`）
  - [x] Step 2：闭包状态 ctx 对象化（`e2eb7d6`，吸收 `ff4f385` overlaySettle 回落状态）
  - [x] Step 3–5：抽取 pointerGaze / interactions / emotionClock+layoutFit 子模块（`18a4e03` / `2535ce7` / `5ffe124`）
  - [x] Step 6：parameterFrame 每帧热路径抽出（`0f13ae5`，native-contract 契约断言跟随模块化新家）
  - [x] Step 7：lifecycle 抽出，useLive2D 收薄为 98 行组合根（`2b1220c`，公开 API 逐字冻结）
  - [x] 收尾硬门槛：`npm run test:live2d-native:release` 真机自检 + 双后端手工冒烟清单归档（2026-08-27 完成：自动化 selftest `OK snapshots=3/3 exit=0`；用户确认双后端人工冒烟可用）。清单见 `docs/live2d-composable-refactor-plan.md` 第八节
- 红线提醒：`destroyRuntime` 全库唯一实现且顺序冻结（Pixi-first）；双后端 capability 分支原样搬家不抽象；`lifecycleToken` 语义不变。

> 已完成（2026-08-22）：`routes/video.js` 八模块化拆分（2229→606 行编排层）、`sendMessage` 六步 pipeline 化、桌宠工具 R18 网关双门控、存储键收敛防回潮门禁。**director.css 分片+分产已完成（2026-08-27）**：四片切片基础上再按异步组件规则级分产 16 个 `director/components/<Owner>.css` 随组件懒加载，PromptBuilderView 路由 CSS 113.7→67.9 KiB（预算 98.9%→59%）；其余中期项（PromptBuilderView 编排下沉、companion.css 分片）按打包预算压力另行排期。

> 已完成（2026-08-23 出图/视频链路，直连真实 ComfyUI 实测驱动）：
> - Krea2 社区增强链路转正（T-Enhancer + er_sde + RCAS 无条件挂载，原 euler 标准链路退役，实测出图耗时持平）；
> - Anima 纯文生图末端 RCAS 锐化回流（+~1s 线条发丝细节显著提升；`res_multistep_cfg_pp` 对照实测为动漫风负优化，已排除并维持 res_multistep + CFG4.5）；
> - 剧情短片纯点击流闭环：蓝图一键剧本（`routes/video/storyboard.js` 起承转合四镜确定性引擎，台词取蓝图原文）→ 一键首帧（逐镜 Krea2 增强链路，`useShotFirstFrames`）→ 批量 + 尾帧衔接 + 拼接；剧本模式激活直通分镜并清退 v18/SD 时代遗留；
> - 双家族（Krea2/Anima）真实 ComfyUI 端到端回归通过；四镜样片（12s，I2VA/FL2VA 交替 + 尾帧衔接）人物零漂移验证；
> - 社区工作流复刻五步样板固化为标准流程：社区来源 → 本机固定 seed 复现样张审核 → 网关受控路线注册 → 契约测试锁定 → 新旧链路实测耗时对比转正。
