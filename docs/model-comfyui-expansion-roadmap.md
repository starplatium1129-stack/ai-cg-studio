# Model and ComfyUI Expansion Roadmap

> Status: ✅ production tranche implemented (verified 2026-08-14). Later phases 1-5 below remain
> deferred — the current machine lacks the required models/detector dependencies, consistent
> with AGENTS.md "明确暂缓". Do not start them until the hardware/dependency conditions exist.

## Verified local baseline

- GPU: RTX 4070 Ti SUPER, 16 GB VRAM; RAM: 32 GB.
- ComfyUI: `E:/code/2/lora/AI/ComfyUI`, v0.31.0, revision `cd84f47e`.
- Installed: WAI v17, Anima Base v1.0, Anima Aesthetic v1.1, Krea 2 Turbo FP8, Qwen encoders/VAE, and project character LoRAs.
- Available custom nodes: Manager, `websocket_image_save.py`, and `ComfyUI-ConditioningKrea2Rebalance`.
- Not installed: ControlNet models, external upscalers, IPAdapter, Impact Pack, and face detectors.

## Primary references

- https://huggingface.co/LyliaEngine/waiIllustriousSDXL_v170
- https://arxiv.org/abs/2409.19946
- https://civitai.com/models/2458426/anima
- https://github.com/krea-ai/krea-2
- https://docs.comfy.org/tutorials/image/krea/krea-2
- https://huggingface.co/Comfy-Org/Krea-2
- https://docs.comfy.org/development/comfyui-server/comms_routes
- https://docs.comfy.org/development/comfyui-server/api-examples
- https://docs.comfy.org/built-in-nodes/CreateHookLora
- https://docs.comfy.org/built-in-nodes/ConditioningSetProperties

## Production tranche implemented

- WAI model and WebUI checkpoint metadata are allowlisted and truthful; Comfy is preferred when the request is compatible.
- WAI Comfy hires uses the built-in latent `nearest-exact` path with bounded scale, area, steps, and denoise values.
- Scene and blueprint semantics automatically select model-native style language in one-click mode. Expert mode may add up to two curated artist tags with family-native rendering.
- Krea 2 official Style LoRAs remain server allowlisted for controlled API experiments, but the one-click drawing flow does not expose or submit them.
- Prompt Builder drafts/history ignore legacy free-form `artistInfluences` and `kreaStyleId`, but persist the new allowlisted `artistStyleIds` expert selection.
- WAI profile selection enables adaptive 1.5x hires (20 second-pass steps, denoise 0.4): WebUI uses Anime6B, Comfy uses nearest-exact latent, and unsupported environments keep the audited direct bucket. Existing artifacts do not prove latent visually superior, so it is a fallback rather than the universal default.

## Later phases

1. Gallery img2img variation.
2. Separate inpaint/outpaint editor.
3. Install and validate ControlNet pose/lineart models.
4. Optional pinned IPAdapter after model and VRAM validation.
5. Tiled 4K export.

Video and dependency-heavy face detailers are explicitly deferred. The current machine does not have the required models or detector dependencies, so this tranche does not advertise them.

## Anima-2.9B 调研记录（2026-08-14，暂缓）

> 决策：preview v1 为训练中途快照（README 标注 "Training in progress"），**暂不下载接入**；待作者完成 10M 样本预训练/正式版，或 OneTrainer 支持 40 层架构 LoRA 训练后再评估。以下为已核实事实与接入预案。

### 模型事实（来源已核实）

- 仓库：https://huggingface.co/Gazingstars123/Anima-2.9B （`Anima-2.9B-preview-v1.safetensors`，5.44 GB，diffusion-single-file）
- 作者 Gazingstars123（与 custom node 同作者）：基于 `circlestone-labs/Anima` 的 finetune + **层扩展**（LLaMA Pro block expansion，arXiv 2401.02415）：transformer 28 层 → 40 层，~2.9B 参数；新层由复制邻近层权重 + 零化输出投影初始化，初始等价于 Anima-base
- 训练：额外 1.7M 动漫/插画样本、Muon、8×5080 集群、知识截止 2026-07（远新于 base 的 2025-09）；70% 算力 1024px；**无 score 标签**；混合标签+自然语言 caption
- 角色：通用 Danbooru 标签体系，认识大量系列/角色（"无 LoRA 出更多角色"属实）；README 强调角色名必须跟系列/版权标签否则混淆；提示词越详细越好
- 推荐参数：euler/res-multistep/er-sde + sgm-uniform/beta/linear-quadratic；28-50 steps；CFG 3.5-5；812×1216 / 1152×1536
- 许可：CircleStone Labs Non-Commercial License（衍生模型），本地个人使用 OK
- 必装补丁：https://github.com/gazingstars123/ComfyUI-Anima-2.9B （custom node，启动时 patch `detect_unet_config` 按实际 block 数修正 `num_blocks`，无 workflow 节点，兼容所有 Anima 系）

### 项目接入预案（下载后执行）

1. 模型放 `ComfyUI/models/unet/`，custom node 克隆到 `ComfyUI/custom_nodes/`，重启 ComfyUI；文本编码器/VAE 复用现有 qwen_3_06b_base + qwen_image_vae（同 Anima 系）
2. 三组实测：① 无 LoRA 宁宁提示词（含系列标签）裸出 vs unified e16（Aesthetic 底模）还原度对比；② unified e16 LoRA 直接加载兼容性（预期层名不匹配不生效/报错）；③ 同 seed 同提示词 Aesthetic 1.1 vs 2.9B 基础画质对比
3. 若 LoRA 不兼容且裸出还原度不达标：等作者 Standalone Trainer（README 称 a few days）或 OneTrainer 支持 40 层架构后重训 LoRA；项目生产暂维持 Aesthetic v1.1 + unified e16

### 风险提示

- preview 为训练中途状态，后续版本会继续演进（10M 样本预训练 + 动漫数据扩展），正式版前不建议作为生产底模
- 2.9B 无 score 标签训练，与项目 WAI/Anima 质量前缀约定的交互需实测（README 称 score 标签仍可用）
- 40 层架构 = 推理更慢、VRAM 更高（bf16 ~6GB，4070 Ti SUPER 16GB 可跑）
