# 项目协作要求

## 图片审核

- 直接使用当前模型的视觉能力或本地图片查看工具检查图片。
- 不调用 `vision.js`、千问 VL 或旧的 `Codex-vision-skill`。
- 场景样张、模型对比图和训练素材必须由当前模型逐张观察后再给出结论，不能只根据文件名、标签或自动评分判断质量。
- 图片审核至少检查：人物身份与官方特征、脸和装饰、服装、肢体结构、双人特征串位、构图、光照，以及画面是否符合场景故事。

## 质量门槛

- 改完跑相关测试；触及公共契约时跑 `npm run validate`（含 design lint、runtime build、typecheck、场景校验与脚本测试）。
- 浏览器冒烟：`npm run test:e2e`（本机 Chrome/Edge 可作 Playwright 可执行文件）。
- 运行时 TS 模块：改 `services/*.ts` 后执行 `npm run build:runtime`，提交 emit 的 `.js` / `.d.ts`。
- Vue SPA：改 `src/` 下文件后执行 `npm run typecheck:app` 确认无类型错误，再执行 `npm run build` 确认构建通过。

### ⚠ 门槛本身的已知盲区（修完 A-1 前不要相信绿灯）

`npm run validate` 全绿并不代表样式/安全无回归，因为部分门槛在检查「应用根本不加载的东西」：

| 门槛 | 实际读取 | 应用真正加载 |
|---|---|---|
| `scripts/maintenance/check-contrast.js:13` | `css/design-system.css` | `src/assets/css/design-system.css` |
| `scripts/maintenance/scan-style-literals.js:18` | `css/` 目录 | `src/assets/css/` + SFC `<style>` |
| `scripts/tests/test-style-debt.js:76` | `css/` 目录 | 同上 |
| `scripts/maintenance/lint-colors.js:47` | `tools` / `docs` / `css` | `src/` |

- `css/director.css`、`css/scene-card.css`、`css/mood.css`、`css/viewer.css` **没有任何页面加载**（只有 11 个 `docs/*.html` 用到 `css/design-system.css` + `css/docs.css`）。
- `server/diagnostics.js`（`redactText`/`redactConfig`/`readLogTail`）**只有 `scripts/tests/test-security.js` 引用**，生产路由完全没接。
- `test-security.js` 测的是 `server/security.js` 里正确的那份 `isDirectLocalRequest`，而 bug 在 `routes/control.js` 自己复制的弱版本里 —— 测好的副本等于没测。

**新增测试时：断言路由的真实输出，不要断言 helper。**

## 架构现状（已完成的迁移）

前端已从 Express + 原生 HTML 完整迁移为 **Vue 3 + Vite + TypeScript + Pinia**。

### src/ 目录结构

```
src/
├── config/
│   ├── characters.ts        角色常量（宁宁/夏目）：名字、图片、声线
│   └── promptConstants.ts   导演台静态定义：情绪/镜头/光照/构图/色彩情调
├── utils/
│   ├── stream.ts            流式工具：NDJSON 解析、句子缓冲、WAV 修复
│   └── sceneUX.ts           场景纯函数：搜索评分、偏好推断、最近记录
│   ├── promptPolicy.ts      prompt 清洗/合并/适配/分析
│   ├── sceneInference.ts    场景 → 光照/镜头/构图 推断
│   ├── sdError.ts           SD 报错分类 + 恢复动作
│   └── stream.ts            流式工具：NDJSON 解析、句子缓冲、WAV 修复
├── stores/
│   ├── sceneStore.ts        Pinia：scenes.json + curation.json 单例缓存（⚠ 当前 0 消费者，见 C-1）
│   └── promptBuilderStore.ts  Pinia：导演台全局状态
├── composables/
│   ├── useChatStorage.ts    聊天历史持久化（localStorage）
│   ├── useLive2D.ts         Live2D 控制器
│   ├── useVoice.ts          TTS 语音合成 + 口型同步
│   ├── useSDGenerate.ts     SD WebUI 生成 API 封装
│   ├── useSDQueue.ts        出图队列（≤8 任务、暂停/恢复、失败保留）
│   ├── useBackup.ts         备份/恢复（history/projects/images → JSON）
│   ├── useKVStore.ts        IndexedDB KV 存储
│   ├── useImageStore.ts     IndexedDB 图片 Blob 存储
│   ├── useToast.ts          全局提示（⚠ 当前 0 视图使用，见 C-4）
│   ├── useTheme.ts          明暗主题
│   └── useScrollReveal.ts   滚动入场（已接 prefers-reduced-motion）
├── components/              AppLayout / AppNav / SceneCard / AppThemeToggle /
│                            AppToast / AppSkeleton / HistoryPanel
├── views/                   每路由一个 .vue，全部懒加载
└── assets/css/              设计系统 Token、组件样式（应用真正加载的那一份）
```

### 已删除的旧文件

以下文件已在重构过程中删除，不要重新创建：

- `tools/chat/` — 已迁移为 `src/composables/useLive2D.ts` + `useVoice.ts` + `useChatStorage.ts`
- `tools/prompt-builder/` — 已迁移为 `src/stores/promptBuilderStore.ts` + 相关 composables
- `tools/image-store.js` — 已迁移为 `src/composables/useKVStore.ts` + `useImageStore.ts`
- `tools/scene-ux.js` — 已迁移为 `src/utils/sceneUX.ts`
- `tools/scene-card.js` — 已迁移为 `src/components/SceneCard.vue`
- `tools/*.html`（所有旧 HTML 页面）— 已被 `src/views/*.vue` 替代
- `tools/*.js`（旧页面控制器）— 已被 Vue 视图和 composables 替代

### index.html

当前 `index.html` 是 Vite SPA 入口，不含任何全局 `<script>` 注入。不要向其中添加 `<script src="/tools/...">` 或其他全局脚本标签。

### 全局变量说明

以下全局变量已不再从 `index.html` 注入，对应功能已迁移：

| 原全局变量 | 现在的位置 |
|---|---|
| `window.AICKVStore` | `src/composables/useKVStore.ts` |
| `window.AICGImageStore` | `src/composables/useImageStore.ts` |
| `window.AICSceneUX` | `src/utils/sceneUX.ts` |
| `window.createSceneCard` | `src/components/SceneCard.vue` |

## 待办 / Future Work

### 已有基础（勿当空白重做）

- **Vue 3 SPA** — `src/` 完整实现；所有页面均已迁移，TypeScript 检查 + Vite build 通过
- **Pinia 状态管理** — `sceneStore`（scenes + curation 单例）、`promptBuilderStore`（导演台）
- **composables** — useVoice / useLive2D / useChatStorage / useSDGenerate / useKVStore / useImageStore
- **sceneUX 纯函数** — tier / matchesSearch / searchScore / buildPreferenceProfile / readRecent 等，已从全局迁入 `src/utils/sceneUX.ts`
- **校验入口** — `npm run validate` 串联 design lint、`build:runtime`、typecheck、场景/内容契约与大量 `scripts/tests/*`
- **契约类型** — `types/*` + 渐进运行时：`control-operation` / `serial-queue` / `http-client` / `tts-service` / `ollama-service` / `translation-service` / `live2d-service`
- **E2E** — Playwright：`tests/e2e/`，`npm run test:e2e`
- **CI** — `.github/workflows/quality.yml`：push/PR 跑 `npm run validate` + Playwright e2e

### 仍待推进

- **测试加深** — E2E 测试用例需更新以覆盖新 Vue SPA 路由与交互（旧版 DOM id 已变化）
- **CI 硬化** — e2e 可拆夜间若 push 过慢
- **tools/ 遗留清理** — `tools/*.js`（`prompt-policy.js` 292 行、`sd-api.js` 421 行、`icon-system.js`、`data-backup.js`）**已无 `src/` 消费者**，功能已分别迁入 `src/utils/promptPolicy.ts`、`useSDGenerate.ts`、`useBackup.ts`。当前只剩 `docs/*.html` 与 `scripts/maintenance/generate-dual-showcase-candidates.js` 引用。迁移成本已变成「删除 + 改 docs」，见 D-2。

### Vue 重构后仍缺失的功能（按优先级）

> 来源：对比重构前 `81d21ff^:tools/` 与当前 `src/`。已完成项见下方"已恢复"。

#### ~~P0 — 出图队列 + 错误恢复~~ ✅ 已完成

`src/composables/useSDQueue.ts`（97 行）+ `src/utils/sdError.ts`（91 行）已实现并在 `PromptBuilderView.vue:979` 接入。

#### ~~P1 — 备份/恢复 UI~~ ✅ 已完成

`src/composables/useBackup.ts`（280 行）已实现并在 `PromptBuilderView.vue:963` 接入（未拆 `BackupOverlay.vue`，弹层内联在视图里）。
~~导演台：评分弹窗~~ — 用户确认鸡肋，不做。

#### P2 — 高频交互细节

- **导演台：Prompt policy 深化** — `src/utils/promptPolicy.ts` 已有基础 `sanitize/merge/adapt`；可继续迁 `inferStory`、`analyzeParts`（token 健康条）、`dedupeParts`、`applyFraming`、`sceneSupportsCharacter`、`enrichDualPrompt`、`recommendAspect`，并加违规高亮。
- **导演台：First-creation coach** — welcome→ready→complete 三阶段 + 首次成功横幅 + 入场签名场景按钮。参考 `81d21ff^:tools/prompt-builder/app.js:337-388`。

#### P3 — 场景管理二级功能

- **场景管理：标签库 CRUD** — 当前 Vue 版只能看不能改。需新增/编辑/删除标签、改名级联、权重、分页。参考 `81d21ff^:tools/scene-manager.js:363-428`。
- **场景管理：样张管理 tab** — 样张预览/上传/替换（JPEG 归一化、15MB/60MP 上限），POST `/api/maintenance/showcase`。参考 `81d21ff^:tools/scene-manager.js:124-184`。
- **场景管理：重复检测 tab** — 按关键词分组检测疑似重复场景。参考 `81d21ff^:tools/scene-manager.js:332-356`。
- **场景管理：维护工具结果细化** — 当前已接 `/api/maintenance/run`，但输出展示较粗，可补 lint/validate/classify/optimize 各自的结构化报告。

## 全面审计待修清单（2026-07-27 审计）

> 全项目审计结论。审计时 `npm run validate` + `typecheck:app` 全绿 —— 以下问题全部藏在绿灯底下。
> 每项都带 `file:line`。修完一项就在这里打勾并写一行结论。
> 标 ✅ 的是本轮已修完的，标 ⬜ 的待做。

### A — 门槛自身失效（先修这个，否则下面的修完也守不住）

- ✅ **A-1 四个样式门槛在审计一棵应用不加载的 CSS 树**。已新增 `scripts/maintenance/style-sources.js` 作为唯一取样口，四个门槛统一从它取文件；对比度改为核算 4 种表面 × 2 主题 + 3:1 非文字档；内联样式扫描扩到 SFC 模板；`lint-colors` 扫 `src/` 且 `--check` 真的会失败（已进 validate）。
  改法：把 `check-contrast.js:13`、`scan-style-literals.js:18`、`test-style-debt.js:76`、`lint-colors.js:47` 指向 `src/assets/css/**` + SFC `<style>` + 模板 `style=`/`:style=`；预算按实测重设（字面量 8→11、内联样式违规 0→19）；`lint-colors.js` 的 `ALLOWED`（110 条）里恰好收录了 `HomeView.vue:303`、`CharacterView.vue:111` 的硬编码渐变，需剪掉而不是继续加。
- ✅ **A-2 `server/diagnostics.js` 曾是死代码**。已接入生产路由：`/api/logs` 走 `redactText` + `readLogTail(f, 64KB)`（不再整份读入），`/api/diagnostics` 走 `redactConfig` + `summarizeToken`。
- ✅ **A-3 `test-security.js` 测的是正确的那份副本**。已补：`safeLocalUrl` / `hostAllowed` 单元用例，`localOnly` 对 `x-forwarded-for`、`cf-connecting-ip`、伪造 `req.ip` 三种形状的断言，以及「`control.js` 与 `maintenance.js` 必须复用 `server/security` 同一函数引用」的恒等断言。
  另新增 **`scripts/tests/test-gateway-contract.js`**（已进 `npm run validate` 与 `npm run test:security`）：起真网关发真 HTTP 请求，断言路由输出而非 helper 返回值。覆盖 S-1/S-2/S-3/S-4/B-3/B-4。

### S — 安全（P0，全部可从公网分享链接触达）

> 威胁模型：默认仅本机，但 `server.js:161` `startTunnel` 会把整个网关暴露到公网，且分享链接是主动发给朋友的。

- ✅ **S-1 `localOnly` 信 `req.ip`，隧道一开等于全员本机**。`routes/control.js:135-138` 只比对 `req.ip`，cloudflared 从 127.0.0.1 连入 → 所有隧道请求都算本机。`routes/maintenance.js:114-118` 的版本是对的（查 `cf-connecting-ip`/`x-forwarded-for`/`forwarded`）。
  已实测：带 `x-forwarded-for: 9.9.9.9` 的 `POST /api/config` → `200` 且落盘；受正确保护的 `POST /api/maintenance/run` → `403`。
  影响：分享链接持有者可开关公网隧道、持久改写三个上游 host、spawn PowerShell 启停 SD WebUI / GPT-SoVITS（`:382`/`:420`/`:483`）。
  改法：删本地副本，`require('../server/security').isDirectLocalRequest`；并把 `localOnly` 提成 `server/security.js` 的共享导出，避免再次漂移。
- ✅ **S-2 WebSocket upgrade 绕过鉴权，且一个未鉴权包能弄死进程**。`server.js:122` `ws:true` 让 http-proxy-middleware 直接订阅 server 的 `upgrade` 事件，完全不过 Express 中间件栈 → `security.tokenAuth`（`server.js:45`）失效。随后 `server.js:133-137` 的错误处理假定拿到的是 Express response，而 upgrade 失败时第三参是裸 `net.Socket` → `TypeError: res.status is not a function` → 进程退出。
  已实测：SD 未启动时，单个未鉴权 `Upgrade: websocket` 请求即打死网关。而 SD 未启动是常态（要从面板启）。
  改法：错误处理按形状分支（`typeof res.status === 'function'` 否则 `res.destroy()`）；`ws:false` + 在 `startGateway` 自己接 `server.on('upgrade')`，先鉴权再 `middleware.upgrade()`。
- ✅ **S-3 上游 host 未校验 → 现在是 SSRF，重启后变持久开放代理**。`routes/control.js:352` 直接 `String(body.sdHost).trim()` 落盘。`STARTUP.md:107` 写了「只接受本机 http://127.0.0.1:端口」但无人执行。
  已实测：把 `sdHost` 设为云元数据地址后 `/api/sd-status` 确实去请求了它。更糟：值会持久化，而 `server.js:123` 在构造代理时读 `config.SD_HOST` → 下次重启后 `/sdapi/*` 成为通用开放代理，超时 20 分钟。
  改法：加 `safeLocalUrl()`（仅 http、hostname 属于 loopback 集合），在 `control.js:352` 与 `server/config.js:58-62` 两处都校验；代理改用 `router` 选项按请求解析 target。
- ✅ **S-4 `/api/status` 泄露原始 token；无 Host 校验 → DNS rebinding**。`routes/control.js:294` 把 `shareLink`（含 `?token=`）放进响应，而 `/api/status`（`:271`）没有 `localOnly`。叠加 `server/security.js:54` 对任何 loopback socket 无条件放行、且不校验 `Host`/`Origin`：用户访问的任意网页可 rebind 到 127.0.0.1 → `POST /api/start` 开隧道 → 读 `shareLink` 拿 token → 获得持久远程访问。
  改法：`tokenAuth` 前加 Host 白名单（`127.0.0.1[:port]` / `localhost[:port]` / 当前活跃 `*.trycloudflare.com`，其余 421）；`shareLink` 移到单独的 `isDirectLocalRequest` 保护端点；`/api/status` 与 `/api/logs` 补 `localOnly`。
- ✅ **S-5 `/sdapi` 全量透传 + 无限流**。已改 8 端点白名单（其余 JSON 404）+ `SerialQueue` 加 `maxPending`（默认 16，超出回 503）。限流（token bucket）仍待做。原文：`server.js:126-128` 整段转发 `/sdapi`/`/controlnet`/`/adetailer`，SD API 可换模型、装了扩展还能碰文件系统。`services/serial-queue.ts:35` 无深度上限（实测连塞 500 个任务全部接受）；`/api/chat`、`/api/tts`、`/api/translate` 无限流。
  改法：只放行 `useSDGenerate.ts` 真正用到的 6 个端点（`sd-models`/`samplers`/`schedulers`/`progress`/`txt2img`/`interrupt`），其余 404；`SerialQueue` 加 `maxPending` → 503；GPU 路由加 token bucket。
- ✅ **S-6 500 响应回带绝对路径**。`server.js:157` `detail:error.message`。与 B-3 一起修。

### B — 后端正确性（P1）

- ✅ **B-1 `spawnSync` 在请求路径上，最坏冻结网关 6 分钟**。已改 `spawn` + await（新增 `runNodeScript`，含 64KB 输出上限与超时），保存路由改 async。原文：`routes/maintenance.js:164`（及 `:408`）在 POST handler 内同步 spawn 三个子进程，各 `timeout:120000`。期间整个事件循环停摆 —— SD 代理、进行中的 `/api/chat` NDJSON 流全部卡死。当前实测约 105ms，属潜伏而非常态，但超时值就是契约。
  改法：改 `spawn` + await，进度走已有的 `control-operation` 机制。
- ✅ **B-2 `/api/status` 每次都 spawn 一个 2.2 秒的 PowerShell，而前端 3 秒轮询一次**。已加 15s TTL 缓存 + in-flight 去重，并真正实现 `fresh=1`（这个参数以前解析了却从未被使用）。服务启停 / 模式切换处传 `force=true` 主动作废缓存。
  实测：冷启 547ms → 温轮询 **2–3ms**；三个并发 `fresh=1` 合并为一次 spawn（总 3422ms 而非 ×3）。
- ✅ **B-3 错误处理丢弃 `err.status`，404 与 413 都变成 500**。`server.js:154` 只特判 JSON 解析失败。已实测：`GET /scene-showcase/images/sc999.jpg` → `500` 且 `detail` 含完整主机路径；60KB body → `500 "request entity too large"` 而非 413。
- ✅ **B-4 SPA catch-all 把未知 API 路由吞成 `200 text/html`**。`server.js:143-147` 匹配 `*`，而 `/api/does-not-exist` 没有扩展名 → 实测返回 SPA 外壳且状态 200。改法：`if (req.path.startsWith('/api/')) return next()`。
- ✅ **B-5 运行时改 host 到不了 SD 代理**。`control.js:352` 改的是 `config.SD_HOST`，但 `server.js:123` 在构造时就把 `target` 定住了 → 面板报成功，`/sdapi/*` 仍打旧 host 直到重启。改法：用代理的 `router` 选项按请求解析。
- ⬜ **B-6 其余**：
  - ✅ 被 abort 的任务仍占 FIFO 位：`SerialQueue.run` 加了 `signal` 选项，排队期间断开即出队；chat 与 tts 两条路径都已接上（含回归用例）。
  - ✅ 翻译服务：就绪轮询 handle 提为 `readyPoll` 并在 `close()` 里清掉；exit handler 不再提前置空 `starting`（那会让并发 `ensureServer` 再 spawn 一个 python）。
  - ✅ `runScriptAsync` 超时改走新的 `killProcessTree`（Windows 上 `taskkill /T /F`），不再孤立 SD/语音进程；stdout/stderr 加 64KB 上限。
  - ✅ 隧道子进程补 `exit`/`error` 监听：cloudflared 挂掉即清空 `tunnelProcess` 与 URL，后续启动不再是静默 no-op。
  - ✅ 已在 `startGateway` 补 `unhandledRejection` / `uncaughtException` 兜底。
  - ✅ 两处回滚 catch 改走 `attemptRollback`：回滚失败时返回 500 + `dataIntegrity:"INCONSISTENT"` + 恢复指引，不再假装只是"保存失败"。其余空 catch 仍在。
  - ✅ `/api/logs` 改走 `readLogTail`（只 seek 尾部 64KB）。`gateway.log` 轮转仍待做。
  - API 有 4 种错误信封；`/api/status` 探测失败回 500，而三个同族 `*-status` 回 200 + `online:false`。

### C — 前端正确性（P2，静默数据丢失）

- ✅ **C-1 项目存储 key 不匹配**。已统一为 `aics_pb_projects`（`GalleryView.vue` + `useBackup.ts` + `promptBuilderStore.ts` 共用），并加旧键 `aics_projects` 的一次性迁移，避免用户已建项目凭空消失。
- ✅ **C-2 `pb.projects` 永远为空**。已补 `loadProjects()`，在 `loadHistory()` 里调用；同时统一作品册的 `title` 与导演台的 `name` 字段差异。
- ✅ **C-3 `useSceneStore` 是死代码**。已扩成六个数据文件的唯一加载口（带 `response.ok`、单版本号、`reload()`），7 处重复 fetch 全部改走它，`src/` 现在 0 处直接 `fetch('/data/...')`。原文：全 `src/` 仅 `sceneStore.ts:15` 自身定义一处匹配。为「单例缓存 scenes.json」而建的 store 零消费者，同时 7 处独立 fetch 该文件、用 4 种不同 cache key —— 包括 `SceneManagerView.vue:833` 的 `?v=' + Date.now()`，保证每次进页面都全量传 230KB。
- ✅ **C-4 blob URL 泄漏 + 无 unmount 清理**。已修四处：`useSDGenerate` 覆盖前 revoke + 新增 `dispose()`（`onUnmounted` 自动挂载，停轮询 + abort in-flight）；`HomeView` 卸载释放全部封面 URL 并加 `unmounted` 竞态标记；`PromptBuilderView` 卸载调 `clearVoiceAudio()`；`GalleryView` 查看器翻页即释放上一张（`releaseViewerUrl`，并避开仍被缩略图引用的 URL）。
- ✅ **C-5 无 404 路由、无滚动恢复**。已加 `:pathMatch(.*)*` → 新建 `src/views/NotFoundView.vue`，以及 `scrollBehavior`（savedPosition / hash 锚点 / 回顶）。
- ⬜ **C-6 `PromptBuilderView.vue` 1243 行装了六个子系统**：prompt 管线（`:761-857`）、配音工作室（`:630-666`/`:1135-1269`）、出图队列（`:979-1007`）、错误恢复（`:1021-1060`）、备份 UI（`:962-977`）、深链恢复（`:1283-1322`）。`SceneManagerView.vue`（877）与 `ControlView.vue`（870）紧随其后。
- ⬜ **C-7 类型纪律**：`src/` 有 213 处 `any`、48 处 `as any`、56 处裸 `fetch(`。`SceneManagerView.vue:318-340` 把整个领域模型声明为 `any[]`/`any`；`ControlView.vue:376` 把 `/api/status` 契约整体当 `any`。多数 `fetch` 不查 `response.ok`（`sceneStore.ts:27`、`promptBuilderStore.ts:249-254` 等 10 处）→ HTML 错误页会被当数据解析。
- ✅ **C-8 四套并存的 toast，全局那套零使用**。`ColorScriptView` 与 `ScenarioView` 已改用 `useToast`（前者的 `.cs-toast` 无样式 bug 随之消失）；`AppToast` 同时修掉嵌套 live region 与「关闭动作挂在不可聚焦 div 上」。`ControlView` 自建那套仍在。原文：`useToast` + `AppToast.vue` 已挂在 `App.vue:7` 却无视图 import；另有 `promptBuilderStore.flash()`、`ControlView.vue:254` 自建、`ScenarioView.vue:194-203` 与 `ColorScriptView.vue:151-156` 直接 `document.createElement` 内联样式。其中 `ColorScriptView` 用的 `.cs-toast` **在任何样式表里都没有定义** —— 那个 toast 现在渲染为页面底部的无样式裸文本，是功能 bug 不只是债。

### P — 性能

> bundle 本身是健康的：入口 107.4KB（gzip 42.5KB）、14 条路由全懒加载、925KB 的 pixi/Cubism 块已正确隔离在 `/chat` 之后。问题全在资源与数据。

- ⬜ **P-1 42.85MB 的 Live2D 贴图**。`assets/live2d/nene/textures/texture_00.png`，8192×8192 RGBA，PNG 不可 gzip → 首次进 `/chat` 连 `nene.moc3` 共 45.35MB 实打实走网络。改法：重导为 4096² WebP 或 KTX2（约 2–4MB）；并把下载改为用户显式开启 Live2D 后才触发，而非 `onMounted`。
- ✅ **P-2 `scenes.json` 被 fetch 7 次**（892.5KB / gzip 229.7KB / 297 条，4 种 cache key）。随 C-3 修完：现在整个会话只取一次。
- ✅ **P-3 带 hash 的产物没有 `immutable`**。`dist/_app` 已改 `max-age=31536000, immutable`，`dist/index.html` 保持 `no-cache`（已加路由级断言）。原文：`server.js:95` 给 `dist/` 一律 `max-age=86400` → 34 个 JS/CSS 文件永远每天回验一次。改法：`dist/_app` → `max-age=31536000, immutable`；仅 `dist/index.html` 保持 `no-cache`。
- ✅ **P-4 字体在打包后的 CSS 里 `@import`**。已移到 `index.html` 的 `preconnect` + `link`。字重保留 5 个：`src/` 里 500 用了 16 次、700 用了 49 次，砍掉会让浏览器合成假粗体。原文：`src/assets/css/design-system.css:8`，已确认它出现在构建产物 CSS 的第 1 个字符 → HTML→CSS→CSS→字体 三段串行 RTT，且请求了 5 个 CJK 字重。改法：改 `index.html` 里 `preconnect` + `link`，字重砍到 2–3 个。
- ✅ **P-5 110KB 路由专用 CSS 全局加载**。`director.css` / `chat.css` 已移入各自视图 → 全局 CSS **139KB → 45.6KB（−67%）**。原文：`src/main.ts:5-10` 无条件 import `director.css`（91.6KB）+ `chat.css`（18.6KB），占 139KB 全局包的 79%。改法：把这两个 import 移进各自视图，`cssCodeSplit` 已开启会自动切块。
- ✅ **P-6 首屏大图**。已补 width/height（实测 1024×1344，消除布局抖动）+ 首图 fetchpriority=high。WebP/srcss 转码仍待做（需要图像工具）。原文：`HomeView.vue:33-34` 两张 1024×1344 JPEG 合计 787KB，无 `width`/`height`/`srcset`、未用 WebP（而立绘已经在用 WebP）。
- ✅ **P-7 无 Brotli**。新增 scripts/maintenance/precompress.js（构建后预压 .br/.gz，已挂 build:all）+ 服务端优先发预压产物。实测 scenes.json 913KB → 233KB gzip → **155KB brotli**；全量 3412KB → 733KB。原文：实测 `scenes.json` 229.7 → **155.2KB**（−32%）。改法：`vite-plugin-compression` 预压 + 静态预压产物服务。
- ⬜ **P-8 42.85MB 贴图已入 git 版本库**（`git ls-files` 已确认）。每次 clone 都要付，且已在历史里。改法：Git LFS 或改为外部下载步骤。**重写历史是破坏性操作，需先征得确认。**
- ✅ **P-9 搜索每次击键全量重算**。已加 150ms debounce（清空立即生效）+ 评分预计算 Map，比较器不再重复调 `uxSearchScore`。原文：`SceneExplorerView.vue:278` 在比较器里每次比较调 `uxSearchScore` 两次 ≈ 每次重算 4900 次评分；全 `src/` 无任何 debounce。改法：150ms debounce + 预计算评分 Map。
- ✅ **P-10 890KB 构建输入被公开托管**。`/data` 改成 6 文件白名单，`data/scenes/*.json` 与 `history/projects/prompts.json` 等个人内容一并不再外露（已加路由级断言）。原文：`data/scenes/*.json` 是 `build-scenes.js` 的输入，被 `server.js:105` 暴露，无客户端读取。改法：移出托管根目录。
- ✅ **P-11 `vite.config.ts` 构建配置**。已补 `manualChunks`（vendor 分块：入口 **107KB → 7.9KB** + vendor 103KB，应用改动不再让框架缓存失效）、`build.target` 与 `package.json` 的 `browserslist`。analyzer 与图片管线仍待做。

### AX — 无障碍

- ✅ **AX-1 全站没有 `<main>` 地标**。`AppLayout.vue` 的 `<div id="main">` 已改真 `<main>`（并把 `outline:none` 换成 `:focus-visible` 可见落点）；`/control` 挂在 `AppLayout` 之外，已自备 `.skip-link` + `<main id="control-main">`。
- ✅ **AX-2 51 个表单控件没有程序化标签**。`SceneManagerView` 的 22 字段编辑器改为 `<label class="form-group">` 包裹控件（`.form-group` 本来就是 `display:grid`，布局不变且无需发明 22 个 id），内层文案改 `<span class="field-label">`；必填字段补 `required` + `aria-invalid`，`formHint` 挂 `role="alert"` 并被 `aria-describedby` 引用。`ControlView` 四个声线输入补 `sr-only` label，公网暴露开关补 `aria-labelledby`。原文：全应用只有 **3 个 `for=`**。最集中处 `SceneManagerView.vue:245-281` —— 22 字段场景编辑器，每个 `<label>` 都是无 `for` 的兄弟节点。`ControlView.vue:172-178` 已有 `id`，只缺 `for`。
- ✅ **AX-3 6 个弹层里 5 个没有焦点管理**。已抽出 `src/composables/useFocusTrap.ts`（焦点存取 + 真 Tab 陷阱 + Escape + 滚动锁），`GalleryView` 改为复用它（删掉手写那份），场景编辑器与备份恢复弹层接上并补 `role="dialog"`/`aria-modal`，`ShowcaseView` 改用 `showModal()` 拿真模态。`body.overlay-open` 提到设计系统（原先写在 GalleryView 的 scoped 块里，根本作用不到 body）。原文：`GalleryView.vue:325-395` 是正确实现（存取焦点、真 Tab 陷阱、Escape、滚动锁），其余五个都没复用。`SceneManagerView.vue:241`（破坏性场景编辑器）只有 `@click.self`。`ShowcaseView.vue:90` 用 `<dialog :open>` 而非 `showModal()` → **非模态**：无 top layer、无 inert 背景、无焦点约束。
  改法：把 Gallery 的陷阱抽成 `useFocusTrap()`；`design-system.css:858-885` 已有 `.overlay`/`.modal-card` 原语，四个视图仍在手搓。
- ✅ **AX-4 主路径键盘不可达**。剧本卡与角色简介展开已改真 `<button>`（后者补 `aria-expanded`），`AppNav` 品牌改真 `RouterLink`。原文：`ScenarioView.vue:14` 剧本卡是 `<div @click>`，无 role/tabindex/keydown，而它是进入剧本查看器的唯一入口。`CharacterView.vue:38` 简介展开同样只有 click，且内容确实被 CSS 截断。`AppNav.vue:4` 把品牌做成 `<div role="link" tabindex="0">` 而非 `RouterLink`。
- ✅ **AX-5 `aria-current` 全站 0 处**。主/次导航都已补；顺带删掉 `<summary aria-label>`（它会盖掉可见文字「更多」，违反 SC 2.5.3）。原文：`AppNav.vue:21` 仅用 class 标记当前路由。
- ⬜ **AX-6 其余**：
  - ✅ `prefers-color-scheme`：`useTheme` 已导出 `preferredTheme()`，首访跟随系统，未显式选过主题时随系统实时切换；`index.html` 补 `<meta name="color-scheme">`。
  - ✅ 根字号：`15px` → `93.75%`（移动端 `14px` → `87.5%`），视觉不变但恢复跟随浏览器字号设置（SC 1.4.4）。
  - ✅ reduced-motion：全局块补 `transition-duration`；`useLive2D.setPaused` 现在判 `prefers-reduced-motion` 并停 pixi ticker（CSS 关不掉 WebGL）。
  - ✅ 公网暴露开关（`role="switch"`）已补 `aria-labelledby`（随 AX-2 一起修）。
  - `CharacterView.vue:9` 与 `ChatView.vue:18` 声明了 `role="tablist"` 却无 `tabpanel`/`aria-controls`/方向键 —— 半成品模式比纯按钮更糟。
  - `ChatView.vue:69` 把 `aria-live="polite"` 加在整个消息历史上 → 流式输出每个 token 都重播报。
  - **mood 卡文字是潜伏的 1.38:1**：`mood.css:22` 设 `color: var(--mood-color)`，目前只因 `director.css:944` 泄漏出一条未作用域限定的覆盖才看起来正常。正确作用域化 `director.css` 会立刻让标题掉到 1.38:1。`design-system.css:58-63` 已记录该陷阱并提供 `--mood-*-text`。
  - **对比度门槛只测了 `--bg-deep` 一种背景**：合成到 `--bg-elevated` 上时 `--text-muted` 为 **4.03**、`--danger` 为 **3.79**，均不达标，且二者确实用在该表面上。

### D — CSS 架构 / 技术债

- ⬜ **D-1 `director.css` 有 571 个未作用域选择器、`chat.css` 94 个**，两者都全局 import → 与视图 `<style>` 产生 **107 处类名冲突**（`.scene-search` 被定义三次）。scoped 样式靠 `[data-v-*]` 权重胜出，所以现在是静默的 —— 直到有人把 `director.css` 正确作用域化，两个视图会当场丢掉 focus 样式。`src/` 有 57 个 `!important`，多数在跟这个泄漏对抗。
- ✅ **D-2 删掉 `css/` 里 4 个孤儿文件**（连 `css/design-system.css` 共 5 个：它是 `src/` 那份的分叉副本，已漂移 20 行）。`docs/*.html` 改指唯一实现，服务端只暴露那一个文件。`css/` 现在只剩 `docs.css`。`tools/*.js` 清理仍待做。原文：（`director.css`/`scene-card.css`/`mood.css`/`viewer.css`，无人加载），并让 `docs/*.html` 指向真正的设计系统。同时清理 `tools/*.js`（见「仍待推进」）。

#### 已恢复（2026-07-27 本轮）

- 场景管理：持久化保存（POST /api/maintenance/scenes）、完整编辑表单（22 字段+策展层级+推荐理由+LoRA 自动绑定）、增删复制、脏态、beforeunload、导出、导入、维护工具
- 导演台：草稿持久化 saveDraft/restoreDraft、深链恢复（?scene/?regen/?variant/?mood/?char/?resume/?quick）、场景智能推断（自动预填光照/镜头/构图/情调/推荐尺寸）、作品历史 IndexedDB 落盘（commitHistoryEntry + saveHistory 改为抓 blob 入库）
- 美化：聊天样式恢复（chat.css 重新接入）、导演台 body→.pb 选择器对齐、Vue 类名兼容、布局语义修正（重复 main→article、skip-link、nav-logo）、首页场景卡改用 SceneCard、全局背景光斑收敛
- Bug：样张查看器改为 fixed 居中
- **控制面板：恢复旧 control-server 的服务启停能力**（接进 Vue SPA，不是独立 3001 进程）
  - 后端 `routes/control.js`：`/api/service/webui|voice|ollama`、`/api/mode`（绘图优先/聊天优先）、operation 进度、Ollama 显存卸载、脚本探测
  - 前端 `ControlView.vue`：SD/语音 启停按钮、Ollama 卸载、模式切换卡、操作进度条、公网通道与网关职责分离
  - 依赖脚本（仍在）：`scripts/runtime/managed-webui.ps1`、`../AI/Voice/Start-Voice.ps1`、`Stop-Voice.ps1`
- **连接修复：补 `/api/sd-status`** — 导演台原先请求不存在接口导致永远“未连接”；现已实现，并回退探测 `/sdapi`
- **导演台：配音工作室** — 中栏 voice-studio（字幕/翻译/系统试听/AI 生成/WAV 下载），接 `/api/tts-status|translate|tts|voice/prepare`
- **导演台：历史面板 UI** — `HistoryPanel.vue`（缩略图/seed/继续/复制/删除）
- **导演台：Seed lock + 负面词编辑** — 出图参数区可锁 seed、复用上次 seed、自定义负面文本；`promptPolicy` 基础接入
- **出图参数对齐旧 sd-api** — 默认 CFG 5.5、负面默认开启、hires denoise 0.35 / Latent、scheduler 可选、`hr_second_pass_steps`
- **控制面板 UI 对齐作品册气质** — 宽壳大标题、状态墙卡片、克制分区、sticky 工具条、旧版 status-grid / service-row / access-card 信息架构
- **画风页** — 多色条 mood 卡、完整 COLOR_MOODS、进入绘制 CTA 与使用提示
