# 002 — 补齐导演台状态交接与退出反馈

- **Status**: DONE
- **Commit**: b1ccfc0
- **Severity**: MEDIUM
- **Category**: Interruptibility / Missed opportunities
- **Estimated scope**: 3 files, 40-90 lines

## Problem

导演台的重要状态变化存在硬切或重复关键帧：

```html
<!-- src/views/PromptBuilderView.vue:240,303 — current -->
<div v-show="!displayResultUrl" class="stage-placeholder">
<div v-if="displayResultUrl" class="result-image-wrap archive-canvas">
```

```html
<!-- src/views/PromptBuilderView.vue:701,705 — current -->
<div v-if="pb.toastMsg" class="pb-toast" role="status" aria-live="polite">
<div v-if="compareOpen && prevResult && lastResult" class="pb-compare-overlay">
```

```css
/* src/assets/css/director.css:1434-1441 — current */
.pb .result-image { animation:aicsBloomReveal .65s var(--spring-soft) forwards; }
@keyframes aicsBloomReveal {
  0% { opacity:0; transform:scale(.97); filter:brightness(1.3) blur(10px); }
  60% { opacity:.95; filter:brightness(1.08) blur(2px); }
  100% { opacity:1; transform:scale(1); filter:brightness(1) blur(0px); }
}
```

结果区与占位区切换时可能跳高，Toast/对比弹窗关闭时直接卸载。生成中的 Anima/Krea 没有真实数值时还显示固定 35%，不能表达真实进度。

## Target

保持舞台容器的稳定尺寸，在内部用 Vue Transition 完成占位层与结果层的轻量交接：opacity 与 transform only，初始 scale `.985`，使用 `var(--motion-control) var(--ease-out)`；不使用 10px blur。

导演台 Toast 和对比弹窗都必须拥有 enter/leave，退出应快于进入且可逆。优先复用全局 `.layer-pop` / `.layer-fade`，不要新建并行动画体系。

结果大图入场只使用 opacity + transform，目标 `220–280ms var(--ease-out)`；移除 brightness/blur 关键帧。

Anima/Krea 在没有真实进度时显示 indeterminate 状态，不伪造 35%。流光只能动画 transform，reduced-motion 下停止流光并保留静态“正在推理”状态。

角色切换必须先确认 `character-shifting` 类名是否确实由 PromptBuilderView 根节点挂载。若未挂载，补齐状态闭环，并保证切换结束后清理类名。

## Repo conventions to follow

- 弹层过渡集中在 `src/assets/css/design-system.css` 的 `.layer-pop` / `.layer-fade`。
- 页面已有 `var(--motion-control)`、`var(--motion-surface)` 和 `var(--ease-out)`。
- 项目遵守 transform/opacity 动效性能规则。

## Steps

1. 阅读 PromptBuilderView 的生成状态、角色选择和比较弹窗状态，确认 class/Transition 的真实结构后再修改。
2. 给舞台占位与结果区域增加明确的 Transition，确保父容器尺寸稳定；不要用并行 keyframe 与 Vue Transition 双重驱动。
3. 将结果大图 Bloom 动画改为 opacity + transform 的轻量过渡，时长控制在 220–280ms。
4. 为 `pb-toast` 增加可逆的 enter/leave，或复用共享 layer 过渡；保持 aria-live 和计时逻辑不变。
5. 为 compare overlay/card 接入共享 Transition，遮罩与内容都能进入和退出。
6. 修复并验证 `character-shifting` 类名挂载，保留既有角色主题颜色过渡和扫光语义。
7. 为 Anima/Krea 的生成状态增加 indeterminate 表现，禁止用固定百分比伪装真实进度；补 reduced-motion 静态降级。

## Boundaries

- Do NOT change prompt token compilation, scene blueprint data, model routing, or generation API contracts.
- Do NOT introduce a new animation dependency.
- Do NOT use blur over 2px for a transition; do not animate layout properties.
- Do NOT alter generated image dimensions or result persistence behavior.
- If the existing template structure cannot support a clean Transition without changing business logic, stop and report the exact structural blocker.

## Verification

- **Mechanical**: run `npm run typecheck:app`, `npm run test:frontend`, and focused prompt-builder tests; expected zero errors.
- **Feel check**: switch characters rapidly and confirm the sweep runs once and the class is cleaned up. Generate an image and confirm the stage height does not jump. Let the director toast expire and confirm it exits. Open/close compare rapidly and confirm the overlay reverses smoothly. Start Anima/Krea generation and confirm indeterminate activity is visible without a fake percentage.
- **Reduced motion**: movement, scale, blur and indeterminate sweep must stop; opacity, border and color state feedback remains.
- **Done when**: no director result entry uses the old 10px blur Bloom; toast and compare have leave states; non-SD generation no longer renders a fixed 35% as if it were measured progress.
