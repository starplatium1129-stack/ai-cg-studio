# Anima v19 LoRA Checkpoint Audit

## Conclusion

- Do not retrain from scratch now.
- Reject the previously deployed final epoch 45 checkpoint.
- Promote epoch 20 / step 1100 as the production file behind `L_NENE_V19_ANIMA`.
- Keep Anima experimental. This audit validates the selected checkpoint, not the entire engine as a stable release.

## Why The First Selection Was Wrong

The original training ran for 45 epochs over 55 images and selected the final file without a checkpoint sweep. Its configuration also differed materially from the clean OneTrainer Anima preset:

| Setting | Original run | OneTrainer Anima preset / clean default |
|---|---:|---:|
| Learning rate | `1e-4` | `3e-5` |
| LoRA rank | `16` | `16` |
| LoRA alpha | `16` | `1` clean default |
| Batch size | `1` | `2` |
| LoRA dropout | `0` | default `0`, but available for overfit control |
| Crop jitter | disabled | enabled by clean concept default |
| Validation | enabled in config, but no validation scalar/data evidence | requires a real validation concept |

The dataset contains 55 files but only 25 visual groups; 11 groups have three near-duplicate variants. The final epoch therefore had enough capacity and update strength to memorize pose and composition while retaining sharp identity details.

TensorBoard contained 2475 training-loss points but no validation-loss series. Training loss alone did not identify the visual overfit.

## Checkpoint Sweep

Preserved checkpoints at epochs 10 and 20 were exposed to local ComfyUI under audit-only filenames. `scripts/tests/evaluate-anima-checkpoints.js` reused `routes/anima.js::buildWorkflow()` and changed only the local LoRA filename.

Audit inputs:

- Scenes: `sc260` through `sc265`.
- Seeds: `20260809`, `20260810`, `20260811`.
- Checkpoints: epoch 10, epoch 20, epoch 45.
- Model: `anima-base-v1.0`.
- Weight: `0.85`.
- Resolution: `1216x832`.
- Sampling: 24 steps, CFG 3, `res_multistep` / `simple`.

Evidence:

- `E:\code\2\lora\AI\Reviews\AnimaV19CheckpointAudit\2026-08-09_e10_e20\manifest.json`
- `E:\code\2\lora\AI\Reviews\AnimaV19CheckpointAudit\2026-08-09_e10_e20\contact_sheets\`
- `E:\code\2\lora\AI\Reviews\AnimaV19CheckpointAudit\2026-08-09_e10_e20\diversity-metrics.json`

Findings:

- Epoch 10 retained the most freedom but underfit identity accessories, hands and complex props in several scenes.
- Epoch 45 produced the sharpest isolated details but showed late-stage line hardening and reduced seed diversity, most visibly in pajamas, witch-action and moonlit-bedroom scenes.
- Epoch 20 retained the official face, ahoge, ribbons and outfit controls while preserving materially more pose and framing variation than epoch 45.

## Production Revalidation

The epoch 20 checkpoint was promoted without overwriting its source or deleting the rejected checkpoint:

- Production file: `ComfyUI/models/loras/ayachi_nene_v19_anima.safetensors`.
- Selected SHA-256: `eb0a29dfbe0a80ea9fd63d874fdb49ac92ff8f6d3aedb91637c9141c807e9bb9`.
- Rejected epoch 45 backup: `ComfyUI/models/loras/ayachi_nene_v19_anima_e45_rejected.safetensors`.
- Rejected SHA-256: `76cb802d55d4a414cdf9305d616f9a6409f50d09b5fd417b47c9ec493636fb44`.

The complete matrix was then regenerated through the production `/api/anima/*` route. Existing SD v18 baseline files were reused only after byte-size and SHA-256 verification.

Results:

- Anima epoch 20: 18/18 pass.
- Identity and official features: 18/18 pass.
- Against SD v18: 16 wins, 2 ties, 0 losses.
- Safe scenes: 12/12 without adult leakage.
- R18 scenes: 6/6 activated only under the adult condition.
- Remaining limitation: camera and composition diversity is still lower than SD v18 within one prompt family.

Production evidence:

- `E:\code\2\lora\AI\Reviews\AnimaV19VisualMatrix\2026-08-09_6x3_e20\manifest.json`
- `E:\code\2\lora\AI\Reviews\AnimaV19VisualMatrix\2026-08-09_6x3_e20\manual-review.json`
- `E:\code\2\lora\AI\Reviews\AnimaV19VisualMatrix\2026-08-09_6x3_e20\contact_sheets\`

## Future Retraining Trigger

Retrain only if broader scene coverage reveals identity failure, safe/R18 leakage, or unacceptable composition locking. A future run must use an Anima-specific train/validation split, checkpoint selection rather than final-epoch selection, and at minimum a learning-rate/alpha sweep around the official preset. It must never overwrite the selected epoch 20 model before passing the same production matrix.
