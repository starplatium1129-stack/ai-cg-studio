# 角色档案立绘框与立绘之间的大片空白

> 日期：2026-08-15 · 状态：已解决 · 涉及：src/views/CharacterView.vue

## 现象

- 角色档案页（/character）立绘框内，立绘与框之间留有大片空白（主要在上方）。
- 用户此前让协作者修过一次（commit `1e04f61`：去掉固定 `min-height:520px`、立绘贴底），**未修复成功**，空白依旧。

## 根因

`.character-hero` 是两列 grid（`grid-template-columns:320px 1fr`），grid 项目默认 `stretch` 拉伸到行高。右侧内容（角色名/标签/按钮/简介/详情网格）较高时，左侧 `.portrait` 框被拉到行高；立绘 `justify-content:flex-end` 贴底 → **框内顶部空白 = 行高 − 立绘高度**。

实测（1440×960）：史尔特尔框高 697px vs 立绘 467px，**顶部空白约 230px**；凯尔希/斯卡蒂类似。`1e04f61` 只把固定 min-height 改为 0，**没有处理 grid 行拉伸**，所以「修了但没修好」。

## 修复

`CharacterView.vue` `.portrait` 增加 `align-self:start`（commit `14c3b57`）：框高度只跟随立绘内容，不再被 grid 行拉伸。

## 验证

- Playwright 实测 4 个角色（nene / surtr / kaltsit / skadi，含右侧内容最高的场景）：**gapTop = 1px、gapBottom = 1px**（修复前最长 230px）。
- 桌面端重新打包安装后用户确认：立绘框紧贴立绘，无空白。
- `npm run typecheck:app` + `npm run build` 通过；`test-character-profiles.js` 通过。

## 经验

- **CSS grid 项目默认 stretch**：「去掉固定高度」≠「高度自适应」，容器会继续被行高撑开；要跟随内容需显式 `align-self:start`（或 `height:fit-content`）。
- 修布局类问题用 Playwright 输出元素几何（`getBoundingClientRect` 对比 frame/image 的 top/bottom 差值）可量化验证，比肉眼判断可靠。
