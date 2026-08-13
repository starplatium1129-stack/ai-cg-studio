# 本地 AI 视频创作路线

> 更新日期：2026-08-13
> 产品定位：个人本地创作；ComfyUI 负责执行，应用负责稳定、低门槛的创作体验。
> 当前状态：P1 已落地；真实 GPU 出片与 I2V 暂缓。

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
| MiniMax H3 | 本地 768p、原生立体声音频的高上限最终成片路线 | 官方 ComfyUI 模板已存在，适配器与本机重型模型实测待完成 |
| Wan 2.2 14B | 更高质量 T2V / I2V / 首尾帧 | 待本机资源、耗时和工作流验证 |
| HunyuanVideo 1.5 | 720p 与超分质量路线 | 待本机资源、耗时和工作流验证 |
| LTX-2.3 | 快速预演、音视频和首尾帧扩展 | 待官方子图 API 适配 |

当前默认选择 Wan 2.2 TI2V 5B，原因是官方 ComfyUI 模板原生支持 T2V/I2V，且 5B 路线更符合本机 RTX 4070 Ti SUPER 16GB 的第一阶段稳定性目标。模型效果、速度和显存结论必须在权重安装后通过真实 GPU 出片记录，不在代码交付阶段提前宣称。

MiniMax H3 的能力上限更高：本地 Base 支持 T2V、首/尾帧和原生 32kHz 立体声音频，输出最长 15 秒；但本地开源链路默认是 768p，完整 2K 依赖尚未开源的 Regenerate 模块或官方 API。Comfy-Org 的最小量化组合约 42.5GB（约 21GB diffusion model + 15.7GB text encoder + 5.2GB video VAE + 0.6GB audio VAE），因此产品定位为“Wan 快速预演 → H3 最终成片”，不把 H3 设为每次生成的默认模型。

## 已落地：P1 · 文字成片最小闭环

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
- 并发上限为 2，单任务超时 45 分钟；取消使用 prompt-id 定向取消，不调用全局 interrupt。

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

## 后续阶段

### P2 · 图生视频

- 从作品册选择图片作为首帧，不要求用户手动找文件路径。
- 服务端负责将受信任的作品转存/上传到 ComfyUI input。
- 同一页面继续复用镜头、运动、时长和队列。
- 首先适配 Wan 2.2 TI2V 5B I2V；通过身份稳定性审核后再开放。

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
