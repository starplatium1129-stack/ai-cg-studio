# 「绘遇 · HUIYU」项目独立深度审查报告（双审综合复核版）

> 历史审计快照（2026-09-12 整理）：正文保留当时证据，旧结论和下一步不代表当前状态或授权。当前事实见 [办公机独立审计](office-independent-audit-2026-09-12.md)，尚未完成及暂停事项见 [未来规划](../../roadmap.md)。归档不表示其中问题全部解决。

> **审查基准**：基于提交 `1f5ad30 feat: finish office-side reliability and diagnostics` 后的全量最新工作区源码、配置、测试套件实际运行表现、构建产物，以及 `scripts/archive/huiyu-independent-audit-20260911/REPORT.md` 独立审查发现与复现脚本的对账核验。

---

## 一、 审查结论与总体评分

在 `1f5ad30` 提交中，团队成功收敛了**端到端测试时序竞态、子进程孤儿残留、手动入册归属与绘图路由体积**。但结合另一份独立审查提供的真实并发、跨域权限与子系统复现（F01—F07 脚本实测），项目在**跨标签页事务并发、自动保存归属校验、旧 SD 原生代理权限旁路、桌面解释器/软链接边界、浏览器 Permissions-Policy** 等深层场景下，仍存在被实机证据实锤的硬核缺陷。

### 综合评分看板

| 维度 | 评分 (满分 10) | 核心依据与最新现状 |
| :--- | :---: | :--- |
| **架构设计与职责划分** | **9.2** | Composables、Store、View 边界清晰；桌面桥与网关通过 Signal 实现可取消全链路 |
| **工程纪律与质量门禁** | **9.5** | 22 步并发门禁（结构模式 12.5s 全绿）、600 行单体红线守卫坚固、动效 Compositor 铁律自动化 |
| **安全机制与权限边界** | **7.8** | 主流程鉴权完备，但旧 SD 代理原生接口存在权限旁路（F03），桌面工具存在链接越界与解释器执行穿透（F04） |
| **数据一致性与存储事务** | **7.5** | 手动保存已加锁防串图，但跨标签页并发保存（F01）与自动保存乱序（F02）存在真实丢记录和误删临时缓冲 |
| **交互与硬件外设鲁棒性** | **8.0** | 响应头禁用麦克风致 Web 端按住说话不可用（F05），取消旧识别回调会污染新会话（F06），Windows 下 npm 启动 ENOENT（F07） |
| **测试完备性与可信度** | **8.8** | 修复了 E2E 动效抽样与用例间端口/存储竞争后，36 项关键端到端流程已 100% 稳定跑通；但缺少多页面并发与权限旁路测试 |
| **综合总体评分** | **8.2 / 10** | **高完成度、工匠级全栈项目；核心架构坚固，但作品保存事务与外围权限边界亟需打补丁** |

---

## 二、 最值得保留的设计（Design Highlights）

1. **`DeferredPanel.vue` 的状态保留延迟挂载模式**：
   - 区别于简单的 `v-if="open"`（关闭时组件销毁，丢失表单与草稿），`DeferredPanel` 采用 `active` 触发挂载，首次激活后持久保留在 DOM 中（`loaded.value = true`）。
   - 既实现了 `AnimaInpaintModal` 与 `BatchSceneDrawPanel` 首屏不打入主 Chunk，又保障了用户在切换交互过程中已配置的复杂参数不被重置。
2. **整棵进程树托管的跨平台生命周期（`server/tool-process.js`）**：
   - 统一收拢桌面端与命令行工具执行，封装 `runToolProcess`。接管 `AbortSignal`、执行超时和 `maxBuffer` 溢出；在触发取消时调用 `killProcessTree`，无论是 Windows 下的 `taskkill /T /F` 还是 Unix 下的负 PID 进程组 `SIGKILL`，均能确保整棵子进程树被彻底销毁，不留孤儿进程。
3. **基于字段白名单的脱敏诊断导出机制（`src/utils/diagnosticExport.ts`）**：
   - 不再依赖容易被特定命名或空格绕过的黑名单替换正则，直接在数据结构层定义导出白名单；
   - 仅记录固定端点类别、请求耗时、状态码及最近 200 条调用上下文，自动剥离任何 API 密钥、聊天历史、生成提示词与原始图像数据。
4. **端到端测试单 Worker 独占与端口收敛（`scripts/lib/e2e-ports.js`）**：
   - 将主流程回归、快捷生成与桌面代码测试归组为 `MOCK_SPECS`，由 Playwright 单 worker 独占运行，配合动态端口偏移 `AICS_E2E_PORT_OFFSET`。其余纯页面渲染和多端设备测试保留多核并发，兼顾了执行速度（全量 1.6 分钟）与零测试状态串扰。
5. **正交解耦的三引擎提示词编译器（`promptCompiler.ts` / `popularContent.ts`）**：
   - 针对 SD WebUI、Anima、Krea 2 按物理渲染特性独立编译；实现了身份词（Identity）、服装词（Outfit）与环境词（Environment）的精准剥离，避免传统 AI 常见的“身份词覆盖服装”、“环境词与蓝图冲突”。

---

## 三、 已证实问题清单 (Verified Issues - 经双审现场复现与对账)

### 【已证实 1】跨标签页保存发生丢失更新（F01）
- **严重级别**：`P1`（已证实真实并发丢数据）
- **触发条件**：同一浏览器来源下打开两个标签页或窗口，同时向作品历史入册。
- **实际影响**：两次保存均在界面提示成功，但底层持久化历史只留下其中一条；被覆盖条目的图片 Blob 变成无法访问的孤儿数据。
- **证据**：
  - `artworkRepository.ts:151` 的内存队列 `mutationTail` 属于单页面实例；`appendArtwork:484` 采用 `get → 修改数组 → set` 模式；
  - `useKVStore.ts:31` 的读事务与第 51 行的写事务是分离的两个事务，无法跨页面形成排他锁；
  - 实测运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-browser.cjs`，40 轮双页面并发写入实验中，有 38 轮出现覆盖丢失。
- **复现步骤**：
  在根目录运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-browser.cjs`。
- **根因**：
  多页面共享同一个 IndexedDB，但应用层的读取、修改、回写不是原子事务。两个页面读到相同的旧历史数组，各自 append 后，后写者覆盖先写者。
- **最小修复**：
  在单个 IndexedDB `readwrite` 事务中完成历史数组的读取、追加与回写，或引入 `navigator.locks.request('aics_artwork_mutation', ...)` 跨页面锁，覆盖追加、删除与恢复。
- **回归风险**：事务内不能包含等待 Blob 转换等慢速异步操作，需在事务外完成图片落盘，事务内仅原子更新索引数组。
- **应补测试**：双页面真实并发调用 `appendArtwork` 必须 100% 全部持久化。

---

### 【已证实 2】旧图自动入册完成会误标新成片并误删新图临时备份（F02）
- **严重级别**：`P1`（已证实异步竞态破坏状态与备份）
- **触发条件**：图 A 正在自动入册（后台等待 IndexedDB 落盘）；在此期间画布生成了新图 B 并暂存到临时缓冲；随后图 A 的入册操作成功完成。
- **实际影响**：画布上仍展示新图 B，但界面却把图 A 的历史 ID 标到图 B 头上（显示“已入册”假象）；同时 `releaseTemp()` 清空了图 B 的临时指针并删除了图 B 刚存下的临时图片 Blob。用户离页后图 B 彻底丢失。
- **证据**：
  - `useTempResult.ts:100`（手动保存虽然在 240 行加了 URL 校验，但自动保存路径未加防护）：
    `useTempResult.ts:137-138` 在 `await pb.commitHistoryEntry(...)` 成功后，无条件执行：
    ```typescript
    displayedResultHistoryId.value = saved.id
    releaseTemp()
    ```
  - `releaseTemp()` 直接调用 `clearTempResult()` 并将当前临时记录的图片物理删除（第 89 行 `imgDelete(record.imageId)`）；
  - 实测运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-autosave.cjs`，图 B 状态瞬间被篡改为 `resultArchived: true, historyId: 101`，且 `deletedImages` 准确包含了图 B 的临时 Blob ID。
- **复现步骤**：
  运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-autosave.cjs`。
- **根因**：
  `handleAnimaResult` 与 `handleSdResult` 内部的自动保存分支没有校验“保存完成时当前画布上是否依然是该结果”，盲目更新当前 UI 状态并清理当前临时缓冲。
- **最小修复**：
  参考手动保存 `saveCurrentResult` 的修法，在 `handleAnimaResult` 和 `handleSdResult` 中保存前记录不可变标识（如结果 URL 或生成的唯一 ID），写入成功后断言 `if (deps.displayResultUrl.value === currentUrl)` 才更新 `displayedResultHistoryId` 并调用 `releaseTemp()`。
- **回归风险**：极低。
- **应补测试**：自动保存慢速完成时不污染后续新结果的临时缓冲。

---

### 【已证实 3】旧 SD 代理原生接口绕过应用级权限与分级约束（F03）
- **严重级别**：`P1`（已证实鉴权/分级旁路）
- **触发条件**：持有有效分享 Token 的远程访客，直接通过 HTTP POST 访问 `/sdapi/v1/txt2img`、`/sdapi/v1/options` 或 `/sdapi/v1/interrupt`，而不走 `/api/generation/jobs`。
- **实际影响**：
  1. 远程访客可以绕过网关对成人内容的 Fail-Closed 拦截（应用层 `/api/generation/jobs` 会返回 403 `ADULT_REMOTE_NOT_ALLOWED`，而直调 `/sdapi/v1/txt2img` 直接返回 200 并出图）；
  2. 远程访客可以随意切换 SD 模型底模（`options`）或中断其他人的正在出图任务（`interrupt`），缺少归属和操作限制。
- **证据**：
  - `server.js:32-41` 将 `/sdapi/v1/txt2img`、`options`、`interrupt` 列入全局透传白名单；
  - `server.js:310-313` 仅对 `txt2img` 做了简单速率限制，随后直接挂载 `sdProxy`；没有经过 `assertAdultAllowed` 校验，也没有对 `options` 和 `interrupt` 施加 `localOnly` 保护；
  - 实测运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-proxy.cjs`：模拟远程 Token 请求下，应用端点返回 403，而 `/sdapi/v1/txt2img`、`/sdapi/v1/options`、`/sdapi/v1/interrupt` 均返回 200 成功，假上游成功收到 3 个写操作 POST 请求。
- **复现步骤**：
  运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-proxy.cjs`。
- **根因**：
  旧反向代理直接将原生端点暴露给所有持有 Token 的用户，未对写操作（POST）与管理操作区分本机还是远程。
- **最小修复**：
  在 `server.js` 中将 `/sdapi/v1/options` 和 `/sdapi/v1/interrupt` 加上 `security.localOnly` 中间件保护；对 `/sdapi/v1/txt2img` 增加 `assertAdultAllowed(req, req.body)` 门禁，或彻底限制远程用户只能使用 `/api/generation/jobs` 规范应用接口。
- **回归风险**：需确保前端已统一使用 `generationApi.ts`，不再有散落代码直接 POST `/sdapi/v1/*`。
- **应补测试**：测试远程身份调用原生端点时被严格 403 拒绝。

---

### 【已证实 4】桌面工具的路径限制无法防御目录联接与解释器穿透（F04）
- **严重级别**：`P1`（已证实沙箱/执行边界穿透）
- **触发条件**：AI 工作区内存在指向工作区外的软链接/目录联接（Junction），或者通过 `run_command` 调用白名单中的通用解释器（如 `node`、`python`）。
- **实际影响**：
  声称“只允许操作 AI 工作区内文件”的工具，可被用于读取、列出、甚至写入工作区外部的任意文件（如系统盘敏感文件），破坏了用户对“工作区边界”的信任。
- **证据**：
  - `routes/desktop-tools.js:107-130` 的 `isPathInsideWorkspace` 仅对字符串做词法比较（`resolved.startsWith(root)`），未调用 `fs.realpathSync` 解引用目录联接；
  - `desktop-tools.js:38` 白名单包含 `node`、`python`，`run_command` 仅校验了工作目录 `cwd`，但解释器可以接收任意外部文件参数（如 `node -e "fs.readFileSync('C:/...')"`）；
  - 实测运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-desktop.cjs`：`junctionRead` 与 `interpreterRead` 均成功返回 `ok: true`，成功读出了工作区外的测试私有标记。
- **复现步骤**：
  运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-desktop.cjs`。
- **根因**：
  纯路径字符串前缀匹配不能代表真实文件系统边界；启动目录（`cwd`）不限制进程后续的磁盘 I/O。
- **最小修复**：
  1. 对文件读写工具的目标路径调用 `fs.realpathSync` 获得真实物理路径，断言真实路径必须在工作区内；
  2. 将通用解释器（`node`/`python`）移出受限命令列表，或在 UI 上明确标为“完全系统访问权限（非工作区隔离）”。
- **回归风险**：需兼容大小写不敏感的 Windows 盘符。
- **应补测试**：指向工作区外的 Junction/Symlink 读取测试被强行拦截拒绝。

---

### 【已证实 5】语音输入被服务端 Permissions-Policy 错误禁用（F05）
- **严重级别**：`P2`（Web 端语音输入彻底失效）
- **触发条件**：在浏览器（包括 Chrome / Edge）中访问网关提供的 Web 端页面，尝试点击麦克风或按住说话。
- **实际影响**：即使用户在浏览器弹窗中明确点击了“允许使用麦克风”，调用 `navigator.mediaDevices.getUserMedia` 依然抛出 `NotAllowedError`，导致 Web 端的按住说话与语音聊天彻底不可用。
- **证据**：
  - `server/security.js:186` 设置了全局响应头：
    `res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');`
  - 策略中将 `microphone` 设为 `()`（即对所有来源全面禁用）；
  - 实测运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-browser.cjs`：在当前响应头下，即使给予假麦克风授权，获取音频依然报 `NotAllowedError`；而移除该响应头后立即变为 `allowed: true, acquired: true`。
- **复现步骤**：
  运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-browser.cjs` 查看 microphone 输出部分。
- **根因**：
  全局安全加固时一刀切禁用了麦克风，未与后续加入的实时语音交互功能对齐。
- **最小修复**：
  在 `server/security.js:186` 中将策略修改为 `microphone=(self)`，允许同源页面使用麦克风。
- **回归风险**：极低（仅允许同源页面请求录音权限，仍需浏览器和用户明确同意）。
- **应补测试**：在 E2E 中增加麦克风权限请求能成功取得 AudioTrack 的断言。

---

### 【已证实 6】取消的旧语音识别回调在延时后污染新会话（F06）
- **严重级别**：`P2`（语音交互状态机串话缺陷）
- **触发条件**：一段语音处于正在识别（`recognizing`）状态时被取消，用户立刻开始下一段录音，随后旧段的 ASR 网络请求返回成功。
- **实际影响**：旧语音的文本被错误注入当前输入框（可能触发误发送）；新会话的状态被旧回调强行改回 `idle`，打断当前录音。
- **证据**：
  - `src/composables/useVoiceInput.ts:108-117`：`recognizeWithAsr` 的 `.then` 回调只检查了一个全局布尔变量 `canceled`；
  - `useVoiceInput.ts:164`：每次调用 `start()` 会直接把 `canceled = false` 重新打开；虽然第 262 行递增了 `startToken`，但 `recognizeSegment` 根本没有绑定 `startToken`；
  - 实测运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-voice.cjs`：新会话启动后，旧回调依然触发，把状态由 `capturing` 改回 `idle`，并接收到了旧文本 `CANCELLED_SESSION_OLD_TRANSCRIPT`。
- **复现步骤**：
  运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-voice.cjs`。
- **根因**：
  取消状态仅用了单例布尔标记，缺乏带轮次 Session ID（Token）的归属校验。
- **最小修复**：
  每次识别分配递增的 `sessionToken`，在 `.then` / `.catch` 中校验 `if (thisSession !== currentSessionToken) return`。
- **回归风险**：低。
- **应补测试**：在取消后迟到的 ASR 响应不改变输入框文本和录音状态。

---

### 【已证实 7】Windows 桌面工具白名单中的 npm/npx 无法启动（F07）
- **严重级别**：`P2`（桌面工具执行失败）
- **触发条件**：在 Windows 平台上，桌面 LLM/桌宠通过 `run_command` 调用白名单中的 `npm` 或 `npx`。
- **实际影响**：直接返回 `spawn npm ENOENT` 报错，无法执行依赖管理或脚本运行。
- **证据**：
  - `routes/desktop-tools.js:38` 白名单显式允许 `npm` 和 `npx`；
  - `server/tool-process.js:54` 使用 `cp.spawn(command, args, { shell: false })` 执行裸命令；
  - 在 Windows 上，`npm` 和 `npx` 是 `.cmd` 批处理脚本，在 `shell: false` 且不带扩展名的情况下，Windows 系统的 `CreateProcess` 无法直接解析裸 `npm`，必然抛出 `ENOENT`；
  - 实测运行 `node scripts/archive/huiyu-independent-audit-20260911/repro-desktop.cjs`：`npmVersion` 和 `npxVersion` 均返回 `spawn npm/npx ENOENT`。
- **复现步骤**：
  在 Windows 机器上执行 `node scripts/archive/huiyu-independent-audit-20260911/repro-desktop.cjs`。
- **根因**：
  Windows 下执行批处理包装器与 `spawn(..., { shell: false })` 的系统底层特性冲突。
- **最小修复**：
  在 Windows 下将裸 `npm` / `npx` 解析为其真实的 `npm.cmd`，或者直接通过 `node path/to/npm-cli.js` 启动。
- **回归风险**：需防范路径中的空格。
- **应补测试**：在 Windows CI 上运行 `run_command: npm --version` 返回 0。

---

### 【已证实 8】默认全量门禁在无外部素材环境阻断 2 步（E01）
- **严重级别**：`P1`（开发环境开箱门禁阻断）
- **触发条件**：新环境克隆仓库，未手动配置 `AICS_CHARACTER_REF_ROOT` / `AI_WORKSPACE_ROOT` 环境变量时，直接运行默认的 `npm run check`。
- **实际影响**：22 步并发门禁中有 2 步阻断（`content-contracts`、`ref-urls`），退出码为 1。
- **证据**：
  1. 直接运行 `npm run check` $\rightarrow$ `门禁失败：2/22 步未通过`；
  2. 显式设置环境变量 `$env:AICS_REFERENCE_AUDIT_MODE = "structure"; npm run check` $\rightarrow$ `全部 22 步通过 · 12.5s`。
- **最小修复**：
  在 `run-check-parallel.js` 中将日常代码检查默认置为 structure 模式，物理核验留给专门的发布脚本。

---

## 四、 高概率风险清单 (High-Probability Risks)

1. **主绘图路由 Chunk 体积高度逼近门禁上限（95%~98.8%）**：
   `PromptBuilderView` JS 目前为 138.3/140 KiB（已达 98.8%），静态闭包 540/580 KiB，稍作修改即面临构建熔断，需将 `DirectorMaterialDrawer.vue` 进一步异步化。
2. **网关成人白名单与 158 位热门角色数据层存在判定断层**：
   `server/validation-core.js:20` 硬编码双女主白名单，而数据层 158 位热门角色均标为 `adult`。远程通道或桌面工具调用时，热门角色会被拦截。
3. **多个服务与组件有效行数紧贴 600 行单体红线**：
   `routes/maintenance.js` 正好 600 行，`routes/anima.js` 598 行，`SemanticParticleField.vue` 595 行，后续开发极易触发超标报警。

---

## 五、 不值得现在做的优化 (Anti-Patterns / Avoid Now)

1. **不要盲目放宽 600 行单体预算或 140 KiB 路由包体预算**：通过组件进一步异步化即可解决。
2. **不要把 1GB 的角色参考图放进 Git 仓库**：坚持外部数据目录和 JSON 索引懒加载的设计方向。
3. **不要试图通过全盘更换 IndexedDB 框架或服务端存储来解决 F01**：在现有仓储中实现单个事务读改写或跨页面锁即可彻底根治，重构数据库反而引入巨大迁移风险。
4. **不要为了解决 F07 把子进程改成 `shell: true`**：会破坏参数转义并带来 Windows 命令注入漏洞。

---

## 六、 推荐修复顺序与里程碑

```text
[Step 1] 修复作品保存事务与归属（优先保护用户数据）
         ├── F01: artworkRepository.ts 增加原子事务/跨页面排他锁，杜绝双标签页丢图。
         └── F02: useTempResult.ts 自动保存增加当前画布 URL 一致性校验，避免清空新图缓冲。
[Step 2] 收拢权限与隔离边界
         ├── F03: server.js 对 /sdapi/v1/options, interrupt 加 localOnly；txt2img 加成人判定。
         └── F04: desktop-tools.js 增加 fs.realpathSync 校验，通用解释器明确提权档位。
[Step 3] 恢复外设与平台兼容能力
         ├── F05: security.js 将 Permissions-Policy 改为 microphone=(self)。
         ├── F06: useVoiceInput.ts 识别回调增加 sessionToken 轮次校验。
         └── F07: desktop-tools.js 在 Windows 下正确解析 npm.cmd / npx.cmd。
[Step 4] 改善 CI 门禁与包体余量
         ├── E01: run-check-parallel.js 默认采用 structure 模式，物理核验归入专用脚本。
         └── 异步化 DirectorMaterialDrawer.vue，为绘图主路由释放至少 10 KiB 安全余量。
```

---

## 七、 如果只能做三件事，最该做什么？

1. **【彻底闭环作品入册的事务与归属安全性（F01 + F02）】**
   在 `artworkRepository.ts` 落地跨页面排他锁，并在 `useTempResult.ts` 的自动保存分支补全成片归属校验。**确保用户在任何多标签页并发、快速出图切换场景下，成片绝不丢失、状态绝不串图。**
2. **【消除外围接口的越权与边界穿透漏洞（F03 + F04）】**
   在网关层彻底阻断远程用户直调 SD 原生端点绕过分级门控的旁路，并在桌面工具中加入真实路径 `realpath` 解引用校验，让“权限隔离”成为真实承诺。
3. **【恢复 Web 语音采集并防御串话污染（F05 + F06）】**
   修复服务端响应头的 `microphone=(self)`，并在语音识别回调中绑定轮次 Token，让语音输入在真实浏览器环境下开箱即用且零状态串扰。
