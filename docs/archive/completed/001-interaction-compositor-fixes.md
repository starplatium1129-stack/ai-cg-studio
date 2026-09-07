# 001 — 修复高频交互的合成层性能

- **Status**: DONE
- **Commit**: b1ccfc0
- **Severity**: HIGH
- **Category**: Performance / Interruptibility
- **Estimated scope**: 4 files, 20-40 lines

## Problem

高频拖拽和控件反馈仍有布局属性补间：

```css
/* src/components/visual/ImageCompareSlider.vue:154-164 — current */
.compare-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--split-pos, 50%);
  width: 2px;
  transform: translateX(-50%);
}
```

```css
/* src/components/visual/ZoomableImageViewer.vue:195-205 — current */
.zoom-transform-layer {
  transform: var(--zoom-transform, none);
  transition: transform 0.08s linear;
}
```

```css
/* src/views/VideoStudioView.vue:922-923 — current */
.video-progress i {
  width:100%;
  transform-origin:left;
  scale:var(--progress,0%);
  transition:scale var(--motion-surface) var(--ease-out);
}
```

```css
/* src/views/ControlView.vue:725-730 — current */
.tunnel-switch-knob { left:2px; transition:left var(--motion-hover); }
.tunnel-switch[aria-checked="true"] .tunnel-switch-knob { left:22px; }
```

这些属性会在拖拽或状态变化时触发布局，且缩放查看器的常驻 80ms transition 会让拖拽滞后。

## Target

比较滑块分割线固定在容器左侧，只更新合成层 transform。根据组件现有的 split 变量/脚本，使用 CSS transform 承载百分比位置；不得继续用 `left: var(--split-pos)`。

缩放查看器在 `.is-panning` 时 `transition: none`；非拖拽状态使用 `transition: transform var(--motion-control) var(--ease-out)`。保留现有 `transform-origin`。

视频进度条保持固定高度，只沿 X 轴缩放：

```css
.video-progress i {
  transform-origin: left center;
  transform: scaleX(var(--progress, 0%));
  transition: transform var(--motion-surface) var(--ease-out);
}
```

开关 knob 保持固定 `left: 2px`，选中态通过 `transform: translateX(20px)` 移动，过渡只作用于 transform。

## Repo conventions to follow

- 动效令牌位于 `src/assets/css/design-system.css`。
- 高频反馈优先使用 `var(--motion-press)` / `var(--motion-control)` 与 `var(--ease-out)`。
- 项目已有 `.btn:active` 的 `scale(.97)`，不要引入新依赖或新的动画库。

## Steps

1. 阅读 `ImageCompareSlider.vue` 的脚本，确认 split 百分比如何写入 DOM；将分割线的位置写入可直接用于 transform 的 CSS 值，避免通过父节点 CSS 变量驱动 `left`。
2. 修改 `ImageCompareSlider.vue` 样式，使 divider 的布局位置固定、transform 承担 X 轴位置；保证 handle 的可访问键盘操作不变。
3. 修改 `ZoomableImageViewer.vue`，添加 `.zoomable-image-viewer.is-panning .zoom-transform-layer { transition: none; }`，将普通 transition 收敛到 `var(--motion-control) var(--ease-out)`。
4. 修改 `VideoStudioView.vue`，将单值 `scale` 改为 `transform: scaleX(...)`，同步将 transition 属性改为 transform。
5. 修改 `ControlView.vue`，将 tunnel switch knob 的 left 过渡改为固定 left + transform translateX。
6. 为 compare slider、zoom viewer、video progress、tunnel switch 各写一条针对高频状态的回归断言或在现有测试中补选择器断言（若仓库已有对应测试，优先扩展原测试）。

## Boundaries

- Do NOT touch scene data, prompt compilation, outfit logic, or any files outside the four listed source files and directly related tests.
- Do NOT change pointer, keyboard, accessibility, or business state logic except the style binding needed to move the divider with transform.
- Do NOT use `transition: all`.
- Do NOT animate width, height, left, top, padding, or margin.
- Do NOT add dependencies.

## Verification

- **Mechanical**: run `npm run typecheck:app`; run focused frontend tests and `npm run test:frontend`; expected zero errors.
- **Feel check**: drag the image comparison handle quickly back and forth and confirm the divider is under the pointer with no visible lag. Zoom in, pan continuously, and confirm panning is immediate while zoom reset eases out. Toggle tunnel and confirm knob height remains constant. Advance video progress and confirm the bar remains exactly 3px high.
- **Reduced motion**: with `prefers-reduced-motion: reduce`, confirm global policy removes movement but leaves state colors and visibility feedback.
- **Done when**: source contains no `transition: left` for the switch, no `left: var(--split-pos` for the divider, no single-value progress `scale`, and no transform transition during `.is-panning`.
