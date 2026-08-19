# 疑难留档：popular→studio 深链提示词串位（2026-08-20）

## 现象

绘图区先进入「热门角色（popular）」模式（从热门角色场景库点开始绘制 → `?popular=` 深链），
随后**不做整页刷新**（SPA 导航）跳到「灵感场景」→ 点宁宁/夏目场景「开始绘制」（`?scene=` 深链）
跳回绘图区时：

- 场景上下文卡、故事框 **正确** 变成宁宁/夏目场景（因为它们由 `sceneId`/`activeScene` 驱动）；
- 但组装出的正向提示词/预览 **仍是上一个热门角色** 的（如 `raiden_shogun, raiden ei, …`）。

## 为什么藏得深（复现前提）

1. 必须先进入 popular 模式，且**用 SPA 导航**保持 Pinia store（整页刷新会重置 store 默认回到 studio，导致本地开发/E2E 用 `page.goto` 时永远复现不出来）。
2. 场景上下文与故事框都正确，肉眼只剩「组装 Prompt 没变」一个可观测点。
3. 需要「先 popular 后 studio 场景」这一特定顺序。

## 根因

`PromptBuilderView.vue` 里提示词组装按模式二选一：

```ts
const livePrompt = computed(() => pb.isPopular ? popular.positivePrompt.value : positivePrompt.value)
```

其中 `pb.isPopular === (subject.kind === 'popular')`。而 `?scene=` 深链只调用
`selectScene → pb.loadScene`，`loadScene` 只写了 `sceneId/story/char/selections`，
**没有把 `subject` 从 popular 切回 studio**。于是 `isPopular` 仍为 true，
提示词继续走 `usePopularPromptAssembly`，与本场景（studio 场景）脱节。

历史恢复（`applyHistory` 的 studio 分支也走 `pb.loadScene`）存在同一条隐患。

## 修复（COMMIT：统一「加载工作室场景 ⇔ studio 模式」不变式）

1. `src/stores/promptBuilderStore.ts` — `loadScene()` 开头强制
   `subject.value = { kind: 'studio' }`。任何工作室场景装载都退出 popular 组装；
   一处兜底同时修掉深链与历史恢复两条路径（`loadScene` 全仓仅 2 个调用点）。
2. `src/views/PromptBuilderView.vue` — `selectScene()` 在 `pb.isPopular` 时先
   `refreshAnimaBackend()`，让专家模式的宁宁/夏目 Anima 模型与 LoRA 白名单立即收敛
   （不等 15s 状态轮询）。
3. 反向路径（studio → `?popular=`）已由 `selectPopularSource('popular')` 原有逻辑处理，对称无缺口。

## 验证

- 真机复现脚本（SPA 导航：先雷电将军再宁宁场景）：
  - 修复前：`data-subject=popular`，预览仍是 `raiden_shogun …`；
  - 修复后：`data-subject=studio`，预览 `safe…ayachi_nene…visual novel event cg…` 随场景变化。
- 新增 E2E 回归 `tests/e2e/flows.spec.ts` **flow 6g**，断言 subject 回 studio、
  预览不残留热门角色身份词、预览随场景变化 —— 已通过。
- `npm run typecheck:app` / `npm run build`（bundle 预算内）通过。
- 注意：`flows` flow 1/3a/4/4b/6 与 `anima-quick` 第一条为**此前已存在**的失败
  （旧 DOM 选择器/上游时序，修复前后一致失败），与本修复无关。

## 教训

- 涉及「模式/主体状态」的深链修复，必须用 **SPA 导航**（点页内链接）而不是 `page.goto`
  （整页刷新会重置 Pinia，掩盖状态残留类 bug）。
- 排查"提示词没跟随场景"类问题，先看组装分支（popular/studio）是否切换，
  再看 `sceneId` 驱动的展示层——两者可能不同步。

## 后续小优化（同日）：进入热门角色模式清空故事

用户反馈的旧故事残留小瑕疵：
- 现象：studio（灵感场景）→ 热门角色（bare `?popular=` 深链或页内切换）时，
  故事框仍显示上一个宁宁/夏目场景的故事。不影响出图（`usePopularPromptAssembly`
  不读 `pb.story`），但显示上是残留。
- 修复：`selectPopularSource('popular')` 由 `clearScene({ keepStory: true })` 改为
  `clearScene()`（一并清空 story）；同时删掉其后已冗余的 `manualTags`/`visualDescription`
  重置行（`clearScene` 本就重置）。选中蓝图后故事由 `selectBlueprint` 写回蓝图
  `description`，无闪现。
- 反向（studio→popular）实测干净：`?popular=` 深链显式走 `selectPopularSource('popular')`，
  且热门组装不读 story，无泄漏。
- 回归：flow 6h 同时断言 subject=popular、预览无工作室身份词、**故事不再等于旧 studio 故事**
  （非空且为新蓝图描述）；flow 6g / draft round-trip 均通过。
