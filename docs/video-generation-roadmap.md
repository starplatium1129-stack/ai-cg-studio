# 视频生成接入路线（MiniMax H3 × ComfyUI）

> 记录日期：2026-08-04
> 对标：MiniMax H3（2026-07-31 发布，08-03 开源）与 ComfyUI 原生工作流（docs.comfy.org/tutorials/video/minimax/minimax-h3）
> 产品前提：本地个人使用为主；视频生成是新增能力，不改变现有出图/配音/聊天链路。
> 状态：全部阶段暂缓。经批准后按 P0 → P3 顺序逐阶段启动，每阶段独立验收、不串阶段。

## 结论

H3 是通用全模态生成模型（文本/图像/视频/音频统一理解，输出带原生立体声的视频，最高 15s / 2K）。ComfyUI ≥ 0.30.0 原生支持，量化剪枝后（int8 convrot + nvfp4 AWQ text encoder）最小组合约 42.5GB，官方声称 12GB 显存（RTX 3060）+ 64GB 系统 RAM 动态卸载可跑，本机原生画布为短边 768px（2K 需官方 API 的 Regenerate pass，不在本地范围内）。

接入路径确定为 **ComfyUI 网关适配器**：新增 `/comfyui` 白名单代理 + `routes/video.js` 服务（工作流模板化组装、任务队列、产物转存）+ 前端 `VideoStudio` 面板。不做 MiniMax 官方 API（付费、云端、与本地个人使用定位冲突）。

## 外部依赖（不在仓库内，先手动装好）

| 项 | 要求 | 说明 |
|---|---|---|
| ComfyUI | ≥ 0.30.0 | H3 原生节点，无需自定义节点；模板库自带 T2V / I2V / R2V 三套工作流 |
| 权重 | 4 个文件 ≈ 42.5GB | 来源 `Comfy-Org/MiniMax-H3`（HF） |
| 硬件 | 12GB 显存 + 64GB RAM | 3060 可跑（官方声称，动态卸载）；速度待实测 |
| 可选加速 | SageAttention + KJNodes | 约 2x 速度，质量损失极小；`Patch Sage Attention KJ` 接在 UNETLoader 与 BasicGuider 之间 |

权重落位（官方目录约定）：

```
ComfyUI/models/
├── diffusion_models/ minimax_h3_fl2va_pruned_int8_convrot.safetensors   # ~21GB，T2V + 首尾帧 I2V
├── text_encoders/    qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors        # ~15.7GB
└── vae/              minimax_h3_video_vae_fp16.safetensors               # ~5.2GB
                      minimax_h3_audio_vae_fp32.safetensors               # ~0.6GB
```

R2V（参考生视频）另需 `minimax_h3_ref2va_pruned_int8_convrot.safetensors`（~21GB，选装）。

规格约束（写入服务端参数校验）：短边 768px 上限 768×1344、宽高取 32 倍数；24fps；时长吸附 17k+5 帧网格（≈0.7s/块）；音频为模型原生生成，无需叠加现有 TTS。

## 分阶段计划

### P0：环境搭建与可行性验证（纯手动，无代码）

- 安装 ComfyUI ≥ 0.30.0，下载 4 个权重（共 42.5GB）按上表落位。
- 模板库加载官方 "MiniMax H3 T2V" 工作流，跑一条 5s / 768p（推荐 832×480）记录：总耗时、峰值 VRAM/RAM、输出质量。
- 可选：装 SageAttention + KJNodes 对比速度。
- 验收：本机 3060 单条生成时间可接受（目标 ≤ 15 分钟/条）才继续 P1；超时则降级为「仅 API 方案」或暂停。
- 同时确认：Community License 条款（商用免费但需显示 "MiniMax H3" 标识；年营收 >$20M 需书面授权；适用地域排除欧盟/英国/韩国/美国——国内个人使用不受影响）。

### P1：网关白名单代理 + 最小 T2V 服务

- `server.js` 新增 `COMFY_PROXY_ALLOWLIST`（仿照 `SD_PROXY_ALLOWLIST`，server.js:28）：
  - `POST /comfyui/prompt`、`GET /comfyui/history/{id}`、`GET /comfyui/view`、`GET /comfyui/object_info`
- **安全约束（硬性）**：ComfyUI `/prompt` 接受任意工作流图 = 任意代码执行风险，**禁止裸透传**。只能由服务端按内置模板组装 API 格式 prompt 后提交；白名单外路径 JSON 404；沿用 `tokenAuth` + `hostGuard` + rateLimit + 统一错误信封。
- 新增 `routes/video.js`：
  - 内置 T2V 工作流模板（取自 `Comfy-Org/workflow_templates` 的 `video_minimax_h3_t2v.json` 核心节点）。
  - 参数白名单契约（仿训练台）：`prompt / width / height / length / seed`；未知 key、非数字、越界一律 400。
  - 任务队列 + 状态轮询（仿 training 任务模型），完成后从 `/view` 拉取 mp4 转存 `runtime/media/`，经 `/video-media` 静态服务回放（不直接暴露 ComfyUI output 目录）。
- 验收：`test-video-routes.js` 进 validate（断言真实 HTTP 路由输出：白名单/越界 400/未启动 502/产物转存）；`typecheck` + `build` 通过。

### P2：VideoStudio 前端面板

- 新视图（独立路由或并入绘图页侧栏，待定）：T2V 表单（prompt 可复用现有场景/词条组装逻辑 + 时长/分辨率/比例）。
- 队列面板：提交、进度轮询、完成通知、`<video>` 预览。
- 历史：IndexedDB 扩展（仿 `useImageStore`），视频元数据 + 产物引用。
- 长任务提示：3060 单条分钟级，必须有明确进度与失败恢复路径。
- 验收：定向 E2E（提交→轮询→预览 mock 链路）+ 视觉回归自查。

### P3：I2V 图生视频（+ R2V 选装）

- I2V：`first_frame`/`last_frame` 输入复用现有出图链路（GalleryView/绘图页产物上传 → ComfyUI `/upload/image`），一个工作流覆盖 T2V/I2V。
- R2V：参考图/视频/音频驱动（锁角色/风格/动作/运镜/音色），需要 ref2va 权重 + 更多输入材料，作为选装阶段。
- 验收：图生视频 round-trip E2E。

## 待验证问题（P0 必须回答）

1. 3060 实测单条生成时间与稳定性（官方声称 vs 实测；动态卸载时 CPU 内存带宽是否成瓶颈）。
2. 分钟级任务的网关轮询策略与 `proxyTimeout`（现 SD 代理为 20 分钟，视频任务应放宽）。
3. 产物文件体积与磁盘增长策略（几秒 768p mp4 的典型大小；是否需要清理/配额）。
4. `runtime/media/` 是否纳入备份与清理范围（当前备份体系只覆盖 localStorage/IndexedDB）。

## 不做（本阶段）

- MiniMax 官方 API（付费云端；2K 完整工作流依赖它，但本地定位优先，P0 测速后再定）。
- 直接暴露 ComfyUI 本体（不映射 `/comfyui` 以外的任意路径，不提供 ComfyUI Web UI 代理）。
- 把 H3 的音频接入现有配音链路（视频自带立体声，与 GPT-SoVITS 角色配音互不干预）。
- 任何不经过服务端模板组装的用户自定义工作流提交。
