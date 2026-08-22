# AI-CG-Studio 项目协作指南

> 当前版本阶段：v1.5.0 全模块稳态阶段。本文档为最高执行宪章，严禁违反核心红线与质量把关标准；历史调研与排障细节归档于 `docs/`。

---

## 一、 最高原则与不可逾越的红线

1. **真实端到端闭环把关（防虚假完成）**：
   - 凡涉及提示词、蓝图绑定、服装联动或换装的改动，**严禁仅凭界面文字或表层状态断定成功**；必须亲自核对底层编译 Token 与真实渲染画面的一致性。
   - 状态机联动必须形成闭环（如场景蓝图切换必须同步联动 `outfitId`、镜头与参数）。
2. **动效与视觉性能铁律**：
   - 所有高频动画与过渡**必须使用 GPU 合成属性（`transform` / `opacity`）**，严禁使用 `left/top/width/height` 做补间引起主线程逐帧重排（Reflow）；
   - 所有新增与修改的 UI 组件，必须同时在 **深色模式 (Dark)** 与 **浅色模式 (Light)** 下通过视觉审查，确保文字对比度（WCAG AA）与扫光不压字。
3. **手绘线条图标规范（2026-08-20 指示）**：项目中新增或修改的图标，**一律采用纯手绘线条 SVG（`ArchiveIcon.vue` 的 Hand-drawn Linear 机制）**，严禁使用 Emoji 字符或实心填充图标。
4. **内容分级 Fail-Closed 契约**：成人（R18）内容默认开启并带模糊遮罩；`adultEligibility` 与 `adultEnabled` 双重把关，未知或未授权状态必须严格拒绝，不得回退安全断言。
5. **精准提交与工作区保护**：
   - **严禁盲目执行 `git add .`**：必须通过 `git status` 与 `git diff` 严格核对改动，只提交经过自测验证的受控文件，严禁卷入他人正在进行的脚本或分支；
   - 严禁 `git reset --hard` 等破坏性命令；临时测试脚本随用随清。
6. **媒体资产入库边界**：`assets/character-references/` 已 `.gitignore`，严禁提交入 Git；运行时统一经 `/data/character-reference-view.json` 懒加载。

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
[1. 状态与逻辑自测] ──► [2. 静态类型检查] ──► [3. 前端与接口契约测试] ──► [4. 生产打包预算] ──► [5. 精准 Git 提交]
 真实出图/状态闭环      npm run typecheck:app     node scripts/tests/...        npm run build        git add <files>
```

1. **类型检查**：`npm run typecheck:app`（零 Error 退出）。
2. **契约与单测**：
   - 热门角色与提示词契约：`node scripts/tests/test-popular-content.js`
   - Anima 接口与生成边界：`node scripts/tests/test-anima-routes.js`
   - 前端状态机单元测试：`npm run test:frontend`
3. **打包预算**：`npm run build`（全站 19 个路由必须严格遵守 140KB 预算红线）。
4. **桌面快速部署（按需）**：
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/maintenance/deploy-desktop-quick.ps1 -SkipBuild
   ```

---

## 四、 后续稳定演进方向（聚焦体验与质感）

1. **短剧分镜与角色一致性打磨**：深化 4 视角标准基准在视频分镜（MiniMax H3 / T8）中的自动化装配与过渡。
2. **桌宠情感与剧场深度联动**：基于好感度、时间段与日程触发 Live2D 专属小剧场，保持低功耗静止节能。
3. **角色设定记忆与知识库（RAG）**：免额度角色检索工具深度打通，为 40+ 热门角色构建世界观设定记忆库。

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
  - [ ] 收尾硬门槛：`npm run test:live2d-native:release` 真机自检 + 双后端手工冒烟清单归档——**2026-08-23 拆分期间 Companion 桌面实例持续运行，selftest 因单实例锁空转退出；关闭桌宠后执行**。清单见 `docs/live2d-composable-refactor-plan.md` 第八节
- 红线提醒：`destroyRuntime` 全库唯一实现且顺序冻结（Pixi-first）；双后端 capability 分支原样搬家不抽象；`lifecycleToken` 语义不变。

> 已完成（2026-08-22）：`routes/video.js` 八模块化拆分（2229→606 行编排层）、`sendMessage` 六步 pipeline 化、桌宠工具 R18 网关双门控、存储键收敛防回潮门禁。其余中期项（PromptBuilderView 编排下沉、director.css/companion.css 分片）按打包预算压力另行排期。
