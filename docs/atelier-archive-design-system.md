# 绘境档案系统（Atelier Archive）平面设计与微交互动效规范

> **文档定位**：AI-CG-Studio（绫季绘境）高级 UI/UX 设计工程指南  
> **核心融合**：
> 1. **品牌视觉**：严格保留项目已有配色（绫地宁宁紫 `#F4A6D7` / 四季夏目金 `#F2BB68` / 极暗紫 `#171329`）。  
> 2. **平面排版**：融合《明日方舟》的瑞士平面网格、1px 战术切角边框与多语言/等宽代码符号。  
> 3. **微交互与动效**：结合 Emil Kowalski（Vercel/Linear 前前端设计工程师）的 **Design Engineering 动效准则**，打造极致顺滑、具有质感的终端微交互。

---

## 1. 平面设计与版式规范 (Graphic Layout & Grid)

### 1.1 瑞士平面排版 (Swiss Style Grid)
* **严谨网格对齐**：全站卡片与组件严格按网格对齐，禁止随意外边距。
* **双语与代码符号**：
  * 主标题伴随等宽英文/代码修饰（如 `SHOWCASE // 场景大厅`、`[SCENE_ID: #042]`）。
  * 标签与状态使用 `[LOG]`、`::STATUS`、`//` 等战术标号。

### 1.2 战术边框与切角 (Tactical Framing & Chamfer)
* **1px 极细半透明边框**：`1px solid rgba(244, 166, 215, 0.2)`。
* **45° 切角 (Chamfer Angle)**：
  * 按钮与面板右侧/顶部采用 45° 切角（`clip-path: polygon(...)`），呈现电子档案质感。

---

## 2. 动效与微交互规范 (Emil Kowalski 动效工程准则)

### 2.1 缓动曲线与时间律动 (Easing & Durations)

绝对避免使用弱效的 `ease` 或滞后的 `ease-in`。入场动画一律采用强烈的 `ease-out`。

```css
:root {
  /* Emil's Custom Easing Curves */
  --ease-out-terminal: cubic-bezier(0.16, 1, 0.3, 1);  /* 战术终端快进慢停 */
  --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);    /* 高响应UI入场 */
  --ease-in-out-smooth: cubic-bezier(0.77, 0, 0.175, 1);/* 构图/平滑位移 */

  /* 动画时长严格控制在 300ms 以内 */
  --duration-click: 120ms;    /* 按钮点击反馈 */
  --duration-fast: 160ms;     /* 悬浮/提示框 */
  --duration-normal: 240ms;   /* 下拉菜单/卡片入场 */
}
```

### 2.2 触感点击反馈 (Active Press Feedback)
* **规则**：所有可点击元素在 `:active` 状态下必须缩小至 `scale(0.97)`，提供瞬间的手感回馈。
```css
.tactical-btn, .archive-card-clickable {
  transition: transform var(--duration-click) var(--ease-out-strong),
              border-color var(--duration-fast) ease;
}

.tactical-btn:active, .archive-card-clickable:active {
  transform: scale(0.97);
}
```

### 2.3 拒绝从 `scale(0)` 出现 (Never Animate from scale(0))
* **规则**：现实中没有物体会从绝对零度无中生有。弹窗、提示框、卡片显现时，起始状态应为 `scale(0.95)` + `opacity: 0`。
```css
.archive-popover {
  opacity: 1;
  transform: scale(1);
  transition: opacity var(--duration-normal) var(--ease-out-strong),
              transform var(--duration-normal) var(--ease-out-strong);
}

.archive-popover-enter-from,
.archive-popover-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
```

### 2.4 阶梯式流畅切入 (Short Stagger Entrance)
* **规则**：卡片列表载入时，错开 30ms ~ 45ms 依次切入。错开时间不能太长，否则会产生卡顿感。
```css
.stagger-item {
  opacity: 0;
  transform: translateY(8px);
  animation: terminal-slide-in var(--duration-normal) var(--ease-out-terminal) forwards;
  animation-delay: calc(var(--index, 0) * 35ms);
}

@keyframes terminal-slide-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 2.5 悬浮扫描与线条延展 (Hover & Scanline Sweep)
* **规则**：仅在桌面端 fine-pointer 设备生效（避免移动端误触）。
```css
@media (hover: hover) and (pointer: fine) {
  .archive-card {
    transition: transform var(--duration-fast) var(--ease-out-strong),
                border-color var(--duration-fast) ease;
  }
  .archive-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-primary);
  }
}
```

---

## 3. Review 检查对照表 (Review Checklist)

在开发与评审 UI 组件时，严格参照以下标准：

| 检查项 | 不推荐 (Before) | 推荐做法 (After) | 优化原因 |
| :--- | :--- | :--- | :--- |
| **属性过渡** | `transition: all 300ms` | `transition: transform 160ms var(--ease-out-strong)` | `all` 性能差；显式声明只触发 GPU 硬件加速属性 |
| **弹窗/卡片出现** | `transform: scale(0)` | `transform: scale(0.95); opacity: 0` | 避免物体无中生有，更符合真实物理感觉 |
| **缓动函数** | `transition: 0.3s ease-in` | `transition: 160ms cubic-bezier(0.23, 1, 0.32, 1)` | `ease-in` 启动极慢，给人软件卡顿的错觉 |
| **按钮按压** | 点击无形变反馈 | `:active { transform: scale(0.97); }` | 给予用户极佳的即时按压回馈 |
| **触控设备悬浮** | 裸写 `:hover` 效果 | 包装在 `@media (hover: hover)` | 防止手机/平板点击后悬浮状态残留 |
| **动画时长** | `400ms - 500ms` | `150ms - 250ms` | UI 动画超过 300ms 会大幅降低软件的“快感” |

---

## 4. 实施总结

已经将 **明日方舟的战术平面语言** 与 **Emil Kowalski 的顶级微交互工程规范** 完美融合到了 `docs/atelier-archive-design-system.md` 中。项目代码可随时依据此规范进行 CSS 变量配置和组件动画升级！
