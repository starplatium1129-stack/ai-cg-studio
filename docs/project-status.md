# AI-CG-Studio 当前状态

> 更新：2026-08-31
> 用途：唯一的项目级当前状态入口。历史轮次、执行者分工和逐步交接稿不再作为维护文档。总文档索引见 `docs/INDEX.md`。

## 项目定位

AI-CG-Studio 是本地个人使用的 Galgame 风格 AI CG 与短片创作台，包含角色聊天、Live2D、TTS、SD/Anima/Krea 2 出图、49 位热门角色场景库（51 角色/267 形态/1869 参考条目参考库，数字以 `DATA_VERSION` 为准）、作品册、AI 视频分镜工作台、控制面板和桌面 Companion。

## 当前架构

- 前端：Vue 3 + Vite + TypeScript + Pinia；路由视图懒加载。
- 网关：Express；`routes/` 负责 HTTP API，`server/` 负责安全、配置、诊断和预压缩，`services/*.ts` 编译产物随仓库提交。
- 数据：场景分片、角色、LoRA、预设、标签、热门角色（49 位 / 参考库 51 位）、518 通用蓝图、角色 4 视角标准定义位于 `data/`；场景运行时只由 `sceneStore` 加载，`DATA_VERSION` 由内容派生。
- 存储：IndexedDB 由 `useKVStore`/`useImageStore` 封装；localStorage 键由 `src/utils/storageKeys.ts` 登记，备份和作品删除分别走统一入口。
- 聊天：Ollama 与 OpenAI-compatible API 可配置；流式回复、归档、TTS、情绪、VAD/ASR 输入和 Live2D 舞台按所有权拆分。角色 Prompt 由服务端分层组装，并支持本机用户档案与用户手动固定的跨会话事实召回。
- 绘图：场景模式是一键流程，只需选择预设场景与底模；镜头、光照、构图、Prompt 和模型参数自动确定。WAI v17 普通兼容请求仍为 Comfy-first；自动 hires 则优先 WebUI Anime6B，仅 Comfy 可用时退到 nearest-exact Latent。Anima Base/Aesthetic 使用 30 steps / CFG 4.5 / `res_multistep` / `simple`（放大 = Remacri 纯像素直出）的模型原生标签流。Krea 2 Turbo 使用 3~5 句纯英文自然语言且无负面。
- 画师风格库：专家模式提供 39 位精选动漫画师与作监风格（含 Nekotomi Chao / 猫富ちゃお、浅野恭司 / WIT Studio、Rella 星夜光影、深崎暮人、Rucarachi 等），支持 SD/WAI (Danbooru tags)、Anima (`@artist`) 与 Krea 2 (自然语言) 跨引擎编译。
- 视频：`/video-studio` 本地 AI 视频工作台。支持 Wan 2.2 TI2V 与 MiniMax H3（Ref2VA 多模态参考图绑定）；支持剧本分镜智能拆解、画风锚注入、中日英对白语言显式控制（`dialogueLang`）与 Range 播放。
- 训练：训练参数覆盖、数据集枚举、配置副本、ETA 和日志均遵守 `AGENTS.md` 的白名单契约。
- 桌面：Tauri 2 NSIS 正式打包与快速增量部署（`deploy-desktop.bat` / `deploy-desktop-quick.ps1`）双轨运行；Native Live2D overlay 正常接入。

## 最近完成

- **43 热门角色体系与一站式角色接入自动化引擎（Character Onboarding Pipeline）**：
  - 新增《不时轻声地用俄语遮羞的邻座艾莉同学》女主角 **艾莉莎·米哈伊洛夫娜·九条（Alisa Mikhailovna Kujou / Alya）**，包含 5 套服装形态（征岭校服、夏日连衣裙、啦啦队、男友衬衫、私密全裸）、20 视角电影级标准参考图、52,261 点阵粒子场以及 11 个专属场景蓝图（6 SFW + 5 NSFW）。
  - 打造 `scripts/maintenance/workflow-onboard-popular-character.js`（`npm run character:onboard`），实现档案注册、多形态规范同步、立绘粒子场生成、20 张 4 视角参考图批量出图、11 张 Showcase 样张转码大盘注册、`DATA_VERSION` 自动哈希对齐与桌面端增量发布的一键自动化闭环。
- **场景管理中台与资源缓存策略升级**：
  - **静态资源协商缓存（`no-cache + ETag`）**：彻底终结浏览器与 WebView2 盲缓存旧图痛点，本地替换任意立绘/参考图后刷新页面即刻 100% 生效，无需手动改写 `?v=版本号`。
  - **场景管理样张大盘打通**：`SceneManagerView.vue` 现已支持全量 648 个样张（301 经典主线场景 + 347 热门角色场景蓝图）的统一检索、多视角预览与在线一键上传替换（自动完成 4096px 原图 + 560px 缩略图生成与 manifest 同步）。
  - **数据版本全自动自愈**：网关保存场景或执行维护脚本时，自动重新计算核心数据文件的 SHA1 哈希并升版 `DATA_VERSION`，杜绝前后端缓存脱节。
- **45 角色 $\times$ 236 服装形态 4 视角参考库（Character Reference Bible）与全自动闭环自愈管线**：
  - 覆盖明日方舟、原神、崩铁、葬送的芙莉莲、Fate、Re:Zero、俄语妹、青猪、刀剑神域、魔禁/超炮、约战、罪恶王冠、无职转生、物语系列、孤独摇滚、电锯人、莉可丽丝、进击的巨人等 45 位角色，共 236 套服装形态（含常规立绘/变体 + `🔞 私密全裸 / 纯粹形态`），构建了 944 个电影级标准参考视角（`ref_01_face_closeup` 特写、`ref_02_half_medium` 半身、`ref_03_full_dynamic` 全身、`ref_04_back_rear` 侧后背影）。
  - **（2026-08-31 更新）**参考库已扩展至 **51 角色 / 267 形态 / 1869 参考条目**：三视图设计图基线全量落地（801 张，`reference:design` 渲染管线，`check-ref-urls` 门禁 1785 张在线图零断链）；热门角色达 49 位。
  - 主站专属女主角（绫地宁宁、四季夏目）全形态强制挂载 Anima 原生专属训练 LoRA（`ayachi_nene_v21_anima`、`shiki_natsume_v21_anima`），确保泪痣、呆毛与神韵 100% 还原。
  - 构建了「3 并发出图池（`render-all-outfits-references.js`）+ 4 并发 Gemini 3.7 Flash 纯视觉审核池（`pure-vision-audit.js`）+ 定向微调自愈引擎（`fine-tuned-repair.js`）」闭环流水线。大盘获得高比例绿灯 PASS 认证，边缘变体与修复配方完整归档至 `docs/character-reference-audit-pending.md`。
  - 数据标准与 TS 映射契约落盘至 `data/character-reference-standards.json` 与 `src/utils/characterReferenceData.ts`。
- **精选动漫画风库扩容至 39 位与作监级分色机制**：
  - 正式实装 **猫富ちゃお（Nekotomi Chao）** 动画工房灵动画师标签（`@nekotomi chao`）、**浅野恭司（Kyoji Asano）** WIT Studio 粗线硬边赛璐珞与大地低饱和色系调光，以及 **Rucarachi** 等画师。
  - 确立「动画人设作监/分镜原画师 vs 小说插画师 vs 动画制作公司」三层风格编译隔离规则。
- **NSFW 场景大透视与光影深度升级**：
  - 完成 **樱岛麻衣·兔女郎私密时刻（`sakurajima_mai_r18_hotel`）** 全景下半身大透视与 Rella 星夜光影重构，并同步更新 Showcase 线上样张。
- **AI 视频工作台 Ref2VA 叙事短片管线**：
  - 支持多镜头连贯剧本分镜自动拆解、Ref2VA 角色参考图绑定、Rella 画风锚注入与多语言对白标签（`dialogueLang: auto/zh/ja/en`）。
- **桌面端增量极速部署流水线（`deploy-desktop.bat` / `deploy-desktop-quick.ps1`）**：
  - 部署脚本收口为单一实现，一键完成 build + data-first 资源同步 + WebView2 缓存穿透清理 + 僵尸 chunk 裁剪 + 静默重启，大幅提升桌面端迭代效率。

## Anima 当前模型状态

详见 `anima-training-record.md`（含长期协议，原 `anima-reproduction-protocol.md` 已并入）。

| 角色/用途 | 当前结论 |
|---|---|
| 宁宁 Anima | v21 生产挂载 `ayachi_nene_v21_anima`，默认 strength `0.85`；泪痣与呆毛 100% 锁定 |
| 夏目 Anima | v21 生产挂载 `shiki_natsume_v21_anima`，默认 strength `0.85`；右眼泪痣稳定 |
| 热门角色 Anima | 33 位热门角色采用纯 Native Tag 流出图，`noLora` 9 节点标准分支 |
| triad/shared Anima | 禁用，继续使用 SD/WAI |
| Krea 2 Turbo | 独立 `krea2` family；通用自然语言实验，身份不保证 |

## Comfy/WAI 能力边界

- WAI 兼容请求优先走固定 ComfyUI 图；只有 Comfy 不可用或请求超出其白名单能力时才回退 WebUI/reForge。
- Comfy 路径只接受已允许的 WAI checkpoint/角色 LoRA、基础 txt2img 与受限 latent hires；浏览器不传 workflow、`class_type`、路径或任意节点输入。
- WAI 默认 `Auto` hires 为 1.5x / 20 steps / denoise 0.4：WebUI 解析为 `R-ESRGAN 4x+ Anime6B`，Comfy 解析为 nearest-exact Latent；ADetailer/face-hand detailer 仍只在 WebUI 可用且直出高分辨率时启用。
- Krea 2 当前只使用 Turbo 推理权重；无角色 LoRA、无 negative、Prompt Enhancer 关闭。

## Live2D/Tauri 状态

- 当前实现、IPC 接入点、坐标系、资源生命周期和真机证据见 `live2d-native-runtime.md`、`docs/archive/expired/tauri-desktop-migration-plan.md`。
- overlay 矩形使用屏幕物理像素；前端通过 `live2dOverlayLayout.ts` 换算，Native 参数写入由 Cubism Native 作者工程负责。
- 可见 Companion 人工验证已通过冷启动、窗口移动/缩放、透明区域、关闭/恢复、双角色 hit-test、重复动作 busy 提示和隐藏。

## 验证基线

- `npm run typecheck:app`、`npm run build`：通过。
- `npm run test:repo-hygiene`：通过。
- `npm run test:contract`（Prompt 编译器、Showcase 样张契约、热门角色契约）：全部 PASS。
- `cargo test --locked --manifest-path desktop-tauri/src-tauri/Cargo.toml`：13/13 通过。
- `npm run test:live2d-native:release`：3/3 snapshot 通过。

## 关键文档索引

- `AGENTS.md`：项目约束、质量门槛与当前实现权威说明。
- `DESIGN.md`：网站与控制面板设计规范。
- `docs/INDEX.md`：全景文档分类与索引总览。
- `docs/character-reference-audit-pending.md`：45 角色 4 视角参考库待精调清单与修复指南。
- `docs/showcase-pipeline-lessons.md`：样张流水线 11 个疑难排查与教训留档。
- `docs/archive/expired/video-generation-roadmap.md`、`docs/video-ai-storyboard.md`：视频工作台与智能分镜。
- `docs/archive/expired/tauri-desktop-migration-plan.md`、`docs/desktop-update-research.md`：桌面端架构与更新机制。
