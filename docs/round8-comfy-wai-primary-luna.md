# Round 8: Unified Generation API + Comfy Basic Fallback

Date: 2026-08-10

## Delivered

- `sd` remains the WAI prompt family and existing drawing modes, queue, history, voice, and settings remain in place.
- Basic WAI txt2img now submits only to `/api/generation/jobs`; WebUI/reForge is the production primary and the server owns a fixed Comfy basic fallback graph.
- The fixed graph uses `CheckpointLoaderSimple`, optional allowlisted `LoraLoader` nodes, two `CLIPTextEncode` nodes, `EmptyLatentImage`, `KSampler`, `VAEDecode`, and `SaveImage` node `10`.
- The existing Anima Comfy lifecycle is parameterized and reused for WAI job ownership, polling, targeted cancellation, TTL, output validation, and one-shot result consumption.
- Provider choice is made by preflight: WebUI online always wins. Only a basic request with WebUI explicitly offline and Comfy online may use Comfy. `faceDetailer` and `hiresFix` require WebUI and fail clearly when WebUI is offline.
- No WebUI long request is followed by a Comfy retry. Once a Comfy prompt is submitted, failures remain Comfy failures.
- Browser access to Comfy native routes remains blocked. No raw graph, class type, node input, checkpoint path, or arbitrary LoRA path is accepted.

## Capability Matrix

| Capability | Provider | Notes |
| --- | --- | --- |
| WAI basic txt2img, WebUI online | WebUI primary | Existing production path and performance retained |
| WAI basic txt2img, WebUI offline + Comfy online | Comfy fallback | Fixed core-node graph, checkpoint and LoRA allowlists |
| WAI hires fix | WebUI only | Fails with `WEBUI_REQUIRED_OFFLINE` when unavailable |
| WAI face/hand detailer | WebUI only | ADetailer is preserved and never silently dropped |
| Unsupported sampler/scheduler | WebUI if supported; otherwise explicit failure | Comfy is not selected while WebUI is online |
| Comfy prompt accepted, later error/timeout | Comfy only | No duplicate GPU submission |
| Anima | Existing `/api/anima/*` behavior | Nene production catalog unchanged; no Natsume Anima integration |

## Real Smoke Evidence

Evidence directory: `E:/code/2/lora/AI/Reviews/WAIComfyRound8`

- `nene-basic-seed-4242.png` and JSON: Comfy basic, 832x1216, fixed seed 4242, 118080 ms, 1,158,684 bytes.
- `natsume-basic-seed-4243.png` and JSON: Comfy basic, 832x1216, fixed seed 4243, 59481 ms, 1,163,449 bytes.
- `nene-webui-seed-4242.png` and JSON: reForge WebUI comparison, same semantic prompt and seed, 9363 ms, 1,131,544 bytes.
- `natsume-webui-seed-4243.png` and JSON: reForge WebUI comparison, same semantic prompt and seed, 8197 ms, 1,167,149 bytes.
- `app-fallback-nene-seed-424242.png` and JSON: real `/api/generation/jobs` fallback smoke with an app-style `<lora:...>` prompt, WebUI preflight offline, Comfy selected, 1,169,386 bytes.

The two Comfy images were inspected individually. They were usable, but showed finger fusion and weaker identity details than the WebUI counterparts; Nene also did not stably show the low twin tails/pink ribbons. The WebUI images were faster and visually stronger overall. This evidence is why production priority remains WebUI; it does not justify lowering WebUI priority. The Natsume WAI LoRA is a hard link from `AI/Data/Models/Lora`, not a repository copy.

## Verification

- `node scripts/tests/test-generation-routes.js`
- `npm run typecheck:app`
- `npm run build`
- Playwright `flows.spec.ts` basic WAI, hires/detailer WebUI fallback, and queue tests passed.
- `git diff --check` passed.

## Known Limits

- Comfy fallback requires WebUI preflight to be offline and Comfy preflight to be online. It does not cross-provider retry after submission.
- Comfy CLIP text removes all `<lora:...>` tags; WebUI payloads preserve the original tags. Unknown or mismatched tags fail closed for Comfy fallback.
- WebUI fallback is still the compatibility path for ADetailer and hires. The WebUI endpoint remains allowlisted and the control-panel lifecycle is unchanged.
