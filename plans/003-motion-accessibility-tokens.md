# 003 — 收敛动效令牌并保留 reduced-motion 反馈

- **Status**: DONE
- **Commit**: b1ccfc0
- **Severity**: HIGH
- **Category**: Accessibility / Cohesion
- **Estimated scope**: 5 files, 40-80 lines

## Problem

全局与导演台 reduced-motion 当前把所有 transition 压成 `.01ms`：

```css
/* src/assets/css/design-system.css:1367-1375 — current */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

```css
/* src/assets/css/director.css:1597-1600 — current */
@media (prefers-reduced-motion: reduce) {
  .pb *, .pb *::before, .pb *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

这会同时抹掉颜色、边框、opacity 等帮助用户理解状态的反馈。另有弹层退出曲线使用 `cubic-bezier(.55, 0, .85, .36)`，以及多处裸 ease/硬编码时长。

## Target

Reduced-motion 策略应移除位移、缩放、旋转、持续氛围和 shimmer，但保留颜色、opacity、border-color 等状态反馈，短时长不超过 200ms。全局规则不能以 `transition-duration: .01ms !important` 粗暴覆盖所有属性；应针对 transform/clip-path/filter 等运动属性，或让组件提供 motion-specific reduced rules。

弹层退出使用快速响应曲线，不使用 ease-in 风格曲线。目标示例：

```css
.layer-pop-leave-active {
  transition: opacity var(--motion-hover) var(--ease-out);
}
.layer-pop-leave-active > :first-child {
  transition: opacity var(--motion-hover) var(--ease-out), transform var(--motion-hover) var(--ease-out);
}
```

动效令牌收敛：高频 hover 用 `--motion-hover`，控件反馈用 `--motion-control`，大面积浮层用 `--motion-surface` / `--ease-drawer`；不为低频艺术氛围强行消灭已有语义。

## Repo conventions to follow

- 令牌集中在 `src/assets/css/design-system.css:196-213`。
- 组件已普遍使用 `[data-theme]` 和 `@media (prefers-reduced-motion: reduce)`。
- 减弱动效保留 opacity/color 的原则见 `.agents/skills/improve-animations/AUDIT.md:84-95`。

## Steps

1. 盘点全局 reduced-motion 覆盖范围，确认哪些组件依赖它关闭 transform/animation；不要直接删除兜底而不补组件规则。
2. 将全局规则改为仅停止 animation、重复次数和 scroll-behavior，并针对常见运动组件明确关闭 transform transition；保留 background/color/border/opacity transition。
3. 将 director.css 的 reduced-motion 段改为：停止舞台氛围、sweep、shimmer、旋转和位移；保留按钮/输入/状态颜色反馈，删除对所有 transition-duration 的通配覆盖。
4. 将 `.layer-pop` 与 `.layer-fade` 退出曲线从 `cubic-bezier(.55, 0, .85, .36)` 收敛为 `var(--ease-out)`，保持退出时长 `var(--motion-hover)`。
5. 修正 `AppToast.vue`：退出逻辑检测 reduced-motion；未达到拖拽关闭阈值时使用短时 ease-out 或 spring 回弹，不要直接清空导致瞬移。
6. 将 `AppSoundToggle.vue:38` 的按压缩放从 `.92` 调整为 `.97`，并将触控设备 hover 动效包在 `(hover: hover) and (pointer: fine)` 中。
7. 收敛本批触及文件中的裸 ease 与硬编码时长；不要为了“令牌化”改变已验证的长时氛围动画语义。

## Boundaries

- Do NOT remove opacity/color/border feedback for reduced-motion users.
- Do NOT change content, routing, model APIs, storage keys, or Live2D runtime behavior.
- Do NOT globally disable all transitions as a shortcut.
- Do NOT change decorative atmosphere duration unless a measured performance issue is demonstrated.
- Do NOT add dependencies.

## Verification

- **Mechanical**: run `npm run typecheck:app`, `npm run test:frontend`, `npm run test:style-debt`; expected zero errors.
- **Feel check**: enable reduced motion and verify button hover/active color, focus rings, selected states and status changes remain visible while movement disappears. Open/close every shared modal and confirm exit starts immediately. Drag a toast and release below threshold; confirm it springs/eases back.
- **Performance**: inspect compare drag, zoom pan, inpaint brush resize and director list interactions in DevTools Performance; no repeated layout work should be caused by the animated property.
- **Done when**: no relevant high-frequency interaction transitions layout properties; reduced-motion preserves state feedback; shared modal exit has no ease-in curve; token audit reports no newly introduced hardcoded motion values.
