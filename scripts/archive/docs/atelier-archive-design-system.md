# 绘境档案系统（Atelier Archive）平面设计与微交互动效规范

> **文档定位**：AI-CG-Studio（绫季绘境）高级 UI/UX 设计工程指南  
> **研究底稿**：[明日方舟式视觉语言与"众生行记"网页设计研究](./arknights-inspired-web-design.md)（视觉语法系统分析）  
> **核心融合**：
> 1. **品牌视觉**：严格保留项目已有配色（绫地宁宁紫 `#F4A6D7` / 四季夏目金 `#F2BB68` / 极暗紫 `#171329`）。  
> 2. **平面排版**：融合《明日方舟》的瑞士平面网格、1px 战术切角边框与多语言/等宽代码符号。  
> 3. **微交互与动效**：结合 Emil Kowalski（Vercel/Linear 前前端设计工程师）的 **Design Engineering 动效准则**。

---

## 0. 视觉语法系统：先理解"方舟式"是什么

明日方舟不是一套固定皮肤（黑白灰 + 斜切 + 噪点），而是一个**稳定的视觉语法系统**：

- 底层品牌语法负责信息纪律、工业感、层级和状态反馈。
- 每次活动再覆盖一层与故事地点、宗教、文化或技术有关的语义。
- 活动可以完全换配色，但编号、信息分层、画面焦点和交互逻辑保持一致。

绫季绘境的翻译：

> **Atelier Archive / 绘境档案系统** —— 表达"私人创作档案、导演终端和角色记忆"。

### 0.1 高对比信息编排（本项目的落地规则）

| 方舟结构 | 绫季绘境落点 |
| :--- | :--- |
| 一幅承担情绪的主视觉 | 首页 Hero 双女主插画、场景样张大图 |
| 一组理性的编号/坐标/标尺 | `ARCHIVE // 00`、`SHOWCASE 05 / 08`、Scene ID、Seed、Sampler、LoRA 权重 |
| 一个对比极强的主操作 | 每屏只保留一个最高对比按钮（如「生成图片」） |
| 低权重辅助信息 | 通过透明度、尺寸、字重退到后方，不抢焦点 |

**纪律**：
- 每个屏幕只允许一个最高对比操作。
- 装饰文字不得与主标题同尺寸同字重。
- 状态色只表达状态，不把整页染成状态色。
- 对比由尺寸、位置、锐度和材质共同完成，不只依赖颜色。

### 0.2 装饰来自页面含义

装饰不是随机贴纸，而是当前系统的"证据"：

- 绘制台用画布点阵、进度刻度、生成参数（Step/Cfg/Seed）。
- 角色房间用档案编号、立绘、Live2D 状态。
- 作品册用拍摄比例、审核状态、版本标记。
- 控制室用服务状态、端口、显存占用。

**禁止**：为了"沉浸感"制造无意义的伪参数；装饰与内容无关的贴图。

---

## 1. 平面设计与版式规范 (Graphic Layout & Grid)

### 1.1 瑞士平面排版 (Swiss Style Grid)
* **严谨网格对齐**：全站卡片与组件严格按网格对齐，禁止随意外边距。
* **双语与代码符号**：
  * 主标题伴随等宽英文/代码修饰（如 `SHOWCASE // 场景大厅`、`[SCENE_ID: #042]`）。
  * 标签与状态使用 `[LOG]`、`::STATUS`、`//` 等战术标号。
* **字体分工**（不引入方舟专有字形）：
  * `--font-sans`：正文、操作、状态（小尺寸可读性）。
  * `--font-mono`：Scene ID、Seed、模型、端口、状态、编号。
  * `--font-serif`：仅活动标题、角色档案引语、大幅叙事标题。

### 1.2 战术边框与切角 (Tactical Framing & Chamfer)
* **1px 极细半透明边框**：`1px solid rgba(244, 166, 215, 0.2)`。
* **45° 切角 (Chamfer Angle)**：
  * 按钮与面板右侧/顶部采用 45° 切角（`clip-path: polygon(...)`），呈现电子档案质感。
* **圆角纪律（2026-07-31 视觉审查修订）**：
  * 全局卡片/按钮圆角收紧至 `2px - 4px`（`--r-md` 以下），**禁止 12px+ 大圆角**。
  * 大圆角是 iOS/Web 的"温馨亲和"语言，与方舟的战术/工业属性冲突。
  * 主卡片或高亮按钮角落可用 45° 切角或十字对准线（crosshair）替代圆角。

### 1.3 对比度与线条锐利度（2026-07-31 视觉审查修订）
* **减少柔和 box-shadow**，改用 1px 高对比边框线（浅色主题 `#E0E0E0`，深色主题 `#333`）。
* **局部深色战术块**：浅色主题下，侧边栏/顶栏/核心按钮可用纯黑深灰（`#121212`）压制，形成方舟标志性的"高反差战术对比"。
* 背景降对比、降饱和后再承载文字；关键操作用实色块或高锐度边框，不淹没在插画中。

### 1.4 图标纪律（2026-07-31 视觉审查修订）
* **全站禁用彩色 3D 系统 Emoji 作为 UI 图标**（情绪面板、聊天区、卡片标题）。
* 统一使用单色线框矢量图标（`ArchiveIcon` 组件，`stroke-width 1.7`）。
* 情绪/状态可用方舟风格简写代号（如 `[EM-01 HAPPY]`、`::WARM`）配合单色图标。
* 与"图标都得自己画"的项目约束一致；系统 Emoji 只允许出现在内容正文（角色对话）而非 UI 控件。

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
| **动画时长** | `400ms - 500ms` | `150ms - 250ms` | UI 动画超过 300ms 会大幅降低软件的"快感" |
| **圆角** | `12px - 16px` 大圆角 | `2px - 4px` 或 45° 切角 | 大圆角弱化战术/工业属性（2026-07-31 视觉审查） |
| **UI 图标** | 彩色 3D 系统 Emoji | 单色线框矢量图标 / `[EM-01]` 代号 | Emoji 与冷硬档案语言冲突（2026-07-31 视觉审查） |
| **阴影与边框** | 柔和大阴影 | 1px 高对比边框 + 局部深色战术块 | 提升锐度，避免"发脏"（2026-07-31 视觉审查） |
| **最高对比操作** | 每屏多个主按钮 | 每屏只保留一个 | 方舟层级纪律：对比由尺寸/位置/锐度共同完成 |

---

## 4. 与既有文档的关系

| 文档 | 角色 |
| :--- | :--- |
| `DESIGN.md` | 品牌 token、色彩、排版、间距的**数据源头**（不改） |
| `arknights-inspired-web-design.md` | 方舟视觉语法与"众生行记"的**研究方法论**（研究底稿） |
| 本文档 | 平面 + 动效的**可执行工程规范**（网格、边框、切角、动效、图标纪律） |

## 5. 实施总结

1. **视觉语法**：高对比信息编排 + 装饰来自页面含义 + 字体分工。
2. **平面语言**：瑞士网格、1px 战术边框、45° 切角、收紧圆角、局部深色战术块。
3. **图标纪律**：全站单色线框矢量图标，禁用彩色 Emoji 做 UI。
4. **微交互**：Emil Kowalski 缓动曲线、120-240ms 时长、`scale(0.97)` 按压反馈、拒绝 `scale(0)` 入场。
5. **验证方式**：对照本规范 + Playwright 截图 + Gemini 视觉审查做周期回归。

项目代码可随时依据此规范进行 CSS 变量配置和组件动画升级。
