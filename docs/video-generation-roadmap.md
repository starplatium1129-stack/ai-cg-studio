# 本地 AI 视频创作路线

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
