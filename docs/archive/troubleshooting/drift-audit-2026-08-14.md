# 文档漂移审计报告（2026-08-14）

> 方法：5 个审计 agent 并行，逐份 read 文档全文，对其中可验证断言（API 路由、文件路径、npm 脚本、存储键、组件名、端口、模型名、行为描述、状态声明）grep/read 对照当前 HEAD 代码与 git 历史验证；纯只读，未改任何文件。
> 范围：docs/ 全部 31 个文件（19 md + 12 html/js）。
> 结果：**18 条漂移（高 0 / 中 11 / 低 7）**。严重度：高=照文档操作会出错；中=引用已改名/迁移/状态过时；低=措辞/计数/格式差异。

---

## 中（11 条）— 需要处理

### 1. `docs/model-prompting-and-parameters-guide.md` L27-29（A 组）
- **声称**：Anima 推荐参数表采样器 `er_sde`、调度器 `sgm_uniform`、步数 30。
- **实际**：生产参数为 24 steps / CFG 3 / res_multistep / simple（`server/anima-generation-contract.js:3-8` ANIMA_DEFAULTS，`routes/anima.js:27-28`，`data/presets.json` 同）。表内只有 CFG 一格标注了「当前生产 preset」，steps/sampler/scheduler 未标注为历史官方对照（同文档 L127 已写明 30/CFG4.5/er_sde/sgm_uniform 仅作历史对照）。
- **建议**：Anima 行 steps/sampler/scheduler 补注「历史官方参数对照」，或整行改为生产默认并单列官方对照。

### 2. `docs/project-status.md` L42 / L32（B 组）
- **声称**：宁宁生产 ID `L_NENE_V20_ANIMA`（v20 epoch 8 / step 336，strength 0.85）。
- **实际**：生产已由 `L_NENE_V20B_ANIMA`（v20-b，epoch 16 / step 672）取代：`src/utils/drawingRoute.ts:26` 的 STUDIO_LORA.nene 使用 `loraId:'L_NENE_V20B_ANIMA', generationCharacter:'nene_b'`；`docs/anima-training-record.md` L27-29 已记录晋级。git 近期有「promote v20-b LoRA」提交。
- **建议**：更新宁宁生产 ID 为 `L_NENE_V20B_ANIMA`，旧 ID 标注为回退条目。

### 3. `docs/anima-training-record.md` L29（A 组）
- **声称**：「routes/anima.js CHARACTERS.nene.loraId 已切换」（v20-b 晋级后默认角色改用 V20B）。
- **实际**：`routes/anima.js:74` 的 `CHARACTERS.nene.loraId` 仍是 `'L_NENE_V20_ANIMA'`（v20-a）；V20B 绑定在独立角色 `nene_b`（L77）。生产一键路线由 `src/utils/drawingRoute.ts:26-29` 把 nene 映射到 V20B / generationCharacter='nene_b'。git 历史 7478e4d 确实切换过，但 cf26909 已改回 v20-a 默认。
- **建议**：改写为「v20-b 生产路由经 drawingRoute.ts nene→nene_b；routes/anima.js 的 nene 默认仍是 v20-a，V20B 在独立 nene_b 条目（保留 A/B 对比通道）」。

### 4. `docs/video-generation-roadmap.md` L73（B 组）
- **声称**：视频任务「并发上限为 2」。
- **实际**：`routes/video.js:712` 用的是 `security.rateLimit({capacity:3, refillMs:60000})` 令牌桶（容量 3），且 `server/security.js:117` 对 `isDirectLocalRequest(req)` 直接放行——本机个人使用下该限流被完全跳过，不存在「并发上限 2」。
- **建议**：文档改为匹配代码的「令牌桶限流（本地请求不限）」，或按文档数值改代码并对本地生效。

### 5. `docs/visual-architecture-roadmap.md` L8 / L152-153（B 组）
- **声称**：「不进行 React、Nuxt、Electron 或 Tauri 重写」；「为了桌面外观立即引入 Electron/Tauri」列为不建议。
- **实际**：Tauri 2 Companion/Atelier 已是活跃方向：`desktop-tauri/src-tauri/Cargo.toml` 存在并作为构建链，`docs/project-status.md` L20 记录「Tauri 2 Companion/Atelier 与 Native Live2D 已构建并通过验证」。该文档（2026-08-02）早于 Tauri 方向落地。
- **建议**：更新结论为「Web 侧不重写；Companion/Atelier 已建立 Tauri 2 桌面壳」，删除与现状冲突的「不建议引入 Tauri」。

### 6. `docs/live2d-native-overlay-plan.md` §4 坐标系约定（L81-85）（C 组）
- **声称**：overlay 矩形为屏幕物理像素，前端换算 `screen = windowBounds + stageRect × dpr`，窗口 bounds 由 Rust 注入。
- **实际**：实现改为 Companion-local 物理坐标：`src/composables/useLive2D.ts:918` 对原生后端调用 computeOverlayRect 时 `windowBounds` 固定传 `{x:0,y:0}`（注释：屏幕绝对原点由 Rust 实时 GetWindowRect 获取）；setFrame 只传 Companion-local 矩形。§8 只勾选了注入解，未订正 §4 公式文本。
- **建议**：§4 改为 Companion-local（origin 0,0），说明屏幕绝对原点由 Rust 实时 HWND 位置换算，`windowBoundsFromScreen` 仅作未注入兜底。

### 7. `docs/live2d-native-overlay-plan.md` §5 crate 调研结论（L98-115）（C 组）
- **声称**：首选 live2d-rs（sena-nana，v5 + wgpu 现成），cubism-rs 4-r.5.1 为回退，裸 FFI 兜底。
- **实际**：实现改用官方 Cubism SDK for Native（5-r.5）+ C++ glue + Rust FFI，由私有 crate `live2d-native`（路径 ../native-live2d）承载；Cargo.toml 无 live2d-rs/cubism-rs 依赖；runtime.md 已记录 `sena-nana/live2d-rs` 曾被验证为 404，不得再引用。
- **建议**：§5 追加更正：crate 调研结论已被实际实现取代（live2d-rs 不存在，最终采用官方 SDK + 私有 live2d-native crate）。

### 8. `docs/maintenance.md` L14 / L15 / L24（D 组）
- **声称**：设计 token 在 `css/design-system.css`，改这里并跑 `npm run lint:colors`。
- **实际**：仓库不存在 `css/design-system.css`；真实路径为 `src/assets/css/design-system.css`（src/main.ts:19 引用；check-contrast.js:11-12 注释旧路径是「审计一棵死树」）。lint:colors 也扫 `src/assets/css`。
- **建议**：三处改为 `src/assets/css/design-system.css`。

### 9. `docs/maintenance.md` L115（D 组）
- **声称**：修改 tts-service.ts 后运行 `npm run test:voice-profile-contract` 与 `npm run test:chat`。
- **实际**：package.json 无 `test:voice-profile-contract` 脚本（执行报 Missing script）；真实脚本名是 `test:voice-profile`（运行 test-voice-profile-contract.js）。
- **建议**：改为 `npm run test:voice-profile`。

### 10. `docs/roadmap.html` L36（E 组）
- **声称**：历史 HTML 路线图与桌面 Companion 研究归档于 `scripts/archive/docs/`。
- **实际**：`scripts/archive/docs/` 只剩 pptx；3 份 md（arknights-inspired-web-design.md、atelier-archive-design-system.md、desktop-companion-research.md）在提交 579187f（2026-08-10）被删除，`scripts/archive/README.md:22` 明确「旧设计研究和 Companion 可行性稿已删除」。且 roadmap.html 是提交 ab7a943 原地精简（-245 行），从未移入 archive。
- **建议**：改为「已完成使命后删除，结论由 DESIGN.md / AGENTS.md / docs/project-status.md 承载」。

### 11. `docs/anima-reproduction-protocol.md` L39-42（A 组）— 低偏中
- **声称**：宁宁 v20/夏目矩阵与预览证据保存在 `AI/Reviews/AnimaV20CheckpointAudit/`、`AnimaV20ProductionSmoke/`、`AnimaV19CheckpointAudit/`、`AnimaV19VisualMatrix/`、`AnimaNatsumeV19ProductMatrix/`、`AnimaNatsumeV19OrdinaryFullbodyAB/`、`AnimaNatsumeV19PreviewSmoke/`。
- **实际**：以上路径在当前 AI 工作区均不存在（递归搜索无命中），Reviews 下 Anima 相关现存目录只有 AnimaUnifiedSweep。
- **建议**：核对并更新证据目录路径，或建立同名目录；否则后续按协议复查找不到证据。
- （同组 anima-training-record.md L31/84/127 同类问题：AnimaV20bCheckpointAudit、AnimaV20bFinal、AnimaPromptAB、AnimaNatsumeV19PreviewSmoke 等路径均不存在。）

---

## 低（7 条）— 顺手可修

| # | 文件 | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| 1 | `docs/companion-voice-roadmap.md` | L6 | 头部「全部阶段暂缓」与正文 P0/P1/P2 已完成矛盾 | 头部改为「P0-P2 已完成，P3/P4 暂缓」 |
| 2 | `docs/prompt-image-quality-roadmap.md` | L101-105 | 声称 short-prompt-batch 对全部单角色场景注入 R18 token；实际 `short-prompt-builder.js:183-184` 按场景 rating 门控（仅 R18/mature 注入 nsfw） | 改为「对 R18/mature 单角色场景注入 nsfw token」 |
| 3 | `docs/live2d-native-runtime.md` | L62 | 验证证据 21/21、3/3 过期；实测 test-live2d-backend.js 24/24、test-live2d-native-contract.js 5/5（合计 29/29，与 L85 一致） | 更新单个脚本用例数 |
| 4 | `docs/live2d-native-overlay-plan.md` | §8 L137-142 | 「前端侧交付尚未提交」；实际已提交（2a1e49b、b09de8e） | 勾销该项并注明提交号 |
| 5 | `docs/showcase-generation-craft.md` | L37/L54 | `popularContent.ts` 缺路径前缀 | 补写为 `src/utils/popularContent.ts` |
| 6 | `docs/index.html` | L128 | 页脚「8 篇」实际 9 个内容页 | 改为 9 或去掉篇数 |
| 7 | `docs/anima-training-record.md` | L31/84/127 | 评审证据目录路径在 AI 工作区不存在（同 A-11） | 标注证据已迁移或更新路径 |

---

## 未发现漂移（抽查确认过）

- `docs/live2d-native-runtime.md` 主体契约（Companion-local 坐标、sena-nana/live2d-rs 404 记录、29/29 合计）与代码一致。
- `docs/anima-training-record.md` 训练协议参数（1e-4 / rank 32 / alpha 32 / 24 epochs / 1024 / LOGIT_NORMAL / attn-mlp、R18 不隔离原则）与当前配置一致。
- `docs/maintenance.md` 其余命令、`docs/getting-started.html`、文档站页面引用的 `tools/nav.js` / `theme.js` / `local-status.js` 均存在。
- `docs/quality-outage-fix-plan.md`、`drawing-experience-optimization-plan.md`、`krea-prompt-recipe.md`、`roleplay-prompt-memory-comparison.md`、`tauri-desktop-migration-plan.md`、`model-comfyui-expansion-roadmap.md` 未发现可验证漂移。

---

## 处置结果（2026-08-14 执行）

**已修复漂移（12 处）**：
- maintenance.md：`css/design-system.css` → `src/assets/css/design-system.css`（2 处）、`test:voice-profile-contract` → `test:voice-profile`
- index.html：页脚「8 篇」→「9 篇」
- companion-voice-roadmap.md：头部状态改为「P0-P2 已完成，P3/P4 暂缓」
- showcase-generation-craft.md：`popularContent.ts` → `src/utils/popularContent.ts`（2 处）
- project-status.md：宁宁生产 ID 更新为 `L_NENE_V20B_ANIMA`（epoch 16/step 672），v20-a 标回退（2 处）
- anima-training-record.md：L29 修正为经 drawingRoute.ts 的 nene→nene_b 映射；证据目录标注「未在 AI 工作区找到」（3 处）
- video-generation-roadmap.md：并发语义修正为「容量 3 令牌桶，本机直连放行」（实测 routes/video.js:712 + security.js:117）
- model-prompting-and-parameters-guide.md：Anima 参数表标注「历史官方参数对照」（3 格）
- prompt-image-quality-roadmap.md：short-prompt-batch 描述改为按 rating 门控
- live2d-native-overlay-plan.md：§4 坐标系追加 Companion-local 更正块、§5 crate 结论追加更正块、§8 提交项勾销（2a1e49b/b09de8e）
- live2d-native-runtime.md：验证数字更新为 24/24、5/5（实测确认）

**已合并（净删 3 份）**：
- `anima-reproduction-protocol.md` → 并入 `anima-training-record.md`（新增「长期协议」节：共同合同 + 生产矩阵与证据 + 可复现入口；超参以 record 各节为准）；project-status、live2d-native-runtime 引用已更新
- `krea-prompt-recipe.md` → 并入 `model-prompting-and-parameters-guide.md`（§三.4 新增「Krea 官方配方与本地映射」子节）
- `quality-outage-fix-plan.md` → 并入 `prompt-image-quality-roadmap.md`（§2.4 新增「2026-08-13 修复方案落地与执行记录」）

**状态标注（3 份）**：
- `model-comfyui-expansion-roadmap.md`：头部标注「生产 tranche 已实现（2026-08-14 确认），后续阶段与 AGENTS.md 明确暂缓一致」
- `drawing-experience-optimization-plan.md`：头部标注「方案稿尚未执行（0%），三提示词切换已被 drawingRoute 部分覆盖」
- `model-prompting-and-parameters-guide.md` 与 `showcase-generation-craft.md`：双向指链（契约权威 ↔ 实操经验）

**未处理（2 项）**：
- `visual-architecture-roadmap.md` 的 Tauri 结论漂移：该文件正被并行协作者修改中（未提交），等对方提交后再更新，避免冲突
- 证据目录路径（`AI/Reviews/Anima*`）：需用户确认是否已归档/迁移后更新

**并行协作提醒**：执行期间检测到工作区被另一会话 stash/reset 整理（reflog `reset: moving to HEAD`），所有修改已随 stash pop 完整恢复、无冲突；本批次提交只包含 docs/ 下本人修改的文件，不含对方的 `visual-architecture-roadmap.md` 与 src/、scripts/ 改动。
