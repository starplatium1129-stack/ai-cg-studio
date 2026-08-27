# useLive2D 组合式函数模块化拆分计划（研究报告）

> **基线日期**：2026-08-22
> **状态**：研究定稿，待实施
> **风险等级**：高（当前代码库最高单项重构）
> **关联红线**：AGENTS.md 一-1（真实闭环把关）、一-2（动效性能铁律）

---

## 一、背景与动机

`src/composables/useLive2D.ts` 是全库最大的可维护性债务：**1270 行单工厂函数、52 个嵌套子函数、约 35 个共享闭包可变变量**。AGENTS.md 演进方向 #2（桌宠情感与剧场深度联动）将以 Live2D 为承重墙——先还债再扩功能，否则后续小剧场状态机只会继续堆进这个闭包体。

有利条件：

- **唯一消费方**：仅 `ChatCharacterStage.vue:206` 调用 `useLive2D(callback)`，公开 API 可逐字冻结，爆炸半径极小；
- **底层纯工具已有测试地基**：`blinkScheduler`、`live2dGaze`、`emotionRuntime` 均有独立 spec，是拆分的现成锚点；
- **事故注释密集**：历史 bug 的实证记录全部在注释里（叠层残留/竞态/加载顺序），照着注释搬家即可。

---

## 二、现状画像

| 维度 | 数据 |
| --- | --- |
| 文件规模 | 1270 行 / 52 个嵌套子函数 |
| 共享闭包可变量 | ~35 个（横跨 7 个职责域） |
| 消费方 | 1 个视图组件（ChatCharacterStage.vue） |
| 组合式内部单测覆盖 | **0**（vitest 无任何 live2d spec） |
| 现有保障 | server 层三件套 + 真机自检 `run-live2d-selftest --release` + 渲染 soak |

闭包状态按域分布：

| 域 | 变量 |
| --- | --- |
| 后端/会话 | catalog、backend、session、model、loading、loadTimer |
| 指针凝视 | pointerGazeX/Y、CurrentX/Y、Active、Frame、LastFrame、FocusKind（8 个） |
| 互动 | activeInteraction、interactionTimer、interactionAudio |
| 生命周期 | lifecycleToken、entranceUntil、leaveTimer、destroyed/enabled/ready 等 refs |
| 口型/语音 | mouthValue、mouthHooked、speaking |
| 情绪 | emotionRuntime、nativeAnimationAdapter、blinkScheduler、emotionCurrent、lastParamFrame |
| 原生 overlay | nativeOverlayReady、nativeLayoutFrame/Attempts、nativeEmotionFrame/LastFrame |
| DOM/监听 | hostEl、stageEl、hostSelector、resizeObserver、visibilityHandler、pointer 三监听、native 两订阅 |

---

## 三、风险清单（按危险度排序）

1. **`destroyRuntime()` 是全域唯一权威复位点**：按注释锁定的顺序清理 4 个域的 timer、3 个 rAF 循环、适配器、参数表、DOM 类与 session/model。"先停 Pixi 再清模型"是修过的崩溃（动作 tick 读已释放数组）。任何拆分必须保住这唯一复位路径，严禁复制清理逻辑。
2. **`applyParameters()` 是 ~90 行每帧热路径**：读写横跨 9 个状态域（口型/眨眼/登场窗口/夏目叠层守卫/情绪平滑/凝视回退），且被 beforeModelUpdate 钩子与 `setMouth` 双入口调用。
3. **`lifecycleToken` 竞态卫兵**贯穿 disable/load/setCharacter 异步路径（告别期间重开、加载中切角色均为修过的实机 bug）。
4. **双后端能力分支**（`capability.parameterOverride === false` 即原生路径）编织在 7 个函数中：原生有独立情绪时钟、overlay DPR 实测比例换算（禁用 devicePixelRatio）、原生 HitArea 通道。
5. **三个独立 rAF 时钟**（凝视 / 原生情绪 / native layout 重试 ≤120 帧）+ Pixi ticker 钩子 + 5 族 setTimeout，取消纪律严格。
6. **夏目叠层残留 bug 史**是最微妙雷区：NATSUME_RESET_PARAMS 的 `-1/0` 隐藏态分组系实证结论（统一写 0 会半透明重影）。
7. **wl-live2d 库怪癖硬编码于流程**：connect 前 innerHTML 清空顺序、Start 组预加载重试 ≤40 次 × 250ms、hitTest 宽 mesh 兜底。

---

## 四、目标架构

```
src/composables/live2d/
├── constants.ts      纯数据：互动表 / MOUTH_PARAMS / BLINK_PARAMS / NATSUME_RESET_PARAMS
├── catalog.ts        readLive2DCatalog + 类型守卫（纯函数）
├── context.ts        Live2DCtx —— 35 个闭包变量 → 显式类型化字段 ★核心机制
├── pointerGaze.ts    凝视控制器（自包含 rAF 循环 + 全局指针入口）
├── interactions.ts   互动系统：分区带命中 / 外框排序 / 好感度动作调度 / 音效
├── emotionClock.ts   原生情绪时钟（bridge 通道独立 rAF）
├── layoutFit.ts      fit / layout / overlay 帧换算 / scheduleNativeLayout 重试环
├── lifecycle.ts      init / load / enable / disable / recover / destroyRuntime / destroy
└── useLive2D.ts      薄组合层：构建 ctx → 接线各模块 → 返回原公开 API（逐字不变）
```

### 核心机制：Live2DCtx

把现有 ~35 个闭包 let 收敛为**单一显式类型化容器**，各子模块只经 ctx 通信：

```ts
// context.ts（示意）
export interface Live2DCtx {
  // 响应式面
  ready: Ref<boolean>; enabled: Ref<boolean>; /* ... */
  // 元素与会话
  hostEl: HTMLElement | null; stageEl: HTMLElement | null;
  session: Live2DStageSession | null; model: Live2DModelHandle | null;
  // 时钟句柄（各子模块自持，ctx 只存统一取消入口）
  timers: { load: number; interaction: number; leave: number };
  frames: { gaze: number; nativeEmotion: number; nativeLayout: number };
  // 凝视共享值（applyParameters 回退路径读取）
  gaze: { x: number; y: number; currentX: number; currentY: number; active: boolean; kind: string };
  // 能力分支 / 生命周期卫兵
  capabilityNative: boolean; lifecycleToken: number; entranceUntil: number;
}
```

这一步把"隐式闭包共享"升级为"显式契约"：模块边界即数据边界，是整个重构的风险收敛器。

### 关键设计决策（红线）

1. `destroyRuntime()` 保持全库唯一实现，留在 lifecycle.ts；各子工厂返回 `{ dispose() }` 钩子注册进 ctx，由 destroyRuntime 按 **Pixi-first 原顺序**统一调用——禁止各模块自带清理副本。
2. `applyParameters` 的凝视回退读 `ctx.gaze.currentX/Y`（共享字段），不做参数传递。
3. 双后端能力分支**不抽象为策略类**——保持现有 if 形状原样搬家（实证注释都在分支内）。
4. `lifecycleToken` 语义不变，存于 ctx。
5. 公开返回对象（useLive2D.ts:1263-1269）**逐字冻结**，消费方零改动。

---

## 五、七步迁移路线（绞杀式，每步独立可编译、可提交、可回滚）

| 步骤 | 内容 | 风险 | 说明 |
| :--: | --- | :--: | --- |
| **0** | **先补测试再动刀**：以纯函数形态导出并测试——分区带映射（y<0.14→Head 等）、夏目外框 hit-area 排序兜底、readLive2DCatalog 宽松解析、MOUTH/BLINK 参数选择 | 低 | 现在零覆盖是最大盲区；测试先行让后续每步有金丝雀 |
| **1** | 抽离 `constants.ts` + `catalog.ts` | 零 | 纯数据/纯函数搬家 |
| **2** | ctx 对象化：35 个闭包 let → `ctx.x` 字段 | 机械量大 | 纯重命名零行为变化；typecheck 全量兜底 |
| **3** | 抽 `pointerGaze.ts` | 中 | 自包含 rAF 循环 + setGlobalPointer 入口 |
| **4** | 抽 `interactions.ts` | 中 | 监听幂等重建逻辑原样搬；好感度调度经 ctx 调 affection |
| **5** | 抽 `emotionClock.ts` + `layoutFit.ts` | 中 | 两个独立时钟域；overlay DPR 换算注释全保留 |
| **6** | 抽 `parameterFrame.ts`（每帧热路径） | 高 | 最后动刀；眨眼/口型/叠层守卫/情绪平滑逐行对照迁移 |
| **7** | 抽 `lifecycle.ts`，主文件收薄为组合根 | 高 | destroyRuntime 清理顺序逐行冻结；公开 API 终检 |

---

## 六、验证策略与门禁

| 阶段 | 门禁 |
| --- | --- |
| 每一步提交前 | `npm run typecheck:app` 零 Error + `npm run test:frontend` 全绿（含 Step 0 新增 spec） |
| Step 6/7 完成后 | 追加 `node scripts/tests/test-live2d-backend.js` + `test-live2d-service.js` + `test-live2d-native-contract.js` |
| **声明完成前（硬门槛）** | `npm run test:live2d-native:release` 真机自检通过 |
| 手工冒烟清单（双后端各过一遍） | ① 双角色切换后点击八分区反馈正确；② 说话口型随音频幅度开合；③ 眨眼双眼同步无 Wink；④ 夏目互动/登场后无叠层残留（灰眼/四手）；⑤ 桌面窗口拖动 overlay 跟随不跳位；⑥ `prefers-reduced-motion` 下静止节能；⑦ e2e `studio.spec.ts` live2d 断言保持通过 |

---

## 七、执行节奏建议

- **一轮会话做 Step 0–2**（测试地基 + 纯抽取 + ctx 化），真机自检通过后再进 Step 3–5；
- **Step 6–7 单独一轮**：动刀前先跑一次基线 `test:live2d-native:release` 存档对照；
- 额外收益：ctx 化之后，分区带映射与叠层守卫成为可单测纯函数，"事故注释区"从此有回归网兜底——比行数缩减更重要的长期资产。

---

## 八、进度追踪

- [x] Step 0 测试地基（2026-08-23，`197e67a`：useLive2D.spec.ts 14 条规格全绿）
- [x] Step 1 constants/catalog（2026-08-23，`6987242`：纯数据/纯函数原样搬出，注释零删改）
- [x] Step 2 ctx 对象化（2026-08-23，`e2eb7d6`：37 个闭包变量 → Live2DCtx；吸收 `ff4f385` 换装闪回修复新增的 overlaySettle/overlayWasByMotion）
- [x] Step 3 pointerGaze（2026-08-23，`18a4e03`）
- [x] Step 4 interactions（2026-08-23，`2535ce7`；Live2DStatus 与 prefersReducedMotion 归位 context.ts）
- [x] Step 5 emotionClock + layoutFit（2026-08-23，`5ffe124`；desktopWindowBounds 随 layoutFit 移入）
- [x] Step 6 parameterFrame（2026-08-23，`0f13ae5`；逐行迁移热路径，native-contract 契约断言跟随模块化新家）
- [x] Step 7 lifecycle + 组合根收薄（2026-08-23，`2b1220c`：useLive2D.ts 1270 → 98 行组合根，destroyRuntime 复位顺序逐行冻结且全库唯一）
- [x] 真机门禁 + 冒烟清单归档 —— 2026-08-27 完成：关闭桌宠后执行 `npm run test:live2d-native:release`，自动化 selftest `OK snapshots=3/3 exit=0`；用户确认双后端人工冒烟可用。

最终架构（2026-08-23 定稿）：useLive2D.ts 98 行组合根 + live2d/ 九模块（constants 97 / catalog 38 / context 183 / pointerGaze 106 / interactions 298 / emotionClock 45 / layoutFit 145 / parameterFrame 151 / lifecycle 466）。每步独立提交、typecheck + test:frontend 全绿；Step 6/7 追加 live2d 三件套（backend 24/24、service、native-contract 5/5）与打包预算（19 路由全部通过）。

人工冒烟清单（双后端各过一遍，目视验证）：
- [x] ① 双角色切换后点击八分区反馈正确
- [x] ② 说话口型随音频幅度开合
- [x] ③ 眨眼双眼同步无 Wink
- [x] ④ 夏目互动/登场后无叠层残留（灰眼/四手）；换装互动结束平滑回落无闪回
- [x] ⑤ 桌面窗口拖动 overlay 跟随不跳位
- [x] ⑥ `prefers-reduced-motion` 下静止节能
- [x] ⑦ e2e `studio.spec.ts` live2d 断言保持通过
