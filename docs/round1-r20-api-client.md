# R-20 API Client 第一轮报告

日期：2026-08-09
任务依据：`docs/next-phase-task-assignments.md` §13、§16.1、§16.4
状态：第一轮实现停止写入，等待 SOL 复审与签收

## 范围与边界

本轮建立普通 JSON API 的单一浏览器传输层，并只迁移 §16.4 指定的 control、training、maintenance、home-hero 与 Companion event poll 调用。未迁移 streaming chat、SD、TTS、ASR、Anima job polling、静态数据或二进制链路。

未修改 `routes/**`、`server/**`、`services/**`、`src/live2d/**`、`src/storage/**`、`desktop-tauri/**`、`package.json`、workflow 或 Q-20 独占 CSS。工作树在本轮开始前已有大量并行修改；这些修改均保留，没有回退、格式化或暂存。

`src/views/CompanionView.vue` 在本轮开始前已有 Native Live2D backend、165 FPS 和窗口 bounds 订阅等并行修改。本轮在该文件中只增加 API 模块导入、typed event poll、独立 `AbortController` 和卸载中止；其他差异不是 R-20 交付内容。

## 修改文件

新增：

- `src/api/client.ts`
- `src/api/controlApi.ts`
- `src/api/trainingApi.ts`
- `src/api/maintenanceApi.ts`
- `scripts/tests/test-api-client.js`
- `docs/round1-r20-api-client.md`

最小修改：

- `src/composables/useControlActions.ts`
- `src/composables/useControlStatus.ts`
- `src/composables/useSceneShowcaseUpload.ts`
- `src/stores/trainingStore.ts`
- `src/types/api.ts`
- `src/views/CompanionView.vue`
- `src/views/HomeView.vue`
- `src/views/SceneManagerView.vue`
- `scripts/tests/quality-test-inventory.js`：只在 `unit` 分层加入一次 `test-api-client.js`。该 inventory 文件本身来自当前并行 Q-10 工作树，R-20 不主张其余内容的所有权。

## 已实现契约

### Transport

- `ApiClientError.kind` 可判别为 `http`、`timeout`、`aborted`、`network`、`invalid-response`。
- 错误保留 `status`、`code`、`detail`、`retryAfterSeconds` 和原始对象 `responseBody`。
- HTTP 非 2xx 一律失败；错误文案优先使用信封 `error`，再附 `detail`。
- 2xx 的显式 `ok:false` 默认失败。只有 `controlApi.getStatus()` 显式接受完整的 `200 + ok:false + degraded:true`。
- 成功对象不要求 `ok:true`，兼容真实 `/api/logs` 成功响应。
- 空 body、非 JSON、截断 JSON、数组顶层和 validator 拒绝的对象统一抛 `invalid-response`，不泄漏 `SyntaxError`。
- 每个请求独立创建 controller 和 timeout；caller abort 与 timeout 分开分类；结束后清除 timer 和 caller listener。
- JSON body 统一序列化并合并 headers；没有 body 的 GET 不增加 `Content-Type`。
- `createApiClient(fetchImplementation)` 支持 Node 测试注入；`src/api/**` 无显式 `any`。

### API 模块

- `controlApi.ts` 集中 status、share-link、logs、config、preference、service、mode、start、stop、diagnostics endpoint。
- `trainingApi.ts` 集中 overview、jobs、start、stop、config、增量 logs，并保留 job id 的 `encodeURIComponent`。
- `maintenanceApi.ts` 集中 build-web、scenes、run、showcase、home-hero get/reset/save，并通过 `maintenanceFailure()` 保留 rollback 与 recovery 元数据。
- timeout 统一声明在 API 模块：control `10s/30s`；training `10s/30s`；maintenance query `10s`、upload/build `120s`、run `130s`、scenes `390s`。`scenes` 高于服务端真实 `360s` 上限。

### 调用方行为

- `useControlStatus.ts` 为 status、logs、share-link 分别维护 latest-request controller；新同类请求只中止旧同类请求；`stopPolling()` 中止三类在途请求。
- status degraded 继续渲染可用字段并显示错误 toast；logs/share-link 的保护路由失败不会保留旧 token，logs 的 403/421 会清空旧日志。
- `useControlActions.ts` 删除本地 `postControl`。`doStart()` 直接按 `saveConfig -> start` 顺序执行，配置失败不会调用 start；preference 失败仍回滚 checkbox；diagnostics Blob 与 build-web 生命周期保持。
- `trainingStore.ts` 删除本地 transport helper，保留 `refreshPromise` 去重、silent refresh、cursor/version/reset、`180000` 字符上限和 action `finally` 清理。
- SceneManager、showcase/home-hero 和 Control build-web 使用 maintenance API；501 code/detail 及 rollback/recovery 元数据可由 UI 读取。
- `HomeView.vue` 的 home-hero 获取失败继续静默使用 bundled fallback。
- Companion event poll 使用 typed `ControlStatus` 与 `TrainingJob[]`；status 失败时不以 training 单独结果生成服务事件；保留 `eventPolling` 防重入和 `viewAlive` 检查；卸载时中止 status/training 请求且不再更新任务栏或提醒。

## 失败注入

`scripts/tests/test-api-client.js` 最终为 18 个纯 Node 测试，覆盖：

- 200 JSON success 且无 `ok` 字段。
- 400、409、501、504 信封中的 status、error、detail、code、retry 映射。
- 200 `ok:false` 默认拒绝及 status degraded 唯一例外。
- 真实 logs 无 success envelope 的响应形状。
- 非 JSON、空 body、截断 JSON、数组顶层、错误对象形状。
- fetch reject 的 network 分类。
- timeout 与 caller abort 区分。
- 两个并发请求只中止其中一个。
- JSON header 合并及 GET 不增加 content type。
- caller listener 与 timeout 清理。
- training `JOB_BUSY` 的 409/code/detail 保留。
- maintenance 501 `DESKTOP_MAINTENANCE_UNAVAILABLE` 与 rollback/dataIntegrity/recovery 保留。
- config 保存失败后 start endpoint 未调用。
- `stopPolling()` 中止隔离的 status/logs 请求，同类新请求中止旧请求，403/421 清理旧保护数据。
- scoped 文件无裸 `fetch`，Companion 保留 signal、viewAlive 与 unmount abort 接线。
- API 模块 timeout 符合 §16.4 基线。

## 验收命令

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `node --test scripts/tests/test-api-client.js` | 0 | 最终复跑 18 passed，0 failed。 |
| `npm run test:check` | 1 | quality inventory 2 passed；随后 repo hygiene 因 Q-20 独占 CSS 的 238 个 CRLF 报错失败。首条为 `worktree:src/assets/css/design-system.css:55:31: unexpected CRLF line ending; expected LF`。R-20 未修改这些 CSS。 |
| `npm run typecheck:app` | 0 | 通过；最终 API 调整后已复跑。 |
| `npm run build` | 0 | 通过；最终 API 调整后已复跑。 |
| `npm run test:control-failures` | 0 | 最终复跑 2 passed，覆盖 timeout、config rollback、voice weights、tunnel exit。 |
| `npm run test:training` | 0 | 1 passed。 |
| `npm run test:maintenance` | 0 | 4 passed。 |
| `node scripts/tests/test-gateway-contract.js` | 0 | 1 passed，含 desktop maintenance 501 契约。 |
| `npx playwright test tests/e2e/studio.spec.ts tests/e2e/flows.spec.ts --grep "control\|training\|maintenance\|companion" --workers=3` | 0 | 最终复跑 2 passed；当前标题只匹配 control panel 与 desktop companion。 |
| `npx playwright test tests/e2e/flows.spec.ts --grep "场景保存" --workers=3` | 0 | 最终 2 passed。 |
| `npx playwright test tests/e2e/a11y-device.spec.ts --grep "training workbench" --workers=3` | 0 | 4 passed。 |
| `npx playwright test tests/e2e/studio.spec.ts --grep "home page stays" --workers=3` | 0 | 1 passed。 |
| `npx playwright test tests/e2e/studio.spec.ts --grep "scene manager exposes" --workers=3` | 0 | 1 passed。 |
| Scoped ESLint | 0 | 0 errors；仅既有 `SceneManagerView.vue:262:56` 的 `vue/no-v-html` warning。 |
| Scoped `git diff --check` | 0 | 通过。 |

### 已确认的非本轮阻断

`node --test scripts/tests/test-resource-scheduling.js` 退出码 1。旧源码哨兵仍断言 `useControlActions.ts` 必须直接包含字符串 `/api/preference`：

```text
[resource] control panel must make voice auto-start an explicit preference
```

R-20 已按要求把 endpoint 收口到 `controlApi.ts`，所以该断言与新架构冲突。`scripts/tests/test-resource-scheduling.js` 不在 R-20 独占文件清单，本轮没有越界修改；SOL 应将断言改为检查 `controlApi.savePreference()` 接线或同时读取 `controlApi.ts`，不能把 endpoint 字符串塞回 composable 迁就源码测试。

辅助 `rg` 命令因本机没有可执行的 `rg` 而失败；后续使用仓库内容搜索工具完成同一检查，不影响验收结论。

## 踩坑与修复

场景保存定向 E2E 首次失败时，页面显示：

```text
保存未完成：服务器返回了无效响应：响应对象不符合预期格式
```

测试断言为 `Expected pattern: not /dirty/`，实际 class 为 `maintenance-state dirty`。原因是 E2E 的合法成功桩没有可选 `message` 字段，而初版 validator 错误地把它当作必填。修复为只验证真实必填字段；第二次执行仍命中旧 `dist`，在 `npm run build` 后同一命令 2/2 通过。该过程确认浏览器回归必须使用本轮重建产物，不能把 stale dist 当源码结果。

## 裸 Fetch 搜索

- §16.4 指定的七个 migrated 调用文件中，`fetch(` 为 0；该断言也在 `test-api-client.js` 中执行。
- 全 `src/**/*.{ts,vue}` 搜索当前有 39 个匹配，其中一个是 `src/api/client.ts` 的预期底层 `globalThis.fetch`。
- 其余匹配属于本轮明确排除或未分配的 Anima、streaming chat/provider、SD、TTS/翻译、ASR、Live2D status、静态 scene/showcase 数据和 data URL 解码路径。
- `src/composables/useCharacterRoomSession.ts` 仍有 `/api/status` 与 `/api/mode` 两个普通 JSON 调用。该文件不在 R-20 独占清单，本轮没有并发越界；SOL 应决定后续是否迁移，不能把它误算成已完成范围。

## 未验证项与残余风险

- `npm run test:check` 未全绿，唯一当前失败阶段是 Q-20 CSS CRLF hygiene；需由对应所有者或 SOL 处理后重跑。
- 完整 `unit` 分层会被上述旧 `test-resource-scheduling.js` 源码哨兵阻断；需由 SOL 更新测试契约后重跑。
- 指定 Playwright grep 当前只发现 2 个标题，没有直接命中 training/maintenance；已用场景保存、training workbench、home 和 scene manager 定向用例补充，但未运行全量 Playwright。
- 未运行 `npm run validate`，因为已知 `test:check` 与旧 resource sentinel 会稳定失败，且本项目规则禁止无目的全量运行。
- Companion unmount cancellation 有源码约束测试和 desktop companion E2E；没有为该大型 SFC 建立独立挂载测试 harness。
- 本轮没有后端、streaming 或外部服务阻断，也没有外部媒体证据目录。

## SOL 接入点

1. 复审 `src/api/client.ts` 的错误分类、body 解析、AbortSignal listener/timer 清理和并发隔离。
2. 复审 `controlApi.getStatus()` 的 degraded 唯一例外，确认其他 2xx `ok:false` 仍失败。
3. 复审 status/log/share latest-request 竞态、403/421 旧敏感数据清理，以及 Companion unmount 后不更新。
4. 更新 `scripts/tests/test-resource-scheduling.js` 的旧 endpoint 字符串断言，再运行完整 unit 分层。
5. 等 Q-20 处理三个独占 CSS 的 LF 后重跑 `npm run test:check`；随后按 §16.5 使用冻结源码运行最终 validate。
6. 决定 `useCharacterRoomSession.ts` 的两个普通 JSON endpoint 是否进入 API Client 后续阶段；本轮不要追溯性扩大完成范围。
7. D-10 可把本报告视为 C 已停止写入的信号；最终安装包仍必须等待 B、C 均报告停止后由冻结源码生成。

## SOL 第二轮签收

日期：2026-08-09

SOL 直接完成以下修复：

- 删除 JSON client 的通用显式失败逃生口；`200 + ok:false` 默认全部失败，只有 `controlApi.getStatus()` 可接收字段完整的 degraded status。
- degraded status 的嵌套 `operation` 和 `scripts` 现在也做真实形状校验，空对象不能再冒充完整状态。
- Companion event poll 在 status 失败或 degraded 时不再单独使用 training 结果生成错误服务事件，卸载时中止在途请求。
- `useCharacterRoomSession.ts` 的 `/api/status` 与 `/api/mode` 普通 JSON 调用迁入 `controlApi`，请求使用独立 controller，并在卸载时中止。
- 更新旧 `test-resource-scheduling.js` endpoint 哨兵；指定迁移文件中的裸 `fetch(` 维持为 0。
- 清理本轮触及文件的 BOM、CRLF 和尾随空格，没有增加 explicit `any`。

最终验证：

- `node --test scripts/tests/test-api-client.js`：19/19 PASS。
- `npm run validate`：PASS；check、184 项 unit 和全部 contract 全绿。
- `npm run build`、`npm run validate:desktop`、控制/训练/维护/网关定向契约：PASS。
- 指定 Playwright grep：2/2 PASS；补充明确相关标题后 8/8 PASS，覆盖 control、character room、Companion、scene manager 与 maintenance save/failure。

结论：`R-20` **PASS，第二轮签收**。
