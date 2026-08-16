# 开发环境修复与 E2E 基线记录（2026-08-16）

> 本会话（UI 布局改造 + 粒子系统 + 性能优化）期间解决的 dev 环境疑难与 E2E 基线归因，留给后续会话查档，避免重复排查。

## 1. `npm run dev`（Vite dev server）整链挂掉：`/assets` 代理吞掉 `?import` 模块请求

- **现象**：dev 模式下任意路由白屏，控制台报 `Failed to load module script: … MIME type of "image/svg+xml"`，随后 `Vue Router warn: Unexpected error when starting the router: Failed to fetch dynamically imported module: …/AppLayout.vue`。生产构建不受影响。
- **根因**：SFC 模板里的 `<img src="/assets/logo.svg">`（`assets/` 在项目根，非 public/）会被 plugin-vue 改写成模块导入 `/assets/logo.svg?import`；而 vite.config 的 proxy 表把整个 `/assets` 转发给 Express（3000），Express 原样返回 svg → 浏览器对 module script 做 MIME 严格检查失败 → AppLayout 模块链断 → 整站不渲染。
- **修复**（`vite.config.ts`）：`/assets` 从 proxy 表移除，改为插件 `express-assets-conditional-proxy`：`/assets/` 且 URL 含 `import` 时交给 Vite 转换，其余才代理给 Express（角色立绘等大文件仍由 Express 提供）。
- **验证**：`curl :5173/assets/logo.svg` 走 Express（带 CSP 头）；浏览器模块链正常、三页截图渲染完整。

## 2. Vite dev server 崩溃：`EBUSY: watch runtime/state/managed-comfyui.pid`

- **现象**：`npx vite` 启动后数秒崩溃 `EBUSY: resource busy or locked, watch …runtime\state\managed-comfyui.pid`。
- **根因**：网关（server.js）随时写 `runtime/state/` 下的 pid/日志，Vite 全仓 watch 撞上文件锁。
- **修复**：`vite.config.ts` 的 `server.watch.ignored` 追加 `'**/runtime/**'`（与已忽略的 desktop-tauri 同类处理）。

## 3. Playwright 浏览器可执行文件缺失

- 本机未下载 ms-playwright 浏览器包；`playwright.config.ts` 已内置 Windows 候选路径解析（Edge 优先、Chrome 兜底），无需 `npx playwright install`。临时截图脚本直接 `chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })` 即可。

## 4. E2E 基线归因（2026-08-16，勿在下次会话重复追查）

对 2026-08-16 HEAD（5a177e3）+ 本会话改动各跑一轮定向 E2E，以下失败**在无本会话改动的基线上同样失败**，属既有问题：

| 用例 | 归因 |
|---|---|
| studio `director separates…` / flows 1 / flows 6 / studio 167 / studio 192 | `#promptMonitor` 的 `open` 属性与 `.preview-output` 元素缺失——5a177e3「Prompt 组装审计收口」重构了 PromptHealthPanel，测试断言未同步更新 |
| anima-quick `main generate…` | 文案断言 `/Anima 在线/`，现行代码显示「✓ Anima 已连接」 |
| studio `scene explorer collapses filters` | checkbox `element is not stable`（动画未沉降，环境相关） |
| studio `speech input: hold-talk…` / `scene manager loads…` / `home page stays inside the performance budget` / flows 3a / flows 4 / flows 4b | 均不在本次改动文件内，基线复现或属聊天/备份子系统 |

本会话改动面的规格全部通过：`archive-visual-language`（.cb-card 35）、`particle-narrative`、`anima-quick` popular 系列与 popular-scenes 深链、flows 大部分。flaky 提示：flows「Anima · 应用 job」与 anima-quick 两个深链用例在大批量并行下偶发超时，单独复跑即过。

## 5. 本地视觉审核通道备忘

`image-inspect`（CLIProxyAPI + gemini-3.7-flash-high）偶发上游 OAuth `EOF` 500，重试即恢复；对 64px 小尺寸元素（如头像缩略图）的"缺失/空白"判断不可靠，必须用 DOM/HTTP 探测复核（本次"角色头像大面积缺失"实为误报，全部 popular-*.png 均存在且 200）。
