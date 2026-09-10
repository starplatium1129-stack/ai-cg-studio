# 请求层修复与门禁复核（2026-09-10，办公机）

> 执行环境：办公机（Windows，Node v22.22.2，满足 `engines >=22.18`）。代码基线 `21ce17f`，本轮改动：请求层（R1／R2／R3／O1／O2）、CI 并发（O4）、`DATA_VERSION` 同步、按用户决定回滚的 35 个定稿场景字段，以及本记录。
> 依据：[项目评价与优化／修复清单](project-review-checklist-2026-09-10.md) 的 R1／R2／R3／O1／O2／O4；机器复现原始证据见[请求层复现记录](../../evidence/project-review-2026-09-10.json)。
> 本记录区分“已修复”“已复现但未修复”“本机不可验”，不把本机静默失败当作通过。

## 1. 本次完成项

| ID | 状态 | 改动位置 | 完成依据 |
| --- | --- | --- | --- |
| R1 | 已修复 | `src/api/client.ts` 写入代际（`generations`） | 写成功后推进代际；旧代读取不回填缓存，新代读取不搭乘旧代 inflight；POST 与 DELETE 均覆盖 |
| R2 | 已修复 | `client.ts` `applyResponseContract` | 传输层不再执行调用者 `validate`；fresh／cached／shared 三条路径各自校验，消费者互不连带 |
| R3 | 已修复 | `client.ts` `cloneResponse` | 参与缓存或共享的 GET 结果交给消费者前深拷贝；写请求结果仍为独享副本，不付拷贝成本 |
| O1 | 已实现 | `client.ts` `cachePolicy: 'default' \| 'refresh' \| 'bypass'` | 明确 HTTP `cache:'no-store'` 与内存 TTL 相互独立；`refresh` 强制新传输并回填，`bypass` 不读不写不登记 |
| O2 | 已补齐 | `src/api/client.spec.ts` | 新增 11 个边界断言（共 18 条）；旧实现 9 条失败，修复后全部通过 |
| O4 | 已配置 | `.github/workflows/quality.yml` | 普通验证按 `github.ref` 收敛并发，tag 推送不套用取消策略；与 `windows-native.yml` 既有写法一致 |
| 定稿漂移 | 已回滚 | `data/scenes/*.json` 6 个分片 + `src/stores/sceneStore.ts` | 按用户决定回滚 35 个定稿场景的 6 个受保护字段至基线，`pinned gate OK: 100`（见 4.1） |

未放宽任何既有预算或门禁阈值，未改动蓝图、服装与模型参数。

## 2. 复现 → 失败断言 → 修复 → 回归

| 步骤 | 命令 | 结果 |
| --- | --- | --- |
| 失败断言（旧实现） | `npx vitest run src/api/client.spec.ts` | **9 failed / 9 passed**，与 R1／R2／R3／O1 分组一一对应 |
| 修复后回归 | 同上 | **18 passed** |
| 类型 | `npm run typecheck:app` | 通过（无输出即无错） |
| 静态风格 | `npx eslint src/api/client.ts src/api/client.spec.ts` | 通过 |
| 全量前端单测 | gate `vitest --coverage` 阶段 | 通过 8.6s（含新增用例，未放宽覆盖率阈值） |
| 行数红线 | gate `monolith-budget` 阶段 | 通过（`client.ts` 413 行） |

旧实现下失败断言的原始报错（摘录）：

- `promise resolved "{ ok: true, value: 1 }" instead of rejecting` —— 缓存命中与共享搭车都跳过了调用者 `validate`（R2）。
- `expected 'rider-edited' to be 'original'` —— 搭车者改嵌套字段污染了发起者的结果（R3）。
- `expected [ [Function] ] to have a length of 2 but got 1` —— 写后读取仍搭乘写前 inflight（R1）。
- `expected { ok: true, n: 1 } to deeply equal { ok: true, n: 2 }` —— 旧 GET 回填缓存后读到写前值（R1）；`bypass`／`refresh` 无强制刷新语义（O1）。

保留回归：既有 7 条用例（去重、搭车者 abort 只取消自己、取消后替换不被旧 finally 破坏、失败重发、TTL 命中与过期、未声明 TTL 不缓存、写后失效）全部继续通过。

## 3. 顺带发现并修复：`DATA_VERSION` 与数据产物失同步

核验 `DATA_VERSION` 时发现：最后一次同步是 `c6181e7`（2026-09-09），其后 9 个数据提交（`e69263a`…`7eeb6a2`、合并 `576e0e1`）改动了 `data/scenes`、`data/blueprints`、`data/popular` 源文件，却没有重建产物或同步版本号。

- 现象：本机 `npm run check` 报 `Scene/Popular/Blueprint build is stale`；`nene-core.*`、`shared.json` 的预压缩件与源不一致。
- 重建后：三个 `--check` 全部 `current`（302 场景／158 热门角色／1,681 蓝图），产物哈希变为 `2303042092`，而已提交值为 `2735481506`（对应合并前的旧数据）。
- 处理：同步 `src/stores/sceneStore.ts` 的一行常量；重建产物属被忽略的生成物，不入库。
- 影响：不改会导致客户端按 `?v=` immutable 缓存继续读取旧数据，且任何重新生成产物（新克隆／主力机）的机器上 `data:validate` 都会失败。
- 数据规模与 [项目状态](../../project-status.md) 一致（302／158／1,681／160），不需要额外改数。

## 4. 已复现但本次未修复（需用户决策或主力机）

### 4.1 定稿保护基线漂移 35/100 —— 已按用户决定回滚

发现时状态：`node scripts/maintenance/pin-scene-prompts.js --check` → `pinned gate FAILED: 35/100`，`sc033`、`sc052`、`sc142` 等 35 条的 `prompt`／`negative`／`animaCaption` 与基线不一致。

- 漂移位于**已提交的 `data/scenes/*.json` 源文件**中，与产物重建、与请求层改动无关：`sc033` 基线为人工确认过的 `standing in apartment genkan holding birthday gift box…`，源文件被 2026-09-10 批次改写为 `winter_night, medium_shot, cinematic_lighting, depth_of_field, @rella` 形式（分片文件由 `36483d7`／`558cf76`／`9e0d7f9`／`9c3a6e8` 等批次提交触碰）。
- 与 [AGENTS.md](../../../AGENTS.md) 红线冲突：`data/prompt-pinned-scenes.json` 为字节级保护基线，批量任务应跳过。

用户决定「回退原来的」后执行的回滚：

| 项目 | 结果 |
| --- | --- |
| 回滚依据 | `data/prompt-pinned-scenes.json` 基线（只恢复 `prompt`／`negative`／`animaCaption`／`recommendedSize`／`rating`／`mature` 六个受保护字段，不动其他元数据） |
| 回滚范围 | 35 个场景，6 个分片（`nene-core.1/2`、`natsume-core.1/2`、`nene-after-story.1`、`shared`），diff 为 72 增 72 删 |
| 定稿门禁 | `pinned gate OK: 100 个定稿场景与基线逐字节一致`；定稿契约测试 2/2 通过 |
| 产物 | `scenes.json` 302 场景重建，`DATA_VERSION` 由 `2303042092` 变为 `2880234034`（随数据提交），`precompress` 306 文件 |

**为什么不用工具自带的 `--apply`**：本机是**浅克隆**（`.git/shallow` = `cd2221c`，本地仅 98 个提交），`PINNED_SOURCES` 里 19 个定点源提交**全部不存在**，`--report`／`--apply`／`--capture` 一律报 `unknown revision or path not in the working tree`。`--check` 只读基线与分片，因此仍可用。从基线文件回滚与 `--apply` 的目标状态等价，且对 PNG 基准场景同样成立（工具出于“工作区现状即权威”会跳过 `sc033`／`sc234`，而这两个场景的权威内容正是基线里记录的 PNG 值）。若后续需要 `--report` 的逐条来源比对或 `--capture`，须先 `git fetch --unshallow`。

**保留标记说明**：回滚只动六个受保护字段，`auditRevision: codex-scene-prompt-audit-2026-09-10` 等批次簿记字段仍留在这些场景上（全分片普遍存在，非本次回滚目标）。如需让审计标记与字段内容完全一致，须单独决定。

### 4.2 其余本机可见失败（与本次改动无关）

| 现象 | 判定 |
| --- | --- |
| `unit` 套件 15/444 失败（`test-popular-content`、`test-showcase-candidate-contract` 等） | 数据内容契约：如 `krista_lenz.outfit.coronation_winter_wall` 环境词 `winter` 泄漏、`kitagawa_marin` 缺安全默认服装蓝图；来自合并批次的已提交数据，非请求层 |
| `content-contracts` 2 项 `pollution`（krista_lenz／murasame 服装环境词） | 同上，同一根因 |
| `test-control-failure-contract.js` 子用例 6／7 失败（Stop 外部启动的 ComfyUI／reForge） | 本机 PowerShell 环境：`scripts/lib/managed-comfyui.ps1:92` 的 `& taskkill.exe /PID … /T /F \| Out-Null` 报 `无法在管道中激活文档: C:\Windows\system32\taskkill.exe`（`CantActivateDocumentInPipeline`）。同一测试在 21:05 的 gate 里通过（✔ 5.8s），21:31 起可稳定复现（5 过 / 2 挂，开关沙箱结果相同），与数据回滚、请求层改动无关；需在主力机复验后再决定是否加固该脚本 |
| 参考图 2,534/2,534 缺失、`ref-urls` 失败、`test-chat.js` 曾 3 分钟超时 | 本机环境：无素材根目录；办公机沿用 `AICS_REFERENCE_AUDIT_MODE=structure`（与[9-09 记录](engineering-debt-2026-09-09.md)边界一致）；`test-chat.js` 在回滚后复跑为 693ms 通过，先前超时属环境波动 |
| `npm run build` 在默认沙箱下被批量删除保护拦截（`dist/_app` 736 项） | 工具链保护，非项目缺陷；受控重跑后构建与打包预算通过 |

### 4.3 未启动项

V1（浏览器 CSP 复验）、C1（提示词逐条对账与人工看图）、C2（批次与审核状态对账）、V2／V3（默认素材模式与真机验收）、O3（按需加载）、O5／O6（首次出图旅程与诊断包）均未在本轮启动：分别需要浏览器上下文、人工看图、主力机素材与真机环境。O3 只记录本轮实测余量（见第 5 节），不放宽预算。

## 5. 验收限制与本轮实测值

- `AICS_REFERENCE_AUDIT_MODE=structure npm run wf -- gate:full --all`（21:05 首轮）结果：`check` 21/22 通过（仅 `content-contracts` 的 2 项数据污染失败）；`typecheck`、`typecheck:app`、`lint:js`、`vitest`、`monolith-budget`、`ux-regressions`、`animation`／`contrast`／`a11y` 均通过；`unit` 15 项、`contract` 2 项失败见 4.2；生产构建与打包预算通过。
- 回滚后复核（分项重跑）：`pinned gate OK: 100`；定稿契约 2/2 通过；`npm run check` 22 步中 20 步通过，失败为 `content-contracts`（2 项污染）与 `ref-urls`（本机无素材根目录，结构模式可过）；`npx vitest run --coverage` 通过；`npm run build` 与打包预算通过；契约套件 24 过 / 1 挂（唯一失败为 4.2 的 `test-control-failure-contract`），`unit` 仍为 15 项且清单与回滚前一致（回滚未引入新失败）。
- 打包预算实测：`PromptBuilderView` JS 138.6 KiB / 140.0 KiB（余量约 1.4 KiB，与上一轮报告一致）、CSS 111.5 / 115.0、路由静态闭包 538.1 / 580.0、入口闭包 359.6 / 390.0。仅 4 项 >90% 警告，未放宽门槛（O3 依据）。
- 未做：浏览器内复验聊天配置“保存／清除后仍显示旧配置”的页面症状（R1 只到模块与用例层）；未在真实 GitHub 运行上观察 O4 的并发取消效果（本机无 `gh`，配置文件无法自证生效）；未跑 Playwright 与真机桌面验收；未对回滚后的 35 个场景做真实出图核验（本轮是恢复人工基线，不是新增视觉验收）。
- 本轮所有改动均在本机完成并推送（`21ce17f..26f4dd8` 加回滚提交）；未执行、失败或需用户操作的步骤已在上表列出，不沿用历史 PASS。
