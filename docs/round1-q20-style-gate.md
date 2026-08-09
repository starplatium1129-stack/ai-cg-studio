# Q-20 第一轮样式 Token 门禁报告

日期：2026-08-09

执行边界：仅修改 `src/assets/css/design-system.css`、`src/assets/css/director.css`、`src/assets/css/scene-card.css`，并新增本报告。未修改 scanner、`BUDGET`、`DESIGN.md`、Vue/TypeScript、`package.json`、`desktop-tauri/**`、`src/api/**`、`docs/project-handoff.md` 或任务分配文档。

## 基线 Scanner

命令：`node scripts/maintenance/scan-style-literals.js`，退出码 `0`。

```text
     7  src/views/HomeView.vue        fontsize=2 radius=5
     5  src/views/PromptBuilderView.vuefontsize=2 radius=1 white=2
     4  src/assets/css/director.css   fontsize=1 font-shorthand=1 zindex=1 bezier=1
     3  src/assets/css/design-system.cssfontsize=2 radius=1
     3  src/assets/css/scene-card.css zindex=3
     3  src/components/DesktopTitleBar.vuefontsize=1 white=2
     2  src/assets/css/chat.css       font-shorthand=1 zindex=1
     2  src/assets/css/companion.css  fontsize=1 font-shorthand=1
     1  src/components/SpeechInputSettings.vueradius=1
     1  src/components/visual/ArchiveStatePanel.vuefontsize=1
     1  src/components/visual/RouteAtmosphere.vuezindex=1
     1  src/views/TrainingView.vue    font-shorthand=1
     1  index.html                    font-shorthand=1
TOTAL literal occurrences: 34 (budget 26)
```

基线与任务文档一致。三个独占 CSS 文件合计 `10` 处；`PromptBuilderView.vue` 的 `5` 处保持未修改。

## 修改内容

| 文件 | 收口内容 | 保持的原计算值 |
|---|---|---|
| `src/assets/css/design-system.css` | 新增 `--fs-brand-caption`、`--r-brand-mark`；主题图标复用 `--fs-body-lg` | `.55rem`、`7px 12px 7px 12px`、`1rem` |
| `src/assets/css/director.css` | 新增 `--fs-stage-glyph`、`--fs-ios-control`、`--z-stage-backdrop`、`--ease-stage-sweep` | `1.7rem`、`16px`、`0`、`cubic-bezier(.4,0,.2,1)` |
| `src/assets/css/scene-card.css` | 新增 `--z-sc-media`、`--z-sc-pointer-glow` | 媒体/骨架 `0`、指尖光斑 `1` |
| `docs/round1-q20-style-gate.md` | 第一轮证据、结果、限制和 SOL 接入点 | 新文件 |

所有 custom property 均按真实角色命名，没有扫描逃逸变量、注释豁免或数值改动。

## 最终 Scanner

命令：`node scripts/maintenance/scan-style-literals.js`，退出码 `0`。

```text
     7  src/views/HomeView.vue        fontsize=2 radius=5
     5  src/views/PromptBuilderView.vuefontsize=2 radius=1 white=2
     3  src/components/DesktopTitleBar.vuefontsize=1 white=2
     2  src/assets/css/chat.css       font-shorthand=1 zindex=1
     2  src/assets/css/companion.css  fontsize=1 font-shorthand=1
     1  src/components/SpeechInputSettings.vueradius=1
     1  src/components/visual/ArchiveStatePanel.vuefontsize=1
     1  src/components/visual/RouteAtmosphere.vuezindex=1
     1  src/views/TrainingView.vue    font-shorthand=1
     1  index.html                    font-shorthand=1
TOTAL literal occurrences: 24 (budget 26)
```

最终总数 `24 <= 24`，scanner 源码中的 budget 仍为 `26`，保留 `2` 处余量。三个目标 CSS 文件不再出现在 scanner 输出中。

## 验收命令

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `node scripts/maintenance/scan-style-literals.js`（基线） | 0 | `34 (budget 26)` |
| `node scripts/maintenance/scan-style-literals.js`（修改后） | 0 | `24 (budget 26)` |
| `npm run test:style-debt` | 0 | style-debt、scanner check、contrast、color lint 全部通过；color lint 仍报告并行文件既有的 11 个 hardcoded hex 警告，但不构成失败且不在 B 的文件边界内 |
| `npm run typecheck:app` | 0 | `vue-tsc -p tsconfig.app.json --noEmit` 通过 |
| `npm run build` | 0 | Vite 构建通过；保留 `>500 kB` chunk 警告；route bundle budget 通过，Prompt Builder CSS `90.9 KiB / 100.0 KiB`，最大 lazy chunk `923.4 KiB / 1000.0 KiB` |
| `npx playwright test tests/e2e/studio.spec.ts --grep "home renders\|director separates\|scene explorer" --workers=3` | 0 | `4 passed (10.3s)`；配置因 `fullyParallel: false` 实际使用 1 worker |
| `git diff --check -- src/assets/css/design-system.css src/assets/css/director.css src/assets/css/scene-card.css` | 0 | 无 whitespace error；Git 仅提示现有 CRLF 工作树将来可能转 LF |
| `node C:\Users\ADMINI~1\AppData\Local\Temp\opencode\q20-visual-audit.js`（首次） | 1 | 当前 AppNav 不再渲染 `.nav-brand small/.dot`，临时检查脚本向 `getComputedStyle(null)` 传参而停止 |
| 同一视觉命令（第二次） | 1 | 当前 Prompt Builder 不再渲染 `.stage-placeholder-icon`，同样按准确 TypeError 停止 |
| 同一视觉命令（查证并改用临时语义夹具后） | 0 | 12 个页面组合、R18、skeleton、层级、曲线、16px 和 reduced-motion 断言全部通过 |

两次视觉脚本失败没有修改应用源码。按“连续两次失败即先查证”规则核对了 MDN `Window.getComputedStyle()` 文档：首参必须是实际 `Element`，伪元素通过第二参数读取。随后只调整工作区外的临时取证脚本，对当前不再实例化的选择器注入临时语义夹具。

参考：<https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle>

## 视觉与状态检查

检查矩阵：`/`、`/prompt-builder`、`/scene-explorer` × dark/light × `1440x960`/`390x844`，共 `12` 个组合。

| 检查项 | 结果 |
|---|---|
| 横向滚动 | 12/12 的 `scrollWidth - clientWidth = 0` |
| 页面运行时错误 | 12/12 非环境错误数组为空 |
| 品牌 caption | 临时夹具计算值：桌面 `8.25px`（`.55rem @ 15px`），手机 `7.7px`（`.55rem @ 14px`） |
| 品牌 mark | dark/light、桌面/手机均为 `18px x 18px`，四角依次 `7px 12px 7px 12px` |
| 主题图标 | 复用 `--fs-body-lg` 后桌面 `15px`、手机 `14px`，与根字号 `1rem` 一致 |
| 导演台装饰字 | 临时夹具计算值：桌面 `25.5px`、手机 `23.8px`，均为根字号的 `1.7rem` |
| iOS 输入约束 | `390x844` dark/light 下 `.story-input` 均为 `16px` |
| 舞台层级 | `::before` 底光 `z-index: 0`；扫光 `::after` 仍为 `z-index: 1` |
| stageSweep | dark/light、桌面/手机计算曲线均为 `cubic-bezier(0.4, 0, 0.2, 1)` |
| reduced-motion | 模拟 `prefers-reduced-motion: reduce` 后舞台 `::before`、`::after` 的 `animation-name` 均为 `none` |
| 场景卡层级 | 图片 `0`、skeleton `0`、指尖光斑 `1` 且 `pointer-events: none`、图区 scrim `1`、R18 badge `3` |
| R18 默认遮罩 | 4 个 scene-explorer 组合均为 `blur(16px) saturate(0.85)`，提示层 opacity `1` |
| R18 hover/focus 揭示 | 4 个组合均转为 `blur(0px) saturate(1)`，提示层 opacity `0` |
| skeleton 延迟加载注入 | pending：skeleton visible、image not ready；loaded：skeleton hidden、image ready；前后媒体层均为 `0` |

### 证据路径

- 汇总 JSON：`C:\Users\ADMINI~1\AppData\Local\Temp\opencode\q20-visual-20260809\results.json`
- 页面截图：同目录下 `desktop|phone` × `dark|light` × `home|director|scene-explorer.png`
- 导演舞台截图：同目录下 `*-director-stage.png`
- R18 模糊/揭示截图：同目录下 `*-scene-explorer-r18-blurred.png` 与 `*-scene-explorer-r18-revealed.png`
- skeleton 注入截图：`failure-skeleton-pending.png`、`failure-skeleton-loaded.png`
- 共生成 `26` 张 PNG，均位于工作区外，不增加仓库未跟踪文件。

## 未验证项与限制

- 当前实时导航使用 `.nav-logo`，不再实例化 `.nav-brand small` 或 `.nav-brand .dot`；当前导演台也不再实例化 `.stage-placeholder-icon`。因此这三项只能通过加载真实 CSS 后的临时 DOM 夹具核对计算样式，不能声称当前产品 DOM 中存在对应像素。未越界修改 Vue 来重新引入节点。
- `390x844` 检查运行于项目 Playwright 使用的本机 Edge/Chromium，而不是真实 iOS Safari；已验证防缩放关键计算字号为 `16px`，真实 Safari 聚焦缩放仍属于设备级未验证项。
- 截图和浏览器计算样式/状态断言已生成并通过；本会话没有可用的人工图片查看器，因此未做主观逐像素美术复核，SOL 可直接使用证据目录复审。
- stageSweep 通过临时添加 `.is-generating` 检查真实 CSS 计算结果，没有启动真实 SD 生成；本轮不涉及 GPU 或外部生成服务。

## 停止条件

未触发实现停止条件：无需修改 scanner、提高 budget、修改 PromptBuilderView、改变设计 token 数值或接管其他执行者文件。scanner 达到 `24` 后没有扩大范围或进行第二轮返工。

第一轮现已停止写入 `src/`，等待 SOL 复审签收。

## SOL 接入点

1. 复核三个 CSS diff 的 token 命名和层级角色，并重跑 scanner；预期仍为 `24 (budget 26)`。
2. 使用 `results.json` 和 26 张截图复审 dark/light、桌面/手机、R18 与 skeleton 证据。
3. 注意任务描述与当前实时 DOM 的漂移：品牌 caption/mark 和导演装饰字选择器目前没有生产节点。是否在后续删除死样式或恢复节点应由 SOL 另行定界，本轮不能修改 Vue 或扩大 CSS 清理。
4. B 已停止修改 `src/`；待 C 同样报告停止后，A 可按 §16.1 进入最终安装包冻结点。

## SOL 第二轮签收

日期：2026-08-09

- 复跑 `scan-style-literals.js --check`，结果保持 `24 / 26`，没有提高 budget、关闭规则或增加豁免。
- `test:style-debt`、repo hygiene、`typecheck:app`、最新 `build` 与完整 `npm run validate` 全部通过。
- SOL 人工复核工作区外 14 张代表性截图，覆盖 dark/light、桌面/手机、Home、Director、Scene Explorer、R18 模糊/揭示和 skeleton 状态，未发现布局或视觉回归。
- 三个 Q-20 CSS 文件保持 LF；设计 token 数值和 R18 默认行为未改变。

结论：`Q-20` **PASS，第二轮签收**。
