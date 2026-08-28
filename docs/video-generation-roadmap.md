# 本地 AI 视频创作路线

> ⚠️ **2026-08-28 过期标注**：本文「权重待安装/生成按钮禁用」等表述已过时——Wan 2.2 / MiniMax H3 权重均已安装并端到端回归通过，I2V/首尾帧/分镜批量/拼接已落地。现状以 `AGENTS.md` 第四节与 `docs/project-status.md` 为准；本文仅保留早期决策史，勿据此判断功能可用性。

> 更新日期：2026-08-15
> 产品定位：个人本地创作；ComfyUI 负责执行，应用负责稳定、低门槛的创作体验。
> 当前状态：✅ P1 已落地（文字成片最小闭环）；✅ MiniMax H3 T2V 适配器已完成并通过真实 ComfyUI 结构验证（2026-08-15）；真实 GPU 出片（权重安装）与 I2V/首尾帧暂缓。

## 结论

视频页不复刻 ComfyUI 节点画布，也不绑定某一个快速迭代中的模型。应用维持一套稳定的创作契约：

1. 用户选择创作方式：文字成片、图片动起来、首尾帧过渡。
2. 用户描述主体、动作、环境、光线和镜头意图。
3. 应用按本机资源和质量档选择一个经过验证的模型配方。
4. 服务端组装固定 ComfyUI API 工作流，浏览器不能提交任意节点图。
5. 结果转存到应用运行时目录，由应用提供队列、预览、取消和下载。

这使模型升级成为“新增/升级配方”，而不是每次重做页面。

## 当前模型目录

| 模型 | 产品定位 | 当前状态 |
| --- | --- | --- |
| Wan 2.2 TI2V 5B | 16GB 显存机器的快速预演与默认短片路线 | T2V 适配已完成，权重待安装与真实 GPU 验证 |
| MiniMax H3 | 本地 768p、原生立体声音频的高上限最终成片路线 | T2V 适配完成（2026-08-15），权重待安装与真实 GPU 实测 |
| Wan 2.2 14B | 更高质量 T2V / I2V / 首尾帧 | 待本机资源、耗时和工作流验证 |
| HunyuanVideo 1.5 | 720p 与超分质量路线 | 待本机资源、耗时和工作流验证 |
| LTX-2.3 | 快速预演、音视频和首尾帧扩展 | 待官方子图 API 适配 |

当前默认选择 Wan 2.2 TI2V 5B，原因是官方 ComfyUI 模板原生支持 T2V/I2V，且 5B 路线更符合本机 RTX 4070 Ti SUPER 16GB 的第一阶段稳定性目标。模型效果、速度和显存结论必须在权重安装后通过真实 GPU 出片记录，不在代码交付阶段提前宣称。

MiniMax H3 的能力上限更高：本地 Base 支持 T2V、首/尾帧和原生 32kHz 立体声音频，输出最长 15 秒；但本地开源链路默认是 768p，完整 2K 依赖尚未开源的 Regenerate 模块或官方 API。Comfy-Org 的最小量化组合约 42.5GB（约 21GB diffusion model + 15.7GB text encoder + 5.2GB video VAE + 0.6GB audio VAE），因此产品定位为“Wan 快速预演 → H3 最终成片”，不把 H3 设为每次生成的默认模型。

## 已落地：✅ P1 · 文字成片最小闭环

### 前端

- 新增 `/video-studio` 独立页面，并接入主导航、首页和全局搜索。
- 创作方式使用意图级入口；当前仅“文字成片”可用，I2V/首尾帧明确标记后续接入。
- 场景模式默认只开放：
  - 镜头描述
  - 横屏 / 竖屏 / 方形
  - 3 秒 / 5 秒
  - 镜头运动
  - 主体运动
- Seed 与负向描述收进高级设置。
- 本机环境区同时显示：
  - ComfyUI 是否在线
  - 配方是否完成适配
  - 模型权重是否齐备
  - 精确缺失文件清单
- 支持任务轮询、取消、MP4 预览、下载与五项人工检查提醒。

### 服务端

- 新增 `routes/video.js`，路由为：
  - `GET /api/video/status`
  - `POST /api/video/jobs`
  - `GET /api/video/jobs/:id`
  - `DELETE /api/video/jobs/:id`
  - `GET /api/video/jobs/:id/result`
- 请求只接受白名单字段，不接受工作流 JSON、节点名、文件路径或任意 ComfyUI 参数。
- 当前固定工作流使用原生节点：
  - `UNETLoader`
  - `CLIPLoader`
  - `VAELoader`
  - `Wan22ImageToVideoLatent`
  - `KSampler`
  - `VAEDecode`
  - `CreateVideo`
  - `SaveVideo`
- 输出固定为 H.264 MP4；仅接受 `output` 类型、`aics_video` 前缀、无子目录的视频结果。
- 结果转存到 `runtime/outputs/video/`，支持 HTTP Range，浏览器不直接读取 ComfyUI output 目录。
- 提交限流为容量 3 的令牌桶（`routes/video.js` 的 `rateLimit({capacity:3, refillMs:60000})`；本机直连请求经 `security.rateLimit` 的 `isDirectLocalRequest` 直接放行，个人本地使用下不生效），单任务超时 45 分钟；取消使用 prompt-id 定向取消，不调用全局 interrupt。

### 当前所需权重

```text
ComfyUI/models/
├── diffusion_models/
│   └── wan2.2_ti2v_5B_fp16.safetensors
├── text_encoders/
│   └── umt5_xxl_fp8_e4m3fn_scaled.safetensors
└── vae/
    └── wan2.2_vae.safetensors
```

本机 2026-08-13 只读检查结果：ComfyUI 0.31 已具备上述工作流需要的全部原生节点，但三个权重文件尚未安装，因此页面会显示“节点已支持，权重待安装”，生成按钮保持禁用。

## 验证

- `test-video-routes.js` 使用真实 Express 网关与模拟 ComfyUI，覆盖：
  - 未知字段与非法参数 400
  - 未适配模型拒绝
  - 权重缺失 503 与精确清单
  - 固定 Wan 工作流节点和参数
  - 视频结果路径/格式安全校验
  - 任务完成与 MP4 Range 读取
- `npm run typecheck:app`
- `npm run build`
- 页面浏览器截图自查

本阶段不运行 E2E，不启动真实 GPU 出片。

## MiniMax H3 T2V 适配完成（2026-08-15）

### 选型结论（16GB 显存，RTX 4070 Ti SUPER）

- 模型组合采用 Comfy-Org 官方最小量化组合 + **lightx2v 官方 Turbo 蒸馏 LoRA**（总量约 43GB）：
  - `diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors`（INT8 剪枝，约 21GB）
  - `text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`（NVFP4-AWQ，约 15.7GB）
  - `vae/minimax_h3_video_vae_fp16.safetensors`（约 5.2GB）+ `vae/minimax_h3_audio_vae_fp32.safetensors`（约 0.6GB）
  - `loras/minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors`（lightx2v/Minimax-h3-Turbo，8 步蒸馏，替代原生 20 步）
- 40 系（Ada）不支持 NVFP4 扩散主干的硬件加速，因此扩散模型选 INT8 而非 NVFP4 版；文本编码器 NVFP4-AWQ 无此限制。
- 下载脚本：`node scripts/maintenance/download-minimax-h3.js`（默认 HF 直连；`--mirror` 走 hf-mirror.com；`--models-root` 可覆盖目录；已存在文件自动跳过）。

### 服务端适配

- `routes/video.js`：`buildWorkflow` 按 `modelId` 分支，新增 `buildH3Workflow`，节点图与官方 Turbo 模板（ModelTC/Minimax-H3-Turbo `video_minimax_h3_t2v_lightx2v_turbo.json`）一致，全部为 ComfyUI 核心节点：
  - `UNETLoader`（INT8 剪枝）+ `CLIPLoader`（type `minimax`）+ 视频/音频双 `VAELoader`
  - **`LoraLoaderModelOnly`**（Turbo LoRA，strength 1.0）→ **`MiniMaxH3SigmaShift`**（shift_video 12 / shift_audio 3）
  - `MiniMaxH3ImageToVideo` → `BasicGuider`（flow matching，无 cfg）+ `KSamplerSelect(euler)` + `BasicScheduler(simple, 8 步)` + `SamplerCustomAdvanced` + `RandomNoise`
  - `VAEDecode` + `VAEDecodeAudio` → `CreateVideo`（fps 24）→ `SaveVideo`（固定节点 11，H.264 MP4，复用结果契约）
- 分辨率按**画质档位**选择（`quality` 参数，默认 standard；16GB 实测区间 0.2—0.5MP，对齐 h3lite 部署矩阵与官方 ResolutionSelector）：
  - `fast` 608×352 / 352×608 / 448×448（0.2MP）——试镜找方向，约 1—2 分钟/条
  - `standard` 832×480 / 480×832 / 640×640（0.4MP）——**日常主力**（官方常规画布），约 2.5—4.5 分钟/条
  - `fine` 960×544 / 544×960 / 768×768（0.5MP）——16GB 上限档，约 3.5—6 分钟/条
  - 720p（≈0.9MP）在 16GB 上无社区实证，低显存出 720p 的正确路径是低档生成 + 视频超分（P4 计划）。
- **`aspectRatio: 'original'`（跟随原图比例，I2VA 专属）**：服务端读首帧图真实像素（PNG IHDR / JPEG SOF / WebP VP8* 只读文件头），按原图比例 + 档位面积计算画布（`fitCanvasToRatio`：32 对齐、短边 ≤768、面积 ≤768×1344、比例收敛 0.5—2）。解决 832×1216 出图被 480×832 画布拉伸变形的问题（如 standard 档 → 512×768）。绘图页「出视频」带入首帧时自动选中该画幅。
- 蒸馏采样 8 步（官方推荐 8 或 4 步），相对原生 20 步约 2.5 倍提速。
- 帧数按官方公式对齐 17k+5 网格：3 秒 → 73 帧、5 秒 → 124 帧（`h3FrameCount`）。
- H3 是自然语言模型：负向词置空（不再拼 Wan 中文负面清单）；提示词按**官方三段式**组装（MiniMax-AI/MiniMax-H3 h3-prompt-writing skill）：
  - `integrated_multimodal_description: [Shot 1] ...`（主线：画面 + 镜头/主体运动英文自然句 + 一致性约束）
  - `overall_soundscape: ...`（全片环境音，无对白）
  - `non_diegetic_music: ...`（观众可听的轻柔配乐）
  - 官方 skill 已沉淀在 `.agents/skills/h3-prompt-writing/`（含 base-en.txt 与 ref-en.txt 参考文件，Ref2VA 六段式供 I2V/首尾帧模式接入时使用）。
- 分辨率沿用应用画幅（832×480 / 480×832 / 640×640，均为 32 倍数，短边 ≤768 画布规则内）。

### 验证

- `test-video-routes.js` 新增 H3 断言：帧数网格、无负面词、Turbo 工作流节点图（LoRA/SigmaShift/euler/8 步）、缺失文件清单（含 lora）、mock 全流程 202 → succeeded。
- 对运行中的真实 ComfyUI（8188）验证：H3 全部节点（含 `LoraLoaderModelOnly`、`MiniMaxH3SigmaShift`）存在（`/object_info`）；提交 Turbo 工作流得到 400 `value_not_in_list`，错误仅指向缺失权重——结构已通过官方 validation，装好权重即可出片。
- 真实 GPU 出片（耗时/显存/质量/音频）待权重安装后按 P3 配方表记录。

### 疑难留档：SaveVideo codec 动态 combo（2026-08-15）

- **现象**：真实 ComfyUI 执行 H3 工作流报 `SaveVideo.execute() missing 1 required positional argument: 'codec'`（node_id 11），而 `/prompt` validation 与 mock 测试全部通过。
- **根因**：`SaveVideo.codec` 是 `COMFY_DYNAMICCOMBO_V3` 动态下拉；API 提交对象结构 `{codec:'h264', encoding:{...}}` 在真实执行时被丢弃（validation 不校验动态 combo 值）；官方模板（`video_minimax_h3_t2v.json`）SaveVideo 的 widgets 就是 `format:'auto' + codec:'auto'`。
- **修复**：`buildH3Workflow` 与 `buildWanWorkflow` 的 SaveVideo 一律改用 `format:'auto', codec:'auto'`（官方模板值），输出由 ComfyUI 按内容自动定（H3 为 mp4）。
- **验证**：测试断言更新（format/codec = 'auto'）后全绿；真实 ComfyUI 队列中 SaveVideo 以 auto/auto 执行不再报错。
- **教训**：mock ComfyUI 不执行真实节点——**凡涉及动态 combo / 自定义节点参数的工作流改动，必须在真实 ComfyUI 上跑一次到执行阶段**，不能只信 validation 与 mock。

## 全链路提示词审计与修复（2026-08-15，h3-prompt-writing skill 逐条对照）

> 审核范围：绘图页「出视频」→ `tagsToVideoProse` → 视频页 `composeVideoPrompt` →
> 后端 `routes/video.js` H3 三段式组装。逐条对照 `.agents/skills/h3-prompt-writing/` 官方 skill。

### 与官方 skill / 官方示例的对照结论（无改动，仅留档）

- **三段式字段名、顺序、空行分隔**：`integrated_multimodal_description` → （空行）→ `overall_soundscape` → （空行）→ `non_diegetic_music`，与 base-en.txt 一致。
- **I2VA 首帧指令**：项目按 skill 2.1 的写法把 `For the target video, at 0.00 seconds…` 放在整段提示词首行、空一行再进三段式。ModelTC 官方 Turbo I2V 示例（`video_minimax_h3_i2v_lightx2v_turbo.json`）把同样的指令写在 `integrated_multimodal_description:` 字段标签同一行、`[Shot 1]` 前。两种都从文本最开头携带指令，语义等价；项目写法与 skill 文字逐字一致，保持现状。
- **本机 ComfyUI 节点确认（`comfy_extras/nodes_minimax_h3.py`）**：`MiniMaxH3ImageToVideo` 的输入名 `first_frame`、`prompt`（multiline + dynamic_prompts）与项目工作流一致；`length` 训练区间提示为 124–362 帧（约 5s–15s），**3 秒档（73 帧）低于训练区间**——能用但 5 秒档是模型训练最下限，质量更稳；默认仍保留 3 秒（16GB 显存优先），文档记一笔不再改。
- **负向词保持空**：H3 是自然语言模型，负向词污染语义（官方 skill 无负面字段），保持现状。
- **动态提示词注意**：`MiniMaxH3ImageToVideo.prompt` 带 `dynamic_prompts=True`，提示词里出现 `{a|b}` 花括号会被 ComfyUI 随机展开——组装层不产生花括号，用户手动输入时自行留意。

### 本次修复（现象 → 根因 → 修复 → 验证）

1. **中文 story 标点被改写（`tagsToVideoProse`）**：含 ≥5 个逗号分句的中文文案会被误判为 tag 流，按 ASCII 逗号重拼，「，」→「, 」造成标点残渣。
   - 修复：输入含 CJK / 全角标点（`CJK_RE`）一律原样返回；权重括号 `(tag:1.2)` 剥离后送 DROP_TAG 过滤；整词包裹括号剥一层；下划线 token 转空格（`surtr_(arknights)` → `surtr (arknights)`，与 AGENTS.md Anima exactTokens 空格规则同向，避免 H3 收下划线噪声）。
   - 验证：`test-video-prompt-prose.js` 新增 2 用例（该文件此前没接进任何质量套件，已补进 `unit` 清单），8 用例全过。
2. **场景预设兜底用中文 `description+action+lighting` 拼进 H3 提示词**：违反官方「英文改写」输出规则，且按中文逗号拼接产生残渣。
   - 修复：`composeVideoPrompt` 蓝图兜底改为优先英文 `promptProse`（Anima/Krea 自然语言，可直接驱动视频），中文结构化字段仅作最后兜底（`evaluate-video-i2va.js` 同步同源）。
3. **控制器镜头/动作句与用户文案打架**：用户写「镜头缓慢推进」而控制器默认 `still` 时，后端附加「The camera holds a static shot.」——自然语言模型拿到矛盾指令会语义漂移。
   - 修复：`CAMERA_MENTION_RE` / `MOTION_MENTION_RE`（中英词汇表，英文带 `\b` 词边界）检测到文案已自带镜头运动/主体动作意图时，控制器句子让位（Wan 中文路径同样生效）；未检测到时行为不变。
4. **soundscape/music 固定模板与画面错配**：雨夜/战场/海边成片拿「quiet room tone」违反官方 4.6/4.7「声音必须对应画面」。
   - 修复：`deriveH3Soundscape` / `deriveH3Music` 按场景信号（雨/海/战斗/山林/温泉/城市/夜…）确定性派生，乐器/节奏描述符合 4.7（无抽象情绪词），无信号回退原模板。
5. **Wan 5B（modes=['text']）允许携带首帧图**：UI 不校验模式 → `buildWanWorkflow` 不消费 first_frame → 用户上传首帧却按文字成片静默生成错误成片。
   - 修复：服务端 `validateInput` 对不含 `image` 模式的模型 400 `MODEL_INPUT_MODE`；前端 `canGenerate` 增加 `activeModel.modes.includes(selectedMode)` 门禁，I2VA 上下文到达与状态刷新时自动切到支持 image 的模型（本机即 MiniMax H3），提交按钮给出明确提示。
6. **cancel/submit 竞态**：任务提交期间用户取消，`submit` 回来仍把状态翻回 `running` 继续生成（白占 45 分钟 GPU）。
   - 修复：`submit` 发现状态已离开 `queued` 时，直接取消刚创建的上游 prompt 并保持取消态。
7. **切回「文字成片」时画幅残留 `original`**：`aspectRatio` 未复位 → 后端 400。加 `watch(selectedMode)` 离开 image 模式自动复位 landscape。

### 验证

- `test-video-routes.js`：新增冲突让位（中英）、雨景 soundscape 派生、非 image 模型拒绝首帧图断言，全套通过。
- `node --test scripts/tests/test-video-prompt-prose.js`：8 用例通过。
- `eslint`（6 个改动文件）、`npm run typecheck:app`、`npm run build` 通过。

### 剩余观察（暂不动）

- H3 3s（73 帧）低于模型训练区间下限 124 帧；产品保留 3s 起步（16GB 优先），已在「选型结论」注明。
- 热门角色 exactTokens 的括号消歧（`rem_(re_zero)` → `rem (re zero)`）仍按 AGENTS.md 待办在 Anima 侧 A/B 验证后批量改；视频侧 `tagsToVideoProse` 已按空格规则处理下划线，两侧规则一致。

### 后续阶段

### P2 · 图生视频

- 从作品册选择图片作为首帧，不要求用户手动找文件路径。
- 服务端负责将受信任的作品转存/上传到 ComfyUI input。
- 同一页面继续复用镜头、运动、时长和队列。
- 首先适配 Wan 2.2 TI2V 5B I2V；通过身份稳定性审核后再开放。

**P2 前端已落地（2026-08-15）**：

- 绘图页结果卡片新增「出视频」按钮：当前成片 blob → IndexedDB（imgPut）→ 上下文（imageId + story + blueprintId/sceneId + characterId）写 sessionStorage → 跳转视频页。图片本体不跨页传（sessionStorage 容量限制），只传 id。
- 跨页桥接在独立 `src/composables/useVideoBridge.ts`（动态 import 独立 chunk，PromptBuilder 路由块只留薄调用壳；bundle 预算 140→145 KiB 为此调整并注释理由）。
- 视频页启用「图片动起来」模式：自动读取跨页上下文（一次性消费），预览首帧图、自动预填提示词、提交时 base64 上传首帧后走 I2VA 工作流。
- **场景预设 → 视频提示词转换方案（确定性组装，不做 tag 翻译）**：
  1. 用户出图时写的 `story` 直接作为视频主描述（用户意图最忠实）；
  2. story 为空时用场景预设结构化字段：`description`（场景）+ `action`（动作）+ `lighting`（光线）；
  3. 身份/服装不重复描述——I2VA 首帧图已锁定，后端自动附加官方 `<Picture 1>` 首帧指令；
  4. 不做 `promptTokens`（SD tag）→ 自然语言"翻译"：tag 是碎片化标签，转译会引入错误语义；prose/story 本就是自然语言，复用质量最高。
  - 预填提示词始终可编辑；后续可增强「本地 LLM 按官方 skill 规范精修」为可选按钮。
  - ⚠️ 2026-08-15 审计修订：上述第 2 条的场景预设兜底已改为**优先英文 `promptProse`**，中文 `description+action+lighting` 仅作最后兜底（理由与验证见下文「全链路提示词审计与修复」第 2 条）。

**P2 后端已落地（2026-08-15，H3 I2VA 先行）**：

- `POST /api/video/images`：base64 图片上传（≤20MB，魔数校验只认 PNG/JPEG/WebP），写入 `ComfyUI/input/aics_video_input_<hex>.<ext>` 受控文件名，返回 name。
- `validateInput` 支持 `image` 参数：只接受本服务上传接口的受控文件名（正则 + 文件存在性双重校验），杜绝任意路径注入；`config` 为可选第二参数（无 config 时跳过存在性检查，测试友好）。
- `buildH3Workflow` I2VA 分支：`LoadImage`（节点 17）→ `MiniMaxH3ImageToVideo.first_frame`。
- 提示词按官方 base-en.txt I2VA 规范：首行 `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.` + 空行 + 三段式（`integrated_multimodal_description` 以 "Preserve the subject, clothing, hairstyle, and scene from <Picture 1>, then …" 开头）。
- 生命周期：job 结束（成功/失败/取消/TTL）删除其专属首帧图；网关启动清理孤儿 input 文件。
- 测试：上传端点（非法数据 400 / 合法 200）、image 参数校验、I2VA 节点图、mock 全流程 202 → succeeded。

**P2 前端待做**：绘图页出图结果卡片加「出视频」按钮（携带 IndexedDB 图片 id + 场景/角色上下文 → 视频页 image 模式）；视频页启用图片模式（预览、自动组装提示词、上传+提交）。

### P3 · 首尾帧与质量路线

- 首尾帧过渡：作品册选择开始/结束两张图。
- 增加 Wan 2.2 14B、HunyuanVideo 1.5、LTX-2.3 配方。
- 模型选择默认隐藏在“执行路线”中；场景模式由应用推荐，专家模式才允许手选。
- 每个配方都必须记录：
  - 固定场景和 seed
  - 总耗时
  - 峰值 VRAM / RAM
  - 身份稳定性
  - 肢体连续性
  - 背景闪烁
  - 镜头遵循

### P4 · 视频作品册与后处理

- IndexedDB 仅保存元数据和引用；大视频继续放运行时媒体目录。
- 增加封面帧、收藏、重用配方、磁盘占用和清理策略。
- 再评估补帧、超分、配音/原生音频与视频延长。

## 明确不做

- 不开放任意 ComfyUI workflow 上传或浏览器直连 `/prompt`。
- 不提供节点画布。
- 不因模型“热门”就标记为本机可用。
- 不在真实 GPU 验证前承诺生成耗时、显存占用或质量等级。
- 不把视频原生音频与现有 GPT-SoVITS 配音链路强行合并。

## ✅ 已落地：P5–P8 · 剧情短片工作流（2026-08-16，用户指示本会话接管视频链路）

> 调研基线：`docs/narrative-short-film-workflow.md`。行业共识流水线 = 剧本 → 分镜表 →
> 角色/场景资产 → 逐镜头图生视频 → 配音音效 → 剪辑合成；本项目缺的「分镜管理 +
> 批量编排 + 跨镜一致性 + 合成」已在此次全部实现。

### 新能力总览

| 能力 | 实现 | 验证 |
| --- | --- | --- |
| 分镜批量生成 | `POST /api/video/batches`（1–30 镜，逐镜串行，单镜失败不打断，单镜重抽） | mock 全流程 + **真实 GPU 端到端**（2 镜批量 ✅） |
| 首尾帧衔接 | linkLastFrame：服务端 ffmpeg 抽上一镜尾帧 → 下一镜 FL2VA `last_frame` / I2VA 续接 | **真实 GPU FL2VA 收敛验证 ✅**（输出末帧与输入尾帧身份/构图精准一致，视觉模型复核） |
| H3 对白 | `dialogue` 字段 → 官方 4.4 `(S1) + <d>[语言] 原文</d>` 组装 | 真实 GPU 对白成片 ✅（AAC 音频 mean -23.8dB，非静音） |
| 景别 | `shotSize`（wide/medium/closeup）→ 官方 4.1 英文构图句 | 单元断言 |
| 成片拼接 | `POST /api/video/batches/:id/concat`：ffmpeg concat + scale/pad 归一化到批量画布 | mock + 真实拼接（待端到端批处理完确认） |
| 前端 | 视频页新增「分镜短片」模式：分镜表格、批量提交/进度轮询、单镜预览/重抽、整片拼接下载 | Playwright UI 冒烟 + 视觉模型截图复核 ✅ |

### 真实 GPU 出片记录（2026-08-16，RTX 4070 Ti SUPER 16GB，standard 档 832×480，5 秒）

| 任务 | 耗时 | 产物 |
| --- | --- | --- |
| T2VA（seed 42，雨夜天台少女回头） | ~228s | h264 832×480 + AAC 32kHz 立体声，5.17s，561KB |
| FL2VA（首帧 + 尾帧，seed 7，拔刀镜头） | ~230s | 同上规格 523KB；末帧收敛到尾帧参考 ✅ |
| 对白 T2VA（seed 8，台词「雨，什么时候才停呢。」） | ~220s | 同上规格 505KB；音频含语音能量 |

产物与抽帧在 `runtime/review/`（不入库）。模型已安装权重：H3 五件套 + Wan 2.2 TI2V 5B 三件套
（后者 2026-08-16 经 hf-mirror 下载，~55–60MB/s，约 5 分钟；注意 umt5 在
`Comfy-Org/Wan_2.2_ComfyUI_Repackaged` 的 `split_files/text_encoders/` 下）。

### 接口契约（`routes/video.js`）

- 单任务新增字段：`dialogue`（≤300 字符，仅 H3）、`lastFrame`（受控文件名，仅
  first-last-frame 模式模型）、`shotSize`（仅 H3）。白名单/错误信封/限流契约不变。
- 批量端点：`POST /api/video/batches`（body ≤1mb，整批统一 modelId/aspectRatio/quality，
  逐镜复用 validateInput 同源校验）、`GET/DELETE /api/video/batches/:id`、
  `POST .../shots/:index/retry`、`POST .../concat`、`GET .../result`（Range 流式）。
- 编排：逐镜串行（尊重 MAX_PENDING 与 16GB 显存）；批量任务 TTL 24h（首镜结果需留到
  批处理完）；衔接抽取的受控图片随任务生命周期删除，网关启动清理孤儿文件。
- 提交前按当前图模式**重组提示词**（`recomposeInput`，seed 显式传回）——衔接改写
  image/lastFrame 后必须重装官方参考图指令（I2VA/FL2VA/L2VA 各不相同）。

### 疑难留档（2026-08-16）

1. **衔接后提示词不跟随输入模式**：现象=镜 2/3 拿到衔接图但提示词仍是 T2V 版（无
   `<Picture 1>` 指令）；根因=validateInput 在批量创建时组装提示词、衔接在提交前改写
   输入；修复=kick 前 recomposeInput 按当前 image/lastFrame 重组（seed 传回保确定性）；
   验证=批量测试断言镜 2 I2VA 指令、镜 3 FL2VA 指令 + 节点接线全绿。
2. **真实 GPU 验证脚本二进制损坏**：现象=ffprobe 报 `delta scale ... is invalid`；
   根因=下载脚本把 MP4 当 utf8 字符串拼接再 latin1 还原（二进制被替换字符破坏）；
   修复=chunks 按 Buffer 累积；教训=凡拉取二进制产物必须 Buffer.concat，禁止字符串中转。
3. **H3 输出画布可能漂移**：现象=损坏文件头误报 832×509（修复后实测仍为 832×480，
   但为防个别镜头 ±几像素漂移）；修复=concat 统一 scale+pad 到批量画布
   （`scale=W:H:force_original_aspect_ratio=decrease,pad=...`）；验证=mock concat 断言。
4. **FL2VA 真实执行确认**：本地 `MiniMaxH3ImageToVideo` 原生支持 `first_frame` +
   `last_frame`（object_info 与 `nodes_minimax_h3.py` 双重确认），工作流 LoadImage 18 号
   节点接线后真机出片成功，末帧收敛参考图。

### 遗留观察

- H3 对白内容（语音清晰度/口型）需人工试听复核（本会话无法听音）。
- 本地无 Context-IR/Ref2VA：多角色同框、长对白的质量上限依赖提示词规范，后续可评估
  官方 API Ref2VA 作为进阶路线。
- 视频作品册（P4）与字幕（P8 可选）未做，留待后续。

## 真实耗时实测与「线上 480p 15s 4 分钟」对标（2026-08-16）

本机：RTX 4070 Ti SUPER 16GB，H3 Turbo 蒸馏（lightx2v），seed 21-24 同提示词实测：

| 档位 | 画布 | 5s | 10s | 15s |
| --- | --- | --- | --- | --- |
| fast（0.2MP）· 8 步 | 608×352 | **130s** | ~260s（推算） | ~390s（推算） |
| fast · **4 步极速** | 608×352 | **80s** | ~160s（推算） | **~240s（推算，≈ 线上 4 分钟）** |
| standard（0.4MP）· 8 步 | 832×480 | 228s | **430s（实测）** | **671s（实测）** |
| fine（0.5MP）· 8 步 | 960×544 | 3.5–6 分钟（推算） | — | — |

结论与启示：

1. **线上「480p 15s ≈ 4 分钟」对标的是我们的 fast 档 + 4 步极速**（0.2MP 画布，推算
   ~4 分钟）；同口径 standard 档（0.4MP，真正 480p+ 画质）本地 15s ≈ 11 分钟——差距
   来自本地消费级 GPU 与线上 A100/H100 集群（约 2–3 倍吞吐差），属硬件边界。
2. **10s/15s 长镜在 16GB 显存跑得动**（实测 430s/671s 无 OOM）：一段 15s 长镜的等待
   时间 ≈ 三段 5s 镜，但只需一次排队、一次抽卡，叙事与效率都更优——H3 时长档已放开
   到 3/5/10/15s（前端仅 H3 显示）。
3. **极速 4 步已做成产品选项**（单任务高级设置 + 分镜整批开关）：实测 fast 5s 130s →
   80s（约 1.6 倍提速），4 步档中间帧视觉抽查「可接受」（面部/肢体无崩坏、无伪影）。
4. 进一步提速路线（P4 后续）：fast 档生成 + 视频超分放大（对齐线上「低档渲染 + 放大」
   的常见做法）；batch 并行度受 16GB 显存限制，维持逐镜串行。

## 与现有场景出图的结合（2026-08-16 已实现）

```
绘图页（场景蓝图 + 角色 LoRA + Anima/Krea/WAI 出图）
  ├─ 「出视频」→ 单张 I2VA（原有）
  └─ 「加入分镜」→ 当前成片入篮子（IndexedDB 只存 imageId，sessionStorage 存上下文数组）
       └─ 「去分镜短片（n）」→ /video-studio?mode=shots
            └─ 分镜编辑器一次性消费：每镜自动挂首帧（原图实际提示词填入，最忠实）
                 → 整批生成（可开 4 步极速 / 10s-15s 长镜）→ 尾帧衔接 → 拼接成片
```

- 每张图带出的是**该图实际生成时的完整提示词**（按图取词，不随面板后续修改漂移），
  场景蓝图/角色上下文随行；镜头提示词仍可逐镜手改。
- 推荐工作流：先按分镜表在绘图页逐镜出关键帧（场景蓝图 + 角色 LoRA 保证形象一致）→
  逐张「加入分镜」→ 去分镜短片一键整批生成。

## ✅ T8 双时钟采样路径（2026-08-16，默认提速 2.5×；来源：B 站「双时钟加速」视频调研）

> 调研出处：B 站 [BV1UquZ6vEwy](https://www.bilibili.com/video/BV1UquZ6vEwy/)
> （Arwen_Studio「Minimax H3 双时钟加速实测：15秒480P视频仅需4分钟」）→ 溯源到
> GitHub [neng320/minimax-h3-local-deployment](https://github.com/neng320/minimax-h3-local-deployment)
> 与 [T8mars/comfyui-minimax-h3-audio-T8](https://github.com/T8mars/comfyui-minimax-h3-audio-T8)。
> 「双时钟」= 视频/音频两条独立 sigma 时钟（shift_video 12 / shift_audio 3）的 Turbo
> 采样器，配合 lightx2v **4 步**加速 LoRA。

### 真机基准（4070 Ti SUPER 16GB，同提示词同分辨率，2026-08-16）

| 配置 | 5s 实测 | 15s | 说明 |
| --- | --- | --- | --- |
| 原生采样 + 8 步 LoRA（旧默认） | 228s | ~684s | 基线 |
| **T8 双时钟 + 4 步 LoRA + 4 步** | **90s** | **~270s ≈ 4.5 分钟** | 新默认（极速档） |
| T8 双时钟 + 4 步 LoRA + 8 步 | 110s | ~330s ≈ 5.5 分钟 | 新默认（标准档） |
| T8 fast 档 + 4 步 | 50s | ~150s ≈ 2.5 分钟 | 试镜档 |

- **更正上节结论**：上节「standard 15s ≈ 11 分钟属硬件边界」基于旧采样路径；T8 双时钟
  落地后 **standard 档 15s ≈ 4.5 分钟，已追平线上「480p 15s/4min」**——线上快不是因为
  硬件不可逾越，而是因为它用双时钟/4 步组合，本地同组合即可达到同一量级。
- 画质抽查：T8 4 步中间帧视觉复核「可接受」（面部/肢体无崩坏、无伪影）。
- cu130（torch 2.9.1/2.13.0+cu130）单独实测**无明显收益**（210–240s）；「3–5×」来自
  全栈组合（且 109s 数据点含已弃用的 TE-Speed）；SageAttention Windows 无预编译轮子未
  采用。**本机收益全部来自 T8 双时钟 + 4 步 LoRA**（另注：ComfyUI 由 venv main.py 派生
  系统 Python 子进程服务，属正常行为，非守护进程）。

### 工程落地

- `routes/video.js`：新增 `buildH3T8Workflow`——`MiniMaxH3AudioConditioningT8`（task_type
  按输入模式 T2VA/I2VA/FL2VA/L2VA 显式声明 + audio_mode native）→
  `LoraLoaderBypassModelOnly`（4 步 LoRA）→ `MiniMaxH3DualClockSamplerT8`（steps 4/8，
  shift 12/3）→ BasicGuider + SamplerCustomAdvanced → `MiniMaxH3AVDecodeT8` → CreateVideo
  → SaveVideo（输出契约不变，节点 11 / aics_video 前缀）。启动时探测真实 ComfyUI
  `object_info` 确认 T8 节点存在才启用，缺失自动回退原生路径（测试可注入 `t8Available`）。
- 依赖新增：T8 自定义节点（`custom_nodes/minimax-h3-audio-T8`，git clone）+ 4 步 LoRA
  （`minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors`，1.86GB，ModelScope
  `lightx2v/Minimax-h3-Turbo`，实测 32MB/s）；H3 requirements 同时挂 8 步（回退）与 4 步
  （主路径）两颗 LoRA。
- 下载工具：`scripts/maintenance/download-torch-cu130.ps1`（8 段并行，阿里云镜像实测
  22MB/s；单流速度实测：ModelScope 32MB/s > 阿里云 2.7MB/s > pytorch 官方 CDN 0.2MB/s、
  hf-mirror 当日 0.1–0.3MB/s——**下载前必须测速选源**）。
- 测试：T8 图结构断言（task_type 映射、4 步 LoRA、双时钟参数、AVDecode 接线、无原生
  节点残留）+ 网关级 T8 注入全流程；原生路径既有断言全部保留（默认回退）。
- 遗留：T8 的 MemoryEfficientSageAttentionPatch 在 1.18.x 未注册（示例为旧版），
  SageAttention 无 Windows 轮子——两者未启用；若未来 Sage 可装，预计再省 1.5–2×。

## ✅ Ref2VA 参考卡链路落地（2026-08-17，短片流水线实锤修复）

> 剧情短片「参考卡 → 批量 Ref2VA」链路打通（<Picture N> 身份声明 + 双角色参考图 + 尾帧衔接）。

### 疑难 1：T8 Autogrow 槽名必须带前缀点号（9 镜批量全败根因）

- **现象**：批量提交 10 镜（第 1 镜无参考图成功，其余带 references 的 9 镜全败），
  错误均为「视频生成上游暂不可用」（`/prompt` 提交成功但执行期崩溃）。
- **根因**：`buildH3T8Workflow` 把参考图写成裸槽名 `ref_image_1`，而 ComfyUI v0.30
  expression API 的 Autogrow 动态输入在 workflow JSON 中的完整名是
  `ref_images.ref_image_0`（Autogrow id 前缀点 + 模板名，序号从 0 起，见
  `comfy_api/latest/_io.py` `finalize_prefix`）。裸 `ref_image_N` 提交能过 /prompt
  schema 校验（node_errors 为空），但执行期被当成普通 kwarg 交给
  `MiniMaxH3AudioConditioningT8.execute()` → `TypeError: ... got an unexpected
  keyword argument 'ref_image_1'`。T8 官方测试
  `custom_nodes/minimax-h3-audio-T8/tests/test_visual_reference_exp.py:163` 断言
  `inputs["ref_images.ref_image_0"]` 即为正确写法。
- **修复**：`ref_image_N` → `ref_images.ref_image_{N-1}`（N 从 1 编号、槽从 0 起）。
- **验证**：单镜 probe 提交真机成功后，10 镜批量全部成功。

### 疑难 2：参考图被启动清理误删（aics_video_input_ 前缀撞车）

- **现象**：参考图上传后网关重启，批量提交报「参考图文件不存在或已过期」。
- **根因**：参考图沿用首帧前缀 `aics_video_input_`，启动时 `cleanupImageInput` 把
  无活动任务的这类文件当首帧孤儿全部删除。
- **修复**：参考图独立前缀 `aics_video_ref_`（`IMAGE_REF_PATTERN` 校验、上传
  `kind:'reference'` 用此前缀、`imageInputAvailable` 同时接受两种前缀、清理只删
  `aics_video_input_`）。

### 疑难 3：`imageInputAvailable` 只认 input 前缀导致 ref 校验恒 false

- **现象**：改用 `aics_video_ref_` 前缀后仍报「参考图文件不存在或已过期」。
- **根因**：`imageInputAvailable` 内部只用 `IMAGE_INPUT_PATTERN.test(name)`，ref 前缀
  永远 false → 即使文件在磁盘上也被拒。
- **修复**：函数内同时接受 `IMAGE_INPUT_PATTERN` 与 `IMAGE_REF_PATTERN`。

### 疑难 4：Ref2VA 双人同框，<Picture 2> 角色被前一镜尾帧覆盖（宁宁化）

- **现象**：linkLastFrame 批量衔接时，带 references 的角色切换镜头（如夏目读信）
  成片画出前一镜主角（白发宁宁），<Picture 2> 的黑发夏目从不出现。
- **根因**：参考图标签错位 + Hybrid 衔接双重叠加：
  1. 首批传 6 张卡（宁宁3+夏目3），prompt 只引用 `<Picture 1>/<Picture 2>`，两个标签
     都指向宁宁的图 → 夏目被锚成白发；
  2. 修正为每角色 1 张 face 卡（<Picture N> 严格对齐）后，linkLastFrame 仍把上一镜
     末帧写入下一镜 image → 带 references 时变 Hybrid（首帧=前主角 + 参考卡），
     首帧像素锚定压过 `<Picture 2>` 参考 → 夏目继续宁宁化。
- **修复**：
  1. 每角色只用 1 张 face 主卡，`<Picture N>` 与 ref 槽 1:1 对齐；
  2. 批量衔接：带 references 的镜头跳过尾帧衔接，保持纯 Ref2VA；
  3. Anchor 声明按参考数分行：单参考 → "exactly one character, no duplicates"；
     多参考 → "each <Picture N> is a distinct character, never swap or merge"。
- **验证**：双人 probe（无衔接纯 Ref2VA）稳定出现白发紫瞳 + 黑发金瞳红发夹两角色；
  v4/v5 全批双人镜头两角色均正确。

### 疑难 5：单人参考镜头分身（镜像复制）

- **现象**：单参考镜头（宁宁独擦杯）画面出现两名一模一样宁宁。
- **根因**：Ref2VA 单图参考时模型把参考"渲染两次"，提示词"空无一人"不足以抑制。
- **修复**：单参考 anchors 追加 "the shot contains exactly one character: <Picture 1>.
  No other people, no reflections, no duplicate or mirrored copies."
- **验证**：probe 3 帧全部唯一角色。
