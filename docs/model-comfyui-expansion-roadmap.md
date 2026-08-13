# Model and ComfyUI Expansion Roadmap

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
