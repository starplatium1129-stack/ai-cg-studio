# AI-CG-Studio 当前状态

> 更新：2026-08-10
> 用途：唯一的项目级当前状态入口。历史轮次、执行者分工和逐步交接稿不再作为维护文档。

## 项目定位

AI-CG-Studio 是本地个人使用的 Galgame 风格 AI CG 创作台，包含角色聊天、Live2D、TTS、SD/Anima/Krea 2 出图、LoRA 训练、场景库、作品册、控制面板和桌面 Companion。

## 当前架构

- 前端：Vue 3 + Vite + TypeScript + Pinia；路由视图懒加载。
- 网关：Express；`routes/` 负责 HTTP API，`server/` 负责安全、配置、诊断和预压缩，`services/*.ts` 编译产物随仓库提交。
- 数据：场景分片、角色、LoRA、预设、标签、热门角色与通用蓝图位于 `data/`；场景运行时只由 `sceneStore` 加载，`DATA_VERSION` 由内容派生。
- 存储：IndexedDB 由 `useKVStore`/`useImageStore` 封装；localStorage 键由 `src/utils/storageKeys.ts` 登记，备份和作品删除分别走统一入口。
- 聊天：Ollama 与 OpenAI-compatible API 可配置；流式回复、归档、TTS、情绪、VAD/ASR 输入和 Live2D 舞台按所有权拆分。
- 绘图：SD/WAI 仍是生产主路径；Anima 是受白名单保护的角色 LoRA 实验路径；Krea 2 Turbo 是无角色 LoRA 的通用自然语言实验路径，不宣称身份长期稳定。WAI 基础 txt2img 在 WebUI 在线时优先，WebUI 离线且 ComfyUI 在线时可使用固定核心节点 fallback。热门角色无 LoRA 模式（`anima-aesthetic-v1.1` 的 `noLora` capability）独立于工作室角色，只在绘图页来源切换为「热门角色」后出现，默认 Anima Aesthetic、可切 Krea 2。
- 训练：训练参数覆盖、数据集枚举、配置副本、ETA 和日志均遵守 `AGENTS.md` 的白名单契约。
- 桌面：Electron 仍是稳定回退路径；Tauri 2 Companion/Atelier 与 Native Live2D 已构建并通过代码级、release selftest 和有限真机验证，但正式发布验收仍受 D-10 阻断。

## 最近完成

- **Krea 2 Prompt 校准为官方散文段结构（P2）**：`naturalDescription` 重构为「风格配方开头 → 主体身份+姿态 → 服装/材质 → 构图/镜头 → 环境 → 光照/色彩/情绪 → 后置媒介词」，identityProse/outfitProse/blueprint.promptProse 原样织入，删除 meta 短语（"A visual novel event CG featuring…"/"Scene details:"/"Composition and lighting:"）与逗号标签堆砌，风格语言恒置最前。新增 `src/config/kreaStyleRecipes.ts`（8 个通用配方 + 2 个独立显式 R18 配方，R18 仅 adult 角色+成熟开关可达，unknown/underage fail-closed），专家模式右栏可选配方（`kreaStyleId` 持久化进草稿/历史，缺省自动）；`data/scene-blueprints.json` 增可选 `kreaStyleHint`/`animaStyleHint`（配方 id 或自由短语），Anima 流行模式只取 lead 保 exact-token+prose 混合、不碰负面。测试：散文段落流断言、R18 门控 unit + 契约 + E2E。详见 `docs/krea-prompt-recipe.md`。
- **热门角色无 LoRA 创作模式（P0/P1 闭环）**：绘图页新增与宁宁/夏目 LoRA 路径正交的「热门角色」来源。`data/popular-characters.json` 首批 18 位角色（含身份词/服装/成人资格 fail closed），`data/scene-blueprints.json` 24 条角色无关通用蓝图（含仅 adult 角色可见的成人蓝图）。服务端 `routes/anima.js` 只为 `anima-aesthetic-v1.1` 开启 `noLora` capability，`buildWorkflow` 新增无 LoraLoader 的九节点分支（正/负 CLIPTextEncode + KSampler res_multistep/simple），原 LoRA 十节点、Krea family 与 UNKNOWN_LORA/INCOMPATIBLE_CHARACTER 校验全部保持。前端 `buildAnimaRequest`/`engineOnline`/LoRA 显隐全部按 capability 门控，不靠 model id 猜；草稿与历史扩展 `subject/characterId/outfitId/blueprintId/noLora` 字段并向后兼容旧草稿（无新 localStorage 键）。
- Tauri 壳 P0-P7 的代码与打包链已收口：双窗口、sidecar、迁移、托盘、IPC、日志、维护 501 契约、staging 和 release 打包均有测试。
- Native Live2D 路径已接入 Companion：可见启动请求 native，`--hidden` 或显式关闭时不加载；Atelier/普通页面默认 browser，缺桥时自动回退。
- Native renderer 已使用模型级 GPU 缓存、持久 upload buffer、destroy 释放和 surface 恢复；宁宁/夏目 release snapshot、动作、口型、情绪、hit-test 和 300 秒 renderer soak 通过。
- ComfyUI 原始接口已从浏览器封闭为应用级 Anima/WAI/Krea 2 job API；固定 workflow、模型/LoRA/参数白名单、路径 containment、取消、TTL 和结果 MIME 校验均由服务端控制。
- API Client、Storage Repository、训练台拆分、状态语言、工作台窄屏层级、动效减法和样式 token 门禁已签收；不再保留这些工作的 round 报告。
- 宁宁 Anima v20 已完成科学训练、checkpoint 选择、18 行人工矩阵和生产 smoke，正式 catalog 使用 `L_NENE_V20_ANIMA`。
- 夏目 v19 E08 未通过正式晋级，但按用户授权作为明确标注的单角色实验预览接入；生产 SD/WAI 仍使用 v18。
- Krea 2 Turbo 已接入独立 `krea2` family：纯自然语言、8 steps/CFG 1、`euler/simple`、无角色 LoRA、无 negative、Prompt Enhancer 关闭；单 seed 真实 smoke 有限 PASS，不代表身份稳定或生产就绪。

## Anima 当前模型状态

详见 `anima-training-record.md` 与 `anima-reproduction-protocol.md`。

| 角色/用途 | 当前结论 |
|---|---|
| 宁宁 Anima | v20 epoch 8 / step 336 晋级，生产 ID `L_NENE_V20_ANIMA`，默认 strength `0.85` |
| 夏目 Anima | v19 E08 / step 312 正式晋级拒绝；实验预览 ID `L_NAT_V19_ANIMA_PREVIEW`，普通全身稳定性有限 |
| triad/shared Anima | 禁用，继续使用 SD/WAI |
| Anima engine | experimental；不得据有限矩阵宣称全引擎稳定发布 |
| Krea 2 Turbo | 独立 `krea2` family；通用自然语言实验，身份不保证，当前仅有限真实 smoke |

## Comfy/WAI 能力边界

- WebUI 在线时 WAI 基础生成优先走既有 WebUI/reForge；Comfy fallback 只在 WebUI 明确离线且 ComfyUI 在线时启用。
- Comfy fallback 仅支持固定核心节点图、已允许的 checkpoint/LoRA 和基础 txt2img。浏览器不传 workflow、`class_type`、路径或任意节点输入。
- hires fix、ADetailer/face-hand detailer 仍依赖 WebUI；WebUI 离线时明确返回 `WEBUI_REQUIRED_OFFLINE`，不能静默降级。
- Comfy 真实 smoke 可用但手指融合、身份细节和服装特征弱于 WebUI；因此不能把 fallback 提升为生产主路径。
- Krea 2 当前只使用 Turbo 推理权重；无角色 LoRA、无 negative、Prompt Enhancer 关闭。视频生成仍不启动。
- 后续若扩展能力，必须先有固定服务端契约、真实 GPU 证据和逐图人工审核。

## Live2D/Tauri 状态

- 当前实现、IPC 接入点、坐标系、资源生命周期和真机证据见 `live2d-native-runtime.md`、`tauri-desktop-migration-plan.md`。
- overlay 矩形使用屏幕物理像素；前端通过 `live2dOverlayLayout.ts` 换算，Native 参数写入由 Cubism Native 作者工程负责。
- release Native selftest：3/3 snapshot，exit 0；renderer 300 秒数据约 47,960 帧、164.3 fps，预热后资源无单调增长，最终资源释放通过。
- 可见 Companion 人工验证已通过冷启动、窗口移动/缩放、透明区域、关闭/恢复、双角色 hit-test、重复动作 busy 提示和隐藏；当前环境无法完成 125% DPI、真实 GPT-SoVITS 和真实安装产品链的全部矩阵。
- 生产发布前仍保留 Electron；Native 发布门禁不得被默认无 GPU `validate` 替代。

## 验证基线

最近完整基线（2026-08-09/10）包括：

- `npm run validate`：209/209 unit；contract 数量不在本文固定，按当前质量清单执行。
- `npm run typecheck:app`、`npm run build`、`npm run validate:desktop`：通过。
- `cargo test --locked --manifest-path desktop-tauri/src-tauri/Cargo.toml`：13/13 通过。
- `npm run test:live2d-native:release`：3/3 snapshot 通过。
- renderer 300 秒 soak：4 次角色切换，约 164 fps，无 OOM、device lost 或持续资源增长。
- 相关 Anima/WAI、训练、聊天、Companion 和文档站页面的定向 Playwright 已通过；真实服务 lane 不纳入默认 validate。

## 当前阻断与未完成

1. **D-10 环境阻断**：真实安装产品验收仍 BLOCKED。当前会话无管理员权限，NSIS 为 per-machine；GPT-SoVITS 离线；只有 100% 单屏；没有实际 self-hosted Windows workflow URL/run id/commit SHA。故尚无安装迁移、125/150% DPI、多屏、真实 TTS、300 秒安装产品 soak、正常退出和卸载 PASS。
2. **Companion 真实麦克风/ASR 回归**：代码级 VAD、speech session、手动长按和取消竞态已有测试，但真实麦克风、ASR 上游、桌面隐藏/显示和权限组合仍需在可用环境回归。
3. **ComfyUI 能力缺口**：detailer、ControlNet、hires fix 等能力仍由 WebUI 提供，Comfy fallback 不得冒充等价支持。
4. **夏目 Anima 正式全身门槛失败**：E08 总矩阵虽为 13W/2T/3L，普通全身修正后 fullbody+identity 只有 2/3、W/T/L 为 1/0/2，正式 promotion guard 必须保持 rejected。
5. **DOC-10**：本次文档归一化完成长期入口收敛；不把 D-10 未完成伪装成完成，也不再维护旧 handoff/任务分派稿。
6. **Krea 生产化阻断**：角色身份需要 Krea RAW 训练专用 LoRA；当前只有 Turbo 推理权重，不能使用 Anima 或 SDXL LoRA。

## 后续顺序

1. 在提升权限、GPT-SoVITS 可用、可切换 DPI/第二屏和 self-hosted runner 环境中运行同一 D-10 harness，不修改门槛制造替代证据。
2. 对 Companion 进行真实麦克风/ASR 权限、隐藏/显示、DND/安静时段和自动发送回归。
3. 若扩展 Comfy 能力，先定义单一服务端 job 契约并逐项验证 detailer/ControlNet，不恢复浏览器直通。
4. Anima 只允许单变量、预注册、分组 holdout 和逐图审核的后续实验；不得覆盖已晋级 v20 或正式 v18 回退资产。
5. Krea 角色身份、style-reference、Prompt Enhancer 和专用 LoRA 训练需单独定义契约并独立验收。

## 关键文档

- `AGENTS.md`：项目约束和当前实现权威说明。
- `DESIGN.md`：网站与控制面板设计规范。
- `maintenance.md`：维护操作契约。
- `live2d-native-overlay-plan.md`：Native overlay IPC/布局契约，Rust 接入依据。
- `live2d-native-runtime.md`：当前 Native renderer、overlay、性能和限制。
- `tauri-desktop-migration-plan.md`：Tauri 壳当前架构、发布边界和 D-10 条件。
- `anima-training-record.md`：Anima v19/v20 训练、审核、晋级和 preview 结果。
- `anima-reproduction-protocol.md`：可复现实验的数据划分、caption、超参数和硬门槛。
- `visual-architecture-roadmap.md`、`companion-voice-roadmap.md`、`video-generation-roadmap.md`：仍在维护的路线图。
