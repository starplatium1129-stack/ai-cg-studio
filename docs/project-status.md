# AI-CG-Studio 当前状态

> 更新：2026-08-11
> 用途：唯一的项目级当前状态入口。历史轮次、执行者分工和逐步交接稿不再作为维护文档。

## 项目定位

AI-CG-Studio 是本地个人使用的 Galgame 风格 AI CG 创作台，包含角色聊天、Live2D、TTS、SD/Anima/Krea 2 出图、LoRA 训练、场景库、作品册、控制面板和桌面 Companion。

## 当前架构

- 前端：Vue 3 + Vite + TypeScript + Pinia；路由视图懒加载。
- 网关：Express；`routes/` 负责 HTTP API，`server/` 负责安全、配置、诊断和预压缩，`services/*.ts` 编译产物随仓库提交。
- 数据：场景分片、角色、LoRA、预设、标签、热门角色与通用蓝图位于 `data/`；场景运行时只由 `sceneStore` 加载，`DATA_VERSION` 由内容派生。
- 存储：IndexedDB 由 `useKVStore`/`useImageStore` 封装；localStorage 键由 `src/utils/storageKeys.ts` 登记，备份和作品删除分别走统一入口。
- 聊天：Ollama 与 OpenAI-compatible API 可配置；流式回复、归档、TTS、情绪、VAD/ASR 输入和 Live2D 舞台按所有权拆分。角色 Prompt 由服务端分层组装，并支持本机用户档案与用户手动固定的跨会话事实召回。
- 绘图：场景模式是一键流程，只需选择预设场景与底模；镜头、光照、构图、Prompt 和模型参数自动确定。WAI v17 普通兼容请求仍为 Comfy-first；自动 hires 则优先 WebUI Anime6B，仅 Comfy 可用时退到 nearest-exact Latent，再不可用时保持审计直出。当前应用生产 preset 中 Anima Base/Aesthetic 使用 24 steps / CFG 3 / `res_multistep` / `simple` 的模型原生标签流；30 steps / CFG 4.5 仅保留为历史对照实验参数。Krea 2 Turbo 使用 3~5 句纯英文自然语言且无负面。
- 视频：新增 `/video-studio` 本地 AI 视频工作台。当前以 Wan 2.2 TI2V 5B 为首个固定配方和快速预演路线，前端只暴露镜头描述、画幅、3/5 秒、镜头运动与主体运动；Seed/负向词默认折叠。`routes/video.js` 负责资源扫描、白名单校验、固定 ComfyUI 工作流、长任务轮询/定向取消、视频安全转存与 Range 播放。MiniMax H3 作为“本地 768p + 原生立体声音频”的高上限最终成片路线进入模型目录；Wan 14B、HunyuanVideo 1.5、LTX-2.3 同样保持待适配。本机当前 ComfyUI 节点已支持，Wan/H3 权重尚未安装，未执行真实 GPU 出片。
- 训练：训练参数覆盖、数据集枚举、配置副本、ETA 和日志均遵守 `AGENTS.md` 的白名单契约。
- 桌面：Electron 仍是稳定回退路径；Tauri 2 Companion/Atelier 与 Native Live2D 已构建并通过代码级、release selftest 和有限真机验证，但正式发布验收仍受 D-10 阻断。

## 最近完成

- **角色 Prompt 分层与轻量长期记忆**：新增 `server/chat-character-prompts.js`，无动态上下文时宁宁/夏目基础 Prompt 哈希保持不变；`aics_user_profile_v1` 保存称呼/关系/备注，`aics_chat_memories_v1` 保存用户主动固定、可编辑删除的事实。召回按角色隔离，使用 CJK bigram + ASCII 词匹配，最多 4 条/1000 字，动态内容在服务端再次白名单校验并标注为不可信事实。未引入 Artemis 的断链 Qdrant/mem0/Headroom 或未接入行为引擎。
- **四底模一键 Prompt 编译**：WAI 保留官方质量/rating 前缀与场景 LoRA 权重；Anima Base 仅 score/LoRA 契约词保留下划线，Aesthetic 去掉全部质量/score；Krea 将 298 场景确定性分成主体、服装、动作、表情、环境和镜头/光照，输出 3~5 句英文散文。基础模式没有画师设置；专家模式提供 20 位热门画师、最多混合 2 位，并分别渲染成 WAI Danbooru tag、Anima `@artist` 和 Krea 自然语言；Muririn / Kobuichi 标注为项目实测，另 6 位新增项标注为待验证。三引擎共用唯一生成按钮和自动参数摘要。
- **热门角色无 LoRA 创作模式（P0/P1 闭环）**：绘图页新增与宁宁/夏目 LoRA 路径正交的「热门角色」来源。`data/popular-characters.json` 首批 18 位角色（含身份词/服装/成人资格 fail closed），`data/scene-blueprints.json` 每角色 10-11 条场景（6 原型含 3 日常感 + 4-5 成人，含性癖向扩容）加 3 条通用成人蓝图；`/popular-scenes` 角色场景库提供与灵感场景页同级的专门浏览（角色筛选/搜索/分类/成人开关/镜头光线推断），「开始绘制」经 `?popular=&blueprint=` 深链直达绘图页并预选场景。服务端 `routes/anima.js` 只为 `anima-aesthetic-v1.1` 开启 `noLora` capability，`buildWorkflow` 新增无 LoraLoader 的九节点分支（正/负 CLIPTextEncode + KSampler res_multistep/simple），原 LoRA 十节点、Krea family 与 UNKNOWN_LORA/INCOMPATIBLE_CHARACTER 校验全部保持。前端 `buildAnimaRequest`/`engineOnline`/LoRA 显隐全部按 capability 门控，不靠 model id 猜；草稿与历史扩展 `subject/characterId/outfitId/blueprintId/noLora` 字段并向后兼容旧草稿（无新 localStorage 键）。
- Tauri 壳 P0-P7 的代码与打包链已收口：双窗口、sidecar、迁移、托盘、IPC、日志、维护 501 契约、staging 和 release 打包均有测试。
- Native Live2D 路径已接入 Companion：可见启动请求 native，`--hidden` 或显式关闭时不加载；Atelier/普通页面默认 browser，缺桥时自动回退。
- Native renderer 已使用模型级 GPU 缓存、持久 upload buffer、destroy 释放和 surface 恢复；宁宁/夏目 release snapshot、动作、口型、情绪、hit-test 和 300 秒 renderer soak 通过。
- ComfyUI 原始接口已从浏览器封闭为应用级 Anima/WAI/Krea 2 job API；固定 workflow、模型/LoRA/参数白名单、路径 containment、取消、TTL 和结果 MIME 校验均由服务端控制。
- API Client、Storage Repository、训练台拆分、状态语言、工作台窄屏层级、动效减法和样式 token 门禁已签收；不再保留这些工作的 round 报告。
- 宁宁 Anima v20-b 已完成科学训练、checkpoint 选择、18 行人工矩阵和生产 smoke，正式 catalog 使用 `L_NENE_V20B_ANIMA`；`L_NENE_V20_ANIMA`（v20-a）保留为回退条目。
- 夏目 Anima v20 epoch 12 已通过五场景同 prompt/seed 人工矩阵并晋级，生产 ID `L_NAT_V20_ANIMA`；生产 SD/WAI 仍使用 v18。
- Krea 2 Turbo 已接入独立 `krea2` family：纯自然语言、8 steps/CFG 1、`euler/simple`、无角色 LoRA、无 negative、Prompt Enhancer 关闭；单 seed 真实 smoke 有限 PASS，不代表身份稳定或生产就绪。

## Anima 当前模型状态

详见 `anima-training-record.md`（含长期协议，原 `anima-reproduction-protocol.md` 已并入）。

| 角色/用途 | 当前结论 |
|---|---|
| 宁宁 Anima | v20-b epoch 16 / step 672 晋级，生产 ID `L_NENE_V20B_ANIMA`，默认 strength `0.85`；v20-a（epoch 8）保留为回退 |
| 夏目 Anima | v20 epoch 12 晋级，生产 ID `L_NAT_V20_ANIMA`，默认 strength `0.85`；泪痣仍非稳定特征 |
| triad/shared Anima | 禁用，继续使用 SD/WAI |
| Anima engine | experimental；不得据有限矩阵宣称全引擎稳定发布 |
| Krea 2 Turbo | 独立 `krea2` family；通用自然语言实验，身份不保证，当前仅有限真实 smoke |

## Comfy/WAI 能力边界

- WAI 兼容请求优先走固定 ComfyUI 图；只有 Comfy 不可用或请求超出其白名单能力时才回退 WebUI/reForge。
- Comfy 路径只接受已允许的 WAI checkpoint/角色 LoRA、基础 txt2img 与受限 latent hires；浏览器不传 workflow、`class_type`、路径或任意节点输入。
- WAI 默认 `Auto` hires 为 1.5x / 20 steps / denoise 0.4：WebUI 解析为 `R-ESRGAN 4x+ Anime6B`，Comfy 解析为 nearest-exact Latent；ADetailer/face-hand detailer 仍只在 WebUI 可用且直出高分辨率时启用。
- WAI Comfy 真实 latent-hires 样张已通过人工复核；身份与肢体质量仍由逐图审核兜底，不据单图宣称所有场景稳定。
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
- `anima-training-record.md`：Anima v19/v20 训练、审核、晋级和 preview 结果，含长期协议（数据划分、caption、超参、硬门槛；原 `anima-reproduction-protocol.md` 已并入）。
- `visual-architecture-roadmap.md`、`companion-voice-roadmap.md`、`video-generation-roadmap.md`：仍在维护的路线图。
